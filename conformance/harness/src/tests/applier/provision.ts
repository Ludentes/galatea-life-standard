import { must, mustEqual } from "../../assert.js";
import { requirement } from "../../registry.js";
import { pollUntil } from "../../util.js";
import { oneSecond } from "../util.js";

// Slice 5a: provisioning (applier, *Provisioning*). install and uninstall are the PC build's (the maintainer, 2026-10-05).

/** A result with its keys sorted at every depth: a record read back from a store may come in another order. */
const sorted = (v: unknown): unknown => Array.isArray(v) ? v.map(sorted)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sorted(x)])) : v;
const PROVISION = { devices: ["lamp", "dimmer"], bridge: { levels: ["Serve", "Provision"] } };

requirement("GA-PROV-1", {
  seam: "applier", fixture: PROVISION,
  covers: "provision is the owner's configuration credential's only; join is passed to the bridge that owns the transport, in "
    + "its ids, and returns its reply; no reply within 2 s is unreachable, within 2 s and the broker's allowance; a bridge whose "
    + "status does not claim Provision is not_claimed. The fixture has one bridge, so a request sent to every bridge passes as "
    + "routed to its owner. A request_id is not graded: the text promises one only for connect. connect's named bridge: under "
    + "GA-DISC-4; the Host clause (install, uninstall) and an adapter's not_claimed are the PC build's and the adapters'",
}, async (ctx) => {
  const { owner, mcp, bridge } = { owner: ctx.owner!, mcp: ctx.mcp!, bridge: ctx.bridge! };
  const join = { join: { transport: "sim-bridge:test", window_s: 30 } };
  const refused = await mcp.call("provision", join);
  mustEqual(refused.ok ? "ok" : refused.error, "not_permitted", "a client's provision");
  const mark = bridge.requests.length;
  const r = await owner.callOk("provision", join);
  const sent = bridge.requests.slice(mark).filter((x) => x.op === "join");
  mustEqual(sent.length, 1, "join requests the bridge received");
  const req = sent[0]!.body as Record<string, unknown>;
  mustEqual([req.transport, req.windowMs, r.status], ["test", 30_000, "accepted"], "the request and its reply");
  await owner.callOk("provision", { join_close: { transport: "sim-bridge:test" } });
  bridge.holdRequests(true);
  const t0 = Date.now();
  const held = await owner.callOk("provision", { unblock: { identifier: "test:gone", bridge: "sim-bridge" } });
  const elapsed = Date.now() - t0;
  bridge.holdRequests(false);
  mustEqual(held.status, "unreachable", "a request the bridge never answered");
  must(bridge.requests.some((x) => x.op === "unblock"), "the unanswered unblock reached the bridge", held);
  must(elapsed <= 2000 + oneSecond(ctx), `no reply within 2 s is unreachable within 2 s and the broker's allowance; it took ${elapsed} ms`);
  ctx.evidence(`unreachable after ${elapsed} ms`);
  await bridge.setLevels(["Serve"]);
  await pollUntil(async () => {
    const x = await owner.call("provision", { join_close: { transport: "sim-bridge:test" } });
    return !x.ok && x.error === "not_claimed" ? true : undefined;
  }, oneSecond(ctx) * 3, "join_close to a bridge whose status no longer claims Provision is not_claimed");
});

requirement("GA-PROV-2", {
  seam: "applier", fixture: PROVISION,
  covers: "a window the owner opened, a device joined in it, closed by join_close: a notice with cause window_closed naming the "
    + "device by its applier id, still listed until taken. A window in which nothing joined is the reference's K4, not graded",
}, async (ctx) => {
  const { owner, bridge } = { owner: ctx.owner!, bridge: ctx.bridge! };
  await owner.callOk("provision", { join: { transport: "sim-bridge:test", window_s: 60 } });
  await bridge.control({ requestId: "prov-2-join", op: "join", device: "kettle", capabilities: ["onoff"], feedback: "closed" });
  await owner.callOk("provision", { join_close: { transport: "sim-bridge:test" } });
  const notices = async () => ((await owner.callOk("events")).notices as { cause: string; devices?: string[] }[])
    .filter((n) => n.cause === "window_closed");
  const n = await pollUntil(async () => (await notices()).find((x) => x.devices?.includes("sim-bridge:kettle")),
    oneSecond(ctx), "a window_closed notice naming sim-bridge:kettle");
  ctx.evidence(`notice: ${JSON.stringify(n)}`);
  must((await notices()).some((x) => x.devices?.includes("sim-bridge:kettle")), "the notice still listed before it is taken");
});

