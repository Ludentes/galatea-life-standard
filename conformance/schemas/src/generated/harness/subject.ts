/* Generated from conformance/schemas/harness/subject.json by scripts/gen-types.ts. Do not edit. */

export interface HarnessSubject {
  standard: "applier" | "steward" | "bridge" | "brain" | "voice";
  /**
   * @minItems 1
   */
  claims: [string, ...string[]];
  start: {
    command: string;
    args?: string[];
    ready: {
      log: string;
      [k: string]: unknown | undefined;
    };
    [k: string]: unknown | undefined;
  };
  state_dir?: boolean;
  /**
   * A Postgres database of its own per test, as GALATEA_DATABASE_URL: true for a fresh one, or an object naming a migrate-only command the harness runs once per run into a template that each test's database is cloned from
   */
  database?:
    | boolean
    | {
        migrate: {
          command: string;
          args?: string[];
        };
      };
  /**
   * A database subject's tables whose lock stops a safety rule's firing from committing (GA-SAFE-3's crash clause); every table of its schema when absent
   *
   * @minItems 1
   */
  stall_tables?: [string, ...string[]];
  mutations?: string[];
  [k: string]: unknown | undefined;
}
