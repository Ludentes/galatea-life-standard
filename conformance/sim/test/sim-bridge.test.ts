import { randomUUID } from "node:crypto";
import { validate } from "@ludentes/galatea-life-schemas";
import { TestClock } from "@ludentes/galatea-life-test-clock";
import { connectAsync } from "mqtt";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { startBroker, type Broker } from "../src/broker.js";
import { MAPS_MOTION_TO_OCCUPANCY, SimBridge, STAMPS_PUBLICATION_TIME } from "../src/bridge/sim-bridge.js";
import { device, fixtureDevices } from "../src/fixture.js";
import { TimeServer } from "../src/time-server.js";
import { watch } from "./watch.js";

let broker: Broker;
let time: TimeServer;
let n = 0;
const cleanup: (() => unknown)[] = [];

beforeAll(async () => { broker = await startBroker(); time = await TimeServer.start(); }, 60_000);
afterAll(async () => { await time.close(); await broker.stop(); });
afterEach(async () => { while (cleanup.length) await cleanup.pop()!(); });

async function bridge(extra: Partial<ConstructorParameters<typeof SimBridge>[0]> = {}) {
  const root = `demo/b${++n}`;
  const clock = await TestClock.connect(time.source);
  const w = await watch(broker.url, `${root}/#`);
  const b = new SimBridge({ brokerUrl: broker.url, root, bridgeId: "sim-bridge", clock, runId: "run-1",
    devices: fixtureDevices(["lamp", "tv"]), ...extra });
  await b.start();
  // Start-up publishes the status last, and one client's messages arrive in order: once the watcher
  // has seen it, everything from start-up is in `seen`, so a `mark` taken now excludes all of it.
  await w.waitFor((s) => s.topic === `${root}/bridges/sim-bridge/status`, 5000);
  cleanup.push(() => clock.close(), () => w.close(), () => b.stop());
  return { b, w, root, clock };
}

