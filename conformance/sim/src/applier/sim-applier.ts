import { randomUUID } from "node:crypto";
import { validate, type ApplierEvent, type ApplierOutcome, type ApplierPlan, type BridgeCommand } from "@ludentes/galatea-life-schemas";
import type { Clock } from "@ludentes/galatea-life-test-clock";
import { bridgeDoc, type FixtureDevice } from "../fixture.js";
import { setsOf, toWire } from "../vocabulary.js";
import { BridgeLink, type LinkEvent } from "./bridge-link.js";
import { ackWithinS, canonical, describeDevice, freshOf, planStep, type HeldDevice, type Step } from "./model.js";
import { authorsOwn, tokenFault } from "./token.js";

export type Liveness = "live" | "stale" | "dead";
export type Caller = { kind: "owner" } | { kind: "client"; id: string } | { kind: "anonymous" };
export type ToolResult = { ok: true; body: Record<string, unknown> } | { ok: false; error: string; message: string };

export interface RecordedRequest {
  tool: "plan" | "apply";
  client: string;
  target: string;
  action: string;
  args: unknown;
  via: string;
  brain: boolean;
  for: unknown;
  /** Whether a token came with the step; the token itself, and its proof, are never kept. */
  token: boolean;
  /** The token's `expires`, when one came. */
  tokenExpires?: string;
  /** Why the token counted as none, or undefined when it stood or none came. */
  tokenFault?: string;
  /** The apply's idempotency key, for an apply. */
  key?: string;
}

/** How long after the scripted stand-in dispatches a step its device answers. */
export const SCRIPTED_ACK_MS = 50;

/**
 * How a scripted step ends instead of its device's answer (`scriptOutcome`): `failed` with its
 * reason, `unanswered`, or `unreachable` (the device's transport down just then), `afterMs` after dispatch; by default `failed(no_ack)` and `unanswered` at
 * the action's `ack_within_s`, as an applier ends them, and the others at `SCRIPTED_ACK_MS`.
 */
export interface ScriptedEnd { outcome: "failed" | "unanswered" | "unreachable"; reason?: string; afterMs?: number }

/**
 * A safety rule as the scripted stand-in holds it (applier, *Safety rules*): the keys it sets on the
 * devices it actuates, and whether it declares a latch, which a test clears by its word.
 */
export interface ScriptedSafetyRule { id: string; actuates: { target: string; key: string; value: unknown }[]; latch?: boolean }

export interface SimApplierOptions {
  /** The broker its bridges speak on. Absent: the scripted stand-in, whose devices a test sets directly. */
  brokerUrl?: string;
  identity: string;
  root: string;
  clock: Clock;
  ownerCredential: string;
  runId?: string;
  standardVersion?: string;
  mutation?: string;
  retarget?: (source: string) => Promise<void>;
  applierId?: string;
}

export const PLANS_WITH_SIDE_EFFECT = "plans-with-side-effect";
/** GA-BIND-1: the MCP binding answers only the 2025 revisions' `initialize` handshake. */
export const SPEAKS_ONLY_2025 = "speaks-only-2025";

export const TOOLS: { name: string; readOnly: boolean }[] = [
  { name: "describe", readOnly: true }, { name: "state", readOnly: true }, { name: "plan", readOnly: true },
  { name: "apply", readOnly: false }, { name: "outcome", readOnly: true }, { name: "events", readOnly: true },
  { name: "history", readOnly: true }, { name: "configure", readOnly: false }, { name: "provision", readOnly: false },
  { name: "candidates", readOnly: true },
];

const PLAN_EXPIRY_MS = 60_000;
const KEY_RETENTION_MS = 3_600_000;
const EVENT_RETENTION_MS = 3_600_000;
const HISTORY_RETENTION_MS = 7 * 24 * 3_600_000;
const META = new Set(["deviceId", "state", "timestamp", "timestamps", "available"]);

class RequestError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

type Args = Record<string, any>;
/** A step's outcome (generated from `applier/outcome.json`). */
type Outcome = ApplierOutcome;
type OutcomeName = ApplierOutcome["outcome"];
/** A plan as held: the generated `applier/plan.json` plus when it expires on the clock. */
type Plan = ApplierPlan & { expiresMs: number };
interface Pending {
  apply_id: string; step_id: string; target: string; action: string; commandId: string;
  expect?: Record<string, unknown>; applied: boolean; open: boolean; timer: number;
}
/** An event as held: the generated `applier/event.json` plus its time on the clock. */
type Event = ApplierEvent & { timeMs: number };

