import { must, mustEqual, RequirementFailure } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { requirement } from "../../registry.js";
import { LAMP } from "../../steward-home.js";
import { pollUntil } from "../../util.js";
import { applyInline, outcomes, sentFrom } from "./answers.js";
import { byBrain } from "./brain.js";
import { endedAtRestart, endsAt, expiresBetween, grantsOf, lampOn, restartReadBack, room, Seen, sensorOn, type LeaseEv } from "./hold-helpers.js";
import { cursorNow, eventsAfter } from "./rules.js";
import { scene } from "./scenarios.js";
import { ackWithinOf, act, del, holdEndLatenessMs, iso, leaseEventsSince, leaseOf, MINUTE, mustDefine, ownerOf, pinHold, ROUNDING_MS, scripted, SECOND,
  setFlag, stepTo, stewardSees, targetIn, up, wall, type HoldPolicy } from "./util.js";

const FIELDS = ["on_s", "off_s", "other_s", "fixed_s", "load_cap_s", "cap_s", "presence_renews", "vacant_ends", "schedule_ends",
  "owner_work_passes_guest_holds", "owner_work_passes_holds"];

/** The owner's describe's home.hold. */
const holdNow = async (ctx: TestContext) => (await ownerOf(ctx).callOk("describe")).home?.hold as HoldPolicy | undefined;

requirement("GA-LEASE-8", {
  seam: "steward",
  covers: "describe's home shows hold with every field, each window an integer of 1 or more and `cap_s` one of 0 or more; define of 20 s windows with `cap_s` 0 (no cap), of 1 s windows and of a cap of 1 s is taken and shown; every flag set false is taken and shown, each in a call of its own; a field set to null returns to the steward's own (the one `define` of `hold: null` gives), not the value set before; `schedule_ends` true is taken, or refused with invalid_request whose `data.field` names the flag; a change applies at once, a held hold's expires moving with it",
}, async (ctx) => {
  // The steward's own policy: every field back to it first, so no earlier setting is taken for it.
  await mustDefine(ctx, [up("home", { hold: null })], "the hold policy back to the steward's own");
  const own = await holdNow(ctx);
  must(own !== undefined, "describe's home shows no hold");
  ctx.evidence(`the steward's own hold policy: ${JSON.stringify(own)}`);
  mustEqual(Object.keys(own!).sort(), [...FIELDS].sort(), "the hold policy's fields");
  for (const k of ["on_s", "off_s", "other_s", "fixed_s", "load_cap_s"] as const) must(Number.isInteger(own![k]) && own![k] >= 1, `hold.${k} ${own![k]}`);
  must(Number.isInteger(own!.cap_s) && own!.cap_s >= 0, `hold.cap_s ${own!.cap_s}`);
  for (const k of ["presence_renews", "vacant_ends", "schedule_ends", "owner_work_passes_guest_holds", "owner_work_passes_holds"] as const) {
    must(typeof own![k] === "boolean", `hold.${k} ${own![k]}`);
  }
  // Short windows, no cap, and a cap, each taken and shown, and every flag's false taken and shown, each in a call of its
  // own (pinHold fails unless define takes each and describe shows it).
  await pinHold(ctx, { on_s: 20, off_s: 20, other_s: 20, fixed_s: 20, load_cap_s: 20, cap_s: 0 });
  await pinHold(ctx, { on_s: 1, off_s: 1, other_s: 1, fixed_s: 1, load_cap_s: 1, cap_s: 1 });
  // A field set to null returns to the steward's own, not to the value the owner set before.
  const set = own!.off_s === 700 ? 701 : 700;
  await mustDefine(ctx, [up("home", { hold: { off_s: set } })], `hold.off_s ${set}`);
  mustEqual((await holdNow(ctx))?.off_s, set, `hold.off_s after it was set to ${set}`);
  await mustDefine(ctx, [up("home", { hold: { off_s: null } })], "hold.off_s null");
  mustEqual((await holdNow(ctx))?.off_s, own!.off_s, "hold.off_s back to the steward's own");
  // A flag: taken, or refused with data.field naming it (setFlag fails on any other answer).
  ctx.evidence(`schedule_ends true: ${await setFlag(ctx, "schedule_ends", true, []) ? "taken" : "refused, data.field naming it"}`);
  if ((await holdNow(ctx))?.schedule_ends === true) await mustDefine(ctx, [up("home", { hold: { schedule_ends: null } })], "hold.schedule_ends null");
  // A change applies at once: the roomless lamp's outside hold moves from fixed_s 3600 to 600.
  await pinHold(ctx);
  const at = ctx.time.now();
  ctx.standIn!.applier.scriptValue(LAMP, "on", true, { cause: "external" });
  const before = await pollUntil(async () => leaseOf(ctx, LAMP), 10_000, "the lamp's outside change took no lease", 100);
  // The steward received the change between `at` and `seen`.
  const seen = ctx.time.now();
  ctx.evidence(`the lamp's hold under fixed_s 3600: expires ${before.expires}`);
  await pinHold(ctx, { fixed_s: 600 });
  let after = NaN;
  const moved = () => after - 600_000 >= at - ROUNDING_MS && after - 600_000 <= seen + ROUNDING_MS;
  const NOT_MOVED = "the held hold's expires did not move";
  await pollUntil(async () => {
    const l = await leaseOf(ctx, LAMP);
    after = l ? Date.parse(l.expires) : NaN;
    return moved() || undefined;
  }, ctx.allowanceMs, NOT_MOVED, 100).catch((err: unknown) => {
    // Only the poll's own timeout is judged below; any other failure is the check's.
    if (!(err instanceof RequirementFailure && err.message.startsWith(NOT_MOVED))) throw err;
  });
  ctx.evidence(`the lamp's hold after fixed_s became 600: expires ${Number.isNaN(after) ? "none" : new Date(after).toISOString()}`);
  must(moved(),
    `the held hold's expires ${Number.isNaN(after) ? "(no lease)" : new Date(after).toISOString()} after fixed_s became 600, was ${before.expires}`);
});

