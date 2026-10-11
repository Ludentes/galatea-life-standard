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
    expect(toWire({ action: "onoff.turn_on" }, {})).toBeUndefined();
    expect(toWire({ action: "level.set_level" }, { level: 40 })).toBe(40);
    expect(fromWire({ action: "level.set_level" }, 40)).toEqual({ level: 40 });
    expect(fromWire({ action: "onoff.turn_on" }, undefined)).toEqual({});
  });

  it("puts notify's arguments on the wire as one object, and knows it stateless and never idempotent", () => {
    expect(actionsOf(["notify"])).toEqual(["notify.notify"]);
    expect(toWire({ action: "notify.notify" }, { text: "dinner", urgency: "info" })).toEqual({ text: "dinner", urgency: "info" });
    expect(fromWire({ action: "notify.notify" }, { text: "dinner", urgency: "info" })).toEqual({ text: "dinner", urgency: "info" });
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
  it("sends an extension action's one argument bare, by its declaration's args (bridge, *Commands*)", () => {
    const decl = { ...set, args: { mode: ["click", "switch"] } };
    expect(toWire(decl, { mode: "click" })).toBe("click");
    expect(fromWire(decl, "click")).toEqual({ mode: "click" });
    expect(toWire(decl, {})).toBeUndefined();
    const two = { action: "org.galatea.test.brew.make", args: { cups: { min: 1, max: 4 }, strength: ["mild", "strong"] } };
    expect(toWire(two, { cups: 2, strength: "mild" })).toEqual({ cups: 2, strength: "mild" });
    expect(fromWire(two, { cups: 2, strength: "mild" })).toEqual({ cups: 2, strength: "mild" });
  });
  it("refuses a value that does not fit, as a real bridge does: a one-argument value wrapped, a value for none, an unknown name", () => {
    const decl = { ...set, args: { mode: ["click", "switch"] } };
    expect(fromWire(decl, { mode: "click" })).toMatch(/goes bare/);
    expect(fromWire({ action: "level.set_level" }, { level: 40 })).toMatch(/goes bare/);
    expect(fromWire({ action: set.action }, "click")).toMatch(/takes no argument/);
    expect(fromWire({ action: "onoff.turn_on" }, true)).toMatch(/takes no argument/);
    expect(fromWire({ action: "org.galatea.test.brew.make", args: { cups: "any", strength: "any" } }, { cups: 1, size: 2 })).toMatch(/size/);
    // A one-argument action whose argument is itself an object takes that object bare.
    const search = { action: "org.galatea.test.tv.find", args: { search: { series: "any", season: { min: 1 } } } };
    expect(fromWire(search, { series: "x" })).toEqual({ search: { series: "x" } });
  });
});
