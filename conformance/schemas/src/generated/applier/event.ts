/* Generated from conformance/schemas/applier/event.json by scripts/gen-types.ts. Do not edit. */

export interface ApplierEvent {
  seq: number;
  /**
   * MCP seams: RFC 3339 with offset
   */
  time: string;
  type:
    | "state"
    | "outcome"
    | "late_ack"
    | "liveness"
    | "rule_fired"
    | "latch"
    | "model"
    | "route_conflict"
    | "provision"
    | "freshness"
    | "transport"
    | "bridge_fault"
    | "other_admins"
    | "occurrence"
    | "undescribed";
  [k: string]: unknown | undefined;
}
