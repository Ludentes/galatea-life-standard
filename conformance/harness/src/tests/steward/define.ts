import { must } from "../../assert.js";
import { requirement } from "../../registry.js";
import { LAMP } from "../../steward-home.js";
import { mustAccept, mustBe } from "./answers.js";
import { brainAsks, brainDefine, defineByPlan, ownerChat, ownerSaysYes } from "./brain.js";
import { freshSecret, mustDefine, mustRefuse, ownerDefine, ownerOf, revisionOf, up, voice } from "./util.js";

const attic = up("room", { id: "attic", name: "Чердак" });

requirement("GA-DEF-1", {
  seam: "steward",
  covers: "a dry run of a change set that would add a room returns a diff naming it, and describe is unchanged",
}, async (ctx) => {
  const before = await ownerOf(ctx).callOk("describe");
  const r = await ownerDefine(ctx, [attic], { dry_run: true });
  const after = await ownerOf(ctx).callOk("describe");
  ctx.evidence(`dry run: ${r.ok ? JSON.stringify(r.body) : r.error}`);
  must(r.ok, `define with dry_run returned ${r.ok ? "" : r.error}`, r.body);
  must(typeof r.body.diff === "string" && r.body.diff.includes("attic"), "the dry run's diff does not name the room it would add", r.body);
  must(JSON.stringify(after) === JSON.stringify(before), "define with dry_run changed describe", { before, after });
});

requirement("GA-DEF-2", {
  seam: "steward",
  covers: "define at a revision behind the current one returns stale_revision and changes nothing; the brain's define plan, answered yes, then another define: define { plan_id } returns stale_revision and changes nothing",
}, async (ctx) => {
  const now = await revisionOf(ctx);
  const code = await mustRefuse(ctx, [attic], "a change set at a stale revision", { expected_revision: now - 1 });
  must(code === "stale_revision", `define at a stale revision returned ${code}, not stale_revision`);
  await ownerChat(ctx);
  const plan = await brainAsks(ctx, [attic], "a room");
  mustAccept(ctx, await ownerSaysYes(ctx, plan.plan_id), "the owner's yes");
  await mustDefine(ctx, [up("room", { id: "cellar", name: "Подвал" })], "another room, moving the house on");
  mustBe(ctx, await defineByPlan(ctx, plan.plan_id), "stale_revision", "define { plan_id } of a plan made before another define");
  const d = await ownerOf(ctx).callOk("describe");
  must(!(d.rooms as { id: string }[]).some((x) => x.id === "attic"), "a stale define plan changed the house", d.rooms);
});

requirement("GA-DEF-3", {
  seam: "steward",
  covers: "the owner clause: define is refused not_permitted from a member's app, a guest panel, and a brain naming the owner as its speaker at the kitchen's voice endpoint, whose role cap is member, and accepted from the owner's app; through a brain, at the owner's chat window: a person is refused not_permitted, a room is asked; the front is not tried, since GA-AUTH-8 refuses it define before the owner clause is read (GA-AUTH-8, slice 9)",
}, async (ctx) => {
  const s = ctx.steward!;
  const tries = [
    { who: "a member's app", as: s.olga, endpoint: "olga-app" },
    { who: "a guest panel", as: s.panel, endpoint: "hall-panel" },
    { who: "a brain naming the owner", as: s.brain, endpoint: "kitchen-voice", speaker: "owner" },
  ];
  for (const t of tries) {
    const code = await mustRefuse(ctx, [attic], `a change set from ${t.who}`, t);
    must(code === "not_permitted", `define from ${t.who} returned ${code}, not not_permitted`);
  }
  // Through a brain: the policy the build rules (Q4) takes the owner's role, and never a person.
  await ownerChat(ctx);
  mustBe(ctx, await brainDefine(ctx, [attic, up("person", { id: "liza", name: "Лиза", role: "member" })]), "not_permitted",
    "a person through the brain at the owner's chat window");
  await brainAsks(ctx, [attic], "a room");
  const r = await ownerDefine(ctx, [attic]);
  must(r.ok, `define from the owner's app returned ${r.ok ? "" : r.error}`, r.body);
});

