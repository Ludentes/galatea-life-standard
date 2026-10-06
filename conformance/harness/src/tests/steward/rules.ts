import { must, mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { requirement } from "../../registry.js";
import { McpSeam } from "../../seams/mcp.js";
import { LAMP } from "../../steward-home.js";
import { pollUntil } from "../../util.js";
import { sentFrom } from "./answers.js";
import { cursorExpiredGap, mustDefine, mustRefuse, ownerOf, raiseTier, scripted, stewardSees, targetIn, up } from "./util.js";
import { failedOf, runReads, runSent, startRun } from "./scenarios.js";
import { scheduleSoon } from "./schedules.js";

/** One of the steward's events. */
export type Ev = { seq: number; time: string; type: string } & Record<string, any>;

const LOCKED = ["locked", "disconnected", "none"];

/** The steward's events after `cursor`. */
export async function eventsAfter(ctx: TestContext, cursor: string): Promise<Ev[]> {
  return (await ownerOf(ctx).callOk("events", { cursor })).events as Ev[];
}

/** The steward's events cursor now. */
export async function cursorNow(ctx: TestContext): Promise<string> {
  return String((await ownerOf(ctx).callOk("events")).cursor);
}

/** The `rule_fired` events of `rule` among `events`. */
export const firedOf = (events: Ev[], rule: string) => events.filter((e) => e.type === "rule_fired" && e.rule === rule);

/** Waits until `rule` has fired `n` times since `cursor`; returns the events since `cursor`. */
export async function fires(ctx: TestContext, cursor: string, rule: string, n: number, what: string): Promise<Ev[]> {
  return pollUntil(async () => {
    const events = await eventsAfter(ctx, cursor);
    return firedOf(events, rule).length >= n ? events : undefined;
  }, 10_000, `${what}: rule ${rule} did not fire ${n} time(s)`, 100);
}

/**
 * Waits until the steward has relayed a `state` event of `target`'s `key` reading `value` since
 * `cursor`; returns the events since `cursor`. A rule reading the key is evaluated in the step that
 * relays it, and a firing's `rule_fired` is put in that step, so the events returned show it if it fired.
 */
export async function relayed(ctx: TestContext, cursor: string, target: string, key: string, value: unknown, what: string): Promise<Ev[]> {
  return pollUntil(async () => {
    const events = await eventsAfter(ctx, cursor);
    return events.some((e) => e.type === "state" && e.target === target && e.key === key && JSON.stringify(e.value) === JSON.stringify(value))
      ? events : undefined;
  }, 10_000, `${what}: the steward did not relay ${target} ${key} ${JSON.stringify(value)}`, 100);
}

/** The scripted stand-in's laptop, adopted: Лиза's key `locked`, Дмитрий's `locked`. */
export async function laptop(ctx: TestContext): Promise<string> {
  const [id] = await scripted(ctx, [{ fixture: "laptop", adopt: "computer" }]);
  ctx.standIn!.applier.scriptValue(id!, "session.liza", "locked", { cause: "device" });
  return id!;
}

/** A session key of the laptop moves, as its bridge reports it (every key of a computer is `self_changing`). */
export const session = (ctx: TestContext, id: string, account: string, value: string) =>
  ctx.standIn!.applier.scriptValue(id, `session.${account}`, value, { cause: "device" });

/** HS20's evening limit, as a rule of conditions only on `account`'s key, with `extra` over it. */
export const limit = (id: string, account = "liza", extra: Record<string, unknown> = {}) => ({ id: account === "liza" ? "limit" : `limit-${account}`,
  name: `Лимит ${account}`, conditions: [{ target: id, key: `session.${account}`, not_in: LOCKED }],
  actions: [{ target: id, action: "session.lock", args: { account } }], ...extra });

/** The wall clock in the home's timezone (the baseline's Europe/Moscow) at `ms`: `HH:MM` and the ISO weekday of its date. */
function local(ms: number): { hhmm: string; day: number } {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", hourCycle: "h23", hour: "2-digit", minute: "2-digit",
    weekday: "short" }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { hhmm: `${p.hour}:${p.minute}`, day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(String(p.weekday)) + 1 };
}

const MINUTE = 60_000;
/** How far a rule's firing may read before the event it is measured from: both are read off the clock in one step. */
const STEP_MS = 1_000;

/**
 * Restarts the steward, `between` running while it is down, and connects each client's seam (the
 * owner's, the member's, the panel's, the brain's and the front's) again once it answers.
 */
