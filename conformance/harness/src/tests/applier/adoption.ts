import { must, mustEqual } from "../../assert.js";
import { requirement } from "../../registry.js";
import type { McpSeam } from "../../seams/mcp.js";
import { randomUUID } from "node:crypto";
import { BridgeWatcher } from "../../seams/bridge-watcher.js";
import { pollUntil, sleep } from "../../util.js";
import { eventsOf, GATE, LAMP, lastDevices, lastStatus, livenessWithin, oneSecond, ownerConfigure, reviveWithin, stillReads, wire } from "../util.js";

type Described = { id: string; adopted: boolean; class: string | null; stable_identifier: string; previous_identifiers: string[];
  bridge_device: { bridge: string; id: string }; fresh_basis: string; actions: { action: string; tier: string }[] };
type Notice = { notice_id: string; cause: string; devices?: string[]; text: string };

/** The device `id` as `describe` gives it now, or undefined. */
async function find(mcp: McpSeam, id: string): Promise<Described | undefined> {
  return ((await mcp.callOk("describe")).devices as Described[]).find((d) => d.id === id);
}

/** The device `id`, once `describe` has it. */
const found = (mcp: McpSeam, id: string, ms: number) => pollUntil(() => find(mcp, id), ms, `${id} in describe`);

/** The notices of `cause` a client sees now. */
async function noticesOf(mcp: McpSeam, cause: string): Promise<Notice[]> {
  return ((await mcp.callOk("events")).notices as Notice[]).filter((n) => n.cause === cause);
}

/** A devices-document entry copied from `from` under the bridge id `id`, the same hardware unless `extra` says otherwise. */
const copyOf = (from: Record<string, unknown>, id: string, extra: Record<string, unknown> = {}) => ({ ...from, id, ...extra });

const adopt = (value: Record<string, unknown>) => ({ op: "upsert", kind: "adopt", value });

requirement("GA-ADOPT-1", {
  seam: "applier", fixture: { devices: ["lamp"] },
  covers: "a device new to the applier is adopted: false; a client cannot adopt it; the owner's adopt is a model change whose model event names the device and class; a forget of a device still in its bridge's devices is refused, and one that left is removed with its adoption, so its hardware back is new and unadopted. refuse(not_adopted) in plan and apply is slice 4's. On a subject claiming Safe, configure refuses a safety rule reading the unadopted kettle, and a forget of the kettle while a rule names it",
}, async (ctx) => {
  const { mcp, owner, bridge } = { mcp: ctx.mcp!, owner: ctx.owner!, bridge: ctx.bridge! };
  const KETTLE = "sim-bridge:kettle";
  await bridge.control({ requestId: "adopt-1", op: "join", device: "kettle", capabilities: ["onoff"], feedback: "closed" });
  const kettle = () => find(owner, KETTLE);
  const joined = await found(owner, KETTLE, oneSecond(ctx));
  mustEqual(joined.adopted, false, "a new device's adopted");
  const adoptKettle = [adopt({ device: KETTLE, class: "socket" })];
  const before = (await owner.callOk("describe")).revision;
  const refused = await mcp.call("configure", { changes: adoptKettle, expected_revision: before, dry_run: false });
  must(!refused.ok && refused.error === "not_permitted", `a client's adopt returned ${refused.ok ? "a result" : refused.error}`);
  mustEqual((await kettle())?.adopted, false, "adopted after a client's adopt");
  const { cursor } = await mcp.callOk("events");
  // A safety rule reading the kettle: refused while it is not adopted, taken once it is.
  const safe = ctx.claims.includes("Safe");
  const ruled = [{ op: "upsert", kind: "safety_rule", value: { id: "adopt-1", trigger: { device: KETTLE, key: "on", op: "eq", value: true },
    actions: [{ target: LAMP, action: "onoff.turn_off" }] } }];
  if (safe) {
    const early = await ownerConfigure(owner, ruled);
    must(!early.ok && early.error === "invalid_request", `a safety rule reading the unadopted kettle returned ${early.ok ? "a result" : early.error}`,
      early.body);
  }
  const r = await ownerConfigure(owner, adoptKettle);
  must(r.ok, `the owner's adopt returned ${r.ok ? "" : r.error}`, r.body);
  const after = await owner.callOk("describe");
  must(after.revision > before, `revision after the adoption: ${after.revision}, before ${before}`);
  mustEqual([(await kettle())?.adopted, (await kettle())?.class], [true, "socket"], "adopted and class after the owner's adopt");
  const model = (await eventsOf(mcp, cursor, "model")).find((e) => e.device === KETTLE);
  must(model && model.class === "socket" && model.revision === after.revision, "a model event naming the device, its class and the revision", model);
  if (safe) {
    const taken = await ownerConfigure(owner, ruled);
    must(taken.ok, `the safety rule on the adopted kettle returned ${taken.ok ? "" : taken.error}`, taken.body);
  }

  const forget = [{ op: "upsert", kind: "forget", value: { device: KETTLE } }];
  const listed = await ownerConfigure(owner, forget);
  must(!listed.ok && listed.error === "invalid_request",
    `a forget of a device its bridge still lists returned ${listed.ok ? "a result" : listed.error}`, listed.body);
  must((await kettle()) !== undefined, "the device its bridge still lists, in describe after a refused forget");
  await bridge.removeDevice("kettle");
  if (safe) {
    // Gone from its bridge, but a rule names it: its forget stays refused until the rule goes.
    await sleep(oneSecond(ctx));
    const named = await ownerConfigure(owner, forget);
    must(!named.ok && named.error === "invalid_request", `a forget of a device a safety rule names returned ${named.ok ? "a result" : named.error}`,
      named.body);
    const gone = await ownerConfigure(owner, [{ op: "delete", kind: "safety_rule", value: { id: "adopt-1" } }]);
    must(gone.ok, `the rule's delete returned ${gone.ok ? "" : gone.error}`, gone.body);
  }
  await pollUntil(async () => (await ownerConfigure(owner, forget)).ok, oneSecond(ctx), "a forget taken once the bridge no longer lists the device");
  mustEqual(await kettle(), undefined, "the forgotten device in describe");
  await bridge.control({ requestId: "adopt-1b", op: "join", device: "kettle", capabilities: ["onoff"], feedback: "closed" });
  mustEqual((await found(owner, KETTLE, oneSecond(ctx))).adopted, false, "the forgotten device's hardware, back: adopted");
});

