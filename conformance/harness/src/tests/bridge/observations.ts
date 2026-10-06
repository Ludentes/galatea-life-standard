import { validate } from "@ludentes/galatea-life-schemas";
import { must, mustEqual, RequirementFailure } from "../../assert.js";
import { requirement } from "../../registry.js";
import type { Seen } from "../../seams/bridge-watcher.js";
import { wire } from "../util.js";
import { describe, LAMP, oneSecond, passUntil, timeOf, topics } from "./doer.js";

/** RFC 3339 in UTC with milliseconds (*A device's status*, GA-BRIDGE-3). */
const WIRE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Every time a message carries, by its path: the fields the binding gives a time. */
function timesIn(payload: unknown, path = ""): [string, string][] {
  if (payload === null || typeof payload !== "object") return [];
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    const at = path ? `${path}.${k}` : k;
    if (["publishedAt", "timestamp", "since", "lastCheckIn"].includes(k) && typeof v === "string") out.push([at, v]);
    else if (k === "timestamps" && v && typeof v === "object") {
      for (const [key, t] of Object.entries(v as Record<string, unknown>)) out.push([`${at}.${key}`, String(t)]);
    } else if (v && typeof v === "object") out.push(...timesIn(v, at));
  }
  return out;
}

requirement("GA-BRIDGE-2", {
  seam: "bridge", covers: "a report of some keys restamps only those keys; the bridge's own read-back of the key a command sets restamps it",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const applier = ctx.applier!;
  const t = topics(ctx);
  await describe(ctx, "dimmer", { capabilities: ["onoff", "level"], feedback: "closed" });

  const first = wire(ctx.time.now() - 5000);
  let mark = watch.seen.length;
  await transport.send({ op: "report", device: "dimmer", values: { on: true, level: 10 }, observedAt: first });
  await watch.waitFor(t.statusOf("dimmer", (p) => p.level === 10), oneSecond(ctx), mark);

  // A report of one key.
  const second = wire(ctx.time.now() - 2000);
  mark = watch.seen.length;
  await transport.send({ op: "report", device: "dimmer", values: { level: 20 }, observedAt: second });
  const partial = await watch.waitFor(t.statusOf("dimmer", (p) => p.level === 20), oneSecond(ctx), mark);
  ctx.evidence(`after a report of level: ${JSON.stringify(partial.payload)}`);
  mustEqual(timeOf(partial.payload, "level"), second, "level's time after a report of level");
  mustEqual(timeOf(partial.payload, "on"), first, "on's time after a report of level alone");

  // The bridge's read-back of the key a command sets, the device reporting nothing of its own.
  await transport.send({ op: "commandResult", device: "dimmer", result: "confirmed", reportAfterMs: 600_000 });
  const issued = ctx.time.now();
  const commandId = await applier.command("dimmer", { action: "level.set_level", value: 40 }, { resultWithinMs: 10_000 });
  const ack = await applier.terminalAck("dimmer", commandId, oneSecond(ctx));
  mustEqual(ack.payload.result, "applied", "the set_level's ack");
  mark = watch.seen.length;
  const read = await passUntil(ctx, t.statusOf("dimmer", (p) => p.level === 40), 10_000, mark);
  ctx.evidence(`after the read-back of level: ${JSON.stringify(read.payload)}`);
  must(Date.parse(timeOf(read.payload, "level")) >= issued, "level's time after the read-back is older than the command", read.payload);
});

