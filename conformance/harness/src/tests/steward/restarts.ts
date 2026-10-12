import { randomUUID } from "node:crypto";
import { must, mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import { CHANNEL, LAMP } from "../../steward-home.js";
import { pollUntil } from "../../util.js";
import { answer, applyInline, applyPlan, mustAccept, outcomes, planned, sentFrom } from "./answers.js";
import { ackWithinMs, endedAs, failuresOf, received, stepTo, unlessRetried } from "./outcomes.js";
import { cursorNow, eventsAfter, firedOf, restartSteward } from "./rules.js";
import { runReads, scene, startRun } from "./scenarios.js";
import { act, mustDefine, ownerOf, raiseTier, scripted, stewardSees, targetIn, up } from "./util.js";

const ON = "onoff.turn_on";
const iso = (ms: number) => new Date(ms).toISOString();
/** How far GA-PERSIST-2 steps the clock on for a firing's retry after the restart: past GA-RULE-7's 300 s, any retry at all. */
const RETRY_LOOK_MS = 2 * 3_600_000;

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
  return Object.entries(l).map(([t, x]) => `${t} ${typeof x.holder === "string" ? x.holder : x.holder?.endpoint ?? JSON.stringify(x.holder)} ${x.precedence} ${x.expires}`).sort();
}

requirement("GA-PERSIST-2", {
  seam: "steward",
  covers: "a notice held for want of a notify channel (the home's channel unadopted through the applier) is kept across the restart and delivered once the channel is adopted again; restarted cleanly, the steward keeps the house (describe's revision, home, rooms, groups, endpoints, scenarios, rules, schedules and modes as before); the member's lease of the lamp, with its expiry; an apply's key, its repeat returning the first apply and sending nothing; a plan of a confirm step answered yes before the restart, applied after it with a token; a plan with no ask either kept or lost, its answer and its apply unknown_plan both or neither; an answer to a plan never made unknown_plan; the events history needs, a history read after the restart giving the lamp's change from before it; the notice a pulse relay's failed(no_ack) holds, raised after the restart once its wait has passed and not inside the late-ack window, and none for a second relay whose late_ack came while the steward was down; a third dimmer's turn_on in flight at the stop, ended unreachable while the steward was down, is relayed naming its rule, and is tried again after the restart under a key other than the one before it; a run of a long scenario ends ended(interrupted) at the restart, its lease released. A held trigger's duration starting afresh at the restart is GA-RULE-1's case; each schedule's last run is GA-SCHED-2's case; the narrowings and the front's records are slice 9's, a session's persons slice 8's",
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
});