export class SimApplier {
  readonly requests: RecordedRequest[] = [];
  /** The MCP revision each client's calls came at, in order (the steward's GA-BIND-2). */
  readonly revisions = new Map<string, string[]>();
  private revision = 0;
  /** How many `plan` calls to refuse next (`scriptRefusePlans`). */
  private plansRefused = 0;
  private readonly clients = new Map<string, { credential: string; kind: string; tokenKey?: string }>();
  private readonly bridges = new Map<string, string>();
  private readonly devices = new Map<string, HeldDevice>();
  private readonly plans = new Map<string, Plan>();
  private readonly applies = new Map<string, Outcome[]>();
  private readonly keys = new Map<string, { body: string; apply_id: string; at: number }>();
  private readonly pending = new Map<string, Pending>();
  private readonly events: Event[] = [];
  private seq = 0;
  private waiters: (() => void)[] = [];
  private readonly link?: BridgeLink;
  /** The scripted stand-in's bridges that read dead; every other one is live. */
  private readonly scriptedDead = new Set<string>();
  /** The scripted stand-in: its `describe` leaves out the run's `test_run_id`, as an applier outside the harness. */
  private runIdHidden = false;
  /** The scripted stand-in: a device's liveness as a test set it, over its bridge's. */
  private readonly scriptedLiveness = new Map<string, Liveness>();
  /** The `standard_version` its `describe` reports; the scripted stand-in may change it. */
  private standardVersion: string;
  /** The notices not yet taken, carried in every `events` response (applier, *Notices*). */
  private notices: Record<string, unknown>[] = [];
  /** Each `notice_taken` a client sent, in order: the notice ids it took. */
  readonly taken: string[] = [];
  /** The scripted stand-in: how the next dispatches of an action end, by `target\u0000action`, first in first used. */
  private readonly endings = new Map<string, ScriptedEnd[]>();
  /** The scripted stand-in: each device's last step that a script failed, which `scriptLateAck` acks late. */
  private readonly failed = new Map<string, { apply_id: string; step_id: string; expect?: Record<string, unknown>; cause: Record<string, unknown> }>();
  private readonly clock: Clock;
  readonly mutation?: string;
  /** The scripted stand-in's safety rules, by id (applier, *Safety rules*): what each actuates, and whether it latches. */
  private readonly safetyRules = new Map<string, ScriptedSafetyRule>();
  /** The safety rules whose latch is held, with when it was set (GA-SAFE-9). */
  private readonly latches = new Map<string, string>();
  /** The safety rules fired and not yet complete, with each actuation's outcome. */
  private readonly running = new Map<string, Record<string, unknown>[]>();
  /** A gap a test opened: no `events` call with a cursor is answered past this `seq` (`scriptGap`). */
  private gapFrom?: number;
  /** Every cursor below this is `cursor_expired`: the gap a test closed with its events lost (`scriptGapEnd`). */
  private expiredBelow = 0;

  constructor(private readonly opts: SimApplierOptions) {
    this.clock = opts.clock;
    this.mutation = opts.runId ? opts.mutation : undefined;
    this.standardVersion = opts.standardVersion ?? "0.14";
    if (opts.brokerUrl) {
      this.link = new BridgeLink({ brokerUrl: opts.brokerUrl, identity: opts.identity, root: opts.root, clock: opts.clock,
        onEvent: (e) => this.onLink(e) });
    }
  }

  async start(): Promise<void> {
    await this.link?.connect();
  }

  /** Whether `bridge` is live: its bridge link's word, or, scripted, live unless a test said otherwise. */
  private alive(bridge: string): boolean {
    return this.link ? this.link.alive(bridge) : !this.scriptedDead.has(bridge);
  }

  /**
   * The scripted stand-in (no broker): a device as its bridge would describe it, held and maybe
   * adopted, its initial values reported; a model change, as a bridge's new device is.
   */
  scriptDevice(spec: FixtureDevice, o: { bridge?: string; adopt?: string } = {}): string {
    const bridge = o.bridge ?? "sim-bridge";
    const id = `${bridge}:${spec.id}`;
    const at = this.iso();
    this.devices.set(id, { id, bridge, doc: bridgeDoc(spec), adopted: o.adopt !== undefined, class: o.adopt ?? null,
      values: Object.fromEntries(Object.entries(spec.initial).map(([k, value]) => [k, { value, basis_time: at }])),
      assumed: {}, lastCheckIn: at });
    this.revision++;
    this.emit("model", { revision: this.revision });
    return id;
  }

  /**
   * The scripted stand-in: a device reports `value` for `key`, a `state` event when it changed, with
   * `cause` (applier, *Causes*): `external` by default, as any change the applier did not make, or
   * `load_cap` or `device`.
   */
  scriptValue(id: string, key: string, value: unknown, o: { cause?: unknown } = {}): void {
    const d = this.devices.get(id);
    if (!d) throw new Error(`no scripted device ${id}`);
    const basis_time = this.iso();
    const old = d.values[key];
    d.values[key] = { value, basis_time };
    d.lastCheckIn = basis_time;
    if (!old || old.value !== value) this.emit("state", { target: id, key, value, basis_time, cause: o.cause ?? "external" });
  }

  /** The scripted stand-in: one device's liveness, over its bridge's, a `liveness` event when it moved. */
  scriptLiveness(id: string, liveness: Liveness): void {
    const d = this.scripted(id);
    const old = this.livenessOf(d);
    this.scriptedLiveness.set(id, liveness);
    if (old !== liveness) this.emit("liveness", { target: id, old, new: liveness });
  }

  /** The scripted stand-in: an owner's freshness bound on a device, or null for none known; a model change. */
  scriptFresh(id: string, freshS: number | null): void {
    this.scripted(id).freshS = freshS;
    this.modelChanged();
  }

  /** The scripted stand-in: the `standard_version` its `describe` reports from now on; a model change. */
  scriptVersion(version: string): void {
    this.standardVersion = version;
    this.modelChanged();
  }

