// The change-scoped matrix's mapping (`src/changed.ts`): a change's files to the mutations in scope,
// each with its reasons, over sites, rows' ids, check files and entries; and the shared harness's list.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { afterReach, BUILD, changedScope, checkedAgainstReach, conditionalChange, declared, entries, importsOf, passLine, sharedClosure, unionSites, unscoped, REPOSITORY, rowEntries, rowIds, scopeClause, scopeLines,
  selectMutations, SHARED_BY_STANDARD, SHARED_HARNESS, sharedFor, sharedHits, siteCounts, siteFiles, sourceOfBuilt, under, type ScopeInput } from "../src/changed.js";
import { callerFile } from "../src/registry.js";

const base: ScopeInput = {
  changed: [],
  mutations: ["drops-it", "keeps-it", "at-start"],
  sites: { "drops-it": ["b/src/a.ts"], "keeps-it": ["b/src/a.ts", "b/src/k.ts"], "at-start": ["b/src/main.ts"] },
  rows: { "drops-it": ["GA-1", "GA-2"], "keeps-it": ["GA-3"], "at-start": ["GA-4"] },
  checkFiles: { "GA-1": "h/src/tests/one.ts", "GA-2": "h/src/tests/two.ts", "GA-3": "h/src/tests/two.ts", "GA-4": "h/src/tests/four.ts" },
  before: { "drops-it": "subject.json", "keeps-it": "subject.json", "at-start": "proposed-rows.json {\"mutation\":\"at-start\"}" },
  after: { "drops-it": "subject.json", "keeps-it": "subject.json", "at-start": "proposed-rows.json {\"mutation\":\"at-start\"}" },
  shared: ["h/src/home.ts", "sim/"],
};
const scope = (o: Partial<ScopeInput>) => changedScope({ ...base, ...o });
const names = (o: Partial<ScopeInput>) => scope(o).mutations.map((s) => s.mutation);

describe("the mutations a change puts in scope", () => {
  it("puts none in scope for a change that touches nothing of theirs", () => {
    const s = scope({ changed: ["docs/guide.md", "b/src/other.ts"] });
    expect(s).toEqual({ mode: "scoped", mutations: [], of: 3, shared: [] });
  });

  it("puts in scope every mutation with a site in a changed file: the one changed and its neighbours in the file", () => {
    expect(scope({ changed: ["b/src/a.ts"] }).mutations).toEqual([
      { mutation: "drops-it", reasons: ["a site in b/src/a.ts"] },
      { mutation: "keeps-it", reasons: ["a site in b/src/a.ts"] },
    ]);
    expect(names({ changed: ["b/src/k.ts"] })).toEqual(["keeps-it"]);
  });

  it("puts in scope a mutation one of whose rows' ids has a changed check file, naming the ids", () => {
    expect(scope({ changed: ["h/src/tests/two.ts"] }).mutations).toEqual([
      { mutation: "drops-it", reasons: ["the check file of GA-2 (h/src/tests/two.ts)"] },
      { mutation: "keeps-it", reasons: ["the check file of GA-3 (h/src/tests/two.ts)"] },
    ]);
  });

  it("ignores an id with no registered test", () => {
    expect(names({ changed: ["h/src/tests/two.ts"], checkFiles: { "GA-1": "h/src/tests/one.ts" } })).toEqual([]);
  });

  it("puts in scope a new mutation and one whose entry changed", () => {
    const s = scope({ mutations: [...base.mutations, "is-new"], sites: { ...base.sites, "is-new": ["b/src/n.ts"] },
      after: { ...base.after, "at-start": "proposed-rows.json {\"mutation\":\"at-start\",\"coupled\":[\"GA-9\"]}", "is-new": "subject.json" } });
    expect(s.mutations).toEqual([
      { mutation: "at-start", reasons: ["its proposed-rows.json entry changed"] },
      { mutation: "is-new", reasons: ["a new mutation"] },
    ]);
  });

  it("names a proposed row moved into subject.json as a changed entry", () => {
    expect(scope({ after: { ...base.after, "at-start": "subject.json" } }).mutations).toEqual([
      { mutation: "at-start", reasons: ["its subject.json entry changed"] }]);
  });

  it("puts every mutation in scope when the shared harness changes, with its other reasons too", () => {
    const s = scope({ changed: ["sim/src/broker.ts", "b/src/k.ts"] });
    expect(s.mode).toBe("shared");
    expect(s.shared).toEqual(["sim/src/broker.ts"]);
    expect(s.mutations).toEqual([
      { mutation: "drops-it", reasons: ["the shared harness changed"] },
      { mutation: "keeps-it", reasons: ["the shared harness changed", "a site in b/src/k.ts"] },
      { mutation: "at-start", reasons: ["the shared harness changed"] },
    ]);
  });

  it("needs no site mapped when the shared harness changed", () => {
    expect(scope({ changed: ["h/src/home.ts"], sites: { ...base.sites, "at-start": [] } })).toMatchObject({ mode: "shared", of: 3 });
  });

  it("gives up scoping, and runs every mutation, when a mutation has no site in the sources", () => {
    const s = scope({ changed: ["docs/x.md"], sites: { ...base.sites, "at-start": [] } });
    expect(s.mode).toBe("unscoped");
    expect(s.why).toBe("no site in the sources for at-start");
    expect(s.mutations.map((x) => x.mutation)).toEqual(base.mutations);
  });
});