export async function restartSteward(ctx: TestContext, between?: () => unknown): Promise<void> {
  await ctx.subject.restart(between);
  // Every seam the case holds is reconnected, so a case reads the restarted steward as each client.
  for (const who of ["owner", "olga", "panel", "brain", "front"] as const) {
    const fresh = await pollUntil(async () => McpSeam.connect(ctx.mcpUrl!, ctx.credentials![who]).catch(() => undefined), 15_000,
      "the restarted steward did not answer", 200);
    const old = ctx.steward![who];
    ctx.steward![who] = fresh;
    if (ctx.owner === old) ctx.owner = fresh;
    await old.close().catch(() => undefined);
  }
}

requirement("GA-RULE-1", {
  seam: "steward",
  covers: "a level rule (the lamp on → the dimmer on) fires once when the lamp comes on, and not again on a state the steward reads again (a model change) nor after a restart while it holds; the lamp coming on while the steward is down, it fires once at the restart, and once more at a restart while it held, having fired, the lamp having gone off and on while the steward was down; the lamp going off and on inside a cursor_expired gap, it fires once the steward reads the gap back; a gap in which only the dimmer's level moves, the lamp on throughout, fires it not",
}, async (ctx) => {
  const applier = ctx.standIn!.applier;
  const [dimmer] = await scripted(ctx, [{ fixture: "dimmer", adopt: "light" }]);
  // A witness on the dimmer's level: it fires on an event the steward follows after its start's state read.
  await mustDefine(ctx, [up("rule", { id: "lamp", name: "Лампа", conditions: [{ target: LAMP, key: "on", op: "eq", value: true }],
    actions: [{ target: dimmer, action: "onoff.turn_on", args: {} }] }),
  up("rule", { id: "witness", name: "Свидетель", conditions: [{ target: dimmer, key: "level", op: "ge", value: 50 }],
    actions: [{ target: dimmer, action: "level.set_level", args: { level: 10 } }] })], "the rules");
  const start = await cursorNow(ctx);
  applier.scriptValue(LAMP, "on", true, { cause: "device" });
  await fires(ctx, start, "lamp", 1, "the lamp on");
  applier.scriptFresh(dimmer!, 600);
  await stewardSees(ctx, "the dimmer's fresh_s", (d) => targetIn(d, dimmer!)?.fresh_s === 600);
  await restartSteward(ctx);
  const restarted = await cursorNow(ctx);
  applier.scriptValue(dimmer!, "level", 60, { cause: "device" });
  const after = await fires(ctx, restarted, "witness", 1, "the witness after the restart");
  ctx.evidence(`after the restart: ${after.map((e) => `${e.type}${e.rule ? ` ${e.rule}` : ""}`).join(", ")}`);
  mustEqual(firedOf(after, "lamp").length, 0, "the lamp rule's firings after a restart while it held, having fired");
  mustEqual(firedOf(await eventsAfter(ctx, start), "lamp").length, 1, "the lamp rule's firings before the restart");
  applier.scriptValue(LAMP, "on", false, { cause: "device" });
  await relayed(ctx, restarted, LAMP, "on", false, "the lamp off");
  // The dimmer is still on, so the firing's step is the steward's own skipped(already): the firing is what is graded.
  const down = await cursorNow(ctx);
  await restartSteward(ctx, () => applier.scriptValue(LAMP, "on", true, { cause: "device" }));
  const again = await pollUntil(async () => { const f = firedOf(await eventsAfter(ctx, down), "lamp"); return f.length ? f : undefined; }, 10_000,
    "the lamp rule did not fire at the restart, the lamp having come on while the steward was down", 100);
  ctx.evidence(`at the restart: ${again.map((e) => `rule_fired ${e.rule} ${e.firing}`).join(", ")}`);
  // Fired, the lamp off and on again while the steward is down: a new becoming true, read from the
  // applier's history at the restart, fires it once more (slice 11).
  await fires(ctx, down, "lamp", 1, "the lamp on while the steward was down");
  const offOn = await cursorNow(ctx);
  await restartSteward(ctx, () => {
    applier.scriptValue(LAMP, "on", false, { cause: "device" });
    applier.scriptValue(LAMP, "on", true, { cause: "device" });
  });
  const anew = await fires(ctx, offOn, "lamp", 1, "the lamp off and on while the steward was down, having fired");
  ctx.evidence(`after the restart: ${anew.map((e) => `${e.type}${e.rule ? ` ${e.rule}` : ""}${e.recovered ? " (recovered)" : ""}`).join(", ")}`);
  mustEqual(firedOf(await eventsAfter(ctx, offOn), "lamp").length, 1, "the lamp rule's firings at a restart after the lamp went off and on");
  // A cursor_expired gap: the lamp off and on inside it.
  const gap = await cursorNow(ctx);
  await cursorExpiredGap(ctx, () => {
    applier.scriptValue(LAMP, "on", false, { cause: "device" });
    applier.scriptValue(LAMP, "on", true, { cause: "device" });
  });
  const regained = await fires(ctx, gap, "lamp", 1, "the lamp off and on inside a cursor_expired gap");
  ctx.evidence(`after the gap: ${regained.map((e) => `${e.type}${e.rule ? ` ${e.rule}` : ""}${e.recovered ? " (recovered)" : ""}`).join(", ")}`);
  // A gap in which the lamp stays on.
  const held = await cursorNow(ctx);
  await cursorExpiredGap(ctx, () => applier.scriptValue(dimmer!, "level", 70, { cause: "device" }));
  const still = await relayed(ctx, held, dimmer!, "level", 70, "the dimmer's level inside a cursor_expired gap");
  mustEqual(firedOf(still, "lamp").length, 0, "the lamp rule's firings after a gap in which the lamp stayed on");
});

