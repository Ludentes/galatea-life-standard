import { validate } from "@ludentes/galatea-life-schemas";
import { must, mustEqual, RequirementFailure } from "../../assert.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import type { Seen } from "../../seams/bridge-watcher.js";
import type { TestContext } from "../../context.js";
import { sleep } from "../../util.js";
import { wire } from "../util.js";
import { describe, LAMP, oneSecond, passUntil, timeOf, topics, whileDown } from "./doer.js";

/** An open plug: the protocol path gives no answer, so its actions are declared `confirms: false`. */
const PLUG = { capabilities: ["onoff"], feedback: "open" };

/**
 * The terminal ack of a command, valid, from this bridge, within `ms`; the ack's payload. A
 * non-terminal `received` MAY be sent before it (*The ack*), so it is passed over.
 */
async function ackOf(ctx: TestContext, device: string, commandId: string, ms: number, from = 0): Promise<Record<string, any>> {
  const ack = await ctx.applier!.terminalAck(device, commandId, ms, from);
  must(validate("bridge/ack.json", ack.payload).length === 0, "the ack is not valid", ack.payload);
  mustEqual(ack.payload.source, ctx.bridgeId, "the ack's source");
  return ack.payload;
}

/** Every terminal ack of the command seen so far; a non-terminal `received` is not one. */
const acksOf = (ctx: TestContext, device: string, commandId: string) => ctx.applier!.terminalAcks(device, commandId);

/** How many commands the test transport's radio sent to the device. */
const transmitted = (ctx: TestContext, device: string) => ctx.transport!.received.filter((r) => r.device === device).length;

requirement("GA-BRIDGE-4", {
  seam: "bridge", covers: "one terminal ack per command; a repeated commandId answered with the first and run once, and one repeated while the first runs given no second ack; an envelope field the standard does not define ignored, an unknown key in value failed(invalid_request); an action not offered unsupported within 1 s; replies within 1 s, a repeated request answered with the first reply and run once",
}, async (ctx) => {
  const watch = ctx.watch!;
  const applier = ctx.applier!;
  const t = topics(ctx);
  await describe(ctx, "lamp", LAMP);

  // A command carrying a field the standard does not define is served as if it were absent.
  const first = await applier.command("lamp", { action: "onoff.turn_on" }, { extra: { priority: "high" } });
  const ack = await ackOf(ctx, "lamp", first, oneSecond(ctx));
  ctx.evidence(`the ack: ${JSON.stringify(ack)}`);
  mustEqual(ack.result, "applied", "the ack of onoff.turn_on with an unknown envelope field");
  await sleep(oneSecond(ctx));
  mustEqual(acksOf(ctx, "lamp", first).length, 1, "acks of one command");

  // The same commandId again: the first ack, and nothing carried out.
  const mark = watch.seen.length;
  await applier.command("lamp", { action: "onoff.turn_on" }, { commandId: first });
  const repeat = await ackOf(ctx, "lamp", first, oneSecond(ctx), mark);
  mustEqual(repeat, ack, "the ack of a repeated commandId");
  mustEqual(transmitted(ctx, "lamp"), 1, "transmissions after a command and its repeat");

  const unknownKey = await applier.command("lamp", { action: "onoff.turn_off", speed: 3 });
  const refused = await ackOf(ctx, "lamp", unknownKey, oneSecond(ctx));
  mustEqual([refused.result, refused.reason], ["failed", "invalid_request"], "the ack of a value with a key the bridge does not know");
  const notOffered = await applier.command("lamp", { action: "level.set_level", value: 40 });
  mustEqual((await ackOf(ctx, "lamp", notOffered, oneSecond(ctx))).result, "unsupported", "the ack of an action the lamp does not offer");
  mustEqual(transmitted(ctx, "lamp"), 1, "transmissions after commands refused on receipt");

  // The same commandId while the first still runs: one terminal ack in all, and one transmission.
  await ctx.transport!.send({ op: "commandResult", device: "lamp", result: "confirmed", afterMs: 1500 });
  const running = await applier.command("lamp", { action: "onoff.turn_off" });
  await applier.command("lamp", { action: "onoff.turn_off" }, { commandId: running });
  mustEqual((await ackOf(ctx, "lamp", running, 1500 + oneSecond(ctx))).result, "applied", "the ack of a command repeated while it ran");
  await sleep(oneSecond(ctx));
  mustEqual(acksOf(ctx, "lamp", running).length, 1, "acks of a command repeated while it ran");
  mustEqual(transmitted(ctx, "lamp"), 2, "transmissions after a command repeated while it ran");

  // Requests: a level not claimed, within 1 s; a snapshot with a field it does not define, and its repeat.
  const join = await applier.request("join", { windowMs: 60_000 });
  const joinReply = await applier.reply(join, oneSecond(ctx));
  must(validate("bridge/reply.json", joinReply.payload).length === 0, "the reply is not valid", joinReply.payload);
  ctx.evidence(`join, not claimed: ${JSON.stringify(joinReply.payload)}`);
  must(["invalid_request", "failed"].includes(joinReply.payload.status), `join was answered ${joinReply.payload.status}`, joinReply.payload);
  const snapshotBound = 10_000 + ctx.allowanceMs;
  const asked = watch.seen.length;
  const snapshot = await applier.request("snapshot", { verbose: true });
  const reply = await applier.reply(snapshot, snapshotBound, asked);
  mustEqual(reply.payload.status, "ok", "the snapshot's reply");
  // A snapshot re-publishes devices before its reply (GA-BRIDGE-30): without it, the check below says nothing.
  must(watch.seen.slice(asked, watch.seen.indexOf(reply) + 1).some((s) => s.topic === `${t.base}/devices`),
    "the snapshot re-published no devices document before its reply");
  const again = watch.seen.length;
  await applier.request("snapshot", {}, snapshot);
  const replyAgain = await applier.reply(snapshot, oneSecond(ctx), again);
  mustEqual(replyAgain.payload, reply.payload, "the reply to a repeated requestId");
  // A run of the snapshot again would have the snapshot's 10 s to show (GA-BRIDGE-30).
  await sleep(snapshotBound);
  mustEqual(watch.seen.slice(again).filter((s) => s.topic === `${t.base}/devices`).length, 0,
    "devices documents published for a repeated snapshot");
});

