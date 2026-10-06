import { must, mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { requirement } from "../../registry.js";
import { LAMP } from "../../steward-home.js";
import { pollUntil } from "../../util.js";
import { sentFrom } from "./answers.js";
import { cursorNow, eventsAfter, restartSteward, type Ev } from "./rules.js";
import { act, del, mustDefine, up } from "./util.js";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** The wall clock in `tz` at `ms`: `HH:MM` and the date `YYYY-MM-DD`. */
export function wall(ms: number, tz = "Europe/Moscow"): { hhmm: string; date: string } {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { hhmm: `${p.hour}:${p.minute}`, date: `${p.year}-${p.month}-${p.day}` };
}

/** The next whole minute at least `ms` from now on the harness's clock. */
export const minuteAfter = (ctx: TestContext, ms: number) => Math.ceil((ctx.time.now() + ms) / MINUTE) * MINUTE;

/** The `scenario` events of the runs `schedule` started since `cursor`. */
export async function startsOf(ctx: TestContext, cursor: string, schedule: string): Promise<Ev[]> {
  return (await eventsAfter(ctx, cursor)).filter((e) => e.type === "scenario" && e.cause?.schedule === schedule);
}

/**
 * Steps the harness's clock to half a minute before `at`, then a minute on, the schedule's time in
 * between, so its timer fires on time (a timer fired over a minute late runs nothing, GA-SCHED-2).
 */
export async function stepOver(ctx: TestContext, at: number): Promise<void> {
  const before = at - 30_000 - ctx.time.now();
  if (before > 0) await ctx.time.stepAndWait(before);
  await ctx.time.stepAndWait(MINUTE);
}

/**
 * Defines schedule `id` of `scenario` two minutes on, in the baseline's Moscow time, steps the clock
 * over its time, and returns the run it started.
 */
export async function scheduleSoon(ctx: TestContext, id: string, scenario: string): Promise<{ run_id: string; event: Ev }> {
  const at = minuteAfter(ctx, 2 * MINUTE);
  await mustDefine(ctx, [up("schedule", { id, scenario, time: wall(at).hhmm })], `schedule ${id}`);
  const cursor = await cursorNow(ctx);
  await stepOver(ctx, at);
  const event = await pollUntil(async () => (await startsOf(ctx, cursor, id)).find((e) => e.change === "started"), 10_000,
    `schedule ${id} started no run of ${scenario}`, 100);
  return { run_id: String(event.run_id), event };
}

const lampScene = (id: string) => up("scenario", { id, name: id, mode: "single", steps: [act(LAMP)] });

requirement("GA-SCHED-1", {
  seam: "steward",
  covers: "a schedule whose exception skips today's run records schedule_skipped at its time and starts none; one whose exception moves today's run five minutes later starts none at its time and one at the moved time, and tomorrow's run at its own time",
}, async (ctx) => {
  // Two scenarios, so tomorrow's two runs at one time do not meet in one `single` scenario.
  await mustDefine(ctx, [lampScene("lamp"), lampScene("lamp2")], "two scenarios of the lamp");
  const at = minuteAfter(ctx, 2 * MINUTE);
  const today = wall(at).date;
  const moved = at + 5 * MINUTE;
  await mustDefine(ctx, [up("schedule", { id: "skip", scenario: "lamp", time: wall(at).hhmm, exceptions: [{ date: today, action: "skip" }] }),
    up("schedule", { id: "move", scenario: "lamp2", time: wall(at).hhmm, exceptions: [{ date: today, action: "move", time: wall(moved).hhmm }] })],
  "a schedule skipped today, and one moved five minutes on");
  const cursor = await cursorNow(ctx);
  await stepOver(ctx, at);
  const skipped = await pollUntil(async () => (await eventsAfter(ctx, cursor)).find((e) => e.type === "schedule_skipped" && e.schedule === "skip"), 10_000,
    "no schedule_skipped for today's skipped run", 100);
  ctx.evidence(`at ${wall(at).hhmm}: ${JSON.stringify(skipped)}`);
  mustEqual([skipped.date, skipped.at], [today, new Date(at).toISOString()], "the skipped run's date and time");
  mustEqual((await startsOf(ctx, cursor, "skip")).length + (await startsOf(ctx, cursor, "move")).length, 0, "runs started at the schedules' own time");
  await stepOver(ctx, moved);
  const run = await pollUntil(async () => (await startsOf(ctx, cursor, "move")).find((e) => e.change === "started"), 10_000, "no run at the moved time", 100);
  ctx.evidence(`the moved run started at ${run.time}`);
  must(Date.parse(run.time) >= moved, `the moved run started at ${run.time}, before ${new Date(moved).toISOString()}`);
  mustEqual((await startsOf(ctx, cursor, "skip")).length, 0, "runs of the skipped schedule");
  // Tomorrow: each at its own time.
  const tomorrow = at + DAY;
  await ctx.time.stepAndWait(tomorrow - 10 * MINUTE - ctx.time.now());
  const c2 = await cursorNow(ctx);
  await stepOver(ctx, tomorrow);
  const both = await pollUntil(async () => {
    const s = [...await startsOf(ctx, c2, "skip"), ...await startsOf(ctx, c2, "move")].filter((e) => e.change !== "ended");
    return s.length >= 2 ? s : undefined;
  }, 10_000, "tomorrow's runs did not both start at their time", 100);
  ctx.evidence(`tomorrow at ${wall(tomorrow).hhmm}: ${both.map((e) => `${e.cause.schedule} ${e.change} ${e.time}`).join("; ")}`);
  mustEqual(both.map((e) => e.cause.schedule).sort(), ["move", "skip"], "the schedules tomorrow's runs came from");
});

requirement("GA-SCHED-2", {
  seam: "steward",
  covers: "a schedule's time passing while the steward is down (the harness's restart): at its start the steward records schedule_missed for that date and time and starts no run, sending nothing",
}, async (ctx) => {
  await mustDefine(ctx, [lampScene("lamp")], "a scenario of the lamp");
  const at = minuteAfter(ctx, 2 * MINUTE);
  await mustDefine(ctx, [up("schedule", { id: "dusk", scenario: "lamp", time: wall(at).hhmm })], "a schedule two minutes on");
  const cursor = await cursorNow(ctx);
  const sent = sentFrom(ctx);
  await restartSteward(ctx, () => ctx.time.step(at + 5 * MINUTE - ctx.time.now()));
  const missed = await pollUntil(async () => (await eventsAfter(ctx, cursor)).find((e) => e.type === "schedule_missed"), 15_000,
    "the restarted steward recorded no schedule_missed", 100);
  ctx.evidence(`after the restart: ${JSON.stringify(missed)}`);
  mustEqual([missed.schedule, missed.date, missed.at], ["dusk", wall(at).date, new Date(at).toISOString()], "the missed run");
  await ctx.time.stepAndWait(5_000);
  mustEqual((await startsOf(ctx, cursor, "dusk")).length, 0, "runs the schedule started late");
  mustEqual(sent().length, 0, "what the stand-in received");
});

requirement("GA-SCHED-3", {
  seam: "steward",
  covers: "in a home on Berlin time: a schedule at 02:30 on the night the clocks go forward (02:00 to 03:00, 2030-03-31) runs at 03:00, not before; one at 02:30 on the night they go back (03:00 to 02:00, 2030-10-27) runs at the first 02:30 and not at the second",
}, async (ctx) => {
  const BERLIN = "Europe/Berlin";
  await mustDefine(ctx, [up("home", { timezone: BERLIN }), lampScene("lamp")], "a home on Berlin time");
  // Spring: 2030-03-31 02:00 CET is 01:00Z, when the wall clock jumps to 03:00 CEST.
  const jump = Date.parse("2030-03-31T01:00:00Z");
  await ctx.time.stepAndWait(jump - 3 * MINUTE - ctx.time.now());
  await mustDefine(ctx, [up("schedule", { id: "gap", scenario: "lamp", time: "02:30" })], "a schedule in the gap");
  let cursor = await cursorNow(ctx);
  await ctx.time.stepAndWait(jump - 30_000 - ctx.time.now());
  mustEqual((await startsOf(ctx, cursor, "gap")).length, 0, `runs before ${wall(jump, BERLIN).hhmm}`);
  await ctx.time.stepAndWait(MINUTE);
  const spring = await pollUntil(async () => (await startsOf(ctx, cursor, "gap")).find((e) => e.change === "started"), 10_000, "no run once the clocks went forward", 100);
  ctx.evidence(`the gap's run started at ${spring.time} (${wall(Date.parse(spring.time), BERLIN).hhmm} in Berlin)`);
  must(Date.parse(spring.time) >= jump && Date.parse(spring.time) < jump + MINUTE, `the gap's run started at ${spring.time}, not at the first minute after the gap`);
  await mustDefine(ctx, [del("schedule", { id: "gap" })], "the gap's schedule gone");
  // Autumn: 2030-10-27 03:00 CEST is 01:00Z, when the wall clock goes back to 02:00 CET; 02:30 is 00:30Z and again 01:30Z.
  const first = Date.parse("2030-10-27T00:30:00Z");
  await ctx.time.stepAndWait(first - 3 * MINUTE - ctx.time.now());
  await mustDefine(ctx, [up("schedule", { id: "twice", scenario: "lamp", time: "02:30" })], "a schedule at a time that occurs twice");
  cursor = await cursorNow(ctx);
  await stepOver(ctx, first);
  const autumn = await pollUntil(async () => (await startsOf(ctx, cursor, "twice")).find((e) => e.change === "started"), 10_000, "no run at the first 02:30", 100);
  ctx.evidence(`the first 02:30's run started at ${autumn.time}`);
  must(Date.parse(autumn.time) >= first && Date.parse(autumn.time) < first + MINUTE, `the run started at ${autumn.time}, not at the first 02:30`);
  const second = first + 60 * MINUTE;
  await ctx.time.stepAndWait(second - 10 * MINUTE - ctx.time.now());
  const c2 = await cursorNow(ctx);
  await stepOver(ctx, second);
  await ctx.time.stepAndWait(5_000);
  const again = (await startsOf(ctx, c2, "twice")).filter((e) => e.change === "started");
  ctx.evidence(`at the second 02:30: ${again.length} runs started`);
  mustEqual(again.length, 0, "runs at the second 02:30");
});
