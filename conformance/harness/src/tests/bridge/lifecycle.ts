import { must, mustEqual, RequirementFailure } from "../../assert.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import type { LinkRecord } from "../../seams/bridge-link.js";
import type { Seen } from "../../seams/bridge-watcher.js";
import { sleep } from "../../util.js";
import { wire } from "../util.js";
import { bridgeConnection, matches } from "./connection.js";
import { coordinator, describe, LAMP, oneSecond, passUntil, topics } from "./doer.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A snapshot's bound (GA-BRIDGE-30), the broker's allowance added. */
const SNAPSHOT_MS = 10_000;

requirement("GA-BRIDGE-10", {
  seam: "bridge",
  covers: "a malformed command and request, a device that never answers, the coordinator lost and back, and the broker lost and back: the bridge never exits, and serves a snapshot in the same instance after them",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const applier = ctx.applier!;
  const t = topics(ctx);
  await describe(ctx, "lamp", LAMP);
  const first = await watch.waitFor(t.status((p) => p.graceful !== true), constantMs("bridge", "status-interval") + ctx.allowanceMs);
  const alive = (what: string) => must(!ctx.subject.exited, `the bridge exited after ${what}`, ctx.subject.output());

  // Bodies that are not a command or a request.
  await applier.raw("devices/lamp/command", "{not json");
  await applier.raw("request/snapshot", "[]");
  await sleep(oneSecond(ctx));
  alive("a malformed command and request");

  // A device that never answers.
  await transport.send({ op: "silence", device: "lamp", silent: true });
  const hung = await applier.command("lamp", { action: "onoff.turn_on" }, { resultWithinMs: 2000 });
  await applier.terminalAck("lamp", hung, 2000 + oneSecond(ctx));
  await transport.send({ op: "silence", device: "lamp", silent: false });
  alive("a device that never answered");

  // The coordinator lost, then back.
  await coordinator(ctx, "down");
  alive("the coordinator's loss");
  await coordinator(ctx, "up");
  alive("the coordinator's return");

  // The broker lost to the bridge alone, then back: a status of the same instance, published after
  // the bridge's new CONNECT, so none in flight before the loss stands for it.
  const link = ctx.bridgeLink!;
  const mark = watch.seen.length;
  const lastConn = Math.max(0, ...link.records.map((r) => r.conn));
  link.sever();
  await sleep(2000);
  link.restore();
  const sameInstance = t.status((p) => p.instanceId === first.payload.instanceId);
  const afterReconnect = (s: Seen) => {
    const connect = link.records.find((r) => r.kind === "connect" && r.conn > lastConn);
    return connect !== undefined && s.realAt >= connect.at && sameInstance(s);
  };
  await passUntil(ctx, afterReconnect, constantMs("bridge", "status-interval"), mark, { realMs: oneSecond(ctx) })
    .catch((err) => {
      throw err instanceof RequirementFailure ? new RequirementFailure(`no status of the same instance after the broker came back: ${err.message}`) : err;
    });
  alive("the broker's loss");

  const asked = watch.seen.length;
  const reply = await applier.reply(await applier.request("snapshot"), SNAPSHOT_MS + ctx.allowanceMs, asked);
  mustEqual(reply.payload.status, "ok", "the snapshot's reply after the faults");
  const last = watch.seen.slice(asked).filter(t.status()).at(-1) ?? watch.seen.filter(t.status()).at(-1)!;
  mustEqual(last.payload.instanceId, first.payload.instanceId, "the instanceId after the faults");
  alive("the faults");
});

