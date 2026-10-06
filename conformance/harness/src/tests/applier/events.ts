import { randomUUID } from "node:crypto";
import { must, mustEqual } from "../../assert.js";
import { requirement } from "../../registry.js";
import { pollUntil, sleep } from "../../util.js";
import { afterLoss, client, HOUR, LAMP, lastDevices, oneSecond, ownerConfigure, wire } from "../util.js";

requirement("GA-EVT-4", {
  seam: "applier", fixture: { devices: ["lamp"] }, timeoutMs: 90_000,
  covers: "events served in a 1 s window while the store is stalled (a database: true subject; otherwise none), then a crash: a cursor of the last life then reads every event it was served after it, or is cursor_expired (a subject that serves none before keeping them owes none); an event 3590 s old is still served from its cursor; past 3600 s the cursor is cursor_expired",
}, async (ctx) => {
  // A loss: events served while the store cannot keep them, then a crash.
  const before = (await ctx.mcp!.callOk("events")).cursor as string;
  const release = ctx.stallStore ? await ctx.stallStore() : undefined;
  if (!release) ctx.evidence("no database: a plain crash");
  for (const on of [true, false]) {
    await ctx.bridge!.control({ requestId: `evt-4-${on}`, op: "report", device: "lamp", values: { on }, observedAt: wire(ctx.time.now()) });
  }
  // Whatever the subject serves in a 1 s window, possibly nothing: one that commits each event before
  // serving it serves none while its store is stalled. Each read is bounded, since such a subject's
  // `events` may itself wait on the store.
  let served: Record<string, unknown>[] = [];
  const until = Date.now() + oneSecond(ctx);
  while (Date.now() < until && served.length < 2) {
    const r = await Promise.race([ctx.mcp!.call("events", { cursor: before }).catch(() => undefined), sleep(250).then(() => undefined)]);
    if (r?.ok) served = (r.body.events as Record<string, unknown>[]).filter((x) => x.type === "state" && x.target === LAMP);
    if (served.length < 2) await sleep(50);
  }
  ctx.evidence(`served before the crash: ${served.length} state events of the lamp`);
  await ctx.restartApplier!({ crash: true, between: release });
  const again = await ctx.mcp!.call("events", { cursor: before });
  ctx.evidence(`after the crash: ${again.ok ? `${again.body.events.length} events` : again.error}`);
  const lost = afterLoss(served, again);
  must(lost === undefined, lost ?? "", again.body);

  // The hour, on a fresh cursor of this life.
  const mcp = ctx.mcp!;
  const { cursor } = await mcp.callOk("events");
  const r = await ownerConfigure(ctx.owner!, [client("evt-4", randomUUID())]);
  must(r.ok, `configure returned ${r.ok ? "" : r.error}`, r.body);
  const fresh = await mcp.callOk("events", { cursor });
  must(fresh.events.length > 0, "a client's registration made no event to read");

  await ctx.time.stepAndWait(HOUR - 10_000);
  const kept = await mcp.call("events", { cursor });
  must(kept.ok && kept.body.events.length > 0,
    `3590 s later the cursor returned ${kept.ok ? "no events" : kept.error}`, kept.body);

  await ctx.time.stepAndWait(20_000);
  const old = await mcp.call("events", { cursor });
  ctx.evidence(`at 3590 s: ${kept.body.events.length} events; at 3610 s: ${old.ok ? `${old.body.events.length} events` : old.error}`);
  must(!old.ok && old.error === "cursor_expired",
    `a cursor 3610 s old returned ${old.ok ? "events" : old.error}, not cursor_expired`, old.body);
});

const SHAKE = "org.galatea.test.vibration";

type StateEvent = { type: string; seq: number; target?: string; cause?: unknown };