requirement("GA-BRIDGE-5", {
  seam: "bridge", covers: "no reading the device did not report: none from a command the device refused, none from an open device's command",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const applier = ctx.applier!;
  const t = topics(ctx);
  await describe(ctx, "lamp", LAMP);
  await describe(ctx, "plug", PLUG);
  const mark = watch.seen.length;
  await transport.send({ op: "report", device: "lamp", values: { on: false }, observedAt: wire(ctx.time.now()) });
  await watch.waitFor(t.statusOf("lamp", (p) => p.on === false), oneSecond(ctx), mark);

  await transport.send({ op: "protocolResult", device: "lamp", result: "refused", reason: "busy", detail: "the device is busy" });
  const refused = await applier.command("lamp", { action: "onoff.turn_on" });
  const ack = await ackOf(ctx, "lamp", refused, oneSecond(ctx));
  mustEqual([ack.result, ack.reason], ["failed", "busy"], "the ack of a command the device refused");
  const sent = await applier.command("plug", { action: "onoff.turn_on" });
  mustEqual((await ackOf(ctx, "plug", sent, oneSecond(ctx))).result, "sent", "the ack of an open plug's command");
  await sleep(oneSecond(ctx));
  const lamp = watch.seen.slice(mark).filter(t.statusOf("lamp"));
  ctx.evidence(`the lamp's statuses: ${JSON.stringify(lamp.map((s) => s.payload.on))}`);
  must(lamp.every((s) => s.payload.on !== true), "the lamp's status reads on, which the device never reported", lamp.map((s) => s.payload));
  const plug = watch.seen.slice(mark).filter(t.statusOf("plug", (p) => "on" in p));
  must(plug.length === 0, "the open plug's status carries on, which it cannot report", plug.map((s) => s.payload));
});

