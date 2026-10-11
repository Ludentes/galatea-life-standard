/* Generated from conformance/schemas/steward/event.ask.json by scripts/gen-types.ts. Do not edit. */

export interface StewardEventAsk {
  seq: number;
  /**
   * MCP seams: RFC 3339 with offset
   */
  time: string;
  type: "ask";
  plan_id: string;
  /**
   * @minItems 1
   */
  step_ids: [string, ...string[]];
  /**
   * One per asked step, in the order of step_ids, each field as the plan's step gives it (steward, Steps); given only to a read bound to the ask's endpoint, by the plan's credential, or whose derived role is owner, every other read getting the event without it (GA-CONF-5)
   *
   * @minItems 1
   */
  steps?: [
    (
      | {
          step_id: string;
          target: string;
          action: string;
          args: unknown;
          tier: "reversible" | "confirm" | "no_voice";
          /**
           * The applier's reasons except token, and the steward's own
           */
          reason:
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
          [k: string]: unknown | undefined;
        }
      | {
          step_id: string;
          reason: "confirm_define";
          diff: string;
        }
    ),
    ...(
      | {
          step_id: string;
          target: string;
          action: string;
          args: unknown;
          tier: "reversible" | "confirm" | "no_voice";
          /**
           * The applier's reasons except token, and the steward's own
           */
          reason:
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
          [k: string]: unknown | undefined;
        }
      | {
          step_id: string;
          reason: "confirm_define";
          diff: string;
        }
    )[]
  ];
  /**
   * The scenario run that asked, on a run's toggle step asked again (GA-SCN-3); optional
   */
  run_id?: string;
  /**
   * Where the question is put: the plan's endpoint, or the confirm_on that applies
   */
  endpoint: string;
  [k: string]: unknown | undefined;
}
