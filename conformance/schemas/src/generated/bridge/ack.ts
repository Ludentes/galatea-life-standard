/* Generated from conformance/schemas/bridge/ack.json by scripts/gen-types.ts. Do not edit. */

export interface BridgeAck {
  commandId: string;
  source: string;
  result: "applied" | "sent" | "failed" | "unsupported";
  /**
   * The named reasons, or another
   */
  reason?: ("unreachable" | "unknown_device" | "invalid_request" | "expired" | "no_confirmation") | string;
  detail?: string;
  /**
   * Bridge binding: RFC 3339 UTC with milliseconds (GA-BRIDGE-3)
   */
  timestamp: string;
  [k: string]: unknown | undefined;
}
