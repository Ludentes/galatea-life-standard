/* Generated from conformance/schemas/bridge/command.json by scripts/gen-types.ts. Do not edit. */

export interface BridgeCommand {
  commandId: string;
  /**
   * Bridge binding: RFC 3339 UTC with milliseconds (GA-BRIDGE-3)
   */
  issuedAt: string;
  resultWithinMs: number;
  value: {
    action: string;
    value?: unknown;
    state?: {
      [k: string]: unknown | undefined;
    };
    [k: string]: unknown | undefined;
  };
  [k: string]: unknown | undefined;
}
