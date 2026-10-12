import { must, mustEqual } from "../../assert.js";
import { requirement } from "../../registry.js";
import type { McpSeam } from "../../seams/mcp.js";
import { pollUntil } from "../../util.js";
import { computer, GATE, LAMP, lastDevices, oneSecond, ownerConfigure, SIM_PC, simPc, wire } from "../util.js";

const HEATER = "sim-bridge:heater";

const RACK = "sim-bridge:rack";
const RANK = ["reversible", "confirm", "no_voice"];

type Described = { id: string; protocol?: string; feedback: string; stable_identifier?: string; personal: string[];
  self_changing: string[]; actions: { action: string; tier: string; idempotent: boolean; ack_within_s: number }[] };

/** One device as `describe` gives it, once it is there. */
async function described(mcp: McpSeam, id: string, ms: number): Promise<Described> {
  return pollUntil(async () => ((await mcp.callOk("describe")).devices as Described[]).find((d) => d.id === id), ms, `${id} in describe`);
}

const tierOf = (d: Described, action: string) => d.actions.find((a) => a.action === action)?.tier;

/** Fails unless `d`'s `action` has a tier at or above `floor`. */
function atLeast(d: Described, action: string, floor: string): void {
  const tier = tierOf(d, action);
  must(tier !== undefined && RANK.indexOf(tier) >= RANK.indexOf(floor), `${d.id} ${action} is ${tier}, below ${floor}`, d.actions);
}

/** A devices-document entry for a device new to the applier. */
const newcomer = (id: string, extra: Record<string, unknown>) => ({ id, stableIdentifier: `test:${id}`, transport: "test",
  model: { vendor: "demo", model: id }, capabilities: ["onoff"], sensorKeys: [], feedback: "closed", reachMs: 1000,
  proposedClass: null, actions: [{ action: "onoff.turn_on", idempotent: true, stateless: false, confirms: true }], ...extra });

const up = (kind: string, value: Record<string, unknown>) => ({ op: "upsert", kind, value });

