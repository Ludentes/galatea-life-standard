import { randomUUID } from "node:crypto";
import { fixtureDevices, nonLoopbackAddress, selfSigned, serveMcp, SimApplier } from "@ludentes/galatea-life-sim";
import { listenPort } from "./ports.js";
import type { Clock } from "@ludentes/galatea-life-test-clock";

/** The steward's client id at its stand-in applier, and so every token's `issuer` (from slice 2b). */
export const STEWARD_CLIENT = "steward";
/** The stand-in's notify channel, which the baseline's `notice_channels` names (GA-DEF-8), and a lamp. */
export const CHANNEL = "sim-bridge:channel";
export const LAMP = "sim-bridge:lamp";
/** The baseline's endpoints with a voice record: an answer at one carries `asked_by` (GA-CONF-2). */
export const VOICE_ENDPOINTS: readonly string[] = ["kitchen-voice"];

/** The baseline house's credentials beside the owner's: one per kind of client a test acts as. */
export interface StewardCredentials { owner: string; olga: string; panel: string; brain: string; front: string }

export const freshCredentials = (): StewardCredentials =>
  ({ owner: randomUUID(), olga: randomUUID(), panel: randomUUID(), brain: randomUUID(), front: randomUUID() });

/**
 * The house the harness defines before a steward test, as the bootstrap owner (the design, *How it
 * is graded*): `time_source` and a notify channel in the first change set, two rooms, a member with
 * her app, a guest panel in the hall, a brain-served voice endpoint in the kitchen with its voice
 * record, the brain and the front credentials.
 */
export function baselineChanges(c: StewardCredentials, timeSource: string): unknown[] {
  const up = (kind: string, value: unknown) => ({ op: "upsert", kind, value });
  return [
    up("home", { timezone: "Europe/Moscow", notice_channels: [CHANNEL], time_source: timeSource }),
    up("room", { id: "hall", name: "Холл" }), up("room", { id: "kitchen", name: "Кухня" }),
    up("person", { id: "olga", name: "Ольга", role: "member" }),
    up("endpoint", { id: "olga-app", name: "Телефон Ольги", type: "app", room: null, person: "olga", served_by: null }),
    up("endpoint", { id: "hall-panel", name: "Панель в холле", type: "panel", room: "hall", person: null, served_by: null }),
    up("endpoint", { id: "kitchen-voice", name: "Кухня", type: "voice", room: "kitchen", person: null, served_by: "brain" }),
    up("voice", { endpoint: "kitchen-voice", listening: "wake_server", wake_words: [{ word: "Галатея", model: "transcript" }],
      zone: "downstairs", output: "speech", follow_up: false, heard_by: "front" }),
    up("credential", { id: "olga-app", kind: "app", secret: c.olga, endpoint: "olga-app" }),
    up("credential", { id: "hall-panel", kind: "panel", secret: c.panel, endpoint: "hall-panel" }),
    up("credential", { id: "brain", kind: "brain", secret: c.brain }),
    up("credential", { id: "front", kind: "front", secret: c.front }),
  ];
}

export interface StandIn {
  applier: SimApplier;
  url: string;
  connections(): { tcp: number; tls: number };
  /** From now on the stand-in serves only the 2025 era, as an applier that does not serve 2026-07-28 (GA-BIND-2). */
  onlyLegacy(on: boolean): void;
  /** The steward's credential and token key at the stand-in. */
  credential: string;
  tokenKey: string;
  close(): Promise<void>;
}

/**
 * The stand-in applier for a steward test, in the harness's own process, scripted (ruled, Q1): an
 * adopted notify channel and a lamp, the steward registered as its client. On loopback, or with
 * `tls` on the host's other address with a certificate nobody trusts (GA-SEC-2); undefined when the
 * host has no such address or no way to make a certificate.
 */
export async function startStandIn(o: { clock: Clock; runId: string; root: string; tls?: boolean }): Promise<StandIn | undefined> {
  let serve: { host?: string; tls?: { cert: string; key: string } } = {};
  if (o.tls) {
    const host = nonLoopbackAddress();
    const tls = host ? await selfSigned(host) : undefined;
    if (!host || !tls) return undefined;
    serve = { host, tls };
  }
  const owner = randomUUID();
  const applier = new SimApplier({ identity: "stand-in", root: o.root, clock: o.clock, ownerCredential: owner, runId: o.runId });
  await applier.start();
  const [channel, lamp] = fixtureDevices(["channel", "lamp"]);
  applier.scriptDevice(channel!, { adopt: "channel" });
  applier.scriptDevice(lamp!, { adopt: "light" });
  const credential = randomUUID();
  const tokenKey = randomUUID();
  const caller = applier.caller(owner);
  const d = await applier.call(caller, "describe", {});
  const r = await applier.call(caller, "configure", { changes: [{ op: "upsert", kind: "client",
    value: { id: STEWARD_CLIENT, credential, kind: "steward", token_key: tokenKey } }],
  expected_revision: d.ok ? d.body.revision : 0, dry_run: false });
  if (!r.ok) throw new Error(`the stand-in did not register the steward: ${r.error}`);
  const server = await serveMcp(applier, await listenPort(), serve);
  return { applier, url: server.url, connections: () => server.connections(), onlyLegacy: (on) => server.onlyLegacy(on), credential, tokenKey,
    close: async () => { await server.close(); await applier.stop(); } };
}
