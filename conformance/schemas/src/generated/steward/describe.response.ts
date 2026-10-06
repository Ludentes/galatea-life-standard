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
   * Persons by id, name and role only (steward, Operations), and by id only to a front (GA-AUTH-8); not in the Operations table's list, see the reference steward's design, Standards problems found
   */
  persons?: {
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
  test_run_id?: string;
  [k: string]: unknown | undefined;
}
