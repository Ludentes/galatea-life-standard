import { randomUUID } from "node:crypto";
import { must, mustEqual } from "../../assert.js";
import { requirement } from "../../registry.js";
import type { McpSeam } from "../../seams/mcp.js";
import { pollUntil } from "../../util.js";
import {
  DIMMER, eventsOf, LAMP, lastDevices, lastStatus, livenessOf, livenessWithin, oneSecond, reviveWithin, snapshots,
  stillReads, TV, wire,
} from "../util.js";

/**
 * The bridge_fault events after `cursor` that name this bridge. `what` is free text in the standard
 * ("what it was"), so its wording is not graded; each test takes its cursor just before the message
 * that should raise the fault.
 */
async function faultsOf(mcp: McpSeam, cursor: string) {
  return (await eventsOf(mcp, cursor, "bridge_fault")).filter((e) => e.bridge === "sim-bridge");
}

/** Fails unless a plan turning each of `targets` on is skip(dead) for every one. */
async function planSkipsDead(mcp: McpSeam, targets: string[], why: string): Promise<void> {
  const actions = targets.map((target) => ({ target, action: "onoff.turn_on", args: {}, via: "app", brain: false, for: { person: "demo" } }));
  const steps = (await mcp.callOk("plan", { actions })).steps as { target: string; verdict: string; reason?: string }[];
  mustEqual(steps.map((s) => [s.target, s.verdict, s.reason]), targets.map((t) => [t, "skip", "dead"]), `the plan's steps ${why}`);
}

/** A devices-document entry for a device new to the applier, copied from the lamp's. */
function newcomer(lamp: Record<string, unknown>, id: string, extra: Record<string, unknown> = {}) {
  return { ...lamp, id, stableIdentifier: `test:${id}`, ...extra };
}

requirement("GA-BUS-1", {
  seam: "applier", fixture: { devices: ["lamp", "dimmer"] },
  covers: "a devices document with one malformed entry still lists the good ones; a roster entry with a bad field is not the device leaving; a device status's bad field drops only itself: its good reading is taken, the bad key keeps its value",
}, async (ctx) => {
  const { mcp, bridge } = { mcp: ctx.mcp!, bridge: ctx.bridge! };
  bridge.setQuiet(true);
  const doc = lastDevices(bridge);
  const { cursor } = await mcp.callOk("events");
  await bridge.publishRaw("devices", { ...doc, devices: [...doc.devices, { id: "ghost" }, newcomer(doc.devices[0]!, "newcomer")] }, true);
  await pollUntil(async () => (await mcp.callOk("describe")).devices.some((d: { id: string }) => d.id === "sim-bridge:newcomer"),
    oneSecond(ctx), "the good entry beside a malformed one in describe");
  must((await faultsOf(mcp, cursor)).length > 0, "a bridge_fault for the malformed entry");

  const status = lastStatus(bridge);
  await bridge.publishStatus({ devices: status.devices.map((e: { id: string }) => (e.id === "dimmer" ? { ...e, lastCheckIn: "garbage" } : e)) });
  await stillReads(ctx, DIMMER, "live", "after a roster entry with a bad field");

  type Reading = { key: string; value: unknown };
  const dimmer = async () => (await mcp.callOk("state", { targets: [DIMMER] })).targets[DIMMER].values as Reading[];
  const level = (await dimmer()).find((v) => v.key === "level")?.value;
  must(level !== undefined, "the dimmer's level before the bad field");
  await bridge.publishRaw("devices/dimmer/status",
    { deviceId: "dimmer", state: "on", on: true, level: { bad: true }, timestamp: wire(ctx.time.now()), available: true }, true);
  const values = await pollUntil(async () => {
    const v = await dimmer();
    return v.some((x) => x.key === "on" && x.value === true) ? v : undefined;
  }, oneSecond(ctx), "the dimmer's good reading beside a bad field");
  mustEqual(values.find((x) => x.key === "level")?.value, level, "the dimmer's level after a status whose level was bad");
});

