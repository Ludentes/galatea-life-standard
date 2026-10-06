import { randomUUID } from "node:crypto";
import { validate, type HarnessTestControl } from "@ludentes/galatea-life-schemas";
import type { Clock } from "@ludentes/galatea-life-test-clock";
import { connectAsync, type MqttClient } from "mqtt";
import { bridgeDoc, device, fixtureDevices, type FixtureDevice } from "../fixture.js";
import { capabilityKeys, fromWire, setsOf } from "../vocabulary.js";

export interface BridgeFaults {
  noV?: boolean;
  noWill?: boolean;
  clockSkewMs?: number;
  /** The `faults` entries every status carries while they stand, as a bridge's own faults do. */
  statusFaults?: { code: string; device?: string; topic?: string; detail?: string }[];
  /** The ways its doer changes a device unseen that it declares in every status (GA-BRIDGE-32); none by default. */
  ungoverned?: string[];
}

export interface SimBridgeOptions {
  brokerUrl: string;
  root: string;
  bridgeId: string;
  clock: Clock;
  runId?: string;
  controlTopic?: string;
  devices?: FixtureDevice[];
  faults?: BridgeFaults;
  mutation?: string;
  statusIntervalMs?: number;
  /** The levels its status claims (bridge, *Conformance levels*); `["Serve"]` by default. */
  levels?: string[];
  /** Its `bridgeType`, carried in its status when set. */
  bridgeType?: string;
  /** The identity keys of its transport `test`, on every status (bridge, *What a bridge adds*); none when unset. */
  transportConnections?: string[];
}

/** A scripted answer to a provisioning request: a reply's status, or `none` for no reply at all. */
export interface ProvisionAnswer {
  reply: "ok" | "accepted" | "invalid_request" | "failed" | "none";
  reason?: string;
  /**
   * A `connect`'s ending after an `accepted` reply: `connected` naming that device (with those
   * `connections`, else the request's `keys`), or `connect_failed` with that reason. Absent, the
   * default `connected` naming a new `taken-<n>`.
   */
  then?: { connected: { device: string; connections?: string[] } } | { failed: string };
  /** A `connect` answered and then nothing more: no device, no event. */
  silent?: boolean;
}

/** The provisioning ops; one the bridge's levels do not cover (Provision) is `invalid_request`. */
const PROVISION_OPS = new Set(["join", "join_close", "commission", "connect", "remove", "unblock"]);
/** The longest join window a bridge opens (bridge, *Provisioning*): a longer one is capped. */
const MAX_WINDOW_MS = 254_000;
/** How long a request's first reply answers a repeat of its requestId (GA-BRIDGE-4). */
const REPLY_KEPT_MS = 10_000;

export interface Received {
  device: string;
  action: string;
  args: Record<string, unknown>;
  state?: Record<string, unknown>;
  commandId: string;
  realAt: number;
}

/**
 * A command as the broker delivered it, a repeated `commandId` included: whether it came retained,
 * and the Message Expiry left on it (GA-BUS-5). A test counts publishes here, actuations in `received`.
 */
export interface CommandSeen {
  device: string;
  commandId?: string;
  retained: boolean;
  expiryS?: number;
  realAt: number;
}

export interface Published {
  topic: string;
  payload: unknown;
  realAt: number;
}

/** A request the bridge received on `request/{op}`, parsed or as it came. */
export interface RequestSeen {
  op: string;
  body: unknown;
  retained: boolean;
  expiryS?: number;
  realAt: number;
}

export const STAMPS_PUBLICATION_TIME = "stamps-publication-time";
/** A movement sensor's reading published under the library's `occupancy` (GA-BRIDGE-78). */
export const MAPS_MOTION_TO_OCCUPANCY = "maps-motion-to-occupancy";
/** The vocabulary key each meaning a `libraryDevice` reading has is published under (bridge, *Mapping by meaning*). */
const BY_MEANING: Record<string, string> = { movement: "motion", presence: "occupancy" };
/** The form of an undescribed name (GA-BRIDGE-76). */
const UNDESCRIBED_NAME = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * How a device answers its next command: `confirmed` acks `applied` (`sent` on an open device) and
 * reports what it set; `rejected` acks `failed(rejected)`; `none` acks nothing; the others ack that
 * result (`unreachable` and `expired` as `failed` with that reason, nothing transmitted), `received`
 * being the binding's non-terminal ack and nothing after it. `detail` rides on the ack; `source` replaces
 * the bridge's id in it.
 */
type How = {
  result: "confirmed" | "rejected" | "none" | "sent" | "unreachable" | "expired" | "no_confirmation" | "unsupported" | "received";
  afterMs?: number; reportAfterMs?: number; detail?: string; source?: string;
};

interface Device {
  spec: FixtureDevice;
  values: Record<string, unknown>;
  times: Record<string, number>;
  lastCheckIn: number | null;
  observable: boolean;
  since: number;
  silent: boolean;
  available: boolean;
  next?: How;
  /** What it sent that no key describes, by its own name, with when it was first seen (GA-BRIDGE-76). */
  undescribed: { name: string; firstSeen: string }[];
  /** A `libraryDevice`'s readings: the library's name to the key it is published under (GA-BRIDGE-78). */
  library?: Record<string, string>;
}

