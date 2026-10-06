/* Generated from conformance/schemas/steward/define.schedule.json by scripts/gen-types.ts. Do not edit. */

export interface StewardDefineSchedule {
  /**
   * An id, as the applier standard's: 1 to 128 characters from [A-Za-z0-9._:/-], case-sensitive (steward, The house model)
   */
  id: string;
  /**
   * The scenario a run of the schedule runs
   */
  scenario: string;
  /**
   * HH:MM in the home's timezone
   */
  time: string;
  /**
   * ISO weekday numbers the schedule runs on, every day when absent
   */
  days?: [number, ...number[]];
  /**
   * @maxItems 64
   *
   * Items: Suppresses (skip) or moves (move, to time on the same date) exactly the run on its date, in the home's timezone (GA-SCHED-1)
   */
  exceptions?: ((
    | {
        action?: "skip";
        [k: string]: unknown | undefined;
      }
    | {
        action?: "move";
        [k: string]: unknown | undefined;
      }
  ) & {
    /**
     * YYYY-MM-DD, a date in the home's timezone
     */
    date: string;
    action: "skip" | "move";
    /**
     * HH:MM in the home's timezone
     */
    time?: string;
  })[];
}
