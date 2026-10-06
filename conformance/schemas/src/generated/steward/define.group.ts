/* Generated from conformance/schemas/steward/define.group.json by scripts/gen-types.ts. Do not edit. */

export interface StewardDefineGroup {
  /**
   * An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
   */
  id: string;
  name: string;
  aliases?: string[];
  room: string | null;
  /**
   * Items: An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
   */
  members: string[];
  aggregate: "any" | "all";
}