requirement("GA-RULE-2", {
  seam: "steward",
  covers: "the limit is false while the laptop is stale, Лиза's session opening then firing nothing, and fires once it is live; «no motion for 180 s» fires 180 s after the sensor read no motion, and, the sensor dead for a while, only 180 s after it is live again; a rule on the IR air conditioner's mode, which the stand-in assumes from the owner's set_mode, fires only once a report says it; a rule reading a sensor with no known fresh_s is a notice naming the rule and the sensor, delivered on the channel; a scenario whose if reads the sensor with no known fresh_s is a notice naming the scenario and the sensor; an if on a stale device holding no branch is graded under GA-SCN-8; an owner fresh_s longer than the declared one is not built (describe gives only the effective bound); a device adopted into a scenario's selector, and a wait's condition on a stale device, are built but not graded here (not built in the harness)",
}, async (ctx) => {
  const applier = ctx.standIn!.applier;
  const pc = await laptop(ctx);
  const [motion, ac, unbound] = await scripted(ctx, [{ fixture: "motion", adopt: "sensor" }, { fixture: "ac", adopt: "ac" },
    { fixture: "unbound", adopt: "sensor" }]);
  await mustDefine(ctx, [up("rule", limit(pc))], "the limit");
  let cursor = await cursorNow(ctx);
  applier.scriptLiveness(pc, "stale");
  session(ctx, pc, "liza", "active");
  const stale = await relayed(ctx, cursor, pc, "session.liza", "active", "Лиза's session opening on a stale laptop");
  ctx.evidence(`the laptop stale: ${stale.map((e) => `${e.type}${e.rule ? ` ${e.rule}` : ""}`).join(", ")}`);
  mustEqual(firedOf(stale, "limit").length, 0, "the limit's firings while the laptop is stale");
  applier.scriptLiveness(pc, "live");
  await fires(ctx, cursor, "limit", 1, "the laptop live again");

  // «No motion for 180 s», defined with the sensor reading no motion.
  cursor = await cursorNow(ctx);
  await mustDefine(ctx, [up("rule", { id: "dark", name: "Темно", trigger: { held: { target: motion, key: "motion", op: "eq", value: false, for_s: 180 } },
    actions: [{ target: LAMP, action: "onoff.turn_off", args: {} }] })], "no motion for 180 s");
  const defined = Date.parse((await pollUntil(async () => (await eventsAfter(ctx, cursor)).find((e) => e.type === "define"), 10_000,
    "the define of no motion for 180 s was not served", 100)).time);
  await ctx.time.stepAndWait(181_000);
  const first = firedOf(await fires(ctx, cursor, "dark", 1, "no motion for 180 s"), "dark")[0]!;
  ctx.evidence(`defined at ${new Date(defined).toISOString()}, fired at ${first.time}`);
  must(Date.parse(first.time) >= defined + 180_000 - STEP_MS, `no motion for 180 s fired at ${first.time}, before 180 s from ${new Date(defined).toISOString()}`);
  cursor = await cursorNow(ctx);
  applier.scriptValue(motion!, "motion", true, { cause: "device" });
  applier.scriptValue(motion!, "motion", false, { cause: "device" });
  await ctx.time.stepAndWait(100_000);
  applier.scriptLiveness(motion!, "dead");
  await ctx.time.stepAndWait(200_000);
  applier.scriptLiveness(motion!, "live");
  const back = await pollUntil(async () => (await eventsAfter(ctx, cursor)).find((e) => e.type === "liveness" && e.target === motion && e.new === "live"),
    10_000, "the sensor live again was not relayed", 100);
  await ctx.time.stepAndWait(181_000);
  const second = firedOf(await fires(ctx, cursor, "dark", 1, "no motion for 180 s after the sensor came back"), "dark")[0]!;
  ctx.evidence(`live again at ${back.time}, fired at ${second.time}`);
  must(Date.parse(second.time) >= Date.parse(back.time) + 180_000 - STEP_MS, `the held duration did not start afresh: fired at ${second.time}, live again at ${back.time}`);

  // The air conditioner's mode is the stand-in's guess from the owner's set_mode until a report says it.
  await mustDefine(ctx, [up("rule", { id: "cool", name: "Прохладно", conditions: [{ target: ac, key: "mode", op: "eq", value: "cool" }],
    actions: [{ target: LAMP, action: "onoff.turn_on", args: {} }] })], "a rule on the air conditioner's mode");
  cursor = await cursorNow(ctx);
  const set = await ownerOf(ctx).callOk("apply", { request: { endpoint: "owner-app", actions: [{ target: ac, action: "climate.set_mode", args: { mode: "cool" } }] },
    idempotency_key: `cool-${cursor}` });
  ctx.evidence(`the owner's set_mode: ${JSON.stringify(set.outcomes)}`);
  // The stand-in assumes the mode once the step ends sent.
  await pollUntil(async () => ((await ownerOf(ctx).callOk("outcome", { apply_id: set.apply_id })).outcomes as { outcome: string }[])[0]?.outcome === "sent"
    || undefined, 10_000, "the owner's set_mode did not end sent", 100);
  // A model change makes the steward read the state, with the assumed mode.
  applier.scriptFresh(ac!, 600);
  await pollUntil(async () => (((await ownerOf(ctx).callOk("state", { targets: [ac] })).targets as Record<string, { values: { key: string; assumed?: boolean }[] }>)[ac!]
    ?.values ?? []).some((v) => v.key === "mode" && v.assumed === true) || undefined, 10_000, "the steward never read the assumed mode", 100);
  applier.scriptValue(ac!, "mode", "cool", { cause: "device" });
  const fired = firedOf(await fires(ctx, cursor, "cool", 1, "the mode reported"), "cool")[0]!;
  // A rule firing on the assumed mode fires at once, maybe before the report is relayed: wait for the report, and fail, never throw,
  // if none comes (rule-on-an-assumed-value).
  const report = await pollUntil(async () => (await eventsAfter(ctx, cursor)).find((e) => e.type === "state" && e.target === ac && e.key === "mode"),
    10_000, `the rule fired (seq ${fired.seq}) on the mode the stand-in assumed, and no report of the mode was relayed`, 100);
  ctx.evidence(`the report at seq ${report.seq}, the rule fired at seq ${fired.seq}`);
  must(fired.seq > report.seq, "the rule fired on the mode the stand-in assumed, before any report said it");

  // A rule reading a sensor with no known fresh_s: a notice on the channel.
  applier.scriptFresh(unbound!, null);
  await stewardSees(ctx, "the sensor with no known fresh_s", (d) => targetIn(d, unbound!)?.fresh_s === null);
  const sent = sentFrom(ctx);
  await mustDefine(ctx, [up("rule", { id: "warm", name: "Тепло", conditions: [{ target: unbound, key: "temperature", op: "gt", value: 25 }],
    actions: [{ target: LAMP, action: "onoff.turn_on", args: {} }] })], "a rule reading the unbound sensor");
  const notice = await pollUntil(async () => sent().find((x) => x.action === "notify.notify" && String(x.for?.notice ?? "").startsWith("steward:unbounded:")),
    10_000, "no notice was sent for a rule reading a sensor with no known fresh_s", 100);
  ctx.evidence(`the notice: ${JSON.stringify(notice.args)}`);
  must(String(notice.args.text).includes("warm") && String(notice.args.text).includes(unbound!), "the notice does not name the rule and the sensor", notice.args);
  // A scenario's if reading the same sensor: a notice naming the scenario.
  await mustDefine(ctx, [up("scenario", { id: "warmth", name: "Тепло", mode: "single",
    steps: [{ if: { target: unbound, key: "temperature", op: "gt", value: 25 }, then: [{ target: LAMP, action: "onoff.turn_on", args: {} }] }] })],
  "a scenario whose if reads the unbound sensor");
  const ifNotice = await pollUntil(async () => sent().find((x) => x.action === "notify.notify" && String(x.for?.notice ?? "").startsWith("steward:unbounded-if:")),
    10_000, "no notice was sent for a scenario's if reading a sensor with no known fresh_s", 100);
  ctx.evidence(`the if's notice: ${JSON.stringify(ifNotice.args)}`);
  must(String(ifNotice.args.text).includes("warmth") && String(ifNotice.args.text).includes(unbound!), "the notice does not name the scenario and the sensor", ifNotice.args);
});

