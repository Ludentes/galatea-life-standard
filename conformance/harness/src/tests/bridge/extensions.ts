import { validate } from "@ludentes/galatea-life-schemas";
import { must, mustEqual, RequirementFailure } from "../../assert.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import type { Seen } from "../../seams/bridge-watcher.js";
import type { TestContext } from "../../context.js";
import { sleep } from "../../util.js";
import { wire } from "../util.js";

/**
 * Made-up devices in the shape of the bench's (the Zigbee design, *Extensions*), declared through
 * the `describe` op; a subject with no doer to script refuses it, and the test is not_applicable.
 */
const PUSHER = "org.galatea.test.pusher";
const MODE = `${PUSHER}.mode`;
const SET_MODE = { action: `${PUSHER}.set_mode`, idempotent: true, stateless: false, confirms: true,
  args: { mode: ["click", "switch"] }, confirmedBy: { key: MODE, value: { arg: "mode" } } };
/** A button pusher whose `onoff` is offered only once its mode is known, idempotent in switch mode only. */
const pusher = () => {
  const onoff = (idempotent: boolean) => [
    { action: "onoff.turn_on", idempotent, stateless: false, confirms: true },
    { action: "onoff.turn_off", idempotent, stateless: false, confirms: true },
    SET_MODE,
  ];
  return {
    entry: { capabilities: [], actions: [SET_MODE], reachMs: 2500,
      extensions: [{ capability: PUSHER, keys: [{ key: MODE, kind: "state", schema: { enum: ["click", "switch"] } }],
        actions: [{ action: SET_MODE.action, schema: { enum: ["click", "switch"] } }] }] },
    bySetting: { key: MODE, entries: { click: { capabilities: ["onoff"], actions: onoff(false) },
      switch: { capabilities: ["onoff"], actions: onoff(true) } } },
  };
};
const BED = "org.galatea.test.bed";
const VIBRATION = `${BED}.vibration`;
/** A bed sensor reporting occupancy, and vibration as an event. */
const BED_ENTRY = { capabilities: ["sensor"], sensorKeys: ["occupancy"], feedback: "closed",
  extensions: [{ capability: BED, keys: [{ key: VIBRATION, kind: "event", schema: { type: "boolean" } }] }] };

function topics(ctx: TestContext) {
  const base = `${ctx.root}/bridges/${ctx.bridgeId}`;
  const entry = (s: Seen, id: string) => (s.payload?.devices ?? []).find((d: { id: string }) => d.id === id) as Record<string, any> | undefined;
  return {
    base,
    entry,
    /** A `devices` document whose entry for `id` `pred` holds for. */
    devices: (id: string, pred: (e: Record<string, any>) => boolean = () => true) => (s: Seen) => {
      if (s.topic !== `${base}/devices` || s.payload === null) return false;
      const e = entry(s, id);
      return e !== undefined && pred(e);
    },
    deviceStatus: (id: string) => `${base}/devices/${id}/status`,
    /** The device's status, when `pred` holds for its payload. */
    statusOf: (id: string, pred: (p: Record<string, any>) => boolean = () => true) => (s: Seen) =>
      s.topic === `${base}/devices/${id}/status` && s.payload !== null && pred(s.payload),
    status: (pred: (p: Record<string, any>) => boolean) => (s: Seen) => s.topic === `${base}/status` && s.payload !== null && pred(s.payload),
  };
}
const offers = (action: string) => (e: Record<string, any>) => (e.actions ?? []).some((a: { action: string }) => a.action === action);

