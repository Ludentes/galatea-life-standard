import { randomUUID } from "node:crypto";
import { must, mustEqual, mustWithin } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import type { McpResult, McpSeam } from "../../seams/mcp.js";
import { LAMP, VOICE_ENDPOINTS } from "../../steward-home.js";
import { pollUntil } from "../../util.js";
import { act, brainChat, mustDefine, occupancyBecomes, planAt, raiseTier, rooms, scripted, short, up } from "./util.js";
import { runReads, runSent, startRun } from "./scenarios.js";

const ON = "onoff.turn_on";
const OFF = "onoff.turn_off";

/**
 * An utterance record heard at `endpoint` now on the time source, each with its own id and transcript,
 * with `extra` over it. At an endpoint with a voice record it names the asking `say`, heard in full and
 * ended half a second before (`asked_by`, GA-CONF-2), so a case there expects what the standard
 * allows whether or not the subject checks `asked_by` yet.
 */
export function heard(ctx: TestContext, endpoint: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const now = ctx.time.now();
  return { utterance_id: randomUUID(), endpoint, time: new Date(now).toISOString(), transcript: `да ${randomUUID().slice(0, 8)}`, addressed_by: "wake",
    ...(VOICE_ENDPOINTS.includes(endpoint) ? { asked_by: { say_id: randomUUID(), status: "full", ended_at: new Date(now - 500).toISOString() } } : {}),
    ...extra };
}

/** A plan from `seam` at `endpoint`, failing unless it is made. */
export async function planned(seam: McpSeam, endpoint: string, actions: unknown[], o: { speaker?: string; respect_occupancy?: boolean } = {}): Promise<any> {
  const r = await planAt(seam, endpoint, actions, o);
  must(r.ok, `plan at ${endpoint} returned ${r.ok ? "" : `${r.error}: ${r.message}`}`, r.body);
  return r.body;
}

/**
 * `answer` from `seam`. A record at an endpoint with a voice record always carries `asked_by`: a case
 * without it would lean on a subject that does not check GA-CONF-2's `asked_by` clause.
 */
export function answer(seam: McpSeam, plan_id: string, endpoint: string, answers: Record<string, string>,
  o: { utterance?: unknown; speaker?: string } = {}): Promise<McpResult> {
  if (o.utterance && VOICE_ENDPOINTS.includes(endpoint) && (o.utterance as Record<string, unknown>).asked_by === undefined) {
    throw new Error(`the harness answers at ${endpoint}, which has a voice record, only with asked_by (GA-CONF-2)`);
  }
  return seam.call("answer", { plan_id, endpoint, answers, ...(o.utterance ? { utterance: o.utterance } : {}), ...(o.speaker ? { speaker: o.speaker } : {}) });
}

/** `apply` of a plan from `seam`, under a fresh key unless one is given. */
export const applyPlan = (seam: McpSeam, plan_id: string, key: string = randomUUID()): Promise<McpResult> =>
  seam.call("apply", { plan_id, idempotency_key: key });

/** `apply` of an inline request from `seam` at `endpoint`. */
export const applyInline = (seam: McpSeam, endpoint: string, actions: unknown[], key: string = randomUUID(),
  o: { speaker?: string; respect_occupancy?: boolean } = {}): Promise<McpResult> =>
  seam.call("apply", { request: { endpoint, ...(o.speaker ? { speaker: o.speaker } : {}), actions,
    ...(o.respect_occupancy !== undefined ? { respect_occupancy: o.respect_occupancy } : {}) }, idempotency_key: key });

/** An outcome as `target outcome(reason)`. */
export const outcomeOf = (o: { target: string; outcome: string; reason?: string }) => `${o.target} ${o.outcome}${o.reason ? `(${o.reason})` : ""}`;

/** An apply's outcomes, failing unless it was applied. */
export function outcomes(r: McpResult, what: string): string[] {
  must(r.ok, `${what} returned ${r.ok ? "" : `${r.error}: ${r.message}`}`, r.body);
  return (r.body.outcomes as { target: string; outcome: string; reason?: string }[]).map(outcomeOf);
}