requirement("GA-ADOPT-2", {
  seam: "applier", fixture: { devices: ["lamp"] },
  covers: "adopt with replaces gives new hardware the replaced id, and its declarations (a raised tier) but not an owner-set fresh_s; the old identifier goes to previous_identifiers, and that hardware, back, is a new unadopted device that cannot take the id back; the new hardware is never modelled twice; hardware replaced while its bridge still lists it is a device of its own under another id, unadopted, across later documents; a new device lacking an action the declarations use is refused. On a subject claiming Safe, a safety rule reading and actuating the lamp follows its id to the new hardware: listed still, and fired by the new hardware's report; a plugin device's replacement the PC build's; the same child the meta-applier's",
}, async (ctx) => {
  const { mcp, owner, bridge } = { mcp: ctx.mcp!, owner: ctx.owner!, bridge: ctx.bridge! };
  const set = await ownerConfigure(owner, [
    { op: "upsert", kind: "tier", value: { device: LAMP, action: "onoff.turn_on", tier: "confirm" } },
    { op: "upsert", kind: "fresh_s", value: { device: LAMP, fresh_s: 20 } }]);
  must(set.ok, `the lamp's declarations returned ${set.ok ? "" : set.error}`, set.body);
  const doc = lastDevices(bridge);
  const lamp = doc.devices.find((d) => d.id === "lamp")!;
  const publish = (devices: Record<string, unknown>[]) => bridge.publishRaw("devices", { ...doc, devices }, true);
  // The lamp's hardware is swapped: the old one leaves, a new lamp and a sensor arrive.
  const fresh = copyOf(lamp, "lamp-2", { stableIdentifier: "test:lamp-2" });
  const probe = copyOf(lamp, "probe", { stableIdentifier: "test:probe", capabilities: ["sensor"], sensorKeys: ["temperature"], actions: [] });
  await publish([fresh, probe]);
  await found(owner, "sim-bridge:probe", oneSecond(ctx));
  const before = (await owner.callOk("describe")).revision;
  // The same class as the lamp's, so only the action it lacks can refuse it.
  const lacking = await ownerConfigure(owner, [adopt({ device: "sim-bridge:probe", class: "light", replaces: LAMP })]);
  must(!lacking.ok && lacking.error === "invalid_request",
    `a replacement lacking the lamp's onoff.turn_on returned ${lacking.ok ? "a result" : lacking.error}`, lacking.body);
  mustEqual((await owner.callOk("describe")).revision, before, "the revision after a refused replacement");

  const { cursor } = await mcp.callOk("events");
  const safe = ctx.claims.includes("Safe");
  if (safe) {
    const rule = await ownerConfigure(owner, [{ op: "upsert", kind: "safety_rule", value: { id: "adopt-2",
      trigger: { device: LAMP, key: "on", op: "eq", value: true }, actions: [{ target: LAMP, action: "onoff.turn_off" }] } }]);
    must(rule.ok, `a safety rule on the lamp returned ${rule.ok ? "" : rule.error}`, rule.body);
  }
  const r = await ownerConfigure(owner, [adopt({ device: "sim-bridge:lamp-2", class: "light", replaces: LAMP })]);
  must(r.ok, `the replacement returned ${r.ok ? "" : r.error}`, r.body);
  if (safe) {
    const rules = (await owner.callOk("describe")).safety_rules as { id: string }[];
    must(rules.some((x) => x.id === "adopt-2"), "the lamp's safety rule, kept through its replacement", rules);
    await bridge.publishRaw("devices/lamp-2/status", { deviceId: "lamp-2", on: true, timestamp: wire(ctx.time.now()) }, false);
    const fired = await pollUntil(async () => (await eventsOf(mcp, cursor, "outcome")).find((e) => e.rule_id === "adopt-2"), oneSecond(ctx),
      "the rule's actuation of the lamp on its new hardware's report");
    ctx.evidence(`the rule on new hardware: ${JSON.stringify(fired)}`);
    mustEqual(fired.target, LAMP, "the rule's actuation's target");
  }
  const now = (await find(mcp, LAMP))!;
  mustEqual([now.stable_identifier, now.previous_identifiers, now.adopted, now.bridge_device.id],
    ["test:lamp-2", ["test:lamp"], true, "lamp-2"], "the replaced id's identifier, previous identifiers, adoption and bridge device");
  mustEqual(now.actions.find((a) => a.action === "onoff.turn_on")?.tier, "confirm", "the replaced device's raised tier, on its new hardware");
  must(now.fresh_basis !== "configured", `the owner's fresh_s is not the new hardware's: fresh_basis ${now.fresh_basis}`, now);
  mustEqual(await find(mcp, "sim-bridge:lamp-2"), undefined, "the new hardware under an id of its own");
  const model = (await eventsOf(mcp, cursor, "model")).find((e) => e.replaces === LAMP);
  must(model?.device === "sim-bridge:lamp-2", "a model event naming the adoption and what it replaces", model);

  // The old hardware back, admitted anew: a new device, and never the id's again.
  const other = copyOf(lamp, "lamp-4", { stableIdentifier: "test:lamp-4" });
  await publish([fresh, probe, copyOf(lamp, "lamp-3"), other]);
  mustEqual((await found(owner, "sim-bridge:lamp-3", oneSecond(ctx))).adopted, false, "the replaced hardware, back: adopted");
  await found(owner, "sim-bridge:lamp-4", oneSecond(ctx));
  mustEqual(await find(mcp, "sim-bridge:lamp-2"), undefined, "the new hardware, after its bridge's next document, under an id of its own");
  // A control first: the same replacement by hardware the id never had is taken (a dry run).
  const dry = async (device: string) => owner.call("configure", { changes: [adopt({ device, class: "light", replaces: LAMP })],
    expected_revision: (await owner.callOk("describe")).revision, dry_run: true });
  const control = await dry("sim-bridge:lamp-4");
  must(control.ok, `a dry-run replacement by new hardware returned ${control.ok ? "" : control.error}`, control.body);
  const back = await dry("sim-bridge:lamp-3");
  must(!back.ok && back.error === "invalid_request", `the replaced hardware taking its old id back returned ${back.ok ? "a result" : back.error}`,
    back.body);
  mustEqual((await find(mcp, LAMP))?.stable_identifier, "test:lamp-2", "the replaced id's identifier after its old hardware came back");

  // Replaced while its bridge still lists it: the lamp-2 hardware stays, under another id, unadopted.
  const next = copyOf(lamp, "lamp-5", { stableIdentifier: "test:lamp-5" });
  const listed = [fresh, probe, copyOf(lamp, "lamp-3"), other, next];
  await publish(listed);
  await found(owner, "sim-bridge:lamp-5", oneSecond(ctx));
  const again = await ownerConfigure(owner, [adopt({ device: "sim-bridge:lamp-5", class: "light", replaces: LAMP })]);
  must(again.ok, `the replacement of hardware still listed returned ${again.ok ? "" : again.error}`, again.body);
  const settled = async (why: string) => {
    const devices = (await owner.callOk("describe")).devices as Described[];
    const id = devices.find((d) => d.id === LAMP);
    const old = devices.filter((d) => d.stable_identifier === "test:lamp-2");
    mustEqual([id?.bridge_device.id, id?.stable_identifier], ["lamp-5", "test:lamp-5"], `the replaced id's hardware ${why}`);
    mustEqual(old.map((d) => [d.id !== LAMP, d.adopted, d.bridge_device.id]), [[true, false, "lamp-2"]],
      `the replaced hardware still listed ${why}: one device, under another id, unadopted`);
  };
  await settled("after the replacement");
  await publish(listed);
  // Nothing to wait on but time: the document changes nothing when the applier is right.
  await sleep(oneSecond(ctx));
  await settled("after its bridge's next document");
});