requirement("GA-BRIDGE-74", {
  seam: "bridge", covers: "no action on a setting never observed; the new devices within 1 s of the setting, and before its value; the setting kept across a restart",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const applier = ctx.applier!;
  const t = topics(ctx);
  const within = 1000 + ctx.allowanceMs;
  const { entry, bySetting } = pusher();
  await transport.send({ op: "describe", device: "pusher", entry, bySetting });
  const first = await watch.waitFor(t.devices("pusher"), within);
  must(!offers("onoff.turn_on")(t.entry(first, "pusher")!), "onoff.turn_on is offered before the mode was ever observed", t.entry(first, "pusher"));
  const early = await applier.command("pusher", { action: "onoff.turn_on" });
  const refused = await applier.terminalAck("pusher", early, within);
  ctx.evidence(`a command before the setting: ${JSON.stringify(refused.payload)}`);
  mustEqual(refused.payload.result, "unsupported", "the ack of onoff.turn_on before the mode is known");

  // The mode is observed, then changed: each time, a `devices` with onoff.turn_on as the mode makes it
  // goes out before the status that carries the mode.
  const idempotentIn = (mode: string) => mode === "switch";
  const turnOnIdempotent = (s: Seen) => t.entry(s, "pusher")?.actions?.find((a: { action: string }) => a.action === "onoff.turn_on")?.idempotent;
  for (const mode of ["switch", "click"]) {
    const mark = watch.seen.length;
    const sentAt = Date.now();
    await transport.send({ op: "setting", device: "pusher", key: MODE, value: mode, observedAt: wire(ctx.time.now()) });
    const value = await watch.waitFor((s) => s.topic === t.deviceStatus("pusher") && s.payload?.[MODE] === mode, within, mark);
    const redescribed = watch.seen.slice(mark, watch.seen.indexOf(value))
      .find((s) => t.devices("pusher", offers("onoff.turn_on"))(s) && turnOnIdempotent(s) === idempotentIn(mode));
    must(redescribed !== undefined, `no devices with onoff.turn_on idempotent ${idempotentIn(mode)} went out before the mode ${mode}`,
      watch.seen.slice(mark).map((s) => s.topic));
    const lag = redescribed.realAt - sentAt;
    ctx.evidence(`mode ${mode}: devices ${lag} ms after the setting, before the status, onoff.turn_on idempotent ${idempotentIn(mode)}`);
    must(lag <= within, `the devices for the mode ${mode} came ${lag} ms after the setting, past 1 s`);
  }
  const later = await applier.command("pusher", { action: "onoff.turn_on" });
  const applied = await applier.terminalAck("pusher", later, within);
  must(applied.payload.result !== "unsupported", "onoff.turn_on is still unsupported once the mode is known", applied.payload);

  // The bridge starts again; the doer describes the device before the device reports its mode, and
  // the declarations rest on the mode last observed, click.
  const restarted = watch.seen.length;
  await ctx.subject.restart();
  await transport.send({ op: "describe", device: "pusher", entry, bySetting });
  const back = await watch.waitFor(t.devices("pusher", offers("onoff.turn_on")), 5000 + ctx.allowanceMs, restarted);
  ctx.evidence(`after the restart: ${JSON.stringify(t.entry(back, "pusher")!.actions.map((a: { action: string; idempotent: boolean }) => [a.action, a.idempotent]))}`);
  mustEqual(turnOnIdempotent(back), false, "onoff.turn_on's idempotent after the restart, the mode kept as click");
});

requirement("GA-BRIDGE-75", {
  seam: "bridge", covers: "an occurrence is published once on event, a repeated frame within 10 s dropped, the same value in a new frame another, never in the status, never again after a restart",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const applier = ctx.applier!;
  const t = topics(ctx);
  const within = 1000 + ctx.allowanceMs;
  const repeatMs = constantMs("bridge", "one-occurrence-a-repeated-frame");
  await transport.send({ op: "describe", device: "bed", entry: BED_ENTRY });
  await watch.waitFor(t.devices("bed"), within);

  const mark = watch.seen.length;
  const observedAt = wire(ctx.time.now());
  const occur = { op: "occur", device: "bed", key: VIBRATION, value: true, frameId: "tsn-17", observedAt };
  await transport.send(occur);
  const seen = await applier.event((e) => e.type === "occurrence" && e.device === "bed", within, mark);
  ctx.evidence(`the occurrence: ${JSON.stringify(seen.payload)}`);
  must(validate("bridge/event.json", seen.payload).length === 0, "the occurrence event is not valid", seen.payload);
  mustEqual(seen.payload.key, VIBRATION, "the occurrence's key");
  mustEqual(seen.payload.value, true, "the occurrence's value");
  mustEqual(seen.payload.timestamp, observedAt, "the occurrence's timestamp");

  // The same frame again, then a report: once the report's status is out, the repeat was handled.
  await transport.send(occur);
  await transport.send({ op: "report", device: "bed", values: { occupancy: true }, observedAt: wire(ctx.time.now()) });
  await watch.waitFor((s) => s.topic === t.deviceStatus("bed") && s.payload?.occupancy === true, within, mark);
  mustEqual(applier.events("occurrence", mark).length, 1, "occurrences after one frame sent twice");
  const statuses = watch.seen.slice(mark).filter((s) => s.topic === t.deviceStatus("bed") && s.payload !== null);
  must(statuses.every((s) => !(VIBRATION in s.payload)), "the occurrence's key is in the device's status", statuses.map((s) => s.payload));

  // The same alarm in a new transaction, within the window, is another occurrence.
  const next = watch.seen.length;
  await transport.send({ ...occur, frameId: "tsn-18", observedAt: wire(ctx.time.now()) });
  await applier.event((e) => e.type === "occurrence" && e.device === "bed", within, next);

  // Past the repeat window, the same frame is another occurrence.
  await ctx.time.advance(repeatMs + 1000, { chunkMs: 1000 });
  const again = watch.seen.length;
  await transport.send({ ...occur, observedAt: wire(ctx.time.now()) });
  await applier.event((e) => e.type === "occurrence" && e.device === "bed", within, again);

  // A restart publishes no occurrence again, at its start or after.
  const restarted = watch.seen.length;
  await ctx.subject.restart();
  await transport.send({ op: "describe", device: "bed", entry: BED_ENTRY });
  await transport.send({ op: "report", device: "bed", values: { occupancy: false }, observedAt: wire(ctx.time.now()) });
  await watch.waitFor((s) => s.topic === t.deviceStatus("bed") && s.payload?.occupancy === false, 5000 + ctx.allowanceMs, restarted);
  mustEqual(applier.events("occurrence", restarted).length, 0, "occurrences published after the restart");
});

