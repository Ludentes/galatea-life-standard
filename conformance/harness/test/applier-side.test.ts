import { fixtureDevices, SimBridge, startBroker, TimeServer, type Broker } from "@ludentes/galatea-life-sim";
import { TestClock } from "@ludentes/galatea-life-test-clock";
import { connectAsync } from "mqtt";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApplierSide, REQUEST_EXPIRY_S, TERMINAL_ACK_RESULTS } from "../src/seams/applier-side.js";
import { BridgeWatcher } from "../src/seams/bridge-watcher.js";

let broker: Broker;
let time: TimeServer;
beforeAll(async () => { broker = await startBroker(); time = await TimeServer.start(); }, 60_000);
afterAll(async () => { await time.close(); await broker.stop(); });

describe("the applier-side seam", () => {
  it("publishes a command and a request retained only when asked, and clears them", async () => {
    const base = "demo/a2/bridges/sim-bridge";
    const watch = await BridgeWatcher.start(broker.url, `${base}/#`);
    const applier = await ApplierSide.start(broker.url, base, watch, () => time.now());
    const late = await connectAsync(broker.url, { protocolVersion: 5 });
    const after = await connectAsync(broker.url, { protocolVersion: 5 });
    try {
      const held: string[] = [];
      late.on("message", (topic, payload, packet) => { if (payload.length && packet.retain) held.push(topic); });
      await applier.command("lamp", { action: "onoff.turn_off" });
      await applier.command("lamp", { action: "onoff.turn_on" }, { retain: true, resultWithinMs: 60_000 });
      await applier.request("snapshot", {}, undefined, { retain: true });
      await late.subscribeAsync([`${base}/devices/+/command`, `${base}/request/+`], { qos: 1 });
      for (let i = 0; i < 40 && held.length < 2; i++) await new Promise((r) => setTimeout(r, 50));
      expect(held.sort()).toEqual([`${base}/devices/lamp/command`, `${base}/request/snapshot`]);
      await applier.clearRetained();
      const left: string[] = [];
      after.on("message", (topic, payload) => { if (payload.length) left.push(topic); });
      await after.subscribeAsync([`${base}/devices/+/command`, `${base}/request/+`], { qos: 1 });
      await new Promise((r) => setTimeout(r, 300));
      expect(left).toEqual([]);
    } finally {
      await late.endAsync();
      await after.endAsync();
      await applier.close();
      await watch.close();
    }
  });

  it("sends commands and requests with Message Expiry, never retained, and reads their acks and replies", async () => {
    const root = "demo/a1";
    const base = `${root}/bridges/sim-bridge`;
    const clock = await TestClock.connect(time.source);
    const bridge = new SimBridge({ brokerUrl: broker.url, root, bridgeId: "sim-bridge", clock, runId: "r",
      devices: fixtureDevices(["lamp"]) });
    await bridge.start();
    const watch = await BridgeWatcher.start(broker.url, `${base}/#`);
    const applier = await ApplierSide.start(broker.url, base, watch, () => time.now());
    // What the broker delivers, with the publish's properties, as the bridge would see it.
    const tap = await connectAsync(broker.url, { protocolVersion: 5 });
    const tapped: { topic: string; retain: boolean; expiry?: number; body: any }[] = [];
    tap.on("message", (topic, payload, packet) => {
      tapped.push({ topic, retain: packet.retain, expiry: packet.properties?.messageExpiryInterval, body: JSON.parse(payload.toString()) });
    });
    await tap.subscribeAsync([`${base}/devices/+/command`, `${base}/request/+`], { qos: 1 });
    try {
      await watch.waitFor((s) => s.topic === `${base}/status`, 5000);
      const commandId = await applier.command("lamp", { action: "onoff.turn_on" }, { resultWithinMs: 2500 });
      const ack = await applier.ack("lamp", commandId, 5000);
      expect(ack.payload).toMatchObject({ commandId, result: "applied" });
      const requestId = await applier.request("snapshot");
      const reply = await applier.reply(requestId, 5000);
      expect(reply.payload).toMatchObject({ requestId, op: "snapshot", status: "ok" });
      expect(tapped.map((t) => [t.topic, t.retain, t.expiry])).toEqual([
        [`${base}/devices/lamp/command`, false, 3], [`${base}/request/snapshot`, false, REQUEST_EXPIRY_S]]);
      expect(Math.abs(Date.parse(tapped[0]!.body.issuedAt) - time.now())).toBeLessThan(2000);
      expect(tapped[0]!.body).toMatchObject({ commandId, resultWithinMs: 2500, value: { action: "onoff.turn_on" } });
      expect(applier.events()).toEqual([]);
      await expect(applier.command("lamp", { action: "Not An Action" })).rejects.toThrow(/bad command/);

      // Fields a test adds ride beside the envelope's own and never replace them.
      const mark = tapped.length;
      const again = await applier.request("snapshot", { requestId: "not-this", issuedAt: "1999-01-01T00:00:00.000Z", note: "x" });
      await applier.reply(again, 5000);
      const extra = await applier.command("lamp", { action: "onoff.turn_off" }, { extra: { futureField: 1, commandId: "not-this" } });
      await applier.ack("lamp", extra, 5000);
      for (let i = 0; i < 40 && tapped.length < mark + 2; i++) await new Promise((r) => setTimeout(r, 50));
      const [request, command] = tapped.slice(mark).map((t) => t.body);
      expect(request).toMatchObject({ requestId: again, note: "x" });
      expect(Math.abs(Date.parse(request.issuedAt) - time.now())).toBeLessThan(2000);
      expect(command).toMatchObject({ commandId: extra, futureField: 1, value: { action: "onoff.turn_off" } });
    } finally {
      await tap.endAsync();
      await applier.close();
      await watch.close();
      await bridge.stop();
      clock.close();
    }
  }, 20_000);

  it("reads the terminal ack past a non-terminal received, which ack() still returns", async () => {
    const base = "demo/a1/bridges/fake";
    const watch = await BridgeWatcher.start(broker.url, `${base}/#`);
    const applier = await ApplierSide.start(broker.url, base, watch, () => time.now());
    const bridge = await connectAsync(broker.url, { protocolVersion: 5 });
    try {
      const commandId = "c-1";
      const ack = (result: string) => bridge.publishAsync(`${base}/devices/lamp/ack`,
        JSON.stringify({ commandId, result, source: "fake", timestamp: new Date().toISOString() }), { qos: 1 });
      await ack("received");
      await ack("applied");
      expect((await applier.terminalAck("lamp", commandId, 5000)).payload.result).toBe("applied");
      expect((await applier.ack("lamp", commandId, 5000)).payload.result).toBe("received");
      expect(applier.terminalAcks("lamp", commandId).map((s) => s.payload.result)).toEqual(["applied"]);
      expect(TERMINAL_ACK_RESULTS).toEqual(["applied", "sent", "failed", "unsupported"]);
      await expect(applier.terminalAck("lamp", "c-2", 300)).rejects.toThrow(/within 300 ms/);
      // An ack no bridge may send is the terminal one, for the test to fail on its form.
      await bridge.publishAsync(`${base}/devices/lamp/ack`, JSON.stringify({ commandId: "c-3", result: "done" }), { qos: 1 });
      expect((await applier.terminalAck("lamp", "c-3", 5000)).payload.result).toBe("done");
    } finally {
      await bridge.endAsync();
      await applier.close();
      await watch.close();
    }
  }, 20_000);
});
