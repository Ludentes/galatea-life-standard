import { randomUUID } from "node:crypto";
import { must, mustEqual, mustWithin } from "../../assert.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import type { McpResult } from "../../seams/mcp.js";
import { LAMP } from "../../steward-home.js";
import { pollUntil, sleep } from "../../util.js";
import { cursorNow, eventsAfter, laptop, relayed, session } from "./rules.js";
import { act, asCredential, brainChat, mustDefine, ownerDefine, ownerOf, planAt, raiseTier, revisionOf, scripted, stepsAt, up, voice } from "./util.js";
import { scene, startRun, visitorRun } from "./scenarios.js";

const HOUR = 3_600_000;
const ON = "onoff.turn_on";
const OFF = "onoff.turn_off";

/** Each plan action the stand-in received last, as `via brain`. */
function lastSeen(ctx: Parameters<typeof ownerOf>[0]): string {
  const r = ctx.standIn!.applier.requests.filter((x) => x.tool === "plan").at(-1);
  return r ? `${r.via} ${r.brain}` : "nothing";
}

requirement("GA-AUTH-1", {
  seam: "steward",
  covers: "the stand-in receives via as the endpoint's type and brain as whether a brain serves it, in plan from a member's app, the guest panel, the brain at its voice endpoint and at an app it serves, and in apply from the member's app with a yes's token bound to her endpoint in its for; plan, answer and apply naming an endpoint the credential is not bound to are not_permitted, from the brain naming the hall panel and from the member's app naming it; define's is graded under GA-DEF-3; scenario_plan from the member's app reaches the stand-in via app, brain false, and scenario_plan and scenario_stop naming the hall panel from her app are not_permitted (scenario_run names no endpoint: it runs a plan); the front's listen and say are slice 9's",
}, async (ctx) => {
  const s = ctx.steward!;
  await mustDefine(ctx, [brainChat("olga-chat", "olga")], "a brain-served app");
  const tries = [
    { who: "the member's app", as: s.olga, endpoint: "olga-app", want: "app false" },
    { who: "the guest panel", as: s.panel, endpoint: "hall-panel", want: "panel false" },
    { who: "the brain at its voice endpoint", as: s.brain, endpoint: "kitchen-voice", want: "voice true" },
    { who: "the brain at an app it serves", as: s.brain, endpoint: "olga-chat", want: "app true" },
  ];
  for (const t of tries) {
    const r = await planAt(t.as, t.endpoint, [act(LAMP)]);
    must(r.ok, `a plan from ${t.who} returned ${r.ok ? "" : r.error}`, r.body);
    ctx.evidence(`${t.who}: the stand-in received via and brain ${lastSeen(ctx)}`);
    mustEqual(lastSeen(ctx), t.want, `via and brain from ${t.who}`);
  }
  await raiseTier(ctx, LAMP, ON, "confirm");
  const asked = await planAt(s.olga, "olga-app", [act(LAMP)]);
  must(asked.ok, `the member's plan returned ${asked.ok ? "" : asked.error}`);
  for (const t of [{ who: "the brain", as: s.brain }, { who: "the member's app", as: s.olga }]) {
    const tries: [string, () => Promise<McpResult>][] = [
      ["plan", () => planAt(t.as, "hall-panel", [act(LAMP)])],
      ["answer", () => t.as.call("answer", { plan_id: asked.body.plan_id, endpoint: "hall-panel", answers: { s1: "yes" } })],
      ["apply", () => t.as.call("apply", { request: { endpoint: "hall-panel", actions: [act(LAMP, OFF)] }, idempotency_key: randomUUID() })],
    ];
    for (const [op, call] of tries) {
      const r = await call();
      ctx.evidence(`${op} by ${t.who} naming the hall panel: ${r.ok ? "accepted" : r.error}`);
      must(!r.ok && r.error === "not_permitted", `${op} by ${t.who} naming an endpoint it is not bound to was ${r.ok ? "accepted" : `refused ${r.error}`}, not not_permitted`);
    }
  }
  const yes = await s.olga.call("answer", { plan_id: asked.body.plan_id, endpoint: "olga-app", answers: { s1: "yes" } });
  must(yes.ok, `the member's yes returned ${yes.ok ? "" : yes.error}`);
  const from = ctx.standIn!.applier.requests.length;
  const applied = await s.olga.call("apply", { plan_id: asked.body.plan_id, idempotency_key: randomUUID() });
  must(applied.ok, `the member's apply returned ${applied.ok ? "" : applied.error}`);
  const sent = ctx.standIn!.applier.requests.slice(from).filter((r) => r.tool === "apply");
  ctx.evidence(`the stand-in received in apply: ${JSON.stringify(sent.map((r) => [r.via, r.brain, r.for, r.token, r.tokenFault ?? ""]))}`);
  must(sent.length === 1 && sent[0]!.via === "app" && sent[0]!.brain === false && (sent[0]!.for as { endpoint?: string }).endpoint === "olga-app"
    && sent[0]!.token && !sent[0]!.tokenFault, "the member's yes did not reach the stand-in from her app, with a token that stands, bound to her endpoint", sent);
  // Scenarios: scenario_plan carries the endpoint's via and brain; one naming an endpoint not bound is not_permitted, as is a stop.
  await mustDefine(ctx, [scene("lamp", [act(LAMP, OFF)])], "a scenario of the lamp");
  const sp = await s.olga.call("scenario_plan", { scenario: "lamp", endpoint: "olga-app" });
  must(sp.ok, `the member's scenario_plan returned ${sp.ok ? "" : sp.error}`);
  ctx.evidence(`the member's scenario_plan: the stand-in received via and brain ${lastSeen(ctx)}`);
  mustEqual(lastSeen(ctx), "app false", "via and brain of the member's scenario_plan");
  const { run_id } = await startRun(ctx, s.olga, "olga-app", "lamp");
  for (const [op, call] of [["scenario_plan", () => s.olga.call("scenario_plan", { scenario: "lamp", endpoint: "hall-panel" })],
    ["scenario_stop", () => s.olga.call("scenario_stop", { run_id, endpoint: "hall-panel" })]] as const) {
    const r = await call();
    ctx.evidence(`${op} by the member's app naming the hall panel: ${r.ok ? "accepted" : r.error}`);
    must(!r.ok && r.error === "not_permitted", `${op} naming an endpoint the app is not bound to was ${r.ok ? "accepted" : `refused ${r.error}`}, not not_permitted`);
  }
});

