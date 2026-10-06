import type { Requirement } from "./manifest.js";

export type RowState = "pass" | "fail" | "not_claimed" | "not_applicable" | "untested" | "needs_judgement";

export interface Row {
  id: string;
  level: Requirement["level"];
  conformance: string;
  verify: Requirement["verify"];
  state: RowState;
  covers?: string;
  ms?: number;
  evidence?: string[];
  error?: string;
  /**
   * On a failed row of a run: true when the test's body failed (a RequirementFailure), false when the
   * subject did not start, did not come back ready, failed the setup or exited unasked: a failure
   * that proves nothing about the requirement (the matrix's negatives).
   */
  caught?: boolean;
  /**
   * The clauses proposed for the standard's next revision that the test judged (`TestContext.proposed`):
   * whether the subject held each. None changes the row's state.
   */
  proposed?: { clause: string; held: boolean; note: string }[];
  /**
   * A run with `--coverage`: the directory the check's subjects wrote V8 coverage into, their launches,
   * and how many ended on a signal and so wrote none (a crash, or a stop that needed SIGKILL).
   */
  coverage?: { dir: string; launches: number; signalled: number };
}

export interface NegativeResult {
  mutation: string;
  broken: string[];
  coupled: string[];
  state: "pass" | "fail" | "untested";
  /** Ids whose tests' bodies failed under the mutation: the mutation was caught there. */
  failed: string[];
  /** Ids whose tests failed without the body failing: the mutation stopped the subject. */
  stopped?: string[];
  /** Why each id failed under the mutation: the error of its test, caught or not. */
  errors?: Record<string, string>;
  detail: string;
}

export interface Report {
  mode: "run" | "negatives";
  standard: string;
  subject: string;
  runId: string;
  claims: string[];
  startedAt: string;
  rows: Row[];
  negatives?: NegativeResult[];
  refused?: string;
  harnessFault?: string;
  coverage: { claimed: number; tested: number };
  passed: boolean;
  /** Real time the command took, from the home's start to its close. */
  wallMs?: number;
  /** The harness's waits on its test databases over the run (`databaseTimes`), when it made any. */
  database?: { creates: number; createMs: number; drops: number; dropMs: number };
}

export function baseRows(manifest: Requirement[], claims: string[]): Row[] {
  return manifest.map((r) => ({
    id: r.id,
    level: r.level,
    conformance: r.conformance,
    verify: r.verify,
    state: !claims.includes(r.conformance) ? "not_claimed" : r.verify === "judged" ? "needs_judgement" : "untested",
  }));
}

export function finish(report: Report, opts: { complete?: boolean } = {}): Report {
  const claimed = report.rows.filter((r) => r.state !== "not_claimed" && r.state !== "not_applicable");
  const tested = claimed.filter((r) => r.state === "pass" || r.state === "fail");
  const mustFailed = claimed.some((r) => r.state === "fail" && r.level === "MUST");
  const untested = claimed.some((r) => r.state === "untested");
  const negativeFailed = (report.negatives ?? []).some((n) => n.state === "fail" || (opts.complete && n.state === "untested"));
  return {
    ...report,
    coverage: { claimed: claimed.length, tested: tested.length },
    passed: !report.refused && !report.harnessFault && !mustFailed && !negativeFailed && !(opts.complete && untested),
  };
}

export function verdict(run: Report, negatives: Report): "conforms" | "does_not_conform" {
  return run.mode === "run" && negatives.mode === "negatives" && run.passed && negatives.passed ? "conforms" : "does_not_conform";
}

function cell(r: Row): string {
  if (r.state === "pass" && r.covers) return `pass (covers: ${r.covers})`;
  if (r.state === "fail" && r.error) return `fail: ${r.error.replace(/\|/g, "\\|").replace(/\n/g, " ")}`;
  return r.state;
}

export function toMarkdown(report: Report): string {
  const lines = [
    `# ${report.mode === "run" ? "Run" : "Negatives"}: ${report.subject} (${report.standard})`,
    "",
    `Run id \`${report.runId}\`, claims ${report.claims.join(", ")}, started ${report.startedAt}.`,
    "",
    `**${report.passed ? "Passed" : "Failed"}.** Tested ${report.coverage.tested} of ${report.coverage.claimed} claimed ids.`,
  ];
  if (report.wallMs !== undefined) {
    const slow = report.rows.filter((r) => r.ms !== undefined).sort((a, b) => b.ms! - a.ms!).slice(0, 5);
    const list = slow.map((r) => `${r.id} ${(r.ms! / 1000).toFixed(1)} s`).join(", ") || "none";
    lines.push("", `Took ${(report.wallMs / 1000).toFixed(1)} s. Slowest: ${list}.`);
  }
  if (report.refused) lines.push("", `Refused: ${report.refused}. No id is reported.`);
  if (report.harnessFault) lines.push("", `Harness fault: ${report.harnessFault}.`);
  if (report.negatives?.length) {
    lines.push("", "| Mutation | Breaks | State | Failed | Detail |", "|---|---|---|---|---|");
    for (const n of report.negatives) {
      lines.push(`| \`${n.mutation}\` | ${n.broken.join(", ")} | ${n.state} | ${n.failed.join(", ") || "—"} | ${n.detail} |`);
    }
  }
  const shown = report.rows.filter((r) => r.state !== "not_claimed" && r.state !== "untested");
  if (shown.length) {
    lines.push("", "| Id | Level | Conf. | State |", "|---|---|---|---|");
    for (const r of shown) lines.push(`| ${r.id} | ${r.level} | ${r.conformance} | ${cell(r)} |`);
  }
  return `${lines.join("\n")}\n`;
}
