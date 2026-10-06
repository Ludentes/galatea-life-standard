/* Generated from conformance/schemas/brain/listen.response.json by scripts/gen-types.ts. Do not edit. */

export interface BrainListenResponse {
  cursor: string;
  utterances: {
    utterance_id: string;
    endpoint: string;
    /**
     * MCP seams: RFC 3339 with offset
     */
    time: string;
    clock_epoch?: string;
    /**
     * MCP seams: RFC 3339 with offset
     */
    available_at: string;
    transcript: string;
    speaker_hint?: string;
    hint_basis?: "gate" | "person";
    echo?: boolean;
    source?: string;
    addressed_by?: "wake" | "tap" | "follow_up" | "skill" | "typed";
    conversation?: string;
    also_heard_at?: {
      endpoint: string;
      addressed_by: "wake" | "tap" | "follow_up" | "skill" | "typed";
      speaker_hint?: string;
      hint_basis?: "gate" | "person";
      [k: string]: unknown | undefined;
    }[];
    [k: string]: unknown | undefined;
  }[];
  played: {
    say_id: string;
    endpoint: string;
    status: "full" | "cut" | "dropped";
    reason?: string;
    heard_chars?: number;
    cut_by?: string;
    /**
     * MCP seams: RFC 3339 with offset
     */
    ended_at?: string;
    clock_epoch?: string;
    latency_ms?: number;
    [k: string]: unknown | undefined;
  }[];
  [k: string]: unknown | undefined;
}
