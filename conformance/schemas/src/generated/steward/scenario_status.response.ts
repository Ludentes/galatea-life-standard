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
    /**
     * On a step that passed a person's hold (steward, The owner passes a person's hold; GA-LEASE-10, GA-LEASE-12): the hold's holder and the first switch that covers the step; left out entirely for a reader a personal press's occurrence is withheld from (GA-AUTH-7); never on a narrowing action or a press's own action
     */
    passed_hold?: {
      /**
       * Who holds a lease (steward, Clients, endpoints and principals): a principal (a press rule's `{ rule, press }` among them), or safety_rule, external or load_cap
       */
      holder:
        | {
            person?: string;
            endpoint: string;
            [k: string]: unknown | undefined;
          }
        | {
            rule: string;
            /**
             * A press rule's hold: the press it came from, the occurrence's reported value (GA-LEASE-9)
             */
            press?: {
              target: string;
              key: string;
              value: unknown;
              [k: string]: unknown | undefined;
            };
            [k: string]: unknown | undefined;
          }
        | {
            run: string;
            [k: string]: unknown | undefined;
          }
        | ("external" | "safety_rule" | "load_cap");
      switch: "rule" | "device" | "home" | "guest";
    };
    [k: string]: unknown | undefined;
  }[];
  sent_steps: {
    step_id: string;
    /**
     * On a step that passed a person's hold (steward, The owner passes a person's hold; GA-LEASE-10, GA-LEASE-12): the hold's holder and the first switch that covers the step; left out entirely for a reader a personal press's occurrence is withheld from (GA-AUTH-7); never on a narrowing action or a press's own action
     */
    passed_hold?: {
      /**
       * Who holds a lease (steward, Clients, endpoints and principals): a principal (a press rule's `{ rule, press }` among them), or safety_rule, external or load_cap
       */
      holder:
        | {
            person?: string;
            endpoint: string;
            [k: string]: unknown | undefined;
          }
        | {
            rule: string;
            /**
             * A press rule's hold: the press it came from, the occurrence's reported value (GA-LEASE-9)
             */
            press?: {
              target: string;
              key: string;
              value: unknown;
              [k: string]: unknown | undefined;
            };
            [k: string]: unknown | undefined;
          }
        | {
            run: string;
            [k: string]: unknown | undefined;
          }
        | ("external" | "safety_rule" | "load_cap");
      switch: "rule" | "device" | "home" | "guest";
    };
    [k: string]: unknown | undefined;
  }[];
  [k: string]: unknown | undefined;
}
