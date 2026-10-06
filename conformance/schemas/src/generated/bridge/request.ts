/* Generated from conformance/schemas/bridge/request.json by scripts/gen-types.ts. Do not edit. */

export interface BridgeRequest {
  requestId: string;
  /**
   * Bridge binding: RFC 3339 UTC with milliseconds (GA-BRIDGE-3)
   */
  issuedAt: string;
  [k: string]: unknown | undefined;
}