/** The stand-in's apply requests from now on: what the steward sent it, one entry per action. */
export function sentFrom(ctx: TestContext): () => { target: string; action: string; args: any; token: boolean; tokenFault?: string; tokenExpires?: string; for: any;
  via: string; brain: boolean; key?: string }[] {
  const from = ctx.standIn!.applier.requests.length;
  return () => ctx.standIn!.applier.requests.slice(from).filter((r) => r.tool === "apply") as never;
}

/** The `answer` events in the steward's log since `cursor`: what an answer that counted leaves behind. */
export async function answersSince(ctx: TestContext, cursor: string): Promise<unknown[]> {
  return ((await ctx.steward!.owner.callOk("events", { cursor })).events as { type: string }[]).filter((e) => e.type === "answer");
}

/** Fails unless `r` is the request error `code`. */
export function mustBe(ctx: TestContext, r: McpResult, code: string, what: string): void {
  ctx.evidence(`${what}: ${r.ok ? "accepted" : `${r.error}: ${r.message}`}`);
  must(!r.ok && r.error === code, `${what} was ${r.ok ? "accepted" : r.error}, not ${code}`, r.body);
}

/** Fails unless `r` was accepted. */
export function mustAccept(ctx: TestContext, r: McpResult, what: string): void {
  ctx.evidence(`${what}: ${r.ok ? "accepted" : `${r.error}: ${r.message}`}`);
  must(r.ok, `${what} returned ${r.ok ? "" : `${r.error}: ${r.message}`}`, r.body);
}

requirement("GA-CONF-1", {
  seam: "steward",
  covers: "the member's plan answered by the owner from their app is not_permitted and changes nothing (no answer event); the brain's plan at a chat whose confirm_on names the member's app is not answered by the brain there, and is answered from the member's app; the brain's plan at the kitchen's voice endpoint naming the member as speaker is not answered naming the owner (its record carrying asked_by); with the brain credential's confirm_on naming the member's app, the brain's plan at a chat with none is not answered by the brain there, and is answered from the member's app; an applied plan takes no answer",
}, async (ctx) => {
  const s = ctx.steward!;
  await raiseTier(ctx, LAMP, ON, "confirm");
  const own = await planned(s.olga, "olga-app", [act(LAMP)]);
  const { cursor } = await s.owner.callOk("events");
  mustBe(ctx, await answer(s.owner, own.plan_id, "owner-app", { s1: "yes" }), "not_permitted", "the owner answering the member's plan");
  mustEqual(await answersSince(ctx, cursor), [], "answer events after a refused answer");
  mustAccept(ctx, await applyPlan(s.olga, own.plan_id), "the member's apply");
  mustBe(ctx, await answer(s.olga, own.plan_id, "olga-app", { s1: "yes" }), "not_permitted", "an answer to an applied plan");
  await mustDefine(ctx, [up("endpoint", { id: "olga-chat", name: "olga-chat", type: "app", room: null, person: "olga", served_by: "brain", confirm_on: "olga-app" })],
    "a chat whose confirm_on names the member's app");
  const chat = await planned(s.brain, "olga-chat", [act(LAMP)]);
  mustBe(ctx, await answer(s.brain, chat.plan_id, "olga-chat", { s1: "yes" }, { utterance: heard(ctx, "olga-chat", { addressed_by: "typed" }) }),
    "not_permitted", "the brain answering at the chat, its question put on the member's app");
  mustAccept(ctx, await answer(s.olga, chat.plan_id, "olga-app", { s1: "yes" }), "the member answering on her app");
  const named = await planned(s.brain, "kitchen-voice", [act(LAMP)], { speaker: "olga" });
  mustBe(ctx, await answer(s.brain, named.plan_id, "kitchen-voice", { s1: "yes" }, { speaker: "owner", utterance: heard(ctx, "kitchen-voice") }),
    "not_permitted", "the brain answering the member's plan naming the owner");
  // The brain credential's own confirm_on, for an endpoint with none (the endpoint's comes first).
  await mustDefine(ctx, [brainChat("olga-notes", "olga"), up("credential", { id: "brain", kind: "brain", secret: ctx.credentials!.brain, confirm_on: "olga-app" })],
    "a chat with no confirm_on, and the brain credential's naming the member's app");
  const viaCredential = await planned(s.brain, "olga-notes", [act(LAMP)]);
  const { cursor: before } = await s.owner.callOk("events");
  mustBe(ctx, await answer(s.brain, viaCredential.plan_id, "olga-notes", { s1: "yes" }, { utterance: heard(ctx, "olga-notes", { addressed_by: "typed" }) }),
    "not_permitted", "the brain answering at the chat, its question put on the member's app by the brain credential's confirm_on");
  mustEqual(await answersSince(ctx, before), [], "answer events after the brain's refused answer");
  mustAccept(ctx, await answer(s.olga, viaCredential.plan_id, "olga-app", { s1: "yes" }), "the member answering on her app, as the brain credential's confirm_on names");
});

