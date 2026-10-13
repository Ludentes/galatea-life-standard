import { must, mustEqual, RequirementFailure } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { requirement } from "../../registry.js";
import type { McpSeam } from "../../seams/mcp.js";
import { pollUntil } from "../../util.js";
import { applyInline, outcomes, sentFrom } from "./answers.js";
import { byBrain } from "./brain.js";
import { cursorNow, eventsAfter, firedOf, fires, type Ev } from "./rules.js";
import { kiosk, scene, startRun } from "./scenarios.js";
import { scheduleSoon } from "./schedules.js";
import { answered, expiresBetween, holdEnds, stepOf } from "./hold-helpers.js";
import { ackWithinOf, act, asCredential, del, holdEndLatenessMs, holderWord, leaseEventsSince, leaseOf, mustDefine, mustRefuse, pinHold, raiseTier, revisionOf,
  scripted, SECOND, setFlag, stewardSees, targetIn, up, wall } from "./util.js";

const ON = "onoff.turn_on";
const OFF = "onoff.turn_off";
const LOCK = "lock.lock";
/** The scripted button's occurrence key (the sim's `button`): each press an occurrence, never state. */
const KEY = "org.galatea.test.button.action";
/** The vibration sensor's (the sim's `shaker`) occurrence key its device keeps `personal`. */
const PERSONAL = "org.galatea.test.vibration.presence";

type Fx = "button" | "lamp" | "dimmer" | "motion" | "heater" | "doorlock" | "watervalve" | "valve" | "shaker";
const ADOPT: Record<Fx, string> = { button: "sensor", lamp: "light", dimmer: "light", motion: "sensor", heater: "socket", doorlock: "door_lock",
  watervalve: "water_valve", valve: "water_valve", shaker: "sensor" };

/**
 * Fixture devices scripted on a bridge of their own, adopted as their class, no room: each part of a
 * check has its own, so no lease, rule or occurrence of one part meets another's. Their ids, by fixture.
 */
async function bench<F extends Fx>(ctx: TestContext, bridge: string, fixtures: F[]): Promise<Record<F, string>> {
  const ids = await scripted(ctx, fixtures.map((f) => ({ fixture: f, adopt: ADOPT[f], bridge })));
  return Object.fromEntries(fixtures.map((f, i) => [f, ids[i]!])) as Record<F, string>;
}

/** The holder a press rule's hold names: the rule and the occurrence, never a person (GA-LEASE-9). */
const pressHolder = (rule: string, button: string, value = "1_single") => ({ rule, press: { target: button, key: KEY, value } });

/** A rule on `button`'s occurrence `value` of `key`, marked `press` unless told not to, with `actions` and `extra` over it. */
const onPress = (id: string, button: string, actions: unknown[],
  o: { key?: string; value?: unknown; press?: boolean; extra?: Record<string, unknown> } = {}) =>
  up("rule", { id, name: id, trigger: { event: { target: button, type: "occurrence", key: o.key ?? KEY, value: o.value ?? "1_single",
    ...(o.press === false ? {} : { press: true }) } }, actions, ...o.extra });

/** A level rule doing `action` on `target` while `motion` reads true: the owner's rule a hold refuses or lets through. */
const whileMotion = (id: string, motion: string, target: string, action = OFF) => up("rule", { id, name: id,
  conditions: [{ target: motion, key: "motion", op: "eq", value: true }], actions: [{ target, action, args: {} }] });

/** A level rule locking `door` while it reads unlocked (HS18's auto-lock). */
const autoLock = (id: string, door: string) => up("rule", { id, name: id, conditions: [{ target: door, key: "locked", op: "eq", value: false }],
  actions: [{ target: door, action: LOCK, args: {} }] });

/** The scripted button pressed: an occurrence on its key (applier, *Occurrences*). */
const press = (ctx: TestContext, button: string, value: unknown = "1_single", key = KEY) =>
  ctx.standIn!.applier.scriptEvent("occurrence", { target: button, key, value, cause: "device" });

/** Motion on the scripted sensor, as its device reports it: takes no lease (GA-LEASE-2). */
const motionOn = (ctx: TestContext, motion: string, value = true) => ctx.standIn!.applier.scriptValue(motion, "motion", value, { cause: "device" });

/**
 * `target`'s lease holder until it reads `want` (undefined: no lease), polled for `wallMs` of wall time (10 s; the run's
 * allowance after a computed end, R-20); the lease.
 */
async function holderIs(ctx: TestContext, target: string, want: string | undefined, what: string,
  wallMs = 10_000): Promise<{ holder: unknown; precedence: string; expires: string } | undefined> {
  let got: Awaited<ReturnType<typeof leaseOf>>;
  const word = () => (got ? holderWord(got.holder) : undefined);
  await pollUntil(async () => {
    got = await leaseOf(ctx, target);
    return word() === want || undefined;
  }, wallMs, what, 100).catch((err: unknown) => {
    if (!(err instanceof RequirementFailure)) throw err;
    throw new RequirementFailure(`${what}: ${target}'s lease is ${got ? `held by ${JSON.stringify(got.holder)}` : "none"}, not ${want ?? "none"}`, got);
  });
  ctx.evidence(`${what}: ${target} ${got ? `${JSON.stringify(got.holder)} ${got.precedence} until ${got.expires}` : "no lease"}`);
  return got;
}

/** An apply from `seam` at `endpoint` of `action` on `target`, dispatched, and its hold `holder` (a word) taken. */
async function holds(ctx: TestContext, seam: McpSeam, endpoint: string, target: string, action: string, holder: string, what: string,
  o: { speaker?: string; acked?: boolean } = {}): Promise<void> {
  const c = await cursorNow(ctx);
  mustEqual(outcomes(await applyInline(seam, endpoint, [act(target, action)], undefined, o), what), [`${target} dispatched`], what);
  await holderIs(ctx, target, holder, what);
  if (o.acked !== false) await answered(ctx, c, target, what);
}

/**
 * What became of a run's step on `target` since `cursor` (of `run` when named): `refused(<reason>) <holder>` from its
 * `refused` event, or `sent` once the stand-in received `action` for a run.
 */
async function runStepOf(ctx: TestContext, cursor: string, sent: ReturnType<typeof sentFrom>, target: string, action: string, what: string,
  run?: string): Promise<string> {
  const got = await pollUntil(async () => {
    const ev = await eventsAfter(ctx, cursor);
    const r = ev.find((e) => e.type === "refused" && typeof e.run === "string" && (run === undefined || e.run === run) && e.target === target);
    if (r) return `refused(${r.reason}) ${holderWord(r.holder)}`;
    return sent().some((x) => x.target === target && x.action === action && typeof x.for?.run === "string" && (run === undefined || x.for.run === run))
      ? "sent" : undefined;
  }, 10_000, `${what}: a run's step on ${target} was neither sent nor refused`, 100);
  ctx.evidence(`${what}: a run's step on ${target}: ${got}`);
  return got;
}

/**
 * A hold on `target` held by `holder` (a word) ending at its `expires` (R-20), its ended event naming `end`; then each of
 * `rules`, refused by it, fires.
 */
async function endsAndFires(ctx: TestContext, target: string, holder: string, end: string, rules: string[], what: string): Promise<void> {
  const { cursor } = await holdEnds(ctx, target, what, { holder, end });
  for (const r of rules) await fires(ctx, cursor, r, 1, `${what}: the rule it refused at its end`, ctx.allowanceMs);
}

