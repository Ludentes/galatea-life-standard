import { once } from "node:events";
import { connect, createServer, type AddressInfo, type Socket } from "node:net";
import { describe, expect, it } from "vitest";
import { ephemeralLow, kernelPort, listenPort } from "../src/ports.js";

describe("a subject's listening port", () => {
  it("is drawn below the range outgoing connections take their ports from, where the kernel's own pick lies", async () => {
    const low = ephemeralLow();
    // Outgoing connections, as a subject's to Postgres and the broker: each takes a local port in the range.
    const server = createServer((s) => s.on("error", () => undefined));
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const sockets: Socket[] = [];
    try {
      for (let i = 0; i < 20; i++) {
        const s = connect((server.address() as AddressInfo).port, "127.0.0.1");
        await once(s, "connect");
        sockets.push(s);
      }
      // The old race: the kernel's listen(0) port is drawn from that same range, so between the harness
      // closing it and the subject binding it, any of these could have taken it.
      expect(sockets.every((s) => s.localPort! >= low)).toBe(true);
      expect(await kernelPort()).toBeGreaterThanOrEqual(low);
      // The fix: a listening port below the range, which no outgoing connection is given.
      for (let i = 0; i < 20; i++) {
        const p = await listenPort();
        expect(p).toBeLessThan(low);
        expect(p).toBeGreaterThanOrEqual(20000);
      }
    } finally {
      for (const s of sockets) s.destroy();
      server.close();
    }
  });

  it("skips a port another server holds", async () => {
    const held = createServer();
    held.listen(25000, "127.0.0.1");
    await once(held, "listening");
    try {
      // The first draw lands on the held port; the next, on a free one.
      const draws = [5000 / (ephemeralLow() - 20000), 0.5];
      const p = await listenPort(() => draws.shift() ?? Math.random());
      expect(p).not.toBe(25000);
      expect(p).toBeLessThan(ephemeralLow());
    } finally {
      held.close();
    }
  });

  it("reads the range's low end, and falls back when it cannot", () => {
    expect(ephemeralLow(() => "40000\t60999\n")).toBe(40000);
    expect(ephemeralLow(() => { throw new Error("no proc"); })).toBe(32768);
    expect(ephemeralLow(() => "1024 65535")).toBe(32768);
  });
});
