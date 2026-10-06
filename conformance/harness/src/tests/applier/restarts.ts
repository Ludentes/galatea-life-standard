import { randomUUID } from "node:crypto";
import { must, mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { requirement } from "../../registry.js";
import { McpSeam } from "../../seams/mcp.js";
import { pollUntil } from "../../util.js";
import { client, DIMMER, eventsOf, LAMP, oneSecond, ownerConfigure } from "../util.js";

// Slice 7a: what a restart keeps (applier, *Restarts*), graded across a real restart of the subject.

type Outcome = { step_id: string; outcome: string; reason?: string };
const ask = (target: string, action = "onoff.turn_on") => ({ target, action, args: {}, via: "app", brain: false, for: { person: "demo" } });
const short = (o: Outcome | undefined) => (o ? `${o.outcome}${o.reason ? `(${o.reason})` : ""}` : "none");

async function configured(ctx: TestContext, changes: unknown[], why: string): Promise<void> {
  const r = await ownerConfigure(ctx.owner!, changes);
  must(r.ok, `${why} returned ${r.ok ? "" : `${r.error}: ${r.message}`}`, r.body);
}

/** What `describe` says of each device that a restart must keep: its id, class, adoption, identifiers and tiers. */
async function kept(ctx: TestContext): Promise<unknown[]> {
  const d = await ctx.owner!.callOk("describe");
  return (d.devices as Record<string, any>[]).map((x) => [x.id, x.class, x.adopted, x.stable_identifier, x.previous_identifiers,
    (x.actions as { action: string; tier: string }[]).map((a) => [a.action, a.tier])]).sort();
}

requirement("GA-PERSIST-1", {
  seam: "applier", fixture: { devices: ["lamp", "dimmer"] }, timeoutMs: 120_000,
  covers: "across a clean restart: a client registered, a tier the owner raised, a replacement's id map, its retired identifier and adoption (describe's devices the same, a second client's credential still answered, a replacement naming the retired identifier still refused); a held apply's outcomes; a step waiting for its ack ends failed(no_ack) at its bound kept across the restart, and a matching report then is its late_ack; a plan made before the restart, applied after it, is applied or unknown_plan (plans need not survive), no other error. Assumed states, tokens and keys are graded under GA-APPLY-16, GA-TOKEN-4 and GA-APPLY-4; the Safe items under their Safe ids; ignored_keys and connections are graded under GA-DISC-3 and GA-DISC-2, a provision's record under GA-PROV-3, a connect in flight under GA-DISC-4; the PC items with the PC build",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  // The configuration: a second client, a raised tier, a bound for the dimmer's turn_on.
  const other = randomUUID();
  await configured(ctx, [client("persist-1", other),
    { op: "upsert", kind: "tier", value: { device: DIMMER, action: "onoff.turn_off", tier: "confirm" } },
    { op: "upsert", kind: "ack_within_s", value: { device: DIMMER, action: "onoff.turn_on", ack_within_s: 30 } }], "the configuration");
  // The id map: new hardware replaces the lamp, which keeps its id; the old hardware takes a minted one.
  await bridge.control({ requestId: "persist-1-join", op: "join", device: "bulb", capabilities: ["onoff"], feedback: "closed" });
  await pollUntil(async () => ((await ctx.owner!.callOk("describe")).devices as { id: string }[]).some((x) => x.id === "sim-bridge:bulb"),
    oneSecond(ctx), "the new bulb in describe");
  await configured(ctx, [{ op: "upsert", kind: "adopt", value: { device: "sim-bridge:bulb", class: "light", replaces: LAMP } }], "the replacement");
  const minted = await pollUntil(async () => ((await ctx.owner!.callOk("describe")).devices as { id: string }[])
    .find((x) => x.id.startsWith(`${LAMP}/`))?.id, oneSecond(ctx), "the old lamp's hardware under a minted id");
  const refusal = { op: "upsert", kind: "adopt", value: { device: minted, class: "light", replaces: LAMP } };
  const r0 = await ownerConfigure(ctx.owner!, [refusal]);
  must(!r0.ok && r0.error === "invalid_request", "a replacement naming the retired identifier refused before the restart", r0.body);

  // A step waiting for its ack across the restart, and a plan.
  await bridge.control({ requestId: "persist-1-none", op: "commandResult", device: "dimmer", result: "none" });
  const r = await ctx.mcp!.callOk("apply", { idempotency_key: randomUUID(), request: { actions: [ask(DIMMER)] } });
  const due = ctx.time.now() + 30_000;
  const plan = await ctx.mcp!.callOk("plan", { actions: [ask(LAMP)] });
  const before = await kept(ctx);

  await ctx.restartApplier!();

  mustEqual(JSON.stringify(await kept(ctx)), JSON.stringify(before), "describe's devices after the restart");
  const second = await McpSeam.connect(ctx.mcpUrl!, other);
  try {
    must((await second.call("describe")).ok, "the second client's credential answered after the restart");
  } finally {
    await second.close();
  }
  const r1 = await ownerConfigure(ctx.owner!, [refusal]);
  must(!r1.ok && r1.error === "invalid_request", `a replacement naming the retired identifier after the restart returned ${r1.ok ? "a result" : r1.error}`, r1.body);
  const late = await ctx.mcp!.call("apply", { plan_id: plan.plan_id, idempotency_key: randomUUID() });
  // "Plans need not survive; applying one that did not is unknown_plan": a plan kept may be applied.
  ctx.evidence(`a plan made before the restart: ${late.ok ? "applied" : late.error}`);
  must(late.ok || late.error === "unknown_plan", `a plan made before the restart returned ${late.ok ? "a result" : late.error}, `
    + "neither an apply nor unknown_plan", late.body);
  const held = (await ctx.mcp!.callOk("outcome", { apply_id: r.apply_id })).outcomes as Outcome[];
  ctx.evidence(`after the restart: ${short(held[0])}, the bound ${due - ctx.time.now()} ms ahead`);
  must(due - ctx.time.now() < oneSecond(ctx) || held[0]?.outcome === "dispatched", "the step still waiting before its bound", held);

  const { cursor } = await ctx.mcp!.callOk("events");
  await ctx.time.advance(Math.max(0, due - ctx.time.now()), { chunkMs: 2000 });
  await pollUntil(async () => short(((await ctx.mcp!.callOk("outcome", { apply_id: r.apply_id })).outcomes as Outcome[])[0]) === "failed(no_ack)",
    oneSecond(ctx), "failed(no_ack) within 1 s after the bound kept across the restart");
  await bridge.control({ requestId: "persist-1-late", op: "report", device: "dimmer", values: { on: true }, observedAt: new Date(ctx.time.now()).toISOString() });
  const lateAck = await pollUntil(async () => (await eventsOf(ctx.mcp!, cursor, "late_ack")).find((e) => e.apply_id === r.apply_id),
    oneSecond(ctx), "the dimmer's report a late_ack of the step");
  ctx.evidence(`late_ack: ${JSON.stringify(lateAck)}`);
});
