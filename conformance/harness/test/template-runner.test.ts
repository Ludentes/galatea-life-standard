import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { must } from "../src/assert.js";
import type { RequirementTest } from "../src/registry.js";
import { templateDatabase } from "../src/database.js";
import { closeOpenHomes } from "../src/home.js";
import { runNegatives, runSubject } from "../src/runner.js";

const fixtures = join(import.meta.dirname, "fixtures");
const test = (ids: string[], fn: RequirementTest["fn"]): RequirementTest => ({ ids, opts: { seam: "applier" }, fn });

/** A check that finds its database's tables already made, by stalling them all (a schema with none refuses). */
const findsTables = (id: string) => test([id], async (ctx) => {
  const release = await ctx.stallStore!();
  await release();
});

describe("an interrupted harness and a migrate still running", () => {
  it("closeOpenHomes kills the migrate's process group and drops the template", async () => {
    const dir = mkdtempSync(join(tmpdir(), "galatea-migrate-close-"));
    try {
      const dropped: string[] = [];
      const sql = async (_url: string, statements: string[]) => { dropped.push(...statements.filter((s) => s.startsWith("DROP DATABASE"))); return []; };
      const pending = templateDatabase("postgres://postgres@127.0.0.1:1/postgres", { command: "sh", args: ["-c", "echo $$ > pid; sleep 30"] }, dir, { sql })
        .catch((e: unknown) => e);
      for (let i = 0; i < 100 && !existsSync(join(dir, "pid")); i++) await new Promise((r) => setTimeout(r, 20));
      const pid = Number(readFileSync(join(dir, "pid"), "utf8"));
      await closeOpenHomes();
      expect(String(await pending)).toMatch(/interrupted/);
      await new Promise((r) => setTimeout(r, 100));
      expect(() => process.kill(pid, 0)).toThrow();
      expect(dropped).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe.skipIf(!process.env.GALATEA_TEST_PG_URL)("the runner and a subject's database.migrate, on a real Postgres", () => {
  it("migrates the template once per run, and every check's database is a clone that holds the tables", async () => {
    const dir = mkdtempSync(join(tmpdir(), "galatea-migrate-runs-"));
    process.env.MIGRATE_COUNT_FILE = join(dir, "count");
    try {
      const report = await runSubject({ subjectDir: join(fixtures, "migrating-subject"), workers: 2,
        tests: [findsTables("GA-DESC-1"), findsTables("GA-DESC-2"), findsTables("GA-PLAN-1")] });
      expect(report.harnessFault).toBeUndefined();
      expect(report.refused).toBeUndefined();
      expect(["GA-DESC-1", "GA-DESC-2", "GA-PLAN-1"].map((id) => report.rows.find((r) => r.id === id)?.state)).toEqual(["pass", "pass", "pass"]);
      expect(readFileSync(process.env.MIGRATE_COUNT_FILE, "utf8")).toBe("x");
    } finally {
      delete process.env.MIGRATE_COUNT_FILE;
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);

  it("migrates once for a negatives run too, and its tests run on clones", async () => {
    const dir = mkdtempSync(join(tmpdir(), "galatea-migrate-neg-"));
    process.env.MIGRATE_COUNT_FILE = join(dir, "count");
    try {
      const report = await runNegatives({ subjectDir: join(fixtures, "migrating-subject"), workers: 1,
        tests: [test(["GA-BIND-1"], async (ctx) => {
          const release = await ctx.stallStore!();
          await release();
          must(false, "fails under the mutation, after finding its tables");
        })] });
      expect(report.harnessFault).toBeUndefined();
      expect(report.refused).toBeUndefined();
      expect(report.negatives?.find((n) => n.mutation === "speaks-only-2025")?.state).toBe("pass");
      expect(readFileSync(process.env.MIGRATE_COUNT_FILE, "utf8")).toBe("x");
    } finally {
      delete process.env.MIGRATE_COUNT_FILE;
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);

  it("still gives a subject with database: true and no command a fresh, empty database per check", async () => {
    const report = await runSubject({ subjectDir: join(fixtures, "fresh-database-subject"), workers: 1,
      tests: [test(["GA-DESC-1"], async (ctx) => {
        const err = await ctx.stallStore!().then(() => undefined, (e: unknown) => e);
        must(err instanceof Error && /no table/.test(err.message), "a fresh database has no tables yet");
      })] });
    expect(report.harnessFault).toBeUndefined();
    expect(report.rows.find((r) => r.id === "GA-DESC-1")?.state).toBe("pass");
  }, 120_000);

  it("refuses the subject, with the command's last lines, when its migrate fails", async () => {
    process.env.MIGRATE_FAIL = "1";
    try {
      const report = await runSubject({ subjectDir: join(fixtures, "migrating-subject"), workers: 1, tests: [findsTables("GA-DESC-1")] });
      expect(report.harnessFault).toBeUndefined();
      expect(report.refused).toMatch(/database\.migrate exited 3.*the migration failed on purpose/);
      expect(report.rows).toEqual([]);
    } finally {
      delete process.env.MIGRATE_FAIL;
    }
  }, 120_000);
});
