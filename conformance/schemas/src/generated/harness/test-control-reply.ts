/* Generated from conformance/schemas/harness/test-control-reply.json by scripts/gen-types.ts. Do not edit. */

export interface HarnessTestControlReply {
  requestId: string;
  ok: boolean;
  error?: string;
  /**
   * true when ok is false because this test transport cannot play the op; the harness reports the test not_applicable
   */
  unsupported?: boolean;
  [k: string]: unknown | undefined;
}
