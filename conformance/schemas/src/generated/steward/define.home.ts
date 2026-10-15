/* Generated from conformance/schemas/steward/define.home.json by scripts/gen-types.ts. Do not edit. */

export interface StewardDefineHome {
  timezone?: string | null;
  /**
   * The hold policy (GA-LEASE-8): an upsert sets the fields it names, a null field back to the steward's own; null whole puts every field back
   */
  hold?: {
    on_s?: number | null;
    off_s?: number | null;
    other_s?: number | null;
    fixed_s?: number | null;
    load_cap_s?: number | null;
    /**
     * 0: no cap; null: back to the steward's own
     */
    cap_s?: number | null;
    presence_renews?: boolean | null;
    vacant_ends?: boolean | null;
    schedule_ends?: boolean | null;
    owner_work_passes_guest_holds?: boolean | null;
    /**
     * The home's switch (GA-LEASE-12); no steward refuses it
     */
    owner_work_passes_holds?: boolean | null;
  } | null;
  occupancy_hold_s?: number | null;
  ask_expiry_s?: number | null;
  notice_channels?: string[] | null;
  other_wake_words?: string[] | null;
  answer_words?: string[] | null;
  audio_retention_s?: number | null;
  time_source?: string | null;
}
