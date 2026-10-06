/* Generated from conformance/schemas/applier/events.response.json by scripts/gen-types.ts. Do not edit. */

export interface ApplierEventsResponse {
  events: {
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
  }[];
  cursor: string;
  notices: {
    notice_id: string;
    cause: string;
    rule_id?: string;
    devices?: string[];
    text: string;
    outcomes?: unknown[];
    [k: string]: unknown | undefined;
  }[];
  [k: string]: unknown | undefined;
}