/** The `lease` events of `target` since `cursor`, each `change end holder`, with ` restored` when marked so. */
async function leaseLine(ctx: TestContext, cursor: string, target: string): Promise<string[]> {
  return (await leaseEventsSince(ctx, cursor)).filter((e) => e.target === target)
    .map((e) => `${e.change}${e.end ? ` ${e.end}` : ""} ${holderWord(e.holder)}${e.restored === true ? " restored" : ""}`);
}

/** A device's `key` (`on` unless told) reported `value` by the device itself, taking no lease: a person's step setting it otherwise is then not `already`. */
const reported = (ctx: TestContext, target: string, key = "on", value: unknown = true) => ctx.standIn!.applier.scriptValue(target, key, value, { cause: "device" });

requirement("GA-LEASE-9", {
  seam: "steward",
  covers: "under the pinned windows, the button's press rule (`press: true` on its occurrence) turns a lamp off over the member's turn_on hold, which refused an off rule: the step is sent `via: rule`, `for: { rule }`, the member's hold ended `replaced` and the press's granted after it, held by `{ rule, press: { target, key, value } }` at person precedence, the off rule passing to it unfired, a rule defined then refused by it; deleting the press rule leaves its hold; at its end (`fixed_s` from dispatch) both rules fire; a press on a lamp nobody holds takes that hold, which, with schedule_ends set false (a steward that refuses it: skipped and said), refuses a scheduled run's step; a press replaces the guest panel's hold; a latching safety rule's lease on a dimmer's level, a `load_cap` lease and a person-started run's lease each refuse the press `leased`; a press rule's `{ scenario }` action starts a run whose step the member's hold refuses, no press hold taken; a press on the shaker's personal key holds the lamp, and the guest panel's, a visitor's and the no-endpoint brain's state, events and history show neither the hold nor its lease events, nor the holder of a rule's step it refuses, each showing the non-personal press's hold and refusal holder; a press whose step the stand-in plans skipped(already) leaves the member's hold and the off rule it refused unfired; the same trigger unmarked, and a `1_double` occurrence on the press rule's key read by an unmarked rule, are each refused `leased` by the member's hold; a press rule whose `between` condition excludes the hour does not fire; a press's `confirm` step is sent with its author's token, not skipped; define refuses `press` on a liveness trigger `invalid_request`, the revision unchanged; a press rule a brain defined is refused by the member's hold, and of a group an owner's press rule acts on, the lamp a brain added is refused while the owner's lamp takes the press's hold; a press whose step ends unreachable ends its hold `unreachable` and restores the member's hold, granted `restored: true` with its role and its own expires, the off rule unfired until that hold's end, when it fires; a press rule's `lock.lock` over an outside unlock's hold is sent and takes no hold",
}, async (ctx) => {
  const s = ctx.steward!;
  const applier = ctx.standIn!.applier;
  const pol = await pinHold(ctx);
  // Where the guest, visitor and no-endpoint reads of the personal press begin, the non-personal press's hold and refusal among them.
  const visitor = await kiosk(ctx);
  const readFrom = { cursor: await cursorNow(ctx), at: ctx.time.now() };

  // Over a member's hold (HS35): the press replaces it, at person precedence, held by the rule and the occurrence.
  const a = await bench(ctx, "press-a", ["button", "lamp", "motion"]);
  await holds(ctx, s.olga, "olga-app", a.lamp, ON, "olga-app", "the member's turn_on of lamp a");
  await mustDefine(ctx, [onPress("press-a", a.button, [act(a.lamp, OFF)]), whileMotion("off-a", a.motion, a.lamp)], "the press rule on lamp a and an off rule");
  let c = await cursorNow(ctx);
  let sent = sentFrom(ctx);
  motionOn(ctx, a.motion);
  mustEqual(await stepOf(ctx, c, sent, "off-a", a.lamp, OFF, "the off rule under the member's hold"), "refused(leased) olga-app", "the off rule under the member's hold on lamp a");
  c = await cursorNow(ctx);
  const pressed = ctx.time.now();
  press(ctx, a.button);
  mustEqual(await stepOf(ctx, c, sent, "press-a", a.lamp, OFF, "the press over the member's hold"), "sent", "the press's step over the member's hold");
  const pressSent = ctx.time.now();
  // It stays the rule's in everything but precedence: `via: rule`, `for: { rule }`.
  mustEqual(sent().filter((x) => x.target === a.lamp && x.action === OFF).map((x) => [x.via, x.for?.rule]), [["rule", "press-a"]], "the press's step's via and for");
  const held = await holderIs(ctx, a.lamp, "press:press-a", "the press over the member's hold");
  mustEqual(held!.holder, pressHolder("press-a", a.button), "the press's hold's holder");
  mustEqual(held!.precedence, "person", "the press's hold's precedence");
  // A roomless lamp: the press's hold ends fixed_s from its dispatch, which lies between the press and the step seen sent.
  await expiresBetween(ctx, a.lamp, pressed + pol.fixed_s * SECOND, pressSent + pol.fixed_s * SECOND, "the press's hold on lamp a, fixed_s from dispatch");
  await answered(ctx, c, a.lamp, "the press over the member's hold", { rule: "press-a" });
  mustEqual(await leaseLine(ctx, c, a.lamp), ["ended replaced olga-app", "granted press:press-a"], "the lease events of the press over the member's hold");
  // The rule the member's hold refused passes to the press's hold, not re-judged at the replacement; a rule defined now is refused by it.
  mustEqual(firedOf(await eventsAfter(ctx, c), "off-a").length, 0, "the off rule's firings when the press replaced the member's hold");
  c = await cursorNow(ctx);
  await mustDefine(ctx, [whileMotion("late-a", a.motion, a.lamp, ON)], "a rule turning lamp a on");
  mustEqual(await stepOf(ctx, c, sent, "late-a", a.lamp, ON, "a rule under the press's hold"), "refused(leased) press:press-a", "a rule's turn_on under the press's hold");
  // A person's hold outlives its rule.
  await mustDefine(ctx, [del("rule", { id: "press-a" })], "the press rule deleted");
  await ctx.time.stepAndWait(1_000);
  const after = await leaseOf(ctx, a.lamp);
  ctx.evidence(`lamp a's lease after the press rule was deleted: ${JSON.stringify(after)}`);
  must(after !== undefined && holderWord(after.holder) === "press:press-a", `the press's hold on lamp a did not outlive its rule's deletion: ${JSON.stringify(after?.holder ?? "no lease")}`);

  // A press on a lamp nobody holds takes a person's hold.
  const b = await bench(ctx, "press-b", ["button", "lamp"]);
  await mustDefine(ctx, [onPress("press-b", b.button, [act(b.lamp, ON)])], "the press rule on lamp b");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  press(ctx, b.button);
  mustEqual(await stepOf(ctx, c, sent, "press-b", b.lamp, ON, "the press on a lamp nobody holds"), "sent", "the press's step on a lamp nobody holds");
  await answered(ctx, c, b.lamp, "the press on a lamp nobody holds", { rule: "press-b" });
  await holderIs(ctx, b.lamp, "press:press-b", "the press on a lamp nobody holds");
  mustEqual(await leaseLine(ctx, c, b.lamp), ["granted press:press-b"], "the lease events of a press on a lamp nobody holds");
  // While it holds, the press's hold refuses a scheduled run's action as any person's hold does; with schedule_ends
  // false, so that the run's step does not end it instead (GA-LEASE-7).
  if (await setFlag(ctx, "schedule_ends", false, ["GA-LEASE-9: the press's hold refusing a scheduled run's step (schedule_ends false)"])) {
    await mustDefine(ctx, [scene("night-b", [act(b.lamp, OFF)])], "a scenario turning lamp b off");
    c = await cursorNow(ctx);
    sent = sentFrom(ctx);
    const nightB = await scheduleSoon(ctx, "night-b-at", "night-b");
    mustEqual(await runStepOf(ctx, c, sent, b.lamp, OFF, "a scheduled run under the press's hold", nightB.run_id), "refused(leased) press:press-b",
      "a scheduled run's step under the press's hold");
    await mustDefine(ctx, [up("home", { hold: { schedule_ends: null } })], "schedule_ends back to the steward's own");
  }

  // A run a person started refuses a press, though at its own precedence.
  const rp = await bench(ctx, "press-p", ["button", "lamp"]);
  await mustDefine(ctx, [scene("keep-p", [{ delay: 900 }], { owned: [rp.lamp] }), onPress("press-p", rp.button, [act(rp.lamp, ON)])],
    "a scenario owning lamp p and a press rule on it");
  const keepP = await startRun(ctx, s.olga, "olga-app", "keep-p");
  await holderIs(ctx, rp.lamp, `run:${keepP.run_id}`, "the member's run owning lamp p");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  press(ctx, rp.button);
  mustEqual(await stepOf(ctx, c, sent, "press-p", rp.lamp, ON, "the press under a person-started run's lease"), `refused(leased) run:${keepP.run_id}`,
    "the press's step under a person-started run's lease");

  // A press rule's `{ scenario }` action starts a run as any rule's does: its step is the run's, refused by the member's hold, and no press hold is taken.
  const q = await bench(ctx, "press-q", ["button", "lamp"]);
  reported(ctx, q.lamp);
  await holds(ctx, s.olga, "olga-app", q.lamp, OFF, "olga-app", "the member's turn_off of lamp q");
  await mustDefine(ctx, [scene("on-q", [act(q.lamp, ON)], { owned: [q.lamp] }), onPress("press-q", q.button, [{ scenario: "on-q" }])],
    "a scenario turning lamp q on and a press rule starting it");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  press(ctx, q.button);
  mustEqual(await runStepOf(ctx, c, sent, q.lamp, ON, "the run a press rule started"), "refused(leased) olga-app", "the step of the run a press rule started");
  await holderIs(ctx, q.lamp, "olga-app", "after the run a press rule started");
  mustEqual(await leaseLine(ctx, c, q.lamp), [], "lamp q's lease events after the run a press rule started");

  // A press on a personal occurrence key: its hold, its lease events, and the holder of a step it refuses are withheld from a guest.
  // A guest's own plan step meets the press's hold at equal precedence and replaces it, so the refusal is a rule's.
  const v = await bench(ctx, "press-v", ["shaker", "lamp", "motion"]);
  await mustDefine(ctx, [onPress("press-v", v.shaker, [act(v.lamp, ON)], { key: PERSONAL, value: true }), whileMotion("off-v", v.motion, v.lamp)],
    "a press rule on the shaker's personal key and an off rule");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  press(ctx, v.shaker, true, PERSONAL);
  mustEqual(await stepOf(ctx, c, sent, "press-v", v.lamp, ON, "the personal press"), "sent", "the personal press's step");
  await holderIs(ctx, v.lamp, "press:press-v", "the personal press");
  await answered(ctx, c, v.lamp, "the personal press", { rule: "press-v" });
  c = await cursorNow(ctx);
  motionOn(ctx, v.motion);
  mustEqual(await stepOf(ctx, c, sent, "off-v", v.lamp, OFF, "a rule under the personal press's hold"), "refused(leased) press:press-v",
    "a rule's step under the personal press's hold, as the owner reads it");
  // Each reader the personal value is withheld from: the guest panel, a visitor's kiosk and the brain with no endpoint. Each
  // must see lamp a's (non-personal) press hold and late-a's refusal naming it, so that a reader shown nothing passes nothing.
  const readers: [string, (fn: (seam: McpSeam) => Promise<void>) => Promise<void>][] = [["the guest panel", (fn) => fn(s.panel)],
    ["a visitor's kiosk", (fn) => asCredential(ctx, visitor, fn)], ["the brain with no endpoint", (fn) => fn(s.brain)]];
  for (const [who, as] of readers) {
    await as(async (seam) => {
      const leases = ((await seam.callOk("state")).leases ?? {}) as Record<string, { holder: unknown }>;
      const events = (await seam.callOk("events", { cursor: readFrom.cursor })).events as Ev[];
      const history = (await seam.callOk("history", { from: new Date(readFrom.at).toISOString(), to: new Date(ctx.time.now() + 60_000).toISOString() }))
        .events as Ev[];
      ctx.evidence(`${who}: leases of lamps a and v ${JSON.stringify([leases[a.lamp], leases[v.lamp]])}; events ${events.length}, history ${history.length}`);
      must(holderWord(leases[a.lamp]?.holder) === "press:press-a", `${who}'s state does not show the non-personal press's hold on lamp a (the control)`, leases[a.lamp]);
      must(leases[v.lamp] === undefined, `${who}'s state shows the personal press's hold: ${JSON.stringify(leases[v.lamp])}`);
      for (const [where, list] of [["events", events], ["history", history]] as const) {
        must(list.some((e) => e.type === "refused" && e.target === a.lamp && holderWord(e.holder) === "press:press-a"),
          `${who}'s ${where} do not show late-a's refusal naming the non-personal press's hold (the control)`);
        mustEqual(list.filter((e) => e.type === "lease" && e.target === v.lamp).length, 0, `the personal press's lease events in ${who}'s ${where}`);
        for (const e of list.filter((x) => x.type === "refused" && x.target === v.lamp)) {
          must(e.holder === undefined, `${who}'s ${where} name the personal press's hold as a refusal's holder`, e);
        }
      }
    });
  }

  // A press replaces a guest's hold too (GA-LEASE-10 not applying).
  const g = await bench(ctx, "press-g", ["button", "lamp"]);
  await holds(ctx, s.panel, "hall-panel", g.lamp, ON, "hall-panel", "the guest panel's turn_on of lamp g");
  await mustDefine(ctx, [onPress("press-g", g.button, [act(g.lamp, OFF)])], "the press rule on lamp g");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  press(ctx, g.button);
  mustEqual(await stepOf(ctx, c, sent, "press-g", g.lamp, OFF, "the press over the guest's hold"), "sent", "the press's step over the guest's hold");
  await holderIs(ctx, g.lamp, "press:press-g", "the press over the guest's hold");
  mustEqual(await leaseLine(ctx, c, g.lamp), ["ended replaced hall-panel", "granted press:press-g"], "the lease events of the press over the guest's hold");

  // Only a person's hold gives way: a safety rule's lease and a load_cap lease each refuse the press. The safety rule
  // latches and completes, so its lease is held by its latch while the stand-in refuses nothing `safety` (a running
  // rule's devices are refused `safety` by the applier, GA-SAFE-2, which would hide the lease). It actuates the dimmer's
  // `level` while the press sends `onoff.turn_on`, so an applier that refuses `latched` (GA-SAFE-7) for the latched key
  // would not meet the press either; the stand-in raises no `latched`.
  const sf = await bench(ctx, "press-s", ["button", "dimmer"]);
  // A model change: followed (the revision moved) before the press rules' define reads the revision (as GA-LEASE-11's).
  const beforeRule = await revisionOf(ctx);
  applier.scriptSafetyRule({ id: "press-latch", actuates: [{ target: sf.dimmer, key: "level", value: 10 }], latch: true });
  await pollUntil(async () => (await revisionOf(ctx)) > beforeRule || undefined, 10_000, "the steward did not follow the safety rule's model change", 100);
  applier.scriptSafetyFire("press-latch");
  await holderIs(ctx, sf.dimmer, "safety:press-latch", "the latching safety rule fired on dimmer s");
  const cap = await bench(ctx, "press-c", ["button", "heater"]);
  reported(ctx, cap.heater);
  applier.scriptValue(cap.heater, "on", false, { cause: "load_cap" });
  await holderIs(ctx, cap.heater, "load_cap", "the applier capped the heater");
  await mustDefine(ctx, [onPress("press-s", sf.button, [act(sf.dimmer, ON)]), onPress("press-c", cap.button, [act(cap.heater, ON)])],
    "the press rules on dimmer s and the heater");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  press(ctx, sf.button);
  press(ctx, cap.button);
  mustEqual(await stepOf(ctx, c, sent, "press-s", sf.dimmer, ON, "the press under a safety rule's lease"), "refused(leased) safety:press-latch",
    "the press's step under a safety rule's lease");
  mustEqual(await stepOf(ctx, c, sent, "press-c", cap.heater, ON, "the press under a load_cap lease"), "refused(leased) load_cap",
    "the press's step under a load_cap lease");
  applier.scriptLatchClear("press-latch", "cleared_by_owner");

  // A press already done leaves the member's hold, and the rule it refused, as they were.
  const k = await bench(ctx, "press-k", ["button", "lamp", "motion"]);
  await holds(ctx, s.olga, "olga-app", k.lamp, ON, "olga-app", "the member's turn_on of lamp k");
  await mustDefine(ctx, [whileMotion("off-k", k.motion, k.lamp), onPress("press-k", k.button, [act(k.lamp, ON)])], "an off rule and the press rule on lamp k");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  motionOn(ctx, k.motion);
  mustEqual(await stepOf(ctx, c, sent, "off-k", k.lamp, OFF, "the off rule under the member's hold"), "refused(leased) olga-app", "the off rule under the member's hold");
  c = await cursorNow(ctx);
  press(ctx, k.button);
  mustEqual(await stepOf(ctx, c, sent, "press-k", k.lamp, ON, "the press of a lamp already on"), "skipped(already)", "the press's step on a lamp already on");
  await ctx.time.stepAndWait(2_000);
  const kept = await leaseOf(ctx, k.lamp);
  ctx.evidence(`lamp k's lease after the press already done: ${JSON.stringify(kept)}`);
  must(kept !== undefined && holderWord(kept.holder) === "olga-app", `a press already done ended the member's hold on lamp k: ${JSON.stringify(kept?.holder ?? "no lease")}`);
  mustEqual(firedOf(await eventsAfter(ctx, c), "off-k").length, 0, "the off rule's firings after a press already done");

  // Only the author's mark makes a press: the same trigger unmarked, and an unmarked rule on another value of the press rule's key.
  const d = await bench(ctx, "press-d", ["button", "lamp"]);
  const d2 = await bench(ctx, "press-d2", ["button"]);
  reported(ctx, d.lamp);
  await holds(ctx, s.olga, "olga-app", d.lamp, OFF, "olga-app", "the member's turn_off of lamp d");
  await mustDefine(ctx, [onPress("press-d", d.button, [act(d.lamp, ON)]), onPress("double-d", d.button, [act(d.lamp, ON)], { value: "1_double", press: false }),
    onPress("plain-d", d2.button, [act(d.lamp, ON)], { press: false })], "the press rule, an unmarked rule on 1_double and the same trigger unmarked");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  press(ctx, d.button, "1_double");
  mustEqual(await stepOf(ctx, c, sent, "double-d", d.lamp, ON, "an unmarked rule on the press rule's key"), "refused(leased) olga-app",
    "an unmarked rule's step on another value of the press rule's key");
  press(ctx, d2.button);
  mustEqual(await stepOf(ctx, c, sent, "plain-d", d.lamp, ON, "the same trigger unmarked"), "refused(leased) olga-app", "the step of the same trigger unmarked");
  await holderIs(ctx, d.lamp, "olga-app", "after occurrences no press rule read");

  // A press rule's conditions still apply: one whose window excludes the hour does not fire, beside one with none that does.
  const e = await bench(ctx, "press-e", ["button", "lamp"]);
  const e2 = await bench(ctx, "press-e2", ["lamp"]);
  const h = (Number(wall(ctx.time.now()).hhmm.slice(0, 2)) + 2) % 24;
  const from = `${String(h).padStart(2, "0")}:00`;
  const until = `${String(h).padStart(2, "0")}:30`;
  await mustDefine(ctx, [onPress("late-e", e.button, [act(e.lamp, ON)], { extra: { conditions: [{ between: { from, until } }] } }),
    onPress("mark-e", e.button, [act(e2.lamp, ON)])], `a press rule between ${from} and ${until}, and one with no condition`);
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  press(ctx, e.button);
  mustEqual(await stepOf(ctx, c, sent, "mark-e", e2.lamp, ON, "the press rule with no condition"), "sent", "the press rule with no condition");
  await answered(ctx, c, e2.lamp, "the press rule with no condition", { rule: "mark-e" });
  const evE = await eventsAfter(ctx, c);
  ctx.evidence(`at ${wall(ctx.time.now()).hhmm}, the press rule between ${from} and ${until}: fired ${firedOf(evE, "late-e").length} time(s)`);
  mustEqual(firedOf(evE, "late-e").length, 0, `firings of a press rule whose condition is between ${from} and ${until}, at ${wall(ctx.time.now()).hhmm}`);
  mustEqual(sent().filter((x) => x.target === e.lamp).length, 0, "actions the stand-in received for the press rule outside its condition");

  // A press's confirm step counts as answered by its author, as every rule's does (GA-SCN-4).
  const t = await bench(ctx, "press-t", ["button", "lamp"]);
  await raiseTier(ctx, t.lamp, ON, "confirm");
  await mustDefine(ctx, [onPress("press-t", t.button, [act(t.lamp, ON)])], "a press rule on a confirm step");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  press(ctx, t.button);
  mustEqual(await stepOf(ctx, c, sent, "press-t", t.lamp, ON, "the press's confirm step"), "sent", "the press's confirm step, defined from the owner's app");
  mustEqual(sent().filter((x) => x.target === t.lamp && x.action === ON).map((x) => x.token), [true], "the press's confirm step's token");

  // `press` only on an occurrence trigger.
  const rev = await revisionOf(ctx);
  const code = await mustRefuse(ctx, [up("rule", { id: "press-live", name: "press-live", trigger: { event: { target: t.lamp, type: "liveness", press: true } },
    actions: [act(t.lamp, ON)] })], "a press rule on a liveness trigger");
  mustEqual(code, "invalid_request", "define of press on a liveness trigger");
  mustEqual(await revisionOf(ctx), rev, "the revision after define refused press on a liveness trigger");

  // A brain's work acts at rule precedence: a press rule a brain wrote, and a lamp a brain added to the group an owner's press rule acts on.
  const w = await bench(ctx, "press-w", ["button", "lamp"]);
  const gr = await bench(ctx, "press-h", ["button", "lamp"]);
  const gr2 = await bench(ctx, "press-h2", ["lamp"]);
  await mustDefine(ctx, [up("group", { id: "press-h-group", name: "press-h-group", room: null, members: [gr.lamp], aggregate: "any" }),
    onPress("press-h", gr.button, [{ target: "press-h-group", action: ON, args: {} }])], "a group and the owner's press rule on it");
  await byBrain(ctx, [onPress("press-w", w.button, [act(w.lamp, ON)])], "a press rule on lamp w");
  await byBrain(ctx, [up("group", { id: "press-h-group", name: "press-h-group", room: null, members: [gr.lamp, gr2.lamp], aggregate: "any" })],
    "a lamp added to the press rule's group");
  for (const l of [w.lamp, gr.lamp, gr2.lamp]) {
    reported(ctx, l);
    await holds(ctx, s.olga, "olga-app", l, OFF, "olga-app", `the member's turn_off of ${l}`);
  }
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  press(ctx, w.button);
  press(ctx, gr.button);
  mustEqual(await stepOf(ctx, c, sent, "press-w", w.lamp, ON, "the brain's press rule"), "refused(leased) olga-app", "the step of a press rule a brain defined");
  mustEqual(await stepOf(ctx, c, sent, "press-h", gr2.lamp, ON, "the press on the lamp a brain grouped"), "refused(leased) olga-app",
    "the press's step on the lamp a brain added to its group");
  mustEqual(await stepOf(ctx, c, sent, "press-h", gr.lamp, ON, "the press on the owner's lamp of the group"), "sent", "the press's step on the owner's lamp of its group");
  await holderIs(ctx, gr.lamp, "press:press-h", "the press on the owner's lamp of the group");
  for (const l of [w.lamp, gr2.lamp]) await holderIs(ctx, l, "olga-app", `${l} after a brain's press`);

  // A press whose step ends unreachable cancels no one's hold: the member's is restored, and the rule it refused stays refused.
  const u = await bench(ctx, "press-u", ["button", "lamp", "motion"]);
  await holds(ctx, s.olga, "olga-app", u.lamp, ON, "olga-app", "the member's turn_on of lamp u");
  const memberU = (await leaseOf(ctx, u.lamp))!.expires;
  await mustDefine(ctx, [whileMotion("off-u", u.motion, u.lamp), onPress("press-u", u.button, [act(u.lamp, OFF)])], "an off rule and the press rule on lamp u");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  motionOn(ctx, u.motion);
  mustEqual(await stepOf(ctx, c, sent, "off-u", u.lamp, OFF, "the off rule under the member's hold"), "refused(leased) olga-app", "the off rule under the member's hold on lamp u");
  // Ended 5 s after dispatch, so the press's hold is seen first.
  applier.scriptOutcome(u.lamp, OFF, { outcome: "unreachable", afterMs: 5_000 });
  const cu = await cursorNow(ctx);
  press(ctx, u.button);
  mustEqual(await stepOf(ctx, cu, sent, "press-u", u.lamp, OFF, "the press that ends unreachable"), "sent", "the press's step that ends unreachable");
  await holderIs(ctx, u.lamp, "press:press-u", "the press that ends unreachable, before it does");
  await ctx.time.stepAndWait(6_000);
  await answered(ctx, cu, u.lamp, "the press's step", { rule: "press-u", outcome: "unreachable" });
  await holderIs(ctx, u.lamp, "olga-app", "once the press's step ended unreachable");
  mustEqual(await leaseLine(ctx, cu, u.lamp), ["ended replaced olga-app", "granted press:press-u", "ended unreachable press:press-u", "granted olga-app restored"],
    "the lease events of a press that ended unreachable");
  const restored = (await leaseEventsSince(ctx, cu)).find((x) => x.target === u.lamp && x.restored === true)!;
  mustEqual(restored.role, "member", "the restored hold's role");
  mustEqual((await leaseOf(ctx, u.lamp))?.expires, memberU, "the restored hold's expires, the member's hold's own");
  await ctx.time.stepAndWait(2_000);
  mustEqual(firedOf(await eventsAfter(ctx, cu), "off-u").length, 0, "the off rule's firings once the press ended unreachable and the member's hold was restored");

  // A press's narrowing action passes the hold and takes none (GA-LEASE-11).
  const l = await bench(ctx, "press-l", ["button", "doorlock"]);
  applier.scriptValue(l.doorlock, "locked", false, { cause: "external" });
  await holderIs(ctx, l.doorlock, "external", "the outside unlock of the door");
  await mustDefine(ctx, [onPress("press-l", l.button, [act(l.doorlock, LOCK)])], "a press rule locking the door");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  press(ctx, l.button);
  mustEqual(await stepOf(ctx, c, sent, "press-l", l.doorlock, LOCK, "the press's lock.lock"), "sent", "the press's lock.lock over the outside unlock's hold");
  await answered(ctx, c, l.doorlock, "the press's lock.lock", { rule: "press-l" });
  const door = await leaseOf(ctx, l.doorlock);
  ctx.evidence(`the door's lease after the press's lock: ${JSON.stringify(door)}`);
  must(door !== undefined && holderWord(door.holder) === "external", `the press's lock.lock took the door's hold: ${JSON.stringify(door?.holder ?? "no lease")}`);
  mustEqual(await leaseLine(ctx, c, l.doorlock), [], "the door's lease events after the press's lock");

  // The press's hold ends as an apply's does (fixed_s from dispatch here), the rules it held back firing then; the
  // restored member's hold ends at its own end, the rule it refused firing then.
  await endsAndFires(ctx, a.lamp, "press:press-a", "window", ["off-a", "late-a"], "the press's hold on lamp a");
  await endsAndFires(ctx, u.lamp, "olga-app", "window", ["off-u"], "the member's restored hold on lamp u");
});

