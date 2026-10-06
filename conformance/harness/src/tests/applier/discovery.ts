import { bridgeDoc, fixtureDevices } from "@ludentes/galatea-life-sim";
import { must, mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { requirement } from "../../registry.js";
import { pollUntil } from "../../util.js";
import { advanceTo, eventsOf, oneSecond, ownerConfigure, reviveWithin, stillBefore, turnOn, wire } from "../util.js";

// Slice 5b: discovery (applier, *Discovery*), with the harness's simulated finder.

const FINDER = { devices: ["lamp"], finder: true, bridge: { levels: ["Serve", "Provision"], bridgeType: "esphome" } };

const finderSays = async (ctx: TestContext) => (await ctx.owner!.callOk("candidates")).finder as string;

/** Polls `candidates` until `finder` reads `want`. */
const finderIs = (ctx: TestContext, want: string, what: string, ms = oneSecond(ctx) * 3) =>
  pollUntil(async () => ((await finderSays(ctx)) === want ? true : undefined), ms, what, 100);

/**
 * The finder live: it publishes a live status until the applier says so, since a retained one never
 * revives it (GA-BUS-8) and its periodic one comes only every 10 s.
 */
const finderLive = (ctx: TestContext, what: string) => pollUntil(async () => {
  await ctx.finder!.publishStatus();
  return (await finderSays(ctx)) === "live" ? true : undefined;
}, 10_000, what, 200);

requirement("GA-DISC-5", {
  seam: "applier", fixture: FINDER, timeoutMs: 120_000,
  covers: "live on a live status, still live 25 s after it; dead 30 s after the last; dead at once on a will naming the latest instanceId (one naming another "
    + "ignored) and on a graceful status; a status without v makes it dead; a publishedAt 60 s off gives clock in finder_faults; a "
    + "dead finder's list still shown; after a restart of the applier with the finder silenced, its retained status does not make it "
    + "live (GA-BUS-8). That a finder's fault is no bridge_fault is graded by the reference's unit tests, not here",
}, async (ctx) => {
  const f = ctx.finder!;
  await f.setCandidates([{ keys: ["mac:D4A651000010"], sources: ["dhcp"], address: { ip: "192.0.2.20" },
    matches: [{ bridgeType: "esphome", connect: true }] }]);
  await finderLive(ctx, "the finder live");
  f.silence(true);
  // Its last status went out just before: still live 25 s on, dead past 30 s (the 5b preflight's M5). 2 s
  // steps, well under the 5 s skew bound, so the bridge's own statuses never read as skewed; to absolute
  // times, since the harness's clock flows while stepped.
  const lastStatus = ctx.time.now();
  await advanceTo(ctx, lastStatus + 25_000, { chunkMs: 2000 });
  mustEqual(await finderSays(ctx), "live", "the finder 25 s after its last status");
  stillBefore(ctx, lastStatus, 29_000, "the finder live before its 30 s");
  await advanceTo(ctx, lastStatus + 36_000, { chunkMs: 2000 });
  await finderIs(ctx, "dead", "the finder 36 s after its last status");
  const listed = (await ctx.owner!.callOk("candidates")).candidates as { keys: string[] }[];
  must(listed.some((c) => c.keys.includes("mac:D4A651000010")), "a dead finder's last list still shown", listed);
  f.silence(false);
  await finderLive(ctx, "the finder live again");
  await f.publishLwt("not-the-latest");
  // The will naming another instance is delivered before anything published after it: a candidates list, then read.
  await f.setCandidates([]);
  await pollUntil(async () => (((await ctx.owner!.callOk("candidates")).candidates as unknown[]).length === 0 ? true : undefined),
    oneSecond(ctx) * 3, "the list after the will naming another instance");
  mustEqual(await finderSays(ctx), "live", "after a will naming another instance");
  f.kill();
  await finderIs(ctx, "dead", "dead on its will");
  await f.restart({ graceful: true });
  await finderLive(ctx, "live after its restart");
  await f.stop();
  await finderIs(ctx, "dead", "dead on a graceful status");
  await f.start();
  await finderLive(ctx, "live after a start");
  f.dropV(true);
  await f.publishStatus();
  await finderIs(ctx, "dead", "dead on a status without v");
  f.dropV(false);
  f.skew(60_000);
  const faults = await pollUntil(async () => {
    await f.publishStatus();
    const r = await ctx.owner!.callOk("candidates");
    return (r.finder_faults as { code: string }[]).some((x) => x.code === "clock") ? r.finder_faults : undefined;
  }, 10_000, "clock in finder_faults while its publishedAt is 60 s off", 200);
  ctx.evidence(`finder_faults: ${JSON.stringify(faults)}`);
  f.skew(0);
  await finderLive(ctx, "live with its clock right");
  f.silence(true);
  await ctx.restartApplier!();
  const after = await pollUntil(async () => {
    const s = await finderSays(ctx);
    return s === "none" ? undefined : s;
  }, oneSecond(ctx) * 3, "the finder heard after the applier's restart, its retained status delivered");
  mustEqual(after, "dead", "a silenced finder after the applier's restart");
  // Held for a while: nothing but a live status revives it.
  await new Promise((r) => setTimeout(r, 1000));
  mustEqual(await finderSays(ctx), "dead", "a silenced finder a second after the applier's restart");
});

const HELD = "mac:D4A651000001"; // the live bridge's lamp
const DEAD_HELD = "mac:D4A651000002"; // a device of a second bridge, never live
const ON_TRANSPORT = "zigbee:pan-0001"; // the live bridge's transport
const FREE = "mac:D4A651000004";

/** A candidate any esphome bridge could take through connect, heard over DHCP at `ip`. */
const esphome = (key: string, ip: string) => ({ keys: [key], sources: ["dhcp"], address: { ip }, matches: [{ bridgeType: "esphome", connect: true }] });

requirement("GA-DISC-1", {
  seam: "applier", fixture: FINDER,
  covers: "a candidate whose keys match no device is no device: describe names nothing of it, and a client's plan naming its id gives "
    + "skip(unknown_target), never op. That it reaches the model only through a bridge's devices and adoption is GA-DISC-4's connect",
}, async (ctx) => {
  const f = ctx.finder!;
  await f.setCandidates([esphome("mac:D4A651000099", "192.0.2.99")]);
  const id = f.candidateId("mac:D4A651000099");
  await pollUntil(async () => ((await ctx.owner!.callOk("candidates")).candidates as { id: string }[]).some((c) => c.id === id) || undefined,
    oneSecond(ctx) * 3, "the candidate listed");
  const d = await ctx.mcp!.callOk("describe");
  must(!JSON.stringify(d).includes(id) && !JSON.stringify(d).includes("D4A651000099"), "describe names nothing of the candidate", d);
  const p = await ctx.mcp!.callOk("plan", { actions: [turnOn(id)] });
  mustEqual((p.steps as { verdict: string; reason?: string }[]).map((x) => [x.verdict, x.reason]), [["skip", "unknown_target"]],
    "the step naming a candidate");
});

requirement("GA-DISC-2", {
  seam: "applier", timeoutMs: 120_000,
  fixture: { ...FINDER, devices: [{ id: "lamp", connections: [HELD] }], bridge: { ...FINDER.bridge, transportConnections: [ON_TRANSPORT] } },
  covers: "a client's candidates is not_permitted; finder_sources shows dhcp off; candidates sharing a key with the live bridge's device, "
    + "its transport, or a dead bridge's device are hidden, the rest listed with offers naming the live Provision bridge of the type and "
    + "not the dead one; no event carries a candidate; across a restart whose between clears the dead bridge's retained devices, the "
    + "held candidate stays hidden. An adapter's finder: none is the adapters'",
}, async (ctx) => {
  const { owner, bridge } = { owner: ctx.owner!, bridge: ctx.bridge! };
  const f = ctx.finder!;
  // A second bridge, registered and never live: its retained status and devices only (dead, GA-BUS-8).
  await bridge.publishAs("sim-bridge-2", "status", { bridgeId: "sim-bridge-2", instanceId: "00000000-0000-4000-8000-0000000000d1", v: 1,
    state: "online", version: "0.0.0", levels: ["Serve", "Provision"], bridgeType: "esphome", faults: [], ungoverned: [], blocked: [],
    transports: [{ id: "test", kind: "other", state: "up", since: wire(ctx.time.now()) }], devices: [], testRunId: ctx.runId,
    publishedAt: wire(ctx.time.now()) }, true);
  await bridge.publishAs("sim-bridge-2", "devices", { publishedAt: wire(ctx.time.now()),
    devices: [bridgeDoc({ ...fixtureDevices(["lamp"])[0]!, id: "spare", connections: [DEAD_HELD] })] }, true);
  const reg = await ownerConfigure(owner, [{ op: "upsert", kind: "bridge", value: { id: "sim-bridge-2", identity: "sim-bridge-2" } }]);
  must(reg.ok, "registering sim-bridge-2", reg.body);
  f.setSources([{ source: "mdns", state: "up" }, { source: "dhcp", state: "off" }]);
  const { cursor } = await owner.callOk("events");
  await f.setCandidates([esphome(HELD, "192.0.2.1"), esphome(DEAD_HELD, "192.0.2.2"), esphome(ON_TRANSPORT, "192.0.2.3"), esphome(FREE, "192.0.2.4")]);
  const r = await pollUntil(async () => {
    await f.publishStatus();
    const x = await owner.callOk("candidates");
    const keys = (x.candidates as { keys: string[] }[]).flatMap((c) => c.keys);
    return keys.length === 1 && keys[0] === FREE && x.finder === "live" ? x : undefined;
  }, 10_000, "only the free candidate listed, the finder live", 200);
  ctx.evidence(`candidates: ${JSON.stringify(r.candidates)}`);
  mustEqual((r.candidates as { offers: unknown }[])[0]!.offers, [{ bridge_type: "esphome", connect: true, bridges: ["sim-bridge"] }], "its offers");
  must((r.finder_sources as { source: string; state: string }[]).some((s) => s.source === "dhcp" && s.state === "off"), "dhcp off shown",
    r.finder_sources);
  const refused = await ctx.mcp!.call("candidates", {});
  mustEqual(refused.ok ? "ok" : refused.error, "not_permitted", "a client's candidates");
  const ids = [HELD, DEAD_HELD, ON_TRANSPORT, FREE].map((k) => f.candidateId(k));
  const evs = JSON.stringify((await owner.callOk("events", { cursor })).events);
  for (const x of [HELD, DEAD_HELD, ON_TRANSPORT, FREE, ...ids]) must(!evs.includes(x), `no event carries ${x}`);
  await ctx.restartApplier!({ between: () => bridge.publishAs("sim-bridge-2", "devices", "", true) });
  // The restart reconnects the owner's seam in place: read it from ctx again.
  const after = await pollUntil(async () => {
    await f.publishStatus();
    const x = await ctx.owner!.callOk("candidates");
    return x.finder === "live" ? (x.candidates as { keys: string[] }[]).flatMap((c) => c.keys) : undefined;
  }, 10_000, "the finder live after the restart", 200);
  must(!after.includes(DEAD_HELD), "the dead bridge's device's candidate still hidden after the restart", after);
  must(after.includes(FREE) && !after.includes(HELD) && !after.includes(ON_TRANSPORT), "the rest as before the restart", after);
});

requirement("GA-DISC-3", {
  seam: "applier", fixture: FINDER, timeoutMs: 120_000,
  covers: "ignore_candidate hides the candidate and every candidate sharing a key, after the finder moves its address and after the "
    + "finder's restart gives it a new id, and across a restart of the applier; ignored_keys holds its keys; revision unmoved and no "
    + "model event; an id not listed and a key not ignored are invalid_request; unignore_candidate lists it again",
}, async (ctx) => {
  const f = ctx.finder!;
  const c = { keys: ["mac:D4A651000030", "mdns:demo-30._esphomelib._tcp.local."], sources: ["dhcp", "mdns"], address: { ip: "192.0.2.30" },
    matches: [{ bridgeType: "esphome", connect: true }] };
  const sibling = { ...c, keys: ["mdns:demo-30._esphomelib._tcp.local.", "usn:demo-31"], address: { ip: "192.0.2.31" } };
  const listedKeys = async () => ((await ctx.owner!.callOk("candidates")).candidates as { keys: string[] }[]).flatMap((x) => x.keys);
  await f.setCandidates([c]);
  await pollUntil(async () => (await listedKeys()).includes("mac:D4A651000030") || undefined, oneSecond(ctx) * 3, "the candidate listed");
  const before = (await ctx.owner!.callOk("describe")).revision;
  const { cursor } = await ctx.owner!.callOk("events");
  const r = await ctx.owner!.call("configure", { changes: [{ op: "upsert", kind: "ignore_candidate", value: { id: f.candidateId("mac:D4A651000030") } }],
    dry_run: false });
  must(r.ok, "an ignore with no expected_revision", r.body);
  mustEqual((await ctx.owner!.callOk("candidates")).ignored_keys, [...c.keys].sort(), "ignored_keys");
  mustEqual((await ctx.owner!.callOk("describe")).revision, before, "the revision after an ignore");
  const evs = (await ctx.owner!.callOk("events", { cursor })).events as { type: string }[];
  must(!evs.some((e) => e.type === "model"), "no model event for an ignore", evs);
  await f.setCandidates([{ ...c, address: { ip: "192.0.2.40" } }, sibling]);
  await f.restart();
  await f.setCandidates([{ ...c, address: { ip: "192.0.2.41" } }, sibling, { ...c, keys: ["mac:D4A651000032"], address: { ip: "192.0.2.32" } }]);
  await ctx.restartApplier!();
  // The finder live, and its latest list read: the unrelated candidate shows.
  const keys = await pollUntil(async () => {
    await f.publishStatus();
    const x = await ctx.owner!.callOk("candidates");
    const k = (x.candidates as { keys: string[] }[]).flatMap((y) => y.keys);
    return x.finder === "live" && k.includes("mac:D4A651000032") ? k : undefined;
  }, 10_000, "the finder live after the applier's restart, its list read", 200);
  must(!keys.includes("mac:D4A651000030") && !keys.includes("usn:demo-31"),
    "the ignored candidate and its key-sharing sibling hidden, after a move, the finder's restart and the applier's", keys);
  const bad = async (change: unknown) => {
    const x = await ctx.owner!.call("configure", { changes: [change], dry_run: false });
    return x.ok ? "ok" : x.error;
  };
  mustEqual(await bad({ op: "upsert", kind: "ignore_candidate", value: { id: "00000000-0000-4000-8000-000000000000" } }), "invalid_request", "an id not listed");
  mustEqual(await bad({ op: "upsert", kind: "unignore_candidate", value: { key: "mac:D4A651000099" } }), "invalid_request", "a key not ignored");
  for (const key of c.keys) mustEqual(await bad({ op: "upsert", kind: "unignore_candidate", value: { key } }), "ok", `unignoring ${key}`);
  await pollUntil(async () => {
    const k = await listedKeys();
    return k.includes("mac:D4A651000030") && k.includes("usn:demo-31") || undefined;
  }, oneSecond(ctx) * 3, "both listed again once unignored");
});

const CONNECTABLE = { keys: ["mac:D4A651000060", "mdns:demo-60.local."], sources: ["dhcp", "mdns"], address: { ip: "192.0.2.60" },
  matches: [{ bridgeType: "esphome", connect: true }, { bridgeType: "tasmota", connect: false }] };

/** The `provision` events among `evs` carrying `requestId`. */
const endsOf = (evs: { type: string }[], requestId: string) =>
  evs.filter((e) => e.type === "provision" && (e as { request_id?: unknown }).request_id === requestId) as Record<string, any>[];
/** A connect's end naming a device: its connected. */
const connected = (e: Record<string, any>) => e.device !== undefined;
/** A connect's end with a reason: its connect_failed. */
const failed = (e: Record<string, any>) => e.reason !== undefined;

requirement("GA-DISC-4", {
  seam: "applier", fixture: FINDER, timeoutMs: 300_000,
  covers: "not_claimed for an unknown bridge, a bridge whose match says connect false, a bridge of another type, one without "
    + "Provision; invalid_request for an id not listed, a missing address, an address on a candidate that has none, the address the "
    + "finder moved since; the bridge's connect carries the owner's address and the candidate's keys, and provision's request_id; "
    + "connected carries the request_id and a cause; accepted then silence, the bridge kept live: no connect_failed before 70 s "
    + "(checked 66 s after the request, still under 70 s), exactly one connect_failed(lost) with the request_id and a cause by 70 s "
    + "and a step, a later connected issued too; a second connect while the first is in flight answered failed(busy), and never "
    + "ended again; a connect ended lost within 1 s of "
    + "its bridge's death; unreachable with a request_id for a qualifying dead bridge; a connect in flight across a crash of the "
    + "applier ends lost exactly once. That connected's device is unadopted is GA-ADOPT's",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  const f = ctx.finder!;
  const owner = () => ctx.owner!;
  const ble = { keys: ["ble:D4A651000061"], sources: ["ble"], matches: [{ bridgeType: "esphome", connect: true }] };
  await f.setCandidates([CONNECTABLE, ble]);
  const id = f.candidateId("mac:D4A651000060");
  await pollUntil(async () => ((await owner().callOk("candidates")).candidates as { id: string }[]).some((c) => c.id === id) || undefined,
    oneSecond(ctx) * 3, "the candidate listed");
  const code = async (args: unknown) => {
    const r = await owner().call("provision", { connect: args });
    return r.ok ? (r.body as { status: string }).status : r.error;
  };
  /** Polls until the candidate `id`'s offer of `type` names the bridge, or (`type` undefined) no offer names it. */
  const offered = (type: string | undefined, what: string) => pollUntil(async () => {
    const c = ((await owner().callOk("candidates")).candidates as { id: string; offers: { bridge_type: string; bridges: string[] }[] }[])
      .find((x) => x.id === id);
    const naming = c?.offers.filter((o) => o.bridges.includes("sim-bridge")).map((o) => o.bridge_type) ?? [];
    return (type === undefined ? naming.length === 0 : naming.includes(type)) ? true : undefined;
  }, oneSecond(ctx) * 3, what, 100);
  const addr = CONNECTABLE.address;
  const sent = () => bridge.requests.filter((r) => r.op === "connect").length;
  const before = sent();
  mustEqual(await code({ candidate: id, bridge: "nobody", address: addr }), "not_claimed", "an unknown bridge");
  mustEqual(await code({ candidate: "00000000-0000-4000-8000-000000000000", bridge: "sim-bridge", address: addr }), "invalid_request",
    "an id not listed");
  mustEqual(await code({ candidate: id, bridge: "sim-bridge" }), "invalid_request", "a missing address");
  mustEqual(await code({ candidate: f.candidateId("ble:D4A651000061"), bridge: "sim-bridge", address: addr }), "invalid_request",
    "an address on a candidate that has none");
  const moved = { ip: "192.0.2.61" };
  await f.setCandidates([{ ...CONNECTABLE, address: moved }, ble]);
  await pollUntil(async () => ((await owner().callOk("candidates")).candidates as { address?: { ip: string } }[]).some((c) => c.address?.ip === moved.ip) || undefined,
    oneSecond(ctx) * 3, "the moved address listed");
  mustEqual(await code({ candidate: id, bridge: "sim-bridge", address: addr }), "invalid_request", "the address the finder moved since");
  // The type and level clauses, each read before it is asked (its offers say so): tasmota, whose match says
  // connect false; a type the candidate does not match; then esphome without Provision.
  await bridge.setType("tasmota");
  await offered("tasmota", "the bridge read as tasmota");
  mustEqual(await code({ candidate: id, bridge: "sim-bridge", address: moved }), "not_claimed", "a bridge whose match says connect false");
  await bridge.setType("matter");
  await offered(undefined, "the bridge read as matter");
  mustEqual(await code({ candidate: id, bridge: "sim-bridge", address: moved }), "not_claimed", "a bridge of another type");
  await bridge.setType("esphome");
  await offered("esphome", "the bridge read as esphome again");
  await bridge.setLevels(["Serve"]);
  await offered(undefined, "the bridge read without Provision");
  mustEqual(await code({ candidate: id, bridge: "sim-bridge", address: moved }), "not_claimed", "a bridge without Provision");
  mustEqual(sent(), before, "no connect sent for a refused one");
  await bridge.setLevels(["Serve", "Provision"]);
  await offered("esphome", "the bridge read with Provision again");
  // Taken: the request, then connected. A connect's events are found by their request_id: the one naming
  // a device is its connected, the one with a reason its connect_failed; each must carry a cause, which
  // the text does not name (as GA-EVT-5 grades a provision event).
  const { cursor } = await owner().callOk("events");
  const took = await owner().callOk("provision", { connect: { candidate: id, bridge: "sim-bridge", address: moved } });
  const req = bridge.requests.filter((r) => r.op === "connect").at(-1)!.body as Record<string, unknown>;
  mustEqual([req.address, req.keys, took.request_id], [moved, CONNECTABLE.keys, req.requestId], "the bridge's connect, and its request_id");
  const done = await pollUntil(async () => endsOf(await eventsOf(owner(), cursor), took.request_id).find(connected),
    oneSecond(ctx) * 3, "connected, carrying the request_id");
  must(done.cause !== undefined, "connected carries a cause", done);
  // The 70 s clause, the bridge kept live by its own statuses (I6).
  await f.setCandidates([{ ...CONNECTABLE, keys: ["mac:D4A651000062"], address: { ip: "192.0.2.62" } }]);
  const quiet = f.candidateId("mac:D4A651000062");
  const askedAt = ctx.time.now();
  const c2 = await pollUntil(async () => {
    bridge.script("connect", { reply: "accepted", silent: true });
    const r = await owner().call("provision", { connect: { candidate: quiet, bridge: "sim-bridge", address: { ip: "192.0.2.62" } } });
    return r.ok ? r.body as Record<string, any> : undefined;
  }, oneSecond(ctx) * 3, "the quiet candidate's connect", 100);
  const answeredAt = ctx.time.now();
  mustEqual(c2.status, "accepted", "the quiet connect accepted");
  // A second connect while the first is in flight: the bridge's failed(busy) is its end, never lost later.
  const busy = await owner().callOk("provision", { connect: { candidate: quiet, bridge: "sim-bridge", address: { ip: "192.0.2.62" } } });
  mustEqual(busy.status, "failed", "a second connect while the first is in flight, answered failed(busy)");
  const failedOf = async (requestId: string) => endsOf(await eventsOf(owner(), cursor), requestId).filter(failed);
  // To an absolute time, counted from before the request, 4 s before the 70 s (the 5b preflight's I5 and M2).
  await advanceTo(ctx, askedAt + 66_000, { chunkMs: 1000 });
  const early = await failedOf(c2.request_id);
  stillBefore(ctx, askedAt, 70_000, "no connect_failed before 70 s");
  mustEqual(early.length, 0, "connect_failed before 70 s");
  const died = (await eventsOf(owner(), cursor, "liveness")).filter((e) => e.new === "dead");
  mustEqual(died, [], "nothing died while the bridge was kept live");
  await advanceTo(ctx, answeredAt + 71_000, { chunkMs: 1000 });
  const lost = await pollUntil(async () => { const l = await failedOf(c2.request_id); return l.length ? l : undefined; },
    oneSecond(ctx), "connect_failed(lost) by 70 s and a step");
  mustEqual(lost.map((e) => e.reason), ["lost"], "exactly one connect_failed, lost");
  must(lost[0]!.cause !== undefined, "connect_failed carries a cause", lost[0]);
  mustEqual(endsOf(await eventsOf(owner(), cursor), busy.request_id), [], "no event for the connect its failed(busy) ended, 70 s on");
  await bridge.publishEvent("connected", { requestId: c2.request_id, device: "late-1" });
  await pollUntil(async () => endsOf(await eventsOf(owner(), cursor), c2.request_id).find(connected),
    oneSecond(ctx), "the later connected issued too");
  // The death clause, apart.
  await f.setCandidates([{ ...CONNECTABLE, keys: ["mac:D4A651000063"], address: { ip: "192.0.2.63" } }]);
  const third = f.candidateId("mac:D4A651000063");
  const c3 = await pollUntil(async () => {
    bridge.script("connect", { reply: "accepted", silent: true });
    const r = await owner().call("provision", { connect: { candidate: third, bridge: "sim-bridge", address: { ip: "192.0.2.63" } } });
    return r.ok ? r.body as Record<string, any> : undefined;
  }, oneSecond(ctx) * 3, "the third candidate's connect", 100);
  bridge.kill();
  await pollUntil(async () => (await failedOf(c3.request_id))[0],
    oneSecond(ctx), "connect_failed(lost) within 1 s of the bridge's death");
  // A qualifying dead bridge: published to, answered unreachable at once.
  const c4 = await owner().callOk("provision", { connect: { candidate: third, bridge: "sim-bridge", address: { ip: "192.0.2.63" } } });
  mustEqual(c4.status, "unreachable", "a connect to a dead bridge");
  must(typeof c4.request_id === "string" && c4.request_id !== "", "an unreachable connect carries its request_id", c4);
  await bridge.start();
  await reviveWithin(ctx, ["sim-bridge:lamp"], oneSecond(ctx) * 5, "after the bridge's start");
  // Across a restart (K2).
  await f.setCandidates([{ ...CONNECTABLE, keys: ["mac:D4A651000064"], address: { ip: "192.0.2.64" } }]);
  const fifth = f.candidateId("mac:D4A651000064");
  const from = wire(ctx.time.now() - 1000);
  const c5 = await pollUntil(async () => {
    bridge.script("connect", { reply: "accepted", silent: true });
    const r = await owner().call("provision", { connect: { candidate: fifth, bridge: "sim-bridge", address: { ip: "192.0.2.64" } } });
    return r.ok && (r.body as { status: string }).status === "accepted" ? r.body as Record<string, any> : undefined;
  }, oneSecond(ctx) * 3, "the fifth candidate's connect accepted", 100);
  // A crash, so the last life's broker loss does not end it first: only the resume may (K2).
  await ctx.restartApplier!({ crash: true });
  await ctx.time.advance(75_000, { chunkMs: 1000 });
  const ended = async () => ((await owner().callOk("history", { from, to: wire(ctx.time.now() + 1000) })).events as Record<string, any>[])
    .filter((e) => e.type === "provision" && e.request_id === c5.request_id && failed(e));
  await pollUntil(async () => ((await ended()).length ? true : undefined), oneSecond(ctx) * 3, "the connect in flight ended after the restart");
  mustEqual((await ended()).length, 1, "connect_failed for the connect in flight across the restart");
});