requirement("GA-DESC-3", {
  seam: "applier", fixture: { devices: ["lamp", "gate", "heater", "rack", "pusher"] },
  covers: "the default tiers of a gate, a door lock, a water valve that opens with turn_off, a heating load and infrastructure power; an owner's raise is taken, and so is the owner's lowering of it back to the floor; a lowering of the floor is refused or ignored; a button pusher's extension action is confirm, and the owner's lowering of it to its floor is taken; a plugin's requested_tier raises its action's floor (GA-DESC-11's test); a computer its bridge proposes as infrastructure takes the infrastructure rows until the owner sets the flag; a device a computer hosts takes the computer row, and once the owner sets the host's infrastructure, in the same change set, its infrastructure row for a standard action and the no_voice floor for an extension action; the host's flag cleared, both come back down. A lowering below the floor is GA-DESC-14's test",
}, async (ctx) => {
  const { mcp, owner, bridge } = { mcp: ctx.mcp!, owner: ctx.owner!, bridge: ctx.bridge! };
  await bridge.control({ requestId: "desc-3a", op: "join", device: "door", capabilities: ["lock"], feedback: "closed" });
  await bridge.control({ requestId: "desc-3b", op: "join", device: "valve", capabilities: ["onoff"], feedback: "closed" });
  await described(owner, "sim-bridge:valve", oneSecond(ctx));
  const r = await ownerConfigure(owner, [
    up("adopt", { device: "sim-bridge:door", class: "door_lock" }),
    up("adopt", { device: "sim-bridge:valve", class: "water_valve", declarations: { opens_with: "onoff.turn_off" } }),
    up("load", { device: HEATER, load: "heating" }),
    up("infrastructure", { device: RACK, infrastructure: true }),
    up("tier", { device: LAMP, action: "onoff.turn_on", tier: "confirm" }),
  ]);
  must(r.ok, `the owner's declarations returned ${r.ok ? "" : r.error}`, r.body);
  const gate = await described(mcp, GATE, oneSecond(ctx));
  atLeast(gate, "cover.close", "confirm");
  for (const a of gate.actions.filter((x) => x.action !== "cover.close")) atLeast(gate, a.action, "no_voice");
  atLeast(await described(mcp, "sim-bridge:door", oneSecond(ctx)), "lock.unlock", "no_voice");
  atLeast(await described(mcp, "sim-bridge:valve", oneSecond(ctx)), "onoff.turn_off", "no_voice");
  atLeast(await described(mcp, HEATER, oneSecond(ctx)), "onoff.turn_on", "confirm");
  atLeast(await described(mcp, RACK, oneSecond(ctx)), "onoff.turn_off", "no_voice");
  mustEqual(tierOf(await described(mcp, LAMP, oneSecond(ctx)), "onoff.turn_on"), "confirm", "the lamp's turn_on after the owner raised it");
  const SET_MODE = "org.galatea.test.pusher.set_mode";
  mustEqual(tierOf(await described(mcp, "sim-bridge:pusher", oneSecond(ctx)), SET_MODE), "confirm", "the pusher's extension action");
  const lowered = await ownerConfigure(owner, [up("tier", { device: "sim-bridge:pusher", action: SET_MODE, tier: "reversible" })]);
  must(lowered.ok, `lowering the pusher's extension action to its floor returned ${lowered.ok ? "" : lowered.error}`, lowered.body);
  mustEqual(tierOf(await described(mcp, "sim-bridge:pusher", oneSecond(ctx)), SET_MODE), "reversible", "the pusher's extension action, lowered to its floor");

  // The standard does not choose between refusing a lowering and clamping it: either leaves the tier and the revision as they were.
  const revision = async () => (await owner.callOk("describe")).revision;
  const before = await revision();
  await ownerConfigure(owner, [up("tier", { device: GATE, action: "cover.open", tier: "reversible" })]);
  mustEqual(await revision(), before, "revision after a lowering of the gate's floor");
  atLeast(await described(mcp, GATE, oneSecond(ctx)), "cover.open", "no_voice");
  // The owner's own raise is the owner's to bring back down, to the floor (HS35).
  const back = await ownerConfigure(owner, [up("tier", { device: LAMP, action: "onoff.turn_on", tier: "reversible" })]);
  must(back.ok, `lowering the owner's own raise of the lamp's turn_on to its floor returned ${back.ok ? "" : back.error}`, back.body);
  mustEqual(tierOf(await described(mcp, LAMP, oneSecond(ctx)), "onoff.turn_on"), "reversible", "the lamp's turn_on after the owner lowered it back");

  // A computer proposed as the broker's host, and a plugin's player hosted by another computer (applier, *Plugins' actions*).
  const X = "org.galatea.test.player";
  const player = { id: "player", stableIdentifier: "plugin:player@1", transport: "lan", model: { vendor: "demo", model: "player" },
    capabilities: ["media", "power"], sensorKeys: [], feedback: "closed", reachMs: 1000, proposedClass: "player", classEvidence: "protocol",
    otherAdmins: [], host: "desk",
    actions: [{ action: "power.shutdown", idempotent: false, stateless: true, confirms: true, requestedTier: "reversible", toolHash: "e".repeat(64) },
      { action: `${X}.quit`, idempotent: false, stateless: true, confirms: true, requestedTier: "reversible", toolHash: "f".repeat(64) }],
    extensions: [{ capability: X, actions: [{ action: `${X}.quit`, schema: { type: "object" } }], keys: [] }] };
  // Their identifiers are the simulated PC's own: none is the fixture's (the rack's is `test:rack`).
  await simPc(ctx, [computer("tower", { proposedInfrastructure: true }), computer("desk"), player]);
  const PLAYER = `${SIM_PC}:player`;
  const playerTiers = async () => {
    const d = await described(mcp, PLAYER, oneSecond(ctx));
    return [tierOf(d, "power.shutdown"), tierOf(d, `${X}.quit`)];
  };
  mustEqual(tierOf(await described(mcp, `${SIM_PC}:tower`, oneSecond(ctx)), "power.sleep"), "no_voice",
    "power.sleep on a computer its bridge proposes as infrastructure, the owner having set nothing");
  mustEqual(await playerTiers(), ["confirm", "confirm"], "the hosted player's power.shutdown and extension action, its host not infrastructure");
  const hosted = await ownerConfigure(owner, [up("adopt", { device: `${SIM_PC}:desk`, class: "computer" }),
    up("infrastructure", { device: `${SIM_PC}:desk`, infrastructure: true })]);
  must(hosted.ok, `adopting the player's host as infrastructure returned ${hosted.ok ? "" : hosted.error}`, hosted.body);
  mustEqual(await playerTiers(), ["no_voice", "no_voice"], "the hosted player's tiers once the owner set its host's infrastructure");
  // A lowering below that floor is GA-DESC-14's to grade: none is tried here.
  const cleared = await ownerConfigure(owner, [up("infrastructure", { device: `${SIM_PC}:desk`, infrastructure: false })]);
  must(cleared.ok, `clearing the host's infrastructure returned ${cleared.ok ? "" : cleared.error}`, cleared.body);
  mustEqual(await playerTiers(), ["confirm", "confirm"], "the hosted player's tiers once the owner cleared its host's infrastructure");
});

