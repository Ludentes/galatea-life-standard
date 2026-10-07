// The change-scoped matrix (`--changed <base>`): which mutations a branch can have changed the result
// of, each with its reasons (docs/guides/2026-10-05-how-builds-are-checked.md, *What runs when*).
// Everything here is pure: `scripts/changed.mjs` runs git and reads the files.
//
// A mutation is in scope when:
//   one of its sites is in a changed file (the sites `reach.ts` finds, in the build's sources);
//   a check file of one of its rows' ids changed (the ids it breaks or couples, in the manifest or
//   `proposed-rows.json`, and its known couplings in `known-outside.json`), each id mapped to the
//   harness module that registers its test;
//   its `subject.json` or `proposed-rows.json` entry changed, or it is new;
// and every mutation is, when the change touches the shared harness (`SHARED_HARNESS`).
import { findSites, withoutDeclarations } from "./reach.js";

/**
 * A part of the harness every check runs through: a change to it can move any check's timing or setup,
 * so it puts every mutation in scope. `path` is relative to the package's folder (`BUILD`: the build's
 * own; `REPOSITORY`: the repository's); one ending in `/` (or empty) is a folder.
 */
export interface SharedPath {
  package: string; path: string; why: string;
  /**
   * When a change to it counts: always (unset); only outside the `MUTATIONS` list and `mutationFromEnv`
   * (`declarations`, a build's `mutations.ts`); only in fields other than `mutations` (`fields`, its
   * `subject.json`). The script decides these from the file at the base and now (`conditionalChange`).
   */
  when?: "declarations" | "fields";
}

const HARNESS = "@ludentes/galatea-life-harness";
const SIM = "@ludentes/galatea-life-sim";
/** A shared path in the build's own folder. */
export const BUILD = ".";
/** A shared path in the repository's folder. */
export const REPOSITORY = "/";

/**
 * The shared harness common to every build: the guide's list, then the maintainer's additions
 * (2026-10-07). Additions are the maintainer's to make, each with its reason.
 */
export const SHARED_HARNESS: readonly SharedPath[] = [
  { package: HARNESS, path: "src/home.ts", why: "every check's home: its broker, fixture bridges, seams, database and the subject's start (startOnSeam)" },
  { package: HARNESS, path: "src/runner.ts", why: "the run code: lanes, the template database, each check's start, retry and report" },
  { package: HARNESS, path: "src/reach.ts", why: "the reach code: which checks each mutation runs" },
  { package: HARNESS, path: "scripts/reach.mjs", why: "the reach code: how a clean run's coverage becomes the stored reach" },
  { package: SIM, path: "", why: "the simulation: the fixture bridges and devices, the broker and the severable proxy, the time server" },
  { package: HARNESS, path: "src/subject.ts", why: "starts, waits for and stops every subject, and passes it the coverage environment" },
  { package: HARNESS, path: "src/database.ts", why: "the template database every check's database is cloned from" },
  { package: HARNESS, path: "src/seams/", why: "the seams every check reaches its subject through" },
  { package: "@ludentes/galatea-life-test-clock", path: "", why: "the test clock: every check's time base, in its home" },
  { package: HARNESS, path: "src/ports.ts", why: "the ports every home listens on" },
  { package: HARNESS, path: "src/util.ts", why: "the waits every home and most checks poll with" },
  { package: HARNESS, path: "src/changed.ts", why: "the scope code: which mutations a change puts in scope" },
  { package: HARNESS, path: "scripts/changed.mjs", why: "the scope code: what a change's scope is read from" },
  { package: HARNESS, path: "src/registry.ts", why: "the scope code: the registry's record of each id's check file" },
  { package: BUILD, path: "src/mutations.ts", why: "the build's declaration file: every mutation is switched on through it", when: "declarations" },
  { package: HARNESS, path: "src/cli.ts", why: "the command every run starts through; its imports (interrupt.ts) are shared by the closure" },
  { package: "@ludentes/galatea-life-schemas", path: "", why: "the schemas the subject's spec, the seams and the checks validate against" },
  { package: BUILD, path: "graded-ids.json", why: "the build's graded ids: which ids every mutation is graded on" },
  { package: BUILD, path: "scripts/matrix-verdict.mjs", why: "the build's verdict: how every mutation is graded" },
  { package: BUILD, path: "scripts/full-matrix.mjs", why: "the build's matrix driver: how every mutation is run" },
  { package: BUILD, path: "subject.json", why: "the build's start, database and claims, every field but its mutations", when: "fields" },
  { package: REPOSITORY, path: "pnpm-lock.yaml", why: "the locked dependencies: the broker's and the database's clients move every check's timing" },
];

