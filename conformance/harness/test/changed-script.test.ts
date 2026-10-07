// `scripts/changed.mjs`: a change's scope worked out from a real git repository, a build's files and
// the registry; and a base git cannot diff, which leaves every mutation unscoped.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
// @ts-expect-error a script without types
import { checkFiles, gitRunner, harnessImports, scopeOfChange, sharedPaths } from "../scripts/changed.mjs";
import { sharedClosure, sharedFor } from "../src/changed.js";

const repo = realpathSync(mkdtempSync(join(tmpdir(), "galatea-changed-")));
afterAll(() => rmSync(repo, { recursive: true, force: true }));
const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" });
const put = (file: string, text: string) => { mkdirSync(dirname(join(repo, file)), { recursive: true }); writeFileSync(join(repo, file), text); };
const json = (o: unknown) => `${JSON.stringify(o)}\n`;

git("init", "-q", "-b", "main");
git("config", "user.email", "t@example.invalid");
git("config", "user.name", "t");
put("build/subject.json", json({ standard: "applier", mutations: ["drops-it", "keeps-it"] }));
put("build/proposed-rows.json", json({ rows: [{ mutation: "at-start", breaks: ["GA-PERSIST-1"], coupled: [] }] }));
put("build/known-outside.json", json({ known: { "keeps-it": ["GA-X-2"] } }));
put("build/src/mutations.ts", 'export const MUTATIONS = ["drops-it", "keeps-it", "at-start"] as const;\n');
put("build/src/a.ts", 'if (o.mutation === "drops-it") x();\nif (o.mutation === "keeps-it") y();\n');
put("build/src/main.ts", 'if (o.mutation === "at-start") z();\n');
put("harness/src/home.ts", "// home\n");
put("harness/src/tests/two.ts", "// GA-X-2\n");
put("docs/a.md", "a\n");
git("add", "-A");
git("commit", "-qm", "base");
git("checkout", "-qb", "work");

const SHARED_PACKAGES = ["@ludentes/galatea-life-sim", "@ludentes/galatea-life-test-clock", "@ludentes/galatea-life-schemas",
  "@ludentes/galatea-life-harness"];
const checks = async () => ({ "GA-X-2": "harness/src/tests/two.ts", "GA-PERSIST-1": "harness/src/tests/persist.ts" });
const shared = () => ["harness/src/home.ts"];
const scopeOf = (o = {}) => scopeOfChange({ buildDir: join(repo, "build"), base: "main", git: gitRunner(join(repo, "build")), checks, shared, ...o });
const commit = (file: string, text: string) => { put(file, text); git("add", "-A"); git("commit", "-qm", file); };

