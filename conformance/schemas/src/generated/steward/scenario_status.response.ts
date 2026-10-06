/* Generated from conformance/schemas/steward/scenario_status.response.json by scripts/gen-types.ts. Do not edit. */

export interface StewardScenarioStatusResponse {
  run_id?: string;
  status: "running" | "ended";
  reason?: "done" | "timeout" | "stopped" | "interrupted";
  failed_steps: {
    step_id: string;
    outcome:
      | "dispatched"
      | "skipped"
      | "refused"
      | "unreachable"
      | "acked"
      | "delivered"
      | "sent"
      | "unanswered"
      | "failed"
      | "confirmed"
      | "unconfirmed"
      | "unknown";
    reason?: string;
    /**
     * MCP seams: RFC 3339 with offset
     */
    time: string;
    [k: string]: unknown | undefined;
  }[];
  sent_steps: {
    step_id: string;
    [k: string]: unknown | undefined;
  }[];
  [k: string]: unknown | undefined;
}
