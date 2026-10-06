/* Generated from conformance/schemas/steward/define.scenario.json by scripts/gen-types.ts. Do not edit. */

export interface StewardDefineScenario {
  /**
   * An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
   */
  id: string;
  name: string;
  /**
   * Home Assistant's meaning; the steward lists the ones it runs in describe.modes, and define refuses another (GA-SCN-5)
   */
  mode: "single" | "restart" | "queued" | "parallel";
  /**
   * Target ids the run leases until it ends (GA-SCN-2); a group's members, leaving out infrastructure ones
   *
   * Items: An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
   */
  owned?: string[];
  respect_occupancy?: boolean;
  /**
   * @minItems 1
   */
  steps: [
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
          target?: unknown;
          selector?: unknown;
          action?: unknown;
          args?: unknown;
          respect_occupancy?: boolean;
          [k: string]: unknown | undefined;
        })
      | {
          /**
           * A target's state key compared with a value (current < 19)
           */
          if: {
            /**
             * An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
             */
            target: string;
            key: string;
            op: "eq" | "ne" | "gt" | "ge" | "lt" | "le";
            value: unknown;
          };
          /**
           * A branch's steps, each one of steps' items; define checks them so, branch by branch, since this schema does not recurse (its types are generated inline)
           *
           * @minItems 1
           */
          then: [
            {
              [k: string]: unknown | undefined;
            },
            ...{
              [k: string]: unknown | undefined;
            }[]
          ];
          /**
           * A branch's steps, each one of steps' items; define checks them so, branch by branch, since this schema does not recurse (its types are generated inline)
           *
           * @minItems 1
           */
          else?: [
            {
              [k: string]: unknown | undefined;
            },
            ...{
              [k: string]: unknown | undefined;
            }[]
          ];
        }
      | {
          delay: number;
        }
      | {
          wait: {
            /**
             * An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
             */
            target: string;
            key: string;
            value: unknown;
            timeout_s: number;
            on_timeout?: "continue" | "stop";
          };
        }
      | {
          /**
           * An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
           */
          run: string;
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
          target?: unknown;
          selector?: unknown;
          action?: unknown;
          args?: unknown;
          respect_occupancy?: boolean;
          [k: string]: unknown | undefined;
        })
      | {
          /**
           * A target's state key compared with a value (current < 19)
           */
          if: {
            /**
             * An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
             */
            target: string;
            key: string;
            op: "eq" | "ne" | "gt" | "ge" | "lt" | "le";
            value: unknown;
          };
          /**
           * A branch's steps, each one of steps' items; define checks them so, branch by branch, since this schema does not recurse (its types are generated inline)
           *
           * @minItems 1
           */
          then: [
            {
              [k: string]: unknown | undefined;
            },
            ...{
              [k: string]: unknown | undefined;
            }[]
          ];
          /**
           * A branch's steps, each one of steps' items; define checks them so, branch by branch, since this schema does not recurse (its types are generated inline)
           *
           * @minItems 1
           */
          else?: [
            {
              [k: string]: unknown | undefined;
            },
            ...{
              [k: string]: unknown | undefined;
            }[]
          ];
        }
      | {
          delay: number;
        }
      | {
          wait: {
            /**
             * An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
             */
            target: string;
            key: string;
            value: unknown;
            timeout_s: number;
            on_timeout?: "continue" | "stop";
          };
        }
      | {
          /**
           * An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
           */
          run: string;
        }
    )[]
  ];
}
