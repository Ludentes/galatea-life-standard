/* Generated from conformance/schemas/steward/define.rule.json by scripts/gen-types.ts. Do not edit. */

export interface StewardDefineRule {
  /**
   * An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
   */
  id: string;
  name?: string;
  trigger?:
    | (
        | {
            /**
             * One device's state key, by the device's id: compared with op and value, or not_in a list of values
             */
            state: {
              [k: string]: unknown | undefined;
            } & {
              /**
               * An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
               */
              target: string;
              key: string;
              op?: "eq" | "ne" | "gt" | "ge" | "lt" | "le";
              value?: unknown;
              /**
               * @minItems 1
               */
              not_in?: [unknown, ...unknown[]];
            };
          }
        | {
            /**
             * A reading held for for_s seconds while its device is live
             */
            held: {
              [k: string]: unknown | undefined;
            } & {
              /**
               * An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
               */
              target: string;
              key: string;
              op?: "eq" | "ne" | "gt" | "ge" | "lt" | "le";
              value?: unknown;
              /**
               * @minItems 1
               */
              not_in?: [unknown, ...unknown[]];
              for_s: number;
            };
          }
        | {
            event: {
              /**
               * An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
               */
              target: string;
              type: "liveness" | "occurrence";
              new?: "live" | "stale" | "dead";
              key?: string;
              value?: unknown;
              /**
               * The author's mark that the occurrence is a person's physical act (GA-LEASE-9); only on an occurrence trigger
               */
              press?: boolean;
            };
          }
        | {
            time: {
              /**
               * HH:MM in the home's timezone
               */
              at: string;
              /**
               * ISO weekday numbers, Monday 1 to Sunday 7
               *
               * @minItems 1
               */
              days?: [number, ...number[]];
            };
          }
      )
    | null;
  conditions?:
    | [
        (
          | ((
              | {
                  [k: string]: unknown | undefined;
                }
              | {
                  [k: string]: unknown | undefined;
                }
            ) & {
              /**
               * An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
               */
              target: string;
              key: string;
              op?: "eq" | "ne" | "gt" | "ge" | "lt" | "le";
              value?: unknown;
              /**
               * @minItems 1
               */
              not_in?: [unknown, ...unknown[]];
            })
          | {
              between: {
                /**
                 * HH:MM in the home's timezone
                 */
                from: string;
                /**
                 * HH:MM in the home's timezone
                 */
                until: string;
                /**
                 * ISO weekday numbers, Monday 1 to Sunday 7
                 *
                 * @minItems 1
                 */
                days?: [number, ...number[]];
              };
            }
        ),
        ...(
          | ((
              | {
                  [k: string]: unknown | undefined;
                }
              | {
                  [k: string]: unknown | undefined;
                }
            ) & {
              /**
               * An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
               */
              target: string;
              key: string;
              op?: "eq" | "ne" | "gt" | "ge" | "lt" | "le";
              value?: unknown;
              /**
               * @minItems 1
               */
              not_in?: [unknown, ...unknown[]];
            })
          | {
              between: {
                /**
                 * HH:MM in the home's timezone
                 */
                from: string;
                /**
                 * HH:MM in the home's timezone
                 */
                until: string;
                /**
                 * ISO weekday numbers, Monday 1 to Sunday 7
                 *
                 * @minItems 1
                 */
                days?: [number, ...number[]];
              };
            }
        )[]
      ]
    | null;
  /**
   * @minItems 1
   */
  actions?: [
    (
      | (((
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
        }) & {
          respect_occupancy?: boolean;
          [k: string]: unknown | undefined;
        })
      | {
          /**
           * An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
           */
          scenario: string;
        }
    ),
    ...(
      | (((
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
        }) & {
          respect_occupancy?: boolean;
          [k: string]: unknown | undefined;
        })
      | {
          /**
           * An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
           */
          scenario: string;
        }
    )[]
  ];
  active?: boolean | null;
  exceptions?:
    | {
        /**
         * MCP seams: RFC 3339 with offset
         */
        from: string;
        /**
         * MCP seams: RFC 3339 with offset
         */
        until: string;
      }[]
    | null;
}