describe("a change's scope, from git", () => {
  it("puts none in scope for a docs-only change", async () => {
    commit("docs/a.md", "b\n");
    const r = await scopeOf();
    expect(r.changed).toEqual(["docs/a.md"]);
    expect(r.scope).toMatchObject({ mode: "scoped", mutations: [], of: 3 });
    expect(r.siteCounts).toEqual({ "drops-it": 1, "keeps-it": 1, "at-start": 1 });
  });

  it("puts the mutations with a site in a changed file in scope, uncommitted changes only when asked", async () => {
    put("build/src/a.ts", 'if (o.mutation === "drops-it") x(1);\nif (o.mutation === "keeps-it") y();\n');
    expect((await scopeOf()).scope.mutations).toEqual([]);
    const r = await scopeOf({ uncommitted: true });
    expect(r.scope.mutations.map((s: { mutation: string }) => s.mutation)).toEqual(["drops-it", "keeps-it"]);
    git("checkout", "--", "build/src/a.ts");
  });

  it("finds a known coupling's check file and a changed proposed row", async () => {
    commit("harness/src/tests/two.ts", "// GA-X-2, changed\n");
    commit("build/proposed-rows.json", json({ rows: [{ mutation: "at-start", breaks: ["GA-PERSIST-1"], coupled: ["GA-X-9"] }] }));
    const r = await scopeOf();
    expect(r.scope.mutations).toEqual([
      { mutation: "keeps-it", reasons: ["the check file of GA-X-2 (harness/src/tests/two.ts)"] },
      { mutation: "at-start", reasons: ["its proposed-rows.json entry changed"] },
    ]);
  });

  it("puts in scope a mutation whose known-outside.json entry changed", async () => {
    const before = (await scopeOf()).scope.mutations.map((m: { mutation: string }) => m.mutation);
    commit("build/known-outside.json", json({ known: { "keeps-it": ["GA-X-2"], "drops-it": ["GA-X-3"] } }));
    const r = await scopeOf();
    expect(before).not.toContain("drops-it");
    expect(r.scope.mutations).toContainEqual({ mutation: "drops-it", reasons: ["its known-outside.json entry changed"] });
  });

  it("puts every mutation in scope for a change to the build's mutations.ts outside its MUTATIONS list only (I5)", async () => {
    const own = { shared: undefined };
    put("build/src/mutations.ts", 'export const MUTATIONS = [\n  "drops-it", "keeps-it", "at-start",\n] as const;\n');
    expect((await scopeOf({ uncommitted: true, ...own })).scope.mode).toBe("scoped");
    put("build/src/mutations.ts", 'export const MUTATIONS = ["drops-it", "keeps-it", "at-start"] as const;\nexport const x = 1;\n');
    const r = await scopeOf({ uncommitted: true, ...own });
    expect(r.scope.mode).toBe("shared");
    expect(r.scope.shared).toEqual(["build/src/mutations.ts (outside its MUTATIONS list)"]);
    git("checkout", "--", "build/src/mutations.ts");
  });

  it("reads the mutation files and sources of another head from git", async () => {
    git("checkout", "-qb", "other", "main");
    commit("build/subject.json", json({ standard: "applier", mutations: ["drops-it", "keeps-it", "is-new"] }));
    commit("build/src/n.ts", 'if (o.mutation === "is-new") n();\n');
    git("checkout", "-q", "work");
    const r = await scopeOf({ head: "other" });
    expect(r.changed).toEqual(["build/src/n.ts", "build/subject.json"]);
    expect(r.scope.mutations).toEqual([{ mutation: "is-new", reasons: ["a site in build/src/n.ts", "a new mutation"] }]);
    expect(r.siteCounts["is-new"]).toBe(1);
  });

  it("puts every mutation in scope for a change to the shared harness", async () => {
    commit("harness/src/home.ts", "// home, changed\n");
    const r = await scopeOf();
    expect(r.scope.mode).toBe("shared");
    expect(r.scope.mutations).toHaveLength(3);
  });

  it("leaves every mutation unscoped, saying why, for a base git cannot diff", async () => {
    const r = await scopeOf({ base: "no-such-ref" });
    expect(r.scope.mode).toBe("unscoped");
    expect(r.scope.why).toMatch(/^git cannot diff no-such-ref\.\.\.HEAD: /);
    expect(r.scope.mutations).toHaveLength(3);
  });

  it("takes git through the runner it is given", async () => {
    const calls: string[][] = [];
    const real = gitRunner(repo);
    const r = await scopeOf({ git: (args: string[]) => { calls.push(args); if (args[0] === "merge-base") throw new Error("refused"); return real(args); } });
    expect(r.scope.why).toBe("git cannot diff main...HEAD: refused");
    expect(calls.map((c) => c[0])).toEqual(["rev-parse", "merge-base"]);
  });
});

