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
  })[];
  [k: string]: unknown | undefined;
}
