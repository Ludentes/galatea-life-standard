import { must, mustEqual } from "../../assert.js";
import { requirement } from "../../registry.js";
import { pollUntil } from "../../util.js";
import { sign } from "../token.js";
import {
  DIMMER, eventsOf, GATE, LAMP, lastDevices, lastStatus, livenessWithin, oneSecond, ownerConfigure, stillReads, TV, wire,
} from "../util.js";

const UNBOUND = "sim-bridge:unbound";
const AC = "sim-bridge:ac";
const HEATER = "sim-bridge:heater";

requirement("GA-STATE-1", {
  seam: "applier", fixture: { devices: ["dimmer"] },
  covers: "a value's basis_time is its observation's time, 5 s before the report, and per key when the keys were observed apart",
}, async (ctx) => {
  const { mcp, bridge } = { mcp: ctx.mcp!, bridge: ctx.bridge! };
  const levelAt = wire(ctx.time.now() - 9000);
  const onAt = wire(ctx.time.now() - 5000);
  await bridge.control({ requestId: "state-1a", op: "report", device: "dimmer", values: { level: 40 }, observedAt: levelAt });
  await bridge.control({ requestId: "state-1b", op: "report", device: "dimmer", values: { on: true }, observedAt: onAt });
  await stillReads(ctx, DIMMER, "live", "after two reports");
  const values = (await mcp.callOk("state", { targets: [DIMMER] })).targets[DIMMER].values as { key: string; value: unknown; basis_time: string }[];
  const at = (key: string) => values.find((v) => v.key === key);
  ctx.evidence(JSON.stringify(values));
  mustEqual([at("level")?.value, Date.parse(at("level")!.basis_time)], [40, Date.parse(levelAt)], "level and its basis_time");
  mustEqual([at("on")?.value, Date.parse(at("on")!.basis_time)], [true, Date.parse(onAt)], "on and its basis_time");
});

requirement("GA-STATE-2", {
  seam: "applier", fixture: { devices: ["lamp", "dimmer", "gate", "heater", "tv"] }, timeoutMs: 60_000,
  covers: "dead within 1 s of each alone: available: false; its retained status cleared; its leaving the devices document (its status and roster entry kept); its leaving the roster (its status and devices entry kept); its transport down; its bridge 30 s without a status. The will, a graceful offline and the broker's loss are graded under GA-BUS-8 and GA-BUS-7",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  const within = oneSecond(ctx);
  await bridge.setAvailable("lamp", false);
  await livenessWithin(ctx, LAMP, "dead", within, "after available: false");
  await bridge.setAvailable("lamp", true);
  await livenessWithin(ctx, LAMP, "live", within, "after available: true again");

  await bridge.publishRaw("devices/dimmer/status", "", true);
  await livenessWithin(ctx, DIMMER, "dead", within, "after its retained status was cleared");

  // Each trigger alone: the gate leaves the devices document only, the heater the roster only.
  const doc = lastDevices(bridge);
  await bridge.publishRaw("devices", { ...doc, devices: doc.devices.filter((d) => d.id !== "gate") }, true);
  await livenessWithin(ctx, GATE, "dead", within, "after leaving the devices document");

  // The periodic status would list the heater again; the test sends the statuses from here on.
  bridge.setQuiet(true);
  await bridge.publishStatus();
  const roster = lastStatus(bridge).devices.filter((e: { id: string }) => e.id !== "heater");
  await bridge.publishStatus({ devices: roster });
  await livenessWithin(ctx, HEATER, "dead", within, "after leaving the roster");

  await bridge.control({ requestId: "state-2a", op: "transportState", state: "down" });
  for (const d of [LAMP, TV]) await livenessWithin(ctx, d, "dead", within, "with its transport down");
  await bridge.control({ requestId: "state-2b", op: "transportState", state: "up" });
  for (const d of [LAMP, TV]) await livenessWithin(ctx, d, "live", within, "with its transport up again");

  // A clean disconnect publishes no will: the bridge just goes silent.
  await bridge.stop({ graceful: false });
  await ctx.time.advance(31_000, { chunkMs: 5000 });
  for (const d of [LAMP, TV]) await livenessWithin(ctx, d, "dead", within, "31 s after its bridge's last status");
});