describe("SimBridge", () => {
  it("publishes a valid retained status, devices document and device status", async () => {
    const { w, root } = await bridge();
    const status = await w.waitFor((s) => s.topic === `${root}/bridges/sim-bridge/status`, 2000);
    expect(validate("bridge/status.json", status.payload)).toEqual([]);
    expect(status.payload.testRunId).toBe("run-1");
    expect(Math.abs(Date.parse(status.payload.publishedAt) - time.now())).toBeLessThan(1000);
    const devices = await w.waitFor((s) => s.topic.endsWith("/sim-bridge/devices"), 2000);
    expect(validate("bridge/devices.json", devices.payload)).toEqual([]);
    const lamp = await w.waitFor((s) => s.topic.endsWith("/devices/lamp/status"), 2000);
    expect(validate("bridge/device-status.json", lamp.payload)).toEqual([]);
    expect(lamp.payload.state).toBe("off");
  });

  it("publishes a library's movement reading as motion, and the mutation as occupancy (GA-BRIDGE-78)", async () => {
    for (const mutation of [undefined, MAPS_MOTION_TO_OCCUPANCY]) {
      const { b, w } = await bridge({ mutation });
      const mark = w.seen.length;
      await b.control({ requestId: "r", op: "libraryDevice", device: "pir", readings: [{ name: "occupancy", means: "movement" }] });
      const doc = await w.waitFor((s) => s.topic.endsWith("/sim-bridge/devices") && s.payload.devices.some((d: any) => d.id === "pir"), 2000, mark);
      const key = mutation ? "occupancy" : "motion";
      expect(doc.payload.devices.find((d: any) => d.id === "pir").sensorKeys).toEqual([key]);
      await b.control({ requestId: "r2", op: "report", device: "pir", values: { occupancy: true }, observedAt: new Date(time.now()).toISOString() });
      const s = await w.waitFor((m) => m.topic.endsWith("/devices/pir/status"), 2000, mark);
      expect(s.payload[key]).toBe(true);
    }
  });

  it("declares an awaited key before the status carrying its first value, and lists every setting (GA-BRIDGE-79, 80)", async () => {
    const radar = device({ id: "radar", capabilities: ["sensor"], sensorKeys: ["occupancy"], awaitedKeys: ["temperature"], feedback: "closed",
      proposedClass: "sensor", initial: {}, settings: ["org.galatea.test.radar.sensitivity"] });
    const { b, w } = await bridge({ devices: [radar] });
    const first = await w.waitFor((s) => s.topic.endsWith("/sim-bridge/devices"), 2000);
    expect(first.payload.devices[0]).toMatchObject({ awaitedKeys: ["temperature"], settings: ["org.galatea.test.radar.sensitivity"] });
    expect(validate("bridge/devices.json", first.payload)).toEqual([]);
    const mark = w.seen.length;
    await b.control({ requestId: "r", op: "report", device: "radar", values: { temperature: 21 }, observedAt: new Date(time.now()).toISOString() });
    const value = await w.waitFor((s) => s.topic.endsWith("/devices/radar/status") && s.payload.temperature === 21, 2000, mark);
    const declared = w.seen.slice(mark, w.seen.indexOf(value)).find((s) => s.topic.endsWith("/sim-bridge/devices"));
    expect(declared?.payload.devices[0].sensorKeys).toEqual(["occupancy", "temperature"]);
    expect(declared?.payload.devices[0]).not.toHaveProperty("awaitedKeys");
  });

  it("keeps a report's observation time, and the mutation restamps it", async () => {
    for (const mutation of [undefined, STAMPS_PUBLICATION_TIME]) {
      const { b, w } = await bridge({ mutation });
      const observedAt = new Date(time.now() - 5000).toISOString();
      const mark = w.seen.length;
      await b.control({ requestId: "r", op: "report", device: "lamp", values: { on: true }, observedAt });
      const s = await w.waitFor((m) => m.topic.endsWith("/devices/lamp/status") && m.payload.on === true, 2000, mark);
      if (mutation) expect(s.payload.timestamp).not.toBe(observedAt);
      else expect(s.payload.timestamp).toBe(observedAt);
    }
  });

  it("refuses the doer's ops, which only the Zigbee bridge's scripted doer plays, replying unsupported", async () => {
    const { b, w, root } = await bridge();
    const at = new Date(time.now()).toISOString();
    for (const msg of [
      { op: "describe", device: "lamp", entry: {} }, { op: "interview", device: "lamp" }, { op: "setting", device: "lamp", key: "x.y.mode", value: "click", observedAt: at },
      { op: "occur", device: "lamp", key: "x.y.alarm", value: true, frameId: "f1", observedAt: at },
      { op: "undescribed", device: "lamp", names: ["dp108"] }, { op: "admit", device: "lamp", how: "association" },
      { op: "leave", device: "lamp" }, { op: "windowState", open: true }, { op: "protocolResult", device: "lamp", result: "confirmed" },
      { op: "hostLink", open: true, answers: false },
      { op: "stateMismatch", disagrees: true }, { op: "reporting", device: "lamp", configuredMs: [60000], modelMs: null },
      { op: "foreignBinding", device: "remote", target: "lamp" }, { op: "classFrom", device: "lamp", proposedClass: "light", from: "modelDb" },
      { op: "nativeControl", way: "touchlink", canDisable: false }, { op: "lockPin", device: "door", requiresPin: true },
    ]) {
      await expect(b.control({ requestId: "r", ...msg } as never), msg.op).rejects.toThrow(/does not play/);
    }
    // On the wire, the reply says the op is not played, so the harness reports the test not_applicable.
    const control = `${root}/test/sim-bridge/control`;
    const mark = w.seen.length;
    await w.client.publishAsync(control, JSON.stringify({ requestId: "r-wire", op: "leave", device: "lamp" }), { qos: 1 });
    const reply = await w.waitFor((s) => s.topic === `${control}/reply` && s.payload?.requestId === "r-wire", 2000, mark);
    expect(validate("harness/test-control-reply.json", reply.payload)).toEqual([]);
    expect(reply.payload).toMatchObject({ ok: false, unsupported: true });
  });

  it("acts on a command, counts the actuation, and acks before a late report", async () => {
    const { b, w, root } = await bridge();
    await b.control({ requestId: "r", op: "commandResult", device: "lamp", result: "confirmed", afterMs: 0, reportAfterMs: 1000 });
    const client = await connectAsync(broker.url, { protocolVersion: 5 });
    cleanup.push(() => client.endAsync());
    const mark = w.seen.length;
    const commandId = "0b5f2c3e-1d4a-4f6b-8c9d-0e1f2a3b4c5d";
    await client.publishAsync(`${root}/bridges/sim-bridge/devices/lamp/command`, JSON.stringify({
      commandId, issuedAt: new Date(time.now()).toISOString(), resultWithinMs: 10_000, value: { action: "onoff.turn_on" },
    }), { qos: 1 });
    const ack = await w.waitFor((s) => s.topic.endsWith("/devices/lamp/ack"), 2000, mark);
    expect(validate("bridge/ack.json", ack.payload)).toEqual([]);
    expect(ack.payload).toMatchObject({ commandId, source: "sim-bridge", result: "applied" });
    const on = await w.waitFor((s) => s.topic.endsWith("/devices/lamp/status") && s.payload.on === true, 3000, mark);
    expect(on.realAt - ack.realAt).toBeGreaterThanOrEqual(900);
    expect(b.received.map((r) => r.action)).toEqual(["onoff.turn_on"]);
    const received = await w.waitFor((s) => s.topic === `${root}/test/sim-bridge/control/received`, 2000, mark);
    expect(validate("harness/test-received.json", received.payload)).toEqual([]);
  });

  it("records a command once its answer is timed, so a step of the clock past the delay brings the answer", async () => {
    const { b, w, root, clock } = await bridge();
    await b.control({ requestId: "r", op: "commandResult", device: "lamp", result: "confirmed", afterMs: 60_000 });
    const client = await connectAsync(broker.url, { protocolVersion: 5 });
    cleanup.push(() => client.endAsync());
    const mark = w.seen.length;
    const commandId = "5d2a3c1e-7b4f-4e6a-9c8d-1f2e3a4b5c6d";
    await client.publishAsync(`${root}/bridges/sim-bridge/devices/lamp/command`, JSON.stringify({
      commandId, issuedAt: new Date(time.now()).toISOString(), resultWithinMs: 120_000, value: { action: "onoff.turn_on" },
    }), { qos: 1 });
    for (let i = 0; i < 100 && !b.answerTimed.includes(commandId); i++) await new Promise((r) => setTimeout(r, 20));
    expect(b.answerTimed).toEqual([commandId]);
    await time.stepAndWait(60_000);
    await clock.sync();
    const ack = await w.waitFor((s) => s.topic.endsWith("/devices/lamp/ack"), 2000, mark);
    expect(ack.payload).toMatchObject({ commandId, result: "applied" });
  });

  it("lists a transport a test added in every later status, one it sends of its own included", async () => {
    const { b, w, root } = await bridge();
    b.setQuiet(true);
    b.addTransport({ id: "radio", kind: "zigbee", state: "up", since: new Date(time.now()).toISOString() });
    const mark = w.seen.length;
    await b.publishStatus();
    // An observable change makes the bridge send a status of its own, quiet or not (GA-BRIDGE-17).
    await b.control({ requestId: "down", op: "transportState", state: "down" });
    const isStatus = (s: { topic: string }) => s.topic === `${root}/bridges/sim-bridge/status`;
    await w.waitFor((s) => isStatus(s) && s.payload.devices.some((d: { id: string; observable: boolean }) => d.id === "lamp" && !d.observable), 2000, mark);
    const statuses = w.seen.slice(mark).filter(isStatus);
    expect(statuses.length).toBeGreaterThanOrEqual(2);
    for (const s of statuses) {
      expect(validate("bridge/status.json", s.payload)).toEqual([]);
      expect(s.payload.transports.map((t: { id: string }) => t.id)).toEqual(["test", "radio"]);
    }
  });

  it("answers the control protocol over MQTT", async () => {
    const { w, root } = await bridge();
    const client = await connectAsync(broker.url, { protocolVersion: 5 });
    cleanup.push(() => client.endAsync());
    const mark = w.seen.length;
    await client.publishAsync(`${root}/test/sim-bridge/control`, JSON.stringify({ requestId: "c1", op: "transportState", state: "down" }), { qos: 1 });
    const reply = await w.waitFor((s) => s.topic.endsWith("/control/reply"), 2000, mark);
    expect(reply.payload).toEqual({ requestId: "c1", ok: true });
    const status = await w.waitFor((s) => s.topic.endsWith("/sim-bridge/status") && s.payload.transports[0].state === "down", 1000, mark);
    expect(status.payload.transports[0].state).toBe("down");
    await client.publishAsync(`${root}/test/sim-bridge/control`, JSON.stringify({ requestId: "c2", op: "explode" }), { qos: 1 });
    const bad = await w.waitFor((s) => s.topic.endsWith("/control/reply") && s.payload.requestId === "c2", 2000, mark);
    expect(bad.payload.ok).toBe(false);
    expect(bad.payload.unsupported).toBeUndefined();
    await client.publishAsync(`${root}/test/sim-bridge/control`,
      JSON.stringify({ requestId: "c3", op: "link", carrier: true, gatewayAnswers: true }), { qos: 1 });
    const link = await w.waitFor((s) => s.topic.endsWith("/control/reply") && s.payload.requestId === "c3", 2000, mark);
    expect(link.payload).toMatchObject({ ok: false, unsupported: true });
    expect(validate("harness/test-control-reply.json", link.payload)).toEqual([]);
  });

  it("drops v under the fault, and its will names its instance when killed", async () => {
    const { b, w } = await bridge({ faults: { noV: true } });
    const status = await w.waitFor((s) => s.topic.endsWith("/sim-bridge/status"), 2000);
    expect(status.payload.v).toBeUndefined();
    const mark = w.seen.length;
    b.kill();
    const lwt = await w.waitFor((s) => s.topic.endsWith("/sim-bridge/lwt") && s.payload !== null, 5000, mark);
    expect(lwt.payload).toEqual({ bridgeId: "sim-bridge", instanceId: b.instanceId });
  });

  it("publishes status every interval of its clock, and once, not many times, after a step", async () => {
    const { w } = await bridge({ statusIntervalMs: 1000 });
    await new Promise((r) => setTimeout(r, 3500));
    const count = () => w.seen.filter((s) => s.topic.endsWith("/sim-bridge/status")).length;
    expect(count()).toBeGreaterThanOrEqual(3);
    const before = count();
    await time.stepAndWait(3_600_000);
    expect(count() - before).toBeLessThanOrEqual(4);
    time.reset();
  });

  it("dedups a repeated commandId: the first ack again, no re-actuation (GA-BRIDGE-4)", async () => {
    const { b, w, root } = await bridge();
    const client = await connectAsync(broker.url, { protocolVersion: 5 });
    cleanup.push(() => client.endAsync());
    const mark = w.seen.length;
    const commandId = "11111111-1111-4111-8111-111111111111";
    const payload = JSON.stringify({
      commandId, issuedAt: new Date(time.now()).toISOString(), resultWithinMs: 10_000, value: { action: "onoff.turn_on" },
    });
    await client.publishAsync(`${root}/bridges/sim-bridge/devices/lamp/command`, payload, { qos: 1 });
    await client.publishAsync(`${root}/bridges/sim-bridge/devices/lamp/command`, payload, { qos: 1 });
    const ack = await w.waitFor((s) => s.topic.endsWith("/devices/lamp/ack"), 2000, mark);
    expect(ack.payload.result).toBe("applied");
    await new Promise((r) => setTimeout(r, 300));
    expect(w.seen.slice(mark).filter((s) => s.topic.endsWith("/devices/lamp/ack"))).toHaveLength(1);
    expect(b.received).toHaveLength(1);
  });

  it("refuses a command while its transport is down, at once (GA-BRIDGE-6, -17)", async () => {
    const { b, w, root } = await bridge();
    await b.control({ requestId: "r", op: "transportState", state: "down" });
    await w.waitFor((s) => s.topic.endsWith("/sim-bridge/status") && s.payload.transports[0].state === "down", 2000);
    const client = await connectAsync(broker.url, { protocolVersion: 5 });
    cleanup.push(() => client.endAsync());
    const mark = w.seen.length;
    const commandId = "22222222-2222-4222-8222-222222222222";
    await client.publishAsync(`${root}/bridges/sim-bridge/devices/lamp/command`, JSON.stringify({
      commandId, issuedAt: new Date(time.now()).toISOString(), resultWithinMs: 10_000, value: { action: "onoff.turn_on" },
    }), { qos: 1 });
    const ack = await w.waitFor((s) => s.topic.endsWith("/devices/lamp/ack"), 1000, mark);
    expect(ack.payload).toMatchObject({ commandId, result: "failed", reason: "unreachable" });
    expect(b.received).toEqual([]);
  });

  it("expires a command whose time ran out before it arrived (GA-BRIDGE-7)", async () => {
    const { b, w, root } = await bridge();
    const issuedAt = new Date(time.now()).toISOString();
    await time.stepAndWait(5000);
    const client = await connectAsync(broker.url, { protocolVersion: 5 });
    cleanup.push(() => client.endAsync());
    const mark = w.seen.length;
    const commandId = "33333333-3333-4333-8333-333333333333";
    await client.publishAsync(`${root}/bridges/sim-bridge/devices/lamp/command`, JSON.stringify({
      commandId, issuedAt, resultWithinMs: 2000, value: { action: "onoff.turn_on" },
    }), { qos: 1 });
    const ack = await w.waitFor((s) => s.topic.endsWith("/devices/lamp/ack"), 1000, mark);
    expect(ack.payload).toMatchObject({ commandId, result: "failed", reason: "expired" });
    expect(b.received).toEqual([]);
    time.reset();
  });

  it("publishes raw payloads, events at a chosen seq, and records the requests it receives", async () => {
    const { b, w, root } = await bridge();
    const base = `${root}/bridges/sim-bridge`;
    const mark = w.seen.length;
    await b.publishRaw("devices", "{", true);
    expect((await w.waitFor((s) => s.topic === `${base}/devices`, 5000, mark)).payload).toBe("{");
    await b.publishEvent("joined", { device: "lamp" });
    await b.publishEvent("joined", { device: "tv" }, { seq: 5 });
    await b.publishEvent("left", { device: "tv" }, { seq: 1, instanceId: "00000000-0000-4000-8000-000000000000" });
    const events = () => w.seen.filter((s) => s.topic === `${base}/event`).map((s) => [s.payload.seq, s.payload.instanceId === b.instanceId]);
    await w.waitFor((s) => s.topic === `${base}/event` && s.payload.type === "left", 5000, mark);
    expect(events()).toEqual([[1, true], [5, true], [1, false]]);
    const client = await connectAsync(broker.url, { protocolVersion: 5 });
    cleanup.push(() => client.endAsync());
    await client.publishAsync(`${base}/request/snapshot`, JSON.stringify({ requestId: "q1", issuedAt: new Date(time.now()).toISOString() }), { qos: 1 });
    await w.waitFor((s) => s.topic === `${base}/reply` && s.payload.requestId === "q1", 5000, mark);
    expect(b.requests.map((r) => r.op)).toEqual(["snapshot"]);
  });

  it("answers a snapshot by publishing every retained topic again, then its reply; a held request is recorded, unanswered", async () => {
    const { b, w, root } = await bridge();
    const base = `${root}/bridges/sim-bridge`;
    const client = await connectAsync(broker.url, { protocolVersion: 5 });
    cleanup.push(() => client.endAsync());
    const ask = (requestId: string) => client.publishAsync(`${base}/request/snapshot`,
      JSON.stringify({ requestId, issuedAt: new Date(time.now()).toISOString() }), { qos: 1 });
    // The tv is an open device: its status exists once it has reported, and a snapshot repeats it too.
    await b.control({ requestId: "r", op: "report", device: "tv", values: { on: true }, observedAt: new Date(time.now()).toISOString() });
    // The report's status reaches the watcher after control returns: the mark is taken once it has.
    await w.waitFor((s) => s.topic === `${base}/devices/tv/status`, 2000);
    let mark = w.seen.length;
    await ask("q1");
    await w.waitFor((s) => s.topic === `${base}/reply` && s.payload.requestId === "q1", 5000, mark);
    const order = w.seen.slice(mark).map((s) => s.topic.slice(base.length + 1)).filter((t) => !t.startsWith("request/"));
    expect(order).toEqual(["devices", "devices/lamp/status", "devices/tv/status", "status", "reply"]);
    b.holdRequests(true);
    mark = w.seen.length;
    await ask("q2");
    await new Promise((r) => setTimeout(r, 500));
    expect(b.requests.map((r) => (r.body as { requestId: string }).requestId)).toEqual(["q1", "q2"]);
    expect(w.seen.slice(mark).filter((s) => s.topic === `${base}/reply`)).toEqual([]);
  });

  it("reports a device unavailable, and removes one: out of devices and roster, its status cleared", async () => {
    const { b, w, root } = await bridge();
    const base = `${root}/bridges/sim-bridge`;
    const mark = w.seen.length;
    await b.setAvailable("lamp", false);
    const off = await w.waitFor((s) => s.topic === `${base}/devices/lamp/status` && s.payload.available === false, 2000, mark);
    expect(validate("bridge/device-status.json", off.payload)).toEqual([]);
    await b.removeDevice("lamp");
    await w.waitFor((s) => s.topic === `${base}/devices/lamp/status` && s.payload === null, 2000, mark);
    const devices = await w.waitFor((s) => s.topic === `${base}/devices` && !s.payload.devices.some((d: { id: string }) => d.id === "lamp"), 2000, mark);
    expect(devices.payload.devices.map((d: { id: string }) => d.id)).toEqual(["tv"]);
    const status = await w.waitFor((s) => s.topic === `${base}/status` && !s.payload.devices.some((d: { id: string }) => d.id === "lamp"), 2000, mark);
    expect(validate("bridge/status.json", status.payload)).toEqual([]);
    expect(w.seen.slice(mark).some((s) => s.topic === `${base}/event` && s.payload.type === "left")).toBe(true);
  });

  it("restarts as a new instance, its will fired when killed, its event seq from 1 again", async () => {
    const { b, w, root } = await bridge();
    const base = `${root}/bridges/sim-bridge`;
    const first = b.instanceId;
    await b.publishEvent("joined", { device: "lamp" });
    const mark = w.seen.length;
    await b.restart({ graceful: false });
    expect(b.instanceId).not.toBe(first);
    await w.waitFor((s) => s.topic === `${base}/lwt` && s.payload?.instanceId === first, 5000, mark);
    await w.waitFor((s) => s.topic === `${base}/status` && s.payload.instanceId === b.instanceId, 2000, mark);
    await b.publishEvent("joined", { device: "tv" });
    const e = await w.waitFor((s) => s.topic === `${base}/event` && s.payload.instanceId === b.instanceId, 2000, mark);
    expect(e.payload.seq).toBe(1);
  });

  it("gives a closed device with no known bound a null basisMaxAgeMs, never observable", async () => {
    const { w, root } = await bridge({ devices: fixtureDevices(["unbound"]) });
    const s = await w.waitFor((m) => m.topic === `${root}/bridges/sim-bridge/status`, 2000);
    expect(s.payload.devices[0]).toMatchObject({ id: "unbound", basisMaxAgeMs: null, observable: false });
  });

  it("publishes as another bridge, on that bridge's tree, and keeps it out of its own published", async () => {
    const { b, w, root } = await bridge();
    const before = b.published.length;
    await b.publishAs("other-bridge", "devices", { devices: [] }, true);
    const s = await w.waitFor((m) => m.topic === `${root}/bridges/other-bridge/devices`, 2000);
    expect(s.payload).toEqual({ devices: [] });
    expect(b.published.length).toBe(before);
  });

  it("holds back its periodic status while quiet, and still sends one it is asked for", async () => {
    const { b, w, root } = await bridge();
    b.setQuiet(true);
    const mark = w.seen.length;
    await time.stepAndWait(25_000);
    expect(w.seen.slice(mark).filter((s) => s.topic === `${root}/bridges/sim-bridge/status`)).toEqual([]);
    await b.publishStatus();
    await w.waitFor((s) => s.topic === `${root}/bridges/sim-bridge/status`, 2000, mark);
  });

  /** A command for `device` from a client of the test's own, as the applier publishes one. */
  async function command(root: string, device: string, value: Record<string, unknown>, o: { retain?: boolean; expiryS?: number } = {}) {
    const client = await connectAsync(broker.url, { protocolVersion: 5 });
    cleanup.push(() => client.endAsync());
    const commandId = crypto.randomUUID();
    await client.publishAsync(`${root}/bridges/sim-bridge/devices/${device}/command`, JSON.stringify({
      commandId, issuedAt: new Date(time.now()).toISOString(), resultWithinMs: 10_000, value,
    }), { qos: 1, retain: o.retain ?? false, ...(o.expiryS ? { properties: { messageExpiryInterval: o.expiryS } } : {}) });
    return commandId;
  }

  it("answers the next command as its commandResult says, with its detail and source; nothing transmitted for unreachable, expired or unsupported", async () => {
    const { b, w, root } = await bridge({ devices: fixtureDevices(["lamp", "tv", "channel"]) });
    const cases: [string, string, Record<string, unknown>, boolean][] = [
      ["sent", "lamp", { result: "sent" }, true], ["unreachable", "lamp", { result: "failed", reason: "unreachable" }, false],
      ["expired", "lamp", { result: "failed", reason: "expired" }, false], ["unsupported", "lamp", { result: "unsupported" }, false],
      ["no_confirmation", "lamp", { result: "failed", reason: "no_confirmation" }, true], ["received", "lamp", { result: "received" }, true],
      ["rejected", "lamp", { result: "failed", reason: "rejected" }, true], ["confirmed", "tv", { result: "sent" }, true],
    ];
    for (const [result, device, ack, actuates] of cases) {
      await b.control({ requestId: result, op: "commandResult", device, result: result as never, afterMs: 0, detail: `why ${result}`,
        ...(result === "rejected" ? { source: "another-bridge" } : {}) });
      const mark = w.seen.length;
      const actuated = b.received.length;
      const commandId = await command(root, device, { action: "onoff.turn_on" });
      const got = await w.waitFor((s) => s.topic.endsWith(`/devices/${device}/ack`) && s.payload.commandId === commandId, 2000, mark);
      expect(got.payload).toMatchObject({ ...ack, detail: `why ${result}`, source: result === "rejected" ? "another-bridge" : "sim-bridge" });
      expect(b.received.length - actuated).toBe(actuates ? 1 : 0);
    }
    await b.control({ requestId: "none", op: "commandResult", device: "tv", result: "none" });
    const mark = w.seen.length;
    await command(root, "tv", { action: "onoff.turn_off" });
    await new Promise((r) => setTimeout(r, 500));
    expect(w.seen.slice(mark).filter((s) => s.topic.endsWith("/devices/tv/ack"))).toEqual([]);
    await b.control({ requestId: "notify", op: "commandResult", device: "channel", result: "confirmed", afterMs: 0 });
    const id = await command(root, "channel", { action: "notify.notify", value: { text: "dinner", urgency: "info" } });
    const ack = await w.waitFor((s) => s.topic.endsWith("/devices/channel/ack") && s.payload.commandId === id, 2000);
    expect(ack.payload.result).toBe("applied");
    expect(b.received.at(-1)).toMatchObject({ device: "channel", action: "notify.notify", args: { text: "dinner", urgency: "info" }, commandId: id });
  });

  it("records every delivery of a command, a repeat included, with its retain flag and Message Expiry; and unsubscribes from commands on request", async () => {
    const { b, w, root } = await bridge();
    // The watcher's `#` would be a subscriber to every command: without it, a command nobody hears is answered 0x10.
    await w.client.unsubscribeAsync(`${root}/#`);
    const first = await command(root, "lamp", { action: "onoff.turn_on" }, { expiryS: 12 });
    await command(root, "lamp", { action: "onoff.turn_off" }, { retain: true });
    await new Promise((r) => setTimeout(r, 300));
    expect(b.commands.map((c) => [c.device, c.retained, c.expiryS])).toEqual([["lamp", false, 12], ["lamp", true, undefined]]);
    expect(b.commands[0]!.commandId).toBe(first);
    await b.control({ requestId: "deaf", op: "commands", subscribed: false });
    const client = await connectAsync(broker.url, { protocolVersion: 5 });
    cleanup.push(() => client.endAsync());
    const reasons: number[] = [];
    client.on("packetreceive", (p) => { if (p.cmd === "puback") reasons.push(p.reasonCode ?? 0); });
    await client.publishAsync(`${root}/bridges/sim-bridge/devices/lamp/command`, "{}", { qos: 1 });
    expect(reasons).toEqual([0x10]);
    await b.control({ requestId: "hear", op: "commands", subscribed: true });
    await client.publishAsync(`${root}/bridges/sim-bridge/devices/lamp/command`, "{}", { qos: 1 });
    expect(reasons).toEqual([0x10, 0]);
  });
});

