import { createSocket } from "node:dgram";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { TestClock, clockFromEnv } from "../src/clock.js";
import { isRequest, request, response } from "../src/sntp.js";

async function fakeSource(startMs: number) {
  let offset = startMs - Date.now();
  const socket = createSocket("udp4");
  socket.on("message", (msg, rinfo) => {
    if (isRequest(msg)) socket.send(response(msg, Date.now() + offset), rinfo.port, rinfo.address);
  });
  await new Promise<void>((r) => socket.bind(0, "127.0.0.1", r));
  const { port } = socket.address() as AddressInfo;
  return { source: `127.0.0.1:${port}`, step: (ms: number) => { offset += ms; }, close: () => socket.close() };
}

const HOUR = 3_600_000;
const T0 = Date.UTC(2030, 0, 1);
const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

describe("TestClock", () => {
  it("takes its time from the source", async () => {
    const src = await fakeSource(T0);
    const clock = await TestClock.connect(src.source);
    cleanup.push(() => clock.close(), src.close);
    expect(Math.abs(clock.now() - T0)).toBeLessThan(200);
  });

  it("fires an hour's timer when the source steps an hour", async () => {
    const src = await fakeSource(T0);
    const clock = await TestClock.connect(src.source);
    cleanup.push(() => clock.close(), src.close);
    let fired = false;
    clock.setTimeout(() => { fired = true; }, HOUR);
    await new Promise((r) => setTimeout(r, 300));
    expect(fired).toBe(false);
    src.step(HOUR);
    await clock.sync();
    expect(fired).toBe(true);
  });

  it("catches an interval up across a step", async () => {
    const src = await fakeSource(T0);
    const clock = await TestClock.connect(src.source);
    cleanup.push(() => clock.close(), src.close);
    let ticks = 0;
    clock.setInterval(() => { ticks++; }, 10_000);
    src.step(60_500);
    await clock.sync();
    expect(ticks).toBe(6);
  });

  it("does not fire a cleared timer", async () => {
    const src = await fakeSource(T0);
    const clock = await TestClock.connect(src.source);
    cleanup.push(() => clock.close(), src.close);
    let fired = false;
    clock.clear(clock.setTimeout(() => { fired = true; }, 1000));
    src.step(2000);
    await clock.sync();
    expect(fired).toBe(false);
  });

  it("ignores an answer to another request", async () => {
    const socket = createSocket("udp4");
    socket.on("message", (msg, rinfo) => {
      if (!isRequest(msg)) return;
      socket.send(response(request(0), T0 + HOUR), rinfo.port, rinfo.address);
      socket.send(response(msg, T0), rinfo.port, rinfo.address);
    });
    await new Promise<void>((r) => socket.bind(0, "127.0.0.1", r));
    const { port } = socket.address() as AddressInfo;
    const clock = await TestClock.connect(`127.0.0.1:${port}`);
    cleanup.push(() => clock.close(), () => socket.close());
    expect(Math.abs(clock.now() - T0)).toBeLessThan(200);
  });

  it("keeps its source when a retarget finds no answer", async () => {
    const src = await fakeSource(T0);
    const clock = await TestClock.connect(src.source);
    cleanup.push(() => clock.close(), src.close);
    const silent = createSocket("udp4");
    await new Promise<void>((r) => silent.bind(0, "127.0.0.1", r));
    const dead = `127.0.0.1:${(silent.address() as AddressInfo).port}`;
    cleanup.push(() => silent.close());
    await expect(clock.retarget(dead)).rejects.toThrow(/no answer/);
    expect(clock.source).toBe(src.source);
    src.step(HOUR);
    await clock.sync();
    expect(Math.abs(clock.now() - (T0 + HOUR))).toBeLessThan(2000);
  });

  it("reads the environment", async () => {
    const src = await fakeSource(T0);
    const clock = await clockFromEnv({ GALATEA_TIME_SOURCE: src.source });
    cleanup.push(() => clock.close(), src.close);
    expect(Math.abs(clock.now() - T0)).toBeLessThan(200);
    const system = await clockFromEnv({});
    expect(Math.abs(system.now() - Date.now())).toBeLessThan(50);
    system.close();
  });
});
