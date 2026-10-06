// The reach mapper (`src/reach.ts`): sites, the lint, coverage to reach, the guards, the union.
import { describe, expect, it } from "vitest";
import { findSites, lint, mutationReads, withoutDeclarations, measureReach, misses, perMutation, reached, reachMarkdown, scopeOf, unionReach,
  type CheckCoverage, type ScriptCoverage, type Site } from "../src/reach.js";

const names = new Set(["drops-it", "keeps-it", "at-start"]);

describe("sites", () => {
  it("finds each direct comparison of the mutation, through any member path or a local alias", () => {
    const text = [
      'if (this.o.mutation === "drops-it") x();',
      'const keep = ctx?.mutation !== "keeps-it";',
      "const m = this.o.mutation;",
      'if (a && m === "drops-it") y();',
    ].join("\n");
    const { sites, problems } = findSites("f.js", text, names);
    expect(problems).toEqual([]);
    expect(sites.map((s) => [s.mutation, s.line])).toEqual([["drops-it", 1], ["keeps-it", 2], ["drops-it", 4]]);
    expect(text.slice(sites[0]!.offset, sites[0]!.offset + 10)).toBe('"drops-it"');
  });

  it("names a literal that is not a direct comparison of the mutation", () => {
    const text = ['const view = { mutation: on ? "drops-it" : undefined };', 'if (other === "keeps-it") z();', 'log("drops-it");'].join("\n");
    expect(findSites("f.js", text, names).problems).toEqual([
      'f.js:1: "drops-it" is not a direct comparison of the mutation',
      'f.js:2: "keeps-it" is not a direct comparison of the mutation',
      'f.js:3: "drops-it" is not a direct comparison of the mutation',
    ]);
  });

  it("ignores a literal that names no mutation", () => {
    expect(findSites("f.js", 'if (this.mutation === "not-a-mutation") x();', names)).toEqual({ sites: [], problems: [] });
  });
});

describe("reads of the mutation (an allowlist)", () => {
  const callees = new Set(["Applier", "EventLog", "judge"]);
  const problems = (text: string) => [...findSites("f.js", text, names).problems, ...mutationReads("f.js", text, callees)];

  // The reach preflight's forms (I2): each read the first lint let through, or another a build must not write.
  it.each([
    ["an argument to code the build does not declare", "report(step, this.o.mutation);"],
    ["destructuring", 'const { mutation } = this.o;\nif (mutation === "drops-it") x();'],
    ["destructuring under another name", "const { mutation: mm } = this.o;\nconst t = TABLE[mm];"],
    ["an index", "const effect = EFFECTS[this.o.mutation];"],
    ["`in`", "if (this.o.mutation in EFFECTS) x();"],
    ["an array holding it", "const all = [this.o.mutation];"],
    ["a shorthand given to code the build does not declare", "log({ mutation });"],
    ["a spread holder, read", "const opts = { ...this.o };\nopts.mutation;"],
    ["a stringified holder", 'if (this.o.mutation === "drops-it") x();\nconsole.log(JSON.stringify(this.o));'],
    ["an alias with a default", 'const m = this.o.mutation ?? "none";'],
    ["a reversed comparison", 'if ("drops-it" === this.o.mutation) x();'],
    ["a loose comparison", 'if (this.o.mutation == "drops-it") x();'],
    ["a method", 'if (this.o.mutation?.startsWith("drops")) x();'],
    ["a property", "const n = this.o.mutation?.length;"],
    ["a field holding it under another name", "this.flag = this.o.mutation;"],
    ["a getter returning it", "get mut() { return this.o.mutation; }"],
    ["a map lookup", "const fn = HANDLERS.get(this.o.mutation);"],
    ["Object.is", 'if (Object.is(this.o.mutation, "drops-it")) x();'],
    ["GALATEA_MUTATION compared", 'if (process.env.GALATEA_MUTATION === "drops-it") x();'],
    ["GALATEA_MUTATION read", 'const raw = process.env.GALATEA_MUTATION;\nif (raw === "keeps-it") y();'],
    ["switch", "switch (this.mutation) { default: }"],
    ["a truth test", "if (mutation) x();"],
    ["a template", "const s = `${this.mutation}`;"],
    ["an alias read but by a comparison", "const m = this.o.mutation;\nif (m) x();"],
  ])("refuses %s", (_what, text) => {
    expect(problems(text)).not.toEqual([]);
  });

  it.each([
    ["a site", 'if (this.o.mutation === "drops-it") x();'],
    ["a site as a ternary's test", 'const on = this.o.mutation === "drops-it" ? 1 : 0;'],
    ["an alias compared", 'const m = this.o.mutation;\nif (a && m !== "keeps-it") y();'],
    ["a type", "interface O { readonly mutation?: Mutation }\nconstructor(private readonly mutation?: Mutation) {}"],
    ["a field copied", "this.mutation = o.mutation;"],
    ["the environment's", "const mutation = mutationFromEnv(env);"],
    ["narrowed by a site", 'const mutation = gate.mutation === "drops-it" ? undefined : gate.mutation;\njudge(s, { ...gate, mutation });'],
    ["an argument of the build's own code", "this.log = new EventLog(o.store, o.mutation);"],
    ["a shorthand or key in the build's own call", "new Applier({ store, mutation });\nnew Applier({ store, mutation: this.o.mutation });"],
    ["a key in a context object", "const ctx = { now: 1, mutation: this.mutation };"],
    ["a key whose value is a literal (findSites judges the literal)", "const view = { mutation: undefined };"],
    ["a comment or a message", '// if (mutation) ...\nconst why = "the mutation is unknown";'],
  ])("allows %s", (_what, text) => {
    expect(problems(text)).toEqual([]);
  });

  it("lints a declaration file but for its MUTATIONS list and mutationFromEnv", () => {
    const decl = [
      'export const MUTATIONS = ["drops-it", "keeps-it"] as const;',
      "export function mutationFromEnv(env) {",
      "  const m = env.GALATEA_MUTATION;",
      "  if (!m) return undefined;",
      "  return m;",
      "}",
    ].join("\n");
    expect(mutationReads("src/mutations.ts", withoutDeclarations(decl), callees)).toEqual([]);
    expect(findSites("src/mutations.ts", withoutDeclarations(decl), names)).toEqual({ sites: [], problems: [] });
    const more = `${decl}\nexport const SECRET = process.env.GALATEA_MUTATION;\nexport const bad = (m: string) => m === "drops-it";`;
    expect(mutationReads("src/mutations.ts", withoutDeclarations(more), callees)[0]).toMatch(/GALATEA_MUTATION is read outside mutationFromEnv/);
    expect(findSites("src/mutations.ts", withoutDeclarations(more), names).problems).toHaveLength(1);
  });
});

