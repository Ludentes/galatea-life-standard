// `run --coverage`: each check's subject writes V8 coverage into a directory of its own, and its row
// says how many instances it launched and how many ended on a signal (which write no coverage).
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { must } from "../src/assert.js";
import { conformanceRoot } from "../src/manifest.js";
import type { RequirementTest } from "../src/registry.js";
import { runSubject } from "../src/runner.js";
import { parseArgs } from "../src/cli.js";

const subjects = join(conformanceRoot, "sim", "subjects");
const diesOnSigterm = join(import.meta.dirname, "fixtures", "dies-on-sigterm");
const test = (ids: string[], fn: RequirementTest["fn"]): RequirementTest => ({ ids, opts: { seam: "applier" }, fn });
const scratch = mkdtempSync(join(tmpdir(), "galatea-coverage-test-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("coverage per check", () => {
  it("parses --coverage for run only", () => {
    expect(parseArgs(["run", "--subject", "x", "--coverage", "/c"])?.opts.coverageDir).toBe("/c");
    expect(parseArgs(["run", "--subject", "x", "--coverage"])).toBeUndefined();
    expect(parseArgs(["negatives", "--subject", "x", "--coverage", "/c"])).toBeUndefined();
  });

  it("gives each check a directory of coverage, and counts its launches and signalled ends", async () => {
    const dir = join(scratch, "cov");
    const report = await runSubject({
      subjectDir: join(subjects, "applier"),
      coverageDir: dir,
      workers: 1,
      tests: [
        test(["GA-DESC-1"], async (ctx) => must((await ctx.mcp!.callOk("describe")).levels.includes("Act"), "claims Act")),
        test(["GA-DESC-2"], async (ctx) => { await ctx.restartApplier!({ crash: true }); }),
        test(["GA-DESC-3"], async (ctx) => { await ctx.restartApplier!(); }),
      ],
    });
    expect(report.harnessFault).toBeUndefined();
    const row = (id: string) => report.rows.find((r) => r.id === id)!;
    expect(row("GA-DESC-1").coverage).toEqual({ dir: join(dir, "t1"), launches: 1, signalled: 0 });
    expect(row("GA-DESC-2").coverage).toEqual({ dir: join(dir, "t2"), launches: 2, signalled: 1 });
    expect(row("GA-DESC-3").coverage).toEqual({ dir: join(dir, "t3"), launches: 2, signalled: 0 });
    // A clean stop writes coverage; a SIGKILLed instance writes none.
    expect(readdirSync(join(dir, "t1")).filter((f) => f.startsWith("coverage-")).length).toBe(1);
    expect(readdirSync(join(dir, "t2")).filter((f) => f.startsWith("coverage-")).length).toBe(1);
    expect(readdirSync(join(dir, "t3")).filter((f) => f.startsWith("coverage-")).length).toBe(2);
  }, 120_000);

  it("counts a stop as signalled when the subject does not end itself on SIGTERM", async () => {
    const dir = join(scratch, "plain");
    const report = await runSubject({ subjectDir: diesOnSigterm, coverageDir: dir, workers: 1,
      tests: [test(["GA-DESC-1"], async () => undefined)] });
    expect(report.rows.find((r) => r.id === "GA-DESC-1")!.coverage).toEqual({ dir: join(dir, "t1"), launches: 1, signalled: 1 });
    // Node makes the directory only when it writes a file.
    expect(existsSync(join(dir, "t1"))).toBe(false);
  }, 120_000);

  it("leaves rows without coverage when it is not asked for", async () => {
    const report = await runSubject({ subjectDir: join(subjects, "applier"), workers: 1,
      tests: [test(["GA-DESC-1"], async () => undefined)] });
    expect(report.rows.find((r) => r.id === "GA-DESC-1")!.coverage).toBeUndefined();
  }, 120_000);
});
