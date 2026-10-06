/* Generated from conformance/schemas/applier/configure.witness.json by scripts/gen-types.ts. Do not edit. */

export interface ApplierConfigureWitness {
  device: string;
  action: string;
  sensor: string;
  /**
   * The sensor key it reads; its first sensor key where absent
   */
  key?: string;
  expect:
    | ("rises" | "falls")
    | {
        becomes: string | number | boolean;
      }
    | {
        toward: {
          arg: string;
          by: number;
        };
      };
  within_s: number;
}