requirement("GA-EVT-2", {
  seam: "applier", fixture: { devices: ["lamp"] },
  covers: "the state events of two plain bridge reports each carry the cause external, and history returns the same causes in the same order; the causes of applies, safety rules and load caps are slices 4 and 6's",
}, async (ctx) => {
  const { mcp, bridge } = { mcp: ctx.mcp!, bridge: ctx.bridge! };
  const from = wire(ctx.time.now() - 1000);
  const { cursor } = await mcp.callOk("events");
  await bridge.control({ requestId: "evt-2a", op: "report", device: "lamp", values: { on: true }, observedAt: wire(ctx.time.now()) });
  await bridge.control({ requestId: "evt-2b", op: "report", device: "lamp", values: { on: false }, observedAt: wire(ctx.time.now()) });
  const served = await pollUntil(async () => {
    const e = ((await mcp.callOk("events", { cursor })).events as StateEvent[]).filter((x) => x.type === "state" && x.target === LAMP);
    return e.length >= 2 ? e : undefined;
  }, oneSecond(ctx), "two state events for the lamp");
  // A plain bridge report, of a key the lamp does not change by itself, is caused from outside.
  must(served.every((e) => e.cause === "external"), "every state event of a bridge report has cause external", served);
  const history = await mcp.callOk("history", { from, to: wire(ctx.time.now() + 1000), targets: [LAMP] });
  // From the first served on: the fixture's own first report may share the range.
  const kept = (history.events as StateEvent[]).filter((e) => e.type === "state" && e.seq >= served[0]!.seq);
  ctx.evidence(`events: ${JSON.stringify(served.map((e) => e.cause))}`);
  mustEqual(kept.map((e) => [e.seq, e.cause]), served.map((e) => [e.seq, e.cause]), "history's state events and causes");
});

