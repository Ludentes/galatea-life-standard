import { randomUUID } from "node:crypto";
import { must, mustEqual } from "../../assert.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import { LAMP } from "../../steward-home.js";
import { pollUntil } from "../../util.js";
import { answer, applyInline, applyPlan, mustAccept, mustBe, outcomes, planned, sentFrom } from "./answers.js";
import { cursorNow, fires, laptop, relayed, restartSteward, session } from "./rules.js";
import { act, asCredential, mustDefine, ownerOf, raiseTier, scripted, up } from "./util.js";
import { runReads, runSent, scene, startRun, stepsEnded } from "./scenarios.js";
import { brainAsks, defineByPlan, ownerChat, ownerSaysYes } from "./brain.js";

const ON = "onoff.turn_on";
const OFF = "onoff.turn_off";

requirement("GA-STW-3", {
  seam: "steward",
  covers: "an inline apply of the lamp off, then a group of the lamp and a dimmer on, then the dimmer's level: the stand-in receives the actions in request order, the group's targets in code-point order of their ids, in one applier apply",
}, async (ctx) => {
  const s = ctx.steward!;
  const [dimmer] = await scripted(ctx, [{ fixture: "dimmer", adopt: "light" }]);
  await mustDefine(ctx, [up("group", { id: "pair", name: "Пара", room: null, members: [LAMP, dimmer], aggregate: "any" })], "a group");
  const sent = sentFrom(ctx);
  const got = outcomes(await applyInline(s.olga, "olga-app", [act(LAMP, OFF), act("pair"), act(dimmer!, "level.set_level", { level: 30 })]), "the apply");
  const order = sent().map((x) => `${x.target} ${x.action}`);
  ctx.evidence(`outcomes: ${got.join(", ")}; the stand-in received ${order.join(", ")}`);
  const first = [dimmer!, LAMP].sort();
  mustEqual(order, [`${LAMP} ${OFF}`, ...first.map((t) => `${t} ${ON}`), `${dimmer} level.set_level`], "the order the stand-in received");
  mustEqual(new Set(sent().map((x) => x.key)).size, 1, "applier applies of one steward apply");
});

requirement("GA-STW-5", {
  seam: "steward",
  covers: "apply of the brain's plan by the member's app is plan_not_yours; a plan made before a define is stale_revision to apply and to answer; a plan past its ask expiry is plan_expired to apply and to answer; the stand-in receives nothing; define { plan_id } of the brain's define plan from the owner's app is plan_not_yours, made before a define stale_revision, past its ask expiry plan_expired, and changes nothing",
}, async (ctx) => {
  const s = ctx.steward!;
  await raiseTier(ctx, LAMP, ON, "confirm");
  const sent = sentFrom(ctx);
  const brains = await planned(s.brain, "kitchen-voice", [act(LAMP, OFF)], { speaker: "olga" });
  mustBe(ctx, await applyPlan(s.olga, brains.plan_id), "plan_not_yours", "the member applying the brain's plan");
  const stale = await planned(s.olga, "olga-app", [act(LAMP)]);
  await mustDefine(ctx, [up("room", { id: "attic", name: "Чердак" })], "a room");
  mustBe(ctx, await answer(s.olga, stale.plan_id, "olga-app", { s1: "yes" }), "stale_revision", "an answer to a plan made before a define");
  mustBe(ctx, await applyPlan(s.olga, stale.plan_id), "stale_revision", "an apply of a plan made before a define");
  const old = await planned(s.olga, "olga-app", [act(LAMP)]);
  await ctx.time.stepAndWait(constantMs("steward", "ask-expiry-default") + 1000);
  mustBe(ctx, await answer(s.olga, old.plan_id, "olga-app", { s1: "yes" }), "plan_expired", "an answer to an expired plan");
  mustBe(ctx, await applyPlan(s.olga, old.plan_id), "plan_expired", "an apply of an expired plan");
  mustEqual(sent().length, 0, "actions the stand-in received");
  // define given a plan: the brain's define plan, checked as apply checks a plan.
  await ownerChat(ctx);
  const room = up("room", { id: "loft", name: "Мансарда" });
  const theirs = await brainAsks(ctx, [room], "a room");
  mustAccept(ctx, await ownerSaysYes(ctx, theirs.plan_id), "the owner's yes");
  mustBe(ctx, await s.owner.call("define", { endpoint: "owner-app", plan_id: theirs.plan_id }), "plan_not_yours", "the owner's app defining the brain's plan");
  await mustDefine(ctx, [up("room", { id: "cellar", name: "Подвал" })], "another room");
  mustBe(ctx, await defineByPlan(ctx, theirs.plan_id), "stale_revision", "define { plan_id } of a plan made before a define");
  const late = await brainAsks(ctx, [room], "a room again");
  mustAccept(ctx, await ownerSaysYes(ctx, late.plan_id), "the owner's yes again");
  await ctx.time.stepAndWait(constantMs("steward", "ask-expiry-default") + 1000);
  mustBe(ctx, await defineByPlan(ctx, late.plan_id), "plan_expired", "define { plan_id } of an expired plan");
  const d = await ownerOf(ctx).callOk("describe");
  must(!(d.rooms as { id: string }[]).some((x) => x.id === "loft"), "a refused define { plan_id } changed the house", d.rooms);
});

