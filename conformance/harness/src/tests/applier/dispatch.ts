import { randomUUID } from "node:crypto";
import { must, mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import { BridgeWatcher } from "../../seams/bridge-watcher.js";
import { pollUntil, sleep } from "../../util.js";
import { sign, type Asked } from "../token.js";
import { DIMMER, eventsOf, LAMP, livenessWithin, oneSecond, ownerConfigure, reviveWithin, TV, wire } from "../util.js";

const CHANNEL = "sim-bridge:channel";
const PAGER = "sim-bridge:pager";
const PULSE = "sim-bridge:pulse";
const AC = "sim-bridge:ac";
type Outcome = { step_id: string; target: string; outcome: string; reason?: string; detail?: string };

/** An action as the harness's steward asks for it. */
const ask = (target: string, action = "onoff.turn_on", args: Record<string, unknown> = {}, extra: Partial<Asked> = {}) =>
  ({ target, action, args, via: "app", brain: false, for: { person: "demo" }, ...extra });
const notify = (target: string, extra: Record<string, unknown> = {}) => ask(target, "notify.notify", { text: "dinner", urgency: "info", ...extra });

/** An outcome written short: `failed(no_ack)`, `dispatched`. */
const short = (o: Outcome | undefined) => (o ? `${o.outcome}${o.reason ? `(${o.reason})` : ""}` : "none");

/** `apply` of an inline request, with a fresh key. */
async function apply(ctx: TestContext, actions: unknown[]): Promise<{ apply_id: string; outcomes: Outcome[] }> {
  return ctx.mcp!.callOk("apply", { idempotency_key: randomUUID(), request: { actions } });
}

async function outcomes(ctx: TestContext, apply_id: string): Promise<Outcome[]> {
  return (await ctx.mcp!.callOk("outcome", { apply_id })).outcomes as Outcome[];
}

/** Waits up to `ms` for step `i` to read `want` (as `short` writes it); returns it. */
async function outcomeWithin(ctx: TestContext, apply_id: string, i: number, want: string, ms: number, why: string): Promise<Outcome> {
  return pollUntil(async () => {
    const o = (await outcomes(ctx, apply_id))[i];
    return short(o) === want ? o : undefined;
  }, ms, `${want} ${why}`, 50);
}

/** Fails unless step `i` still reads `want` after the broker's allowance and 1 s more. */
async function stillOutcome(ctx: TestContext, apply_id: string, i: number, want: string, why: string): Promise<void> {
  await sleep(oneSecond(ctx));
  mustEqual(short((await outcomes(ctx, apply_id))[i]), want, `the outcome ${why}`);
}

/** The action's `ack_within_s`, as the subject's `describe` gives it. */
async function ackWithinS(ctx: TestContext, target: string, action: string): Promise<number> {
  const d = ((await ctx.owner!.callOk("describe")).devices as { id: string; actions: { action: string; ack_within_s: number }[] }[])
    .find((x) => x.id === target);
  const s = d?.actions.find((a) => a.action === action)?.ack_within_s;
  must(typeof s === "number", `describe gives ${target}'s ${action} an ack_within_s`, d);
  return s!;
}

/** The commands the bridge has been delivered for `device` since `from`. */
const commandsTo = (ctx: TestContext, device: string, from = 0) => ctx.bridge!.commands.slice(from).filter((c) => c.device === device);

/** The bridge_fault events naming the simulated bridge, after `cursor`. */
async function bridgeFaults(ctx: TestContext, cursor: string): Promise<{ what: string }[]> {
  return (await eventsOf(ctx.mcp!, cursor, "bridge_fault")).filter((e) => e.bridge === "sim-bridge");
}

/** The owner raises `actions` of `target` to `confirm`, so a token is needed. */
async function confirmTier(ctx: TestContext, target: string, actions: string[]): Promise<void> {
  const r = await ownerConfigure(ctx.owner!, actions.map((action) => ({ op: "upsert", kind: "tier", value: { device: target, action, tier: "confirm" } })));
  must(r.ok, `raising ${target}'s tiers returned ${r.ok ? "" : r.error}`, r.body);
}

requirement("GA-APPLY-1", {
  seam: "applier", fixture: { devices: ["lamp"] }, timeoutMs: 60_000,
  covers: "apply of 20 live, adopted lamps on one bridge returns all 20 outcomes within 500 ms and the broker's allowance; the meta-applier's hops are slice 8's",
}, async (ctx) => {
  const { owner, bridge } = { owner: ctx.owner!, bridge: ctx.bridge! };
  const extra = Array.from({ length: 19 }, (_, i) => `lamp-${i + 1}`);
  for (const id of extra) await bridge.control({ requestId: `apply-1-${id}`, op: "join", device: id, capabilities: ["onoff"], feedback: "closed" });
  const targets = [LAMP, ...extra.map((id) => `sim-bridge:${id}`)];
  await pollUntil(async () => {
    const ids = new Set(((await owner.callOk("describe")).devices as { id: string }[]).map((d) => d.id));
    return targets.every((t) => ids.has(t));
  }, 10_000, "the 19 joined lamps in describe");
  const r = await ownerConfigure(owner, extra.map((id) => ({ op: "upsert", kind: "adopt", value: { device: `sim-bridge:${id}`, class: "light" } })));
  must(r.ok, `adopting the joined lamps returned ${r.ok ? "" : r.error}`, r.body);
  await reviveWithin(ctx, targets, 10_000, "before the apply");
  // No lamp answers its command: a bridge's ack landing while the 20 steps are still dispatched one by
  // one would rightly make an early step acked, so `dispatched` would depend on the machine's load.
  for (const id of ["lamp", ...extra]) await bridge.control({ requestId: `apply-1-quiet-${id}`, op: "commandResult", device: id, result: "none" });
  const t0 = Date.now();
  const out = await apply(ctx, targets.map((t) => ask(t)));
  const took = Date.now() - t0;
  ctx.evidence(`apply of ${targets.length} targets took ${took} ms`);
  mustEqual(out.outcomes.map(short), targets.map(() => "dispatched"), "the 20 synchronous outcomes");
  const bound = constantMs("applier", "apply-synchronous-bound") + ctx.allowanceMs;
  must(took <= bound, `apply of 20 targets took ${took} ms, past ${bound} ms`);
});

requirement("GA-APPLY-5", {
  seam: "applier", fixture: { devices: ["lamp", "dimmer"] },
  covers: "a lamp planned op, then dead, is unreachable when its plan is applied, and is sent no command; an inline request for the dead lamp sends nothing either, skipped(dead) or unreachable (the standard names skipped(dead) for a planned skip, and is silent on an inline request); after dispatch, the bridge's failed(unreachable) and failed(expired) are unreachable within 1 s. A computer's power.wake is the PC build's",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  const planned = (await ctx.mcp!.callOk("plan", { actions: [ask(LAMP)] })) as { plan_id: string; steps: { verdict: string }[] };
  mustEqual(planned.steps.map((x) => x.verdict), ["op"], "the plan for the live lamp");
  await bridge.setAvailable("lamp", false);
  await livenessWithin(ctx, LAMP, "dead", oneSecond(ctx), "once its bridge says it is unavailable");
  const mark = bridge.commands.length;
  const dead = (await ctx.mcp!.callOk("apply", { idempotency_key: randomUUID(), plan_id: planned.plan_id })) as { outcomes: Outcome[] };
  mustEqual(short(dead.outcomes[0]), "unreachable", "the dead lamp's outcome, its plan applied");
  const inline = await apply(ctx, [ask(LAMP)]);
  const said = short(inline.outcomes[0]);
  must(said === "skipped(dead)" || said === "unreachable", `an inline request for the dead lamp is ${said}, not skipped(dead) or unreachable`);
  await sleep(oneSecond(ctx));
  mustEqual(commandsTo(ctx, "lamp", mark).length, 0, "commands the dead lamp's bridge was sent");
  await bridge.setAvailable("lamp", true);
  await reviveWithin(ctx, [LAMP, DIMMER], 10_000, "after the lamp is available again");
  for (const [device, target, reason] of [["dimmer", DIMMER, "unreachable"], ["lamp", LAMP, "expired"]] as const) {
    await bridge.control({ requestId: `apply-5-${reason}`, op: "commandResult", device, result: reason, afterMs: 0 });
    const r = await apply(ctx, [ask(target)]);
    mustEqual(short(r.outcomes[0]), "dispatched", `the ${device}'s synchronous outcome`);
    await outcomeWithin(ctx, r.apply_id, 0, "unreachable", oneSecond(ctx), `after the bridge's failed(${reason})`);
  }
});

requirement("GA-APPLY-6", {
  seam: "applier", fixture: { devices: ["pulse"] }, timeoutMs: 60_000,
  covers: "the pulse relay's turn_on, declared not idempotent, reversible and no toggle, sent with no token, that nothing answers is actuated once through 5 s past its bound: no reissue on its ack timeout. Its outcome is GA-APPLY-8's. A safety rule's actuations are slice 6's",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  const bound = await ackWithinS(ctx, PULSE, "onoff.turn_on");
  await bridge.control({ requestId: "apply-6-none", op: "commandResult", device: "pulse", result: "none" });
  const mark = bridge.received.length;
  const r = await apply(ctx, [ask(PULSE)]);
  mustEqual(r.outcomes.map(short), ["dispatched"], "the synchronous outcome");
  await ctx.time.advance(bound * 1000 + 5000, { chunkMs: 5000 });
  await sleep(oneSecond(ctx));
  const actuations = bridge.received.slice(mark).filter((x) => x.device === "pulse");
  ctx.evidence(`the pulse relay received ${JSON.stringify(actuations)}`);
  mustEqual(actuations.length, 1, "physical actuations of the pulse relay");
});

requirement("GA-APPLY-7", {
  seam: "applier", fixture: { devices: ["channel", "pager"] },
  covers: "notify on a closed channel ends delivered on the bridge's applied, never acked; on a pager declaring it confirms: false, sent on its sent; a sent for the channel's notify, declared confirms: true, is a bridge_fault event and the step waits. An adapter's engine word and power.wake are the adapters' slice's and the PC build's",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  const r = await apply(ctx, [notify(CHANNEL), notify(PAGER)]);
  mustEqual(r.outcomes.map(short), ["dispatched", "dispatched"], "the synchronous outcomes");
  await outcomeWithin(ctx, r.apply_id, 0, "delivered", oneSecond(ctx), "for the channel's applied");
  await stillOutcome(ctx, r.apply_id, 0, "delivered", "of the channel's notify, after its delivered");
  await bridge.control({ requestId: "apply-7-pager", op: "commandResult", device: "pager", result: "sent", afterMs: 0 });
  const p = await apply(ctx, [notify(PAGER)]);
  await outcomeWithin(ctx, p.apply_id, 0, "sent", oneSecond(ctx), "for the pager's sent");
  const { cursor } = await ctx.mcp!.callOk("events");
  await bridge.control({ requestId: "apply-7-channel", op: "commandResult", device: "channel", result: "sent", afterMs: 0 });
  const c = await apply(ctx, [notify(CHANNEL)]);
  await pollUntil(async () => (await bridgeFaults(ctx, cursor)).length > 0, oneSecond(ctx), "a bridge_fault event for a sent the channel cannot give");
  ctx.evidence(`faults: ${JSON.stringify(await bridgeFaults(ctx, cursor))}`);
  await stillOutcome(ctx, c.apply_id, 0, "dispatched", "of the channel's notify after a sent it cannot give");
});

requirement("GA-APPLY-8", {
  seam: "applier", fixture: { devices: ["lamp", "dimmer"] }, timeoutMs: 60_000,
  covers: "a silent lamp's step is dispatched 1 s before its ack_within_s and failed(no_ack) within 1 s after it; a dimmer's step waiting on no ack is failed(no_ack) within 1 s of its bridge's death, not at its bound. An engine, a child and power.wake are slices 7 and 8's and the PC build's",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  const bound = await ackWithinS(ctx, LAMP, "onoff.turn_on");
  await bridge.control({ requestId: "apply-8-none", op: "commandResult", device: "lamp", result: "none" });
  const at = ctx.time.now();
  const r = await apply(ctx, [ask(LAMP)]);
  mustEqual(short(r.outcomes[0]), "dispatched", "the silent lamp's synchronous outcome");
  // The source's time also runs between its steps, so one step to 1 s before the bound, counted from the apply.
  await ctx.time.stepAndWait(at + bound * 1000 - 1000 - ctx.time.now());
  mustEqual(short((await outcomes(ctx, r.apply_id))[0]), "dispatched", `the silent lamp's outcome 1 s before its ack_within_s of ${bound} s`);
  await ctx.time.advance(1000);
  await outcomeWithin(ctx, r.apply_id, 0, "failed(no_ack)", oneSecond(ctx), "once its ack_within_s passed");

  await reviveWithin(ctx, [DIMMER], 10_000, "before the dimmer's step");
  await bridge.control({ requestId: "apply-8-dimmer", op: "commandResult", device: "dimmer", result: "none" });
  const d = await apply(ctx, [ask(DIMMER, "level.set_level", { level: 50 })]);
  mustEqual(short(d.outcomes[0]), "dispatched", "the dimmer's synchronous outcome");
  await sleep(500);
  bridge.kill();
  await outcomeWithin(ctx, d.apply_id, 0, "failed(no_ack)", oneSecond(ctx), "within 1 s of its bridge's death");
});

requirement("GA-APPLY-9", {
  seam: "applier", fixture: { devices: ["lamp", "dimmer", "gate", "tv"] }, timeoutMs: 30_000,
  covers: "apply of a plan judges again at dispatch: a lamp planned op and on since is skipped(already); one planned skip(already) and off since is dispatched; a dimmer planned op and dead since is unreachable; a toggle on the open tv whose person's token expired since is refused(toggle_only); the gate's open whose token expired is refused(token). not_adopted cannot change between a plan and its apply without a model change, which makes it stale_revision; a changed declaration, refused(declaration_changed), is graded under GA-DESC-18; safety and latched are slice 6's",
}, async (ctx) => {
  const { mcp, bridge } = { mcp: ctx.mcp!, bridge: ctx.bridge! };
  const report = async (device: string, values: Record<string, unknown>) =>
    bridge.control({ requestId: `apply-9-${device}-${randomUUID()}`, op: "report", device, values, observedAt: wire(ctx.time.now()) });
  const planned = async (actions: unknown[]) => (await mcp.callOk("plan", { actions })) as { plan_id: string; steps: { verdict: string; reason?: string }[] };
  const applyPlan = async (plan_id: string) => (await mcp.callOk("apply", { idempotency_key: randomUUID(), plan_id })).outcomes as Outcome[];

  const on = await planned([ask(LAMP)]);
  mustEqual(on.steps.map((s) => s.reason ?? s.verdict), ["op"], "the plan to turn on the lamp, off");
  await report("lamp", { on: true });
  await pollUntil(async () => (await planned([ask(LAMP)])).steps[0]?.reason === "already", oneSecond(ctx), "the lamp read on");
  mustEqual((await applyPlan(on.plan_id)).map(short), ["skipped(already)"], "applying it once the lamp is on");
  const already = await planned([ask(LAMP)]);
  await report("lamp", { on: false });
  await pollUntil(async () => (await planned([ask(LAMP)])).steps[0]?.verdict === "op", oneSecond(ctx), "the lamp read off");
  mustEqual((await applyPlan(already.plan_id)).map(short), ["dispatched"], "applying a plan made while on, once the lamp is off");

  const dim = await planned([ask(DIMMER)]);
  await bridge.setAvailable("dimmer", false);
  await livenessWithin(ctx, DIMMER, "dead", oneSecond(ctx), "once its bridge says it is unavailable");
  mustEqual((await applyPlan(dim.plan_id)).map(short), ["unreachable"], "applying a plan for the dimmer, dead since");

  const toggle = ask(TV, "onoff.turn_off");
  const open = ask("sim-bridge:gate", "cover.open");
  const soon = { expires: new Date(ctx.time.now() + 1000).toISOString() };
  const late = await planned([{ ...toggle, token: sign(ctx, toggle, soon) }, { ...open, token: sign(ctx, open, soon) }]);
  mustEqual(late.steps.map((s) => s.verdict), ["op", "op"], "the plan with tokens that still stand");
  await ctx.time.advance(constantMs("applier", "token-expiry-skew") + 2000);
  mustEqual((await applyPlan(late.plan_id)).map(short), ["refused(toggle_only)", "refused(token)"], "applying them once the tokens expired");
});

requirement("GA-APPLY-11", {
  seam: "applier", fixture: { devices: ["lamp"] },
  covers: "the lamp's turn_on that nothing answered ends failed(no_ack), and the lamp then reporting on is one late_ack event naming that apply, with its cause, the state event's cause the apply's, never external, and history keeps the late_ack and its cause; a report matching a turn_on its bridge acked failed(rejected) is external, and no late_ack; nor is a match 61 s after a failed(no_ack), the lamp held silent meanwhile. session.lock's clause is the PC build's",
  timeoutMs: 90_000,
}, async (ctx) => {
  const { mcp, bridge } = { mcp: ctx.mcp!, bridge: ctx.bridge! };
  const report = (on: boolean) =>
    bridge.control({ requestId: `apply-11-${randomUUID()}`, op: "report", device: "lamp", values: { on }, observedAt: wire(ctx.time.now()) });
  const bound = await ackWithinS(ctx, LAMP, "onoff.turn_on");
  const from = wire(ctx.time.now() - 1000);
  const { cursor } = await mcp.callOk("events");
  await bridge.control({ requestId: "apply-11-none", op: "commandResult", device: "lamp", result: "none" });
  const r = await apply(ctx, [ask(LAMP)]);
  // A subject may reissue the idempotent turn_on after its bound: that reissue is answered by nothing either.
  await bridge.control({ requestId: "apply-11-none-again", op: "commandResult", device: "lamp", result: "none" });
  await ctx.time.advance(bound * 1000, { chunkMs: 5000 });
  await outcomeWithin(ctx, r.apply_id, 0, "failed(no_ack)", oneSecond(ctx), `once its ack_within_s of ${bound} s passed`);
  await report(true);
  const late = await pollUntil(async () => {
    const l = (await eventsOf(mcp, cursor, "late_ack")).filter((e) => e.apply_id === r.apply_id);
    return l.length ? l : undefined;
  }, oneSecond(ctx), "a late_ack event for the lamp's turn_on");
  await sleep(oneSecond(ctx));
  const all = (await eventsOf(mcp, cursor, "late_ack")).filter((e) => e.apply_id === r.apply_id);
  const states = (await eventsOf(mcp, cursor, "state")).filter((e) => e.target === LAMP);
  ctx.evidence(`late_ack ${JSON.stringify(all)}; states ${JSON.stringify(states.map((e) => [e.key, e.value, e.cause]))}`);
  mustEqual(all.length, 1, "late_ack events for the turn_on");
  must(late[0].target === LAMP && late[0].cause?.apply === r.apply_id, "the late_ack names the lamp, and the apply as its cause", late[0]);
  mustEqual(states.map((e) => [e.key, e.value, e.cause?.apply === r.apply_id ? "apply" : e.cause]), [["on", true, "apply"]],
    "the lamp's state event and its cause");
  const history = await pollUntil(async () => {
    const h = ((await mcp.callOk("history", { from, to: wire(ctx.time.now() + 1000), targets: [LAMP] })).events as any[])
      .filter((e) => e.type === "late_ack" && e.apply_id === r.apply_id);
    return h.length ? h : undefined;
  }, oneSecond(ctx), "the late_ack in history");
  must(history[0].cause?.apply === r.apply_id, "history's late_ack carries the apply as its cause", history[0]);

  await report(false);
  await bridge.control({ requestId: "apply-11-rejected", op: "commandResult", device: "lamp", result: "rejected", afterMs: 0 });
  const { cursor: c2 } = await mcp.callOk("events");
  const f = await apply(ctx, [ask(LAMP)]);
  await outcomeWithin(ctx, f.apply_id, 0, "failed(rejected)", oneSecond(ctx), "for the bridge's failed(rejected)");
  await report(true);
  const after = await pollUntil(async () => {
    const s = (await eventsOf(mcp, c2, "state")).filter((e) => e.target === LAMP && e.value === true);
    return s.length ? s : undefined;
  }, oneSecond(ctx), "the lamp's state event after the rejected turn_on");
  mustEqual(after[0].cause, "external", "the cause of a match after the bridge's failed(rejected)");
  mustEqual((await eventsOf(mcp, c2, "late_ack")).length, 0, "late_ack events after the bridge's failed(rejected)");

  // 61 s after a failed(no_ack), a match is no late_ack: the lamp is held silent meanwhile, so neither
  // the command nor any reissue of it acts.
  await report(false);
  await bridge.control({ requestId: "apply-11-silent", op: "silence", device: "lamp", silent: true });
  const g = await apply(ctx, [ask(LAMP)]);
  await ctx.time.advance(bound * 1000, { chunkMs: 5000 });
  await outcomeWithin(ctx, g.apply_id, 0, "failed(no_ack)", oneSecond(ctx), `once its ack_within_s of ${bound} s passed, the lamp silent`);
  await ctx.time.advance(61_000, { chunkMs: 5000 });
  await bridge.control({ requestId: "apply-11-heard", op: "silence", device: "lamp", silent: false });
  const { cursor: c3 } = await mcp.callOk("events");
  await report(true);
  const past = await pollUntil(async () => {
    const s = (await eventsOf(mcp, c3, "state")).filter((e) => e.target === LAMP && e.key === "on" && e.value === true);
    return s.length ? s : undefined;
  }, oneSecond(ctx), "the lamp's state event 61 s after the failed(no_ack)");
  mustEqual(past[0].cause, "external", "the cause of a match 61 s after the failed(no_ack)");
  mustEqual((await eventsOf(mcp, c3, "late_ack")).length, 0, "late_ack events 61 s after the failed(no_ack)");
});

requirement("GA-APPLY-14", {
  seam: "applier", fixture: { devices: ["channel", "pager"] },
  covers: "a notify without from is accepted; with from, the channel, whose notify lists no from, gets none, and the pager, whose notify lists it, gets it. A meta-applier's child is slice 8's",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  const r = await apply(ctx, [notify(CHANNEL), notify(PAGER, { from: { notice: "n-1" } }), notify(CHANNEL, { from: { notice: "n-1" } })]);
  mustEqual(r.outcomes.map(short), ["dispatched", "dispatched", "dispatched"], "the synchronous outcomes");
  await pollUntil(async () => bridge.received.length >= 3, oneSecond(ctx), "the three notifications at the bridge");
  const args = bridge.received.map((x) => [x.device, x.args]);
  ctx.evidence(`received: ${JSON.stringify(args)}`);
  mustEqual(args, [["channel", { text: "dinner", urgency: "info" }], ["pager", { text: "dinner", urgency: "info", from: { notice: "n-1" } }],
    ["channel", { text: "dinner", urgency: "info" }]], "what each device was sent");
});

requirement("GA-APPLY-15", {
  seam: "applier", fixture: { devices: ["lamp", "channel"] },
  covers: "the detail of a failed(rejected) ack, and of an applied one, rides on the step's final outcome and its outcome event, which it does not change; a failed(no_ack) after a failed(no_confirmation) with a detail carries that detail, reached through the bridge's death (GA-APPLY-8's at once), so a subject that never ends a silent step at its bound is not graded here",
}, async (ctx) => {
  const { mcp, bridge } = { mcp: ctx.mcp!, bridge: ctx.bridge! };
  const { cursor } = await mcp.callOk("events");
  await bridge.control({ requestId: "apply-15-lamp", op: "commandResult", device: "lamp", result: "rejected", afterMs: 0, detail: "the bulb is busy" });
  await bridge.control({ requestId: "apply-15-channel", op: "commandResult", device: "channel", result: "confirmed", afterMs: 0, detail: "rang twice" });
  const r = await apply(ctx, [ask(LAMP), notify(CHANNEL)]);
  const lamp = await outcomeWithin(ctx, r.apply_id, 0, "failed(rejected)", oneSecond(ctx), "for the lamp's failed(rejected)");
  const channel = await outcomeWithin(ctx, r.apply_id, 1, "delivered", oneSecond(ctx), "for the channel's applied");
  mustEqual([lamp.detail, channel.detail], ["the bulb is busy", "rang twice"], "the outcomes' details");
  // The two steps' acks race to the applier, so their final outcome events come in either order: each is
  // matched by its target, every detail checked.
  const events = (await eventsOf(mcp, cursor, "outcome")).filter((e) => e.apply_id === r.apply_id && e.outcome !== "dispatched");
  const byTarget = (rows: unknown[][]) => [...rows].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  mustEqual(byTarget(events.map((e) => [e.target, e.outcome, e.detail])),
    byTarget([[LAMP, "failed", "the bulb is busy"], [CHANNEL, "delivered", "rang twice"]]), "the outcome events, by target");

  await bridge.control({ requestId: "apply-15-unconfirmed", op: "commandResult", device: "lamp", result: "no_confirmation", afterMs: 0,
    detail: "the bulb did not answer" });
  const u = await apply(ctx, [ask(LAMP)]);
  await pollUntil(async () => commandsTo(ctx, "lamp").length > 1, oneSecond(ctx), "the lamp's second command at the bridge");
  await stillOutcome(ctx, u.apply_id, 0, "dispatched", "after the bridge's failed(no_confirmation)");
  bridge.kill();
  const ended = await outcomeWithin(ctx, u.apply_id, 0, "failed(no_ack)", oneSecond(ctx), "within 1 s of its bridge's death");
  mustEqual(ended.detail, "the bulb did not answer", "the failed(no_ack)'s detail, from the failed(no_confirmation) before it");
});

requirement("GA-APPLY-16", {
  seam: "applier", fixture: { devices: ["ac"] }, timeoutMs: 40_000,
  covers: "on the IR air conditioner, declared whole_state: true, last sent mode off: a setpoint sent while a set_mode cool's ack is held back carries mode: cool; one sent after a set_mode heat that ended unreachable carries cool, the mode before it; a setpoint whose frame carried an in-flight mode fan and ended sent leaves fan assumed when that set_mode then ends failed, so the next frame carries fan; a set_mode cool whose ack comes after a later set_mode heat ended sent overlays it in no frame, neither in flight nor once it ends; and after a clean restart a setpoint carries the mode last sent, heat",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  const mode = (m: string) => ask(AC, "climate.set_mode", { mode: m });
  const setpoint = (c: number) => ask(AC, "climate.set_setpoint", { celsius: c });
  const result = (requestId: string, result: "confirmed" | "unreachable" | "rejected", afterMs = 0) =>
    bridge.control({ requestId, op: "commandResult", device: "ac", result, afterMs });
  /** Applies `a`, and gives the `state` of the command the air conditioner received for it. */
  const frame = async (a: unknown) => {
    const mark = bridge.received.length;
    const r = await apply(ctx, [a]);
    const got = await pollUntil(async () => bridge.received.slice(mark).find((x) => x.device === "ac"), oneSecond(ctx), "the air conditioner's command");
    ctx.evidence(`${JSON.stringify((a as { args: unknown }).args)}: state ${JSON.stringify(got.state)}`);
    return { r, state: got.state ?? {} };
  };
  /**
   * Applies `set_mode m`, and waits until the air conditioner has received it, found by its action and
   * mode, so the next `frame()`'s mark falls after it: `apply` answers before the bridge receives the
   * command, and one landing after the mark was read as the next frame (the 5b PR gate, under load).
   */
  const sendMode = async (m: string) => {
    const mark = bridge.received.length;
    const r = await apply(ctx, [mode(m)]);
    await pollUntil(async () => bridge.received.slice(mark).some((x) => x.device === "ac" && x.action === "climate.set_mode"
      && (x.args as { mode?: unknown } | undefined)?.mode === m) || undefined, oneSecond(ctx), `set_mode ${m} at the air conditioner`);
    return r;
  };

  const off = await apply(ctx, [mode("off")]);
  await outcomeWithin(ctx, off.apply_id, 0, "sent", oneSecond(ctx), "for set_mode off");
  await result("apply-16-slow", "confirmed", 2000);
  const cool = await sendMode("cool");
  const a = await frame(setpoint(22));
  mustEqual([a.state.mode, a.state.setpoint], ["cool", 22], "the mode and setpoint a setpoint sent while set_mode cool is in flight carries");
  await outcomeWithin(ctx, cool.apply_id, 0, "sent", 2000 + oneSecond(ctx), "for set_mode cool once its ack came");

  await result("apply-16-unreachable", "unreachable");
  const heat = await apply(ctx, [mode("heat")]);
  await outcomeWithin(ctx, heat.apply_id, 0, "unreachable", oneSecond(ctx), "for set_mode heat");
  const b = await frame(setpoint(23));
  mustEqual(b.state.mode, "cool", "the mode a setpoint carries after set_mode heat ended unreachable");
  await outcomeWithin(ctx, b.r.apply_id, 0, "sent", oneSecond(ctx), "for setpoint 23");

  await result("apply-16-rejected", "rejected", 2000);
  const fan = await sendMode("fan");
  const c = await frame(setpoint(24));
  mustEqual(c.state.mode, "fan", "the mode a setpoint carries while set_mode fan is in flight");
  await outcomeWithin(ctx, c.r.apply_id, 0, "sent", oneSecond(ctx), "for setpoint 24");
  await outcomeWithin(ctx, fan.apply_id, 0, "failed(rejected)", 2000 + oneSecond(ctx), "for set_mode fan");
  const d = await frame(setpoint(25));
  mustEqual(d.state.mode, "fan", "the mode the next frame carries, after a frame carrying fan ended sent and set_mode fan then failed");

  // Dispatch order, not the order outcomes end in: set_mode cool, its ack held back, then set_mode heat,
  // which ends sent; a setpoint carries heat, and still does once cool's late sent comes.
  await outcomeWithin(ctx, d.r.apply_id, 0, "sent", oneSecond(ctx), "for setpoint 25");
  await result("apply-16-held", "confirmed", 3000);
  const held = await sendMode("cool");
  const later = await apply(ctx, [mode("heat")]);
  await outcomeWithin(ctx, later.apply_id, 0, "sent", oneSecond(ctx), "for set_mode heat");
  const e = await frame(setpoint(26));
  mustEqual(e.state.mode, "heat", "the mode a setpoint carries while an earlier set_mode cool is in flight and a later set_mode heat ended sent");
  await outcomeWithin(ctx, held.apply_id, 0, "sent", 3000 + oneSecond(ctx), "for set_mode cool once its ack came");
  const f = await frame(setpoint(27));
  mustEqual(f.state.mode, "heat", "the mode the next frame carries once the earlier set_mode cool ended sent");

  // Across a restart (applier, *Restarts*: "across a restart too").
  await outcomeWithin(ctx, f.r.apply_id, 0, "sent", oneSecond(ctx), "for setpoint 27");
  await ctx.restartApplier!();
  const g = await frame(setpoint(28));
  mustEqual(g.state.mode, "heat", "the mode a setpoint carries after a restart, the last mode sent heat");
});

requirement("GA-PLAN-7", {
  seam: "applier", fixture: { devices: ["lamp", "dimmer", "channel"] },
  covers: "the steps of an apply reach the bridge in request order, the reverse of describe's. A meta-applier's children are slice 8's",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  const mark = bridge.commands.length;
  await apply(ctx, [notify(CHANNEL), ask(DIMMER, "level.set_level", { level: 30 }), ask(LAMP)]);
  await pollUntil(async () => bridge.commands.length - mark >= 3, oneSecond(ctx), "the three commands at the bridge");
  mustEqual(bridge.commands.slice(mark).map((c) => c.device), ["channel", "dimmer", "lamp"], "the order the commands arrived in");
});

requirement("GA-BUS-4", {
  seam: "applier", fixture: { devices: ["lamp", "channel"] }, timeoutMs: 60_000,
  covers: "after a received ack, the step stays dispatched, and its command is not sent again, until 1.5 s before its result_within_s; a channel's notify whose applied comes 500 ms after its result_within_s, as a bridge counting from receipt sends it, is taken: delivered. The outcome at the bound with no ack is GA-APPLY-8's",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  const bound = await ackWithinS(ctx, LAMP, "onoff.turn_on");
  await bridge.control({ requestId: "bus-4", op: "commandResult", device: "lamp", result: "received", afterMs: 0 });
  const mark = bridge.commands.length;
  const at = ctx.time.now();
  const r = await apply(ctx, [ask(LAMP)]);
  await stillOutcome(ctx, r.apply_id, 0, "dispatched", "after the bridge's received");
  // The source's time also runs between its steps, so one step to 1.5 s before the bound, counted from the apply.
  await ctx.time.stepAndWait(at + bound * 1000 - 1500 - ctx.time.now());
  mustEqual(short((await outcomes(ctx, r.apply_id))[0]), "dispatched", "the outcome 1.5 s before result_within_s");
  const sent = commandsTo(ctx, "lamp", mark);
  ctx.evidence(`deliveries: ${JSON.stringify(sent)}`);
  mustEqual(sent.length, 1, "deliveries of the lamp's command inside its result_within_s");

  const notifyBound = await ackWithinS(ctx, CHANNEL, "notify.notify");
  await bridge.control({ requestId: "bus-4-late", op: "commandResult", device: "channel", result: "confirmed", afterMs: notifyBound * 1000 + 500 });
  await reviveWithin(ctx, [CHANNEL], 10_000, "after the lamp's step");
  const heard = bridge.received.length;
  const late = await apply(ctx, [notify(CHANNEL)]);
  mustEqual(short(late.outcomes[0]), "dispatched", "the channel's synchronous outcome");
  // The simulated bridge times its delay on the harness's clock, as the subject times its bound: once
  // the bridge has timed its answer, step both to the bound, and the applied comes 500 ms later.
  await pollUntil(async () => {
    const r = bridge.received.slice(heard).find((x) => x.device === "channel");
    return r !== undefined && bridge.answerTimed.includes(r.commandId);
  }, oneSecond(ctx), "the channel's notify at the bridge, its answer timed");
  await ctx.time.stepAndWait(notifyBound * 1000);
  await outcomeWithin(ctx, late.apply_id, 0, "delivered", 500 + oneSecond(ctx), "for an applied 500 ms after its result_within_s");
});

requirement("GA-BUS-5", {
  seam: "applier", fixture: { devices: ["lamp"] },
  covers: "a command arrives unretained with a Message Expiry no longer than its result_within_s, and a snapshot request unretained with one no longer than 10 s; a client subscribing afterwards is given neither as retained",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  const bound = await ackWithinS(ctx, LAMP, "onoff.turn_on");
  const mark = bridge.commands.length;
  await apply(ctx, [ask(LAMP)]);
  const [cmd] = await pollUntil(async () => {
    const c = commandsTo(ctx, "lamp", mark);
    return c.length ? c : undefined;
  }, oneSecond(ctx), "the lamp's command at the bridge");
  ctx.evidence(`command: ${JSON.stringify(cmd)}`);
  must(!cmd!.retained, "the command arrived retained", cmd);
  must(cmd!.expiryS !== undefined && cmd!.expiryS > 0 && cmd!.expiryS <= bound, `the command's Message Expiry is ${cmd!.expiryS}, not within 1..${bound} s`, cmd);
  const requests = bridge.requests.length;
  await bridge.restart();
  const req = await pollUntil(async () => bridge.requests.slice(requests).find((x) => x.op === "snapshot"), 10_000, "a snapshot request after a new instance");
  ctx.evidence(`request: ${JSON.stringify({ ...req, body: undefined })}`);
  must(!req.retained, "the snapshot request arrived retained", req);
  must(req.expiryS !== undefined && req.expiryS > 0 && req.expiryS <= 10, `the snapshot request's Message Expiry is ${req.expiryS}, not within 1..10 s`, req);
  const fresh = await BridgeWatcher.start(ctx.link!.url, `${ctx.root}/bridges/sim-bridge/#`);
  try {
    await sleep(500 + ctx.allowanceMs);
    const kept = fresh.seen.filter((s) => s.retained && /\/(devices\/[^/]+\/command|request\/[^/]+)$/.test(s.topic));
    mustEqual(kept.map((s) => s.topic), [], "commands or requests a later subscriber was given retained");
  } finally {
    await fresh.close();
  }
});

requirement("GA-BUS-9", {
  seam: "applier", fixture: { devices: ["lamp", "gate"] }, timeoutMs: 40_000,
  covers: "with no subscriber for its commands (0x10), the gate's open is unreachable and its token unused, so the same token then dispatches it; a command whose PUBACK the lost connection took is dispatched, still dispatched once the connection is back (the loss is no bridge found dead: it waits for its bound), and is not sent again. 0x87 needs a broker with an ACL, which the harness's anonymous broker is not, and is graded by the reference applier's unit tests; the subscription clause is GA-BUS-7's run",
}, async (ctx) => {
  const { bridge, link } = { bridge: ctx.bridge!, link: ctx.link! };
  const open = ask("sim-bridge:gate", "cover.open");
  const withToken = { ...open, token: sign(ctx, open) };
  await bridge.control({ requestId: "bus-9-deaf", op: "commands", subscribed: false });
  const deaf = await apply(ctx, [withToken]);
  mustEqual(short(deaf.outcomes[0]), "unreachable", "the gate's open with no subscriber for its command");
  await bridge.control({ requestId: "bus-9-hear", op: "commands", subscribed: true });
  const heard = await apply(ctx, [withToken]);
  mustEqual(short(heard.outcomes[0]), "dispatched", "the gate's open with the same token, its bridge subscribed again");

  const mark = bridge.commands.length;
  link.stall();
  const pending = apply(ctx, [ask(LAMP)]);
  await sleep(500);
  link.sever();
  const lost = await pending;
  mustEqual(short(lost.outcomes[0]), "dispatched", "a step whose PUBACK the lost connection took");
  link.restore();
  await reviveWithin(ctx, [LAMP], 20_000, "once the broker is back");
  await sleep(oneSecond(ctx));
  mustEqual(commandsTo(ctx, "lamp", mark).length, 0, "deliveries of the lamp's command after the connection came back");
  mustEqual(short((await outcomes(ctx, lost.apply_id))[0]), "dispatched", "the step after the connection came back, inside its bound");
});

requirement("GA-BUS-13", {
  seam: "applier", fixture: { devices: ["lamp"] },
  covers: "an ack on the lamp's topic whose source is another bridge's id is a bridge_fault event, and the step does not end on it",
}, async (ctx) => {
  const { cursor } = await ctx.mcp!.callOk("events");
  await ctx.bridge!.control({ requestId: "bus-13", op: "commandResult", device: "lamp", result: "rejected", afterMs: 0, source: "another-bridge" });
  const r = await apply(ctx, [ask(LAMP)]);
  await pollUntil(async () => (await bridgeFaults(ctx, cursor)).length > 0, oneSecond(ctx), "a bridge_fault event for the foreign ack");
  await stillOutcome(ctx, r.apply_id, 0, "dispatched", "after an ack another bridge's id sent");
});

requirement("GA-TOKEN-4", {
  seam: "applier", fixture: { devices: ["lamp", "dimmer"] }, timeoutMs: 90_000,
  covers: "a token whose step the bridge acks failed(unreachable) after dispatch stays used: the same token is then refused(token); one whose target was dead at dispatch stays unused, and dispatches later; two applies with one token at once dispatch it once; a token used before a clean restart is refused(token) after it; across a stalled store, a crash and a restart one token actuates the lamp at most once (a database: true subject only)",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  await confirmTier(ctx, LAMP, ["onoff.turn_on"]);
  await confirmTier(ctx, DIMMER, ["onoff.turn_on"]);
  const lampOn = ask(LAMP);
  const t1 = { ...lampOn, token: sign(ctx, lampOn) };
  await bridge.control({ requestId: "token-4-unreachable", op: "commandResult", device: "lamp", result: "unreachable", afterMs: 0 });
  const r = await apply(ctx, [t1]);
  await outcomeWithin(ctx, r.apply_id, 0, "unreachable", oneSecond(ctx), "after the bridge's failed(unreachable)");
  mustEqual((await apply(ctx, [t1])).outcomes.map(short), ["refused(token)"], "the same token again, after a late unreachable");

  const dimOn = ask(DIMMER);
  const t2 = { ...dimOn, token: sign(ctx, dimOn) };
  await bridge.setAvailable("dimmer", false);
  await livenessWithin(ctx, DIMMER, "dead", oneSecond(ctx), "once its bridge says it is unavailable");
  const deadStep = short((await apply(ctx, [t2])).outcomes[0]);
  must(deadStep === "skipped(dead)" || deadStep === "unreachable", `the dimmer's step, dead at dispatch, is ${deadStep}, not skipped(dead) or unreachable`);
  await bridge.setAvailable("dimmer", true);
  await reviveWithin(ctx, [DIMMER], 10_000, "once it is available again");
  mustEqual((await apply(ctx, [t2])).outcomes.map(short), ["dispatched"], "the same token, its target live again");

  const t3 = { ...lampOn, token: sign(ctx, lampOn) };
  const mark = bridge.commands.length;
  const both = await Promise.all([apply(ctx, [t3]), apply(ctx, [t3])]);
  mustEqual(both.map((x) => short(x.outcomes[0])).sort(), ["dispatched", "refused(token)"], "two applies of one token at once");
  await sleep(oneSecond(ctx));
  mustEqual(commandsTo(ctx, "lamp", mark).length, 1, "commands the lamp was sent for them");

  // Used token ids across a clean restart (applier, *Restarts*). The lamp reports off first, so its turn_on is
  // no skip(already), which the reason order puts before the token.
  await bridge.control({ requestId: "token-4-off", op: "report", device: "lamp", values: { on: false }, observedAt: wire(ctx.time.now()) });
  await pollUntil(async () => (await ctx.mcp!.callOk("plan", { actions: [lampOn] })).steps[0].verdict !== "skip", oneSecond(ctx),
    "the lamp's turn_on no longer skipped once it reports off");
  await ctx.restartApplier!();
  mustEqual((await apply(ctx, [t3])).outcomes.map(short), ["refused(token)"], "the token used before the restart, applied after it");

  // At most once across a stalled store, a crash and a restart: physical actuations, whatever the apply in the stall answered.
  if (!ctx.stallStore) {
    ctx.evidence("no database: the stalled-store clause is not graded");
    return;
  }
  const t4 = { ...lampOn, token: sign(ctx, lampOn) };
  // The lamp answers nothing and stays off: a second command after the restart is no skip(already).
  await bridge.control({ requestId: "token-4-none", op: "commandResult", device: "lamp", result: "none" });
  const from = bridge.commands.length;
  const fromRan = bridge.received.length;
  const release = await ctx.stallStore();
  const inStall = apply(ctx, [t4]).then((x) => short(x.outcomes[0]), (err: unknown) => `no answer (${String(err).slice(0, 80)})`);
  await sleep(2 * oneSecond(ctx));
  await ctx.restartApplier!({ crash: true, between: release });
  const afterIt = await apply(ctx, [t4]).then((x) => short(x.outcomes[0]), (err: unknown) => `no answer (${String(err).slice(0, 80)})`);
  await sleep(oneSecond(ctx));
  // Actuations, as the bridge counts them: a command delivered again under its commandId is dropped by the
  // bridge (GA-BRIDGE-4), and is GA-BUS-4's to grade, not a second use of the token.
  const ids = commandsTo(ctx, "lamp", from).map((c) => c.commandId);
  const ran = bridge.received.slice(fromRan).filter((x) => x.device === "lamp").length;
  ctx.evidence(`in the stall: ${await inStall}; after the restart: ${afterIt}; commands to the lamp: ${ids.length}, `
    + `commandIds ${JSON.stringify(ids)}; actuations of the lamp: ${ran}`);
  must(ran <= 1, `one token actuated the lamp ${ran} times across a stalled store, a crash and a restart`);
});

requirement("GA-EVT-1", {
  seam: "applier", fixture: { devices: ["dimmer"] },
  covers: "while a set_level of 80 waits, the dimmer's report of level 40 and on: true (its side effect) carry the apply's cause, one of 20 (moving away) is external, the matching 80 the apply's; a later 50, after the match, is external. session.lock is the PC build's",
}, async (ctx) => {
  const { mcp, bridge } = { mcp: ctx.mcp!, bridge: ctx.bridge! };
  const report = (values: Record<string, unknown>) =>
    bridge.control({ requestId: `evt-1-${randomUUID()}`, op: "report", device: "dimmer", values, observedAt: wire(ctx.time.now()) });
  await bridge.control({ requestId: "evt-1-none", op: "commandResult", device: "dimmer", result: "none" });
  const { cursor } = await mcp.callOk("events");
  const r = await apply(ctx, [ask(DIMMER, "level.set_level", { level: 80 })]);
  for (const values of [{ on: true, level: 40 }, { level: 20 }, { level: 80 }, { level: 50 }]) await report(values);
  const states = await pollUntil(async () => {
    const s = (await eventsOf(mcp, cursor, "state")).filter((e) => e.target === DIMMER);
    return s.length >= 5 ? s : undefined;
  }, oneSecond(ctx), "five state events of the dimmer");
  const causes = states.map((e) => [e.key, e.value, typeof e.cause === "object" ? e.cause.apply === r.apply_id ? "apply" : JSON.stringify(e.cause) : e.cause]);
  ctx.evidence(`causes: ${JSON.stringify(causes)}`);
  mustEqual(causes, [["on", true, "apply"], ["level", 40, "apply"], ["level", 20, "external"], ["level", 80, "apply"], ["level", 50, "external"]],
    "each state event's cause");
});

requirement("GA-EVT-6", {
  seam: "applier", fixture: { devices: ["dimmer"] },
  covers: "with level and on declared self_changing, a set_level of 60's report of level 30 carries the apply's cause, its side effect on: true is device, and level 10 after the step's bound device",
}, async (ctx) => {
  const { mcp, owner, bridge } = { mcp: ctx.mcp!, owner: ctx.owner!, bridge: ctx.bridge! };
  const r0 = await ownerConfigure(owner, ["level", "on"].map((key) => ({ op: "upsert", kind: "self_changing", value: { device: DIMMER, key } })));
  must(r0.ok, `declaring the dimmer's keys self_changing returned ${r0.ok ? "" : r0.error}`, r0.body);
  const report = (values: Record<string, unknown>) =>
    bridge.control({ requestId: `evt-6-${randomUUID()}`, op: "report", device: "dimmer", values, observedAt: wire(ctx.time.now()) });
  const bound = await ackWithinS(ctx, DIMMER, "level.set_level");
  await bridge.control({ requestId: "evt-6-none", op: "commandResult", device: "dimmer", result: "none" });
  const { cursor } = await mcp.callOk("events");
  const r = await apply(ctx, [ask(DIMMER, "level.set_level", { level: 60 })]);
  // A subject may reissue the idempotent set_level after its bound: that reissue is answered by nothing either.
  await bridge.control({ requestId: "evt-6-none-again", op: "commandResult", device: "dimmer", result: "none" });
  await report({ on: true, level: 30 });
  await ctx.time.advance(bound * 1000 + 1000, { chunkMs: 5000 });
  await report({ level: 10 });
  const states = await pollUntil(async () => {
    const s = (await eventsOf(mcp, cursor, "state")).filter((e) => e.target === DIMMER);
    return s.length >= 3 ? s : undefined;
  }, oneSecond(ctx), "three state events of the dimmer");
  const causes = states.map((e) => [e.key, e.value, typeof e.cause === "object" ? e.cause.apply === r.apply_id ? "apply" : JSON.stringify(e.cause) : e.cause]);
  ctx.evidence(`causes: ${JSON.stringify(causes)}`);
  mustEqual(causes, [["on", true, "device"], ["level", 30, "apply"], ["level", 10, "device"]], "each state event's cause");
});