requirement("GA-EVT-5", {
  seam: "applier", fixture: { devices: ["lamp", "speaker", "shaker"] }, timeoutMs: 120_000,
  covers: "state, liveness, model, freshness, transport, bridge_fault, route_conflict, other_admins, occurrence and provision events are in history 7 days less a minute later, with their causes, a speaker's speech reading and an occurrence of a key in the device's personal, when it happened or now, in events only; a provision event naming a device that joined, by its device or devices, with a cause, the same in events and history, and matched by targets naming that device. Its other fields (the kind of change, which cause) are not graded: the text does not name them. Outcome, late_ack, rule_fired and latch are the slices that raise them",
}, async (ctx) => {
  const { mcp, owner, bridge } = { mcp: ctx.mcp!, owner: ctx.owner!, bridge: ctx.bridge! };
  const from = wire(ctx.time.now() - 1000);
  const { cursor } = await mcp.callOk("events");
  await bridge.control({ requestId: "evt-5a", op: "report", device: "lamp", values: { on: true }, observedAt: wire(ctx.time.now()) });
  await bridge.control({ requestId: "evt-5s", op: "report", device: "speaker", values: { speech: "hello" }, observedAt: wire(ctx.time.now()) });
  // The shaker's alarm is kept in history; its presence, a key in its personal, is not.
  await bridge.control({ requestId: "evt-5o", op: "report", device: "shaker", values: { [`${SHAKE}.alarm`]: true, [`${SHAKE}.presence`]: true },
    observedAt: wire(ctx.time.now()) });
  await bridge.setAvailable("lamp", false);
  await bridge.setAvailable("lamp", true);
  const r = await ownerConfigure(owner, [{ op: "upsert", kind: "fresh_s", value: { device: LAMP, fresh_s: 30 } }]);
  must(r.ok, `the owner's fresh_s returned ${r.ok ? "" : r.error}`, r.body);
  await bridge.control({ requestId: "evt-5b", op: "transportState", state: "down" });
  await bridge.control({ requestId: "evt-5c", op: "transportState", state: "up" });
  await bridge.publishRaw("devices/lamp/status", "{", true);
  // An admin of the lamp, and two arrivals, neither adopted, showing one identifier: a route
  // conflict that no adoption is at stake in, so GA-BUS-11's negative leaves it alone.
  const doc = lastDevices(bridge);
  const lamp = doc.devices.find((d) => d.id === "lamp")!;
  await bridge.publishRaw("devices", { ...doc, devices: [{ ...lamp, otherAdmins: [{ vendor: "demo", label: "remote" }] },
    { ...lamp, id: "twin-1", stableIdentifier: "test:twin" }, { ...lamp, id: "twin-2", stableIdentifier: "test:twin" }] }, true);
  // A device joins: a provision event names it (slice 5a).
  await bridge.control({ requestId: "evt-5j", op: "join", device: "kettle", capabilities: ["onoff"], feedback: "closed" });
  const namesKettle = (x: { type: string; device?: unknown; devices?: unknown }) => x.type === "provision"
    && (x.device === "sim-bridge:kettle" || (Array.isArray(x.devices) && x.devices.includes("sim-bridge:kettle")));
  const WANT = ["bridge_fault", "freshness", "liveness", "model", "occurrence", "other_admins", "provision", "route_conflict", "state", "transport"];
  const served = await pollUntil(async () => {
    const e = (await mcp.callOk("events", { cursor })).events as { seq: number; type: string; key?: string; cause?: unknown }[];
    return WANT.every((t) => e.some((x) => x.type === t)) && e.some(namesKettle) && e.some((x) => x.key === "speech") && e.some((x) => x.key === `${SHAKE}.presence`)
      ? e : undefined;
  }, oneSecond(ctx) * 3, `events of each type (${WANT.join(", ")}), a speech reading and the shaker's presence`);
  const to = wire(ctx.time.now() + 1000);
  // Liveness, transport and faults go on changing while time passes: only what `events` served is compared.
  // A day at a time, then the last hour alone: the subject's timers fire after each chunk, so a prune
  // at 7 days less an hour and a minute has committed before the read, as hour-long chunks gave, in
  // eight chunks rather than 168.
  await ctx.time.advance(7 * 24 * HOUR - HOUR - 60_000, { chunkMs: 24 * HOUR });
  await ctx.time.advance(HOUR, { chunkMs: HOUR });
  const kept = (await mcp.callOk("history", { from, to })).events as { seq: number; type: string; key?: string; cause?: unknown }[];
  const bySeq = new Map(kept.map((e) => [e.seq, e]));
  const kept_out = (e: { type: string; key?: string }) => e.key === "speech" || (e.type === "occurrence" && e.key === `${SHAKE}.presence`);
  const expected = served.filter((e) => !kept_out(e));
  ctx.evidence(`served ${served.length}, history ${kept.length}`);
  // Each as `events` served it, fields and causes, whatever order its keys come in, at any depth
  // (an other_admins entry's keys too: a jsonb store gives them back in its own order).
  const sorted = (e: unknown): unknown => Array.isArray(e) ? e.map(sorted)
    : e && typeof e === "object" ? Object.fromEntries(Object.entries(e).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sorted(v)])) : e;
  mustEqual(expected.map((e) => sorted(bySeq.get(e.seq))), expected.map(sorted), "the events served, as history gives them 7 days less a minute later");
  must(!kept.some((e) => e.key === "speech"), "history holds no speech reading", kept);
  must(!kept.some(kept_out), "history holds no occurrence of the shaker's presence, a personal key", kept);
  // A key the owner marks personal later hides its earlier occurrences too: personal when it happened or now.
  must(kept.some((e) => e.type === "occurrence" && e.key === `${SHAKE}.alarm`), "history holds the shaker's alarm before it is personal", kept);
  const p = await ownerConfigure(owner, [{ op: "upsert", kind: "personal", value: { device: "sim-bridge:shaker", key: `${SHAKE}.alarm` } }]);
  must(p.ok, `marking the shaker's alarm personal returned ${p.ok ? "" : p.error}`, p.body);
  // Compared above with what `events` served, cause and all; here it must have one.
  const joined = served.find(namesKettle);
  must(joined !== undefined && joined.cause !== undefined && joined.cause !== null && bySeq.get(joined.seq)?.cause !== undefined,
    "the provision event naming the joined device carries a cause, in events and in history", joined);
  const byTarget = (await mcp.callOk("history", { from, to, targets: ["sim-bridge:kettle"] })).events as { type: string }[];
  must(byTarget.some((e) => e.type === "provision"), "history with targets naming the joined device returns its provision event", byTarget);
  const later = (await mcp.callOk("history", { from, to })).events as { type: string; key?: string }[];
  must(!later.some((e) => e.type === "occurrence" && e.key === `${SHAKE}.alarm`), "history holds no occurrence of the alarm once the owner marked it personal", later);
});
