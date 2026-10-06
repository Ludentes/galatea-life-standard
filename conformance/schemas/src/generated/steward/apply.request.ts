/* Generated from conformance/schemas/steward/apply.request.json by scripts/gen-types.ts. Do not edit. */

export type StewardApplyRequest = {
  idempotency_key: string;
  plan_id?: string;
  request?: {
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
  };
  [k: string]: unknown | undefined;
} & {
  [k: string]: unknown | undefined;
};
