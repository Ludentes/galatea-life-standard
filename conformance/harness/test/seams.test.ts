import { SimApplier, SimBridge, TimeServer, freePort, serveMcp, startBroker, type Broker } from "@ludentes/galatea-life-sim";
import { TestClock } from "@ludentes/galatea-life-test-clock";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectAsync } from "mqtt";
import { RequirementFailure, SubjectFault } from "../src/assert.js";
import { BridgeWatcher } from "../src/seams/bridge-watcher.js";
import { McpSeam } from "../src/seams/mcp.js";
import { TestTransportClient } from "../src/seams/test-transport.js";
import { mustBeNotPermitted, refusal } from "../src/tests/util.js";

let broker: Broker;
let time: TimeServer;
beforeAll(async () => { broker = await startBroker(); time = await TimeServer.start(); }, 60_000);
afterAll(async () => { await time.close(); await broker.stop(); });

describe("seam clients", () => {
  it("watch a bridge and drive its test transport", async () => {
    const clock = await TestClock.connect(time.source);
    const watch = await BridgeWatcher.start(broker.url, "demo/s1/bridges/sim-bridge/#");
    const bridge = new SimBridge({ brokerUrl: broker.url, root: "demo/s1", bridgeId: "sim-bridge", clock, runId: "r" });
    await bridge.start();
    const transport = await TestTransportClient.start(broker.url, "demo/s1/test/sim-bridge/control");
    try {
      const status = await watch.waitFor((s) => s.topic.endsWith("/status"), 2000);
      expect(status.retained).toBe(false);
      await transport.send({ op: "commandResult", device: "lamp", result: "none" });
      const refused = transport.send({ op: "report", device: "nope", values: {}, observedAt: "2030-01-01T08:00:00.000Z" });
      await expect(refused).rejects.toThrow(/no device nope/);
      await expect(refused).rejects.toBeInstanceOf(SubjectFault);
      await expect(watch.waitFor(() => false, 200)).rejects.toBeInstanceOf(RequirementFailure);
    } finally {
      await transport.close();
      await bridge.stop();
      await watch.close();
      clock.close();
    }
  });

  it("take a subject's non-JSON reply as the subject's fault, and keep running", async () => {
    const transport = await TestTransportClient.start(broker.url, "demo/s3/test/b/control");
    const subject = await connectAsync(broker.url, { protocolVersion: 5 });
    try {
      await subject.publishAsync("demo/s3/test/b/control/reply", "not json", { qos: 1 });
      await subject.publishAsync("demo/s3/test/b/control/received", "{also not", { qos: 1 });
      const sent = transport.send({ op: "transportState", state: "up" }, 300);
      await expect(sent).rejects.toBeInstanceOf(SubjectFault);
      await expect(sent).rejects.toThrow(/not JSON/);
      expect(transport.received).toEqual([]);
    } finally {
      await subject.endAsync();
      await transport.close();
    }
  });

  it("connect in the 2025 era when asked, to a subject that serves both", async () => {
    const clock = await TestClock.connect(time.source);
    const applier = new SimApplier({ brokerUrl: broker.url, identity: "sim-applier", root: "demo/s4", clock,
      ownerCredential: "owner", runId: "r" });
    await applier.start();
    const server = await serveMcp(applier, await freePort());
    const owner = await McpSeam.connect(server.url, "owner", { era: "legacy" });
    try {
      expect(owner.protocolVersion).toBe("2025-11-25");
      expect((await owner.callOk("describe")).test_run_id).toBe("r");
    } finally {
      await owner.close();
      await server.close();
      await applier.stop();
      clock.close();
    }
  });

  it("take an MCP subject that cannot be reached, times out or answers non-JSON as the subject's fault", async () => {
    await expect(McpSeam.connect(`http://127.0.0.1:${await freePort()}/mcp`, "x")).rejects.toBeInstanceOf(SubjectFault);
    const fake = (callTool: () => Promise<unknown>) => new (McpSeam as any)({ callTool, close: async () => undefined }) as McpSeam;
    const garbled = fake(async () => ({ content: [{ type: "text", text: "not json" }] }));
    await expect(garbled.call("describe")).rejects.toBeInstanceOf(SubjectFault);
    const silent = fake(async () => { throw new Error("Request timed out"); });
    await expect(silent.call("describe")).rejects.toBeInstanceOf(SubjectFault);
    await expect(silent.callOk("describe")).rejects.toThrow(/describe: Request timed out/);
  });

  it("call the applier over MCP, errors included", async () => {
    const clock = await TestClock.connect(time.source);
    const applier = new SimApplier({ brokerUrl: broker.url, identity: "sim-applier", root: "demo/s2", clock,
      ownerCredential: "owner", runId: "r" });
    await applier.start();
    const server = await serveMcp(applier, await freePort());
    const owner = await McpSeam.connect(server.url, "owner");
    try {
      expect(owner.protocolVersion).toBe("2026-07-28");
      expect((await owner.callOk("describe")).test_run_id).toBe("r");
      const denied = await owner.call("state");
      expect(denied).toMatchObject({ ok: false, error: "not_permitted" });
      await expect(owner.callOk("state")).rejects.toBeInstanceOf(RequirementFailure);
    } finally {
      await owner.close();
      await server.close();
      await applier.stop();
      clock.close();
    }
  });

  it("grade an applier that speaks only the 2025 era", async () => {
    const clock = await TestClock.connect(time.source);
    const applier = new SimApplier({ brokerUrl: broker.url, identity: "sim-applier", root: "demo/s3", clock,
      ownerCredential: "owner", runId: "r", mutation: "speaks-only-2025" });
    await applier.start();
    const server = await serveMcp(applier, await freePort());
    const owner = await McpSeam.connect(server.url, "owner");
    try {
      expect(owner.protocolVersion).toBe("2025-11-25");
      expect((await owner.callOk("describe")).test_run_id).toBe("r");
      expect(await owner.call("state")).toMatchObject({ ok: false, error: "not_permitted" });
    } finally {
      await owner.close();
      await server.close();
      await applier.stop();
      clock.close();
    }
  });

  it("take only not_permitted as GA-AUTH-3's refusal: an answer or a refused connection fails", async () => {
    const clock = await TestClock.connect(time.source);
    const applier = new SimApplier({ brokerUrl: broker.url, identity: "sim-applier", root: "demo/s5", clock,
      ownerCredential: "owner", runId: "r" });
    await applier.start();
    const server = await serveMcp(applier, await freePort());
    try {
      expect(await refusal(server.url, "stranger")).toBe("not_permitted");
      expect(await mustBeNotPermitted(server.url, "stranger", "a stranger")).toBe("not_permitted");
      expect(await refusal(server.url, "owner")).toBe("answered");
      await expect(mustBeNotPermitted(server.url, "owner", "the owner")).rejects.toThrow(/the owner was answered/);
      const nowhere = `http://127.0.0.1:${await freePort()}/mcp`;
      expect(await refusal(nowhere, "stranger")).toMatch(/^refused at connect/);
      await expect(mustBeNotPermitted(nowhere, "stranger", "a stranger")).rejects.toBeInstanceOf(RequirementFailure);
    } finally {
      await server.close();
      await applier.stop();
      clock.close();
    }
  });
});
