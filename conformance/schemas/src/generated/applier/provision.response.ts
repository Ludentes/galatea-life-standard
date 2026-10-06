/* Generated from conformance/schemas/applier/provision.response.json by scripts/gen-types.ts. Do not edit. */

export interface ApplierProvisionResponse {
  request_id: string;
  op: "join" | "join_close" | "commission" | "connect" | "remove" | "unblock" | "install" | "uninstall";
  status: "ok" | "accepted" | "invalid_request" | "failed" | "unreachable";
  data?: unknown;
  reason?: string;
}
