/* Generated from conformance/schemas/applier/token.json by scripts/gen-types.ts. Do not edit. */

export interface ApplierToken {
  token_id: string;
  issuer: string;
  target: string;
  action: string;
  args: unknown;
  via: "voice" | "panel" | "app" | "rule" | "schedule";
  brain: boolean;
  for: {
    [k: string]: unknown | undefined;
  };
  /**
   * MCP seams: RFC 3339 with offset
   */
  expires: string;
  proof: string;
}