requirement("GA-STATE-5", {
  seam: "applier", fixture: { devices: ["lamp", "unbound"] }, timeoutMs: 60_000,
  covers: "a closed device whose bound is not known reads stale; one silent past fresh_s (60 s) plus 11 s reads stale within 1 s, and live before fresh_s. The adapter clauses are not this build's",
}, async (ctx) => {
  const { mcp, bridge } = { mcp: ctx.mcp!, bridge: ctx.bridge! };
  await stillReads(ctx, UNBOUND, "stale", "with no known fresh_s");
  await bridge.control({ requestId: "state-5", op: "silence", device: "lamp", silent: true });
  // A heartbeat may have landed after the last status: publish the silenced lamp's last check-in, and
  // wait until the applier holds it.
  await bridge.publishStatus();
  const said = lastStatus(bridge).devices.find((e: { id: string }) => e.id === "lamp").lastCheckIn as string;
  const lamp = await pollUntil(async () => {
    const l = (await mcp.callOk("state", { targets: [LAMP] })).targets[LAMP];
    return Date.parse(l.last_check_in) === Date.parse(said) ? l : undefined;
  }, oneSecond(ctx), "the lamp's last check-in as its bridge last said it");
  mustEqual(lamp.fresh_s, 60, "the lamp's fresh_s");
  const checkIn = Date.parse(said);
  // Time passes in 5 s chunks each subject takes, so no step reads as a fast clock and the bridge's
  // statuses keep it alive meanwhile.
  await ctx.time.advance(checkIn + 50_000 - ctx.time.now(), { chunkMs: 5000 });
  await stillReads(ctx, LAMP, "live", "50 s after its last check-in");
  await ctx.time.advance(checkIn + 71_000 - ctx.time.now(), { chunkMs: 5000 });
  await livenessWithin(ctx, LAMP, "stale", oneSecond(ctx), "71 s after its last check-in");
});

requirement("GA-STATE-4", {
  seam: "applier", fixture: { devices: ["tv", "ac"] }, timeoutMs: 60_000,
  covers: "an open device is live while its bridge is alive and its transport up or unknown, and dead when down; a toggle on it with a person's token ends sent on its bridge's sent, and unanswered when nothing came within its ack_within_s, never acked or failed(no_ack); the IR air conditioner's state is assumed, marked so: mode cool once set_mode cool ended sent, still cool after set_mode heat ended unreachable, setpoint 22 once set_setpoint 22 ended unanswered. power.wake is the PC build's",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  await livenessWithin(ctx, TV, "live", oneSecond(ctx), "with its transport up");
  await bridge.control({ requestId: "state-4a", op: "transportState", state: "unknown" });
  await stillReads(ctx, TV, "live", "with its transport unknown");
  await bridge.control({ requestId: "state-4b", op: "transportState", state: "down" });
  await livenessWithin(ctx, TV, "dead", oneSecond(ctx), "with its transport down");
  await bridge.control({ requestId: "state-4c", op: "transportState", state: "up" });
  await livenessWithin(ctx, TV, "live", oneSecond(ctx), "with its transport up again");

  const off = { target: TV, action: "onoff.turn_off", args: {}, via: "app", brain: false, for: { person: "demo" } };
  const outcome = async (apply_id: string) => {
    const [o] = (await ctx.mcp!.callOk("outcome", { apply_id })).outcomes as { outcome: string; reason?: string }[];
    return `${o!.outcome}${o!.reason ? `(${o!.reason})` : ""}`;
  };
  const sent = await ctx.mcp!.callOk("apply", { idempotency_key: `state-4-sent-${ctx.runId}`, request: { actions: [{ ...off, token: sign(ctx, off) }] } });
  await pollUntil(async () => (await outcome(sent.apply_id)) === "sent", oneSecond(ctx), "sent once the tv's bridge said it sent");
  const bound = ((await ctx.owner!.callOk("describe")).devices as { id: string; actions: { action: string; ack_within_s: number }[] }[])
    .find((d) => d.id === TV)!.actions.find((a) => a.action === "onoff.turn_off")!.ack_within_s;
  await bridge.control({ requestId: "state-4-none", op: "commandResult", device: "tv", result: "none" });
  const quiet = await ctx.mcp!.callOk("apply", { idempotency_key: `state-4-quiet-${ctx.runId}`, request: { actions: [{ ...off, token: sign(ctx, off) }] } });
  await ctx.time.advance(bound * 1000, { chunkMs: 5000 });
  await pollUntil(async () => (await outcome(quiet.apply_id)) === "unanswered", oneSecond(ctx), `unanswered once ${bound} s passed with nothing heard`);

  const climate = (action: string, args: Record<string, unknown>) => ({ target: AC, action, args, via: "app", brain: false, for: { person: "demo" } });
  const assumed = async () => {
    const values = (await ctx.mcp!.callOk("state", { targets: [AC] })).targets[AC].values as { key: string; value: unknown; assumed?: boolean }[];
    ctx.evidence(`the air conditioner's state: ${JSON.stringify(values)}`);
    must(values.every((v) => v.assumed === true), "every value of the air conditioner is marked assumed", values);
    return Object.fromEntries(values.map((v) => [v.key, v.value]));
  };
  const cool = await ctx.mcp!.callOk("apply", { idempotency_key: `state-4-cool-${ctx.runId}`, request: { actions: [climate("climate.set_mode", { mode: "cool" })] } });
  await pollUntil(async () => (await outcome(cool.apply_id)) === "sent", oneSecond(ctx), "set_mode cool sent");
  mustEqual((await assumed()).mode, "cool", "the mode assumed once set_mode cool ended sent");
  await bridge.control({ requestId: "state-4-unreachable", op: "commandResult", device: "ac", result: "unreachable", afterMs: 0 });
  const heat = await ctx.mcp!.callOk("apply", { idempotency_key: `state-4-heat-${ctx.runId}`, request: { actions: [climate("climate.set_mode", { mode: "heat" })] } });
  await pollUntil(async () => (await outcome(heat.apply_id)) === "unreachable", oneSecond(ctx), "set_mode heat unreachable");
  mustEqual((await assumed()).mode, "cool", "the mode assumed after set_mode heat ended unreachable");
  await bridge.control({ requestId: "state-4-ac-none", op: "commandResult", device: "ac", result: "none" });
  const acBound = ((await ctx.owner!.callOk("describe")).devices as { id: string; actions: { action: string; ack_within_s: number }[] }[])
    .find((d) => d.id === AC)!.actions.find((a) => a.action === "climate.set_setpoint")!.ack_within_s;
  const set = await ctx.mcp!.callOk("apply", { idempotency_key: `state-4-setpoint-${ctx.runId}`, request: { actions: [climate("climate.set_setpoint", { celsius: 22 })] } });
  await ctx.time.advance(acBound * 1000, { chunkMs: 5000 });
  await pollUntil(async () => (await outcome(set.apply_id)) === "unanswered", oneSecond(ctx), `set_setpoint 22 unanswered once ${acBound} s passed`);
  mustEqual((await assumed()).setpoint, 22, "the setpoint assumed once set_setpoint 22 ended unanswered");
});

