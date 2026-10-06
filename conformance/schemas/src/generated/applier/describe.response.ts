/* Generated from conformance/schemas/applier/describe.response.json by scripts/gen-types.ts. Do not edit. */

export type ApplierDescribeResponse =
  | {
      applier_id: string;
      standard_version: string;
      /**
       * Items: standard/applier.md, Conformance levels: the levels table names only Act and Safe
       */
      levels: ("Act" | "Safe")[];
      revision: number;
      descendants: string[];
      ungoverned: unknown[];
      box: unknown;
      clients: unknown[];
      devices: {
        id: string;
        label?: string;
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
        capabilities: string[];
        sensor_key?: string;
        sensor_keys?: string[];
        proposed_class?:
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
        class_evidence?: "protocol" | "model_db" | "none";
        protocol?: "matter" | "zigbee" | "zwave" | "modbus" | "ir" | "other";
        stable_identifier?: string;
        previous_identifiers?: string[];
        adopted: boolean;
        other_admins?:
          | {
              vendor: string;
              label: string;
              [k: string]: unknown | undefined;
            }[]
          | "unknown";
        transport?: string;
        bridge_device?: {
          bridge: string;
          id: string;
          [k: string]: unknown | undefined;
        };
        reach_s?: number;
        feedback: "closed" | "open";
        load?: "heating" | "motor" | "lighting" | "other";
        max_on_s?: number;
        fresh_s?: number | null;
        fresh_slack_s?: number;
        fresh_basis?: "declared" | "configured" | "unknown";
        self_changing?: string[];
        awaited_keys?: string[];
        settings?: string[];
        /**
         * @maxItems 32
         */
        undescribed?: {
          name: string;
          first_seen: string;
          [k: string]: unknown | undefined;
        }[];
        personal?: string[];
        infrastructure?: boolean;
        proposed_infrastructure?: true;
        applier_host?: boolean;
        internal?: boolean;
        wake_via?: string;
        accounts?: {
          [k: string]: string | undefined;
        };
        host?: string;
        plugin?: string;
        version?: string;
        staged_for?: string;
        extensions?: {
          capability: string;
          keys?: {
            key: string;
            kind?: "state" | "event";
            [k: string]: unknown | undefined;
          }[];
          [k: string]: unknown | undefined;
        }[];
        child?: string;
        actions: {
          action: string;
          tier: "reversible" | "confirm" | "no_voice";
          idempotent: boolean;
          stateless: boolean;
          toggles?: boolean;
          whole_state?: boolean;
          args?: {
            [k: string]: unknown | undefined;
          };
          tolerance?: number;
          ack_within_s: number;
          confirms?: boolean;
          confirmed_by?: {
            [k: string]: unknown | undefined;
          };
          tool_hash?: string;
          requested_tier?: "reversible" | "confirm" | "no_voice";
          witness?: {
            [k: string]: unknown | undefined;
          };
          [k: string]: unknown | undefined;
        }[];
        [k: string]: unknown | undefined;
      }[];
      transports: {
        id: string;
        kind: "matter" | "zigbee" | "zwave" | "modbus" | "ir" | "other";
        up: boolean;
        state: "up" | "down" | "unknown";
        bridge: string;
        [k: string]: unknown | undefined;
      }[];
      safety_rules: unknown[];
      children: unknown[];
      test_run_id?: string;
      [k: string]: unknown | undefined;
    }
  | {
      revision: number;
      unchanged: true;
      [k: string]: unknown | undefined;
    };
