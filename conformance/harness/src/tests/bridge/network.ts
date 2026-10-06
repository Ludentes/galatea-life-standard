import { randomInt } from "node:crypto";
import { must, mustEqual, RequirementFailure } from "../../assert.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import type { LinkRecord } from "../../seams/bridge-link.js";
import type { Seen } from "../../seams/bridge-watcher.js";
import { awaitTail, describe, LAMP, oneSecond, passUntil, settled, topics } from "./doer.js";

/**
 * What the bridge makes of the network's facts: a store that disagrees with it, who else controls a
 * device, where a class was found, the native ways around the applier, and a lock's PIN. Each test
 * scripts them through a doer's ops, so a subject with no doer refuses the first, and the test is
 * not_applicable.
 */

const faultKeys = (s: Seen | undefined) => new Set(((s?.payload?.faults ?? []) as unknown[]).map((f) => JSON.stringify(f)));
const allDown = (p: Record<string, any>) => Array.isArray(p.transports) && p.transports.length > 0
  && p.transports.every((x: { state?: unknown }) => x.state === "down");

requirement("GA-BRIDGE-12", {
  seam: "bridge", covers: "persisted state that disagrees with the network: a fault in status, every transport down, status still at least every interval over 25 s of its clock (the window's tail included), each with the new fault and every transport down, a command acked failed(unreachable), and, for a subject that claims Provision, a join failed(state_mismatch); how the owner resolves it is outside the standard",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const t = topics(ctx);
  const interval = constantMs("bridge", "status-interval");
  await describe(ctx, "lamp", LAMP);
  const live = t.status((p) => p.graceful !== true);
  const before = faultKeys(watch.seen.filter(live).at(-1));
  let mark = watch.seen.length;
  await transport.send({ op: "stateMismatch", disagrees: true });
  try {
    const gained = (p: Record<string, any>) => ((p.faults ?? []) as unknown[]).some((f) => !before.has(JSON.stringify(f)));
    const bound = interval + 1000 + ctx.allowanceMs;
    const shown = await passUntil(ctx, t.status((p) => p.graceful !== true && gained(p) && allDown(p)), interval, mark).catch((err) => {
      throw err instanceof RequirementFailure
        ? new RequirementFailure(`no status showed a new fault and every transport down within ${interval} ms of the bridge's clock after the network disagreed with its store: ${err.message}`) : err;
    });
    ctx.evidence(`faults ${JSON.stringify(shown.payload.faults)}; transports ${JSON.stringify(shown.payload.transports)}`);

    // Its status goes on, to the end of the window, each still with the fault and every transport down.
    mark = watch.seen.length;
    await ctx.time.advance(25_000, { chunkMs: 1000 });
    const end = ctx.time.now();
    // A status published near the end may still be on its way: wait for it before grading the tail.
    await awaitTail(ctx, live, end, bound, mark);
    const statuses = watch.seen.slice(mark).filter(live);
    const times = statuses.map((s) => Date.parse(s.payload.publishedAt));
    ctx.evidence(`statuses at ${times.map((x) => x - times[0]!).join(", ")} ms of the bridge's clock`);
    must(times.length >= 2, `${times.length} status in 25 s of the bridge's clock while it served nothing`);
    for (let i = 1; i < times.length; i++) {
      must(times[i]! - times[i - 1]! <= bound, `a gap of ${times[i]! - times[i - 1]!} ms between statuses`);
    }
    must(end - times.at(-1)! <= bound, `a gap of ${end - times.at(-1)!} ms from the last status to the end of the window`);
    for (const s of statuses) {
      must(allDown(s.payload), "a status showed a transport not down before the owner resolved the mismatch", s.payload);
      must(gained(s.payload), "a status no longer showed the mismatch's fault before the owner resolved it", s.payload);
    }

    // A command is acked failed(unreachable), within the command's own time.
    mark = watch.seen.length;
    const id = await ctx.applier!.command("lamp", { action: "onoff.turn_on" });
    const ack = await passUntil(ctx, (s) => s.topic === `${t.base}/devices/lamp/ack` && s.payload?.commandId === id
      && s.payload.result !== "received", 10_000, mark);
    ctx.evidence(`the ack: ${JSON.stringify(ack.payload)}`);
    mustEqual([ack.payload.result, ack.payload.reason], ["failed", "unreachable"], "the ack of a command while the store disagrees with the network");

    // Provisioning is failed(state_mismatch), for a subject that claims it.
    if (ctx.claims.includes("Provision")) {
      const transports = (watch.seen.filter(live).at(-1)?.payload.transports ?? []) as { id: string }[];
      mark = watch.seen.length;
      const requestId = await ctx.applier!.request("join", { transport: transports[0]?.id ?? "", windowMs: 60_000 });
      const reply = await ctx.applier!.reply(requestId, 1000 + ctx.allowanceMs, mark);
      ctx.evidence(`the reply to join: ${JSON.stringify(reply.payload)}`);
      mustEqual([reply.payload.status, reply.payload.reason], ["failed", "state_mismatch"], "the reply to a join while the store disagrees with the network");
    }
  } finally {
    await transport.send({ op: "stateMismatch", disagrees: false }).catch(() => {});
  }
});