requirement("GA-AUTH-2", {
  seam: "steward",
  covers: "in plan, on a confirm step: the role is the lower of the person's and the endpoint's max_role (a member's app capped at guest refuses it role, her own app asks; the owner named by the brain at a voice endpoint capped at guest refuses it role), no person is a guest (the panel refuses it role); a speaker named by the brain at its voice endpoint is taken (the member asks), and is invalid_request naming no registered person, from the panel, from a member's app, and from the brain at an app it serves that has a person",
}, async (ctx) => {
  const s = ctx.steward!;
  await raiseTier(ctx, LAMP, ON, "confirm");
  const tablet = randomUUID();
  await mustDefine(ctx, [up("endpoint", { id: "olga-tablet", name: "Планшет Ольги", type: "app", room: null, person: "olga", served_by: null, max_role: "guest" }),
    up("credential", { id: "olga-tablet", kind: "app", secret: tablet, endpoint: "olga-tablet" }), brainChat("olga-chat", "olga"),
    up("endpoint", { id: "hall-voice", name: "Холл", type: "voice", room: "hall", person: null, served_by: "brain", max_role: "guest" }),
    voice("hall-voice")], "a capped app and a capped voice endpoint");
  const roles = [
    { who: "the member's own app", steps: await stepsAt(s.olga, "olga-app", [act(LAMP)]), want: `${LAMP} ask(confirm_tier)` },
    { who: "the member's app capped at guest", steps: await asCredential(ctx, tablet, (t) => stepsAt(t, "olga-tablet", [act(LAMP)])), want: `${LAMP} refuse(role)` },
    { who: "the panel, with no person", steps: await stepsAt(s.panel, "hall-panel", [act(LAMP)]), want: `${LAMP} refuse(role)` },
    { who: "the brain naming the member", steps: await stepsAt(s.brain, "kitchen-voice", [act(LAMP)], { speaker: "olga" }), want: `${LAMP} ask(confirm_tier)` },
    { who: "the brain naming the owner at a voice endpoint capped at guest", steps: await stepsAt(s.brain, "hall-voice", [act(LAMP)], { speaker: "owner" }),
      want: `${LAMP} refuse(role)` },
  ];
  for (const r of roles) {
    ctx.evidence(`${r.who}: ${r.steps.join(", ")}`);
    mustEqual(r.steps, [r.want], `the confirm step from ${r.who}`);
  }
  const speakers = [
    { who: "the brain naming no registered person", as: s.brain, endpoint: "kitchen-voice", speaker: "nobody" },
    { who: "the panel naming the owner", as: s.panel, endpoint: "hall-panel", speaker: "owner" },
    { who: "the member's app naming her", as: s.olga, endpoint: "olga-app", speaker: "olga" },
    { who: "the brain at an app with a person", as: s.brain, endpoint: "olga-chat", speaker: "owner" },
  ];
  for (const t of speakers) {
    const r = await planAt(t.as, t.endpoint, [act(LAMP)], { speaker: t.speaker });
    ctx.evidence(`${t.who}: ${r.ok ? `planned ${(r.body.steps as { verdict: string }[]).map((x) => x.verdict).join(", ")}` : r.error}`);
    must(!r.ok && r.error === "invalid_request", `a speaker from ${t.who} was ${r.ok ? "taken" : `refused ${r.error}`}, not invalid_request`);
  }
});