requirement("GA-DESC-13", {
  seam: "applier", fixture: { devices: ["heater"] },
  covers: "a change of load raises a tier now below its new floor and keeps one at or above it, in the same change set; a change of infrastructure likewise; the flag cleared, the owner's value is back; a load changed from heating to lighting, the owner having set no tier, drops turn_on to its new default, the owner's value never written. A computer's hosted devices are GA-DESC-3's test",
}, async (ctx) => {
  const owner = ctx.owner!;
  const set = async (changes: unknown[], why: string) => {
    const r = await ownerConfigure(owner, changes);
    must(r.ok, `${why} returned ${r.ok ? "" : r.error}`, r.body);
    return described(owner, HEATER, oneSecond(ctx));
  };
  let heater = await set([up("load", { device: HEATER, load: "lighting" }),
    up("tier", { device: HEATER, action: "onoff.turn_off", tier: "confirm" })], "a lighting load");
  mustEqual([tierOf(heater, "onoff.turn_on"), tierOf(heater, "onoff.turn_off")], ["reversible", "confirm"], "the heater's tiers on a lighting load");
  heater = await set([up("load", { device: HEATER, load: "heating" })], "a heating load");
  mustEqual([tierOf(heater, "onoff.turn_on"), tierOf(heater, "onoff.turn_off")], ["confirm", "confirm"],
    "the heater's tiers on a heating load: turn_on raised, turn_off kept");
  heater = await set([up("infrastructure", { device: HEATER, infrastructure: true })], "infrastructure");
  mustEqual(tierOf(heater, "onoff.turn_off"), "no_voice", "the heater's turn_off once it is infrastructure");
  // The flag cleared: the owner's confirm, never rewritten, is back.
  heater = await set([up("infrastructure", { device: HEATER, infrastructure: false })], "infrastructure cleared");
  mustEqual(tierOf(heater, "onoff.turn_off"), "confirm", "the heater's turn_off once it is no longer infrastructure: the owner's value");
  // The owner set no tier on turn_on: the table's confirm goes with the heating load (HS35).
  heater = await set([up("load", { device: HEATER, load: "lighting" })], "the heater back to a lighting load");
  mustEqual(tierOf(heater, "onoff.turn_on"), "reversible", "the heater's turn_on once its load is lighting again, the owner having set no tier");
});

const BOX = "org.galatea.test.box";