requirement("GA-BRIDGE-14", {
  seam: "bridge", covers: "a device a binding the bridge did not make targets is never shown otherAdmins []; each change of a device's otherAdmins is an other_admins_changed event naming it, checked only on a change seen during the test (the reference, which shows unknown throughout, makes none); the [] side (every binding table read within 24 h, no foreign group) is not tested: the reference reads no binding table, and shows unknown",
}, async (ctx) => {
  const watch = ctx.watch!;
  const t = topics(ctx);
  const start = watch.seen.length;
  await describe(ctx, "valve", { capabilities: ["onoff"], feedback: "closed" });
  await describe(ctx, "remote", { capabilities: [], feedback: "closed" });
  await ctx.transport!.send({ op: "foreignBinding", device: "remote", target: "valve" });
  const { devices } = await settled(ctx);
  const valve = t.entry(devices, "valve");
  must(valve !== undefined, "devices does not list the valve", devices.payload);
  ctx.evidence(`the valve's otherAdmins: ${JSON.stringify(valve!.otherAdmins)}`);
  must(valve!.otherAdmins === "unknown" || (Array.isArray(valve!.otherAdmins) && valve!.otherAdmins.length > 0),
    `the valve, which a remote's binding the bridge did not make targets, is shown otherAdmins ${JSON.stringify(valve!.otherAdmins)}`);

  // Each change of a device's otherAdmins, across the devices documents of the test, is an event: as
  // many events naming the device as it had changes. The standard fixes neither the event's time nor
  // its order against the devices document, so each is waited for, within 1 s.
  const last = new Map<string, string>();
  const changes = new Map<string, number>();
  for (const s of watch.seen.slice(start).filter((x) => x.topic === `${t.base}/devices` && x.payload !== null)) {
    for (const e of (s.payload.devices ?? []) as Record<string, any>[]) {
      const now = JSON.stringify(e.otherAdmins);
      if (last.has(e.id) && last.get(e.id) !== now) changes.set(e.id, (changes.get(e.id) ?? 0) + 1);
      last.set(e.id, now);
    }
  }
  if (!changes.size) ctx.evidence("no device's otherAdmins changed during the test: the event clause had nothing to check");
  for (const [id, count] of changes) {
    const names = (e: Record<string, any>) => e.type === "other_admins_changed" && (e.device === id || JSON.stringify(e).includes(`"${id}"`));
    let from = start;
    for (let n = 1; n <= count; n++) {
      const seen = await ctx.applier!.event(names, oneSecond(ctx), from).catch((err) => {
        throw err instanceof RequirementFailure
          ? new RequirementFailure(`${id}'s otherAdmins changed ${count} times, with only ${n - 1} other_admins_changed events naming it`,
            ctx.applier!.events("other_admins_changed", start)) : err;
      });
      from = watch.seen.indexOf(seen) + 1;
    }
    ctx.evidence(`${id}'s otherAdmins changed ${count} times, each an other_admins_changed event`);
  }
});

/** The evidence a class may have (*Devices*). */
const EVIDENCE = ["protocol", "model_db", "none"];