requirement("GA-ADOPT-3", {
  seam: "applier", fixture: { devices: ["lamp", "gate"] },
  covers: "a device with an action above reversible is an other_admin notice when an admin is added to it, and when adopted with other_admins unknown; one whose actions are all reversible is not; its becoming [] is a notice replacing the untaken earlier one; the notice comes with the adoption, not with the device's arrival. The tier judged before the same change set lowers it, and the once when the applier starts supporting adoption, are unit-tested",
}, async (ctx) => {
  const { mcp, owner, bridge } = { mcp: ctx.mcp!, owner: ctx.owner!, bridge: ctx.bridge! };
  const doc = lastDevices(bridge);
  const lamp = doc.devices.find((d) => d.id === "lamp")!;
  const gate = doc.devices.find((d) => d.id === "gate")!;
  const remote = [{ vendor: "demo", label: "remote" }];
  const naming = async (id: string) => (await noticesOf(mcp, "other_admin")).filter((n) => n.devices?.includes(id));
  const firstNaming = (id: string, why: string) => pollUntil(async () => {
    const n = await naming(id);
    return n.length ? n : undefined;
  }, oneSecond(ctx), why);

  // An admin added to the adopted gate (its cover.close is confirm) and to the lamp (all reversible).
  await bridge.publishRaw("devices", { ...doc, devices: [copyOf(gate, "gate", { otherAdmins: remote }),
    copyOf(lamp, "lamp", { otherAdmins: remote })] }, true);
  const [added] = await firstNaming(GATE, "an other_admin notice naming the gate, an admin added to it");
  ctx.evidence(`notice: ${JSON.stringify(added)}`);
  mustEqual(await naming(LAMP), [], "other_admin notices naming the lamp, whose actions are all reversible");

  // A gate adopted with other_admins unknown.
  const second = copyOf(gate, "gate-2", { stableIdentifier: "test:gate-2", otherAdmins: "unknown" });
  await bridge.publishRaw("devices", { ...doc, devices: [copyOf(gate, "gate", { otherAdmins: remote }), lamp, second] }, true);
  await found(owner, "sim-bridge:gate-2", oneSecond(ctx));
  await sleep(oneSecond(ctx));
  mustEqual(await naming("sim-bridge:gate-2"), [], "other_admin notices naming the gate before its adoption");
  const r = await ownerConfigure(owner, [adopt({ device: "sim-bridge:gate-2", class: "gate" })]);
  must(r.ok, `the adoption returned ${r.ok ? "" : r.error}`, r.body);
  const [unknown] = await firstNaming("sim-bridge:gate-2", "an other_admin notice at the adoption of a gate whose other admins are unknown");

  // Its admins become []: a notice that replaces the untaken earlier one.
  await bridge.publishRaw("devices", { ...doc, devices: [copyOf(gate, "gate", { otherAdmins: remote }), lamp,
    copyOf(second, "gate-2", { otherAdmins: [] })] }, true);
  const now = await pollUntil(async () => {
    const n = await naming("sim-bridge:gate-2");
    return n.length === 1 && n[0]!.notice_id !== unknown!.notice_id ? n : undefined;
  }, oneSecond(ctx), "one other_admin notice for the gate whose admins became [], in place of the earlier one");
  ctx.evidence(`[] notice: ${JSON.stringify(now[0])}`);
});

