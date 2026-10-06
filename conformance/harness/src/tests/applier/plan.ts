import { must, mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { requirement } from "../../registry.js";
import { pollUntil, sleep } from "../../util.js";
import { sign, type Asked } from "../token.js";
import { DIMMER, GATE, LAMP, livenessWithin, oneSecond, TV } from "../util.js";

const RELAY = "sim-bridge:relay";
const KETTLE = "sim-bridge:kettle";
type Step = { step_id: string; target: string; action: string; verdict: string; reason?: string; tier: string; stale: boolean; basis: string };

/** An action as the harness's steward asks for it. */
const ask = (target: string, action: string, extra: Partial<Asked> & { token?: unknown } = {}) =>
  ({ target, action, args: {}, via: "app", brain: false, for: { person: "demo" }, ...extra });

/** The steps of a plan for `actions`. */
async function steps(ctx: TestContext, actions: unknown[]): Promise<Step[]> {
  return (await ctx.mcp!.callOk("plan", { actions })).steps as Step[];
}

/** The one step's verdict, with its reason: `op`, `skip(already)`, `refuse(token)`. */
async function verdict(ctx: TestContext, action: Record<string, unknown>): Promise<string> {
  const [s] = await steps(ctx, [action]);
  return `${s!.verdict}${s!.reason ? `(${s!.reason})` : ""}`;
}

/** Fails unless the step for `action` is `want`, naming `why`. */
async function mustPlan(ctx: TestContext, action: Record<string, unknown>, want: string, why: string): Promise<void> {
  mustEqual(await verdict(ctx, action), want, `the step for ${why}`);
}

/** `a` with a token the harness signed for it, `extra` changing the token before it is signed. */
const signed = (ctx: TestContext, a: ReturnType<typeof ask>, extra: Record<string, unknown> = {}) => ({ ...a, token: sign(ctx, a, extra) });

requirement("GA-PLAN-2", {
  seam: "applier", fixture: { devices: ["lamp"] },
  covers: "identical actions are one step; a different via, for or token is a step of its own; an unknown target is skip(unknown_target) in a plan that succeeds",
}, async (ctx) => {
  const on = ask(LAMP, "onoff.turn_on");
  const s = await steps(ctx, [on, on, { ...on, via: "panel" }, { ...on, for: { person: "guest" } }, ask("sim-bridge:ghost", "onoff.turn_on")]);
  mustEqual(s.map((x) => [x.target, x.verdict, x.reason ?? null]), [[LAMP, "op", null], [LAMP, "op", null], [LAMP, "op", null],
    ["sim-bridge:ghost", "skip", "unknown_target"]], "the plan's steps");
  must(new Set(s.map((x) => x.step_id)).size === s.length, "each step has its own step_id", s);
  const withToken = await steps(ctx, [on, { ...on, token: sign(ctx, on) }]);
  mustEqual(withToken.length, 2, "the steps of an action with a token and the same without");
});

requirement("GA-PLAN-3", {
  seam: "applier", fixture: { devices: ["lamp", "tv"] },
  covers: "every step of a plan, op, skip and refuse alike, closed and open devices alike, says real or emulated",
}, async (ctx) => {
  const s = await steps(ctx, [ask(LAMP, "onoff.turn_on"), ask(TV, "onoff.turn_off"), ask(LAMP, "level.set_level", { args: { level: 5 } }),
    ask("sim-bridge:ghost", "onoff.turn_on")]);
  for (const x of s) must(x.basis === "real" || x.basis === "emulated", `step ${x.step_id} (${x.target} ${x.action}) says real or emulated`, x);
});

requirement("GA-PLAN-4", {
  seam: "applier", fixture: { devices: ["lamp", "dimmer", "gate"] }, timeoutMs: 30_000,
  covers: "unsupported_action before not_adopted, on a kettle not adopted; not_adopted before invalid_args; invalid_args before dead; dead before tier; already before token; each checked on a step to which both apply. duplicate_route (the meta-applier's, under route first), tier before already, and toggle_only's place are graded by the reference applier's unit tests; power.wake's order is the PC build's",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  await mustPlan(ctx, ask(LAMP, "level.set_level", { args: { level: 400 } }), "skip(unsupported_action)", "an action the lamp lacks, with bad args");
  await bridge.control({ requestId: "plan-4-kettle", op: "join", device: "kettle", capabilities: ["onoff"], feedback: "closed" });
  await pollUntil(async () => ((await ctx.mcp!.callOk("describe")).devices as { id: string }[]).some((d) => d.id === KETTLE),
    oneSecond(ctx), `${KETTLE} in describe`);
  await mustPlan(ctx, ask(KETTLE, "level.set_level", { args: { level: 50 } }), "skip(unsupported_action)", "an action the kettle, not adopted, lacks");
  await mustPlan(ctx, ask(KETTLE, "onoff.turn_on", { args: { level: 50 } }), "refuse(not_adopted)", "the kettle, not adopted, with bad args");
  // The gate is closed (position 0): closing it again is already, before its confirm tier's token.
  await mustPlan(ctx, ask(GATE, "cover.close"), "skip(already)", "closing the closed gate without a token");
  await bridge.setAvailable("dimmer", false);
  await bridge.setAvailable("gate", false);
  await livenessWithin(ctx, DIMMER, "dead", oneSecond(ctx), "once its bridge says it is unavailable");
  await livenessWithin(ctx, GATE, "dead", oneSecond(ctx), "once its bridge says it is unavailable");
  await mustPlan(ctx, ask(DIMMER, "level.set_level", { args: { level: 400 } }), "refuse(invalid_args)", "a dead dimmer's level of 400");
  await mustPlan(ctx, ask(GATE, "cover.open", { via: "voice" }), "skip(dead)", "opening a dead gate by voice (no_voice)");
});

requirement("GA-PLAN-8", {
  seam: "applier", fixture: { devices: ["tv", "relay"] },
  covers: "on an open tv, a toggle without a token is refuse(toggle_only), with a person's token op, with a token for a rule or for a run with no person and no endpoint refuse(toggle_only), with one for a run started at an endpoint op; on a closed relay the toggle is planned from its observed state (op when off, already when on), with no toggle_only; both declare it idempotent: false",
}, async (ctx) => {
  const off = ask(TV, "onoff.turn_off");
  await mustPlan(ctx, off, "refuse(toggle_only)", "a toggle on the open tv without a token");
  await mustPlan(ctx, signed(ctx, off), "op", "a toggle on the open tv with a person's token");
  const byRule = ask(TV, "onoff.turn_off", { via: "rule", for: { rule: "evening" } });
  await mustPlan(ctx, signed(ctx, byRule), "refuse(toggle_only)", "a toggle on the open tv with a rule's token");
  const byRun = ask(TV, "onoff.turn_off", { via: "schedule", for: { run: "r-1" } });
  await mustPlan(ctx, signed(ctx, byRun), "refuse(toggle_only)", "a toggle on the open tv with the token of a run no person started");
  const byPanel = ask(TV, "onoff.turn_off", { via: "panel", for: { run: "r-1", endpoint: "hall-panel" } });
  await mustPlan(ctx, signed(ctx, byPanel), "op", "a toggle on the open tv with the token of a run started at an endpoint");
  await mustPlan(ctx, ask(RELAY, "onoff.turn_on"), "op", "turning on the closed relay, off, without a token");
  await mustPlan(ctx, ask(RELAY, "onoff.turn_off"), "skip(already)", "turning off the closed relay, off, without a token");
  const d = (await ctx.mcp!.callOk("describe")).devices as { id: string; actions: { action: string; idempotent: boolean }[] }[];
  for (const id of [TV, RELAY]) {
    for (const a of d.find((x) => x.id === id)?.actions ?? []) must(a.idempotent === false, `${id}'s ${a.action} is declared idempotent: false`, a);
  }
});

requirement("GA-TOKEN-1", {
  seam: "applier", fixture: { devices: ["gate"] },
  covers: "the gate's no_voice cover.open without a token is refuse(token) in a plan and refused(token) on apply, nothing sent; with a token the harness signed, op",
}, async (ctx) => {
  const open = ask(GATE, "cover.open");
  const [s] = await steps(ctx, [open]);
  mustEqual([s!.verdict, s!.reason, s!.tier], ["refuse", "token", "no_voice"], "the step to open the gate without a token");
  await mustPlan(ctx, signed(ctx, open), "op", "opening the gate with a token");
  const r = await ctx.mcp!.callOk("apply", { idempotency_key: `token-1-${ctx.runId}`, request: { actions: [open] } });
  mustEqual(r.outcomes.map((o: { outcome: string; reason?: string }) => `${o.outcome}(${o.reason})`), ["refused(token)"],
    "applying the gate's open without a token");
  await sleep(oneSecond(ctx));
  mustEqual(ctx.bridge!.received.filter((x) => x.device === "gate").length, 0, "commands the gate received");
});

requirement("GA-TOKEN-2", {
  seam: "applier", fixture: { devices: ["gate", "lamp"] },
  covers: "a token for another target, action, args, via, brain or for, expired past the 5 s skew, expiring more than 300 s ahead, issued by another client, proved with another key, or already used (dispatched by an earlier apply) is refuse(token), each beside a control token that stands",
}, async (ctx) => {
  const open = ask(GATE, "cover.open");
  await mustPlan(ctx, signed(ctx, open), "op", "a token that stands (the control)");
  const now = ctx.time.now();
  const bad: [string, Record<string, unknown>][] = [
    ["another target", { target: LAMP }], ["another action", { action: "cover.stop" }], ["other args", { args: { position: 1 } }],
    ["another via", { via: "panel" }], ["another brain", { brain: true }], ["another for", { for: { person: "guest" } }],
    ["expired 10 s ago", { expires: new Date(now - 10_000).toISOString() }],
    ["expiring 400 s ahead", { expires: new Date(now + 400_000).toISOString() }],
    ["issued by another client", { issuer: "another-steward" }],
  ];
  for (const [why, extra] of bad) await mustPlan(ctx, signed(ctx, open, extra), "refuse(token)", `a token ${why}`);
  const forged = { ...signed(ctx, open), token: { ...sign(ctx, open), proof: sign({ ...ctx, tokenKey: "another-key-of-the-harness" }, open).proof } };
  await mustPlan(ctx, forged, "refuse(token)", "a token proved with another key");
  const once = signed(ctx, open);
  const r = await ctx.mcp!.callOk("apply", { idempotency_key: `token-2-${ctx.runId}`, request: { actions: [once] } });
  mustEqual(r.outcomes.map((o: { outcome: string }) => o.outcome), ["dispatched"], "the gate's open with a token that stands");
  await mustPlan(ctx, once, "refuse(token)", "a token already used");
});

requirement("GA-TOKEN-3", {
  seam: "applier", fixture: { devices: ["gate"] },
  covers: "the gate's no_voice cover.open by voice, or through a brain, is refuse(tier) with a token that otherwise stands, and without one",
}, async (ctx) => {
  for (const extra of [{ via: "voice" }, { brain: true }]) {
    const a = ask(GATE, "cover.open", extra);
    await mustPlan(ctx, a, "refuse(tier)", `opening the gate with ${JSON.stringify(extra)} and no token`);
    await mustPlan(ctx, signed(ctx, a), "refuse(tier)", `opening the gate with ${JSON.stringify(extra)} and a token`);
  }
});