describe("the shared harness", () => {
  it("matches a named file exactly and a folder by prefix", () => {
    expect(under("h/src/home.ts", "h/src/home.ts")).toBe(true);
    expect(under("h/src/home.test.ts", "h/src/home.ts")).toBe(false);
    expect(under("sim/src/x.ts", "sim/")).toBe(true);
    expect(under("simx/a.ts", "sim/")).toBe(false);
    expect(under("anything", "")).toBe(true);
    expect(sharedHits(["h/src/home.ts", "h/src/registry.ts", "sim/a.ts"], ["h/src/home.ts", "sim/"])).toEqual(["h/src/home.ts", "sim/a.ts"]);
  });

  it("is the guide's list with the maintainer's additions, in one place, and each path in it exists", () => {
    const harness = join(dirname(fileURLToPath(import.meta.url)), "..");
    const roots: Record<string, string> = { "@ludentes/galatea-life-harness": harness, "@ludentes/galatea-life-sim": join(harness, "..", "sim"),
      "@ludentes/galatea-life-test-clock": join(harness, "..", "clock"), "@ludentes/galatea-life-schemas": join(harness, "..", "schemas"), [REPOSITORY]: join(harness, "..", ".."),
      [BUILD]: join(harness, "..", "..", "reference", "applier") };
    const H = "@ludentes/galatea-life-harness";
    expect(SHARED_HARNESS.map((s) => `${s.package}:${s.path}`)).toEqual([
      `${H}:src/home.ts`, `${H}:src/runner.ts`, `${H}:src/reach.ts`, `${H}:scripts/reach.mjs`,
      "@ludentes/galatea-life-sim:",
      `${H}:src/subject.ts`, `${H}:src/database.ts`, `${H}:src/seams/`, "@ludentes/galatea-life-test-clock:",
      `${H}:src/ports.ts`, `${H}:src/util.ts`,
      `${H}:src/changed.ts`, `${H}:scripts/changed.mjs`, `${H}:src/registry.ts`,
      `${BUILD}:src/mutations.ts`, `${H}:src/cli.ts`, "@ludentes/galatea-life-schemas:",
      `${BUILD}:graded-ids.json`, `${BUILD}:scripts/matrix-verdict.mjs`, `${BUILD}:scripts/full-matrix.mjs`, `${BUILD}:subject.json`,
      `${REPOSITORY}:pnpm-lock.yaml`,
    ]);
    expect(SHARED_HARNESS.filter((s) => s.when).map((s) => [s.path, s.when])).toEqual([["src/mutations.ts", "declarations"], ["subject.json", "fields"]]);
    expect(SHARED_BY_STANDARD).toEqual({ steward: [expect.objectContaining({ package: H, path: "src/steward-home.ts" })] });
    for (const s of [...SHARED_HARNESS, ...Object.values(SHARED_BY_STANDARD).flat()]) {
      // The build's paths exist only where the reference applier stands beside the harness (the workshop).
      if (s.package === BUILD && !existsSync(roots[BUILD]!)) continue;
      expect(existsSync(join(roots[s.package]!, s.path)), `${s.package} ${s.path}`).toBe(true);
      expect(s.why.length).toBeGreaterThan(10);
    }
    // The sim holds the fixture, the broker, the proxy and the time server the guide names.
    for (const f of ["fixture.ts", "broker.ts", "proxy.ts", "time-server.ts"]) expect(existsSync(join(roots["@ludentes/galatea-life-sim"]!, "src", f))).toBe(true);
  });
});