/** At most this many undescribed names per device (GA-BRIDGE-76). */
const MAX_UNDESCRIBED = 32;

const wire = (ms: number) => new Date(ms).toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** An op this test transport cannot play; its reply carries `unsupported: true`. */
class Unplayable extends Error {}

/** A bridge at Serve over the test transport, whose "radio" the harness plays (GA-BRIDGE-16). */
export class SimBridge {
  /** New on every start of the process (GA-BRIDGE-31): `restart` gives a new one. */
  instanceId = randomUUID();
  readonly received: Received[] = [];
  /** The commandId of each command whose answer is timed: a test steps the clock past its delay only after. */
  readonly answerTimed: string[] = [];
  /** Every command the broker delivered, in order, repeats included. */
  readonly commands: CommandSeen[] = [];
  readonly published: Published[] = [];
  /** Every request received, snapshots included, so a test can see what the applier asked. */
  readonly requests: RequestSeen[] = [];
  private client?: MqttClient;
  private readonly devices = new Map<string, Device>();
  private transport: { state: "up" | "down" | "unknown"; since: number };
  private faults: BridgeFaults;
  private readonly timers = new Set<number>();
  /** commandId → its first terminal ack, once there is one, for GA-BRIDGE-4's dedup; bounded by
   * pruning entries once their command's `resultWithinMs` has passed. */
  private readonly handled = new Map<string, { ack?: Record<string, unknown>; expiresAt: number }>();
  private stalledUntil = 0;
  /** While set, the periodic status is not sent; `publishStatus` still is. */
  private quiet = false;
  private readonly extraTransports: Record<string, unknown>[] = [];
  /** While set, requests are recorded and left unanswered: a bridge that has not yet answered. */
  private holding = false;
  private seq = 0;
  /** The levels its status claims; a test may change them (`setLevels`). */
  private levels: string[];
  /** Its `bridgeType`; a test may change it (`setType`). */
  private bridgeType?: string;
  /** A scripted answer per op, replacing the default once. */
  private readonly scripted = new Map<string, ProvisionAnswer>();
  /** Ops whose next reply is dropped, the work still done. */
  private readonly dropping = new Set<string>();
  /** A requestId's first reply, kept 10 s (GA-BRIDGE-4); no reply while it is still being answered. */
  private readonly replied = new Map<string, { reply?: Record<string, unknown>; until: number }>();
  /** The open join window, if any: what joined in it, its effective windowMs, and its timer. */
  private window?: { transport: string; devices: string[]; windowMs: number; timer: number };
  /** How many devices `connect` has taken, naming the next `taken-<n>`. */
  private taken = 0;
  /**
   * The requestId of the `connect` it has accepted and not yet ended with `connected` or `connect_failed`:
   * a second one meanwhile is `failed(busy)` (bridge, *Provisioning*). Gone with the process.
   */
  private connecting?: string;
  private stopped = false;
  private readonly base: string;
  private readonly controlTopic: string;
  private readonly mutation?: string;
  private readonly clock: Clock;

  constructor(private readonly opts: SimBridgeOptions) {
    this.clock = opts.clock;
    this.base = `${opts.root}/bridges/${opts.bridgeId}`;
    this.controlTopic = opts.controlTopic ?? `${opts.root}/test/${opts.bridgeId}/control`;
    this.faults = { ...opts.faults };
    this.levels = opts.levels ?? ["Serve"];
    this.bridgeType = opts.bridgeType;
    this.mutation = opts.runId ? opts.mutation : undefined;
    const now = this.clock.now();
    this.transport = { state: "up", since: now };
    for (const spec of opts.devices ?? fixtureDevices()) this.add(spec, now);
  }

  async start(): Promise<void> {
    const { bridgeId } = this.opts;
    this.connecting = undefined;
    this.client = await connectAsync(this.opts.brokerUrl, {
      protocolVersion: 5,
      clientId: `${bridgeId}-${this.instanceId.slice(0, 8)}`,
      username: bridgeId,
      keepalive: 10,
      clean: true,
      reconnectPeriod: 1000,
      will: this.faults.noWill ? undefined : {
        topic: `${this.base}/lwt`,
        payload: Buffer.from(JSON.stringify({ bridgeId, instanceId: this.instanceId })),
        qos: 1,
        retain: true,
        properties: { willDelayInterval: 0 },
      },
    });
    this.client.on("error", () => undefined);
    this.client.on("message", (topic, payload, packet) => void this.onMessage(topic, payload, packet.retain,
      packet.properties?.messageExpiryInterval).catch((err) => console.error(err)));
    // Retain As Published, so a command or request published retained is seen so (GA-BUS-5).
    await this.client.subscribeAsync([`${this.base}/devices/+/command`, `${this.base}/request/+`], { qos: 1, rap: true });
    await this.client.subscribeAsync(this.controlTopic, { qos: 1 });
    await this.publish(`${this.base}/lwt`, "", true);
    await this.publishDevices();
    for (const d of this.devices.values()) if (d.spec.feedback === "closed") await this.publishDeviceStatus(d);
    await this.publishStatus();
    this.every(() => (this.quiet ? undefined : this.publishStatus()), this.opts.statusIntervalMs ?? 10_000);
    this.every(() => this.checkObservable(), 500);
    for (const d of this.devices.values()) this.heartbeat(d);
  }

