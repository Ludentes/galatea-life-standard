// Each mutation's reach: the checks whose clean run evaluated one of the mutation's sites, from V8
// coverage of a `run --coverage` (the subject-lifecycle design, *The matrix's own structure: reach*).
// Everything here is pure: the caller reads the sources, the coverage files and the report.
//
// A site is a direct comparison of the mutation, as built: `<x>.mutation === "<name>"` or `!==`, or
// a local alias of it. A build reads its mutation only through such comparisons (the lint), so a
// check whose clean run evaluated none of a mutation's sites runs the same code under it, timing apart.

/** A mutation site in a built file: the offset of its string literal, which V8's ranges are in. */
export interface Site {
  mutation: string;
  file: string;
  offset: number;
  line: number;
  column: number;
}

export interface V8Range { startOffset: number; endOffset: number; count: number }
export interface V8Function { functionName: string; ranges: V8Range[] }
/** One script of one coverage file, its URL already a file path. */
export interface ScriptCoverage { file: string; functions: V8Function[] }

/** One check of a covered run: its ids, its coverage, and what the runner counted of its subjects. */
export interface CheckCoverage {
  ids: string[];
  launches: number;
  signalled: number;
  /** Every script of every coverage file the check's subjects wrote. */
  scripts: ScriptCoverage[];
  /**
   * How many of its coverage files hold the entry module: one per instance that wrote coverage. Fewer
   * than its launches less its signalled ends means coverage was lost unseen (a wrapper, a kill after
   * its copy, a failed start): the check is class P.
   */
  written?: number;
}

/** Where a site sits: code run once at start-up (the module's top level, a constructor, a field initialiser) or a function. */
export type SiteScope = "top" | "constructor" | "initialiser" | "function" | "unknown";

export interface Reach {
  /** A hash of the build's `dist`: reaches are added together only within one build. */
  build: string;
  /** The commits whose clean runs this reach adds together. */
  commits: string[];
  /** The builds whose observed pairs it carries (`unionReach`), the latest last; absent for one run's. */
  builds?: string[];
  /** The clean runs added together. */
  runs: number;
  sites: Record<string, { file: string; line: number; column: number; scope: SiteScope }[]>;
  /** The ids each check grades, in the order of the latest run. */
  checks: string[][];
  /** Per id, the mutations a site of which its clean run evaluated: coverage alone. */
  observed: Record<string, string[]>;
  guards: {
    /** Ids a check of which lost an instance to a signal or launched none, with why: in reach of every mutation. */
    classP: Record<string, string>;
    /** Mutations with a site run at start-up (in `entry`, at a module's top level, in a constructor or a field initialiser): reach every check. */
    startup: string[];
    /** The lint's problems; a reach is written only without any. */
    lint: string[];
  };
  /** Per id, the mutations in its reach once the guards are applied: what a skipping matrix would run it under. */
  reach: Record<string, string[]>;
}

function lineColumn(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset);
  const line = before.split("\n").length;
  return { line, column: offset - before.lastIndexOf("\n") };
}

