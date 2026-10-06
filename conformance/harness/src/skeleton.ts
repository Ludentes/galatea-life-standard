import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { exitCode, writeReport } from "./cli.js";
import { startHomes } from "./home.js";
import { exitOnInterrupt } from "./interrupt.js";
import { toMarkdown, type Report } from "./report.js";
import { runNegatives, runSubject } from "./runner.js";
import "./tests/index.js";

exitOnInterrupt();
// The stand-ins' subjects, shipped in the sim package beside its dist/.
const subjects = fileURLToPath(new URL("../subjects", import.meta.resolve("@ludentes/galatea-life-sim")));
const homes = await startHomes().catch((err) => {
  console.error(`the simulated home did not start: ${err}`);
  process.exit(2);
});

const negativePasses = (mutation: string) => (r: Report) =>
  r.passed && !!r.negatives?.some((n) => n.mutation === mutation && n.state === "pass");

/**
 * The ids the minimal simulated applier is built to pass; the reference applier proves the rest. It keeps
 * nothing across a restart, so GA-APPLY-4, whose test restarts the subject (slice 7a), is not among them.
 */
const STAND_IN_APPLIER_IDS = ["GA-APPLY-2", "GA-BIND-1", "GA-BUS-14", "GA-DESC-1", "GA-EVT-3", "GA-HARN-1", "GA-PLAN-1"];

const checks: { name: string; run: () => Promise<Report>; ok: (r: Report) => boolean }[] = [
  { name: "the simulated bridge's run", run: () => runSubject({ subjectDir: join(subjects, "bridge"), homes }),
    ok: (r) => r.passed && r.coverage.tested >= 3 },
  { name: "the simulated bridge's negatives", run: () => runNegatives({ subjectDir: join(subjects, "bridge"), homes }),
    ok: negativePasses("stamps-publication-time") },
  { name: "the simulated applier's run", run: () => runSubject({ subjectDir: join(subjects, "applier"), homes, ids: STAND_IN_APPLIER_IDS }),
    ok: (r) => r.passed && r.coverage.tested >= 7 },
  { name: "the simulated applier's negatives", run: () => runNegatives({ subjectDir: join(subjects, "applier"), homes }),
    ok: (r) => negativePasses("plans-with-side-effect")(r) && negativePasses("speaks-only-2025")(r) },
  { name: "the run-id guard", run: () => runSubject({ subjectDir: join(subjects, "applier-without-run-id"), homes }),
    ok: (r) => !!r.refused && r.rows.length === 0 && !r.harnessFault },
];

let worst = 0;
const t0 = Date.now();
try {
  for (const check of checks) {
    const report = await check.run();
    const ok = check.ok(report);
    console.log(toMarkdown(report));
    console.log(`${ok ? "✓" : "✗"} ${check.name} (report: ${writeReport(report)})\n`);
    if (!ok) worst = Math.max(worst, report.harnessFault ? 2 : 1);
    else if (exitCode(report) === 2) worst = 2;
  }
} catch (err) {
  console.error(`the skeleton stopped on a harness fault: ${err instanceof Error ? err.stack : err}`);
  worst = 2;
} finally {
  await homes.close().catch((err) => {
    console.error(`the simulated home did not close: ${err}`);
    worst = 2;
  });
}
console.log(`${worst === 0 ? "The walking skeleton passes" : "The walking skeleton does not pass"}, in ${((Date.now() - t0) / 1000).toFixed(1)} s.`);
process.exit(worst);