/** What an ended `lease` event may name as its `end` (steward, *Explained*). */
const ENDS = ["quiet", "window", "cap", "vacant", "schedule", "removed", "replaced", "unreachable"];

/**
 * Holds ended by a cause that is not a window (a removal, an unreachable step) at `causeMs`: gone within the
 * hold end lateness of it, polled for that plus the run's allowance of wall time, each ended event timed so
 * and naming `end`. Returns the ended events, in the order of `targets`.
 */
async function endedBy(ctx: TestContext, seen: Seen, cursor: string, targets: string[], causeMs: number, end: string, what: string): Promise<LeaseEv[]> {
  const bound = holdEndLatenessMs() + ctx.allowanceMs;
  const got = await pollUntil(async () => {
    const ev = seen.keep(await leaseEventsSince(ctx, cursor)).filter((e) => e.change === "ended");
    const e = targets.map((t) => ev.find((x) => x.target === t));
    return e.every((x) => x !== undefined) ? e as LeaseEv[] : undefined;
  }, bound, `${what}: no ended lease event for each of ${targets.join(", ")}`, 50);
  ctx.evidence(`${what}: ${got.map((e) => JSON.stringify(e)).join(", ")}`);
  for (const e of got) {
    must(e.end === end, `${what}: ${e.target}'s hold ended ${JSON.stringify(e.end)}, not ${end}`, e);
    must(Date.parse(e.time) <= causeMs + bound, `${what}: ${e.target}'s hold ended at ${e.time}, past the lateness after ${iso(causeMs)}`, e);
  }
  for (const t of targets) must((await leaseOf(ctx, t)) === undefined, `${what}: ${t} still leased after its ended event`);
  return got;
}

