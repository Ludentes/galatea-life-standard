import { must, mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import { CHANNEL, LAMP } from "../../steward-home.js";
import { pollUntil } from "../../util.js";
import { sentFrom } from "./answers.js";
import { cursorNow, eventsAfter, firedOf, limit, relayed, session, type Ev } from "./rules.js";
import { mustDefine, ownerOf, scripted, stewardSees, targetIn, up } from "./util.js";

/** A rule of conditions only on the motion sensor reading motion, acting on `target`. */
const onMotion = (id: string, motion: string, target: string, action: string, args: Record<string, unknown> = {}) => ({ id, name: id,
  conditions: [{ target: motion, key: "motion", op: "eq", value: true }], actions: [{ target, action, args }] });

/** The `ack_within_s` the stand-in declares for `target`'s `action`, as the steward's `describe` shows it. */
export async function ackWithinMs(ctx: TestContext, target: string, action: string): Promise<number> {
  const d = await ownerOf(ctx).callOk("describe");
  const a = (targetIn(d, target)?.actions as { action: string; ack_within_s: number }[] | undefined)?.find((x) => x.action === action);
  must(typeof a?.ack_within_s === "number", `the steward's describe shows no ack_within_s for ${target} ${action}`, a);
  return a!.ack_within_s * 1000;
}

/** Waits until the steward has relayed a final outcome `outcome` of a firing of `rule` since `cursor`; returns that event. */
export async function endedAs(ctx: TestContext, cursor: string, rule: string, outcome: string, what: string): Promise<Ev> {
  return pollUntil(async () => (await eventsAfter(ctx, cursor)).find((e) => e.type === "outcome" && e.cause?.rule === rule
    && `${e.outcome}${e.reason ? `(${e.reason})` : ""}` === outcome), 10_000, `${what}: the steward never relayed ${rule}'s ${outcome}`, 100);
}

/** The failure notices the steward raised since `cursor` for `rule` (GA-RULE-8). */
export async function failuresOf(ctx: TestContext, cursor: string, rule: string): Promise<Ev[]> {
  return (await eventsAfter(ctx, cursor)).filter((e) => e.type === "notice" && e.change === "raised" && e.cause === "rule_failed" && e.rule === rule);
}

/** The toggle notices the steward raised since `cursor` for `rule` (GA-RULE-8). */
async function togglesOf(ctx: TestContext, cursor: string, rule: string): Promise<Ev[]> {
  return (await eventsAfter(ctx, cursor)).filter((e) => e.type === "notice" && e.change === "raised" && e.cause === "rule_toggle" && e.rule === rule);
}

/**
 * Waits until the stand-in has received a rule's apply for each of `targets`: `rule_fired` is logged
 * before the firing's first await, so a step of the clock taken on it alone could come before the
 * stand-in set the step's ending on its clock, and that ending would never come.
 */
export async function received(sent: () => { target: string; for: any }[], targets: string[], what: string): Promise<void> {
  await pollUntil(async () => targets.every((t) => sent().some((x) => x.target === t && x.for?.rule !== undefined)) || undefined,
    10_000, `${what}: the stand-in never received the rules' applies`, 100);
}

/** Steps the clock to `atMs` (the clock moves with wall time too, so the step is measured now), the stepped time taken by every client. */
export async function stepTo(ctx: TestContext, atMs: number): Promise<void> {
  const left = atMs - ctx.time.now();
  if (left > 0) await ctx.time.stepAndWait(left);
}

requirement("GA-RULE-7", {
  seam: "steward",
  covers: "a lock whose ack was lost (failed(no_ack)) while Лиза's session stays open is fired again no sooner than its ack_within_s and no later than 300 s after its last try, and, its retry acked and the session locked, not again; the air conditioner's idempotent set_mode that ends unanswered is fired again once, and no more in the next 300 s; a second air conditioner's set_mode that ends unreachable is fired again, lands, and is not fired again while motion holds; a third air conditioner's set_mode, the device dead (skipped(dead)), is fired again within 300 s; a lock that keeps ending unreachable is fired again until its session closes, then not; the pulse relay's turn_on (not idempotent) that ends failed(no_ack) and the lamp's turn_on that ends failed(invalid_request) are not fired again in 300 s",
}, async (ctx) => {
  const applier = ctx.standIn!.applier;
  const [pc, motion, ac, pulse, acDead, pcAway, acB] = await scripted(ctx, [{ fixture: "laptop", adopt: "computer" }, { fixture: "motion", adopt: "sensor" },
    { fixture: "ac", adopt: "ac" }, { fixture: "pulse", adopt: "socket" }, { fixture: "ac", adopt: "ac", bridge: "ac-dead" },
    { fixture: "laptop", adopt: "computer", bridge: "pc-away" }, { fixture: "ac", adopt: "ac", bridge: "ac-b" }]);
  for (const x of [pc!, pcAway!]) session(ctx, x, "liza", "locked");
  await mustDefine(ctx, [up("rule", limit(pc!)), up("rule", onMotion("cool", motion!, ac!, "climate.set_mode", { mode: "off" })),
    up("rule", onMotion("pulse", motion!, pulse!, "onoff.turn_on")), up("rule", onMotion("lamp", motion!, LAMP, "onoff.turn_on")),
    up("rule", onMotion("cool-dead", motion!, acDead!, "climate.set_mode", { mode: "off" })), up("rule", limit(pcAway!, "liza", { id: "limit-away", name: "Лимит: недоступный" })),
    up("rule", onMotion("cool-b", motion!, acB!, "climate.set_mode", { mode: "off" }))], "the rules");
  const ack = await ackWithinMs(ctx, pc!, "session.lock");
  applier.scriptOutcome(pc!, "session.lock", { outcome: "failed", reason: "no_ack" });
  applier.scriptOutcome(ac!, "climate.set_mode", { outcome: "unanswered" });
  applier.scriptOutcome(ac!, "climate.set_mode", { outcome: "unanswered" });
  applier.scriptOutcome(pulse!, "onoff.turn_on", { outcome: "failed", reason: "no_ack" });
  applier.scriptOutcome(LAMP, "onoff.turn_on", { outcome: "failed", reason: "invalid_request" });
  applier.scriptOutcome(acB!, "climate.set_mode", { outcome: "unreachable" });
  for (let i = 0; i < 8; i++) applier.scriptOutcome(pcAway!, "session.lock", { outcome: "unreachable" });
  const sent = sentFrom(ctx);
  const cursor = await cursorNow(ctx);
  applier.scriptLiveness(acDead!, "dead");
  for (const x of [pc!, pcAway!]) session(ctx, x, "liza", "active");
  applier.scriptValue(motion!, "motion", true, { cause: "device" });
  const rules = ["limit", "cool", "pulse", "lamp", "cool-dead", "limit-away", "cool-b"];
  const first = await pollUntil(async () => {
    const events = await eventsAfter(ctx, cursor);
    return rules.every((r) => firedOf(events, r).length) ? events : undefined;
  }, 10_000, "the rules did not all fire", 100);
  const firstAt = (rule: string) => Date.parse(firedOf(first, rule)[0]!.time);
  await received(sent, [pc!, ac!, pulse!, LAMP, pcAway!, acB!], "the first firings");
  await ctx.time.stepAndWait(ack + 1_000);
  await endedAs(ctx, cursor, "limit", "failed(no_ack)", "the lock");
  await endedAs(ctx, cursor, "cool", "unanswered", "the air conditioner");
  await endedAs(ctx, cursor, "pulse", "failed(no_ack)", "the pulse relay");
  await endedAs(ctx, cursor, "lamp", "failed(invalid_request)", "the lamp");
  await endedAs(ctx, cursor, "cool-dead", "skipped(dead)", "the dead air conditioner");
  await endedAs(ctx, cursor, "limit-away", "unreachable", "the lock on the laptop out of reach");
  await endedAs(ctx, cursor, "cool-b", "unreachable", "the second air conditioner");
  // 300 s from the first tries, thirty seconds at a time: a retry is due a minute after its last try,
  // and the air conditioner's second unanswered 12 s after its retry.
  const until = firstAt("limit") + 300_000;
  let closed = false;
  while (ctx.time.now() < until) {
    await ctx.time.stepAndWait(Math.min(30_000, until - ctx.time.now()));
    if (!closed && firedOf(await eventsAfter(ctx, cursor), "limit-away").length >= 2) {
      closed = true;
      session(ctx, pcAway!, "liza", "locked");
      await relayed(ctx, cursor, pcAway!, "session.liza", "locked", "the session on the laptop out of reach closing");
    }
  }
  const events = await eventsAfter(ctx, cursor);
  const times = (rule: string) => firedOf(events, rule).map((e) => Date.parse(e.time) - firstAt(rule));
  ctx.evidence(`firings, ms after each rule's first: ${JSON.stringify(Object.fromEntries(rules.map((r) => [r, times(r)])))}`);
  const lock = times("limit");
  mustEqual(lock.length, 2, "the lock whose ack was lost: fired again once within 300 s of its last try, and, its retry acked, not again");
  must(lock[1]! >= ack && lock[1]! <= 300_000, `the lock was fired again ${lock[1]} ms after its last try, not within ${ack} ms to 300 s`, lock);
  must(firedOf(events, "limit")[1]!.retry === true, "the lock's second firing is not marked a retry", firedOf(events, "limit")[1]);
  const cool = times("cool");
  mustEqual(cool.length, 2, "the air conditioner's firings: the first and one more after its unanswered");
  must(cool[1]! >= ack && cool[1]! <= 300_000, `the unanswered set_mode was fired again ${cool[1]} ms after its last try`, cool);
  const coolB = times("cool-b");
  mustEqual(coolB.length, 2, "the second air conditioner's firings: the first, ended unreachable, and one more that landed, then none while motion holds");
  must(coolB[1]! >= ack && coolB[1]! <= 300_000, `the unreachable set_mode was fired again ${coolB[1]} ms after its last try`, coolB);
  const dead = times("cool-dead");
  must(dead.length >= 2 && dead[1]! <= 300_000, "the dead air conditioner's set_mode (skipped(dead)) was not fired again within 300 s", dead);
  must(closed, "the lock that ended unreachable was not fired again within 300 s", times("limit-away"));
  mustEqual(times("limit-away").length, 2, "the lock that ended unreachable: fired again until its session closed, then not");
  mustEqual(times("pulse").length, 1, "the pulse relay's firings: a turn_on that is not idempotent is never fired again");
  mustEqual(times("lamp").length, 1, "the lamp's firings: a failed(invalid_request) is never fired again");
});

requirement("GA-RULE-8", {
  seam: "steward",
  covers: "a lock that ends failed(not_locked) 1 s after dispatch raises no notice at once and one once its ack_within_s and the late-ack slack have passed, naming the rule, the action, its target and the outcome, delivered on the channel, and still when Лиза's session closed 5 s after it; one with a late_ack 3 s later raises none; a failed(no_graphical_session) raises one at once; the pulse relay's turn_on (not idempotent) that ends failed(no_ack) raises none 61 s after it, and none when a late_ack comes then or 20 s after it; a third that has no late_ack raises one once the 60 s window and the slack have passed; an air conditioner's set_mode that ends unanswered twice raises one after its one further try (each of these two skipped with evidence where GA-RULE-7's retries, its precondition, went otherwise); a rule on the IR tv's toggling turn_off raises one notice at its define, and none when its firing ends skipped(toggle_only); a rule naming a second tv whose turn_off its bridge re-declares toggles: true raises one notice then; a step refused(leased) raises none (a clause whose step never ends so, the steward not refusing or skipping it, is skipped with evidence: that is GA-LEASE-3's or GA-SCN-4's failure); a schedule of a scenario whose run step reaches the tv's toggle raises one notice at its define, naming the schedule, and one of a scenario of the lamp none; skipped(in_use) slice 8's; a held notice across a restart is GA-PERSIST-2's case",
}, async (ctx) => {
  const applier = ctx.standIn!.applier;
  const slack = constantMs("steward", "late-ack-slack");
  const devices = await scripted(ctx, [{ fixture: "laptop", adopt: "computer", bridge: "pc-a" }, { fixture: "laptop", adopt: "computer", bridge: "pc-b" },
    { fixture: "laptop", adopt: "computer", bridge: "pc-c" }, { fixture: "laptop", adopt: "computer", bridge: "pc-d" }, { fixture: "motion", adopt: "sensor" },
    { fixture: "pulse", adopt: "socket", bridge: "relay-e" }, { fixture: "pulse", adopt: "socket", bridge: "relay-f" }, { fixture: "tv", adopt: "tv" },
    { fixture: "tv", adopt: "tv", bridge: "tv-h" }, { fixture: "pulse", adopt: "socket", bridge: "relay-g" }, { fixture: "ac", adopt: "ac", bridge: "ac-n" }]);
  const [pcA, pcB, pcC, pcD, motion, pulseE, pulseF, tv, tvH, pulseG, acN] = devices as [string, string, string, string, string, string, string, string, string, string, string];
  const pcs = { a: pcA, b: pcB, c: pcC, d: pcD };
  for (const pc of Object.values(pcs)) session(ctx, pc, "liza", "locked");
  // The second tv's turn_off is no toggle yet; the lamp is someone's, turned off by hand (GA-LEASE-2).
  applier.scriptToggles(tvH, "onoff.turn_off", false);
  applier.scriptValue(LAMP, "on", false, { cause: "external" });
  applier.scriptValue(LAMP, "on", true, { cause: "external" });
  await stewardSees(ctx, "the second tv's turn_off no toggle", (d) => targetIn(d, tvH)?.actions?.find((a: { action: string }) => a.action === "onoff.turn_off")?.toggles === undefined);
  const ack = await ackWithinMs(ctx, pcA, "session.lock");
  const defined = await cursorNow(ctx);
  await mustDefine(ctx, [...Object.entries(pcs).map(([k, pc]) => up("rule", limit(pc, "liza", { id: `limit-${k}`, name: `Лимит ${k}` }))),
    up("rule", onMotion("pulse-e", motion, pulseE, "onoff.turn_on")), up("rule", onMotion("pulse-f", motion, pulseF, "onoff.turn_on")),
    up("rule", onMotion("tv-g", motion, tv, "onoff.turn_off")), up("rule", onMotion("tv-h", motion, tvH, "onoff.turn_off")),
    up("rule", onMotion("lamp-i", motion, LAMP, "onoff.turn_off")), up("rule", onMotion("pulse-g", motion, pulseG, "onoff.turn_on")),
    up("rule", onMotion("cool-n", motion, acN, "climate.set_mode", { mode: "off" }))], "the rules");
  // A rule on a toggle: one notice at its define.
  const told = await pollUntil(async () => (await togglesOf(ctx, defined, "tv-g"))[0], 10_000, "no notice at the define of a rule acting on the tv's toggle", 100);
  ctx.evidence(`at define: ${told.text}`);
  must(told.target === tv && told.action === "onoff.turn_off", "the toggle notice does not name the tv's turn_off", told);
  mustEqual((await togglesOf(ctx, defined, "tv-h")).length, 0, "toggle notices for the second tv before its re-declaration");
  for (const pc of [pcA, pcB, pcD]) applier.scriptOutcome(pc, "session.lock", { outcome: "failed", reason: "not_locked", afterMs: 1_000 });
  applier.scriptOutcome(pcC, "session.lock", { outcome: "failed", reason: "no_graphical_session", afterMs: 1_000 });
  applier.scriptOutcome(pulseE, "onoff.turn_on", { outcome: "failed", reason: "no_ack" });
  applier.scriptOutcome(pulseF, "onoff.turn_on", { outcome: "failed", reason: "no_ack" });
  applier.scriptOutcome(pulseG, "onoff.turn_on", { outcome: "failed", reason: "no_ack" });
  applier.scriptOutcome(acN, "climate.set_mode", { outcome: "unanswered" });
  applier.scriptOutcome(acN, "climate.set_mode", { outcome: "unanswered" });
  const sent = sentFrom(ctx);
  const cursor = await cursorNow(ctx);
  for (const pc of Object.values(pcs)) session(ctx, pc, "liza", "active");
  applier.scriptValue(motion, "motion", true, { cause: "device" });

  await received(sent, [pcA, pcB, pcC, pcD, pulseE, pulseF, pulseG, acN], "the firings");
  // Steps that end at the steward: a lease's refusal and a toggle's skip raise none, in the step that ends them.
  // A step that never ends so is no case of this clause: it is skipped, with evidence (the milestone review, M9).
  const leased = await maybe(ctx, endedAs(ctx, cursor, "lamp-i", "refused(leased)", "the lamp under someone's lease"), "a step refused(leased)");
  const toggled = await maybe(ctx, endedAs(ctx, cursor, "tv-g", "skipped(toggle_only)", "the tv's toggle"), "a step skipped(toggle_only)");
  if (leased) mustEqual((await failuresOf(ctx, cursor, "lamp-i")).length, 0, "notices for a step refused(leased)");
  if (toggled) mustEqual((await failuresOf(ctx, cursor, "tv-g")).length, 0, "notices for a step skipped(toggle_only)");

  // The locks: each failed 1 s after dispatch.
  const failedA = await endedAs(ctx, cursor, "limit-a", "failed(not_locked)", "Лиза's lock on the first laptop");
  mustEqual((await failuresOf(ctx, cursor, "limit-a")).length, 0, "notices for a failed(not_locked) at once, inside its ack_within_s");
  await endedAs(ctx, cursor, "limit-c", "failed(no_graphical_session)", "the lock of an account logged in over SSH only");
  const ssh = await failuresOf(ctx, cursor, "limit-c");
  ctx.evidence(`failed(no_graphical_session): ${ssh.length} notice(s) at once`);
  mustEqual(ssh.length, 1, "notices for a failed(no_graphical_session) at once");
  await endedAs(ctx, cursor, "limit-b", "failed(not_locked)", "the lock on the second laptop");
  applier.scriptLateAck(pcB);
  await endedAs(ctx, cursor, "limit-d", "failed(not_locked)", "the lock on the fourth laptop");
  await stepTo(ctx, Date.parse(failedA.time) + 5_000);
  session(ctx, pcD, "liza", "disconnected");

  // A schedule whose scenario reaches the tv's toggle through a run step: one notice at its define.
  const sched = await cursorNow(ctx);
  await mustDefine(ctx, [up("scenario", { id: "tv-off", name: "ТВ", mode: "single", steps: [{ target: tv, action: "onoff.turn_off", args: {} }] }),
    up("scenario", { id: "night", name: "Ночь", mode: "single", steps: [{ run: "tv-off" }] }),
    up("scenario", { id: "lamp", name: "Лампа", mode: "single", steps: [{ target: LAMP, action: "onoff.turn_on", args: {} }] }),
    up("schedule", { id: "night", scenario: "night", time: "23:00" }), up("schedule", { id: "lamp", scenario: "lamp", time: "18:00" })],
  "a schedule reaching the tv's toggle, and one of the lamp");
  const scheduled = await pollUntil(async () => {
    const n = (await eventsAfter(ctx, sched)).filter((e) => e.type === "notice" && e.change === "raised" && e.cause === "schedule_toggle");
    return n.length ? n : undefined;
  }, 10_000, "no notice at the define of a schedule reaching the tv's toggle", 100);
  ctx.evidence(`the schedule's: ${scheduled.map((e) => e.text).join(" | ")}`);
  mustEqual(scheduled.map((e) => [e.schedule, e.target, e.action]), [["night", tv, "onoff.turn_off"]], "the schedules' toggle notices");

  // The second tv re-declared: one notice.
  const before = await cursorNow(ctx);
  applier.scriptToggles(tvH, "onoff.turn_off", true);
  await pollUntil(async () => (await togglesOf(ctx, before, "tv-h")).length || undefined, 10_000,
    "no notice when the second tv's turn_off was re-declared toggles: true", 100);

  // Past the locks' wait: their dispatch plus ack_within_s plus the slack.
  const firedA = Date.parse(firedOf(await eventsAfter(ctx, cursor), "limit-a")[0]!.time);
  await stepTo(ctx, firedA + ack + slack + 1_000);
  const limitA = await pollUntil(async () => (await failuresOf(ctx, cursor, "limit-a"))[0], 10_000,
    "no notice for the lock that ended failed(not_locked) once its wait passed", 100);
  ctx.evidence(`fired ${new Date(firedA).toISOString()}, the notice ${limitA.time}: ${limitA.text}`);
  must(Date.parse(limitA.time) >= firedA + ack + slack, `the notice came at ${limitA.time}, before the lock's ack_within_s and the slack had passed`);
  must(limitA.rule === "limit-a" && limitA.action === "session.lock" && limitA.target === pcA && limitA.outcome === "failed" && limitA.reason === "not_locked",
    "the notice does not name the rule, the action, its target and the outcome", limitA);
  await pollUntil(async () => sent().some((x) => x.target === CHANNEL && x.for?.notice === limitA.notice_id && String(x.args?.text).includes("limit-a")) || undefined,
    10_000, "the notice was never sent on the home's channel", 100);
  mustEqual((await failuresOf(ctx, cursor, "limit-b")).length, 0, "notices for a lock with a late_ack inside its wait");
  mustEqual((await failuresOf(ctx, cursor, "limit-d")).length, 1, "notices for a lock whose session closed during its wait");

  // The pulse relays: failed(no_ack) at ack_within_s; one's late ack 20 s on, the other's at 61 s.
  const failedE = Date.parse((await endedAs(ctx, cursor, "pulse-e", "failed(no_ack)", "the first pulse relay")).time);
  await endedAs(ctx, cursor, "pulse-f", "failed(no_ack)", "the second pulse relay");
  await stepTo(ctx, failedE + 20_000);
  applier.scriptLateAck(pulseF);
  await stepTo(ctx, failedE + 61_000);
  mustEqual((await failuresOf(ctx, cursor, "pulse-e")).length, 0, "notices 61 s after a failed(no_ack), inside the late-ack window and the slack");
  applier.scriptLateAck(pulseE);
  await stepTo(ctx, failedE + 60_000 + slack + 5_000);
  const after = await eventsAfter(ctx, cursor);
  ctx.evidence(`failure notices: ${JSON.stringify(after.filter((e) => e.type === "notice" && e.cause === "rule_failed" && e.change === "raised")
    .map((e) => `${e.rule} ${e.outcome}(${e.reason})`))}`);
  mustEqual((await failuresOf(ctx, cursor, "pulse-e")).length, 0, "notices for a failed(no_ack) whose late_ack came 61 s after it");
  mustEqual((await failuresOf(ctx, cursor, "pulse-f")).length, 0, "notices for a failed(no_ack) whose late_ack came 20 s after it");
  if (toggled) mustEqual((await failuresOf(ctx, cursor, "tv-g")).length, 0, "notices for the tv's skipped(toggle_only)");

  // The third relay: no late_ack, so one notice once the window and the slack have passed (the milestone review, B5).
  // Its precondition is GA-RULE-7's: a step not idempotent is not fired again. One fired again raises
  // no notice, rightly, so the clause is skipped with evidence: that is GA-RULE-7's failure.
  const failedG = Date.parse((await endedAs(ctx, cursor, "pulse-g", "failed(no_ack)", "the third pulse relay")).time);
  const noticeG = await unlessRetried(ctx, cursor, "pulse-g", 1, pollUntil(async () => (await failuresOf(ctx, cursor, "pulse-g"))[0], 10_000,
    "no notice for a failed(no_ack) with no late_ack once the 60 s window and the slack passed", 100), "the third relay's notice, its step fired again");
  if (noticeG) {
    ctx.evidence(`the third relay failed ${new Date(failedG).toISOString()}, its notice ${noticeG.time}`);
    must(Date.parse(noticeG.time) >= failedG + 60_000 + slack, `the third relay's notice came at ${noticeG.time}, before the window and the slack had passed`);
    mustEqual((await failuresOf(ctx, cursor, "pulse-g")).length, 1, "notices for the third relay's failed(no_ack)");
  }

  // The air conditioner: unanswered, tried once more, unanswered again: one notice then.
  const ackAc = await ackWithinMs(ctx, acN, "climate.set_mode");
  const firedN = Date.parse(firedOf(await eventsAfter(ctx, cursor), "cool-n")[0]!.time);
  await stepTo(ctx, firedN + Math.max(60_000, ackAc) + ackAc + 2_000);
  // Its precondition is GA-RULE-7's one further try: without it, the clause is skipped with evidence.
  const noticeN = await unlessRetried(ctx, cursor, "cool-n", 2, pollUntil(async () => (await failuresOf(ctx, cursor, "cool-n"))[0], 10_000,
    "no notice for a set_mode that ended unanswered after its one further try", 100), "the air conditioner's notice, its one further try not made");
  if (noticeN) {
    ctx.evidence(`the air conditioner's notice: ${noticeN.text}`);
    mustEqual(firedOf(await eventsAfter(ctx, cursor), "cool-n").length, 2, "the air conditioner's firings: the first and its one further try");
    must(noticeN.outcome === "unanswered", "the air conditioner's notice does not name unanswered", noticeN);
  }
});

/**
 * `p`'s value; or, when it failed and `rule` was not fired exactly `firings` times (GA-RULE-7's
 * retries, the clause's precondition), undefined with evidence: that is GA-RULE-7's failure, not this one's.
 */
export async function unlessRetried<T>(ctx: TestContext, cursor: string, rule: string, firings: number, p: Promise<T>, clause: string): Promise<T | undefined> {
  try {
    return await p;
  } catch (err) {
    const fired = firedOf(await eventsAfter(ctx, cursor), rule).length;
    if (fired === firings) throw err;
    ctx.evidence(`skipped the clause on ${clause}: ${rule} was fired ${fired} times, not ${firings} (GA-RULE-7's)`);
    return undefined;
  }
}

/** `p`'s value, or undefined with evidence when it failed: a clause whose precondition the subject never met is skipped. */
async function maybe<T>(ctx: TestContext, p: Promise<T>, clause: string): Promise<T | undefined> {
  try {
    return await p;
  } catch (err) {
    ctx.evidence(`skipped the clause on ${clause}: its step never ended so (${err instanceof Error ? err.message : String(err)})`);
    return undefined;
  }
}