describe("the preflight's findings, from git", () => {
  const own = { shared: undefined };
  const fresh = (name: string) => git("checkout", "-qb", name, "main");

  it("puts in scope a mutation whose site moved out of a file, though it keeps one elsewhere (B1)", async () => {
    fresh("b1");
    put("build/src/a.ts", 'if (o.mutation === "drops-it") x();\n');
    commit("build/src/k.ts", 'if (o.mutation === "keeps-it") y();\n');
    const r = await scopeOf();
    expect(r.scope.mutations).toContainEqual({ mutation: "keeps-it", reasons: ["a site in build/src/a.ts", "a site in build/src/k.ts"] });
  });

  it("puts every mutation in scope for the build's graded ids, its verdict, its driver, and subject.json's other fields (B3)", async () => {
    for (const f of ["build/graded-ids.json", "build/scripts/matrix-verdict.mjs", "build/scripts/full-matrix.mjs"]) {
      fresh(`b3-${f.replace(/\W/g, "")}`);
      commit(f, "x\n");
      expect((await scopeOf(own)).scope).toMatchObject({ mode: "shared", shared: [f] });
    }
    fresh("b3-subject-mutations");
    commit("build/subject.json", json({ standard: "applier", mutations: ["drops-it", "keeps-it", "at-start-2"] }));
    expect((await scopeOf(own)).scope.mode).not.toBe("shared");
    fresh("b3-subject-fields");
    commit("build/subject.json", json({ standard: "applier", mutations: ["drops-it", "keeps-it"], start: { command: "node" } }));
    expect((await scopeOf(own)).scope).toMatchObject({ mode: "shared", shared: ["build/subject.json (a field other than its mutations)"] });
  });

  it("sees a renamed shared file as its old path, whatever git's settings (I1)", async () => {
    fresh("i1");
    git("mv", "harness/src/home.ts", "harness/src/home-x.ts");
    put("docs/é.md", "x\n");
    git("add", "-A");
    git("commit", "-qm", "rename");
    git("config", "diff.relative", "true");
    git("config", "diff.renames", "true");
    try {
      const r = await scopeOf();
      expect(r.changed).toEqual(["docs/é.md", "harness/src/home-x.ts", "harness/src/home.ts"]);
      expect(r.scope.mode).toBe("shared");
    } finally {
      git("config", "--unset", "diff.relative");
      git("config", "--unset", "diff.renames");
    }
  });

  it("lists untracked files from the top, inside the build and out, and warns of a dirty tree without --uncommitted (I2)", async () => {
    fresh("i2");
    put("build/src/zz.ts", 'if (o.mutation === "at-start") z();\n');
    put("elsewhere/new.txt", "x\n");
    try {
      const r = await scopeOf({ uncommitted: true });
      expect(r.changed).toEqual(["build/src/zz.ts", "elsewhere/new.txt"]);
      expect(r.scope.mutations).toEqual([{ mutation: "at-start", reasons: ["a site in build/src/zz.ts"] }]);
      expect(r.warnings).toEqual([]);
      const quiet = await scopeOf();
      expect(quiet.scope.mutations).toEqual([]);
      expect(quiet.warnings).toEqual(["the working tree has changes the scope leaves out: commit them, or pass --uncommitted"]);
    } finally {
      rmSync(join(repo, "build/src/zz.ts"));
      rmSync(join(repo, "elsewhere"), { recursive: true });
    }
  });

  it("falls back to every mutation, saying why, on what it cannot read (M1)", async () => {
    fresh("m1");
    put("build/proposed-rows.json", "{ not json");
    try {
      const r = await scopeOf({ uncommitted: true });
      expect(r.scope.mode).toBe("unscoped");
      expect(r.scope.why).toMatch(/JSON/);
    } finally {
      git("checkout", "--", "build/proposed-rows.json");
    }
    const thrown = await scopeOf({ checks: async () => { throw new Error("no registry"); } });
    expect(thrown.scope).toMatchObject({ mode: "unscoped", why: "no registry", of: 3 });
  });

  it("refuses --uncommitted with another head (M3)", async () => {
    await expect(scopeOf({ head: "main", uncommitted: true })).rejects.toThrow(/cannot go with another --head/);
  });
});