requirement("GA-BRIDGE-22", {
  seam: "bridge",
  covers: "a restart: commands and requests unsubscribed and the UNSUBACK awaited, then, for a subject that claims Provision, an open window closed with its window_closed, and a command in flight that was transmitted acked failed(no_confirmation), then offline with graceful: true, lwt cleared and a clean disconnect, all before the new instance connects; a command not yet transmitted, connects and a PC's suspend are not tested",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const applier = ctx.applier!;
  const link = ctx.bridgeLink!;
  const t = topics(ctx);
  await describe(ctx, "lamp", LAMP);
  await watch.waitFor(t.status((p) => p.graceful !== true), constantMs("bridge", "status-interval") + ctx.allowanceMs);
  const { firstStatus } = bridgeConnection(ctx);
  const old = firstStatus.conn;

  // A command the radio sent, which the lamp never answers: in flight at the restart.
  await transport.send({ op: "silence", device: "lamp", silent: true });
  const inFlight = await applier.command("lamp", { action: "onoff.turn_on" }, { resultWithinMs: 60_000 });
  for (let i = 0; i < 20 && !transport.received.some((r) => r.device === "lamp"); i++) await sleep(100);
  must(transport.received.some((r) => r.device === "lamp"), "the radio never sent the command that was to be in flight");

  // A window open at the restart, for a subject that claims Provision.
  const windowed = ctx.claims.includes("Provision");
  if (windowed) {
    const tid = (watch.seen.filter(t.status((p) => p.graceful !== true)).at(-1)?.payload.transports ?? [])[0]?.id ?? "";
    const asked = watch.seen.length;
    const opened = await applier.reply(await applier.request("join", { transport: tid, windowMs: 120_000 }), oneSecond(ctx), asked);
    mustEqual(opened.payload.status, "accepted", "the reply to the join before the restart");
  }

  const from = link.records.length;
  const mark = watch.seen.length;
  await ctx.subject.restart();
  const records = link.records.slice(from);
  const mine = records.filter((r) => r.conn === old);
  const at = (pred: (r: LinkRecord) => boolean) => mine.findIndex(pred);
  ctx.evidence(`the old instance's last packets: ${mine.map((r) => (r.kind === "publish" ? `publish ${r.topic.slice(t.base.length)}` : r.kind)).join(", ")}`);

  const { command, request } = { command: `${t.base}/devices/lamp/command`, request: `${t.base}/request/snapshot` };
  const body = (r: LinkRecord): Record<string, any> | undefined => {
    if (r.kind !== "publish") return undefined;
    try {
      return JSON.parse(r.payload);
    } catch {
      return undefined;
    }
  };
  // Every UNSUBSCRIBE of commands or requests, in one packet or several, as GA-BRIDGE-18 reads its
  // SUBSCRIBEs; each one's UNSUBACK must come before the command's ack.
  const unsubscribes = mine.filter((r): r is Extract<LinkRecord, { kind: "unsubscribe" }> => r.kind === "unsubscribe"
    && r.filters.some((f) => matches(f, command) || matches(f, request)));
  must(unsubscribes.length > 0, "the bridge did not unsubscribe before it went");
  const unsubscribed = unsubscribes.flatMap((u) => u.filters);
  must(unsubscribed.some((f) => matches(f, command)) && unsubscribed.some((f) => matches(f, request)),
    "the bridge's unsubscribes did not cover its commands and its requests", unsubscribes);
  const unsubacks = unsubscribes.map((u) => {
    const sent = mine.indexOf(u);
    return mine.findIndex((r, i) => i > sent && r.kind === "unsuback" && r.packetId === u.packetId);
  });
  const unsuback = unsubacks.some((i) => i < 0) ? -1 : Math.max(...unsubacks);
  const ack = at((r) => r.kind === "publish" && r.topic === `${t.base}/devices/lamp/ack` && body(r)?.commandId === inFlight
    && body(r)?.result === "failed");
  const offline = at((r) => r.kind === "publish" && r.topic === `${t.base}/status` && body(r)?.graceful === true
    && body(r)?.state === "offline");
  const cleared = at((r) => r.kind === "publish" && r.topic === `${t.base}/lwt` && r.retain && r.payload === "");
  const disconnect = at((r) => r.kind === "disconnect");
  must(unsuback >= 0, "the bridge went before the broker's UNSUBACK");
  must(ack > unsuback, "the command in flight was not acked after the UNSUBACK");
  must(offline > ack, "no graceful offline after the command's ack");
  must(cleared > offline, "lwt was not cleared after the graceful offline");
  must(disconnect > cleared, "no clean disconnect after lwt was cleared");
  if (windowed) {
    const closed = at((r) => r.kind === "publish" && r.topic === `${t.base}/event` && body(r)?.type === "window_closed");
    must(closed > unsuback, "the open window was not closed with its window_closed after the UNSUBACK");
    must(closed < offline, "the open window was not closed with its window_closed before the graceful offline");
  }
  mustEqual((mine[disconnect] as Extract<LinkRecord, { kind: "disconnect" }>).reason, 0, "the DISCONNECT's reason");
  const reconnect = records.findIndex((r) => r.kind === "connect" && r.conn !== old);
  must(reconnect > records.indexOf(mine[disconnect]!), "the new instance connected before the old one disconnected");

  const acked = await applier.terminalAck("lamp", inFlight, oneSecond(ctx), mark);
  mustEqual([acked.payload.result, acked.payload.reason], ["failed", "no_confirmation"], "the ack of the transmitted command in flight");
  // A will the broker fired for the old instance reaches the watcher before the new instance's first status.
  const oldInstance = body(firstStatus)?.instanceId;
  await passUntil(ctx, t.status((p) => p.instanceId !== oldInstance && p.graceful !== true), constantMs("bridge", "status-interval"), mark,
    { realMs: oneSecond(ctx) }).catch((err) => {
    throw err instanceof RequirementFailure ? new RequirementFailure(`no status of the new instance after the restart: ${err.message}`) : err;
  });
  must(!watch.seen.slice(mark).some((s: Seen) => s.topic === `${t.base}/lwt` && s.payload !== null), "the old instance's will fired");
});

