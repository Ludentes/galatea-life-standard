import { must, mustEqual, RequirementFailure } from "../../assert.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import type { LinkRecord } from "../../seams/bridge-link.js";
import type { TestContext } from "../../context.js";
import { sleep } from "../../util.js";
import { wire } from "../util.js";
import { describe, LAMP, oneSecond, passUntil, topics } from "./doer.js";

/** Whether the MQTT topic filter `filter` matches `topic`. */
export function matches(filter: string, topic: string): boolean {
  const f = filter.split("/");
  const t = topic.split("/");
  for (let i = 0; i < f.length; i++) {
    if (f[i] === "#") return i <= t.length;
    if (i >= t.length) return false;
    if (f[i] !== "+" && f[i] !== t[i]) return false;
  }
  return f.length === t.length;
}

type Of<K extends LinkRecord["kind"]> = Extract<LinkRecord, { kind: K }>;

/**
 * The bridge's own connection: the one that published its first `status` (a doer of its own, as
 * the Zigbee bridge's scripted doer has, connects beside it). Its records, in order, and that publish.
 */
export function bridgeConnection(ctx: TestContext): { records: LinkRecord[]; firstStatus: Of<"publish"> } {
  const status = `${topics(ctx).base}/status`;
  const firstStatus = ctx.bridgeLink!.records.find((r): r is Of<"publish"> => r.kind === "publish" && r.topic === status);
  must(firstStatus, "the bridge published no status through its link");
  return { records: ctx.bridgeLink!.records.filter((r) => r.conn === firstStatus.conn), firstStatus };
}

/** A command topic and a request topic of the bridge: what its subscriptions must cover. */
const served = (ctx: TestContext) => {
  const base = topics(ctx).base;
  return { command: `${base}/devices/lamp/command`, request: `${base}/request/snapshot` };
};