requirement("GA-BRIDGE-6", {
  seam: "bridge", covers: "a command on a down transport failed(unreachable) within 1 s; one for an unknown device failed(unknown_device), naming it; unreachable only for a command nothing of which was transmitted, a lost or unanswered one no_confirmation",
}, async (ctx) => {
  const transport = ctx.transport!;
  const applier = ctx.applier!;
  await describe(ctx, "lamp", LAMP);

  await whileDown(ctx, async () => {
    const sentAt = Date.now();
    const down = await applier.command("lamp", { action: "onoff.turn_on" });
    const ack = await ackOf(ctx, "lamp", down, oneSecond(ctx)).catch((err) => {
      throw err instanceof RequirementFailure ? new RequirementFailure(`no ack within 1 s of a command on a down coordinator: ${err.message}`) : err;
    });
    ctx.evidence(`on a down coordinator, ${Date.now() - sentAt} ms: ${JSON.stringify(ack)}`);
    mustEqual([ack.result, ack.reason], ["failed", "unreachable"], "the ack of a command on a down coordinator");
  });
  // The wait for the coordinator may have let the lamp's check-in age past its bound.
  await transport.send({ op: "checkIn", device: "lamp", at: wire(ctx.time.now()) });

  const ghost = await applier.command("ghost", { action: "onoff.turn_on" });
  const unknown = await ackOf(ctx, "ghost", ghost, oneSecond(ctx));
  mustEqual([unknown.result, unknown.reason], ["failed", "unknown_device"], "the ack of a command for a device the bridge does not have");
  must(String(unknown.detail ?? "").includes("ghost"), "the unknown_device ack does not name the device", unknown);

  // The stack sent nothing: unreachable, and the radio is silent.
  await transport.send({ op: "protocolResult", device: "lamp", result: "notSent", reason: "unreachable" });
  const notSent = await applier.command("lamp", { action: "onoff.turn_on" });
  const unsent = await ackOf(ctx, "lamp", notSent, oneSecond(ctx));
  mustEqual([unsent.result, unsent.reason], ["failed", "unreachable"], "the ack of a command the stack did not send");
  mustEqual(transmitted(ctx, "lamp"), 0, "transmissions of commands acked unreachable");

  // The stack took it, then lost it; the device took it, and never answered: no_confirmation.
  await transport.send({ op: "protocolResult", device: "lamp", result: "lost", detail: "MAC_NO_ACK" });
  const lost = await applier.command("lamp", { action: "onoff.turn_on" });
  const lostAck = await ackOf(ctx, "lamp", lost, oneSecond(ctx));
  mustEqual([lostAck.result, lostAck.reason], ["failed", "no_confirmation"], "the ack of a command lost after transmission");
  await transport.send({ op: "silence", device: "lamp", silent: true });
  const unanswered = await applier.command("lamp", { action: "onoff.turn_off" }, { resultWithinMs: 2000 });
  const silentAck = await ackOf(ctx, "lamp", unanswered, 2000 + oneSecond(ctx));
  mustEqual([silentAck.result, silentAck.reason], ["failed", "no_confirmation"], "the ack of a command the device never answered");
  mustEqual(transmitted(ctx, "lamp"), 2, "transmissions of the lost and the unanswered command");
});

requirement("GA-BRIDGE-7", {
  seam: "bridge", covers: "a command whose time ran out before it could start is failed(expired) and never transmitted; one acked failed is never carried out later; no action on a device unreachable within 145 s",
}, async (ctx) => {
  const transport = ctx.transport!;
  const applier = ctx.applier!;
  const t = topics(ctx);
  await describe(ctx, "lamp", LAMP);

  // The bridge's main loop is held past the command's time.
  await transport.send({ op: "stall", ms: 2500 });
  const late = await applier.command("lamp", { action: "onoff.turn_on" }, { resultWithinMs: 1000 });
  const expired = await ackOf(ctx, "lamp", late, 2500 + oneSecond(ctx));
  ctx.evidence(`a command held past its time: ${JSON.stringify(expired)}`);
  mustEqual([expired.result, expired.reason], ["failed", "expired"], "the ack of a command whose time ran out");

  // A command acked unreachable while the coordinator was down is not carried out once it is back.
  await whileDown(ctx, async () => {
    const down = await applier.command("lamp", { action: "onoff.turn_on" });
    mustEqual((await ackOf(ctx, "lamp", down, oneSecond(ctx))).reason, "unreachable", "the ack on a down coordinator");
  });
  await sleep(oneSecond(ctx));
  mustEqual(transmitted(ctx, "lamp"), 0, "transmissions of commands acked failed");

  // A device the bridge cannot reach within 145 s is offered nothing; one within it is.
  const far = ctx.watch!.seen.length;
  await describe(ctx, "far", { ...LAMP, reachMs: 145_001 });
  await describe(ctx, "near", { ...LAMP, reachMs: 145_000 });
  const doc = ctx.watch!.seen.slice(far).filter(t.devices("near")).at(-1)!;
  ctx.evidence(`far: ${JSON.stringify(t.entry(doc, "far")?.actions)}, near: ${JSON.stringify(t.entry(doc, "near")?.actions?.length)} actions`);
  mustEqual(t.entry(doc, "far")?.actions ?? [], [], "the actions of a device reached only within 145 001 ms");
  must((t.entry(doc, "near")?.actions ?? []).length > 0, "a device reached within 145 s is offered no action");
});