describe("SimBridge: extensions (bridge 0.5)", () => {
  const PUSH = "org.galatea.test.pusher";
  const V = "org.galatea.test.vibration";
  const now = () => new Date(time.now()).toISOString();

  it("declares a device's extensions, its personal keys and confirmedBy, valid against bridge/devices.json", async () => {
    const { w } = await bridge({ devices: fixtureDevices(["pusher", "shaker"]) });
    const doc = (await w.waitFor((s) => s.topic.endsWith("/sim-bridge/devices"), 2000)).payload;
    expect(validate("bridge/devices.json", doc)).toEqual([]);
    const pusher = doc.devices.find((d: any) => d.id === "pusher");
    expect(pusher.extensions[0].capability).toBe(PUSH);
    expect(pusher.actions.find((a: any) => a.action === `${PUSH}.set_mode`).confirmedBy).toEqual({ key: `${PUSH}.mode`, value: { arg: "mode" } });
    const shaker = doc.devices.find((d: any) => d.id === "shaker");
    expect(shaker.personal).toEqual([`${V}.presence`]);
    expect(shaker.selfChanging).toEqual([`${V}.sensitivity`]);
    expect(shaker.extensions[0].keys.map((k: any) => [k.key, k.kind])).toEqual([[`${V}.alarm`, "event"], [`${V}.presence`, "event"],
      [`${V}.sensitivity`, "state"]]);
  });

  it("puts only declared keys in a status, lists the rest in the device's undescribed with one event each, and an event key's value in one occurrence (GA-BRIDGE-75, 76)", async () => {
    const { b, w } = await bridge({ devices: fixtureDevices(["lamp", "shaker"]) });
    const mark = w.seen.length;
    await b.control({ requestId: "r1", op: "report", device: "lamp", values: { on: true, speech: "hello", dp108: 3 }, observedAt: now() });
    const lamp = await w.waitFor((s) => s.topic.endsWith("/devices/lamp/status") && s.payload.on === true, 2000, mark);
    expect(lamp.payload).not.toHaveProperty("speech");
    expect(lamp.payload).not.toHaveProperty("dp108");
    const doc = await w.waitFor((s) => s.topic.endsWith("/sim-bridge/devices")
      && s.payload.devices.find((d: any) => d.id === "lamp")?.undescribed?.length === 2, 2000, mark);
    expect(validate("bridge/devices.json", doc.payload)).toEqual([]);
    expect(doc.payload.devices.find((d: any) => d.id === "lamp").undescribed.map((u: any) => u.name)).toEqual(["speech", "dp108"]);
    await w.waitFor((s) => s.topic.endsWith("/sim-bridge/event") && s.payload.type === "undescribed" && s.payload.name === "dp108", 2000, mark);
    // The same names again: no second event, and never a fault.
    await b.control({ requestId: "r1b", op: "report", device: "lamp", values: { on: false, dp108: 4 }, observedAt: now() });
    await w.waitFor((s) => s.topic.endsWith("/devices/lamp/status") && s.payload.on === false, 2000, mark);
    const events = w.seen.slice(mark).filter((s) => s.topic.endsWith("/sim-bridge/event") && s.payload.type === "undescribed");
    expect(events.map((s) => [s.payload.device, s.payload.name])).toEqual([["lamp", "speech"], ["lamp", "dp108"]]);
    for (const e of events) expect(validate("bridge/event.json", e.payload)).toEqual([]);
    const statusMark = w.seen.length;
    await b.publishStatus();
    const status = await w.waitFor((s) => s.topic.endsWith("/sim-bridge/status"), 2000, statusMark);
    expect(status.payload.faults).toEqual([]);
    const before = b.published.length;
    await b.control({ requestId: "r2", op: "report", device: "shaker", values: { [`${V}.alarm`]: true, battery: 80 }, observedAt: now() });
    const occurrence = await w.waitFor((s) => s.topic.endsWith("/sim-bridge/event") && s.payload.type === "occurrence", 2000, mark);
    expect(validate("bridge/event.json", occurrence.payload)).toEqual([]);
    expect(occurrence.payload).toMatchObject({ device: "shaker", key: `${V}.alarm`, value: true });
    const statuses = b.published.slice(before).filter((p) => p.topic.endsWith("/devices/shaker/status"));
    expect(statuses.map((p) => p.payload)).toEqual([expect.objectContaining({ battery: 80 })]);
    expect(statuses[0]!.payload).not.toHaveProperty(`${V}.alarm`);
  });

  it("re-publishes devices before the status carrying a setting that changes a declaration (GA-BRIDGE-74), and sets an extension action's confirmedBy key", async () => {
    const { b, w, root } = await bridge({ devices: fixtureDevices(["pusher"]) });
    const client = await connectAsync(broker.url, { protocolVersion: 5 });
    cleanup.push(() => client.endAsync());
    const mark = w.seen.length;
    await client.publishAsync(`${root}/bridges/sim-bridge/devices/pusher/command`, JSON.stringify({
      commandId: "0b5f2c3e-1d4a-4f6b-8c9d-0e1f2a3b4c5e", issuedAt: now(), resultWithinMs: 10_000,
      value: { action: `${PUSH}.set_mode`, value: { mode: "click" } },
    }), { qos: 1 });
    const ack = await w.waitFor((s) => s.topic.endsWith("/devices/pusher/ack"), 2000, mark);
    expect(ack.payload.result).toBe("applied");
    const after = w.seen.slice(mark).filter((s) => s.topic.endsWith("/sim-bridge/devices") || s.topic.endsWith("/devices/pusher/status"));
    expect(after.map((s) => s.topic.split("/").pop())).toEqual(["devices", "status"]);
    expect(after[0]!.payload.devices[0].actions.find((a: any) => a.action === "onoff.turn_on").idempotent).toBe(false);
    expect(after[1]!.payload[`${PUSH}.mode`]).toBe("click");
    expect(b.received).toMatchObject([{ action: `${PUSH}.set_mode`, args: { mode: "click" } }]);
  });
});

