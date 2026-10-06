/* Generated from conformance/schemas/applier/configure.tier.json by scripts/gen-types.ts. Do not edit. */

export interface ApplierConfigureTier {
  device: string;
  action: string;
  tier: "reversible" | "confirm" | "no_voice";
}
