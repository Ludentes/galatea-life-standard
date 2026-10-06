import { expect } from "vitest";
import { RequirementFailure } from "../src/assert.js";
import type { TestContext } from "../src/context.js";
import { registered } from "../src/registry.js";
import type { LinkRecord } from "../src/seams/bridge-link.js";
import type { Seen } from "../src/seams/bridge-watcher.js";
import "../src/tests/index.js";

/**
 * A fake bridge for the roster's and the network's tests (GA-BRIDGE-12, 13, 14, 15, 36, 38), which run
 * against it:
 * a watcher, a clock, a test transport, an applier side and a link, enough for each test's body. The
 * fake publishes its status and `devices` after each op and its status every interval of its clock;
 * each case changes one thing a conforming bridge does, to show the test catches it.
 */

export const BASE = "demo/bridges/subject";
const INTERVAL = 10_000;
export const START = Date.parse("2026-10-04T00:00:00.000Z");

export type Entry = Record<string, any>;
interface Dev {
  entry: Entry;
  roster: Entry;
  /** A polled device that answers no read (`silence`). */
  silent?: boolean;
  /** When the fake last read a polled device, on its clock. */
  polledAt?: number;
}

export interface Hooks {
  /** A device the doer described, as the fake bridge publishes it. */
  describe?: (id: string, given: Entry, dev: Dev, w: World) => void;
  /** Any other op, after which the fake publishes its devices and status; the fake accepts every op. */
  op?: (op: Entry, w: World) => void;
  /** A command the applier side sent; the fake publishes its terminal ack unless this does. */
  command?: (device: string, value: Entry, id: string, w: World) => boolean | void;
  /** Whether the fake publishes its status at this time of its clock. */
  statusAt?: (now: number) => boolean;
  /** Each second of the clock. */
  tick?: (now: number, w: World) => void;
  /** A restart of the subject; the fake's devices are kept unless this drops them. */
  restart?: (w: World) => void;
}

export interface World {
  seen: Seen[];
  records: LinkRecord[];
  devs: Map<string, Dev>;
  faults: Entry[];
  down: boolean;
  /** Counts the subject's starts; a restart gives its status a new instanceId. */
  instance: number;
  now: () => number;
  publish: (topic: string, payload: unknown, properties?: string[]) => void;
  status: () => void;
  devices: () => void;
  event: (payload: Entry) => void;
}

const iso = (ms: number) => new Date(ms).toISOString();
const instanceId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const DEFAULT_ACTIONS: Record<string, Entry[]> = {
  onoff: [{ action: "onoff.turn_on", idempotent: true, stateless: false, confirms: true },
    { action: "onoff.turn_off", idempotent: true, stateless: false, confirms: true }],
  lock: [{ action: "lock.lock", idempotent: true, stateless: false, confirms: true },
    { action: "lock.unlock", idempotent: true, stateless: false, confirms: true }],
};

export function fake(hooks: Hooks = {}) {
  const seen: Seen[] = [];
  const records: LinkRecord[] = [];
  let now = START;
  let lastStatus = -Infinity;
  let seq = 0;
  let commands = 0;
  let requests = 0;
  const w: World = {
    seen, records, devs: new Map(), faults: [], down: false, instance: 1, now: () => now,
    publish(topic, payload, properties) {
      // A copy, as the wire gives: a later change of the fake's state is not one of what it published.
      seen.push({ topic, payload: structuredClone(payload), retained: false, realAt: Date.now() });
      records.push({ kind: "publish", conn: 1, at: Date.now(), topic, qos: 1, retain: false, payload: JSON.stringify(payload),
        ...(properties ? { properties } : {}) });
    },
    status() {
      if (hooks.statusAt && !hooks.statusAt(now)) return;
      lastStatus = now;
      w.publish(`${BASE}/status`, {
        bridgeId: "subject", instanceId: instanceId(w.instance), v: 1, state: w.down ? "degraded" : "online",
        version: "1", levels: ["Serve"], faults: w.faults, ungoverned: [], blocked: [],
        transports: [{ id: "zb", kind: "zigbee", state: w.down ? "down" : "up", since: iso(START) }],
        devices: [...w.devs.values()].map((d) => d.roster), publishedAt: iso(now),
      });
    },
    devices() {
      w.publish(`${BASE}/devices`, { publishedAt: iso(now), devices: [...w.devs.values()].map((d) => d.entry) });
    },
    event(payload) {
      w.publish(`${BASE}/event`, { seq: ++seq, instanceId: instanceId(w.instance), ...payload });
    },
  };
  const watch = {
    seen,
    async waitFor(pred: (s: Seen) => boolean, ms: number, from = 0): Promise<Seen> {
      const deadline = Date.now() + ms;
      for (;;) {
        const hit = seen.slice(from).find(pred);
        if (hit) return hit;
        if (Date.now() > deadline) throw new RequirementFailure(`nothing within ${ms} ms`);
        await new Promise((r) => setTimeout(r, 5));
      }
    },
  };
  const isEvent = (s: Seen) => s.topic === `${BASE}/event` && s.payload !== null;
  const evidenceLog: string[] = [];
  const ctx = {
    root: "demo", bridgeId: "subject", allowanceMs: 0, watch, evidence: (note: string) => evidenceLog.push(note), evidenceLog,
    // The fake bridge claims Serve alone: the tests that read the claims skip Provision's steps.
    claims: ["Serve"],
    time: {
      now: () => now,
      /** The clock stands still between advances, so a message's time is the clock's. */
      at: () => now,
      advance: async (ms: number) => {
        for (const end = now + ms; now < end;) {
          now += 1000;
          hooks.tick?.(now, w);
          if (now - lastStatus >= INTERVAL) w.status();
        }
      },
    },
    transport: {
      send: async (op: Entry) => {
        if (op.op === "describe") {
          const given = op.entry as Entry;
          const caps = (given.capabilities ?? []) as string[];
          const dev: Dev = {
            entry: {
              id: op.device, stableIdentifier: `hw-${op.device}`, transport: "zb", model: given.model ?? { vendor: "v", model: "m" },
              capabilities: caps, actions: given.actions ?? caps.flatMap((c) => DEFAULT_ACTIONS[c] ?? []), feedback: given.feedback ?? "closed",
              reachMs: 1000, proposedClass: null, classEvidence: "none", otherAdmins: "unknown",
              ...(given.extensions ? { extensions: given.extensions } : {}),
            },
            roster: { id: op.device, transport: "zb", basis: given.basis ?? "report", cadenceMs: given.cadenceMs ?? null,
              basisMaxAgeMs: null, timestamp: null, lastCheckIn: null, observable: false, since: iso(START) },
          };
          w.devs.set(String(op.device), dev);
          hooks.describe?.(String(op.device), given, dev, w);
        } else {
          hooks.op?.(op, w);
        }
        w.devices();
        w.status();
        return {};
      },
    },
    subject: {
      startedAt: 0,
      async restart() {
        w.instance++;
        this.startedAt = Date.now();
        hooks.restart?.(w);
        w.status();
      },
    },
    applier: {
      /** A request is answered at once: a snapshot re-publishes the status, then replies. */
      async request(op: string): Promise<string> {
        const id = `r${++requests}`;
        if (op === "snapshot") w.status();
        w.publish(`${BASE}/reply/${id}`, { requestId: id, result: "ok" });
        return id;
      },
      reply: (id: string, ms: number, from = 0) => watch.waitFor((s) => s.topic === `${BASE}/reply/${id}`, ms, from),
      async command(device: string, value: Entry): Promise<string> {
        const id = `c${++commands}`;
        if (!hooks.command?.(device, value, id, w)) {
          w.publish(`${BASE}/devices/${device}/ack`, w.down
            ? { commandId: id, result: "failed", reason: "unreachable" } : { commandId: id, result: "applied" });
        }
        return id;
      },
      events: (type?: string, from = 0) => seen.slice(from).filter((s) => isEvent(s) && (type === undefined || s.payload.type === type))
        .map((s) => s.payload),
      event: (pred: (e: Entry) => boolean, ms: number, from = 0) => watch.waitFor((s) => isEvent(s) && pred(s.payload), ms, from),
    },
    bridgeLink: { records },
  } as unknown as TestContext;
  return { ctx, w };
}