requirement("GA-BUS-2", {
  seam: "applier", fixture: { devices: ["lamp"] },
  covers: "a live status published 6 s ahead of or behind its arrival is a bridge_fault (each after one within tolerance, since a standing fault is raised once); a check-in stamped 6 s ahead is a fault and the device stale until a correctly stamped one; a reading stamped 6 s ahead is a fault and the device stale until a correctly stamped report",
}, async (ctx) => {
  const { mcp, bridge } = { mcp: ctx.mcp!, bridge: ctx.bridge! };
  for (const skew of [6000, -6000]) {
    const { cursor } = await mcp.callOk("events");
    bridge.setFaults({ clockSkewMs: skew });
    await bridge.publishStatus();
    await pollUntil(async () => (await faultsOf(mcp, cursor)).length > 0, oneSecond(ctx),
      `a bridge_fault for a status published ${skew / 1000} s from its arrival`);
    // A standing fault is raised once; a status within tolerance ends it, so the next skew is new.
    bridge.setFaults({ clockSkewMs: 0 });
    await bridge.publishStatus();
  }
  // A check-in stamped ahead: the lamp's heartbeat held off so the fast one stands.
  await bridge.control({ requestId: "bus-2c", op: "silence", device: "lamp", silent: true });
  let { cursor } = await mcp.callOk("events");
  await bridge.control({ requestId: "bus-2d", op: "checkIn", device: "lamp", at: wire(ctx.time.now() + 6000) });
  await bridge.publishStatus();
  await livenessWithin(ctx, LAMP, "stale", oneSecond(ctx), "after a check-in stamped 6 s ahead");
  must((await faultsOf(mcp, cursor)).length > 0, "a bridge_fault for the fast check-in");
  await bridge.control({ requestId: "bus-2e", op: "checkIn", device: "lamp", at: wire(ctx.time.now()) });
  await bridge.publishStatus();
  await livenessWithin(ctx, LAMP, "live", oneSecond(ctx), "after a correctly stamped check-in");
  await bridge.control({ requestId: "bus-2f", op: "silence", device: "lamp", silent: false });

  ({ cursor } = await mcp.callOk("events"));
  await bridge.control({ requestId: "bus-2a", op: "report", device: "lamp", values: { on: true }, observedAt: wire(ctx.time.now() + 6000) });
  await livenessWithin(ctx, LAMP, "stale", oneSecond(ctx), "after a reading stamped 6 s ahead");
  must((await faultsOf(mcp, cursor)).length > 0, "a bridge_fault for the fast reading");
  await bridge.control({ requestId: "bus-2b", op: "report", device: "lamp", values: { on: true }, observedAt: wire(ctx.time.now()) });
  await livenessWithin(ctx, LAMP, "live", oneSecond(ctx), "after a correctly stamped report");
});

requirement("GA-BUS-3", {
  seam: "applier", fixture: { devices: ["lamp"] },
  covers: "a status with an unknown state and a transport of an unknown kind, and a devices entry with an unknown feedback and classEvidence, are taken, each unknown value as the least it can mean",
}, async (ctx) => {
  const { mcp, bridge } = { mcp: ctx.mcp!, bridge: ctx.bridge! };
  const since = wire(ctx.time.now());
  // The oddity is on radio2 first: a transport no device names leaves the model when a status omits
  // it, and the sim's own periodic status, which can land after the test's, omits it.
  const doc = lastDevices(bridge);
  await bridge.publishRaw("devices", { ...doc, devices: [...doc.devices,
    newcomer(doc.devices[0]!, "oddity", { feedback: "psychic", classEvidence: "rumour", transport: "radio2" })] }, true);
  await bridge.publishStatus({ state: "hibernating", transports: [{ id: "test", kind: "other", state: "up", since },
    { id: "radio2", kind: "lora", state: "up", since }] });
  await pollUntil(async () => (await mcp.callOk("describe")).transports
    .some((t: { id: string; kind: string }) => t.id === "sim-bridge:radio2" && t.kind === "other"), oneSecond(ctx),
    "the transport of kind lora listed as other");
  const odd = await pollUntil(async () => (await mcp.callOk("describe")).devices
    .find((d: { id: string }) => d.id === "sim-bridge:oddity"), oneSecond(ctx), "the entry with unknown values in describe");
  mustEqual([odd.feedback, odd.class_evidence], ["closed", "none"], "the unknown feedback and classEvidence, taken as the least they mean");
  mustEqual(await livenessOf(mcp, LAMP), "live", "the lamp's liveness under a status with an unknown state");
});

