import { randomUUID } from "node:crypto";
import { must, mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { requirement } from "../../registry.js";
import { pollUntil, sleep } from "../../util.js";
import { eventsOf, lastDevices, livenessWithin, oneSecond, ownerConfigure, stillReads, wire } from "../util.js";

// Applier 0.14: extensions on any device, occurrences, and declarations that change.

const PUSHER = "sim-bridge:pusher";
const SHAKER = "sim-bridge:shaker";
const PUSH = "org.galatea.test.pusher";
const V = "org.galatea.test.vibration";
type Outcome = { outcome: string; reason?: string };
type Action = { action: string; tier: string; idempotent: boolean; ack_within_s: number };

const ask = (target: string, action = "onoff.turn_on", args: Record<string, unknown> = {}) =>
  ({ target, action, args, via: "app", brain: false, for: { person: "demo" } });
const short = (o: Outcome | undefined) => (o ? `${o.outcome}${o.reason ? `(${o.reason})` : ""}` : "none");
const up = (kind: string, value: Record<string, unknown>) => ({ op: "upsert", kind, value });

/** `device`'s `action` as the owner's `describe` gives it. */
async function declared(ctx: TestContext, device: string, action: string): Promise<Action | undefined> {
  const d = ((await ctx.owner!.callOk("describe")).devices as { id: string; actions: Action[] }[]).find((x) => x.id === device);
  return d?.actions.find((a) => a.action === action);
}

/** The pusher's mode, reported by the simulated bridge: `click` makes its onoff a press, never idempotent. */
async function mode(ctx: TestContext, to: "click" | "switch"): Promise<void> {
  await ctx.bridge!.control({ requestId: `mode-${randomUUID()}`, op: "report", device: "pusher", values: { [`${PUSH}.mode`]: to },
    observedAt: wire(ctx.time.now()) });
  await pollUntil(async () => (await declared(ctx, PUSHER, "onoff.turn_on"))?.idempotent === (to === "switch"), oneSecond(ctx),
    `the pusher's turn_on described ${to === "switch" ? "idempotent" : "not idempotent"} in ${to} mode`);
}

requirement("GA-DESC-14", {
  seam: "applier", fixture: { devices: ["lamp"] },
  covers: "a door lock's extension action set to confirm, below its floor of no_voice, is invalid_request, nothing changed and not clamped; a plugin's requested_tier is the PC build's",
}, async (ctx) => {
  const { owner, bridge } = { owner: ctx.owner!, bridge: ctx.bridge! };
  const X = "org.galatea.test.lockx";
  const doc = lastDevices(bridge);
  await bridge.publishRaw("devices", { ...doc, devices: [...doc.devices, { id: "door", stableIdentifier: "test:door", transport: "test",
    model: { vendor: "demo", model: "door" }, capabilities: ["lock"], sensorKeys: [], feedback: "closed", reachMs: 1000, proposedClass: "door_lock",
    actions: [{ action: "lock.lock", idempotent: true, stateless: false, confirms: true },
      { action: `${X}.chime`, idempotent: false, stateless: true, confirms: true }],
    extensions: [{ capability: X, actions: [{ action: `${X}.chime`, schema: { type: "object" } }], keys: [] }] }] }, true);
  await pollUntil(async () => (await declared(ctx, "sim-bridge:door", `${X}.chime`)) !== undefined, oneSecond(ctx), "the door in describe");
  const adopted = await ownerConfigure(owner, [up("adopt", { device: "sim-bridge:door", class: "door_lock" })]);
  must(adopted.ok, `adopting the door returned ${adopted.ok ? "" : adopted.error}`, adopted.body);
  mustEqual((await declared(ctx, "sim-bridge:door", `${X}.chime`))?.tier, "no_voice", "the door lock's extension action, at its floor");
  const before = (await owner.callOk("describe")).revision;
  const r = await ownerConfigure(owner, [up("tier", { device: "sim-bridge:door", action: `${X}.chime`, tier: "confirm" })]);
  ctx.evidence(`configure returned ${r.ok ? "ok" : r.error}`);
  must(!r.ok && r.error === "invalid_request", `a door lock's extension action set to confirm returned ${r.ok ? "a result" : r.error}, not invalid_request`, r.body);
  mustEqual((await owner.callOk("describe")).revision, before, "the revision after the refusal");
  mustEqual((await declared(ctx, "sim-bridge:door", `${X}.chime`))?.tier, "no_voice", "the extension action's tier after the refusal");
});

requirement("GA-EVT-8", {
  seam: "applier", fixture: { devices: ["shaker", "lamp"] }, timeoutMs: 60_000,
  covers: "a vibration sensor's alarm, an event key, is one occurrence event with its target, key, value, basis_time and cause device; state never returns it; it moves no liveness or freshness: one on a stale sensor, its check-in unmoved, leaves it stale. On a subject claiming Safe, configure refuses a safety rule reading the alarm with invalid_request, and takes the same rule reading the sensor's sensitivity, a state key. That the check-in carrying it moves last_check_in is the bridge's (GA-BRIDGE-75)",
}, async (ctx) => {
  const { mcp, bridge } = { mcp: ctx.mcp!, bridge: ctx.bridge! };
  if (ctx.claims.includes("Safe")) {
    const rule = (key: string, value: unknown) => [{ op: "upsert", kind: "safety_rule", value: { id: "evt-8", trigger: { device: SHAKER, key, op: "eq", value },
      actions: [{ target: "sim-bridge:lamp", action: "onoff.turn_off" }] } }];
    const alarm = await ownerConfigure(ctx.owner!, rule(`${V}.alarm`, true));
    must(!alarm.ok && alarm.error === "invalid_request", `a safety rule reading the alarm returned ${alarm.ok ? "a result" : alarm.error}`, alarm.body);
    const control = await ownerConfigure(ctx.owner!, rule(`${V}.sensitivity`, "high"));
    must(control.ok, `the same rule reading the sensitivity returned ${control.ok ? "" : control.error}`, control.body);
  }
  const { cursor } = await mcp.callOk("events");
  const at = wire(ctx.time.now());
  await bridge.control({ requestId: "evt-8", op: "report", device: "shaker", values: { [`${V}.alarm`]: true }, observedAt: at });
  const seen = await pollUntil(async () => {
    const e = await eventsOf(mcp, cursor, "occurrence");
    return e.length ? e : undefined;
  }, oneSecond(ctx), "an occurrence event");
  await sleep(500);
  const all = await eventsOf(mcp, cursor);
  ctx.evidence(`events: ${JSON.stringify(all)}`);
  mustEqual(all.filter((e) => e.type === "occurrence").map((e) => ({ target: e.target, key: e.key, value: e.value, basis_time: e.basis_time, cause: e.cause })),
    [{ target: SHAKER, key: `${V}.alarm`, value: true, basis_time: at, cause: "device" }], "the occurrence events");
  must(seen.length === 1, "one occurrence event", seen);
  must(!all.some((e) => e.type === "liveness" || e.type === "freshness" || (e.type === "state" && e.key === `${V}.alarm`)),
    "the occurrence moved no liveness or freshness and made no state event", all);
  const state = await mcp.callOk("state", { targets: [SHAKER] });
  const keys = (state.targets[SHAKER]?.values ?? []).map((v: { key: string }) => v.key);
  must(!keys.includes(`${V}.alarm`), `state returns the alarm: ${JSON.stringify(keys)}`, state);

  // On a stale sensor, an occurrence whose check-in its bridge does not move leaves it stale.
  await bridge.control({ requestId: "evt-8-silence", op: "silence", device: "shaker", silent: true });
  await bridge.publishStatus();
  await ctx.time.advance(80_000, { chunkMs: 5000 });
  await livenessWithin(ctx, SHAKER, "stale", oneSecond(ctx), "silent 80 s");
  const later = (await mcp.callOk("events")).cursor;
  await bridge.publishEvent("occurrence", { device: "shaker", key: `${V}.alarm`, value: true, timestamp: wire(ctx.time.now()) });
  await pollUntil(async () => ((await eventsOf(mcp, later, "occurrence")).length ? true : undefined), oneSecond(ctx), "the second occurrence");
  await stillReads(ctx, SHAKER, "stale", "after an occurrence that moved no check-in");
  const moved = (await eventsOf(mcp, later)).filter((e) => e.type === "liveness" || e.type === "freshness");
  must(!moved.length, "the occurrence on the stale sensor moved no liveness or freshness", moved);
});

requirement("GA-DESC-18", {
  seam: "applier", fixture: { devices: ["lamp", "dimmer", "pusher"] }, timeoutMs: 90_000,
  covers: "the pusher's mode turning its onoff into a press is a model change naming it, a plan made before is stale_revision; a step not yet dispatched when it changed is refused(declaration_changed), the pusher already on, while the dimmer's unchanged step goes; a dispatched turn_on, not idempotent then, is never reissued once it is again; a tier the owner lowered on its extension action falls back to the table when that action's declarations change, and stays so when they return, until the owner sets it again. The owner's idempotent: true is not offered by this build",
}, async (ctx) => {
  const { mcp, owner, bridge, link } = { mcp: ctx.mcp!, owner: ctx.owner!, bridge: ctx.bridge!, link: ctx.link! };

  // A plan made before the change.
  const plan = await mcp.callOk("plan", { actions: [ask(PUSHER)] });
  const { cursor } = await mcp.callOk("events");
  await mode(ctx, "click");
  const r = await mcp.call("apply", { idempotency_key: randomUUID(), plan_id: plan.plan_id });
  ctx.evidence(`a plan of revision ${plan.revision} applied after the change: ${r.ok ? "applied" : r.error}`);
  must(!r.ok && r.error === "stale_revision", `a plan made before the pusher's declarations changed returned ${r.ok ? "a result" : r.error}, not stale_revision`, r.body);
  const models = await eventsOf(mcp, cursor, "model");
  must(models.some((e) => e.device === PUSHER), "a model event names the pusher", models);

  // A step not yet dispatched when its action's declarations change: the pusher already on, so a
  // subject judging already before the change would call a press never made a success; the dimmer's
  // step, its action unchanged, still goes.
  await mode(ctx, "switch");
  await bridge.control({ requestId: "desc-18-on", op: "report", device: "pusher", values: { on: true }, observedAt: wire(ctx.time.now()) });
  await pollUntil(async () => (((await mcp.callOk("state", { targets: [PUSHER] })).targets[PUSHER]?.values ?? []) as { key: string; value: unknown }[])
    .some((v) => v.key === "on" && v.value === true) || undefined, oneSecond(ctx), "the pusher on");
  link.holdOutbound();
  let pending: Promise<{ ok: boolean; body: any; error?: string }>;
  try {
    pending = mcp.call("apply", { idempotency_key: randomUUID(), request: { actions: [ask("sim-bridge:lamp"), ask(PUSHER), ask("sim-bridge:dimmer")] } }) as never;
    await sleep(300);
    await mode(ctx, "click");
  } finally {
    link.restore();
  }
  const held = await pending!;
  must(held.ok, `the apply returned ${held.error}`, held.body);
  ctx.evidence(`outcomes: ${JSON.stringify(held.body.outcomes)}`);
  mustEqual((held.body.outcomes as Outcome[]).map(short), ["dispatched", "refused(declaration_changed)", "dispatched"],
    "the lamp's step, the pusher's, whose turn_on became a press before its dispatch, and the dimmer's");

  // A dispatched action, not idempotent when it went, is not reissued once it is again.
  await bridge.control({ requestId: "desc-18-off", op: "report", device: "pusher", values: { on: false }, observedAt: wire(ctx.time.now()) });
  await pollUntil(async () => (((await mcp.callOk("state", { targets: [PUSHER] })).targets[PUSHER]?.values ?? []) as { key: string; value: unknown }[])
    .some((v) => v.key === "on" && v.value === false) || undefined, oneSecond(ctx), "the pusher off");
  await bridge.control({ requestId: "desc-18-none", op: "commandResult", device: "pusher", result: "none" });
  const bound = (await declared(ctx, PUSHER, "onoff.turn_on"))!.ack_within_s;
  const mark = bridge.received.length;
  const sent = await mcp.callOk("apply", { idempotency_key: randomUUID(), request: { actions: [ask(PUSHER)] } });
  mustEqual((sent.outcomes as Outcome[]).map(short), ["dispatched"], "the press's synchronous outcome");
  await mode(ctx, "switch");
  await ctx.time.advance(bound * 1000 + 5000, { chunkMs: 5000 });
  await sleep(oneSecond(ctx));
  const presses = bridge.received.slice(mark).filter((x) => x.device === "pusher" && x.action === "onoff.turn_on");
  ctx.evidence(`the pusher received ${JSON.stringify(presses)}`);
  mustEqual(presses.length, 1, "turn_ons the pusher received, sent as a press");

  // A tier the owner lowered falls back when its action's declarations change, until the owner sets it again.
  const lower = async () => {
    const x = await ownerConfigure(owner, [up("tier", { device: PUSHER, action: `${PUSH}.set_mode`, tier: "reversible" })]);
    must(x.ok, `lowering set_mode to reversible returned ${x.ok ? "" : x.error}`, x.body);
  };
  await lower();
  mustEqual((await declared(ctx, PUSHER, `${PUSH}.set_mode`))?.tier, "reversible", "set_mode once the owner lowered it");
  const doc = lastDevices(bridge);
  await bridge.publishRaw("devices", { ...doc, devices: doc.devices.map((d: any) => d.id !== "pusher" ? d : { ...d,
    extensions: d.extensions.map((e: any) => ({ ...e, actions: e.actions.map((a: any) => ({ ...a,
      schema: { type: "object", properties: { mode: { enum: ["switch", "click", "hold"] } }, required: ["mode"] } })) })) }) }, true);
  await pollUntil(async () => (await declared(ctx, PUSHER, `${PUSH}.set_mode`))?.tier === "confirm", oneSecond(ctx),
    "set_mode back at confirm once its declarations changed");
  // The bridge returns to the declaration the owner judged: the tier stays fallen back.
  const back = (await mcp.callOk("events")).cursor;
  await bridge.publishRaw("devices", doc, true);
  await pollUntil(async () => ((await eventsOf(mcp, back, "model")).some((e) => e.device === PUSHER) ? true : undefined), oneSecond(ctx),
    "a model event naming the pusher once its declaration returned");
  mustEqual((await declared(ctx, PUSHER, `${PUSH}.set_mode`))?.tier, "confirm", "set_mode once its declaration returned to the one the owner lowered it on");
  await lower();
  mustEqual((await declared(ctx, PUSHER, `${PUSH}.set_mode`))?.tier, "reversible", "set_mode once the owner lowered it again");
});
