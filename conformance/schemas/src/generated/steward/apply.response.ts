/* Generated from conformance/schemas/steward/apply.response.json by scripts/gen-types.ts. Do not edit. */

export interface StewardApplyResponse {
  apply_id: string;
  outcomes: ({
    step_id: string;
    target: string;
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
    detail?: string;
    /**
     * MCP seams: RFC 3339 with offset
     */
    time?: string;
    /**
     * A witnessed step's witness and its verdict (GA-WIT-1): beside the step's own outcome in outcome, which never changes; in the verdict's own outcome event, whose outcome is the verdict
     */
    witness?: {
      sensor: string;
      key?: string;
      expect: unknown;
      within_s: number;
      verdict: "confirmed" | "unconfirmed" | "unknown";
      [k: string]: unknown | undefined;
    };
    [k: string]: unknown | undefined;
  } & {
    [k: string]: unknown | undefined;
  } & {
    /**
     * On a notify step applied inline whose caller-set from the steward overwrote (GA-NOTE-2)
     */
    from_replaced?: true;
    [k: string]: unknown | undefined;
  })[];
  [k: string]: unknown | undefined;
}
