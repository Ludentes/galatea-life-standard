import { fileURLToPath } from "node:url";
import type { BridgeFaults } from "@ludentes/galatea-life-sim";
import type { TestContext } from "./context.js";

export type Seam = "bridge" | "applier" | "steward";

export interface FixtureSpec {
  /** Fixture devices by name, or with the `connections` their `devices` entry gives (slice 5b). */
  devices?: (string | { id: string; connections?: string[] })[];
  faults?: BridgeFaults;
  /**
   * The fixture bridge's claimed levels (`["Serve"]` by default), its `bridgeType`, and its transport's
   * `connections` (none by default).
   */
  bridge?: { levels?: string[]; bridgeType?: string; transportConnections?: string[] };
  /** Applier seam: the harness's simulated finder on the test's root, started before the subject. */
  finder?: boolean;
}

export interface TestOptions {
  seam: Seam;
  /** Which clause the test checks, when it checks less than the whole requirement. */
  covers?: string;
  fixture?: FixtureSpec;
  /**
   * Steward seam: the stand-in served with `tls` on the host's other address, with a certificate the
   * steward is not told to trust (GA-SEC-2); the baseline house is then not defined, since the
   * steward never reaches it.
   */
  standIn?: { tls?: boolean };
  timeoutMs?: number;
}

export interface RequirementTest {
  ids: string[];
  opts: TestOptions;
  fn: (ctx: TestContext) => Promise<void>;
  /**
   * The module that registered the test, as a path: its check file (built, or the source under
   * vitest). The change-scoped matrix maps a graded id to it (`changed.ts`).
   */
  file?: string;
}

const tests: RequirementTest[] = [];

export function requirement(ids: string | string[], opts: TestOptions, fn: (ctx: TestContext) => Promise<void>): void {
  const file = callerFile(new Error().stack ?? "");
  tests.push({ ids: Array.isArray(ids) ? ids : [ids], opts, fn, ...(file ? { file } : {}) });
}

/**
 * The first module in `stack` other than this one: the one that called `requirement`. This module may
 * show as built or, source-mapped (under vitest), as its source.
 */
export function callerFile(stack: string, self: string = import.meta.url): string | undefined {
  const same = (path: string) => path.replace(/\/dist\/(.+)\.js$/, "/src/$1.ts");
  const me = same(fileURLToPath(self));
  for (const line of stack.split("\n")) {
    // A V8 frame: `at <function> (<location>)` or `at <location>`, the location ending `:<line>:<column>`.
    // The function never holds " (", so the location is all after the first; a path may hold spaces.
    const frame = line.match(/^\s*at (.*)$/)?.[1];
    if (!frame) continue;
    const open = frame.indexOf(" (");
    const location = open >= 0 && frame.endsWith(")") ? frame.slice(open + 2, -1) : frame;
    const path = location.match(/^(.*):\d+:\d+$/)?.[1];
    if (!path || !(path.startsWith("file://") || path.startsWith("/"))) continue;
    const at = path.startsWith("file://") ? fileURLToPath(path) : path;
    if (same(at) !== me) return at;
  }
  return undefined;
}

export function registered(): RequirementTest[] {
  return [...tests];
}

export function clearRegistry(): void {
  tests.length = 0;
}

/** The harness refuses to run with a test for an unknown id, or two tests for one id. */
export function checkRegistry(known: Set<string>, list: RequirementTest[] = tests): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const t of list) {
    for (const id of t.ids) {
      if (!known.has(id)) errors.push(`${id} is not in any manifest`);
      if (seen.has(id)) errors.push(`${id} has two tests`);
      seen.add(id);
    }
  }
  return errors;
}
