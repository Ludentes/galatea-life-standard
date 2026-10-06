import { randomUUID } from "node:crypto";
import { fixtureDevices } from "@ludentes/galatea-life-sim";
import { must } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { McpSeam, type McpResult } from "../../seams/mcp.js";
import { LAMP as STEWARD_LAMP } from "../../steward-home.js";
import { pollUntil } from "../../util.js";

export const up = (kind: string, value: unknown) => ({ op: "upsert", kind, value });
export const del = (kind: string, value: unknown) => ({ op: "delete", kind, value });

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