export const run = (id: string, ctx: TestContext) => registered().find((t) => t.ids.includes(id))!.fn(ctx);
export const fails = async (id: string, ctx: TestContext, match?: RegExp) => {
  const err = await run(id, ctx).then(() => undefined, (e: unknown) => e);
  expect(err).toBeInstanceOf(RequirementFailure);
  if (match) expect((err as Error).message).toMatch(match);
};

/** A bridge whose doer's ops take effect as the scripted doer's do. */
export const SOCKET = "org.galatea.test.socket";
export const conforming: Hooks = {
  describe(_id, given, dev, w) {
    if (given.feedback === "open") return;
    if (given.basis === "poll") {
      dev.roster.basisMaxAgeMs = 3 * given.cadenceMs;
      dev.polledAt = w.now();
    }
    if (given.extensions) dev.entry.selfChanging = [`${SOCKET}.power`];
  },
  op(op, w) {
    const dev = w.devs.get(String(op.device));
    if (op.op === "reporting") {
      const configured = op.configuredMs as number[];
      dev!.roster.basisMaxAgeMs = configured.length ? 2 * Math.max(...configured) : op.modelMs;
    } else if (op.op === "silence") {
      dev!.silent = op.silent as boolean;
    } else if (op.op === "classFrom") {
      dev!.entry.proposedClass = op.proposedClass;
      dev!.entry.classEvidence = ({ modelDb: "model_db", guess: "none", device: "protocol" } as Record<string, string>)[op.from as string];
    } else if (op.op === "stateMismatch") {
      w.down = op.disagrees as boolean;
      w.faults = w.down ? [{ code: "state_mismatch", detail: "the store disagrees with the network" }] : [];
    } else if (op.op === "lockPin") {
      const unlock = DEFAULT_ACTIONS.lock![1]!;
      const held = typeof op.pin === "string";
      dev!.entry.actions = held ? DEFAULT_ACTIONS.lock : DEFAULT_ACTIONS.lock!.filter((a) => a !== unlock);
      w.faults = held ? [] : [{ code: "pin_missing", device: String(op.device), detail: "the lock requires a PIN" }];
    }
  },
  /** Each polled device read at its cadence, each answer a check-in unless it is silent; `observable` as the bound says. */
  tick(now, w) {
    for (const dev of w.devs.values()) {
      const r = dev.roster;
      if (r.basis === "poll" && typeof r.cadenceMs === "number" && dev.polledAt !== undefined && now - dev.polledAt >= r.cadenceMs) {
        dev.polledAt = now;
        if (!dev.silent) r.lastCheckIn = iso(now);
      }
      if (r.basis === "poll") r.observable = r.lastCheckIn !== null && r.basisMaxAgeMs !== null && now - Date.parse(r.lastCheckIn) <= r.basisMaxAgeMs;
    }
  },
};
export const withHooks = (more: Hooks): Hooks => ({ ...conforming, ...more });

