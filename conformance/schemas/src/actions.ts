/**
 * What a standard action sets, and what report matches it (`standard/applier.md`, *Capabilities and
 * actions*, *Action declarations*, GA-EVT-3): the one table an applier's `already` and `acked` and a
 * steward's hold floor read, so the two never judge one report differently.
 */

/** An extension action's `confirmed_by` (applier, *Action declarations*): its value a literal, or `{ arg }`, that argument of the step. */
export type ConfirmedBy = { key: string; value: string | number | boolean | { arg: string } };

/** The default `tolerance` of a numeric key (applier, *Action declarations*). */
export const TOLERANCE: Readonly<Record<string, number>> = { level: 1, volume: 1, setpoint: 0.5, position: 2 };

/**
 * How a report matches what an action sets, as plain data, so a reader can keep it (a steward persists
 * it with a hold) and rebuild the test with `matcher`: `near`, a number within `tolerance` of `want`;
 * `exactly`, the same scalar; `caseless`, the same string whatever its case (a colour); `one_of`, any
 * of `values` (`session.lock`).
 */
export type Match =
  | { kind: "near"; want: unknown; tolerance: number }
  | { kind: "exactly"; value: unknown }
  | { kind: "caseless"; value: unknown }
  | { kind: "one_of"; values: unknown[] };

/**
 * The key an action sets, how a report matches it (`match`, and `matches` built from it), and for a
 * numeric key the value it wants, so a report can move towards it; `value`, the value it asks for,
 * which an open device's state assumes once it is sent (applier GA-STATE-4), absent where an argument
 * chooses among several (`session.lock`).
 */
export type Sets = { key: string; match: Match; matches: (value: unknown) => boolean; want?: number; value?: unknown };

/** The test `m` describes. */
export function matcher(m: Match): (v: unknown) => boolean {
  switch (m.kind) {
    case "near": return (v) => typeof v === "number" && typeof m.want === "number" && Math.abs(v - m.want) <= m.tolerance;
    case "exactly": return (v) => v === m.value;
    case "caseless": return (v) => typeof v === "string" && typeof m.value === "string" && v.toLowerCase() === m.value.toLowerCase();
    case "one_of": return (v) => m.values.includes(v);
  }
}

const of = (key: string, match: Match, value?: unknown): Sets =>
  ({ key, match, matches: matcher(match), ...(match.kind === "near" && typeof match.want === "number" ? { want: match.want } : {}),
    ...(match.kind !== "one_of" ? { value } : {}) });
const near = (key: string, want: unknown): Sets => of(key, { kind: "near", want, tolerance: TOLERANCE[key] ?? 0 }, want);
const exactly = (key: string, want: unknown): Sets => of(key, { kind: "exactly", value: want }, want);

/**
 * The key a stateful action sets and what matches it (the key an argument chooses included, *Key
 * families*), or undefined for a stateless action and for one never `already` (`media.launch`). An
 * extension action sets what its `confirmed_by` names: its key, at its value or the value of the
 * argument it names (applier, *Action declarations*, GA-EVT-3).
 */
export function sets(action: string, args: Record<string, unknown>, confirmedBy?: ConfirmedBy): Sets | undefined {
  if (confirmedBy) {
    const want = typeof confirmedBy.value === "object" ? args[confirmedBy.value.arg] : confirmedBy.value;
    return typeof want === "number" ? near(confirmedBy.key, want) : exactly(confirmedBy.key, want);
  }
  switch (action) {
    case "onoff.turn_on": return exactly("on", true);
    case "onoff.turn_off": return exactly("on", false);
    case "level.set_level": return near("level", args.level);
    case "color.set_color": return of("color", { kind: "caseless", value: args.rgb }, args.rgb);
    case "climate.set_mode": return exactly("mode", args.mode);
    case "climate.set_setpoint": return near("setpoint", args.celsius);
    case "cover.open": return near("position", 100);
    case "cover.close": return near("position", 0);
    case "cover.set_position": return near("position", args.position);
    case "media.pause": return exactly("playing", false);
    case "media.resume": return exactly("playing", true);
    case "media.set_volume": return near("volume", args.volume);
    case "valve.open": return exactly("open", true);
    case "valve.close": return exactly("open", false);
    case "lock.lock": return exactly("locked", true);
    case "lock.unlock": return exactly("locked", false);
    case "session.lock": return of(`session.${String(args.account)}`, { kind: "one_of", values: ["locked", "disconnected", "none"] });
    default: return undefined;
  }
}
