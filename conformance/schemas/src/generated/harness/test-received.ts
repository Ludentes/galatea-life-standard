/* Generated from conformance/schemas/harness/test-received.json by scripts/gen-types.ts. Do not edit. */

export interface HarnessTestReceived {
  device: string;
  action: string;
  args?: unknown;
  state?: {
    [k: string]: unknown | undefined;
  };
  [k: string]: unknown | undefined;
}
