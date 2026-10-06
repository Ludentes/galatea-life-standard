/* Generated from conformance/schemas/applier/plan.response.json by scripts/gen-types.ts. Do not edit. */

export interface ApplierPlanResponse {
  plan_id: string;
  /**
   * MCP seams: RFC 3339 with offset
   */
  expires_at: string;
  revision: number;
  client: string;
  request: {
    /**
     * @minItems 1
     */
    actions: [
      {
        target: string;
        action: string;
        args: unknown;
        via: "voice" | "panel" | "app" | "rule" | "schedule";
        brain: boolean;
        for: {
          [k: string]: unknown | undefined;
        };
        token?: {
          [k: string]: unknown | undefined;
        };
        [k: string]: unknown | undefined;
      },
      ...{
        target: string;
        action: string;
        args: unknown;
        via: "voice" | "panel" | "app" | "rule" | "schedule";
        brain: boolean;
        for: {
          [k: string]: unknown | undefined;
        };
        token?: {
          [k: string]: unknown | undefined;
        };
        [k: string]: unknown | undefined;
      }[]
    ];
    [k: string]: unknown | undefined;
  };
  steps: {
    step_id: string;
    target: string;
    action: string;
    args?: unknown;
    verdict: "op" | "skip" | "refuse";
    reason?:
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
      | "declaration_changed";
    tier: "reversible" | "confirm" | "no_voice";
    stale: boolean;
    basis: "real" | "emulated";
    [k: string]: unknown | undefined;
  }[];
  [k: string]: unknown | undefined;
}
