/* Generated from conformance/schemas/bridge/reply.json by scripts/gen-types.ts. Do not edit. */

export interface BridgeReply {
  requestId: string;
  op:
    | "snapshot"
    | "join"
    | "join_close"
    | "commission"
    | "connect"
    | "remove"
    | "unblock"
    | "install"
    | "uninstall"
    | "activate";
  status: "ok" | "accepted" | "invalid_request" | "failed";
  data?: unknown;
  reason?: string;
  [k: string]: unknown | undefined;
}