requirement("GA-DEF-5", {
  seam: "steward",
  covers: "a change set whose last change is refused leaves its earlier changes undone; a valid one of two changes applies both",
}, async (ctx) => {
  await mustRefuse(ctx, [attic, up("endpoint", { id: "attic-panel", name: "Панель", type: "panel", room: "nowhere", person: null, served_by: null })],
    "a room and a panel in a room that does not exist");
  const r = await ownerDefine(ctx, [attic, up("endpoint", { id: "attic-panel", name: "Панель", type: "panel", room: "attic", person: null, served_by: null })]);
  must(r.ok, `a valid change set returned ${r.ok ? "" : r.error}`, r.body);
  const d = await ownerOf(ctx).callOk("describe");
  must(d.rooms.some((x: { id: string }) => x.id === "attic") && d.endpoints.some((x: { id: string }) => x.id === "attic-panel"),
    "a change set that was accepted did not apply whole", d);
});

requirement("GA-DEF-8", {
  seam: "steward",
  covers: "each clause, one change set apiece, against the baseline: a voice endpoint without served_by; a panel with a voice record without served_by; an app without a person; heard_by naming no front; a second front; a skill_account on a panel, and on a voice endpoint with a person; two endpoints with one skill_account and skill_surface; an account surfaced on one endpoint and not on another; a panel with a null room; notice_channels naming only a lamp",
}, async (ctx) => {
  const ep = (id: string, extra: Record<string, unknown>) =>
    up("endpoint", { id, name: id, type: "voice", room: "kitchen", person: null, served_by: "brain", ...extra });
  const cases: [string, unknown[]][] = [
    ["a voice endpoint without served_by", [ep("v1", { served_by: null })]],
    ["a panel with a voice record and no served_by", [ep("p1", { type: "panel", served_by: null }), voice("p1")]],
    ["an app endpoint without a person", [ep("a1", { type: "app", room: null, served_by: null })]],
    ["a voice record whose heard_by is no front", [ep("v2", {}), voice("v2", { heard_by: "brain" })]],
    ["voice records naming two fronts", [up("credential", { id: "front2", kind: "front", secret: freshSecret() }), ep("v3", {}), voice("v3", { heard_by: "front2" })]],
    ["a skill_account on a panel", [ep("p2", { type: "panel" }), voice("p2", { skill_account: "acc" })]],
    ["a skill_account on an endpoint with a person", [ep("v4", { person: "olga" }), voice("v4", { skill_account: "acc" })]],
    ["two endpoints with one skill_account and skill_surface", [ep("v5", {}), voice("v5", { skill_account: "acc", skill_surface: "s" }),
      ep("v6", {}), voice("v6", { skill_account: "acc", skill_surface: "s" })]],
    ["one account surfaced on one endpoint and not on another", [ep("v7", {}), voice("v7", { skill_account: "acc", skill_surface: "s" }),
      ep("v8", {}), voice("v8", { skill_account: "acc" })]],
    ["a panel with a null room", [ep("p3", { type: "panel", room: null, served_by: null })]],
    ["notice_channels naming no notify channel", [up("home", { notice_channels: [LAMP] })]],
  ];
  for (const [what, changes] of cases) await mustRefuse(ctx, changes, what);
  // The accepted counterparts: the clauses refuse what they name, not voice endpoints at large.
  const r = await ownerDefine(ctx, [ep("v9", {}), voice("v9", { skill_account: "acc" })]);
  must(r.ok, `a voice endpoint with a skill_account and no person was refused: ${r.ok ? "" : r.error}`, r.body);
});

requirement("GA-CONF-4", {
  seam: "steward",
  covers: "define refuses confirm_on naming a brain-served endpoint, on an endpoint and on a brain credential, and accepts it naming an app",
}, async (ctx) => {
  await mustRefuse(ctx, [up("endpoint", { id: "hall-panel", name: "Панель в холле", type: "panel", room: "hall", person: null,
    served_by: null, confirm_on: "kitchen-voice" })], "an endpoint's confirm_on naming a brain-served endpoint");
  await mustRefuse(ctx, [up("credential", { id: "brain", kind: "brain", secret: ctx.credentials!.brain, confirm_on: "kitchen-voice" })],
    "a brain credential's confirm_on naming a brain-served endpoint");
  const r = await ownerDefine(ctx, [up("endpoint", { id: "hall-panel", name: "Панель в холле", type: "panel", room: "hall", person: null,
    served_by: null, confirm_on: "olga-app" })]);
  must(r.ok, `confirm_on naming an app was refused: ${r.ok ? "" : r.error}`, r.body);
});