requirement("GA-RULE-3", {
  seam: "steward",
  covers: "a window starting two minutes on, Лиза's session open, fires the limit on entering it and not before; an overnight window whose days name only yesterday, which started yesterday evening and holds now, fires at define; define refuses a window whose from equals its until; a daylight-saving gap and a doubled time have no stand-in path in a home on Moscow time (unit-tested)",
}, async (ctx) => {
  const pc = await laptop(ctx);
  session(ctx, pc, "dmitry", "active");
  session(ctx, pc, "liza", "active");
  await stewardSees(ctx, "the laptop", (d) => targetIn(d, pc) !== undefined);
  const now = ctx.time.now();
  const entry = Math.ceil((now + 2 * MINUTE) / MINUTE) * MINUTE;
  const cursor = await cursorNow(ctx);
  await mustDefine(ctx, [up("rule", limit(pc, "liza", { conditions: [{ between: { from: local(entry).hhmm, until: local(entry + 30 * MINUTE).hhmm } },
    { target: pc, key: "session.liza", not_in: LOCKED }] }))], "the limit in a window two minutes on");
  await ctx.time.stepAndWait(entry - now - 30_000);
  await ctx.time.stepAndWait(60_000);
  const fired = firedOf(await fires(ctx, cursor, "limit", 1, "entering the window"), "limit")[0]!;
  ctx.evidence(`the window starts at ${new Date(entry).toISOString()}; fired at ${fired.time}`);
  must(Date.parse(fired.time) >= entry, `the limit fired at ${fired.time}, before its window at ${new Date(entry).toISOString()}`);
  // An overnight window that started yesterday: from an hour ahead of now's clock, until half an hour ahead, so it ends today.
  const t = ctx.time.now();
  const shift = local(t + 30 * MINUTE).hhmm < local(t + 60 * MINUTE).hhmm ? 0 : 60 * MINUTE;
  const from = t + 60 * MINUTE + shift;
  const yesterday = local(from - 24 * 60 * MINUTE).day;
  const c2 = await cursorNow(ctx);
  await mustDefine(ctx, [up("rule", limit(pc, "dmitry", { conditions: [{ between: { from: local(from).hhmm, until: local(t + 30 * MINUTE + shift).hhmm,
    days: [yesterday] } }, { target: pc, key: "session.dmitry", not_in: LOCKED }] }))], "an overnight window started yesterday");
  ctx.evidence(`the overnight window ${local(from).hhmm}–${local(t + 30 * MINUTE + shift).hhmm} on day ${yesterday}, now ${local(t).hhmm} on day ${local(t).day}`);
  await fires(ctx, c2, "limit-dmitry", 1, "an overnight window that started yesterday");
  const code = await mustRefuse(ctx, [up("rule", limit(pc, "liza", { id: "same", conditions: [{ between: { from: "21:00", until: "21:00" } }] }))],
    "a window whose from equals its until");
  mustEqual(code, "invalid_request", "the error for a window whose from equals its until");
});