requirement("GA-CONF-2", {
  seam: "steward",
  covers: "through the brain at a chat it serves: an answer without an utterance record, with one of another endpoint, timed 2 s before the ask or 2 s after the answer arrives, naming a step the ask did not, or whose utterance_id, or whose endpoint, time and transcript, already answered another plan, is invalid_request and counts for nothing (no answer event), and one timed now is taken, its record kept in history with its step (the answer event naming s1 and the utterance); a record without addressed_by counting as follow_up is graded under GA-CONF-6; the asked_by clauses are slice 9's (listening)",
}, async (ctx) => {
  const s = ctx.steward!;
  await raiseTier(ctx, LAMP, ON, "confirm");
  await mustDefine(ctx, [brainChat("olga-chat", "olga")], "a brain-served chat");
  const p = await planned(s.brain, "olga-chat", [act(LAMP, ON), act(LAMP, OFF)]);
  const at = (ms: number) => heard(ctx, "olga-chat", { time: new Date(ctx.time.now() + ms).toISOString() });
  const refused: [string, () => Promise<McpResult>][] = [
    ["an answer with no record", () => answer(s.brain, p.plan_id, "olga-chat", { s1: "yes" })],
    ["a record of another endpoint", () => answer(s.brain, p.plan_id, "olga-chat", { s1: "yes" }, { utterance: heard(ctx, "kitchen-voice") })],
    ["a record 2 s before the ask", () => answer(s.brain, p.plan_id, "olga-chat", { s1: "yes" }, { utterance: at(-2000 - 1000 * Math.ceil(ctx.allowanceMs / 1000)) })],
    ["a record 2 s after the answer arrives", () => answer(s.brain, p.plan_id, "olga-chat", { s1: "yes" }, { utterance: at(2000 + ctx.allowanceMs) })],
    ["a step the ask did not name", () => answer(s.brain, p.plan_id, "olga-chat", { s2: "yes" }, { utterance: heard(ctx, "olga-chat") })],
  ];
  const { cursor } = await s.owner.callOk("events");
  for (const [what, r] of refused) mustBe(ctx, await r(), "invalid_request", what);
  mustEqual(await answersSince(ctx, cursor), [], "answer events after refused records (they count for nothing)");
  const first = heard(ctx, "olga-chat");
  const since = ctx.time.now() - 1_000;
  mustAccept(ctx, await answer(s.brain, p.plan_id, "olga-chat", { s1: "yes" }, { utterance: first }), "a record timed now");
  // `to` a minute past now: the steward's clock may run a little ahead of the time server's (the milestone 7+10+11 review, I1).
  const kept = ((await s.owner.callOk("history", { from: new Date(since).toISOString(), to: new Date(ctx.time.now() + 60_000).toISOString() })).events as
    { type: string; plan_id?: string; answers?: unknown; utterance?: { utterance_id?: string } }[]).find((e) => e.type === "answer" && e.plan_id === p.plan_id);
  ctx.evidence(`the answer in history: ${JSON.stringify(kept)}`);
  mustEqual(kept?.answers, { s1: "yes" }, "the answer's step in history");
  mustEqual(kept?.utterance?.utterance_id, first.utterance_id, "the answer's utterance record in history");
  const q = await planned(s.brain, "olga-chat", [act(LAMP, ON)]);
  mustBe(ctx, await answer(s.brain, q.plan_id, "olga-chat", { s1: "yes" }, { utterance: { ...heard(ctx, "olga-chat"), utterance_id: first.utterance_id } }),
    "invalid_request", "a record whose utterance_id answered another plan");
  mustBe(ctx, await answer(s.brain, q.plan_id, "olga-chat", { s1: "yes" }, { utterance: { ...first, utterance_id: randomUUID() } }),
    "invalid_request", "a record whose endpoint, time and transcript answered another plan");
  mustAccept(ctx, await answer(s.brain, q.plan_id, "olga-chat", { s1: "yes" }, { utterance: heard(ctx, "olga-chat") }), "a fresh record");
});

