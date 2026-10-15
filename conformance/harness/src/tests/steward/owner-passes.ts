import { must, mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { requirement } from "../../registry.js";
import type { McpSeam } from "../../seams/mcp.js";
import { pollUntil } from "../../util.js";
import { sentFrom } from "./answers.js";
import { byBrain } from "./brain.js";
import { cursorNow, eventsAfter, firedOf, fires, type Ev } from "./rules.js";
import { holdEnds } from "./hold-helpers.js";
import { answered, bench, holderIs, holds, leaseLine, motionOn, OFF, ON, onPress, PERSONAL, press, reported, runStepOf, stepOf, whileMotion } from "./pass-helpers.js";
import { runReads, scene, startRun } from "./scenarios.js";
import { scheduleSoon } from "./schedules.js";
import { ackWithinOf, act, holdEndLatenessMs, holderWord, leaseOf, mustDefine, ownerOf, pinHold, revisionOf, scripted, stepTo, stewardSees, targetIn, up } from "./util.js";

/** A rule upsert marked `passes_holds` by its author, the owner (GA-LEASE-12). */
const marked = (rule: ReturnType<typeof up>) => up("rule", { ...(rule.value as Record<string, unknown>), passes_holds: true });

/** The home `hold`'s `owner_work_passes_holds` set through define, which no steward refuses (GA-LEASE-8, GA-LEASE-12). */
const homeSwitch = (ctx: TestContext, value: boolean, what: string) =>
  mustDefine(ctx, [up("home", { hold: { owner_work_passes_holds: value } })], `${what}: the home hold's owner_work_passes_holds ${value}`);

/** A target's `owner_work_passes_holds` set through define. */
const deviceSwitch = (ctx: TestContext, target: string, value: boolean, what: string) =>
  mustDefine(ctx, [up("target", { id: target, owner_work_passes_holds: value })], `${what}: ${target}'s owner_work_passes_holds ${value}`);

/** The `outcome` events of `rule`'s steps on `target` in `seam`'s `history` from `fromMs`, polled until one is `acked`. */
async function ruleOutcomesIn(ctx: TestContext, seam: McpSeam, fromMs: number, rule: string, target: string, what: string): Promise<Ev[]> {
  return pollUntil(async () => {
    const list = ((await seam.callOk("history", { from: new Date(fromMs).toISOString(), to: new Date(ctx.time.now() + 60_000).toISOString() })).events as Ev[])
      .filter((e) => e.type === "outcome" && e.target === target && e.cause?.rule === rule);
    return list.some((e) => e.outcome === "acked") ? list : undefined;
  }, 10_000, `${what}: no acked outcome event of rule ${rule}'s step on ${target} in history`, 100);
}

/** A member's hold: Olga's apply from her app of `action`, acked by the stand-in, so its floor has passed (GA-LEASE-7). */
const membersHold = (ctx: TestContext, target: string, what: string, action = ON) =>
  holds(ctx, ctx.steward!.olga, "olga-app", target, action, "olga-app", what);

requirement("GA-LEASE-12", {
  seam: "steward",
  covers: "under the pinned policy (every flag false but presence_renews), each part on a bridge of its own: the home hold's owner_work_passes_holds set true through define is taken and describe shows it (never refused as not implemented), then false again; "
    + "over a member's acked hold on lamp a, an unmarked level rule turning it off is refused `leased`, and the owner's rule marked passes_holds turning it off, its motion seen, is sent `for: { rule }` and acked: the member's hold stays in state with the expires it had, no lease event is issued, the rule's outcome event carries no holder, the refused rule has not fired, and at the hold's own end (its expires plus the hold end lateness) the refused rule fires; "
    + "with no switch set, an unmarked rule turning lamp b off is refused `leased` by a member's hold past its floor; "
    + "inside the floor of a member's turn_off of a lit lamp c the stand-in leaves unacked and unreported, the marked rule turning lamp c off is refused `leased`; "
    + "with lamp d's switch set, the member's turn_on unacked and the lamp's report of on caused by her apply coming first, the unmarked rule lamp d on -> off triggered by that report is sent, the member's hold standing; "
    + "with lamp e's switch set, an unmarked rule passes a member's hold, its outcome event in the owner's history carrying passed_hold { holder: { person: olga, endpoint: olga-app }, switch: device }; "
    + "a member's hold on lamp f past its floor, then the home's switch set true: an unmarked rule turning lamp f off is sent (the switch spares no hold held before it was set), and the home's switch false again; "
    + "with the heater's switch, the home's switch and the rule's mark all set, the applier's load_cap lease refuses the marked rule's turn_on `leased` load_cap; "
    + "with the home's switch set, a latching safety rule, completed, set the thermostat's mode off: the marked rule's climate.set_setpoint is refused `leased` by the safety rule's lease (its holder `safety_rule` or naming the rule) and none reaches the stand-in while the latch holds; "
    + "a brain renames the owner's marked rule (the owner saying yes): it then passes no member's hold past its floor, refused `leased`; "
    + "a brain adds lamp g2 to the group the owner's marked rule turns off: over members' holds on both, g1's step is sent and g2's refused `leased`; "
    + "a press rule also marked passes_holds turns lamp h on over a member's turn_off hold: state shows the press's hold, the member's ended `replaced`, and the press's outcome event has no passed_hold; "
    + "a press on the shaker's personal key holds lamp i and the owner's marked rule turning it off passes that hold: the guest panel's history holds the rule's outcome event for lamp i with no passed_hold key, the owner's with one; "
    + "runs: the owner's marked rule starts scenario outer-k, whose run step reaches inner-k turning open-loop lamp k off, over a member's hold, no other switch set: the step is sent, and the run's scenario_status lists it in sent_steps with passed_hold { holder: { person: olga, endpoint: olga-app }, switch: rule }; "
    + "with lamp j's switch and the home's set, a person-started run owning lamp j refuses the owner's marked rule turning it off `leased`, naming the run; "
    + "with the home's switch set, a scheduled run's turn_off of lamp m is sent over an `external` change's hold, which stands; "
    + "with the home's switch set, a member's hold on lamp n refuses late-n, a rule a brain defined (the owner saying yes); a scheduled run owning lamp n sends its turn_off through the hold, and state shows the member's hold, not the run's lease; at that hold's end the lease events are its ended then the run's granted, and late-n, judged again, is refused `leased` naming the run (GA-SCN-2's clause); "
    + "with the home's switch set, a scheduled run owning lamp p passes the guest panel's hold; the member's turn_on, unacked, replaces it: the run's next step inside her floor is refused `leased`, its step past the floor sent, and at her hold's end the run's lease is granted; "
    + "a scheduled run owning lamp q holds its lease; the member's turn_off replaces it, and at her hold's end no lease is granted to the run, which still runs; "
    + "a step undoing a narrowing: the water valve (opens_with onoff.turn_on) and the valve closed by hand (`on`, `open` reported false, cause external), only the home's switch set, a scheduled run's onoff.turn_on, valve.open, is refused `leased` naming external; with the valve's own switch set, sent",
}, async (ctx) => {
  const s = ctx.steward!;
  const applier = ctx.standIn!.applier;
  await pinHold(ctx);

  // The home's switch: every steward implements it, so define takes it; describe shows it; back to false.
  await homeSwitch(ctx, true, "the home's switch");
  let hold = (await ownerOf(ctx).callOk("describe")).home?.hold as Record<string, unknown> | undefined;
  mustEqual(hold?.owner_work_passes_holds, true, "describe's home.hold.owner_work_passes_holds after it was set true");
  await homeSwitch(ctx, false, "the home's switch");
  hold = (await ownerOf(ctx).callOk("describe")).home?.hold as Record<string, unknown> | undefined;
  mustEqual(hold?.owner_work_passes_holds, false, "describe's home.hold.owner_work_passes_holds after it was set false again");

  // The rule's switch: the marked rule passes the member's hold, which stays, keeps its end and its refused rule.
  const a = await bench(ctx, "op-a", ["lamp", "motion"]);
  await membersHold(ctx, a.lamp, "the member's turn_on of lamp a");
  await mustDefine(ctx, [whileMotion("late-a", a.motion, a.lamp)], "an unmarked rule turning lamp a off");
  let c = await cursorNow(ctx);
  let sent = sentFrom(ctx);
  motionOn(ctx, a.motion);
  mustEqual(await stepOf(ctx, c, sent, "late-a", a.lamp, OFF, "the unmarked rule under the member's hold"), "refused(leased) olga-app",
    "the unmarked rule's step under the member's hold on lamp a");
  // Some time on, so that a hold whose change moved to the pass would show it in its expires.
  await ctx.time.stepAndWait(5_000);
  const before = await leaseOf(ctx, a.lamp);
  must(before !== undefined && holderWord(before.holder) === "olga-app", `lamp a is not held by the member before the pass: ${JSON.stringify(before?.holder ?? "no lease")}`);
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  await mustDefine(ctx, [marked(whileMotion("off-a", a.motion, a.lamp))], "the owner's rule marked passes_holds turning lamp a off while motion a is seen");
  mustEqual(await stepOf(ctx, c, sent, "off-a", a.lamp, OFF, "the marked rule over the member's hold"), "sent", "the marked rule's step over the member's hold on lamp a");
  mustEqual(sent().filter((x) => x.target === a.lamp && x.action === OFF).map((x) => x.for), [{ rule: "off-a" }], "the marked rule's step's for");
  await answered(ctx, c, a.lamp, "the marked rule's turn_off", { rule: "off-a" });
  await ctx.time.stepAndWait(2_000);
  const after = await leaseOf(ctx, a.lamp);
  ctx.evidence(`lamp a's lease before the pass ${JSON.stringify(before)}, after ${JSON.stringify(after)}`);
  must(after !== undefined && holderWord(after.holder) === "olga-app", `the pass did not leave the member's hold on lamp a: ${JSON.stringify(after?.holder ?? "no lease")}`);
  mustEqual(after!.expires, before!.expires, "the member's hold's expires after the marked rule passed it");
  mustEqual(await leaseLine(ctx, c, a.lamp), [], "lamp a's lease events after the marked rule passed the member's hold");
  const evA = await eventsAfter(ctx, c);
  const outA = evA.filter((e) => e.type === "outcome" && e.target === a.lamp && e.cause?.rule === "off-a");
  ctx.evidence(`the marked rule's outcome events on lamp a: ${JSON.stringify(outA)}`);
  must(outA.length > 0, "no outcome event of the marked rule's step on lamp a");
  for (const e of outA) must(e.holder === undefined, "the passing step's outcome event carries a holder", e);
  mustEqual(firedOf(evA, "late-a").length, 0, "the refused rule's firings when the marked rule passed the member's hold");
  // Again after a settle, so that a re-evaluation at the pass that lands late is still seen.
  await ctx.time.stepAndWait(1_000);
  await new Promise((r) => setTimeout(r, 500));
  mustEqual(firedOf(await eventsAfter(ctx, c), "late-a").length, 0, "the refused rule's firings a second after the marked rule passed the member's hold");

  // No switch: an unmarked rule is refused by a member's hold past its floor.
  const b = await bench(ctx, "op-b", ["lamp", "motion"]);
  await membersHold(ctx, b.lamp, "the member's turn_on of lamp b");
  await mustDefine(ctx, [whileMotion("off-b", b.motion, b.lamp)], "an unmarked rule turning lamp b off");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  motionOn(ctx, b.motion);
  mustEqual(await stepOf(ctx, c, sent, "off-b", b.lamp, OFF, "an unmarked rule, no switch set"), "refused(leased) olga-app",
    "an unmarked rule's step over a member's hold past its floor, no switch set");

  // Inside the floor: the member's step unacked and its report withheld, the marked rule is refused.
  const fl = await bench(ctx, "op-c", ["lamp", "motion"]);
  await mustDefine(ctx, [marked(whileMotion("off-c", fl.motion, fl.lamp))], "the owner's marked rule turning lamp c off");
  // The lamp reads on and the member's step is a turn_off left unacked and unreported, so the lamp still reads on and the
  // rule's turn_off is not `already` (a turn_on here would leave the lamp off, and the rule's turn_off would be skipped).
  reported(ctx, fl.lamp);
  applier.scriptOutcome(fl.lamp, OFF, { outcome: "failed", reason: "no_ack" });
  await holds(ctx, s.olga, "olga-app", fl.lamp, OFF, "olga-app", "the member's turn_off of lamp c, never acked", { acked: false });
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  motionOn(ctx, fl.motion);
  mustEqual(await stepOf(ctx, c, sent, "off-c", fl.lamp, OFF, "the marked rule inside the member's floor"), "refused(leased) olga-app",
    "the marked rule's step inside the member's hold's floor");

  // The person's own report: with lamp d's switch, the lamp's report of on, before the ack, ends the floor for passing.
  const d = await bench(ctx, "op-d", ["lamp"]);
  await deviceSwitch(ctx, d.lamp, true, "lamp d");
  await mustDefine(ctx, [up("rule", { id: "off-d", name: "off-d", conditions: [{ target: d.lamp, key: "on", op: "eq", value: true }],
    actions: [act(d.lamp, OFF)] })], "the unmarked rule lamp d on -> lamp d off");
  applier.scriptOutcome(d.lamp, ON, { outcome: "failed", reason: "no_ack" });
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  await holds(ctx, s.olga, "olga-app", d.lamp, ON, "olga-app", "the member's turn_on of lamp d, its ack not yet come", { acked: false });
  // The lamp reports on as a conforming applier sends it: caused by the member's apply, still unacked (GA-EVT-1).
  applier.scriptReportOfStep(d.lamp);
  mustEqual(await stepOf(ctx, c, sent, "off-d", d.lamp, OFF, "the rule the member's own report of on triggered"), "sent",
    "the rule's step triggered by the member's own report of on, before the ack");
  await holderIs(ctx, d.lamp, "olga-app", "after the rule passed the member's hold at her own report");

  // The device's switch: an unmarked rule passes, and the record names the switch.
  const e = await bench(ctx, "op-e", ["lamp", "motion"]);
  await deviceSwitch(ctx, e.lamp, true, "lamp e");
  const fromE = ctx.time.now();
  await membersHold(ctx, e.lamp, "the member's turn_on of lamp e");
  await mustDefine(ctx, [whileMotion("off-e", e.motion, e.lamp)], "an unmarked rule turning lamp e off");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  motionOn(ctx, e.motion);
  mustEqual(await stepOf(ctx, c, sent, "off-e", e.lamp, OFF, "an unmarked rule under the device's switch"), "sent", "an unmarked rule's step over a member's hold, the lamp's switch set");
  await answered(ctx, c, e.lamp, "the unmarked rule's turn_off of lamp e", { rule: "off-e" });
  await holderIs(ctx, e.lamp, "olga-app", "after the rule passed the member's hold on lamp e");
  const outE = await ruleOutcomesIn(ctx, s.owner, fromE, "off-e", e.lamp, "the owner's history");
  ctx.evidence(`the owner's history, off-e's outcome events on lamp e: ${JSON.stringify(outE)}`);
  for (const x of outE.filter((y) => y.outcome === "acked")) {
    mustEqual(x.passed_hold, { holder: { person: "olga", endpoint: "olga-app" }, switch: "device" }, "the passing step's outcome event's passed_hold in the owner's history");
  }

  // A switch set on a held hold: the home's switch, set after the member's hold was granted, passes it.
  const f = await bench(ctx, "op-f", ["lamp", "motion"]);
  await membersHold(ctx, f.lamp, "the member's turn_on of lamp f");
  await mustDefine(ctx, [whileMotion("off-f", f.motion, f.lamp)], "an unmarked rule turning lamp f off");
  await homeSwitch(ctx, true, "a switch set on a held hold");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  motionOn(ctx, f.motion);
  mustEqual(await stepOf(ctx, c, sent, "off-f", f.lamp, OFF, "an unmarked rule after the home's switch was set"), "sent",
    "an unmarked rule's step over a member's hold held before the home's switch was set");
  await holderIs(ctx, f.lamp, "olga-app", "after the rule passed the member's hold on lamp f");
  await homeSwitch(ctx, false, "a switch set on a held hold");

  // The cap: no switch passes a load_cap lease.
  const h = await bench(ctx, "op-cap", ["heater", "motion"]);
  reported(ctx, h.heater);
  await deviceSwitch(ctx, h.heater, true, "the heater");
  await homeSwitch(ctx, true, "the cap");
  applier.scriptValue(h.heater, "on", false, { cause: "load_cap" });
  await holderIs(ctx, h.heater, "load_cap", "the applier capped the heater");
  await mustDefine(ctx, [marked(whileMotion("on-cap", h.motion, h.heater, ON))], "the owner's marked rule turning the heater on");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  motionOn(ctx, h.motion);
  mustEqual(await stepOf(ctx, c, sent, "on-cap", h.heater, ON, "the marked rule under a load_cap lease"), "refused(leased) load_cap",
    "the marked rule's step under a load_cap lease, every switch set");
  await homeSwitch(ctx, false, "the cap");

  // Safety: no switch passes a safety rule's lease. The rule latches and completes, its lease held by the latch: a rule left
  // running has the stand-in refuse its devices' plans `safety` (GA-SAFE-2), which would hide the lease from the step. The
  // stand-in raises no `latched` (GA-SAFE-7) for the setpoint, another key than the latched mode.
  const [thermostat, tm] = await scripted(ctx, [{ fixture: "thermostat", adopt: "boiler", bridge: "op-t" }, { fixture: "motion", adopt: "sensor", bridge: "op-t" }]);
  const beforeRule = await revisionOf(ctx);
  applier.scriptSafetyRule({ id: "frost", actuates: [{ target: thermostat!, key: "mode", value: "off" }], latch: true });
  await pollUntil(async () => (await revisionOf(ctx)) > beforeRule || undefined, 10_000, "the steward did not follow the safety rule's model change", 100);
  applier.scriptSafetyFire("frost");
  // The holder's shape is an open question (the schema's bare "safety_rule", or one naming the rule): either is taken.
  const safetyWords = ["safety_rule", "safety:frost"];
  const safetyLease = await pollUntil(async () => {
    const l = await leaseOf(ctx, thermostat!);
    return l !== undefined && safetyWords.includes(holderWord(l.holder)) ? l : undefined;
  }, 10_000, "the latching safety rule set the thermostat's mode off: no safety rule's lease on it", 100);
  ctx.evidence(`the safety rule's lease on the thermostat: ${JSON.stringify(safetyLease)}`);
  await homeSwitch(ctx, true, "safety");
  await mustDefine(ctx, [marked(up("rule", { id: "set-t", name: "set-t", conditions: [{ target: tm!, key: "motion", op: "eq", value: true }],
    actions: [act(thermostat!, "climate.set_setpoint", { celsius: 18 })] }))], "the owner's marked rule setting the thermostat to 18");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  motionOn(ctx, tm!);
  const stepT = await stepOf(ctx, c, sent, "set-t", thermostat!, "climate.set_setpoint", "the marked rule under the safety rule's lease");
  must(safetyWords.some((w) => stepT === `refused(leased) ${w}`),
    `the marked rule's set_setpoint under the safety rule's lease, the home's switch set: expected refused(leased) by the safety rule, got ${stepT}`);
  await ctx.time.stepAndWait(2_000);
  mustEqual(sent().filter((x) => x.target === thermostat && x.action === "climate.set_setpoint").length, 0,
    "set_setpoint steps the stand-in received while the latch held");
  await homeSwitch(ctx, false, "safety");
  applier.scriptLatchClear("frost", "cleared_by_owner");

  // A brain's rename: the owner's marked rule a brain edited passes nothing.
  const j = await bench(ctx, "op-j", ["lamp", "motion"]);
  await mustDefine(ctx, [marked(whileMotion("off-j", j.motion, j.lamp))], "the owner's marked rule turning lamp j off");
  await byBrain(ctx, [up("rule", { id: "off-j", name: "Выключить лампу" })], "a rename of the owner's marked rule");
  const ruleJ = ((await ownerOf(ctx).callOk("describe")).rules as Record<string, unknown>[]).find((r) => r.id === "off-j");
  ctx.evidence(`the renamed rule: ${JSON.stringify(ruleJ)}`);
  mustEqual([ruleJ?.brain_authored, ruleJ?.passes_holds], [true, true], "the renamed rule's brain_authored and passes_holds");
  await membersHold(ctx, j.lamp, "the member's turn_on of lamp j");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  motionOn(ctx, j.motion);
  mustEqual(await stepOf(ctx, c, sent, "off-j", j.lamp, OFF, "the marked rule a brain renamed"), "refused(leased) olga-app",
    "the step of the owner's marked rule a brain renamed, over a member's hold");

  // A brain's group join: the lamp a brain added is not the owner's work.
  const g1 = await bench(ctx, "op-g1", ["lamp", "motion"]);
  const g2 = await bench(ctx, "op-g2", ["lamp"]);
  await mustDefine(ctx, [up("group", { id: "op-g", name: "op-g", room: null, members: [g1.lamp], aggregate: "any" }),
    marked(whileMotion("off-g", g1.motion, "op-g"))], "the owner's group of lamp g1 and the marked rule turning it off");
  await byBrain(ctx, [up("group", { id: "op-g", name: "op-g", room: null, members: [g1.lamp, g2.lamp], aggregate: "any" })], "lamp g2 added to the group");
  for (const l of [g1.lamp, g2.lamp]) await membersHold(ctx, l, `the member's turn_on of ${l}`);
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  motionOn(ctx, g1.motion);
  mustEqual(await stepOf(ctx, c, sent, "off-g", g1.lamp, OFF, "the marked rule on the owner's lamp of the group"), "sent",
    "the marked rule's step on the owner's lamp of its group");
  mustEqual(await stepOf(ctx, c, sent, "off-g", g2.lamp, OFF, "the marked rule on the lamp a brain grouped"), "refused(leased) olga-app",
    "the marked rule's step on the lamp a brain added to its group");

  // A press marked to pass: its own action stays a press, replacing the member's hold.
  const p = await bench(ctx, "op-h", ["button", "lamp"]);
  reported(ctx, p.lamp);
  await membersHold(ctx, p.lamp, "the member's turn_off of lamp h", OFF);
  await mustDefine(ctx, [onPress("press-h", p.button, [act(p.lamp, ON)], { extra: { passes_holds: true } })], "a press rule marked passes_holds turning lamp h on");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  press(ctx, p.button);
  mustEqual(await stepOf(ctx, c, sent, "press-h", p.lamp, ON, "the marked press over the member's hold"), "sent", "the marked press's step over the member's hold");
  const pressOut = await answered(ctx, c, p.lamp, "the marked press's turn_on", { rule: "press-h" });
  await holderIs(ctx, p.lamp, "press:press-h", "the marked press over the member's hold");
  mustEqual(await leaseLine(ctx, c, p.lamp), ["ended replaced olga-app", "granted press:press-h"], "the lease events of the marked press over the member's hold");
  must(pressOut.passed_hold === undefined, "the marked press's outcome event carries a passed_hold", pressOut);

  // A personal press passed: the guest reads the rule's outcome without passed_hold; the owner with it.
  const v = await bench(ctx, "op-i", ["shaker", "lamp", "motion"]);
  await mustDefine(ctx, [onPress("press-i", v.shaker, [act(v.lamp, ON)], { key: PERSONAL, value: true })], "a press rule on the shaker's personal key");
  const fromI = ctx.time.now();
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  press(ctx, v.shaker, true, PERSONAL);
  mustEqual(await stepOf(ctx, c, sent, "press-i", v.lamp, ON, "the personal press"), "sent", "the personal press's step");
  await answered(ctx, c, v.lamp, "the personal press", { rule: "press-i" });
  await holderIs(ctx, v.lamp, "press:press-i", "the personal press");
  await mustDefine(ctx, [marked(whileMotion("off-i", v.motion, v.lamp))], "the owner's marked rule turning lamp i off");
  c = await cursorNow(ctx);
  motionOn(ctx, v.motion);
  mustEqual(await stepOf(ctx, c, sent, "off-i", v.lamp, OFF, "the marked rule over the personal press's hold"), "sent", "the marked rule's step over the personal press's hold");
  const ownerI = await ruleOutcomesIn(ctx, s.owner, fromI, "off-i", v.lamp, "the owner's app's history");
  const guestI = await ruleOutcomesIn(ctx, s.panel, fromI, "off-i", v.lamp, "the guest panel's history");
  ctx.evidence(`off-i's outcome events on lamp i, the owner's app's history ${JSON.stringify(ownerI)}, the guest panel's ${JSON.stringify(guestI)}`);
  for (const x of guestI) must(!("passed_hold" in x), "the guest panel's history shows a passed_hold on the step that passed a personal press's hold", x);
  must(ownerI.some((x) => x.outcome === "acked" && x.passed_hold !== undefined), "the owner's app's history shows no passed_hold on the step that passed the press's hold (the control)");

  // The member's hold on lamp a ends at its own end, and the rule it refused fires then.
  const end = Date.parse((await leaseOf(ctx, a.lamp))!.expires);
  mustEqual(new Date(end).toISOString(), new Date(Date.parse(before!.expires)).toISOString(), "the member's hold on lamp a's expires before its end");
  c = await cursorNow(ctx);
  await stepTo(ctx, end + holdEndLatenessMs());
  await holderIs(ctx, a.lamp, undefined, "the member's hold on lamp a past its end", ctx.allowanceMs);
  await fires(ctx, c, "late-a", 1, "the rule the member's hold on lamp a refused, at that hold's end", ctx.allowanceMs);

  // Runs. They come after lamp a's end, so that their clock steps (schedules, holds' ends) end no hold an earlier part reads.

  // Through a run step: the marked rule's mark follows its run into the scenario a `run` step reaches. Lamp k is an open-loop
  // plug, so its steps end `sent` and the run's step is listed in `sent_steps`. No other switch is set, so only the rule's passes.
  const rk = await scripted(ctx, [{ fixture: "rfplug", adopt: "light", bridge: "op-rk" }, { fixture: "motion", adopt: "sensor", bridge: "op-rk" }]);
  const [kLamp, kMotion] = [rk[0]!, rk[1]!];
  await mustDefine(ctx, [scene("inner-k", [act(kLamp, OFF)]), scene("outer-k", [{ run: "inner-k" }]),
    marked(up("rule", { id: "start-k", name: "start-k", conditions: [{ target: kMotion, key: "motion", op: "eq", value: true }], actions: [{ scenario: "outer-k" }] }))],
  "scenario outer-k, whose run step reaches inner-k turning lamp k off, and the owner's marked rule starting outer-k");
  c = await cursorNow(ctx);
  await holds(ctx, s.olga, "olga-app", kLamp, ON, "olga-app", "the member's turn_on of lamp k", { acked: false });
  await answered(ctx, c, kLamp, "the member's turn_on of lamp k, open-loop", { outcome: "sent" });
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  motionOn(ctx, kMotion);
  mustEqual(await runStepOf(ctx, c, sent, kLamp, OFF, "the marked rule's run, through its run step, over the member's hold"), "sent",
    "the step a run step reached, in the marked rule's run, over the member's hold on lamp k");
  const kRun = String(sent().find((x) => x.target === kLamp && x.action === OFF)!.for.run);
  const kStatus = await pollUntil(async () => {
    const st = await ownerOf(ctx).callOk("scenario_status", { run_id: kRun });
    return (st.sent_steps as unknown[]).length > 0 ? st : undefined;
  }, 10_000, "the marked rule's run lists no sent step", 100);
  ctx.evidence(`the marked rule's run's scenario_status: ${JSON.stringify(kStatus)}`);
  mustEqual((kStatus.sent_steps as { passed_hold?: unknown }[]).map((x) => x.passed_hold), [{ holder: { person: "olga", endpoint: "olga-app" }, switch: "rule" }],
    "the passed_hold of the marked rule's run's sent step on lamp k");
  await holderIs(ctx, kLamp, "olga-app", "after the marked rule's run passed the member's hold on lamp k");

  // A run's lease: every switch set, the owner's marked rule is refused by a person-started run's lease.
  const rj = await bench(ctx, "op-rj", ["lamp", "motion"]);
  reported(ctx, rj.lamp);
  await deviceSwitch(ctx, rj.lamp, true, "lamp j of a run");
  await homeSwitch(ctx, true, "the runs");
  await mustDefine(ctx, [scene("keep-rj", [{ delay: 900 }], { owned: [rj.lamp] }), marked(whileMotion("off-rj", rj.motion, rj.lamp))],
    "a scenario owning lamp j, and the owner's marked rule turning it off");
  const jRun = await startRun(ctx, s.olga, "olga-app", "keep-rj");
  await holderIs(ctx, rj.lamp, `run:${jRun.run_id}`, "the member's run owning lamp j");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  motionOn(ctx, rj.motion);
  mustEqual(await stepOf(ctx, c, sent, "off-rj", rj.lamp, OFF, "the marked rule under a run's lease"), `refused(leased) run:${jRun.run_id}`,
    "the marked rule's step under a person-started run's lease, every switch set");

  // The home's switch over a schedule: a scheduled run passes an outside change's hold.
  const rm = await bench(ctx, "op-rm", ["lamp"]);
  applier.scriptValue(rm.lamp, "on", true, { cause: "external" });
  await holderIs(ctx, rm.lamp, "external", "lamp m switched on outside");
  await mustDefine(ctx, [scene("off-rm", [act(rm.lamp, OFF)])], "a scenario turning lamp m off");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  const mRun = await scheduleSoon(ctx, "off-rm-at", "off-rm");
  mustEqual(await runStepOf(ctx, c, sent, rm.lamp, OFF, "a scheduled run over the outside change's hold", mRun.run_id), "sent",
    "a scheduled run's step over the outside change's hold on lamp m, the home's switch set");
  await holderIs(ctx, rm.lamp, "external", "after the scheduled run passed the outside change's hold");

  // The run's lease waits (GA-SCN-2's clause): a scheduled run owning lamp n passes the member's hold, takes no lease while it
  // stands, and takes it at that hold's end, before the rule the hold refused is judged again.
  // late-n is a brain's rule (the owner saying yes), work no switch passes, so the member's hold refuses it with the home's
  // switch set throughout.
  const rn = await bench(ctx, "op-rn", ["lamp", "motion"]);
  await membersHold(ctx, rn.lamp, "the member's turn_on of lamp n");
  await mustDefine(ctx, [scene("keep-rn", [act(rn.lamp, OFF), { delay: 7_200 }], { owned: [rn.lamp] })], "a scenario owning lamp n turning it off");
  await byBrain(ctx, [whileMotion("late-n", rn.motion, rn.lamp)], "a brain's rule turning lamp n off");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  motionOn(ctx, rn.motion);
  mustEqual(await stepOf(ctx, c, sent, "late-n", rn.lamp, OFF, "the brain's rule under the member's hold"), "refused(leased) olga-app",
    "the brain's rule's step under the member's hold on lamp n, the home's switch set");
  c = await cursorNow(ctx);
  const nRun = await scheduleSoon(ctx, "keep-rn-at", "keep-rn");
  mustEqual(await runStepOf(ctx, c, sent, rn.lamp, OFF, "the scheduled run owning lamp n over the member's hold", nRun.run_id), "sent",
    "the scheduled run's turn_off over the member's hold on lamp n, the home's switch set");
  await answered(ctx, c, rn.lamp, "the scheduled run's turn_off of lamp n");
  await holderIs(ctx, rn.lamp, "olga-app", "the scheduled run owning lamp n started over the member's hold");
  // The lamp reads on again by its own report (no lease, GA-LEASE-2), so that late-n's turn_off at the hold's end is not `already`.
  reported(ctx, rn.lamp);
  await pollUntil(async () => (((await ownerOf(ctx).callOk("state", { targets: [rn.lamp] })).targets as Record<string, { values: { key: string; value: unknown }[] }>)[rn.lamp]
    ?.values ?? []).some((v) => v.key === "on" && v.value === true) || undefined, 10_000, "the steward never read lamp n on again", 100);
  const nEnd = await holdEnds(ctx, rn.lamp, "the member's hold on lamp n", { holder: "olga-app" });
  await holderIs(ctx, rn.lamp, `run:${nRun.run_id}`, "the scheduled run, once the member's hold on lamp n ended", ctx.allowanceMs);
  const nLine = (await leaseLine(ctx, nEnd.cursor, rn.lamp)).map((x) => x.replace(/^ended \S+ /, "ended "));
  mustEqual(nLine, ["ended olga-app", `granted run:${nRun.run_id}`], "lamp n's lease events at the member's hold's end");
  mustEqual(await stepOf(ctx, nEnd.cursor, sent, "late-n", rn.lamp, OFF, "the rule the member's hold refused, at its end"), `refused(leased) run:${nRun.run_id}`,
    "the step of the rule the member's hold on lamp n refused, judged again at its end");

  // A replaced passed hold: a scheduled run passes the guest panel's hold on lamp p; the member's turn_on replaces it, and the
  // device stays in question: inside the member's floor the run's step is refused, past it sent, and at its end the run leases it.
  const rp = await bench(ctx, "op-rp", ["lamp"]);
  await holds(ctx, s.panel, "hall-panel", rp.lamp, ON, "hall-panel", "the guest panel's turn_on of lamp p");
  await mustDefine(ctx, [scene("keep-rp", [act(rp.lamp, OFF), { delay: 60 }, act(rp.lamp, ON), { delay: 600 }, act(rp.lamp, ON), { delay: 7_200 }],
    { owned: [rp.lamp] })], "a scenario owning lamp p: off, on a minute later, on again ten minutes after");
  const ackP = await ackWithinOf(ctx, rp.lamp, ON);
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  const pRun = await scheduleSoon(ctx, "keep-rp-at", "keep-rp");
  mustEqual(await runStepOf(ctx, c, sent, rp.lamp, OFF, "the scheduled run owning lamp p over the guest's hold", pRun.run_id), "sent",
    "the scheduled run's turn_off over the guest panel's hold on lamp p");
  const first = await answered(ctx, c, rp.lamp, "the scheduled run's turn_off of lamp p");
  await holderIs(ctx, rp.lamp, "hall-panel", "the scheduled run passed the guest panel's hold on lamp p");
  // The member's turn_on, unacked and unreported, so the lamp reads off and the run's turn_on is not `already`.
  applier.scriptOutcome(rp.lamp, ON, { outcome: "failed", reason: "no_ack" });
  c = await cursorNow(ctx);
  const memberAt = ctx.time.now();
  await holds(ctx, s.olga, "olga-app", rp.lamp, ON, "olga-app", "the member's turn_on of lamp p over the guest's hold", { acked: false });
  mustEqual(await leaseLine(ctx, c, rp.lamp), ["ended replaced hall-panel", "granted olga-app"], "lamp p's lease events at the member's turn_on");
  const secondAt = Date.parse(first.time) + 60_000;
  must(secondAt > memberAt && secondAt < memberAt + (ackP + 60) * 1000, `the run's second step at ${new Date(secondAt).toISOString()} is not inside the member's floor`);
  c = await cursorNow(ctx);
  await stepTo(ctx, secondAt + 1_000);
  mustEqual(await runStepOf(ctx, c, sent, rp.lamp, ON, "the run's turn_on inside the member's floor", pRun.run_id), "refused(leased) olga-app",
    "the scheduled run's turn_on of lamp p inside the member's floor");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  await stepTo(ctx, secondAt + 600_000 + 2_000);
  mustEqual(await runStepOf(ctx, c, sent, rp.lamp, ON, "the run's turn_on past the member's floor", pRun.run_id), "sent",
    "the scheduled run's turn_on of lamp p past the member's floor, the home's switch set");
  await holderIs(ctx, rp.lamp, "olga-app", "after the run passed the member's hold on lamp p");
  const pEnd = await holdEnds(ctx, rp.lamp, "the member's hold on lamp p", { holder: "olga-app" });
  await holderIs(ctx, rp.lamp, `run:${pRun.run_id}`, "the scheduled run, once the member's hold on lamp p ended", ctx.allowanceMs);
  mustEqual((await leaseLine(ctx, pEnd.cursor, rp.lamp)).map((x) => x.replace(/^ended \S+ /, "ended ")), ["ended olga-app", `granted run:${pRun.run_id}`],
    "lamp p's lease events at the member's hold's end");

  // A run's own lease replaced: the run holds none on lamp q for the rest of the run.
  const rq = await bench(ctx, "op-rq", ["lamp"]);
  await mustDefine(ctx, [scene("keep-rq", [act(rq.lamp, ON), { delay: 7_200 }], { owned: [rq.lamp] })], "a scenario owning lamp q turning it on");
  c = await cursorNow(ctx);
  const qRun = await scheduleSoon(ctx, "keep-rq-at", "keep-rq");
  await holderIs(ctx, rq.lamp, `run:${qRun.run_id}`, "the scheduled run owning lamp q");
  await answered(ctx, c, rq.lamp, "the scheduled run's turn_on of lamp q");
  c = await cursorNow(ctx);
  await membersHold(ctx, rq.lamp, "the member's turn_off of lamp q over the run's lease", OFF);
  mustEqual(await leaseLine(ctx, c, rq.lamp), [`ended replaced run:${qRun.run_id}`, "granted olga-app"], "lamp q's lease events at the member's turn_off");
  const qEnd = await holdEnds(ctx, rq.lamp, "the member's hold on lamp q", { holder: "olga-app" });
  // No grant may come: read the lease and its events through a window of wall time, a late grant failing at once.
  await ctx.time.stepAndWait(2_000);
  const quietUntil = Date.now() + 2_000;
  while (Date.now() < quietUntil) {
    const l = await leaseOf(ctx, rq.lamp);
    must(l === undefined, `after the member's hold on lamp q ended, the run still going: lamp q held by ${JSON.stringify(l?.holder)}`);
    mustEqual((await leaseLine(ctx, qEnd.cursor, rq.lamp)).filter((x) => x.startsWith("granted")), [], "lamp q's granted lease events at the member's hold's end");
    await new Promise((r) => setTimeout(r, 200));
  }
  await runReads(ctx, qRun.run_id, "running", "the scheduled run owning lamp q, after the member's hold ended");

  // A step undoing a narrowing (*What no switch passes*): a valve closed by hand is not reopened by the home's switch; the
  // valve's own switch passes it. On the water valve opened by turn_on (its opens_with), and on the valve opened by valve.open.
  await homeSwitch(ctx, true, "the narrowing undone");
  for (const [fx, key, open] of [["watervalve", "on", ON], ["valve", "open", "valve.open"]] as const) {
    const v = (await bench(ctx, `op-rv-${fx}`, [fx]))[fx];
    if (fx === "watervalve") {
      applier.scriptOpensWith(v, "turn_on");
      await stewardSees(ctx, `${v} opens_with onoff.turn_on`, (dd) => targetIn(dd, v)?.opens_with === "onoff.turn_on");
    }
    applier.scriptValue(v, key, false, { cause: "external" });
    await holderIs(ctx, v, "external", `the ${fx} closed by hand`);
    await mustDefine(ctx, [scene(`open-${fx}`, [act(v, open)]), scene(`open2-${fx}`, [act(v, open)])], `two scenarios opening the ${fx}`);
    c = await cursorNow(ctx);
    sent = sentFrom(ctx);
    const homeRun = await scheduleSoon(ctx, `open-${fx}-at`, `open-${fx}`);
    mustEqual(await runStepOf(ctx, c, sent, v, open, `a scheduled run opening the ${fx}, only the home's switch set`, homeRun.run_id), "refused(leased) external",
      `a scheduled run's ${open} of the ${fx} closed by hand, only the home's switch set`);
    await holderIs(ctx, v, "external", `after the home's switch did not pass the hand's hold on the ${fx}`);
    await deviceSwitch(ctx, v, true, `the ${fx} closed by hand`);
    c = await cursorNow(ctx);
    sent = sentFrom(ctx);
    const deviceRun = await scheduleSoon(ctx, `open2-${fx}-at`, `open2-${fx}`);
    mustEqual(await runStepOf(ctx, c, sent, v, open, `a scheduled run opening the ${fx}, its own switch set`, deviceRun.run_id), "sent",
      `a scheduled run's ${open} of the ${fx} closed by hand, the ${fx}'s own switch set`);
  }
  await homeSwitch(ctx, false, "the runs");
});
