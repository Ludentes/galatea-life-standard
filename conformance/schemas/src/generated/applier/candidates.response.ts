/* Generated from conformance/schemas/applier/candidates.response.json by scripts/gen-types.ts. Do not edit. */

export interface ApplierCandidatesResponse {
  finder: "live" | "dead" | "none";
  finder_sources: unknown[];
  finder_faults: unknown[];
  candidates: unknown[];
  ignored_keys: unknown[];
  [k: string]: unknown | undefined;
}