requirement("GA-BRIDGE-3", {
  seam: "bridge", covers: "every time the bridge sends is RFC 3339 UTC with milliseconds and no more than 1 s ahead of true time, a device's clock ahead included",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const applier = ctx.applier!;
  const t = topics(ctx);
  const start = watch.seen.length;
  await describe(ctx, "lamp", LAMP);

  // A device whose clock runs 30 s ahead reports, and checks in.
  const ahead = () => wire(ctx.time.now() + 30_000);
  let mark = watch.seen.length;
  await transport.send({ op: "report", device: "lamp", values: { on: true }, observedAt: ahead() });
  const reported = await watch.waitFor(t.statusOf("lamp", (p) => p.on === true), oneSecond(ctx), mark);
  ctx.evidence(`the status of a report stamped 30 s ahead: ${JSON.stringify(reported.payload)}`);
  await transport.send({ op: "checkIn", device: "lamp", at: ahead() });
  const commandId = await applier.command("lamp", { action: "onoff.turn_off" });
  await applier.terminalAck("lamp", commandId, oneSecond(ctx));
  mark = watch.seen.length;
  const snapshot = await applier.request("snapshot");
  const answered = await applier.reply(snapshot, 10_000 + ctx.allowanceMs, mark);
  // A snapshot re-publishes the status before its reply (GA-BRIDGE-30): the last one before it is the snapshot's.
  const roster = watch.seen.slice(mark, watch.seen.indexOf(answered)).filter(t.status()).at(-1);
  must(roster, "no status re-published before the snapshot's reply");
  ctx.evidence(`the roster after a check-in stamped 30 s ahead: ${JSON.stringify(t.roster(roster, "lamp"))}`);

  // Everything the bridge published in this test, retained documents included.
  const sent = watch.seen.slice(start).filter((s) => s.payload !== null && typeof s.payload === "object");
  let checked = 0;
  for (const s of sent) {
    const trueNow = ctx.time.at(s.realAt);
    for (const [path, value] of timesIn(s.payload)) {
      must(WIRE_TIME.test(value), `${s.topic} ${path} is ${JSON.stringify(value)}, not RFC 3339 UTC with milliseconds`);
      const lead = Date.parse(value) - trueNow;
      must(lead <= oneSecond(ctx), `${s.topic} ${path} is ${value}, ${lead} ms ahead of true time`, s.payload);
      checked += 1;
    }
  }
  ctx.evidence(`${checked} times in ${sent.length} messages, none ahead of true time`);
  must(checked > 0, "the bridge published no time");
});

requirement("GA-BRIDGE-33", {
  seam: "bridge", covers: "every event carries the instance's instanceId and a seq from 1 increasing by one, again from 1 after a restart",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const applier = ctx.applier!;
  const t = topics(ctx);
  const bed = { capabilities: ["sensor"], sensorKeys: ["occupancy"], feedback: "closed",
    extensions: [{ capability: "org.galatea.test.bed", keys: [{ key: "org.galatea.test.bed.vibration", kind: "event", schema: { type: "boolean" } }] }] };
  await describe(ctx, "lamp", LAMP);
  await describe(ctx, "bed", bed);
  await transport.send({ op: "occur", device: "bed", key: "org.galatea.test.bed.vibration", value: true, frameId: "f1",
    observedAt: wire(ctx.time.now()) });
  await transport.send({ op: "leave", device: "lamp" });
  await applier.event((e) => e.type === "left", oneSecond(ctx));
  const status = await watch.waitFor(t.status(), 10_000 + ctx.allowanceMs);
  const checkEvents = (events: Record<string, any>[], instanceId: string, what: string) => {
    ctx.evidence(`${what}: ${JSON.stringify(events.map((e) => [e.type, e.seq]))}`);
    must(events.length > 0, `no event ${what}`);
    events.forEach((e, i) => {
      must(validate("bridge/event.json", e).length === 0, `an event ${what} is not valid`, e);
      mustEqual(e.instanceId, instanceId, `the instanceId of event ${i + 1} ${what}`);
      mustEqual(e.seq, i + 1, `the seq of event ${i + 1} ${what}`);
    });
  };
  checkEvents(applier.events(), status.payload.instanceId, "before the restart");
  // The standard fixes each event's instanceId and seq, not which others a bridge sends (an
  // `interviewed`, say): the four this test caused must be among them.
  const types = applier.events().map((e) => e.type);
  for (const [type, n] of [["joined", 2], ["occurrence", 1], ["left", 1]] as const) {
    must(types.filter((x) => x === type).length >= n, `fewer than ${n} ${type} events before the restart`, types);
  }

  const restarted = watch.seen.length;
  await ctx.subject.restart();
  await describe(ctx, "rug", LAMP);
  await applier.event((e) => e.type === "joined" && e.device === "rug", oneSecond(ctx), restarted);
  // The first status of the new instance: not the old one's graceful offline.
  const again = await watch.waitFor(t.status((p) => p.graceful !== true), 10_000 + ctx.allowanceMs, restarted);
  must(again.payload.instanceId !== status.payload.instanceId, "the instanceId did not change at the restart", again.payload.instanceId);
  checkEvents(applier.events(undefined, restarted), again.payload.instanceId, "after the restart");
});

