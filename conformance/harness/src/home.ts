import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import {
  brokerUrl, fixtureDevices, measureAllowance, SeverableProxy, SimBridge, SimFinder, startBroker, stopBrokers, TimeServer,
} from "@ludentes/galatea-life-sim";
import { TestClock } from "@ludentes/galatea-life-test-clock";
import { RequirementFailure } from "./assert.js";
import { dropOpenTemplates, freshDatabase, type TemplateDatabase, type TestDatabase } from "./database.js";
import type { ProposedClause, TestContext } from "./context.js";
import type { RequirementTest } from "./registry.js";
import { ApplierSide } from "./seams/applier-side.js";
import { BridgeLink } from "./seams/bridge-link.js";
import { BridgeWatcher } from "./seams/bridge-watcher.js";
import { McpSeam, type McpResult } from "./seams/mcp.js";
import { TestTransportClient } from "./seams/test-transport.js";
import { SubjectNotReady, SubjectProcess, SubjectSpecError, type SubjectSpec } from "./subject.js";
import { baselineChanges, CHANNEL, freshCredentials, startStandIn, STEWARD_CLIENT, type StandIn, type StewardCredentials } from "./steward-home.js";
import { listenPort } from "./ports.js";
import { pollUntil } from "./util.js";

export const SUBJECT_BRIDGE_ID = "subject-bridge";

/**
 * What a test's start knows of its run: the run id, the test's MQTT root, the mutation, and the run's
 * template database when the subject declares `database.migrate`, from which the test's is cloned.
 */
export interface RunInfo {
  runId: string; root: string; mutation?: string; template?: TemplateDatabase;
  /** The directory this check's subjects write V8 coverage into (`run --coverage`), as `NODE_V8_COVERAGE`. */
  coverage?: string;
}
export const SUBJECT_APPLIER_ID = "subject-applier";

/**
 * The applier subject's MQTT identity for one test: its own on the shared broker, since the binding
 * makes the ClientID the identity, and two subjects of one identity would take over each other's
 * session (a lesson from a deployed MQTT fleet). `demo/run-1/t3` gives `subject-applier-run-1-t3`.
 */
export function applierIdentity(root: string): string {
  return [SUBJECT_APPLIER_ID, ...root.split("/").slice(1)].join("-");
}
export const SIM_BRIDGE_ID = "sim-bridge";
/** The id the harness registers itself under as the subject's client, and so every token's `issuer`. */
export const HARNESS_CLIENT = "harness";
export const DEFAULT_DEVICES = ["lamp", "dimmer", "gate", "tv"];

/** One worker's view of the home: the shared broker, and a time server of its own. */
export interface Home {
  brokerUrl: string;
  time: TimeServer;
  allowanceMs: number;
}

/** The home of one command: one broker, and one lane per worker, since a step moves every subject on its source. */
export interface Homes {
  lanes: Home[];
  close(): Promise<void>;
}

/** Half the machine's cores, between 1 and 4. */
export function defaultWorkers(): number {
  return Math.max(1, Math.min(4, Math.floor(availableParallelism() / 2)));
}

const openHomes = new Set<Homes>();

/**
 * Closes every home still open, and every broker, one still starting included; for a harness that
 * is being interrupted.
 */
export async function closeOpenHomes(): Promise<void> {
  for (const h of [...openHomes]) await h.close().catch(() => undefined);
  await dropOpenTemplates();
  await stopBrokers();
}

