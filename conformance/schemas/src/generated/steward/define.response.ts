/* Generated from conformance/schemas/steward/define.response.json by scripts/gen-types.ts. Do not edit. */

export type StewardDefineResponse = (
  | {
      [k: string]: unknown | undefined;
    }
  | {
      plan_id: string;
      /**
       * MCP seams: RFC 3339 with offset
       */
      expires_at: string;
      revision: number;
      endpoint: string;
      client?: string;
      speaker?: string;
      request:
        | {
            endpoint: string;
            speaker?: string;
            respect_occupancy?: boolean;
            /**
             * @minItems 1
             */
            actions: [
              (
                | {
                    [k: string]: unknown | undefined;
                  }
                | {
                    [k: string]: unknown | undefined;
                  }
              ) & {
                target?: string;
                selector?: {
                  room?: string;
                  class?:
                    | "light"
                    | "socket"
                    | "ac"
                    | "boiler"
                    | "floor_heating"
                    | "curtain"
                    | "gate"
                    | "garage_door"
                    | "door_lock"
                    | "water_valve"
                    | "gas_valve"
                    | "tv"
                    | "speaker"
                    | "sensor"
                    | "channel"
                    | "computer"
                    | "player";
                  capability?: string;
                  [k: string]: unknown | undefined;
                };
                action: string;
                args: {
                  [k: string]: unknown | undefined;
                };
                [k: string]: unknown | undefined;
              } & (
                  | {
                      [k: string]: unknown | undefined;
                    }
                  | {
                      [k: string]: unknown | undefined;
                    }
                ) & {
                  target?: string;
                  selector?: {
                    room?: string;
                    class?:
                      | "light"
                      | "socket"
                      | "ac"
                      | "boiler"
                      | "floor_heating"
                      | "curtain"
                      | "gate"
                      | "garage_door"
                      | "door_lock"
                      | "water_valve"
                      | "gas_valve"
                      | "tv"
                      | "speaker"
                      | "sensor"
                      | "channel"
                      | "computer"
                      | "player";
                    capability?: string;
                    [k: string]: unknown | undefined;
                  };
                  action: string;
                  args: {
                    [k: string]: unknown | undefined;
                  };
                  [k: string]: unknown | undefined;
                },
              ...((
                | {
                    [k: string]: unknown | undefined;
                  }
                | {
                    [k: string]: unknown | undefined;
                  }
              ) & {
                target?: string;
                selector?: {
                  room?: string;
                  class?:
                    | "light"
                    | "socket"
                    | "ac"
                    | "boiler"
                    | "floor_heating"
                    | "curtain"
                    | "gate"
                    | "garage_door"
                    | "door_lock"
                    | "water_valve"
                    | "gas_valve"
                    | "tv"
                    | "speaker"
                    | "sensor"
                    | "channel"
                    | "computer"
                    | "player";
                  capability?: string;
                  [k: string]: unknown | undefined;
                };
                action: string;
                args: {
                  [k: string]: unknown | undefined;
                };
                [k: string]: unknown | undefined;
              } & (
                  | {
                      [k: string]: unknown | undefined;
                    }
                  | {
                      [k: string]: unknown | undefined;
                    }
                ) & {
                  target?: string;
                  selector?: {
                    room?: string;
                    class?:
                      | "light"
                      | "socket"
                      | "ac"
                      | "boiler"
                      | "floor_heating"
                      | "curtain"
                      | "gate"
                      | "garage_door"
                      | "door_lock"
                      | "water_valve"
                      | "gas_valve"
                      | "tv"
                      | "speaker"
                      | "sensor"
                      | "channel"
                      | "computer"
                      | "player";
                    capability?: string;
                    [k: string]: unknown | undefined;
                  };
                  action: string;
                  args: {
                    [k: string]: unknown | undefined;
                  };
                  [k: string]: unknown | undefined;
                })[]
            ];
            [k: string]: unknown | undefined;
          }
        | {
            endpoint: string;
            speaker?: string;
            changes: {
              op: "upsert" | "delete";
              kind: string;
              value?: unknown;
              [k: string]: unknown | undefined;
            }[];
            expected_revision: number;
            [k: string]: unknown | undefined;
          };
      steps: (
        | {
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
             * Who holds a lease (steward, Clients, endpoints and principals): a principal (a press rule's `{ rule, press }` among them), or safety_rule, external or load_cap
             */
            holder?:
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
            stale: boolean;
            basis: "real" | "emulated";
            from_replaced?: true;
            /**
             * A step of brain_authored work (GA-DEF-7): above reversible it is refuse(tier), and it is sent with brain: true (steward, Steps)
             */
            brain_authored?: true;
            /**
             * The answer that stands for an asked step, once one was given (steward, The confirmation dialogue): the plan, updated, that answer returns
             */
            answer?: "yes" | "no";
            [k: string]: unknown | undefined;
          }
        | {
            step_id: string;
            verdict: "ask";
            reason: "confirm_define";
            diff: string;
            answer?: "yes" | "no";
          }
      )[];
      [k: string]: unknown | undefined;
    }
) & {
  revision?: number;
  diff?: string;
  /**
   * The house, after this define, has no notify channel, so notices are held (GA-NOTE-1)
   */
  no_notify_channel?: true;
  /**
   * define { plan_id } of a plan whose confirm_define no one answered yes: nothing changed, and the plan is spent (GA-DEF-6; steward, Operations)
   */
  skipped?: "not_confirmed";
  [k: string]: unknown | undefined;
};
