/* Generated from conformance/schemas/steward/define.rule_exception.json by scripts/gen-types.ts. Do not edit. */

export interface StewardDefineRuleException {
  /**
   * An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
   */
  rule: string;
  /**
   * MCP seams: RFC 3339 with offset
   */
  from: string;
  /**
   * MCP seams: RFC 3339 with offset
   */
  until: string;
}