  /**
   * The scripted stand-in raises a notice (applier, *Notices*): carried in every `events` response
   * until a client lists its id in `notice_taken`; a waiting long-poll is answered with it.
   */
  scriptNotice(notice: { notice_id: string; cause: string; text: string } & Record<string, unknown>): void {
    this.notices.push(notice);
    for (const w of this.waiters.splice(0)) w();
  }

  /** The notices not yet taken. */
  pendingNotices(): Record<string, unknown>[] {
    return this.notices.map((n) => ({ ...n }));
  }

  private livenessOf(d: HeldDevice): Liveness {
    return this.scriptedLiveness.get(d.id) ?? (this.alive(d.bridge) ? "live" : "dead");
  }

  /** The scripted stand-in: an action's effective tier, as an owner's `configure` raises it; a model change. */
  scriptTier(id: string, action: string, tier: "reversible" | "confirm" | "no_voice"): void {
    const d = this.scripted(id);
    d.tiers = { ...d.tiers, [action]: tier };
    this.modelChanged();
  }

  /** The scripted stand-in: a device marked, or unmarked, `internal` or `infrastructure`, as an owner's `configure` does; a model change. */
  scriptMarks(id: string, marks: { internal?: boolean; infrastructure?: boolean }): void {
    Object.assign(this.scripted(id), marks);
    this.modelChanged();
  }

  /** The scripted stand-in: a device adopted again or no longer, as the applier's owner adopts or releases it; a model change. */
  scriptAdopted(id: string, adopted: boolean): void {
    this.scripted(id).adopted = adopted;
    this.modelChanged();
  }

  /** The scripted stand-in: a device the applier no longer describes, as when its bridge forgets it; a model change. */
  scriptForget(id: string): void {
    this.scripted(id);
    this.devices.delete(id);
    this.modelChanged();
  }

  /** The scripted stand-in: every device of `bridge` reads dead, or live again, a `liveness` event each. */
  scriptDead(bridge: string, dead: boolean): void {
    if (dead === this.scriptedDead.has(bridge)) return;
    if (dead) this.scriptedDead.add(bridge);
    else this.scriptedDead.delete(bridge);
    for (const d of this.devices.values()) {
      if (d.bridge === bridge) this.emit("liveness", { target: d.id, old: dead ? "live" : "dead", new: dead ? "dead" : "live" });
    }
  }

  /**
   * The scripted stand-in: a computer's accounts from now on, as its bridge declares them; a retired
   * account's key is no longer reported (bridge GA-BRIDGE-52). A model change.
   */
  /** The next `n` `plan` calls are refused, as an applier that cannot plan just then: a test's word. */
  scriptRefusePlans(n: number): void {
    this.plansRefused = n;
  }

  scriptAccounts(id: string, accounts: Record<string, string>): void {
    const d = this.scripted(id);
    (d.doc as { accounts?: Record<string, string> }).accounts = { ...accounts };
    for (const key of Object.keys(d.values)) if (key.startsWith("session.") && !(key.slice("session.".length) in accounts)) delete d.values[key];
    this.modelChanged();
  }

  /**
   * The scripted stand-in: the next dispatch of `action` on `target` ends as `end` says, nothing set
   * on the device; several are used in the order given, one per dispatch.
   */
  scriptOutcome(target: string, action: string, end: ScriptedEnd): void {
    this.scripted(target);
    const k = `${target}\u0000${action}`;
    this.endings.set(k, [...(this.endings.get(k) ?? []), end]);
  }

  /**
   * The scripted stand-in: the last step on `target` a script failed takes effect after all (applier,
   * GA-APPLY-11): the device's values move to what its action sets, each a `state` event caused by the
   * apply, and a `late_ack` event names the apply and its step. Once per failed step.
   */
  scriptLateAck(target: string): void {
    const f = this.failed.get(target);
    if (!f) throw new Error(`no failed step on ${target} to ack late`);
    this.failed.delete(target);
    const d = this.scripted(target);
    for (const [key, value] of Object.entries(f.expect ?? {})) {
      const basis_time = this.iso();
      d.values[key] = { value, basis_time };
      this.emit("state", { target, key, value, basis_time, cause: { ...f.cause } });
      this.emit("late_ack", { apply_id: f.apply_id, step_id: f.step_id, target, key, value, cause: { ...f.cause } });
    }
  }

  /** The scripted stand-in: `action` on `id` declared `toggles: true`, or no longer, as its bridge re-declares it; a model change. */
  scriptToggles(id: string, action: string, toggles: boolean): void {
    const decl = this.scripted(id).doc.actions.find((a) => a.action === action);
    if (!decl) throw new Error(`${id} declares no ${action}`);
    if (toggles) decl.toggles = true;
    else delete decl.toggles;
    this.modelChanged();
  }

  /**
   * The scripted stand-in: a safety rule configured (applier, *Safety rules*), listed in `describe`
   * with its actions and its latch; a model change. Its trigger is the test's word (`scriptSafetyFire`).
   */
  scriptSafetyRule(rule: ScriptedSafetyRule): void {
    for (const a of rule.actuates) this.scripted(a.target);
    this.safetyRules.set(rule.id, { ...rule, actuates: rule.actuates.map((a) => ({ ...a })) });
    this.modelChanged();
  }

