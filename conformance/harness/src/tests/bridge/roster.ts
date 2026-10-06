import { validate } from "@ludentes/galatea-life-schemas";
import { must, mustEqual, RequirementFailure } from "../../assert.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import { describe, LAMP, passUntil, settled, topics } from "./doer.js";

/**
 * The roster's bound and the fields of `status` and `devices`. Each test scripts the network's facts
 * through a doer's ops (`describe`, `reporting`), so a subject with no doer refuses the first, and
 * the test is not_applicable.
 */

/** A model with no entry in any model database: a bound comes only from the reporting facts. */
const ACME = { vendor: "acme", model: "sensor-1" };
const SENSOR = { capabilities: [], sensorKeys: ["temperature"], model: ACME };

requirement("GA-BRIDGE-13", {
  seam: "bridge", covers: "a device that reports on its own declares twice its longest configured interval, its model's (undoubled or doubled) where none is configured, and null with neither, never a guess; a polled device, declared poll at its cadence, at most three times that cadence, and a poll the bridge makes: its lastCheckIn moving at that cadence with no message of the harness's while it answers, and observable false once three cadences passed after it fell silent; an open device null; a Matter subscription, the bridge's own host and a plugin device are not tested",
}, async (ctx) => {
  const transport = ctx.transport!;
  await describe(ctx, "configured", SENSOR);
  await transport.send({ op: "reporting", device: "configured", configuredMs: [300_000, 1_800_000], modelMs: 600_000 });
  await describe(ctx, "model", SENSOR);
  await transport.send({ op: "reporting", device: "model", configuredMs: [], modelMs: 900_000 });
  await describe(ctx, "unknown", SENSOR);
  await transport.send({ op: "reporting", device: "unknown", configuredMs: [], modelMs: null });
  await describe(ctx, "polled", { ...SENSOR, basis: "poll", cadenceMs: 20_000 });
  await describe(ctx, "plug", { capabilities: ["onoff"], feedback: "open", model: ACME });
  const { status } = await settled(ctx);
  const rosterEntry = (id: string): Record<string, any> => {
    const e = (status.payload.devices ?? []).find((d: { id: string }) => d.id === id);
    must(e !== undefined && "basisMaxAgeMs" in e, `the roster has no basisMaxAgeMs for ${id}`, status.payload.devices);
    return e;
  };
  const bound = (id: string): number | null => rosterEntry(id).basisMaxAgeMs;
  ctx.evidence(`bounds: ${["configured", "model", "unknown", "polled", "plug"].map((id) => `${id} ${bound(id)}`).join(", ")}`);
  mustEqual(bound("configured"), 3_600_000, "the bound of a device configured to report at 300 s and 1800 s (twice the longest)");
  // "Allowing at least one missed report" reads two ways for a model's figure: the figure itself, or
  // twice it, as for a configured interval. The standard settles neither, so both pass (Standards gaps).
  const model = bound("model");
  must(model === 900_000 || model === 1_800_000,
    `the bound of a device with no reporting configuration whose model reports every 900 s is ${model}, not 900000 (the model's figure) or 1800000 (twice it)`);
  mustEqual(bound("unknown"), null, "the bound of a device with no reporting configuration and no model entry");
  // The polled bound is the entry's own: at most three times the cadenceMs it declares, which must be
  // the poll the doer was scripted with.
  const polled = rosterEntry("polled");
  mustEqual([polled.basis, polled.cadenceMs], ["poll", 20_000], "the basis and cadence of a device polled every 20 s");
  must(polled.basisMaxAgeMs !== null && polled.basisMaxAgeMs <= 3 * polled.cadenceMs,
    `the bound of a device polled at a cadence of ${polled.cadenceMs} ms is ${polled.basisMaxAgeMs}, not at most three times it`);
  mustEqual(bound("plug"), null, "the bound of an open device");

  // A poll's bound is one the bridge knows only where it polls: each read the device answers is a
  // check-in (*The roster and freshness*), so the polled device's lastCheckIn moves with nothing sent
  // by the harness, and it stays observable; fallen silent, its reads go unanswered, and once three
  // cadences passed with no answer it is observable no longer, its lastCheckIn still the last answer's.
  const watch = ctx.watch!;
  const t = topics(ctx);
  const cadence = polled.cadenceMs as number;
  const polledIn = (p: Record<string, any>) => (p.devices ?? []).find((d: { id: string }) => d.id === "polled") as Record<string, any> | undefined;
  const firstAt = ctx.time.now();
  const answered = t.status((p) => {
    const e = polledIn(p);
    return e?.observable === true && typeof e.lastCheckIn === "string" && Date.parse(e.lastCheckIn) >= firstAt;
  });
  const shown = await passUntil(ctx, answered, 2 * cadence, watch.seen.length).catch((err) => {
    throw new RequirementFailure(`the device polled every ${cadence} ms checked in by no answer to a read in ${2 * cadence} ms of the ` +
      `bridge's clock, nothing sent to it by the harness: it is not polled at the cadence declared`, err);
  });
  const heard = Date.parse(polledIn(shown.payload)!.lastCheckIn);
  ctx.evidence(`polled every ${cadence} ms: lastCheckIn ${polledIn(shown.payload)!.lastCheckIn}, observable, with no check-in sent`);
  await transport.send({ op: "silence", device: "polled", silent: true });
  const silencedAt = ctx.time.now();
  const mark = watch.seen.length;
  const gone = t.status((p) => polledIn(p)?.observable === false);
  const late = await passUntil(ctx, gone, polled.basisMaxAgeMs + cadence + constantMs("bridge", "status-interval"), mark).catch((err) => {
    throw new RequirementFailure(`the polled device, silent since ${new Date(silencedAt).toISOString()}, is still observable past its bound of ` +
      `${polled.basisMaxAgeMs} ms`, err);
  });
  const lastHeard = Date.parse(polledIn(late.payload)!.lastCheckIn);
  must(lastHeard >= heard && lastHeard <= silencedAt + 1000 + ctx.allowanceMs,
    `the silent device's lastCheckIn ${polledIn(late.payload)!.lastCheckIn} moved after it fell silent at ${new Date(silencedAt).toISOString()}`);
  ctx.evidence(`silent at ${new Date(silencedAt).toISOString()}: observable false at ${late.payload.publishedAt}, lastCheckIn ${polledIn(late.payload)!.lastCheckIn}`);
});