requirement("GA-STATE-6", {
  seam: "applier", fixture: { devices: ["lamp", "unbound"] }, timeoutMs: 60_000,
  covers: "an owner's fresh_s of 600 makes a device with no bound live; one of 20 over a declared 60 makes the lamp stale 31 s after its check-in, live at 15 s; each with fresh_basis configured and a freshness event",
}, async (ctx) => {
  const { mcp, owner, bridge } = { mcp: ctx.mcp!, owner: ctx.owner!, bridge: ctx.bridge! };
  const { cursor } = await mcp.callOk("events");
  const r = await ownerConfigure(owner, [{ op: "upsert", kind: "fresh_s", value: { device: UNBOUND, fresh_s: 600 } },
    { op: "upsert", kind: "fresh_s", value: { device: LAMP, fresh_s: 20 } }]);
  must(r.ok, `the owner's fresh_s returned ${r.ok ? "" : r.error}`, r.body);
  await livenessWithin(ctx, UNBOUND, "live", oneSecond(ctx), "under the owner's fresh_s of 600");
  const targets = (await mcp.callOk("state", { targets: [UNBOUND, LAMP] })).targets;
  mustEqual([targets[UNBOUND].fresh_s, targets[UNBOUND].fresh_basis, targets[LAMP].fresh_s, targets[LAMP].fresh_basis],
    [600, "configured", 20, "configured"], "each device's fresh_s and fresh_basis");
  const freshness = await eventsOf(mcp, cursor, "freshness");
  mustEqual(freshness.map((e) => [e.target, e.fresh_s, e.fresh_basis]).sort(),
    [[LAMP, 20, "configured"], [UNBOUND, 600, "configured"]], "the freshness events");

  await bridge.control({ requestId: "state-6", op: "silence", device: "lamp", silent: true });
  await bridge.publishStatus();
  const said = lastStatus(bridge).devices.find((e: { id: string }) => e.id === "lamp").lastCheckIn as string;
  await pollUntil(async () => Date.parse((await mcp.callOk("state", { targets: [LAMP] })).targets[LAMP].last_check_in) === Date.parse(said),
    oneSecond(ctx), "the lamp's last check-in as its bridge last said it");
  const checkIn = Date.parse(said);
  await ctx.time.advance(checkIn + 15_000 - ctx.time.now(), { chunkMs: 5000 });
  await stillReads(ctx, LAMP, "live", "15 s after its last check-in");
  await ctx.time.advance(checkIn + 31_000 - ctx.time.now(), { chunkMs: 5000 });
  await livenessWithin(ctx, LAMP, "stale", oneSecond(ctx), "31 s after its last check-in, under a fresh_s of 20");
});
