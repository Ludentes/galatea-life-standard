import { describe, expect, it } from "vitest";
import { matcher, sets, type Match } from "../src/index.js";

describe("what an action sets (applier, *Action declarations*, GA-EVT-3)", () => {
  it("matches a numeric key within its default tolerance, and no further", () => {
    const level = sets("level.set_level", { level: 40 })!;
    expect([level.key, level.want, level.value]).toEqual(["level", 40, 40]);
    expect([39, 41, 40.5].map(level.matches)).toEqual([true, true, true]);
    expect([38.9, 42, "40"].map(level.matches)).toEqual([false, false, false]);
    expect(sets("climate.set_setpoint", { celsius: 21 })!.matches(21.5)).toBe(true);
    expect(sets("climate.set_setpoint", { celsius: 21 })!.matches(21.6)).toBe(false);
    expect(sets("cover.close", {})!.matches(2)).toBe(true);
    expect(sets("media.set_volume", { volume: 5 })!.matches(6)).toBe(true);
  });

  it("names the colour's argument rgb, and matches it whatever its case", () => {
    const c = sets("color.set_color", { rgb: "#FFaa00" })!;
    expect([c.key, c.value]).toEqual(["color", "#FFaa00"]);
    expect(c.matches("#ffaa00")).toBe(true);
    expect(c.matches("#ffaa01")).toBe(false);
  });

  it("sets an extension action's confirmed_by, near for a number, exactly otherwise", () => {
    expect(sets("x.set_mode", { mode: "click" }, { key: "x.mode", value: { arg: "mode" } })!.matches("click")).toBe(true);
    const n = sets("x.set", { v: 3 }, { key: "x.v", value: { arg: "v" } })!;
    expect([n.matches(3), n.matches(3.1)]).toEqual([true, false]);
  });

  it("matches session.lock's key by locked, disconnected or none, with no value", () => {
    const s = sets("session.lock", { account: "liza" })!;
    expect(s.key).toBe("session.liza");
    expect("value" in s).toBe(false);
    expect(["locked", "disconnected", "none", "active"].map(s.matches)).toEqual([true, true, true, false]);
  });

  it("sets nothing for a stateless action, media.launch or an unknown one", () => {
    expect(sets("notify.notify", { text: "x", urgency: "info" })).toBeUndefined();
    expect(sets("media.launch", { search: {} })).toBeUndefined();
    expect(sets("x.press", {})).toBeUndefined();
  });

  it("keeps how it matches as plain data, which rebuilds the same test after a JSON round trip", () => {
    for (const s of [sets("level.set_level", { level: 40 })!, sets("color.set_color", { rgb: "#ABCDEF" })!, sets("onoff.turn_on", {})!,
      sets("session.lock", { account: "liza" })!]) {
      const kept = JSON.parse(JSON.stringify(s.match)) as Match;
      for (const v of [40, 41, 42, "#abcdef", true, false, "locked", "active"]) expect(matcher(kept)(v)).toBe(s.matches(v));
    }
  });
});