  /**
   * The scripted stand-in: a safety rule fires, under no client (GA-SAFE-1). Its latch, if it has one,
   * is set first (a `latch` event); each actuation sets its key, a `state` event caused by
   * `{ safety_rule }`, and is `acked`, an `outcome` event naming the rule. Unless told
   * `complete: false`, the rule then completes: a `rule_fired` event with the outcomes. As applier 0.14
   * gives them: neither event, nor `state`'s latches, names the devices; `describe`'s rule does.
   */
  scriptSafetyFire(id: string, o: { complete?: boolean } = {}): void {
    const rule = this.safetyRules.get(id);
    if (!rule) throw new Error(`no scripted safety rule ${id}`);
    if (rule.latch && !this.latches.has(id)) {
      this.latches.set(id, this.iso());
      this.emit("latch", { rule_id: id, latch: "set" });
    }
    const outcomes: Record<string, unknown>[] = [];
    rule.actuates.forEach((a, i) => {
      const d = this.scripted(a.target);
      const basis_time = this.iso();
      const old = d.values[a.key];
      d.values[a.key] = { value: a.value, basis_time };
      d.lastCheckIn = basis_time;
      if (!old || old.value !== a.value) this.emit("state", { target: a.target, key: a.key, value: a.value, basis_time, cause: { safety_rule: id } });
      const step_id = `s${i + 1}`;
      this.emit("outcome", { rule_id: id, step_id, target: a.target, outcome: "acked" });
      outcomes.push({ step_id, target: a.target, outcome: "acked" });
    });
    this.running.set(id, outcomes);
    if (o.complete !== false) this.scriptSafetyComplete(id);
  }

  /** The scripted stand-in: a fired safety rule completes (GA-SAFE-3): its `rule_fired` event, issued at completion. */
  scriptSafetyComplete(id: string): void {
    const outcomes = this.running.get(id);
    if (!outcomes) throw new Error(`safety rule ${id} is not running`);
    this.running.delete(id);
    this.emit("rule_fired", { rule_id: id, outcomes, notice: null });
  }

  /** The scripted stand-in: a held latch clears, by its condition (`cleared`) or by the owner (`cleared_by_owner`); a `latch` event (GA-SAFE-9). */
  scriptLatchClear(id: string, how: "cleared" | "cleared_by_owner" = "cleared"): void {
    if (!this.latches.delete(id)) throw new Error(`safety rule ${id} holds no latch`);
    this.emit("latch", { rule_id: id, latch: how });
  }

  /** The scripted stand-in: any event of the applier's, as a test words it (a `route_conflict`, a `provision`, a `bridge_fault`, …). */
  scriptEvent(type: ApplierEvent["type"], fields: Record<string, unknown>): void {
    this.emit(type, fields);
  }

  /**
   * The scripted stand-in: a gap opens in its events. From now on no `events` call with a cursor is
   * answered past this point: what happens is kept, in `history` too, but no client following the
   * events sees it, as a client whose long-poll did not come back for an hour.
   */
  scriptGap(): void {
    this.gapFrom = this.seq;
  }

  /**
   * The scripted stand-in: the gap closes. With `expire` (the default) every cursor given before now
   * is `cursor_expired`, the events of the gap lost to `events` as past the applier's retention, so the
   * client re-reads `describe` and `state` (GA-EVT-4); without, the events of the gap are served.
   */
  scriptGapEnd(o: { expire?: boolean } = {}): void {
    this.gapFrom = undefined;
    if (o.expire !== false) this.expiredBelow = this.seq;
    for (const w of this.waiters.splice(0)) w();
  }

  /** The scripted stand-in: its `describe` leaves out `test_run_id`, or gives it again; a model change. */
  hideRunId(hidden: boolean): void {
    this.runIdHidden = hidden;
    this.modelChanged();
  }

  private scripted(id: string): HeldDevice {
    const d = this.devices.get(id);
    if (!d) throw new Error(`no scripted device ${id}`);
    return d;
  }

  private modelChanged(): void {
    this.revision++;
    this.emit("model", { revision: this.revision });
  }

  /** Records the MCP revision a caller's call came at. */
  seen(caller: Caller, version: string | null | undefined): void {
    const id = caller.kind === "client" ? caller.id : caller.kind;
    this.revisions.set(id, [...(this.revisions.get(id) ?? []), version ?? "none"]);
  }

  async stop(): Promise<void> {
    for (const p of this.pending.values()) this.clock.clear(p.timer);
    for (const w of this.waiters.splice(0)) w();
    await this.link?.close();
  }

  caller(bearer?: string): Caller {
    if (!bearer) return { kind: "anonymous" };
    if (bearer === this.opts.ownerCredential) return { kind: "owner" };
    for (const [id, c] of this.clients) if (c.credential === bearer) return { kind: "client", id };
    return { kind: "anonymous" };
  }

  async call(caller: Caller, tool: string, args: unknown): Promise<ToolResult> {
    try {
      if (!TOOLS.some((t) => t.name === tool)) throw new RequestError("invalid_request", `no tool ${tool}`);
      const allowed = tool === "configure" ? caller.kind === "owner"
        : caller.kind === "client" || (caller.kind === "owner" && tool === "describe");
      if (!allowed) throw new RequestError("not_permitted", `not permitted to call ${tool}`);
      const a = (args ?? {}) as Args;
      const errors = validate(`applier/${tool}.request.json`, a);
      if (errors.length) throw new RequestError("invalid_request", errors.join("; "));
      const client = caller.kind === "client" ? caller.id : "owner";
      return { ok: true, body: await this.dispatch(tool, client, a) };
    } catch (err) {
      if (err instanceof RequestError) return { ok: false, error: err.code, message: err.message };
      throw err;
    }
  }

