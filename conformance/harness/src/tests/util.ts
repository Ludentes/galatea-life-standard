import type { SimBridge } from "@ludentes/galatea-life-sim";
import { must, mustEqual, SubjectFault } from "../assert.js";
import type { TestContext } from "../context.js";
import { McpSeam } from "../seams/mcp.js";
import { pollUntil, sleep } from "../util.js";

export const HOUR = 3_600_000;
export const LAMP = "sim-bridge:lamp";

export const wire = (ms: number) => new Date(ms).toISOString();

/** An applier plan request's action, as a steward sends it. */
export function turnOn(target: string) {
  return { target, action: "onoff.turn_on", args: {}, via: "app", brain: false, for: { person: "demo" } };
}

/** Polls `outcome` until the step's outcome is `want`; returns the real time it was first seen. */
export async function outcomeSeen(mcp: McpSeam, apply_id: string, want: string, ms: number): Promise<number> {
  return pollUntil(async () => {
    const o = await mcp.callOk("outcome", { apply_id });
    return o.outcomes?.[0]?.outcome === want ? Date.now() : false;
  }, ms, `the outcome ${want}`, 50);
}

/** A fixture with no devices: for tests that need no bridge device, and subjects that have no bus yet. */
export const EMPTY_HOME = { devices: [] as string[] };

/** The owner's `configure` at the current revision, unless `expected_revision` is given. */
export async function ownerConfigure(owner: McpSeam, changes: unknown[],
  opts: { dry_run?: boolean; expected_revision?: number } = {}) {
  const expected_revision = opts.expected_revision ?? (await owner.callOk("describe")).revision;
  return owner.call("configure", { changes, expected_revision, dry_run: opts.dry_run ?? false });
}

/**
 * How the subject met `bearer` on `describe`: its error code (`not_permitted`, or any other),
 * `"answered"` when it gave a result, or `"refused at connect: …"` when the connection itself failed.
 */
export async function refusal(url: string, bearer: string, era: "auto" | "legacy" = "auto"): Promise<string> {
  let seam: McpSeam;
  try {
    seam = await McpSeam.connect(url, bearer, { era });
  } catch (err) {
    if (err instanceof SubjectFault) return `refused at connect: ${err.message}`;
    throw err;
  }
  try {
    const r = await seam.call("describe");
    return r.ok ? "answered" : r.error;
  } finally {
    await seam.close();
  }
}

/**
 * Fails unless the subject refuses `bearer` with `not_permitted`, and returns what it did. GA-AUTH-3
 * says a request from a client not registered, or removed, "is `not_permitted`", and the standard
 * names no refusal at connect (no HTTP 401), so a refused connection or any other error fails too.
 */
export async function mustBeNotPermitted(url: string, bearer: string, who: string, era: "auto" | "legacy" = "auto"): Promise<string> {
  const r = await refusal(url, bearer, era);
  must(r === "not_permitted", `${who} was ${r === "answered" ? "answered" : `refused with ${r}`}, not not_permitted (era ${era})`);
  return r;
}

/** A client registration, as the harness's own setup makes one. */
export const client = (id: string, credential: string) =>
  ({ op: "upsert", kind: "client", value: { id, credential, kind: "steward" } });

export const DIMMER = "sim-bridge:dimmer";
export const GATE = "sim-bridge:gate";
export const TV = "sim-bridge:tv";

/** Within GA-STATE-2's 1 s, and the broker's delivery allowance. */
export const oneSecond = (ctx: TestContext) => 1000 + ctx.allowanceMs;

/**
 * Steps harness time to the absolute `targetMs`, chunk by chunk, the remainder recomputed after each:
 * the time server's clock also flows in real time while it is stepped (each step waits for the subject
 * to take it), so a relative `advance(n)` overshoots by that flow. Stops at most one step's flow past it.
 */
export async function advanceTo(ctx: TestContext, targetMs: number, { chunkMs = 1000 }: { chunkMs?: number } = {}): Promise<void> {
  for (let left = targetMs - ctx.time.now(); left > 0; left = targetMs - ctx.time.now()) {
    await ctx.time.stepAndWait(Math.min(chunkMs, left));
  }
}

/**
 * Before an absence is graded: harness time since `fromMs` must still be under `boundMs`, or the
 * check would grade a time the requirement does not speak of. Recorded as evidence either way.
 */
export function stillBefore(ctx: TestContext, fromMs: number, boundMs: number, what: string): void {
  const at = Math.round(ctx.time.now() - fromMs);
  ctx.evidence(`${what}: checked ${at} ms of harness time after its start, the bound ${boundMs} ms`);
  must(at < boundMs, `${what}: checked ${at} ms after its start, not before its bound of ${boundMs} ms`);
}

/** A device's liveness, as the subject's `state` gives it. */
export async function livenessOf(mcp: McpSeam, target: string): Promise<string | undefined> {
  return (await mcp.callOk("state", { targets: [target] })).targets?.[target]?.liveness;
}

/** Waits up to `ms` for `target` to read `want`. */
export async function livenessWithin(ctx: TestContext, target: string, want: string, ms: number, why: string): Promise<void> {
  await pollUntil(async () => (await livenessOf(ctx.mcp!, target)) === want, ms, `${target} ${want} ${why}`, 50);
}

