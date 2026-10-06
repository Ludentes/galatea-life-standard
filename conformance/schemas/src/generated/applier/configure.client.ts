/* Generated from conformance/schemas/applier/configure.client.json by scripts/gen-types.ts. Do not edit. */

export interface ApplierConfigureClient {
  id: string;
  credential: string;
  kind: "steward" | "parent";
  token_key?: string;
}