describe("the lint", () => {
  const src = (text: string, file = "src/a.ts") => ({ file, text });
  const ok = 'if (this.mutation === "drops-it") x();\nif (this.mutation !== "keeps-it") y();';
  it("passes a build whose every mutation has as many direct sites in its sources as built", () => {
    expect(lint({ mutations: ["drops-it", "keeps-it"], sources: [src(ok), src('export const MUTATIONS = ["drops-it", "keeps-it"];', "src/mutations.ts")],
      built: [src(ok, "dist/a.js")], declarations: ["mutations.ts"] })).toEqual([]);
  });
  it("fails a mutation with no site, one with fewer built, and an indirect read", () => {
    expect(lint({ mutations: ["drops-it", "keeps-it", "at-start"], sources: [src(`${ok}\nif (mutation) z();`)],
      built: [src('if (this.mutation === "drops-it") x();', "dist/a.js")], declarations: [] })).toEqual([
      "src/a.ts:3: the mutation is read other than by a direct comparison or passed on whole to this build's code: if (mutation) z();",
      "keeps-it has 1 sites in the sources and 0 built",
      "at-start has no site in the sources",
    ]);
  });
});

// A built file, as V8 would cover it: its top level, a constructor and a method.
const text = [
  'const early = mutation === "at-start";',
  "class A {",
  '  constructor() { this.k = mutation === "keeps-it"; }',
  '  run(x) { if (x) return this.mutation === "drops-it"; return 0; }',
  "}",
].join("\n");
const sites: Site[] = findSites("/b/dist/a.js", text, names).sites;
const at = (s: string) => text.indexOf(s);
const fn = (functionName: string, from: string, to: string, count: number, blocks: [string, string, number][] = []) =>
  ({ functionName, ranges: [{ startOffset: at(from), endOffset: at(to) + to.length, count },
    ...blocks.map(([a, b, c]) => ({ startOffset: at(a), endOffset: at(b) + b.length, count: c }))] });
/** The file's coverage when `run` was called with `x` true (`deep`), or false. */
const cover = (deep: boolean): ScriptCoverage => ({ file: "/b/dist/a.js", functions: [
  { functionName: "", ranges: [{ startOffset: 0, endOffset: text.length, count: 1 }] },
  fn("A", "constructor()", "; }", 1),
  fn("run", "run(x)", "return 0; }\n", 1, [['return this.mutation === "drops-it";', 'return this.mutation === "drops-it";', deep ? 1 : 0]]),
] });