export async function startHomes(workers = defaultWorkers()): Promise<Homes> {
  if (!Number.isInteger(workers) || workers < 1) throw new Error(`workers must be an integer of at least 1, not ${workers}`);
  const broker = await startBroker();
  const times: TimeServer[] = [];
  let closing: Promise<void> | undefined;
  // Registered as soon as the broker runs, so an interrupt while the rest starts still removes it.
  // Closing is memoised: the interrupt and the command's own close may overlap.
  const homes: Homes = {
    lanes: [],
    close() {
      closing ??= (async () => {
        openHomes.delete(homes);
        for (const t of times) await t.close();
        await broker.stop();
      })();
      return closing;
    },
  };
  openHomes.add(homes);
  try {
    const allowanceMs = await measureAllowance(broker.url);
    for (let i = 0; i < workers; i++) {
      const time = await TimeServer.start();
      if (closing) {
        await time.close();
        throw new Error("the home was closed while it started");
      }
      times.push(time);
    }
    homes.lanes = times.map((time) => ({ brokerUrl: broker.url, time, allowanceMs }));
    return homes;
  } catch (err) {
    await homes.close();
    throw err;
  }
}

type Cleanup = () => unknown;

async function teardownAll(list: Cleanup[]): Promise<void> {
  while (list.length) {
    try {
      await list.pop()!();
    } catch {
      // Teardown is best effort; the next test has its own root.
    }
  }
}

/**
 * The contract's environment. A state directory is removed by `cleanup`; since cleanup runs last in
 * first, and the subject's stop is pushed after this call, it is removed after the subject stopped.
 * A database, and its role, are dropped by `cleanup` the same way, after the subject stopped.
 */
async function contractEnv(home: Home, spec: SubjectSpec, identity: string, run: RunInfo,
  cleanup: Cleanup[], broker = home.brokerUrl, out?: { database?: TestDatabase }): Promise<Record<string, string>> {
  const env: Record<string, string> = {
    GALATEA_TEST_RUN_ID: run.runId,
    GALATEA_TIME_SOURCE: home.time.source,
    GALATEA_BROKER: brokerUrl(broker, identity),
    GALATEA_ROOT: run.root,
  };
  if (run.mutation) env.GALATEA_MUTATION = run.mutation;
  if (run.coverage) env.NODE_V8_COVERAGE = run.coverage;
  if (spec.state_dir) {
    const dir = mkdtempSync(join(tmpdir(), "galatea-state-"));
    env.GALATEA_STATE_DIR = dir;
    cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  }
  if (spec.database) {
    const admin = process.env.GALATEA_TEST_PG_URL;
    // The harness's own configuration, not the subject's fault: a harness fault names it.
    if (!admin) {
      throw new Error("the subject asks for a database: set GALATEA_TEST_PG_URL, or run under "
        + "conformance/harness/scripts/with-postgres.mjs");
    }
    // A subject that declares database.migrate has the run's template; each test's database is its clone.
    const db = run.template ? await run.template.clone() : await freshDatabase(admin);
    env.GALATEA_DATABASE_URL = db.url;
    if (out) out.database = db;
    cleanup.push(() => db.drop());
  }
  return env;
}

/** The guard's bound on the subject's answer: a bridge's status, an applier's `describe`. */
const GUARD_MS = 15_000;

/** A failure of the subject, not of the harness: the guard refuses the subject for it. */
class Refusal extends Error {}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** `p`, or a Refusal naming `what` when it rejects or takes longer than `ms`. */
async function fromSubject<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Refusal(`${what}: no answer in ${ms} ms`)), ms); }),
    ]);
  } catch (err) {
    if (err instanceof Refusal) throw err;
    throw new Refusal(`${what}: ${message(err)}`);
  } finally {
    clearTimeout(timer);
  }
}

async function startSubject(dir: string, spec: SubjectSpec, env: Record<string, string>): Promise<SubjectProcess> {
  try {
    return await SubjectProcess.start(dir, spec, env);
  } catch (err) {
    if (err instanceof SubjectNotReady || err instanceof SubjectSpecError) throw new Refusal(`the subject could not be started: ${err.message}${err instanceof SubjectNotReady ? ` (${err.output.join(" | ")})` : ""}`);
    throw err;
  }
}

