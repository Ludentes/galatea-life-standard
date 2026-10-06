import type { BridgeDevices } from "@ludentes/galatea-life-schemas";
import { actionSpec, actionsOf } from "./vocabulary.js";

/** An item of `bridge/devices.json`'s `devices` array (generated; never hand-written, per I1). */
export type BridgeDeviceDoc = BridgeDevices["devices"][number];

/** An item of a device's `actions`, the shape `bridge/devices.json` describes. */
export type FixtureAction = BridgeDeviceDoc["actions"][number];

export interface FixtureDevice {
  id: string;
  model: { vendor: string; model: string };
  capabilities: string[];
  sensorKeys: string[];
  feedback: "closed" | "open";
  proposedClass: string | null;
  actions: FixtureAction[];
  initial: Record<string, unknown>;
  ackMs: number;
  reachMs: number;
  basisMaxAgeMs: number | null;
  checkInMs: number;
  /** Its bridge's own capabilities (bridge, *Extension names*): each key a `state` or an `event`. */
  extensions?: BridgeDeviceDoc["extensions"];
  personal?: string[];
  selfChanging?: string[];
  /** A computer's interactive accounts, token to the OS's name (applier, *Computers and players*). */
  accounts?: Record<string, string>;
  /**
   * A setting that changes its declarations (bridge, *Declarations and settings*): while the state key
   * `key` holds a value `actions` names, the device declares those actions. Data, so a fixture clones.
   */
  modes?: { key: string; actions: Record<string, FixtureAction[]> };
  /** The state keys that are its settings (bridge, *Declarations and settings*, GA-BRIDGE-79). */
  settings?: string[];
  /** Numeric keys its model promises and it has not yet reported, held back until it does (GA-BRIDGE-80). */
  awaitedKeys?: string[];
  /** The identity keys by which the finder can hear it (bridge, *What a bridge adds*), in its `devices` entry; none by default. */
  connections?: string[];
}

function declare(capabilities: string[], feedback: "closed" | "open", extra: Partial<FixtureAction> = {}): FixtureAction[] {
  return actionsOf(capabilities).map((action) => {
    const spec = actionSpec(action)!;
    return { action, idempotent: spec.idempotent, stateless: spec.stateless, confirms: feedback === "closed", ...extra };
  });
}

/**
 * A device's defaults (model, sensorKeys, actions declared from its capabilities, ackMs 200,
 * reachMs 1000, basisMaxAgeMs 60 000 for a closed device, checkInMs 30 000), overridden by
 * whatever `d` gives explicitly. The one place these defaults live (ruling M10); `SimBridge`'s
 * `join` builds a joined device from this too, instead of restating them.
 */
export function device(d: Omit<FixtureDevice, "model" | "sensorKeys" | "actions" | "ackMs" | "reachMs" | "basisMaxAgeMs" | "checkInMs"> & Partial<FixtureDevice>): FixtureDevice {
  return {
    model: { vendor: "demo", model: d.id },
    sensorKeys: [],
    actions: declare(d.capabilities, d.feedback),
    ackMs: 200,
    reachMs: 1000,
    basisMaxAgeMs: d.feedback === "closed" ? 60_000 : null,
    checkInMs: 30_000,
    ...d,
  };
}

