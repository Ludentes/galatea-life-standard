// Reads what a reach is made of and writes it: a build's sources and built files, a covered clean
// run's report and coverage, the stored reach of the same build. The reach itself is `dist/reach.js`'s,
// which is pure. Used by the reference builds' drivers (`--reach <store>`); see
// docs/plans/2026-10-06-harness-reach.md.
import { createHash } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync }
  from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { findSites, lint, measureReach, misses, perMutation, reachMarkdown, unionReach, withoutDeclarations } from "../dist/reach.js";

/** The files under `dir` ending in `ext`, but declarations, sorted. */
function walk(dir, ext) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name), ext)
    : e.name.endsWith(ext) && !e.name.endsWith(".d.ts") ? [join(dir, e.name)] : [])).sort();
}

const read = (file) => ({ file, text: readFileSync(file, "utf8") });

/** A hash of the build's `dist` JavaScript, path and content: a reach holds for one build only. */
export function buildHash(buildDir) {
  const h = createHash("sha256");
  for (const f of walk(join(buildDir, "dist"), ".js")) h.update(relative(buildDir, f)).update("\0").update(readFileSync(f)).update("\0");
  return h.digest("hex");
}

/** Per mutation, the ids its rows break (`own`) and their coupled ids (`coupled`), from a manifest (proposed rows included). */
export function ownRows(manifest, mutations) {
  const named = (m) => manifest.filter((r) => r.negative_subjects.some((s) => s.subject === m));
  return {
    own: Object.fromEntries(mutations.map((m) => [m, named(m).map((r) => r.id)])),
    coupled: Object.fromEntries(mutations.map((m) => [m, [...new Set(named(m).flatMap((r) => r.negative_subjects
      .filter((s) => s.subject === m).flatMap((s) => s.coupled ?? [])))]])),
  };
}

/**
 * The scripts of the build's `dist` in every coverage file of `dir`, their URLs as paths, and how many
 * of the files hold `entry`: one per instance that wrote coverage.
 */
function coverageOf(dir, dist, entry) {
  if (!existsSync(dir)) return { scripts: [], written: 0 };
  let written = 0;
  const scripts = readdirSync(dir).filter((f) => f.startsWith("coverage-") && f.endsWith(".json")).flatMap((f) => {
    const mine = JSON.parse(readFileSync(join(dir, f), "utf8")).result
      .filter((s) => s.url.startsWith("file://"))
      .map((s) => ({ file: fileURLToPath(s.url), functions: s.functions }))
      .filter((s) => s.file.startsWith(dist));
    if (mine.some((s) => s.file === entry)) written++;
    return mine;
  });
  return { scripts, written };
}

/** The stored reach in `file`, or undefined with a warning when it is missing or cannot be read. */
function stored(file, warnings) {
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    warnings.push(`the stored reach ${file} cannot be read (${err.message}); it counts as empty`);
    return undefined;
  }
}

/** How long a merge waits for another to release the store before it gives up. */
const LOCK_WAIT_MS = 120_000;

const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** True while process `pid` lives (EPERM: it lives, under another user). */
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}

/**
 * Runs `fn` holding `<file>.lock`, made exclusively (`wx`) with this process's pid in it: two
 * matrices, in two heavy slots or two worktrees, merge into one store one at a time, so neither loses
 * the other's pairs. A lock whose pid no longer lives is taken over; a live one is waited for, up
 * to `waitMs`.
 */
export function withLock(file, fn, waitMs = LOCK_WAIT_MS) {
  const lock = `${file}.lock`;
  const t0 = Date.now();
  for (;;) {
    try {
      const fd = openSync(lock, "wx");
      writeFileSync(fd, `${process.pid}\n`);
      closeSync(fd);
      break;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
    }
    let holder = 0;
    try { holder = Number(readFileSync(lock, "utf8").trim()); } catch { continue; }
    // A pid of 0 is a lock being made: its pid is not written yet.
    if (holder && !alive(holder)) {
      try { unlinkSync(lock); } catch { /* another merge took it over first */ }
      continue;
    }
    if (Date.now() - t0 > waitMs) throw new Error(`the reach store ${file} stayed locked for ${waitMs} ms by pid ${holder} (${lock})`);
    sleepSync(50);
  }
  try {
    return fn();
  } finally {
    try { unlinkSync(lock); } catch { /* gone already */ }
  }
}

/** Writes `file` whole or not at all: a temporary file beside it, renamed over it. */
function writeAtomic(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

/**
 * The reach of a covered clean run, added to the stored reach (`<store>/<standard>.json`), written to
 * the store and to `out` (`reach.json`, `reach.md`). The store carries observed pairs across builds
 * (`unionReach`); `reset` (a full matrix) stores this run alone. With lint problems nothing is stored
 * and only the report is written. Returns the reach, its report, its misses, the store's file and any
 * warnings.
 */
export function collectReach({ buildDir, report, store, out, mutations, own, coupled, known, history, commit, entry = "main.js",
  declarations = ["mutations.ts", "mutations.js"], reset = false, mergeDelayMs = 0 }) {
  const warnings = [];
  const build = realpathSync(buildDir);
  const dist = join(build, "dist") + "/";
  const built = walk(join(build, "dist"), ".js").map(read);
  const problems = lint({ mutations, sources: walk(join(build, "src"), ".ts").map(read), built, declarations });
  const names = new Set(mutations);
  const own_ = (f) => (declarations.some((d) => f.file.endsWith(d)) ? withoutDeclarations(f.text) : f.text);
  const sites = built.flatMap((f) => findSites(f.file, own_(f), names).sites);
  const entryFile = join(dist, entry);
  const texts = Object.fromEntries(built.map((f) => [f.file, f.text]));
  const byDir = new Map();
  for (const row of report.rows) {
    if (!row.coverage) continue;
    const c = byDir.get(row.coverage.dir) ?? { ids: [], launches: row.coverage.launches, signalled: row.coverage.signalled, dir: row.coverage.dir };
    c.ids.push(row.id);
    byDir.set(row.coverage.dir, c);
  }
  const checks = [...byDir.values()].map(({ dir, ...c }) => ({ ...c, ...coverageOf(dir, dist, entryFile) }));
  const hash = buildHash(build);
  let reach = measureReach({ build: hash, commit, mutations, sites, texts, entry: entryFile, checks, lint: problems });
  mkdirSync(out, { recursive: true });
  const file = join(store, `${report.standard}.json`);
  if (!problems.length) {
    mkdirSync(store, { recursive: true });
    const measured = reach;
    reach = withLock(file, () => {
      const before = reset ? undefined : stored(file, warnings);
      const merged = before ? unionReach(before, measured, mutations) : measured;
      // A test's seam: hold the store between the read and the write, to show the lock serialises merges.
      if (mergeDelayMs) sleepSync(mergeDelayMs);
      writeAtomic(file, `${JSON.stringify(merged, null, 2)}\n`);
      return merged;
    });
    writeFileSync(join(out, "reach.json"), `${JSON.stringify(reach, null, 2)}\n`);
  }
  const expected = { own, coupled, known, history };
  const md = reachMarkdown(reach, mutations, expected);
  writeFileSync(join(out, "reach.md"), md);
  return { reach, md, misses: misses(reach, expected), perMutation: perMutation(reach, mutations), file: problems.length ? undefined : file,
    problems, warnings };
}
