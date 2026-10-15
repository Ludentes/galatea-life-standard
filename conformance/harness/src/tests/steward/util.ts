import { randomUUID } from "node:crypto";
import { fixtureDevices } from "@ludentes/galatea-life-sim";
import { must } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { constantMs } from "../../manifest.js";
import { McpSeam, type McpResult } from "../../seams/mcp.js";
import { LAMP as STEWARD_LAMP } from "../../steward-home.js";
import { pollUntil } from "../../util.js";

export const SECOND = 1_000;
export const MINUTE = 60_000;
/** An instant as RFC 3339. */
export const iso = (ms: number) => new Date(ms).toISOString();
/** How far an instant a check computes from the moments it saw (a receipt lies between two of them) may sit outside them: rounding only. */
export const ROUNDING_MS = 1_000;

/** Steps the harness's clock to `atMs`, waiting for it; not at all when it has passed. */
export async function stepTo(ctx: TestContext, atMs: number): Promise<void> {
  const left = atMs - ctx.time.now();
  if (left > 0) await ctx.time.stepAndWait(left);
}

/** A lease's holder as a word: a cause, an endpoint's id, `press:<rule>`, `run:<id>` or `safety:<rule>`. */
export function holderWord(h: unknown): string {
  if (typeof h === "string") return h;
  const o = (h ?? {}) as Record<string, unknown>;
  if (typeof o.rule === "string" && o.press !== undefined) return `press:${o.rule}`;
  if (typeof o.run === "string") return `run:${o.run}`;
  if (typeof o.safety_rule === "string") return `safety:${o.safety_rule}`;
  if (typeof o.endpoint === "string") return o.endpoint;
  return JSON.stringify(h);
}

export const up = (kind: string, value: unknown) => ({ op: "upsert", kind, value });
export const del = (kind: string, value: unknown) => ({ op: "delete", kind, value });

/** The wall clock in `tz` at `ms`: `HH:MM` and the date `YYYY-MM-DD`. */
export function wall(ms: number, tz = "Europe/Moscow"): { hhmm: string; date: string } {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { hhmm: `${p.hour}:${p.minute}`, date: `${p.year}-${p.month}-${p.day}` };
}

/** The owner's seam, from the steward seam's setup. */
export const ownerOf = (ctx: TestContext): McpSeam => ctx.steward!.owner;

/** The house's revision as the owner's `describe` gives it. */
export async function revisionOf(ctx: TestContext): Promise<number> {
  return (await ownerOf(ctx).callOk("describe")).revision as number;
}

/** `define` as the owner, from their app, at the current revision unless told otherwise. */
export async function ownerDefine(ctx: TestContext, changes: unknown[],
  o: { dry_run?: boolean; expected_revision?: number; as?: McpSeam; endpoint?: string; speaker?: string } = {}): Promise<McpResult> {
  const expected_revision = o.expected_revision ?? await revisionOf(ctx);
  return (o.as ?? ownerOf(ctx)).call("define", { endpoint: o.endpoint ?? "owner-app", ...(o.speaker ? { speaker: o.speaker } : {}),
    changes, expected_revision, dry_run: o.dry_run ?? false });
}

/**
 * Fails unless `define` refuses `changes` and the owner's `describe` is exactly what it was: nothing of
 * the change set took effect (GA-DEF-5 for the refusals of the others). Returns the error code.
 */
export async function mustRefuse(ctx: TestContext, changes: unknown[], what: string, o: Parameters<typeof ownerDefine>[2] = {}): Promise<string> {
  const before = await ownerOf(ctx).callOk("describe");
  const r = await ownerDefine(ctx, changes, o);
  const after = await ownerOf(ctx).callOk("describe");
  ctx.evidence(`${what}: ${r.ok ? `accepted, revision ${r.body?.revision}` : `${r.error}: ${r.message}`}`);
  must(!r.ok, `define accepted ${what}`, r.body);
  must(JSON.stringify(after) === JSON.stringify(before), `define refused ${what} with ${r.error}, but describe changed`, { before, after });
  return r.error;
}

/** A credential secret nobody holds yet. */
export const freshSecret = () => randomUUID();