describe("each build's shared list", () => {
  it("is the common part, plus the steward's own for the steward only", () => {
    expect(sharedFor("applier")).toEqual(SHARED_HARNESS);
    expect(sharedFor("steward").map((s) => s.path).slice(-1)).toEqual(["src/steward-home.ts"]);
    expect(sharedFor("steward")).toHaveLength(SHARED_HARNESS.length + 1);
    expect(sharedFor(undefined)).toEqual(SHARED_HARNESS);
  });
});

describe("helpers reached through the check files that import them", () => {
  const checkFiles = { "GA-1": "h/src/tests/a/one.ts", "GA-2": "h/src/tests/a/two.ts", "GA-3": "h/src/tests/b/three.ts" };
  const imports = { "h/src/tests/a/one.ts": ["h/src/tests/a/util.ts"], "h/src/tests/a/two.ts": ["h/src/tests/a/one.ts"],
    "h/src/tests/a/util.ts": ["h/src/tests/token.ts"], "h/src/tests/b/three.ts": [] };
  const s = (changed: string[]) => changedScope({ ...base, changed, checkFiles, imports,
    rows: { "drops-it": ["GA-1"], "keeps-it": ["GA-2"], "at-start": ["GA-3"] } }).mutations;

  it("puts a mutation in scope when a helper its rows' check files import, at any depth, changed", () => {
    expect(s(["h/src/tests/token.ts"])).toEqual([
      { mutation: "drops-it", reasons: ["a helper of the check file of GA-1 (h/src/tests/token.ts)"] },
      { mutation: "keeps-it", reasons: ["a helper of the check file of GA-2 (h/src/tests/token.ts)"] },
    ]);
    expect(s(["h/src/tests/a/one.ts"])).toEqual([
      { mutation: "drops-it", reasons: ["the check file of GA-1 (h/src/tests/a/one.ts)"] },
      { mutation: "keeps-it", reasons: ["a helper of the check file of GA-2 (h/src/tests/a/one.ts)"] },
    ]);
    expect(s(["h/src/tests/b/other.ts"])).toEqual([]);
  });

  it("reads a module's relative imports, resolved to their sources, and survives a cycle", () => {
    const text = ['import { a } from "./util.js";', 'import type { T } from "../token.js";', 'import "../../assert.js";',
      'import { x } from "node:crypto";', 'export { y } from "./answers.js";'].join("\n");
    expect(importsOf("h/src/tests/steward/rules.ts", text)).toEqual(["h/src/tests/steward/util.ts", "h/src/tests/token.ts",
      "h/src/assert.ts", "h/src/tests/steward/answers.ts"]);
    expect(changedScope({ ...base, changed: ["h/src/tests/x.ts"], checkFiles: { "GA-1": "h/src/tests/w.ts" },
      imports: { "h/src/tests/w.ts": ["h/src/tests/x.ts"], "h/src/tests/x.ts": ["h/src/tests/w.ts"] } }).mutations.map((m) => m.mutation))
      .toEqual(["drops-it"]);
  });
});

describe("a mutation's manifest row and known couplings", () => {
  const manifest = [{ id: "GA-1", negative_subjects: [{ subject: "drops-it", coupled: ["GA-2"] }] },
    { id: "GA-3", negative_subjects: [{ subject: "keeps-it", coupled: [] }] }];
  const known = { known: { "drops-it": ["GA-9"] } };

  it("reads each mutation's rows of the manifest and its known-outside.json entry", () => {
    expect(rowEntries(["drops-it", "at-start"], manifest, { known })).toEqual({
      "drops-it": { manifest: '[{"id":"GA-1","subject":"drops-it","coupled":["GA-2"]}]', known: '["GA-9"]' },
      "at-start": { manifest: "[]", known: "[]" },
    });
  });

  it("puts in scope a mutation whose manifest row or known-outside.json entry changed", () => {
    const before = rowEntries(base.mutations, manifest, { known });
    const changedManifest = [{ ...manifest[0]!, negative_subjects: [{ subject: "drops-it", coupled: [] }] }, manifest[1]!];
    expect(scope({ rowsBefore: before, rowsAfter: rowEntries(base.mutations, changedManifest, { known }) }).mutations).toEqual([
      { mutation: "drops-it", reasons: ["its manifest row changed"] }]);
    expect(scope({ rowsBefore: before, rowsAfter: rowEntries(base.mutations, manifest, { known: { known: { "keeps-it": ["GA-4"] } } }) })
      .mutations).toEqual([{ mutation: "drops-it", reasons: ["its known-outside.json entry changed"] },
      { mutation: "keeps-it", reasons: ["its known-outside.json entry changed"] }]);
    expect(scope({ rowsBefore: before, rowsAfter: before }).mutations).toEqual([]);
  });
});