requirement("GA-STW-6", {
  seam: "steward",
  covers: "a key repeated by the member's app with the same body returns the first apply and the stand-in receives one apply; with another body it is idempotency_conflict; the same key from the owner is another apply; after a step past the key retention, the key is a new apply",
}, async (ctx) => {
  const s = ctx.steward!;
  const sent = sentFrom(ctx);
  const key = randomUUID();
  const first = await applyInline(s.olga, "olga-app", [act(LAMP)], key);
  mustAccept(ctx, first, "the first apply");
  const again = await applyInline(s.olga, "olga-app", [act(LAMP)], key);
  mustAccept(ctx, again, "the repeat");
  mustEqual(again.body.apply_id, first.body.apply_id, "the repeat's apply_id");
  mustEqual(sent().length, 1, "actions the stand-in received for an apply and its repeat");
  mustBe(ctx, await applyInline(s.olga, "olga-app", [act(LAMP, OFF)], key), "idempotency_conflict", "the key with another body");
  const owners = await applyInline(s.owner, "owner-app", [act(LAMP)], key);
  mustAccept(ctx, owners, "the owner's apply under the member's key");
  must(owners.body.apply_id !== first.body.apply_id, "the owner's apply under the member's key returned the member's apply");
  await ctx.time.stepAndWait(constantMs("steward", "idempotency-key-retention") + 1000);
  const later = await applyInline(s.olga, "olga-app", [act(LAMP, OFF)], key);
  mustAccept(ctx, later, "the key with another body, past its retention");
  must(later.body.apply_id !== first.body.apply_id, "the key past its retention returned the first apply");
});

requirement("GA-STW-9", {
  seam: "steward",
  covers: "five inline applies of the lamp through the steward, whose stand-in answers at once, return within 200 ms at the median, so one slow apply in five passes (a SHOULD, measured where other tests run beside it; each apply's time is in the evidence)",
}, async (ctx) => {
  const s = ctx.steward!;
  const took: number[] = [];
  for (let i = 0; i < 5; i++) {
    const started = performance.now();
    mustAccept(ctx, await applyInline(s.olga, "olga-app", [act(LAMP, i % 2 ? OFF : ON)]), `apply ${i + 1}`);
    took.push(Math.round(performance.now() - started));
  }
  ctx.evidence(`apply took ${took.join(", ")} ms`);
  const median = [...took].sort((a, b) => a - b)[2]!;
  must(median <= 200 + ctx.allowanceMs, `applies took ${median} ms at the median, more than 200 ms over an applier that answers at once`, took);
});

