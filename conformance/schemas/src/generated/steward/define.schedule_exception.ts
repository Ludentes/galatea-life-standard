/* Generated from conformance/schemas/steward/define.schedule_exception.json by scripts/gen-types.ts. Do not edit. */

export type StewardDefineScheduleException = {
  /**
   * An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
   */
  schedule: string;
  /**
   * YYYY-MM-DD, a date in the home's timezone
   */
  date: string;
  action: "skip" | "move";
  /**
   * HH:MM in the home's timezone
   */
  time?: string;
} & (
  | {
      action?: "skip";
      [k: string]: unknown | undefined;
    }
  | {
      action?: "move";
      [k: string]: unknown | undefined;
    }
);