describe("the preflight's findings, as tests", () => {
  it("puts in scope a mutation whose site was removed from one file while it keeps one in another (B1)", () => {
    const sites = unionSites({ "keeps-it": ["b/src/a.ts", "b/src/k.ts"] }, { "keeps-it": ["b/src/k.ts"] });
    expect(sites).toEqual({ "keeps-it": ["b/src/a.ts", "b/src/k.ts"] });
    expect(scope({ changed: ["b/src/a.ts"], sites: { ...base.sites, "drops-it": [], ...sites } }).mutations.map((m) => m.mutation))
      .toContain("keeps-it");
  });

  it("closes the shared files over what they import in the harness, never into the checks (B2)", () => {
    const imports = { "h/src/home.ts": ["h/src/context.ts", "h/src/registry.ts"], "h/src/context.ts": ["h/src/assert.ts"],
      "h/src/cli.ts": ["h/src/runner.ts", "h/src/tests/index.ts"], "h/src/tests/index.ts": ["h/src/tests/a.ts"], "h/src/other.ts": [] };
    expect(sharedClosure(["h/src/home.ts", "h/src/cli.ts"], imports, "h/src/tests/")).toEqual(
      ["h/src/home.ts", "h/src/cli.ts", "h/src/assert.ts", "h/src/context.ts", "h/src/registry.ts", "h/src/runner.ts"]);
    expect(sharedClosure(["sim/"], imports, "h/src/tests/")).toEqual(["sim/"]);
    const s = scope({ changed: ["h/src/assert.ts"], shared: sharedClosure(["h/src/home.ts"], imports, "h/src/tests/") });
    expect(s.mode).toBe("shared");
  });

  it("follows a check file's imports beyond the checks, into the rest of the harness (B2)", () => {
    expect(scope({ changed: ["h/src/report.ts"], checkFiles: { "GA-1": "h/src/tests/one.ts" },
      imports: { "h/src/tests/one.ts": ["h/src/report.ts"] } }).mutations).toEqual([
      { mutation: "drops-it", reasons: ["a helper of the check file of GA-1 (h/src/report.ts)"] }]);
  });

  it("counts a conditional shared file's change only outside what each mutation's own entry holds (B3, I5)", () => {
    const decl = (list: string, rest = "") => `export const MUTATIONS = [${list}] as const;\n${rest}export function mutationFromEnv() { return 1; }\n`;
    expect(conditionalChange("declarations", decl('"a"'), decl('"a",\n  "b"'))).toBe(false);
    expect(conditionalChange("declarations", decl('"a"'), decl('"a"', "export const x = 1;\n"))).toBe(true);
    expect(conditionalChange("fields", '{"mutations":["a"],"start":{"command":"node"}}', '{"mutations":["a","b"],"start":{"command":"node"}}')).toBe(false);
    expect(conditionalChange("fields", '{"mutations":["a"],"start":{"command":"node"}}', '{"mutations":["a"],"start":{"command":"env"}}')).toBe(true);
    expect(conditionalChange("fields", undefined, "{}")).toBe(true);
    expect(scope({ sharedChanged: ["b/subject.json (a field other than its mutations)"] })).toMatchObject({ mode: "shared",
      shared: ["b/subject.json (a field other than its mutations)"] });
  });
});