requirement("GA-PROV-3", {
  seam: "applier", fixture: PROVISION, timeoutMs: 120_000,
  covers: "a keyed remove whose reply is dropped is unreachable, and its repeat after the bridge's 10 s window is answered from "
    + "the record with the same request_id, the bridge receiving one remove; a key answered ok, repeated after the bridge stops "
    + "claiming Provision, is still answered from its record, nothing sent; another body under a held key is "
    + "idempotency_conflict, nothing sent; across a clean restart and a crash, each repeat still answered from its record, "
    + "nothing sent. An install's record (provisions-twice's own subject) is the PC build's",
}, async (ctx) => {
  const { owner, bridge } = { owner: ctx.owner!, bridge: ctx.bridge! };
  const removes = () => bridge.requests.filter((x) => x.op === "remove").length;
  const dropped = { remove: { device: "sim-bridge:dimmer", block_rejoin: false }, idempotency_key: "prov-3-a" };
  bridge.dropReply("remove");
  const first = await owner.callOk("provision", dropped);
  mustEqual(first.status, "unreachable", "a keyed remove whose reply was dropped");
  await ctx.time.advance(11_000, { chunkMs: 5000 });
  const again = await owner.callOk("provision", dropped);
  mustEqual([again.request_id, again.status], [first.request_id, "unreachable"], "the repeat, from the record");
  mustEqual(removes(), 1, "removes the bridge received");
  const kept = { unblock: { identifier: "test:gone", bridge: "sim-bridge" }, idempotency_key: "prov-3-b" };
  const ok = await owner.callOk("provision", kept);
  mustEqual(ok.status, "ok", "the unblock's reply");
  await bridge.setLevels(["Serve"]);
  // The status that drops Provision has landed once an unkeyed request is refused for it.
  await pollUntil(async () => {
    const x = await owner.call("provision", { join_close: { transport: "sim-bridge:test" } });
    return !x.ok && x.error === "not_claimed" ? true : undefined;
  }, oneSecond(ctx) * 3, "join_close to a bridge whose status no longer claims Provision is not_claimed");
  mustEqual(sorted(await owner.callOk("provision", kept)), sorted(ok), "the repeat after the bridge dropped Provision, from the record");
  const other = await owner.call("provision", { ...kept, unblock: { identifier: "test:other", bridge: "sim-bridge" } });
  mustEqual(other.ok ? "ok" : other.error, "idempotency_conflict", "another body under a held key");
  mustEqual(bridge.requests.filter((x) => x.op === "unblock").length, 1, "unblocks the bridge received");
  // The record committed before its publish, so a crash keeps it as a clean restart does. The dimmer
  // left its bridge with the remove, so the restart does not wait for it to be live.
  for (const crash of [false, true]) {
    const sent = bridge.requests.length;
    await ctx.restartApplier!({ crash, dead: ["dimmer"] });
    mustEqual(sorted(await ctx.owner!.callOk("provision", kept)), sorted(ok), `the repeat after a ${crash ? "crash" : "clean restart"}, from the record`);
    mustEqual(sorted(await ctx.owner!.callOk("provision", dropped)), sorted(again), `the unreachable repeat after a ${crash ? "crash" : "clean restart"}`);
    mustEqual(bridge.requests.slice(sent).filter((x) => x.op === "unblock" || x.op === "remove").length, 0,
      "requests the bridge received after the restart");
  }
});