requirement("GA-BRIDGE-8", {
  seam: "bridge", covers: "applied only on the protocol's confirmation; a transmission never confirmed failed(no_confirmation), never applied or sent; sent for an action declared confirms: false",
}, async (ctx) => {
  const transport = ctx.transport!;
  const applier = ctx.applier!;
  await describe(ctx, "lamp", LAMP);
  await describe(ctx, "plug", PLUG);
  const results: [string, Record<string, unknown> | undefined, string[]][] = [
    ["confirmed", { result: "confirmed" }, ["applied"]],
    ["transmitted, no answer", { result: "transmitted" }, ["failed", "no_confirmation"]],
    ["lost", { result: "lost" }, ["failed", "no_confirmation"]],
  ];
  for (const [what, result, want] of results) {
    await transport.send({ op: "protocolResult", device: "lamp", ...result });
    const id = await applier.command("lamp", { action: "onoff.turn_on" });
    const ack = await ackOf(ctx, "lamp", id, oneSecond(ctx));
    ctx.evidence(`${what}: ${JSON.stringify(ack)}`);
    mustEqual([ack.result, ack.reason].filter(Boolean), want, `the ack when the protocol says ${what}`);
  }
  await transport.send({ op: "silence", device: "lamp", silent: true });
  const unanswered = await applier.command("lamp", { action: "onoff.turn_off" }, { resultWithinMs: 2000 });
  const silent = await ackOf(ctx, "lamp", unanswered, 2000 + oneSecond(ctx));
  mustEqual([silent.result, silent.reason], ["failed", "no_confirmation"], "the ack when the device never answers");

  const doc = ctx.watch!.seen.filter(topics(ctx).devices("plug")).at(-1)!;
  const declared = (topics(ctx).entry(doc, "plug")?.actions ?? []).find((a: { action: string }) => a.action === "onoff.turn_on");
  mustEqual(declared?.confirms, false, "the open plug's onoff.turn_on confirms");
  const sent = await applier.command("plug", { action: "onoff.turn_on" });
  mustEqual((await ackOf(ctx, "plug", sent, oneSecond(ctx))).result, "sent", "the ack of an action declared confirms: false");
});

requirement("GA-BRIDGE-9", {
  seam: "bridge", covers: "a device that never answers stops no command to another; the broker lost to the bridge alone and back is recovered in the same instance, which serves commands again, and changes no device's observable or available",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const applier = ctx.applier!;
  const t = topics(ctx);
  await describe(ctx, "lamp", LAMP);
  await describe(ctx, "hall", LAMP);
  // The hall is configured to report every 30 s, which gives it a 60 s bound (twice that, GA-BRIDGE-13);
  // the scripted doer sends no periodic report, so its check-in is its confirmed turn_on below, which
  // makes it observable within that bound.
  await transport.send({ op: "reporting", device: "hall", configuredMs: [30_000], modelMs: null });
  await transport.send({ op: "silence", device: "lamp", silent: true });
  const stuck = await applier.command("lamp", { action: "onoff.turn_on" }, { resultWithinMs: 5000 });
  const other = await applier.command("hall", { action: "onoff.turn_on" });
  const ok = await ackOf(ctx, "hall", other, oneSecond(ctx)).catch((err) => {
    throw err instanceof RequirementFailure ? new RequirementFailure(`no ack for the healthy hall within 1 s while the lamp's command hung: ${err.message}`) : err;
  });
  mustEqual(ok.result, "applied", "the healthy hall's ack");
  const hung = await ackOf(ctx, "lamp", stuck, 5000 + oneSecond(ctx));
  ctx.evidence(`the silent lamp: ${JSON.stringify(hung)}; the hall: ${JSON.stringify(ok)}`);
  mustEqual(hung.reason, "no_confirmation", "the silent lamp's ack");

  // The broker lost to the bridge alone, then back. The silent lamp has never checked in, the hall
  // has, within its bound: a status from before the loss shows the hall observable, and each
  // device's observable.
  const statusInterval = constantMs("bridge", "status-interval");
  let mark = watch.seen.length;
  const hallOf = (p: Record<string, any>) => t.roster({ payload: p } as Seen, "hall");
  const before = await passUntil(ctx, t.status((p) => hallOf(p)?.observable === true), statusInterval, mark).catch((err) => {
    throw err instanceof RequirementFailure ? new RequirementFailure(`the hall, which checked in within its bound, was not shown observable: ${err.message}`) : err;
  });
  const observable = Object.fromEntries((before.payload.devices as { id: string; observable: boolean }[]).map((d) => [d.id, d.observable]));
  ctx.evidence(`before the loss: ${JSON.stringify(observable)}`);
  ctx.bridgeLink!.sever();
  await sleep(3000);
  mark = watch.seen.length;
  ctx.bridgeLink!.restore();
  // The status the bridge times: its own clock passed for it, as for GA-BRIDGE-20, with real time
  // between its seconds for the client's reconnection.
  const back = await passUntil(ctx, t.status((p) => p.instanceId === before.payload.instanceId), statusInterval, mark,
    { realMs: oneSecond(ctx) }).catch((err) => {
      throw err instanceof RequirementFailure ? new RequirementFailure(`no status of the same instance after the broker came back: ${err.message}`) : err;
    });
  ctx.evidence(`after it: ${JSON.stringify(back.payload.devices)}`);
  for (const [id, was] of Object.entries(observable)) mustEqual(t.roster(back, id)?.observable, was, `${id}'s observable after the broker came back`);
  const again = await applier.command("hall", { action: "onoff.turn_off" });
  mustEqual((await ackOf(ctx, "hall", again, oneSecond(ctx))).result, "applied", "the hall's ack after the broker came back");
  for (const s of watch.seen.slice(mark).filter((x) => x.topic.endsWith("/status") && x.topic.startsWith(`${t.base}/devices/`))) {
    must(s.payload === null || s.payload.available !== false, `${s.topic} published available: false after the broker came back`, s.payload);
  }
});

