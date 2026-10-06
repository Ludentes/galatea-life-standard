import { describe, expect, it } from "vitest";
import { ackWithinS, canonical, planStep, type HeldDevice } from "../src/applier/model.js";

function lamp(over: Partial<HeldDevice> = {}): HeldDevice {
  return {
    id: "sim-bridge:lamp", bridge: "sim-bridge", adopted: true, class: "light", lastCheckIn: null, assumed: {},
    values: { on: { value: false, basis_time: "2030-01-01T08:00:00.000Z" } },
    doc: { id: "lamp", stableIdentifier: "test:lamp", transport: "test", model: { vendor: "demo", model: "lamp" },
      capabilities: ["onoff"], feedback: "closed", reachMs: 1000, proposedClass: "light",
      actions: [{ action: "onoff.turn_on", idempotent: true, stateless: false, confirms: true },
        { action: "onoff.turn_off", idempotent: true, stateless: false, confirms: true }] },
    ...over,
  };
}
const on = { target: "sim-bridge:lamp", action: "onoff.turn_on", args: {} };

describe("planning", () => {
  it("gives reasons in the standard's order", () => {
    expect(planStep(0, { ...on, target: "nope" }, undefined, true)).toMatchObject({ verdict: "skip", reason: "unknown_target" });
    expect(planStep(0, { ...on, action: "level.set_level" }, lamp({ adopted: false }), false))
      .toMatchObject({ verdict: "skip", reason: "unsupported_action" });
    expect(planStep(0, on, lamp({ adopted: false }), false)).toMatchObject({ verdict: "refuse", reason: "not_adopted" });
    expect(planStep(0, on, lamp(), false)).toMatchObject({ verdict: "skip", reason: "dead" });
    expect(planStep(0, { ...on, action: "onoff.turn_off" }, lamp(), true)).toMatchObject({ verdict: "skip", reason: "already" });
    expect(planStep(1, on, lamp(), true)).toEqual({ step_id: "s2", target: "sim-bridge:lamp", action: "onoff.turn_on",
      args: {}, verdict: "op", tier: "reversible", stale: false, basis: "real" });
  });

  it("never finds an open device already there", () => {
    const tv = lamp({ doc: { ...lamp().doc, feedback: "open" }, values: {}, assumed: { on: false } });
    expect(planStep(0, { ...on, action: "onoff.turn_off" }, tv, true).verdict).toBe("op");
  });

  it("bounds acks by class and reach", () => {
    expect(ackWithinS("light", 1000)).toBe(12);
    expect(ackWithinS("gate", 1000)).toBe(90);
    expect(ackWithinS(null)).toBe(10);
  });

  it("serialises with sorted keys", () => {
    expect(canonical({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}');
  });
});