const FIXTURE: Record<string, FixtureDevice> = {
  lamp: device({ id: "lamp", capabilities: ["onoff"], feedback: "closed", proposedClass: "light", initial: { on: false } }),
  dimmer: device({ id: "dimmer", capabilities: ["onoff", "level"], feedback: "closed", proposedClass: "light",
    initial: { on: false, level: 0 } }),
  leak: device({ id: "leak", capabilities: ["sensor"], sensorKeys: ["leak"], feedback: "closed", proposedClass: "sensor",
    initial: { leak: false } }),
  // A momentary relay: each command is one pulse, so no action on it is idempotent; it acks in 3 s,
  // slower than any reissue window.
  gate: device({ id: "gate", capabilities: ["cover"], feedback: "closed", proposedClass: "gate", initial: { position: 0 },
    actions: declare(["cover"], "closed", { idempotent: false }), ackMs: 3000 }),
  // The harness configures `load: heating` on the applier when a test needs it.
  heater: device({ id: "heater", capabilities: ["onoff"], feedback: "closed", proposedClass: "socket", initial: { on: false } }),
  // The harness configures `infrastructure: true` on the applier when a test needs it.
  rack: device({ id: "rack", capabilities: ["onoff"], feedback: "closed", proposedClass: "socket", initial: { on: true } }),
  // A closed sensor whose bridge cannot know its rhythm: its bound is null (GA-STATE-5's "not known").
  unbound: device({ id: "unbound", capabilities: ["sensor"], sensorKeys: ["temperature"], feedback: "closed",
    proposedClass: "sensor", initial: { temperature: 21 }, basisMaxAgeMs: null }),
  // IR: nothing reports; the power code toggles.
  // A closed relay whose command flips it: a toggle planned from its observed state (GA-PLAN-8).
  relay: device({ id: "relay", capabilities: ["onoff"], feedback: "closed", proposedClass: "socket", initial: { on: false },
    actions: declare(["onoff"], "closed", { idempotent: false, toggles: true }) }),
  // A closed pulse relay: each command one pulse, so its onoff is never idempotent, yet no toggle, and
  // reversible: what GA-APPLY-6 counts, with no token in the way.
  pulse: device({ id: "pulse", capabilities: ["onoff"], feedback: "closed", proposedClass: "socket", initial: { on: false },
    actions: declare(["onoff"], "closed", { idempotent: false }) }),
  tv: device({ id: "tv", capabilities: ["onoff"], feedback: "open", proposedClass: "tv", initial: {},
    actions: declare(["onoff"], "open", { idempotent: false, toggles: true }) }),
  // A notification channel whose protocol confirms a message, and whose notify does not list `from`.
  channel: device({ id: "channel", capabilities: ["notify"], feedback: "closed", proposedClass: "channel", initial: {} }),
  // A pager that can only send a message, and lists `from` among its notify's args (GA-APPLY-14).
  pager: device({ id: "pager", capabilities: ["notify"], feedback: "closed", proposedClass: "channel", initial: {},
    actions: declare(["notify"], "closed", { confirms: false, args: { text: "any", urgency: ["info", "warning", "critical"], from: "any" } }) }),
  // IR: every code carries the whole state.
  ac: device({ id: "ac", capabilities: ["climate"], feedback: "open", proposedClass: "ac", initial: {},
    actions: declare(["climate"], "open", { wholeState: true }) }),
  // A water valve that reports its state: what a leak rule closes (HS4).
  valve: device({ id: "valve", capabilities: ["valve"], feedback: "closed", proposedClass: "water_valve", initial: { open: true } }),
  // A room thermometer with a bound: what a witness reads (GA-WIT-1).
  thermo: device({ id: "thermo", capabilities: ["sensor"], sensorKeys: ["temperature"], feedback: "closed", proposedClass: "sensor",
    initial: { temperature: 20 } }),
  // A radio plug that reports nothing, its codes discrete: a heater on it is capped from what the applier sent (GA-LOAD-2).
  rfplug: device({ id: "rfplug", capabilities: ["onoff"], feedback: "open", proposedClass: "socket", initial: {} }),
};

// A button pusher (bridge, *Declarations and settings*): in `switch` mode it holds a position, so its
// onoff is idempotent; in `click` mode each command is a press, never idempotent. Its mode is an extension
// state key, set by its own extension action and confirmed by it.
const PUSH = "org.galatea.test.pusher";
const setMode: FixtureAction = { action: `${PUSH}.set_mode`, idempotent: false, stateless: false, confirms: true,
  confirmedBy: { key: `${PUSH}.mode`, value: { arg: "mode" } } };
const pushActions = (idempotent: boolean): FixtureAction[] => [...declare(["onoff"], "closed", { idempotent }), setMode];
FIXTURE.pusher = device({ id: "pusher", capabilities: ["onoff"], feedback: "closed", proposedClass: "socket",
  initial: { on: false, [`${PUSH}.mode`]: "switch" }, actions: pushActions(true),
  extensions: [{ capability: PUSH, description: "The pusher's own settings.",
    actions: [{ action: `${PUSH}.set_mode`, description: "Sets whether it holds a position or presses once.",
      schema: { type: "object", properties: { mode: { enum: ["switch", "click"] } }, required: ["mode"] } }],
    keys: [{ key: `${PUSH}.mode`, kind: "state", description: "switch or click.", schema: { type: "string" } }] }],
  modes: { key: `${PUSH}.mode`, actions: { switch: pushActions(true), click: pushActions(false) } } });
