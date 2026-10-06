/* Generated from conformance/schemas/steward/define.credential.json by scripts/gen-types.ts. Do not edit. */

export interface StewardDefineCredential {
  id: string;
  kind: "app" | "panel" | "brain" | "front";
  secret: string;
  endpoint?: string;
  confirm_on?: string;
}
