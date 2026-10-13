/* Generated from conformance/schemas/steward/describe.response.json by scripts/gen-types.ts. Do not edit. */

export interface StewardDescribeResponse {
  steward_id: string;
  standard_version: string;
  revision: number;
  /**
   * The home's settings; a front sees only audio_retention_s and other_wake_words (GA-AUTH-8), every other reader the hold policy in force (GA-LEASE-8)
   */
  home: {
    /**
     * The hold policy in force (steward, How a person's hold ends; GA-LEASE-8): every field present, as describe shows it
     */
    hold?: {
      /**
       * The quiet window after an on change
       */
      on_s: number;
      /**
       * The quiet window after an off change
       */
      off_s: number;
      /**
       * The quiet window after any other change
       */
      other_s: number;
      /**
       * The window from the change for a device with no room or no presence source
       */
      fixed_s: number;
      /**
       * The window from the change for a load_cap lease
       */
      load_cap_s: number;
      /**
       * A person's hold ends this long after the change whatever presence does, never before its floor; 0: no cap
       */
      cap_s: number;
      presence_renews: boolean;
      vacant_ends: boolean;
      schedule_ends: boolean;
      /**
       * Whether the owner's rules and schedules pass a guest's hold (GA-LEASE-10)
       */
      owner_work_passes_guest_holds: boolean;
    };
    [k: string]: unknown | undefined;
  };
  rooms: unknown[];
  targets: unknown[];
  groups: unknown[];
  endpoints: unknown[];
  /**
   * Persons by id, name and role only (steward, Operations), and by id only to a front (GA-AUTH-8)
   */
  persons: {
    id: string;
    name?: string;
    role?: "owner" | "member" | "guest";
    [k: string]: unknown | undefined;
  }[];
  scenarios: unknown[];
  rules: unknown[];
  schedules: unknown[];
  modes: unknown[];
  applier: {
    applier_id: string;
    levels: string[];
    ungoverned: unknown[];
    [k: string]: unknown | undefined;
  };
  /**
   * The bound on replaying an edge from a gap, at most 300 s; absent when the steward replays none (GA-RULE-1)
   */
  edge_replay_s?: number;
  /**
   * The bound on a latchless safety lease; absent when the steward never ends one early (GA-LEASE-6)
   */
  safety_lease_s?: number;
  /**
   * The count of notices held, shown while no channel has notify (GA-NOTE-1)
   */
  held_notices?: number;
  test_run_id?: string;
  [k: string]: unknown | undefined;
}
