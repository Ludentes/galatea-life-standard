import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { RequirementFailure } from "./assert.js";
import { databaseTimes, MigrateFailed, templateDatabase, type TemplateDatabase } from "./database.js";
import type { ProposedClause } from "./context.js";
import { OpUnsupported } from "./seams/test-transport.js";
import { guard, startHomes, startOnSeam, type Home, type Homes, type RunInfo } from "./home.js";
import { allIds, loadManifest, type Requirement, type StandardName } from "./manifest.js";
import { checkRegistry, registered, type RequirementTest } from "./registry.js";
import { baseRows, finish, type NegativeResult, type Report, type Row } from "./report.js";
import { loadSubject, SubjectNotReady, SubjectProcess, SubjectSpecError, type SubjectSpec } from "./subject.js";

export class HarnessFault extends Error {}

export interface RunOptions {
  subjectDir: string;
  ids?: string[];
  complete?: boolean;
  tests?: RequirementTest[];
  workers?: number;
  /** A home to use and leave open; otherwise the command starts and closes its own. */
  homes?: Homes;
  /** A run only: each check's subjects write V8 coverage into `<coverageDir>/t<n>` (the reach measure). */
  coverageDir?: string;
}

/**
 * The mutations whose fault is the subject's exit (bridge, *Negative subjects*: `exits-on-fault`, "an
 * exit stops every other device"). Under one of them, a test in which the subject exited when nothing
 * the harness did asked it to has caught the mutation; under any other, the exit proves nothing.
 */
export const EXIT_MUTATIONS: Record<StandardName, string[]> = { applier: [], steward: [], bridge: ["exits-on-fault"], brain: [], voice: [] };

/** The harness's own mutations of the simulated home, per standard (the spec's *Negative subjects*). */
export const ENVIRONMENT_MUTATIONS: Record<StandardName, string[]> = { applier: [], steward: [], bridge: [], brain: [], voice: [] };

/**
 * `caught` is true only when the test's body ran and threw a RequirementFailure (a SubjectFault
 * included): the subject's behaviour failed the test. A failed setup, a subject that did not come
 * back ready, or one that exited under an error of another kind, is a fail that is not caught.
 */
type Outcome = { state: "pass" | "fail" | "not_applicable"; ms: number; error?: string; evidence: string[]; caught?: boolean;
  proposed?: ProposedClause[]; coverage?: Row["coverage"] };

/** How long a failed test waits for a dying subject's exit to be seen. */
const EXIT_SETTLE_MS = 200;

const describeError = (err: unknown) => (err instanceof Error ? err.message : String(err));

async function runTest(home: Home, dir: string, spec: SubjectSpec, test: RequirementTest,
  run: RunInfo): Promise<Outcome> {
  const t0 = Date.now();
  home.time.reset();
  const failed = (error: string, evidence: string[] = []): Outcome => ({ state: "fail", ms: Date.now() - t0, error, evidence });
  let started: Awaited<ReturnType<typeof startOnSeam>>;
  try {
    started = await startOnSeam(home, dir, spec, test, run);
  } catch (err) {
    if (err instanceof SubjectNotReady) return failed(err.message, err.output);
    if (err instanceof RequirementFailure) return failed(`setup: ${err.message}`);
    throw new HarnessFault(`setting up ${test.ids.join(", ")}: ${describeError(err)}`);
  }
  const { ctx, teardown } = started;
  const outcome = (o: Outcome): Outcome => (ctx.proposedLog?.length ? { ...o, proposed: [...ctx.proposedLog] } : o);
  const timeoutMs = test.opts.timeoutMs ?? 120_000;
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      test.fn(ctx),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new RequirementFailure(`the test did not finish in ${timeoutMs} ms`)), timeoutMs); }),
    ]);
    return outcome({ state: "pass", ms: Date.now() - t0, evidence: ctx.evidenceLog });
  } catch (err) {
    // A subject that died makes the next call fail as a SubjectFault; let its exit event land
    // first, so such a failure is not taken for the requirement's.
    await ctx.subject.settle(EXIT_SETTLE_MS);
    const evidence = [...ctx.evidenceLog, ...ctx.subject.output()];
    if (err instanceof OpUnsupported) return { state: "not_applicable", ms: Date.now() - t0, evidence: [...ctx.evidenceLog, err.message] };
    if (ctx.subject.exitedUnasked) {
      const exitIsTheFault = run.mutation !== undefined && EXIT_MUTATIONS[spec.standard].includes(run.mutation);
      return { ...failed(`the subject exited during the test: ${describeError(err)}`, evidence), ...(exitIsTheFault ? { caught: true } : {}) };
    }
    if (err instanceof RequirementFailure) return outcome({ ...failed(err.message, evidence), caught: true });
    if (err instanceof SubjectNotReady) return failed(err.message, evidence);
    if (ctx.subject.exited) return failed(`the subject exited during the test: ${describeError(err)}`, ctx.subject.output());
    throw new HarnessFault(`a test of ${test.ids.join(", ")} threw outside an assertion: ${describeError(err)}`);
  } finally {
    clearTimeout(timer);
    await teardown();
  }
}

