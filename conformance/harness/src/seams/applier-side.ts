import { randomUUID } from "node:crypto";
import { validate } from "@ludentes/galatea-life-schemas";
import { connectAsync, type MqttClient } from "mqtt";
import type { BridgeWatcher, Seen } from "./bridge-watcher.js";

/** Every request other than a command expires in the broker after this (bridge, *Message Expiry*). */
export const REQUEST_EXPIRY_S = 10;

/**
 * The results that end a command (bridge, *The ack*); a non-terminal `received` MAY come before
 * one, and the applier ignores it.
 */
export const TERMINAL_ACK_RESULTS: readonly string[] = ["applied", "sent", "failed", "unsupported"];
/** The one result an ack may carry before the terminal one (*The ack*). */
export const NON_TERMINAL_ACK = "received";

export interface CommandOptions {
  /** The command's bound; 10 s unless given. */
  resultWithinMs?: number;
  /** When the commander issued it, on the harness's time source; now unless given. */
  issuedAt?: number;
  commandId?: string;
  /** Envelope fields the standard does not define, which a bridge ignores (GA-BRIDGE-4); the envelope's own win. */
  extra?: Record<string, unknown>;
  /** Published retained, as no applier would (GA-BRIDGE-19); `clearRetained` clears it. */
  retain?: boolean;
}

/**
 * The harness as the bridge's applier (bridge, *The MQTT binding*): it publishes commands on
 * `devices/{d}/command`, with Message Expiry of their `resultWithinMs` rounded up to whole seconds,
 * and requests on `request/{op}` with 10 s, not retained unless a test asks for it (`retain`, as no
 * applier would, GA-BRIDGE-19), and reads the acks, replies and events the bridge publishes through
 * the test's watcher.
 */
export class ApplierSide {
  /** The topics this side published retained, for `clearRetained`. */
  private readonly retained = new Set<string>();

  private constructor(
    private readonly client: MqttClient,
    private readonly base: string,
    private readonly watch: BridgeWatcher,
    private readonly now: () => number,
  ) {}

  /** `base` is the bridge's tree, `{root}/bridges/{b}`; `now` the harness's time source. */
  static async start(url: string, base: string, watch: BridgeWatcher, now: () => number): Promise<ApplierSide> {
    const client = await connectAsync(url, { protocolVersion: 5, username: "galatea-harness", clean: true });
    return new ApplierSide(client, base, watch, now);
  }

  /** Publishes a command for device `device`, `value` being its `{ action, value?, state? }`; returns its `commandId`. */
  async command(device: string, value: Record<string, unknown>, opts: CommandOptions = {}): Promise<string> {
    const resultWithinMs = opts.resultWithinMs ?? 10_000;
    const body = { ...opts.extra, commandId: opts.commandId ?? randomUUID(),
      issuedAt: new Date(opts.issuedAt ?? this.now()).toISOString(), resultWithinMs, value };
    const errors = validate("bridge/command.json", body);
    if (errors.length) throw new Error(`the harness built a bad command: ${errors.join("; ")}`);
    const topic = `${this.base}/devices/${device}/command`;
    if (opts.retain) this.retained.add(topic);
    await this.client.publishAsync(topic, JSON.stringify(body),
      { qos: 1, retain: opts.retain ?? false, properties: { messageExpiryInterval: Math.max(1, Math.ceil(resultWithinMs / 1000)) } });
    return body.commandId;
  }

  /**
   * Publishes a request `op` with its fields, which never replace `requestId` or `issuedAt`; returns
   * its `requestId`. `retain` publishes it retained, as no applier would (GA-BRIDGE-19).
   */
  async request(op: string, fields: Record<string, unknown> = {}, requestId: string = randomUUID(),
    opts: { retain?: boolean } = {}): Promise<string> {
    const body = { ...fields, requestId, issuedAt: new Date(this.now()).toISOString() };
    const errors = validate("bridge/request.json", body);
    if (errors.length) throw new Error(`the harness built a bad request: ${errors.join("; ")}`);
    const topic = `${this.base}/request/${op}`;
    if (opts.retain) this.retained.add(topic);
    await this.client.publishAsync(topic, JSON.stringify(body),
      { qos: 1, retain: opts.retain ?? false, properties: { messageExpiryInterval: REQUEST_EXPIRY_S } });
    return requestId;
  }

  /** Publishes `body` as it is on `{base}/{path}`, QoS 1 and not retained: a message no applier would send (GA-BRIDGE-10). */
  async raw(path: string, body: string): Promise<void> {
    await this.client.publishAsync(`${this.base}/${path}`, body, { qos: 1, retain: false });
  }

  /** Clears every command and request this side published retained. */
  async clearRetained(): Promise<void> {
    for (const topic of this.retained) await this.client.publishAsync(topic, "", { qos: 1, retain: true });
    this.retained.clear();
  }

  /** The ack of the command on its device's `ack` topic, seen after `from`, within `ms`. */
  ack(device: string, commandId: string, ms: number, from = 0): Promise<Seen> {
    return this.watch.waitFor((s) => s.topic === `${this.base}/devices/${device}/ack` && s.payload?.commandId === commandId, ms, from);
  }

  /**
   * The terminal ack of the command, seen after `from`, within `ms`: a non-terminal `received` before
   * it is passed over. An ack whose result is neither is taken as the terminal one, so that a test
   * which validates it fails on its form, not by waiting out its time.
   */
  terminalAck(device: string, commandId: string, ms: number, from = 0): Promise<Seen> {
    return this.watch.waitFor((s) => this.isTerminalAck(s, device, commandId), ms, from);
  }

  /** Every terminal ack of the command seen after `from`. */
  terminalAcks(device: string, commandId: string, from = 0): Seen[] {
    return this.watch.seen.slice(from).filter((s) => this.isTerminalAck(s, device, commandId));
  }

  private isTerminalAck(s: Seen, device: string, commandId: string): boolean {
    return s.topic === `${this.base}/devices/${device}/ack` && s.payload?.commandId === commandId
      && s.payload.result !== NON_TERMINAL_ACK;
  }

  /** The reply to the request, seen after `from`, within `ms`. */
  reply(requestId: string, ms: number, from = 0): Promise<Seen> {
    return this.watch.waitFor((s) => s.topic === `${this.base}/reply` && s.payload?.requestId === requestId, ms, from);
  }

  /** Every event the bridge published after `from`, of `type` where given. */
  events(type?: string, from = 0): Record<string, any>[] {
    return this.watch.seen.slice(from).filter((s) => s.topic === `${this.base}/event` && s.payload !== null
      && (type === undefined || s.payload.type === type)).map((s) => s.payload);
  }

  /** The first event after `from` that `pred` holds for, within `ms`. */
  event(pred: (e: Record<string, any>) => boolean, ms: number, from = 0): Promise<Seen> {
    return this.watch.waitFor((s) => s.topic === `${this.base}/event` && s.payload !== null && pred(s.payload), ms, from);
  }

  close(): Promise<void> {
    return this.client.endAsync();
  }
}