requirement("GA-TIER-1", {
  seam: "steward",
  covers: "in plan: a no_voice step is refuse(tier) from the brain at its voice endpoint naming a member, and at an app it serves with a person; from the member's own app it is asked; answered or not: the plan applied refuses it tier, never asked so never answered, as does an inline apply through the brain, the stand-in receiving nothing",
}, async (ctx) => {
  const s = ctx.steward!;
  await raiseTier(ctx, LAMP, OFF, "no_voice");
  await mustDefine(ctx, [brainChat("olga-chat", "olga")], "a brain-served app");
  const cases = [
    { who: "the brain at its voice endpoint", steps: await stepsAt(s.brain, "kitchen-voice", [act(LAMP, OFF)], { speaker: "olga" }), want: "refuse(tier)" },
    { who: "the brain at an app it serves", steps: await stepsAt(s.brain, "olga-chat", [act(LAMP, OFF)]), want: "refuse(tier)" },
    { who: "the member's own app", steps: await stepsAt(s.olga, "olga-app", [act(LAMP, OFF)]), want: "ask(confirm_tier)" },
  ];
  for (const c of cases) {
    ctx.evidence(`${c.who}: ${c.steps.join(", ")}`);
    mustEqual(c.steps, [`${LAMP} ${c.want}`], `a no_voice step from ${c.who}`);
  }
  const p = await planAt(s.brain, "olga-chat", [act(LAMP, OFF)]);
  must(p.ok, `the brain's plan returned ${p.ok ? "" : p.error}`);
  const from = ctx.standIn!.applier.requests.length;
  for (const [what, r] of [["the plan applied", await s.brain.call("apply", { plan_id: p.body.plan_id, idempotency_key: randomUUID() })],
    ["applied inline", await s.brain.call("apply", { request: { endpoint: "olga-chat", actions: [act(LAMP, OFF)] }, idempotency_key: randomUUID() })]] as const) {
    must(r.ok, `${what} returned ${r.ok ? "" : r.error}`);
    const got = (r.body.outcomes as { outcome: string; reason?: string }[]).map((o) => `${o.outcome}(${o.reason ?? ""})`);
    ctx.evidence(`${what} through the brain: ${got.join(", ")}`);
    mustEqual(got, ["refused(tier)"], `a no_voice step through the brain, ${what}`);
  }
  mustEqual(ctx.standIn!.applier.requests.slice(from).filter((r) => r.tool === "apply").length, 0, "actions the stand-in received");
});

requirement("GA-TIER-2", {
  seam: "steward",
  covers: "unanswered confirm and no_voice steps from the member's and the owner's apps are ask(confirm_tier) in a plan, carrying the applier's tier, and refused(tier) applied inline, the stand-in receiving neither",
}, async (ctx) => {
  const s = ctx.steward!;
  await raiseTier(ctx, LAMP, ON, "confirm");
  await raiseTier(ctx, LAMP, OFF, "no_voice");
  for (const [who, seam, endpoint] of [["the member", s.olga, "olga-app"], ["the owner", s.owner, "owner-app"]] as const) {
    const r = await planAt(seam, endpoint, [act(LAMP, ON), act(LAMP, OFF)]);
    must(r.ok, `a plan from ${who} returned ${r.ok ? "" : r.error}`, r.body);
    const steps = (r.body.steps as { tier: string; verdict: string; reason?: string }[]).map((x) => `${x.tier} ${x.verdict}(${x.reason ?? ""})`);
    ctx.evidence(`${who}: ${steps.join(", ")}`);
    mustEqual(steps, ["confirm ask(confirm_tier)", "no_voice ask(confirm_tier)"], `unanswered steps above reversible from ${who}`);
    const from = ctx.standIn!.applier.requests.length;
    const inline = await seam.call("apply", { request: { endpoint, actions: [act(LAMP, ON), act(LAMP, OFF)] }, idempotency_key: randomUUID() });
    must(inline.ok, `an inline apply from ${who} returned ${inline.ok ? "" : inline.error}`, inline.body);
    const got = (inline.body.outcomes as { outcome: string; reason?: string }[]).map((o) => `${o.outcome}(${o.reason ?? ""})`);
    ctx.evidence(`${who}, inline: ${got.join(", ")}`);
    mustEqual(got, ["refused(tier)", "refused(tier)"], `unanswered steps above reversible from ${who}, applied inline`);
    mustEqual(ctx.standIn!.applier.requests.slice(from).filter((r) => r.tool === "apply").length, 0, "actions the stand-in received");
  }
});

