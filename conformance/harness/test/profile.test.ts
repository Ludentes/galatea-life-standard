// The harness's profile scripts: `scripts/postgres-profile.mjs` (statements folded across databases)
// and `scripts/matrix-timing.mjs`. `tools/profile-lib.mjs` is tested beside it.
import { describe, expect, it } from "vitest";
import { addHarvest, newFold, normalise, postgresReport, renderPostgres, statementKind } from "../scripts/postgres-profile.mjs";
import { timingLines } from "../scripts/matrix-timing.mjs";

describe("Postgres's view", () => {
  it("makes the per-check databases' names one and never keeps a password", () => {
    expect(normalise("CREATE ROLE galatea_0123456789abcdef0123456789abcdef LOGIN PASSWORD 'abc-123'"))
      .toBe("CREATE ROLE galatea_<id> LOGIN PASSWORD '<redacted>'");
  });
  it.each([
    ["CREATE DATABASE galatea_<id>", "CREATE DATABASE"],
    ["DROP DATABASE IF EXISTS galatea_<id> WITH (FORCE)", "DROP DATABASE"],
    ["DO $$ BEGIN CREATE ROLE reader NOLOGIN; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END $$", "roles"],
    ["CREATE SCHEMA galatea_<id> AUTHORIZATION galatea_<id>", "CREATE SCHEMA (harness)"],
    ["CREATE TABLE IF NOT EXISTS migrations (name text PRIMARY KEY)", "migrations"],
    ["INSERT INTO migrations (name) VALUES ($1)", "migrations"],
    ["CREATE INDEX x ON y (z)", "migrations"],
    ["BEGIN", "transaction control"],
    ["SELECT pg_stat_statements_reset()", "profiler"],
    ["SELECT * FROM devices WHERE id = $1", "queries (subjects and harness)"],
  ])("%s is %s", (q, kind) => {
    expect(statementKind(q)).toBe(kind);
  });
  it("folds a statement across databases and harvests, and keeps each database's last counters", () => {
    const fold = newFold();
    const a = "galatea_" + "a".repeat(32);
    const b = "galatea_" + "b".repeat(32);
    addHarvest(fold, { statements: [{ q: `CREATE DATABASE ${a}`, calls: 1, total: 30, rows: 0, walb: 1000 },
      { q: "SELECT 1", calls: 10, total: 5, rows: 10 }], dealloc: 0,
    databases: [{ datid: 5, xact_commit: 10 }, { datid: 6, xact_commit: 3 }] });
    addHarvest(fold, { statements: [{ q: `CREATE DATABASE ${b}`, calls: 1, total: 50, rows: 0, walb: 3000 }], dealloc: 2,
      databases: [{ datid: 5, xact_commit: 12 }] });
    const r = postgresReport(fold, { wallS: 10, cgroup: { usage_usec: "4000000", user_usec: "3000000", system_usec: "1000000" } });
    expect(r.kinds[0]).toMatchObject({ kind: "CREATE DATABASE", statements: 1, calls: 2, totalMs: 80, meanMs: 40, walBytes: 4000, share: 94.1 });
    expect(r.statements[0]).toMatchObject({ text: "CREATE DATABASE galatea_<id>", calls: 2, totalMs: 80 });
    expect(r.databases).toMatchObject({ xact_commit: 15, seen: 2 });
    expect(r.dealloc).toBe(2);
    expect(r.harvests).toBe(2);
    expect(r.container).toMatchObject({ cpuS: 4, userS: 3, systemS: 1, meanCores: 0.4 });
    expect(renderPostgres(r, "/d")).toContain("| CREATE DATABASE | 1 | 2 | 0.1 | 40 | 94.1% | 0 |");
  });
});

describe("the matrix's timing lines", () => {
  it("gives the wall, each lane's runs and databases, and the slowest ids by mean", () => {
    const report = (ms: Record<string, number>, database?: object) => ({ rows: Object.entries(ms).map(([id, m]) => ({ id, ms: m })), database });
    const lines = timingLines({ wallMs: 100_000, lanes: 2, top: 2, profile: ["Profile: /d"], runs: [
      { lane: 0, wallMs: 40_000, report: report({ A: 1000, B: 4000, C: 100 }, { creates: 10, createMs: 2000, drops: 10, dropMs: 1000 }) },
      { lane: 1, wallMs: 60_000, report: report({ A: 3000, B: 2000, C: 300 }, { creates: 20, createMs: 6000, drops: 20, dropMs: 4000 }) },
      { lane: 0, wallMs: 50_000, report: undefined },
    ] });
    expect(lines).toEqual(["",
      "Timing: wall 100.0 s, 3 runs on 2 lanes.",
      "Run wall: min 40.0 s, median 50.0 s, max 60.0 s.",
      "Lane 1: 2 runs, busy 90.0 s; databases 10 made in 2.0 s (mean 200 ms), 10 dropped in 1.0 s (mean 100 ms).",
      "Lane 2: 1 runs, busy 60.0 s; databases 20 made in 6.0 s (mean 300 ms), 20 dropped in 4.0 s (mean 200 ms).",
      "Slowest ids (mean over runs): B 3.0 s, A 2.0 s.",
      "Profile so far:", "  Profile: /d"]);
  });
  it("counts the checks a skipping matrix ran and skipped under its mutations", () => {
    const lines = timingLines({ wallMs: 10_000, lanes: 1, runs: [], checks: [
      { mutation: "a", ran: 10, of: 90 }, { mutation: "b", ran: 30, of: 90 }, { mutation: "c", ran: 90, of: 90 }] });
    expect(lines).toContain("Checks under the mutations: 130 run, 140 skipped, of 270 (48%); per mutation min 10, median 30, max 90.");
  });
});
