import { describe as suite, expect, it } from "vitest";
import { RequirementFailure } from "../src/assert.js";
import type { TestContext } from "../src/context.js";
import type { Seen } from "../src/seams/bridge-watcher.js";
import { OpUnsupported } from "../src/seams/test-transport.js";
import { describe, passUntil, settled } from "../src/tests/bridge/doer.js";

const BASE = "demo/bridges/subject";

/** A watcher, a clock and a test transport, enough for the doer's helpers; `onAdvance` runs on each step of the clock. */
function fake(seen: Seen[], onAdvance: (now: number) => void = () => {}) {
  const sent: Record<string, unknown>[] = [];
  let now = 0;
  const watch = {
    seen,
    async waitFor(pred: (s: Seen) => boolean, ms: number, from = 0): Promise<Seen> {
      const deadline = Date.now() + ms;
      for (;;) {
        const hit = seen.slice(from).find(pred);
        if (hit) return hit;
        if (Date.now() > deadline) throw new RequirementFailure(`nothing within ${ms} ms`);
        await new Promise((r) => setTimeout(r, 10));
      }
    },
  };
  const ctx = {
    root: "demo", bridgeId: "subject", allowanceMs: 0, watch,
    time: { now: () => now, advance: async (ms: number) => { now += ms; onAdvance(now); } },
    transport: {
      send: async (op: Record<string, unknown>) => {
        sent.push(op);
        if (op.op === "describe") seen.push(devices(String(op.device)));
        return {};
      },
    },
  } as unknown as TestContext;
  return { ctx, sent };
}

const status = (state: string, transports: string[]): Seen => ({ topic: `${BASE}/status`, retained: true, realAt: Date.now(),
  payload: { state, ...(state === "offline" ? { graceful: true } : {}), transports: transports.map((s, i) => ({ id: `t${i}`, kind: "zigbee", state: s })) } });
const devices = (id: string): Seen => ({ topic: `${BASE}/devices`, retained: true, realAt: Date.now(), payload: { devices: [{ id }] } });

suite("the doer's describe", () => {
  it("describes at once when the latest status shows every transport up", async () => {
    const { ctx, sent } = fake([status("online", ["up"])]);
    await describe(ctx, "lamp", {});
    expect(sent.map((o) => o.op)).toEqual(["describe"]);
  });

  it("sends the doer's op first, then waits for the transports to come up, on the subject's clock", async () => {
    const seen = [status("degraded", ["down"])];
    const { ctx, sent } = fake(seen, (now) => {
      expect(sent.map((o) => o.op)).toEqual(["describe"]);
      if (now === 3000) seen.push(status("degraded", ["up"]));
    });
    await describe(ctx, "lamp", {});
    expect(ctx.time.now()).toBe(3000);
    expect(sent.map((o) => o.op)).toEqual(["describe"]);
  });

  it("takes an unknown transport as no obstacle (GA-BRIDGE-72), but waits out a down one", async () => {
    const { ctx } = fake([status("online", ["up", "unknown"])]);
    await describe(ctx, "lamp", {});
    expect(ctx.time.now()).toBe(0);

    const seen = [status("degraded", ["unknown", "down"])];
    const late = fake(seen, (now) => { if (now === 2000) seen.push(status("online", ["unknown", "up"])); });
    await describe(late.ctx, "lamp", {});
    expect(late.ctx.time.now()).toBe(2000);
  });

  it("is refused at once by a subject with no doer, before any wait", async () => {
    const { ctx } = fake([status("degraded", ["down"])]);
    (ctx.transport as { send: unknown }).send = async (op: { op: string }) => { throw new OpUnsupported(op.op, "no doer"); };
    await expect(describe(ctx, "lamp", {})).rejects.toBeInstanceOf(OpUnsupported);
    expect(ctx.time.now()).toBe(0);
  });

  it("does not take the status of an instance before the subject's latest start as up", async () => {
    const old = { ...status("online", ["up"]), realAt: Date.now() - 10_000 };
    const seen = [old];
    const { ctx, sent } = fake(seen, (now) => { if (now === 2000) seen.push(status("online", ["up"])); });
    (ctx as { subject: unknown }).subject = { startedAt: Date.now() - 5000 };
    await describe(ctx, "lamp", {});
    expect(ctx.time.now()).toBe(2000);
    expect(sent.map((o) => o.op)).toEqual(["describe"]);
  });

  it("does not take an empty transports list, or a graceful last status, as up", async () => {
    const seen = [status("offline", ["up"])];
    const { ctx, sent } = fake(seen, (now) => {
      if (now === 1000) seen.push(status("online", []));
      if (now === 2000) seen.push(status("online", ["up"]));
    });
    await describe(ctx, "lamp", {});
    expect(ctx.time.now()).toBe(2000);
    expect(sent.map((o) => o.op)).toEqual(["describe"]);
  });
});

suite("passUntil", () => {
  it("passes the subject's time, a second at a time, until what it waits for comes", async () => {
    const seen: Seen[] = [];
    const { ctx } = fake(seen, (now) => { if (now === 4000) seen.push(status("online", ["up"])); });
    await passUntil(ctx, (s) => s.topic === `${BASE}/status`, 10_000, 0);
    expect(ctx.time.now()).toBe(4000);
  });

  it("with realMs, takes what comes in real time before it passes any of the subject's time", async () => {
    const seen: Seen[] = [];
    const { ctx } = fake(seen);
    setTimeout(() => seen.push(status("online", ["up"])), 300);
    await passUntil(ctx, (s) => s.topic === `${BASE}/status`, 10_000, 0, { realMs: 1000 });
    expect(ctx.time.now()).toBe(0);
  });

  it("with realMs, still passes the subject's time for what the subject times", async () => {
    const seen: Seen[] = [];
    const { ctx } = fake(seen, (now) => { if (now === 2000) seen.push(status("online", ["up"])); });
    await passUntil(ctx, (s) => s.topic === `${BASE}/status`, 10_000, 0, { realMs: 100 });
    expect(ctx.time.now()).toBe(2000);
  });
});

suite("settled", () => {
  it("grades the first live status after the clock has passed, not one from before it delivered late", async () => {
    const seen: Seen[] = [devices("lamp")];
    let late = true;
    const { ctx } = fake(seen, () => {
      if (!late) return;
      late = false;
      // A status from before the ops, delivered while the clock passes; the next heartbeat comes after.
      seen.push({ ...status("online", ["up"]), payload: { ...status("online", ["up"]).payload, which: "stale" } });
      setTimeout(() => seen.push({ ...status("online", ["up"]), payload: { ...status("online", ["up"]).payload, which: "fresh" } }), 50);
    });
    const { status: got } = await settled(ctx);
    expect(got.payload.which).toBe("fresh");
  });
});