requirement("GA-TIER-3", {
  seam: "steward",
  covers: "in plan: the guest panel's reversible step is op and its confirm step refuse(role); a panel capped at visitor, and a voice endpoint with a skill_account (visitor by default) served by the brain, are refused role on a reversible step; the visitor's inline apply is refused(role) and the stand-in receives nothing; a visitor's scenario run from the kiosk plans its reversible step refuse(role), ends it refused(role), and sends nothing; define is GA-DEF-3's",
}, async (ctx) => {
  const s = ctx.steward!;
  await raiseTier(ctx, LAMP, OFF, "confirm");
  const kiosk = randomUUID();
  await mustDefine(ctx, [up("endpoint", { id: "hall-kiosk", name: "Киоск", type: "panel", room: "hall", person: null, served_by: null, max_role: "visitor" }),
    up("credential", { id: "hall-kiosk", kind: "panel", secret: kiosk, endpoint: "hall-kiosk" }),
    up("endpoint", { id: "skill", name: "Навык", type: "voice", room: "hall", person: null, served_by: "brain" }), voice("skill", { skill_account: "demo" })],
  "a visitor's kiosk and a skill");
  const cases = [
    { who: "the guest panel, reversible", steps: await stepsAt(s.panel, "hall-panel", [act(LAMP, ON)]), want: "op" },
    { who: "the guest panel, confirm", steps: await stepsAt(s.panel, "hall-panel", [act(LAMP, OFF)]), want: "refuse(role)" },
    { who: "the visitor's kiosk, reversible", steps: await asCredential(ctx, kiosk, (k) => stepsAt(k, "hall-kiosk", [act(LAMP, ON)])), want: "refuse(role)" },
    { who: "the skill, reversible", steps: await stepsAt(s.brain, "skill", [act(LAMP, ON)]), want: "refuse(role)" },
  ];
  for (const c of cases) {
    ctx.evidence(`${c.who}: ${c.steps.join(", ")}`);
    mustEqual(c.steps, [`${LAMP} ${c.want}`], `the step from ${c.who}`);
  }
  const from = ctx.standIn!.applier.requests.length;
  const applied = await asCredential(ctx, kiosk, (k) => k.call("apply", { request: { endpoint: "hall-kiosk", actions: [act(LAMP, ON)] }, idempotency_key: randomUUID() }));
  must(applied.ok, `the visitor's apply returned ${applied.ok ? "" : applied.error}`);
  const got = (applied.body.outcomes as { outcome: string; reason?: string }[]).map((o) => `${o.outcome}(${o.reason ?? ""})`);
  ctx.evidence(`the visitor's inline apply: ${got.join(", ")}`);
  mustEqual(got, ["refused(role)"], "the visitor's reversible step, applied inline");
  mustEqual(ctx.standIn!.applier.requests.slice(from).filter((r) => r.tool === "apply").length, 0, "actions the stand-in received");
  await visitorRun(ctx, kiosk);
});

requirement("GA-STW-1", {
  seam: "steward",
  covers: "a plan with no ask and one with an ask leave describe and state as they were, the lamp's lease from an earlier apply included, the stand-in receives no apply, and every event after them is an ask event",
}, async (ctx) => {
  const s = ctx.steward!;
  // A lease to keep: the member's apply of the lamp, settled before the plans.
  const leased = await s.olga.call("apply", { request: { endpoint: "olga-app", actions: [act(LAMP, ON)] }, idempotency_key: randomUUID() });
  must(leased.ok, `the member's apply returned ${leased.ok ? "" : leased.error}`);
  await pollUntil(async () => ((await s.olga.callOk("outcome", { apply_id: leased.body.apply_id })).outcomes as { outcome: string }[])
    .every((o) => o.outcome !== "dispatched") || undefined, 5_000, "the member's apply was not answered", 50);
  // A raised tier is a model change: wait for the steward to follow it, or describe moves mid-test.
  await raiseTier(ctx, LAMP, OFF, "confirm");
  const { cursor } = await s.olga.callOk("events");
  const before = [await ownerOf(ctx).callOk("describe"), await ownerOf(ctx).callOk("state")];
  const applies = () => ctx.standIn!.applier.requests.filter((r) => r.tool === "apply").length;
  const sent = applies();
  const plain = await stepsAt(s.olga, "olga-app", [act(LAMP, ON)]);
  const asked = await stepsAt(s.olga, "olga-app", [act(LAMP, OFF)]);
  const after = [await ownerOf(ctx).callOk("describe"), await ownerOf(ctx).callOk("state")];
  const events = (await s.olga.callOk("events", { cursor })).events as { type: string }[];
  ctx.evidence(`plans: ${plain.join(", ")}; ${asked.join(", ")}; events after them: ${events.map((e) => e.type).join(", ") || "none"}`);
  // Not a failure here: a subject that leases nothing breaks GA-LEASE-1, not this.
  ctx.evidence(`leases before the plans: ${JSON.stringify((before[1] as { leases?: object }).leases ?? {})}`);
  must(JSON.stringify(after) === JSON.stringify(before), "a plan changed describe or state", { before, after });
  must(events.every((e) => e.type === "ask"), `a plan emitted ${events.map((e) => e.type).join(", ")}, not only ask events`, events);
  mustEqual(applies(), sent, "applies the stand-in received during the plans");
});

