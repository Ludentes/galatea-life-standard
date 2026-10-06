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
 * A command's `value.value`: absent, the single argument bare, or the object of several; an action
 * the vocabulary does not know (an extension action) takes its arguments as one object.
 */
export function toWire(action: string, args: Record<string, unknown> = {}): unknown {
  if (!VOCABULARY[action]) return Object.keys(args).length ? args : undefined;
  const params = VOCABULARY[action]!.params;
  if (params.length === 0) return undefined;
  if (params.length === 1) return args[params[0]!];
  return args;
}

export function fromWire(action: string, value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  const params = VOCABULARY[action]?.params ?? [];
  if (params.length === 1) return { [params[0]!]: value };
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
