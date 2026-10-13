import { randomUUID } from "node:crypto";
import { must, mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import { CHANNEL, LAMP } from "../../steward-home.js";
import { pollUntil } from "../../util.js";
import { answer, applyInline, applyPlan, mustAccept, outcomes, planned, sentFrom } from "./answers.js";
import { ackWithinMs, endedAs, failuresOf, received, unlessRetried } from "./outcomes.js";
import { cursorNow, eventsAfter, firedOf, restartSteward } from "./rules.js";
import { runReads, scene, startRun } from "./scenarios.js";
import { answered, endedAtRestart, endsAt, expiresBetween, grantsOf, lampOn, restartReadBack, room, Seen, sensorOn, stepOf } from "./hold-helpers.js";
import { act, holderWord, iso, leaseEventsSince, leaseOf, mustDefine, ownerOf, pinHold, raiseTier, scripted, SECOND, setFlag, stepTo, stewardSees, targetIn, up } from "./util.js";

const ON = "onoff.turn_on";
/** How far GA-PERSIST-2 steps the clock on for a firing's retry after the restart: past GA-RULE-7's 300 s, any retry at all. */
const RETRY_LOOK_MS = 2 * 3_600_000;
/** How far the long gap of GA-PERSIST-2's hold part runs: two hours, past a missed change's whole `fixed_s` (3600 s pinned). */
const LONG_GAP_MS = 2 * 3_600_000;

/** `v` with every object's keys in order: a restart may give a definition's fields in another order, which is the same house. */
const sorted = (v: unknown): unknown => (Array.isArray(v) ? v.map(sorted) : v && typeof v === "object"
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, x]) => [k, sorted(x)])) : v);

/** What a restart must keep of the house, from the owner's `describe`. */
async function houseOf(ctx: TestContext): Promise<unknown> {
  const d = await ownerOf(ctx).callOk("describe");
  return sorted(Object.fromEntries(["revision", "home", "rooms", "groups", "endpoints", "scenarios", "rules", "schedules", "modes"].map((k) => [k, d[k]])));
}

/** The leases the owner's `state` shows, `target holder precedence expires`. */
async function leaseLines(ctx: TestContext): Promise<string[]> {
  const l = ((await ownerOf(ctx).callOk("state")).leases ?? {}) as Record<string, { holder: any; precedence: string; expires: string }>;
  return Object.entries(l).map(([t, x]) => `${t} ${holderWord(x.holder)} ${x.precedence} ${x.expires}`).sort();
}

