import { describe, expect, it } from "vitest";
import { actionSpec, actionsOf, fromWire, setsOf, stateAfter, toWire } from "../src/vocabulary.js";

describe("vocabulary", () => {
  it("lists a capability's actions", () => {
    expect(actionsOf(["onoff"])).toEqual(["onoff.turn_on", "onoff.turn_off"]);
    expect(actionsOf(["cover"])).toContain("cover.stop");
    expect(actionsOf(["sensor"])).toEqual([]);
  });

  it("knows the state an action sets", () => {
    expect(stateAfter("onoff.turn_on")).toEqual({ on: true });
    expect(stateAfter("level.set_level", { level: 40 })).toEqual({ level: 40 });
    expect(stateAfter("cover.stop")).toBeUndefined();
    expect(actionSpec("cover.stop")?.stateless).toBe(true);
  });

  it("puts a single argument on the wire bare, and takes it back", () => {
    expect(toWire("onoff.turn_on", {})).toBeUndefined();
    expect(toWire("level.set_level", { level: 40 })).toBe(40);
    expect(fromWire("level.set_level", 40)).toEqual({ level: 40 });
    expect(fromWire("onoff.turn_on", undefined)).toEqual({});
  });

  it("puts notify's arguments on the wire as one object, and knows it stateless and never idempotent", () => {
    expect(actionsOf(["notify"])).toEqual(["notify.notify"]);
    expect(toWire("notify.notify", { text: "dinner", urgency: "info" })).toEqual({ text: "dinner", urgency: "info" });
    expect(fromWire("notify.notify", { text: "dinner", urgency: "info" })).toEqual({ text: "dinner", urgency: "info" });
    expect(actionSpec("notify.notify")).toMatchObject({ stateless: true, idempotent: false });
    expect(stateAfter("notify.notify", { text: "x" })).toBeUndefined();
  });
});

describe("extension actions (bridge 0.5)", () => {
  const set = { action: "org.galatea.test.pusher.set_mode", confirmedBy: { key: "org.galatea.test.pusher.mode", value: { arg: "mode" } } };
  it("sets the key a confirmedBy names, at the argument it names or its value; a standard action as the vocabulary says", () => {
    expect(setsOf(set, { mode: "click" })).toEqual({ "org.galatea.test.pusher.mode": "click" });
    expect(setsOf({ ...set, confirmedBy: { key: "org.galatea.test.pusher.armed", value: true } })).toEqual({ "org.galatea.test.pusher.armed": true });
    expect(setsOf({ action: "onoff.turn_on" })).toEqual({ on: true });
  });
  it("sends an extension action's arguments as one object, even one", () => {
    expect(toWire(set.action, { mode: "click" })).toEqual({ mode: "click" });
    expect(fromWire(set.action, { mode: "click" })).toEqual({ mode: "click" });
    expect(toWire(set.action, {})).toBeUndefined();
  });
});
