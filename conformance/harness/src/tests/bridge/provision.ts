import { validate } from "@ludentes/galatea-life-schemas";
import { must, mustEqual, RequirementFailure } from "../../assert.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import { OpUnsupported } from "../../seams/test-transport.js";
import type { Seen } from "../../seams/bridge-watcher.js";
import type { TestContext } from "../../context.js";
import { pollUntil } from "../../util.js";
import { describe, LAMP, oneSecond, passUntil, topics } from "./doer.js";

/**
 * Provision (bridge, *Provisioning*): join windows, removal and the blocklist, and the requests a
 * transport does not fit. Each test starts with a doer's op, so a subject with no doer to script
 * refuses it at once, and the test is not_applicable. The test transport shows each window its
 * coordinator opens or closes on `received`, as `{ device: <router, or "*">, action:
 * "provision.window", args: { windowMs } }`, `windowMs` 0 for a close (the harness's control
 * interface).
 */

/** `received`'s action for a window the test transport's coordinator opened or closed. */
const WINDOW = "provision.window";

/** The bridge's transports, as its latest live status lists them. */
function transportsOf(ctx: TestContext): { id: string; kind: string }[] {
  const t = topics(ctx);
  const last = ctx.watch!.seen.filter(t.status((p) => p.graceful !== true)).at(-1);
  if (!last) throw new RequirementFailure("the bridge published no status");
  return last.payload.transports ?? [];
}

/** The first transport with a join window: a Zigbee one, the only kind the harness scripts windows on. */
function windowTransport(ctx: TestContext): string {
  const z = transportsOf(ctx).find((x) => x.kind === "zigbee");
  if (!z) throw new OpUnsupported("join", "the bridge has no transport with a join window the harness can script");
  return z.id;
}

/** Sends a request and waits for its reply, within the 1 s GA-BRIDGE-4 gives a reply. */
async function ask(ctx: TestContext, op: string, fields: Record<string, unknown>): Promise<Record<string, any>> {
  const mark = ctx.watch!.seen.length;
  const requestId = await ctx.applier!.request(op, fields);
  const reply = await ctx.applier!.reply(requestId, oneSecond(ctx), mark).catch((err) => {
    throw err instanceof RequirementFailure ? new RequirementFailure(`no reply to ${op} within 1 s: ${err.message}`) : err;
  });
  must(validate("bridge/reply.json", reply.payload).length === 0, `the reply to ${op} is not valid`, reply.payload);
  return reply.payload;
}

/** The window shown on `received` after `from` that `pred` holds for, within 1 s. */
function windowShown(ctx: TestContext, from: number, pred: (r: Record<string, any>) => boolean, what: string) {
  return pollUntil(async () => ctx.transport!.received.slice(from).find((r) => r.action === WINDOW && pred(r as Record<string, any>)),
    oneSecond(ctx), what);
}

/** The first event after `from` of `type` that `pred` holds for, within 1 s, valid. */
async function eventOf(ctx: TestContext, type: string, from: number, pred: (e: Record<string, any>) => boolean = () => true): Promise<Record<string, any>> {
  const seen = await ctx.applier!.event((e) => e.type === type && pred(e), oneSecond(ctx), from).catch((err) => {
    throw err instanceof RequirementFailure ? new RequirementFailure(`no ${type} event within 1 s: ${err.message}`) : err;
  });
  must(validate("bridge/event.json", seen.payload).length === 0, `the ${type} event is not valid`, seen.payload);
  return seen.payload;
}

requirement("GA-BRIDGE-25", {
  seam: "bridge",
  covers: "a window asked for longer than the transport's cap is open until the cap, and window_closed carries the device that joined in it and the cap as its windowMs; join_close closes a window at once, the coordinator told, with window_closed carrying its effective windowMs and no device",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const cap = constantMs("bridge", "zigbee-join-window-cap");
  await describe(ctx, "lamp", LAMP);
  const tid = windowTransport(ctx);

  // Longer than the cap: open until it, with what joined in it.
  let mark = watch.seen.length;
  const opened = await ask(ctx, "join", { transport: tid, windowMs: cap + 46_000 });
  mustEqual(opened.status, "accepted", "the reply to join");
  await transport.send({ op: "describe", device: "newcomer", entry: LAMP });
  const joined = await eventOf(ctx, "joined", mark);
  ctx.evidence(`joined in the window: ${joined.device}`);
  await ctx.time.advance(cap, { chunkMs: 20_000 });
  const closed = await passUntil(ctx, (s: Seen) => s.topic === `${topics(ctx).base}/event` && s.payload?.type === "window_closed", 1000, mark)
    .catch((err) => {
      throw err instanceof RequirementFailure ? new RequirementFailure(`no window_closed once the cap of ${cap} ms had passed: ${err.message}`) : err;
    });
  ctx.evidence(`window_closed: ${JSON.stringify(closed.payload)}`);
  must(validate("bridge/event.json", closed.payload).length === 0, "the window_closed event is not valid", closed.payload);
  mustEqual([closed.payload.transport, closed.payload.devices, closed.payload.windowMs], [tid, [joined.device], cap],
    "window_closed's transport, devices and windowMs");

  // join_close: at once.
  mark = watch.seen.length;
  const from = transport.received.length;
  mustEqual((await ask(ctx, "join", { transport: tid, windowMs: 60_000 })).status, "accepted", "the reply to the second join");
  const closing = watch.seen.length;
  const reply = await ask(ctx, "join_close", { transport: tid });
  mustEqual(reply.status, "ok", "the reply to join_close");
  const atOnce = await eventOf(ctx, "window_closed", closing);
  mustEqual([atOnce.devices, atOnce.windowMs], [[], 60_000], "window_closed's devices and windowMs after join_close");
  await windowShown(ctx, from, (r) => r.args?.windowMs === 0, "the coordinator was not told to close the window");
  mustEqual(watch.seen.slice(mark).filter((s) => s.topic === `${topics(ctx).base}/event` && s.payload?.type === "window_closed").length, 1,
    "window_closed events after join_close");
});

