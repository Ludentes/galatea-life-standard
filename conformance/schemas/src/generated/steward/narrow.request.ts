/* Generated from conformance/schemas/steward/narrow.request.json by scripts/gen-types.ts. Do not edit. */

export interface StewardNarrowRequest {
  endpoint: string;
  speaker?: string;
  listening?: "off" | "tap" | "wake_device" | "wake_server";
  follow_up?: boolean;
  /**
   * MCP seams: RFC 3339 with offset
   */
  until?: string;
  [k: string]: unknown | undefined;
}