/** A snapshot's answer, as a fence: everything the subject published for what came before it is in. */
async function fence(ctx: TestContext): Promise<Seen> {
  const asked = ctx.watch!.seen.length;
  return ctx.applier!.reply(await ctx.applier!.request("snapshot"), 10_000 + ctx.allowanceMs, asked);
}

const NAME_FORM = /^[A-Za-z0-9._-]{1,64}$/;

requirement("GA-BRIDGE-76", {
  seam: "bridge", covers: "a value no key describes is never in a status, and is named in the device's undescribed in devices, with when it was first seen, each name in the form, at most 32, announced by one undescribed event when added; a full list neither lists nor announces a new name; a name the declarations come to describe leaves and frees its place, and a name not listed is added when it next comes with a place free; the list and its times kept across a restart, and no name announced again after it",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const applier = ctx.applier!;
  const t = topics(ctx);
  const within = 1000 + ctx.allowanceMs;
  const LAMP_ENTRY = { capabilities: ["onoff"], feedback: "closed" };
  await transport.send({ op: "describe", device: "lamp", entry: LAMP_ENTRY });
  await watch.waitFor(t.devices("lamp"), within);
  const listed = (s: Seen) => (t.entry(s, "lamp")?.undescribed ?? []) as { name: string; firstSeen: string }[];
  const names = (s: Seen) => listed(s).map((u) => u.name);
  const announced = (from: number) => applier.events("undescribed", from).filter((e) => e.device === "lamp").map((e) => e.name as string);
  const start = watch.seen.length;

  // A datapoint the lamp's entry does not declare: listed with its first sighting, announced once, never a reading.
  const sentAt = ctx.time.now();
  await transport.send({ op: "report", device: "lamp", values: { on: true, dp108: 5 }, observedAt: wire(sentAt) });
  const reading = await watch.waitFor(t.statusOf("lamp", (p) => p.on === true), within, start);
  must(!("dp108" in reading.payload), "the undescribed dp108 is published as a reading", reading.payload);
  const doc = await watch.waitFor(t.devices("lamp", (e) => (e.undescribed ?? []).some((u: { name: string }) => u.name === "dp108")), within, start);
  const dp108 = listed(doc).find((u) => u.name === "dp108")!;
  ctx.evidence(`undescribed after dp108: ${JSON.stringify(listed(doc))}`);
  must(validate("bridge/devices.json", doc.payload).length === 0, "the devices document is not valid", validate("bridge/devices.json", doc.payload));
  must(!Number.isNaN(Date.parse(dp108.firstSeen)), `dp108's firstSeen ${dp108.firstSeen} is no time`);
  const event = await applier.event((e) => e.type === "undescribed" && e.device === "lamp" && e.name === "dp108", within, start);
  must(validate("bridge/event.json", event.payload).length === 0, "the undescribed event is not valid", event.payload);
  await transport.send({ op: "report", device: "lamp", values: { on: false, dp108: 6 }, observedAt: wire(ctx.time.now()) });
  await watch.waitFor(t.statusOf("lamp", (p) => p.on === false), within, start);
  // Names the doer reports without values, as a cluster it does not decode, and a key no declaration has yet.
  await transport.send({ op: "undescribed", device: "lamp", names: ["genBasic.0x4000"] });
  await transport.send({ op: "report", device: "lamp", values: { on: true, temperature: 21 }, observedAt: wire(ctx.time.now()) });
  await watch.waitFor(t.devices("lamp", (e) => ["genBasic.0x4000", "temperature"].every((n) => (e.undescribed ?? []).some((u: { name: string }) => u.name === n))),
    within, start);

  // Forty names more, two not in the form: the list fills to 32, and no more.
  const many = ["genBasic/0x4001", "bad:name", ...Array.from({ length: 38 }, (_, i) => `dp${200 + i}`)];
  await transport.send({ op: "undescribed", device: "lamp", names: many });
  const full = await watch.waitFor(t.devices("lamp", (e) => (e.undescribed ?? []).length === 32), within, start)
    .catch((err) => { throw err instanceof RequirementFailure ? new RequirementFailure(`the list did not fill to 32 after forty names more: ${err.message}`) : err; });
  ctx.evidence(`full: ${names(full).length} names`);
  await fence(ctx);
  const once = announced(start);
  const twice = once.filter((n, i) => once.indexOf(n) !== i);
  must(twice.length === 0, `undescribed names announced more than once: ${JSON.stringify(twice)}`, once);
  const fullNames = names(full);
  const unannounced = fullNames.filter((n) => !once.includes(n));
  const unlisted = once.filter((n) => !fullNames.includes(n));
  must(unannounced.length === 0, `names listed and never announced: ${JSON.stringify(unannounced)}`);
  must(unlisted.length === 0, `names announced and never listed, as when the list was full: ${JSON.stringify(unlisted)}`);

  // The lamp comes to declare temperature: it leaves the list and frees its place, which a name left
  // out while the list was full takes when it next comes, announced.
  await transport.send({ op: "describe", device: "lamp", entry: { ...LAMP_ENTRY, capabilities: ["onoff", "sensor"], sensorKeys: ["temperature"] } });
  await watch.waitFor(t.devices("lamp", (e) => !(e.undescribed ?? []).some((u: { name: string }) => u.name === "temperature")
    && (e.undescribed ?? []).length === 31), within, start);
  const waiting = many.filter((n) => NAME_FORM.test(n) && !fullNames.includes(n));
  must(waiting.length > 0, "every name of the forty was listed, so none waits for a place", fullNames);
  const next = watch.seen.length;
  await transport.send({ op: "undescribed", device: "lamp", names: [waiting[0]!] });
  await watch.waitFor(t.devices("lamp", (e) => (e.undescribed ?? []).some((u: { name: string }) => u.name === waiting[0])), within, next);
  await applier.event((e) => e.type === "undescribed" && e.device === "lamp" && e.name === waiting[0], within, next);

  // Every document since: no lamp status carries an undescribed name, and no list is past 32 or out of the form.
  const before = watch.seen.slice(start);
  for (const m of before.filter(t.statusOf("lamp"))) {
    for (const n of ["dp108", "genBasic.0x4000", ...many]) must(!(n in m.payload), `the undescribed ${n} is in the lamp's status`, m.payload);
  }
  for (const d of before.filter(t.devices("lamp"))) {
    const l = names(d);
    must(l.length <= 32 && l.every((n) => NAME_FORM.test(n)), `a devices document lists ${l.length} undescribed names, or one out of the form`, l);
  }
  const kept = listed(before.filter(t.devices("lamp")).at(-1)!);

  // A restart: the list and each name's first sighting are kept, and no name is announced again,
  // even as the lamp sends dp108 once more.
  const restarted = watch.seen.length;
  await ctx.subject.restart();
  await transport.send({ op: "describe", device: "lamp", entry: { ...LAMP_ENTRY, capabilities: ["onoff", "sensor"], sensorKeys: ["temperature"] } });
  const back = await watch.waitFor(t.devices("lamp"), 5000 + ctx.allowanceMs, restarted);
  await transport.send({ op: "report", device: "lamp", values: { on: true, dp108: 7 }, observedAt: wire(ctx.time.now()) });
  await watch.waitFor(t.statusOf("lamp", (p) => p.on === true), within, restarted);
  await fence(ctx);
  ctx.evidence(`after the restart: ${listed(back).length} names listed`);
  const lost = kept.filter((u) => !listed(back).some((b) => b.name === u.name && b.firstSeen === u.firstSeen));
  must(lost.length === 0, `undescribed names lost, or their firstSeen changed, across the restart: ${JSON.stringify(lost)}`, listed(back));
  const again = announced(restarted);
  must(again.length === 0, `names announced again after the restart: ${JSON.stringify(again)}`);
});