requirement("GA-BRIDGE-26", {
  seam: "bridge",
  covers: "a join naming a router as near opens the window at that router, as the coordinator shows",
}, async (ctx) => {
  const transport = ctx.transport!;
  await describe(ctx, "router", { ...LAMP, router: true });
  const tid = windowTransport(ctx);
  const from = transport.received.length;
  const opened = await ask(ctx, "join", { transport: tid, windowMs: 30_000, near: "router" });
  mustEqual(opened.status, "accepted", "the reply to a join near a router");
  const shown = await windowShown(ctx, from, (r) => r.args?.windowMs > 0, "the coordinator opened no window");
  ctx.evidence(`the window: ${JSON.stringify(shown)}`);
  mustEqual(shown.device, "router", "where the window opened");
  await ask(ctx, "join_close", { transport: tid });
});

requirement("GA-BRIDGE-27", {
  seam: "bridge",
  covers: "remove with blockRejoin: left, the identifier in status.blocked, its rejoin in a window and its secured rejoin with none open each removed again with blocked_rejoin and no joined; a blocked identifier the bridge still has (its removal waiting for it) associating in a window turned away with blocked_rejoin and left, no joined; remove, unblock and join_close repeated change nothing more; unblock lets it in again; remove with force drops a device that does not answer; a remove of an identifier never had is failed(unknown_device); a blocked identifier's connect is not tested (the bridge has no connect)",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const t = topics(ctx);
  await describe(ctx, "lamp", LAMP);
  await describe(ctx, "plug", LAMP);
  const tid = windowTransport(ctx);
  const isEvent = (type: string) => (s: Seen) => s.topic === `${t.base}/event` && s.payload?.type === type;

  // Removed and blocked.
  let mark = watch.seen.length;
  mustEqual((await ask(ctx, "remove", { device: "lamp", blockRejoin: true })).status, "accepted", "the reply to remove with blockRejoin");
  await eventOf(ctx, "left", mark, (e) => e.device === "lamp");
  const listed = await watch.waitFor(t.status((p) => p.graceful !== true && (p.blocked ?? []).includes("lamp")), oneSecond(ctx), mark)
    .catch(() => {
      throw new RequirementFailure("no status within 1 s of the remove lists lamp in blocked");
    });
  ctx.evidence(`blocked: ${JSON.stringify(listed.payload.blocked)}`);

  // Out of every later window, and, with no window open, removed again on a secured rejoin.
  mark = watch.seen.length;
  mustEqual((await ask(ctx, "join", { transport: tid, windowMs: 60_000 })).status, "accepted", "the reply to join");
  await transport.send({ op: "describe", device: "lamp", entry: LAMP });
  await eventOf(ctx, "blocked_rejoin", mark, (e) => e.identifier === "lamp");
  await ask(ctx, "join_close", { transport: tid });
  const rejoin = watch.seen.length;
  await transport.send({ op: "admit", device: "lamp", how: "securedRejoin" });
  await eventOf(ctx, "blocked_rejoin", rejoin, (e) => e.identifier === "lamp").catch((err) => {
    throw err instanceof RequirementFailure ? new RequirementFailure(`a blocked identifier's secured rejoin, with no window open: ${err.message}`) : err;
  });
  // The bridge handles what the doer tells it in order: once this report is out, both arrivals were handled.
  await transport.send({ op: "report", device: "plug", values: { on: true }, observedAt: new Date(ctx.time.now()).toISOString() });
  await watch.waitFor(t.statusOf("plug", (p) => p.on === true), oneSecond(ctx), mark);
  mustEqual(watch.seen.slice(mark).filter(isEvent("joined")).map((s) => s.payload.device), [], "joined events for a blocked identifier");
  const devices = watch.seen.filter((s) => s.topic === `${t.base}/devices` && s.payload !== null).at(-1)!;
  mustEqual(devices.payload.devices.map((d: { id: string }) => d.id), ["plug"], "devices after the blocked identifier came back");

  // Repeated, nothing more changes.
  mark = watch.seen.length;
  mustEqual((await ask(ctx, "remove", { device: "lamp", blockRejoin: true })).status, "accepted", "the reply to remove repeated");
  await eventOf(ctx, "left", mark, (e) => e.device === "lamp");
  mustEqual((await ask(ctx, "join_close", { transport: tid })).status, "ok", "the reply to join_close with no window open");
  for (const n of [1, 2]) mustEqual((await ask(ctx, "unblock", { identifier: "lamp" })).status, "ok", `the reply to unblock ${n}`);
  await watch.waitFor(t.status((p) => p.graceful !== true && !(p.blocked ?? []).includes("lamp")), oneSecond(ctx), mark).catch(() => {
    throw new RequirementFailure("no status within 1 s of the unblock leaves lamp out of blocked");
  });
  mustEqual(watch.seen.slice(mark).filter(isEvent("window_closed")).length, 0, "window_closed events with no window open");

  // Unblocked, it comes in again: a new device.
  mark = watch.seen.length;
  await transport.send({ op: "admit", device: "lamp", how: "association" });
  const back = await eventOf(ctx, "joined", mark);
  must(back.device !== "lamp", "the unblocked identifier came back under its old id", back);

  // force drops a device that does not answer.
  mark = watch.seen.length;
  await transport.send({ op: "silence", device: "plug", silent: true });
  mustEqual((await ask(ctx, "remove", { device: "plug", blockRejoin: false, force: true })).status, "accepted", "the reply to remove with force");
  await eventOf(ctx, "left", mark, (e) => e.device === "plug");

  // Blocked while its removal waits for it, it associates in a window: turned away, never admitted.
  await describe(ctx, "porch", LAMP);
  await transport.send({ op: "silence", device: "porch", silent: true });
  mark = watch.seen.length;
  mustEqual((await ask(ctx, "remove", { device: "porch", blockRejoin: true })).status, "accepted", "the reply to remove of a silent device");
  mustEqual((await ask(ctx, "join", { transport: tid, windowMs: 60_000 })).status, "accepted", "the reply to the join for porch");
  await transport.send({ op: "admit", device: "porch", how: "association" });
  await eventOf(ctx, "blocked_rejoin", mark, (e) => e.identifier === "porch").catch((err) => {
    throw err instanceof RequirementFailure ? new RequirementFailure(`a blocked identifier's association in a window: ${err.message}`) : err;
  });
  await eventOf(ctx, "left", mark, (e) => e.device === "porch");
  await ask(ctx, "join_close", { transport: tid });
  mustEqual(watch.seen.slice(mark).filter(isEvent("joined")).map((s) => s.payload.device), [], "joined events for a blocked identifier associating in a window");

  // An identifier the bridge never had.
  const never = await ask(ctx, "remove", { identifier: "never-had", blockRejoin: false });
  mustEqual([never.status, never.reason], ["failed", "unknown_device"], "the reply to a remove of an identifier never had");
});

