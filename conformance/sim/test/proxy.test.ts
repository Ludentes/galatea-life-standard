import { connectAsync, type MqttClient } from "mqtt";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { startBroker, type Broker } from "../src/broker.js";
import { SeverableProxy } from "../src/proxy.js";

let broker: Broker;
const cleanup: (() => unknown)[] = [];
beforeAll(async () => { broker = await startBroker(); }, 60_000);
afterAll(async () => { await broker.stop(); });
afterEach(async () => { while (cleanup.length) await cleanup.pop()!(); });

const until = async (check: () => boolean, ms: number) => {
  const deadline = Date.now() + ms;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`not within ${ms} ms`);
    await new Promise((r) => setTimeout(r, 50));
  }
};

async function through(keepalive = 10): Promise<{ proxy: SeverableProxy; client: MqttClient; closes: number[] }> {
  const proxy = await SeverableProxy.start(broker.url);
  const client = await connectAsync(proxy.url, { protocolVersion: 5, keepalive, reconnectPeriod: 200 });
  const closes: number[] = [];
  client.on("close", () => closes.push(Date.now()));
  client.on("error", () => undefined);
  cleanup.push(() => proxy.close(), () => client.endAsync(true));
  return { proxy, client, closes };
}

describe("SeverableProxy", () => {
  it("forwards to the broker, cuts the link on sever, refuses reconnection, and lets it back on restore", async () => {
    const { proxy, client, closes } = await through();
    await client.subscribeAsync("demo/proxy/x", { qos: 1 });
    proxy.sever();
    await until(() => closes.length > 0, 2000);
    await new Promise((r) => setTimeout(r, 1000));
    expect(client.connected).toBe(false);
    proxy.restore();
    await until(() => client.connected, 3000);
  });

  it("stalls a link so that only the client's keepalive finds it gone", async () => {
    const { proxy, client, closes } = await through(2);
    const t0 = Date.now();
    proxy.stall();
    await until(() => closes.length > 0, 6000);
    expect(closes[0]! - t0).toBeGreaterThanOrEqual(1500);
    proxy.restore();
    await until(() => client.connected, 3000);
  });
});

describe("SeverableProxy: holding", () => {
  it("holds what the client sends, while what the broker sends still arrives, and forwards it on restore", async () => {
    const { proxy, client } = await through();
    const other = await connectAsync(broker.url, { protocolVersion: 5 });
    cleanup.push(() => other.endAsync(true));
    const got: string[] = [];
    await client.subscribeAsync("demo/proxy/in", { qos: 1 });
    await other.subscribeAsync("demo/proxy/out", { qos: 1 });
    other.on("message", (t) => got.push(t));
    client.on("message", (t) => got.push(t));
    proxy.holdOutbound();
    const sent = client.publishAsync("demo/proxy/out", "x", { qos: 1 });
    await other.publishAsync("demo/proxy/in", "y", { qos: 1 });
    await until(() => got.includes("demo/proxy/in"), 2000);
    await new Promise((r) => setTimeout(r, 300));
    expect(got).toEqual(["demo/proxy/in"]);
    proxy.restore();
    await sent;
    await until(() => got.includes("demo/proxy/out"), 2000);
  });
});
