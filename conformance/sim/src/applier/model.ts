import type { ApplierPlan } from "@ludentes/galatea-life-schemas";
import type { BridgeDeviceDoc } from "../fixture.js";
import { setsOf } from "../vocabulary.js";

export type { BridgeDeviceDoc } from "../fixture.js";

export interface HeldDevice {
  id: string;
  bridge: string;
  doc: BridgeDeviceDoc;
  adopted: boolean;
  class: string | null;
  values: Record<string, { value: unknown; basis_time: string }>;
  assumed: Record<string, unknown>;
  lastCheckIn: string | null;
  /** The scripted stand-in: actions whose effective tier is not `reversible`, as an owner's `configure` raises them. */
  tiers?: Record<string, Tier>;
  /** The scripted stand-in: what an owner's `configure` marks it (applier, *Devices*). */
  internal?: boolean;
  infrastructure?: boolean;
  /** The scripted stand-in: an owner's freshness bound (`fresh_s`), or null for none known, over the declared one. */
  freshS?: number | null;
}

export type Tier = "reversible" | "confirm" | "no_voice";

/** One step of a plan (generated from `applier/plan.json`; never hand-written). */
export type Step = ApplierPlan["steps"][number];
/** A step's reason, as `applier/plan.json` enumerates them. */
export type StepReason = NonNullable<Step["reason"]>;

const SLOW: Record<string, number> = { gate: 90, cover: 90, curtain: 90, garage_door: 90, water_valve: 60, gas_valve: 60 };

/** The declared ack bound: the class's default, never below GA-CFG-3's 2 × reach_s + 10. */
export function ackWithinS(cls: string | null, reachMs = 0): number {
  return Math.max(SLOW[cls ?? ""] ?? 10, Math.ceil((2 * reachMs) / 1000 + 10));
}

/**
 * A device's effective freshness bound and its basis: a closed device declares 60 s, an open one none;
 * the scripted stand-in's owner bound (`freshS`) wins, null meaning none known.
 */
export function freshOf(d: HeldDevice): { fresh_s: number | null; fresh_basis: "declared" | "configured" | "unknown" } {
  if (d.freshS !== undefined) return { fresh_s: d.freshS, fresh_basis: d.freshS === null ? "unknown" : "configured" };
  return d.doc.feedback === "closed" ? { fresh_s: 60, fresh_basis: "declared" } : { fresh_s: null, fresh_basis: "unknown" };
}

export function describeDevice(d: HeldDevice): Record<string, unknown> {
  const cls = d.class ?? d.doc.proposedClass ?? null;
  const sensorKeys = d.doc.sensorKeys ?? [];
  return {
    id: d.id,
    label: d.doc.id,
    class: d.class,
    capabilities: d.doc.capabilities,
    ...(sensorKeys.length ? { sensor_key: sensorKeys[0] } : {}),
    sensor_keys: sensorKeys,
    proposed_class: d.doc.proposedClass ?? null,
    class_evidence: d.doc.classEvidence ?? "none",
    protocol: "other",
    stable_identifier: d.doc.stableIdentifier,
    adopted: d.adopted,
    other_admins: [],
    transport: `${d.bridge}:${d.doc.transport}`,
    bridge_device: { bridge: d.bridge, id: d.doc.id },
    reach_s: (d.doc.reachMs ?? 0) / 1000,
    feedback: d.doc.feedback,
    ...freshOf(d),
    fresh_slack_s: 11,
    // A bridge's own capabilities, each key's kind `state` where its bridge left it out (applier 0.14).
    ...(d.internal ? { internal: true } : {}),
    ...((d.doc as { accounts?: Record<string, string> }).accounts ? { accounts: (d.doc as { accounts?: Record<string, string> }).accounts } : {}),
    ...(d.infrastructure ? { infrastructure: true } : {}),
    // The keys its bridge declares personal (applier, *Personal keys*, GA-DESC-9).
    ...(d.doc.personal?.length ? { personal: [...d.doc.personal] } : {}),
    ...(d.doc.extensions ? { extensions: d.doc.extensions.map((e) => ({ ...e, keys: (e.keys ?? []).map((k) => ({ ...k, kind: k.kind ?? "state" })) })) } : {}),
    actions: d.doc.actions.map((a) => ({
      action: a.action,
      tier: d.tiers?.[a.action] ?? "reversible",
      // An extension action, one its device's extensions declare, is never idempotent (GA-DESC-4).
      idempotent: a.idempotent && !(d.doc.extensions ?? []).some((e) => ((e.actions ?? []) as { action: string }[]).some((x) => x.action === a.action)),
      ...(a.confirmedBy ? { confirmed_by: a.confirmedBy } : {}),
      stateless: a.stateless,
      ...(a.toggles ? { toggles: true } : {}),
      ...(a.wholeState ? { whole_state: true } : {}),
      ack_within_s: ackWithinS(cls, d.doc.reachMs),
      confirms: a.confirms,
    })),
  };
}

/**
 * One step, with the first reason that applies, in the standard's order (applier, *Reason order*):
 * `invalid_args`, `duplicate_route`, `safety` and `latched` never arise here. `token` is the token
 * that stands, the caller having dropped one that does not (`tokenFault`); `toggle` is false when it
 * stands but its `for` is an author's, which lifts a tier but never a toggle (GA-PLAN-8).
 */
export function planStep(
  i: number,
  a: { target: string; action: string; args: Record<string, unknown>; via?: string; brain?: boolean; token?: unknown; toggle?: boolean },
  d: HeldDevice | undefined,
  alive: boolean,
): Step {
  const tier = d?.tiers?.[a.action] ?? "reversible";
  const step: Step = { step_id: `s${i + 1}`, target: a.target, action: a.action, args: a.args, verdict: "op",
    tier, stale: false, basis: "real" };
  const decl = d?.doc.actions.find((x) => x.action === a.action);
  const why = (verdict: "skip" | "refuse", reason: StepReason): Step => ({ ...step, verdict, reason });
  if (!d) return why("skip", "unknown_target");
  if (!decl) return why("skip", "unsupported_action");
  if (!d.adopted) return why("refuse", "not_adopted");
  if (!alive) return why("skip", "dead");
  if (tier === "no_voice" && (a.via === "voice" || a.brain === true)) return why("refuse", "tier");
  const sets = setsOf(decl, a.args);
  // A lock is already done when the account's key reads any state a lock ends in (applier, *Computers and players*).
  if (a.action === "session.lock" && ["locked", "disconnected", "none"].includes(String(d.values[`session.${String(a.args.account)}`]?.value))) {
    return why("skip", "already");
  }
  // `already` is never evaluated for a stateless action, an open device or a stale value (applier
  // GA-PLAN-4); idempotence is no condition. The stand-in's values are never stale.
  if (d.doc.feedback === "closed" && !decl.stateless && !decl.toggles && sets
      && Object.entries(sets).every(([k, v]) => d.values[k] !== undefined && d.values[k]!.value === v)) {
    return why("skip", "already");
  }
  if (decl.toggles && d.doc.feedback === "open" && (a.token === undefined || a.toggle === false)) return why("refuse", "toggle_only");
  if (tier !== "reversible" && a.token === undefined) return why("refuse", "token");
  return step;
}

/** JSON with object keys sorted, for comparing request bodies (GA-APPLY-4). */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
