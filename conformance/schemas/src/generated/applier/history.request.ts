/* Generated from conformance/schemas/applier/history.request.json by scripts/gen-types.ts. Do not edit. */

export interface ApplierHistoryRequest {
  targets?: string[];
  /**
   * MCP seams: RFC 3339 with offset
   */
  from: string;
  /**
   * MCP seams: RFC 3339 with offset
   */
  to: string;
  [k: string]: unknown | undefined;
}