/** A plugin device's devices-document entry: a standard action and an extension action, each with its manifest's tier and tool. */
const boxEntry = (id: string, pause: string, go: string, tool: string, schema: Record<string, unknown> = { type: "object" }) =>
  newcomer(id, { stableIdentifier: `plugin:box@${id}`, capabilities: ["media"],
  actions: [{ action: "media.pause", idempotent: true, stateless: false, confirms: true, requestedTier: pause, toolHash: `${tool}`.repeat(64) },
    { action: `${BOX}.go`, idempotent: false, stateless: true, confirms: true, requestedTier: go, toolHash: `${tool}${tool}`.repeat(32) }],
  extensions: [{ capability: BOX, actions: [{ action: `${BOX}.go`, schema }], keys: [] }] });

requirement("GA-DESC-11", {
  seam: "applier", fixture: { devices: ["lamp"] }, timeoutMs: 120_000,
  covers: "a plugin device's media.pause and extension action, their manifest requesting no_voice: a replacement whose manifest requests confirm and reversible keeps both at no_voice, as the owner's value, the extension action's deleted by the owner back to its default under the new manifest (a standard action's delete is GA-DESC-14's); a replacement whose tools changed drops the owner's lowering of the extension action to its floor, back to its default, and keeps media.pause's no_voice, the owner's value; the owner's lowering set again, the subject restarted while the version's tool changes, the lowering falls back once it is back (the tool hash kept across the restart); set again, a replacement whose argument schema changed, the tool the same, drops it too",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  // The seams as they are now: the restart opens others.
  const mcp = () => ctx.mcp!;
  const owner = () => ctx.owner!;
  const doc = lastDevices(bridge);
  const ID = "sim-bridge:box1";
  const publish = async (entry: Record<string, unknown>, id: string) => {
    await bridge.publishRaw("devices", { ...doc, devices: [...doc.devices, entry] }, true);
    await described(owner(), `sim-bridge:${id}`, oneSecond(ctx));
  };
  const tiers = async () => {
    const d = await described(mcp(), ID, oneSecond(ctx));
    return [tierOf(d, "media.pause"), tierOf(d, `${BOX}.go`)];
  };
  const set = async (changes: unknown[], why: string) => {
    const r = await ownerConfigure(owner(), changes);
    must(r.ok, `${why} returned ${r.ok ? "" : r.error}`, r.body);
  };
  await publish(boxEntry("box1", "no_voice", "no_voice", "a"), "box1");
  await set([up("adopt", { device: ID, class: "player" })], "adopting the box");
  mustEqual(await tiers(), ["no_voice", "no_voice"], "the box's tiers, its manifest requesting no_voice");
  // A new version whose manifest requests less: the tiers stay, stored as the owner's value.
  await publish(boxEntry("box2", "confirm", "reversible", "a"), "box2");
  await set([up("adopt", { device: "sim-bridge:box2", class: "player", replaces: ID })], "the box's replacement by a version requesting less");
  mustEqual(await tiers(), ["no_voice", "no_voice"], "the replaced box's tiers: kept from the manifest it replaced");
  // The extension action's kept tier deleted: a standard action's delete is GA-DESC-14's to grade.
  await set([{ op: "delete", kind: "tier", value: { device: ID, action: `${BOX}.go` } }], "deleting the extension action's kept tier");
  mustEqual(await tiers(), ["no_voice", "confirm"], "the box's tiers once the owner deleted the extension action's kept one: its default under the new manifest");
  // The owner lowers the extension action to its floor, media.pause staying at no_voice; a version whose tools changed follows.
  await set([up("tier", { device: ID, action: `${BOX}.go`, tier: "reversible" })], "the owner's lowering");
  mustEqual(await tiers(), ["no_voice", "reversible"], "the box's tiers as the owner set them");
  await publish(boxEntry("box3", "confirm", "reversible", "c"), "box3");
  await set([up("adopt", { device: "sim-bridge:box3", class: "player", replaces: ID })], "the box's replacement by a version whose tools changed");
  mustEqual(await tiers(), ["no_voice", "confirm"], "the box's tiers after its tools changed: the raise kept, the lowering dropped");

  // Set again; the subject restarts while the version's tool changes: the hash it kept is compared once it is back.
  const lower = () => set([up("tier", { device: ID, action: `${BOX}.go`, tier: "reversible" })], "the owner's lowering set again");
  await lower();
  mustEqual(await tiers(), ["no_voice", "reversible"], "the box's tiers with the lowering set again");
  if (!ctx.restartApplier) throw new Error("the subject cannot restart the applier");
  await ctx.restartApplier({ between: () => bridge.publishRaw("devices", { ...doc, devices: [...doc.devices, boxEntry("box3", "confirm", "reversible", "d")] }, true) });
  // What it restored may say the old tool a moment, until the bridge's document is read.
  let after: (string | undefined)[] = [];
  try {
    await pollUntil(async () => (after = await tiers())[1] === "confirm" ? after : undefined, 5 * oneSecond(ctx), "the lowering's fall-back");
  } catch { /* judged below */ }
  mustEqual(after, ["no_voice", "confirm"], "the box's tiers after a restart over which its tool changed: the lowering dropped");

  // Set again; a replacement whose argument schema changed, the tool the same, drops it too.
  await lower();
  await publish(boxEntry("box4", "confirm", "reversible", "d", { type: "object", properties: { speed: { type: "number" } } }), "box4");
  await set([up("adopt", { device: "sim-bridge:box4", class: "player", replaces: ID })], "the box's replacement by a version whose schema changed");
  mustEqual(await tiers(), ["no_voice", "confirm"], "the box's tiers after its schema changed: the lowering dropped");
});