requirement("GA-BUS-6", {
  seam: "applier", fixture: { devices: ["lamp"] },
  covers: "a seq gap, an instanceId not seen before, and the applier's reconnection each send snapshot; an (instanceId, seq) already seen does not; a device that joined while the applier was cut off is a notice naming it once it is back. A new other admin in a re-sent devices is the notice GA-ADOPT-3 grades, raised alike from a document heard live or re-sent; the acks' clauses are slice 4's",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  const asked = async (before: number, why: string) =>
    pollUntil(async () => snapshots(bridge) > before, oneSecond(ctx), `a snapshot request ${why}`);
  await bridge.publishEvent("joined", { device: "lamp" });
  let n = snapshots(bridge);
  await bridge.publishEvent("joined", { device: "lamp" }, { seq: 3 });
  await asked(n, "after a seq gap (1, then 3)");
  n = snapshots(bridge);
  await bridge.publishEvent("joined", { device: "lamp" }, { seq: 3 });
  await stillReads(ctx, LAMP, "live", "after a duplicate event");
  mustEqual(snapshots(bridge), n, "snapshot requests after an event already seen");
  await bridge.publishEvent("joined", { device: "lamp" }, { seq: 1, instanceId: randomUUID() });
  await asked(n, "after an event from an instance not seen before");
  n = snapshots(bridge);
  // Severing destroys the applier's connection at once; whether it reads its devices dead is GA-BUS-7's.
  ctx.link!.sever();
  await livenessWithin(ctx, LAMP, "dead", oneSecond(ctx), "with the broker cut");
  // Its joined event is lost to the applier; only the retained devices document and the snapshot say it.
  await bridge.control({ requestId: "bus-6", op: "join", device: "kettle", capabilities: ["onoff"], feedback: "closed" });
  ctx.link!.restore();
  await pollUntil(async () => snapshots(bridge) > n, 10_000, "a snapshot request after the applier reconnected");
  const missed = await pollUntil(async () => ((await ctx.mcp!.callOk("events")).notices as { cause: string; devices?: string[] }[])
    .find((x) => x.devices?.includes("sim-bridge:kettle")), oneSecond(ctx), "a notice naming the device that joined while it was away");
  ctx.evidence(`notice: ${JSON.stringify(missed)}`);
});

requirement("GA-BUS-7", {
  seam: "applier", fixture: { devices: ["lamp", "tv"] }, timeoutMs: 60_000,
  covers: "every bridged device, closed and open, reads dead within 1 s of the broker connection closing, and within 1.5 × 10 s + 1 s of a link that stops forwarding (a 10 s keepalive); a plan for them then is skip(dead)",
}, async (ctx) => {
  const link = ctx.link!;
  link.sever();
  for (const d of [LAMP, TV]) await livenessWithin(ctx, d, "dead", oneSecond(ctx), "with the broker cut");
  await planSkipsDead(ctx.mcp!, [LAMP, TV], "with the broker cut");
  link.restore();
  await reviveWithin(ctx, [LAMP, TV], 10_000, "after the broker came back");
  const t0 = Date.now();
  link.stall();
  for (const d of [LAMP, TV]) await livenessWithin(ctx, d, "dead", 16_000 + ctx.allowanceMs, "with the link stalled");
  ctx.evidence(`dead ${Date.now() - t0} ms after the link stalled`);
  link.restore();
});

