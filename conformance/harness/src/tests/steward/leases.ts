import { must, mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import { CHANNEL, LAMP } from "../../steward-home.js";
import { pollUntil } from "../../util.js";
import { applyInline, mustAccept, outcomes, sentFrom } from "./answers.js";
import { cursorNow, eventsAfter, firedOf, fires, laptop, limit, relayed, restartSteward, session, type Ev } from "./rules.js";
import { act, cursorExpiredGap, mustDefine, ownerOf, scripted, up } from "./util.js";

type Lease = { holder: unknown; precedence: string; expires: string };

/** A lease's holder as a word: an endpoint's id, a safety rule's id, or a cause. */
const holderOf = (h: unknown) => (typeof h === "string" ? h : (h as { safety_rule?: string; endpoint?: string }).safety_rule ?? (h as { endpoint?: string }).endpoint);

/** Each device's lease as the owner's `state` shows it, `target holder precedence`, the holder an endpoint's id, a safety rule's or a cause. */
async function leases(ctx: TestContext): Promise<string[]> {
  const l = ((await ownerOf(ctx).callOk("state")).leases ?? {}) as Record<string, Lease>;
  return Object.entries(l).map(([t, x]) => `${t} ${holderOf(x.holder)} ${x.precedence}`);
}

/** The `lease` events since `cursor`, `change target holder`. */
async function leaseEvents(ctx: TestContext, cursor: string): Promise<string[]> {
  const events = (await ownerOf(ctx).callOk("events", { cursor })).events as { type: string; change: string; target: string; holder: unknown }[];
  return events.filter((e) => e.type === "lease")
    .map((e) => `${e.change} ${e.target} ${holderOf(e.holder)}`);
}

/** A level rule turning the lamp off on motion, and an edge rule doing the same on motion's change, each at rule precedence. */
const offOn = (motion: string, id = "off") => ({ id, name: "Гасить по движению", conditions: [{ target: motion, key: "motion", op: "eq", value: true }],
  actions: [{ target: LAMP, action: "onoff.turn_off", args: {} }] });
const edgeOn = (motion: string) => ({ id: "edge", name: "Гасить при движении", trigger: { state: { target: motion, key: "motion", op: "eq", value: true } },
  actions: [{ target: LAMP, action: "onoff.turn_off", args: {} }] });

/** The `refused` events of rules since `cursor`, `rule target reason holder`, once `n` came. */
async function refusals(ctx: TestContext, cursor: string, n: number, what: string): Promise<string[]> {
  const holder = (h: unknown) => (typeof h === "string" ? h : (h as { endpoint?: string })?.endpoint);
  let seen: Ev[] = [];
  const got = await pollUntil(async () => {
    seen = await eventsAfter(ctx, cursor);
    const r = seen.filter((e: Ev) => e.type === "refused");
    return r.length >= n ? r : undefined;
  }, 10_000, `${what}: no refused event`, 100).catch((err: unknown) => {
    ctx.evidence(`events: ${JSON.stringify(seen.map((e) => [e.type, e.rule ?? e.target, e.outcome ?? e.change ?? e.value, e.reason]))}`);
    throw err;
  });
  return got.map((e) => `${e.rule} ${e.target} ${e.reason} ${holder(e.holder)}`).sort();
}

/** The owner's `state` leases until `want`, as the steward relays the stand-in's events. */
async function leasesBecome(ctx: TestContext, want: string[], what: string): Promise<void> {
  await pollUntil(async () => JSON.stringify(await leases(ctx)) === JSON.stringify(want) || undefined, 10_000,
    `${what}: the leases were ${JSON.stringify(await leases(ctx))}, not ${JSON.stringify(want)}`, 100);
}

requirement("GA-LEASE-1", {
  seam: "steward",
  covers: "the member's app turning the lamp on leases it to her, at person precedence, from dispatch until the hold time after, with a granted event; state shows it until then and not after, with an ended event; the owner's notify on the channel takes none, nor the owner's session.lock of the laptop; a rule's later turn_off of the lamp is refused(leased), naming her; her turn_on that the stand-in ends unreachable ends its lease then, with an ended event",
}, async (ctx) => {
  const s = ctx.steward!;
  const hold = constantMs("steward", "hold-time-default");
  const { cursor } = await ownerOf(ctx).callOk("events");
  const at = ctx.time.now();
  mustAccept(ctx, await applyInline(s.owner, "owner-app", [act(CHANNEL, "notify.notify", { text: "Проверка", urgency: "info" })]), "the owner's notify");
  outcomes(await applyInline(s.olga, "olga-app", [act(LAMP)]), "the member's apply");
  const state = (await ownerOf(ctx).callOk("state")).leases as Record<string, Lease>;
  ctx.evidence(`leases after the applies: ${JSON.stringify(state)}`);
  mustEqual(Object.keys(state), [LAMP], "the devices leased after a notify and a lamp on");
  mustEqual(state[LAMP]!.holder, { person: "olga", endpoint: "olga-app" }, "the lamp's lease holder");
  mustEqual(state[LAMP]!.precedence, "person", "the lamp's lease precedence");
  const expires = Date.parse(state[LAMP]!.expires);
  must(Math.abs(expires - (at + hold)) <= 2_000 + ctx.allowanceMs, `the lease expires at ${state[LAMP]!.expires}, not the hold time after dispatch`);
  const granted = await leaseEvents(ctx, cursor);
  ctx.evidence(`lease events after the applies: ${granted.join(", ")}`);
  mustEqual(granted, [`granted ${LAMP} olga-app`], "the lease events after the applies");
  // A rule's later action on the lamp is refused by her lease; the owner's lock of the laptop takes none.
  const [motion] = await scripted(ctx, [{ fixture: "motion", adopt: "sensor" }]);
  const pc = await laptop(ctx);
  await mustDefine(ctx, [up("rule", offOn(motion!))], "a rule turning the lamp off on motion");
  const c = await cursorNow(ctx);
  ctx.standIn!.applier.scriptValue(motion!, "motion", true, { cause: "device" });
  const refused = await refusals(ctx, c, 1, "motion with the lamp leased");
  ctx.evidence(`refused: ${refused.join(", ")}`);
  mustEqual(refused, [`off ${LAMP} leased olga-app`], "the rule's step on the leased lamp");
  session(ctx, pc, "liza", "active");
  await relayed(ctx, c, pc, "session.liza", "active", "Лиза's session");
  mustEqual(outcomes(await applyInline(s.owner, "owner-app", [act(pc, "session.lock", { account: "liza" })]), "the owner's lock"), [`${pc} dispatched`],
    "the owner's lock of the laptop");
  mustEqual(await leases(ctx), [`${LAMP} olga-app person`], "the leases after the owner's lock");
  await ctx.time.stepAndWait(hold - 5_000);
  mustEqual(await leases(ctx), [`${LAMP} olga-app person`], "the leases 5 s before the hold time ends");
  // The log keeps an hour of events: the end is read from a cursor taken just before it.
  const { cursor: late } = await ownerOf(ctx).callOk("events");
  await ctx.time.stepAndWait(10_000);
  await leasesBecome(ctx, [], "past the hold time");
  const ended = await leaseEvents(ctx, late);
  ctx.evidence(`lease events past the hold time: ${ended.join(", ")}`);
  mustEqual(ended, [`ended ${LAMP} olga-app`], "the lease events past the hold time");
  // The rule, refused while she held the lamp, turns it off once her lease ended (GA-LEASE-4): waited
  // for, so her next turn_on finds the lamp off under load too.
  await relayed(ctx, late, LAMP, "on", false, "the rule's turn_off once the lease ended");
  // A step that ends unreachable sent nothing: its lease ends then, not at the hold time (B5).
  // Ended 5 s after dispatch, so the lease is seen standing first, even on a loaded run.
  ctx.standIn!.applier.scriptOutcome(LAMP, "onoff.turn_on", { outcome: "unreachable", afterMs: 5_000 });
  const before = await cursorNow(ctx);
  mustEqual(outcomes(await applyInline(s.olga, "olga-app", [act(LAMP)]), "the member's turn_on the stand-in ends unreachable"), [`${LAMP} dispatched`],
    "the member's turn_on before it ends");
  await leasesBecome(ctx, [`${LAMP} olga-app person`], "after the member's turn_on");
  await ctx.time.stepAndWait(6_000);
  await pollUntil(async () => (await eventsAfter(ctx, before)).some((e) => e.type === "outcome" && e.target === LAMP && e.outcome === "unreachable") || undefined,
    10_000, "the stand-in's unreachable was not relayed", 100);
  await leasesBecome(ctx, [], "once the turn_on ended unreachable");
  const gone = await leaseEvents(ctx, before);
  ctx.evidence(`lease events around the unreachable step: ${gone.join(", ")}`);
  mustEqual(gone, [`granted ${LAMP} olga-app`, `ended ${LAMP} olga-app`], "the lease events of a step that ended unreachable");
});

requirement("GA-LEASE-2", {
  seam: "steward",
  covers: "an external change on the lamp and a load_cap change on a dimmer each take a lease at person precedence held by that cause; a device change on another lamp takes none; an external change on that lamp inside a cursor_expired gap, the gap lasting 10 minutes, takes its lease once the steward reads the gap back, expiring the hold time after the change, not after the gap; an external change on that lamp while the steward is down takes its lease after the restart",
}, async (ctx) => {
  const applier = ctx.standIn!.applier;
  const [dimmer, other] = await scripted(ctx, [{ fixture: "dimmer", adopt: "light" }, { fixture: "lamp", adopt: "light", bridge: "other-bridge" }]);
  applier.scriptValue(other!, "on", true, { cause: "device" });
  applier.scriptValue(LAMP, "on", true);
  applier.scriptValue(dimmer!, "on", true, { cause: "load_cap" });
  const want = [`${dimmer} load_cap person`, `${LAMP} external person`].sort();
  await leasesBecome(ctx, want, "after an external, a load_cap and a device change");
  ctx.evidence(`leases: ${(await leases(ctx)).join(", ")}`);
  // Missed in a gap: leased for what is left of the hold, from the stand-in's history.
  const hold = constantMs("steward", "hold-time-default");
  let at = 0;
  await cursorExpiredGap(ctx, async () => {
    at = ctx.time.now();
    applier.scriptValue(other!, "on", false);
    await ctx.time.stepAndWait(10 * 60_000);
  });
  await leasesBecome(ctx, [...want, `${other} external person`].sort(), "after an outside change inside a gap");
  const gapLeases = ((await ownerOf(ctx).callOk("state")).leases ?? {}) as Record<string, Lease>;
  must(gapLeases[other!] !== undefined, "the outside change inside the gap holds no lease when state is read", gapLeases);
  const expires = Date.parse(gapLeases[other!]!.expires);
  ctx.evidence(`changed at ${new Date(at).toISOString()}, leased until ${new Date(expires).toISOString()}`);
  must(Math.abs(expires - (at + hold)) <= 2_000 + ctx.allowanceMs, `the missed change's lease expires at ${new Date(expires).toISOString()}, not the hold time after the change`);
  // Missed while the steward was down: the restart's gap leases it as a cursor_expired gap's does.
  await ctx.time.stepAndWait(hold + 10_000);
  await leasesBecome(ctx, [], "after the hold time");
  await restartSteward(ctx, () => applier.scriptValue(other!, "on", true));
  await leasesBecome(ctx, [`${other} external person`], "after an outside change while the steward was down");
});

requirement("GA-LEASE-3", {
  seam: "steward",
  covers: "equal precedence replaces: the member's lease on the lamp is replaced by an external change's, and that by the hall panel's apply, the panel's apply dispatched; each a replaced event; a lower precedence is refused: a rule's turn_off of the lamp is refused(leased), naming the panel; a rule's session.lock of a laptop an external change leased is dispatched, the lease standing as it was; a safety rule turning the lamp on replaces the panel's lease with its own, a replaced event, and the panel's apply then is refused (the stand-in's refuse(safety) while the rule runs); a duck is slice 9's",
}, async (ctx) => {
  const s = ctx.steward!;
  const applier = ctx.standIn!.applier;
  const { cursor } = await ownerOf(ctx).callOk("events");
  const mine = await applyInline(s.olga, "olga-app", [act(LAMP)]);
  outcomes(mine, "the member's apply");
  // The lamp on, as the stand-in settles the apply; then someone turns it off at the switch.
  await pollUntil(async () => ((await s.olga.callOk("outcome", { apply_id: mine.body.apply_id })).outcomes as { outcome: string }[])
    .every((o) => o.outcome !== "dispatched") || undefined, 5_000, "the member's apply was not answered", 50);
  applier.scriptValue(LAMP, "on", false);
  await leasesBecome(ctx, [`${LAMP} external person`], "after the outside change");
  const panel = outcomes(await applyInline(s.panel, "hall-panel", [act(LAMP)]), "the panel's apply");
  ctx.evidence(`the panel's apply: ${panel.join(", ")}`);
  mustEqual(panel, [`${LAMP} dispatched`], "the panel's apply over the outside change's lease");
  await leasesBecome(ctx, [`${LAMP} hall-panel person`], "after the panel's apply");
  const events = await leaseEvents(ctx, cursor);
  ctx.evidence(`lease events: ${events.join(", ")}`);
  mustEqual(events, [`granted ${LAMP} olga-app`, `replaced ${LAMP} external`, `replaced ${LAMP} hall-panel`], "the lease events");
  // A lower precedence is refused; a session.lock is refused by no lease, and replaces none.
  const [motion] = await scripted(ctx, [{ fixture: "motion", adopt: "sensor" }]);
  const pc = await laptop(ctx);
  await mustDefine(ctx, [up("rule", offOn(motion!)), up("rule", limit(pc))], "a rule on the lamp and the limit");
  const c = await cursorNow(ctx);
  applier.scriptValue(motion!, "motion", true, { cause: "device" });
  const refused = await refusals(ctx, c, 1, "motion with the lamp leased to the panel");
  ctx.evidence(`refused: ${refused.join(", ")}`);
  mustEqual(refused, [`off ${LAMP} leased hall-panel`], "a rule's step on the lamp the panel leased");
  applier.scriptValue(pc, "session.dmitry", "active", { cause: "external" });
  await leasesBecome(ctx, [`${LAMP} hall-panel person`, `${pc} external person`].sort(), "after an outside change on the laptop");
  const sent = sentFrom(ctx);
  session(ctx, pc, "liza", "active");
  await fires(ctx, c, "limit", 1, "Лиза's session opening");
  await pollUntil(async () => sent().some((x) => x.action === "session.lock") || undefined, 10_000, "the limit's lock was not sent over the laptop's lease", 100);
  mustEqual(await leases(ctx), [`${LAMP} hall-panel person`, `${pc} external person`].sort(), "the leases after the rule's lock");
  // A safety rule is higher: it replaces the panel's lease, and the panel is then refused.
  const before = await cursorNow(ctx);
  applier.scriptSafetyRule({ id: "night", actuates: [{ target: LAMP, key: "on", value: false }] });
  applier.scriptSafetyFire("night", { complete: false });
  await leasesBecome(ctx, [`${LAMP} night safety_rule`, `${pc} external person`].sort(), "a safety rule actuating the lamp");
  mustEqual(await leaseEvents(ctx, before), [`replaced ${LAMP} night`], "the lease events of the safety rule's actuation");
  const panelAgain = outcomes(await applyInline(s.panel, "hall-panel", [act(LAMP)]), "the panel's apply under the safety rule's lease");
  ctx.evidence(`the panel's apply under the safety rule's lease: ${panelAgain.join(", ")}`);
  // The rule still running, the stand-in refuses the lamp `safety` (applier GA-SAFE-2), the applier's reason first in the
  // steward's order; a person refused(leased) by a safety rule's lease is GA-LEASE-6's case.
  mustEqual(panelAgain, [`${LAMP} refused(safety)`], "the panel's apply under the running safety rule");
});

requirement("GA-LEASE-4", {
  seam: "steward",
  covers: "the member leases the lamp; motion makes a level rule and an edge rule turning it off each refused(leased); when the lease ends the level rule fires again and its turn_off reaches the stand-in, and the edge rule does not fire; the member's turn_off of the lamp, now off, ends skipped(already), and the level rule, still holding, does not fire again (no lease ended: a provisional one lifted is no lease's end); a lease of hers that refused nothing ends and the rule, fired and holding, does not fire; HS3: a hand on the switch (an external change) leases the lamp and a rule defined then is refused, a second touch a minute later replaces the lease with nothing re-evaluated, and the rule fires when the second lease ends; a lease that refused a further rule ends inside an exception granted after the refusal, and that rule does not fire",
}, async (ctx) => {
  const s = ctx.steward!;
  const hold = constantMs("steward", "hold-time-default");
  const [motion] = await scripted(ctx, [{ fixture: "motion", adopt: "sensor" }]);
  const c0 = await cursorNow(ctx);
  outcomes(await applyInline(s.olga, "olga-app", [act(LAMP)]), "the member's apply");
  await relayed(ctx, c0, LAMP, "on", true, "the lamp on");
  await mustDefine(ctx, [up("rule", offOn(motion!)), up("rule", edgeOn(motion!))], "a level and an edge rule on the lamp");
  const c = await cursorNow(ctx);
  ctx.standIn!.applier.scriptValue(motion!, "motion", true, { cause: "device" });
  mustEqual(await refusals(ctx, c, 2, "motion with the lamp leased"), [`edge ${LAMP} leased olga-app`, `off ${LAMP} leased olga-app`], "the rules' refusals");
  await ctx.time.stepAndWait(hold - 5_000);
  // The log keeps an hour of events: the lease's end is read from a cursor taken just before it.
  const late = await cursorNow(ctx);
  const sent = sentFrom(ctx);
  await ctx.time.stepAndWait(10_000);
  const events = await fires(ctx, late, "off", 1, "the lease ending");
  ctx.evidence(`after the lease ended: ${events.map((e) => `${e.type}${e.rule ? ` ${e.rule}` : ""}`).join(", ")}`);
  mustEqual(firedOf(events, "edge").length, 0, "the edge rule's firings when the lease ended");
  await pollUntil(async () => sent().some((x) => x.target === LAMP && x.action === "onoff.turn_off" && x.key?.startsWith("rule:off:")) || undefined,
    10_000, "the level rule's turn_off did not reach the stand-in after the lease ended", 100);
  // A person's step the stand-in skips lays a provisional lease that is lifted: no lease ends, so the
  // level rule, still holding, is not fired again (the milestone review, B6).
  await relayed(ctx, late, LAMP, "on", false, "the lamp off by the level rule");
  const already = await cursorNow(ctx);
  mustEqual(outcomes(await applyInline(s.olga, "olga-app", [act(LAMP, "onoff.turn_off")]), "the member's turn_off of the lamp already off"),
    [`${LAMP} skipped(already)`], "the member's turn_off of the lamp already off");
  await ctx.time.stepAndWait(5_000);
  const after = await eventsAfter(ctx, already);
  ctx.evidence(`after the member's skipped turn_off: ${after.map((e) => `${e.type}${e.rule ? ` ${e.rule}` : ""}`).join(", ")}`);
  mustEqual(firedOf(after, "off").length, 0, "the level rule's firings after a person's step ended skipped(already)");

  // A lease that refused nothing ends with nothing re-evaluated: the level rule, fired and still holding, stays fired.
  outcomes(await applyInline(s.olga, "olga-app", [act(LAMP)]), "the member's turn_on, which the rule does not meet");
  await ctx.time.stepAndWait(hold - 5_000);
  const quiet = await cursorNow(ctx);
  await ctx.time.stepAndWait(15_000);
  const quietAfter = await eventsAfter(ctx, quiet);
  ctx.evidence(`after a lease that refused nothing ended: ${quietAfter.map((e) => `${e.type}${e.rule ? ` ${e.rule}` : ""}`).join(", ")}`);
  mustEqual(firedOf(quietAfter, "off").length, 0, "the level rule's firings when a lease that refused nothing ended");

  // HS3: a hand on the switch leases the lamp (`external`), and a rule defined then, motion holding, is
  // refused; a second touch replaces the lease, which takes over the rule the first one refused, re-evaluated at its end.
  const hand = (on: boolean) => ctx.standIn!.applier.scriptValue(LAMP, "on", on, { cause: "external" });
  hand(false);
  await ctx.time.stepAndWait(1_000);
  hand(true);
  await ctx.time.stepAndWait(1_000);
  const touched = await cursorNow(ctx);
  await mustDefine(ctx, [up("rule", offOn(motion!, "hs3"))], "a level rule turning the lamp off on motion, under the first touch's lease");
  mustEqual(await refusals(ctx, touched, 1, "the rule under the first touch's lease"), [`hs3 ${LAMP} leased external`],
    "the rule's refusal under the first touch's lease");
  await ctx.time.stepAndWait(60_000);
  const second = await cursorNow(ctx);
  hand(false);
  await ctx.time.stepAndWait(1_000);
  hand(true);
  await ctx.time.stepAndWait(5_000);
  const atSecond = await eventsAfter(ctx, second);
  ctx.evidence(`at the second touch: ${atSecond.map((e) => `${e.type}${e.rule ? ` ${e.rule}` : ""}`).join(", ")}`);
  mustEqual(atSecond.filter((e) => e.type === "refused" || (e.type === "rule_fired" && e.rule === "hs3")).length, 0,
    "the rule's re-evaluations at the second touch");
  await ctx.time.stepAndWait(hold - 15_000);
  const handed = await cursorNow(ctx);
  await ctx.time.stepAndWait(20_000);
  await fires(ctx, handed, "hs3", 1, "the second touch's lease ending");

  // A re-evaluation fires a rule only outside its exceptions (GA-RULE-6).
  await relayed(ctx, handed, LAMP, "on", false, "the lamp off by the rule");
  hand(true);
  await ctx.time.stepAndWait(1_000);
  const third = await cursorNow(ctx);
  await mustDefine(ctx, [up("rule", offOn(motion!, "late"))], "a second level rule, under the third touch's lease");
  await refusals(ctx, third, 1, "the second rule under the third touch's lease");
  const now = ctx.time.now();
  await mustDefine(ctx, [up("rule_exception", { rule: "late", from: new Date(now).toISOString(), until: new Date(now + hold + 1_800_000).toISOString() })],
    "an exception for the second rule past the lease's end");
  await ctx.time.stepAndWait(hold - 15_000);
  const excepted = await cursorNow(ctx);
  await ctx.time.stepAndWait(25_000);
  const inException = await eventsAfter(ctx, excepted);
  ctx.evidence(`after a lease ended inside the second rule's exception: ${inException.map((e) => `${e.type}${e.rule ? ` ${e.rule}` : ""}`).join(", ")}`);
  mustEqual(firedOf(inException, "late").length, 0, "the second rule's firings when the lease ended inside its exception");
});

requirement("GA-LEASE-5", {
  seam: "steward",
  covers: "a rule turning the lamp on at motion reaches the stand-in, the lamp comes on, and no lease is taken: state shows none and no lease event is put",
}, async (ctx) => {
  const [motion] = await scripted(ctx, [{ fixture: "motion", adopt: "sensor" }]);
  await mustDefine(ctx, [up("rule", { id: "on", name: "Свет", conditions: [{ target: motion, key: "motion", op: "eq", value: true }],
    actions: [{ target: LAMP, action: "onoff.turn_on", args: {} }] })], "a rule turning the lamp on");
  const c = await cursorNow(ctx);
  ctx.standIn!.applier.scriptValue(motion!, "motion", true, { cause: "device" });
  await fires(ctx, c, "on", 1, "motion");
  const events = await relayed(ctx, c, LAMP, "on", true, "the lamp coming on");
  ctx.evidence(`events: ${events.map((e) => e.type).join(", ")}`);
  mustEqual(events.filter((e) => e.type === "lease").length, 0, "lease events after a rule's action");
  mustEqual(await leases(ctx), [], "the leases after a rule's action");
});
