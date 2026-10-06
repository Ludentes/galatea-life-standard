/* Generated from conformance/schemas/steward/define.voice.json by scripts/gen-types.ts. Do not edit. */

export interface StewardDefineVoice {
  endpoint: string;
  listening: "off" | "tap" | "wake_device" | "wake_server";
  wake_words: {
    word: string;
    model: string;
  }[];
  zone: string | null;
  output: "speech" | null;
  follow_up: boolean;
  heard_by: string;
  skill_account?: string;
  skill_surface?: string;
}
