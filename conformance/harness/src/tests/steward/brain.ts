import { must, mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { requirement } from "../../registry.js";
import type { McpResult } from "../../seams/mcp.js";
import { CHANNEL, LAMP } from "../../steward-home.js";
import { pollUntil } from "../../util.js";
import { answer, heard, mustAccept, sentFrom } from "./answers.js";
import { cursorNow, eventsAfter, fires, type Ev } from "./rules.js";
import { failedOf, runReads, runSent, scene, startRun } from "./scenarios.js";
import { minuteAfter, stepOver, wall } from "./schedules.js";
import { act, brainChat, mustDefine, ownerOf, raiseTier, revisionOf, scripted, up } from "./util.js";

const ON = "onoff.turn_on";
const NOTIFY = "notify.notify";
const MINUTE = 60_000;

/** The owner's chat window in their app, which the baseline's brain serves: the owner through a brain. */
export const OWNER_CHAT = "owner-chat";

/** Defines the owner's chat window, once. */
export async function ownerChat(ctx: TestContext): Promise<void> {
  const d = await ownerOf(ctx).callOk("describe");
  if (!(d.endpoints as { id: string }[]).some((e) => e.id === OWNER_CHAT)) await mustDefine(ctx, [brainChat(OWNER_CHAT, "owner")], "the owner's chat window");
}

/** `define` from the brain at `endpoint` (the owner's chat window unless told), at the current revision. */
export async function brainDefine(ctx: TestContext, changes: unknown[], o: { endpoint?: string; speaker?: string; dry_run?: boolean } = {}): Promise<McpResult> {
  return ctx.steward!.brain.call("define", { endpoint: o.endpoint ?? OWNER_CHAT, ...(o.speaker ? { speaker: o.speaker } : {}), changes,
    expected_revision: await revisionOf(ctx), dry_run: o.dry_run ?? false });
}

/** The plan a `define` through the brain at the owner's chat window returns, failing unless it is one. */
export async function brainAsks(ctx: TestContext, changes: unknown[], what: string): Promise<any> {
  const r = await brainDefine(ctx, changes);
  mustAccept(ctx, r, `the brain's define of ${what}`);
  must(Array.isArray(r.body.steps), `the brain's define of ${what} returned no plan`, r.body);
  return r.body;
}

/** The owner's typed yes to a plan, in the chat window, relayed by the brain. */
export const ownerSaysYes = (ctx: TestContext, plan_id: string, word = "yes") =>
  answer(ctx.steward!.brain, plan_id, OWNER_CHAT, { s1: word }, { utterance: heard(ctx, OWNER_CHAT, { addressed_by: "typed" }) });

/** `define { plan_id }` from the brain at the owner's chat window. */
export const defineByPlan = (ctx: TestContext, plan_id: string) => ctx.steward!.brain.call("define", { endpoint: OWNER_CHAT, plan_id });

/** Defines `changes` through the brain at the owner's chat window, the owner saying yes. */
export async function byBrain(ctx: TestContext, changes: unknown[], what: string): Promise<void> {
  await ownerChat(ctx);
  const plan = await brainAsks(ctx, changes, what);
  mustAccept(ctx, await ownerSaysYes(ctx, plan.plan_id), `the owner's yes to ${what}`);
  const r = await defineByPlan(ctx, plan.plan_id);
  mustAccept(ctx, r, `define { plan_id } of ${what}`);
  must(typeof r.body.revision === "number" && r.body.skipped === undefined, `define { plan_id } of ${what} changed nothing`, r.body);
}

/** Waits until the steward has put a `refused` event of `target` since `cursor`; returns it. */
async function refusedSince(ctx: TestContext, cursor: string, target: string, what: string): Promise<Ev> {
  return pollUntil(async () => (await eventsAfter(ctx, cursor)).find((e) => e.type === "refused" && e.target === target), 10_000,
    `${what}: no refused event of ${target}`, 100);
}

/** An action the stand-in received as `target brain token`. */
const shown = (x: { target: string; brain: boolean; token: boolean }) => `${x.target} brain:${x.brain} token:${x.token}`;

requirement("GA-DEF-6", {
  seam: "steward",
  covers: "the brain's define of a room at the owner's chat window returns a plan of one ask(confirm_define) step whose diff names the room, and changes nothing; define { plan_id } unanswered changes nothing; answered yes, it adds the room (its ask event is GA-CONF-5's, kept here as evidence)",
}, async (ctx) => {
  await ownerChat(ctx);
  const attic = up("room", { id: "attic", name: "Чердак" });
  const before = await ownerOf(ctx).callOk("describe");
  const cursor = await cursorNow(ctx);
  const plan = await brainAsks(ctx, [attic], "a room");
  ctx.evidence(`the plan's steps: ${JSON.stringify(plan.steps)}`);
  mustEqual(plan.steps.map((x: { verdict: string; reason?: string }) => `${x.verdict}(${x.reason})`), ["ask(confirm_define)"], "the plan's steps");
  must(typeof plan.steps[0].diff === "string" && plan.steps[0].diff.includes("attic"), "the ask carries no diff naming the room", plan.steps[0]);
  const asks = (await eventsAfter(ctx, cursor)).filter((e) => e.type === "ask" && e.plan_id === plan.plan_id);
  ctx.evidence(`the plan's ask events (graded in GA-CONF-5): ${JSON.stringify(asks.map((e) => e.step_ids))}`);
  mustEqual(await ownerOf(ctx).callOk("describe"), before, "describe once the brain's define was asked");
  const r = await defineByPlan(ctx, plan.plan_id);
  ctx.evidence(`define { plan_id } unanswered: ${r.ok ? JSON.stringify(r.body) : r.error}`);
  mustEqual(await ownerOf(ctx).callOk("describe"), before, "describe once the unanswered plan was defined");
  const again = await brainAsks(ctx, [attic], "a room again");
  mustAccept(ctx, await ownerSaysYes(ctx, again.plan_id), "the owner's yes");
  mustAccept(ctx, await defineByPlan(ctx, again.plan_id), "define { plan_id } answered yes");
  const after = await ownerOf(ctx).callOk("describe");
  must((after.rooms as { id: string }[]).some((x) => x.id === "attic"), "the room the owner said yes to is not in describe", after.rooms);
});

requirement("GA-DEF-7", {
  seam: "steward",
  covers: "a scenario the brain defined is brain_authored in describe; the owner's app runs it: its confirm step is refuse(tier) in the plan and never sent, its reversible step sent with brain: true; the brain's rule starts the owner's scenario: its confirm step refused(tier), never sent; a date the brain moved runs the owner's scenario with its confirm step refused(tier), and the next day's run sends it with the schedule's token; the owner's rule acts on a group: the heater the brain added to it is refused(tier) and never sent, and once the owner sets the group again it is sent with the rule's token",
}, async (ctx) => {
  const s = ctx.steward!;
  const [dimmer, motion, heater] = await scripted(ctx, [{ fixture: "dimmer", adopt: "light" }, { fixture: "motion", adopt: "sensor" },
    { fixture: "heater", adopt: "socket" }]);
  await raiseTier(ctx, dimmer!, ON, "confirm");
  await raiseTier(ctx, heater!, ON, "confirm");
  const sent = sentFrom(ctx);
  // A scenario the brain defined, run from the owner's own app.
  await byBrain(ctx, [scene("cosy", [act(dimmer!), act(LAMP)])], "a scenario");
  const d = await ownerOf(ctx).callOk("describe");
  mustEqual((d.scenarios as { id: string; brain_authored?: boolean }[]).find((x) => x.id === "cosy")?.brain_authored, true, "the brain's scenario's mark");
  const { plan, run_id } = await startRun(ctx, s.owner, "owner-app", "cosy");
  ctx.evidence(`the owner's plan of the brain's scenario: ${JSON.stringify(plan.steps.map((x: any) => [x.target, x.verdict, x.reason]))}`);
  mustEqual(plan.steps.map((x: { verdict: string; reason?: string }) => `${x.verdict}${x.reason ? `(${x.reason})` : ""}`), ["refuse(tier)", "op"],
    "the owner's plan of the brain's scenario");
  await runReads(ctx, run_id, "ended(done)", "the owner's run of the brain's scenario");
  mustEqual(runSent(sent, run_id).map(shown), [`${LAMP} brain:true token:false`], "what the owner's run of the brain's scenario sent");
  // The brain's rule starts the owner's scenario: its confirm step is the brain's work now.
  await mustDefine(ctx, [scene("warm", [act(dimmer!)])], "the owner's scenario");
  await byBrain(ctx, [up("rule", { id: "warmth", name: "Тепло", trigger: { state: { target: motion, key: "motion", op: "eq", value: true } },
    actions: [{ scenario: "warm" }] })], "a rule starting the owner's scenario");
  let cursor = await cursorNow(ctx);
  ctx.standIn!.applier.scriptValue(motion!, "motion", true, { cause: "device" });
  const started = await pollUntil(async () => (await eventsAfter(ctx, cursor)).find((e) => e.type === "scenario" && e.change === "started" && e.scenario === "warm"),
    10_000, "the brain's rule never started the owner's scenario", 100);
  const warm = await runReads(ctx, String(started.run_id), "ended(done)", "the run the brain's rule started");
  mustEqual(failedOf(warm), ["s1 refused(tier)"], "the failed steps of the run the brain's rule started");
  mustEqual(runSent(sent, String(started.run_id)).length, 0, "actions the run the brain's rule started sent");
  // The owner's schedule of that scenario, its date moved by the brain.
  const at = minuteAfter(ctx, 2 * MINUTE);
  await mustDefine(ctx, [up("schedule", { id: "evening", scenario: "warm", time: wall(at).hhmm })], "the owner's schedule");
  await byBrain(ctx, [up("schedule_exception", { schedule: "evening", date: wall(at).date, action: "move", time: wall(at + MINUTE).hhmm })], "a moved date");
  cursor = await cursorNow(ctx);
  await stepOver(ctx, at + MINUTE);
  const moved = await pollUntil(async () => (await eventsAfter(ctx, cursor)).find((e) => e.type === "scenario" && e.change === "started"
    && e.cause?.schedule === "evening"), 10_000, "the moved date's run never started", 100);
  mustEqual(failedOf(await runReads(ctx, String(moved.run_id), "ended(done)", "the moved date's run")), ["s1 refused(tier)"], "the moved date's run's failed steps");
  // The cursor is taken once the day has passed: an event that came before the jump (one trailing behind, under load)
  // would be past the 3600 s the log keeps, and events after a cursor before it cursor_expired.
  await ctx.time.stepAndWait(at + 24 * 60 * MINUTE - MINUTE - ctx.time.now());
  cursor = await cursorNow(ctx);
  await stepOver(ctx, at + 24 * 60 * MINUTE);
  const next = await pollUntil(async () => (await eventsAfter(ctx, cursor)).find((e) => e.type === "scenario" && e.change === "started"
    && e.cause?.schedule === "evening"), 10_000, "the next day's run never started", 100);
  await runReads(ctx, String(next.run_id), "ended(done)", "the next day's run");
  mustEqual(runSent(sent, String(next.run_id)).map(shown), [`${dimmer} brain:false token:true`], "what the next day's run sent");
  // The owner's rule acts on the owner's group; the brain adds the heater to it.
  await mustDefine(ctx, [up("group", { id: "evening-heat", name: "Вечер", room: null, members: [LAMP], aggregate: "any" }),
    up("rule", { id: "dark", name: "Темно", trigger: { state: { target: motion, key: "motion", op: "eq", value: false } },
      actions: [{ target: "evening-heat", action: ON, args: {} }] })], "the owner's group and rule");
  await byBrain(ctx, [up("group", { id: "evening-heat", name: "Вечер", room: null, members: [LAMP, heater], aggregate: "any" })], "the heater in the group");
  const heated = () => sent().filter((x) => x.for?.rule === "dark" && x.target === heater);
  cursor = await cursorNow(ctx);
  ctx.standIn!.applier.scriptValue(motion!, "motion", false, { cause: "device" });
  const refused = await refusedSince(ctx, cursor, heater!, "the owner's rule over the moved heater");
  await fires(ctx, cursor, "dark", 1, "the owner's rule over the moved heater");
  ctx.evidence(`the owner's rule: refused ${JSON.stringify(refused)}; the heater sent ${JSON.stringify(heated().map(shown))}`);
  mustEqual(refused.reason, "tier", "the moved heater's refusal");
  mustEqual(heated().length, 0, "the heater's actions the owner's rule sent while the brain had moved it");
  // The owner sets the group again: the heater is the owner's.
  await mustDefine(ctx, [up("group", { id: "evening-heat", name: "Вечер", room: null, members: [LAMP, heater], aggregate: "any" })], "the group again");
  cursor = await cursorNow(ctx);
  ctx.standIn!.applier.scriptValue(motion!, "motion", true, { cause: "device" });
  ctx.standIn!.applier.scriptValue(motion!, "motion", false, { cause: "device" });
  await fires(ctx, cursor, "dark", 1, "the owner's rule once the owner set the group");
  await pollUntil(async () => heated().length >= 1 || undefined, 10_000, "the owner's rule sent the heater nothing once the owner set the group", 100);
  mustEqual(heated().map(shown), [`${heater} brain:false token:true`], "what the owner's rule sent the heater once the owner set the group");
});

/** The notify the brain's rule sends, through the stand-in's channel, once the motion sensor reads `value`. */
export async function brainRuleNotify(ctx: TestContext, motion: string): Promise<unknown> {
  const sent = sentFrom(ctx);
  await byBrain(ctx, [up("rule", { id: "told", name: "Сказать", trigger: { state: { target: motion, key: "motion", op: "eq", value: true } },
    actions: [act(CHANNEL, NOTIFY, { text: "Движение", urgency: "info", from: { rule: "house" } })] })], "a rule's notify");
  ctx.standIn!.applier.scriptValue(motion, "motion", true, { cause: "device" });
  const said = await pollUntil(async () => sent().find((x) => x.action === NOTIFY && x.for?.rule === "told"), 10_000, "the brain's rule's notify never came", 100);
  return said.args.from;
}
