/* Generated from conformance/schemas/bridge/device-status.json by scripts/gen-types.ts. Do not edit. */

export interface BridgeDeviceStatus {
  deviceId: string;
  state?: string;
  /**
   * Bridge binding: RFC 3339 UTC with milliseconds (GA-BRIDGE-3)
   */
  timestamp: string;
  timestamps?: {
    /**
     * Bridge binding: RFC 3339 UTC with milliseconds (GA-BRIDGE-3)
     */
    [k: string]: string | undefined;
  };
  available: boolean;
  [k: string]: unknown | undefined;
}
