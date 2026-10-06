/* Generated from conformance/schemas/steward/answer.request.json by scripts/gen-types.ts. Do not edit. */

export interface StewardAnswerRequest {
  plan_id: string;
  endpoint: string;
  speaker?: string;
  /**
   * What a spoken yes carries (steward, The confirmation dialogue)
   */
  utterance?: {
    utterance_id: string;
    endpoint: string;
    /**
     * MCP seams: RFC 3339 with offset
     */
    time: string;
    clock_epoch?: string;
    transcript: string;
    addressed_by?: "wake" | "tap" | "follow_up" | "skill" | "typed";
    speaker_hint?: string;
    hint_basis?: "gate" | "person";
    asked_by?: {
      say_id: string;
      status: "full" | "cut" | "dropped";
      cut_by?: string;
      /**
       * MCP seams: RFC 3339 with offset
       */
      ended_at?: string;
      clock_epoch?: string;
      [k: string]: unknown | undefined;
    };
    [k: string]: unknown | undefined;
  };
  answers: {
    [k: string]: "yes" | "no" | undefined;
  };
  [k: string]: unknown | undefined;
}