/** The fields *Devices* gives every device's entry; `proposedClass` may be null, but is there. */
const DEVICE_FIELDS = ["id", "stableIdentifier", "transport", "model", "capabilities", "actions", "feedback", "reachMs",
  "proposedClass", "classEvidence", "otherAdmins"];
/** The roster's fields GA-BRIDGE-38 names, each present, null where *The roster and freshness* allows. */
const ROSTER_FIELDS = ["lastCheckIn", "basisMaxAgeMs", "observable"];

const SOCKET = "org.galatea.test.socket";
const MODE = `${SOCKET}.mode`;
const POWER = `${SOCKET}.power`;
/** A socket with an extension: a mode its set_mode is confirmed by, and a power reading no action confirms. */
const SOCKET_ENTRY = {
  capabilities: ["onoff"], feedback: "closed",
  actions: [
    { action: "onoff.turn_on", idempotent: true, stateless: false, confirms: true },
    { action: "onoff.turn_off", idempotent: true, stateless: false, confirms: true },
    { action: `${SOCKET}.set_mode`, idempotent: true, stateless: false, confirms: true, args: { mode: ["eco", "boost"] },
      confirmedBy: { key: MODE, value: { arg: "mode" } } },
  ],
  extensions: [{ capability: SOCKET, description: "A socket's mode and power",
    actions: [{ action: `${SOCKET}.set_mode`, description: "Sets the mode", schema: { enum: ["eco", "boost"] } }],
    keys: [{ key: MODE, kind: "state", description: "The mode", schema: { enum: ["eco", "boost"] } },
      { key: POWER, kind: "state", description: "The power drawn, in W", schema: { type: "number" } }] }],
};