requirement("GA-BRIDGE-18", {
  seam: "bridge",
  covers: "a clean session (Session Expiry 0 on MQTT 5), a keepalive of at most 10 s, a retained will on lwt carrying the instanceId with a Will Delay of 0, lwt cleared on connecting, no shared subscription, device ids free of +, # and /, and commands and requests subscribed before the first status; the authenticated identity and TLS are not tested (the harness's broker is anonymous, on loopback)",
}, async (ctx) => {
  const watch = ctx.watch!;
  const t = topics(ctx);
  // A doer's op first: a subject with no doer to script is not_applicable.
  await describe(ctx, "lamp", LAMP);
  const status = await watch.waitFor(t.status((p) => p.graceful !== true), constantMs("bridge", "status-interval") + ctx.allowanceMs);
  const { records, firstStatus } = bridgeConnection(ctx);
  const connect = records.find((r): r is Of<"connect"> => r.kind === "connect");
  must(connect, "the link saw no CONNECT for the bridge's connection");
  ctx.evidence(`CONNECT: ${JSON.stringify(connect)}`);
  must(connect.cleanStart, "the bridge connected without Clean Start");
  if (connect.level === 5) mustEqual(connect.sessionExpiry, 0, "the Session Expiry Interval");
  must(connect.keepalive >= 1 && connect.keepalive <= 10, `a keepalive of ${connect.keepalive} s`);
  const will = connect.will;
  must(will, "the bridge connected with no will");
  mustEqual(will.topic, `${t.base}/lwt`, "the will's topic");
  must(will.retain, "the will is not retained");
  if (connect.level === 5) mustEqual(will.delay, 0, "the Will Delay Interval");
  let body: Record<string, unknown> | undefined;
  try {
    body = JSON.parse(will.payload);
  } catch {
    body = undefined;
  }
  mustEqual(body?.instanceId, status.payload.instanceId, "the will's instanceId against the status's");
  must(records.some((r) => r.kind === "publish" && r.topic === `${t.base}/lwt` && r.retain && r.payload === ""),
    "the bridge did not clear lwt with an empty retained payload on connecting");

  const filters = (rs: LinkRecord[]) => rs.flatMap((r) => (r.kind === "subscribe" ? r.filters.map((f) => f.filter) : []));
  // The bridge's own connection, as for the order: "It never uses a shared subscription" is of the bridge, not of a doer beside it.
  const shared = filters(records).filter((f) => f.startsWith("$share/"));
  mustEqual(shared, [], "shared subscriptions");
  const before = filters(records.slice(0, records.indexOf(firstStatus)));
  ctx.evidence(`subscribed before the first status: ${JSON.stringify(before)}`);
  const { command, request } = served(ctx);
  must(before.some((f) => matches(f, command)), "the bridge published its first status before it subscribed to its commands");
  must(before.some((f) => matches(f, request)), "the bridge published its first status before it subscribed to its requests");

  const devices = await watch.waitFor(t.devices("lamp"), oneSecond(ctx));
  for (const e of devices.payload.devices as { id: string }[]) must(!/[+#/]/.test(e.id), `the device id ${JSON.stringify(e.id)} holds +, # or /`);
});

requirement("GA-BRIDGE-19", {
  seam: "bridge",
  covers: "a command and a request retained while the bridge was away are not acted on when it subscribes again; on MQTT 5 its commands and requests are subscribed with Retain Handling 2",
}, async (ctx) => {
  const watch = ctx.watch!;
  const applier = ctx.applier!;
  const link = ctx.bridgeLink!;
  const t = topics(ctx);
  await describe(ctx, "lamp", LAMP);
  const instanceId = (await watch.waitFor(t.status((p) => p.graceful !== true), constantMs("bridge", "status-interval") + ctx.allowanceMs))
    .payload.instanceId;

  // The bridge away from the broker; a command and a request retained meanwhile; the bridge back.
  link.sever();
  await sleep(1000);
  const mark = watch.seen.length;
  const commandId = await applier.command("lamp", { action: "onoff.turn_on" }, { resultWithinMs: 60_000, retain: true });
  const requestId = await applier.request("snapshot", {}, undefined, { retain: true });
  try {
    link.restore();
    // The status the bridge times: its own clock passed for it (a status interval), with real time
    // between its seconds for the client's reconnection.
    await passUntil(ctx, t.status((p) => p.instanceId === instanceId), constantMs("bridge", "status-interval"), mark,
      { realMs: oneSecond(ctx) }).catch((err) => {
      throw err instanceof RequirementFailure ? new RequirementFailure(`no status after the broker came back: ${err.message}`) : err;
    });
    await sleep(2 * oneSecond(ctx));
    ctx.evidence(`after the bridge came back: ${watch.seen.slice(mark).map((s) => s.topic.slice(t.base.length)).join(", ")}`);
    mustEqual(applier.terminalAcks("lamp", commandId, mark).length, 0, "acks of the retained command");
    must(!watch.seen.slice(mark).some((s) => s.topic === `${t.base}/reply` && s.payload?.requestId === requestId),
      "the bridge answered the retained request");
    mustEqual(ctx.transport!.received.filter((r) => r.device === "lamp").length, 0, "transmissions of the retained command");
  } finally {
    await applier.clearRetained();
  }

  const subscribed = link.records.filter((r): r is Of<"subscribe"> => r.kind === "subscribe");
  const connects = link.records.filter((r): r is Of<"connect"> => r.kind === "connect");
  const { command, request } = served(ctx);
  for (const s of subscribed) {
    if (connects.find((c) => c.conn === s.conn)?.level !== 5) continue;
    for (const f of s.filters) {
      if (!matches(f.filter, command) && !matches(f.filter, request)) continue;
      mustEqual(f.retainHandling, 2, `the Retain Handling of ${f.filter}`);
    }
  }
});

requirement("GA-BRIDGE-20", {
  seam: "bridge",
  covers: "a SUBACK refusing its requests' subscription, and an MQTT 5 PUBACK refusing a device's status, each a fault in status naming the topic, in its `topic` or its `detail`; the refusals are the harness's link's, not the broker's",
}, async (ctx) => {
  const link = ctx.bridgeLink!;
  const transport = ctx.transport!;
  const t = topics(ctx);
  await describe(ctx, "lamp", LAMP);
  const { records } = bridgeConnection(ctx);
  const level = records.find((r): r is Of<"connect"> => r.kind === "connect")?.level;
  const { request } = served(ctx);
  const refusedStatus = t.deviceStatus("vault");
  link.refuse({ subscribe: (f) => matches(f, request), publish: (topic) => topic === refusedStatus });

  // A refused publish, on MQTT 5 only. The doer's ops go before the sever: the scripted doer's own
  // connection runs through the link too, and after a restore it may not have subscribed again. The
  // bridge re-publishes every device status once reconnected (*Faults*, "The broker restarts"), so
  // the refusal comes again after the mark.
  if (level === 5) {
    await describe(ctx, "vault", LAMP);
    await transport.send({ op: "report", device: "vault", values: { on: true }, observedAt: wire(ctx.time.now()) });
  }

  // A new subscription: the broker away, and back.
  const mark = ctx.watch!.seen.length;
  link.sever();
  await sleep(1000);
  link.restore();
  const suback = await (async () => {
    const until = Date.now() + 10_000 + ctx.allowanceMs;
    for (;;) {
      const r = link.records.find((x): x is Of<"suback"> => x.kind === "suback" && x.refused);
      if (r) return r;
      if (Date.now() > until) throw new RequirementFailure("the bridge did not subscribe to its requests again once the broker came back");
      await sleep(100);
    }
  })();
  const sub = link.records.find((r): r is Of<"subscribe"> => r.kind === "subscribe" && r.conn === suback.conn && r.packetId === suback.packetId)!;
  const refusedFilters = sub.filters.map((f) => f.filter).filter((f) => matches(f, request));
  ctx.evidence(`refused on the SUBACK: ${JSON.stringify(refusedFilters)}`);

  // "Naming the topic" fixes no form: the full topic, or the topic within the bridge's tree (`request/+`).
  const names = (f: Record<string, any>, topic: string) => {
    const forms = topic.startsWith(`${t.base}/`) ? [topic, topic.slice(t.base.length + 1)] : [topic];
    return forms.some((x) => f.topic === x || (typeof f.detail === "string" && f.detail.includes(x)));
  };
  const reported = (p: Record<string, any>) => {
    const faults = (p.faults ?? []) as Record<string, any>[];
    return refusedFilters.every((f) => faults.some((x) => names(x, f))) && (level !== 5 || faults.some((x) => names(x, refusedStatus)));
  };
  const shown = await passUntil(ctx, t.status(reported), constantMs("bridge", "status-interval"), mark).catch((err) => {
    throw err instanceof RequirementFailure
      ? new RequirementFailure(`no status named the refused ${level === 5 ? "subscription and publish" : "subscription"} in its faults: ${err.message}`) : err;
  });
  ctx.evidence(`faults: ${JSON.stringify(shown.payload.faults)}`);
});