requirement("GA-BRIDGE-30", {
  seam: "bridge", covers: "on snapshot, status, devices and every device's status published again before the reply ok, within 10 s",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const applier = ctx.applier!;
  const t = topics(ctx);
  await describe(ctx, "lamp", LAMP);
  await describe(ctx, "sensor", { capabilities: ["sensor"], sensorKeys: ["temperature"], feedback: "closed" });
  let mark = watch.seen.length;
  await transport.send({ op: "report", device: "lamp", values: { on: true }, observedAt: wire(ctx.time.now()) });
  await transport.send({ op: "report", device: "sensor", values: { temperature: 20 }, observedAt: wire(ctx.time.now()) });
  await watch.waitFor(t.statusOf("sensor"), oneSecond(ctx), mark);

  mark = watch.seen.length;
  const sentAt = Date.now();
  const requestId = await applier.request("snapshot");
  const reply = await applier.reply(requestId, SNAPSHOT_MS + ctx.allowanceMs, mark);
  ctx.evidence(`the reply ${reply.realAt - sentAt} ms after the request: ${JSON.stringify(reply.payload)}`);
  mustEqual(reply.payload.status, "ok", "the snapshot's reply");
  const before = watch.seen.slice(mark, watch.seen.indexOf(reply));
  const topicsSeen = new Set(before.map((s) => s.topic));
  for (const topic of [`${t.base}/status`, `${t.base}/devices`, t.deviceStatus("lamp"), t.deviceStatus("sensor")]) {
    must(topicsSeen.has(topic), `${topic.slice(t.base.length + 1)} was not published again before the snapshot's reply`);
  }
});

requirement("GA-BRIDGE-31", {
  seam: "bridge",
  covers: "lastCheckIn survives a restart, and every start takes a new UUID as instanceId; for a subject that claims Provision, the blocklist too: listed in status after each restart, and the blocked identifier turned away in a window with blocked_rejoin; otherAdmins (the doer's, `unknown` in the reference) is not tested",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const applier = ctx.applier!;
  const t = topics(ctx);
  const SENSOR = { capabilities: ["sensor"], sensorKeys: ["temperature"], feedback: "closed" };
  await describe(ctx, "sensor", SENSOR);
  await transport.send({ op: "checkIn", device: "sensor", at: wire(ctx.time.now()) });
  const mark = watch.seen.length;
  await applier.reply(await applier.request("snapshot"), SNAPSHOT_MS + ctx.allowanceMs, mark);
  const shown = watch.seen.slice(mark).filter(t.status()).at(-1);
  must(shown, "no status published again for a snapshot");
  const checkIn = t.roster(shown, "sensor")?.lastCheckIn;
  must(typeof checkIn === "string", "no lastCheckIn after the check-in", t.roster(shown, "sensor"));
  const ids = [shown.payload.instanceId as string];

  // A blocked identifier, for a subject that claims Provision.
  const blocking = ctx.claims.includes("Provision");
  if (blocking) {
    await describe(ctx, "gate", { capabilities: ["onoff"], feedback: "closed" });
    const asked = watch.seen.length;
    const removed = await applier.reply(await applier.request("remove", { device: "gate", blockRejoin: true }), oneSecond(ctx), asked);
    mustEqual(removed.payload.status, "accepted", "the reply to remove with blockRejoin");
    await watch.waitFor(t.status((p) => p.graceful !== true && (p.blocked ?? []).includes("gate")), oneSecond(ctx), asked);
  }

  for (const n of [1, 2]) {
    const restarted = watch.seen.length;
    await ctx.subject.restart();
    await describe(ctx, "sensor", SENSOR);
    const back = await watch.waitFor(t.status((p) => !ids.includes(p.instanceId) && t.roster({ payload: p } as Seen, "sensor") !== undefined),
      constantMs("bridge", "status-interval") + ctx.allowanceMs, restarted).catch((err) => {
      throw err instanceof RequirementFailure ? new RequirementFailure(`no status of a new instance holding the sensor after restart ${n}: ${err.message}`) : err;
    });
    ctx.evidence(`restart ${n}: instanceId ${back.payload.instanceId}, ${JSON.stringify(t.roster(back, "sensor"))}`);
    must(UUID.test(back.payload.instanceId), `the instanceId ${back.payload.instanceId} after restart ${n} is not a UUID`);
    mustEqual(t.roster(back, "sensor")?.lastCheckIn, checkIn, `lastCheckIn after restart ${n}`);
    if (blocking) {
      must((back.payload.blocked ?? []).includes("gate"), `the blocklist after restart ${n} does not list gate`, back.payload.blocked);
      // In a window: what this restart must keep is the list, which a window's refusal reads.
      const turned = watch.seen.length;
      const tid = (back.payload.transports ?? [])[0]?.id ?? "";
      await applier.reply(await applier.request("join", { transport: tid, windowMs: 60_000 }), oneSecond(ctx), turned);
      await transport.send({ op: "describe", device: "gate", entry: { capabilities: ["onoff"], feedback: "closed" } });
      await applier.event((e) => e.type === "blocked_rejoin" && e.identifier === "gate", oneSecond(ctx), turned).catch(() => {
        throw new RequirementFailure(`gate, blocked, was not turned away with blocked_rejoin after restart ${n}`);
      });
      must(!applier.events("joined", turned).length, `gate, blocked, joined again after restart ${n}`);
      const closing = watch.seen.length;
      await applier.reply(await applier.request("join_close", { transport: tid }), oneSecond(ctx), closing);
    }
    ids.push(back.payload.instanceId);
  }
  must(UUID.test(ids[0]!), `the first instanceId ${ids[0]} is not a UUID`);
});