  private dispatch(tool: string, client: string, a: Args): Promise<Record<string, unknown>> | Record<string, unknown> {
    switch (tool) {
      case "describe": return this.describe(a);
      case "state": return this.state(a);
      case "plan": return this.plan(client, a);
      case "apply": return this.apply(client, a);
      case "outcome": return this.outcome(a);
      case "events": return this.eventsCall(a);
      case "history": return this.history(a);
      case "configure": return this.configure(a);
      default: throw new RequestError("not_claimed", `${tool} is not claimed by the simulated applier`);
    }
  }

  private describe(a: Args): Record<string, unknown> {
    if (a.since_revision === this.revision) return { revision: this.revision, unchanged: true };
    return {
      applier_id: this.opts.applierId ?? "sim-applier",
      standard_version: this.standardVersion,
      levels: ["Act"],
      revision: this.revision,
      descendants: [],
      ungoverned: [],
      box: false,
      clients: [...this.clients].map(([id, c]) => ({ id, kind: c.kind })),
      devices: [...this.devices.values()].map(describeDevice),
      transports: [...this.bridges.keys()].flatMap((bridge) => (this.link?.transports(bridge) ?? []).map((t) => ({
        id: `${bridge}:${String(t.id)}`, kind: t.kind, up: t.state === "up", state: t.state, bridge,
      }))),
      safety_rules: [...this.safetyRules.values()].map((r) => ({ id: r.id, trigger: { scripted: true },
        actions: r.actuates.map((a) => ({ target: a.target, set: { [a.key]: a.value } })), ...(r.latch ? { latch: { condition: { scripted: true } } } : {}) })),
      children: [],
      ...(this.opts.runId && !this.runIdHidden ? { test_run_id: this.opts.runId } : {}),
    };
  }

  private state(a: Args): Record<string, unknown> {
    const wanted: string[] | undefined = a.targets;
    const targets: Record<string, unknown> = {};
    for (const d of this.devices.values()) {
      if (wanted && !wanted.includes(d.id)) continue;
      targets[d.id] = {
        values: [
          ...Object.entries(d.values).map(([key, v]) => ({ key, value: v.value, basis_time: v.basis_time })),
          ...Object.entries(d.assumed).map(([key, value]) => ({ key, value, basis_time: this.iso(), assumed: true })),
        ],
        liveness: this.livenessOf(d),
        last_check_in: d.lastCheckIn,
        ...freshOf(d),
        other_admins: [],
      };
    }
    const latches = [...this.latches].map(([rule_id, since]) => ({ rule_id, since }));
    return { targets, transports: this.describe({}).transports as unknown[], latches };
  }

  private makePlan(client: string, request: Args, tool: "plan" | "apply", key?: string): Plan {
    const now = this.clock.now();
    const judged = (request.actions as Args[]).map((x) => {
      const fault = x.token === undefined ? undefined : tokenFault(x.token, x, { client, key: this.clients.get(client)?.tokenKey, now });
      this.requests.push({ tool, client, target: x.target, action: x.action, args: x.args, via: x.via, brain: x.brain, for: x.for,
        token: x.token !== undefined, ...(typeof x.token?.expires === "string" ? { tokenExpires: x.token.expires } : {}), ...(fault ? { tokenFault: fault } : {}), ...(key !== undefined ? { key } : {}) });
      return { ...x, token: fault ? undefined : x.token, toggle: !authorsOwn(x.for) } as Args;
    });
    const plan: Plan = {
      plan_id: randomUUID(),
      expires_at: this.iso(now + PLAN_EXPIRY_MS),
      revision: this.revision,
      client,
      request: request as ApplierPlan["request"],
      steps: judged.map((x, i) => {
        const d = this.devices.get(x.target);
        const step = planStep(i, x as never, d, d ? this.livenessOf(d) !== "dead" : false);
        // An applier before 0.10 knows no `from`, and refuses the argument it does not know (steward GA-NOTE-2).
        if (step.verdict === "op" && x.action === "notify.notify" && x.args?.from !== undefined && older(this.standardVersion, "0.10")) {
          return { ...step, verdict: "refuse", reason: "invalid_args" } as Step;
        }
        return step;
      }),
      expiresMs: now + PLAN_EXPIRY_MS,
    };
    this.plans.set(plan.plan_id, plan);
    return plan;
  }

  /** GA-PLAN-1: plan changes nothing; the mutation makes it emit an event. A scripted refusal comes first. */
  private plan(client: string, a: Args): Record<string, unknown> {
    if (this.plansRefused > 0) {
      this.plansRefused--;
      throw new RequestError("invalid_request", "the stand-in refuses this plan, as scripted");
    }
    const { expiresMs: _e, ...plan } = this.makePlan(client, a, "plan");
    if (this.mutation === PLANS_WITH_SIDE_EFFECT) this.emit("model", { revision: this.revision });
    return plan;
  }

