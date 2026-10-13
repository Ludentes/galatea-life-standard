import { must, mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import { LAMP } from "../../steward-home.js";
import { pollUntil } from "../../util.js";
import { applyInline, outcomes, sentFrom } from "./answers.js";
import { cursorNow, eventsAfter, fires, type Ev } from "./rules.js";
import { ackWithinMs } from "./outcomes.js";
import { act, cursorExpiredGap, holderWord, mustDefine, ownerOf, scripted, up } from "./util.js";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const iso = (ms: number) => new Date(ms).toISOString();
/** The vibration sensor's extension: its alarm an occurrence, its presence a personal one. */
const V = "org.galatea.test.vibration";

/**
 * The owner's `history` over `[from, to]`, every target or `targets`. `to` is a minute past the time
 * server's now unless given: the steward stamps events by its own clock, which an SNTP sync may set a
 * little ahead, so a case never bounds `history` by its own clock (the milestone 7+10+11 review, I1).
 */
export async function historyOf(ctx: TestContext, from: number, to: number = ctx.time.now() + MINUTE, targets?: string[]): Promise<Ev[]> {
  return (await ownerOf(ctx).callOk("history", { from: iso(from), to: iso(to), ...(targets ? { targets } : {}) })).events as Ev[];
}

/** An event as `type target key`, what a list of them is compared by. */
const kind = (e: Ev) => [e.type, e.target ?? e.rule_id ?? e.rule ?? "", e.key ?? e.latch ?? e.change ?? ""].join(" ").trim();

/** Each device's lease as the owner's `state` shows it, `target holder precedence`, the holder a `holderWord`. */
async function leases(ctx: TestContext): Promise<string[]> {
  const l = ((await ownerOf(ctx).callOk("state")).leases ?? {}) as Record<string, { holder: any; precedence: string; expires: string }>;
  return Object.entries(l).map(([t, x]) => `${t} ${holderWord(x.holder)} ${x.precedence}`).sort();
}

/** The owner's `state` leases until `want`, as the steward relays the stand-in's events. */
async function leasesBecome(ctx: TestContext, want: string[], what: string): Promise<void> {
  await pollUntil(async () => JSON.stringify(await leases(ctx)) === JSON.stringify([...want].sort()) || undefined, 10_000,
    `${what}: the leases were ${JSON.stringify(await leases(ctx))}, not ${JSON.stringify([...want].sort())}`, 100);
}

requirement("GA-STW-7", {
  seam: "steward",
  covers: "the owner's define event, read at her app, carries its diff, and the guest panel's events give it without the diff; history returns, oldest first and with their causes, the steward's define, lease, refused and rule_fired events (an outside change leasing the lamp, a rule's turn_off on it refused) and the applier's state, outcome, latch and rule_fired (a safety rule closing the valve, its state change caused by it), liveness, model, late_ack, route_conflict, provision, freshness, transport, other_admins, bridge_fault, occurrence and undescribed events (undescribed as received live); a speaker's speech and the vibration sensor's personal presence occurrence are served by events and absent from history; events still serve them from the cursor 3590 s on, and history still returns every one a minute short of 7 days on; answer in history is graded under GA-CONF-2; ask, scenario, schedule_missed, schedule_skipped and notice pass the same filter and are not graded here; narrowed is slice 9's (narrow is not built)",
}, async (ctx) => {
  const applier = ctx.standIn!.applier;
  // The define event's diff, to its endpoint (the owner's app) and not to the guest panel.
  {
    const c = await cursorNow(ctx);
    await mustDefine(ctx, [up("room", { id: "attic", name: "Чердак" })], "a room");
    const own = ((await ownerOf(ctx).callOk("events", { cursor: c })).events as Ev[]).find((e) => e.type === "define");
    const panel = ((await ctx.steward!.panel.callOk("events", { cursor: c })).events as Ev[]).find((e) => e.type === "define");
    ctx.evidence(`the owner's define event at her app: ${JSON.stringify(own)}; at the guest panel: ${JSON.stringify(panel)}`);
    must(own !== undefined && own.diff !== undefined, "the define event read at the define's endpoint carries no diff", own);
    must(panel !== undefined && panel.diff === undefined, "the guest panel's events gave the diff of the owner's define", panel);
  }
  const [shaker, speaker, valve] = await scripted(ctx, [{ fixture: "shaker", adopt: "sensor" }, { fixture: "speaker", adopt: "speaker" },
    { fixture: "valve", adopt: "water_valve" }]);
  await mustDefine(ctx, [up("rule", { id: "off", name: "Гасить", conditions: [{ target: LAMP, key: "on", op: "eq", value: true }],
    actions: [{ target: LAMP, action: "onoff.turn_off", args: {} }] })], "a rule turning the lamp off");
  const from = ctx.time.now() - 1_000;
  const cursor = await cursorNow(ctx);
  // The steward's own: an outside change leases the lamp, and the rule's turn_off on it is refused.
  applier.scriptValue(LAMP, "on", true);
  await pollUntil(async () => (await eventsAfter(ctx, cursor)).some((e) => e.type === "refused") || undefined, 10_000,
    "the rule's turn_off on the leased lamp was not refused", 100);
  // The applier's: a safety rule closes the valve and latches, and the rest as the stand-in words them.
  applier.scriptSafetyRule({ id: "leak", actuates: [{ target: valve!, key: "open", value: false }], latch: true });
  applier.scriptSafetyFire("leak");
  applier.scriptFresh(valve!, 600);
  applier.scriptLiveness(speaker!, "stale");
  const worded: [Parameters<typeof applier.scriptEvent>[0], Record<string, unknown>][] = [
    ["late_ack", { apply_id: "elsewhere", step_id: "s1", target: LAMP, cause: "external" }],
    ["route_conflict", { target: LAMP, bridges: ["sim-bridge", "other-bridge"] }],
    ["provision", { target: valve, change: "provisioned" }],
    ["freshness", { target: valve, fresh_s: 600 }],
    ["transport", { transport: "sim-bridge:zigbee", up: false }],
    ["other_admins", { target: LAMP, admins: ["another-app"] }],
    ["bridge_fault", { bridge: "sim-bridge", fault: "restarted" }],
    ["occurrence", { target: shaker, key: `${V}.alarm`, value: true, cause: "device" }],
    // Relayed live only: the applier's history does not keep it (applier GA-DESC-19).
    ["undescribed", { target: shaker, name: "tamper_raw" }],
    ["occurrence", { target: shaker, key: `${V}.presence`, value: true, cause: "device" }],
    ["state", { target: speaker, key: "speech", value: "новости", cause: "device" }],
  ];
  for (const [type, fields] of worded) applier.scriptEvent(type, fields);
  const served = await pollUntil(async () => {
    const e = await eventsAfter(ctx, cursor);
    return e.some((x) => x.type === "state" && x.key === "speech") ? e : undefined;
  }, 10_000, "the steward did not relay the speaker's speech", 100);
  ctx.evidence(`events: ${served.map(kind).join(", ")}`);
  must(served.some((e) => e.type === "occurrence" && e.key === `${V}.presence`), "events did not serve the personal presence occurrence");
  const h = await historyOf(ctx, from);
  ctx.evidence(`history: ${h.map(kind).join(", ")}`);
  const types = new Set(h.map((e) => e.type));
  const want = ["define", "lease", "refused", "rule_fired", "state", "outcome", "latch", "liveness", "model", "late_ack", "route_conflict",
    "provision", "freshness", "transport", "other_admins", "bridge_fault", "occurrence", "undescribed"];
  mustEqual(want.filter((t) => !types.has(t)), [], "the event types history left out");
  mustEqual(h.map((e) => e.seq), [...h.map((e) => e.seq)].sort((a, b) => a - b), "history's order, by seq");
  must(!h.some((e) => e.type === "state" && e.key === "speech"), "history returned the speaker's speech");
  must(!h.some((e) => e.type === "occurrence" && e.key === `${V}.presence`), "history returned the personal presence occurrence");
  must(h.some((e) => e.type === "occurrence" && e.key === `${V}.alarm`), "history left out the alarm occurrence");
  const lamp = h.find((e) => e.type === "state" && e.target === LAMP);
  mustEqual(lamp?.cause, "external", "the outside change's cause in history");
  mustEqual(h.find((e) => e.type === "state" && e.target === valve)?.cause, { safety_rule: "leak" }, "the safety rule's change's cause in history");
  mustEqual(h.find((e) => e.type === "lease")?.holder, "external", "the lease's holder in history");
  mustEqual(h.find((e) => e.type === "refused")?.rule, "off", "the refused event's rule in history");
  // Events kept 3600 s: the cursor still serves them 3590 s on.
  await ctx.time.stepAndWait(3_590_000 - (ctx.time.now() - from));
  const still = await ownerOf(ctx).call("events", { cursor });
  must(still.ok, `events from the cursor 3590 s on: ${still.ok ? "" : still.error}`);
  must((still.body.events as Ev[]).some((e) => e.type === "refused"), "events no longer served the refused event 3590 s on");
  // History kept 7 days: every event it returned is returned a minute short of them.
  const seqs = h.map((e) => e.seq);
  await ctx.time.stepAndWait(constantMs("steward", "history-retention") - MINUTE - (ctx.time.now() - from));
  const later = (await historyOf(ctx, from)).filter((e) => e.seq <= seqs.at(-1)!);
  ctx.evidence(`history ${Math.round((ctx.time.now() - from) / DAY * 100) / 100} days on: ${later.length} of ${h.length}`);
  mustEqual(later.map((e) => e.seq), seqs, "history's events a minute short of 7 days on");
});

requirement("GA-LEASE-6", {
  seam: "steward",
  covers: "a latching safety rule closing the valve leases it to the rule at safety_rule precedence, the member's open of it refused(leased), and keeps it when the rule completes; its latch cleared by the owner ends it; a latchless rule turning the lamp on leases it until its rule_fired; across a cursor_expired gap: a latch set inside it leases the valve after (read from state's latches), one set before and cleared inside ends; a latchless rule fired and completed inside it holds no lease after, and one fired before and completed inside ends (its rule_fired read from history); a latchless rule on the valve that does not complete keeps its lease past the valve's ack_within_s, the late-ack window and slack, and, when describe states safety_lease_s, ends it only past that, a rule opening the valve then refused(safety) firing again when the safety rule completes; with no safety_lease_s stated, the lease stands 20 minutes on, until the rule completes",
}, async (ctx) => {
  const s = ctx.steward!;
  const applier = ctx.standIn!.applier;
  const [valve] = await scripted(ctx, [{ fixture: "valve", adopt: "water_valve" }]);
  applier.scriptSafetyRule({ id: "leak", actuates: [{ target: valve!, key: "open", value: false }], latch: true });
  applier.scriptSafetyRule({ id: "night", actuates: [{ target: LAMP, key: "on", value: true }] });
  applier.scriptSafetyFire("leak");
  await leasesBecome(ctx, [`${valve} safety:leak safety_rule`], "the latching rule fired");
  const open = outcomes(await applyInline(s.olga, "olga-app", [act(valve!, "valve.open")]), "the member's open of the leased valve");
  ctx.evidence(`the member's open: ${open.join(", ")}`);
  mustEqual(open, [`${valve} refused(leased)`], "the member's open of the valve a safety rule leased");
  applier.scriptLatchClear("leak", "cleared_by_owner");
  await leasesBecome(ctx, [], "the latch cleared by the owner");
  applier.scriptSafetyFire("night", { complete: false });
  await leasesBecome(ctx, [`${LAMP} safety:night safety_rule`], "the latchless rule running");
  applier.scriptSafetyComplete("night");
  await leasesBecome(ctx, [], "the latchless rule complete");

  // Across a gap.
  await cursorExpiredGap(ctx, () => { applier.scriptSafetyFire("leak"); });
  await leasesBecome(ctx, [`${valve} safety:leak safety_rule`], "a latch set inside a gap");
  await cursorExpiredGap(ctx, () => { applier.scriptLatchClear("leak"); });
  await leasesBecome(ctx, [], "a latch cleared inside a gap");
  const cursor = await cursorNow(ctx);
  await cursorExpiredGap(ctx, () => { applier.scriptSafetyFire("night"); });
  // The recovered completion is the last the gap held: once it is relayed, the lease it ended is gone.
  await pollUntil(async () => (await eventsAfter(ctx, cursor)).some((e) => e.type === "rule_fired" && e.rule_id === "night" && e.recovered) || undefined,
    10_000, "the latchless rule's completion inside the gap was not recorded", 100);
  mustEqual(await leases(ctx), [], "the leases after a latchless rule fired and completed inside a gap");
  applier.scriptSafetyFire("night", { complete: false });
  await leasesBecome(ctx, [`${LAMP} safety:night safety_rule`], "the latchless rule running before a gap");
  // It runs a second before it completes: the steward times its lease by its own clock and the completion it reads from
  // history by the applier's, and the two may stand a few milliseconds apart (under load, an SNTP offset).
  await ctx.time.stepAndWait(1_000);
  await cursorExpiredGap(ctx, () => { applier.scriptSafetyComplete("night"); });
  await leasesBecome(ctx, [], "the latchless rule completing inside a gap");

  // A latchless rule whose completion does not come: its lease stands past the valve's ack bound and the
  // 60 s late-ack window (the row's floor, no slack added), and past safety_lease_s when describe states
  // one, else until it completes. The check stands 5 s before the floor.
  const bound = (await ownerOf(ctx).callOk("describe")).safety_lease_s as number | undefined;
  ctx.evidence(`safety_lease_s: ${bound ?? "not stated"}`);
  const ack = Math.max(...await Promise.all(["valve.open", "valve.close"].map((a) => ackWithinMs(ctx, valve!, a))));
  const floor = ack + 60_000;
  applier.scriptSafetyRule({ id: "shut", actuates: [{ target: valve!, key: "open", value: false }] });
  await ctx.time.stepAndWait(1_000);
  const granted = ctx.time.now();
  applier.scriptSafetyFire("shut", { complete: false });
  await leasesBecome(ctx, [`${valve} safety:shut safety_rule`], "the latchless rule on the valve running");
  await ctx.time.stepAndWait(floor - 5_000);
  mustEqual(await leases(ctx), [`${valve} safety:shut safety_rule`], "the leases before the valve's ack bound and the late-ack window passed");
  if (bound === undefined) {
    await ctx.time.stepAndWait(20 * 60_000);
    mustEqual(await leases(ctx), [`${valve} safety:shut safety_rule`], "the leases 20 minutes on, the rule not complete and no safety_lease_s stated");
    applier.scriptSafetyComplete("shut");
    await leasesBecome(ctx, [], "the latchless rule on the valve complete");
    return;
  }
  const ends = granted + Math.max(bound * 1000, floor);
  if (ends - 5_000 > ctx.time.now()) await ctx.time.stepAndWait(ends - 5_000 - ctx.time.now());
  mustEqual(await leases(ctx), [`${valve} safety:shut safety_rule`], "the leases before safety_lease_s passed");
  await ctx.time.stepAndWait(10_000 + ctx.allowanceMs);
  await leasesBecome(ctx, [], "the latchless lease past safety_lease_s");
  // Ended early, the rule still running: a rule opening the valve is refused safety, and fires again once the rule completes.
  const c = await cursorNow(ctx);
  const sent = sentFrom(ctx);
  await mustDefine(ctx, [up("rule", { id: "reopen", name: "Открыть", conditions: [{ target: LAMP, key: "on", op: "eq", value: true }],
    actions: [act(valve!, "valve.open")] })], "a rule opening the valve while the lamp is on");
  const refused = await pollUntil(async () => (await eventsAfter(ctx, c)).find((e) => e.type === "outcome" && (e.cause as { rule?: string })?.rule === "reopen"),
    10_000, "the rule opening the valve had no outcome", 100);
  ctx.evidence(`the rule opening the valve: ${refused.outcome}(${refused.reason})`);
  mustEqual(`${refused.outcome}(${refused.reason})`, "refused(safety)", "the rule's outcome while the safety rule runs");
  applier.scriptSafetyComplete("shut");
  await fires(ctx, c, "reopen", 2, "the safety rule's completion");
  await pollUntil(async () => sent().some((x) => x.target === valve && x.action === "valve.open") || undefined, 10_000,
    "the rule's valve.open did not reach the stand-in after the safety rule completed", 100);
});
