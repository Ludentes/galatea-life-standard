/* Generated from conformance/schemas/steward/define.endpoint.json by scripts/gen-types.ts. Do not edit. */

export interface StewardDefineEndpoint {
  id: string;
  name?: string;
  type?: "voice" | "panel" | "app";
  room?: string | null;
  person?: string | null;
  max_role?: ("owner" | "member" | "guest" | "visitor") | null;
  served_by?: string | null;
  confirm_on?: string | null;
}
