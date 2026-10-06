/* Generated from conformance/schemas/steward/event.json by scripts/gen-types.ts. Do not edit. */

export interface StewardEvent {
  seq: number;
  /**
   * MCP seams: RFC 3339 with offset
   */
  time: string;
  type: string;
  [k: string]: unknown | undefined;
}