requirement("GA-STW-2", {
  seam: "steward",
  covers: "a target reached twice identically, by id and through a group, is one step, in order of first appearance; one target and action with two args gives each step refuse(conflict), and a third identical to the first merges into it; another action on the same target is no conflict; session.lock on one laptop for two accounts is two steps, each an op, and a rule's two locks reach the stand-in as one apply of two actions",
}, async (ctx) => {
  const s = ctx.steward!;
  const [dimmer] = await scripted(ctx, [{ fixture: "dimmer", adopt: "light" }]);
  await mustDefine(ctx, [up("group", { id: "pair", name: "Пара", room: null, members: [LAMP, dimmer], aggregate: "any" })], "a group");
  const level = (n: number) => act(dimmer!, "level.set_level", { level: n });
  const merged = await stepsAt(s.olga, "olga-app", [act(LAMP), act(LAMP), act("pair")]);
  const conflict = await stepsAt(s.olga, "olga-app", [level(10), level(20), level(10)]);
  const two = await stepsAt(s.olga, "olga-app", [act(LAMP, ON), act(LAMP, OFF)]);
  ctx.evidence(`merged: ${merged.join(", ")}; conflict: ${conflict.join(", ")}; two actions: ${two.join(", ")}`);
  mustEqual(merged, [`${LAMP} op`, `${dimmer} op`], "a lamp named, named again and reached through a group with a dimmer");
  mustEqual(conflict, [`${dimmer} refuse(conflict)`, `${dimmer} refuse(conflict)`], "one dimmer set to two levels");
  must(two.length === 2 && two.every((x) => !x.includes("conflict")), `two actions on the lamp gave ${two.join(", ")}`);
  const pc = await laptop(ctx);
  const lock = (account: string) => act(pc, "session.lock", { account });
  const c = await cursorNow(ctx);
  session(ctx, pc, "dmitry", "active");
  session(ctx, pc, "liza", "active");
  await relayed(ctx, c, pc, "session.liza", "active", "both sessions open");
  const locks = await stepsAt(s.olga, "olga-app", [lock("liza"), lock("dmitry")]);
  ctx.evidence(`two accounts' locks: ${locks.join(", ")}`);
  mustEqual(locks, [`${pc} op`, `${pc} op`], "session.lock on one laptop for two accounts");
  session(ctx, pc, "liza", "locked");
  await relayed(ctx, c, pc, "session.liza", "locked", "Лиза's session locked");
  await mustDefine(ctx, [up("rule", { id: "both", name: "Оба", conditions: [{ target: pc, key: "session.liza", not_in: ["locked"] }],
    actions: [lock("liza"), lock("dmitry")] })], "a rule locking both accounts");
  const sent = ctx.standIn!.applier.requests.length;
  session(ctx, pc, "liza", "active");
  const applies = await pollUntil(async () => {
    const r = ctx.standIn!.applier.requests.slice(sent).filter((x) => x.tool === "apply" && String(x.key ?? "").startsWith("rule:both:"));
    return r.length >= 2 ? r : undefined;
  }, 10_000, "the rule's two locks did not reach the stand-in", 100);
  ctx.evidence(`the rule's locks: ${JSON.stringify(applies.map((x) => [x.key, x.args]))}`);
  mustEqual(new Set(applies.map((x) => x.key)).size, 1, "applier applies for the rule's two locks");
});