  private async apply(client: string, a: Args): Promise<Record<string, unknown>> {
    const now = this.clock.now();
    const { idempotency_key: key, ...rest } = a;
    const body = canonical(stripTokens(rest));
    const held = this.keys.get(`${client}\u0000${key}`);
    if (held && now - held.at <= KEY_RETENTION_MS) {
      if (held.body !== body) throw new RequestError("idempotency_conflict", "the key was used with another body");
      return this.outcome({ apply_id: held.apply_id });
    }
    let plan: Plan;
    if (a.plan_id !== undefined) {
      const p = this.plans.get(a.plan_id);
      if (!p) throw new RequestError("unknown_plan", `no plan ${a.plan_id}`);
      if (p.client !== client) throw new RequestError("plan_not_yours", "another client made this plan");
      if (now > p.expiresMs) throw new RequestError("plan_expired", "the plan expired");
      if (p.revision !== this.revision) throw new RequestError("stale_revision", "the model changed since the plan");
      plan = p;
    } else {
      plan = this.makePlan(client, a.request, "apply", key);
    }
    const apply_id = randomUUID();
    const outcomes: Outcome[] = [];
    this.applies.set(apply_id, outcomes);
    this.keys.set(`${client}\u0000${key}`, { body, apply_id, at: now });
    for (const step of plan.steps) {
      const base = { step_id: step.step_id, target: step.target };
      if (step.verdict === "skip") outcomes.push({ ...base, outcome: "skipped", reason: step.reason });
      else if (step.verdict === "refuse") outcomes.push({ ...base, outcome: "refused", reason: step.reason });
      else outcomes.push({ ...base, outcome: await this.dispatchStep(apply_id, step, client, plan.request.actions[Number(step.step_id.slice(1)) - 1]?.for) });
    }
    return { apply_id, outcomes: outcomes.map((o) => ({ ...o })) };
  }

  private async dispatchStep(apply_id: string, step: Step, client: string, forWhom: unknown): Promise<OutcomeName> {
    const d = this.devices.get(step.target)!;
    if (this.livenessOf(d) === "dead") return "unreachable";
    const decl = d.doc.actions.find((x) => x.action === step.action)!;
    if (!this.link) return this.scriptedDispatch(apply_id, step, d, decl, client, forWhom);
    const ackS = ackWithinS(d.class, d.doc.reachMs);
    const commandId = randomUUID();
    const args = (step.args ?? {}) as Record<string, unknown>;
    const value: BridgeCommand["value"] = { action: step.action };
    const wire = toWire(step.action, args);
    if (wire !== undefined) value.value = wire;
    const expect = setsOf(decl, args);
    if (decl.wholeState) value.state = { ...d.assumed, ...expect };
    const open = d.doc.feedback === "open";
    const timer = this.clock.setTimeout(() => this.finish(commandId, open ? "unanswered" : "failed", open ? undefined : "no_ack"), ackS * 1000);
    this.pending.set(commandId, { apply_id, step_id: step.step_id, target: step.target, action: step.action, commandId,
      expect: decl.toggles ? undefined : expect, applied: false, open, timer });
    const command: BridgeCommand = { commandId, issuedAt: new Date(this.clock.now()).toISOString(), resultWithinMs: ackS * 1000, value };
    try {
      await this.link.send(d.bridge, d.doc.id, command, ackS * 1000);
      return "dispatched";
    } catch {
      this.clock.clear(timer);
      this.pending.delete(commandId);
      return "unreachable";
    }
  }

  /**
   * The scripted stand-in's dispatch: no bridge, so the device answers by itself `SCRIPTED_ACK_MS`
   * later, a closed device's values set to what the action sets (a `state` event each that changed,
   * caused by the apply: `{ apply, client, for }`) and the step `acked`, or, a stateless action,
   * `delivered`, `sent` where it is declared `confirms: false` (GA-APPLY-7); an open device's assumed
   * and the step `sent`. A test's script (`scriptOutcome`) ends it instead, setting nothing.
   */
  private scriptedDispatch(apply_id: string, step: Step, d: HeldDevice, decl: HeldDevice["doc"]["actions"][number], client: string,
    forWhom: unknown): OutcomeName {
    const commandId = randomUUID();
    const expect = decl.toggles ? undefined : setsOf(decl, (step.args ?? {}) as Record<string, unknown>);
    const open = d.doc.feedback === "open";
    const k = `${d.id}\u0000${step.action}`;
    const end = this.endings.get(k)?.shift();
    if (this.endings.get(k)?.length === 0) this.endings.delete(k);
    if (end) {
      const atAck = end.outcome === "unanswered" || end.reason === "no_ack";
      const timer = this.clock.setTimeout(() => {
        if (end.outcome === "failed") this.failed.set(d.id, { apply_id, step_id: step.step_id, expect, cause: { apply: apply_id, client, for: forWhom } });
        this.finish(commandId, end.outcome, end.reason);
      }, end.afterMs ?? (atAck ? ackWithinS(d.class, d.doc.reachMs) * 1000 : SCRIPTED_ACK_MS));
      this.pending.set(commandId, { apply_id, step_id: step.step_id, target: step.target, action: step.action, commandId, expect, applied: true, open, timer });
      return "dispatched";
    }
    const timer = this.clock.setTimeout(() => {
      if (!open) {
        for (const [key, value] of Object.entries(expect ?? {})) {
          if (d.values[key]?.value === value) continue;
          d.values[key] = { value, basis_time: this.iso() };
          this.emit("state", { target: d.id, key, value, basis_time: this.iso(), cause: { apply: apply_id, client, for: forWhom } });
        }
      }
      this.finish(commandId, open || (decl.stateless && decl.confirms === false) ? "sent" : decl.stateless ? "delivered" : "acked");
    }, SCRIPTED_ACK_MS);
    this.pending.set(commandId, { apply_id, step_id: step.step_id, target: step.target, action: step.action, commandId, expect, applied: true, open, timer });
    return "dispatched";
  }

