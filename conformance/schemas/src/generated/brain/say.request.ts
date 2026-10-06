/* Generated from conformance/schemas/brain/say.request.json by scripts/gen-types.ts. Do not edit. */

export interface BrainSayRequest {
  endpoint: string;
  in_reply_to?: string;
  asks?: string;
  text: string;
  continues?: string;
  reports?: {
    [k: string]: unknown | undefined;
  }[];
  cites?: number[];
  invites_reply?: boolean;
  final?: boolean;
  [k: string]: unknown | undefined;
}
