/* Generated from conformance/schemas/steward/events.response.json by scripts/gen-types.ts. Do not edit. */

export interface StewardEventsResponse {
  events: {
    seq: number;
    /**
     * MCP seams: RFC 3339 with offset
     */
    time: string;
    type: string;
    [k: string]: unknown | undefined;
  }[];
  cursor: string;
  [k: string]: unknown | undefined;
}
