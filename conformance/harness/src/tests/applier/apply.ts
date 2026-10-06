import { must, mustEqual } from "../../assert.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import { sleep } from "../../util.js";
import { sign } from "../token.js";
import { DIMMER, LAMP, outcomeSeen, turnOn } from "../util.js";

requirement("GA-APPLY-4", {
  seam: "applier",
  covers: "the same key and body from one client returns the first apply and actuates once; a retry carrying a freshly issued token is the same body, and actuates once; and across a clean restart the same key and body still return the first apply and actuate nothing",
}, async (ctx) => {
  const mcp = ctx.mcp!;
  const body = { request: { actions: [turnOn(LAMP)] }, idempotency_key: `apply-4-${ctx.runId}` };
  const first = await mcp.callOk("apply", body);
  const again = await mcp.callOk("apply", body);
  mustEqual(again.apply_id, first.apply_id, "the repeat's apply_id");

  const level = { target: DIMMER, action: "level.set_level", args: { level: 40 }, via: "app", brain: false, for: { person: "demo" } };
  const key = `apply-4-token-${ctx.runId}`;
  const withToken = await mcp.callOk("apply", { idempotency_key: key, request: { actions: [{ ...level, token: sign(ctx, level) }] } });
  const retried = await mcp.callOk("apply", { idempotency_key: key, request: { actions: [{ ...level, token: sign(ctx, level) }] } });
  mustEqual(retried.apply_id, withToken.apply_id, "the apply_id of a retry carrying a fresh token");
  await sleep(1000 + ctx.allowanceMs);
  const actuations = ctx.bridge!.received.filter((x) => x.device === "lamp" || x.device === "dimmer");
  ctx.evidence(`received ${JSON.stringify(actuations)}`);
  mustEqual(actuations.map((x) => x.device), ["lamp", "dimmer"], "physical actuations of the lamp and the dimmer");

  await ctx.restartApplier!();
  const afterRestart = await ctx.mcp!.callOk("apply", body);
  mustEqual(afterRestart.apply_id, first.apply_id, "the repeat's apply_id after a restart");
  await sleep(1000 + ctx.allowanceMs);
  const all = ctx.bridge!.received.filter((x) => x.device === "lamp" || x.device === "dimmer");
  mustEqual(all.map((x) => x.device), ["lamp", "dimmer"], "physical actuations of the lamp and the dimmer, the restart included");
});

requirement("GA-APPLY-10", {
  seam: "applier", covers: "a key used again by the same client for another target is idempotency_conflict, and only the first apply actuates",
}, async (ctx) => {
  const mcp = ctx.mcp!;
  const key = `apply-10-${ctx.runId}`;
  await mcp.callOk("apply", { idempotency_key: key, request: { actions: [turnOn(LAMP)] } });
  const r = await mcp.call("apply", { idempotency_key: key, request: { actions: [turnOn(DIMMER)] } });
  must(!r.ok && r.error === "idempotency_conflict", `the same key with another body returned ${r.ok ? "a result" : r.error}, not idempotency_conflict`, r.body);
  await sleep(1000 + ctx.allowanceMs);
  const actuations = ctx.bridge!.received.filter((x) => x.device === "lamp" || x.device === "dimmer");
  ctx.evidence(`received ${JSON.stringify(actuations)}`);
  mustEqual(actuations.map((x) => x.device), ["lamp"], "physical actuations of the lamp and the dimmer");
});

requirement("GA-EVT-3", {
  seam: "applier", fixture: { devices: ["lamp", "pusher"] },
  covers: "acked only after the reported state matches, for onoff, and for a button pusher's extension action on its confirmed_by key, each with the report 2 s after the ack. session.lock's is the PC build's",
}, async (ctx) => {
  const mcp = ctx.mcp!;
  const bridge = ctx.bridge!;
  await bridge.control({ requestId: "evt-3", op: "commandResult", device: "lamp", result: "confirmed", afterMs: 0, reportAfterMs: 2000 });
  const { apply_id } = await mcp.callOk("apply", { request: { actions: [turnOn(LAMP)] }, idempotency_key: `evt-3-${ctx.runId}` });
  const ackedAt = await outcomeSeen(mcp, apply_id, "acked", constantMs("applier", "ack-bound-defaults"));
  const report = bridge.published.find((p) => p.topic.endsWith("/devices/lamp/status") && (p.payload as { on?: boolean }).on === true);
  must(report, "the lamp reported on");
  ctx.evidence(`reported on at +0 ms, acked seen at ${ackedAt - report.realAt} ms`);
  must(ackedAt >= report.realAt, `acked before the lamp reported: seen ${report.realAt - ackedAt} ms early`);

  const MODE = "org.galatea.test.pusher.mode";
  await bridge.control({ requestId: "evt-3-pusher", op: "commandResult", device: "pusher", result: "confirmed", afterMs: 0, reportAfterMs: 2000 });
  const asked = { target: "sim-bridge:pusher", action: "org.galatea.test.pusher.set_mode", args: { mode: "click" }, via: "app", brain: false,
    for: { person: "demo" } };
  const set = await mcp.callOk("apply", { request: { actions: [{ ...asked, token: sign(ctx, asked) }] }, idempotency_key: `evt-3-pusher-${ctx.runId}` });
  const setAt = await outcomeSeen(mcp, set.apply_id, "acked", constantMs("applier", "ack-bound-defaults"));
  const mode = bridge.published.find((p) => p.topic.endsWith("/devices/pusher/status") && (p.payload as Record<string, unknown>)[MODE] === "click");
  must(mode, "the pusher reported its mode click");
  ctx.evidence(`the pusher reported click at +0 ms, acked seen at ${setAt - mode.realAt} ms`);
  must(setAt >= mode.realAt, `set_mode acked before the pusher reported its mode: seen ${mode.realAt - setAt} ms early`);
});
