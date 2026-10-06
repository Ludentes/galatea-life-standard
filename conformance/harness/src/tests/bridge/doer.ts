import { RequirementFailure } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { constantMs } from "../../manifest.js";
import type { Seen } from "../../seams/bridge-watcher.js";

/**
 * What the tests that script a doer share. Each such test starts with a doer's op (`describe`), sent
 * before any wait, so a subject whose test transport has no doer to script refuses it at once, and
 * the test is not_applicable.
 */

/** A closed lamp, as a `describe` op gives it: on and off, confirmed by the protocol. */
export const LAMP = { capabilities: ["onoff"], feedback: "closed" };

/** Within a 1 s bound, the broker's delivery allowance added. */
export const oneSecond = (ctx: TestContext) => 1000 + ctx.allowanceMs;

/** The bridge's topics under test, and predicates on what it published. */
export function topics(ctx: TestContext) {
  const base = `${ctx.root}/bridges/${ctx.bridgeId}`;
  const entry = (s: Seen, id: string) =>
    (s.payload?.devices ?? []).find((d: { id: string }) => d.id === id) as Record<string, any> | undefined;
  return {
    base,
    entry,
    /** A `devices` document whose entry for `id` `pred` holds for. */
    devices: (id: string, pred: (e: Record<string, any>) => boolean = () => true) => (s: Seen) => {
      if (s.topic !== `${base}/devices` || s.payload === null) return false;
      const e = entry(s, id);
      return e !== undefined && pred(e);
    },
    deviceStatus: (id: string) => `${base}/devices/${id}/status`,
    /** The device's status, when `pred` holds for its payload. */
    statusOf: (id: string, pred: (p: Record<string, any>) => boolean = () => true) => (s: Seen) =>
      s.topic === `${base}/devices/${id}/status` && s.payload !== null && pred(s.payload),
    /** The bridge's status, when `pred` holds for it. */
    status: (pred: (p: Record<string, any>) => boolean = () => true) => (s: Seen) =>
      s.topic === `${base}/status` && s.payload !== null && pred(s.payload),
    /** The roster entry of `id` in a status. */
    roster: (s: Seen, id: string) => (s.payload?.devices ?? []).find((d: { id: string }) => d.id === id) as Record<string, any> | undefined,
  };
}

/**
 * Describes the device and waits for a `devices` document that holds it; its id is the device's name.
 * The doer's op goes first, so a subject with no doer refuses it at once and the test is
 * not_applicable. Then the bridge's status must show no transport `down` before this returns: a
 * command before then may be acked `failed(unreachable)` by a conforming bridge (GA-BRIDGE-6), so no
 * test commands a device sooner.
 */
export async function describe(ctx: TestContext, device: string, entry: Record<string, unknown>): Promise<void> {
  const t = topics(ctx);
  const mark = ctx.watch!.seen.length;
  await ctx.transport!.send({ op: "describe", device, entry });
  await transportsUp(ctx);
  await ctx.watch!.waitFor(t.devices(device), oneSecond(ctx), mark);
}

/**
 * Before a window's tail is graded: waits, without moving the clock, up to 1 s of real time (the
 * delivery allowance added) for a status `pred` holds for whose `publishedAt` is within `bound` of
 * `end`, the clock's time at the window's end. A status the bridge published in time but the watcher
 * had not yet received is then counted; one that never comes leaves the tail's gap to be graded.
 */
export async function awaitTail(ctx: TestContext, pred: (s: Seen) => boolean, end: number, bound: number, from: number): Promise<void> {
  await ctx.watch!.waitFor((s) => pred(s) && Date.parse(s.payload.publishedAt) >= end - bound, oneSecond(ctx), from).catch((err) => {
    if (!(err instanceof RequirementFailure)) throw err;
  });
}

/** The time a reading of `key` rests on, in a device status: its own in `timestamps`, else the status's. */
export const timeOf = (payload: Record<string, any>, key: string): string => payload.timestamps?.[key] ?? payload.timestamp;

/**
 * Lets the subject's time pass, a second at a time, until the watcher has seen what `pred` holds for
 * after `from`, or `ms` of it passed; then waits for it, bounded. With `realMs`, each second of the
 * subject's time also waits up to `realMs` of real time first, for what the subject does on real
 * timers as well as on its clock (an MQTT client's reconnection).
 */
export async function passUntil(ctx: TestContext, pred: (s: Seen) => boolean, ms: number, from: number,
  { realMs = 0 }: { realMs?: number } = {}): Promise<Seen> {
  const watch = ctx.watch!;
  const until = ctx.time.now() + ms;
  for (;;) {
    if (realMs > 0) {
      const hit = await watch.waitFor(pred, realMs, from).catch((err) => {
        if (err instanceof RequirementFailure) return undefined;
        throw err;
      });
      if (hit) return hit;
    }
    if (watch.seen.slice(from).some(pred) || ctx.time.now() >= until) break;
    await ctx.time.advance(1000, { chunkMs: 1000 });
  }
  return watch.waitFor(pred, oneSecond(ctx), from);
}