requirement("GA-RULE-4", {
  seam: "steward",
  covers: "the limit fires on Лиза's session reading unknown after locked; Лиза's account retired from the laptop's accounts, the limit reads her key false and does not fire, while a witness rule on Дмитрий's account fires on the next report; a key the device never reports reads true (unit-tested)",
}, async (ctx) => {
  const applier = ctx.standIn!.applier;
  const pc = await laptop(ctx);
  await mustDefine(ctx, [up("rule", limit(pc)), up("rule", limit(pc, "dmitry"))], "the limits of both accounts");
  let cursor = await cursorNow(ctx);
  session(ctx, pc, "liza", "unknown");
  await fires(ctx, cursor, "limit", 1, "Лиза's session reading unknown");
  await relayed(ctx, cursor, pc, "session.liza", "locked", "the lock taking");
  cursor = await cursorNow(ctx);
  applier.scriptAccounts(pc, { dmitry: "Дмитрий" });
  await stewardSees(ctx, "Лиза's account retired", (d) => targetIn(d, pc)?.accounts && !("liza" in targetIn(d, pc).accounts));
  session(ctx, pc, "dmitry", "active");
  const events = await fires(ctx, cursor, "limit-dmitry", 1, "the witness on Дмитрий's account");
  ctx.evidence(`after Лиза's account was retired: ${events.map((e) => `${e.type}${e.rule ? ` ${e.rule}` : ""}`).join(", ")}`);
  mustEqual(firedOf(events, "limit").length, 0, "the limit's firings on a retired account");
});