requirement("GA-STW-4", {
  seam: "steward",
  covers: "the applier, conflict, role, tier and toggle clauses, each on a step two reasons fit: unknown_target before conflict; conflict before dead; dead before role; role before tier; tier before already (a confirm step on a lamp already on is asked); the applier's refuse(token) asked as confirm_tier, never token; the applier's refuse(toggle_only) on the open tv asked as toggle_only, and in place of confirm_tier once the owner raises its tier; refuse(tier) in place of an ask is GA-TIER-1's; a yes to the toggle's ask sends it with a token that stands, and applied inline it is refused(toggle_only), the stand-in receiving nothing; with respect_occupancy, each target in no room: dead before occupancy, tier before occupancy, and the tv's toggle_only in place of occupancy_unknown; leased, on a rule's steps, which alone meet it: already before leased (the lamp off and leased, a turn_off skipped(already)), leased before occupancy (a turn_on respecting occupancy in no room refused(leased)); in_use and in_use_unknown are slice 8's",
}, async (ctx) => {
  const s = ctx.steward!;
  const applier = ctx.standIn!.applier;
  const [far, tv] = await scripted(ctx, [{ fixture: "dimmer", adopt: "light", bridge: "far-bridge" }, { fixture: "tv", adopt: "tv" }]);
  applier.scriptDead("far-bridge", true);
  await raiseTier(ctx, LAMP, ON, "confirm");
  await raiseTier(ctx, far!, ON, "confirm");
  const level = (target: string, n: number) => act(target, "level.set_level", { level: n });
  const cases: [string, () => Promise<string[]>, string[]][] = [
    ["unknown_target before conflict", () => stepsAt(s.olga, "olga-app", [level("sim-bridge:nothing", 1), level("sim-bridge:nothing", 2)]),
      ["sim-bridge:nothing skip(unknown_target)", "sim-bridge:nothing skip(unknown_target)"]],
    ["conflict before dead", () => stepsAt(s.olga, "olga-app", [level(far!, 1), level(far!, 2)]), [`${far} refuse(conflict)`, `${far} refuse(conflict)`]],
    ["dead before role", () => stepsAt(s.panel, "hall-panel", [act(far!)]), [`${far} skip(dead)`]],
    ["role before tier", () => stepsAt(s.panel, "hall-panel", [act(LAMP)]), [`${LAMP} refuse(role)`]],
    ["the applier's token asked as confirm_tier", () => stepsAt(s.olga, "olga-app", [act(LAMP)]), [`${LAMP} ask(confirm_tier)`]],
    ["the applier's toggle_only asked", () => stepsAt(s.olga, "olga-app", [act(tv!, OFF)]), [`${tv} ask(toggle_only)`]],
    ["dead before occupancy", () => stepsAt(s.olga, "olga-app", [act(far!)], { respect_occupancy: true }), [`${far} skip(dead)`]],
    ["tier before occupancy", () => stepsAt(s.olga, "olga-app", [act(LAMP)], { respect_occupancy: true }), [`${LAMP} ask(confirm_tier)`]],
    ["toggle_only in place of occupancy_unknown", () => stepsAt(s.olga, "olga-app", [act(tv!, OFF)], { respect_occupancy: true }), [`${tv} ask(toggle_only)`]],
  ];
  for (const [what, steps, want] of cases) {
    const got = await steps();
    ctx.evidence(`${what}: ${got.join(", ")}`);
    mustEqual(got, want, what);
  }
  applier.scriptValue(LAMP, "on", true);
  const already = await stepsAt(s.olga, "olga-app", [act(LAMP)]);
  ctx.evidence(`tier before already, the lamp on: ${already.join(", ")}`);
  mustEqual(already, [`${LAMP} ask(confirm_tier)`], "a confirm step on a lamp already on");
  await raiseTier(ctx, tv!, OFF, "confirm");
  const raised = await stepsAt(s.olga, "olga-app", [act(tv!, OFF)]);
  ctx.evidence(`the tv's toggle at confirm: ${raised.join(", ")}`);
  mustEqual(raised, [`${tv} ask(toggle_only)`], "a toggle whose tier the owner raised to confirm");
  const p = await planAt(s.olga, "olga-app", [act(tv!, OFF)]);
  must(p.ok, `the plan returned ${p.ok ? "" : p.error}`);
  const yes = await s.olga.call("answer", { plan_id: p.body.plan_id, endpoint: "olga-app", answers: { s1: "yes" } });
  must(yes.ok, `the yes to the toggle returned ${yes.ok ? "" : yes.error}`);
  const from = applier.requests.length;
  const applied = await s.olga.call("apply", { plan_id: p.body.plan_id, idempotency_key: randomUUID() });
  const inline = await s.olga.call("apply", { request: { endpoint: "olga-app", actions: [act(tv!, OFF)] }, idempotency_key: randomUUID() });
  must(applied.ok && inline.ok, `the applies returned ${applied.ok ? "" : applied.error} ${inline.ok ? "" : inline.error}`);
  const sent = applier.requests.slice(from).filter((r) => r.tool === "apply");
  const got = [...applied.body.outcomes, ...inline.body.outcomes].map((o: { outcome: string; reason?: string }) => `${o.outcome}(${o.reason ?? ""})`);
  ctx.evidence(`the toggle answered yes, then inline: ${got.join(", ")}; the stand-in received ${JSON.stringify(sent.map((r) => [r.target, r.token, r.tokenFault ?? ""]))}`);
  mustEqual(got, ["dispatched()", "refused(toggle_only)"], "the toggle answered yes, then applied inline");
  must(sent.length === 1 && sent[0]!.token && !sent[0]!.tokenFault, "the toggle's yes did not reach the stand-in with a token that stands", sent);
  // Leased, which only authored work meets: already before it, and it before occupancy.
  const c = await cursorNow(ctx);
  mustEqual((await s.olga.callOk("apply", { request: { endpoint: "olga-app", actions: [act(LAMP, OFF)] }, idempotency_key: randomUUID() })).outcomes
    .map((o: { outcome: string }) => o.outcome), ["dispatched"], "the member turning the lamp off");
  await relayed(ctx, c, LAMP, "on", false, "the lamp off");
  const [motion] = await scripted(ctx, [{ fixture: "motion", adopt: "sensor" }]);
  await mustDefine(ctx, [up("rule", { id: "order", name: "Порядок", conditions: [{ target: motion, key: "motion", op: "eq", value: true }],
    actions: [{ ...act(LAMP, OFF), respect_occupancy: true }, { ...act(LAMP, ON), respect_occupancy: true }] })], "a rule on the leased lamp");
  const c2 = await cursorNow(ctx);
  applier.scriptValue(motion!, "motion", true, { cause: "device" });
  const ruled = await pollUntil(async () => {
    const own = (await eventsAfter(ctx, c2)).filter((e) => e.type === "outcome" && e.cause?.rule === "order" && e.outcome !== "dispatched");
    return own.length >= 2 ? own : undefined;
  }, 10_000, "the rule's outcomes on the leased lamp", 100);
  const got2 = ruled.map((e) => `${e.step_id} ${e.outcome}(${e.reason})`).sort();
  ctx.evidence(`the rule on the leased lamp: ${got2.join(", ")}`);
  mustEqual(got2, ["s1 skipped(already)", "s2 refused(leased)"], "already before leased, leased before occupancy");
});