// A vibration sensor whose alarms are events, never state (bridge, *Occurrences*); its presence is personal,
// and its sensitivity, a state key no confirmedBy names, selfChanging.
const V = "org.galatea.test.vibration";
FIXTURE.shaker = device({ id: "shaker", capabilities: ["sensor"], sensorKeys: ["battery"], feedback: "closed", proposedClass: "sensor",
  initial: { battery: 90, [`${V}.sensitivity`]: "medium" }, actions: [], personal: [`${V}.presence`], selfChanging: [`${V}.sensitivity`],
  extensions: [{ capability: V, description: "The sensor's own alarms.", actions: [],
    keys: [{ key: `${V}.alarm`, kind: "event", description: "A vibration felt.", schema: { type: "boolean" } },
      { key: `${V}.presence`, kind: "event", description: "Someone moved near it.", schema: { type: "boolean" } },
      { key: `${V}.sensitivity`, kind: "state", description: "low, medium or high.", schema: { type: "string" } }] }] });
// A speaker, which reports speech where its protocol gives it (GA-EVT-5).
FIXTURE.speaker = device({ id: "speaker", capabilities: ["media"], feedback: "closed", proposedClass: "speaker",
  initial: { playing: false, volume: 20 } });

export const FIXTURE_IDS = Object.keys(FIXTURE);

/**
 * Devices only the scripted stand-in scripts, never a simulated bridge's defaults: a room's motion
 * sensor and its presence sensor (steward, *Occupancy*), each closed, so each declares a bound.
 */
const SCRIPTED: Record<string, FixtureDevice> = {
  motion: device({ id: "motion", capabilities: ["sensor"], sensorKeys: ["motion"], feedback: "closed", proposedClass: "sensor",
    initial: { motion: false } }),
  presence: device({ id: "presence", capabilities: ["sensor"], sensorKeys: ["occupancy"], feedback: "closed", proposedClass: "sensor",
    initial: { occupancy: false } }),
  // A laptop with two accounts, one key each of the session family; every key of a computer is self_changing.
  laptop: device({ id: "laptop", capabilities: ["session"], feedback: "closed", proposedClass: "computer",
    initial: { "session.liza": "active", "session.dmitry": "locked" }, accounts: { liza: "Лиза", dmitry: "Дмитрий" },
    actions: declare(["session"], "closed", { args: { account: ["liza", "dmitry"] } }), selfChanging: ["session.liza", "session.dmitry"] }),
};

/** A device's entry in its bridge's `devices` document (`bridge/devices.json`), as the simulated bridge publishes it. */
export function bridgeDoc(spec: FixtureDevice, undescribed: { name: string; firstSeen: string }[] = []): BridgeDeviceDoc {
  return {
    id: spec.id,
    stableIdentifier: `test:${spec.id}`,
    transport: "test",
    model: spec.model,
    capabilities: spec.capabilities,
    sensorKeys: spec.sensorKeys,
    actions: spec.actions,
    feedback: spec.feedback,
    reachMs: spec.reachMs,
    proposedClass: spec.proposedClass,
    classEvidence: spec.proposedClass ? "protocol" : "none",
    otherAdmins: [],
    connections: spec.connections ?? [],
    ...(spec.extensions ? { extensions: spec.extensions } : {}),
    ...(spec.personal ? { personal: spec.personal } : {}),
    ...(spec.selfChanging ? { selfChanging: spec.selfChanging } : {}),
    ...(spec.accounts ? { accounts: spec.accounts } : {}),
    ...(spec.settings?.length ? { settings: spec.settings } : {}),
    ...(spec.awaitedKeys?.length ? { awaitedKeys: spec.awaitedKeys } : {}),
    ...(undescribed.length ? { undescribed } : {}),
  } as BridgeDeviceDoc;
}

export function fixtureDevices(ids: string[] = FIXTURE_IDS): FixtureDevice[] {
  return ids.map((id) => {
    const d = FIXTURE[id] ?? SCRIPTED[id];
    if (!d) throw new Error(`no fixture device ${id}`);
    return structuredClone(d);
  });
}
