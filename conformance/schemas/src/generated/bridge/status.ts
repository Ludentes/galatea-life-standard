/* Generated from conformance/schemas/bridge/status.json by scripts/gen-types.ts. Do not edit. */

export interface BridgeStatus {
  bridgeId: string;
  instanceId: string;
  v: 1;
  state: "online" | "degraded" | "offline";
  graceful?: true;
  version: string;
  bridgeType?: string;
  levels: ("Serve" | "Provision" | "Host" | "Box" | "Find")[];
  faults: {
    code: ("pin_mismatch" | "crash_loop" | "account_deleted" | "helper_refused" | "overflow") | string;
    device?: string;
    topic?: string;
    detail?: string;
    [k: string]: unknown | undefined;
  }[];
  ungoverned: unknown[];
  blocked: unknown[];
  testRunId?: string;
  transports: {
    id: string;
    kind: "matter" | "zigbee" | "zwave" | "modbus" | "ir" | "other";
    state: "up" | "down" | "unknown";
    /**
     * Bridge binding: RFC 3339 UTC with milliseconds (GA-BRIDGE-3)
     */
    since: string;
    retryIntervalMs?: number;
    connections?: string[];
    [k: string]: unknown | undefined;
  }[];
  devices: {
    id: string;
    transport: string;
    basis: string;
    cadenceMs: number | null;
    basisMaxAgeMs: number | null;
    timestamp: string | null;
    lastCheckIn: string | null;
    observable: boolean;
    /**
     * Bridge binding: RFC 3339 UTC with milliseconds (GA-BRIDGE-3)
     */
    since: string;
    [k: string]: unknown | undefined;
  }[];
  /**
   * Bridge binding: RFC 3339 UTC with milliseconds (GA-BRIDGE-3)
   */
  publishedAt: string;
  [k: string]: unknown | undefined;
}