/** A voice record for `endpoint`, heard by the baseline's front, with `extra` over it. */
export const voice = (endpoint: string, extra: Record<string, unknown> = {}) => up("voice", { endpoint, listening: "wake_server",
  wake_words: [{ word: "Галатея", model: "transcript" }], zone: "downstairs", output: "speech", follow_up: false, heard_by: "front", ...extra });

/** An action on a target or a group by id, or on a selector, as a request names it. */
export const act = (on: string | Record<string, unknown>, action = "onoff.turn_on", args: Record<string, unknown> = {}) =>
  ({ ...(typeof on === "string" ? { target: on } : { selector: on }), action, args });

/** A step as `target verdict(reason)`. */
export const short = (s: { target: string; verdict: string; reason?: string }) => `${s.target} ${s.verdict}${s.reason ? `(${s.reason})` : ""}`;

/** The owner's `describe` until `ok` holds of it, waiting for the steward to follow its applier. */
export async function stewardSees(ctx: TestContext, what: string, ok: (d: any) => boolean): Promise<any> {
  return pollUntil(async () => {
    const d = await ownerOf(ctx).callOk("describe");
    return ok(d) ? d : undefined;
  }, 10_000, `the steward's describe did not show ${what}`, 100);
}

/** A target of the owner's `describe`, by id. */
export const targetIn = (d: any, id: string) => (d.targets as { id: string }[]).find((t) => t.id === id) as any;

/**
 * Scripts fixture devices on the stand-in, each `adopt`ed as its class (null: not adopted), on its
 * `bridge`, and waits until the steward's `describe` shows them. Returns their ids.
 */
export async function scripted(ctx: TestContext, devices: { fixture: string; adopt: string | null; bridge?: string }[]): Promise<string[]> {
  const applier = ctx.standIn!.applier;
  const ids = devices.map((x) => applier.scriptDevice(fixtureDevices([x.fixture])[0]!,
    { ...(x.adopt ? { adopt: x.adopt } : {}), ...(x.bridge ? { bridge: x.bridge } : {}) }));
  await stewardSees(ctx, `the stand-in's ${ids.join(", ")}`, (d) => ids.every((id) => targetIn(d, id)));
  return ids;
}

/**
 * A speaker on the stand-in that announces: the fixture's speaker with `media.announce` declared, a
 * channel that speaks a notice but never delivers one (steward, *Notices*). Adopted; its id.
 */
export async function announcer(ctx: TestContext): Promise<string> {
  const speaker = fixtureDevices(["speaker"])[0]!;
  const id = ctx.standIn!.applier.scriptDevice({ ...speaker, id: "announcer",
    actions: [...speaker.actions, { action: "media.announce", idempotent: false, stateless: true, confirms: false }] }, { adopt: "speaker" });
  await stewardSees(ctx, `the stand-in's ${id}`, (d) => targetIn(d, id) !== undefined);
  return id;
}

/** `plan` from `seam` at `endpoint`, respecting occupancy when told. */
export function planAt(seam: McpSeam, endpoint: string, actions: unknown[], o: { speaker?: string; respect_occupancy?: boolean } = {}): Promise<McpResult> {
  return seam.call("plan", { endpoint, ...(o.speaker ? { speaker: o.speaker } : {}), actions,
    ...(o.respect_occupancy !== undefined ? { respect_occupancy: o.respect_occupancy } : {}) });
}

/** The steps of a plan from `seam` at `endpoint`, each `target verdict(reason)`, or a failure naming the error. */
export async function stepsAt(seam: McpSeam, endpoint: string, actions: unknown[], o: { speaker?: string; respect_occupancy?: boolean } = {}): Promise<string[]> {
  const r = await planAt(seam, endpoint, actions, o);
  must(r.ok, `plan at ${endpoint}${o.speaker ? ` naming ${o.speaker}` : ""} returned ${r.ok ? "" : `${r.error}: ${r.message}`}`, r.body);
  return (r.body.steps as { target: string; verdict: string; reason?: string }[]).map(short);
}

/** `define` as the owner, failing unless it is accepted. */
export async function mustDefine(ctx: TestContext, changes: unknown[], what: string): Promise<void> {
  const r = await ownerDefine(ctx, changes);
  must(r.ok, `define of ${what} returned ${r.ok ? "" : `${r.error}: ${r.message}`}`, r.body);
}