requirement("GA-RULE-5", {
  seam: "steward",
  covers: "the limit, a rule of conditions only, fires when Лиза's session opens, its lock taking makes it false, and it fires again when her session reads unknown; idle while it holds fires nothing (unit-tested)",
}, async (ctx) => {
  const pc = await laptop(ctx);
  await mustDefine(ctx, [up("rule", limit(pc))], "the limit");
  const cursor = await cursorNow(ctx);
  session(ctx, pc, "liza", "active");
  await fires(ctx, cursor, "limit", 1, "Лиза's session opening");
  await relayed(ctx, cursor, pc, "session.liza", "locked", "the lock taking");
  session(ctx, pc, "liza", "unknown");
  const events = await fires(ctx, cursor, "limit", 2, "Лиза unlocking");
  ctx.evidence(`fired at ${firedOf(events, "limit").map((e) => e.time).join(", ")}`);
});

requirement("GA-RULE-6", {
  seam: "steward",
  covers: "define refuses an exception whose until is not after its from, in a rule and as a rule_exception; the owner grants half an hour as a rule_exception, Лиза's session opens inside it and the limit does not fire until the exception ends, then fires; an edge rule's trigger inside an exception is lost (unit-tested)",
}, async (ctx) => {
  const pc = await laptop(ctx);
  await mustDefine(ctx, [up("rule", limit(pc))], "the limit");
  const now = ctx.time.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  for (const [what, change] of [
    ["an exception ending at its start", up("rule", limit(pc, "liza", { exceptions: [{ from: iso(now), until: iso(now) }] }))],
    ["a rule_exception ending before its start", up("rule_exception", { rule: "limit", from: iso(now + MINUTE), until: iso(now) })],
  ] as const) mustEqual(await mustRefuse(ctx, [change], what), "invalid_request", `the error for ${what}`);
  const until = now + 30 * MINUTE;
  await mustDefine(ctx, [up("rule_exception", { rule: "limit", from: iso(now - MINUTE), until: iso(until) })], "half an hour granted");
  const cursor = await cursorNow(ctx);
  session(ctx, pc, "liza", "active");
  await relayed(ctx, cursor, pc, "session.liza", "active", "Лиза's session opening");
  await ctx.time.stepAndWait(30 * MINUTE + 1_000);
  const fired = firedOf(await fires(ctx, cursor, "limit", 1, "the exception ending"), "limit")[0]!;
  ctx.evidence(`the exception ends at ${iso(until)}; fired at ${fired.time}`);
  must(Date.parse(fired.time) >= until, `the limit fired at ${fired.time}, inside the exception ending ${iso(until)}`);
});