requirement("GA-ADOPT-6", {
  seam: "applier", fixture: { devices: ["lamp"] },
  covers: "an adopted device's transport first reading unknown is an open_loop notice naming it, once; adopting a device on an unknown transport is one too, with the adoption, not the arrival; on a subject claiming Safe, configure of a safety rule actuating it is one naming the rule",
}, async (ctx) => {
  const { mcp, owner, bridge } = { mcp: ctx.mcp!, owner: ctx.owner!, bridge: ctx.bridge! };
  const naming = async (id: string) => (await noticesOf(mcp, "open_loop")).filter((n) => n.devices?.includes(id));
  await bridge.control({ requestId: "adopt-6a", op: "transportState", state: "unknown" });
  await pollUntil(async () => (await naming(LAMP)).length > 0, oneSecond(ctx), "an open_loop notice naming the lamp, its transport first unknown");
  await bridge.control({ requestId: "adopt-6b", op: "transportState", state: "up" });
  await bridge.control({ requestId: "adopt-6c", op: "transportState", state: "unknown" });
  await stillReads(ctx, LAMP, "live", "on a transport unknown again");
  mustEqual((await naming(LAMP)).length, 1, "open_loop notices naming the lamp once its transport read unknown again");

  await bridge.control({ requestId: "adopt-6d", op: "join", device: "kettle", capabilities: ["onoff"], feedback: "closed" });
  await found(owner, "sim-bridge:kettle", oneSecond(ctx));
  await sleep(oneSecond(ctx));
  mustEqual(await naming("sim-bridge:kettle"), [], "open_loop notices naming the kettle before its adoption");
  const r = await ownerConfigure(owner, [adopt({ device: "sim-bridge:kettle", class: "socket" })]);
  must(r.ok, `the adoption returned ${r.ok ? "" : r.error}`, r.body);
  await pollUntil(async () => (await naming("sim-bridge:kettle")).length > 0, oneSecond(ctx),
    "an open_loop notice naming a device adopted on an unknown transport");
  if (ctx.claims.includes("Safe")) {
    const rule = await ownerConfigure(owner, [{ op: "upsert", kind: "safety_rule", value: { id: "adopt-6",
      trigger: { device: LAMP, key: "on", op: "eq", value: true }, actions: [{ target: "sim-bridge:kettle", action: "onoff.turn_off" }] } }]);
    must(rule.ok, `a safety rule actuating the kettle returned ${rule.ok ? "" : rule.error}`, rule.body);
    const n = await pollUntil(async () => (await noticesOf(mcp, "open_loop")).find((x) => (x as { rule_id?: string }).rule_id === "adopt-6"),
      oneSecond(ctx), "an open_loop notice naming the rule actuating a device on an unknown transport");
    ctx.evidence(`the rule's open_loop notice: ${JSON.stringify(n)}`);
    must(n.devices?.includes("sim-bridge:kettle"), "the rule's open_loop notice names the kettle", n);
  }
});

