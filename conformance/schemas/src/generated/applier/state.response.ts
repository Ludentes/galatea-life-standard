/* Generated from conformance/schemas/applier/state.response.json by scripts/gen-types.ts. Do not edit. */

export interface ApplierStateResponse {
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
}
