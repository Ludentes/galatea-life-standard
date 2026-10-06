/* Generated from conformance/schemas/steward/define.person.json by scripts/gen-types.ts. Do not edit. */

export interface StewardDefinePerson {
  id: string;
  name: string;
  role: "owner" | "member" | "guest";
}
