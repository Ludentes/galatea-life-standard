/* Generated from conformance/schemas/steward/zone_sources.response.json by scripts/gen-types.ts. Do not edit. */

export interface StewardZoneSourcesResponse {
  sources: {
    target: string;
    speech: string | null;
    speaking_for_ms: number;
    [k: string]: unknown | undefined;
  }[];
  cursor: string;
  [k: string]: unknown | undefined;
}