  private outcome(a: Args): Record<string, unknown> {
    const outcomes = this.applies.get(a.apply_id);
    if (!outcomes) throw new RequestError("unknown_apply", `no apply ${a.apply_id}`);
    return { apply_id: a.apply_id, outcomes: outcomes.map((o) => ({ ...o })) };
  }

  private async eventsCall(a: Args): Promise<Record<string, unknown>> {
    // A notice a client took is no longer carried (applier, *Events and history*).
    const taken: string[] = Array.isArray(a.notice_taken) ? a.notice_taken : [];
    if (taken.length) {
      this.taken.push(...taken);
      this.notices = this.notices.filter((n) => !taken.includes(String(n.notice_id)));
    }
    const notices = () => this.notices.map((n) => ({ ...n }));
    if (a.cursor === undefined) return { events: [], cursor: String(this.seq), notices: notices() };
    const c = Number(a.cursor);
    if (!Number.isInteger(c) || c < 0 || c > this.seq) throw new RequestError("invalid_request", `no cursor ${a.cursor}`);
    const check = () => {
      // A gap a test closed with its events lost (`scriptGapEnd`), or a cursor past the retention.
      if (c < this.expiredBelow) throw new RequestError("cursor_expired", "the events after the cursor were lost in a gap");
      const kept = this.events.filter((e) => e.timeMs >= this.clock.now() - EVENT_RETENTION_MS);
      const oldest = kept[0]?.seq ?? this.seq + 1;
      if (c < oldest - 1) throw new RequestError("cursor_expired", "the cursor is older than the events kept");
    };
    // Inside a gap a test opened, nothing past its start is served (`scriptGap`).
    const visible = () => this.events.filter((e) => e.seq > c && (this.gapFrom === undefined || e.seq <= this.gapFrom));
    check();
    let out = visible();
    if (!out.length && a.wait_s) {
      // On the clock, as the reference applier's log waits: a stepped clock ends the wait, and it
      // never holds the caller in wall time while the test's time moves on.
      await new Promise<void>((resolve) => {
        const wake = () => { this.clock.clear(t); this.waiters = this.waiters.filter((w) => w !== wake); resolve(); };
        const t = this.clock.setTimeout(wake, a.wait_s * 1000);
        this.waiters.push(wake);
      });
      check();
      out = visible();
    }
    return { events: out.map(publicEvent), cursor: String(out.at(-1)?.seq ?? c), notices: notices() };
  }

  /**
   * The devices an event names (applier, *Events and history*): its target, a `model` event's device,
   * and for a `rule_fired` or `latch` event the devices its rule actuates, which the event itself does not name.
   */
  private namesOf(e: Event): string[] {
    const x = e as unknown as Record<string, unknown>;
    const rule = (x.type === "rule_fired" || x.type === "latch") && typeof x.rule_id === "string" ? this.safetyRules.get(x.rule_id) : undefined;
    return [x.target, x.device, ...(rule ? rule.actuates.map((a) => a.target) : [])].filter((t): t is string => typeof t === "string");
  }

  private history(a: Args): Record<string, unknown> {
    const from = Date.parse(a.from);
    const to = Date.parse(a.to);
    const targets: string[] | undefined = a.targets;
    return {
      events: this.events
        .filter((e) => e.timeMs >= from && e.timeMs <= to && (!targets || this.namesOf(e).some((t) => targets.includes(t))))
        .map(publicEvent),
    };
  }

  private async configure(a: Args): Promise<Record<string, unknown>> {
    if (a.expected_revision !== this.revision) throw new RequestError("stale_revision", `the revision is ${this.revision}`);
    const lines: string[] = [];
    const steps: (() => Promise<void> | void)[] = [];
    for (const c of a.changes as Args[]) {
      const v = c.value ?? {};
      const del = c.op === "delete";
      switch (c.kind) {
        case "client":
          if (typeof v.id !== "string" || (!del && typeof v.credential !== "string")) throw new RequestError("invalid_request", "a client is { id, credential, kind }");
          lines.push(`${c.op} client ${v.id}`);
          // Its token key is kept to check the tokens it sends; never logged.
          steps.push(() => {
            if (del) this.clients.delete(v.id);
            else this.clients.set(v.id, { credential: v.credential, kind: v.kind ?? "steward", ...(typeof v.token_key === "string" ? { tokenKey: v.token_key } : {}) });
          });
          break;
        case "bridge":
          if (typeof v.id !== "string" || (!del && typeof v.identity !== "string")) throw new RequestError("invalid_request", "a bridge is { id, identity }");
          lines.push(`${c.op} bridge ${v.id}`);
          steps.push(async () => {
            if (del) { this.bridges.delete(v.id); await this.link?.remove(v.id); }
            else { this.bridges.set(v.id, v.identity); await this.link?.add(v.id, v.identity); }
          });
          break;
        case "adopt": {
          const d = this.devices.get(v.device);
          if (del || !d || d.adopted || typeof v.class !== "string") throw new RequestError("invalid_request", `cannot adopt ${v.device}`);
          lines.push(`adopt ${v.device} as ${v.class}`);
          steps.push(() => { d.adopted = true; d.class = v.class; });
          break;
        }
        case "time_source":
          if (!this.opts.runId || !this.opts.retarget) throw new RequestError("invalid_request", "time_source is accepted only under the harness");
          if (typeof c.value !== "string") throw new RequestError("invalid_request", "time_source is host:port");
          lines.push(`time_source ${c.value}`);
          steps.push(() => this.opts.retarget!(c.value));
          break;
        default:
          throw new RequestError("invalid_request", `${c.kind} is not configured by the simulated applier`);
      }
    }
    if (a.dry_run) return { diff: lines.join("\n") };
    if (!steps.length) return { revision: this.revision };
    for (const step of steps) await step();
    this.revision++;
    this.emit("model", { revision: this.revision });
    return { revision: this.revision };
  }