/**
 * The coordinator reads `state`, and the bridge's status says so. The standard gives a transport
 * that falls silent "that transport `down` within 30 s" (*Faults*), and one coming back `up` needs an
 * exchange, which the bridge may make only at its next retry, `retryIntervalMs` away while `down`
 * (GA-BRIDGE-11, GA-BRIDGE-23). A bridge that shows it at once passes at once; one that waits on its
 * own clock has that clock passed for it, up to the bound.
 */
export async function coordinator(ctx: TestContext, state: "up" | "down"): Promise<void> {
  const t = topics(ctx);
  const watch = ctx.watch!;
  const now = (p: Record<string, any>) => (p.transports ?? []) as { state: string; retryIntervalMs?: number }[];
  const before = watch.seen.filter(t.status()).at(-1);
  const mark = watch.seen.length;
  await ctx.transport!.send({ op: "transportState", state });
  const shown = t.status((p) => now(p).length > 0 && now(p).every((x) => x.state === state));
  const retry = Math.max(0, ...(before ? now(before.payload) : []).map((x) => x.retryIntervalMs ?? 0));
  const bound = state === "down" ? constantMs("bridge", "transport-up-window")
    : retry || constantMs("bridge", "reconnection-backoff-ceiling");
  await watch.waitFor(shown, oneSecond(ctx), mark).catch(async (err) => {
    if (!(err instanceof RequirementFailure)) throw err;
    await passUntil(ctx, shown, bound, mark).catch((late) => {
      throw late instanceof RequirementFailure
        ? new RequirementFailure(`the bridge's status did not show the coordinator ${state} within ${bound} ms of its clock: ${late.message}`) : late;
    });
  });
}

/**
 * The bridge's latest status, not its graceful last, shows transports, each `up` or `unknown`; else
 * the test waits for one that does, 1 s in real time, then on the subject's clock up to the
 * reconnection backoff's ceiling, as an `up` may wait for the bridge's next retry (GA-BRIDGE-11,
 * GA-BRIDGE-23). A transport that only transmits is `unknown`, never `up` (GA-BRIDGE-72), and a
 * command on it is transmitted, not refused, so `unknown` passes. Only a status seen since the
 * subject's latest start counts: after a restart, the earlier instance's last `up` says nothing.
 */
export async function transportsUp(ctx: TestContext): Promise<void> {
  const t = topics(ctx);
  const watch = ctx.watch!;
  const since = ctx.subject?.startedAt ?? 0;
  const live = t.status((p) => p.graceful !== true && Array.isArray(p.transports) && p.transports.length > 0
    && p.transports.every((x: { state?: unknown }) => x.state === "up" || x.state === "unknown"));
  const up = (s: Seen) => s.realAt >= since && live(s);
  const mark = watch.seen.length;
  const last = watch.seen.slice(0, mark).filter(t.status()).at(-1);
  if (last && up(last)) return;
  const bound = constantMs("bridge", "reconnection-backoff-ceiling");
  await watch.waitFor(up, oneSecond(ctx), mark).catch(async (err) => {
    if (!(err instanceof RequirementFailure)) throw err;
    await passUntil(ctx, up, bound, mark).catch((late) => {
      throw late instanceof RequirementFailure
        ? new RequirementFailure(`the bridge's status did not show its transports up within ${bound} ms of its clock: ${late.message}`) : late;
    });
  });
}

/**
 * The bridge's first live status after a status interval of its clock has passed, and its latest
 * `devices` document then: the heartbeat carries the roster as it stands (GA-BRIDGE-17), and the
 * standard fixes no sooner bound for a change of the roster or of a device's entry to show. The mark
 * is taken after the interval, so a status published before it and delivered late is not the one
 * graded; the next heartbeat comes at most one interval later.
 */
export async function settled(ctx: TestContext): Promise<{ status: Seen; devices: Seen }> {
  const t = topics(ctx);
  const watch = ctx.watch!;
  const interval = constantMs("bridge", "status-interval");
  const live = t.status((p) => p.graceful !== true);
  await ctx.time.advance(interval, { chunkMs: 1000 });
  const mark = watch.seen.length;
  const status = await passUntil(ctx, live, interval, mark);
  const devices = watch.seen.filter((s) => s.topic === `${t.base}/devices` && s.payload !== null).at(-1);
  if (!devices) throw new RequirementFailure("the bridge published no devices document");
  return { status, devices };
}

/** Runs `body` with the coordinator down, then brings it up; a failure to bring it up never hides the body's. */
export async function whileDown(ctx: TestContext, body: () => Promise<void>): Promise<void> {
  await coordinator(ctx, "down");
  let failed = true;
  try {
    await body();
    failed = false;
  } finally {
    if (failed) await coordinator(ctx, "up").catch(() => {});
    else await coordinator(ctx, "up");
  }
}