requirement("GA-PERSIST-2", {
  seam: "steward",
  covers: "a notice held for want of a notify channel (the home's channel unadopted through the applier) is kept across the restart and delivered once the channel is adopted again; restarted cleanly, the steward keeps the house (describe's revision, home, rooms, groups, endpoints, scenarios, rules, schedules and modes as before); the member's lease of the lamp, with its expiry; an apply's key, its repeat returning the first apply and sending nothing; a plan of a confirm step answered yes before the restart, applied after it with a token; a plan with no ask either kept or lost, its answer and its apply unknown_plan both or neither; an answer to a plan never made unknown_plan; the events history needs, a history read after the restart giving the lamp's change from before it; the notice a pulse relay's failed(no_ack) holds, raised after the restart once its wait has passed and not inside the late-ack window, and none for a second relay whose late_ack came while the steward was down; a third dimmer's turn_on in flight at the stop, ended unreachable while the steward was down, is relayed naming its rule, and is tried again after the restart under a key other than the one before it; a run of a long scenario ends ended(interrupted) at the restart, its lease released. A held trigger's duration starting afresh at the restart is GA-RULE-1's case; each schedule's last run is GA-SCHED-2's case; the narrowings and the front's records are slice 9's, a session's persons slice 8's. A person's hold, under the pinned windows with presence_renews set true (a steward that refuses the flag: the quiet parts skipped and said): an outside on in a room whose motion cleared 3000 s after it, the steward then down 300 s with no presence in its room, ends on_s after the motion's false and names it as quiet_since, not on_s after the restart; another room's outside on, motion true and false in that gap, ends on_s after that false, counted at its event's time and not at the read-back; a hold whose quiet end fell in a two-hour gap, motion only later in the gap, ends at the restart, end quiet with end_time that end, not revived; a roomless lamp's outside on 10 s into that gap, its fixed_s end passed by the read-back, takes no lease and puts no lease event; with other_s pinned apart from on_s and off_s, a member's turn_off in a room quiet throughout, its expires off_s after its dispatch before the stop, ends off_s after its dispatch across a restart (its direction kept), `quiet` with presence_renews and `window` without; with owner_work_passes_guest_holds set true (a steward that refuses it: skipped and said), after a restart the owner's rule passes the guest panel's acked hold and is refused(leased) by the member's acked hold beside it (each hold's derived role kept); each restart's gap end read within the hold end lateness of the read-back, its end_time the hold's expires before the stop",
}, async (ctx) => {
  const s = ctx.steward!;
  const applier = ctx.standIn!.applier;
  const slack = constantMs("steward", "late-ack-slack");
  const [dimmer, held, motion, pulseE, pulseF, warm] = await scripted(ctx, [{ fixture: "dimmer", adopt: "light" },
    { fixture: "dimmer", adopt: "light", bridge: "dim-b" }, { fixture: "motion", adopt: "sensor" },
    { fixture: "pulse", adopt: "socket", bridge: "relay-e" }, { fixture: "pulse", adopt: "socket", bridge: "relay-f" },
    { fixture: "dimmer", adopt: "light", bridge: "dim-w" }]) as [string, string, string, string, string, string];
  await raiseTier(ctx, dimmer, ON, "confirm");
  const pulse = (id: string, target: string) => up("rule", { id, name: id, conditions: [{ target: motion, key: "motion", op: "eq", value: true }],
    actions: [act(target)] });
  // A notice held for want of a notify channel: the home's channel unadopted through the applier (no define, so no
  // GA-DEF-8 check leans on this case), the notice raised before the restart.
  // Waited for by describe's adopted, not by the steward's notice of the loss, which is GA-NOTE-4's.
  applier.scriptAdopted(CHANNEL, false);
  await stewardSees(ctx, "the home's channel no longer adopted", (d) => targetIn(d, CHANNEL)?.adopted === false);
  const heldNotice = `n-${randomUUID().slice(0, 8)}`;
  const raisedFrom = await cursorNow(ctx);
  applier.scriptNotice({ notice_id: heldNotice, cause: "join_window", text: "Окно сопряжения закрыто" });
  await pollUntil(async () => (await eventsAfter(ctx, raisedFrom)).some((e) => e.type === "notice" && e.change === "raised" && e.notice_id === heldNotice) || undefined,
    10_000, "the steward did not raise the notice the stand-in gave with no notify channel", 100);
  must(!applier.taken.includes(heldNotice), "the steward took a notice no notify channel delivered, before the restart");

  const start = await cursorNow(ctx);
  await mustDefine(ctx, [pulse("pulse-e", pulseE), pulse("pulse-f", pulseF), pulse("warm", warm), scene("long", [act(held), { delay: 3600 }], { owned: [held] })],
  "the relays' rules and a long scenario");
  const defined = Date.parse((await eventsAfter(ctx, start)).find((e) => e.type === "define")!.time);

  // The member's lamp on, under a key, leases the lamp to her; a plan of a confirm step answered yes; a run of the long scenario.
  const key = randomUUID();
  const first = await applyInline(s.olga, "olga-app", [act(LAMP)], key);
  mustAccept(ctx, first, "the member's lamp on");
  await pollUntil(async () => {
    const r = await s.olga.callOk("outcome", { apply_id: first.body.apply_id });
    return (r.outcomes as { outcome: string }[]).every((x) => x.outcome !== "dispatched") ? r : undefined;
  }, 10_000, "the member's lamp on did not settle", 100);
  const repeat = await applyInline(s.olga, "olga-app", [act(LAMP)], key);
  mustAccept(ctx, repeat, "the repeat before the restart");
  const p = await planned(s.olga, "olga-app", [act(dimmer)]);
  mustEqual(p.steps.map((x: { verdict: string }) => x.verdict), ["ask"], "the plan's steps");
  mustAccept(ctx, await answer(s.olga, p.plan_id, "olga-app", { s1: "yes" }), "the member's yes");
  // A plan with no ask: it may be lost at the restart, and is then unknown_plan.
  const plain = await planned(s.olga, "olga-app", [act(LAMP)]);
  const { run_id } = await startRun(ctx, s.olga, "olga-app", "long");
  await pollUntil(async () => (await leaseLines(ctx)).some((l) => l.startsWith(`${held} `)) || undefined, 10_000, "the run took no lease of its dimmer", 100);

  // Both relays' turn_on end failed(no_ack); the second's late_ack comes while the steward is down.
  // The third dimmer's turn_on (idempotent) is still in flight at the stop, and ends unreachable while the steward is down.
  const ack = await ackWithinMs(ctx, pulseE, ON);
  applier.scriptOutcome(pulseE, ON, { outcome: "failed", reason: "no_ack" });
  applier.scriptOutcome(pulseF, ON, { outcome: "failed", reason: "no_ack" });
  applier.scriptOutcome(warm, ON, { outcome: "unreachable", afterMs: ack + 26_000 });
  const cursor = await cursorNow(ctx);
  const fired = sentFrom(ctx);
  applier.scriptValue(motion, "motion", true, { cause: "device" });
  await received(fired, [pulseE, pulseF, warm], "the relays' and the dimmer's rules");
  await ctx.time.stepAndWait(ack + 1_000);
  const failedE = Date.parse((await endedAs(ctx, cursor, "pulse-e", "failed(no_ack)", "the first relay")).time);
  await endedAs(ctx, cursor, "pulse-f", "failed(no_ack)", "the second relay");
  await stepTo(ctx, failedE + 20_000);
  mustEqual((await failuresOf(ctx, cursor, "pulse-e")).length, 0, "notices 20 s after a failed(no_ack)");

  const house = await houseOf(ctx);
  const leases = await leaseLines(ctx);
  ctx.evidence(`before the restart: leases ${JSON.stringify(leases)}`);
  must(leases.some((l) => l.startsWith(`${LAMP} olga-app person `)), "the member's lease of the lamp before the restart", leases);
  mustEqual((await eventsAfter(ctx, cursor)).filter((e) => e.type === "outcome" && e.target === warm && e.outcome !== "dispatched").length, 0,
    "the third dimmer's outcomes before the restart");
  // The key the third dimmer's firing went under before the restart, which a retry after it must not reuse.
  const warmSent = () => fired().filter((x) => x.target === warm);
  const warmBefore = [...new Set(warmSent().map((x) => String(x.key)))];
  must(warmBefore.length === 1, "the third dimmer's firing before the restart went under one key", warmBefore);
  // What the stand-in received for the third dimmer from here on, read from a recorder started before the restart: a
  // retry due at once may be sent at the first sync after it, before any recorder this case starts later.
  const warmSentBefore = warmSent().length;
  await restartSteward(ctx, () => {
    applier.scriptLateAck(pulseF);
    ctx.time.step(10_000);
  });
  const restarted = ctx.time.now();
  const after = await cursorNow(ctx);

  // The house, the lease, the key.
  mustEqual(await houseOf(ctx), house, "the house after the restart");
  const kept = await leaseLines(ctx);
  ctx.evidence(`after the restart: leases ${JSON.stringify(kept)}`);
  mustEqual(kept.filter((l) => l.startsWith(`${LAMP} `)), leases.filter((l) => l.startsWith(`${LAMP} `)), "the member's lease of the lamp after the restart");
  const sent = sentFrom(ctx);
  const again = await applyInline(s.olga, "olga-app", [act(LAMP)], key);
  mustAccept(ctx, again, "the repeat after the restart");
  mustEqual(again.body.apply_id, first.body.apply_id, "the apply a repeat of its key returns after the restart");
  mustEqual(again.body, repeat.body, "the apply a repeat of its key returns after the restart, as before it");
  // The lamp's: the third dimmer's retry may come at any time after the restart (GA-RULE-7's spacing).
  mustEqual(sent().filter((x) => x.target === LAMP).length, 0, "actions the stand-in received for the repeat");

  // The run ended interrupted, its lease released.
  const st = await runReads(ctx, run_id, "ended(interrupted)", "the long run after the restart");
  ctx.evidence(`the run after the restart: ${JSON.stringify(st)}`);
  await pollUntil(async () => !(await leaseLines(ctx)).some((l) => l.startsWith(`${held} `)) || undefined, 10_000,
    "the interrupted run's lease of its dimmer was not released", 100);

  // The plan with no ask: kept, or lost, its answer and its apply then both unknown_plan.
  const plainAnswer = await answer(s.olga, plain.plan_id, "olga-app", { s1: "yes" });
  const plainApply = await applyPlan(s.olga, plain.plan_id);
  const said = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error!);
  ctx.evidence(`the plan with no ask after the restart: answer ${said(plainAnswer)}, apply ${said(plainApply)}`);
  must((said(plainAnswer) === "unknown_plan") === (said(plainApply) === "unknown_plan"),
    `the plan with no ask after the restart: answer ${said(plainAnswer)}, apply ${said(plainApply)}: lost to one and not the other`);
  mustEqual(said(await answer(s.olga, "no-such-plan", "olga-app", { s1: "yes" })), "unknown_plan", "an answer to a plan never made");

  // The plan answered yes before the restart is applied after it, with a token.
  const yes = await applyPlan(s.olga, p.plan_id);
  mustEqual(outcomes(yes, "the plan's apply after the restart"), [`${dimmer} dispatched`], "the plan's outcomes after the restart");
  const dim = sent().filter((x) => x.target === dimmer && x.action === ON);
  mustEqual(dim.map((x) => [x.token, x.tokenFault ?? ""]), [[true, ""]], "the plan's step at the stand-in, its token and whether it stands");

  // The held notice survived it: delivered once the notify channel is adopted again (its taking is GA-NOTE-1's).
  const heard = sentFrom(ctx);
  applier.scriptAdopted(CHANNEL, true);
  const heldSent = await pollUntil(async () => heard().find((x) => x.action === "notify.notify" && x.for?.notice === heldNotice), 10_000,
    "the notice held across the restart was never delivered once the notify channel was adopted again", 100);
  ctx.evidence(`the notice held across the restart: sent on ${heldSent.target} once the channel was adopted again`);

  // History from before the restart: its events, by seq (before the cursor taken after it), not by the case's clock (the milestone 7+10+11 review, I1).
  const past = ((await ownerOf(ctx).callOk("history", { targets: [LAMP], from: iso(defined - 1_000), to: iso(ctx.time.now() + 60_000) })).events as
    { seq: number; type: string; target: string; key?: string; value?: unknown }[]).filter((e) => e.seq <= Number(after));
  ctx.evidence(`history of the lamp across the restart: ${JSON.stringify(past.map((e) => [e.type, e.key, e.value]))}`);
  must(past.some((e) => e.type === "state" && e.target === LAMP && e.key === "on" && e.value === true), "history after the restart lacks the lamp's on from before it", past);

  // The held notice: none before its wait passes, one once it has; none for the relay whose late_ack came while the steward was down.
  // When inside the window it is raised, and the slack, are GA-RULE-8's: here, that it comes after the restart, and not before the window.
  await stepTo(ctx, failedE + 55_000);
  mustEqual((await failuresOf(ctx, cursor, "pulse-e")).length, 0, "notices 55 s after a failed(no_ack), inside the late-ack window");
  await stepTo(ctx, failedE + 60_000 + slack + 5_000);
  // Its precondition is GA-RULE-7's: a step not idempotent is not fired again; one fired again (and landed) raises none, rightly.
  const notice = await unlessRetried(ctx, cursor, "pulse-e", 1, pollUntil(async () => (await failuresOf(ctx, cursor, "pulse-e"))[0], 10_000,
    "no notice for the relay's failed(no_ack) once its wait passed after the restart", 100), "the held notice, its step fired again");
  if (notice) {
    ctx.evidence(`the first relay failed ${iso(failedE)}, its notice ${notice.time}`);
    must(Date.parse(notice.time) >= failedE + 60_000, `the held notice came at ${notice.time}, inside the late-ack window`);
    mustEqual(notice.target, pulseE, "the held notice's target");
  }
  mustEqual((await failuresOf(ctx, cursor, "pulse-f")).length, 0, "notices for the relay whose late_ack came while the steward was down");

  // The firing in flight at the stop: its unreachable, given while the steward was down, names its rule, and it is fired again (GA-RULE-7).
  const lost = await pollUntil(async () => (await eventsAfter(ctx, cursor)).find((e) => e.type === "outcome" && e.target === warm && e.outcome === "unreachable"),
    10_000, "the third dimmer's unreachable, given while the steward was down, was not relayed", 100);
  ctx.evidence(`the third dimmer's unreachable after the restart: ${JSON.stringify([lost.cause, lost.recovered])}`);
  mustEqual(lost.cause, { rule: "warm" }, "the cause of an outcome of a firing in flight at the stop");
  const warmKeys = () => [...new Set(warmSent().slice(warmSentBefore).map((x) => String(x.key)))];


  // Its retry's spacing is GA-RULE-7's: here, that a retry is made after the restart, under a key other than the one before it
  // (the milestone 7+10+11 review, I5). Last in the case, the clock stepped on five minutes at a time for up to two hours until
  // it comes, so a retry spaced wrongly is GA-RULE-7's failure only, and none at all this case's.
  const retried = async (ms: number) => pollUntil(async () => warmKeys().length >= 1 || undefined, ms, "", 100).then(() => true, () => false);
  let stepped = 0;
  while (!(await retried(stepped ? 2_000 : 10_000)) && stepped < RETRY_LOOK_MS) {
    await ctx.time.stepAndWait(5 * 60_000);
    stepped += 5 * 60_000;
  }
  must(warmKeys().length >= 1, `the third dimmer's firing was not tried again after the restart, the clock stepped ${stepped / 60_000} min on`);
  ctx.evidence(`the third dimmer's key before the restart: ${warmBefore.join(", ")}; after it: ${warmKeys().join(", ")}`
    + (stepped ? `, once the clock was stepped ${stepped / 60_000} min on (its spacing is GA-RULE-7's)` : ""));
  must(warmKeys().every((k) => /^rule:warm:\d+$/.test(k) && !warmBefore.includes(k)), "the retry's key after the restart, against the one before it",
    { before: warmBefore, after: warmKeys() });
  // A person's hold across a restart (the hold part), under the pinned windows, other_s apart from on_s and off_s: with
  // presence_renews, the quiet kept and the gap's presence counted at its event's time; a member's turn_off keeping its
  // direction (off_s, not on_s or other_s); with owner_work_passes_guest_holds, the guest panel's hold keeping its role
  // (the owner's rule passes it) and a member's hers (the rule refused); an end in the gap ended at the restart with
  // end_time and not revived; a missed change whose end passed in the gap taking no lease. Motion sensors only: no
  // room here can be vacant (GA-OCC-1).
  const pol = await pinHold(ctx, { other_s: 1800 });
  const seen = new Seen();
  const renews = await setFlag(ctx, "presence_renews", true, ["restarts-the-quiet", "GA-PERSIST-2: a gap's presence counted at its event's time"]);
  const passes = await setFlag(ctx, "owner_work_passes_guest_holds", true, ["GA-PERSIST-2: a guest's hold keeping its derived role across a restart"]);
  {
    const [lampA, motionA] = renews ? await scripted(ctx, [lampOn("persist-a"), sensorOn("motion", "persist-a")]) : [];
    const [lampB, motionB] = renews ? await scripted(ctx, [lampOn("persist-b"), sensorOn("motion", "persist-b")]) : [];
    const [lampE, motionE] = await scripted(ctx, [lampOn("persist-e"), sensorOn("motion", "persist-e")]);
    const [lampG, lampM, motionR] = passes ? await scripted(ctx, [lampOn("persist-g"), lampOn("persist-g2"), sensorOn("motion", "persist-g3")]) : [];
    await mustDefine(ctx, [...(renews ? [...room("persist-hall", [lampA!, motionA!]), ...room("persist-den", [lampB!, motionB!])] : []),
      ...room("persist-kitchen", [lampE!, motionE!]),
      ...(passes ? [up("rule", { id: "persist-off-g", name: "persist-off-g", conditions: [{ target: motionR, key: "motion", op: "eq", value: true }],
        actions: [{ target: lampG, action: "onoff.turn_off", args: {} }] }),
      up("rule", { id: "persist-off-m", name: "persist-off-m", conditions: [{ target: motionR, key: "motion", op: "eq", value: true }],
        actions: [{ target: lampM, action: "onoff.turn_off", args: {} }] })] : [])], "the hold part's rooms and rules");
    applier.scriptValue(lampE!, "on", true, { cause: "device" });
    const c = await cursorNow(ctx);
    const t0 = ctx.time.now();
    if (renews) {
      applier.scriptValue(lampA!, "on", true, { cause: "external" });
      applier.scriptValue(lampB!, "on", true, { cause: "external" });
      await grantsOf(ctx, seen, c, [lampA!, lampB!], "outside ons in the hall and the den");
    }
    await stepTo(ctx, t0 + 2_990 * SECOND);
    // The kitchen quiet throughout: a member's turn_off there ends off_s after its dispatch, across the restart.
    const offAt = ctx.time.now();
    mustEqual(outcomes(await applyInline(s.olga, "olga-app", [act(lampE!, "onoff.turn_off")]), "the member's turn_off in the kitchen"),
      [`${lampE} dispatched`], "the member's turn_off in the kitchen");
    const offSent = ctx.time.now();
    // Its direction shows in its expires (off_s); the granted event's direction and role are GA-LEASE-7's to read.
    await grantsOf(ctx, seen, c, [lampE!], "the member's turn_off in the kitchen");
    await expiresBetween(ctx, lampE!, offAt + pol.off_s * SECOND, offSent + pol.off_s * SECOND, "the kitchen hold before the stop, off_s from dispatch");
    if (passes) {
      // The guest panel's and the member's holds, acked before the stop, so each is past its floor.
      const cg = await cursorNow(ctx);
      mustEqual(outcomes(await applyInline(s.panel, "hall-panel", [act(lampG!)]), "the guest panel's turn_on"), [`${lampG} dispatched`],
        "the guest panel's turn_on");
      mustEqual(outcomes(await applyInline(s.olga, "olga-app", [act(lampM!)]), "the member's turn_on"), [`${lampM} dispatched`], "the member's turn_on");
      const g = await grantsOf(ctx, seen, cg, [lampG!, lampM!], "the guest panel's and the member's holds");
      mustEqual([g[lampG!]!.role, g[lampM!]!.role], ["guest", "member"], "the roles the holds' granted events name");
      await answered(ctx, cg, lampG!, "the guest panel's turn_on");
      await answered(ctx, cg, lampM!, "the member's turn_on");
    }
    if (renews) {
      // The hall's motion, true then false at +3000 s, seen live before the stop: quiet from then.
      await stepTo(ctx, t0 + 3000 * SECOND);
      const m = await cursorNow(ctx);
      applier.scriptValue(motionA!, "motion", true);
      applier.scriptValue(motionA!, "motion", false);
      await pollUntil(async () => (await eventsAfter(ctx, m)).some((e) => e.type === "state" && e.target === motionA && e.key === "motion" && e.value === false)
        || undefined, 10_000, "the steward did not relay the hall's motion clearing", 100);
    } else await stepTo(ctx, t0 + 3000 * SECOND);
    // Down 300 s: no presence in the hall; the den's motion true at +3010 s and false at +3040 s, stamped at those
    // times (stepped and waited for), read back at +3300 s.
    await restartReadBack(ctx, async () => {
      await ctx.time.stepAndWait(10 * SECOND);
      if (renews) applier.scriptValue(motionB!, "motion", true);
      await ctx.time.stepAndWait(30 * SECOND);
      if (renews) applier.scriptValue(motionB!, "motion", false);
      await ctx.time.stepAndWait(t0 + 3300 * SECOND - ctx.time.now());
    });
    ctx.evidence(`restarted at ${iso(ctx.time.now())}, the outside changes at ${iso(t0)}, the kitchen's turn_off at ${iso(offAt)}`);
    if (passes) {
      // The roles kept: the owner's rule passes the guest's hold, and the member's hold refuses it.
      const cr = await cursorNow(ctx);
      const sent = sentFrom(ctx);
      applier.scriptValue(motionR!, "motion", true, { cause: "device" });
      mustEqual(await stepOf(ctx, cr, sent, "persist-off-g", lampG!, "onoff.turn_off", "the owner's rule over the guest's hold after the restart"), "sent",
        "the owner's rule over the guest panel's hold after the restart");
      mustEqual(await stepOf(ctx, cr, sent, "persist-off-m", lampM!, "onoff.turn_off", "the owner's rule over the member's hold after the restart"),
        "refused(leased) olga-app", "the owner's rule over the member's hold after the restart");
      applier.scriptValue(motionR!, "motion", false, { cause: "device" });
    }
    await endsAt(ctx, seen, lampE!, offAt + pol.off_s * SECOND, "the kitchen's off hold, its direction kept across the restart",
      { end: renews ? "quiet" : "window", quietSince: null, byExpires: true });
    if (renews) {
      await endsAt(ctx, seen, lampA!, t0 + (3000 + pol.on_s) * SECOND, "the hall's hold, its quiet kept across the restart",
        { end: "quiet", quietSince: t0 + 3000 * SECOND, byExpires: true });
      await endsAt(ctx, seen, lampB!, t0 + (3040 + pol.on_s) * SECOND, "the den's hold, the gap's motion counted at its time",
        { end: "quiet", quietSince: t0 + 3040 * SECOND, byExpires: true });
    }
  }

  // A two-hour gap: the study's hold, its quiet end inside it and motion only later, ends at the restart with end_time
  // that end and is not revived; a roomless lamp's outside on 10 s into it, its fixed_s end passed by the read-back,
  // takes no lease. Neither needs presence_renews: the study's room is quiet from the change to its end.
  {
    const [lampC, motionC] = await scripted(ctx, [lampOn("persist-c"), sensorOn("motion", "persist-c")]);
    const [lampD] = await scripted(ctx, [lampOn("persist-d")]);
    await mustDefine(ctx, room("persist-study", [lampC!, motionC!]), "the study");
    const c = await cursorNow(ctx);
    const t1 = ctx.time.now();
    applier.scriptValue(lampC!, "on", true, { cause: "external" });
    await grantsOf(ctx, seen, c, [lampC!], "an outside on in the study");
    await stepTo(ctx, t1 + 600 * SECOND);
    // The room quiet throughout, its expires before the stop is its quiet end, which end_time must name.
    const before = await leaseOf(ctx, lampC!);
    must(before !== undefined, "the study's hold before the stop: no lease");
    const down = await cursorNow(ctx);
    const stopped = ctx.time.now();
    const readBack = await restartReadBack(ctx, async () => {
      await ctx.time.stepAndWait(10 * SECOND);
      applier.scriptValue(lampD!, "on", true, { cause: "external" });
      await ctx.time.stepAndWait(t1 + (pol.on_s + 300) * SECOND - ctx.time.now());
      applier.scriptValue(motionC!, "motion", true);
      await ctx.time.stepAndWait(30 * SECOND);
      await ctx.time.stepAndWait(stopped + LONG_GAP_MS - ctx.time.now());
    });
    await endedAtRestart(ctx, seen, down, lampC!, Date.parse(before!.expires), "quiet", "the study's hold, its quiet end in a two-hour gap", readBack);
    // Not revived, and the missed change none: a further look, so a lease granted just after the end is seen.
    const late = await pollUntil(async () => seen.keep(await leaseEventsSince(ctx, down)).find((e) => e.change === "granted" && (e.target === lampC || e.target === lampD)),
      2_000, "", 100).catch(() => undefined);
    must(late === undefined, `${late?.target === lampD ? "the roomless lamp's outside change in the gap, its end passed, took a lease" : "the study's hold granted again after the restart"}`, late);
    must((await leaseOf(ctx, lampC!)) === undefined, "the motion later in the gap revived the study's hold");
    const missed = await leaseOf(ctx, lampD!);
    must(missed === undefined, "the roomless lamp's outside change 10 s into a two-hour gap, its fixed_s end passed at the read-back, holds a lease", missed);
    mustEqual(seen.keep(await leaseEventsSince(ctx, down)).filter((e) => e.target === lampD).length, 0,
      "lease events for the roomless lamp's outside change whose end passed in the gap");
    ctx.evidence(`the roomless lamp's outside change at ${iso(stopped + 10 * SECOND)}, read back at ${iso(stopped + LONG_GAP_MS)}: no lease`);
  }
  await mustDefine(ctx, [up("home", { hold: { presence_renews: null, owner_work_passes_guest_holds: null } })], "the flags back to the steward's own");
});
