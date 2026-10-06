import { randomUUID } from "node:crypto";
import { must, mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import { CHANNEL, LAMP } from "../../steward-home.js";
import { pollUntil } from "../../util.js";
import { applyInline, mustAccept, planned, sentFrom } from "./answers.js";
import { act, mustDefine, revisionOf, scripted, up } from "./util.js";
import { runReads, runSent, startRun } from "./scenarios.js";
import { cursorNow, eventsAfter } from "./rules.js";
import { scheduleSoon } from "./schedules.js";
import { brainRuleNotify } from "./brain.js";

const NOTIFY = "notify.notify";

/** A notice the stand-in raises: a join window that closed, its id fresh. */
function raise(ctx: TestContext, text = "Окно сопряжения закрыто"): string {
  const notice_id = `n-${randomUUID().slice(0, 8)}`;
  ctx.standIn!.applier.scriptNotice({ notice_id, cause: "join_window", text });
  return notice_id;
}

/**
 * Waits until the stand-in has been told `notice_taken` for `id`. It rides on the steward's next
 * `events` call, which may wait out its long-poll first: past 5 s, the clock steps over that wait.
 */
async function taken(ctx: TestContext, id: string): Promise<void> {
  const told = async () => ctx.standIn!.applier.taken.includes(id) || undefined;
  if (await pollUntil(told, 5_000, "", 100).catch(() => undefined)) return;
  await ctx.time.stepAndWait(31_000);
  await pollUntil(told, 10_000, `the steward never took notice ${id}`, 100);
}

/** The stand-in's notify steps for notice `id` since `sent` began. */
const notifiesOf = (sent: ReturnType<typeof sentFrom>, id: string) =>
  sent().filter((x) => x.action === NOTIFY && JSON.stringify(x.for) === JSON.stringify({ notice: id }));

/** Scripts the stand-in's `standard_version` and waits for the steward to follow the model change. */
async function version(ctx: TestContext, v: string): Promise<void> {
  const before = await revisionOf(ctx);
  ctx.standIn!.applier.scriptVersion(v);
  await pollUntil(async () => (await revisionOf(ctx)) > before, 10_000, `the steward did not follow the stand-in's version ${v}`, 100);
}

requirement("GA-NOTE-1", {
  seam: "steward",
  covers: "a notice the stand-in raises is delivered by a notify on the home's channel, sent via rule for the notice, and only then taken; with the channel dead its notify is tried again within each 60 s, three times, the notice not taken; once the channel lives again the next try delivers it and it is taken; announcing channels are slice 9's",
}, async (ctx) => {
  const applier = ctx.standIn!.applier;
  const retry = constantMs("steward", "notice-retry-interval");
  const sent = sentFrom(ctx);
  const first = raise(ctx);
  await taken(ctx, first);
  const delivered = notifiesOf(sent, first);
  ctx.evidence(`the first notice's notifies: ${JSON.stringify(delivered.map((x) => [x.target, x.via, x.brain, x.args]))}`);
  must(delivered.length >= 1 && delivered.every((x) => x.target === CHANNEL && x.via === "rule" && x.brain === false),
    "the notice was not delivered by a notify on the home's channel", delivered);
  applier.scriptLiveness(CHANNEL, "dead");
  const second = raise(ctx, "Второе уведомление");
  await pollUntil(async () => notifiesOf(sent, second).length >= 1 || undefined, 10_000, "the second notice was never tried", 100);
  for (let n = 2; n <= 4; n++) {
    await ctx.time.stepAndWait(retry);
    await pollUntil(async () => notifiesOf(sent, second).length >= n || undefined, 10_000, `the second notice was not tried a ${n}th time within ${retry / 1000} s`, 100);
  }
  ctx.evidence(`tries on the dead channel: ${notifiesOf(sent, second).length}`);
  must(!applier.taken.includes(second), "the steward took a notice no channel delivered");
  mustEqual(applier.pendingNotices().map((n) => n.notice_id), [second], "the stand-in's notices still listed");
  applier.scriptLiveness(CHANNEL, "live");
  await ctx.time.stepAndWait(retry);
  await taken(ctx, second);
  ctx.evidence(`taken once the channel lived again, after ${notifiesOf(sent, second).length} tries`);
});

requirement("GA-NOTE-2", {
  seam: "steward",
  covers: "a notify the member plans with a caller-set from has it overwritten with { endpoint, role }, marked from_replaced on the plan's step; the panel's inline notify with a from is sent with the panel's own, its outcome marked from_replaced; a notice's notify carries { notice }; with the stand-in at 0.8, which refuses from, the member's notify and a notice's carry none, the notice delivered and taken; a rule's notify, with a caller-set from, carries { rule }; a person-started run's notify, with a caller-set from, carries { endpoint, role } and a rule-started run's { rule }, a schedule-started run's { scenario }; a rule the brain defined, its notify with a caller-set from, carries { rule, brain_authored: true }",
}, async (ctx) => {
  const s = ctx.steward!;
  const notify = (text: string, from?: unknown) => act(CHANNEL, NOTIFY, { text, urgency: "info", ...(from ? { from } : {}) });
  const plan = await planned(s.olga, "olga-app", [notify("Ужин готов", { notice: "fake" })]);
  ctx.evidence(`the member's plan: ${JSON.stringify(plan.steps.map((x: { args: unknown; from_replaced?: boolean }) => [x.args, x.from_replaced]))}`);
  mustEqual(plan.steps[0].args.from, { endpoint: "olga-app", role: "member" }, "the plan step's from");
  mustEqual(plan.steps[0].from_replaced, true, "the plan step's from_replaced");
  const sent = sentFrom(ctx);
  const inline = await applyInline(s.panel, "hall-panel", [notify("Откройте дверь", { rule: "house" }), act(LAMP)]);
  mustAccept(ctx, inline, "the panel's inline notify");
  ctx.evidence(`the panel's outcomes: ${JSON.stringify(inline.body.outcomes)}; the stand-in received ${JSON.stringify(sent().map((x) => x.args))}`);
  mustEqual(inline.body.outcomes.map((o: { from_replaced?: boolean }) => o.from_replaced ?? false), [true, false], "from_replaced on the inline outcomes");
  mustEqual(sent().filter((x) => x.action === NOTIFY).map((x) => x.args.from), [{ endpoint: "hall-panel", role: "guest" }], "the from the stand-in received");
  const notice = raise(ctx);
  await taken(ctx, notice);
  mustEqual([...new Set(notifiesOf(sent, notice).map((x) => JSON.stringify(x.args.from)))], [JSON.stringify({ notice })], "a notice's from");
  const [motion] = await scripted(ctx, [{ fixture: "motion", adopt: "sensor" }]);
  await mustDefine(ctx, [up("rule", { id: "say", name: "Сказать", conditions: [{ target: motion, key: "motion", op: "eq", value: true }],
    actions: [notify("Движение", { endpoint: "olga-app", role: "owner" })] })], "a rule's notify");
  ctx.standIn!.applier.scriptValue(motion!, "motion", true, { cause: "device" });
  const said = await pollUntil(async () => sent().find((x) => x.action === NOTIFY && x.for?.rule === "say"), 10_000, "the rule's notify never reached the stand-in", 100);
  ctx.evidence(`the rule's notify: ${JSON.stringify(said.args)}`);
  mustEqual(said.args.from, { rule: "say" }, "a rule's notify's from");
  await version(ctx, "0.8");
  const old = await planned(s.olga, "olga-app", [notify("Старый")]);
  ctx.evidence(`at 0.8, the member's plan: ${JSON.stringify(old.steps.map((x: { args: unknown }) => x.args))}`);
  must(old.steps[0].args.from === undefined, "a plan's notify carried from to an applier of 0.8", old.steps[0]);
  const late = raise(ctx, "Уведомление для старого");
  await taken(ctx, late);
  const lateSent = notifiesOf(sent, late);
  must(lateSent.length >= 1 && lateSent.every((x) => x.args.from === undefined), "a notice's notify carried from to an applier of 0.8", lateSent);
  await version(ctx, "0.14");
  await mustDefine(ctx, [up("scenario", { id: "say", name: "Сказать", mode: "single", steps: [notify("Сцена", { notice: "fake" })] }),
    up("rule", { id: "scene", name: "Сцена", conditions: [{ target: motion, key: "motion", op: "eq", value: false }], actions: [{ scenario: "say" }] })],
  "a scenario's notify, and a rule starting it");
  const { run_id } = await startRun(ctx, s.olga, "olga-app", "say");
  await runReads(ctx, run_id, "ended(done)", "the member's run");
  const c = await cursorNow(ctx);
  ctx.standIn!.applier.scriptValue(motion!, "motion", false, { cause: "device" });
  const started = await pollUntil(async () => (await eventsAfter(ctx, c)).find((e) => e.type === "scenario" && e.change === "started" && e.scenario === "say"),
    10_000, "the rule never started its run", 100);
  await runReads(ctx, String(started.run_id), "ended(done)", "the rule's run");
  const { run_id: sid } = await scheduleSoon(ctx, "say-at", "say");
  await runReads(ctx, sid, "ended(done)", "the scheduled run");
  const froms = [run_id, String(started.run_id), sid].map((id) => runSent(sent, id).map((x) => x.args.from)[0]);
  ctx.evidence(`the runs' notify from: ${JSON.stringify(froms)}`);
  mustEqual(froms, [{ endpoint: "olga-app", role: "member" }, { rule: "scene" }, { scenario: "say" }], "the runs' notify's from");
  const marked = await brainRuleNotify(ctx, motion!);
  ctx.evidence(`the brain's rule's notify from: ${JSON.stringify(marked)}`);
  mustEqual(marked, { rule: "told", brain_authored: true }, "the brain's rule's notify's from");
});