/** Runs `fn` with a seam for a credential this test defined, closed afterwards. */
export async function asCredential<T>(ctx: TestContext, secret: string, fn: (seam: McpSeam) => Promise<T>): Promise<T> {
  const seam = await McpSeam.connect(ctx.mcpUrl!, secret);
  try {
    return await fn(seam);
  } finally {
    await seam.close();
  }
}

/** An app endpoint served by the brain, for a person: a chat window in an app. */
export const brainChat = (id: string, person: string) => up("endpoint", { id, name: id, type: "app", room: null, person, served_by: "brain" });

/**
 * Scripts the stand-in's effective tier for `target`'s `action`, as an owner's `configure` raises it,
 * and waits until the steward has followed the model change, so a plan made next is not stale.
 */
export async function raiseTier(ctx: TestContext, target: string, action: string, tier: "confirm" | "no_voice" | "reversible"): Promise<void> {
  const before = await revisionOf(ctx);
  ctx.standIn!.applier.scriptTier(target, action, tier);
  await pollUntil(async () => (await revisionOf(ctx)) > before, 10_000, `the steward did not follow ${target} ${action} raised to ${tier}`, 100);
}

/**
 * The hall with the lamp and a presence sensor, the kitchen with a dimmer and a motion sensor, and a
 * second lamp in no room; the sensors scripted just now, so live for less than the hold.
 */
export async function rooms(ctx: TestContext): Promise<{ presence: string; motion: string; dimmer: string; roomless: string }> {
  const [presence, motion, dimmer, roomless] = await scripted(ctx, [{ fixture: "presence", adopt: "sensor" }, { fixture: "motion", adopt: "sensor" },
    { fixture: "dimmer", adopt: "light" }, { fixture: "lamp", adopt: "light", bridge: "other-bridge" }]);
  await mustDefine(ctx, [up("target", { id: STEWARD_LAMP, room: "hall" }), up("target", { id: presence, room: "hall" }),
    up("target", { id: dimmer, room: "kitchen" }), up("target", { id: motion, room: "kitchen" })], "the rooms' devices");
  return { presence: presence!, motion: motion!, dimmer: dimmer!, roomless: roomless! };
}

/** Each room's occupancy as the owner's `state` shows it, once it reads `want`. */
export async function occupancyBecomes(ctx: TestContext, want: Record<string, string>, what: string): Promise<void> {
  const now = async () => Object.fromEntries(Object.entries(((await ownerOf(ctx).callOk("state")).rooms ?? {}) as Record<string, { occupancy: string }>)
    .map(([r, x]) => [r, x.occupancy]));
  await pollUntil(async () => JSON.stringify(await now()) === JSON.stringify(want) || undefined, 10_000,
    `${what}: the rooms read ${JSON.stringify(await now())}, not ${JSON.stringify(want)}`, 100);
  ctx.evidence(`${what}: ${JSON.stringify(want)}`);
}

/**
 * Opens a gap in the stand-in's events, runs `inside` within it, and closes the gap with every
 * cursor given before it expired, the steward's long-poll answered `cursor_expired`: the steward
 * reads the gap back from the stand-in's `history` (the steward, *Rules*; GA-LEASE-2, GA-LEASE-6,
 * GA-RULE-1).
 */
export async function cursorExpiredGap(ctx: TestContext, inside: () => unknown): Promise<void> {
  const applier = ctx.standIn!.applier;
  applier.scriptGap();
  await inside();
  applier.scriptGapEnd();
}

/** How late after its computed end a hold may still stand (steward, *Constants*). */
export const holdEndLatenessMs = () => constantMs("steward", "hold-end-lateness");

/** The pinned policy's windows (steward, *Conformance*): set through define one field at a time. */
export const PINNED_WINDOWS = { on_s: 3600, off_s: 600, other_s: 3600, fixed_s: 3600, load_cap_s: 3600, cap_s: 0 } as const;

/**
 * The pinned policy's flags (steward, *Conformance*): `presence_renews` true, which the subjects on renewal rest on, and every
 * other flag false, each set through define in a call of its own.
 */
export const PINNED_FLAGS = { presence_renews: true, vacant_ends: false, schedule_ends: false, owner_work_passes_guest_holds: false,
  owner_work_passes_holds: false } as const;

