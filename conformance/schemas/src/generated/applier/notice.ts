/* Generated from conformance/schemas/applier/notice.json by scripts/gen-types.ts. Do not edit. */

export interface ApplierNotice {
  notice_id: string;
  cause: string;
  rule_id?: string;
  /**
   * For a rule_disabled notice of a witness (GA-SAFE-14): the device and action it watches. The reference build's shape until the standard names one
   */
  witness?: {
    device: string;
    action: string;
    [k: string]: unknown | undefined;
  };
  devices?: string[];
  text: string;
  outcomes?: unknown[];
  [k: string]: unknown | undefined;
}
