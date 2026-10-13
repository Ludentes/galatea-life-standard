import { must, mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { pollUntil } from "../../util.js";
import type { sentFrom } from "./answers.js";
import { cursorNow, eventsAfter, restartSteward, type Ev } from "./rules.js";
import { holdEndLatenessMs, holderWord, iso, leaseEventsSince, leaseOf, ROUNDING_MS, stepTo, up } from "./util.js";

/** The helpers the hold checks share (GA-LEASE-1 to -11, GA-PERSIST-2): no check is registered here. */

export type LeaseEv = Record<string, any>;
export type Device = { fixture: string; adopt: string | null; bridge?: string };

/** Every `lease` event a check read, once each, by `seq`: a part on every end's reason reads them all. */
export class Seen {
  readonly all = new Map<number, LeaseEv>();
  keep(events: LeaseEv[]): LeaseEv[] {
    for (const e of events) this.all.set(e.seq as number, e);
    return events;
  }
}

export const lampOn = (bridge: string): Device => ({ fixture: "lamp", adopt: "light", bridge });
export const sensorOn = (fixture: "motion" | "presence", bridge: string): Device => ({ fixture, adopt: "sensor", bridge });
/** A room and the devices in it, as define upserts. */
export const room = (id: string, devices: string[]) => [up("room", { id, name: id }), ...devices.map((d) => up("target", { id: d, room: id }))];

/** The granted `lease` event of each of `targets` since `cursor`, once each has come. */
export async function grantsOf(ctx: TestContext, seen: Seen, cursor: string, targets: string[], what: string): Promise<Record<string, LeaseEv>> {
  const got = await pollUntil(async () => {
    const ev = seen.keep(await leaseEventsSince(ctx, cursor));
    const g = targets.map((t) => ev.find((e) => e.change === "granted" && e.target === t));
    return g.every((x) => x !== undefined) ? g : undefined;
  }, 10_000, `${what}: no granted lease event for each of ${targets.join(", ")}`, 100);
  ctx.evidence(`${what}: ${got.map((e) => JSON.stringify(e)).join(", ")}`);
  return Object.fromEntries(targets.map((t, i) => [t, got[i]!]));
}

/** Fails unless `target`'s lease shows `expires` within [lo, hi] (the instants the change lies between, moved by its window) give or take rounding. */
export async function expiresBetween(ctx: TestContext, target: string, lo: number, hi: number, what: string): Promise<void> {
  const l = await leaseOf(ctx, target);
  must(l !== undefined, `${what}: no hold`);
  const e = Date.parse(l!.expires);
  ctx.evidence(`${what}: expires ${l!.expires}, between ${iso(lo)} and ${iso(hi)}`);
  must(e >= lo - ROUNDING_MS && e <= hi + ROUNDING_MS, `${what}: expires ${l!.expires}, not between ${iso(lo)} and ${iso(hi)}`);
}

export interface HoldEnd {
  /** The end the check computed; none: the lease's own `expires`, read now (R-20). */
  dueMs?: number;
  /** With `dueMs`: the lease's `expires` must read the end 5 s before it, and the clock steps from that `expires`. */
  byExpires?: boolean;
  /** The holder (a `holderWord`) the lease must show while it stands; gone means no lease or another holder. */
  holder?: string;
  /** The `end` the ended event must name (one of them); none: the ended event is not read. */
  end?: string | string[];
  /** The moment the room last became quiet, which `quiet_since` must name; null: it must be absent (quiet throughout). */
  quietSince?: number | null;
  /** Where the lease events read are kept. */
  seen?: Seen;
  /** Where to read the ended event from, when the end may come before the call (a late ack's); none: a cursor taken before the end. */
  cursor?: string;
}

/**
 * A hold's end (R-20): still held 5 s before it (when that is still ahead); gone once the clock has passed it by
 * the hold end lateness, polled for at most the run's allowance of wall time and never stepped further; and, when
 * `end` is named, its ended `lease` event naming it. Returns the ended event (when read) and the cursor taken
 * before the end, from which what the end set off is read.
 */
export async function holdEnds(ctx: TestContext, target: string, what: string, want: HoldEnd): Promise<{ ev?: LeaseEv; cursor: string }> {
  const tol = 2_000 + ctx.allowanceMs;
  const held = (l: Awaited<ReturnType<typeof leaseOf>>) => l !== undefined && (want.holder === undefined || holderWord(l.holder) === want.holder);
  const by = want.holder === undefined ? "" : ` by ${want.holder}`;
  let from = want.dueMs;
  if (from === undefined) {
    const l = await leaseOf(ctx, target);
    must(held(l), `${what}: ${target} is not held${by}: ${JSON.stringify(l?.holder ?? "no lease")}`);
    from = Date.parse(l!.expires);
  }
  if (from - 5_000 > ctx.time.now()) {
    const due = from;
    await stepTo(ctx, due - 5_000);
    const l = await leaseOf(ctx, target);
    must(held(l), `${what}: the hold${by} was gone 5 s before its end at ${iso(due)}: ${JSON.stringify(l?.holder ?? "no lease")}`);
    ctx.evidence(`${what}: held 5 s before ${iso(due)}, expires ${l!.expires}`);
    if (want.dueMs !== undefined && want.byExpires) {
      const e = Date.parse(l!.expires);
      must(Math.abs(e - due) <= tol, `${what}: expires ${l!.expires} 5 s before the end, not ${iso(due)}`);
      from = e;
    }
  }
  const cursor = want.cursor ?? await cursorNow(ctx);
  await stepTo(ctx, from + holdEndLatenessMs());
  await pollUntil(async () => !held(await leaseOf(ctx, target)) || undefined, ctx.allowanceMs,
    `${what}: the hold${by} stood ${holdEndLatenessMs()} ms after its end at ${iso(from)}`, 50);
  if (want.end === undefined) return { cursor };
  const ev = await pollUntil(async () => keep(want.seen, await leaseEventsSince(ctx, cursor)).find((e) => e.change === "ended" && e.target === target),
    ctx.allowanceMs, `${what}: the hold ended with no ended lease event`, 50);
  ctx.evidence(`${what}: ${JSON.stringify(ev)}`);
  const ends = [want.end].flat();
  must(ends.includes(ev.end), `${what}: the hold ended ${JSON.stringify(ev.end)}, not ${ends.join(" or ")}`, ev);
  if (want.quietSince === null) must(ev.quiet_since === undefined, `${what}: quiet_since ${ev.quiet_since} for a room quiet throughout`, ev);
  else if (want.quietSince !== undefined) {
    must(typeof ev.quiet_since === "string" && Math.abs(Date.parse(ev.quiet_since) - want.quietSince) <= tol,
      `${what}: quiet_since ${ev.quiet_since}, not ${iso(want.quietSince)}`, ev);
  }
  return { ev, cursor };
}

const keep = (seen: Seen | undefined, events: LeaseEv[]) => (seen ? seen.keep(events) : events);

/** `holdEnds` at `dueMs`, its ended event naming `want.end`: the ended event. */
export async function endsAt(ctx: TestContext, seen: Seen, target: string, dueMs: number, what: string,
  want: Omit<HoldEnd, "dueMs" | "seen"> & { end: string | string[] }): Promise<LeaseEv> {
  return (await holdEnds(ctx, target, what, { ...want, dueMs, seen })).ev!;
}

/** Where a restarted steward's read-back stands: how many read-back calls (`history`, `state`) the stand-in has seen. */
export interface ReadBack { calls: number }

/**
 * Restarts the steward, `between` run while it is down, and waits until the restarted steward has made a read-back
 * call to its applier (`history` or `state`, whichever its recovery uses; a start's wait, 15 s): what it does at the
 * read-back is then timed from its last such call.
 */
export async function restartReadBack(ctx: TestContext, between: () => Promise<unknown>): Promise<ReadBack> {
  const applier = ctx.standIn!.applier;
  let calls = 0;
  await restartSteward(ctx, async () => {
    calls = applier.readBacks.length;
    await between();
  });
  await pollUntil(async () => applier.readBacks.length > calls || undefined, 15_000, "the restarted steward made no read-back call to its applier", 50);
  return { calls };
}

/**
 * A hold whose end fell in a restart's gap (GA-LEASE-7, GA-PERSIST-2), called once `restartReadBack` returned: its ended
 * event since `cursor`, within the hold end lateness and the run's allowance of wall time of the steward's last read-back
 * call seen (a later call moves the anchor), naming `end` and an `end_time` equal to `endMs`, the hold's `expires`
 * before the stop. The ended event.
 */
export async function endedAtRestart(ctx: TestContext, seen: Seen, cursor: string, target: string, endMs: number, end: string,
  what: string, readBack: ReadBack): Promise<LeaseEv> {
  const applier = ctx.standIn!.applier;
  const bound = holdEndLatenessMs() + ctx.allowanceMs;
  let calls = applier.readBacks.length;
  let anchor = Date.now();
  let ev: LeaseEv | undefined;
  for (;;) {
    ev = seen.keep(await leaseEventsSince(ctx, cursor)).find((e) => e.change === "ended" && e.target === target);
    if (ev) break;
    if (applier.readBacks.length !== calls) {
      calls = applier.readBacks.length;
      anchor = Date.now();
    }
    if (Date.now() - anchor > bound) {
      ctx.evidence(`${what}, after the restart: read-back calls ${JSON.stringify(applier.readBacks.slice(readBack.calls))}, lease ${JSON.stringify(await leaseOf(ctx, target))}, `
        + `events ${JSON.stringify((await eventsAfter(ctx, cursor)).slice(-8))}`);
      must(false, `${what}: not ended within ${bound} ms of the restarted steward's last read-back call`);
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  ctx.evidence(`${what}: ended at the restart, after read-back calls ${applier.readBacks.slice(readBack.calls).map((x) => x.tool).join(", ")}: ${JSON.stringify(ev)}`);
  mustEqual(ev!.end, end, `${what}: how it ended`);
  must(typeof ev!.end_time === "string", `${what}: ended at the restart for an end in the gap, it names no end_time`, ev);
  mustEqual(ev!.end_time, iso(endMs), `${what}: its end_time, against the expires before the stop`);
  return ev!;
}

/**
 * What became of `rule`'s step on `target` since `cursor`: `refused(<reason>) <holder>` from its `refused`
 * event, `skipped(<reason>)` from its outcome, or `sent` once the stand-in received `action` for the rule.
 */
export async function stepOf(ctx: TestContext, cursor: string, sent: ReturnType<typeof sentFrom>, rule: string, target: string, action: string,
  what: string): Promise<string> {
  const got = await pollUntil(async () => {
    const ev = await eventsAfter(ctx, cursor);
    const r = ev.find((e) => e.type === "refused" && e.rule === rule && e.target === target);
    if (r) return `refused(${r.reason}) ${holderWord(r.holder)}`;
    const o = ev.find((e) => e.type === "outcome" && e.cause?.rule === rule && e.target === target && (e.outcome === "skipped" || e.outcome === "refused"));
    if (o) return `${o.outcome}(${o.reason})`;
    return sent().some((x) => x.target === target && x.action === action && x.for?.rule === rule) ? "sent" : undefined;
  }, 10_000, `${what}: rule ${rule}'s step on ${target} was neither sent, refused nor skipped`, 100);
  ctx.evidence(`${what}: rule ${rule}'s step on ${target}: ${got}`);
  return got;
}

/** Waits until the steward has relayed the stand-in's answer to a step on `target` (`acked` unless told) since `cursor`, of `rule`'s when named. */
export async function answered(ctx: TestContext, cursor: string, target: string, what: string, o: { rule?: string; outcome?: string } = {}): Promise<Ev> {
  return pollUntil(async () => (await eventsAfter(ctx, cursor)).find((e) => e.type === "outcome" && e.target === target && e.outcome === (o.outcome ?? "acked")
    && (o.rule === undefined || e.cause?.rule === o.rule)), 10_000, `${what}: the stand-in's ${o.outcome ?? "acked"} on ${target} was not relayed`, 100);
}