requirement("GA-BRIDGE-37", {
  seam: "bridge", covers: "lastCheckIn is when the check-in reached the bridge, moved by no status, snapshot or restart and kept across it; a device's status within 1 s of a report that changes a reading or its time",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const applier = ctx.applier!;
  const t = topics(ctx);
  const SENSOR = { capabilities: ["sensor"], sensorKeys: ["temperature"], feedback: "closed" };
  await describe(ctx, "sensor", SENSOR);
  const lastCheckIn = (s: Seen) => t.roster(s, "sensor")?.lastCheckIn;
  /** The last status before a snapshot's reply, which re-publishes it first (GA-BRIDGE-30): the snapshot's. */
  const snapshotRoster = async (): Promise<Seen> => {
    const mark = watch.seen.length;
    const reply = await applier.reply(await applier.request("snapshot"), 10_000 + ctx.allowanceMs, mark);
    const shown = watch.seen.slice(mark, watch.seen.indexOf(reply)).filter(t.status()).at(-1);
    must(shown, "no status re-published before the snapshot's reply");
    return shown;
  };

  // When the check-in reached the bridge: between the device's sending it and the roster that shows
  // it. The device stamps it an hour old, so a bridge that keeps the device's stamp shows that hour.
  const sentAt = ctx.time.now();
  const stamped = wire(sentAt - 3_600_000);
  await transport.send({ op: "checkIn", device: "sensor", at: stamped });
  const shown = await snapshotRoster();
  const checkIn = lastCheckIn(shown);
  ctx.evidence(`the check-in sent at ${wire(sentAt)}, stamped ${stamped} by the device, lastCheckIn ${checkIn}`);
  must(typeof checkIn === "string", "no lastCheckIn after the check-in", t.roster(shown, "sensor"));
  const reached = Date.parse(checkIn);
  must(reached >= sentAt - oneSecond(ctx) && reached <= ctx.time.at(shown.realAt) + oneSecond(ctx),
    `lastCheckIn ${checkIn} is not when the check-in sent at ${wire(sentAt)} reached the bridge`);
  // Statuses on the bridge's own rhythm, and a snapshot, are no check-in.
  const quiet = watch.seen.length;
  await ctx.time.advance(11_000, { chunkMs: 1000 });
  const periodic = watch.seen.slice(quiet).filter(t.status());
  must(periodic.length > 0, "no status in 11 s of the bridge's clock");
  for (const s of periodic) mustEqual(lastCheckIn(s), checkIn, `lastCheckIn in the status published at ${s.payload.publishedAt}`);
  mustEqual(lastCheckIn(await snapshotRoster()), checkIn, "lastCheckIn after a snapshot");

  // A report that changes a reading, then one that changes only its time: each status within 1 s.
  // A device stamps its observation in its past, never at the harness's "now": a conforming bridge
  // may clamp a time ahead of its own clock (GA-BRIDGE-3), and its clock, an SNTP estimate, can read
  // a few ms behind the harness's, so a report stamped at the harness's now would come back restamped.
  for (const [what, values, agoMs] of [["a new reading", { temperature: 21 }, 2000], ["the same reading, later", { temperature: 21 }, 1000]] as const) {
    const observedAt = wire(ctx.time.now() - agoMs);
    const mark = watch.seen.length;
    const sent = Date.now();
    await transport.send({ op: "report", device: "sensor", values, observedAt });
    const s = await watch.waitFor(t.statusOf("sensor", (p) => p.timestamp === observedAt), oneSecond(ctx), mark).catch((err) => {
      if (!(err instanceof RequirementFailure)) throw err;
      // Late, or published with another time: what the sensor's status and the roster showed after the report.
      const after = watch.seen.slice(mark).flatMap((x) => {
        const at = `${x.realAt - sent} ms`;
        if (t.statusOf("sensor")(x)) {
          return [`status at ${at}: timestamp ${x.payload.timestamp}, temperature ${JSON.stringify(x.payload.temperature)}, timestamps ${JSON.stringify(x.payload.timestamps ?? null)}`];
        }
        const r = t.status()(x) ? t.roster(x, "sensor") : undefined;
        return r ? [`roster at ${at}: lastCheckIn ${r.lastCheckIn}`] : [];
      });
      throw new RequirementFailure(`${what}, observed at ${observedAt}: no status with that timestamp within ${oneSecond(ctx)} ms; ` +
        `after the report: ${after.length ? after.join("; ") : "nothing of the sensor"}`, err);
    });
    ctx.evidence(`${what}: its status ${s.realAt - sent} ms after the report`);
  }
  const reported = lastCheckIn(await snapshotRoster());
  must(reported !== checkIn, "the reports did not move lastCheckIn");

  // A restart keeps it: the new instance's first roster that holds the sensor.
  const before = watch.seen.filter(t.status()).at(-1)!.payload.instanceId;
  const restarted = watch.seen.length;
  await ctx.subject.restart();
  await describe(ctx, "sensor", SENSOR);
  const back = await watch.waitFor(t.status((p) => p.instanceId !== before && t.roster({ payload: p } as Seen, "sensor") !== undefined),
    10_000 + ctx.allowanceMs, restarted);
  ctx.evidence(`after the restart: ${JSON.stringify(t.roster(back, "sensor"))}`);
  mustEqual(lastCheckIn(back), reported, "lastCheckIn after the restart");
});
