import { mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import { LAMP } from "../../steward-home.js";
import { pollUntil } from "../../util.js";
import { answer, applyPlan, mustAccept, outcomes, planned, sentFrom } from "./answers.js";
import { act, occupancyBecomes, ownerOf, revisionOf, rooms, stepsAt } from "./util.js";

/** Waits until the steward has followed a model change the stand-in made, by the house's revision. */
async function followed(ctx: TestContext, before: number, what: string): Promise<void> {
  await pollUntil(async () => (await revisionOf(ctx)) > before, 10_000, `the steward did not follow ${what}`, 100);
}

const RESPECT = { respect_occupancy: true };

requirement("GA-OCC-1", {
  seam: "steward",
  covers: "with respect_occupancy: the hall (a presence sensor live for less than the hold) unknown, ask(occupancy_unknown); live for the hold with no presence, vacant, an op; presence now, skip(occupied); presence within the hold, unknown again; the kitchen with only a motion sensor unknown, and occupied, skip(occupied), on motion within the hold; a lamp in no room unknown; the sensor stale, unknown; the sensor's configured fresh_s longer than the hold less its slack, unknown though live for the hold; without the flag, the occupied hall's lamp an op; state shows each room's occupancy",
}, async (ctx) => {
  const s = ctx.steward!;
  const applier = ctx.standIn!.applier;
  const hold = constantMs("steward", "occupancy-hold-default");
  const { presence, motion, dimmer, roomless } = await rooms(ctx);
  const steps = async (what: string, actions: unknown[], want: string[], o = RESPECT) => {
    const got = await stepsAt(s.olga, "olga-app", actions, o);
    ctx.evidence(`${what}: ${got.join(", ")}`);
    mustEqual(got, want, what);
  };
  await steps("live for less than the hold", [act(LAMP), act(dimmer), act(roomless)],
    [`${LAMP} ask(occupancy_unknown)`, `${dimmer} ask(occupancy_unknown)`, `${roomless} ask(occupancy_unknown)`]);
  await ctx.time.stepAndWait(hold + 1_000);
  await occupancyBecomes(ctx, { hall: "vacant", kitchen: "unknown" }, "live for the hold");
  await steps("the hall vacant, the kitchen with only motion", [act(LAMP), act(dimmer)], [`${LAMP} op`, `${dimmer} ask(occupancy_unknown)`]);
  applier.scriptValue(presence, "occupancy", true);
  applier.scriptValue(motion, "motion", true);
  await occupancyBecomes(ctx, { hall: "occupied", kitchen: "occupied" }, "presence and motion now");
  await steps("presence and motion now", [act(LAMP), act(dimmer)], [`${LAMP} skip(occupied)`, `${dimmer} skip(occupied)`]);
  await steps("without respect_occupancy", [act(LAMP)], [`${LAMP} op`], { respect_occupancy: false });
  applier.scriptValue(presence, "occupancy", false);
  applier.scriptValue(motion, "motion", false);
  await occupancyBecomes(ctx, { hall: "unknown", kitchen: "occupied" }, "presence and motion within the hold");
  await ctx.time.stepAndWait(hold + 1_000);
  await occupancyBecomes(ctx, { hall: "vacant", kitchen: "unknown" }, "a hold later");
  applier.scriptLiveness(presence, "stale");
  await occupancyBecomes(ctx, { hall: "unknown", kitchen: "unknown" }, "the sensor stale");
  applier.scriptLiveness(presence, "live");
  await ctx.time.stepAndWait(hold + 1_000);
  await occupancyBecomes(ctx, { hall: "vacant", kitchen: "unknown" }, "live again for the hold");
  const before = await revisionOf(ctx);
  applier.scriptFresh(presence, Math.ceil(hold / 1000));
  await followed(ctx, before, "the sensor's fresh_s");
  await occupancyBecomes(ctx, { hall: "unknown", kitchen: "unknown" }, "a fresh_s that with its slack passes the hold");
  await steps("the slow sensor", [act(LAMP)], [`${LAMP} ask(occupancy_unknown)`]);
});

requirement("GA-STW-8", {
  seam: "steward",
  covers: "with respect_occupancy, apply judges the room again: a plan made with the hall vacant, applied once presence comes, is skipped(occupied) and the stand-in receives nothing; a step asked occupancy_unknown in the kitchen and answered yes is dispatched while the kitchen stays unknown, the answer kept; the stand-in's own judgement at dispatch passed through (the lamp already on: skipped(already)); leased at dispatch: a plan made with the lamp free, applied once a safety rule has leased it, is refused(leased) and the stand-in receives nothing; a yes to ask(in_use) slice 8's",
}, async (ctx) => {
  const s = ctx.steward!;
  const applier = ctx.standIn!.applier;
  const { presence, dimmer } = await rooms(ctx);
  await ctx.time.stepAndWait(constantMs("steward", "occupancy-hold-default") + 1_000);
  await occupancyBecomes(ctx, { hall: "vacant", kitchen: "unknown" }, "live for the hold");
  const vacant = await planned(s.olga, "olga-app", [act(LAMP)], RESPECT);
  const off = await planned(s.olga, "olga-app", [act(LAMP)], RESPECT);
  const asked = await planned(s.olga, "olga-app", [act(dimmer)], RESPECT);
  mustAccept(ctx, await answer(s.olga, asked.plan_id, "olga-app", { s1: "yes" }), "the yes to the kitchen's occupancy_unknown");
  const sent = sentFrom(ctx);
  const kitchen = outcomes(await applyPlan(s.olga, asked.plan_id), "the kitchen's apply");
  ctx.evidence(`the kitchen still unknown: ${kitchen.join(", ")}`);
  mustEqual(kitchen, [`${dimmer} dispatched`], "a yes to occupancy_unknown applied while the room is unknown");
  applier.scriptValue(LAMP, "on", true, { cause: "device" });
  await pollUntil(async () => ((await ownerOf(ctx).callOk("state")).targets as Record<string, { values?: { key: string; value: unknown }[] }>)[LAMP]
    ?.values?.some((v) => v.key === "on" && v.value === true) || undefined, 10_000, "the steward did not see the lamp on", 100);
  const already = outcomes(await applyPlan(s.olga, off.plan_id), "the apply with the lamp on");
  ctx.evidence(`the lamp on, the hall vacant: ${already.join(", ")}`);
  mustEqual(already, [`${LAMP} skipped(already)`], "the stand-in's own judgement at dispatch");
  applier.scriptValue(presence, "occupancy", true);
  await occupancyBecomes(ctx, { hall: "occupied", kitchen: "unknown" }, "presence in the hall");
  const filled = outcomes(await applyPlan(s.olga, vacant.plan_id), "the apply once the hall filled");
  ctx.evidence(`made vacant, applied occupied: ${filled.join(", ")}`);
  mustEqual(filled, [`${LAMP} skipped(occupied)`], "a plan made vacant, applied occupied");
  mustEqual(sent().map((x) => `${x.target} ${x.action}`), [`${dimmer} onoff.turn_on`, `${LAMP} onoff.turn_on`], "what the stand-in received");
  // Leased at dispatch: a person's apply meets a lease only a safety rule's (a person's is equal, and replaced).
  // The rule configured first: a model change moves the house's revision, which would make the plan stale.
  const unruled = await revisionOf(ctx);
  applier.scriptSafetyRule({ id: "night", actuates: [{ target: LAMP, key: "on", value: true }] });
  await followed(ctx, unruled, "the safety rule's model change");
  const free = await planned(s.olga, "olga-app", [act(LAMP, "onoff.turn_off")]);
  applier.scriptSafetyFire("night", { complete: false });
  await pollUntil(async () => ((await ownerOf(ctx).callOk("state")).leases as Record<string, { precedence: string }>)[LAMP]?.precedence === "safety_rule" || undefined,
    10_000, "the safety rule's lease on the lamp was not seen", 100);
  const leasedSent = sentFrom(ctx);
  const leased = outcomes(await applyPlan(s.olga, free.plan_id), "the apply under the safety rule's lease");
  ctx.evidence(`made free, applied leased: ${leased.join(", ")}`);
  mustEqual(leased, [`${LAMP} refused(leased)`], "a plan made free, applied under a safety rule's lease");
  mustEqual(leasedSent(), [], "what the stand-in received under the safety rule's lease");
});
