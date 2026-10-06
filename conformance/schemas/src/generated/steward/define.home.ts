/* Generated from conformance/schemas/steward/define.home.json by scripts/gen-types.ts. Do not edit. */

export interface StewardDefineHome {
  timezone?: string | null;
  hold_time_s?: number | null;
  occupancy_hold_s?: number | null;
  ask_expiry_s?: number | null;
  notice_channels?: string[] | null;
  other_wake_words?: string[] | null;
  answer_words?: string[] | null;
  audio_retention_s?: number | null;
  time_source?: string | null;
}