export type HoldPolicy = { on_s: number; off_s: number; other_s: number; fixed_s: number; load_cap_s: number; cap_s: number;
  presence_renews: boolean; vacant_ends: boolean; schedule_ends: boolean; owner_work_passes_guest_holds: boolean; owner_work_passes_holds: boolean };

/**
 * Pins the policy (steward, *Conformance*): the windows, `extra` windows over them, then each flag in a call of its own, a
 * `false` through mustDefine (always accepted, GA-LEASE-8) and `presence_renews` true through setFlag, its refusal recorded (a
 * subject resting on it calls setFlag itself, and is skipped and said there). Returns the policy describe then shows, failing
 * unless every window and flag is as pinned, `presence_renews` only when it was taken.
 */
export async function pinHold(ctx: TestContext, extra: Partial<Record<keyof typeof PINNED_WINDOWS, number>> = {}): Promise<HoldPolicy> {
  const want: Record<string, number | boolean> = { ...PINNED_WINDOWS, ...extra };
  // One field at a time (*Conformance*), so a steward refusing one says which.
  for (const [k, v] of Object.entries(want)) await mustDefine(ctx, [up("home", { hold: { [k]: v } })], `the pinned ${k}`);
  for (const [k, v] of Object.entries(PINNED_FLAGS)) {
    if (!v) {
      await mustDefine(ctx, [up("home", { hold: { [k]: false } })], `the pinned ${k} false (GA-LEASE-8: a flag's false is always accepted)`);
      want[k] = false;
    } else if (await setFlag(ctx, k as keyof HoldPolicy, true, [])) {
      want[k] = true;
    } else {
      ctx.evidence(`the pinned ${k} true refused by the steward: the subjects resting on it are skipped where they set it`);
    }
  }
  const hold = (await ownerOf(ctx).callOk("describe")).home?.hold as HoldPolicy | undefined;
  must(hold !== undefined, "describe's home shows no hold (GA-LEASE-8)");
  for (const [k, v] of Object.entries(want)) {
    must(hold![k as keyof HoldPolicy] === v, `describe's home.hold.${k} is ${JSON.stringify(hold![k as keyof HoldPolicy])}, not the pinned ${v} (GA-LEASE-8)`);
  }
  ctx.evidence(`hold policy: ${JSON.stringify(hold)}`);
  return hold!;
}

/**
 * Sets one flag through define: true when taken; false, each of `subjects` recorded as skipped, when refused with data.field
 * naming it; any other answer fails. A subject is a negative subject's mutation id when the part skipped is one, else
 * `<requirement id>: <the clause skipped>`, so the report's skipped subjects map to rows and clauses.
 */
export async function setFlag(ctx: TestContext, flag: keyof HoldPolicy, value: boolean, subjects: string[]): Promise<boolean> {
  const r = await ownerDefine(ctx, [up("home", { hold: { [flag]: value } })]);
  if (r.ok) return true;
  must(r.error === "invalid_request" && (r.body?.data?.field ?? null) === flag,
    `define of hold.${flag} ${value} returned ${r.error}: ${r.message}, not invalid_request with data.field ${flag}`, r.body);
  for (const x of subjects) ctx.evidence(`skipped: ${x}: hold.${flag} ${value} refused by the steward`);
  return false;
}

/** The owner's `state` lease of `target`, or undefined. */
export async function leaseOf(ctx: TestContext, target: string): Promise<{ holder: unknown; precedence: string; expires: string } | undefined> {
  return (((await ownerOf(ctx).callOk("state")).leases ?? {}) as Record<string, { holder: unknown; precedence: string; expires: string }>)[target];
}

/** The `lease` events since `cursor`, whole. */
export async function leaseEventsSince(ctx: TestContext, cursor: string): Promise<Record<string, any>[]> {
  return ((await ownerOf(ctx).callOk("events", { cursor })).events as Record<string, any>[]).filter((e) => e.type === "lease");
}

/** `action`'s `ack_within_s` on `target`, as the steward's describe shows the applier's declaration. */
export async function ackWithinOf(ctx: TestContext, target: string, action: string): Promise<number> {
  const t = targetIn(await ownerOf(ctx).callOk("describe"), target);
  const a = (t?.actions ?? []).find((x: any) => x.action === action);
  must(typeof a?.ack_within_s === "number", `describe shows no ack_within_s for ${target} ${action}`);
  return a.ack_within_s as number;
}