requirement("GA-DESC-4", {
  seam: "applier", fixture: { devices: ["lamp"] },
  covers: "notify, media.announce and an extension action a bridge declares idempotent are listed not idempotent; every action declares idempotency. power.shutdown and media.launch are built and unit-tested, graded once the sim has a computer and a player (the PC build); a plugin's manifest is the PC build's; the owner's idempotent: true at adoption is not offered by this build",
}, async (ctx) => {
  const { mcp, bridge } = { mcp: ctx.mcp!, bridge: ctx.bridge! };
  const doc = lastDevices(bridge);
  const X = "org.galatea.test.speakerx";
  await bridge.publishRaw("devices", { ...doc, devices: [...doc.devices, newcomer("speaker", { capabilities: ["media", "notify"],
    actions: [...["media.announce", "notify.notify", "media.pause"].map((action) => ({ action, idempotent: true, stateless: action !== "media.pause", confirms: true })),
      { action: `${X}.ding`, idempotent: true, stateless: true, confirms: true }],
    extensions: [{ capability: X, actions: [{ action: `${X}.ding`, schema: { type: "object" } }], keys: [] }] })] }, true);
  const speaker = await described(mcp, "sim-bridge:speaker", oneSecond(ctx));
  const idem = Object.fromEntries(speaker.actions.map((a) => [a.action, a.idempotent]));
  mustEqual(idem, { "media.announce": false, "notify.notify": false, "media.pause": true, [`${X}.ding`]: false }, "the speaker's idempotency");
  for (const d of (await mcp.callOk("describe")).devices as Described[]) {
    for (const a of d.actions) must(typeof a.idempotent === "boolean", `${d.id} ${a.action} declares no idempotency`, a);
  }
});

/** Takes the status from the test: its transports are the lamp's `test` and `extra`. */
async function withTransport(ctx: Parameters<Parameters<typeof requirement>[2]>[0], extra: Record<string, unknown>): Promise<void> {
  const bridge = ctx.bridge!;
  bridge.setQuiet(true);
  // Kept by the bridge: a status it sends of its own (an observable change) lists the transport too.
  bridge.addTransport({ state: "up", since: wire(ctx.time.now()), ...extra });
  await bridge.publishStatus();
}

