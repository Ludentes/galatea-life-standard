/* Generated from conformance/schemas/steward/define.request.json by scripts/gen-types.ts. Do not edit. */

export type StewardDefineRequest = {
  endpoint: string;
  speaker?: string;
  plan_id?: string;
  changes?: {
    op: "upsert" | "delete";
    kind: string;
    value?: unknown;
    [k: string]: unknown | undefined;
  }[];
  expected_revision?: number;
  dry_run?: boolean;
  [k: string]: unknown | undefined;
} & {
  [k: string]: unknown | undefined;
};
