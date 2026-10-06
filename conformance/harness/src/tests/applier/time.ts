import { randomUUID } from "node:crypto";
import { must, mustEqual, mustWithin } from "../../assert.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import { McpSeam, type McpResult } from "../../seams/mcp.js";
import { sleep } from "../../util.js";
import { client, HOUR, LAMP, ownerConfigure, turnOn } from "../util.js";

requirement("GA-HARN-1", {
  seam: "applier", covers: "after a step of an hour, a plan's expires_at is the source's time plus the plan expiry",
}, async (ctx) => {
  await ctx.time.stepAndWait(HOUR);
  const plan = await ctx.mcp!.callOk("plan", { actions: [turnOn(LAMP)] });
  ctx.evidence(`expires_at ${plan.expires_at}, source ${new Date(ctx.time.now()).toISOString()}`);
  mustWithin(Date.parse(plan.expires_at), ctx.time.now() + constantMs("applier", "plan-expiry"), 1000 + ctx.allowanceMs, "expires_at");
});

requirement("GA-APPLY-2", {
  seam: "applier",
  covers: "applying another client's plan is plan_not_yours, one made before a model change stale_revision, an expired one plan_expired; nothing is dispatched",
}, async (ctx) => {
  const { mcp, owner } = { mcp: ctx.mcp!, owner: ctx.owner! };
  const applyPlan = (seam: McpSeam, plan_id: string) => seam.call("apply", { plan_id, idempotency_key: `apply-2-${randomUUID()}` });
  const refused = (r: McpResult, want: string, why: string) =>
    must(!r.ok && r.error === want, `apply of ${why} returned ${r.ok ? "a result" : r.error}, not ${want}`, r.body);

  const credential = randomUUID();
  const added = await ownerConfigure(owner, [client("another-steward", credential)]);
  must(added.ok, `registering a second client returned ${added.ok ? "" : added.error}`, added.body);
  const other = await McpSeam.connect(ctx.mcpUrl!, credential);
  try {
    const mine = await mcp.callOk("plan", { actions: [turnOn(LAMP)] });
    refused(await applyPlan(other, mine.plan_id), "plan_not_yours", "another client's plan");
  } finally {
    await other.close();
  }
  const before = await mcp.callOk("plan", { actions: [turnOn(LAMP)] });
  const moved = await ownerConfigure(owner, [client("a-third-steward", randomUUID())]);
  must(moved.ok, `registering a third client returned ${moved.ok ? "" : moved.error}`, moved.body);
  refused(await applyPlan(mcp, before.plan_id), "stale_revision", "a plan made before a model change");
  const plan = await mcp.callOk("plan", { actions: [turnOn(LAMP)] });
  await ctx.time.stepAndWait(constantMs("applier", "plan-expiry") + 1000);
  refused(await applyPlan(mcp, plan.plan_id), "plan_expired", "an expired plan");
  await sleep(1000 + ctx.allowanceMs);
  mustEqual(ctx.bridge!.received.length, 0, "commands the bridge received");
});
