export interface ActionSpec {
  params: string[];
  idempotent: boolean;
  stateless: boolean;
}

type Entry = ActionSpec & { sets?: (args: Record<string, unknown>) => Record<string, unknown> };

const stateful = (params: string[], sets: Entry["sets"]): Entry => ({ params, idempotent: true, stateless: false, sets });

const VOCABULARY: Record<string, Entry> = {
  "onoff.turn_on": stateful([], () => ({ on: true })),
  "onoff.turn_off": stateful([], () => ({ on: false })),
  "level.set_level": stateful(["level"], (a) => ({ level: a.level })),
  "color.set_color": stateful(["rgb"], (a) => ({ color: a.rgb })),
  "climate.set_mode": stateful(["mode"], (a) => ({ mode: a.mode })),
  "climate.set_setpoint": stateful(["celsius"], (a) => ({ setpoint: a.celsius })),
  "cover.open": stateful([], () => ({ position: 100 })),
  "cover.close": stateful([], () => ({ position: 0 })),
  "cover.set_position": stateful(["position"], (a) => ({ position: a.position })),
  "cover.stop": { params: [], idempotent: true, stateless: true },
  "media.pause": stateful([], () => ({ playing: false })),
  "media.resume": stateful([], () => ({ playing: true })),
  "media.set_volume": stateful(["volume"], (a) => ({ volume: a.volume })),
  "valve.open": stateful([], () => ({ open: true })),
  "valve.close": stateful([], () => ({ open: false })),
  "lock.lock": stateful([], () => ({ locked: true })),
  "lock.unlock": stateful([], () => ({ locked: false })),
  // Locks every session of one account: it sets that account's key of the `session.<account>` family.
  "session.lock": stateful(["account"], (a) => ({ [`session.${String(a.account)}`]: "locked" })),
  // Its arguments travel as one object; `from` only where the device lists it (GA-APPLY-14).
  "notify.notify": { params: ["text", "urgency", "from"], idempotent: false, stateless: true },
};

/**
 * The state keys each standard capability declares, as the applier's capability table names them; a
 * device with `media` reports `speech` where its protocol gives it. A sensor's keys are its `sensorKeys`.
 */
const CAPABILITY_KEYS: Record<string, string[]> = {
  onoff: ["on"], level: ["level"], color: ["color"], climate: ["mode", "setpoint", "current"], cover: ["position"],
  media: ["playing", "volume", "title", "started_at", "speech"], valve: ["open"], lock: ["locked"],
};

/** The standard keys a device with these capabilities declares (bridge, *Device status*). */
export function capabilityKeys(capabilities: string[]): string[] {
  return capabilities.flatMap((c) => CAPABILITY_KEYS[c] ?? []);
}

export function actionSpec(action: string): ActionSpec | undefined {
  const e = VOCABULARY[action];
  return e && { params: e.params, idempotent: e.idempotent, stateless: e.stateless };
}

/** The standard actions of these capabilities; a standard action's capability is its first segment. */
export function actionsOf(capabilities: string[]): string[] {
  return Object.keys(VOCABULARY).filter((a) => capabilities.includes(a.split(".")[0]!));
}

/** The state a device reports once the action took effect, or undefined for a stateless one. */
export function stateAfter(action: string, args: Record<string, unknown> = {}): Record<string, unknown> | undefined {
  return VOCABULARY[action]?.sets?.(args);
}

/**
 * The state a stateful action sets once it took effect: a standard action's, as the vocabulary says;
 * an extension action's, the key its `confirmedBy` names, at its value or the argument's it names.
 */
export function setsOf(decl: { action: string; confirmedBy?: unknown }, args: Record<string, unknown> = {}): Record<string, unknown> | undefined {
  const by = decl.confirmedBy as { key: string; value: unknown } | undefined;
  if (!by) return stateAfter(decl.action, args);
  const arg = typeof by.value === "object" && by.value !== null ? (by.value as { arg: string }).arg : undefined;
  return { [by.key]: arg !== undefined ? args[arg] : by.value };
}

/**
 * The names of an action's arguments, in the count a command carries them by (bridge, *Commands*): a
 * standard action's, the vocabulary's; an extension action's, the names its declaration's `args` give.
 */
function argNames(decl: { action: string; args?: Record<string, unknown> }): string[] {
  const known = VOCABULARY[decl.action];
  return known ? known.params : Object.keys(decl.args ?? {});
}

const RANGE = new Set(["min", "max", "step", "optional"]);
/** Whether an `args` constraint is an object argument's, an object of named fields (applier, *Arguments that are objects*). */
function objectArg(c: unknown): boolean {
  if (typeof c !== "object" || c === null || Array.isArray(c)) return false;
  const keys = Object.keys(c);
  return keys.length > 0 && !keys.every((k) => RANGE.has(k));
}

/**
 * A command's `value.value` (bridge, *Commands*): absent for an action of no argument, the argument
 * itself for one with one, and an object of them for one with several.
 */
export function toWire(decl: { action: string; args?: Record<string, unknown> }, args: Record<string, unknown> = {}): unknown {
  const names = argNames(decl);
  if (names.length === 0) return undefined;
  if (names.length === 1) return args[names[0]!];
  return Object.keys(args).length ? args : undefined;
}

/**
 * A command's arguments by name, read from its `value.value` as a bridge reads it (bridge,
 * *Commands*), or why it does not fit, for `failed(invalid_request)`: a value for an action of no
 * argument; an object for one of one whose argument is not itself an object; anything but an object of its own names for one of
 * several. Its arguments' values are the doer's; only the shape is checked.
 */
export function fromWire(decl: { action: string; args?: Record<string, unknown> }, value: unknown): Record<string, unknown> | string {
  const names = argNames(decl);
  if (names.length === 0) return value === undefined ? {} : `${decl.action} takes no argument`;
  if (names.length === 1) {
    if (value === undefined) return {};
    const wrapped = typeof value === "object" && value !== null && !objectArg(decl.args?.[names[0]!]);
    return wrapped ? `${decl.action}'s one argument ${names[0]} goes bare, not as an object` : { [names[0]!]: value };
  }
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) return `${decl.action} takes an object of ${names.join(", ")}`;
  const unknown = Object.keys(value).filter((k) => !names.includes(k));
  return unknown.length ? `${decl.action} takes no argument ${unknown.join(", ")}` : (value as Record<string, unknown>);
}