requirement("GA-BRIDGE-28", {
  seam: "bridge",
  covers: "commission on a Zigbee transport, which has no setup codes, is invalid_request; join on a transport with no join window is not tested (the bridge has none)",
}, async (ctx) => {
  await describe(ctx, "lamp", LAMP);
  const tid = windowTransport(ctx);
  const reply = await ask(ctx, "commission", { transport: tid, code: "34970112332" });
  ctx.evidence(`the reply: ${JSON.stringify(reply)}`);
  mustEqual(reply.status, "invalid_request", "the reply to commission on a Zigbee transport");
  must(!ctx.applier!.events().some((e) => e.type === "commissioned" || e.type === "commission_failed"), "a commission event followed");
});

requirement("GA-BRIDGE-29", {
  seam: "bridge",
  covers: "not tested: no transport the harness scripts has setup codes",
}, async (ctx) => {
  await describe(ctx, "lamp", LAMP);
  if (!transportsOf(ctx).some((x) => x.kind === "matter")) {
    throw new OpUnsupported("commission", "the bridge has no transport with setup codes, so it commissions nothing to refuse");
  }
  throw new OpUnsupported("commission", "the harness scripts no Matter attestation");
});

requirement("GA-BRIDGE-40", {
  seam: "bridge",
  covers: "a bridge whose type ships no manifest answers connect invalid_request; a bridge with a manifest is not tested",
}, async (ctx) => {
  await describe(ctx, "lamp", LAMP);
  const last = ctx.watch!.seen.filter(topics(ctx).status((p) => p.graceful !== true)).at(-1)!;
  if (typeof last.payload.bridgeType === "string") {
    throw new OpUnsupported("connect", "the bridge ships a manifest; its connect is graded with a finder, which this run has not");
  }
  const reply = await ask(ctx, "connect", { address: "192.0.2.7", keys: ["mac:02:00:00:00:00:07"] });
  mustEqual(reply.status, "invalid_request", "the reply to connect from a bridge with no manifest");
  must(!ctx.applier!.events().some((e) => e.type === "connected" || e.type === "connect_failed"), "a connect event followed");
});
