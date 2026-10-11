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
  /**
   * The structured details a requirement names, as GA-SAFE-14's { key, device, awaited } for a key a safety rule, latch or witness reads that its device does not declare
   */
  data?: {
    [k: string]: unknown | undefined;
  };
  [k: string]: unknown | undefined;
}