/** Each build's own shared paths, by its standard, added to the common ones: they never widen another build's. */
export const SHARED_BY_STANDARD: Readonly<Record<string, readonly SharedPath[]>> = {
  steward: [{ package: HARNESS, path: "src/steward-home.ts", why: "the steward's home: the stand-in applier every steward check runs against" }],
};

/** The shared paths of a build of `standard`: the common ones and its own. */
export function sharedFor(standard: string | undefined): SharedPath[] {
  return [...SHARED_HARNESS, ...(standard ? SHARED_BY_STANDARD[standard] ?? [] : [])];
}

/** True when `file` (repository-relative) is under `prefix`: the file itself, or a folder ending in `/` (or the root, ""). */
export function under(file: string, prefix: string): boolean {
  return prefix === "" || prefix.endsWith("/") ? file.startsWith(prefix) : file === prefix;
}

/**
 * True when a conditional shared file changed in a way that counts (`SharedPath.when`): `declarations`,
 * outside the `MUTATIONS` list and `mutationFromEnv`, whitespace aside; `fields`, in a JSON field other
 * than `mutations`. A file missing on one side has changed.
 */
export function conditionalChange(when: "declarations" | "fields", before: string | undefined, after: string | undefined): boolean {
  if (before === undefined || after === undefined) return before !== after;
  if (when === "declarations") {
    const code = (t: string) => withoutDeclarations(t).replace(/\s+/g, " ").trim();
    return code(before) !== code(after);
  }
  const fields = (t: string) => { try { return JSON.stringify({ ...JSON.parse(t), mutations: undefined }); } catch { return t; } };
  return fields(before) !== fields(after);
}

/**
 * The shared paths with the harness modules they import, at any depth: `imports` maps each module of
 * the harness to those it imports. A module under `stop` (the checks) is never added: each is scoped
 * by the ids it registers.
 */
export function sharedClosure(shared: string[], imports: Record<string, string[]>, stop: string): string[] {
  const modules = new Set([...Object.keys(imports), ...Object.values(imports).flat()]);
  const seen = new Set([...modules].filter((f) => shared.some((p) => under(f, p)) && !f.startsWith(stop)));
  for (const f of seen) for (const i of imports[f] ?? []) if (!i.startsWith(stop)) seen.add(i);
  const extra = [...seen].filter((f) => !shared.some((p) => under(f, p))).sort();
  return [...shared, ...extra];
}

/** The changed files that touch the shared harness, given its paths relative to the repository. */
export function sharedHits(changed: string[], shared: string[]): string[] {
  return changed.filter((f) => shared.some((p) => under(f, p)));
}

/** The source of a built module: `<pkg>/dist/x/y.js` is `<pkg>/src/x/y.ts`; any other path is its own. */
export function sourceOfBuilt(file: string): string {
  const m = file.match(/^(.*\/)dist\/(.+)\.js$/);
  return m ? `${m[1]}src/${m[2]}.ts` : file;
}

/**
 * Per mutation, the source files that hold one of its sites. In a declaration file (`mutations.ts`)
 * the `MUTATIONS` list and `mutationFromEnv` are left out, as the lint does.
 */
export function siteFiles(mutations: string[], sources: { file: string; text: string }[],
  declarations: string[] = ["mutations.ts", "mutations.js"]): Record<string, string[]> {
  const names = new Set(mutations);
  const out: Record<string, string[]> = Object.fromEntries(mutations.map((m) => [m, []]));
  for (const f of sources) {
    const text = declarations.some((d) => f.file.endsWith(d)) ? withoutDeclarations(f.text) : f.text;
    for (const s of findSites(f.file, text, names).sites) if (!out[s.mutation]!.includes(f.file)) out[s.mutation]!.push(f.file);
  }
  return out;
}

/** Per mutation, the files of either map: the site files at the base and now, so a removed site counts. */
export function unionSites(a: Record<string, string[]>, b: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const m of new Set([...Object.keys(a), ...Object.keys(b)])) out[m] = [...new Set([...(a[m] ?? []), ...(b[m] ?? [])])];
  return out;
}