requirement("GA-CONF-3", {
  seam: "steward",
  covers: "a plan of two confirm steps answered yes and no, applied: the stand-in receives the yes step with a token whose proof, issuer and bound target, action, args, via, brain and for hold, expiring 60 s after issue, and never the no step; an unanswered step gets no token; a rule's confirm step reaches the stand-in with an authored token for the rule that stands, expiring 60 s after issue; a person-started run's yes earns a token at its step's dispatch, bound to the for sent (naming the run), that stands; rule-started runs' authored tokens are graded under GA-SCN-4",
}, async (ctx) => {
  const s = ctx.steward!;
  const applier = ctx.standIn!.applier;
  const [dimmer] = await scripted(ctx, [{ fixture: "dimmer", adopt: "light" }]);
  await raiseTier(ctx, LAMP, ON, "confirm");
  await raiseTier(ctx, dimmer!, ON, "confirm");
  const p = await planned(s.olga, "olga-app", [act(LAMP), act(dimmer!), act(dimmer!, "level.set_level", { level: 30 })]);
  mustEqual(p.steps.map((x: any) => x.verdict), ["ask", "ask", "op"], "the plan's steps");
  mustAccept(ctx, await answer(s.olga, p.plan_id, "olga-app", { s1: "yes", s2: "no" }), "the member's yes and no");
  const sent = sentFrom(ctx);
  const r = await applyPlan(s.olga, p.plan_id);
  const issued = ctx.time.now();
  ctx.evidence(`applied: ${outcomes(r, "the apply").join(", ")}; the stand-in received ${JSON.stringify(sent().map((x) => [x.target, x.action, x.token, x.tokenFault ?? ""]))}`);
  mustEqual(sent().map((x) => [x.target, x.action, x.token]), [[LAMP, ON, true], [dimmer, "level.set_level", false]], "the actions the stand-in received, and which had a token");
  const yes = sent()[0]!;
  must(yes.tokenFault === undefined, `the yes step's token does not stand at the stand-in: ${yes.tokenFault}`);
  mustWithin(Date.parse(yes.tokenExpires!), issued + constantMs("steward", "token-expiry"), 1000 + ctx.allowanceMs, "the token's expires");
  // Authored: a rule's confirm step, on a dimmer no one leased.
  const [pc, other] = await scripted(ctx, [{ fixture: "laptop", adopt: "computer" }, { fixture: "dimmer", adopt: "light", bridge: "other-bridge" }]);
  await raiseTier(ctx, other!, ON, "confirm");
  applier.scriptValue(pc!, "session.liza", "locked", { cause: "device" });
  await mustDefine(ctx, [up("rule", { id: "dim", name: "Свет", conditions: [{ target: pc, key: "session.liza", not_in: ["locked"] }],
    actions: [act(other!)] })], "a rule on the dimmer's confirm step");
  const authored = sentFrom(ctx);
  applier.scriptValue(pc!, "session.liza", "active", { cause: "device" });
  const step = await pollUntil(async () => authored().find((x) => x.target === other && x.action === ON), 10_000, "the rule's step never reached the stand-in", 100);
  const fired = ctx.time.now();
  ctx.evidence(`the rule's step: ${JSON.stringify([step.token, step.tokenFault ?? "", step.for, step.via])}`);
  must(step.token && step.tokenFault === undefined, `the rule's step has no token that stands: ${step.tokenFault}`);
  mustEqual(step.for, { rule: "dim" }, "the authored token's for");
  mustWithin(Date.parse(step.tokenExpires!), fired + constantMs("steward", "token-expiry"), 2000 + ctx.allowanceMs, "the authored token's expires");
  // A run's yes: the token is issued at its step's dispatch.
  await mustDefine(ctx, [up("scenario", { id: "dim", name: "Свет", mode: "single", steps: [{ delay: 5 }, act(dimmer!)] })], "a scenario of the dimmer's confirm step");
  const runSentAll = sentFrom(ctx);
  const { run_id } = await startRun(ctx, s.olga, "olga-app", "dim", { answers: { s1: "yes" } });
  await ctx.time.stepAndWait(5_000);
  await runReads(ctx, run_id, "ended(done)", "the member's run");
  const runStep = runSent(runSentAll, run_id);
  ctx.evidence(`the run's step: ${JSON.stringify(runStep.map((x) => [x.target, x.token, x.tokenFault ?? "", x.for]))}`);
  // GA-CONF-3 grades the token bound to the for actually sent; that the cause names the starting endpoint is GA-SCN-3's.
  mustEqual(runStep.map((x) => [x.target, x.token, x.tokenFault ?? null, (x.for as { run?: unknown } | undefined)?.run]), [[dimmer, true, null, run_id]],
    "the run's step, its token standing, and its for naming the run");
});