requirement("GA-CONF-5", {
  seam: "steward",
  covers: "a plan with an ask emits one ask event { plan_id, step_ids, endpoint, time }, naming only the asked steps, its endpoint the plan's (the member's app; the brain's voice endpoint), the brain credential's confirm_on once it names one, and the endpoint's own over the credential's; a brain's define plan, asked confirm_define, emits one too; a plan with no ask emits none",
}, async (ctx) => {
  const s = ctx.steward!;
  await raiseTier(ctx, LAMP, ON, "confirm");
  const asked = async (seam: typeof s.olga, endpoint: string, speaker?: string) => {
    const { cursor } = await s.olga.callOk("events");
    const r = await planAt(seam, endpoint, [act(LAMP, ON), act(LAMP, OFF)], { speaker });
    must(r.ok, `a plan at ${endpoint} returned ${r.ok ? "" : r.error}`, r.body);
    const events = ((await s.olga.callOk("events", { cursor })).events as any[]).filter((e) => e.type === "ask");
    ctx.evidence(`a plan at ${endpoint}: ${JSON.stringify(events)}`);
    mustEqual(events.length, 1, `ask events of a plan at ${endpoint}`);
    const e = events[0];
    mustEqual([e.plan_id, e.step_ids], [r.body.plan_id, ["s1"]], `the ask event's plan and steps for a plan at ${endpoint}`);
    mustWithin(Date.parse(e.time), ctx.time.now(), 1000 + ctx.allowanceMs, "the ask event's time");
    return e.endpoint as string;
  };
  mustEqual(await asked(s.olga, "olga-app"), "olga-app", "where the member's own plan is asked");
  // A brain's define plan asks confirm_define, and puts its ask event as any plan with an ask.
  const owners = await ownerOf(ctx).callOk("describe");
  if (!(owners.endpoints as { id: string }[]).some((e) => e.id === "owner-chat")) await mustDefine(ctx, [brainChat("owner-chat", "owner")], "the owner's chat window");
  const before = await s.olga.callOk("events");
  const defined = await s.brain.call("define", { endpoint: "owner-chat", changes: [up("room", { id: "attic", name: "Чердак" })],
    expected_revision: await revisionOf(ctx), dry_run: false });
  must(defined.ok && Array.isArray(defined.body.steps), "the brain's define returned no plan", defined.ok ? defined.body : defined.error);
  const defineAsks = ((await s.olga.callOk("events", { cursor: before.cursor })).events as any[]).filter((e) => e.type === "ask" && e.plan_id === defined.body.plan_id);
  ctx.evidence(`the brain's define plan's ask events: ${JSON.stringify(defineAsks)}`);
  mustEqual(defineAsks.map((e) => e.step_ids), [["s1"]], "the ask events of the brain's define plan");
  mustEqual(await asked(s.brain, "kitchen-voice", "olga"), "kitchen-voice", "where the brain's plan is asked, with no confirm_on");
  await mustDefine(ctx, [up("credential", { id: "brain", kind: "brain", secret: ctx.credentials!.brain, confirm_on: "olga-app" })], "the brain's confirm_on");
  mustEqual(await asked(s.brain, "kitchen-voice", "olga"), "olga-app", "where the brain's plan is asked, its credential naming olga-app");
  await mustDefine(ctx, [up("endpoint", { id: "kitchen-voice", name: "Кухня", type: "voice", room: "kitchen", person: null, served_by: "brain",
    confirm_on: "owner-app" })], "the voice endpoint's confirm_on");
  mustEqual(await asked(s.brain, "kitchen-voice", "olga"), "owner-app", "where the brain's plan is asked, its endpoint naming owner-app");
  const { cursor } = await s.olga.callOk("events");
  await stepsAt(s.olga, "olga-app", [act(LAMP, OFF)]);
  const none = (await s.olga.callOk("events", { cursor })).events as { type: string }[];
  mustEqual(none.filter((e) => e.type === "ask").length, 0, "ask events of a plan with no ask");
});