requirement("GA-BRIDGE-77", {
  seam: "bridge", covers: "an extension whose name breaks the form is never published: a capability without a namespace, a key of a vocabulary quantity, a key outside its capability, and a capability nested in another on one device",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const t = topics(ctx);
  const within = 1000 + ctx.allowanceMs;
  const good = { capability: BED, keys: [{ key: VIBRATION, kind: "event", schema: { type: "boolean" } }] };
  const bare = { capability: "vibe", keys: [{ key: "vibe.level", schema: { type: "number" } }] };
  const battery = { capability: "org.galatea.test.vibe", keys: [{ key: "org.galatea.test.vibe.battery", schema: { type: "number" } }] };
  const stray = { capability: "org.galatea.test.rug", keys: [{ key: "org.galatea.test.other.level", schema: { type: "number" } }] };
  const outer = { capability: "org.galatea.test.mat", keys: [{ key: "org.galatea.test.mat.level", schema: { type: "number" } }] };
  const inner = { capability: "org.galatea.test.mat.edge", keys: [{ key: "org.galatea.test.mat.edge.level", schema: { type: "number" } }] };
  // The well-named extension rides on its own device; the misnamed ones on another, so a bridge
  // that drops a whole device for a malformed extension is not failed by the good one's wait.
  const mark = watch.seen.length;
  await transport.send({ op: "describe", device: "bed", entry: { capabilities: ["sensor"], sensorKeys: ["occupancy"], feedback: "closed",
    extensions: [good] } });
  await transport.send({ op: "describe", device: "rug", entry: { capabilities: ["sensor"], sensorKeys: ["occupancy"], feedback: "closed",
    extensions: [bare, battery, stray, outer, inner] } });
  // The bed must be published with its extension. The standard asks only that a misnamed extension
  // is never published, so the rug may be left out whole: the test watches a bounded window and
  // holds every devices document in it to the form, and the rug's absence passes.
  const bound = constantMs("bridge", "status-interval") + ctx.allowanceMs;
  const until = Date.now() + bound;
  const bedDoc = await watch.waitFor(t.devices("bed"), bound, mark);
  const published = (t.entry(bedDoc, "bed")?.extensions ?? []) as { capability: string }[];
  must(published.some((e) => e.capability === BED), "the well-named extension was not published on its device", published);
  await sleep(Math.max(0, until - Date.now()));
  // And past the window, through a snapshot that publishes devices again.
  const asked = watch.seen.length;
  const reply = await ctx.applier!.reply(await ctx.applier!.request("snapshot"), 10_000 + ctx.allowanceMs, asked);
  const rugDocs = watch.seen.slice(mark, watch.seen.indexOf(reply)).filter(t.devices("rug"));
  ctx.evidence(rugDocs.length === 0 ? `the rug was in no devices document within ${bound} ms, or after a snapshot`
    : `${rugDocs.length} devices documents with the rug within ${bound} ms and through a snapshot`);
  for (const d of rugDocs) {
    const rug = (t.entry(d, "rug")?.extensions ?? []) as { capability: string }[];
    const caps = rug.map((e) => e.capability);
    if (d === rugDocs[0]) ctx.evidence(`extensions published: bed ${JSON.stringify(published.map((e) => e.capability))}, rug ${JSON.stringify(caps)}`);
    must(!caps.includes("vibe"), "the extension vibe, with no namespace, was published", rug);
    must(!caps.includes(battery.capability), "an extension reporting battery under its own name was published", rug);
    must(!caps.includes(stray.capability), "an extension with a key outside its capability was published", rug);
    must(!(caps.includes(outer.capability) && caps.includes(inner.capability)),
      "two extensions, one the other's name with a segment added, were published on one device", rug);
  }
});