/** Per mutation, how many sites the sources hold: as many as the built files, by the lint, and so as the reach. */
export function siteCounts(mutations: string[], sources: { file: string; text: string }[],
  declarations: string[] = ["mutations.ts", "mutations.js"]): Record<string, number> {
  const names = new Set(mutations);
  const out: Record<string, number> = Object.fromEntries(mutations.map((m) => [m, 0]));
  for (const f of sources) {
    const text = declarations.some((d) => f.file.endsWith(d)) ? withoutDeclarations(f.text) : f.text;
    for (const s of findSites(f.file, text, names).sites) out[s.mutation]!++;
  }
  return out;
}

/** A build's mutation files: `subject.json`'s, `proposed-rows.json`'s and `known-outside.json`'s. */
export interface RowFiles {
  subject?: { mutations?: string[] };
  proposed?: { rows?: { mutation: string; breaks: string[]; coupled?: string[]; clause?: string }[] };
  known?: { known?: Record<string, string[]> };
}

/**
 * The modules a source imports by a relative path, as their sources: `./x.js` beside `file` is
 * `<dir>/x.ts`. Package imports are left out.
 */
export function importsOf(file: string, text: string): string[] {
  const dir = file.split("/").slice(0, -1);
  const out: string[] = [];
  for (const m of text.matchAll(/(?:^|\n)\s*(?:import|export)\b[^"';]*?["'](\.{1,2}\/[^"']+)["']/g)) {
    const parts = [...dir];
    for (const seg of m[1]!.replace(/\.js$/, ".ts").split("/")) {
      if (seg === "..") parts.pop();
      else if (seg !== ".") parts.push(seg);
    }
    out.push(parts.join("/"));
  }
  return out;
}

/** `file` and every module it imports, at any depth, through `imports`. */
function closure(file: string, imports: Record<string, string[]>): string[] {
  const seen = new Set([file]);
  for (const f of seen) for (const i of imports[f] ?? []) seen.add(i);
  return [...seen];
}

/** Per mutation, its entry as text: `subject.json` names it, or its `proposed-rows.json` row. Undefined files have none. */
export function entries(files: RowFiles): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of files.subject?.mutations ?? []) out[m] = "subject.json";
  for (const r of files.proposed?.rows ?? []) out[r.mutation] = `proposed-rows.json ${JSON.stringify(r)}`;
  return out;
}

/** Per mutation, its rows of the manifest and its `known-outside.json` entry, each as text. */
export function rowEntries(mutations: string[], manifest: { id: string; negative_subjects?: { subject: string; coupled?: string[]; clause?: string }[] }[],
  files: RowFiles): Record<string, { manifest: string; known: string }> {
  return Object.fromEntries(mutations.map((m) => [m, {
    manifest: JSON.stringify(manifest.flatMap((r) => (r.negative_subjects ?? []).filter((s) => s.subject === m).map((s) => ({ id: r.id, ...s })))),
    known: JSON.stringify(files.known?.known?.[m] ?? []),
  }]));
}

/** Every mutation the build declares: `subject.json`'s, then `proposed-rows.json`'s. */
export function declared(files: RowFiles): string[] {
  return [...(files.subject?.mutations ?? []), ...(files.proposed?.rows ?? []).map((r) => r.mutation)];
}

/**
 * Per mutation, its rows' ids: those its manifest rows (and proposed rows) break, their coupled ids,
 * and the ids `known-outside.json` knows it fails.
 */
export function rowIds(mutations: string[], manifest: { id: string; negative_subjects?: { subject: string; coupled?: string[] }[] }[],
  files: RowFiles): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const m of mutations) {
    const ids = new Set<string>();
    for (const r of manifest) {
      for (const s of r.negative_subjects ?? []) if (s.subject === m) { ids.add(r.id); for (const c of s.coupled ?? []) ids.add(c); }
    }
    for (const p of files.proposed?.rows ?? []) if (p.mutation === m) for (const id of [...p.breaks, ...(p.coupled ?? [])]) ids.add(id);
    for (const id of files.known?.known?.[m] ?? []) ids.add(id);
    out[m] = [...ids];
  }
  return out;
}

