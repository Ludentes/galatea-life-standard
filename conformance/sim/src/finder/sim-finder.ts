import { randomUUID } from "node:crypto";
import type { Clock } from "@ludentes/galatea-life-test-clock";
import { connectAsync, type MqttClient } from "mqtt";

export interface SimFinderOptions {
  brokerUrl: string;
  root: string;
  clock: Clock;
  runId?: string;
  /** Its `finderId`; `sim-finder` by default. */
  finderId?: string;
}

/** A source the finder listens on (bridge, *The finder's topics*): `off` where the box does not give it. */
export interface FinderSource {
  source: string;
  state: "up" | "down" | "off";
  reason?: string;
}

/**
 * A candidate as a test gives it (bridge, *The finder*): the finder adds its `id` (kept per first key
 * while listed), `firstSeen` and `lastSeen`.
 */
export interface FinderCandidate {
  keys: string[];
  sources: string[];
  address?: { ip: string; port?: number } | { path: string };
  hints?: { name?: string; vendor?: string; model?: string };
  matches: { bridgeType: string; connect: boolean }[];
}

const wire = (ms: number) => new Date(ms).toISOString();

/**
 * The box's finder, as the harness plays it on `{root}/finder/`: a retained `status` every 10 s of
 * the harness's clock, its will on `lwt` (cleared on connecting), and the whole `candidates` list
 * retained. It listens on nothing: a test says what it heard.
 */
export class SimFinder {
  /** New on every start (bridge, *The finder's topics*): `restart` gives a new one. */
  instanceId = randomUUID();
  private client?: MqttClient;
  private sources: FinderSource[] = [];
  private faults: { code: string; detail?: string }[] = [];
  private skewMs = 0;
  private noV = false;
  private quiet = false;
  /** Each candidate's id, by its first key, while it is listed (bridge, *The finder*). */
  private readonly ids = new Map<string, string>();
  private readonly firstSeen = new Map<string, number>();
  private readonly timers = new Set<number>();
  private stopped = false;
  private readonly base: string;
  private readonly finderId: string;

  constructor(private readonly o: SimFinderOptions) {
    this.base = `${o.root}/finder`;
    this.finderId = o.finderId ?? "sim-finder";
  }

  async start(): Promise<void> {
    this.stopped = false;
    this.client = await connectAsync(this.o.brokerUrl, {
      protocolVersion: 5,
      clientId: `${this.finderId}-${this.instanceId.slice(0, 8)}`,
      username: this.finderId,
      clean: true,
      keepalive: 10,
      reconnectPeriod: 0,
      will: { topic: `${this.base}/lwt`, payload: Buffer.from(JSON.stringify({ finderId: this.finderId, instanceId: this.instanceId })),
        qos: 1, retain: true, properties: { willDelayInterval: 0 } },
    });
    this.client.on("error", () => undefined);
    await this.client.publishAsync(`${this.base}/lwt`, "", { qos: 1, retain: true });
    await this.publishStatus();
    this.every(() => (this.quiet ? undefined : this.publishStatus()), 10_000);
  }

  /** Goes as the finder must: a graceful `status`, `lwt` cleared, a clean disconnect. */
  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    for (const h of this.timers) this.o.clock.clear(h);
    this.timers.clear();
    if (!this.client) return;
    if (this.client.connected) {
      await this.publishStatus({ graceful: true });
      await this.client.publishAsync(`${this.base}/lwt`, "", { qos: 1, retain: true });
    }
    await this.client.endAsync();
  }

  /** Dies without a DISCONNECT, so the broker publishes the will. */
  kill(): void {
    this.stopped = true;
    for (const h of this.timers) this.o.clock.clear(h);
    this.timers.clear();
    if (!this.client) return;
    this.client.options.reconnectPeriod = 0;
    this.client.stream.destroy();
  }

  /** A new process: the old one stops (or is killed), and a new `instanceId` draws every candidate's `id` again. */
  async restart({ graceful = true }: { graceful?: boolean } = {}): Promise<void> {
    if (graceful) await this.stop();
    else this.kill();
    this.ids.clear();
    this.firstSeen.clear();
    this.instanceId = randomUUID();
    await this.start();
  }

  /** Holds back the periodic status (a hung main loop); `publishStatus` still sends one. */
  silence(on: boolean): void {
    this.quiet = on;
  }

  setSources(s: FinderSource[]): void {
    this.sources = s.map((x) => ({ ...x }));
  }

  setFaults(f: { code: string; detail?: string }[]): void {
    this.faults = f.map((x) => ({ ...x }));
  }

  /** Its `publishedAt` off by `ms` from the harness's clock. */
  skew(ms: number): void {
    this.skewMs = ms;
  }

  /** Its status without `v`. */
  dropV(on: boolean): void {
    this.noV = on;
  }

  /** The whole list, published retained within the call; a candidate keeps its `id` while its first key is listed. */
  async setCandidates(cs: FinderCandidate[]): Promise<void> {
    const now = this.o.clock.now();
    const keep = new Set(cs.map((c) => c.keys[0]!));
    for (const k of [...this.ids.keys()]) {
      if (!keep.has(k)) {
        this.ids.delete(k);
        this.firstSeen.delete(k);
      }
    }
    const candidates = cs.map((c) => {
      const k = c.keys[0]!;
      if (!this.ids.has(k)) {
        this.ids.set(k, randomUUID());
        this.firstSeen.set(k, now);
      }
      return { id: this.ids.get(k), sources: c.sources, keys: c.keys, ...(c.address ? { address: c.address } : {}),
        firstSeen: wire(this.firstSeen.get(k)!), lastSeen: wire(now), hints: c.hints ?? {}, matches: c.matches };
    });
    await this.publish(`${this.base}/candidates`, { publishedAt: wire(now), candidates }, true);
  }

  /** The `id` it gives the candidate whose first key is `key` now. */
  candidateId(key: string): string {
    const id = this.ids.get(key);
    if (!id) throw new Error(`no candidate listed with first key ${key}`);
    return id;
  }

  async publishStatus(extra: Record<string, unknown> = {}): Promise<void> {
    const status: Record<string, unknown> = {
      finderId: this.finderId,
      instanceId: this.instanceId,
      v: 1,
      levels: ["Find"],
      sources: this.sources,
      faults: this.faults,
      publishedAt: wire(this.o.clock.now() + this.skewMs),
      ...extra,
    };
    if (this.o.runId) status.testRunId = this.o.runId;
    if (this.noV) delete status.v;
    await this.publish(`${this.base}/status`, status, true);
  }

  /** A will-shaped `lwt`, retained, naming `instanceId`: one naming an earlier instance must be ignored. */
  async publishLwt(instanceId: string): Promise<void> {
    await this.publish(`${this.base}/lwt`, { finderId: this.finderId, instanceId }, true);
  }

  private async publish(topic: string, payload: unknown, retain: boolean): Promise<void> {
    if (!this.client) throw new Error("the finder is not started");
    await this.client.publishAsync(topic, JSON.stringify(payload), { qos: 1, retain });
  }

  private later(fn: () => unknown, ms: number): void {
    const h = this.o.clock.setTimeout(() => {
      this.timers.delete(h);
      if (!this.stopped) void Promise.resolve(fn()).catch((err) => console.error(err));
    }, ms);
    this.timers.add(h);
  }

  /** Runs `fn` every `ms` of the clock, rescheduling from its own callback, so a step runs it once. */
  private every(fn: () => unknown, ms: number): void {
    const tick = () => {
      this.later(tick, ms);
      return fn();
    };
    this.later(tick, ms);
  }
}
