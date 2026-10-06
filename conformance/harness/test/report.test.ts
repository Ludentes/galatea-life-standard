import { describe, expect, it } from "vitest";
import type { Requirement } from "../src/manifest.js";
import { baseRows, finish, toMarkdown, verdict, type Report } from "../src/report.js";

const req = (id: string, level: Requirement["level"], conformance: string, verify: Requirement["verify"] = "wire"): Requirement =>
  ({ id, level, conformance, verify, text: id, negative_subjects: [] });
const manifest = [req("GA-A-1", "MUST", "Act"), req("GA-A-2", "SHOULD", "Act"), req("GA-A-3", "MUST", "Safe"),
  req("GA-A-4", "MUST", "Act", "judged"), req("GA-A-5", "MUST", "Act")];

function report(states: Record<string, string>, mode: Report["mode"] = "run"): Report {
  const rows = baseRows(manifest, ["Act"]).map((r) => (states[r.id] ? { ...r, state: states[r.id] as never } : r));
  return finish({ mode, standard: "applier", subject: "s", runId: "r", claims: ["Act"], startedAt: "t", rows,
    coverage: { claimed: 0, tested: 0 }, passed: false });
}

describe("report", () => {
  it("starts rows by level and verification", () => {
    const rows = Object.fromEntries(baseRows(manifest, ["Act"]).map((r) => [r.id, r.state]));
    expect(rows).toEqual({ "GA-A-1": "untested", "GA-A-2": "untested", "GA-A-3": "not_claimed",
      "GA-A-4": "needs_judgement", "GA-A-5": "untested" });
  });

  it("fails on a MUST's fail, never on a SHOULD's", () => {
    expect(report({ "GA-A-1": "pass", "GA-A-2": "fail" }).passed).toBe(true);
    expect(report({ "GA-A-1": "fail" }).passed).toBe(false);
  });

  it("counts coverage, and --complete fails on untested", () => {
    const r = report({ "GA-A-1": "pass" });
    expect(r.coverage).toEqual({ claimed: 4, tested: 1 });
    expect(finish(r, { complete: true }).passed).toBe(false);
  });

  it("fails a refused run and a harness fault", () => {
    expect(finish({ ...report({}), refused: "no run id" }).passed).toBe(false);
    expect(finish({ ...report({}), harnessFault: "broker died" }).passed).toBe(false);
  });

  it("conforms only when the run and the negatives both passed", () => {
    const run = report({ "GA-A-1": "pass" });
    const neg = report({}, "negatives");
    expect(verdict(run, neg)).toBe("conforms");
    expect(verdict(run, { ...neg, passed: false })).toBe("does_not_conform");
    expect(verdict(neg, run)).toBe("does_not_conform");
  });

  it("prints covers beside pass", () => {
    const r = report({});
    r.rows[0] = { ...r.rows[0]!, state: "pass", covers: "the first clause" };
    expect(toMarkdown(r)).toContain("| GA-A-1 | MUST | Act | pass (covers: the first clause) |");
  });

  it("prints the wall time and the slowest tests", () => {
    const r = report({});
    r.rows[0] = { ...r.rows[0]!, state: "pass", ms: 2500 };
    expect(toMarkdown({ ...r, wallMs: 61_000 })).toContain("Took 61.0 s. Slowest: GA-A-1 2.5 s.");
  });
});
