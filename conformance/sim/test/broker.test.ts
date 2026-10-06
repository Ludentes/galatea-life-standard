import { createServer } from "node:net";
import { connectAsync } from "mqtt";
import { describe, expect, it } from "vitest";
import { measureAllowance, startBroker, waitForConnect } from "../src/broker.js";
import { brokerUrl, parseBrokerUrl } from "../src/net.js";

describe("broker", () => {
  it("starts, keeps a retained message, measures its allowance and stops", async () => {
    const broker = await startBroker();
    try {
      const a = await connectAsync(broker.url, { protocolVersion: 5 });
      await a.publishAsync("demo/probe", "kept", { qos: 1, retain: true });
      await a.endAsync();
      const b = await connectAsync(broker.url, { protocolVersion: 5 });
      const got = new Promise<{ retain: boolean; body: string }>((resolve) =>
        b.on("message", (_t, payload, packet) => resolve({ retain: packet.retain, body: payload.toString() })));
      await b.subscribeAsync("demo/probe", { qos: 1 });
      expect(await got).toEqual({ retain: true, body: "kept" });
      await b.endAsync();
      const allowance = await measureAllowance(broker.url);
      expect(allowance).toBeGreaterThan(0);
      expect(allowance).toBeLessThan(1000);
    } finally {
      await broker.stop();
    }
    await expect(connectAsync(broker.url, { protocolVersion: 5, reconnectPeriod: 0, connectTimeout: 1000 }))
      .rejects.toThrow();
  }, 60_000);

  it("gives up on a listener that drops every connection before the broker answers", async () => {
    // Docker's port proxy does this while the broker inside the container is still starting.
    const server = createServer((socket) => socket.destroy());
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as { port: number };
    const t0 = Date.now();
    try {
      await expect(waitForConnect(`mqtt://127.0.0.1:${port}`, 1500)).rejects.toThrow(/did not accept a connection/);
      expect(Date.now() - t0).toBeLessThan(5000);
    } finally {
      server.close();
    }
  }, 10_000);

  it("carries an identity in the broker URL", () => {
    const url = brokerUrl("mqtt://127.0.0.1:1883", "sim-bridge");
    expect(url).toBe("mqtt://sim-bridge@127.0.0.1:1883");
    expect(parseBrokerUrl(url)).toEqual({ url: "mqtt://127.0.0.1:1883", identity: "sim-bridge" });
  });
});