export interface ScopeInput {
  /** The changed files, relative to the repository. */
  changed: string[];
  /** Every mutation the build declares now, in order. */
  mutations: string[];
  /** Per mutation, the repository-relative source files that hold a site of it. */
  sites: Record<string, string[]>;
  /** Per mutation, its rows' ids (`rowIds`). */
  rows: Record<string, string[]>;
  /** Per graded id, the repository-relative file that registers its test. */
  checkFiles: Record<string, string>;
  /** Per module of the harness's tests, the modules it imports (`importsOf`): a changed helper reaches the check files that import it. */
  imports?: Record<string, string[]>;
  /** Per mutation, its manifest rows and known couplings (`rowEntries`) at the base and now. */
  rowsBefore?: Record<string, { manifest: string; known: string }>;
  rowsAfter?: Record<string, { manifest: string; known: string }>;
  /** Per mutation, its entry (`entries`) at the base and now. */
  before: Record<string, string>;
  after: Record<string, string>;
  /** The shared harness's paths, relative to the repository. */
  shared: string[];
  /** Conditional shared files that changed in a way that counts (`conditionalChange`), each as it is printed. */
  sharedChanged?: string[];
}

export interface Scoped { mutation: string; reasons: string[] }

/**
 * The scope of a change. `scoped`: the mutations in it, each with its reasons, maybe none. `shared`:
 * every mutation, since the shared harness changed. `unscoped`: every mutation, because the change
 * could not be scoped (`why`).
 */
export interface Scope {
  mode: "scoped" | "shared" | "unscoped";
  why?: string;
  /** The mutations in scope, in declared order. */
  mutations: Scoped[];
  /** How many the build declares. */
  of: number;
  /** The changed files that touch the shared harness. */
  shared: string[];
}

/** Every mutation, unscoped, with why. */
export function unscoped(mutations: string[], why: string): Scope {
  return { mode: "unscoped", why, mutations: mutations.map((mutation) => ({ mutation, reasons: [`unscoped: ${why}`] })), of: mutations.length, shared: [] };
}

/** The mutations a change puts in scope, each with its reasons. */
export function changedScope(o: ScopeInput): Scope {
  const shared = [...sharedHits(o.changed, o.shared), ...(o.sharedChanged ?? [])];
  // Every mutation is in scope when the shared harness changed: no site need be mapped.
  const unmapped = o.mutations.filter((m) => !(o.sites[m] ?? []).length);
  if (unmapped.length && !shared.length) return unscoped(o.mutations, `no site in the sources for ${unmapped.join(", ")}`);
  const changed = new Set(o.changed);
  const out: Scoped[] = [];
  for (const m of o.mutations) {
    const reasons: string[] = [];
    if (shared.length) reasons.push("the shared harness changed");
    for (const f of o.sites[m] ?? []) if (changed.has(f)) reasons.push(`a site in ${f}`);
    const byFile = new Map<string, { ids: string[]; helper: boolean }>();
    for (const id of o.rows[m] ?? []) {
      const own = o.checkFiles[id];
      if (!own) continue;
      for (const f of closure(own, o.imports ?? {})) {
        if (!changed.has(f)) continue;
        const at = byFile.get(f) ?? { ids: [], helper: f !== own };
        at.ids.push(id);
        byFile.set(f, at);
      }
    }
    for (const [f, { ids, helper }] of byFile) reasons.push(`${helper ? "a helper of " : ""}the check file of ${ids.join(", ")} (${f})`);
    if (!(m in o.before)) reasons.push("a new mutation");
    else {
      if (o.before[m] !== o.after[m]) reasons.push(`its ${o.after[m]!.split(" ")[0]} entry changed`);
      const was = o.rowsBefore?.[m];
      const is = o.rowsAfter?.[m];
      if (was && is && was.manifest !== is.manifest) reasons.push("its manifest row changed");
      if (was && is && was.known !== is.known) reasons.push("its known-outside.json entry changed");
    }
    if (reasons.length) out.push({ mutation: m, reasons });
  }
  return { mode: shared.length ? "shared" : "scoped", mutations: out, of: o.mutations.length, shared };
}

/**
 * `scope` with the mutations whose sites `reach` does not hold as many as the sources do made
 * unscoped: a store with no reach of this build's sites cannot be trusted to map them.
 */