describe("coverage to reach", () => {
  it("counts a site reached by the innermost range around it", () => {
    const drops = sites.find((s) => s.mutation === "drops-it")!;
    expect(reached(drops, [cover(false)])).toBe(false);
    expect(reached(drops, [cover(true)])).toBe(true);
    expect(reached(drops, [{ ...cover(true), file: "/b/dist/other.js" }])).toBe(false);
  });

  it("places a site at the top level, in a constructor or in a function", () => {
    expect(sites.map((s) => scopeOf(s, text, [cover(false)]))).toEqual(["top", "constructor", "function"]);
    expect(scopeOf(sites[0]!, text, [])).toBe("unknown");
  });

  const check = (ids: string[], deep: boolean, o: Partial<CheckCoverage> = {}): CheckCoverage =>
    ({ ids, launches: 1, signalled: 0, scripts: [cover(deep)], ...o });
  const mutations = ["drops-it", "keeps-it", "at-start"];
  const measure = (checks: CheckCoverage[], commit = "c1") =>
    measureReach({ build: "b1", commit, mutations, sites, texts: { "/b/dist/a.js": text }, entry: "/b/dist/main.js", checks, lint: [] });

  it("gives each id the mutations its check reached, every start-up mutation, and class P every mutation", () => {
    // Class P (ruled 2026-10-06): a check that lost an instance to a signal, whose coverage is missing,
    // or one whose subject never launched. A restart on SIGTERM writes both instances' coverage: measured.
    const r = measure([check(["GA-1"], false), check(["GA-2", "GA-3"], true), check(["GA-4"], false, { launches: 2 }),
      check(["GA-5"], false, { launches: 2, signalled: 1 }), check(["GA-6"], false, { launches: 0 })]);
    expect(r.observed["GA-1"]).toEqual(["keeps-it", "at-start"]);
    expect(r.observed["GA-2"]).toEqual(mutations);
    expect(r.guards.startup).toEqual(["keeps-it", "at-start"]);
    expect(r.guards.classP).toEqual({ "GA-5": "1 ended on a signal", "GA-6": "no subject launched" });
    expect(r.reach["GA-1"]).toEqual(["keeps-it", "at-start"]);
    expect(r.reach["GA-3"]).toEqual(mutations);
    expect(r.reach["GA-4"]).toEqual(["keeps-it", "at-start"]);
    expect(r.reach["GA-5"]).toEqual(mutations);
    expect(perMutation(r, mutations)).toEqual([
      { mutation: "drops-it", checks: 3, ids: 4, observedChecks: 1 },
      { mutation: "keeps-it", checks: 5, ids: 6, observedChecks: 5 },
      { mutation: "at-start", checks: 5, ids: 6, observedChecks: 5 },
    ]);
  });

  it("adds two clean runs of one build together, class P included", () => {
    const a = measure([check(["GA-1"], false), check(["GA-2"], false, { signalled: 1 })]);
    const b = measure([check(["GA-1"], true), check(["GA-2"], false)], "c2");
    const u = unionReach(a, b, mutations);
    expect(u.runs).toBe(2);
    expect(u.commits).toEqual(["c1", "c2"]);
    expect(u.reach["GA-1"]).toContain("drops-it");
    expect(Object.keys(u.guards.classP)).toEqual(["GA-2"]);
  });

  it("carries observed pairs across builds, for the mutations still declared and the ids still graded", () => {
    const a = measure([check(["GA-1"], true), check(["GA-2"], false, { signalled: 1 }), check(["GA-9"], true)]);
    const b = { ...measure([check(["GA-1"], false), check(["GA-2"], false)], "c2"), build: "b2" };
    const u = unionReach(a, b, ["drops-it", "keeps-it"]);
    expect(u.builds).toEqual(["b1", "b2"]);
    // drops-it, reached only in the earlier build's run, is carried; at-start is no longer declared.
    expect(u.observed).toEqual({ "GA-1": ["drops-it", "keeps-it"], "GA-2": ["keeps-it"] });
    // Class P is the new build's own.
    expect(u.guards.classP).toEqual({});
    expect(u.reach["GA-2"]).toEqual(["keeps-it"]);
  });

  it("puts a check whose coverage files are fewer than its instances that ended themselves in class P", () => {
    const r = measure([check(["GA-1"], false, { launches: 2, written: 1 }), check(["GA-2"], false, { launches: 2, signalled: 1, written: 1 }),
      check(["GA-3"], false, { launches: 1, written: 1 })]);
    expect(r.guards.classP).toEqual({ "GA-1": "1 of 2 instances wrote coverage", "GA-2": "1 ended on a signal" });
  });

  it("lists each own-row, known or historical id outside its mutation's reach", () => {
    const r = measure([check(["GA-1"], false), check(["GA-2"], true)]);
    expect(misses(r, { own: { "drops-it": ["GA-2"] }, coupled: { "drops-it": ["GA-1"] }, known: { "drops-it": ["GA-1"] },
      history: { "drops-it": ["GA-9"] } })).toEqual([{ mutation: "drops-it", id: "GA-1", source: "coupled" }, { mutation: "drops-it", id: "GA-1", source: "known" }]);
    expect(reachMarkdown(r, mutations, { own: {}, known: { "drops-it": ["GA-1"] } })).toContain("- drops-it does not reach GA-1 (known)");
  });
});
