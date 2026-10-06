/* Generated from conformance/schemas/applier/events.request.json by scripts/gen-types.ts. Do not edit. */

export interface ApplierEventsRequest {
  cursor?: string;
  wait_s?: number;
  notice_taken?: string[];
  [k: string]: unknown | undefined;
}
