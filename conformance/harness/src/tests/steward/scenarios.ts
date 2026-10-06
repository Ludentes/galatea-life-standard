import { randomUUID } from "node:crypto";
import { must, mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import type { McpSeam } from "../../seams/mcp.js";
import { LAMP } from "../../steward-home.js";
import { pollUntil } from "../../util.js";
import { answer, mustAccept, mustBe, sentFrom } from "./answers.js";
import { cursorNow, eventsAfter, type Ev } from "./rules.js";
import { scheduleSoon } from "./schedules.js";
import { act, asCredential, mustDefine, mustRefuse, occupancyBecomes, ownerOf, raiseTier, rooms, scripted, short, stewardSees, up } from "./util.js";

const ON = "onoff.turn_on";
const OFF = "onoff.turn_off";

/** A scenario `id` of mode `single`, `steps` in order, with `extra` over it, as an upsert. */
export const scene = (id: string, steps: unknown[], extra: Record<string, unknown> = {}) =>
  up("scenario", { id, name: id, mode: "single", steps, ...extra });

/** `scenario_plan` for `scenario` at `endpoint`, refused unless it is taken. */
export async function scenePlan(ctx: TestContext, seam: McpSeam, endpoint: string, scenario: string, o: { speaker?: string } = {}): Promise<any> {
  const r = await seam.call("scenario_plan", { scenario, endpoint, ...(o.speaker ? { speaker: o.speaker } : {}) });
  mustAccept(ctx, r, `the plan of ${scenario} at ${endpoint}`);
  return r.body;
}

/** Plans `scenario` at `endpoint`, answers it with `answers` if given, and runs it under a fresh key: the plan and the run's id. */
export async function startRun(ctx: TestContext, seam: McpSeam, endpoint: string, scenario: string,
  o: { answers?: Record<string, string>; speaker?: string } = {}): Promise<{ plan: any; run_id: string }> {
  const plan = await scenePlan(ctx, seam, endpoint, scenario, o);
  if (o.answers) mustAccept(ctx, await answer(seam, plan.plan_id, endpoint, o.answers), `the answers to ${scenario}`);
  const r = await seam.call("scenario_run", { plan_id: plan.plan_id, idempotency_key: randomUUID() });
  mustAccept(ctx, r, `the run of ${scenario}`);
  must(r.body.ignored === undefined, `the run of ${scenario} was ignored`, r.body);
  return { plan, run_id: String(r.body.run_id) };
}

/** A run's status as `status(reason)`. */
export const statusLine = (st: { status: string; reason?: string }) => `${st.status}${st.reason ? `(${st.reason})` : ""}`;

/** Waits until `run_id` reads `want` (`running`, `ended(done)`, ...); returns its status. */
export async function runReads(ctx: TestContext, run_id: string, want: string, what: string, ms = 10_000): Promise<any> {
  let last: any;
  try {
    return await pollUntil(async () => {
      last = await ownerOf(ctx).callOk("scenario_status", { run_id });
      return statusLine(last) === want ? last : undefined;
    }, ms, what, 100);
  } catch (err) {
    ctx.evidence(`${what}: the run last read ${JSON.stringify(last)}`);
    throw err;
  }
}

/** A run's failed steps as `step_id outcome(reason)`. */
export const failedOf = (st: { failed_steps: { step_id: string; outcome: string; reason?: string }[] }) =>
  st.failed_steps.map((x) => `${x.step_id} ${x.outcome}${x.reason ? `(${x.reason})` : ""}`);

/** The applies the stand-in received for `run_id`'s steps, from `sent`. */
export const runSent = (sent: ReturnType<typeof sentFrom>, run_id: string) => sent().filter((x) => String(x.key ?? "").startsWith(`run:${run_id}:`));

/** The `scenario` events of `run_id` among `events`, as `change` or `change(reason)`. */
export const changesOf = (events: Ev[], run_id: string) =>
  events.filter((e) => e.type === "scenario" && e.run_id === run_id).map((e) => `${e.change}${e.reason ? `(${e.reason})` : ""}`);

/**
 * Waits until `n` of `run_id`'s steps have ended (an `outcome` event past `dispatched`) since `cursor`:
 * a run waits for each action step's outcome before its next node, so a test steps the clock through a
 * `delay` only once the step before it has ended.
 */
export async function stepsEnded(ctx: TestContext, cursor: string, run_id: string, n: number, what: string): Promise<void> {
  await pollUntil(async () => (await eventsAfter(ctx, cursor)).filter((e) => e.type === "outcome" && e.cause?.run === run_id && e.outcome !== "dispatched")
    .length >= n || undefined, 10_000, `${what}: the run's steps did not end`, 100);
}

/** The scripted air conditioner's mode, assumed by the stand-in from the owner's set_mode and read so by the steward (GA-RULE-2's way). */
export async function assumedMode(ctx: TestContext, ac: string, mode = "cool"): Promise<void> {
  const set = await ownerOf(ctx).callOk("apply", { request: { endpoint: "owner-app", actions: [{ target: ac, action: "climate.set_mode", args: { mode } }] },
    idempotency_key: randomUUID() });
  await pollUntil(async () => ((await ownerOf(ctx).callOk("outcome", { apply_id: set.apply_id })).outcomes as { outcome: string }[])[0]?.outcome === "sent"
    || undefined, 10_000, "the owner's set_mode did not end sent", 100);
  // A model change makes the steward read the state, with the assumed mode.
  ctx.standIn!.applier.scriptFresh(ac, 600);
  await pollUntil(async () => (((await ownerOf(ctx).callOk("state", { targets: [ac] })).targets as Record<string, { values: { key: string; assumed?: boolean }[] }>)[ac]
    ?.values ?? []).some((v) => v.key === "mode" && v.assumed === true) || undefined, 10_000, "the steward never read the assumed mode", 100);
}

requirement("GA-SCN-1", {
  seam: "steward",
  covers: "a single scenario running (the lamp, then a 60 s delay): a second start from another plan returns the running run with ignored, sending nothing; once it has ended a start is a new run; the modes restart, queued and parallel are not built (define refuses them, GA-SCN-5)",
}, async (ctx) => {
  const s = ctx.steward!;
  await mustDefine(ctx, [scene("long", [act(LAMP), { delay: 60 }])], "a scenario with a delay");
  const sent = sentFrom(ctx);
  const c = await cursorNow(ctx);
  const first = await startRun(ctx, s.olga, "olga-app", "long");
  await stepsEnded(ctx, c, first.run_id, 1, "the run's lamp");
  const plan = await scenePlan(ctx, s.olga, "olga-app", "long");
  const again = await s.olga.call("scenario_run", { plan_id: plan.plan_id, idempotency_key: randomUUID() });
  mustAccept(ctx, again, "a second start while it runs");
  ctx.evidence(`a second start while it runs: ${JSON.stringify(again.body)}`);
  mustEqual(again.body, { run_id: first.run_id, ignored: true }, "the second start's answer");
  await ctx.time.stepAndWait(61_000);
  await runReads(ctx, first.run_id, "ended(done)", "the first run");
  mustEqual(sent().length, 1, "applies the stand-in received for both starts");
  const later = await startRun(ctx, s.olga, "olga-app", "long");
  must(later.run_id !== first.run_id, "a start once the run had ended returned the ended run");
});

requirement("GA-SCN-2", {
  seam: "steward",
  covers: "a run owning a group of the lamp, a dimmer and an infrastructure relay leases the lamp and the dimmer, not the relay, at person precedence until the run ends; the member's own apply on the lamp meanwhile replaces the lease there, and the run's end releases only the dimmer's, the member's staying",
}, async (ctx) => {
  const s = ctx.steward!;
  const [dimmer, relay] = await scripted(ctx, [{ fixture: "dimmer", adopt: "light" }, { fixture: "lamp", adopt: "light", bridge: "other-bridge" }]);
  ctx.standIn!.applier.scriptMarks(relay!, { infrastructure: true });
  await stewardSees(ctx, `${relay} infrastructure`, (d) => (d.targets as any[]).find((t) => t.id === relay)?.infrastructure === true);
  await mustDefine(ctx, [up("group", { id: "all", name: "Все", room: null, members: [LAMP, dimmer, relay], aggregate: "any" }),
    scene("owned", [{ delay: 60 }], { owned: ["all"] })], "a group and a scenario owning it");
  const leases = async () => Object.fromEntries(Object.entries((await ownerOf(ctx).callOk("state")).leases as Record<string, any>)
    .map(([t, l]) => [t, `${JSON.stringify(l.holder)} ${l.precedence} ${l.expires}`]));
  const { run_id } = await startRun(ctx, s.olga, "olga-app", "owned");
  const held = await pollUntil(async () => {
    const l = await leases();
    return l[LAMP] && l[dimmer!] ? l : undefined;
  }, 10_000, "the run's leases", 100);
  ctx.evidence(`while it runs: ${JSON.stringify(held)}`);
  const own = `${JSON.stringify({ run: run_id })} person run_end`;
  mustEqual(Object.entries(held).sort(), [[LAMP, own], [dimmer!, own]].sort(), "the leases while it runs");
  mustAccept(ctx, await s.olga.call("apply", { request: { endpoint: "olga-app", actions: [act(LAMP)] }, idempotency_key: randomUUID() }), "the member's apply on the lamp");
  await ctx.time.stepAndWait(61_000);
  await runReads(ctx, run_id, "ended(done)", "the run");
  const after = await leases();
  ctx.evidence(`after it ended: ${JSON.stringify(after)}`);
  mustEqual(Object.keys(after), [LAMP], "the leases left once the run ended");
  must(!after[LAMP]!.includes(run_id), "the run's lease on the lamp outlived it", after);
});

requirement("GA-SCN-3", {
  seam: "steward",
  covers: "a run from the guest panel, no person, is dispatched for { run, endpoint } via panel, its confirm step refused(role); a run through the brain at the kitchen's voice endpoint, naming the member, refuses its no_voice step refused(tier) and dispatches its reversible one via voice, brain true; the member's run leaves an unanswered ask skipped(not_confirmed); her yes to the open TV's ask(toggle_only), 400 s before its delayed step, is asked again as a new ask event naming the run, and the step is sent only after a new yes",
}, async (ctx) => {
  const s = ctx.steward!;
  const [dimmer, tv] = await scripted(ctx, [{ fixture: "dimmer", adopt: "light" }, { fixture: "tv", adopt: "tv" }]);
  await raiseTier(ctx, dimmer!, ON, "confirm");
  await raiseTier(ctx, LAMP, OFF, "no_voice");
  await mustDefine(ctx, [scene("panel", [act(LAMP), act(dimmer!)]), scene("voice", [act(LAMP, OFF), act(dimmer!, "level.set_level", { level: 20 })]),
    scene("ask", [act(dimmer!)]), scene("tv", [{ delay: 400 }, act(tv!, OFF)])], "the scenarios");
  const sent = sentFrom(ctx);
  const panel = await startRun(ctx, s.panel, "hall-panel", "panel");
  const ps = await runReads(ctx, panel.run_id, "ended(done)", "the panel's run");
  const pSent = runSent(sent, panel.run_id);
  ctx.evidence(`the panel's run: failed ${JSON.stringify(failedOf(ps))}; sent ${JSON.stringify(pSent.map((x) => [x.target, x.via, x.brain, x.for]))}`);
  mustEqual(failedOf(ps), ["s2 refused(role)"], "the panel's run's failed steps");
  mustEqual(pSent.map((x) => [x.target, x.via, x.brain, x.for]), [[LAMP, "panel", false, { run: panel.run_id, endpoint: "hall-panel" }]], "what the panel's run sent");
  const voice = await startRun(ctx, s.brain, "kitchen-voice", "voice", { speaker: "olga" });
  const vs = await runReads(ctx, voice.run_id, "ended(done)", "the voice run");
  const vSent = runSent(sent, voice.run_id);
  ctx.evidence(`the voice run: failed ${JSON.stringify(failedOf(vs))}; sent ${JSON.stringify(vSent.map((x) => [x.target, x.action, x.via, x.brain]))}`);
  mustEqual(failedOf(vs), ["s1 refused(tier)"], "the voice run's failed steps");
  mustEqual(vSent.map((x) => [x.action, x.via, x.brain]), [["level.set_level", "voice", true]], "what the voice run sent");
  const asked = await startRun(ctx, s.olga, "olga-app", "ask");
  const as = await runReads(ctx, asked.run_id, "ended(done)", "the unanswered run");
  mustEqual(failedOf(as), ["s1 skipped(not_confirmed)"], "the unanswered run's failed steps");
  mustEqual(runSent(sent, asked.run_id).length, 0, "what the unanswered run sent");
  // The toggle: a yes 400 s old by its step is asked again.
  const c = await cursorNow(ctx);
  const tvRun = await startRun(ctx, s.olga, "olga-app", "tv", { answers: { s1: "yes" } });
  await ctx.time.stepAndWait(400_000);
  const reask = await pollUntil(async () => (await eventsAfter(ctx, c)).find((e) => e.type === "ask" && e.run_id === tvRun.run_id), 10_000,
    "the toggle step was not asked again", 100);
  ctx.evidence(`asked again: ${JSON.stringify(reask)}; sent so far ${runSent(sent, tvRun.run_id).length}`);
  mustEqual([reask.plan_id, reask.step_ids], [tvRun.plan.plan_id, ["s1"]], "the new ask's plan and steps");
  mustEqual(runSent(sent, tvRun.run_id).length, 0, "the toggle sent before a new yes");
  mustAccept(ctx, await answer(s.olga, tvRun.plan.plan_id, "olga-app", { s1: "yes" }), "the new yes");
  await runReads(ctx, tvRun.run_id, "ended(done)", "the toggle's run");
  mustEqual(runSent(sent, tvRun.run_id).map((x) => [x.target, x.token, x.tokenFault ?? null]), [[tv, true, null]], "the toggle sent with a token after the new yes");
});

requirement("GA-SCN-5", {
  seam: "steward",
  covers: "describe lists the modes the steward runs; a scenario of a mode it does not list (restart), or of none, is refused invalid_request; a single one is taken and listed",
}, async (ctx) => {
  const d = await ownerOf(ctx).callOk("describe");
  ctx.evidence(`describe's modes: ${JSON.stringify(d.modes)}`);
  must(Array.isArray(d.modes) && d.modes.includes("single"), "describe lists no single mode", d.modes);
  for (const mode of ["restart", "queued", "parallel"].filter((m) => !d.modes.includes(m))) {
    mustEqual(await mustRefuse(ctx, [scene("x", [act(LAMP)], { mode })], `a scenario of mode ${mode}`), "invalid_request", `the error for mode ${mode}`);
  }
  mustEqual(await mustRefuse(ctx, [up("scenario", { id: "x", name: "x", steps: [act(LAMP)] })], "a scenario of no mode"), "invalid_request", "the error for no mode");
  await mustDefine(ctx, [scene("x", [act(LAMP)])], "a single scenario");
  must(((await ownerOf(ctx).callOk("describe")).scenarios as { id: string }[]).some((x) => x.id === "x"), "describe does not list the scenario");
});

requirement("GA-SCN-6", {
  seam: "steward",
  covers: "scenario_plan gives one step per action step in order, a run step's expanded in place and an if's marked conditional; a repeated scenario_run key returns the first run and starts nothing, sending nothing more",
}, async (ctx) => {
  const s = ctx.steward!;
  const [dimmer] = await scripted(ctx, [{ fixture: "dimmer", adopt: "light" }]);
  await mustDefine(ctx, [scene("inner", [act(dimmer!, OFF)]),
    scene("outer", [act(LAMP), { if: { target: LAMP, key: "on", op: "eq", value: true }, then: [act(dimmer!)] }, { run: "inner" }, act(LAMP, OFF)])],
  "a scenario with an if and a run step");
  const plan = await scenePlan(ctx, s.olga, "olga-app", "outer");
  const got = plan.steps.map((x: any) => `${x.step_id} ${x.target} ${x.action}${x.conditional ? " conditional" : ""}`);
  ctx.evidence(`the plan's steps: ${got.join(", ")}`);
  mustEqual(got, [`s1 ${LAMP} ${ON}`, `s2 ${dimmer} ${ON} conditional`, `s3 ${dimmer} ${OFF}`, `s4 ${LAMP} ${OFF}`], "the plan's steps");
  const sent = sentFrom(ctx);
  const key = randomUUID();
  const first = await s.olga.call("scenario_run", { plan_id: plan.plan_id, idempotency_key: key });
  mustAccept(ctx, first, "the run");
  await runReads(ctx, String(first.body.run_id), "ended(done)", "the run");
  const before = sent().length;
  const again = await s.olga.call("scenario_run", { plan_id: plan.plan_id, idempotency_key: key });
  mustAccept(ctx, again, "the repeated key");
  ctx.evidence(`the repeat: ${JSON.stringify(again.body)}; the stand-in received ${before} then ${sent().length}`);
  mustEqual(again.body.run_id, first.body.run_id, "the repeat's run");
  await ctx.time.stepAndWait(1_000);
  mustEqual(sent().length, before, "applies the stand-in received for the repeat");
});

requirement("GA-SCN-7", {
  seam: "steward",
  covers: "each step is judged again at its dispatch, the first included: a step on the hall's lamp respecting occupancy, planned op in the vacant hall, is skipped(occupied) once the hall is occupied by its run, never sent; a later step on it, after a delay, in a run started while the hall was vacant, is skipped(occupied) when the hall became occupied during the delay, never sent; an ask unanswered at dispatch is skipped(not_confirmed), and an answered one stands, sent with a token",
}, async (ctx) => {
  const s = ctx.steward!;
  const { presence, dimmer } = await rooms(ctx);
  await raiseTier(ctx, dimmer, ON, "confirm");
  await ctx.time.stepAndWait(constantMs("steward", "occupancy-hold-default") + 1_000);
  await occupancyBecomes(ctx, { hall: "vacant", kitchen: "unknown" }, "the hall's sensor live for the hold");
  await mustDefine(ctx, [scene("hall", [act(LAMP)], { respect_occupancy: true }), scene("later", [{ delay: 5 }, act(LAMP)], { respect_occupancy: true }),
    scene("asks", [act(dimmer), { delay: 5 }, act(dimmer, "level.set_level", { level: 40 })])],
  "scenarios respecting the hall, one after a delay, and one with an ask");
  const plan = await scenePlan(ctx, s.olga, "olga-app", "hall");
  mustEqual(plan.steps.map(short), [`${LAMP} op`], "the hall step at plan");
  const sent = sentFrom(ctx);
  const c = await cursorNow(ctx);
  // Started in the vacant hall: its step, after the delay, is judged at its own turn.
  const later = await startRun(ctx, s.olga, "olga-app", "later");
  ctx.standIn!.applier.scriptValue(presence, "occupancy", true, { cause: "device" });
  await occupancyBecomes(ctx, { hall: "occupied", kitchen: "unknown" }, "someone in the hall");
  const r = await s.olga.call("scenario_run", { plan_id: plan.plan_id, idempotency_key: randomUUID() });
  mustAccept(ctx, r, "the hall's run");
  const hs = await runReads(ctx, String(r.body.run_id), "ended(done)", "the hall's run");
  const outcomesOf = async (run_id: string) => ((await eventsAfter(ctx, c)).filter((e) => e.type === "outcome" && e.cause?.run === run_id))
    .map((e) => `${e.target} ${e.outcome}${e.reason ? `(${e.reason})` : ""}`);
  ctx.evidence(`the hall's run: ${JSON.stringify(await outcomesOf(String(r.body.run_id)))}; failed ${JSON.stringify(failedOf(hs))}`);
  mustEqual(await outcomesOf(String(r.body.run_id)), [`${LAMP} skipped(occupied)`], "the hall step at dispatch");
  mustEqual(runSent(sent, String(r.body.run_id)).length, 0, "what the hall's run sent");
  await ctx.time.stepAndWait(5_000);
  const ls = await runReads(ctx, later.run_id, "ended(done)", "the later run");
  ctx.evidence(`the later run: ${JSON.stringify(await outcomesOf(later.run_id))}; failed ${JSON.stringify(failedOf(ls))}`);
  mustEqual(await outcomesOf(later.run_id), [`${LAMP} skipped(occupied)`], "the later step at its own dispatch");
  mustEqual(runSent(sent, later.run_id).length, 0, "what the later run sent");
  const unanswered = await startRun(ctx, s.olga, "olga-app", "asks");
  await ctx.time.stepAndWait(5_000);
  const us = await runReads(ctx, unanswered.run_id, "ended(done)", "the unanswered run");
  mustEqual(failedOf(us), ["s1 skipped(not_confirmed)"], "the unanswered ask at dispatch");
  mustEqual(runSent(sent, unanswered.run_id).map((x) => [x.action, x.token]), [["level.set_level", false]], "what the unanswered run sent");
  const answered = await startRun(ctx, s.olga, "olga-app", "asks", { answers: { s1: "yes" } });
  await stepsEnded(ctx, c, answered.run_id, 1, "the answered run's first step");
  await ctx.time.stepAndWait(5_000);
  await runReads(ctx, answered.run_id, "ended(done)", "the answered run");
  mustEqual(runSent(sent, answered.run_id).map((x) => [x.action, x.token, x.tokenFault ?? null]), [[ON, true, null], ["level.set_level", false, null]],
    "what the answered run sent");
});

requirement("GA-SCN-8", {
  seam: "steward",
  covers: "an if is read when reached and runs one branch: on the live lamp its then; on a dead dimmer, a stale sensor or the air conditioner's assumed mode, with no else, none, the step ending skipped(dead), skipped(stale) or skipped(assumed) in failed_steps; on the assumed mode with an else, the else",
}, async (ctx) => {
  const s = ctx.steward!;
  const [dimmer, motion, ac] = await scripted(ctx, [{ fixture: "dimmer", adopt: "light" }, { fixture: "motion", adopt: "sensor" }, { fixture: "ac", adopt: "ac" }]);
  await assumedMode(ctx, ac!);
  const iff = (target: string, key: string, value: unknown, withElse = false) => ({ if: { target, key, op: "eq", value }, then: [act(LAMP)],
    ...(withElse ? { else: [act(LAMP, OFF)] } : {}) });
  await mustDefine(ctx, [scene("live", [iff(LAMP, "on", false)]), scene("dead", [iff(dimmer!, "on", false)]), scene("stale", [iff(motion!, "motion", false)]),
    scene("assumed", [iff(ac!, "mode", "cool")]), scene("else", [iff(ac!, "mode", "cool", true)])], "scenarios with ifs");
  ctx.standIn!.applier.scriptLiveness(dimmer!, "dead");
  ctx.standIn!.applier.scriptLiveness(motion!, "stale");
  await pollUntil(async () => {
    const t = (await ownerOf(ctx).callOk("state", { targets: [dimmer, motion] })).targets as Record<string, { liveness: string }>;
    return t[dimmer!]?.liveness === "dead" && t[motion!]?.liveness === "stale" || undefined;
  }, 10_000, "the steward never saw the dimmer dead and the sensor stale", 100);
  const sent = sentFrom(ctx);
  const results: string[] = [];
  for (const id of ["live", "dead", "stale", "assumed", "else"]) {
    const { run_id } = await startRun(ctx, s.olga, "olga-app", id);
    const st = await runReads(ctx, run_id, "ended(done)", `the ${id} run`);
    results.push(`${id}: ${JSON.stringify(failedOf(st))} ${JSON.stringify(runSent(sent, run_id).map((x) => x.action))}`);
  }
  ctx.evidence(results.join("; "));
  mustEqual(results, [`live: [] ${JSON.stringify([ON])}`, `dead: ${JSON.stringify(["if1 skipped(dead)"])} []`, `stale: ${JSON.stringify(["if1 skipped(stale)"])} []`,
    `assumed: ${JSON.stringify(["if1 skipped(assumed)"])} []`, `else: [] ${JSON.stringify([OFF])}`], "each if's branch and outcome");
});

requirement("GA-SCN-9", {
  seam: "steward",
  covers: "the owner's run: the member's scenario_stop, a lower role, is not_permitted; an unknown run_id is unknown_run; the owner's stop ends it ended(stopped), its later step never sent",
}, async (ctx) => {
  const s = ctx.steward!;
  await mustDefine(ctx, [scene("long", [act(LAMP), { delay: 60 }, act(LAMP, OFF)])], "a scenario with a delay");
  const sent = sentFrom(ctx);
  const { run_id } = await startRun(ctx, ownerOf(ctx), "owner-app", "long");
  await pollUntil(async () => runSent(sent, run_id).length === 1 || undefined, 10_000, "the run's first step never reached the stand-in", 100);
  mustBe(ctx, await s.olga.call("scenario_stop", { run_id, endpoint: "olga-app" }), "not_permitted", "the member stopping the owner's run");
  mustBe(ctx, await s.olga.call("scenario_stop", { run_id: randomUUID(), endpoint: "olga-app" }), "unknown_run", "a stop of an unknown run");
  const stopped = await ownerOf(ctx).call("scenario_stop", { run_id, endpoint: "owner-app" });
  mustAccept(ctx, stopped, "the owner's stop");
  mustEqual(statusLine(stopped.body as never), "ended(stopped)", "the stop's answer");
  await ctx.time.stepAndWait(61_000);
  await runReads(ctx, run_id, "ended(stopped)", "the stopped run");
  mustEqual(runSent(sent, run_id).map((x) => x.action), [ON], "what the stopped run sent");
});

requirement("GA-SCN-10", {
  seam: "steward",
  covers: "a wait on the motion sensor met goes on to the lamp; one timing out after 60 s with stop ends the run ended(timeout), the lamp never sent, and with continue goes on to it, a scenario event recording each timeout",
}, async (ctx) => {
  const s = ctx.steward!;
  const [motion] = await scripted(ctx, [{ fixture: "motion", adopt: "sensor" }]);
  const wait = (on_timeout: string) => ({ wait: { target: motion, key: "motion", value: true, timeout_s: 60, on_timeout } });
  await mustDefine(ctx, [scene("met", [wait("stop"), act(LAMP)]), scene("stop", [wait("stop"), act(LAMP)]), scene("go", [wait("continue"), act(LAMP)])],
    "scenarios waiting on motion");
  const sent = sentFrom(ctx);
  const c = await cursorNow(ctx);
  const met = await startRun(ctx, s.olga, "olga-app", "met");
  ctx.standIn!.applier.scriptValue(motion!, "motion", true, { cause: "device" });
  await runReads(ctx, met.run_id, "ended(done)", "the met wait");
  mustEqual(runSent(sent, met.run_id).length, 1, "the lamp after the met wait");
  ctx.standIn!.applier.scriptValue(motion!, "motion", false, { cause: "device" });
  await pollUntil(async () => (((await ownerOf(ctx).callOk("state", { targets: [motion] })).targets as any)[motion!]?.values ?? [])
    .some((v: any) => v.key === "motion" && v.value === false) || undefined, 10_000, "the steward never read no motion", 100);
  const stop = await startRun(ctx, s.olga, "olga-app", "stop");
  const go = await startRun(ctx, s.olga, "olga-app", "go");
  await ctx.time.stepAndWait(61_000);
  await runReads(ctx, stop.run_id, "ended(timeout)", "the wait with stop");
  await runReads(ctx, go.run_id, "ended(done)", "the wait with continue");
  const events = await eventsAfter(ctx, c);
  ctx.evidence(`stop: ${changesOf(events, stop.run_id).join(", ")}; continue: ${changesOf(events, go.run_id).join(", ")}`);
  mustEqual(runSent(sent, stop.run_id).length, 0, "the lamp after the wait timed out with stop");
  mustEqual(runSent(sent, go.run_id).length, 1, "the lamp after the wait timed out with continue");
  for (const r of [stop, go]) must(events.some((e) => e.type === "scenario" && e.run_id === r.run_id && e.change === "wait_timeout"), "a timeout was not recorded");
});

requirement("GA-SCN-11", {
  seam: "steward",
  covers: "a person's run: its skipped(occupied) step (the occupied hall) is left out of failed_steps, its skipped(not_confirmed) (an unanswered confirm step) in it; a rule-started run: its skipped(occupancy_unknown) (a lamp in no room) and skipped(toggle_only) (the open TV) are in it; a schedule-started run of the same scenario alike; in_use and in_use_unknown are slice 8's",
}, async (ctx) => {
  const s = ctx.steward!;
  const { presence, dimmer, roomless } = await rooms(ctx);
  const [tv, motion] = await scripted(ctx, [{ fixture: "tv", adopt: "tv" }, { fixture: "motion", adopt: "sensor", bridge: "other-bridge" }]);
  await raiseTier(ctx, dimmer, ON, "confirm");
  ctx.standIn!.applier.scriptValue(presence, "occupancy", true, { cause: "device" });
  await occupancyBecomes(ctx, { hall: "occupied", kitchen: "unknown" }, "someone in the hall");
  await mustDefine(ctx, [scene("mixed", [act(LAMP), act(dimmer, ON)], { respect_occupancy: true }), scene("toggle", [act(tv!, OFF), act(roomless)], { respect_occupancy: true }),
    up("rule", { id: "go", name: "Пуск", conditions: [{ target: motion, key: "motion", op: "eq", value: true }], actions: [{ scenario: "toggle" }] })],
  "a run of each skip, and a rule starting a toggle");
  const { run_id } = await startRun(ctx, s.olga, "olga-app", "mixed");
  const st = await runReads(ctx, run_id, "ended(done)", "the person's run");
  ctx.evidence(`the person's run: ${JSON.stringify(st.failed_steps)}`);
  mustEqual(failedOf(st), ["s2 skipped(not_confirmed)"], "the person's run's failed steps");
  const c = await cursorNow(ctx);
  ctx.standIn!.applier.scriptValue(motion!, "motion", true, { cause: "device" });
  const started = await pollUntil(async () => (await eventsAfter(ctx, c)).find((e) => e.type === "scenario" && e.change === "started" && e.scenario === "toggle"),
    10_000, "the rule never started its run", 100);
  const rs = await runReads(ctx, String(started.run_id), "ended(done)", "the rule's run");
  ctx.evidence(`the rule's run: ${JSON.stringify(rs.failed_steps)}`);
  mustEqual(failedOf(rs), ["s1 skipped(toggle_only)", "s2 skipped(occupancy_unknown)"], "the rule's run's failed steps");
  const { run_id: sid } = await scheduleSoon(ctx, "toggle-at", "toggle");
  const ss = await runReads(ctx, sid, "ended(done)", "the scheduled run");
  ctx.evidence(`the scheduled run: ${JSON.stringify(ss.failed_steps)}`);
  mustEqual(failedOf(ss), ["s1 skipped(toggle_only)", "s2 skipped(occupancy_unknown)"], "the scheduled run's failed steps");
});

requirement("GA-DEF-4", {
  seam: "steward",
  covers: "scenarios whose run steps form a cycle, a → b → a in one change set, and one running itself, are refused cycle, changing nothing; a run step naming no scenario is invalid_request; a chain a → b is taken",
}, async (ctx) => {
  mustEqual(await mustRefuse(ctx, [scene("a", [{ run: "b" }]), scene("b", [act(LAMP), { run: "a" }])], "a → b → a"), "cycle", "the error for a → b → a");
  mustEqual(await mustRefuse(ctx, [scene("self", [{ if: { target: LAMP, key: "on", op: "eq", value: true }, then: [{ run: "self" }] }])], "a scenario running itself"),
    "cycle", "the error for a scenario running itself");
  mustEqual(await mustRefuse(ctx, [scene("a", [{ run: "nowhere" }])], "a run step naming no scenario"), "invalid_request", "the error for a run step naming nothing");
  await mustDefine(ctx, [scene("b", [act(LAMP)]), scene("a", [{ run: "b" }])], "a → b");
});

/** The kiosk capped at visitor, defined: its secret. */
export async function kiosk(ctx: TestContext): Promise<string> {
  const secret = randomUUID();
  await mustDefine(ctx, [up("endpoint", { id: "hall-kiosk", name: "Киоск", type: "panel", room: "hall", person: null, served_by: null, max_role: "visitor" }),
    up("credential", { id: "hall-kiosk", kind: "panel", secret, endpoint: "hall-kiosk" })], "a visitor's kiosk");
  return secret;
}

/** A visitor's run of the lamp from the kiosk: refused(role) and nothing sent (GA-TIER-3). */
export async function visitorRun(ctx: TestContext, secret: string): Promise<void> {
  await mustDefine(ctx, [scene("visit", [act(LAMP)])], "a scenario of the lamp");
  const sent = sentFrom(ctx);
  const st = await asCredential(ctx, secret, async (k) => {
    const { plan, run_id } = await startRun(ctx, k, "hall-kiosk", "visit");
    mustEqual(plan.steps.map(short), [`${LAMP} refuse(role)`], "the visitor's planned step");
    return runReads(ctx, run_id, "ended(done)", "the visitor's run");
  });
  ctx.evidence(`the visitor's run: ${JSON.stringify(st.failed_steps)}`);
  mustEqual(failedOf(st), ["s1 refused(role)"], "the visitor's run's failed steps");
  mustEqual(sent().length, 0, "actions the stand-in received for the visitor's run");
}