requirement("GA-BRIDGE-15", {
  seam: "bridge", covers: "every devices entry states its classEvidence, one of protocol, model_db and none; a class found in a model database, or guessed, never claims protocol evidence; whether the scripted classes were proposed is reported, not graded (a bridge may propose none)",
}, async (ctx) => {
  const transport = ctx.transport!;
  const t = topics(ctx);
  await describe(ctx, "lamp", LAMP);
  await describe(ctx, "socket", { capabilities: ["onoff"], feedback: "closed" });
  await describe(ctx, "thermometer", { capabilities: [], sensorKeys: ["temperature"], feedback: "closed" });
  await transport.send({ op: "classFrom", device: "lamp", proposedClass: "light", from: "modelDb" });
  await transport.send({ op: "classFrom", device: "socket", proposedClass: "socket", from: "guess" });
  await transport.send({ op: "classFrom", device: "thermometer", proposedClass: "sensor", from: "device" });
  const { devices } = await settled(ctx);
  const entries = (devices.payload.devices ?? []) as Record<string, any>[];
  ctx.evidence(entries.map((e) => `${e.id}: ${e.proposedClass} by ${e.classEvidence}`).join("; "));
  for (const e of entries) {
    must(EVIDENCE.includes(e.classEvidence), `the devices entry of ${e.id} states classEvidence ${JSON.stringify(e.classEvidence)}, not one of ${EVIDENCE.join(", ")}`, e);
  }
  // Whether the scripted classes reached the bridge, so the report says what a pass means. It is not a
  // failure: GA-BRIDGE-15 asks only that a proposed class state its evidence, and a bridge may propose
  // none (`proposedClass` null, `classEvidence` none).
  const scripted: Record<string, string> = { lamp: "light", socket: "socket", thermometer: "sensor" };
  for (const id of Object.keys(scripted)) must(t.entry(devices, id) !== undefined, `devices does not list ${id}`, entries);
  const taken = Object.entries(scripted).filter(([id, cls]) => t.entry(devices, id)!.proposedClass === cls).map(([id]) => id);
  ctx.evidence(taken.length === 3 ? "each scripted class was proposed"
    : `the scripted classes of ${Object.keys(scripted).filter((id) => !taken.includes(id)).join(", ")} were not proposed: the floor was checked on the classes the bridge did propose`);
  for (const id of ["lamp", "socket"]) {
    const e = t.entry(devices, id)!;
    must(e.classEvidence !== "protocol", `${id}'s class, found ${id === "lamp" ? "in a model database" : "by a guess"}, claims protocol evidence`, e);
  }
});

requirement("GA-BRIDGE-32", {
  seam: "bridge", covers: "a native way the doer cannot disable is listed in status's ungoverned, an entry naming it; that a way the doer disabled is disabled, and that the list is complete, are the author's word (not checked by the harness); a computer's own behaviour is not tested",
}, async (ctx) => {
  const transport = ctx.transport!;
  // The doer's op goes first: a subject with no doer refuses it at once.
  await transport.send({ op: "nativeControl", way: "touchlink", canDisable: true });
  await transport.send({ op: "nativeControl", way: "a web frontend", canDisable: false });
  const { status } = await settled(ctx);
  const listed = (status.payload.ungoverned ?? []) as unknown[];
  ctx.evidence(`ungoverned: ${JSON.stringify(listed)}`);
  must(listed.some((x) => JSON.stringify(x).includes("a web frontend")),
    "a web frontend the doer cannot disable is not listed in status's ungoverned", listed);
});

/**
 * Every text the bridge sent the broker on the binding, as its link read it: each PUBLISH's topic,
 * payload and MQTT 5 properties, each CONNECT's client id, user name, properties and will (topic,
 * payload, properties), and each SUBSCRIBE's and UNSUBSCRIBE's filters and properties. The test
 * transport's own topics (`{root}/test/…`) are not the binding, and are left out. Not scanned: the
 * CONNECT's password (the harness does not hold a subject's credential), DISCONNECT's and PUBACK's
 * reason strings, and AUTH. Numbers (times, packet ids) are not text the bridge chose, and are left
 * out.
 */
function sentTexts(r: LinkRecord, root: string): string[] {
  const test = (topic: string) => topic.startsWith(`${root}/test/`);
  switch (r.kind) {
    case "publish": return test(r.topic) ? [] : [r.topic, r.payload, ...(r.properties ?? [])];
    case "connect": return [r.clientId, r.username ?? "", ...(r.properties ?? []),
      ...(r.will && !test(r.will.topic) ? [r.will.topic, r.will.payload, ...(r.will.properties ?? [])] : [])];
    case "subscribe": return [...r.filters.map((f) => f.filter).filter((f) => !test(f)), ...(r.properties ?? [])];
    case "unsubscribe": return [...r.filters.filter((f) => !test(f)), ...(r.properties ?? [])];
    default: return [];
  }
}