requirement("GA-STW-10", {
  seam: "steward",
  covers: "a plan applied, and an inline request applied, each reach the stand-in as one inline apply (never an applier plan's id) under one key; restarted, the steward returns the first apply for a repeated key and sends nothing; a rule's firing reaches the stand-in as one apply keyed rule:<id>:<n>, and its next firing after the restart under another such key; a run's two action steps reach the stand-in as two applies keyed run:<run_id>:1 and run:<run_id>:2, the second after its delay (a run ends at a restart, so its keys are not used again)",
}, async (ctx) => {
  const s = ctx.steward!;
  const applier = ctx.standIn!.applier;
  const sent = sentFrom(ctx);
  const plan = await planned(s.olga, "olga-app", [act(LAMP), act(LAMP, OFF)]);
  const key = randomUUID();
  const byPlan = await applyPlan(s.olga, plan.plan_id, key);
  mustAccept(ctx, byPlan, "the plan's apply");
  const inline = await applyInline(s.olga, "olga-app", [act(LAMP)]);
  mustAccept(ctx, inline, "the inline apply");
  const keys = sent().map((x) => x.key);
  ctx.evidence(`the stand-in's apply actions: ${JSON.stringify(sent().map((x) => [x.action, x.key]))}`);
  // Each recorded apply action came inline: an applier plan's id is never recorded as an action.
  mustEqual(keys.length, 3, "inline actions the stand-in received");
  mustEqual(new Set(keys).size, 2, "applier applies, one per steward apply");
  // The lamp's outcome moves to acked a moment later; once it has, a repeat of the key returns the apply as it then stands.
  await pollUntil(async () => ((await s.olga.callOk("outcome", { apply_id: byPlan.body.apply_id })).outcomes as { outcome: string }[])
    .every((x) => x.outcome !== "dispatched") || undefined, 5_000, "the plan's apply did not settle", 50);
  const settled = await applyPlan(s.olga, plan.plan_id, key);
  mustAccept(ctx, settled, "the repeat before the restart");
  const pc = await laptop(ctx);
  // An edge rule on a state change: its keys are graded here, its firing semantics by GA-RULE-1 and 5.
  await mustDefine(ctx, [up("rule", { id: "lock", name: "Замок", trigger: { state: { target: pc, key: "session.liza", op: "eq", value: "active" } },
    actions: [act(pc, "session.lock", { account: "liza" })] })], "an edge rule locking Лиза's session");
  const c = await cursorNow(ctx);
  session(ctx, pc, "liza", "active");
  await fires(ctx, c, "lock", 1, "Лиза's session opening");
  await relayed(ctx, c, pc, "session.liza", "locked", "the lock taking");
  const ruleKeys = () => [...new Set(applier.requests.filter((r) => r.tool === "apply" && String(r.key ?? "").startsWith("rule:")).map((r) => r.key))];
  await restartSteward(ctx);
  const before = applier.requests.length;
  const again = await asCredential(ctx, ctx.credentials!.olga, async (olga) => pollUntil(async () => {
    const r = await applyPlan(olga, plan.plan_id, key).catch(() => undefined);
    return r?.ok ? r : undefined;
  }, 15_000, "the restarted steward did not answer the repeated key", 200));
  mustEqual(again.body, settled.body, "the first apply, returned by the restarted steward for its key");
  mustEqual(applier.requests.slice(before).filter((r) => r.tool === "apply").length, 0, "actions the stand-in received for the repeat");
  // An edge fires on a change the steward follows after its start's state read: wait for that read
  // (its state shows the laptop locked), or the change is the read's and no edge (GA-RULE-1).
  await pollUntil(async () => {
    const values = ((await ownerOf(ctx).callOk("state", { targets: [pc] })).targets?.[pc]?.values ?? []) as { key: string; value: unknown }[];
    return values.some((v) => v.key === "session.liza" && v.value === "locked") || undefined;
  }, 10_000, "the restarted steward never read the laptop", 100);
  session(ctx, pc, "liza", "active");
  await pollUntil(async () => ruleKeys().length >= 2 || undefined, 10_000, "the rule did not fire after the restart", 100);
  ctx.evidence(`the rule's keys: ${ruleKeys().join(", ")}`);
  must(ruleKeys().length === 2 && ruleKeys().every((k) => /^rule:lock:\d+$/.test(String(k))), "the rule's firings' keys", ruleKeys());
  await mustDefine(ctx, [scene("two", [act(LAMP), { delay: 5 }, act(LAMP, OFF)])], "a scenario of two action steps");
  const runSentAll = sentFrom(ctx);
  const before2 = await cursorNow(ctx);
  const { run_id } = await startRun(ctx, s.olga, "olga-app", "two");
  await stepsEnded(ctx, before2, run_id, 1, "the run's first step");
  await ctx.time.stepAndWait(5_000);
  await runReads(ctx, run_id, "ended(done)", "the run");
  const runKeys = runSent(runSentAll, run_id).map((x) => x.key);
  ctx.evidence(`the run's keys: ${runKeys.join(", ")}`);
  mustEqual(runKeys, [`run:${run_id}:1`, `run:${run_id}:2`], "the run's applies' keys");
});

