/* Generated from conformance/schemas/steward/define.target.json by scripts/gen-types.ts. Do not edit. */

export interface StewardDefineTarget {
  /**
   * the applier's device id
   */
  id: string;
  name?: string | null;
  aliases?: string[] | null;
  room?: string | null;
  /**
   * A computer's account tokens mapped to person ids (GA-DEF-11), apart from the applier's accounts
   */
  account_persons?: {
    [k: string]: string | undefined;
  } | null;
}
