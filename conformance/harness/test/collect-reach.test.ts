// `scripts/reach.mjs`: a covered run's report and its real V8 coverage, to a stored reach, added to
// the store's reach of the same build.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
// @ts-expect-error a script without types
import { collectReach } from "../scripts/reach.mjs";

const build = join(import.meta.dirname, "fixtures", "reach-build");
const scratch = mkdtempSync(join(tmpdir(), "galatea-collect-reach-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
const mutations = ["drops-it", "at-start"];

/** Runs the build with coverage into `dir`, as a check's subject would. */
const cover = (dir: string, deep: boolean) =>
  execFileSync(process.execPath, [join(build, "dist", "main.js"), ...(deep ? ["deep"] : [])], { env: { ...process.env, NODE_V8_COVERAGE: dir } });
const row = (id: string, dir: string, o = {}) => ({ id, state: "pass", coverage: { dir, launches: 1, signalled: 0, ...o } });

describe("collecting a reach", () => {
  it("maps each check's coverage to its mutations, stores it, and adds a later run of the build to it", () => {
    cover(join(scratch, "r1", "t1"), false);
    cover(join(scratch, "r1", "t2"), true);
    const store = join(scratch, "store");
    const report = { standard: "applier", rows: [row("GA-1", join(scratch, "r1", "t1")), row("GA-2", join(scratch, "r1", "t2")),
      row("GA-3", join(scratch, "r1", "t3"), { launches: 2, signalled: 1 }), { id: "GA-4", state: "not_claimed" }] };
    const first = collectReach({ buildDir: build, report, store, out: join(scratch, "out1"), mutations, own: { "drops-it": ["GA-2"] },
      known: { "drops-it": ["GA-1"] }, commit: "c1" });
    expect(first.problems).toEqual([]);
    expect(first.reach.observed).toEqual({ "GA-1": ["at-start"], "GA-2": ["drops-it", "at-start"], "GA-3": [] });
    expect(first.reach.guards.startup).toEqual(["at-start"]);
    expect(first.reach.reach["GA-3"]).toEqual(mutations);
    expect(first.misses).toEqual([{ mutation: "drops-it", id: "GA-1", source: "known" }]);
    expect(JSON.parse(readFileSync(first.file, "utf8")).runs).toBe(1);
    expect(existsSync(join(scratch, "out1", "reach.md"))).toBe(true);

    cover(join(scratch, "r2", "t1"), true);
    const second = collectReach({ buildDir: build, report: { standard: "applier", rows: [row("GA-1", join(scratch, "r2", "t1"))] },
      store, out: join(scratch, "out2"), mutations, own: {}, known: {}, commit: "c2" });
    expect(second.file).toBe(first.file);
    expect(second.reach.runs).toBe(2);
    expect(second.reach.observed["GA-1"]).toEqual(["drops-it", "at-start"]);
  });

  it("stores a full matrix's run alone, and counts an unreadable store as empty, with a warning", () => {
    const store = join(scratch, "store5");
    const report = { standard: "applier", rows: [row("GA-1", join(scratch, "r1", "t2"))] };
    const args = { buildDir: build, report, store, out: join(scratch, "out6"), mutations, own: {}, known: {}, commit: "c" };
    collectReach(args);
    expect(collectReach(args).reach.runs).toBe(2);
    expect(collectReach({ ...args, reset: true }).reach.runs).toBe(1);
    writeFileSync(join(store, "applier.json"), "{ torn");
    const r = collectReach(args);
    expect(r.reach.runs).toBe(1);
    expect(r.warnings[0]).toMatch(/cannot be read .* counts as empty/);
    expect(JSON.parse(readFileSync(join(store, "applier.json"), "utf8")).runs).toBe(1);
  });

  it("counts the coverage files that hold the entry: fewer than the instances that ended themselves is class P", () => {
    const report = { standard: "applier", rows: [row("GA-1", join(scratch, "r1", "t1"), { launches: 2 })] };
    const r = collectReach({ buildDir: build, report, store: join(scratch, "store6"), out: join(scratch, "out7"), mutations, own: {},
      known: {}, commit: "c" });
    expect(r.reach.guards.classP).toEqual({ "GA-1": "1 of 2 instances wrote coverage" });
  });

  it("keeps both runs' pairs when two merge into one store at once: the store is locked around its read and write", async () => {
    cover(join(scratch, "c1", "t1"), true);
    cover(join(scratch, "c2", "t1"), false);
    const store = join(scratch, "store-race");
    // Each merge holds the store 500 ms between its read and its write: unlocked, the later write loses the earlier run.
    // Each run grades GA-1 and GA-2, and reaches drops-it in one of them: the other run's in the other.
    const merge = (name: string, deep: string, shallow: string) => new Promise<number>((resolve) => {
      const code = `import { collectReach } from ${JSON.stringify(join(import.meta.dirname, "..", "scripts", "reach.mjs"))};
        collectReach({ buildDir: ${JSON.stringify(build)}, report: { standard: "applier", rows: [
          { id: ${JSON.stringify(deep)}, state: "pass", coverage: { dir: ${JSON.stringify(join(scratch, "c1", "t1"))}, launches: 1, signalled: 0 } },
          { id: ${JSON.stringify(shallow)}, state: "pass", coverage: { dir: ${JSON.stringify(join(scratch, "c2", "t1"))}, launches: 1, signalled: 0 } }] },
          store: ${JSON.stringify(store)}, out: ${JSON.stringify(join(scratch, `out-${name}`))}, mutations: ${JSON.stringify(mutations)}, own: {}, known: {}, commit: "c",
          mergeDelayMs: 500 });`;
      spawn(process.execPath, ["--input-type=module", "-e", code], { stdio: "inherit" }).on("exit", (c) => resolve(c ?? 1));
    });
    expect(await Promise.all([merge("a", "GA-1", "GA-2"), merge("b", "GA-2", "GA-1")])).toEqual([0, 0]);
    const r = JSON.parse(readFileSync(join(store, "applier.json"), "utf8"));
    expect(r.runs).toBe(2);
    expect(r.observed).toEqual({ "GA-1": ["drops-it", "at-start"], "GA-2": ["drops-it", "at-start"] });
    expect(existsSync(join(store, "applier.json.lock"))).toBe(false);
  }, 30_000);

  it("takes over a lock its holder left behind when it died", () => {
    const store = join(scratch, "store-stale");
    mkdirSync(store, { recursive: true });
    // A pid no process has: the holder is gone.
    writeFileSync(join(store, "applier.json.lock"), "2147483646\n");
    const r = collectReach({ buildDir: build, report: { standard: "applier", rows: [row("GA-1", join(scratch, "r1", "t1"))] }, store,
      out: join(scratch, "out-stale"), mutations, own: {}, known: {}, commit: "c" });
    expect(r.file).toBe(join(store, "applier.json"));
    expect(existsSync(join(store, "applier.json.lock"))).toBe(false);
  });

  it("counts every site of the entry module as wired at start-up", () => {
    const r = collectReach({ buildDir: build, report: { standard: "applier", rows: [] }, store: join(scratch, "store3"),
      out: join(scratch, "out4"), mutations, own: {}, known: {}, commit: "c", entry: "run.js" });
    expect(r.reach.guards.startup).toEqual(mutations);
  });

  it("counts no site of a module no check loaded as wired at start-up", () => {
    const r = collectReach({ buildDir: build, report: { standard: "applier", rows: [] }, store: join(scratch, "store4"),
      out: join(scratch, "out5"), mutations, own: {}, known: {}, commit: "c" });
    expect(r.reach.guards.startup).toEqual([]);
  });

  it("stores nothing when the lint fails", () => {
    const r = collectReach({ buildDir: build, report: { standard: "applier", rows: [] }, store: join(scratch, "store2"),
      out: join(scratch, "out3"), mutations: [...mutations, "never-read"], own: {}, known: {}, commit: "c" });
    expect(r.problems).toEqual(["never-read has no site in the sources"]);
    expect(r.file).toBeUndefined();
    expect(existsSync(join(scratch, "store2"))).toBe(false);
  });
});