requirement("GA-BRIDGE-38", {
  seam: "bridge", covers: "status valid, with every field The bridge's status lists; the roster lists every device devices does and no other, each with lastCheckIn, basisMaxAgeMs and observable present; each devices entry with the fields Devices gives every device; on a device with extensions, confirmedBy on each stateful extension action and every extension state key no confirmedBy names in selfChanging; a computer's, a plugin device's and a relay entry's fields are not tested",
}, async (ctx) => {
  await describe(ctx, "lamp", LAMP);
  await describe(ctx, "plug", { capabilities: ["onoff"], feedback: "open" });
  await describe(ctx, "socket", SOCKET_ENTRY);
  const { status, devices } = await settled(ctx);
  const statusErrors = validate("bridge/status.json", status.payload);
  must(statusErrors.length === 0, `the status is not valid: ${statusErrors.join("; ")}`, status.payload);
  const devicesErrors = validate("bridge/devices.json", devices.payload);
  must(devicesErrors.length === 0, `the devices document is not valid: ${devicesErrors.join("; ")}`, devices.payload);

  const entries = devices.payload.devices as Record<string, any>[];
  const roster = status.payload.devices as Record<string, any>[];
  const ids = (xs: Record<string, any>[]) => xs.map((x) => String(x.id)).sort();
  ctx.evidence(`devices: ${ids(entries).join(", ")}; roster: ${ids(roster).join(", ")}`);
  for (const id of ["lamp", "plug", "socket"]) must(ids(entries).includes(id), `devices does not list ${id}`, entries);
  mustEqual(ids(roster), ids(entries), "the roster's devices against the devices document's");
  for (const r of roster) for (const f of ROSTER_FIELDS) must(f in r, `the roster entry of ${r.id} has no ${f}`, r);
  for (const e of entries) for (const f of DEVICE_FIELDS) must(f in e, `the devices entry of ${e.id} has no ${f}`, e);

  // Every extension declaration the standard makes (*Devices*): first that the socket's extension is
  // published at all, with its stateful set_mode, so the clauses below have something to check.
  const socket = entries.find((e) => e.id === "socket")!;
  const published = ((socket.extensions ?? []) as { capability?: string; keys?: { key?: string }[] }[]).find((x) => x.capability === SOCKET);
  must(published !== undefined, `the socket's devices entry does not publish its extension ${SOCKET}`, socket);
  const keys = (published!.keys ?? []).map((k) => k.key);
  must([MODE, POWER].every((k) => keys.includes(k)), `the socket's extension does not publish its keys ${MODE} and ${POWER}`, published);
  const setMode = ((socket.actions ?? []) as Record<string, any>[]).find((a) => a.action === `${SOCKET}.set_mode`);
  must(setMode !== undefined && setMode.stateless === false, `the socket's devices entry does not publish its stateful ${SOCKET}.set_mode`, socket);
  // set_mode's confirmedBy comes in the describe entry, so this half grades that the bridge passes the
  // doer's declaration through: for a Zigbee bridge the doer is where that declaration comes from.
  // selfChanging below is the bridge's own derivation: the entry carries none.
  const capabilities = (socket.extensions ?? []).map((x: { capability: string }) => x.capability) as string[];
  const extension = (name: string) => capabilities.some((c) => name.startsWith(`${c}.`));
  for (const a of socket.actions as Record<string, any>[]) {
    if (extension(a.action) && a.stateless === false) must(a.confirmedBy !== undefined, `the stateful extension action ${a.action} has no confirmedBy`, a);
  }
  const confirming = new Set((socket.actions as Record<string, any>[]).map((a) => a.confirmedBy?.key).filter(Boolean));
  const stateKeys = (socket.extensions ?? []).flatMap((x: { keys?: { key: string; kind?: string }[] }) =>
    (x.keys ?? []).filter((k) => k.kind !== "event").map((k) => k.key)) as string[];
  for (const k of stateKeys.filter((k) => !confirming.has(k))) {
    must((socket.selfChanging ?? []).includes(k), `${k}, which no action confirms, is not in selfChanging`, socket);
  }
});