requirement("GA-BRIDGE-34", {
  seam: "bridge", covers: "after applied, sent and no_confirmation, a fresh observation of the key the action sets, read back when the device reports nothing, out before the command's issuedAt plus resultWithinMs",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const applier = ctx.applier!;
  const t = topics(ctx);
  const within = 10_000;
  // A closed switch whose protocol path gives no answer: its actions are declared `confirms: false`, so `sent`.
  const unconfirmed = (action: string) => ({ action, idempotent: true, stateless: false, confirms: false });
  await describe(ctx, "lamp", LAMP);
  await describe(ctx, "switch", { capabilities: ["onoff"], feedback: "closed",
    actions: [unconfirmed("onoff.turn_on"), unconfirmed("onoff.turn_off")] });
  let mark = watch.seen.length;
  await transport.send({ op: "report", device: "lamp", values: { on: false }, observedAt: wire(ctx.time.now() - 5000) });
  await transport.send({ op: "report", device: "switch", values: { on: false }, observedAt: wire(ctx.time.now() - 5000) });
  await watch.waitFor(t.statusOf("lamp", (p) => p.on === false), oneSecond(ctx), mark);
  await watch.waitFor(t.statusOf("switch", (p) => p.on === false), oneSecond(ctx), mark);

  const cases: [string, string, Record<string, unknown>, string, boolean][] = [
    // The device carries it out and reports nothing of its own for ten minutes.
    ["applied", "lamp", { op: "commandResult", device: "lamp", result: "confirmed", reportAfterMs: 600_000 }, "onoff.turn_on", true],
    // The stack lost it; the lamp is still on.
    ["no_confirmation", "lamp", { op: "protocolResult", device: "lamp", result: "lost" }, "onoff.turn_off", true],
    // The switch carries it out, which nothing confirms, and reports nothing of its own.
    ["sent", "switch", { op: "commandResult", device: "switch", result: "sent", reportAfterMs: 600_000 }, "onoff.turn_on", true],
  ];
  for (const [what, device, script, action, on] of cases) {
    await transport.send(script as { op: string });
    const issued = ctx.time.now();
    // Before the command: nothing fixes the read-back's order against the ack, and statuses from
    // before it fail `fresh` by their time.
    mark = watch.seen.length;
    const id = await applier.command(device, { action }, { resultWithinMs: within });
    const ack = await ackOf(ctx, device, id, oneSecond(ctx));
    mustEqual(ack.reason ?? ack.result, what, `the ack of ${action}`);
    const fresh = (p: Record<string, any>) => p.on === on && Date.parse(timeOf(p, "on")) >= issued;
    const read: Seen = await passUntil(ctx, t.statusOf(device, fresh), within, mark).catch((err) => {
      throw err instanceof RequirementFailure ? new RequirementFailure(`no fresh observation of on after ${what}: ${err.message}`) : err;
    });
    const by = ctx.time.at(read.realAt) - issued;
    ctx.evidence(`after ${what}: ${JSON.stringify(read.payload)}, ${by} ms after issuedAt`);
    // The ack bound is resultWithinMs from the command's publish (*Commands*), and issuedAt is taken just before it.
    must(by <= within, `the fresh observation after ${what} came ${by} ms after issuedAt, past its ack bound of ${within} ms`);
  }
});
