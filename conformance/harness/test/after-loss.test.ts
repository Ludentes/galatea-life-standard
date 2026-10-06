// GA-EVT-4's verdict across a loss (the 7a preflight's I2): a subject that commits each event before
// serving it serves nothing while its store is stalled, and owes nothing after the crash.
import { describe, expect, it } from "vitest";
import { afterLoss } from "../src/tests/util.js";

const on = { type: "state", target: "sim-bridge:lamp", key: "on", value: true, seq: 7 };
const off = { type: "state", target: "sim-bridge:lamp", key: "on", value: false, seq: 8 };
const read = (events: unknown[]) => ({ ok: true, body: { events } });

describe("GA-EVT-4 after a crash that lost events", () => {
  it("passes a subject that served nothing in the stall, whatever its old cursor reads", () => {
    expect(afterLoss([], read([]))).toBeUndefined();
    expect(afterLoss([], { ok: false, error: "cursor_expired" })).toBeUndefined();
  });

  it("passes every served event read again, or cursor_expired", () => {
    expect(afterLoss([on, off], read([{ ...on, seq: 70 }, { ...off, seq: 71 }]))).toBeUndefined();
    expect(afterLoss([on, off], { ok: false, error: "cursor_expired" })).toBeUndefined();
  });

  it("fails a served event missing with no cursor_expired, and any other error", () => {
    expect(afterLoss([on, off], read([on]))).toMatch(/missing from it after/);
    expect(afterLoss([on], { ok: false, error: "internal_error" })).toMatch(/internal_error, not cursor_expired/);
  });
});
