import { TestClock } from "@ludentes/galatea-life-test-clock";
import { afterEach, describe, expect, it } from "vitest";
import { SUBJECT_EPOCH_MS, TimeServer } from "../src/time-server.js";

const HOUR = 3_600_000;
const cleanup: (() => unknown)[] = [];
afterEach(async () => { while (cleanup.length) await cleanup.pop()!(); });

describe("TimeServer", () => {
  it("starts subject time at the epoch, years from the wall clock", async () => {
    const time = await TimeServer.start();
    cleanup.push(() => time.close());
    expect(Math.abs(time.now() - SUBJECT_EPOCH_MS)).toBeLessThan(100);
  });

  it("a client clock follows a step once it has taken it", async () => {
    const time = await TimeServer.start();
    const clock = await TestClock.connect(time.source);
    cleanup.push(() => time.close(), () => clock.close());
    let fired = false;
    clock.setTimeout(() => { fired = true; }, HOUR);
    await new Promise((r) => setTimeout(r, 600));
    await time.stepAndWait(HOUR);
    expect(fired).toBe(true);
    expect(Math.abs(clock.now() - time.now())).toBeLessThan(100);
  });

  it("forgets a client that stops asking", async () => {
    const time = await TimeServer.start();
    const clock = await TestClock.connect(time.source);
    cleanup.push(() => time.close());
    await new Promise((r) => setTimeout(r, 600));
    clock.close();
    await new Promise((r) => setTimeout(r, 60));
    const t = Date.now();
    await time.stepAndWait(1000);
    expect(Date.now() - t).toBeLessThan(1000);
    const t2 = Date.now();
    await time.stepAndWait(1000);
    expect(Date.now() - t2).toBeLessThan(1000);
  });

  it("still awaits a live client", async () => {
    const time = await TimeServer.start();
    const clock = await TestClock.connect(time.source);
    cleanup.push(() => time.close(), () => clock.close());
    await new Promise((r) => setTimeout(r, 600));
    await time.stepAndWait(HOUR);
    expect(Math.abs(clock.now() - time.now())).toBeLessThan(200);
  });

  it("reset goes back to the epoch and forgets its clients", async () => {
    const time = await TimeServer.start();
    const clock = await TestClock.connect(time.source);
    cleanup.push(() => time.close());
    await new Promise((r) => setTimeout(r, 200));
    time.step(HOUR);
    clock.close();
    time.reset();
    expect(Math.abs(time.now() - SUBJECT_EPOCH_MS)).toBeLessThan(100);
    await time.stepAndWait(1000);
  });

  it("advances in chunks, so a periodic job runs in each, quickly", async () => {
    const time = await TimeServer.start();
    const clock = await TestClock.connect(time.source);
    cleanup.push(() => time.close(), () => clock.close());
    const ticks: number[] = [];
    const every = () => { ticks.push(clock.now()); clock.setTimeout(every, 10_000); };
    clock.setTimeout(every, 10_000);
    await new Promise((r) => setTimeout(r, 200));
    const t = Date.now();
    await time.advance(60_000, { chunkMs: 5_000 });
    expect(Date.now() - t).toBeLessThan(3000);
    expect(ticks.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]! - ticks[i - 1]!).toBeLessThanOrEqual(15_000);
  });

  it("maps a real time to subject time", async () => {
    const time = await TimeServer.start();
    cleanup.push(() => time.close());
    const real = Date.now();
    expect(Math.abs(time.at(real) - time.now())).toBeLessThan(50);
  });
});
