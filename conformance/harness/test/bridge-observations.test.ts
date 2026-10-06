import { describe as suite, expect, it } from "vitest";
import { BASE, fails, fake, type Hooks, run } from "./fake-bridge.js";

const iso = (ms: number) => new Date(ms).toISOString();

/**
 * A sensor's bridge as the reference is: `lastCheckIn` is when a message reached it, kept across a
 * restart, and a reading's time is the report's, never ahead of its own clock, which reads `lagMs`
 * behind the harness's (an SNTP estimate on a loaded host). `statuses` false publishes no device status.
 */
function sensor(lagMs: number, statuses = true): Hooks {
  const kept = new Map<string, string | null>();
  return {
    describe(id, _given, dev) { dev.roster.lastCheckIn = kept.get(id) ?? null; },
    op(op, w) {
      const dev = w.devs.get(String(op.device));
      if (!dev || (op.op !== "checkIn" && op.op !== "report")) return;
      dev.roster.lastCheckIn = iso(w.now());
      kept.set(String(op.device), dev.roster.lastCheckIn);
      if (op.op === "report" && statuses) {
        const at = Math.min(Date.parse(String(op.observedAt)), w.now() - lagMs);
        w.publish(`${BASE}/devices/${op.device}/status`, { ...(op.values as object), timestamp: iso(at) });
      }
    },
  };
}

suite("GA-BRIDGE-37", () => {
  it("passes a bridge whose clock agrees with the harness's", async () => {
    await run("GA-BRIDGE-37", fake(sensor(0)).ctx);
  });

  it("passes a bridge whose clock reads a few ms behind, so a report stamped at the harness's now would be clamped", async () => {
    // Final review I1: a conforming bridge may clamp a stamp ahead of its own clock (GA-BRIDGE-3), so
    // the test's reports must be stamped in the past, as a device's are.
    await run("GA-BRIDGE-37", fake(sensor(3)).ctx);
  });

  it("fails a bridge that publishes no status for a report, and lists what it saw after the report", async () => {
    const { ctx } = fake(sensor(0, false));
    await fails("GA-BRIDGE-37", ctx, /no status with that timestamp.*after the report: roster at .*lastCheckIn/);
  });

  it("fails a bridge that moves lastCheckIn on its own status", async () => {
    const hooks = sensor(0);
    const { ctx } = fake({ ...hooks, tick(now, w) { for (const d of w.devs.values()) d.roster.lastCheckIn = iso(now); } });
    const err = await run("GA-BRIDGE-37", ctx).then(() => undefined, (e: unknown) => e);
    expect(String(err)).toMatch(/lastCheckIn/);
  });
});
