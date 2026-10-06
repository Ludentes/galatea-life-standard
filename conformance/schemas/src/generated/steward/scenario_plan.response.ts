/* Generated from conformance/schemas/steward/scenario_plan.response.json by scripts/gen-types.ts. Do not edit. */

export interface StewardScenarioPlanResponse {
  plan_id: string;
  /**
   * MCP seams: RFC 3339 with offset
   */
  expires_at: string;
  revision: number;
  endpoint: string;
  speaker?: string;
  client?: string;
  request: {
    scenario: string;
    endpoint: string;
    speaker?: string;
    [k: string]: unknown | undefined;
  };
  steps: ({
    step_id: string;
    target: string;
    action: string;
    args?: unknown;
    verdict: "op" | "skip" | "ask" | "refuse";
    tier: "reversible" | "confirm" | "no_voice";
    /**
     * The applier's reasons except token, and the steward's own
     */
    reason?:
      | (
          | "already"
          | "unknown_target"
          | "unsupported_action"
          | "dead"
          | "not_adopted"
          | "invalid_args"
          | "duplicate_route"
          | "safety"
          | "latched"
          | "tier"
          | "toggle_only"
          | "token"
          | "declaration_changed"
        )
      | (
          | "conflict"
          | "role"
          | "tier"
          | "leased"
          | "occupied"
          | "occupancy_unknown"
          | "in_use"
          | "in_use_unknown"
          | "confirm_tier"
          | "confirm_define"
          | "not_confirmed"
        );
    /**
     * Who holds a lease (steward, Clients, endpoints and principals): a principal, or safety_rule or load_cap
     */
    holder?:
      | {
          person?: string;
          endpoint: string;
          [k: string]: unknown | undefined;
        }
      | {
          rule: string;
          [k: string]: unknown | undefined;
        }
      | {
          run: string;
          [k: string]: unknown | undefined;
        }
      | ("external" | "safety_rule" | "load_cap");
    stale: boolean;
    basis: "real" | "emulated";
    from_replaced?: true;
    /**
     * A step of brain_authored work (GA-DEF-7): above reversible it is refuse(tier), and it is sent with brain: true (provisional: the standard names no field for it)
     */
    brain_authored?: true;
    /**
     * The answer that stands for an asked step, once one was given (steward, The confirmation dialogue): the plan, updated, that answer returns
     */
    answer?: "yes" | "no";
    [k: string]: unknown | undefined;
  } & {
    /**
     * An action inside an if, planned as if its branch were taken (steward, Scenario runs)
     */
    conditional?: true;
    [k: string]: unknown | undefined;
  })[];
  [k: string]: unknown | undefined;
}