requirement("GA-SCN-4", {
  seam: "steward",
  covers: "a rule's own action: its confirm step (the dimmer raised to confirm) is sent with an authored token for the rule; its step on the open tv, whose power code toggles, is skipped(toggle_only) and never sent; its step on the lamp, respecting occupancy in no room, is skipped(occupancy_unknown); in_use and in_use_unknown are slice 8's, a run the rule starts (the same three steps) ends them alike, its confirm step sent with an authored token for { run, rule }; a run a schedule starts alike, its confirm step's token for { run, schedule }",
}, async (ctx) => {
  const pc = await laptop(ctx);
  const [dimmer, tv] = await scripted(ctx, [{ fixture: "dimmer", adopt: "light" }, { fixture: "tv", adopt: "tv" }]);
  await raiseTier(ctx, dimmer!, "onoff.turn_on", "confirm");
  await mustDefine(ctx, [up("rule", { id: "all", name: "Всё", conditions: [{ target: pc, key: "session.liza", not_in: LOCKED }],
    actions: [{ target: dimmer, action: "onoff.turn_on", args: {} }, { target: tv, action: "onoff.turn_off", args: {} },
      { target: LAMP, action: "onoff.turn_on", args: {}, respect_occupancy: true }] })], "a rule on a confirm step, a toggle and an unknown room");
  const sent = sentFrom(ctx);
  const cursor = await cursorNow(ctx);
  session(ctx, pc, "liza", "active");
  await fires(ctx, cursor, "all", 1, "the rule");
  // Each step's first outcome: the dimmer's acked comes after.
  const outcomes = await pollUntil(async () => {
    const own = (await eventsAfter(ctx, cursor)).filter((e) => e.type === "outcome" && e.cause?.rule === "all" && e.outcome !== "acked");
    return own.length >= 3 ? own : undefined;
  }, 10_000, "the rule's outcomes", 100);
  const got = outcomes.map((e) => `${e.target} ${e.outcome}${e.reason ? `(${e.reason})` : ""}`).sort();
  ctx.evidence(`the rule's outcomes: ${got.join(", ")}; the stand-in received ${JSON.stringify(sent().map((x) => [x.target, x.action, x.token, x.for]))}`);
  mustEqual(got, [`${dimmer} dispatched`, `${LAMP} skipped(occupancy_unknown)`, `${tv} skipped(toggle_only)`].sort(), "the rule's outcomes");
  // The notices the rule's outcomes raise (GA-RULE-8) are sent too; they are not the rule's steps.
  mustEqual(sent().filter((x) => x.for?.notice === undefined).map((x) => [x.target, x.token, x.tokenFault ?? null, x.for]), [[dimmer, true, null, { rule: "all" }]],
    "what the stand-in received for the rule");
  // The same steps in a run the rule starts.
  await mustDefine(ctx, [up("scenario", { id: "steps", name: "Шаги", mode: "single", steps: [{ target: dimmer, action: "onoff.turn_on", args: {} },
    { target: tv, action: "onoff.turn_off", args: {} }, { target: LAMP, action: "onoff.turn_on", args: {}, respect_occupancy: true }] }),
  up("rule", { id: "start", name: "Пуск", conditions: [{ target: pc, key: "session.liza", op: "eq", value: "idle" }], actions: [{ scenario: "steps" }] })],
  "a rule starting a run of the steps");
  // The rule's own action turned the dimmer on (its ack comes after its dispatch): off again once it
  // has, so the run's step is not skipped(already).
  await relayed(ctx, cursor, dimmer!, "on", true, "the dimmer on by the rule");
  ctx.standIn!.applier.scriptValue(dimmer!, "on", false, { cause: "device" });
  await relayed(ctx, cursor, dimmer!, "on", false, "the dimmer off");
  const runSentAll = sentFrom(ctx);
  const c2 = await cursorNow(ctx);
  session(ctx, pc, "liza", "idle");
  const started = await pollUntil(async () => (await eventsAfter(ctx, c2)).find((e) => e.type === "scenario" && e.change === "started" && e.scenario === "steps"),
    10_000, "the rule never started its run", 100);
  const st = await runReads(ctx, String(started.run_id), "ended(done)", "the rule's run");
  const runSteps = runSent(runSentAll, String(started.run_id));
  ctx.evidence(`the rule's run: failed ${JSON.stringify(failedOf(st))}; sent ${JSON.stringify(runSteps.map((x) => [x.target, x.token, x.tokenFault ?? null, x.for]))}`);
  mustEqual(failedOf(st).map((x) => x.replace(/^s\d+ /, "")).sort(), ["skipped(occupancy_unknown)", "skipped(toggle_only)"], "the rule's run's failed steps");
  mustEqual(runSteps.map((x) => [x.target, x.token, x.tokenFault ?? null, x.for]), [[dimmer, true, null, { run: started.run_id, rule: "start" }]], "what the rule's run sent");
  // The same steps in a run a schedule starts: the dimmer off again first.
  await relayed(ctx, c2, dimmer!, "on", true, "the dimmer on by the rule's run");
  ctx.standIn!.applier.scriptValue(dimmer!, "on", false, { cause: "device" });
  await relayed(ctx, c2, dimmer!, "on", false, "the dimmer off again");
  const schedSentAll = sentFrom(ctx);
  const c3 = await cursorNow(ctx);
  const { run_id: sid } = await scheduleSoon(ctx, "steps-at", "steps");
  await runReads(ctx, sid, "ended(done)", "the scheduled run");
  // Its steps' outcomes, as the rule's own action's: failed_steps are GA-SCN-11's.
  const schedOutcomes = (await eventsAfter(ctx, c3)).filter((e) => e.type === "outcome" && e.cause?.run === sid && e.outcome !== "acked")
    .map((e) => `${e.target} ${e.outcome}${e.reason ? `(${e.reason})` : ""}`).sort();
  const schedSteps = runSent(schedSentAll, sid);
  ctx.evidence(`the scheduled run's outcomes: ${schedOutcomes.join(", ")}; sent ${JSON.stringify(schedSteps.map((x) => [x.target, x.token, x.tokenFault ?? null, x.for]))}`);
  mustEqual(schedOutcomes, [`${dimmer} dispatched`, `${LAMP} skipped(occupancy_unknown)`, `${tv} skipped(toggle_only)`].sort(), "the scheduled run's outcomes");
  mustEqual(schedSteps.map((x) => [x.target, x.token, x.tokenFault ?? null, x.for]), [[dimmer, true, null, { run: sid, schedule: "steps-at" }]], "what the scheduled run sent");
});

