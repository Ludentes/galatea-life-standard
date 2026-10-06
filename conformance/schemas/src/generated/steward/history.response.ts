/* Generated from conformance/schemas/steward/history.response.json by scripts/gen-types.ts. Do not edit. */

export interface StewardHistoryResponse {
  events: {
    seq: number;
    /**
     * MCP seams: RFC 3339 with offset
     */
    time: string;
    type: string;
    [k: string]: unknown | undefined;
  }[];
  [k: string]: unknown | undefined;
}