requirement("GA-HARN-2", {
  seam: "steward",
  covers: "after a step of an hour, a plan's expires_at is the source's time plus the plan expiry, and with an ask plus ask_expiry_s; a describe long poll ends when the source is stepped past its wait_s; time_source is refused invalid_request once the applier's describe carries no test_run_id, and taken again once it does",
}, async (ctx) => {
  const s = ctx.steward!;
  await ctx.time.stepAndWait(HOUR);
  const expiry = async (what: string, want: number) => {
    const r = await planAt(s.olga, "olga-app", [act(LAMP, ON)]);
    must(r.ok, `a plan returned ${r.ok ? "" : r.error}`, r.body);
    ctx.evidence(`${what}: expires_at ${r.body.expires_at}, the source at ${new Date(ctx.time.now()).toISOString()}`);
    mustWithin(Date.parse(r.body.expires_at), ctx.time.now() + want, 1000 + ctx.allowanceMs, `${what}'s expires_at`);
  };
  await expiry("a plan with no ask", constantMs("steward", "plan-expiry"));
  await raiseTier(ctx, LAMP, ON, "confirm");
  await expiry("a plan with an ask", constantMs("steward", "ask-expiry-default"));
  const r1 = await revisionOf(ctx);
  // The poll may reach the steward only after a step, which then counts its wait_s from the stepped time (a
  // loaded host): the source is stepped past wait_s again while it still waits, for up to 10 s of wall time.
  const started = Date.now();
  let ended = false;
  const waiting = ownerOf(ctx).callOk("describe", { since_revision: r1, wait_s: 30 }).finally(() => { ended = true; });
  waiting.catch(() => undefined);
  let steps = 0;
  while (!ended && Date.now() - started < 10_000) {
    await ctx.time.stepAndWait(31_000);
    steps++;
    for (const stepped = Date.now(); !ended && Date.now() - stepped < 1_000;) await sleep(20);
  }
  must(ended, "a describe long poll did not end when the source was stepped past its wait_s");
  const woke = await waiting;
  ctx.evidence(`a describe waiting 30 s returned revision ${woke.revision} ${Date.now() - started} ms of wall time after the source was stepped 31 s ${steps === 1 ? "once" : `${steps} times`}`);
  ctx.standIn!.applier.hideRunId(true);
  await pollUntil(async () => (await revisionOf(ctx)) > r1, 10_000, "the steward did not follow the stand-in's describe", 100);
  const refused = await ownerDefine(ctx, [up("home", { time_source: ctx.time.source })]);
  ctx.evidence(`time_source with no test_run_id at the applier: ${refused.ok ? "accepted" : `${refused.error}: ${refused.message}`}`);
  must(!refused.ok && refused.error === "invalid_request", `time_source was ${refused.ok ? "accepted" : `refused ${refused.error}`} while the applier reported no test_run_id`);
  const r2 = await revisionOf(ctx);
  ctx.standIn!.applier.hideRunId(false);
  await pollUntil(async () => (await revisionOf(ctx)) > r2, 10_000, "the steward did not follow the stand-in's describe", 100);
  const taken = await ownerDefine(ctx, [up("home", { time_source: ctx.time.source })]);
  must(taken.ok, `time_source was refused ${taken.ok ? "" : taken.error} once the applier reported its test_run_id again`, taken.body);
});
