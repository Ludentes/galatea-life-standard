/* Generated from conformance/schemas/steward/narrow.response.json by scripts/gen-types.ts. Do not edit. */

export interface StewardNarrowResponse {
  narrowing_id: string;
  /**
   * MCP seams: RFC 3339 with offset
   */
  until: string;
  [k: string]: unknown | undefined;
}
