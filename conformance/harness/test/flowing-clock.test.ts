import { describe, expect, it } from "vitest";
import type { TestContext } from "../src/context.js";
import { advanceTo, stillBefore } from "../src/tests/util.js";

/** A harness clock that also flows `flowMs` of real time with every step, as the time server's does. */
function flowing(flowMs: number) {
  let now = 0;
  const steps: number[] = [];
  const evidence: string[] = [];
  const ctx = {
    time: { now: () => now, stepAndWait: async (ms: number) => { steps.push(ms); now += ms + flowMs; } },
    evidence: (s: string) => evidence.push(s),
  } as unknown as TestContext;
  return { ctx, steps, evidence, set: (ms: number) => { now = ms; } };
}

describe("a clock that flows while it is stepped (the preflight's I5)", () => {
  it("advanceTo stops at the absolute target, the flow counted, never past it by more than one step's flow", async () => {
    const c = flowing(150);
    await advanceTo(c.ctx, 10_000, { chunkMs: 1000 });
    // A relative advance of 10 s would read 11.5 s; the absolute one stops within one flow of 10 s.
    expect(c.ctx.time.now()).toBeGreaterThanOrEqual(10_000);
    expect(c.ctx.time.now()).toBeLessThan(10_000 + 150 + 1);
    expect(c.steps.every((s) => s <= 1000)).toBe(true);
    expect(c.steps.reduce((a, b) => a + b, 0)).toBeLessThan(10_000);
  });

  it("advanceTo does nothing when the target has passed", async () => {
    const c = flowing(150);
    c.set(5000);
    await advanceTo(c.ctx, 4000);
    expect(c.steps).toEqual([]);
  });

  it("stillBefore fails an absence checked at or past its bound, and records the time it was checked", () => {
    const c = flowing(0);
    c.set(11_999);
    expect(() => stillBefore(c.ctx, 0, 12_000, "early")).not.toThrow();
    c.set(12_470);
    expect(() => stillBefore(c.ctx, 0, 12_000, "early")).toThrow(/12470 ms .* bound of 12000 ms/);
    expect(c.evidence.some((e) => e.includes("12470"))).toBe(true);
  });
});