describe("the registry's check files and the shared harness, in this repository", () => {
  const top = realpathSync(execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: import.meta.dirname, encoding: "utf8" }).trim());
  const harness = relative(top, join(import.meta.dirname, ".."));

  it("maps each graded id to the source of the module that registers its test", async () => {
    const files = await checkFiles(top);
    expect(files["GA-BUS-8"]).toBe(`${harness}/src/tests/applier/bus.ts`);
    expect(files["GA-PERSIST-1"]).toMatch(new RegExp(`^${harness}/src/tests/applier/restarts\\.ts$`));
    expect(Object.values(files).every((f) => /\/src\/tests\/.+\.ts$/.test(f as string))).toBe(true);
  });

  it("refuses an id two modules register, and a test with no module (M2, M6)", async () => {
    const t = (ids: string[], file?: string) => ({ ids, opts: { seam: "applier" }, fn: async () => undefined, ...(file ? { file } : {}) });
    const f = (n: string) => join(import.meta.dirname, "..", "src", "tests", n);
    expect(await checkFiles(top, [t(["GA-1"], f("token.ts")), t(["GA-2"], f("util.ts"))])).toEqual({
      "GA-1": `${harness}/src/tests/token.ts`, "GA-2": `${harness}/src/tests/util.ts` });
    await expect(checkFiles(top, [t(["GA-1"], f("token.ts")), t(["GA-1"], f("util.ts"))])).rejects.toThrow(/GA-1 is registered by .* and /);
    await expect(checkFiles(top, [t(["GA-1"])])).rejects.toThrow(/no module for GA-1/);
  });

  it("names the shared harness's paths relative to the repository", () => {
    const sim = relative(top, join(import.meta.dirname, "..", "..", "sim"));
    const clock = relative(top, join(import.meta.dirname, "..", "..", "clock"));
    expect(sharedPaths(top, undefined, undefined, "reference/applier")).toEqual([`${harness}/src/home.ts`, `${harness}/src/runner.ts`,
      `${harness}/src/reach.ts`, `${harness}/scripts/reach.mjs`, `${sim}/`, `${harness}/src/subject.ts`, `${harness}/src/database.ts`,
      `${harness}/src/seams/`, `${clock}/`, `${harness}/src/ports.ts`, `${harness}/src/util.ts`, `${harness}/src/changed.ts`,
      `${harness}/scripts/changed.mjs`, `${harness}/src/registry.ts`, `${harness}/src/cli.ts`,
      `${relative(top, join(import.meta.dirname, "..", "..", "schemas"))}/`, "reference/applier/graded-ids.json",
      "reference/applier/scripts/matrix-verdict.mjs", "reference/applier/scripts/full-matrix.mjs", "pnpm-lock.yaml"]);
  });

  it("maps the imports among the harness's modules, the checks' into the rest of the harness too", () => {
    const imports = harnessImports(top);
    expect(imports[`${harness}/src/tests/applier/dispatch.ts`]).toContain(`${harness}/src/tests/token.ts`);
    expect(imports[`${harness}/src/tests/applier/dispatch.ts`]).toContain(`${harness}/src/assert.ts`);
    expect(Object.entries(imports).flatMap(([f, i]) => [f, ...(i as string[])]).every((f) => f.startsWith(`${harness}/src/`))).toBe(true);
  });

  it("shares every module a shared file imports, in the harness and as a package (B2)", () => {
    const imports = harnessImports(top);
    const stop = `${harness}/src/tests/`;
    for (const standard of ["applier", "steward"]) {
      const shared = sharedClosure(sharedPaths(top, sharedFor(standard), undefined, "reference/applier"), imports, stop);
      const isShared = (f: string) => shared.some((p: string) => (p.endsWith("/") ? f.startsWith(p) : f === p));
      for (const f of ["assert.ts", "context.ts", "report.ts", "manifest.ts", "interrupt.ts", "registry.ts"]) {
        expect(isShared(`${harness}/src/${f}`), f).toBe(true);
      }
      const packages = new Set(SHARED_PACKAGES);
      for (const f of Object.keys(imports).filter(isShared)) {
        for (const i of imports[f]!) if (!i.startsWith(stop)) expect(isShared(i), `${f} imports ${i}`).toBe(true);
        const text = readFileSync(join(top, f), "utf8");
        for (const m of text.matchAll(/from\s+["'](@ludentes\/galatea-life-[\w-]+)/g)) expect(packages.has(m[1]!), `${f} imports ${m[1]}`).toBe(true);
      }
    }
  });

  it("leaves out a shared package installed outside the repository", () => {
    expect(sharedPaths(top, [{ package: "x", path: "src/a.ts", why: "" }], () => tmpdir())).toEqual([]);
  });
});

// The preflight's probes A to J, each a detached commit on this checkout's HEAD made with plumbing (no
// branch, no change to the working tree), scoped against HEAD for the applier. They need the reference
// applier beside the harness, so they skip where the harness stands alone (the public standard repository).
const workshop = existsSync(join(import.meta.dirname, "..", "..", "..", "reference", "applier", "subject.json"));
describe.skipIf(!workshop)("the preflight's probes, on this repository", () => {
  const top = realpathSync(execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: import.meta.dirname, encoding: "utf8" }).trim());
  const index = join(mkdtempSync(join(tmpdir(), "galatea-changed-probe-")), "index");
  const env = { ...process.env, GIT_INDEX_FILE: index, GIT_AUTHOR_NAME: "p", GIT_AUTHOR_EMAIL: "p@example.invalid",
    GIT_COMMITTER_NAME: "p", GIT_COMMITTER_EMAIL: "p@example.invalid" };
  const g = (args: string[], input?: string) => execFileSync("git", args, { cwd: top, encoding: "utf8", env, input });
  afterAll(() => rmSync(dirname(index), { recursive: true, force: true }));
  type Edit = { file: string; edit: (t: string) => string } | { rename: [string, string] };
  const probe = (edits: Edit[]) => {
    g(["read-tree", "HEAD"]);
    for (const e of edits) {
      if ("rename" in e) {
        const [mode, sha] = g(["ls-files", "-s", e.rename[0]]).trim().split(/\s+/);
        g(["update-index", "--force-remove", e.rename[0]]);
        g(["update-index", "--add", "--cacheinfo", `${mode},${sha},${e.rename[1]}`]);
        continue;
      }
      const sha = g(["hash-object", "-w", "--stdin"], e.edit(g(["show", `HEAD:${e.file}`]))).trim();
      g(["update-index", "--add", "--cacheinfo", `100644,${sha},${e.file}`]);
    }
    return g(["commit-tree", g(["write-tree"]).trim(), "-p", "HEAD", "-m", "probe"]).trim();
  };
  const touch = (file: string) => ({ file, edit: (t: string) => `${t}\n// probe\n` });
  const scoped = async (edits: Edit[]) => (await scopeOfChange({ buildDir: join(top, "reference/applier"), base: "HEAD", head: probe(edits) })).scope;

  it("A: a site removed from one of a mutation's two files puts it in scope", async () => {
    const s = await scoped([{ file: "reference/applier/src/gate/plan.ts", edit: (t) => t.replace(/"toggles-to-reach-a-state"/, '"zz-probe"') }]);
    expect(s.mutations).toContainEqual({ mutation: "toggles-to-reach-a-state", reasons: ["a site in reference/applier/src/gate/plan.ts"] });
  });

  it.each([
    ["B", "conformance/harness/src/assert.ts"], ["C1", "conformance/harness/src/context.ts"], ["C2", "conformance/harness/src/cli.ts"],
    ["C3", "conformance/harness/src/report.ts"], ["C4", "conformance/harness/src/manifest.ts"], ["D", "conformance/schemas/src/index.ts"],
    ["E", "reference/applier/scripts/matrix-verdict.mjs"], ["E2", "reference/applier/scripts/full-matrix.mjs"],
    ["F", "reference/applier/graded-ids.json"],
  ])("%s: %s is shared", async (_, file) => {
    expect(await scoped([touch(file)])).toMatchObject({ mode: "shared", shared: [file] });
  });

  it("G: a shared file renamed is shared", async () => {
    expect((await scoped([{ rename: ["conformance/harness/src/runner.ts", "conformance/harness/src/runner-x.ts"] }])).mode).toBe("shared");
  });

  it("C5, H, I, J: the checks' index, the build's package.json, the subject's other code and the binding scope by their sites only", async () => {
    expect((await scoped([touch("conformance/harness/src/tests/index.ts")])).mutations).toEqual([]);
    expect((await scoped([{ file: "reference/applier/package.json", edit: (t) => `${t}\n` }])).mutations).toEqual([]);
    expect((await scoped([touch("reference/applier/src/main.ts")])).mutations.map((m) => m.mutation)).toEqual(["retains-request"]);
    expect((await scoped([touch("conformance/binding/src/index.ts")])).mutations).toEqual([]);
  });
});
