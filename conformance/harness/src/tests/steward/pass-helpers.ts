/**
 * The helpers GA-LEASE-9, GA-LEASE-10 and GA-LEASE-11's checks share with GA-LEASE-12's: fixtures on a bench of
 * their own, press rules, holders and what became of a step.
 */
import { mustEqual, RequirementFailure } from "../../assert.js";
import type { TestContext } from "../../context.js";
import type { McpSeam } from "../../seams/mcp.js";
import { pollUntil } from "../../util.js";
import { applyInline, outcomes, sentFrom } from "./answers.js";
import { cursorNow, eventsAfter, fires } from "./rules.js";
import { answered, holdEnds, stepOf } from "./hold-helpers.js";
import { act, holderWord, leaseEventsSince, leaseOf, scripted, up } from "./util.js";

export { answered, stepOf };
export const ON = "onoff.turn_on";
export const OFF = "onoff.turn_off";
export const LOCK = "lock.lock";
/** The scripted button's occurrence key (the sim's `button`): each press an occurrence, never state. */
export const KEY = "org.galatea.test.button.action";
/** The vibration sensor's (the sim's `shaker`) occurrence key its device keeps `personal`. */
export const PERSONAL = "org.galatea.test.vibration.presence";

export type Fx = "button" | "lamp" | "dimmer" | "motion" | "heater" | "doorlock" | "watervalve" | "valve" | "shaker";
const ADOPT: Record<Fx, string> = { button: "sensor", lamp: "light", dimmer: "light", motion: "sensor", heater: "socket", doorlock: "door_lock",
  watervalve: "water_valve", valve: "water_valve", shaker: "sensor" };

/**
 * Fixture devices scripted on a bridge of their own, adopted as their class, no room: each part of a
 * check has its own, so no lease, rule or occurrence of one part meets another's. Their ids, by fixture.
 */
export async function bench<F extends Fx>(ctx: TestContext, bridge: string, fixtures: F[]): Promise<Record<F, string>> {
  const ids = await scripted(ctx, fixtures.map((f) => ({ fixture: f, adopt: ADOPT[f], bridge })));
  return Object.fromEntries(fixtures.map((f, i) => [f, ids[i]!])) as Record<F, string>;
}

/** The holder a press rule's hold names: the rule and the occurrence, never a person (GA-LEASE-9). */
export const pressHolder = (rule: string, button: string, value = "1_single") => ({ rule, press: { target: button, key: KEY, value } });

/** A rule on `button`'s occurrence `value` of `key`, marked `press` unless told not to, with `actions` and `extra` over it. */
export const onPress = (id: string, button: string, actions: unknown[],
  o: { key?: string; value?: unknown; press?: boolean; extra?: Record<string, unknown> } = {}) =>
  up("rule", { id, name: id, trigger: { event: { target: button, type: "occurrence", key: o.key ?? KEY, value: o.value ?? "1_single",
    ...(o.press === false ? {} : { press: true }) } }, actions, ...o.extra });

/** A level rule doing `action` on `target` while `motion` reads true: the owner's rule a hold refuses or lets through. */
export const whileMotion = (id: string, motion: string, target: string, action = OFF) => up("rule", { id, name: id,
  conditions: [{ target: motion, key: "motion", op: "eq", value: true }], actions: [{ target, action, args: {} }] });

/** A level rule locking `door` while it reads unlocked (HS18's auto-lock). */
export const autoLock = (id: string, door: string) => up("rule", { id, name: id, conditions: [{ target: door, key: "locked", op: "eq", value: false }],
  actions: [{ target: door, action: LOCK, args: {} }] });

/** The scripted button pressed: an occurrence on its key (applier, *Occurrences*). */
export const press = (ctx: TestContext, button: string, value: unknown = "1_single", key = KEY) =>
  ctx.standIn!.applier.scriptEvent("occurrence", { target: button, key, value, cause: "device" });

/** Motion on the scripted sensor, as its device reports it: takes no lease (GA-LEASE-2). */
export const motionOn = (ctx: TestContext, motion: string, value = true) => ctx.standIn!.applier.scriptValue(motion, "motion", value, { cause: "device" });

/**
 * `target`'s lease holder until it reads `want` (undefined: no lease), polled for `wallMs` of wall time (10 s; the run's
 * allowance after a computed end, R-20); the lease.
 */
export async function holderIs(ctx: TestContext, target: string, want: string | undefined, what: string,
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
export async function holds(ctx: TestContext, seam: McpSeam, endpoint: string, target: string, action: string, holder: string, what: string,
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
export async function runStepOf(ctx: TestContext, cursor: string, sent: ReturnType<typeof sentFrom>, target: string, action: string, what: string,
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
export async function endsAndFires(ctx: TestContext, target: string, holder: string, end: string, rules: string[], what: string): Promise<void> {
  const { cursor } = await holdEnds(ctx, target, what, { holder, end });
  for (const r of rules) await fires(ctx, cursor, r, 1, `${what}: the rule it refused at its end`, ctx.allowanceMs);
}

/** The `lease` events of `target` since `cursor`, each `change end holder`, with ` restored` when marked so. */
export async function leaseLine(ctx: TestContext, cursor: string, target: string): Promise<string[]> {
  return (await leaseEventsSince(ctx, cursor)).filter((e) => e.target === target)
    .map((e) => `${e.change}${e.end ? ` ${e.end}` : ""} ${holderWord(e.holder)}${e.restored === true ? " restored" : ""}`);
}

/** A device's `key` (`on` unless told) reported `value` by the device itself, taking no lease: a person's step setting it otherwise is then not `already`. */
export const reported = (ctx: TestContext, target: string, key = "on", value: unknown = true) => ctx.standIn!.applier.scriptValue(target, key, value, { cause: "device" });
