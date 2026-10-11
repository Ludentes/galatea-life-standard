/* Generated from conformance/schemas/steward/define.delete.json by scripts/gen-types.ts. Do not edit. */

export type StewardDefineDelete =
  | {
      id: string;
    }
  | {
      endpoint: string;
    }
  | {
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
  | {
      /**
       * An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
       */
      schedule: string;
      /**
       * YYYY-MM-DD, a date in the home's timezone
       */
      date: string;
    };