requirement("GA-LEASE-7", {
  seam: "steward",
  covers: "under the pinned windows, with presence_renews set true: a hold ends when its room has been quiet for its direction's window (an outside on 3600 s, an off 600 s, a brightness change, a member's set_level and her turn_on declared toggles other_s, a member's turn_off off_s), motion renewing it, naming quiet_since, absent for a room quiet throughout; each granted event names its direction and an apply's its derived role; a source going stale ends it fixed_s after the later of the change and that moment, one back to live, one in the room adopted and one in it unadopted restarting the quiet count; presence_renews false (when taken) renews nothing; a roomless hold ends fixed_s after the change, end window, its expires saying so from the grant, and fixed_s counts from a move into a room with no source; under 1 s windows a failed apply's hold lasts ack_within_s + 60 s from dispatch and expires says so, an acked one ends at once and a late ack inside the floor ends it; with vacant_ends (when taken) an open-loop lamp's hold, its step sent, ends at a vacancy right after; cap_s 900 ends a busy hold, end cap, cap_s 7200 one kept busy by motion every 600 s, and under 1 s windows cap_s 1 waits for the floor; a load_cap lease has no direction and ends load_cap_s after it, end window, motion, cap_s and vacancy notwithstanding; vacancy ends a hold taken while the room was not vacant, `occupancy_hold_s` running out with no report, and not one taken while it was vacant (when vacant_ends); a device unadopted, forgotten by the applier or made internal ends its hold, and a load_cap lease, removed within the lateness, neither back once adopted again; a step ending unreachable leaves no hold, or one ended unreachable within the lateness; a replaced hold's ended event, end replaced, comes before the new granted one; a hold whose quiet end fell while the steward was down, motion only later in the gap, ends at the restart with end_time that end; every end within the hold end lateness and every person's lease's end naming its reason; a schedule's end when `schedule_ends` is taken (a steward that refuses the flag: skipped and said; not built in the reference)",
}, async (ctx) => {
  const applier = ctx.standIn!.applier;
  const s = ctx.steward!;
  const seen = new Seen();
  let p = await pinHold(ctx);
  let renews = await setFlag(ctx, "presence_renews", true, ["ends-a-hold-while-busy", "never-ends-a-quiet-hold",
    "quiet-without-its-moment", "renews-on-a-dead-sensor", "gap-end-without-time"]);
  // The vacancy parts time a room turning vacant from occupancy_hold_s: pinned at its default, 300 s, put back at the end.
  const ownOccupancyHoldS = (await ownerOf(ctx).callOk("describe")).home.occupancy_hold_s as number;
  await mustDefine(ctx, [up("home", { occupancy_hold_s: 300 })], "occupancy_hold_s 300");
  const occupancyHoldMs = 300 * SECOND;

  if (renews) {
    // Quiet, both ways: an on in the hall (busy for 30 s at +1000 s), an off in the den (quiet throughout),
    // an off in the study (busy from +300 s to +900 s).
    const [lampA, motionA] = await scripted(ctx, [lampOn("hold-a"), sensorOn("motion", "hold-a")]);
    const [lampB, motionB] = await scripted(ctx, [lampOn("hold-a2"), sensorOn("motion", "hold-a2")]);
    const [lampC, motionC] = await scripted(ctx, [lampOn("hold-a3"), sensorOn("motion", "hold-a3")]);
    await mustDefine(ctx, [...room("hold-hall", [lampA!, motionA!]), ...room("hold-den", [lampB!, motionB!]), ...room("hold-study", [lampC!, motionC!])],
      "the quiet part's rooms");
    applier.scriptValue(lampB!, "on", true, { cause: "device" });
    applier.scriptValue(lampC!, "on", true, { cause: "device" });
    const c = await cursorNow(ctx);
    const t0 = ctx.time.now();
    applier.scriptValue(lampA!, "on", true, { cause: "external" });
    applier.scriptValue(lampB!, "on", false, { cause: "external" });
    applier.scriptValue(lampC!, "on", false, { cause: "external" });
    const g = await grantsOf(ctx, seen, c, [lampA!, lampB!, lampC!], "an outside on in the hall, offs in the den and the study");
    mustEqual([lampA, lampB, lampC].map((x) => g[x!]!.direction), ["on", "off", "off"], "the granted events' directions");
    await stepTo(ctx, t0 + 300 * SECOND);
    applier.scriptValue(motionC!, "motion", true);
    await endsAt(ctx, seen, lampB!, t0 + p.off_s * SECOND, "an off hold in a room quiet throughout", { end: "quiet", quietSince: null, byExpires: true });
    must((await leaseOf(ctx, lampC!)) !== undefined, `an off hold in a room busy since +300 s ended ${p.off_s} s after the change`);
    await stepTo(ctx, t0 + 900 * SECOND);
    const quietC = ctx.time.now();
    applier.scriptValue(motionC!, "motion", false);
    await stepTo(ctx, t0 + 1_000 * SECOND);
    applier.scriptValue(motionA!, "motion", true);
    await stepTo(ctx, t0 + 1_030 * SECOND);
    const quietA = ctx.time.now();
    applier.scriptValue(motionA!, "motion", false);
    await endsAt(ctx, seen, lampC!, quietC + p.off_s * SECOND, "an off hold, the room quiet from +900 s", { end: "quiet", quietSince: quietC, byExpires: true });
    await endsAt(ctx, seen, lampA!, quietA + p.on_s * SECOND, "an on hold, the room quiet from +1030 s", { end: "quiet", quietSince: quietA, byExpires: true });

    // A stale source renews nothing: the attic's sensor goes stale reading motion (fixed_s from then); the
    // cellar's goes stale (the room quiet from then), clears, and is live again (the quiet counted from its return).
    const [lampD, motionD] = await scripted(ctx, [lampOn("hold-b"), sensorOn("motion", "hold-b")]);
    const [lampE, motionE] = await scripted(ctx, [lampOn("hold-b2"), sensorOn("motion", "hold-b2")]);
    await mustDefine(ctx, [...room("hold-attic", [lampD!, motionD!]), ...room("hold-cellar", [lampE!, motionE!])], "the stale part's rooms");
    const c2 = await cursorNow(ctx);
    const t1 = ctx.time.now();
    applier.scriptValue(lampD!, "on", true, { cause: "external" });
    applier.scriptValue(lampE!, "on", true, { cause: "external" });
    await grantsOf(ctx, seen, c2, [lampD!, lampE!], "outside ons in the attic and the cellar");
    await stepTo(ctx, t1 + 10 * SECOND);
    applier.scriptValue(motionD!, "motion", true);
    applier.scriptValue(motionE!, "motion", true);
    await stepTo(ctx, t1 + 100 * SECOND);
    const stale = ctx.time.now();
    applier.scriptLiveness(motionD!, "stale");
    applier.scriptLiveness(motionE!, "stale");
    await stepTo(ctx, t1 + 150 * SECOND);
    applier.scriptValue(motionE!, "motion", false);
    await stepTo(ctx, t1 + 200 * SECOND);
    const back = ctx.time.now();
    applier.scriptLiveness(motionE!, "live");
    await endsAt(ctx, seen, lampD!, stale + p.fixed_s * SECOND, "a hold whose only source went stale reading motion", { end: "window", byExpires: true });
    await endsAt(ctx, seen, lampE!, back + p.on_s * SECOND, "a hold whose only source came back live, clear", { end: "quiet", quietSince: stale, byExpires: true });

    // A source adopted into the room, and one removed from it, restart the quiet count from then.
    const [lampW, motionW] = await scripted(ctx, [lampOn("hold-l"), sensorOn("motion", "hold-l")]);
    const [lampX, motionX] = await scripted(ctx, [lampOn("hold-l2"), sensorOn("motion", "hold-l2")]);
    const [motionX2] = await scripted(ctx, [sensorOn("motion", "hold-l3")]);
    const [motionW2] = await scripted(ctx, [sensorOn("motion", "hold-l4")]);
    await mustDefine(ctx, [...room("hold-shed", [lampW!, motionW!, motionW2!]), ...room("hold-barn", [lampX!, motionX!, motionX2!])], "the shed and the barn");
    // The shed's second sensor is in the room but not adopted until +1000 s.
    applier.scriptAdopted(motionW2!, false);
    await stewardSees(ctx, "the shed's second sensor not adopted", (d) => targetIn(d, motionW2!)?.adopted === false);
    const c3 = await cursorNow(ctx);
    const t2 = ctx.time.now();
    applier.scriptValue(lampW!, "on", true, { cause: "external" });
    applier.scriptValue(lampX!, "on", true, { cause: "external" });
    await grantsOf(ctx, seen, c3, [lampW!, lampX!], "outside ons in the shed and the barn");
    await stepTo(ctx, t2 + 1_000 * SECOND);
    const gained = ctx.time.now();
    applier.scriptAdopted(motionW2!, true);
    await stewardSees(ctx, "the shed's second sensor adopted", (d) => targetIn(d, motionW2!)?.adopted === true);
    await stepTo(ctx, t2 + 1_100 * SECOND);
    const lost = ctx.time.now();
    applier.scriptAdopted(motionX2!, false);
    await stewardSees(ctx, "the barn's second sensor no longer adopted", (d) => targetIn(d, motionX2!)?.adopted === false);
    await endsAt(ctx, seen, lampW!, gained + p.on_s * SECOND, "a hold whose room gained a source at +1000 s", { end: "quiet", byExpires: true });
    await endsAt(ctx, seen, lampX!, lost + p.on_s * SECOND, "a hold whose room lost a source at +1100 s", { end: "quiet", byExpires: true });
  }

  // presence_renews false (when taken): motion held true from +10 s renews nothing; the hold ends on_s after the change.
  if (await setFlag(ctx, "presence_renews", false, ["renews-when-told-not-to"])) {
    const [lampF, motionF] = await scripted(ctx, [lampOn("hold-b3"), sensorOn("motion", "hold-b3")]);
    await mustDefine(ctx, room("hold-loft", [lampF!, motionF!]), "the loft");
    const c = await cursorNow(ctx);
    const t0 = ctx.time.now();
    applier.scriptValue(lampF!, "on", true, { cause: "external" });
    await grantsOf(ctx, seen, c, [lampF!], "an outside on in the loft");
    await stepTo(ctx, t0 + 10 * SECOND);
    applier.scriptValue(motionF!, "motion", true);
    await endsAt(ctx, seen, lampF!, t0 + p.on_s * SECOND, "a hold without presence_renews, motion held", { end: "window", byExpires: true });
    applier.scriptValue(motionF!, "motion", false);
    await mustDefine(ctx, [up("home", { hold: { presence_renews: null } })], "hold.presence_renews null");
  }
  renews = await setFlag(ctx, "presence_renews", true, ["ignores-the-cap", "gap-end-without-time"]);

  // Direction other, and an apply's direction from its action: other_s 1800 for a brightness change from outside and
  // a member's set_level, off_s for her turn_off; each apply's grant naming her derived role. Run with or without
  // presence_renews: in a room quiet throughout either ends at the direction's window from the change, `quiet` with
  // it and `window` without (GA-LEASE-7).
  p = await pinHold(ctx, { other_s: 1800 });
  {
    const quietEnd = renews ? "quiet" : "window";
    const [dimmer1, motionK] = await scripted(ctx, [{ fixture: "dimmer", adopt: "light", bridge: "hold-k" }, sensorOn("motion", "hold-k")]);
    const [dimmer2] = await scripted(ctx, [{ fixture: "dimmer", adopt: "light", bridge: "hold-k2" }]);
    const [lampK] = await scripted(ctx, [lampOn("hold-k3")]);
    const [toggler] = await scripted(ctx, [lampOn("hold-k4")]);
    await mustDefine(ctx, room("hold-pantry", [dimmer1!, motionK!, dimmer2!, lampK!, toggler!]), "the pantry");
    // A turn_on declared toggles: its direction is other, whatever the action's name says.
    applier.scriptToggles(toggler!, "onoff.turn_on", true);
    await stewardSees(ctx, "the toggling lamp's turn_on declared toggles",
      (d) => (targetIn(d, toggler!)?.actions ?? []).some((a: any) => a.action === "onoff.turn_on" && a.toggles === true));
    applier.scriptValue(lampK!, "on", true, { cause: "device" });
    const c = await cursorNow(ctx);
    const t0 = ctx.time.now();
    applier.scriptValue(dimmer1!, "level", 50, { cause: "external" });
    await grantsOf(ctx, seen, c, [dimmer1!], "a brightness change from outside");
    await stepTo(ctx, t0 + 100 * SECOND);
    const tA = ctx.time.now();
    mustEqual(outcomes(await applyInline(s.olga, "olga-app", [act(dimmer2!, "level.set_level", { level: 40 }), act(lampK!, "onoff.turn_off")]),
      "the member's set_level and turn_off"), [`${dimmer2} dispatched`, `${lampK} dispatched`], "the member's set_level and turn_off");
    const g = await grantsOf(ctx, seen, c, [dimmer1!, dimmer2!, lampK!], "a brightness change, and the member's set_level and turn_off");
    mustEqual([dimmer1, dimmer2, lampK].map((x) => [g[x!]!.direction, g[x!]!.role ?? null]), [["other", null], ["other", "member"], ["off", "member"]],
      "the granted events' directions and roles");
    await stepTo(ctx, t0 + 200 * SECOND);
    const tB = ctx.time.now();
    mustEqual(outcomes(await applyInline(s.olga, "olga-app", [act(toggler!)]), "the member's turn_on declared toggles"), [`${toggler} dispatched`],
      "the member's turn_on declared toggles");
    const gt = await grantsOf(ctx, seen, c, [toggler!], "the member's turn_on declared toggles");
    mustEqual([gt[toggler!]!.direction, gt[toggler!]!.role], ["other", "member"], "a toggling turn_on's granted direction and role");
    await endsAt(ctx, seen, lampK!, tA + p.off_s * SECOND, "the member's turn_off in a quiet room", { end: quietEnd, quietSince: null, byExpires: true });
    await endsAt(ctx, seen, dimmer1!, t0 + p.other_s * SECOND, "a brightness change from outside in a quiet room", { end: quietEnd, byExpires: true });
    await endsAt(ctx, seen, dimmer2!, tA + p.other_s * SECOND, "the member's set_level in a quiet room", { end: quietEnd, byExpires: true });
    await endsAt(ctx, seen, toggler!, tB + p.other_s * SECOND, "the member's turn_on declared toggles in a quiet room", { end: quietEnd, byExpires: true });
  }

  // No room, no source: fixed_s 600 from the change, whatever motion elsewhere reads; from a move into a room with no source.
  p = await pinHold(ctx, { fixed_s: 600 });
  {
    const [lampG] = await scripted(ctx, [lampOn("hold-c")]);
    const [lampH] = await scripted(ctx, [lampOn("hold-c2")]);
    const [motionG] = await scripted(ctx, [sensorOn("motion", "hold-c3")]);
    await mustDefine(ctx, [...room("hold-yard", [motionG!]), up("room", { id: "hold-porch", name: "hold-porch" })], "the yard's motion and the empty porch");
    applier.scriptValue(motionG!, "motion", true);
    const c = await cursorNow(ctx);
    const at = ctx.time.now();
    applier.scriptValue(lampG!, "on", true, { cause: "external" });
    applier.scriptValue(lampH!, "on", true, { cause: "external" });
    const g = await grantsOf(ctx, seen, c, [lampG!, lampH!], "outside ons on two roomless lamps");
    const seenAt = ctx.time.now();
    mustEqual(g[lampG!]!.direction, "on", "an outside on's granted direction");
    await expiresBetween(ctx, lampG!, at + 600 * SECOND, seenAt + 600 * SECOND, "a roomless hold's expires from the grant on, fixed_s 600");
    await stepTo(ctx, at + 300 * SECOND);
    const moved = ctx.time.now();
    await mustDefine(ctx, [up("target", { id: lampH!, room: "hold-porch" })], "the lamp moved into the empty porch");
    await endsAt(ctx, seen, lampG!, at + p.fixed_s * SECOND, "a roomless hold", { end: "window", byExpires: true });
    await endsAt(ctx, seen, lampH!, moved + p.fixed_s * SECOND, "a hold moved into a room with no source", { end: "window", byExpires: true });
    applier.scriptValue(motionG!, "motion", false);
  }

  // The floor, under 1 s windows: a failed apply's hold lasts ack_within_s + 60 s from dispatch, its expires
  // saying so from the grant; an acked one ends at once; a late ack inside the floor ends it.
  p = await pinHold(ctx, { on_s: 1, off_s: 1, other_s: 1, fixed_s: 1 });
  {
    const [lampI] = await scripted(ctx, [lampOn("hold-d")]);
    const [lampJ] = await scripted(ctx, [lampOn("hold-d2")]);
    const [lampK] = await scripted(ctx, [lampOn("hold-d3")]);
    const floorMs = ((await ackWithinOf(ctx, lampI!, "onoff.turn_on")) + 60) * SECOND;
    applier.scriptOutcome(lampI!, "onoff.turn_on", { outcome: "unanswered" });
    applier.scriptOutcome(lampK!, "onoff.turn_on", { outcome: "failed", reason: "no_ack" });
    const c = await cursorNow(ctx);
    const at = ctx.time.now();
    mustEqual(outcomes(await applyInline(s.olga, "olga-app", [act(lampI!), act(lampJ!), act(lampK!)]), "the member's turn_on of three lamps"),
      [`${lampI} dispatched`, `${lampJ} dispatched`, `${lampK} dispatched`], "the member's turn_on of three lamps");
    const sent = ctx.time.now();
    await grantsOf(ctx, seen, c, [lampI!, lampJ!, lampK!], "the member's three holds");
    await expiresBetween(ctx, lampI!, at + floorMs, sent + floorMs, "an unanswered step's hold under 1 s windows, from the grant on");
    await endsAt(ctx, seen, lampJ!, sent + p.fixed_s * SECOND, "an acked step's hold under 1 s windows", { end: "window", cursor: c });
    await stepTo(ctx, at + floorMs - 50 * SECOND);
    must((await leaseOf(ctx, lampK!)) !== undefined, "a failed step's hold ended inside its floor");
    const beforeLate = await cursorNow(ctx);
    const late = ctx.time.now();
    applier.scriptLateAck(lampK!);
    await endsAt(ctx, seen, lampK!, late, "a failed step's hold, acked late inside its floor", { end: "window", cursor: beforeLate });
    await endsAt(ctx, seen, lampI!, at + floorMs, "an unanswered step's hold under 1 s windows", { end: "window", byExpires: true });
  }

  // With vacant_ends (when taken), an open-loop lamp's floor ends at `sent`: a vacancy 20 s after dispatch ends the hold.
  p = await pinHold(ctx);
  const vacant = await setFlag(ctx, "vacant_ends", true, ["floor-waits-past-sent", "vacant-ends-a-remote-hold", "misses-a-vacancy"]);
  if (vacant) {
    const [nookLamp, presence] = await scripted(ctx, [{ fixture: "rflamp", adopt: "light", bridge: "hold-d4" }, sensorOn("presence", "hold-d4")]);
    await mustDefine(ctx, room("hold-nook", [nookLamp!, presence!]), "the nook");
    const there = ctx.time.now();
    applier.scriptValue(presence!, "occupancy", true);
    applier.scriptValue(presence!, "occupancy", false);
    await stepTo(ctx, there + occupancyHoldMs - 20 * SECOND);
    const c = await cursorNow(ctx);
    mustEqual(outcomes(await applyInline(s.olga, "olga-app", [act(nookLamp!)]), "the member's turn_on of the open-loop lamp"), [`${nookLamp} dispatched`],
      "the member's turn_on of the open-loop lamp");
    await grantsOf(ctx, seen, c, [nookLamp!], "the member's hold on the open-loop lamp");
    await pollUntil(async () => (await eventsAfter(ctx, c)).some((e) => e.type === "outcome" && e.target === nookLamp && e.outcome === "sent") || undefined,
      10_000, "the open-loop lamp's step was not relayed sent", 100);
    await endsAt(ctx, seen, nookLamp!, there + occupancyHoldMs, "an open-loop lamp's hold, its step sent, the nook turning vacant", { end: "vacant" });
  }

  // The cap: cap_s 900 ends a hold held busy; cap_s 7200 one kept busy by motion every 600 s (presence renewing);
  // under 1 s windows cap_s 1 waits for the floor.
  p = await pinHold(ctx, { cap_s: 900 });
  const [lampL, motionL] = await scripted(ctx, [lampOn("hold-e"), sensorOn("motion", "hold-e")]);
  const [heater] = await scripted(ctx, [{ fixture: "heater", adopt: "socket", bridge: "hold-e2" }]);
  await mustDefine(ctx, room("hold-gym", [lampL!, motionL!, heater!]), "the gym");
  applier.scriptValue(motionL!, "motion", true);
  {
    const c = await cursorNow(ctx);
    const t0 = ctx.time.now();
    applier.scriptValue(lampL!, "on", true, { cause: "external" });
    await grantsOf(ctx, seen, c, [lampL!], "an outside on in the busy gym");
    await endsAt(ctx, seen, lampL!, t0 + p.cap_s * SECOND, "a hold held busy, cap_s 900", { end: "cap", byExpires: true });
  }
  if (renews) {
    p = await pinHold(ctx, { cap_s: 7200 });
    const [lampN, motionN] = await scripted(ctx, [lampOn("hold-e3"), sensorOn("motion", "hold-e3")]);
    await mustDefine(ctx, room("hold-landing", [lampN!, motionN!]), "the landing");
    const c = await cursorNow(ctx);
    const t0 = ctx.time.now();
    applier.scriptValue(lampN!, "on", true, { cause: "external" });
    await grantsOf(ctx, seen, c, [lampN!], "an outside on on the landing");
    for (let k = 1; k * 600 < p.cap_s; k++) {
      await stepTo(ctx, t0 + k * 600 * SECOND);
      applier.scriptValue(motionN!, "motion", true);
      await stepTo(ctx, t0 + (k * 600 + 30) * SECOND);
      applier.scriptValue(motionN!, "motion", false);
    }
    await endsAt(ctx, seen, lampN!, t0 + p.cap_s * SECOND, "a hold kept busy by motion every 600 s, cap_s 7200", { end: "cap", byExpires: true });
  }
  await pinHold(ctx, { on_s: 1, off_s: 1, other_s: 1, fixed_s: 1, cap_s: 1 });
  {
    const [lampM] = await scripted(ctx, [lampOn("hold-e4")]);
    const floorMs = ((await ackWithinOf(ctx, lampM!, "onoff.turn_on")) + 60) * SECOND;
    applier.scriptOutcome(lampM!, "onoff.turn_on", { outcome: "unanswered" });
    const c = await cursorNow(ctx);
    const at = ctx.time.now();
    mustEqual(outcomes(await applyInline(s.olga, "olga-app", [act(lampM!)]), "the member's turn_on under cap_s 1"), [`${lampM} dispatched`],
      "the member's turn_on under cap_s 1");
    await grantsOf(ctx, seen, c, [lampM!], "the member's hold under cap_s 1");
    await endsAt(ctx, seen, lampM!, at + floorMs, "an unanswered step's hold under cap_s 1", { end: ["cap", "window"], byExpires: true });
  }
  // The heater's guard: load_cap_s from the change, no direction, end window; motion in the gym, cap_s 900 and,
  // when vacant_ends is taken, the boiler room turning vacant notwithstanding.
  p = await pinHold(ctx, { cap_s: 900 });
  if (vacant) await mustDefine(ctx, [up("home", { hold: { vacant_ends: true } })], "vacant_ends true again, over the pinned false");
  {
    const [heater2, presence] = await scripted(ctx, [{ fixture: "heater", adopt: "socket", bridge: "hold-e5" }, sensorOn("presence", "hold-e5")]);
    await mustDefine(ctx, room("hold-boiler", [heater2!, presence!]), "the boiler room");
    applier.scriptValue(heater!, "on", true, { cause: "device" });
    applier.scriptValue(heater2!, "on", true, { cause: "device" });
    const c = await cursorNow(ctx);
    const t0 = ctx.time.now();
    applier.scriptValue(heater!, "on", false, { cause: "load_cap" });
    await stepTo(ctx, t0 + 100 * SECOND);
    // The boiler room occupied just now, so it turns vacant occupancy_hold_s after its change.
    applier.scriptValue(presence!, "occupancy", true);
    applier.scriptValue(presence!, "occupancy", false);
    const t1 = ctx.time.now();
    applier.scriptValue(heater2!, "on", false, { cause: "load_cap" });
    const g = await grantsOf(ctx, seen, c, [heater!, heater2!], "the heaters' load_cap changes");
    for (const h of [heater!, heater2!]) must(!("direction" in g[h]!), `a load_cap lease's granted event names direction ${g[h]!.direction}`, g[h]);
    await endsAt(ctx, seen, heater!, t0 + p.load_cap_s * SECOND, "a load_cap lease in the busy gym, cap_s 900", { end: "window", byExpires: true });
    await endsAt(ctx, seen, heater2!, t1 + p.load_cap_s * SECOND, `a load_cap lease in a room${vacant ? " turned vacant" : ""}, cap_s 900`,
      { end: "window", byExpires: true });
  }
  await pinHold(ctx);
  applier.scriptValue(motionL!, "motion", false);

  // Vacancy (when vacant_ends is taken): a hold taken while the room was not vacant ends when it turns vacant,
  // occupancy_hold_s running out with no report; one taken while it was vacant ends on_s after its change.
  p = await pinHold(ctx);
  if (vacant) {
    await mustDefine(ctx, [up("home", { hold: { vacant_ends: true } })], "vacant_ends true again, over the pinned false");
    const [lampO, presence] = await scripted(ctx, [lampOn("hold-f"), sensorOn("presence", "hold-f")]);
    const [lampP] = await scripted(ctx, [lampOn("hold-f2")]);
    await mustDefine(ctx, room("hold-bedroom", [lampO!, presence!, lampP!]), "the bedroom");
    const there = ctx.time.now();
    applier.scriptValue(presence!, "occupancy", true);
    applier.scriptValue(presence!, "occupancy", false);
    await stepTo(ctx, there + 20 * SECOND);
    const c = await cursorNow(ctx);
    applier.scriptValue(lampO!, "on", true, { cause: "external" });
    await grantsOf(ctx, seen, c, [lampO!], "an outside on in the bedroom, not vacant");
    await endsAt(ctx, seen, lampO!, there + occupancyHoldMs, "a hold in a room turning vacant with no report", { end: "vacant" });
    const c2 = await cursorNow(ctx);
    const t1 = ctx.time.now();
    applier.scriptValue(lampP!, "on", true, { cause: "external" });
    await grantsOf(ctx, seen, c2, [lampP!], "an outside on in the vacant bedroom");
    await endsAt(ctx, seen, lampP!, t1 + p.on_s * SECOND, "a hold taken in a vacant room",
      renews ? { end: "quiet", quietSince: null, byExpires: true } : { end: "window", byExpires: true });
  }

  // Removed: unadopting ends a hold and a load_cap lease, the applier forgetting a device and its becoming
  // internal end a hold, each `removed` within the lateness; adopting again brings neither back. A member's step
  // ending unreachable leaves no hold, or one ended unreachable within the lateness.
  {
    const [lampQ] = await scripted(ctx, [lampOn("hold-g")]);
    const [heaterQ] = await scripted(ctx, [{ fixture: "heater", adopt: "socket", bridge: "hold-g2" }]);
    const [lampR] = await scripted(ctx, [lampOn("hold-g3")]);
    const [lampGone] = await scripted(ctx, [lampOn("hold-g4")]);
    const [lampInternal] = await scripted(ctx, [lampOn("hold-g5")]);
    applier.scriptValue(heaterQ!, "on", true, { cause: "device" });
    const c = await cursorNow(ctx);
    applier.scriptValue(lampQ!, "on", true, { cause: "external" });
    applier.scriptValue(heaterQ!, "on", false, { cause: "load_cap" });
    applier.scriptValue(lampGone!, "on", true, { cause: "external" });
    applier.scriptValue(lampInternal!, "on", true, { cause: "external" });
    await grantsOf(ctx, seen, c, [lampQ!, heaterQ!, lampGone!, lampInternal!], "outside ons and a load_cap change");
    const c2 = await cursorNow(ctx);
    const unadopted = ctx.time.now();
    applier.scriptAdopted(lampQ!, false);
    applier.scriptAdopted(heaterQ!, false);
    await endedBy(ctx, seen, c2, [lampQ!, heaterQ!], unadopted, "removed", "the lamp and the heater unadopted");
    applier.scriptAdopted(lampQ!, true);
    applier.scriptAdopted(heaterQ!, true);
    await stewardSees(ctx, "the lamp and the heater adopted again", (d) => targetIn(d, lampQ!)?.adopted === true && targetIn(d, heaterQ!)?.adopted === true);
    mustEqual([await leaseOf(ctx, lampQ!), await leaseOf(ctx, heaterQ!)], [undefined, undefined], "the leases once adopted again");
    const c3 = await cursorNow(ctx);
    const forgotten = ctx.time.now();
    applier.scriptForget(lampGone!);
    await endedBy(ctx, seen, c3, [lampGone!], forgotten, "removed", "a lamp the applier no longer describes");
    const c4 = await cursorNow(ctx);
    const marked = ctx.time.now();
    applier.scriptMarks(lampInternal!, { internal: true });
    await endedBy(ctx, seen, c4, [lampInternal!], marked, "removed", "a lamp made internal");
    applier.scriptOutcome(lampR!, "onoff.turn_on", { outcome: "unreachable", afterMs: 5_000 });
    const c5 = await cursorNow(ctx);
    mustEqual(outcomes(await applyInline(s.olga, "olga-app", [act(lampR!)]), "the member's turn_on the stand-in ends unreachable"), [`${lampR} dispatched`],
      "the member's turn_on before it ends");
    await ctx.time.stepAndWait(6_000);
    const failed = await pollUntil(async () => (await eventsAfter(ctx, c5)).find((e) => e.type === "outcome" && e.target === lampR && e.outcome === "unreachable"),
      10_000, "the stand-in's unreachable was not relayed", 100);
    const ev = seen.keep(await leaseEventsSince(ctx, c5)).filter((e) => e.target === lampR);
    if (ev.some((e) => e.change === "granted")) {
      const [end] = await endedBy(ctx, seen, c5, [lampR!], Date.parse(failed.time), "unreachable", "a hold whose step ended unreachable");
      ctx.evidence(`the unreachable step's hold: ${JSON.stringify(end)}`);
    } else must((await leaseOf(ctx, lampR!)) === undefined, "a step ending unreachable left a hold with no granted event");
  }

  // A replacement: the member's hold ends `replaced` before the outside change's lease is granted.
  {
    const [lampS] = await scripted(ctx, [lampOn("hold-h")]);
    const c = await cursorNow(ctx);
    const mine = await applyInline(s.olga, "olga-app", [act(lampS!)]);
    mustEqual(outcomes(mine, "the member's turn_on"), [`${lampS} dispatched`], "the member's turn_on");
    await pollUntil(async () => ((await s.olga.callOk("outcome", { apply_id: mine.body.apply_id })).outcomes as { outcome: string }[])
      .every((o) => o.outcome !== "dispatched") || undefined, 5_000, "the member's apply was not answered", 50);
    applier.scriptValue(lampS!, "on", false, { cause: "external" });
    const ev = await pollUntil(async () => {
      const all = seen.keep(await leaseEventsSince(ctx, c)).filter((e) => e.target === lampS);
      return all.length >= 3 ? all : undefined;
    }, 10_000, "the outside change did not replace the member's hold", 100);
    ctx.evidence(`a replacement's lease events: ${JSON.stringify(ev)}`);
    mustEqual(ev.map((e) => `${e.change} ${typeof e.holder === "string" ? e.holder : e.holder?.endpoint}${e.end ? ` ${e.end}` : ""}`),
      ["granted olga-app", "ended olga-app replaced", "granted external"], "a replacement's lease events, in order");
  }

  // A restart (presence_renews taken): a hold whose quiet end falls while the steward is down, motion only later in
  // the gap, ends at the restart with end_time that end, not revived by the motion.
  if (renews) {
    p = await pinHold(ctx);
    const [lampV, motionV] = await scripted(ctx, [lampOn("hold-m"), sensorOn("motion", "hold-m")]);
    await mustDefine(ctx, room("hold-garage", [lampV!, motionV!]), "the garage");
    const c = await cursorNow(ctx);
    const t0 = ctx.time.now();
    applier.scriptValue(lampV!, "on", true, { cause: "external" });
    await grantsOf(ctx, seen, c, [lampV!], "an outside on in the garage");
    await stepTo(ctx, t0 + 600 * SECOND);
    // The room quiet throughout, its expires before the stop is its quiet end, which end_time must name.
    const before = await leaseOf(ctx, lampV!);
    must(before !== undefined, "the garage's hold before the stop: no lease");
    const down = await cursorNow(ctx);
    // Stepped and waited for, so the stand-in stamps the motion at its time in the gap.
    const readBack = await restartReadBack(ctx, async () => {
      await ctx.time.stepAndWait(t0 + (p.on_s + 300) * SECOND - ctx.time.now());
      applier.scriptValue(motionV!, "motion", true);
      await ctx.time.stepAndWait(30 * SECOND);
    });
    await endedAtRestart(ctx, seen, down, lampV!, Date.parse(before!.expires), "quiet", "a hold whose quiet end fell while the steward was down", readBack);
    must((await leaseOf(ctx, lampV!)) === undefined, "the motion later in the gap revived the hold");
    must(!seen.keep(await leaseEventsSince(ctx, down)).some((e) => e.change === "granted" && e.target === lampV), "a hold granted again after the restart");
  }

  // A schedule's end (when schedule_ends is taken): a run's step after the floor ends the hold `schedule` naming
  // the run; one inside the floor is refused and ends nothing, then or when the floor passes; a step skipped
  // (skip(occupied)) and a brain_authored run's step end nothing.
  // Pinned first: the pinned policy sets schedule_ends false.
  await pinHold(ctx);
  if (await setFlag(ctx, "schedule_ends", true, ["schedule-cannot-end", "schedule-ends-without-dispatch", "schedule-end-without-run", "schedule-ends-at-the-floor"])) {
    const [lampT] = await scripted(ctx, [lampOn("hold-h2")]);
    const [lampU] = await scripted(ctx, [lampOn("hold-h3")]);
    const [lampY, presenceY] = await scripted(ctx, [lampOn("hold-h4"), sensorOn("presence", "hold-h4")]);
    const [lampZ] = await scripted(ctx, [lampOn("hold-h5")]);
    await mustDefine(ctx, room("hold-closet", [lampY!, presenceY!]), "the closet");
    applier.scriptValue(presenceY!, "occupancy", true);
    const floorMs = ((await ackWithinOf(ctx, lampU!, "onoff.turn_on")) + 60) * SECOND;
    const at = Math.ceil((ctx.time.now() + 3 * MINUTE) / MINUTE) * MINUTE;
    await mustDefine(ctx, [scene("hold-off", [act(lampT!, "onoff.turn_off"), act(lampU!, "onoff.turn_off")]),
      scene("hold-skip", [act(lampY!, "onoff.turn_off")], { respect_occupancy: true }),
      up("schedule", { id: "hold-off", scenario: "hold-off", time: wall(at).hhmm }),
      up("schedule", { id: "hold-skip", scenario: "hold-skip", time: wall(at).hhmm })], "schedules turning lamps off");
    await byBrain(ctx, [scene("hold-brain", [act(lampZ!, "onoff.turn_off")]), up("schedule", { id: "hold-brain", scenario: "hold-brain", time: wall(at).hhmm })],
      "a brain's schedule turning a lamp off");
    mustEqual(outcomes(await applyInline(s.olga, "olga-app", [act(lampT!), act(lampY!), act(lampZ!)]), "the member's turn_on, acked"),
      [`${lampT} dispatched`, `${lampY} dispatched`, `${lampZ} dispatched`], "the member's turn_on, acked");
    await stepTo(ctx, at - 30 * SECOND);
    applier.scriptOutcome(lampU!, "onoff.turn_on", { outcome: "unanswered" });
    const dispatched = ctx.time.now();
    mustEqual(outcomes(await applyInline(s.olga, "olga-app", [act(lampU!)]), "the member's turn_on, unanswered"), [`${lampU} dispatched`],
      "the member's turn_on, unanswered");
    const sent = sentFrom(ctx);
    const c = await cursorNow(ctx);
    await ctx.time.stepAndWait(MINUTE);
    const run = await pollUntil(async () => (await eventsAfter(ctx, c)).find((e) => e.type === "scenario" && e.cause?.schedule === "hold-off" && e.change === "started"),
      10_000, "the schedule started no run", 100);
    await pollUntil(async () => sent().some((x) => x.target === lampT && x.action === "onoff.turn_off") || undefined, 10_000,
      "the schedule's step on the held lamp was not dispatched", 100);
    const end = await pollUntil(async () => seen.keep(await leaseEventsSince(ctx, c)).find((e) => e.change === "ended" && e.target === lampT),
      holdEndLatenessMs() + ctx.allowanceMs, "a schedule's step after the floor ended no hold", 100);
    ctx.evidence(`the schedule's end: ${JSON.stringify(end)}`);
    mustEqual([end.end, end.run], ["schedule", run.run_id], "a schedule's end and its run");
    await stepTo(ctx, dispatched + floorMs + holdEndLatenessMs());
    const still = await Promise.all([lampU, lampY, lampZ].map(async (t) => (await leaseOf(ctx, t!)) !== undefined));
    mustEqual(still, [true, true, true], "holds a step inside the floor, a skipped step and a brain's run met, still standing");
    must(!seen.keep(await leaseEventsSince(ctx, c)).some((e) => e.change === "ended" && [lampU, lampY, lampZ].includes(e.target)),
      "a step inside the floor, a skipped step or a brain's run ended a hold");
    await mustDefine(ctx, [del("schedule", { id: "hold-off" }), del("schedule", { id: "hold-skip" }), del("schedule", { id: "hold-brain" }),
      del("scenario", { id: "hold-off" }), del("scenario", { id: "hold-skip" }), del("scenario", { id: "hold-brain" }),
      up("home", { hold: { schedule_ends: null } })], "the schedules removed, schedule_ends back to the steward's own");
  }

  // Every end names its reason: each ended event of a person-precedence lease (a person's hold, a load_cap lease) read across the parts.
  const ends = [...seen.all.values()].filter((e) => e.change === "ended" && e.precedence === "person");
  ctx.evidence(`ended person-precedence lease events read: ${ends.length}`);
  for (const e of ends) {
    must(ENDS.includes(e.end), `an ended lease event names end ${JSON.stringify(e.end)}`, e);
    if (e.end === "schedule") must(typeof e.run === "string", "an end at a schedule names no run", e);
  }
  await mustDefine(ctx, [up("home", { hold: { presence_renews: null, vacant_ends: null } })], "the flags back to the steward's own");
  await mustDefine(ctx, [up("home", { occupancy_hold_s: ownOccupancyHoldS })], `occupancy_hold_s back to ${ownOccupancyHoldS}`);
});
