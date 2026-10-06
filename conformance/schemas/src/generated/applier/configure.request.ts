/* Generated from conformance/schemas/applier/configure.request.json by scripts/gen-types.ts. Do not edit. */

export interface ApplierConfigureRequest {
  changes: {
    op: "upsert" | "delete";
    kind: string;
    value?: unknown;
  }[];
  expected_revision?: number;
  dry_run: boolean;
}
