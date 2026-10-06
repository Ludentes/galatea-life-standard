#!/usr/bin/env node
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exitOnInterrupt } from "./interrupt.js";
import { allIds } from "./manifest.js";
import { toMarkdown, type Report } from "./report.js";
import { runNegatives, runSubject, type RunOptions } from "./runner.js";
import "./tests/index.js";

const USAGE = "usage: galatea-harness run|negatives --subject <dir> [--ids <id,id>] [--complete] [--workers <n>] [--out <dir>]"
  + " (run only: [--coverage <dir>])";

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

export function writeReport(report: Report, out?: string): string {
  const dir = resolve(out ?? join(tmpdir(), "galatea-harness", report.runId));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${report.mode}.json`), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(dir, `${report.mode}.md`), toMarkdown(report));
  return dir;
}

export function exitCode(report: Report): number {
  if (report.harnessFault) return 2;
  return report.passed ? 0 : 1;
}

export interface Command {
  mode: "run" | "negatives";
  opts: RunOptions;
  out?: string;
}

/** The command line as a command, or undefined when it is not one (the usage line, exit 2). */
export function parseArgs(argv: string[]): Command | undefined {
  const [mode, ...args] = argv;
  const subjectDir = flag(args, "--subject");
  if ((mode !== "run" && mode !== "negatives") || !subjectDir) return undefined;
  if (args.includes("--ids") && !flag(args, "--ids")) return undefined;
  let workers: number | undefined;
  if (args.includes("--workers")) {
    const text = flag(args, "--workers") ?? "";
    workers = /^\d+$/.test(text) ? Number(text) : NaN;
    if (!Number.isInteger(workers) || workers < 1) return undefined;
  }
  // Coverage is a run's: the reach measure reads the clean run's, and a negatives job runs a mutation.
  if (args.includes("--coverage") && (mode !== "run" || !flag(args, "--coverage"))) return undefined;
  const opts: RunOptions = { subjectDir, ids: flag(args, "--ids")?.split(","), complete: args.includes("--complete"), workers,
    ...(args.includes("--coverage") ? { coverageDir: flag(args, "--coverage") } : {}) };
  return { mode, opts, out: flag(args, "--out") };
}

/** The ids of `--ids` that are in no manifest: a typo would otherwise test nothing and pass. */
export function unknownIds(ids: string[] | undefined): string[] {
  const known = allIds();
  return (ids ?? []).filter((id) => !known.has(id));
}

async function main(argv: string[]): Promise<number> {
  const command = parseArgs(argv);
  if (!command) {
    console.error(USAGE);
    return 2;
  }
  const unknown = unknownIds(command.opts.ids);
  if (unknown.length) {
    console.error(`--ids names ${unknown.join(", ")}, which is in no manifest`);
    console.error(USAGE);
    return 2;
  }
  const report = command.mode === "run" ? await runSubject(command.opts) : await runNegatives(command.opts);
  const dir = writeReport(report, command.out);
  console.log(toMarkdown(report));
  console.log(`Report: ${dir}`);
  return exitCode(report);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  exitOnInterrupt();
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
    console.error(err);
    process.exit(2);
  });
}