requirement("GA-AUTH-5", {
  seam: "steward",
  covers: "the limit's session.lock reaches the stand-in via rule, brain false, for the rule; a person-started run's steps carry its starting endpoint's via and brain (the panel's panel, false; the brain's at the kitchen voice, voice, true); a rule-started run's via rule, brain false; a schedule-started run's via schedule, brain false; a front's duck is a later slice's",
}, async (ctx) => {
  const pc = await laptop(ctx);
  await mustDefine(ctx, [up("rule", limit(pc))], "the limit");
  const sent = sentFrom(ctx);
  session(ctx, pc, "liza", "active");
  const lock = await pollUntil(async () => sent().find((x) => x.action === "session.lock"), 10_000, "the limit's lock never reached the stand-in", 100);
  ctx.evidence(`the lock: ${JSON.stringify([lock.via, lock.brain, lock.for, lock.args])}`);
  mustEqual([lock.via, lock.brain, lock.for], ["rule", false, { rule: "limit" }], "the lock's via, brain and for");
  // The rule's scenario turns the lamp off, which the person's runs turned on, so its step is sent, not already (the steward's own skip).
  await mustDefine(ctx, [up("scenario", { id: "lamp", name: "Лампа", mode: "single", steps: [{ target: LAMP, action: "onoff.turn_on", args: {} }] }),
    up("scenario", { id: "dark", name: "Темно", mode: "single", steps: [{ target: LAMP, action: "onoff.turn_off", args: {} }] }),
    up("rule", { id: "start", name: "Пуск", conditions: [{ target: pc, key: "session.liza", op: "eq", value: "idle" }], actions: [{ scenario: "dark" }] })],
  "scenarios of the lamp, and a rule starting one");
  const s = ctx.steward!;
  const vias: string[] = [];
  for (const [seam, endpoint, extra] of [[s.panel, "hall-panel", {}], [s.brain, "kitchen-voice", { speaker: "olga" }]] as const) {
    const { run_id } = await startRun(ctx, seam, endpoint, "lamp", extra);
    await runReads(ctx, run_id, "ended(done)", `the run from ${endpoint}`);
    vias.push(...runSent(sent, run_id).map((x) => `${endpoint}: ${x.via} ${x.brain}`));
  }
  const c = await cursorNow(ctx);
  session(ctx, pc, "liza", "idle");
  const started = await pollUntil(async () => (await eventsAfter(ctx, c)).find((e) => e.type === "scenario" && e.change === "started" && e.scenario === "dark"),
    10_000, "the rule never started its run", 100);
  await runReads(ctx, String(started.run_id), "ended(done)", "the rule's run");
  vias.push(...runSent(sent, String(started.run_id)).map((x) => `rule: ${x.via} ${x.brain}`));
  const { run_id: sid } = await scheduleSoon(ctx, "lamp-at", "lamp");
  await runReads(ctx, sid, "ended(done)", "the scheduled run");
  vias.push(...runSent(sent, sid).map((x) => `schedule: ${x.via} ${x.brain}`));
  ctx.evidence(`the runs' via and brain: ${vias.join("; ")}`);
  mustEqual(vias, ["hall-panel: panel false", "kitchen-voice: voice true", "rule: rule false", "schedule: schedule false"], "the runs' via and brain");
});