requirement("GA-DESC-5", {
  seam: "applier", fixture: { devices: ["lamp"] },
  covers: "a zigbee device the bridge lists without a stableIdentifier is never described without one; one with it is",
}, async (ctx) => {
  const { mcp, bridge } = { mcp: ctx.mcp!, bridge: ctx.bridge! };
  await withTransport(ctx, { id: "radio", kind: "zigbee" });
  const doc = lastDevices(bridge);
  const { stableIdentifier: _s, ...nameless } = newcomer("nameless", { transport: "radio" });
  await bridge.publishRaw("devices", { ...doc, devices: [...doc.devices, nameless, newcomer("named", { transport: "radio" })] }, true);
  const named = await described(mcp, "sim-bridge:named", oneSecond(ctx));
  mustEqual([named.protocol, named.stable_identifier], ["zigbee", "test:named"], "the named zigbee device's protocol and stable_identifier");
  for (const d of (await mcp.callOk("describe")).devices as Described[]) {
    if (["matter", "zigbee", "zwave"].includes(d.protocol ?? "")) must(!!d.stable_identifier, `${d.id} on ${d.protocol} has no stable_identifier`, d);
  }
});

requirement("GA-DESC-7", {
  seam: "applier", fixture: { devices: ["lamp"] },
  covers: "a device on an ir transport its bridge declares feedback: closed is described feedback: open",
}, async (ctx) => {
  const { mcp, bridge } = { mcp: ctx.mcp!, bridge: ctx.bridge! };
  await withTransport(ctx, { id: "blaster", kind: "ir" });
  const doc = lastDevices(bridge);
  await bridge.publishRaw("devices", { ...doc, devices: [...doc.devices, newcomer("remote", { transport: "blaster" })] }, true);
  const remote = await pollUntil(async () => {
    const d = await described(mcp, "sim-bridge:remote", oneSecond(ctx));
    return d.protocol === "ir" ? d : undefined;
  }, oneSecond(ctx), "the remote on its ir transport");
  mustEqual(remote.feedback, "open", "an ir device's feedback");
});

requirement("GA-DESC-9", {
  seam: "applier", fixture: { devices: ["lamp"] },
  covers: "app and speech personal, speech self_changing, where reported; every key the bridge declares; the owner's added; one the standard declares is not removed. Computer and player keys are built and unit-tested, graded once the sim has a computer and a player (the PC build); a computer's session.<account> keys, internal, and plugins are the PC build's",
}, async (ctx) => {
  const { mcp, owner, bridge } = { mcp: ctx.mcp!, owner: ctx.owner!, bridge: ctx.bridge! };
  const doc = lastDevices(bridge);
  await bridge.publishRaw("devices", { ...doc, devices: [...doc.devices, newcomer("desk", { capabilities: ["sensor", "media"],
    sensorKeys: ["app", "temperature"], actions: [], personal: ["temperature"], selfChanging: ["temperature"] })] }, true);
  await described(owner, "sim-bridge:desk", oneSecond(ctx));
  const r = await ownerConfigure(owner, [up("adopt", { device: "sim-bridge:desk", class: "sensor" }),
    up("personal", { device: "sim-bridge:desk", key: "volume" }), up("self_changing", { device: "sim-bridge:desk", key: "volume" })]);
  must(r.ok, `the owner's keys returned ${r.ok ? "" : r.error}`, r.body);
  const desk = await described(mcp, "sim-bridge:desk", oneSecond(ctx));
  const has = (list: string[], keys: string[], what: string) => must(keys.every((k) => list.includes(k)), `${what} ${JSON.stringify(list)} lacks one of ${keys}`);
  has(desk.personal, ["app", "speech", "temperature", "volume"], "personal");
  has(desk.self_changing, ["speech", "temperature", "volume"], "self_changing");
  // Refused or ignored, the standard does not choose: the key stays and the revision does not move.
  const before = (await owner.callOk("describe")).revision;
  await ownerConfigure(owner, [{ op: "delete", kind: "personal", value: { device: "sim-bridge:desk", key: "app" } }]);
  mustEqual((await owner.callOk("describe")).revision, before, "revision after removing app from personal");
  has((await described(mcp, "sim-bridge:desk", oneSecond(ctx))).personal, ["app"], "personal, after the removal, ");
});

