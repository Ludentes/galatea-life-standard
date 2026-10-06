import { randomUUID } from "node:crypto";
import { must, mustEqual } from "../../assert.js";
import { requirement } from "../../registry.js";
import { pollUntil } from "../../util.js";
import { client, EMPTY_HOME, mustBeNotPermitted, oneSecond, ownerConfigure } from "../util.js";

requirement("GA-CFG-1", {
  seam: "applier", fixture: EMPTY_HOME,
  covers: "a registered client's configure is not_permitted and changes nothing; the owner's is taken",
}, async (ctx) => {
  const before = (await ctx.owner!.callOk("describe")).revision;
  const credential = randomUUID();
  const r = await ctx.mcp!.call("configure", { changes: [client("cfg-1", credential)], expected_revision: before, dry_run: false });
  must(!r.ok && r.error === "not_permitted", `a client's configure returned ${r.ok ? "a result" : r.error}`, r.body);
  mustEqual((await ctx.owner!.callOk("describe")).revision, before, "revision after the refused configure");
  await mustBeNotPermitted(ctx.mcpUrl!, credential, "the client a refused configure named");
  const ok = await ownerConfigure(ctx.owner!, [client("cfg-1", credential)]);
  must(ok.ok, `the owner's configure returned ${ok.ok ? "" : ok.error}`, ok.body);
});

requirement("GA-CFG-2", {
  seam: "applier", fixture: { ...EMPTY_HOME, finder: true },
  covers: "dry_run changes nothing; a stale expected_revision is stale_revision; a change set with one bad change is invalid_request "
    + "and applies none of it; a change set of only ignores, at a stale expected_revision and with none, is applied; any other change "
    + "without one is invalid_request",
}, async (ctx) => {
  const owner = ctx.owner!;
  const url = ctx.mcpUrl!;
  const before = (await owner.callOk("describe")).revision;

  const dry = randomUUID();
  const d = await ownerConfigure(owner, [client("cfg-2-dry", dry)], { dry_run: true });
  must(d.ok, `a dry run returned ${d.ok ? "" : d.error}`, d.body);
  mustEqual((await owner.callOk("describe")).revision, before, "revision after a dry run");
  await mustBeNotPermitted(url, dry, "the client a dry run named");

  const stale = randomUUID();
  const s = await ownerConfigure(owner, [client("cfg-2-stale", stale)], { expected_revision: before - 1 });
  must(!s.ok && s.error === "stale_revision", `a stale configure returned ${s.ok ? "a result" : s.error}`, s.body);
  await mustBeNotPermitted(url, stale, "the client a stale configure named");

  const whole = randomUUID();
  // No kind the standard lists (*configure*), so a request the applier cannot act on at all, and of
  // the standard's error codes (*Operations*) only `invalid_request` names that.
  const w = await ownerConfigure(owner, [client("cfg-2-whole", whole), { op: "upsert", kind: "no-such-kind", value: {} }]);
  must(!w.ok && w.error === "invalid_request", `a change set with an unknown kind returned ${w.ok ? "a result" : w.error}`, w.body);
  mustEqual((await owner.callOk("describe")).revision, before, "revision after a refused change set");
  await mustBeNotPermitted(url, whole, "the good change of a refused change set");

  // The ignores' exemption (applier, *Discovery*).
  const f = ctx.finder!;
  await f.setCandidates([{ keys: ["mac:D4A651000050"], sources: ["dhcp"], address: { ip: "192.0.2.50" }, matches: [] }]);
  const id = f.candidateId("mac:D4A651000050");
  await pollUntil(async () => ((await owner.callOk("candidates")).candidates as { id: string }[]).some((c) => c.id === id) || undefined,
    oneSecond(ctx) * 3, "the candidate listed");
  const ignore = [{ op: "upsert", kind: "ignore_candidate", value: { id } }];
  const st = await owner.call("configure", { changes: ignore, expected_revision: before - 1, dry_run: false });
  must(st.ok, `an ignore-only set at a stale expected_revision returned ${st.ok ? "" : st.error}`, st.body);
  const none = await owner.call("configure", { changes: [{ op: "upsert", kind: "unignore_candidate", value: { key: "mac:D4A651000050" } }],
    dry_run: false });
  must(none.ok, `an ignore-only set with no expected_revision returned ${none.ok ? "" : none.error}`, none.body);
  const other = await owner.call("configure", { changes: [client("cfg-2-x", randomUUID())], dry_run: false });
  mustEqual(other.ok ? "ok" : other.error, "invalid_request", "another change with no expected_revision");
});

requirement("GA-LVL-1", {
  seam: "applier", fixture: EMPTY_HOME,
  covers: "a Safe configure change (a safety rule) on an applier that does not claim Safe is not_claimed; a subject claiming Safe over bridges is probed with its box cleared, when Safe is not in its levels (GA-DESC-6)",
}, async (ctx) => {
  const safe = ctx.claims.includes("Safe");
  if (safe) {
    const r = await ownerConfigure(ctx.owner!, [{ op: "upsert", kind: "box", value: false }]);
    must(r.ok, `clearing box returned ${r.ok ? "" : r.error}`, r.body);
    const levels = (await ctx.owner!.callOk("describe")).levels as string[];
    ctx.evidence(`with box cleared, levels ${JSON.stringify(levels)}`);
    must(!levels.includes("Safe"), "Safe not claimed with box cleared", levels);
  }
  const before = (await ctx.owner!.callOk("describe")).revision;
  const r = await ownerConfigure(ctx.owner!, [{ op: "upsert", kind: "safety_rule", value: { id: "lvl-1" } }]);
  must(!r.ok && r.error === "not_claimed", `a safety rule on an applier not claiming Safe returned ${r.ok ? "a result" : r.error}`, r.body);
  mustEqual((await ctx.owner!.callOk("describe")).revision, before, "revision after the refused change");
  if (safe) {
    const back = await ownerConfigure(ctx.owner!, [{ op: "upsert", kind: "box", value: true }]);
    must(back.ok, `setting box again returned ${back.ok ? "" : back.error}`, back.body);
  }
});

requirement("GA-DESC-2", {
  seam: "applier", fixture: EMPTY_HOME,
  covers: "registering a client, a model change, moves revision",
}, async (ctx) => {
  const before = (await ctx.mcp!.callOk("describe")).revision;
  const r = await ownerConfigure(ctx.owner!, [client("desc-2", randomUUID())]);
  must(r.ok, `configure returned ${r.ok ? "" : r.error}`, r.body);
  const after = (await ctx.mcp!.callOk("describe")).revision;
  ctx.evidence(`revision ${before} → ${after}`);
  must(after !== before, `revision stayed ${before} across a client's registration`);
});