describe("what the mapping reads", () => {
  it("maps a built module to its source, and leaves a source alone", () => {
    expect(sourceOfBuilt("/r/conformance/harness/dist/tests/applier/bus.js")).toBe("/r/conformance/harness/src/tests/applier/bus.ts");
    expect(sourceOfBuilt("/r/conformance/harness/src/tests/applier/bus.ts")).toBe("/r/conformance/harness/src/tests/applier/bus.ts");
  });

  it("finds each mutation's site files and counts, leaving out the declaration file's list", () => {
    const sources = [
      { file: "b/src/mutations.ts", text: 'export const MUTATIONS = ["drops-it", "keeps-it"] as const;\n' },
      { file: "b/src/a.ts", text: 'if (o.mutation === "drops-it") x();\nif (o.mutation !== "keeps-it") y();\nif (o.mutation === "drops-it") z();\n' },
    ];
    expect(siteFiles(["drops-it", "keeps-it"], sources)).toEqual({ "drops-it": ["b/src/a.ts"], "keeps-it": ["b/src/a.ts"] });
    expect(siteCounts(["drops-it", "keeps-it"], sources)).toEqual({ "drops-it": 2, "keeps-it": 1 });
  });

  it("reads entries, the declared list and the rows' ids from the mutation files", () => {
    const files = { subject: { mutations: ["drops-it"] }, proposed: { rows: [{ mutation: "at-start", breaks: ["GA-5"], coupled: ["GA-6"] }] },
      known: { known: { "drops-it": ["GA-7"] } } };
    expect(declared(files)).toEqual(["drops-it", "at-start"]);
    expect(entries(files)).toEqual({ "drops-it": "subject.json", "at-start": 'proposed-rows.json {"mutation":"at-start","breaks":["GA-5"],"coupled":["GA-6"]}' });
    const manifest = [{ id: "GA-1", negative_subjects: [{ subject: "drops-it", coupled: ["GA-2"] }] }, { id: "GA-3", negative_subjects: [] }];
    expect(rowIds(["drops-it", "at-start"], manifest, files)).toEqual({ "drops-it": ["GA-1", "GA-2", "GA-7"], "at-start": ["GA-5", "GA-6"] });
    expect(entries({})).toEqual({});
  });

  it("names the module that called requirement from a stack, past the registry's own frames", () => {
    const stack = ["Error", "    at requirement (file:///r/h/dist/registry.js:44:16)", "    at file:///r/h/dist/tests/applier/bus.js:12:1",
      "    at ModuleJob.run (node:internal/modules/esm/module_job:271:25)"].join("\n");
    expect(callerFile(stack, "file:///r/h/dist/registry.js")).toBe("/r/h/dist/tests/applier/bus.js");
    expect(callerFile("    at x (/r/h/src/registry.ts:3:1)\n    at /r/h/src/tests/x.ts:9:2", "file:///r/h/src/registry.ts")).toBe("/r/h/src/tests/x.ts");
    expect(callerFile("Error", "file:///r/h/dist/registry.js")).toBeUndefined();
    // A checkout path holding a space or a parenthesis (M6), as a URL and as a path.
    expect(callerFile("    at requirement (file:///r/my%20h/dist/registry.js:44:16)\n    at file:///r/my%20h/dist/tests/a%20(b).js:12:1",
      "file:///r/my%20h/dist/registry.js")).toBe("/r/my h/dist/tests/a (b).js");
    expect(callerFile("    at requirement (/r/my h/src/registry.ts:4:1)\n    at async Promise.all (index 0)\n    at fn (/r/my h (x)/t.ts:9:2)",
      "file:///r/my%20h/src/registry.ts")).toBe("/r/my h (x)/t.ts");
    // Source-mapped, the registry's own frame names its source.
    expect(callerFile("    at requirement (/r/h/src/registry.ts:44:16)\n    at /r/h/src/tests/a.ts:1:1", "file:///r/h/dist/registry.js"))
      .toBe("/r/h/src/tests/a.ts");
  });
});

