/* Generated from conformance/schemas/bridge/event.json by scripts/gen-types.ts. Do not edit. */

export interface BridgeEvent {
  seq: number;
  instanceId: string;
  type:
    | "joined"
    | "interviewed"
    | "left"
    | "window_closed"
    | "commissioned"
    | "commission_failed"
    | "connected"
    | "connect_failed"
    | "blocked_rejoin"
    | "other_admins_changed"
    | "installed"
    | "install_failed"
    | "uninstalled"
    | "occurrence"
    | "undescribed";
  [k: string]: unknown | undefined;
}