requirement("GA-LEASE-10", {
  seam: "steward",
  covers: "under the pinned windows, with owner_work_passes_guest_holds set true through define (a steward that refuses it: skipped and said): the guest panel's turn_on holds the lamp, granted with role guest; once acked, the owner's rule turning it off is sent and the lease stays the panel's; a run a rule started sends its turn_off through the panel's acked hold, which stays; inside the floor of a panel's turn_off the stand-in does not ack, the rule is refused `leased`, again once the step has failed, and once the floor has passed it is sent, the hold standing; a member's hold refuses the rule; a brain-defined rule is refused by the panel's hold; the hold of a brain-served endpoint's apply naming the member as speaker, granted member, refuses the rule, and one naming none, granted guest, lets it through; a scheduled run owning the lamp, started while the panel's hold stands, sends its turn_off through it, takes no lease while it stands, and takes the lamp's lease when that hold ends at its window; with the flag set false (when taken) the panel's hold refuses the rule; the flag then null; that guest's hold not ended by the scheduled run's step when schedule_ends is set true (a steward that refuses the flag: skipped and said; not built in the reference)",
}, async (ctx) => {
  const s = ctx.steward!;
  await pinHold(ctx);
  const passes = await setFlag(ctx, "owner_work_passes_guest_holds", true, ["guest-hold-blocks-the-owner", "brain-rule-passes-a-guest", "passes-a-member-hold",
    "named-speaker-is-a-guest", "passes-inside-the-floor", "two-leases-at-once"]);
  if (passes) {
    // The owner's rule through a guest's hold whose floor has passed: sent, the hold staying.
    const ga = await bench(ctx, "guest-a", ["lamp", "motion"]);
    await mustDefine(ctx, [whileMotion("off-ga", ga.motion, ga.lamp)], "the owner's rule turning lamp a off");
    let c = await cursorNow(ctx);
    let sent = sentFrom(ctx);
    await holds(ctx, s.panel, "hall-panel", ga.lamp, ON, "hall-panel", "the guest panel's turn_on of lamp a");
    const granted = (await leaseEventsSince(ctx, c)).find((e) => e.target === ga.lamp && e.change === "granted");
    ctx.evidence(`the panel's hold granted: ${JSON.stringify(granted)}`);
    mustEqual(granted?.role, "guest", "the role the panel's hold's granted event names");
    c = await cursorNow(ctx);
    motionOn(ctx, ga.motion);
    mustEqual(await stepOf(ctx, c, sent, "off-ga", ga.lamp, OFF, "the owner's rule over the guest's acked hold"), "sent", "the owner's rule over the guest's acked hold");
    await answered(ctx, c, ga.lamp, "the owner's rule's turn_off", { rule: "off-ga" });
    await holderIs(ctx, ga.lamp, "hall-panel", "after the owner's rule passed the guest's hold");

    // A run a rule started, the owner's work too, passes the guest's hold the same way.
    const gs = await bench(ctx, "guest-s", ["lamp", "motion"]);
    await mustDefine(ctx, [scene("night-s", [act(gs.lamp, OFF)]), up("rule", { id: "start-s", name: "start-s",
      conditions: [{ target: gs.motion, key: "motion", op: "eq", value: true }], actions: [{ scenario: "night-s" }] })], "a rule starting a run turning lamp s off");
    await holds(ctx, s.panel, "hall-panel", gs.lamp, ON, "hall-panel", "the guest panel's turn_on of lamp s");
    c = await cursorNow(ctx);
    sent = sentFrom(ctx);
    motionOn(ctx, gs.motion);
    mustEqual(await runStepOf(ctx, c, sent, gs.lamp, OFF, "a rule-started run over the guest's acked hold"), "sent", "a rule-started run's step over the guest's acked hold");
    await answered(ctx, c, gs.lamp, "the rule-started run's turn_off");
    await holderIs(ctx, gs.lamp, "hall-panel", "after the rule-started run passed the guest's hold");

    // Inside the floor the guest's hold refuses the owner's rule; past it, the rule goes through.
    const gf = await bench(ctx, "guest-f", ["lamp", "motion"]);
    await mustDefine(ctx, [whileMotion("off-gf", gf.motion, gf.lamp)], "the owner's rule turning lamp f off");
    // The guest's turn_off fails unacked, the lamp staying on, so the rule's turn_off is not `already`.
    reported(ctx, gf.lamp);
    const ackS = await ackWithinOf(ctx, gf.lamp, OFF);
    ctx.standIn!.applier.scriptOutcome(gf.lamp, OFF, { outcome: "failed", reason: "no_ack" });
    c = await cursorNow(ctx);
    sent = sentFrom(ctx);
    const at = ctx.time.now();
    await holds(ctx, s.panel, "hall-panel", gf.lamp, OFF, "hall-panel", "the guest panel's turn_off of lamp f, never acked", { acked: false });
    motionOn(ctx, gf.motion);
    mustEqual(await stepOf(ctx, c, sent, "off-gf", gf.lamp, OFF, "the owner's rule inside the guest's floor"), "refused(leased) hall-panel",
      "the owner's rule inside the guest's hold's floor");
    // Its step failed (no ack) and its floor still running, the rule made true again is refused again.
    await ctx.time.stepAndWait(at + ackS * 1000 + 1_000 - ctx.time.now());
    await answered(ctx, c, gf.lamp, "the guest's turn_off", { outcome: "failed" });
    motionOn(ctx, gf.motion, false);
    await ctx.time.stepAndWait(1_000);
    c = await cursorNow(ctx);
    motionOn(ctx, gf.motion);
    mustEqual(await stepOf(ctx, c, sent, "off-gf", gf.lamp, OFF, "the owner's rule after the guest's step failed, inside its floor"), "refused(leased) hall-panel",
      "the owner's rule after the guest's step failed, inside its floor");
    const floor = at + (ackS + 60) * 1000;
    await ctx.time.stepAndWait(floor + holdEndLatenessMs() - ctx.time.now());
    await holderIs(ctx, gf.lamp, "hall-panel", "past the guest's floor");
    // Its condition made true again past the floor: a steward that re-judged the rule at the floor sent it already.
    motionOn(ctx, gf.motion, false);
    await ctx.time.stepAndWait(1_000);
    motionOn(ctx, gf.motion);
    await pollUntil(async () => sent().some((x) => x.target === gf.lamp && x.action === OFF && x.for?.rule === "off-gf") || undefined, ctx.allowanceMs,
      "past the guest's floor, the owner's rule's turn_off did not reach the stand-in", 100);
    await holderIs(ctx, gf.lamp, "hall-panel", "after the owner's rule passed the guest's hold past its floor");

    // No other hold is passed: a member's.
    const gm = await bench(ctx, "guest-m", ["lamp", "motion"]);
    reported(ctx, gm.lamp);
    await holds(ctx, s.olga, "olga-app", gm.lamp, OFF, "olga-app", "the member's turn_off of lamp m");
    await mustDefine(ctx, [whileMotion("on-gm", gm.motion, gm.lamp, ON)], "the owner's rule turning lamp m on");
    c = await cursorNow(ctx);
    sent = sentFrom(ctx);
    motionOn(ctx, gm.motion);
    mustEqual(await stepOf(ctx, c, sent, "on-gm", gm.lamp, ON, "the owner's rule over a member's hold"), "refused(leased) olga-app", "the owner's rule over a member's acked hold");

    // No brain_authored work passes.
    const gb = await bench(ctx, "guest-b", ["lamp", "motion"]);
    await byBrain(ctx, [whileMotion("off-gb", gb.motion, gb.lamp)], "a rule turning lamp b off");
    await holds(ctx, s.panel, "hall-panel", gb.lamp, ON, "hall-panel", "the guest panel's turn_on of lamp b");
    c = await cursorNow(ctx);
    sent = sentFrom(ctx);
    motionOn(ctx, gb.motion);
    mustEqual(await stepOf(ctx, c, sent, "off-gb", gb.lamp, OFF, "a brain's rule over the guest's hold"), "refused(leased) hall-panel", "a brain-defined rule over the guest's acked hold");

    // Through a brain-served endpoint: a named member's hold is no guest's; one with no derived person is.
    const gn = await bench(ctx, "guest-n", ["lamp", "motion"]);
    const go = await bench(ctx, "guest-o", ["lamp", "motion"]);
    await mustDefine(ctx, [whileMotion("off-gn", gn.motion, gn.lamp), whileMotion("off-go", go.motion, go.lamp)], "the owner's rules turning lamps n and o off");
    c = await cursorNow(ctx);
    await holds(ctx, s.brain, "kitchen-voice", gn.lamp, ON, "kitchen-voice", "the brain's turn_on of lamp n naming the member", { speaker: "olga" });
    await holds(ctx, s.brain, "kitchen-voice", go.lamp, ON, "kitchen-voice", "the brain's turn_on of lamp o naming no speaker");
    const roles = Object.fromEntries((await leaseEventsSince(ctx, c)).filter((e) => e.change === "granted").map((e) => [e.target, e.role]));
    ctx.evidence(`the brain's holds' roles: ${JSON.stringify(roles)}`);
    mustEqual(roles[gn.lamp], "member", "the role of the hold of a brain-served apply naming the member");
    mustEqual(roles[go.lamp], "guest", "the role of the hold of a brain-served apply naming no speaker");
    c = await cursorNow(ctx);
    sent = sentFrom(ctx);
    motionOn(ctx, gn.motion);
    motionOn(ctx, go.motion);
    mustEqual(await stepOf(ctx, c, sent, "off-gn", gn.lamp, OFF, "the owner's rule over a brain's apply naming the member"), "refused(leased) kitchen-voice",
      "the owner's rule over the hold of a brain-served apply naming the member");
    mustEqual(await stepOf(ctx, c, sent, "off-go", go.lamp, OFF, "the owner's rule over a brain's apply naming no one"), "sent",
      "the owner's rule over the hold of a brain-served apply naming no speaker");

    // A scheduled run owning the lamp takes no lease while the guest's hold stands, passes it, and takes the lease at its end.
    const g2 = await bench(ctx, "guest-r", ["lamp"]);
    await holds(ctx, s.panel, "hall-panel", g2.lamp, ON, "hall-panel", "the guest panel's turn_on of lamp r");
    const hold = await leaseOf(ctx, g2.lamp);
    const end = Date.parse(hold!.expires);
    await mustDefine(ctx, [scene("keep-r", [act(g2.lamp, OFF), { delay: 4_000 }], { owned: [g2.lamp] })], "a scenario owning lamp r");
    // A guest's hold the owner's scheduled run passes is not ended by it, schedule_ends or not.
    const ends = await setFlag(ctx, "schedule_ends", true, ["GA-LEASE-10: a guest's hold not ended by a schedule's step (schedule_ends)"]);
    sent = sentFrom(ctx);
    const { run_id } = await scheduleSoon(ctx, "keep-r-at", "keep-r");
    await pollUntil(async () => sent().some((x) => x.target === g2.lamp && x.action === OFF && x.for?.run === run_id) || undefined, 10_000,
      "the scheduled run's turn_off of lamp r did not reach the stand-in through the guest's hold", 100);
    const during = await leaseOf(ctx, g2.lamp);
    ctx.evidence(`lamp r's lease with the run started: ${JSON.stringify(during)}`);
    must(during !== undefined && holderWord(during.holder) === "hall-panel",
      `the scheduled run started while the guest's hold stood took lamp r: ${JSON.stringify(during?.holder ?? "no lease")}`);
    must(end - ctx.time.now() > 60_000, `the guest's hold on lamp r ends at ${hold!.expires}, too soon to test the run`);
    await ctx.time.stepAndWait(end - 5_000 - ctx.time.now());
    await holderIs(ctx, g2.lamp, "hall-panel", "5 s before the guest's hold on lamp r ends");
    await ctx.time.stepAndWait(end + holdEndLatenessMs() - ctx.time.now());
    await holderIs(ctx, g2.lamp, `run:${run_id}`, "once the guest's hold on lamp r ended, the run still going", ctx.allowanceMs);
    if (ends) await mustDefine(ctx, [up("home", { hold: { schedule_ends: null } })], "schedule_ends back to the steward's own");
  }

  // Undeclared, the owner's work passes no guest's hold.
  if (await setFlag(ctx, "owner_work_passes_guest_holds", false, ["passes-undeclared"])) {
    const gu = await bench(ctx, "guest-u", ["lamp", "motion"]);
    await mustDefine(ctx, [whileMotion("off-gu", gu.motion, gu.lamp)], "the owner's rule turning lamp u off");
    await holds(ctx, s.panel, "hall-panel", gu.lamp, ON, "hall-panel", "the guest panel's turn_on of lamp u");
    const c = await cursorNow(ctx);
    const sent = sentFrom(ctx);
    motionOn(ctx, gu.motion);
    mustEqual(await stepOf(ctx, c, sent, "off-gu", gu.lamp, OFF, "the owner's rule with the flag false"), "refused(leased) hall-panel",
      "the owner's rule over the guest's acked hold, owner_work_passes_guest_holds false");
  }
  await mustDefine(ctx, [up("home", { hold: { owner_work_passes_guest_holds: null } })], "owner_work_passes_guest_holds back to the steward's own");
});