describe("what the driver selects and prints", () => {
  const declaredList = ["drops-it", "keeps-it", "at-start"];

  it("runs the scope, within --only when given", () => {
    const s = scope({ changed: ["b/src/a.ts"] });
    expect(selectMutations({ declared: declaredList, scope: s })).toEqual(["drops-it", "keeps-it"]);
    expect(selectMutations({ declared: declaredList, scope: s, only: ["keeps-it", "at-start"] })).toEqual(["keeps-it"]);
    expect(selectMutations({ declared: declaredList, only: ["at-start"] })).toEqual(["at-start"]);
    expect(selectMutations({ declared: declaredList })).toEqual(declaredList);
  });

  it("prints each mutation in scope with its reasons", () => {
    expect(scopeLines(scope({ changed: ["b/src/a.ts", "h/src/tests/four.ts"] }), "origin/main")).toEqual([
      "Scope: the change against origin/main puts 3 of 3 mutations in scope.",
      "  drops-it: a site in b/src/a.ts",
      "  keeps-it: a site in b/src/a.ts",
      "  at-start: the check file of GA-4 (h/src/tests/four.ts)",
    ]);
  });

  it("says a change that touches none runs the clean run only", () => {
    expect(scopeLines(scope({ changed: ["docs/x.md"] }), "origin/main")).toEqual([
      "Scope: the change against origin/main touches no mutation's site, rows' check file or entry, nor the shared harness: "
        + "no mutation is in scope, and the run is the clean run only.",
    ]);
  });

  it("says the shared harness put every mutation in scope", () => {
    expect(scopeLines(scope({ changed: ["h/src/home.ts"] }), "b")[0]).toBe(
      "Scope: the change against b touches the shared harness (h/src/home.ts), so every mutation is in scope.");
  });

  it("says why it could not scope, and what --only leaves", () => {
    const s = scope({ sites: { ...base.sites, "at-start": [] } });
    expect(scopeLines(s, "b", ["keeps-it"])).toEqual([
      "Scope: the change against b cannot be scoped (no site in the sources for at-start), so every mutation runs, by reach.",
      "  With --only, 1 of them run: keeps-it.",
    ]);
  });

  it("gives the pass line's clause", () => {
    expect(scopeClause(scope({ changed: ["b/src/k.ts"] }), "origin/main", 1)).toBe("scoped to the change against origin/main: 1 of 3 mutations");
    expect(scopeClause(scope({ sites: {} }), "x", 3)).toMatch(/^not scoped to the change against x \(no site in the sources for drops-it, keeps-it, at-start\): 3 of 3 mutations$/);
  });

  it("runs every declared mutation when unscoped, even a scope that names none", () => {
    expect(selectMutations({ declared: declaredList, scope: unscoped([], "x") })).toEqual(declaredList);
    expect(selectMutations({ declared: declaredList, scope: unscoped([], "x"), only: ["keeps-it"] })).toEqual(["keeps-it"]);
  });

  it("re-scopes after the clean run's reach, printing the new lines only when the scope gave up (M4)", () => {
    const s = scope({ changed: ["b/src/k.ts"] });
    const counts = { "drops-it": 1, "keeps-it": 2, "at-start": 1 };
    const sites = { "drops-it": [{}], "keeps-it": [{}, {}], "at-start": [{}] };
    expect(afterReach({ scope: s, siteCounts: counts, reachSites: sites, declared: declaredList, base: "b" }))
      .toEqual({ scope: s, mutations: ["keeps-it"], lines: [] });
    const gave = afterReach({ scope: s, siteCounts: counts, reachSites: { ...sites, "at-start": [] }, declared: declaredList, only: ["at-start"], base: "b" });
    expect(gave.mutations).toEqual(["at-start"]);
    expect(gave.lines).toEqual(["Scope: the change against b cannot be scoped (the reach's sites do not match the sources for at-start), "
      + "so every mutation runs, by reach.", "  With --only, 1 of them run: at-start."]);
  });

  it("gives the pass line, full, by reach, scoped, and the clean run only (M4)", () => {
    expect(passLine({ full: true, runs: 4, ids: 9, graded: 3 })).toBe(
      "The full matrix passes: 4 runs against 9 graded ids; every mutation caught in its row, no new failure outside one.");
    expect(passLine({ full: false, runs: 4, ids: 9, graded: 3 })).toBe("The matrix passes, skipping by reach: 4 runs against 9 graded ids; "
      + "every mutation caught in its row, no new failure outside one among the ids it ran.");
    const s = scope({ changed: ["b/src/k.ts"] });
    expect(passLine({ full: false, scope: s, base: "origin/main", runs: 2, ids: 9, graded: 1 })).toBe("The matrix passes, scoped to the change "
      + "against origin/main: 1 of 3 mutations, skipping by reach: 2 runs against 9 graded ids; every mutation caught in its row, "
      + "no new failure outside one among the ids it ran.");
    expect(passLine({ full: false, scope: scope({}), base: "origin/main", runs: 1, ids: 9, graded: 0 })).toBe(
      "The matrix passes, scoped to the change against origin/main: 0 of 3 mutations: the clean run only, against 9 graded ids.");
  });

  it("gives up scoping when the clean run's reach does not hold the sources' sites", () => {
    const s = scope({ changed: ["b/src/k.ts"] });
    const counts = { "drops-it": 1, "keeps-it": 2, "at-start": 1 };
    const sites = (n: number[]) => ({ "drops-it": Array(n[0]).fill({}), "keeps-it": Array(n[1]).fill({}), "at-start": Array(n[2]).fill({}) });
    expect(checkedAgainstReach(s, counts, sites([1, 2, 1]), declaredList)).toBe(s);
    expect(checkedAgainstReach(s, counts, sites([1, 1, 1]), declaredList)).toMatchObject({ mode: "unscoped", why: "the reach's sites do not match the sources for keeps-it" });
    expect(checkedAgainstReach(s, counts, undefined, declaredList)).toMatchObject({ mode: "unscoped", why: "the store holds no reach for this build" });
  });
});