/** `startSubject` on a port of its own, again on a fresh one while another server took it (`onFreshPort`). */
async function startSubjectOnPort(dir: string, spec: SubjectSpec, env: Record<string, string>): Promise<{ subject: SubjectProcess; port: number }> {
  try {
    return await onFreshPort(async (port) => ({ port, subject: await SubjectProcess.start(dir, spec, { ...env, GALATEA_MCP_PORT: String(port) }) }));
  } catch (err) {
    if (err instanceof SubjectNotReady || err instanceof SubjectSpecError) throw new Refusal(`the subject could not be started: ${err.message}${err instanceof SubjectNotReady ? ` (${err.output.join(" | ")})` : ""}`);
    throw err;
  }
}

/**
 * The run-id guard: the reason to refuse the subject, or undefined. Nothing is actuated. Only a
 * failure of the subject refuses it; a failure of the harness's own side (its broker, a bug) is
 * thrown, and the run reports a harness fault.
 */
export async function guard(home: Home, dir: string, spec: SubjectSpec, runId: string, template?: TemplateDatabase): Promise<string | undefined> {
  const root = `demo/${runId}/guard`;
  const cleanup: Cleanup[] = [];
  try {
    if (spec.standard === "bridge") {
      const watch = await BridgeWatcher.start(home.brokerUrl, `${root}/bridges/${SUBJECT_BRIDGE_ID}/status`);
      cleanup.push(() => watch.close());
      const env = { ...(await contractEnv(home, spec, SUBJECT_BRIDGE_ID, { runId, root, template }, cleanup)),
        GALATEA_TEST_TRANSPORT: `${root}/test/${SUBJECT_BRIDGE_ID}/control` };
      const subject = await startSubject(dir, spec, env);
      cleanup.push(() => subject.stop());
      const status = await watch.waitFor((s) => s.payload !== null, GUARD_MS).catch(() => undefined);
      if (!status) return `the bridge published no status in ${GUARD_MS / 1000} s`;
      if (status.payload.testRunId !== runId) return `the bridge's status carries testRunId ${JSON.stringify(status.payload.testRunId)}, not the run's`;
      return undefined;
    }
    if (spec.standard === "applier" || spec.standard === "steward") {
      const owner = randomUUID();
      let env = { ...(await contractEnv(home, spec, applierIdentity(root), { runId, root, template }, cleanup)),
        GALATEA_OWNER_CREDENTIAL: owner };
      if (spec.standard === "steward") {
        // A steward needs its applier: the stand-in, though the guard reads only the steward's describe.
        const clock = await TestClock.connect(home.time.source);
        cleanup.push(() => clock.close());
        const standIn = (await startStandIn({ clock, runId, root }))!;
        cleanup.push(() => standIn.close());
        env = { ...env, ...applierEnv(standIn) };
      }
      const { subject, port } = await startSubjectOnPort(dir, spec, env);
      cleanup.push(() => subject.stop());
      // One deadline for the connect and the describe; McpSeam's own bound is the SDK's 60 s.
      let settled = false;
      const d = await fromSubject((async () => {
        const seam = await McpSeam.connect(`http://127.0.0.1:${port}/mcp`, owner);
        // A seam that connects after the deadline is closed at once, not left open.
        if (settled) void seam.close().catch(() => undefined);
        else cleanup.push(() => seam.close());
        return seam.call("describe");
      })(), GUARD_MS, "the subject's MCP describe").finally(() => { settled = true; });
      if (!d.ok) return `describe returned ${d.error}`;
      if (d.body.test_run_id !== runId) return `describe.test_run_id is ${JSON.stringify(d.body.test_run_id)}, not the run's`;
      return undefined;
    }
    return `the harness has no seam for ${spec.standard} in wave 0`;
  } catch (err) {
    if (err instanceof Refusal) return err.message;
    throw err;
  } finally {
    await teardownAll(cleanup);
  }
}

/** What a steward subject is told of its applier (the design, *How it is graded*). */
function applierEnv(standIn: StandIn): Record<string, string> {
  return { GALATEA_APPLIER_URL: standIn.url, GALATEA_APPLIER_CLIENT: STEWARD_CLIENT, GALATEA_APPLIER_CREDENTIAL: standIn.credential,
    GALATEA_APPLIER_TOKEN_KEY: standIn.tokenKey };
}

