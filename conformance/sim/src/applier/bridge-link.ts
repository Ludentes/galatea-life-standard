import { randomUUID } from "node:crypto";
import { validate, type BridgeAck, type BridgeDeviceStatus } from "@ludentes/galatea-life-schemas";
import type { Clock } from "@ludentes/galatea-life-test-clock";
import { connectAsync, type MqttClient } from "mqtt";
import type { BridgeDeviceDoc } from "./model.js";

export type LinkEvent =
  | { kind: "devices"; bridge: string; devices: BridgeDeviceDoc[] }
  | { kind: "device-status"; bridge: string; device: string; status: BridgeDeviceStatus }
  | { kind: "ack"; bridge: string; device: string; ack: BridgeAck }
  | { kind: "liveness"; bridge: string; alive: boolean }
  | { kind: "fault"; bridge: string; what: string };

interface Bridge {
  id: string;
  identity: string;
  alive: boolean;
  faulted: boolean;
  instanceId?: string;
  lastStatusAt?: number;
  transports: Record<string, unknown>[];
}

const DEAD_AFTER_MS = 30_000;

export class BridgeLink {
  private client?: MqttClient;
  private readonly bridges = new Map<string, Bridge>();
  private timer?: number;

  constructor(private readonly opts: {
    brokerUrl: string; identity: string; root: string; clock: Clock; onEvent: (e: LinkEvent) => void;
  }) {}

  async connect(): Promise<void> {
    this.client = await connectAsync(this.opts.brokerUrl, {
      protocolVersion: 5, username: this.opts.identity, clientId: `${this.opts.identity}-${randomUUID()}`,
      keepalive: 10, clean: true, reconnectPeriod: 1000,
    });
    this.client.on("error", () => undefined);
    this.client.on("message", (topic, payload, packet) => {
      // Nothing a bridge publishes may take the applier down: a handler's exception is logged, not thrown.
      try {
        this.onMessage(topic, payload, packet.retain);
      } catch (err) {
        console.error(err);
      }
    });
    const check = () => {
      this.timer = this.opts.clock.setTimeout(check, 1000);
      const now = this.opts.clock.now();
      for (const b of this.bridges.values()) {
        if (b.alive && b.lastStatusAt !== undefined && now - b.lastStatusAt > DEAD_AFTER_MS) this.setAlive(b, false);
      }
    };
    this.timer = this.opts.clock.setTimeout(check, 1000);
  }

  async add(bridge: string, identity: string): Promise<void> {
    this.bridges.set(bridge, { id: bridge, identity, alive: false, faulted: false, transports: [] });
    await this.client!.subscribeAsync(`${this.opts.root}/bridges/${identity}/#`, { qos: 1 });
  }

  async remove(bridge: string): Promise<void> {
    const b = this.bridges.get(bridge);
    if (!b) return;
    this.bridges.delete(bridge);
    await this.client!.unsubscribeAsync(`${this.opts.root}/bridges/${b.identity}/#`);
  }

  alive(bridge: string): boolean {
    return this.bridges.get(bridge)?.alive ?? false;
  }

  transports(bridge: string): Record<string, unknown>[] {
    return this.bridges.get(bridge)?.transports ?? [];
  }

  /** Publishes a command at QoS 1 with Message Expiry; resolves on the broker's PUBACK. */
  async send(bridge: string, device: string, command: Record<string, unknown>, resultWithinMs: number): Promise<void> {
    const b = this.bridges.get(bridge);
    if (!b) throw new Error(`no bridge ${bridge}`);
    await this.client!.publishAsync(`${this.opts.root}/bridges/${b.identity}/devices/${device}/command`, JSON.stringify(command), {
      qos: 1, properties: { messageExpiryInterval: Math.max(1, Math.ceil(resultWithinMs / 1000)) },
    });
  }

  async close(): Promise<void> {
    if (this.timer !== undefined) this.opts.clock.clear(this.timer);
    await this.client?.endAsync();
  }

  private onMessage(topic: string, payload: Buffer, retained: boolean): void {
    const prefix = `${this.opts.root}/bridges/`;
    if (!topic.startsWith(prefix)) return;
    const [identity, ...rest] = topic.slice(prefix.length).split("/");
    const b = [...this.bridges.values()].find((x) => x.identity === identity);
    if (!b) return;
    let body: Record<string, unknown> | null = null;
    if (payload.length) {
      try {
        body = JSON.parse(payload.toString());
      } catch {
        this.fault(b, `${rest.join("/")} is not JSON`);
        return;
      }
    }
    const path = rest.join("/");
    if (path === "status" && body) return this.onStatus(b, body, retained);
    const device = path.match(/^devices\/([^/]+)\/(status|ack)$/);
    const schema = path === "lwt" ? "bridge/lwt.json" : path === "devices" ? "bridge/devices.json"
      : device?.[2] === "status" ? "bridge/device-status.json" : device?.[2] === "ack" ? "bridge/ack.json" : undefined;
    if (schema && body) {
      const errors = validate(schema, body);
      if (errors.length) {
        this.fault(b, `an invalid ${path}: ${errors.join("; ")}`);
        return;
      }
    }
    if (path === "lwt" && body) {
      if (body.instanceId === b.instanceId) {
        this.fault(b, "its will");
        this.setAlive(b, false);
      }
      return;
    }
    if (path === "devices" && body) {
      this.opts.onEvent({ kind: "devices", bridge: b.id, devices: (body.devices ?? []) as BridgeDeviceDoc[] });
      return;
    }
    if (!device || !body) return;
    if (device[2] === "status") {
      // The schema's pattern admits a date that does not exist (2030-13-45); such a time is as bad as none.
      const times = [body.timestamp, ...Object.values((body.timestamps ?? {}) as Record<string, unknown>)];
      if (times.some((t) => Number.isNaN(Date.parse(String(t))))) {
        this.fault(b, `an invalid ${path}: a timestamp that is not a date`);
        return;
      }
      this.opts.onEvent({ kind: "device-status", bridge: b.id, device: device[1]!, status: body as BridgeDeviceStatus });
    } else if (body.source !== b.identity) {
      this.fault(b, `an ack from ${String(body.source)}`);
    } else {
      this.opts.onEvent({ kind: "ack", bridge: b.id, device: device[1]!, ack: body as BridgeAck });
    }
  }

  /** GA-BUS-14: a bad status is a fault and kills the bridge until a valid one arrives live. */
  private onStatus(b: Bridge, s: Record<string, unknown>, retained: boolean): void {
    const bad = s.v === undefined ? "a status without v"
      : s.v !== 1 ? `a status with v ${String(s.v)}`
      : s.bridgeId !== b.identity ? `a status naming ${String(s.bridgeId)}`
      : validate("bridge/status.json", s).map((e) => `an invalid status: ${e}`).join("; ") || undefined;
    if (bad) {
      if (!b.faulted) this.fault(b, bad);
      b.faulted = true;
      this.setAlive(b, false);
      return;
    }
    if (b.faulted && retained) return;
    b.faulted = false;
    b.instanceId = s.instanceId as string;
    b.lastStatusAt = this.opts.clock.now();
    b.transports = (s.transports ?? []) as Record<string, unknown>[];
    this.setAlive(b, !(s.state === "offline" && s.graceful === true));
  }

  private fault(b: Bridge, what: string): void {
    this.opts.onEvent({ kind: "fault", bridge: b.id, what });
  }

  private setAlive(b: Bridge, alive: boolean): void {
    if (b.alive === alive) return;
    b.alive = alive;
    this.opts.onEvent({ kind: "liveness", bridge: b.id, alive });
  }
}
