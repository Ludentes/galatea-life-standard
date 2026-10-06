import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const STANDARDS = ["applier", "steward", "bridge", "brain", "voice"] as const;
export type StandardName = (typeof STANDARDS)[number];

export interface Requirement {
  id: string;
  level: "MUST" | "SHOULD" | "MAY";
  conformance: string;
  verify: "wire" | "static" | "judged";
  text: string;
  negative_subjects: { subject: string; coupled: string[] }[];
}

export interface Constant {
  key: string;
  name: string;
  value: string;
  number: number | null;
  unit: string | null;
  guess: boolean;
  where: string;
}

/** conformance/, from src/ under vitest and from dist/ when built, when the harness sits in the repository. */
export const conformanceRoot = fileURLToPath(new URL("../..", import.meta.url));
/** The harness package's own folder. */
export const packageRoot = fileURLToPath(new URL("..", import.meta.url));

/**
 * The first folder that holds the manifests: the repository's `conformance/` when the harness sits in
 * it (the source, never a stale copy), else the copy the build put in the package (`manifests/`), as
 * when the harness is installed from the registry.
 */
export function manifestRoot(candidates = [conformanceRoot, join(packageRoot, "manifests")]): string {
  const found = candidates.find((d) => existsSync(join(d, "applier-requirements.json")));
  if (!found) throw new Error(`no applier-requirements.json in ${candidates.join(" or ")}`);
  return found;
}

const read = <T>(name: string): T => JSON.parse(readFileSync(join(manifestRoot(), name), "utf8")) as T;

export function loadManifest(s: StandardName): Requirement[] {
  return read<Requirement[]>(`${s}-requirements.json`);
}

export function allIds(): Set<string> {
  return new Set(STANDARDS.flatMap((s) => loadManifest(s).map((r) => r.id)));
}

export function loadConstants(s: StandardName): Constant[] {
  return read<Constant[]>(`${s}-constants.json`);
}

const UNIT_MS: Record<string, number> = { ms: 1, s: 1000, min: 60_000, h: 3_600_000, day: 86_400_000, days: 86_400_000 };

/** A constant's first number, in ms; never a copy of the text's value. */
export function constantMs(s: StandardName, key: string): number {
  const c = loadConstants(s).find((x) => x.key === key);
  if (!c) throw new Error(`no constant ${key} in ${s}`);
  if (c.number === null || c.unit === null || !(c.unit in UNIT_MS)) throw new Error(`${s} ${key} is not a duration: ${c.value}`);
  return c.number * UNIT_MS[c.unit]!;
}