/**
 * The guard against a port another server took between its draw (`listenPort`) and the subject's
 * bind: the server on the port must be this test's subject, which knows the owner credential the
 * harness gave it and answers the run's `test_run_id`. Anything else is the harness's fault, thrown as one, and
 * never the subject's failure of the test.
 */
export function whoAnswers(describe: McpResult, runId: string): void {
  if (!describe.ok && describe.error === "not_permitted") {
    throw new Error("the subject's MCP port refused the owner credential the harness gave it: another server may hold the port");
  }
  // Fails closed: an answer that is not this subject's describe is not this test's subject.
  if (!describe.ok) {
    throw new Error(`the subject's MCP port answered the owner's describe with ${describe.error}: another server may hold the port`);
  }
  if (describe.body?.test_run_id !== runId) {
    throw new Error(`the subject's MCP port answered test_run_id ${JSON.stringify(describe.body?.test_run_id)}, not the run's `
      + `${runId}: another server holds the port`);
  }
}

/** How many ports a subject's start tries before a lost port is the run's failure. */
export const PORT_ATTEMPTS = 5;

/**
 * Starts a subject on a port from `listenPort`, and again on a fresh one, after a short random pause,
 * while another server took the port between its draw and the subject's bind (the subject's output
 * says `EADDRINUSE`), up to PORT_ATTEMPTS. Any other failure, or the last loss, is thrown. The subject
 * contract names the port the subject listens on (GALATEA_MCP_PORT), so the harness chooses it; a
 * subject binding port 0 and reporting its own would change the contract every subject keeps.
 */
export async function onFreshPort<T>(start: (port: number) => Promise<T>,
  o: { port?: () => Promise<number>; pauseMs?: () => number } = {}): Promise<T> {
  const port = o.port ?? listenPort;
  const pauseMs = o.pauseMs ?? (() => 20 + Math.floor(Math.random() * 180));
  for (let attempt = 1; ; attempt++) {
    try {
      return await start(await port());
    } catch (err) {
      const lost = err instanceof SubjectNotReady && err.output.some((l) => l.includes("EADDRINUSE"));
      if (!lost || attempt === PORT_ATTEMPTS) throw err;
      await new Promise((r) => setTimeout(r, pauseMs()));
    }
  }
}

