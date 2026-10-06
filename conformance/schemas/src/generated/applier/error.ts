/* Generated from conformance/schemas/applier/error.json by scripts/gen-types.ts. Do not edit. */

export interface ApplierError {
  error:
    | "invalid_request"
    | "not_claimed"
    | "not_permitted"
    | "unknown_plan"
    | "unknown_apply"
    | "plan_expired"
    | "stale_revision"
    | "plan_not_yours"
    | "cursor_expired"
    | "idempotency_conflict"
    | "cycle";
  message: string;
  [k: string]: unknown | undefined;
}
