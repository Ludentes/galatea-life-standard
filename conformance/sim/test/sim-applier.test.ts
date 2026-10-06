import { signToken } from "@ludentes/galatea-life-binding";
import { validate } from "@ludentes/galatea-life-schemas";
import { TestClock } from "@ludentes/galatea-life-test-clock";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { connectAsync } from "mqtt";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { serveMcp } from "../src/applier/mcp.js";
import { PLANS_WITH_SIDE_EFFECT, SimApplier, SPEAKS_ONLY_2025 } from "../src/applier/sim-applier.js";
import { SimBridge } from "../src/bridge/sim-bridge.js";
import { startBroker, type Broker } from "../src/broker.js";
import { fixtureDevices } from "../src/fixture.js";
import { freePort } from "../src/net.js";
import { TimeServer } from "../src/time-server.js";

let broker: Broker;
let time: TimeServer;
let n = 0;
const cleanup: (() => unknown)[] = [];
beforeAll(async () => { broker = await startBroker(); time = await TimeServer.start(); }, 60_000);
afterAll(async () => { await time.close(); await broker.stop(); });
afterEach(async () => { while (cleanup.length) await cleanup.pop()!(); time.reset(); });

async function connect(url: string, bearer: string, era: "legacy" | "auto" = "auto") {
  const client = new Client({ name: "sim-test", version: "0.0.0" }, { versionNegotiation: { mode: era } });
  await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${bearer}` } } }));
  cleanup.push(() => client.close());
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as { structuredContent?: any; isError?: boolean };
    if (!r.isError && ["state", "outcome", "events", "history"].includes(name)) {
      expect(validate(`applier/${name}.response.json`, r.structuredContent), name).toEqual([]);
    }
    return { ok: !r.isError, body: r.structuredContent };
  };
  return Object.assign(call, { era: () => client.getProtocolEra() });
}

async function home(opts: { mutation?: string; faults?: { noV?: boolean } } = {}) {
  const root = `demo/a${++n}`;
  const bridgeClock = await TestClock.connect(time.source);
  const bridge = new SimBridge({ brokerUrl: broker.url, root, bridgeId: "sim-bridge", clock: bridgeClock, runId: "run-1",
    devices: fixtureDevices(["lamp", "tv"]), faults: opts.faults });
  await bridge.start();
  const clock = await TestClock.connect(time.source);
  const applier = new SimApplier({ brokerUrl: broker.url, identity: "sim-applier", root, clock, ownerCredential: "owner-secret",
    runId: "run-1", mutation: opts.mutation, retarget: (s) => clock.retarget(s) });
  await applier.start();
  const mcp = await serveMcp(applier, await freePort());
  cleanup.push(() => bridgeClock.close(), () => clock.close(), () => bridge.stop(), () => applier.stop(), () => mcp.close());
  const owner = await connect(mcp.url, "owner-secret");
  let rev = (await owner("describe")).body.revision;
  const configure = async (changes: unknown[]) => {
    const r = await owner("configure", { changes, expected_revision: rev, dry_run: false });
    expect(r.ok, JSON.stringify(r.body)).toBe(true);
    rev = r.body.revision;
  };
  await configure([
    { op: "upsert", kind: "client", value: { id: "harness", credential: "harness-secret", kind: "steward", token_key: "harness-token-key-0123" } },
    { op: "upsert", kind: "bridge", value: { id: "sim-bridge", identity: "sim-bridge" } },
    { op: "upsert", kind: "time_source", value: time.source },
  ]);
  for (let i = 0; i < 50 && (await owner("describe")).body.devices.length < 2; i++) await new Promise((r) => setTimeout(r, 100));
  rev = (await owner("describe")).body.revision;
  await configure([{ op: "upsert", kind: "adopt", value: { device: "sim-bridge:lamp", class: "light" } },
    { op: "upsert", kind: "adopt", value: { device: "sim-bridge:tv", class: "tv" } }]);
  return { clock, bridge, applier, owner, root, url: mcp.url, call: await connect(mcp.url, "harness-secret") };
}

const turnOn = { actions: [{ target: "sim-bridge:lamp", action: "onoff.turn_on", args: {}, via: "app", brain: false, for: { person: "demo" } }] };

describe("SimApplier", () => {
  it("describes a valid model with the run id; refuses strangers and non-owners", async () => {
    const { owner, call } = await home();
    const d = await call("describe");
    expect(validate("applier/describe.response.json", d.body)).toEqual([]);
    expect(d.body.test_run_id).toBe("run-1");
    expect((await call("configure", { changes: [], expected_revision: 0, dry_run: true })).body.error).toBe("not_permitted");
    expect((await owner("plan", turnOn)).body.error).toBe("not_permitted");
  });

  it("serves both MCP eras, 2025 and 2026-07-28, with the bearer on each request", async () => {
    const { url } = await home();
    for (const [mode, era] of [["legacy", "legacy"], ["auto", "modern"]] as const) {
      const harness = await connect(url, "harness-secret", mode);
      expect(harness.era(), mode).toBe(era);
      expect((await harness("describe")).body.test_run_id, mode).toBe("run-1");
      expect((await (await connect(url, "stranger", mode))("describe")).body.error, mode).toBe("not_permitted");
    }
  });

  it("plays an applier that speaks only the 2025 era, as the mutation speaks-only-2025", async () => {
    const { applier } = await home({ mutation: SPEAKS_ONLY_2025 });
    const legacy = await serveMcp(applier, await freePort());
    cleanup.push(() => legacy.close());
    const harness = await connect(legacy.url, "harness-secret", "auto");
    expect(harness.era()).toBe("legacy");
    expect((await harness("describe")).body.test_run_id).toBe("run-1");
  });

  it("plans without side effects, and the mutation breaks that", async () => {
    for (const mutation of [undefined, PLANS_WITH_SIDE_EFFECT]) {
      const { call } = await home({ mutation });
      const { cursor } = (await call("events")).body;
      const plan = await call("plan", turnOn);
      expect(validate("applier/plan.response.json", plan.body)).toEqual([]);
      expect(plan.body.steps[0].verdict).toBe("op");
      const after = await call("events", { cursor, wait_s: 1 });
      expect(after.body.events.length > 0).toBe(mutation !== undefined);
    }
  });

  it("applies once per key, and acks only on the matching report", async () => {
    const { call, bridge } = await home();
    await bridge.control({ requestId: "r", op: "commandResult", device: "lamp", result: "confirmed", afterMs: 0, reportAfterMs: 1000 });
    const req = { request: turnOn, idempotency_key: "k1" };
    const first = await call("apply", req);
    expect(validate("applier/apply.response.json", first.body)).toEqual([]);
    expect(first.body.outcomes[0].outcome).toBe("dispatched");
    const again = await call("apply", req);
    expect(again.body.apply_id).toBe(first.body.apply_id);
    const other = await call("apply", { ...req, request: { actions: [{ ...turnOn.actions[0], action: "onoff.turn_off" }] } });
    expect(other.body.error).toBe("idempotency_conflict");
    await new Promise((r) => setTimeout(r, 300));
    expect((await call("outcome", { apply_id: first.body.apply_id })).body.outcomes[0].outcome).toBe("dispatched");
    await new Promise((r) => setTimeout(r, 1500));
    expect((await call("outcome", { apply_id: first.body.apply_id })).body.outcomes[0].outcome).toBe("acked");
    expect(bridge.received.length).toBe(1);
  });

  it("ends an open device's step sent", async () => {
    const { call, clock } = await home();
    // The tv's code toggles: a person's yes, a token, lets it through (GA-PLAN-8).
    const tv = { ...turnOn.actions[0]!, target: "sim-bridge:tv" };
    const token = signToken({ token_id: "t", issuer: "harness", ...tv, expires: new Date(clock.now() + 60_000).toISOString() }, "harness-token-key-0123");
    const r = await call("apply", { request: { actions: [{ ...tv, token }] },
      idempotency_key: "k2" });
    await new Promise((res) => setTimeout(res, 800));
    expect((await call("outcome", { apply_id: r.body.apply_id })).body.outcomes[0].outcome).toBe("sent");
  });

  it("emits one model event per configure, adoptions included", async () => {
    const { owner, call, bridge } = await home();
    await bridge.control({ requestId: "j", op: "join", device: "plug", capabilities: ["onoff"], feedback: "closed" });
    let rev = 0;
    for (let i = 0; i < 50; i++) {
      const d = (await owner("describe")).body;
      rev = d.revision;
      if (d.devices.some((x: any) => x.id === "sim-bridge:plug")) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const { cursor } = (await call("events")).body;
    const r = await owner("configure", { changes: [{ op: "upsert", kind: "adopt", value: { device: "sim-bridge:plug", class: "socket" } }],
      expected_revision: rev, dry_run: false });
    expect(r.body.revision).toBe(rev + 1);
    const models = (await call("events", { cursor })).body.events.filter((e: any) => e.type === "model");
    expect(models).toEqual([expect.objectContaining({ type: "model", revision: rev + 1 })]);
  });

  it("leaves the revision alone for a configure that changes nothing", async () => {
    const { owner, call } = await home();
    const rev = (await owner("describe")).body.revision;
    const { cursor } = (await call("events")).body;
    const r = await owner("configure", { changes: [], expected_revision: rev, dry_run: false });
    expect(r.body.revision).toBe(rev);
    expect((await owner("describe")).body.revision).toBe(rev);
    expect((await call("events", { cursor })).body.events).toEqual([]);
  });

  it("survives a malformed device status and takes it as a bridge fault", async () => {
    const { owner, call, root } = await home();
    const raw = await connectAsync(broker.url, { protocolVersion: 5, username: "sim-bridge", clientId: `raw-${n}` });
    cleanup.push(() => raw.endAsync());
    const topic = `${root}/bridges/sim-bridge/devices/lamp/status`;
    await raw.publishAsync(topic, JSON.stringify({ deviceId: "lamp", available: true, on: true }), { qos: 1 });
    await raw.publishAsync(topic, JSON.stringify({ deviceId: "lamp", available: true, on: true, timestamp: "2030-13-45T25:00:00.000Z" }), { qos: 1 });
    await new Promise((r) => setTimeout(r, 300));
    expect((await owner("describe")).ok).toBe(true);
    const h = await call("history", { from: "2000-01-01T00:00:00Z", to: "2100-01-01T00:00:00Z" });
    expect(h.body.events.filter((e: any) => e.type === "bridge_fault").length).toBe(2);
    expect(h.body.events.some((e: any) => e.type === "state" && e.value === true)).toBe(false);
  });

  it("expires a plan after a step of the clock", async () => {
    const { call } = await home();
    const plan = await call("plan", turnOn);
    await time.stepAndWait(61_000);
    expect((await call("apply", { plan_id: plan.body.plan_id, idempotency_key: "k3" })).body.error).toBe("plan_expired");
  });

  it("takes a status without v as a bridge fault, and a live valid status clears it", async () => {
    const { call, bridge } = await home({ faults: { noV: true } });
    const state = async () => (await call("state", { targets: ["sim-bridge:lamp"] })).body.targets["sim-bridge:lamp"].liveness;
    expect(await state()).toBe("dead");
    const h = await call("history", { from: "2000-01-01T00:00:00Z", to: "2100-01-01T00:00:00Z" });
    expect(h.body.events.some((e: any) => e.type === "bridge_fault")).toBe(true);
    bridge.setFaults({ noV: false });
    await bridge.publishStatus();
    await new Promise((r) => setTimeout(r, 300));
    expect(await state()).toBe("live");
  });
});