requirement("GA-BUS-8", {
  seam: "applier", fixture: { devices: ["lamp"] }, timeoutMs: 60_000,
  covers: "a will naming another instance is ignored; its own kills with no bridge_fault; a status published before the death does not revive; a live one does; a graceful offline kills with no bridge_fault; after the applier reconnects, the retained status does not revive, a live one does",
}, async (ctx) => {
  const { mcp, bridge } = { mcp: ctx.mcp!, bridge: ctx.bridge! };
  bridge.setQuiet(true);
  await bridge.publishRaw("lwt", { bridgeId: "sim-bridge", instanceId: randomUUID() }, true);
  await stillReads(ctx, LAMP, "live", "after a will naming another instance");

  let { cursor } = await mcp.callOk("events");
  await bridge.publishRaw("lwt", { bridgeId: "sim-bridge", instanceId: bridge.instanceId }, true);
  await livenessWithin(ctx, LAMP, "dead", oneSecond(ctx), "after its own will");
  must((await eventsOf(mcp, cursor, "bridge_fault")).length === 0, "no bridge_fault for a will");
  await bridge.publishRaw("lwt", "", true);
  await bridge.publishStatus({ publishedAt: wire(ctx.time.now() - 10_000) });
  await stillReads(ctx, LAMP, "dead", "after a status published 10 s before the death");
  await bridge.publishStatus();
  await livenessWithin(ctx, LAMP, "live", oneSecond(ctx), "after a live status");

  ({ cursor } = await mcp.callOk("events"));
  await bridge.publishStatus({ state: "offline", graceful: true });
  await livenessWithin(ctx, LAMP, "dead", oneSecond(ctx), "after a graceful offline");
  mustEqual(await eventsOf(mcp, cursor, "bridge_fault"), [], "bridge_fault events after a graceful offline");
  await bridge.publishStatus();
  await livenessWithin(ctx, LAMP, "live", oneSecond(ctx), "after a live status");

  const n = snapshots(bridge);
  ctx.link!.sever();
  await livenessWithin(ctx, LAMP, "dead", oneSecond(ctx), "with the broker cut");
  // The bridge answers no request until the test has read the lamp: a snapshot's answer re-publishes
  // the status live, and that one may revive it.
  bridge.holdRequests(true);
  try {
    ctx.link!.restore();
    // Listening again once it asks for a snapshot; the retained status reached it on subscribing.
    await pollUntil(async () => snapshots(bridge) > n, 10_000, "the applier back on the broker");
    await stillReads(ctx, LAMP, "dead", "after reconnecting, on the retained status alone");
  } finally {
    bridge.holdRequests(false);
  }
  await bridge.publishStatus();
  await livenessWithin(ctx, LAMP, "live", oneSecond(ctx), "after a live status");
});

requirement("GA-BUS-10", {
  seam: "applier", fixture: { devices: ["lamp"] },
  covers: "a device with a 2-minute-old value and a fresh check-in is live; one whose check-in is 80 s old (bound 60 s) is stale, though its status has just arrived",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  await bridge.control({ requestId: "bus-10a", op: "report", device: "lamp", values: { on: true }, observedAt: wire(ctx.time.now() - 120_000) });
  await stillReads(ctx, LAMP, "live", "with an old value and a fresh check-in");
  await bridge.control({ requestId: "bus-10b", op: "checkIn", device: "lamp", at: wire(ctx.time.now() - 80_000) });
  await bridge.publishStatus();
  await livenessWithin(ctx, LAMP, "stale", oneSecond(ctx), "with an 80 s old check-in in a status just arrived");
});

