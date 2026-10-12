import { randomUUID } from "node:crypto";
import { must, mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import { CHANNEL, LAMP } from "../../steward-home.js";
import { pollUntil } from "../../util.js";
import { applyInline, mustAccept, planned, sentFrom } from "./answers.js";
import { act, announcer, mustDefine, ownerDefine, ownerOf, revisionOf, scripted, up } from "./util.js";
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
  standIn: { bare: true },
  covers: "on a fresh steward, a notice the stand-in raises before any define is held: describe shows it in held_notices; a define setting notice_channels to an announcing speaker alone answers no_notify_channel: true, the notice still held; once the baseline sets the notify channel, the held notice is delivered by a notify on it and taken, and describe shows no held_notices; then a notice the stand-in raises is delivered by a notify on the home's channel, sent via rule for the notice, and only then taken; with the channel dead its notify is tried again within each 60 s, three times, the notice not taken; once the channel lives again the next try delivers it and it is taken; with the home's channel unadopted through the applier, a define answers no_notify_channel: true; speaking through an announcing channel is slice 9's",
}, async (ctx) => {
  const applier = ctx.standIn!.applier;
  const retry = constantMs("steward", "notice-retry-interval");
  const sent = sentFrom(ctx);
  const speaker = await announcer(ctx);
  const early = raise(ctx, "Раннее уведомление");
  const held = async (what: string) => pollUntil(async () => {
    const n = (await ownerOf(ctx).callOk("describe")).held_notices;
    return typeof n === "number" && n >= 1 ? n : undefined;
  }, 10_000, `describe showed no held_notices ${what}`, 100);
  // Held before any define, so no first change set's check (GA-DEF-8) leans on this case.
  ctx.evidence(`held_notices before any define: ${await held("before any define")}`);
  const spoken = await ownerDefine(ctx, [up("home", { notice_channels: [speaker] })]);
  must(spoken.ok, `notice_channels naming an announcing speaker alone was refused: ${spoken.ok ? "" : spoken.error}`, spoken.body);
  ctx.evidence(`a define setting an announcing speaker alone answered ${JSON.stringify(spoken.body)}`);
  mustEqual(spoken.body.no_notify_channel, true, "no_notify_channel in a define's answer setting an announcing speaker alone");
  ctx.evidence(`held_notices with an announcing speaker alone: ${await held("with an announcing speaker alone")}`);
  must(!applier.taken.includes(early), "the steward took a notice no notify channel delivered");
  await ctx.defineBaseline!();
  await taken(ctx, early);
  const delivered0 = notifiesOf(sent, early);
  ctx.evidence(`the early notice's notifies once the channel was set: ${JSON.stringify(delivered0.map((x) => x.target))}`);
  must(delivered0.some((x) => x.target === CHANNEL), "the notice held before the channel was set was never delivered on it", delivered0);
  const after = await ownerOf(ctx).callOk("describe");
  must(after.held_notices === undefined, "describe shows held_notices with a notify channel set", after.held_notices);
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
  // No notify channel left by the applier's side: a define's answer says so.
  applier.scriptAdopted(CHANNEL, false);
  const unadopted = await pollUntil(async () => {
    const r = await ownerDefine(ctx, [up("room", { id: "attic", name: "Чердак" })]);
    return r.ok && r.body.no_notify_channel === true ? r.body : undefined;
  }, 10_000, "no define answered no_notify_channel: true with the home's channel unadopted", 100);
  ctx.evidence(`a define with the home's channel unadopted answered ${JSON.stringify(unadopted)}`);
  applier.scriptAdopted(CHANNEL, true);
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

requirement("GA-NOTE-4", {
  seam: "steward",
  covers: "with the home's channel and a pager listed, the owner unadopts the pager through the applier's configure, and a notice naming it is delivered on the home's channel, once; the home's channel unadopted too, the list has no notify channel left: notices of the channel's loss and the list's are raised and held, none delivered, and both are delivered once the channel is adopted again",
}, async (ctx) => {
  const applier = ctx.standIn!.applier;
  const [pager] = await scripted(ctx, [{ fixture: "pager", adopt: "channel" }]) as [string];
  await mustDefine(ctx, [up("home", { notice_channels: [CHANNEL, pager] })], "the home's channel and a pager as notice channels");
  const sent = sentFrom(ctx);
  const naming = (id: string) => sent().filter((x) => x.action === NOTIFY && String(x.args?.text ?? "").includes(id));
  applier.scriptAdopted(pager, false);
  const told = await pollUntil(async () => naming(pager)[0], 10_000, `no notice naming the pager ${pager} once it left adoption`, 100);
  ctx.evidence(`once the pager left adoption: a notify on ${told.target}: ${told.args.text}`);
  mustEqual(told.target, CHANNEL, "the channel the pager's loss was told on");
  const gone = await cursorNow(ctx);
  applier.scriptAdopted(CHANNEL, false);
  // Held: raised (the steward's notice events), one naming the home's channel and one naming no device (the list's
  // loss of its last notify channel), and not delivered while no notify channel is left.
  const raisedAs = async () => {
    const n = (await eventsAfter(ctx, gone)).filter((e) => e.type === "notice" && e.change === "raised");
    const channel = n.find((e) => e.target === CHANNEL);
    const list = n.find((e) => e.target === undefined && e.devices === undefined);
    return channel && list ? { channel, list } : undefined;
  };
  const raised = await pollUntil(raisedAs, 10_000,
    "the steward did not raise a notice naming the home's channel and one for the list's last notify channel once the channel left adoption", 100);
  ctx.evidence(`no notify channel left: ${raised.channel.text} | ${raised.list.text}`);
  await ctx.time.stepAndWait(5_000);
  mustEqual(naming(CHANNEL).length, 0, "notices naming the home's channel delivered while no notify channel was left");
  applier.scriptAdopted(CHANNEL, true);
  const lost = await pollUntil(async () => naming(CHANNEL)[0], 10_000, `no notice naming the home's channel ${CHANNEL} once it was adopted again`, 100);
  ctx.evidence(`once the home's channel was adopted again: ${lost.args.text}`);
  const delivered = (id: unknown) => sent().some((x) => x.action === NOTIFY && x.target === CHANNEL && x.for?.notice === id);
  await pollUntil(async () => (delivered(raised.channel.notice_id) && delivered(raised.list.notice_id)) || undefined, 10_000,
    "the channel's loss and the list's were not both delivered once the channel returned", 100);
  mustEqual([...new Set(naming(pager).map((x) => JSON.stringify(x.for)))].length, 1, "notices naming the pager");
});
