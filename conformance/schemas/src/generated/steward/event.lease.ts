/* Generated from conformance/schemas/steward/event.lease.json by scripts/gen-types.ts. Do not edit. */

export type StewardEventLease = {
  seq: number;
  /**
   * MCP seams: RFC 3339 with offset
   */
  time: string;
  type: "lease";
  target: string;
  change: "granted" | "replaced" | "ended";
  /**
   * Who holds a lease (steward, Clients, endpoints and principals): a principal (a press rule's `{ rule, press }` among them), or safety_rule, external or load_cap
   */
  holder:
    | {
        person?: string;
        endpoint: string;
        [k: string]: unknown | undefined;
      }
    | {
        rule: string;
        /**
         * A press rule's hold: the press it came from, the occurrence's reported value (GA-LEASE-9)
         */
        press?: {
          target: string;
          key: string;
          value: unknown;
          [k: string]: unknown | undefined;
        };
        [k: string]: unknown | undefined;
      }
    | {
        run: string;
        [k: string]: unknown | undefined;
      }
    | ("external" | "safety_rule" | "load_cap");
  precedence: "safety_rule" | "person" | "scheduled_run" | "rule";
  expires: string | "run_end";
  /**
   * A person's hold granted or replacing: the change's direction; none for a load_cap lease
   */
  direction?: "on" | "off" | "other";
  /**
   * A granted apply's hold: the role derived at the apply, kept with the hold (GA-LEASE-10)
   */
  role?: "owner" | "member" | "guest";
  /**
   * A hold a press replaced, granted again after the press's step ended unreachable (GA-LEASE-9)
   */
  restored?: true;
  /**
   * What ended the lease, on an `ended` event only; a person's hold's ended event names it (GA-LEASE-7)
   */
  end?: "quiet" | "window" | "cap" | "vacant" | "schedule" | "replaced" | "unreachable" | "removed";
  /**
   * With end quiet: the moment the room last became quiet; absent when quiet throughout
   */
  quiet_since?: string;
  /**
   * An end that fell inside a restart's gap, ended at the restart (GA-PERSIST-2)
   */
  end_time?: string;
  /**
   * With end schedule: the schedule's run
   */
  run?: string;
  [k: string]: unknown | undefined;
};
