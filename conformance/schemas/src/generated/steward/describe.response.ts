/* Generated from conformance/schemas/steward/describe.response.json by scripts/gen-types.ts. Do not edit. */

export interface StewardDescribeResponse {
  steward_id: string;
  standard_version: string;
  revision: number;
  home: {
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