requirement("GA-BRIDGE-36", {
  seam: "bridge", covers: "a lock that requires a PIN for remote operation, none configured: no unlock offered, and a new faults entry naming the lock (in its device, topic or detail); one configured: nothing the bridge sends the broker on the binding from then on carries it verbatim (as a UTF-8 substring), on any topic, in a payload, a will, a client id, a user name, a filter or an MQTT 5 string property, an unlock's ack and a status interval after it included; not scanned: the test transport's own topics, the CONNECT password, reason strings, AUTH, and the PIN in any other encoding; that it is held in the bridge's own configuration is the author's word",
}, async (ctx) => {
  const transport = ctx.transport!;
  const t = topics(ctx);
  const interval = constantMs("bridge", "status-interval");
  const pin = String(randomInt(10_000_000, 100_000_000));
  const offersUnlock = (e: Record<string, any> | undefined) =>
    (Array.isArray(e?.actions) ? e!.actions : []).some((a: { action?: string }) => a?.action === "lock.unlock");
  const actionsOf = (e: Record<string, any>) => (Array.isArray(e.actions) ? e.actions : []).map((a: { action?: string }) => a?.action);
  await describe(ctx, "door", { capabilities: ["lock"], feedback: "closed" });
  // The faults before the PIN is required: the PIN's fault must be a new one.
  const before = faultKeys(ctx.watch!.seen.filter(t.status((p) => p.graceful !== true)).at(-1));
  await transport.send({ op: "lockPin", device: "door", requiresPin: true });
  const first = await settled(ctx);
  const door = t.entry(first.devices, "door");
  must(door !== undefined, "devices does not list the door", first.devices.payload);
  must(Array.isArray(door!.actions), "the door's devices entry has no actions list", door);
  ctx.evidence(`with no PIN: actions ${JSON.stringify(actionsOf(door!))}; faults ${JSON.stringify(first.status.payload.faults)}`);
  must(!offersUnlock(door), "the door, which requires a PIN the bridge does not hold, is offered unlock", door);
  const faults = (first.status.payload.faults ?? []) as { device?: string; topic?: string; detail?: string }[];
  const namesDoor = (f: { device?: string; topic?: string; detail?: string }) =>
    f.device === "door" || String(f.topic ?? "").split("/").includes("door") || String(f.detail ?? "").includes("door");
  must(faults.some((f) => !before.has(JSON.stringify(f)) && namesDoor(f)),
    "no faults entry in status, new since the PIN was required, names the door", { before: [...before], faults });

  // The owner sets the PIN in the bridge's own configuration, which the test transport stands in for.
  // Only what the bridge sent from then on is scanned: nothing before could carry it.
  const fromRecord = ctx.bridgeLink!.records.length;
  await transport.send({ op: "lockPin", device: "door", requiresPin: true, pin });
  const second = await settled(ctx);
  const carriers = () => ctx.bridgeLink!.records.slice(fromRecord).filter((r) => sentTexts(r, ctx.root).some((x) => x.includes(pin)));
  if (offersUnlock(t.entry(second.devices, "door"))) {
    const mark = ctx.watch!.seen.length;
    const id = await ctx.applier!.command("door", { action: "lock.unlock" });
    const ack = await passUntil(ctx, (s) => s.topic === `${t.base}/devices/door/ack` && s.payload?.commandId === id
      && s.payload.result !== "received", 10_000, mark);
    ctx.evidence(`with the PIN: unlock offered, its ack ${JSON.stringify(ack.payload)}`);
    // What the unlock causes after its ack (the door's status, an event) is sent too: the scan keeps
    // going for a status interval of the bridge's clock, and stops early on a carrier.
    await passUntil(ctx, () => carriers().length > 0, interval, ctx.watch!.seen.length).catch((err) => {
      if (!(err instanceof RequirementFailure)) throw err;
    });
  } else {
    ctx.evidence("with the PIN: unlock still not offered, so no unlock was sent");
  }
  const found = carriers();
  must(found.length === 0, `the bridge sent the PIN to the broker, in ${found.map((r) => r.kind === "publish" || r.kind === "connect" ? `${r.kind} ${r.kind === "publish" ? r.topic : "(will or properties)"}` : r.kind).join(", ")}`,
    found);
});