requirement("GA-BUS-14", {
  seam: "applier",
  fixture: { devices: ["lamp"] },
  covers: "a live status without v, with another v, naming another bridgeId, or without an instanceId is a bridge_fault and the devices read dead within 1 s, and a plan for them is skip(dead), until a valid status arrives live",
}, async (ctx) => {
  const mcp = ctx.mcp!;
  const clauses: [string, () => Promise<void>][] = [
    ["without v", async () => { ctx.bridge!.setFaults({ noV: true }); await ctx.bridge!.publishStatus(); }],
    ["with another v", () => ctx.bridge!.publishStatus({ v: 2 })],
    ["naming another bridgeId", () => ctx.bridge!.publishStatus({ bridgeId: "another-bridge" })],
    ["without an instanceId", () => ctx.bridge!.publishStatus({ instanceId: "" })],
  ];
  for (const [what, publishBad] of clauses) {
    const { cursor } = await mcp.callOk("events");
    await publishBad();
    await livenessWithin(ctx, LAMP, "dead", oneSecond(ctx), `after a status ${what}`);
    must((await faultsOf(mcp, cursor)).length > 0, `a bridge_fault event after a status ${what}`);
    await planSkipsDead(mcp, [LAMP], `after a status ${what}`);
    ctx.bridge!.setFaults({ noV: false });
    await ctx.bridge!.publishStatus();
    await livenessWithin(ctx, LAMP, "live", oneSecond(ctx), `after a valid status following one ${what}`);
  }
});

requirement("GA-BUS-12", {
  seam: "applier", fixture: { devices: ["lamp"] },
  covers: "a faults entry naming an adopted device is a bridge_fault notice naming it, once while it stands, a client's notice_taken included; one again once it ended and stands anew; none for a device not adopted",
}, async (ctx) => {
  const { mcp, bridge } = { mcp: ctx.mcp!, bridge: ctx.bridge! };
  type Notice = { notice_id: string; cause: string; devices?: string[] };
  const faultNotices = async (take: string[] = []) => ((await mcp.callOk("events", take.length ? { notice_taken: take } : {})).notices as Notice[])
    .filter((x) => x.cause === "bridge_fault");
  const firstNotices = (why: string) => pollUntil(async () => {
    const n = await faultNotices();
    return n.length ? n : undefined;
  }, oneSecond(ctx), why);
  const doc = lastDevices(bridge);
  await bridge.publishRaw("devices", { ...doc, devices: [...doc.devices, newcomer(doc.devices[0]!, "stray")] }, true);
  // Every status carries the entries from here on, as a bridge's standing faults do.
  bridge.setFaults({ statusFaults: [{ code: "pin_mismatch", device: "lamp" }, { code: "pin_mismatch", device: "stray" }] });
  await bridge.publishStatus();
  const [first] = await firstNotices("a bridge_fault notice for the lamp");
  mustEqual(first!.devices, [LAMP], "the devices the notice names");
  await bridge.publishStatus();
  await stillReads(ctx, LAMP, "live", "after the same faults again");
  mustEqual((await faultNotices()).map((x) => x.notice_id), [first!.notice_id], "the bridge_fault notices while the entry stands");
  mustEqual(await faultNotices([first!.notice_id]), [], "the bridge_fault notices once a client took it");
  await bridge.publishStatus();
  await stillReads(ctx, LAMP, "live", "after the same faults, the notice taken");
  mustEqual(await faultNotices(), [], "the bridge_fault notices while a taken entry still stands");
  bridge.setFaults({ statusFaults: [] });
  await bridge.publishStatus();
  await stillReads(ctx, LAMP, "live", "once the fault ended");
  bridge.setFaults({ statusFaults: [{ code: "pin_mismatch", device: "lamp" }] });
  await bridge.publishStatus();
  const again = await firstNotices("a bridge_fault notice for the lamp's fault standing anew");
  must(again.length === 1 && again[0]!.notice_id !== first!.notice_id, "one new notice for the fault standing anew", again);
});
