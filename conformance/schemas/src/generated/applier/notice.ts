/* Generated from conformance/schemas/applier/notice.json by scripts/gen-types.ts. Do not edit. */

export interface ApplierNotice {
  notice_id: string;
  cause: string;
  rule_id?: string;
  devices?: string[];
  text: string;
  outcomes?: unknown[];
  [k: string]: unknown | undefined;
}