requirement("GA-CONF-6", {
  seam: "steward",
  covers: "through the brain at a chat it serves with a person: a follow_up answer, and one with no addressed_by, without a gate hint naming a registered person, is not_permitted and changes nothing (no answer event); one with a gate hint naming the member counts; typed counts at the chat, an app, and is not_permitted at the kitchen's voice endpoint; skill at an endpoint with no skill_account, and a person basis naming another than the chat's person, are not_permitted; the clauses against a voice record, its narrowings and gate models are slice 9's (listening)",
}, async (ctx) => {
  const s = ctx.steward!;
  await raiseTier(ctx, LAMP, ON, "confirm");
  await mustDefine(ctx, [brainChat("olga-chat", "olga")], "a brain-served chat");
  const p = await planned(s.brain, "olga-chat", [act(LAMP)]);
  const by = (extra: Record<string, unknown>, endpoint = "olga-chat") => heard(ctx, endpoint, extra);
  const refused: [string, Record<string, unknown>][] = [
    ["a follow_up with no hint", { addressed_by: "follow_up" }],
    ["a record with no addressed_by and no hint", { addressed_by: undefined }],
    ["a follow_up with a gate hint naming nobody registered", { addressed_by: "follow_up", hint_basis: "gate", speaker_hint: "nobody" }],
    ["a follow_up with a person hint", { addressed_by: "follow_up", hint_basis: "person", speaker_hint: "olga" }],
    ["a skill's answer with no skill_account", { addressed_by: "skill", hint_basis: "gate", speaker_hint: "olga" }],
    ["a person basis naming the owner at the member's chat", { addressed_by: "wake", hint_basis: "person", speaker_hint: "owner" }],
  ];
  const { cursor } = await s.owner.callOk("events");
  for (const [what, extra] of refused) mustBe(ctx, await answer(s.brain, p.plan_id, "olga-chat", { s1: "yes" }, { utterance: by(extra) }), "not_permitted", what);
  mustEqual(await answersSince(ctx, cursor), [], "answer events after refused answers");
  const q = await planned(s.brain, "olga-chat", [act(LAMP)]);
  mustAccept(ctx, await answer(s.brain, q.plan_id, "olga-chat", { s1: "yes" },
    { utterance: by({ addressed_by: "follow_up", hint_basis: "gate", speaker_hint: "olga" }) }), "a follow_up with a gate hint naming the member");
  const t = await planned(s.brain, "olga-chat", [act(LAMP)]);
  mustAccept(ctx, await answer(s.brain, t.plan_id, "olga-chat", { s1: "yes" }, { utterance: by({ addressed_by: "typed" }) }), "typed at the chat");
  const k = await planned(s.brain, "kitchen-voice", [act(LAMP)], { speaker: "olga" });
  mustBe(ctx, await answer(s.brain, k.plan_id, "kitchen-voice", { s1: "yes" }, { speaker: "olga", utterance: by({ addressed_by: "typed" }, "kitchen-voice") }),
    "not_permitted", "typed at the kitchen's voice endpoint");
});