/** Starts a fresh subject for one test, with its seam's neighbours, and the test's context. */
export async function startOnSeam(
  home: Home, dir: string, spec: SubjectSpec, test: RequirementTest, run: RunInfo,
): Promise<{ ctx: TestContext; teardown(): Promise<void> }> {
  const cleanup: Cleanup[] = [];
  const evidence: string[] = [];
  const proposedLog: ProposedClause[] = [];
  const base = { runId: run.runId, root: run.root, time: home.time, allowanceMs: home.allowanceMs,
    claims: spec.claims, evidence: (note: string) => void evidence.push(note),
    proposed: (clause: string, held: boolean, note: string) => void proposedLog.push({ clause, held, note }), proposedLog };
  try {
    if (test.opts.seam === "steward") {
      const { ctx, more } = await startSteward(home, dir, spec, test, run, cleanup);
      return { ctx: { ...base, ...ctx, evidenceLog: evidence, ...more } as TestContext, teardown: () => teardownAll(cleanup) };
    }
    if (test.opts.seam === "bridge") {
      const control = `${run.root}/test/${SUBJECT_BRIDGE_ID}/control`;
      const watch = await BridgeWatcher.start(home.brokerUrl, `${run.root}/bridges/${SUBJECT_BRIDGE_ID}/#`);
      cleanup.push(() => watch.close());
      const transport = await TestTransportClient.start(home.brokerUrl, control);
      cleanup.push(() => transport.close());
      const applier = await ApplierSide.start(home.brokerUrl, `${run.root}/bridges/${SUBJECT_BRIDGE_ID}`, watch, () => home.time.now());
      cleanup.push(() => applier.close());
      // The subject reaches the shared broker through a link of its own, which a test may cut, read
      // and have refuse (GA-BRIDGE-9, 18, 20).
      const bridgeLink = await BridgeLink.start(home.brokerUrl);
      cleanup.push(() => bridgeLink.close());
      const subject = await SubjectProcess.start(dir, spec,
        { ...(await contractEnv(home, spec, SUBJECT_BRIDGE_ID, run, cleanup, bridgeLink.url)), GALATEA_TEST_TRANSPORT: control });
      cleanup.push(() => subject.stop());
      return { ctx: { ...base, subject, bridgeId: SUBJECT_BRIDGE_ID, watch, transport, applier, bridgeLink, evidenceLog: evidence },
        teardown: () => teardownAll(cleanup) };
    }
    const fixture = test.opts.fixture ?? {};
    const clock = await TestClock.connect(home.time.source);
    cleanup.push(() => clock.close());
    const devices = (fixture.devices ?? DEFAULT_DEVICES).map((d) => (typeof d === "string" ? fixtureDevices([d])[0]!
      : { ...fixtureDevices([d.id])[0]!, ...(d.connections ? { connections: d.connections } : {}) }));
    const bridge = new SimBridge({ brokerUrl: home.brokerUrl, root: run.root, bridgeId: SIM_BRIDGE_ID, clock,
      runId: run.runId, devices, faults: fixture.faults, ...(fixture.bridge ?? {}) });
    await bridge.start();
    cleanup.push(() => bridge.stop());
    let finder: SimFinder | undefined;
    if (fixture.finder) {
      const f = new SimFinder({ brokerUrl: home.brokerUrl, root: run.root, clock, runId: run.runId });
      await f.start();
      cleanup.push(() => f.stop());
      finder = f;
    }
    // The subject reaches the shared broker through a proxy of its own, so a test can take the broker
    // away from this subject alone (GA-BUS-7, GA-BUS-8).
    const link = await SeverableProxy.start(home.brokerUrl);
    cleanup.push(() => link.close());
    const ownerCredential = randomUUID();
    const out: { database?: TestDatabase } = {};
    const env = await contractEnv(home, spec, applierIdentity(run.root), run, cleanup, link.url, out);
    const { subject, port } = await onFreshPort(async (port) => ({ port,
      subject: await SubjectProcess.start(dir, spec, { ...env, GALATEA_MCP_PORT: String(port), GALATEA_OWNER_CREDENTIAL: ownerCredential }) }));
    cleanup.push(() => subject.stop());
    const url = `http://127.0.0.1:${port}/mcp`;
    const owner = await McpSeam.connect(url, ownerCredential);
    // A restart closes it first.
    cleanup.push(() => owner.close().catch(() => undefined));
    whoAnswers(await owner.call("describe"), run.runId);
    const credential = randomUUID();
    // The key the harness signs its confirmation tokens with (applier, *Clients and tokens*).
    const tokenKey = randomUUID();
    // A bridge's report may move the revision between the read and the write (a device arriving is a
    // model change), so a stale_revision here is the setup's race, not the subject's fault: read again.
    const configure = async (changes: unknown[]) => {
      for (let attempt = 1; ; attempt++) {
        const { revision } = await owner.callOk("describe");
        const r = await owner.call("configure", { changes, expected_revision: revision, dry_run: false });
        if (r.ok) return;
        if (r.error !== "stale_revision" || attempt === 5) {
          throw new RequirementFailure(`configure returned ${r.error}: ${r.message}`, r.body);
        }
      }
    };
    await configure([
      { op: "upsert", kind: "client", value: { id: HARNESS_CLIENT, credential, kind: "steward", token_key: tokenKey } },
      { op: "upsert", kind: "bridge", value: { id: SIM_BRIDGE_ID, identity: SIM_BRIDGE_ID } },
      { op: "upsert", kind: "time_source", value: home.time.source },
      // A subject claiming Safe over bridges claims it only with the owner's box (GA-DESC-6).
      ...(spec.claims.includes("Safe") ? [{ op: "upsert", kind: "box", value: true }] : []),
    ]);
    const fixtureIds = devices.map((d) => `${SIM_BRIDGE_ID}:${d.id}`);
    const described = await pollUntil(async () => {
      const d = await owner.callOk("describe");
      const ids = new Set((d.devices as { id: string }[]).map((x) => x.id));
      return fixtureIds.every((id) => ids.has(id)) ? d : undefined;
    }, 10_000, `describe did not show the fixture's devices ${fixtureIds.join(", ")}`);
    await configure((described.devices as { id: string; proposed_class: string | null; adopted: boolean }[])
      .filter((d) => fixtureIds.includes(d.id) && !d.adopted)
      .map((d) => {
        const cls = d.proposed_class ?? "socket";
        // A Safe owner declares every socket's load: one never configured is heating (GA-DESC-8), whose tiers a test does not expect.
        const load = cls === "socket" && spec.claims.includes("Safe") ? { declarations: { load: "other" } } : {};
        return { op: "upsert", kind: "adopt", value: { device: d.id, class: cls, ...load } };
      }));
    const mcp = await McpSeam.connect(url, credential);
    cleanup.push(() => mcp.close().catch(() => undefined));
    // A retained status delivered on subscribing never makes a bridge live (GA-BUS-8), so the bridge
    // publishes a live one, again until its devices are no longer dead: the applier may subscribe
    // only after its registration commits. Tests start from a live bridge; after a restart, so does
    // what follows it, but for the devices the test made dead.
    const liveAgain = async (seam: McpSeam, dead: string[] = []) => {
      const wanted = fixtureIds.filter((id) => !dead.some((d) => id === `${SIM_BRIDGE_ID}:${d}`));
      if (!wanted.length) return;
      await pollUntil(async () => {
        await bridge.publishStatus();
        const s = await seam.callOk("state", { targets: wanted });
        return wanted.every((id) => s.targets?.[id] && s.targets[id].liveness !== "dead");
      }, 10_000, `the fixture's devices did not come alive: ${wanted.join(", ")}`, 100);
    };
    await liveAgain(mcp);
    // The fixture bridge's transport is in the model too before a test starts: it arrives with the
    // bridge's status, apart from its devices, and would otherwise move the revision under a test that
    // reads it first (the 5b preflight's M1).
    const transport = `${SIM_BRIDGE_ID}:test`;
    await pollUntil(async () => ((await owner.callOk("describe")).transports as { id: string }[] | undefined)?.some((t) => t.id === transport) || undefined,
      10_000, `describe did not show the fixture bridge's transport ${transport}`);
    const ctx: TestContext = { ...base, subject, mcp, owner, mcpUrl: url, bridge, link, tokenKey, evidenceLog: evidence,
      ...(finder ? { finder } : {}) };
    ctx.restartApplier = async (o = {}) => {
      // The old sessions end with the process; closing them first keeps the client from retrying into the new one.
      await ctx.mcp!.close().catch(() => undefined);
      await ctx.owner!.close().catch(() => undefined);
      await subject.restart(o.between, { crash: o.crash });
      const again = await pollUntil(async () => McpSeam.connect(url, ownerCredential).catch(() => undefined), 15_000,
        "the restarted applier did not answer its owner", 200);
      ctx.owner = again;
      cleanup.push(() => again.close().catch(() => undefined));
      // The port is the subject's again only if this run's subject answers on it.
      whoAnswers(await again.call("describe"), run.runId);
      const seam = await McpSeam.connect(url, credential);
      ctx.mcp = seam;
      cleanup.push(() => seam.close().catch(() => undefined));
      await liveAgain(seam, o.dead);
    };
    const database = out.database;
    if (database) {
      ctx.stallStore = (tables) => database.stall(tables);
      if (spec.stall_tables) ctx.stallTables = spec.stall_tables;
    }
    return { ctx, teardown: () => teardownAll(cleanup) };
  } catch (err) {
    await teardownAll(cleanup);
    throw err;
  }
}