describe("SimBridge: provisioning", () => {
  const request = async (root: string, op: string, body: Record<string, unknown>) => {
    const c = await connectAsync(broker.url, { protocolVersion: 5 });
    cleanup.push(() => c.endAsync());
    const requestId = randomUUID();
    await c.publishAsync(`${root}/bridges/sim-bridge/request/${op}`,
      JSON.stringify({ requestId, issuedAt: new Date(time.now()).toISOString(), ...body }), { qos: 1 });
    return requestId;
  };

  it("opens a window on join, names what joined in window_closed on join_close, and keeps Serve's default", async () => {
    const plain = await bridge();
    const first = await plain.w.waitFor((s) => s.topic === `${plain.root}/bridges/sim-bridge/status`, 2000);
    expect(first.payload.levels).toEqual(["Serve"]);
    expect(first.payload).not.toHaveProperty("bridgeType");
    const { b, w, root } = await bridge({ levels: ["Serve", "Provision"], bridgeType: "test" });
    const status = await w.waitFor((s) => s.topic === `${root}/bridges/sim-bridge/status`, 2000);
    expect(status.payload).toMatchObject({ levels: ["Serve", "Provision"], bridgeType: "test" });
    expect(validate("bridge/status.json", status.payload)).toEqual([]);
    const id = await request(root, "join", { transport: "test", windowMs: 60_000 });
    const reply = await w.waitFor((s) => s.topic.endsWith("/reply") && s.payload.requestId === id, 2000);
    expect(reply.payload).toMatchObject({ op: "join", status: "accepted" });
    expect(validate("bridge/reply.json", reply.payload)).toEqual([]);
    await b.control({ requestId: "j1", op: "join", device: "kettle", capabilities: ["onoff"], feedback: "closed" });
    const close = await request(root, "join_close", { transport: "test" });
    const closed = await w.waitFor((s) => s.topic.endsWith("/event") && s.payload.type === "window_closed", 2000);
    expect(closed.payload).toMatchObject({ transport: "test", devices: ["kettle"], windowMs: 60_000 });
    expect(validate("bridge/event.json", closed.payload)).toEqual([]);
    const ok = await w.waitFor((s) => s.topic.endsWith("/reply") && s.payload.requestId === close, 2000);
    expect(ok.payload).toMatchObject({ op: "join_close", status: "ok" });
  });

  it("answers a second join while its window is open failed(busy), the window unchanged (GA-BRIDGE-4)", async () => {
    const { w, root } = await bridge({ levels: ["Serve", "Provision"] });
    const first = await request(root, "join", { transport: "test", windowMs: 60_000 });
    await w.waitFor((s) => s.topic.endsWith("/reply") && s.payload.requestId === first, 2000);
    const second = await request(root, "join", { transport: "test", windowMs: 10_000 });
    const busy = await w.waitFor((s) => s.topic.endsWith("/reply") && s.payload.requestId === second, 2000);
    expect(busy.payload).toMatchObject({ op: "join", status: "failed", reason: "busy" });
    expect(validate("bridge/reply.json", busy.payload)).toEqual([]);
    const close = await request(root, "join_close", { transport: "test" });
    await w.waitFor((s) => s.topic.endsWith("/reply") && s.payload.requestId === close, 2000);
    const closed = await w.waitFor((s) => s.topic.endsWith("/event") && s.payload.type === "window_closed", 2000);
    expect(closed.payload.windowMs).toBe(60_000);
    const third = await request(root, "join", { transport: "test", windowMs: 10_000 });
    const again = await w.waitFor((s) => s.topic.endsWith("/reply") && s.payload.requestId === third, 2000);
    expect(again.payload.status).toBe("accepted");
  });

  it("closes a window at its windowMs, capped at 254 000 ms, naming nothing when nothing joined", async () => {
    const { w, root } = await bridge({ levels: ["Serve", "Provision"] });
    const id = await request(root, "join", { transport: "test", windowMs: 600_000 });
    await w.waitFor((s) => s.topic.endsWith("/reply") && s.payload.requestId === id, 2000);
    await time.stepAndWait(253_000);
    expect(w.seen.some((s) => s.topic.endsWith("/event") && s.payload.type === "window_closed")).toBe(false);
    await time.stepAndWait(1000);
    const closed = await w.waitFor((s) => s.topic.endsWith("/event") && s.payload.type === "window_closed", 2000);
    expect(closed.payload).toMatchObject({ transport: "test", devices: [], windowMs: 254_000 });
    time.reset();
  });

  it("answers a repeated requestId with its first reply, and refuses provisioning without Provision", async () => {
    const { b, w, root } = await bridge({ levels: ["Serve", "Provision"] });
    const id = await request(root, "remove", { device: "lamp", blockRejoin: false });
    await w.waitFor((s) => s.topic.endsWith("/event") && s.payload.type === "left", 2000);
    const left = w.seen.find((s) => s.topic.endsWith("/event") && s.payload.type === "left")!;
    expect(left.payload).not.toHaveProperty("requestId");
    const c = await connectAsync(broker.url, { protocolVersion: 5 });
    cleanup.push(() => c.endAsync());
    const from = w.seen.length;
    await c.publishAsync(`${root}/bridges/sim-bridge/request/remove`,
      JSON.stringify({ requestId: id, issuedAt: new Date(time.now()).toISOString(), device: "lamp", blockRejoin: false }), { qos: 1 });
    const again = await w.waitFor((s) => s.topic.endsWith("/reply") && s.payload.requestId === id, 2000, from);
    expect(again.payload).toMatchObject({ op: "remove", status: "accepted" });
    expect(b.requests.filter((r) => r.op === "remove")).toHaveLength(2);
    expect(w.seen.filter((s) => s.topic.endsWith("/event") && s.payload.type === "left")).toHaveLength(1);
    await b.setLevels(["Serve"]);
    const later = await request(root, "unblock", { identifier: "test:lamp" });
    const r = await w.waitFor((s) => s.topic.endsWith("/reply") && s.payload.requestId === later, 2000);
    expect(r.payload.status).toBe("invalid_request");
  });

  it("says a new bridgeType in a status at once, and in every later one", async () => {
    const { b, w } = await bridge({ levels: ["Serve", "Provision"], bridgeType: "esphome" });
    await b.setType("tasmota");
    await w.waitFor((s) => s.topic.endsWith("/status") && s.payload.bridgeType === "tasmota", 2000);
    await b.setLevels(["Serve"]);
    const later = await w.waitFor((s) => s.topic.endsWith("/status") && Array.isArray(s.payload.levels) && s.payload.levels.length === 1, 2000);
    expect(later.payload.bridgeType).toBe("tasmota");
  });

  it("answers a scripted op once as told, and commission accepted then commission_failed by default", async () => {
    const { b, w, root } = await bridge({ levels: ["Serve", "Provision"] });
    b.script("unblock", { reply: "failed", reason: "not_blocked" });
    const first = await request(root, "unblock", { identifier: "test:x" });
    const r1 = await w.waitFor((s) => s.topic.endsWith("/reply") && s.payload.requestId === first, 2000);
    expect(r1.payload).toMatchObject({ status: "failed", reason: "not_blocked" });
    const second = await request(root, "unblock", { identifier: "test:x" });
    const r2 = await w.waitFor((s) => s.topic.endsWith("/reply") && s.payload.requestId === second, 2000);
    expect(r2.payload).toMatchObject({ status: "ok" });
    const c = await request(root, "commission", { transport: "test", code: "34970112332" });
    const r3 = await w.waitFor((s) => s.topic.endsWith("/reply") && s.payload.requestId === c, 2000);
    expect(r3.payload.status).toBe("accepted");
    const failed = await w.waitFor((s) => s.topic.endsWith("/event") && s.payload.type === "commission_failed", 2000);
    expect(failed.payload.reason).toBe("unsupported");
  });

  it("removes by identifier, naming the device in left, and answers an identifier it never had failed(unknown_device) (GA-BRIDGE-27)", async () => {
    const { w, root } = await bridge({ levels: ["Serve", "Provision"] });
    const id = await request(root, "remove", { identifier: "test:lamp", blockRejoin: false });
    const r = await w.waitFor((s) => s.topic.endsWith("/reply") && s.payload.requestId === id, 2000);
    expect(r.payload).toMatchObject({ op: "remove", status: "accepted" });
    const left = await w.waitFor((s) => s.topic.endsWith("/event") && s.payload.type === "left", 2000);
    expect(left.payload.device).toBe("lamp");
    const devices = w.seen.filter((s) => s.topic.endsWith("/sim-bridge/devices")).at(-1)!;
    expect(devices.payload.devices.map((d: { id: string }) => d.id)).not.toContain("lamp");
    const from = w.seen.length;
    const gone = await request(root, "remove", { identifier: "test:nothing", blockRejoin: false });
    const f = await w.waitFor((s) => s.topic.endsWith("/reply") && s.payload.requestId === gone, 2000, from);
    expect(f.payload).toMatchObject({ op: "remove", status: "failed", reason: "unknown_device" });
    expect(validate("bridge/reply.json", f.payload)).toEqual([]);
    expect(w.seen.slice(from).some((s) => s.topic.endsWith("/event") && s.payload.type === "left")).toBe(false);
  });

  it("shows a fixture device's connections in devices, and its transport's on status", async () => {
    const lamp = { ...fixtureDevices(["lamp"])[0]!, connections: ["mac:D4A651000002"] };
    const { w, root } = await bridge({ devices: [lamp, ...fixtureDevices(["tv"])], transportConnections: ["zigbee:pan-0001"] });
    const devices = await w.waitFor((s) => s.topic === `${root}/bridges/sim-bridge/devices`, 2000);
    expect(validate("bridge/devices.json", devices.payload)).toEqual([]);
    const byId = Object.fromEntries(devices.payload.devices.map((d: { id: string; connections: string[] }) => [d.id, d.connections]));
    expect(byId).toEqual({ lamp: ["mac:D4A651000002"], tv: [] });
    const status = await w.waitFor((s) => s.topic === `${root}/bridges/sim-bridge/status`, 2000);
    expect(validate("bridge/status.json", status.payload)).toEqual([]);
    expect(status.payload.transports[0]).toMatchObject({ id: "test", connections: ["zigbee:pan-0001"] });
  });

  it("takes a device through connect: accepted, then devices naming it with the request's keys, then connected (GA-BRIDGE-40)", async () => {
    const { w, root } = await bridge({ levels: ["Serve", "Provision"], bridgeType: "esphome" });
    const from = w.seen.length;
    const id = await request(root, "connect", { address: { ip: "192.0.2.4" }, keys: ["mac:D4A651000004"] });
    const connected = await w.waitFor((s) => s.topic.endsWith("/event") && s.payload.type === "connected", 2000, from);
    expect(connected.payload).toMatchObject({ requestId: id, device: "taken-1" });
    expect(validate("bridge/event.json", connected.payload)).toEqual([]);
    const after = w.seen.slice(from);
    const at = (pred: (x: (typeof after)[number]) => boolean) => after.findIndex(pred);
    const reply = at((s) => s.topic.endsWith("/reply") && s.payload.requestId === id);
    const devices = at((s) => s.topic.endsWith("/sim-bridge/devices") && s.payload.devices.some((d: { id: string }) => d.id === "taken-1"));
    const event = at((s) => s.topic.endsWith("/event") && s.payload.type === "connected");
    expect(after[reply]!.payload).toMatchObject({ op: "connect", status: "accepted" });
    expect(reply).toBeGreaterThanOrEqual(0);
    expect(devices).toBeGreaterThan(reply);
    expect(event).toBeGreaterThan(devices);
    const taken = after[devices]!.payload.devices.find((d: { id: string }) => d.id === "taken-1");
    expect(taken.connections).toEqual(["mac:D4A651000004"]);
    expect(after.some((s) => s.topic.endsWith("/event") && s.payload.type === "joined")).toBe(false);
  });

  it("answers a scripted connect as told: a named device, a connect_failed, or accepted and then silence", async () => {
    const { b, w, root } = await bridge({ levels: ["Serve", "Provision"], bridgeType: "esphome" });
    b.script("connect", { reply: "accepted", then: { connected: { device: "hall", connections: ["mac:D4A651000005", "ip:192.0.2.5"] } } });
    let from = w.seen.length;
    const one = await request(root, "connect", { address: { ip: "192.0.2.5" }, keys: ["mac:D4A651000005"] });
    const named = await w.waitFor((s) => s.topic.endsWith("/event") && s.payload.type === "connected", 2000, from);
    expect(named.payload).toMatchObject({ requestId: one, device: "hall" });
    const doc = w.seen.slice(from).filter((s) => s.topic.endsWith("/sim-bridge/devices")).at(-1)!;
    expect(doc.payload.devices.find((d: { id: string }) => d.id === "hall").connections).toEqual(["mac:D4A651000005", "ip:192.0.2.5"]);
    b.script("connect", { reply: "accepted", then: { failed: "unreachable" } });
    from = w.seen.length;
    const two = await request(root, "connect", { address: { ip: "192.0.2.6" }, keys: ["mac:D4A651000006"] });
    const failed = await w.waitFor((s) => s.topic.endsWith("/event") && s.payload.type === "connect_failed", 2000, from);
    expect(failed.payload).toMatchObject({ requestId: two, reason: "unreachable" });
    b.script("connect", { reply: "accepted", silent: true });
    from = w.seen.length;
    const three = await request(root, "connect", { address: { ip: "192.0.2.7" }, keys: ["mac:D4A651000007"] });
    const r = await w.waitFor((s) => s.topic.endsWith("/reply") && s.payload.requestId === three, 2000, from);
    expect(r.payload.status).toBe("accepted");
    await new Promise((res) => setTimeout(res, 2000));
    expect(w.seen.slice(from).filter((s) => !/\/(reply|status|request\/connect)$/.test(s.topic)).map((s) => s.topic)).toEqual([]);
    await b.publishEvent("connect_failed", { requestId: three, reason: "timeout" });
    b.script("connect", { reply: "failed", reason: "unsupported" });
    from = w.seen.length;
    const four = await request(root, "connect", { keys: ["ble:D4A651000008"] });
    const r4 = await w.waitFor((s) => s.topic.endsWith("/reply") && s.payload.requestId === four, 2000, from);
    expect(r4.payload).toMatchObject({ status: "failed", reason: "unsupported" });
  });

  it("answers failed(busy) to a second connect while one is in flight, and takes one again once it ended", async () => {
    const { b, w, root } = await bridge({ levels: ["Serve", "Provision"], bridgeType: "esphome" });
    b.script("connect", { reply: "accepted", silent: true });
    let from = w.seen.length;
    const first = await request(root, "connect", { address: { ip: "192.0.2.9" }, keys: ["mac:D4A651000009"] });
    expect((await w.waitFor((s) => s.topic.endsWith("/reply") && s.payload.requestId === first, 2000, from)).payload.status).toBe("accepted");
    from = w.seen.length;
    const second = await request(root, "connect", { address: { ip: "192.0.2.10" }, keys: ["mac:D4A651000010"] });
    expect((await w.waitFor((s) => s.topic.endsWith("/reply") && s.payload.requestId === second, 2000, from)).payload)
      .toMatchObject({ status: "failed", reason: "busy" });
    await b.publishEvent("connected", { requestId: first, device: "late-1" });
    from = w.seen.length;
    const third = await request(root, "connect", { address: { ip: "192.0.2.10" }, keys: ["mac:D4A651000010"] });
    expect((await w.waitFor((s) => s.topic.endsWith("/reply") && s.payload.requestId === third, 2000, from)).payload.status).toBe("accepted");
  });

  it("drops the next reply of an op when told, and still does the work", async () => {
    const { b, w, root } = await bridge({ levels: ["Serve", "Provision"] });
    b.dropReply("remove");
    const id = await request(root, "remove", { device: "lamp", blockRejoin: false });
    await w.waitFor((s) => s.topic.endsWith("/event") && s.payload.type === "left", 2000);
    expect(w.seen.some((s) => s.topic.endsWith("/reply") && s.payload.requestId === id)).toBe(false);
  });
});