requirement("GA-LEASE-11", {
  seam: "steward",
  covers: "under the pinned windows: HS18, an outside unlock holds the door, and an auto-lock rule's lock.lock a minute later is sent, the lease staying the outside change's, no lease event; a brain-defined auto-lock is refused `leased` by that hold; on a water valve declared `opens_with: onoff.turn_off`, the member's onoff.turn_on (closing) takes no lease and no lease event, and her onoff.turn_off (opening) takes her hold; on a valve whose closing onoff.turn_off is declared toggles, the member's hold refuses a rule's turn_off; a rule's onoff.turn_on (closing) over her opening hold is sent, the hold staying hers; a rule's valve.close on a valve an outside change opened is sent, the lease staying the outside change's, no lease event; a member's hold on a heater refuses a rule's onoff.turn_on; a latching safety rule's lease on the door refuses the auto-lock `leased`; a person-started run owning the door refuses a rule's lock.lock `leased`, and the member's lock.lock ends the run's lease `replaced`, leaving no lease, the refused rule firing then",
}, async (ctx) => {
  const s = ctx.steward!;
  const applier = ctx.standIn!.applier;
  await pinHold(ctx);

  // HS18: the auto-lock passes the phone's hold and takes none; a brain's does not pass it.
  const na = await bench(ctx, "narrow-a", ["doorlock"]);
  const nb = await bench(ctx, "narrow-b", ["doorlock"]);
  for (const d of [na.doorlock, nb.doorlock]) {
    applier.scriptValue(d, "locked", false, { cause: "external" });
    await holderIs(ctx, d, "external", `the outside unlock of ${d}`);
  }
  await ctx.time.stepAndWait(60_000);
  let c = await cursorNow(ctx);
  let sent = sentFrom(ctx);
  await mustDefine(ctx, [autoLock("auto-a", na.doorlock)], "the auto-lock of door a");
  mustEqual(await stepOf(ctx, c, sent, "auto-a", na.doorlock, LOCK, "the auto-lock a minute after the outside unlock"), "sent",
    "the auto-lock's lock.lock over the outside unlock's hold");
  await answered(ctx, c, na.doorlock, "the auto-lock's lock.lock", { rule: "auto-a" });
  await holderIs(ctx, na.doorlock, "external", "after the auto-lock");
  mustEqual(await leaseLine(ctx, c, na.doorlock), [], "door a's lease events after the auto-lock");
  c = await cursorNow(ctx);
  await byBrain(ctx, [autoLock("auto-b", nb.doorlock)], "the auto-lock of door b");
  mustEqual(await stepOf(ctx, c, sent, "auto-b", nb.doorlock, LOCK, "a brain's auto-lock"), "refused(leased) external", "a brain-defined auto-lock over the outside unlock's hold");

  // A valve that opens with turn_off: its turn_on closes, narrowing, taking no lease; its turn_off opens, taking a hold.
  const nv = await bench(ctx, "narrow-v", ["watervalve", "motion"]);
  applier.scriptOpensWith(nv.watervalve, "turn_off");
  await stewardSees(ctx, `${nv.watervalve} opens_with onoff.turn_off`, (dd) => targetIn(dd, nv.watervalve)?.opens_with === "onoff.turn_off");
  reported(ctx, nv.watervalve, "on", false);
  c = await cursorNow(ctx);
  mustEqual(outcomes(await applyInline(s.olga, "olga-app", [act(nv.watervalve, ON)]), "the member's closing turn_on"), [`${nv.watervalve} dispatched`],
    "the member's closing turn_on of the valve");
  await answered(ctx, c, nv.watervalve, "the member's closing turn_on");
  const closed = await leaseOf(ctx, nv.watervalve);
  ctx.evidence(`the valve's lease after the member closed it: ${JSON.stringify(closed)}`);
  must(closed === undefined, `the member's closing turn_on of a valve declared opens_with onoff.turn_off took a lease: ${JSON.stringify(closed?.holder)}`);
  mustEqual(await leaseLine(ctx, c, nv.watervalve), [], "the valve's lease events after the member's closing turn_on");
  await holds(ctx, s.olga, "olga-app", nv.watervalve, OFF, "olga-app", "the member's opening turn_off of the valve");
  // A rule's closing turn_on passes her opening hold, taking none.
  await mustDefine(ctx, [whileMotion("close-v", nv.motion, nv.watervalve, ON)], "a rule closing the valve");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  motionOn(ctx, nv.motion);
  mustEqual(await stepOf(ctx, c, sent, "close-v", nv.watervalve, ON, "a rule's closing turn_on over her hold"), "sent", "a rule's closing turn_on over the member's opening hold");
  await answered(ctx, c, nv.watervalve, "the rule's closing turn_on", { rule: "close-v" });
  await holderIs(ctx, nv.watervalve, "olga-app", "after the rule closed the valve");

  // `valve.close` on a valve an outside change opened.
  const nc = await bench(ctx, "narrow-c", ["valve", "motion"]);
  reported(ctx, nc.valve, "open", false);
  applier.scriptValue(nc.valve, "open", true, { cause: "external" });
  await holderIs(ctx, nc.valve, "external", "the outside opening of valve c");
  await mustDefine(ctx, [whileMotion("close-c", nc.motion, nc.valve, "valve.close")], "a rule closing valve c");
  c = await cursorNow(ctx);
  motionOn(ctx, nc.motion);
  mustEqual(await stepOf(ctx, c, sent, "close-c", nc.valve, "valve.close", "a rule's valve.close over the outside hold"), "sent", "a rule's valve.close over the outside change's hold");
  await answered(ctx, c, nc.valve, "the rule's valve.close", { rule: "close-c" });
  await holderIs(ctx, nc.valve, "external", "after the rule closed valve c");
  mustEqual(await leaseLine(ctx, c, nc.valve), [], "valve c's lease events after the rule's valve.close");

  // A closing action declared toggles is not narrowing: a member's hold refuses it.
  const nt = await bench(ctx, "narrow-t", ["watervalve", "motion"]);
  applier.scriptToggles(nt.watervalve, OFF, true);
  await stewardSees(ctx, `${nt.watervalve} turn_off declared toggles`,
    (dd) => ((targetIn(dd, nt.watervalve)?.actions ?? []) as { action: string; toggles?: boolean }[]).some((x) => x.action === OFF && x.toggles === true));
  reported(ctx, nt.watervalve, "on", false);
  await holds(ctx, s.olga, "olga-app", nt.watervalve, ON, "olga-app", "the member's opening turn_on of the toggling valve");
  // A heater's turn_on is no narrowing action.
  const nh = await bench(ctx, "narrow-h", ["heater", "motion"]);
  reported(ctx, nh.heater);
  await holds(ctx, s.olga, "olga-app", nh.heater, OFF, "olga-app", "the member's turn_off of the heater");
  await mustDefine(ctx, [whileMotion("close-t", nt.motion, nt.watervalve, OFF), whileMotion("heat-h", nh.motion, nh.heater, ON)],
    "rules closing the toggling valve and switching the heater on");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  motionOn(ctx, nt.motion);
  motionOn(ctx, nh.motion);
  mustEqual(await stepOf(ctx, c, sent, "close-t", nt.watervalve, OFF, "a rule's toggling turn_off of the valve"), "refused(leased) olga-app",
    "a rule's turn_off declared toggles over the member's hold");
  mustEqual(await stepOf(ctx, c, sent, "heat-h", nh.heater, ON, "a rule's turn_on of the heater"), "refused(leased) olga-app",
    "a rule's turn_on of the heater over the member's hold");

  // Against any lease but a person's hold, precedence decides: a safety rule's refuses the auto-lock. The rule latches and
  // completes, its lease held by the latch, so the stand-in refuses nothing `safety` (GA-SAFE-2 would hide the lease);
  // this relies on the stand-in raising no `latched` (GA-SAFE-7) for the latched `locked` key, which a door offers no other.
  const ns = await bench(ctx, "narrow-s", ["doorlock"]);
  // The safety rule is a model change: the steward has followed it (its revision moved) before the auto-lock's define
  // reads the revision, or that define may meet the move and be refused stale_revision.
  const beforeRule = await revisionOf(ctx);
  applier.scriptSafetyRule({ id: "escape", actuates: [{ target: ns.doorlock, key: "locked", value: false }], latch: true });
  await pollUntil(async () => (await revisionOf(ctx)) > beforeRule || undefined, 10_000, "the steward did not follow the safety rule's model change", 100);
  applier.scriptSafetyFire("escape");
  await holderIs(ctx, ns.doorlock, "safety:escape", "the latching safety rule unlocked door s");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  await mustDefine(ctx, [autoLock("auto-s", ns.doorlock)], "the auto-lock of door s");
  mustEqual(await stepOf(ctx, c, sent, "auto-s", ns.doorlock, LOCK, "the auto-lock under a safety rule's lease"), "refused(leased) safety:escape",
    "the auto-lock under the safety rule's lease");
  applier.scriptLatchClear("escape", "cleared_by_owner");

  // A person-started run owning the door: a rule's lock is refused; a member's ends the run's lease, taking none.
  const nr = await bench(ctx, "narrow-r", ["doorlock"]);
  reported(ctx, nr.doorlock, "locked", false);
  await mustDefine(ctx, [scene("keep-door", [{ delay: 900 }], { owned: [nr.doorlock] })], "a scenario owning door r");
  const { run_id } = await startRun(ctx, s.olga, "olga-app", "keep-door");
  await holderIs(ctx, nr.doorlock, `run:${run_id}`, "the member's run owning door r");
  c = await cursorNow(ctx);
  sent = sentFrom(ctx);
  await mustDefine(ctx, [autoLock("auto-r", nr.doorlock)], "the auto-lock of door r");
  mustEqual(await stepOf(ctx, c, sent, "auto-r", nr.doorlock, LOCK, "the auto-lock under the run's lease"), `refused(leased) run:${run_id}`,
    "a rule's lock.lock under a person-started run's lease");
  // Its answer held back, the door still reads unlocked when the run's lease ends, so the auto-lock judged again then fires.
  applier.scriptOutcome(nr.doorlock, LOCK, { outcome: "failed", reason: "no_ack", afterMs: 5_000 });
  c = await cursorNow(ctx);
  mustEqual(outcomes(await applyInline(s.olga, "olga-app", [act(nr.doorlock, LOCK)]), "the member's lock.lock"), [`${nr.doorlock} dispatched`],
    "the member's lock.lock of door r");
  await holderIs(ctx, nr.doorlock, undefined, "after the member's lock.lock of the run's door");
  mustEqual(await leaseLine(ctx, c, nr.doorlock), [`ended replaced run:${run_id}`], "door r's lease events after the member's lock.lock");
  // The rule the run's lease refused is judged again at that lease's end.
  await fires(ctx, c, "auto-r", 1, "the auto-lock once the member's lock ended the run's lease");
});