/** Runs `fn` over `items` on each lane, a lane taking the next item when it is free; the first error stops new items. */
async function onLanes<T>(lanes: Home[], items: T[], fn: (item: T, lane: Home, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  let fault: unknown;
  await Promise.all(lanes.map(async (lane) => {
    while (fault === undefined && next < items.length) {
      const i = next++;
      try {
        await fn(items[i]!, lane, i);
      } catch (err) {
        fault ??= err;
      }
    }
  }));
  if (fault !== undefined) throw fault;
}

interface Prepared {
  spec: SubjectSpec;
  manifest: Requirement[];
  tests: RequirementTest[];
  report: Report;
  /** The run's template database, while the run holds one (`subject.json`'s `database.migrate`). */
  template?: TemplateDatabase;
}

function prepare(opts: RunOptions, mode: Report["mode"]): Prepared {
  const dir = resolve(opts.subjectDir);
  const runId = `run-${randomUUID().slice(0, 8)}`;
  const report: Report = { mode, standard: "", subject: dir, runId, claims: [], startedAt: new Date().toISOString(),
    rows: [], coverage: { claimed: 0, tested: 0 }, passed: false };
  let spec: SubjectSpec;
  try {
    spec = loadSubject(dir);
  } catch (err) {
    if (err instanceof SubjectSpecError) {
      report.refused = err.message;
      return { spec: undefined as never, manifest: [], tests: [], report };
    }
    throw err;
  }
  const manifest = loadManifest(spec.standard);
  const all = opts.tests ?? registered();
  const errors = checkRegistry(allIds(), all);
  if (errors.length) report.harnessFault = `the registry is wrong: ${errors.join("; ")}`;
  const claimed = new Set(manifest.filter((r) => spec.claims.includes(r.conformance)).map((r) => r.id));
  const tests = all.filter((t) => t.opts.seam === spec.standard && t.ids.some((id) => claimed.has(id))
    && (!opts.ids || t.ids.some((id) => opts.ids!.includes(id))));
  Object.assign(report, { standard: spec.standard, claims: spec.claims, rows: baseRows(manifest, spec.claims) });
  return { spec, manifest, tests, report };
}

/** Starts the home (unless given) and runs the guard; `body` runs only when both succeeded. */
async function withHome(p: Prepared, opts: RunOptions, body: (lanes: Home[]) => Promise<void>): Promise<void> {
  if (p.report.refused || p.report.harnessFault) {
    if (p.report.refused) p.report.rows = [];
    return;
  }
  const t0 = Date.now();
  const db0 = { ...databaseTimes };
  let homes: Homes;
  try {
    homes = opts.homes ?? (await startHomes(opts.workers));
  } catch (err) {
    p.report.harnessFault = `the simulated home did not start: ${describeError(err)}`;
    p.report.rows = [];
    return;
  }
  try {
    const migrate = typeof p.spec.database === "object" ? p.spec.database.migrate : undefined;
    if (migrate) {
      const admin = process.env.GALATEA_TEST_PG_URL;
      if (!admin) throw new Error("the subject asks for a database: set GALATEA_TEST_PG_URL, or run under conformance/harness/scripts/with-postgres.mjs");
      try {
        p.template = await templateDatabase(admin, migrate, p.report.subject);
      } catch (err) {
        if (!(err instanceof MigrateFailed)) throw err;
        p.report.refused = `${err.message}${err.output.length ? ` (${err.output.join(" | ")})` : ""}`;
        p.report.rows = [];
        return;
      }
    }
    const refusal = await guard(homes.lanes[0]!, p.report.subject, p.spec, p.report.runId, p.template);
    if (refusal) {
      p.report.refused = refusal;
      p.report.rows = [];
      return;
    }
    await body(homes.lanes);
  } catch (err) {
    p.report.harnessFault = describeError(err);
  } finally {
    // Every test has ended and dropped its own clone by now; a clone needs nothing of the template anyway.
    if (p.template) await p.template.drop().catch(() => undefined);
    if (!opts.homes) await homes.close();
    p.report.wallMs = Date.now() - t0;
    if (databaseTimes.creates > db0.creates) {
      p.report.database = { creates: databaseTimes.creates - db0.creates, createMs: databaseTimes.createMs - db0.createMs,
        drops: databaseTimes.drops - db0.drops, dropMs: databaseTimes.dropMs - db0.dropMs };
    }
  }
}

function setRows(rows: Row[], test: RequirementTest, o: Outcome): void {
  for (const row of rows) {
    if (!test.ids.includes(row.id) || row.state === "not_claimed") continue;
    Object.assign(row, { state: o.state, ms: o.ms, evidence: o.evidence, error: o.error, covers: test.opts.covers,
      ...(o.state === "fail" ? { caught: o.caught === true } : {}), ...(o.proposed ? { proposed: o.proposed } : {}),
      ...(o.coverage ? { coverage: o.coverage } : {}) });
  }
}

export async function runSubject(opts: RunOptions): Promise<Report> {
  const p = prepare(opts, "run");
  await withHome(p, opts, (lanes) => onLanes(lanes, p.tests, async (test, lane, i) => {
    const coverage = opts.coverageDir === undefined ? undefined : join(resolve(opts.coverageDir), `t${i + 1}`);
    const o = await runTest(lane, p.report.subject, p.spec, test,
      { runId: p.report.runId, root: `demo/${p.report.runId}/t${i + 1}`, template: p.template, coverage });
    setRows(p.report.rows, test, coverage === undefined ? o : { ...o, coverage: { dir: coverage, ...SubjectProcess.coverageLife(coverage) } });
  }));
  return finish(p.report, { complete: opts.complete });
}

export async function runNegatives(opts: RunOptions): Promise<Report> {
  const p = prepare(opts, "negatives");
  const withSubjects = new Set(p.manifest.filter((r) => r.negative_subjects.length).map((r) => r.id));
  if (!p.report.refused) p.report.rows = p.report.rows.filter((r) => withSubjects.has(r.id));
  const results: NegativeResult[] = [];
  await withHome(p, opts, async (lanes) => {
    const all = opts.tests ?? registered();
    const scopes = new Map<NegativeResult, { scope: Set<string>; brokenTested: string[] }>();
    const jobs: { result: NegativeResult; test: RequirementTest; brokenTested: string[] }[] = [];
    for (const mutation of [...(p.spec.mutations ?? []), ...ENVIRONMENT_MUTATIONS[p.spec.standard]]) {
      const rows = p.manifest.filter((r) => r.negative_subjects.some((s) => s.subject === mutation));
      const broken = rows.map((r) => r.id);
      const coupled = [...new Set(rows.flatMap((r) => r.negative_subjects.filter((s) => s.subject === mutation).flatMap((s) => s.coupled)))];
      const scope = new Set([...broken, ...coupled]);
      const result: NegativeResult = { mutation, broken, coupled, state: "untested", failed: [], detail: "" };
      results.push(result);
      if (!broken.length) {
        Object.assign(result, { state: "fail", detail: "no row of the manifest names this mutation" });
        continue;
      }
      const tests = all.filter((t) => t.opts.seam === p.spec.standard && t.ids.some((id) => scope.has(id)));
      const brokenTested = broken.filter((id) => tests.some((t) => t.ids.includes(id)));
      if (!brokenTested.length) {
        result.detail = `no test for ${broken.join(", ")}`;
        continue;
      }
      scopes.set(result, { scope, brokenTested });
      for (const test of tests) jobs.push({ result, test, brokenTested });
    }
    await onLanes(lanes, jobs, async ({ result, test, brokenTested }, lane, i) => {
      const o = await runTest(lane, p.report.subject, p.spec, test,
        { runId: p.report.runId, root: `demo/${p.report.runId}/t${i + 1}`, mutation: result.mutation, template: p.template });
      // Only a failure of the test's body catches the mutation; a mutation that stops the subject
      // (its setup failed, it did not come back ready) proves nothing about the requirement.
      const into = o.caught ? result.failed : o.state === "fail" ? (result.stopped ??= []) : undefined;
      into?.push(...test.ids.filter((id) => !into.includes(id)));
      if (o.state === "fail") for (const id of test.ids) (result.errors ??= {})[id] ??= o.error ?? "failed";
      // The job's time goes to each tested id its mutation breaks, so the report's slowest line is filled.
      for (const row of p.report.rows) if (brokenTested.includes(row.id)) row.ms = (row.ms ?? 0) + o.ms;
    });
    for (const [result, { scope, brokenTested }] of scopes) {
      const stopped = result.stopped ?? [];
      const disarmed = brokenTested.filter((id) => !result.failed.includes(id) && !stopped.includes(id));
      const outside = result.failed.filter((id) => !scope.has(id));
      result.state = disarmed.length || outside.length || stopped.length ? "fail" : "pass";
      result.detail = [
        stopped.length ? `the mutation stopped the subject in ${stopped.join(", ")}, so it proves nothing there` : "",
        disarmed.length ? `still passes ${disarmed.join(", ")}` : "",
        outside.length ? `also fails ${outside.join(", ")}, outside its coupled ids` : "",
      ].filter(Boolean).join("; ") || `fails ${result.failed.join(", ")} and nothing outside ${[...scope].join(", ")}`;
      for (const row of p.report.rows) if (brokenTested.includes(row.id)) row.state = result.state;
    }
  });
  p.report.negatives = results;
  return finish(p.report, { complete: opts.complete });
}