  async stop({ graceful = true }: { graceful?: boolean } = {}): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    for (const h of this.timers) this.clock.clear(h);
    if (!this.client) return;
    if (graceful && this.client.connected) {
      await this.publishStatus({ state: "offline", graceful: true });
      await this.publish(`${this.base}/lwt`, "", true);
    }
    await this.client.endAsync();
  }

  /**
   * A new process of the same bridge: the old one stops (gracefully, or killed so its will fires),
   * and the new one starts with a new `instanceId`, its event `seq` from 1 again.
   */
  async restart({ graceful = true }: { graceful?: boolean } = {}): Promise<void> {
    if (graceful) await this.stop();
    else this.kill();
    this.timers.clear();
    this.stopped = false;
    this.instanceId = randomUUID();
    this.seq = 0;
    await this.start();
  }

  /**
   * Publishes `payload` on `{root}/bridges/{b}/{path}` as it is given: a string or a Buffer raw (so
   * `""` is an empty payload and `"{"` is not JSON), anything else as JSON. For the malformed and
   * odd messages a real bridge should never send.
   */
  async publishRaw(path: string, payload: unknown, retain: boolean): Promise<void> {
    if (!this.client) throw new Error("the bridge is not started");
    const topic = `${this.base}/${path}`;
    this.published.push({ topic, payload, realAt: Date.now() });
    const raw = typeof payload === "string" || Buffer.isBuffer(payload) ? payload : JSON.stringify(payload);
    await this.client.publishAsync(topic, raw, { qos: 1, retain });
  }

  /**
   * Publishes `payload` as `publishRaw` does, on another bridge's tree, `{root}/bridges/{bridgeId}/{path}`:
   * a second bridge that only publishes what a test gives it (the broker has no ACL under the harness).
   * It is not kept in `published`, which is this bridge's own.
   */
  async publishAs(bridgeId: string, path: string, payload: unknown, retain: boolean): Promise<void> {
    if (!this.client) throw new Error("the bridge is not started");
    const topic = `${this.opts.root}/bridges/${bridgeId}/${path}`;
    const raw = typeof payload === "string" || Buffer.isBuffer(payload) ? payload : JSON.stringify(payload);
    await this.client.publishAsync(topic, raw, { qos: 1, retain });
  }

  /**
   * Publishes an `event`, by default the next `seq` of this instance. `at.seq` moves the bridge's own
   * counter, so the next default event continues from it; `at.instanceId` only stamps this event.
   */
  async publishEvent(type: string, extra: Record<string, unknown> = {}, at: { seq?: number; instanceId?: string } = {}): Promise<void> {
    if (at.seq !== undefined) this.seq = at.seq;
    else this.seq++;
    if ((type === "connected" || type === "connect_failed") && extra.requestId === this.connecting) this.connecting = undefined;
    await this.publish(`${this.base}/event`, { seq: this.seq, instanceId: at.instanceId ?? this.instanceId, type, ...extra }, false);
  }

  /** The bridge reports the device `available: false` (the protocol declared it gone), or back. */
  async setAvailable(id: string, available: boolean): Promise<void> {
    const d = this.device(id);
    d.available = available;
    await this.publishDeviceStatus(d, true);
  }

  /**
   * The device leaves: out of the `devices` document and the roster, its retained status cleared
   * (GA-BRIDGE-21), and a `left` event.
   */
  async removeDevice(id: string): Promise<void> {
    this.device(id);
    this.devices.delete(id);
    await this.publishDevices();
    await this.publish(`${this.base}/devices/${id}/status`, "", true);
    await this.publishEvent("left", { device: id });
    await this.publishStatus();
  }

  /** Dies without a DISCONNECT, so the broker publishes the will. */
  kill(): void {
    this.stopped = true;
    for (const h of this.timers) this.clock.clear(h);
    if (!this.client) return;
    this.client.options.reconnectPeriod = 0;
    this.client.stream.destroy();
  }

  /**
   * Transports a test adds after the bridge's own: every later status lists them, its own (an
   * `observable` change's, a snapshot's answer) included, so none takes them away again.
   */
  addTransport(t: Record<string, unknown>): void {
    this.extraTransports.push(t);
  }

  /** Holds back the periodic status (a hung main loop), so only the statuses a test sends arrive. */
  setQuiet(quiet: boolean): void {
    this.quiet = quiet;
  }

  /** Records requests and answers none, snapshots included, until released. */
  holdRequests(hold: boolean): void {
    this.holding = hold;
  }

  /** Claims other levels from now on, and says so in a status at once. */
  async setLevels(levels: string[]): Promise<void> {
    this.levels = [...levels];
    await this.publishStatus();
  }

  /** Gives another `bridgeType` from now on, and says so in a status at once. */
  async setType(bridgeType: string): Promise<void> {
    this.bridgeType = bridgeType;
    await this.publishStatus();
  }

  /** Answers the next provisioning request of `op` as told, instead of its default, once. */
  script(op: string, answer: ProvisionAnswer): void {
    this.scripted.set(op, answer);
  }

  /** Drops the next reply of `op`: the work is still done, its events still published. */
  dropReply(op: string): void {
    this.dropping.add(op);
  }

  setFaults(f: BridgeFaults): void {
    this.faults = { ...this.faults, ...f };
  }

  /** The test transport's control protocol, in process. */
  async control(msg: HarnessTestControl): Promise<void> {
    const errors = validate("harness/test-control.json", msg);
    if (errors.length) throw new Error(errors.join("; "));
    const m = msg as Record<string, any>;
    const now = this.clock.now();
    switch (m.op) {
      case "join": {
        if (this.devices.has(m.device)) return;
        this.add(device({
          id: m.device, capabilities: m.capabilities, feedback: m.feedback, proposedClass: null, initial: {},
          ...(m.model ? { model: m.model } : {}),
        }), now);
        this.heartbeat(this.devices.get(m.device)!);
        if (this.window) this.window.devices.push(m.device);
        await this.publishDevices();
        await this.publishEvent("joined", { device: m.device });
        await this.publishStatus();
        return;
      }
      case "libraryDevice": {
        if (this.devices.has(m.device)) return;
        const library: Record<string, string> = Object.fromEntries((m.readings as { name: string; means: string }[]).map((r) =>
          [r.name, this.mutation === MAPS_MOTION_TO_OCCUPANCY && r.means === "movement" ? r.name : BY_MEANING[r.means]!]));
        this.add(device({ id: m.device, capabilities: ["sensor"], sensorKeys: [...new Set(Object.values(library))], feedback: "closed",
          proposedClass: "sensor", initial: {} }), now);
        this.devices.get(m.device)!.library = library;
        this.heartbeat(this.devices.get(m.device)!);
        await this.publishDevices();
        await this.publishEvent("joined", { device: m.device });
        await this.publishStatus();
        return;
      }
      case "report": {
        const d = this.device(m.device);
        const at = Date.parse(m.observedAt);
        const values = Object.fromEntries(Object.entries(m.values as Record<string, unknown>).map(([k, v]) => [d.library?.[k] ?? k, v]));
        // A held-back key's first report declares it, before its value (GA-BRIDGE-80).
        const first = (d.spec.awaitedKeys ?? []).filter((k) => Object.hasOwn(values, k));
        if (first.length) {
          d.spec.awaitedKeys = d.spec.awaitedKeys!.filter((k) => !first.includes(k));
          d.spec.sensorKeys = [...d.spec.sensorKeys, ...first];
        }
        // An event key's value is an occurrence, never state; what no key describes is left out (GA-BRIDGE-75, 76).
        const events = this.keysOf(d, "event");
        const state = this.keysOf(d, "state");
        const kept: Record<string, unknown> = {};
        const named: string[] = [];
        for (const [k, v] of Object.entries(values)) {
          if (events.has(k)) await this.publishEvent("occurrence", { device: d.spec.id, key: k, value: v, timestamp: wire(at) });
          else if (state.has(k)) kept[k] = v;
          else if (UNDESCRIBED_NAME.test(k) && !d.undescribed.some((u) => u.name === k) && d.undescribed.length < MAX_UNDESCRIBED) {
            d.undescribed.push({ name: k, firstSeen: wire(now) });
            named.push(k);
          }
        }
        d.lastCheckIn = now;
        const redeclared = this.settle(d, kept) || first.length > 0;
        Object.assign(d.values, kept);
        for (const k of Object.keys(kept)) d.times[k] = at;
        if (redeclared) await this.publishDevices();
        if (Object.keys(kept).length) await this.publishDeviceStatus(d);
        // Listed in devices, and each announced once, never a fault (GA-BRIDGE-76).
        if (named.length) {
          await this.publishDevices();
          for (const name of named) await this.publishEvent("undescribed", { device: d.spec.id, name });
        }
        await this.checkObservable();
        return;
      }
      case "checkIn":
        this.device(m.device).lastCheckIn = Date.parse(m.at);
        await this.checkObservable();
        return;
      case "silence":
        this.device(m.device).silent = m.silent;
        return;
      case "commandResult":
        this.device(m.device).next = { result: m.result, afterMs: m.afterMs, reportAfterMs: m.reportAfterMs, detail: m.detail,
          source: m.source };
        return;
      case "commands":
        // A bridge between connections: the broker has no subscriber for its commands, and answers 0x10.
        if (m.subscribed) await this.client?.subscribeAsync(`${this.base}/devices/+/command`, { qos: 1, rap: true });
        else await this.client?.unsubscribeAsync(`${this.base}/devices/+/command`);
        return;
      case "transportState":
        this.transport = { state: m.state, since: now };
        await this.checkObservable(true);
        return;
      case "link":
        throw new Unplayable("the simulated bridge has no interface; link is a wake relay's op");
      case "describe":
      case "interview":
      case "setting":
      case "occur":
      case "undescribed":
      case "admit":
      case "leave":
      case "windowState":
      case "protocolResult":
      case "hostLink":
      case "stateMismatch":
      case "reporting":
      case "foreignBinding":
      case "classFrom":
      case "nativeControl":
      case "lockPin":
        throw new Unplayable(`the simulated bridge does not play ${m.op}: it is a doer's op (the Zigbee bridge's scripted doer)`);
      case "stall":
        this.stalledUntil = Date.now() + m.ms;
        return;
    }
  }

  async publishStatus(extra: Record<string, unknown> = {}): Promise<void> {
    await this.whenFree();
    const now = this.clock.now();
    const devices = [...this.devices.values()];
    const observable = devices.filter((d) => d.observable).length;
    const status: Record<string, unknown> = {
      bridgeId: this.opts.bridgeId,
      instanceId: this.instanceId,
      v: 1,
      state: observable === devices.length ? "online" : observable === 0 ? "offline" : "degraded",
      version: "0.0.0",
      levels: this.levels,
      ...(this.bridgeType !== undefined ? { bridgeType: this.bridgeType } : {}),
      faults: [...(this.faults.statusFaults ?? [])],
      ungoverned: this.faults.ungoverned ?? [],
      blocked: [],
      transports: [{ id: "test", kind: "other", state: this.transport.state, since: wire(this.transport.since),
        ...(this.opts.transportConnections ? { connections: this.opts.transportConnections } : {}) }, ...this.extraTransports],
      devices: devices.map((d) => this.roster(d)),
      publishedAt: wire(now + (this.faults.clockSkewMs ?? 0)),
      ...extra,
    };
    if (this.opts.runId) status.testRunId = this.opts.runId;
    if (this.faults.noV) delete status.v;
    await this.publish(`${this.base}/status`, status, true);
  }

  private add(spec: FixtureDevice, now: number): void {
    const closed = spec.feedback === "closed";
    const d: Device = {
      spec,
      values: closed ? { ...spec.initial } : {},
      times: closed ? Object.fromEntries(Object.keys(spec.initial).map((k) => [k, now])) : {},
      lastCheckIn: closed ? now : null,
      observable: false,
      since: now,
      silent: false,
      available: true,
      undescribed: [],
    };
    d.observable = this.isObservable(d, now);
    this.devices.set(spec.id, d);
  }

  private device(id: string): Device {
    const d = this.devices.get(id);
    if (!d) throw new Error(`no device ${id}`);
    return d;
  }

  /** Nothing on a `down` transport is observable (GA-BRIDGE-6, -17): there is only one transport here. */
  private isObservable(d: Device, now: number): boolean {
    if (this.transport.state === "down") return false;
    if (d.spec.feedback === "open") return true;
    const max = d.spec.basisMaxAgeMs;
    return d.lastCheckIn !== null && max !== null && now - d.lastCheckIn <= max;
  }

  /** Publishes a status within 1 s of an `observable` change (GA-BRIDGE-17), or at once when forced. */
  private async checkObservable(force = false): Promise<void> {
    const now = this.clock.now();
    let changed = force;
    for (const d of this.devices.values()) {
      const o = this.isObservable(d, now);
      if (o !== d.observable) {
        d.observable = o;
        d.since = now;
        changed = true;
      }
    }
    if (changed) await this.publishStatus();
  }

  /**
   * The keys a device declares of `kind` (bridge, *Device status*): for `state`, its capabilities'
   * keys, its `sensorKeys` and its extensions' `state` keys; for `event`, its extensions' `event` keys.
   */
  private keysOf(d: Device, kind: "state" | "event"): Set<string> {
    const own = (d.spec.extensions ?? []).flatMap((e) => (e.keys ?? []).filter((k) => (k.kind ?? "state") === kind).map((k) => k.key));
    return new Set(kind === "event" ? own : [...capabilityKeys(d.spec.capabilities), ...d.spec.sensorKeys, ...own]);
  }

  /**
   * A setting about to take new values: where it changes the device's declarations, they change now,
   * so `devices` is published before the status carrying the new value (GA-BRIDGE-74). True when they did.
   */
  private settle(d: Device, values: Record<string, unknown>): boolean {
    const modes = d.spec.modes;
    if (!modes || !Object.hasOwn(values, modes.key)) return false;
    const next = modes.actions[String(values[modes.key])];
    if (!next || JSON.stringify(next) === JSON.stringify(d.spec.actions)) return false;
    d.spec.actions = structuredClone(next);
    return true;
  }

  private roster(d: Device) {
    const times = Object.values(d.times);
    return {
      id: d.spec.id,
      transport: "test",
      basis: "report",
      cadenceMs: null,
      basisMaxAgeMs: d.spec.basisMaxAgeMs,
      timestamp: times.length ? wire(Math.max(...times)) : null,
      lastCheckIn: d.lastCheckIn === null ? null : wire(d.lastCheckIn),
      observable: d.observable,
      since: wire(d.since),
    };
  }

  private async publishDevices(): Promise<void> {
    await this.publish(`${this.base}/devices`, {
      publishedAt: wire(this.clock.now()),
      devices: [...this.devices.values()].map((d) => bridgeDoc(d.spec, d.undescribed)),
    }, true);
  }

  /** Each reading carries its observation's time (GA-BRIDGE-1); the mutation stamps publication. */
  private async publishDeviceStatus(d: Device, always = false): Promise<void> {
    const keys = Object.keys(d.values);
    if (!keys.length && !always) return;
    const now = this.clock.now();
    let timestamp = now;
    let timestamps: Record<string, string> | undefined;
    if (this.mutation !== STAMPS_PUBLICATION_TIME) {
      timestamp = Math.max(...keys.map((k) => d.times[k] ?? now));
      const others = keys.filter((k) => (d.times[k] ?? now) !== timestamp);
      if (others.length) timestamps = Object.fromEntries(others.map((k) => [k, wire(d.times[k] ?? now)]));
    }
    await this.publish(`${this.base}/devices/${d.spec.id}/status`, {
      deviceId: d.spec.id,
      ...(d.spec.capabilities.includes("onoff") ? { state: d.values.on ? "on" : "off" } : {}),
      ...d.values,
      timestamp: wire(keys.length ? timestamp : now),
      ...(timestamps ? { timestamps } : {}),
      available: d.available,
    }, true);
  }

  private async onMessage(topic: string, payload: Buffer, retained = false, expiryS?: number): Promise<void> {
    await this.whenFree();
    if (topic === this.controlTopic) return this.onControl(payload);
    const command = topic.match(/\/devices\/([^/]+)\/command$/);
    if (command) return this.onCommand(command[1]!, payload, retained, expiryS);
    const request = topic.match(/\/request\/([^/]+)$/);
    if (request) return this.onRequest(request[1]!, payload, retained, expiryS);
  }

  private async onControl(payload: Buffer): Promise<void> {
    let msg: Record<string, unknown> = {};
    try {
      msg = JSON.parse(payload.toString());
      await this.control(msg as HarnessTestControl);
      await this.publish(`${this.controlTopic}/reply`, { requestId: msg.requestId, ok: true }, false);
    } catch (err) {
      await this.publish(`${this.controlTopic}/reply`, { requestId: String(msg.requestId ?? ""), ok: false, error: String(err),
        ...(err instanceof Unplayable ? { unsupported: true } : {}) }, false);
    }
  }

  private async onCommand(id: string, payload: Buffer, retained = false, expiryS?: number): Promise<void> {
    let cmd: Record<string, any>;
    try {
      cmd = JSON.parse(payload.toString());
    } catch {
      this.commands.push({ device: id, retained, ...(expiryS !== undefined ? { expiryS } : {}), realAt: Date.now() });
      return;
    }
    this.commands.push({ device: id, ...(typeof cmd.commandId === "string" ? { commandId: cmd.commandId } : {}), retained,
      ...(expiryS !== undefined ? { expiryS } : {}), realAt: Date.now() });
    if (validate("bridge/command.json", cmd).length) {
      if (typeof cmd.commandId === "string") await this.ack(id, cmd.commandId, "failed", "invalid_request");
      return;
    }
    const now = this.clock.now();
    this.pruneCommands(now);
    // A repeated commandId gets the first ack again, or nothing while it still runs, and does
    // nothing more: no re-execution, nothing added to `received` (GA-BRIDGE-4).
    const existing = this.handled.get(cmd.commandId);
    if (existing) {
      if (existing.ack) await this.publish(`${this.base}/devices/${id}/ack`, existing.ack, false);
      return;
    }
    this.handled.set(cmd.commandId, { expiresAt: now + cmd.resultWithinMs });
    const d = this.devices.get(id);
    if (!d) return this.ack(id, cmd.commandId, "failed", "unknown_device");
    // A command whose time has already run out is never started (GA-BRIDGE-7).
    if (Date.parse(cmd.issuedAt) + cmd.resultWithinMs < now) return this.ack(id, cmd.commandId, "failed", "expired");
    // A device unreachable when the command arrives (its transport down, or it not observable)
    // is failed at once, nothing transmitted (GA-BRIDGE-6).
    if (!d.observable) return this.ack(id, cmd.commandId, "failed", "unreachable");
    const action: string = cmd.value.action;
    const decl = d.spec.actions.find((a) => a.action === action);
    if (!decl) return this.ack(id, cmd.commandId, "unsupported");
    if (d.silent) {
      this.later(() => void this.ack(id, cmd.commandId, "failed", "no_confirmation"), cmd.resultWithinMs);
      return;
    }
    const how: How = d.next ?? { result: "confirmed" };
    d.next = undefined;
    const afterMs = how.afterMs ?? d.spec.ackMs;
    const answer = (result: string, reason?: string) => {
      this.later(() => void this.ack(id, cmd.commandId, result, reason, how), afterMs);
      this.answerTimed.push(cmd.commandId);
    };
    // Nothing transmitted: no actuation, and the ack says why.
    if (how.result === "unreachable" || how.result === "expired") return answer("failed", how.result);
    if (how.result === "unsupported") return answer("unsupported");
    const args = fromWire(action, cmd.value.value);
    this.received.push({ device: id, action, args, state: cmd.value.state, commandId: cmd.commandId, realAt: Date.now() });
    await this.publish(`${this.controlTopic}/received`, { device: id, action, args, ...(cmd.value.state ? { state: cmd.value.state } : {}) }, false);
    if (how.result === "none") return;
    if (how.result === "received") return answer("received");
    if (how.result === "no_confirmation") return answer("failed", "no_confirmation");
    if (how.result === "rejected") return answer("failed", "rejected");
    if (how.result === "sent" || d.spec.feedback === "open") return answer("sent");
    // A standard action sets what the vocabulary says; an extension action, the key its confirmedBy names.
    const sets = setsOf(decl, args);
    const report = async () => {
      if (!sets) return;
      const now = this.clock.now();
      if (this.settle(d, sets)) await this.publishDevices();
      Object.assign(d.values, sets);
      for (const k of Object.keys(sets)) d.times[k] = now;
      d.lastCheckIn = now;
      await this.publishDeviceStatus(d);
    };
    const reportAfterMs = how.reportAfterMs ?? 0;
    this.later(async () => {
      if (reportAfterMs === 0) await report();
      await this.ack(id, cmd.commandId, "applied", undefined, how);
      if (reportAfterMs > 0) this.later(() => void report(), reportAfterMs);
    }, afterMs);
    this.answerTimed.push(cmd.commandId);
  }

  private async onRequest(op: string, payload: Buffer, retained = false, expiryS?: number): Promise<void> {
    const seen = { retained, ...(expiryS !== undefined ? { expiryS } : {}), realAt: Date.now() };
    let req: Record<string, any>;
    try {
      req = JSON.parse(payload.toString());
    } catch {
      this.requests.push({ op, body: payload.toString(), ...seen });
      return;
    }
    this.requests.push({ op, body: req, ...seen });
    if (this.holding || validate("bridge/request.json", req).length) return;
    if (op === "snapshot") {
      // Every retained topic again, then the reply (GA-BRIDGE-30): the devices document, every
      // device's status (one with nothing to report has none), and the bridge's status.
      await this.publishDevices();
      for (const d of this.devices.values()) await this.publishDeviceStatus(d);
      await this.publishStatus();
      await this.publish(`${this.base}/reply`, { requestId: req.requestId, op, status: "ok", data: {} }, false);
      return;
    }
    return this.provisioning(op, req);
  }

  /**
   * A request other than a snapshot (bridge, *Requests and replies*, *Provisioning*): a repeated
   * requestId within 10 s gets the first reply and does nothing more (GA-BRIDGE-4); a provisioning op
   * without Provision is `invalid_request`; otherwise a scripted answer, or the op's default.
   */
  private async provisioning(op: string, req: Record<string, any>): Promise<void> {
    const now = this.clock.now();
    for (const [id, r] of this.replied) if (now > r.until) this.replied.delete(id);
    const kept = this.replied.get(req.requestId);
    if (kept) {
      if (kept.reply) await this.publish(`${this.base}/reply`, kept.reply, false);
      return;
    }
    const record: { reply?: Record<string, unknown>; until: number } = { until: now + REPLY_KEPT_MS };
    this.replied.set(req.requestId, record);
    const answer = async (status: string, reason?: string) => {
      const reply = { requestId: req.requestId, op, status, ...(reason !== undefined ? { reason } : {}),
        ...(status === "ok" ? { data: {} } : {}) };
      record.reply = reply;
      if (this.dropping.delete(op)) return;
      if (validate("bridge/reply.json", reply).length === 0) await this.publish(`${this.base}/reply`, reply, false);
    };
    if (PROVISION_OPS.has(op) && !this.levels.includes("Provision")) return answer("invalid_request");
    const scripted = this.scripted.get(op);
    // A scripted connect is played by connect's own case, which reads its ending too.
    if (scripted && op !== "connect") {
      this.scripted.delete(op);
      if (scripted.reply !== "none") await answer(scripted.reply, scripted.reason);
      return;
    }
    switch (op) {
      case "join": {
        // A join on a transport whose window is open is failed(busy), the window unchanged (GA-BRIDGE-4).
        if (this.window) return answer("failed", "busy");
        // The window is open before the reply goes, so a device joining once the reply is seen is in it.
        const windowMs = Math.min(Math.max(Number(req.windowMs) || 0, 0), MAX_WINDOW_MS);
        const timer = this.clock.setTimeout(() => {
          this.timers.delete(timer);
          if (!this.stopped) void this.windowClosed().catch((err) => console.error(err));
        }, windowMs);
        this.timers.add(timer);
        this.window = { transport: String(req.transport ?? "test"), devices: [], windowMs, timer };
        return answer("accepted");
      }
      case "join_close":
        await answer("ok");
        return this.windowClosed();
      case "unblock":
        return answer("ok");
      case "remove": {
        // By identifier, retired hardware: the device holding that stableIdentifier, or none (GA-BRIDGE-27).
        const byIdentifier = typeof req.identifier === "string"
          ? [...this.devices.values()].find((d) => bridgeDoc(d.spec).stableIdentifier === req.identifier)?.spec.id : undefined;
        if (typeof req.identifier === "string" && byIdentifier === undefined) return answer("failed", "unknown_device");
        await answer("accepted");
        const id = byIdentifier ?? String(req.device ?? "");
        if (this.devices.delete(id)) {
          await this.publishDevices();
          await this.publish(`${this.base}/devices/${id}/status`, "", true);
        }
        await this.publishEvent("left", { device: id });
        return this.publishStatus();
      }
      case "connect": {
        // Accepted, then the devices document naming the device, then connected (GA-BRIDGE-40); no joined.
        const s = this.scripted.get("connect");
        this.scripted.delete("connect");
        if (s?.reply === "none") return;
        // One connect at a time: a second while the first is in flight is failed(busy), the first unchanged.
        if (this.connecting !== undefined) {
          if (s) this.scripted.set("connect", s);
          return answer("failed", "busy");
        }
        const reply = s?.reply ?? "accepted";
        if (reply === "accepted") this.connecting = req.requestId;
        await answer(reply, s?.reason);
        if (s && (s.silent || s.reply !== "accepted")) return;
        if (s?.then && "failed" in s.then) return this.publishEvent("connect_failed", { requestId: req.requestId, reason: s.then.failed });
        const named = s?.then && "connected" in s.then ? s.then.connected : undefined;
        const id = named?.device ?? `taken-${++this.taken}`;
        if (!this.devices.has(id)) {
          const keys = Array.isArray(req.keys) ? req.keys.filter((k: unknown): k is string => typeof k === "string") : [];
          this.add(device({ id, capabilities: ["onoff"], feedback: "closed", proposedClass: "socket", initial: { on: false },
            connections: named?.connections ?? keys }), this.clock.now());
          this.heartbeat(this.devices.get(id)!);
          await this.publishDevices();
          await this.publishDeviceStatus(this.devices.get(id)!);
          await this.publishStatus();
        }
        return this.publishEvent("connected", { requestId: req.requestId, device: id });
      }
      case "commission":
        await answer("accepted");
        return this.publishEvent("commission_failed", { reason: "unsupported" });
      default:
        return answer("failed", "unsupported");
    }
  }

  /** Ends the open window, if any, with its `window_closed` naming what joined in it. */
  private async windowClosed(): Promise<void> {
    const w = this.window;
    if (!w) return;
    this.closeWindow();
    await this.publishEvent("window_closed", { transport: w.transport, devices: w.devices, windowMs: w.windowMs });
  }

  /** Ends the open window silently. */
  private closeWindow(): void {
    if (!this.window) return;
    this.clock.clear(this.window.timer);
    this.timers.delete(this.window.timer);
    this.window = undefined;
  }

  private async ack(id: string, commandId: string, result: string, reason?: string, how?: How): Promise<void> {
    const payload = {
      commandId, source: how?.source ?? this.opts.bridgeId, result, ...(reason ? { reason } : {}),
      ...(how?.detail !== undefined ? { detail: how.detail } : {}), timestamp: wire(this.clock.now()),
    };
    // `received` is not terminal: a repeat of the command is not answered with it.
    const record = this.handled.get(commandId);
    if (record && result !== "received") record.ack = payload;
    await this.publish(`${this.base}/devices/${id}/ack`, payload, false);
  }

  /** Drops a command's dedup record once its `resultWithinMs` has passed. */
  private pruneCommands(now: number): void {
    for (const [id, rec] of this.handled) if (now > rec.expiresAt) this.handled.delete(id);
  }

  private heartbeat(d: Device): void {
    if (d.spec.feedback !== "closed") return;
    this.every(async () => {
      if (d.silent || this.transport.state === "down") return;
      d.lastCheckIn = this.clock.now();
      await this.checkObservable();
    }, d.spec.checkInMs);
  }

  private async publish(topic: string, payload: unknown, retain: boolean): Promise<void> {
    if (!this.client) return;
    this.published.push({ topic, payload, realAt: Date.now() });
    await this.client.publishAsync(topic, payload === "" ? "" : JSON.stringify(payload), { qos: 1, retain });
  }

  private later(fn: () => unknown, ms: number): void {
    const h = this.clock.setTimeout(() => {
      this.timers.delete(h);
      if (!this.stopped) void Promise.resolve(fn()).catch((err) => console.error(err));
    }, ms);
    this.timers.add(h);
  }

  /** Runs `fn` every `ms` of the clock, rescheduling after each run, so a step runs it once. */
  private every(fn: () => unknown, ms: number): void {
    const tick = () => {
      this.later(tick, ms);
      return fn();
    };
    this.later(tick, ms);
  }

  private async whenFree(): Promise<void> {
    const wait = this.stalledUntil - Date.now();
    if (wait > 0) await sleep(wait);
  }
}