requirement("GA-BUS-11", {
  seam: "applier", fixture: { devices: ["lamp"] },
  covers: "an arrival on the adopted lamp's own bridge showing its identifier, and a device of a second bridge showing it, are each a separate unadopted device, never merged into the lamp, with a route_conflict event naming the identifier and the bridges; the first is also a route_conflict notice. A second bridge's copy of an unadopted kettle is one device with it, exposed once, one route_conflict naming both bridges; route first: its adoption is refused and its steps are refuse(not_adopted) until the owner routes the identifier, then it is adopted and its steps are op; the route of the adopted kettle is neither deleted nor moved to the other bridge. Then its command goes only to its own bridge, the copy's bridge is sent nothing, an ack the copy's bridge sends for it is no one's, and the copy's bridge dying changes neither the kettle's liveness nor its step. duplicate_route, which a single applier never reaches under route first, is the meta-applier's. A staged plugin device is the PC build's",
}, async (ctx) => {
  const { mcp, owner, bridge } = { mcp: ctx.mcp!, owner: ctx.owner!, bridge: ctx.bridge! };
  const doc = lastDevices(bridge);
  const lamp = doc.devices.find((d) => d.id === "lamp")!;
  const conflicts = async (cursor: string) => (await eventsOf(mcp, cursor, "route_conflict"))
    .filter((e) => e.stable_identifier === lamp.stableIdentifier);
  const theLamp = async () => {
    const d = await find(mcp, LAMP);
    mustEqual([d?.adopted, d?.bridge_device.bridge, d?.bridge_device.id], [true, "sim-bridge", "lamp"], "the adopted lamp, on its own bridge");
  };

  let { cursor } = await mcp.callOk("events");
  await bridge.publishRaw("devices", { ...doc, devices: [...doc.devices, copyOf(lamp, "lamp-2")] }, true);
  const [same] = await pollUntil(async () => {
    const c = await conflicts(cursor);
    return c.length ? c : undefined;
  }, oneSecond(ctx), "a route_conflict event for an arrival showing the lamp's identifier");
  mustEqual(same.bridges, ["sim-bridge"], "the bridges the route_conflict names");
  mustEqual((await find(mcp, "sim-bridge:lamp-2"))?.adopted, false, "the arrival showing the adopted lamp's identifier: adopted");
  await theLamp();
  const notice = await pollUntil(async () => (await noticesOf(mcp, "route_conflict"))
    .find((n) => n.devices?.includes(LAMP) && n.devices.includes("sim-bridge:lamp-2")), oneSecond(ctx),
    "a route_conflict notice naming the lamp and the arrival");
  ctx.evidence(`notice: ${JSON.stringify(notice)}`);

  ({ cursor } = await mcp.callOk("events"));
  await bridge.publishAs("sim-bridge-2", "devices", { publishedAt: wire(ctx.time.now()), devices: [copyOf(lamp, "lamp")] }, true);
  const r = await ownerConfigure(owner, [{ op: "upsert", kind: "bridge", value: { id: "sim-bridge-2", identity: "sim-bridge-2" } }]);
  must(r.ok, `registering a second bridge returned ${r.ok ? "" : r.error}`, r.body);
  const [other] = await pollUntil(async () => {
    const c = (await conflicts(cursor)).filter((e) => e.bridges?.includes("sim-bridge-2"));
    return c.length ? c : undefined;
  }, 10_000, "a route_conflict event for the lamp's identifier under a second bridge");
  mustEqual(other.bridges, ["sim-bridge", "sim-bridge-2"], "the bridges the route_conflict names");
  mustEqual((await find(mcp, "sim-bridge-2:lamp"))?.adopted, false, "the second bridge's device showing the lamp's identifier: adopted");
  await theLamp();
  await stillReads(ctx, LAMP, "live", "after another bridge showed its identifier");

  // With neither adopted, one identifier on two bridges is one device.
  const KETTLE = "sim-bridge:kettle";
  await bridge.control({ requestId: "join-kettle", op: "join", device: "kettle", capabilities: ["onoff"], feedback: "closed" });
  await found(owner, KETTLE, oneSecond(ctx));
  ({ cursor } = await mcp.callOk("events"));
  const kettle = lastDevices(bridge).devices.find((d) => d.id === "kettle")!;
  await bridge.publishAs("sim-bridge-2", "devices", { publishedAt: wire(ctx.time.now()), devices: [copyOf(lamp, "lamp"), copyOf(kettle, "0x02")] }, true);
  const [one] = await pollUntil(async () => {
    const c = (await eventsOf(mcp, cursor, "route_conflict")).filter((e) => e.stable_identifier === kettle.stableIdentifier);
    return c.length ? c : undefined;
  }, oneSecond(ctx), "a route_conflict event for the kettle's identifier under a second bridge");
  mustEqual(one.bridges, ["sim-bridge", "sim-bridge-2"], "the bridges the kettle's route_conflict names");
  const shown = ((await owner.callOk("describe")).devices as Described[]).filter((d) => d.stable_identifier === kettle.stableIdentifier);
  mustEqual(shown.map((d) => d.id), [KETTLE], "the devices describe shows with the kettle's identifier");
  const unrouted = await ownerConfigure(owner, [adopt({ device: KETTLE, class: "socket" })]);
  mustEqual(unrouted.ok ? "ok" : unrouted.error, "invalid_request", "adopting the kettle before its identifier is routed");
  const turnOn = { target: KETTLE, action: "onoff.turn_on", args: {}, via: "app", brain: false, for: { person: "demo" } };
  const planned = async () => {
    const [s] = (await mcp.callOk("plan", { actions: [turnOn] })).steps as { verdict: string; reason?: string }[];
    return [s?.verdict, s?.reason ?? null];
  };
  mustEqual(await planned(), ["refuse", "not_adopted"], "the step for the kettle, not routed");
  const route = (bridge: string) => ({ op: "upsert", kind: "route", value: { stable_identifier: kettle.stableIdentifier, bridge } });
  // A Safe owner declares the kettle's load, so its turn_on stays reversible (GA-DESC-8's heating would ask a token).
  const load = ctx.claims.includes("Safe") ? { declarations: { load: "other" } } : {};
  const routed = await ownerConfigure(owner, [route("sim-bridge"), adopt({ device: KETTLE, class: "socket", ...load })]);
  must(routed.ok, `routing and adopting the kettle returned ${routed.ok ? "" : routed.error}`, routed.body);
  mustEqual(await planned(), ["op", null], "the step for the kettle, routed to its own bridge and adopted");
  const unroute = await ownerConfigure(owner, [{ op: "delete", kind: "route", value: { stable_identifier: kettle.stableIdentifier } }]);
  mustEqual(unroute.ok ? "ok" : unroute.error, "invalid_request", "deleting the adopted kettle's route");
  const moved = await ownerConfigure(owner, [route("sim-bridge-2")]);
  mustEqual(moved.ok ? "ok" : moved.error, "invalid_request", "routing the adopted kettle to the other bridge");
  const d = await find(mcp, KETTLE);
  mustEqual([d?.bridge_device.bridge, d?.bridge_device.id], ["sim-bridge", "kettle"], "the adopted kettle's bridge after the refused route");

  // Two hazards a deployed fleet met: a command goes, and its ack is taken, only through the bridge that carries the
  // device; the copy's bridge dying never changes the device's liveness.
  const roster = lastStatus(bridge);
  const instanceId = randomUUID();
  const entry = (id: string, as: string) => ({ ...roster.devices.find((x: { id: string }) => x.id === id), id: as });
  await bridge.publishAs("sim-bridge-2", "status", { ...roster, bridgeId: "sim-bridge-2", instanceId, testRunId: ctx.runId,
    devices: [entry("lamp", "lamp"), entry("kettle", "0x02")], publishedAt: wire(ctx.time.now()) }, false);
  // The copy's bridge is alive: its own lamp, a device apart from the adopted one, reads live.
  await livenessWithin(ctx, "sim-bridge-2:lamp", "live", oneSecond(ctx), "once the copy's bridge says it is online");
  const copies = await BridgeWatcher.start(ctx.link!.url, `${ctx.root}/bridges/sim-bridge-2/devices/+/command`);
  try {
    await bridge.control({ requestId: "bus-11-quiet", op: "commandResult", device: "kettle", result: "none" });
    await reviveWithin(ctx, [KETTLE], 10_000, "before the kettle's step");
    const mark = bridge.commands.length;
    const applied = await mcp.callOk("apply", { idempotency_key: `bus-11-${ctx.runId}`, request: { actions: [turnOn] } });
    const outcome = async () => (await mcp.callOk("outcome", { apply_id: applied.apply_id })).outcomes[0].outcome as string;
    mustEqual(await outcome(), "dispatched", "the kettle's step");
    const [cmd] = await pollUntil(async () => {
      const c = bridge.commands.slice(mark).filter((x) => x.device === "kettle");
      return c.length ? c : undefined;
    }, oneSecond(ctx), "the kettle's command at its own bridge");
    ({ cursor } = await mcp.callOk("events"));
    await bridge.publishAs("sim-bridge-2", "devices/0x02/ack", { commandId: cmd!.commandId, source: "sim-bridge-2", result: "failed",
      reason: "rejected", timestamp: wire(ctx.time.now()) }, false);
    await bridge.publishAs("sim-bridge-2", "lwt", { instanceId }, true);
    // The will was taken: the copy's bridge's own lamp went dead.
    await livenessWithin(ctx, "sim-bridge-2:lamp", "dead", oneSecond(ctx), "within 1 s of the copy's bridge's will");
    await sleep(oneSecond(ctx));
    mustEqual(copies.seen.map((x) => x.topic), [], "commands the copy's bridge was sent");
    mustEqual(await outcome(), "dispatched", "the kettle's step after the copy's bridge acked it failed and died");
    mustEqual((await eventsOf(mcp, cursor, "liveness")).filter((e) => e.target === KETTLE), [], "the kettle's liveness events");
  } finally {
    await copies.close();
  }
});