requirement("GA-APPLY-3", {
  seam: "steward",
  covers: "an asked step left unanswered, and one answered no, are skipped(not_confirmed) at apply and the stand-in receives no action for either, the plan's other step dispatched; a step that becomes an ask at dispatch, the hall's lamp planned with respect_occupancy while the hall was vacant and applied once its sensor is stale, is skipped(not_confirmed) and the stand-in receives nothing",
}, async (ctx) => {
  const s = ctx.steward!;
  await raiseTier(ctx, LAMP, ON, "confirm");
  for (const said of [undefined, "no"] as const) {
    ctx.standIn!.applier.scriptValue(LAMP, "on", true);
    const p = await planned(s.olga, "olga-app", [act(LAMP, ON), act(LAMP, OFF)]);
    if (said) mustAccept(ctx, await answer(s.olga, p.plan_id, "olga-app", { s1: said }), "the member's no");
    const sent = sentFrom(ctx);
    const applied = await applyPlan(s.olga, p.plan_id);
    const got = outcomes(applied, "the apply");
    ctx.evidence(`answered ${said ?? "nothing"}: ${got.join(", ")}`);
    mustEqual(got, [`${LAMP} skipped(not_confirmed)`, `${LAMP} dispatched`], `the plan answered ${said ?? "nothing"}`);
    mustEqual(sent().map((x) => x.action), [OFF], "the actions the stand-in received");
    // The stand-in answers the off a moment later; the next round turns the lamp on again only after it.
    await pollUntil(async () => ((await s.olga.callOk("outcome", { apply_id: applied.body.apply_id })).outcomes as { outcome: string }[])
      .every((o) => o.outcome !== "dispatched") || undefined, 5_000, "the lamp's off was not answered", 50);
  }
  // A step that becomes an ask at dispatch: the hall's room no longer known.
  await raiseTier(ctx, LAMP, ON, "reversible");
  const { presence } = await rooms(ctx);
  await ctx.time.stepAndWait(constantMs("steward", "occupancy-hold-default") + 1_000);
  await occupancyBecomes(ctx, { hall: "vacant", kitchen: "unknown" }, "the hall's sensor live for the hold");
  const vacant = await planned(s.olga, "olga-app", [act(LAMP, ON)], { respect_occupancy: true });
  ctx.evidence(`planned in the vacant hall: ${vacant.steps.map(short).join(", ")}`);
  mustEqual(vacant.steps.map(short), [`${LAMP} op`], "the lamp's step in the vacant hall");
  ctx.standIn!.applier.scriptLiveness(presence, "stale");
  await occupancyBecomes(ctx, { hall: "unknown", kitchen: "unknown" }, "the hall's sensor stale");
  const sent = sentFrom(ctx);
  const got = outcomes(await applyPlan(s.olga, vacant.plan_id), "the apply once the hall is unknown");
  ctx.evidence(`applied once the hall is unknown: ${got.join(", ")}`);
  mustEqual(got, [`${LAMP} skipped(not_confirmed)`], "a step that became an ask at dispatch");
  mustEqual(sent().length, 0, "actions the stand-in received");
});