requirement("GA-STW-12", {
  seam: "steward",
  covers: "the guest panel's plan applied, a confirm step refused role and a lamp: the refused outcome carries the moment the steward decided it, the dispatched one the time of its outcome event, and, from outcome once the stand-in acks, the acked one the time of its outcome event; scenario_status's failed steps carry their time: a run's refused(role) step the moment the steward decided it, against its outcome event's",
}, async (ctx) => {
  const s = ctx.steward!;
  await raiseTier(ctx, LAMP, ON, "confirm");
  ctx.standIn!.applier.scriptValue(LAMP, "on", true);
  const plan = await planned(s.panel, "hall-panel", [act(LAMP, ON), act(LAMP, OFF)]);
  const { cursor } = await ownerOf(ctx).callOk("events");
  const before = ctx.time.now();
  const r = await applyPlan(s.panel, plan.plan_id);
  mustEqual(outcomes(r, "the apply"), [`${LAMP} refused(role)`, `${LAMP} dispatched`], "the apply's outcomes");
  const [skipped, dispatched] = r.body.outcomes as { time?: string; step_id: string }[];
  must(typeof skipped!.time === "string" && Date.parse(skipped!.time) >= before - 1000 && Date.parse(skipped!.time) <= ctx.time.now() + 1000,
    `the steward's own outcome carries ${skipped!.time}, not the moment it decided`);
  const eventOf = async (outcome: string) => pollUntil(async () => ((await ownerOf(ctx).callOk("events", { cursor })).events as any[])
    .find((e) => e.type === "outcome" && e.apply_id === r.body.apply_id && e.step_id === dispatched!.step_id && e.outcome === outcome),
  5_000, `no ${outcome} outcome event`, 100);
  const sentEvent = await eventOf("dispatched");
  mustEqual(dispatched!.time, sentEvent.time, "the dispatched outcome's time, against its outcome event's");
  const acked = await pollUntil(async () => {
    const o = await s.panel.callOk("outcome", { apply_id: r.body.apply_id });
    const x = (o.outcomes as { step_id: string; outcome: string; time?: string }[]).find((y) => y.step_id === dispatched!.step_id);
    return x?.outcome === "acked" ? x : undefined;
  }, 5_000, "the lamp's outcome did not become acked", 100);
  const ackEvent = await eventOf("acked");
  ctx.evidence(`refused at ${skipped!.time}; dispatched at ${dispatched!.time}, its event at ${sentEvent.time}; acked at ${acked.time}, its event at ${ackEvent.time}`);
  mustEqual(acked.time, ackEvent.time, "the acked outcome's time, against its outcome event's");
  await mustDefine(ctx, [scene("guest", [act(LAMP, ON)])], "a scenario of the confirm step");
  const { run_id } = await startRun(ctx, s.panel, "hall-panel", "guest");
  const st = await runReads(ctx, run_id, "ended(done)", "the panel's run");
  const failed = st.failed_steps[0] as { step_id: string; outcome: string; time?: string };
  const runEvent = await pollUntil(async () => ((await ownerOf(ctx).callOk("events", { cursor })).events as any[])
    .find((e) => e.type === "outcome" && e.cause?.run === run_id && e.step_id === failed.step_id), 5_000, "no outcome event for the run's step", 100);
  ctx.evidence(`the run's failed step: ${JSON.stringify(failed)}; its event at ${runEvent.time}`);
  mustEqual([failed.outcome, failed.time], ["refused", runEvent.time], "the run's failed step and its time, against its outcome event's");
});
