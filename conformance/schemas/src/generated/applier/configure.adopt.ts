/* Generated from conformance/schemas/applier/configure.adopt.json by scripts/gen-types.ts. Do not edit. */

export interface ApplierConfigureAdopt {
  device: string;
  class:
    | (
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
        | "player"
      )
    | null;
  declarations?: {
    tiers?: {
      [k: string]: "reversible" | "confirm" | "no_voice" | undefined;
    };
    load?: "heating" | "motor" | "lighting" | "other";
    max_on_s?: number;
    infrastructure?: boolean;
    fresh_s?: number;
    ack_within_s?: {
      [k: string]: number | undefined;
    };
    self_changing?: string[];
    personal?: string[];
    opens_with?: "onoff.turn_on" | "onoff.turn_off";
  };
  replaces?: string;
}