/** Fails unless `target` still reads `want` 1 s later: a change that must not happen. */
export async function stillReads(ctx: TestContext, target: string, want: string, why: string): Promise<void> {
  await sleep(oneSecond(ctx));
  mustEqual(await livenessOf(ctx.mcp!, target), want, `${target}'s liveness ${why}`);
}

/** Every event after `cursor` so far, the `type` given only. */
export async function eventsOf(mcp: McpSeam, cursor: string, type?: string): Promise<any[]> {
  const r = await mcp.callOk("events", { cursor });
  return (r.events as { type: string }[]).filter((e) => !type || e.type === type);
}

/** Asks the bridge for live statuses until `targets` read live, as the harness's setup does. */
export async function reviveWithin(ctx: TestContext, targets: string[], ms: number, why: string): Promise<void> {
  await pollUntil(async () => {
    await ctx.bridge!.publishStatus();
    const s = await ctx.mcp!.callOk("state", { targets });
    return targets.every((t) => s.targets?.[t]?.liveness === "live");
  }, ms, `${targets.join(", ")} live ${why}`, 250);
}

/** The bridge's last retained `devices` document, as it published it. */
export function lastDevices(bridge: SimBridge): { publishedAt: string; devices: Record<string, unknown>[] } {
  const p = [...bridge.published].reverse().find((x) => /\/bridges\/[^/]+\/devices$/.test(x.topic));
  if (!p) throw new Error("the bridge has published no devices document");
  return p.payload as { publishedAt: string; devices: Record<string, unknown>[] };
}

/** The bridge's last status, as it published it. */
export function lastStatus(bridge: SimBridge): Record<string, any> {
  const p = [...bridge.published].reverse().find((x) => /\/bridges\/[^/]+\/status$/.test(x.topic) && x.payload);
  if (!p) throw new Error("the bridge has published no status");
  return p.payload as Record<string, any>;
}

/** How many snapshot requests the bridge has received. */
export const snapshots = (bridge: SimBridge) => bridge.requests.filter((r) => r.op === "snapshot").length;

/** The simulated PC bridge's id: a second bridge that only publishes the computers a test gives it. */
export const SIM_PC = "sim-pc";
/** A computer as a PC's bridge declares it (bridge, *Computers*): `os` administrators, and on the broker's host its proposal. */
export const computer = (id: string, extra: Record<string, unknown> = {}) => ({ id, stableIdentifier: `test:${id}`, transport: "lan",
  model: { vendor: "demo", model: "pc" }, capabilities: ["power"], sensorKeys: [],
  actions: [{ action: "power.sleep", idempotent: true, stateless: false, confirms: true }], feedback: "closed", reachMs: 1000,
  proposedClass: "computer", classEvidence: "protocol", otherAdmins: [{ vendor: "os", label: "root" }], ...extra });

/**
 * The simulated PC bridge's `devices` document, `computers`, registered with the subject and shown in
 * its `describe`. It publishes no status: its computers read dead, which no configure check reads.
 */
export async function simPc(ctx: TestContext, computers: Record<string, any>[]): Promise<void> {
  await ctx.bridge!.publishAs(SIM_PC, "devices", { publishedAt: wire(ctx.time.now()), devices: computers }, true);
  const owner = ctx.owner!;
  // Registering it again, with the same identity, changes nothing.
  const r = await ownerConfigure(owner, [{ op: "upsert", kind: "bridge", value: { id: SIM_PC, identity: SIM_PC } }]);
  must(r.ok, `registering the simulated PC bridge returned ${r.ok ? "" : `${r.error}: ${r.message}`}`, r.body);
  const want = computers.map((c) => `${SIM_PC}:${c.id as string}`);
  await pollUntil(async () => {
    const ds = (await owner.callOk("describe")).devices as { id: string; other_admins?: unknown; proposed_infrastructure?: true }[];
    return computers.every((c) => {
      const d = ds.find((x) => x.id === `${SIM_PC}:${c.id as string}`);
      return d && JSON.stringify(d.other_admins) === JSON.stringify(c.otherAdmins) && (d.proposed_infrastructure === true) === (c.proposedInfrastructure === true);
    });
  }, 10_000, `describe showing the simulated PC's computers ${want.join(", ")} as declared`);
}

/**
 * GA-EVT-4 across a loss: what a cursor of the last life reads after a crash, against the events it
 * was served before it. Either every served event is read again (by type, target, key and value), or
 * the answer is `cursor_expired`; anything else is the failure this returns. Nothing served, nothing
 * owed: a subject that commits each event before serving it serves none while its store is stalled.
 */
export function afterLoss(served: Record<string, unknown>[], again: { ok: boolean; error?: string; body?: any }): string | undefined {
  const sig = (x: Record<string, unknown>) => JSON.stringify([x.type, x.target, x.key, x.value]);
  if (!again.ok) return again.error === "cursor_expired" ? undefined : `a cursor of the last life after the crash returned ${again.error}, not cursor_expired`;
  const now = new Set(((again.body?.events ?? []) as Record<string, unknown>[]).map(sig));
  const missing = served.filter((x) => !now.has(sig(x)));
  return missing.length ? `events the cursor was served before the crash, missing from it after, with no cursor_expired: ${JSON.stringify(missing)}` : undefined;
}