  private onLink(e: LinkEvent): void {
    switch (e.kind) {
      case "devices": {
        for (const doc of e.devices) {
          const id = `${e.bridge}:${doc.id}`;
          const held = this.devices.get(id);
          if (held) held.doc = doc;
          else this.devices.set(id, { id, bridge: e.bridge, doc, adopted: false, class: null, values: {}, assumed: {}, lastCheckIn: null });
        }
        this.revision++;
        this.emit("model", { revision: this.revision });
        return;
      }
      case "device-status": {
        const d = this.devices.get(`${e.bridge}:${e.device}`);
        if (!d) return;
        const s = e.status as Args;
        for (const [key, value] of Object.entries(s)) {
          if (META.has(key)) continue;
          const basis_time = new Date(Date.parse(s.timestamps?.[key] ?? s.timestamp)).toISOString();
          const old = d.values[key];
          d.values[key] = { value, basis_time };
          if (!old || old.value !== value) this.emit("state", { target: d.id, key, value, basis_time, cause: "report" });
        }
        d.lastCheckIn = new Date(Date.parse(s.timestamp)).toISOString();
        for (const p of this.pending.values()) if (p.target === d.id && p.applied && this.matches(p)) this.finish(p.commandId, "acked");
        return;
      }
      case "ack": {
        const ack = e.ack as Args;
        const p = this.pending.get(ack.commandId);
        if (!p) return;
        if (ack.result === "failed") return this.finish(p.commandId, "failed", ack.reason);
        if (ack.result === "unsupported") return this.finish(p.commandId, "failed", "unsupported");
        if (p.open || ack.result === "sent") return this.finish(p.commandId, "sent");
        p.applied = true;
        if (!p.expect || this.matches(p)) this.finish(p.commandId, "acked");
        return;
      }
      case "liveness":
        for (const d of this.devices.values()) {
          if (d.bridge === e.bridge) this.emit("liveness", { target: d.id, old: e.alive ? "dead" : "live", new: e.alive ? "live" : "dead" });
        }
        return;
      case "fault":
        this.emit("bridge_fault", { bridge: e.bridge, what: e.what });
        return;
    }
  }

  /** GA-EVT-3: the device's reported state matches what the action sets. */
  private matches(p: Pending): boolean {
    const d = this.devices.get(p.target);
    return !!d && Object.entries(p.expect ?? {}).every(([k, v]) => d.values[k]?.value === v);
  }

  private finish(commandId: string, outcome: OutcomeName, reason?: string): void {
    const p = this.pending.get(commandId);
    if (!p) return;
    this.pending.delete(commandId);
    this.clock.clear(p.timer);
    if (p.open && p.expect && (outcome === "sent" || outcome === "unanswered")) {
      Object.assign(this.devices.get(p.target)!.assumed, p.expect);
    }
    const outcomes = this.applies.get(p.apply_id)!;
    const i = outcomes.findIndex((o) => o.step_id === p.step_id);
    outcomes[i] = { step_id: p.step_id, target: p.target, outcome, ...(reason ? { reason } : {}), time: this.iso() };
    this.emit("outcome", { apply_id: p.apply_id, step_id: p.step_id, target: p.target, outcome, ...(reason ? { reason } : {}) });
  }

  private emit(type: ApplierEvent["type"], fields: Record<string, unknown>): void {
    const timeMs = this.clock.now();
    this.events.push({ seq: ++this.seq, time: new Date(timeMs).toISOString(), timeMs, type, ...fields });
    while (this.events.length && this.events[0]!.timeMs < timeMs - HISTORY_RETENTION_MS) this.events.shift();
    for (const w of this.waiters.splice(0)) w();
  }

  private iso(ms = this.clock.now()): string {
    return new Date(ms).toISOString();
  }
}

/** Whether `version` is below `than`, read as dotted numbers ("0.9" below "0.10"). */
function older(version: string, than: string): boolean {
  const a = version.split(".").map(Number);
  const b = than.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  return false;
}

function publicEvent({ timeMs: _t, ...e }: Event): Record<string, unknown> {
  return e;
}

function stripTokens(body: Args): Args {
  const request = body.request as Args | undefined;
  if (!request) return body;
  return { ...body, request: { ...request, actions: request.actions.map(({ token: _t, ...x }: Args) => x) } };
}
