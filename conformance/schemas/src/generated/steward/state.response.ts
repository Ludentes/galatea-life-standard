/* Generated from conformance/schemas/steward/state.response.json by scripts/gen-types.ts. Do not edit. */

export type StewardStateResponse = {
  targets: {
    [k: string]:
      | {
          values: {
            key: string;
            value: unknown;
            /**
             * MCP seams: RFC 3339 with offset
             */
            basis_time: string;
            assumed?: boolean;
            [k: string]: unknown | undefined;
          }[];
          liveness: "live" | "stale" | "dead";
          last_check_in: string | null;
          fresh_s: number | null;
          fresh_basis: "declared" | "configured" | "unknown";
          other_admins:
            | {
                vendor: string;
                label: string;
                [k: string]: unknown | undefined;
              }[]
            | "unknown";
          [k: string]: unknown | undefined;
        }
      | undefined;
  };
  transports: unknown[];
  latches: unknown[];
  [k: string]: unknown | undefined;
} & {
  /**
   * Each group's state (GA-GRP-1): on, null when no member has onoff (the reference steward's design, Standards fixes this build shows)
   */
  groups?: {
    [k: string]:
      | {
          on: boolean | null;
          [k: string]: unknown | undefined;
        }
      | undefined;
  };
  /**
   * Each room's occupancy (steward, Occupancy; GA-OCC-1), computed when read (the reference steward's design, Standards fixes this build shows)
   */
  rooms?: {
    [k: string]:
      | {
          occupancy: "occupied" | "vacant" | "unknown";
          [k: string]: unknown | undefined;
        }
      | undefined;
  };
  /**
   * Each leased device's lease (steward, Leases): its holder, its precedence and when it ends; a device with none is absent (the reference steward's design, Standards fixes this build shows)
   */
  leases?: {
    [k: string]:
      | {
          /**
           * Who holds a lease (steward, Clients, endpoints and principals): a principal, or safety_rule or load_cap
           */
          holder:
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
          precedence: "safety_rule" | "person" | "scheduled_run" | "rule";
          expires: string | "run_end";
          [k: string]: unknown | undefined;
        }
      | undefined;
  };
  [k: string]: unknown | undefined;
};