/** Literals naming a mutation, with the text before each: `"name"` or `'name'`. */
function literals(text: string, names: ReadonlySet<string>): { name: string; offset: number; before: string }[] {
  const out: { name: string; offset: number; before: string }[] = [];
  for (const m of text.matchAll(/(["'])([a-z0-9]+(?:-[a-z0-9]+)+)\1/g)) {
    if (!names.has(m[2]!)) continue;
    out.push({ name: m[2]!, offset: m.index!, before: text.slice(Math.max(0, m.index! - 80), m.index!) });
  }
  return out;
}

/** The mutation-reading expression a direct comparison ends in: `x.mutation`, `mutation`, or an alias. */
const COMPARED = /(?:^|[^\w.?])((?:[\w$]+(?:\??\.))*([\w$]+))\s*[!=]==\s*$/;

/** The aliases a file declares for its mutation: `const m = this.o.mutation;`. */
export function aliases(text: string): string[] {
  return [...text.matchAll(/\b(?:const|let)\s+([\w$]+)\s*=\s*(?:[\w$]+\??\.)*mutation\s*;/g)].map((m) => m[1]!);
}

/**
 * The sites of a built (or source) file: every literal naming a mutation that is a direct comparison
 * of the mutation. Any other literal naming one is a problem.
 */
export function findSites(file: string, text: string, names: ReadonlySet<string>): { sites: Site[]; problems: string[] } {
  const readers = new Set(["mutation", ...aliases(text)]);
  const sites: Site[] = [];
  const problems: string[] = [];
  for (const l of literals(text, names)) {
    const m = l.before.match(COMPARED);
    const at = lineColumn(text, l.offset);
    if (m && readers.has(m[2]!)) sites.push({ mutation: l.name, file, offset: l.offset, ...at });
    else problems.push(`${file}:${at.line}: "${l.name}" is not a direct comparison of the mutation`);
  }
  return { sites, problems };
}

/**
 * `text` with the contents of its comments and string literals blanked (the same length, quotes
 * kept), and a template's literal text blanked but its `${…}` kept: what the lint reads as code.
 */
export function codeOf(text: string): string {
  const out = text.split("");
  const blank = (i: number) => { if (out[i] !== "\n") out[i] = " "; };
  let i = 0;
  const templates: number[] = [];
  let depth = 0;
  while (i < text.length) {
    const c = text[i]!;
    const n = text[i + 1];
    if (templates.length && templates[templates.length - 1] === depth && c === "}") { templates.pop(); i++; inTemplate(); continue; }
    if (c === "/" && n === "/") { while (i < text.length && text[i] !== "\n") blank(i++); continue; }
    if (c === "/" && n === "*") { const e = text.indexOf("*/", i + 2); const stop = e < 0 ? text.length : e + 2; while (i < stop) blank(i++); continue; }
    if (c === '"' || c === "'") {
      i++;
      while (i < text.length && text[i] !== c && text[i] !== "\n") { if (text[i] === "\\") blank(i++); blank(i++); }
      i++;
      continue;
    }
    if (c === "`") { i++; inTemplate(); continue; }
    if (c === "{") depth++;
    if (c === "}") depth--;
    i++;
  }
  return out.join("");
  /** Blanks a template's text from `i` to its end or its next `${`, which it enters. */
  function inTemplate(): void {
    while (i < text.length) {
      if (text[i] === "\\") { blank(i++); blank(i++); continue; }
      if (text[i] === "`") { i++; return; }
      if (text[i] === "$" && text[i + 1] === "{") { i += 2; templates.push(depth); return; }
      blank(i++);
    }
  }
}

/** The offset of the bracket closing the one at `open` in `code`, or -1. */
function closing(code: string, open: number): number {
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const stack: string[] = [];
  for (let i = open; i < code.length; i++) {
    const c = code[i]!;
    if (c in pairs) stack.push(pairs[c]!);
    else if (c === ")" || c === "]" || c === "}") { if (stack.pop() !== c) return -1; if (!stack.length) return i; }
  }
  return -1;
}

/**
 * A declaration file (`mutations.ts`) with its `MUTATIONS` list and its `mutationFromEnv` blanked:
 * the only places a build may name every mutation, or read `GALATEA_MUTATION`. The rest of it is
 * linted as any file.
 */
export function withoutDeclarations(text: string): string {
  const code = codeOf(text);
  let out = text;
  const blankSpan = (from: number, to: number) => { out = out.slice(0, from) + out.slice(from, to).replace(/[^\n]/g, " ") + out.slice(to); };
  for (const re of [/\bexport\s+const\s+MUTATIONS\s*=\s*\[/, /\bexport\s+function\s+mutationFromEnv\s*\(/]) {
    const m = re.exec(code);
    if (!m) continue;
    const open = re.source.endsWith("\\[") ? m.index + m[0].length - 1 : code.indexOf("{", closing(code, m.index + m[0].length - 1));
    const end = closing(code, open);
    if (end > 0) blankSpan(m.index, end + 1);
  }
  return out;
}

/** The names a build declares, whose calls may be given the mutation: functions and classes. */
export function declaredNames(texts: string[]): Set<string> {
  const names = new Set<string>();
  for (const t of texts) for (const m of codeOf(t).matchAll(/\b(?:function\*?|class)\s+([\w$]+)/g)) names.add(m[1]!);
  return names;
}

const PATH = String.raw`(?:[\w$]+\??\.)*`;

/**
 * Every read of the mutation that is not one of the allowed forms, as problems. The lint is an
 * allowlist: a read of `mutation` (any member path ending in it) or of a local alias is allowed only
 *   as a direct comparison with a mutation's name (`x.mutation === "name"`, `!==`), a site;
 *   in a type (`mutation?: Mutation`) or as an object key;
 *   copied whole into a field or an alias (`this.mutation = o.mutation;`, `const m = this.o.mutation;`),
 *   or taken from the environment (`const mutation = mutationFromEnv(env);`);
 *   narrowed by a site (`const mutation = x.mutation === "name" ? undefined : x.mutation;`);
 *   or passed on whole: as an argument of a function or class this build declares, or as the value of
 *   a `mutation` key (or a shorthand) in an object literal that no call to other code is given.
 * A holder of the mutation (an `x` in `x.mutation`) may be spread only into such an object literal,
 * and never stringified. `GALATEA_MUTATION` is read nowhere but `mutationFromEnv`. Destructuring,
 * indexing, `in`, a method or property of it, a truth test, a loose or reversed comparison: each is a
 * problem.
 */
export function mutationReads(file: string, text: string, callees: ReadonlySet<string>): string[] {
  const code = codeOf(text);
  const problems: string[] = [];
  const at = (offset: number) => lineColumn(text, offset).line;
  const lineOf = (offset: number) => text.slice(text.lastIndexOf("\n", offset - 1) + 1, text.indexOf("\n", offset) < 0 ? undefined : text.indexOf("\n", offset)).trim();
  const fail = (offset: number, why: string) => problems.push(`${file}:${at(offset)}: ${why}: ${lineOf(offset)}`);
  /** The unmatched bracket before `offset`, or -1. */
  const opener = (offset: number): number => {
    let depth = 0;
    for (let i = offset - 1; i >= 0; i--) {
      const c = code[i]!;
      if (c === ")" || c === "]" || c === "}") depth++;
      else if (c === "(" || c === "[" || c === "{") { if (depth === 0) return i; depth--; }
    }
    return -1;
  };
  const prevChar = (offset: number) => code.slice(0, offset).trimEnd().slice(-1);
  const nextChar = (offset: number) => code.slice(offset).trimStart()[0];
  /** True when the call that opens at `paren` is to a function or class this build declares. */
  const declaredCall = (paren: number) => {
    const m = code.slice(0, paren).match(/(?:new\s+)?([\w$]+)\s*$/);
    return m !== null && callees.has(m[1]!);
  };
  /** True when the braces opening at `brace` are a destructuring pattern, `const { mutation } = x`: a read. */
  const destructuring = (brace: number): boolean => {
    const close = closing(code, brace);
    return /\b(?:const|let|var)\s*$/.test(code.slice(0, brace)) || (close > 0 && /^\s*=(?![=>])/.test(code.slice(close + 1)));
  };
  /** True when the object literal opening at `brace` is not an argument of a call to code this build does not declare. */
  const literalKept = (brace: number): boolean => {
    const p = opener(brace);
    if (p < 0 || code[p] !== "(" || !["(", ","].includes(prevChar(brace))) return true;
    return declaredCall(p);
  };
  /**
   * True when the expression from `from` to `to` is a whole argument of a declared call, or the whole
   * value of a `mutation` key (or a shorthand) in an object literal that no undeclared call is given.
   */
  const passedOn = (from: number, to: number): boolean => {
    const o = opener(from);
    if (o < 0) return false;
    const before = prevChar(from);
    const after = nextChar(to);
    if (code[o] === "(") return (before === "(" || before === ",") && (after === ")" || after === ",") && declaredCall(o);
    if (code[o] !== "{") return false;
    const keyed = /\bmutation\s*:\s*$/.test(code.slice(0, from));
    if (code[o - 1] === "$") return false;
    const shorthand = code.slice(from, to) === "mutation" && (before === "{" || before === ",") && (after === "}" || after === ",");
    if (!(keyed || shorthand) || !(after === "}" || after === ",")) return false;
    // A destructuring pattern reads the mutation out: not a literal.
    return !destructuring(o) && literalKept(o);
  };
  const aliasNames = new Set<string>();
  const readers = (name: string) => new RegExp(String.raw`(?<![\w$.])(${PATH})(${name})(?![\w$])`, "g");
  const check = (name: string, isAlias: boolean) => {
    for (const m of code.matchAll(readers(name))) {
      const start = m.index!;
      const end = start + m[0].length;
      const tail = code.slice(end);
      const head = code.slice(0, start);
      const lineHead = head.slice(head.lastIndexOf("\n") + 1);
      // A site: compared, as built, with a literal (findSites names a literal that is not a mutation's).
      if (/^\s*(?:===|!==)\s*["']/.test(tail)) continue;
      if (isAlias) {
        if (/\b(?:const|let)\s+$/.test(lineHead) && m[1] === "") continue;
        fail(start, `the alias ${name} is read other than by a direct comparison`);
        continue;
      }
      // An object key or a typed field, parameter or property: a name, not a read.
      if (m[1] === "" && /^\s*\??:\s*Mutation\b/.test(tail)) continue;
      if (m[1] === "" && /^\s*\??:/.test(tail) && (["{", ",", "(", ";"].includes(prevChar(start)) || /^\s*(?:readonly\s+)?$/.test(lineHead))) {
        const o = opener(start);
        if (!(o >= 0 && code[o] === "{" && destructuring(o))) continue;
      }
      // Copied whole into a field or an alias, or from the environment.
      if (/^this\.$/.test(m[1]!) && new RegExp(String.raw`^\s*=\s*${PATH}mutation\s*;`).test(tail)) continue;
      if (/(?:\bthis\.mutation|\b(?:const|let)\s+[\w$]+)\s*=\s*$/.test(lineHead) && /^\s*;/.test(tail)) {
        const a = lineHead.match(/\b(?:const|let)\s+([\w$]+)\s*=\s*$/)?.[1];
        if (a && a !== "mutation") aliasNames.add(a);
        continue;
      }
      if (m[1] === "" && /\b(?:const|let)\s+$/.test(lineHead) && /^\s*=\s*mutationFromEnv\(/.test(tail)) continue;
      // Narrowed by a site: `const mutation = x.mutation === "name" ? undefined : x.mutation;`, both reads.
      const narrowed = new RegExp(String.raw`\b(?:const|let)\s+mutation\s*=\s*${PATH}mutation\s*(?:===|!==)\s*["'][^"'\n]*["']\s*\?\s*undefined\s*:\s*${PATH}mutation\s*;`);
      const lineEnd = code.indexOf("\n", start);
      if (narrowed.test(code.slice(head.lastIndexOf("\n") + 1, lineEnd < 0 ? undefined : lineEnd))) continue;
      if (passedOn(start, end)) continue;
      fail(start, "the mutation is read other than by a direct comparison or passed on whole to this build's code");
    }
  };
  check("mutation", false);
  for (const a of aliasNames) check(a, true);
  // Holders: spread only into an object literal that no undeclared call is given; never stringified.
  const holders = new Set([...code.matchAll(new RegExp(String.raw`(?<![\w$.])(${PATH}[\w$]+)\??\.mutation\b`, "g"))].map((m) => m[1]!));
  for (const h of holders) {
    const x = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const m of code.matchAll(new RegExp(String.raw`JSON\.stringify\(\s*${x}(?![\w$.])`, "g"))) fail(m.index!, `${h}, which holds the mutation, is stringified`);
    for (const m of code.matchAll(new RegExp(String.raw`\.\.\.${x}(?![\w$.])`, "g"))) {
      const o = opener(m.index!);
      if (!(o >= 0 && code[o] === "{" && literalKept(o))) fail(m.index!, `${h}, which holds the mutation, is spread into a call to code this build does not declare`);
    }
  }
  for (const m of code.matchAll(/\bGALATEA_MUTATION\b/g)) fail(m.index!, "GALATEA_MUTATION is read outside mutationFromEnv");
  return problems;
}

/**
 * The lint over a build's sources and its built files: every mutation has a site in both, as many in
 * each; every literal naming one is a direct comparison; the mutation is read only in the forms
 * `mutationReads` allows. In `declarations` (the files that list the mutations and read the
 * environment) the `MUTATIONS` list and `mutationFromEnv` are left out, and the rest is linted.
 */
export function lint(o: { mutations: string[]; sources: { file: string; text: string }[]; built: { file: string; text: string }[];
  declarations: string[] }): string[] {
  const names = new Set(o.mutations);
  const problems: string[] = [];
  const own = (f: { file: string; text: string }) => (o.declarations.some((d) => f.file.endsWith(d)) ? withoutDeclarations(f.text) : f.text);
  const callees = declaredNames(o.sources.map((f) => f.text));
  const count = (files: { file: string; text: string }[], into?: string[]) => {
    const n = new Map<string, number>();
    for (const f of files) {
      const text = own(f);
      const { sites, problems: p } = findSites(f.file, text, names);
      if (into) into.push(...p, ...mutationReads(f.file, text, callees));
      for (const s of sites) n.set(s.mutation, (n.get(s.mutation) ?? 0) + 1);
    }
    return n;
  };
  const inSource = count(o.sources, problems);
  const inBuilt = count(o.built);
  for (const m of o.mutations) {
    if (!inSource.get(m)) problems.push(`${m} has no site in the sources`);
    else if (inSource.get(m) !== inBuilt.get(m)) problems.push(`${m} has ${inSource.get(m)} sites in the sources and ${inBuilt.get(m) ?? 0} built`);
  }
  return problems;
}

/** The innermost range around `offset` among `functions`, or undefined when none holds it. */
function innermost(functions: V8Function[], offset: number): V8Range | undefined {
  let best: V8Range | undefined;
  for (const f of functions) {
    for (const r of f.ranges) {
      if (r.startOffset <= offset && offset < r.endOffset && (!best || r.endOffset - r.startOffset < best.endOffset - best.startOffset)) best = r;
    }
  }
  return best;
}

/** True when the check's coverage counts the site as evaluated in any of its scripts. */
export function reached(site: Site, scripts: ScriptCoverage[]): boolean {
  return scripts.some((s) => s.file === site.file && (innermost(s.functions, site.offset)?.count ?? 0) > 0);
}

/**
 * Where a site sits, from the function ranges of any coverage of its file: the innermost function
 * around it is the script itself (top), a constructor, a field initialiser, or another function.
 */
export function scopeOf(site: Site, text: string, scripts: ScriptCoverage[]): SiteScope {
  let best: { f: V8Function; r: V8Range } | undefined;
  for (const s of scripts) {
    if (s.file !== site.file) continue;
    for (const f of s.functions) {
      const r = f.ranges[0];
      if (r && r.startOffset <= site.offset && site.offset < r.endOffset && (!best || r.endOffset - r.startOffset < best.r.endOffset - best.r.startOffset)) best = { f, r };
    }
  }
  if (!best) return "unknown";
  if (best.r.startOffset === 0 && best.f.functionName === "") return "top";
  if (/^<(instance_members|static)_initializer>$/.test(best.f.functionName)) return "initialiser";
  if (/^constructor\s*\(/.test(text.slice(best.r.startOffset))) return "constructor";
  return "function";
}

/**
 * The reach of one covered clean run. A check that lost an instance to a signal (a SIGKILL: its
 * coverage is missing), or whose subject never launched, is in reach of every mutation (class P, as
 * ruled 2026-10-06; a restart on SIGTERM writes both instances' coverage and is measured like any
 * check), as is every check for a mutation with a site run at start-up
 * (in `entry`, at a module's top level, in a constructor or a field initialiser).
 */
export function measureReach(o: { build: string; commit: string; mutations: string[]; sites: Site[]; texts: Record<string, string>;
  /** The entry module's path, as the sites' files are named (`<dist>/main.js`). */
  entry: string; checks: CheckCoverage[]; lint: string[] }): Reach {
  const all = o.checks.flatMap((c) => c.scripts);
  const scopes = new Map(o.sites.map((s) => [s, s.file === o.entry ? "top" as SiteScope : scopeOf(s, o.texts[s.file] ?? "", all)]));
  const sites: Reach["sites"] = {};
  for (const m of o.mutations) sites[m] = [];
  for (const s of o.sites) (sites[s.mutation] ??= []).push({ file: s.file, line: s.line, column: s.column, scope: scopes.get(s)! });
  // A site no coverage holds is in a module no check loaded: it reaches nothing, and is not wired at start-up.
  const startup = o.mutations.filter((m) => o.sites.some((s) => s.mutation === m && ["top", "constructor", "initialiser"].includes(scopes.get(s)!)));
  const observed: Record<string, string[]> = {};
  const classP: Record<string, string> = {};
  for (const c of o.checks) {
    const hit = [...new Set(o.sites.filter((s) => reached(s, c.scripts)).map((s) => s.mutation))];
    const lost = c.written !== undefined && c.written < c.launches - c.signalled;
    const why = [c.signalled ? `${c.signalled} ended on a signal` : "",
      lost ? `${c.written} of ${c.launches - c.signalled} instances wrote coverage` : "",
      c.launches === 0 ? "no subject launched" : ""].filter(Boolean).join(", ");
    for (const id of c.ids) {
      const seen = new Set([...(observed[id] ?? []), ...hit]);
      observed[id] = o.mutations.filter((m) => seen.has(m));
      if (why) classP[id] = why;
    }
  }
  const reach: Reach = { build: o.build, commits: [o.commit], runs: 1, sites, checks: o.checks.map((c) => c.ids), observed,
    guards: { classP, startup, lint: o.lint }, reach: {} };
  return withGuards(reach, o.mutations);
}

/** `r` with `reach` recomputed from its coverage and its guards. */
export function withGuards(r: Reach, mutations: string[]): Reach {
  const reach: Record<string, string[]> = {};
  for (const id of r.checks.flat()) {
    reach[id] = id in r.guards.classP ? [...mutations]
      : mutations.filter((m) => r.guards.startup.includes(m) || (r.observed[id] ?? []).includes(m));
  }
  return { ...r, reach };
}

/**
 * A stored reach and a new clean run's added together. Within one build the class P checks add up
 * too. Across builds (the controller's ruling on the reach preflight's I1, 2026-10-06) the observed
 * (mutation, id) pairs are carried forward, for the mutations still declared and the ids still
 * graded, since a branch only some timing takes is reached in some runs only; the build's sites,
 * start-up mutations and class P checks are the new run's. A full matrix resets the carry by storing
 * its run alone.
 */
export function unionReach(a: Reach, b: Reach, mutations: string[]): Reach {
  const same = a.build === b.build;
  const graded = new Set(b.checks.flat());
  const observed: Record<string, string[]> = {};
  for (const id of graded) {
    const seen = new Set([...(a.observed[id] ?? []), ...(b.observed[id] ?? [])]);
    observed[id] = mutations.filter((m) => seen.has(m));
  }
  const classP = same ? Object.fromEntries(Object.entries({ ...a.guards.classP, ...b.guards.classP }).filter(([id]) => graded.has(id)))
    : b.guards.classP;
  const startup = same ? mutations.filter((m) => a.guards.startup.includes(m) || b.guards.startup.includes(m)) : b.guards.startup;
  return withGuards({ ...b, commits: [...new Set([...a.commits, ...b.commits])], runs: a.runs + b.runs,
    builds: [...new Set([...(a.builds ?? [a.build]), ...(b.builds ?? [b.build])])], observed,
    guards: { classP, startup, lint: b.guards.lint } }, mutations);
}

/**
 * What a reach is checked against: the ids each mutation's rows break (which it must fail), their
 * coupled ids (which it may fail), its known couplings, and the ids it failed in earlier matrices.
 */
export interface Expected { own: Record<string, string[]>; coupled?: Record<string, string[]>; known: Record<string, string[]>;
  history?: Record<string, string[]> }

export type MissSource = "own" | "coupled" | "known" | "history";

/**
 * Each expected id outside its mutation's reach. One the mutation must fail (own), has been seen to
 * fail (known, history) is a soundness failure to explain; a coupled id outside it is one the
 * mutation cannot fail, timing apart.
 */
export function misses(r: Reach, e: Expected): { mutation: string; id: string; source: MissSource }[] {
  const out: { mutation: string; id: string; source: MissSource }[] = [];
  for (const source of ["own", "coupled", "known", "history"] as const) {
    for (const [m, ids] of Object.entries(e[source] ?? {})) {
      for (const id of ids) if (id in r.reach && !r.reach[id]!.includes(m)) out.push({ mutation: m, id, source });
    }
  }
  return out;
}

/** Per mutation, the checks and ids in its reach, and the share each guard adds. */
export function perMutation(r: Reach, mutations: string[]): { mutation: string; checks: number; ids: number; observedChecks: number }[] {
  return mutations.map((m) => {
    const inReach = (ids: string[], by: Record<string, string[]>) => ids.some((id) => (by[id] ?? []).includes(m));
    return {
      mutation: m,
      checks: r.checks.filter((ids) => inReach(ids, r.reach)).length,
      ids: Object.keys(r.reach).filter((id) => r.reach[id]!.includes(m)).length,
      observedChecks: r.checks.filter((ids) => inReach(ids, r.observed)).length,
    };
  });
}

/** The reach as a report: per mutation, the totals, each guard's effect and the misses. */
export function reachMarkdown(r: Reach, mutations: string[], e: Expected): string {
  const rows = perMutation(r, mutations);
  const total = rows.reduce((n, x) => n + x.checks, 0);
  const observed = rows.reduce((n, x) => n + x.observedChecks, 0);
  const classPChecks = r.checks.filter((ids) => ids.some((id) => id in r.guards.classP)).length;
  const miss = misses(r, e);
  const lines = [
    `# Reach of build ${r.build.slice(0, 12)}`,
    "",
    `${r.runs} clean run(s) of ${(r.builds ?? [r.build]).length} build(s) added together (the latest commits `
      + `${r.commits.slice(-3).map((c) => c.slice(0, 8)).join(", ")}); ${r.checks.length} checks, `
      + `${Object.keys(r.reach).length} ids; ${mutations.length} mutations.`,
    "",
    `A matrix that skips what a mutation cannot reach runs ${total} checks under the mutations, plus ${r.checks.length} clean: `
      + `${total + r.checks.length}, against ${(mutations.length + 1) * r.checks.length} for the full matrix.`,
    `Coverage alone would give ${observed}; class P adds the rest for ${classPChecks} checks, start-up wiring for `
      + `${r.guards.startup.length} mutation(s)${r.guards.startup.length ? ` (${r.guards.startup.join(", ")})` : ""}.`,
    "",
    r.guards.lint.length ? `The lint fails:\n${r.guards.lint.map((l) => `- ${l}`).join("\n")}` : "The lint passes.",
    "",
    miss.length ? `Misses (an own, known or historical one is a soundness failure to explain; a coupled one an id the mutation cannot fail but by timing):\n${miss.map((x) => `- ${x.mutation} does not reach ${x.id} (${x.source})`).join("\n")}`
      : "No miss: every own-row, coupled, known and historical id is in its mutation's reach.",
    "",
    "| Mutation | Checks in reach | Ids | By coverage alone |",
    "|---|---|---|---|",
    ...rows.map((x) => `| \`${x.mutation}\` | ${x.checks} | ${x.ids} | ${x.observedChecks} |`),
    "",
    `Class P (${classPChecks} checks): ${Object.entries(r.guards.classP).map(([id, why]) => `${id} (${why})`).join(", ") || "none"}.`,
  ];
  return `${lines.join("\n")}\n`;
}