export function checkedAgainstReach(scope: Scope, sources: Record<string, number>, reachSites: Record<string, unknown[]> | undefined,
  mutations: string[]): Scope {
  if (scope.mode === "unscoped") return scope;
  if (!reachSites) return unscoped(mutations, "the store holds no reach for this build");
  const off = mutations.filter((m) => (reachSites[m]?.length ?? 0) !== (sources[m] ?? 0));
  return off.length ? unscoped(mutations, `the reach's sites do not match the sources for ${off.join(", ")}`) : scope;
}

/**
 * The mutations a matrix runs: those declared, within `--only` when given, within the scope when
 * given. `--changed` with `--full` is refused by the driver, not here.
 */
export function selectMutations(o: { declared: string[]; only?: string[]; scope?: Scope }): string[] {
  // Unscoped, every mutation runs, whatever the scope lists (it may list none when nothing could be read).
  const inScope = o.scope && o.scope.mode !== "unscoped" && new Set(o.scope.mutations.map((s) => s.mutation));
  return o.declared.filter((m) => (!o.only || o.only.includes(m)) && (!inScope || inScope.has(m)));
}

/** What the matrix prints of the scope before it runs: the mode, then each mutation in scope with its reasons. */
export function scopeLines(scope: Scope, base: string, only?: string[]): string[] {
  const head = scope.mode === "unscoped"
    ? `Scope: the change against ${base} cannot be scoped (${scope.why}), so every mutation runs, by reach.`
    : scope.mode === "shared"
      ? `Scope: the change against ${base} touches the shared harness (${scope.shared.join(", ")}), so every mutation is in scope.`
      : scope.mutations.length
        ? `Scope: the change against ${base} puts ${scope.mutations.length} of ${scope.of} mutations in scope.`
        : `Scope: the change against ${base} touches no mutation's site, rows' check file or entry, nor the shared harness: `
          + "no mutation is in scope, and the run is the clean run only.";
  const lines = [head];
  if (scope.mode !== "unscoped") for (const s of scope.mutations) lines.push(`  ${s.mutation}: ${s.reasons.join("; ")}`);
  if (only) {
    const left = selectMutations({ declared: scope.mutations.map((s) => s.mutation), only });
    lines.push(`  With --only, ${left.length} of them run: ${left.join(", ") || "none"}.`);
  }
  return lines;
}

/** The pass line's scope clause: "scoped to the change against <base>: N of M mutations", or why every one ran. */
export function scopeClause(scope: Scope, base: string, ran: number): string {
  return scope.mode === "unscoped"
    ? `not scoped to the change against ${base} (${scope.why}): ${ran} of ${scope.of} mutations`
    : `scoped to the change against ${base}: ${ran} of ${scope.of} mutations`;
}

/**
 * The scope once the clean run's reach is in (`checkedAgainstReach`): the mutations the matrix runs,
 * and, when the scope gave up, its new lines to print.
 */
export function afterReach(o: { scope: Scope; siteCounts: Record<string, number>; reachSites: Record<string, unknown[]> | undefined;
  declared: string[]; only?: string[]; base: string }): { scope: Scope; mutations: string[]; lines: string[] } {
  const scope = checkedAgainstReach(o.scope, o.siteCounts, o.reachSites, o.declared);
  return { scope, mutations: selectMutations({ declared: o.declared, only: o.only, scope }),
    lines: scope === o.scope ? [] : scopeLines(scope, o.base, o.only) };
}

/** The matrix's pass line: full, skipping by reach, or scoped to a change (the clean run only when no mutation ran). */
export function passLine(o: { full: boolean; scope?: Scope; base?: string; runs: number; ids: number; graded: number }): string {
  if (o.full) {
    return `The full matrix passes: ${o.runs} runs against ${o.ids} graded ids; every mutation caught in its row, no new failure outside one.`;
  }
  const scoped = o.scope ? `${scopeClause(o.scope, o.base ?? "", o.graded)}, ` : "";
  if (o.scope && !o.graded) return `The matrix passes, ${scopeClause(o.scope, o.base ?? "", 0)}: the clean run only, against ${o.ids} graded ids.`;
  return `The matrix passes, ${scoped}skipping by reach: ${o.runs} runs against ${o.ids} graded ids; every mutation caught in its row, `
    + "no new failure outside one among the ids it ran.";
}
