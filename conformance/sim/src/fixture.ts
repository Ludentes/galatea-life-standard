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
  args: { mode: ["switch", "click"] }, confirmedBy: { key: `${PUSH}.mode`, value: { arg: "mode" } } };
const pushActions = (idempotent: boolean): FixtureAction[] => [...declare(["onoff"], "closed", { idempotent }), setMode];
FIXTURE.pusher = device({ id: "pusher", capabilities: ["onoff"], feedback: "closed", proposedClass: "socket",
  initial: { on: false, [`${PUSH}.mode`]: "switch" }, actions: pushActions(true),
  extensions: [{ capability: PUSH, description: "The pusher's own settings.",
    actions: [{ action: `${PUSH}.set_mode`, description: "Sets whether it holds a position or presses once.",
      schema: { type: "object", properties: { mode: { enum: ["switch", "click"] } }, required: ["mode"] } }],
    // Its mode's schema an enum without a type, as the Zigbee bridge gives an enum expose (the Fingerbot's mode).
    keys: [{ key: `${PUSH}.mode`, kind: "state", description: "switch or click.", schema: { enum: ["switch", "click"] } }] }],
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
 * Devices a test gets only by naming them, never in the default fixture. A climate sensor in the shape
 * of the Zigbee bridge's (bridge 0.6): its humidity awaited, never reported yet (GA-BRIDGE-80), and its
 * reporting interval a setting (GA-BRIDGE-79). What it sends that no key describes it lists as
 * undescribed and announces (GA-BRIDGE-76), as every simulated device does.
 */
const R = "org.galatea.test.climate";
/**
 * A button pusher in the Zigbee bridge's shape (bridge 0.6): in click mode its onoff actions vanish
 * and a stateless press, a toggle, appears; in switch mode the press vanishes and onoff returns. Its
 * `onoff` capability stays either way. Its bridge describes only the extension actions it offers.
 */
const PRESS = "org.galatea.test.presser";
const pressMode: FixtureAction = { action: `${PRESS}.set_mode`, idempotent: false, stateless: false, confirms: true,
  args: { mode: ["switch", "click"] }, confirmedBy: { key: `${PRESS}.mode`, value: { arg: "mode" } } };
const pressActions: Record<string, FixtureAction[]> = {
  switch: [...declare(["onoff"], "closed"), pressMode],
  click: [pressMode, { action: `${PRESS}.press`, idempotent: false, stateless: true, toggles: true, confirms: true }],
};
const NAMED: Record<string, FixtureDevice> = {
  climate: device({ id: "climate", capabilities: ["sensor"], sensorKeys: ["temperature"], feedback: "closed", proposedClass: "sensor",
    initial: { temperature: 21, [`${R}.interval`]: 60 }, actions: [], awaitedKeys: ["humidity"], settings: [`${R}.interval`],
    extensions: [{ capability: R, description: "The sensor's own settings.", actions: [],
      keys: [{ key: `${R}.interval`, kind: "state", description: "Seconds between its reports.", schema: { type: "integer" } }] }] }),
  presser: device({ id: "presser", capabilities: ["onoff"], feedback: "closed", proposedClass: "socket",
    initial: { on: false, [`${PRESS}.mode`]: "switch" }, actions: pressActions.switch, settings: [`${PRESS}.mode`],
    extensions: [{ capability: PRESS, description: "The pusher's own press and mode.",
      actions: [{ action: `${PRESS}.set_mode`, description: "Sets whether it holds a position or presses once.",
        schema: { type: "object", properties: { mode: { enum: ["switch", "click"] } }, required: ["mode"] } },
      { action: `${PRESS}.press`, description: "Presses the button: the arm goes down, then up.", schema: { type: "object", properties: {} } }],
      keys: [{ key: `${PRESS}.mode`, kind: "state", description: "switch or click.", schema: { enum: ["switch", "click"] } }] }],
    modes: { key: `${PRESS}.mode`, actions: pressActions } }),
};

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
  // A wall scene switch: each press an occurrence (bridge, *Occurrences*), never state (HS35).
  button: device({ id: "button", capabilities: ["sensor"], sensorKeys: ["battery"], feedback: "closed", proposedClass: "sensor",
    initial: { battery: 90 }, actions: [], extensions: [{ capability: "org.galatea.test.button", description: "The switch's presses.", actions: [],
      keys: [{ key: "org.galatea.test.button.action", kind: "event", description: "1_single, 1_double, 1_hold.", schema: { type: "string" } }] }] }),
  // A door lock (HS18) and a valve its protocol shows as a switch (GA-LEASE-11).
  doorlock: device({ id: "doorlock", capabilities: ["lock"], feedback: "closed", proposedClass: "door_lock", initial: { locked: true } }),
  watervalve: device({ id: "watervalve", capabilities: ["onoff"], feedback: "closed", proposedClass: "water_valve", initial: { on: true } }),
  // A metering plug: a socket that reports its power, which the heater does not.
  meteringplug: device({ id: "meteringplug", capabilities: ["onoff"], sensorKeys: ["power"], feedback: "closed", proposedClass: "socket",
    initial: { on: false, power: 0 } }),
  // A radio lamp that reports nothing, its codes discrete: an open-loop lamp, whose hold's floor ends at `sent` (GA-LEASE-7).
  rflamp: device({ id: "rflamp", capabilities: ["onoff"], feedback: "open", proposedClass: "light", initial: {} }),
  // A multisensor: presence and light readings, neither set by any action (GA-LEASE-2).
  multisensor: device({ id: "multisensor", capabilities: ["sensor"], sensorKeys: ["occupancy", "illuminance"], feedback: "closed",
    proposedClass: "sensor", initial: { occupancy: false, illuminance: 0 } }),
  // A thermostat: a closed climate device, two keys set by two actions (`climate.set_mode` sets `mode`,
  // `climate.set_setpoint` sets `setpoint`), what `owner-passes-safety` latches one of (GA-LEASE-12).
  thermostat: device({ id: "thermostat", capabilities: ["climate"], feedback: "closed", proposedClass: "boiler",
    initial: { mode: "heat", setpoint: 21 } }),
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
    // An extension action is described only where it is offered, as the Zigbee bridge describes one.
    ...(spec.extensions ? { extensions: spec.extensions.map((x) => (!x.actions ? x
      : { ...x, actions: (x.actions as { action: string }[]).filter((a) => spec.actions.some((d) => d.action === a.action)) })) } : {}),
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
    const d = FIXTURE[id] ?? NAMED[id] ?? SCRIPTED[id];
    if (!d) throw new Error(`no fixture device ${id}`);
    return structuredClone(d);
  });
}