/**
 * The steward seam (the design, *How it is graded*): the scripted stand-in applier in this process,
 * the steward subject started against it, and, unless the stand-in is on TLS, the baseline house
 * defined as the bootstrap owner, with a seam per credential.
 */
async function startSteward(home: Home, dir: string, spec: SubjectSpec, test: RequirementTest,
  run: RunInfo, cleanup: Cleanup[]):
Promise<{ ctx: Pick<TestContext, "subject" | "owner" | "mcpUrl" | "standIn" | "startSteward">; more: Partial<TestContext> }> {
  const clock = await TestClock.connect(home.time.source);
  cleanup.push(() => clock.close());
  const tls = test.opts.standIn?.tls === true;
  // On a host with no other address, or no way to make a certificate, the stand-in stays on loopback,
  // and a test that needs TLS says it cannot be run here.
  const standIn = (tls ? await startStandIn({ clock, runId: run.runId, root: run.root, tls }) : undefined)
    ?? (await startStandIn({ clock, runId: run.runId, root: run.root }))!;
  cleanup.push(() => standIn.close());
  const credentials = freshCredentials();
  const env = { ...(await contractEnv(home, spec, "steward", run, cleanup)), ...applierEnv(standIn),
    GALATEA_OWNER_CREDENTIAL: credentials.owner };
  const { subject, port } = await onFreshPort(async (port) => ({ port,
    subject: await SubjectProcess.start(dir, spec, { ...env, GALATEA_MCP_PORT: String(port) }) }));
  cleanup.push(() => subject.stop());
  const url = `http://127.0.0.1:${port}/mcp`;
  const owner = await McpSeam.connect(url, credentials.owner);
  cleanup.push(() => owner.close());
  whoAnswers(await owner.call("describe"), run.runId);
  const startSteward = async (extra: Record<string, string>) => {
    const { subject: other } = await onFreshPort(async (port) => ({ port,
      subject: await SubjectProcess.start(dir, spec, { ...env, GALATEA_MCP_PORT: String(port), ...extra }, { readyMs: 15_000 }) }));
    cleanup.push(() => other.stop());
    return other;
  };
  const ctx = { subject, owner, mcpUrl: url, standIn, startSteward };
  if (standIn.url.startsWith("https:")) return { ctx, more: { credentials } };
  await pollUntil(async () => ((await owner.callOk("describe")).targets as { id: string }[]).some((t) => t.id === CHANNEL),
    10_000, `the steward's describe did not show the stand-in's ${CHANNEL}`, 100);
  await defineBaseline(owner, credentials, home.time.source);
  const seams: Record<string, McpSeam> = { owner };
  for (const who of ["olga", "panel", "brain", "front"] as const) {
    seams[who] = await McpSeam.connect(url, credentials[who]);
    cleanup.push(() => seams[who]!.close());
  }
  return { ctx, more: { credentials, steward: seams as NonNullable<TestContext["steward"]> } };
}

/**
 * The baseline house, in one change set. The stand-in's model may move the revision between the read
 * and the write (the steward follows it), so a stale_revision here is the setup's race: read again.
 */
async function defineBaseline(owner: McpSeam, credentials: StewardCredentials, timeSource: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    const { revision } = await owner.callOk("describe");
    const r = await owner.call("define", { endpoint: "owner-app", changes: baselineChanges(credentials, timeSource),
      expected_revision: revision, dry_run: false });
    if (r.ok) return;
    if (r.error !== "stale_revision" || attempt === 5) throw new RequirementFailure(`setup: define returned ${r.error}: ${r.message}`, r.body);
  }
}
