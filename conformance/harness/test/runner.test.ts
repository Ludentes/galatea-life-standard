import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { freePort, TimeServer } from "@ludentes/galatea-life-sim";
import { describe, expect, it } from "vitest";
import { must, RequirementFailure } from "../src/assert.js";
import { conformanceRoot } from "../src/manifest.js";
import type { RequirementTest } from "../src/registry.js";
import { guard, startHomes, startOnSeam } from "../src/home.js";
import { EXIT_MUTATIONS, runNegatives, runSubject } from "../src/runner.js";
import { loadSubject } from "../src/subject.js";

const subjects = join(conformanceRoot, "sim", "subjects");
const fixtures = join(import.meta.dirname, "fixtures");
const test = (ids: string[], fn: RequirementTest["fn"]): RequirementTest => ({ ids, opts: { seam: "applier" }, fn });

describe("runner", () => {
  it("grades pass and fail per id, and leaves the rest untested", async () => {
    const report = await runSubject({
      subjectDir: join(subjects, "applier"),
      tests: [
        test(["GA-DESC-1"], async (ctx) => must((await ctx.mcp!.callOk("describe")).levels.includes("Act"), "claims Act")),
        test(["GA-DESC-2"], async () => must(false, "a deliberate failure")),
      ],
    });
    const state = (id: string) => report.rows.find((r) => r.id === id)?.state;
    expect(report.harnessFault).toBeUndefined();
    expect(state("GA-DESC-1")).toBe("pass");
    expect(state("GA-DESC-2")).toBe("fail");
    expect(state("GA-PLAN-1")).toBe("untested");
    expect(state("GA-META-1")).toBe("not_claimed");
    expect(report.passed).toBe(false);
  }, 120_000);

  it("records a proposed clause on its row, held or not, and never lets it change the row's state", async () => {
    const report = await runSubject({
      subjectDir: join(subjects, "applier"),
      tests: [
        test(["GA-DESC-1"], async (ctx) => { ctx.proposed!("same-command-same-id", false, "two ids"); }),
        test(["GA-DESC-2"], async (ctx) => { ctx.proposed!("same-command-same-id", true, "one id"); must(false, "a deliberate failure"); }),
        test(["GA-DESC-3"], async () => undefined),
      ],
    });
    const row = (id: string) => report.rows.find((r) => r.id === id);
    expect(report.harnessFault).toBeUndefined();
    expect([row("GA-DESC-1")?.state, row("GA-DESC-1")?.proposed]).toEqual(["pass", [{ clause: "same-command-same-id", held: false, note: "two ids" }]]);
    expect([row("GA-DESC-2")?.state, row("GA-DESC-2")?.proposed]).toEqual(["fail", [{ clause: "same-command-same-id", held: true, note: "one id" }]]);
    expect(row("GA-DESC-3")).not.toHaveProperty("proposed");
  }, 120_000);

  it("marks a failed row caught only when the test's body failed, not when the subject exited under it", async () => {
    const dir = mkdtempSync(join(tmpdir(), "galatea-exit-"));
    process.env.FIXTURE_EXIT_FILE = join(dir, "exit");
    try {
      const report = await runSubject({
        subjectDir: join(fixtures, "applier-exits-on-file"),
        workers: 1,
        tests: [
          test(["GA-DESC-2"], async () => must(false, "a deliberate failure")),
          test(["GA-PLAN-1"], async (ctx) => {
            writeFileSync(join(dir, "exit"), "");
            await new Promise((r) => setTimeout(r, 300));
            await ctx.mcp!.callOk("describe");
          }),
        ],
      });
      const row = (id: string) => report.rows.find((r) => r.id === id);
      expect(report.harnessFault).toBeUndefined();
      expect([row("GA-DESC-2")?.state, row("GA-DESC-2")?.caught]).toEqual(["fail", true]);
      expect([row("GA-PLAN-1")?.state, row("GA-PLAN-1")?.caught]).toEqual(["fail", false]);
      expect(row("GA-PLAN-1")?.error).toMatch(/^the subject exited during the test/);
    } finally {
      delete process.env.FIXTURE_EXIT_FILE;
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);

  it("refuses a subject that does not report the run id, and reports no id", async () => {
    const report = await runSubject({ subjectDir: join(subjects, "applier-without-run-id"), tests: [] });
    expect(report.refused).toMatch(/test_run_id/);
    expect(report.rows).toEqual([]);
    expect(report.passed).toBe(false);
  }, 60_000);

  it("reports a failure on the harness's side of the guard as a harness fault, not a refusal", async () => {
    const time = await TimeServer.start();
    const lane = { brokerUrl: `mqtt://127.0.0.1:${await freePort()}`, time, allowanceMs: 0 };
    try {
      const dir = join(subjects, "bridge");
      await expect(guard(lane, dir, loadSubject(dir), "run-x")).rejects.toThrow(/ECONNREFUSED/);
      const report = await runSubject({ subjectDir: dir, tests: [], homes: { lanes: [lane], close: async () => undefined } });
      expect(report.refused).toBeUndefined();
      expect(report.harnessFault).toMatch(/ECONNREFUSED/);
      expect(report.passed).toBe(false);
    } finally {
      await time.close();
    }
  }, 30_000);

  it("grades a bridge that ignores the test transport as failing the test, not as a harness fault", async () => {
    const report = await runSubject({
      subjectDir: join(fixtures, "bridge-ignores-transport"),
      tests: [{ ids: ["GA-BRIDGE-1"], opts: { seam: "bridge" }, fn: async (ctx) => {
        await ctx.transport!.send({ op: "join", device: "lamp", capabilities: ["onoff"], feedback: "closed" }, 1000);
      } }],
    });
    expect(report.harnessFault).toBeUndefined();
    const row = report.rows.find((r) => r.id === "GA-BRIDGE-1");
    expect(row?.state).toBe("fail");
    expect(row?.error).toMatch(/no reply to join/);
    expect(report.passed).toBe(false);
  }, 60_000);

  it("fails the setup, as the subject's, when the applier serves no MCP", async () => {
    const homes = await startHomes(1);
    try {
      const dir = join(fixtures, "echo-subject");
      const setup = startOnSeam(homes.lanes[0]!, dir, loadSubject(dir), test(["GA-DESC-1"], async () => undefined),
        { runId: "run-x", root: "demo/run-x/t1" });
      await expect(setup).rejects.toBeInstanceOf(RequirementFailure);
    } finally {
      await homes.close();
    }
  }, 60_000);

  it("removes each state directory once its subject has stopped, the guard's included", async () => {
    const dir = mkdtempSync(join(tmpdir(), "galatea-state-list-"));
    process.env.FIXTURE_STATE_FILE = join(dir, "dirs");
    try {
      let seen = false;
      const report = await runSubject({
        subjectDir: join(fixtures, "bridge-with-state"),
        tests: [{ ids: ["GA-BRIDGE-1"], opts: { seam: "bridge" }, fn: async (ctx) => {
          await ctx.subject.restart();
          const dirs = readFileSync(join(dir, "dirs"), "utf8").trim().split("\n");
          seen = existsSync(dirs.at(-1)!) && dirs.at(-1) === dirs.at(-2);
        } }],
      });
      expect(report.harnessFault).toBeUndefined();
      expect(seen).toBe(true);
      const dirs = readFileSync(join(dir, "dirs"), "utf8").trim().split("\n");
      expect(new Set(dirs).size).toBe(2);
      for (const d of dirs) expect(existsSync(d)).toBe(false);
    } finally {
      delete process.env.FIXTURE_STATE_FILE;
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  it("reports a test whose op the subject's transport refused as not_applicable, with the refusal as evidence", async () => {
    const report = await runSubject({
      subjectDir: join(subjects, "bridge"),
      tests: [{ ids: ["GA-BRIDGE-1"], opts: { seam: "bridge" }, fn: async (ctx) => {
        await ctx.transport!.send({ op: "link", carrier: true, gatewayAnswers: true });
      } }],
    });
    const row = report.rows.find((r) => r.id === "GA-BRIDGE-1");
    expect(report.harnessFault).toBeUndefined();
    expect(row?.state).toBe("not_applicable");
    expect(row?.evidence?.join(" ")).toMatch(/cannot play link/);
    expect(report.passed).toBe(true);
  }, 60_000);

  it("stops on a test that throws outside an assertion", async () => {
    const report = await runSubject({
      subjectDir: join(subjects, "applier"),
      tests: [test(["GA-DESC-1"], async () => { throw new TypeError("a harness bug"); })],
    });
    expect(report.harnessFault).toMatch(/a harness bug/);
  }, 60_000);

  it("refuses to run a registry with an unknown id", async () => {
    const report = await runSubject({ subjectDir: join(subjects, "applier"), tests: [test(["GA-NOPE-1"], async () => undefined)] });
    expect(report.harnessFault).toMatch(/GA-NOPE-1 is not in any manifest/);
  });

  it("does not count a mutation that stops the subject as caught", async () => {
    const report = await runNegatives({
      subjectDir: join(fixtures, "applier-exits-on-mutation"),
      tests: [test(["GA-PLAN-1"], async () => must(false, "fails under the mutation"))],
    });
    const n = report.negatives?.find((m) => m.mutation === "plans-with-side-effect");
    expect(report.harnessFault).toBeUndefined();
    expect(n?.state).toBe("fail");
    expect(n?.failed).toEqual([]);
    expect(n?.detail).toMatch(/the mutation stopped the subject in GA-PLAN-1/);
    expect(n?.errors?.["GA-PLAN-1"]).toMatch(/exited/);
    expect(report.passed).toBe(false);
  }, 120_000);

  it("does not count a mutation whose subject exits during the test's body as caught", async () => {
    // Under the mutation, the fixture SIGKILLs the applier once the body creates FIXTURE_EXIT_FILE,
    // so the body's next call meets a dead subject (a SubjectFault) inside the body, not in setup.
    const dir = mkdtempSync(join(tmpdir(), "galatea-exit-"));
    process.env.FIXTURE_EXIT_FILE = join(dir, "exit");
    try {
      const report = await runNegatives({
        subjectDir: join(fixtures, "applier-exits-mid-test"),
        tests: [test(["GA-PLAN-1"], async (ctx) => {
          writeFileSync(join(dir, "exit"), "");
          await new Promise((r) => setTimeout(r, 300));
          await ctx.mcp!.callOk("describe");
        })],
      });
      const n = report.negatives?.find((m) => m.mutation === "plans-with-side-effect");
      expect(report.harnessFault).toBeUndefined();
      expect(n?.state).toBe("fail");
      expect(n?.failed).toEqual([]);
      expect(n?.stopped).toEqual(["GA-PLAN-1"]);
      expect(n?.errors?.["GA-PLAN-1"]).toMatch(/^the subject exited during the test/);
      expect(report.passed).toBe(false);
    } finally {
      delete process.env.FIXTURE_EXIT_FILE;
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);

  it("counts a subject's exit as caught under a mutation whose fault is the exit", async () => {
    // The applier's table names no such mutation: the fixture's stands in for the bridge's exits-on-fault.
    const dir = mkdtempSync(join(tmpdir(), "galatea-exit-"));
    process.env.FIXTURE_EXIT_FILE = join(dir, "exit");
    EXIT_MUTATIONS.applier.push("plans-with-side-effect");
    try {
      const report = await runNegatives({
        subjectDir: join(fixtures, "applier-exits-mid-test"),
        tests: [test(["GA-PLAN-1"], async (ctx) => {
          writeFileSync(join(dir, "exit"), "");
          await new Promise((r) => setTimeout(r, 300));
          await ctx.mcp!.callOk("describe");
        })],
      });
      const n = report.negatives?.find((m) => m.mutation === "plans-with-side-effect");
      expect(report.harnessFault).toBeUndefined();
      expect(n?.state).toBe("pass");
      expect(n?.failed).toEqual(["GA-PLAN-1"]);
      expect(n?.stopped).toBeUndefined();
      expect(n?.errors?.["GA-PLAN-1"]).toMatch(/^the subject exited during the test/);
    } finally {
      EXIT_MUTATIONS.applier.splice(EXIT_MUTATIONS.applier.indexOf("plans-with-side-effect"), 1);
      delete process.env.FIXTURE_EXIT_FILE;
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);

  it("times each negative job on the rows of the ids its mutation breaks", async () => {
    const report = await runNegatives({
      subjectDir: join(subjects, "applier"),
      tests: [test(["GA-PLAN-1"], async () => must(false, "fails under the mutation"))],
    });
    const row = report.rows.find((r) => r.id === "GA-PLAN-1");
    expect(report.harnessFault).toBeUndefined();
    expect(report.negatives?.find((n) => n.mutation === "plans-with-side-effect")?.state).toBe("pass");
    expect(row?.state).toBe("pass");
    expect(row?.ms).toBeGreaterThan(0);
    expect(report.wallMs).toBeGreaterThan(0);
  }, 120_000);
});