requirement("GA-CFG-3", {
  seam: "applier", fixture: { devices: ["lamp", "gate", "heater"] },
  covers: "an ack_within_s of 1, of 11 on a device reached in 1 s, and of 301 are refused; 300 is taken, and so is 30, below the action's class default (90 for a gate's cover.close). On an applier that claims Safe, a max_on_s of 86401 on a heating socket is refused and 86400 taken. applier_host is refused on a plug, and on a second of a simulated PC bridge's computers while the first holds it; moved from one to the other in one set, it is taken",
}, async (ctx) => {
  const owner = ctx.owner!;
  const ack = (s: number) => up("ack_within_s", { device: LAMP, action: "onoff.turn_on", ack_within_s: s });
  for (const s of [1, 11, 301]) {
    const r = await ownerConfigure(owner, [ack(s)]);
    must(!r.ok && r.error === "invalid_request", `an ack_within_s of ${s} returned ${r.ok ? "a result" : r.error}`, r.body);
  }
  const ok = await ownerConfigure(owner, [ack(300)]);
  must(ok.ok, `an ack_within_s of 300 returned ${ok.ok ? "" : ok.error}`, ok.body);
  mustEqual((await described(owner, LAMP, oneSecond(ctx))).actions.find((a) => a.action === "onoff.turn_on")?.ack_within_s, 300,
    "the lamp's ack_within_s");
  const below = await ownerConfigure(owner, [up("ack_within_s", { device: GATE, action: "cover.close", ack_within_s: 30 })]);
  must(below.ok, `an ack_within_s of 30 on the gate returned ${below.ok ? "" : below.error}`, below.body);
  mustEqual((await described(owner, GATE, oneSecond(ctx))).actions.find((a) => a.action === "cover.close")?.ack_within_s, 30,
    "the gate's cover.close ack_within_s, below the class default");
  if (ctx.claims.includes("Safe")) {
    const heat = await ownerConfigure(owner, [up("load", { device: HEATER, load: "heating" })]);
    must(heat.ok, `load: heating on the heater returned ${heat.ok ? "" : heat.error}`, heat.body);
    const r = await ownerConfigure(owner, [up("max_on_s", { device: HEATER, max_on_s: 86_401 })]);
    must(!r.ok && r.error === "invalid_request", `a max_on_s of 86401 returned ${r.ok ? "a result" : r.error}`, r.body);
    const day = await ownerConfigure(owner, [up("max_on_s", { device: HEATER, max_on_s: 86_400 })]);
    must(day.ok, `a max_on_s of 86400 returned ${day.ok ? "" : day.error}`, day.body);
  } else {
    ctx.evidence("the subject does not claim Safe: its max_on_s clause is not graded");
  }
  // applier_host: one computer, and only a computer.
  await simPc(ctx, [computer("desk"), computer("den")]);
  const [DESK, DEN] = [`${SIM_PC}:desk`, `${SIM_PC}:den`];
  const adopted = await ownerConfigure(owner, [DESK, DEN].map((device) => up("adopt", { device, class: "computer" })));
  must(adopted.ok, `adopting the two computers returned ${adopted.ok ? "" : adopted.error}`, adopted.body);
  const host = (device: string, applier_host = true) => up("applier_host", { device, applier_host });
  const plug = await ownerConfigure(owner, [host(HEATER)]);
  must(!plug.ok && plug.error === "invalid_request", `applier_host on a plug returned ${plug.ok ? "a result" : plug.error}`, plug.body);
  const first = await ownerConfigure(owner, [host(DESK)]);
  must(first.ok, `applier_host on one computer returned ${first.ok ? "" : first.error}`, first.body);
  const second = await ownerConfigure(owner, [host(DEN)]);
  must(!second.ok && second.error === "invalid_request", `applier_host on a second computer returned ${second.ok ? "a result" : second.error}`, second.body);
  const moved = await ownerConfigure(owner, [host(DESK, false), host(DEN)]);
  must(moved.ok, `applier_host moved in one set returned ${moved.ok ? "" : moved.error}`, moved.body);
  ctx.evidence(`refused: ${plug.ok ? "" : plug.message}; ${second.ok ? "" : second.message}`);
});
