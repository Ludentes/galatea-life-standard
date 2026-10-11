/* Generated from conformance/schemas/bridge/devices.json by scripts/gen-types.ts. Do not edit. */

export interface BridgeDevices {
  /**
   * Bridge binding: RFC 3339 UTC with milliseconds (GA-BRIDGE-3)
   */
  publishedAt?: string;
  devices: {
    id: string;
    stableIdentifier: string;
    transport: string;
    model: {
      vendor: string;
      model: string;
      [k: string]: unknown | undefined;
    };
    capabilities: string[];
    sensorKeys?: string[];
    actions: {
      action: string;
      idempotent: boolean;
      stateless: boolean;
      toggles?: boolean;
      wholeState?: boolean;
      args?: {
        /**
         * One argument's constraint in an action's args, the table ruled 2026-10-06: a list is the allowed values (an empty one allows none); an object holding min, max or step a numeric range (step from min, else 0); "any" or {} no limit; an object of named fields an object argument, each field's own constraint; optional: true beside a range's or fields' keys an argument that may be left out. Not JSON Schema.
         */
        [k: string]:
          | "any"
          | (string | number | boolean)[]
          | {
              min?: number;
              max?: number;
              step?: number;
              optional?: boolean;
              [k: string]: unknown | undefined;
            }
          | undefined;
      };
      confirms: boolean;
      confirmedBy?: {
        [k: string]: unknown | undefined;
      };
      requestedTier?: string;
      toolHash?: string;
      [k: string]: unknown | undefined;
    }[];
    feedback: "closed" | "open";
    reachMs?: number;
    proposedClass?:
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
    classEvidence?: "protocol" | "model_db" | "none";
    otherAdmins?:
      | {
          vendor: string;
          label: string;
          [k: string]: unknown | undefined;
        }[]
      | "unknown";
    connections?: string[];
    host?: string;
    plugin?: string;
    version?: string;
    proposedInfrastructure?: true;
    personal?: string[];
    selfChanging?: string[];
    settings?: string[];
    awaitedKeys?: string[];
    /**
     * @maxItems 32
     */
    undescribed?: {
      name: string;
      firstSeen: string;
      [k: string]: unknown | undefined;
    }[];
    internal?: true;
    stagedFor?: string;
    accounts?: {
      [k: string]: string | undefined;
    };
    extensions?: {
      capability: string;
      keys?: {
        key: string;
        kind?: "state" | "event";
        [k: string]: unknown | undefined;
      }[];
      [k: string]: unknown | undefined;
    }[];
    [k: string]: unknown | undefined;
  }[];
  [k: string]: unknown | undefined;
}
