import { createHmac, randomUUID } from "node:crypto";
import { must } from "../assert.js";
import type { TestContext } from "../context.js";
import { HARNESS_CLIENT } from "../home.js";

/** An action as a steward asks for it, which a token names exactly (GA-TOKEN-2). */
export type Asked = { target: string; action: string; args: unknown; via: string; brain: boolean; for: unknown };

/**
 * RFC 8785 (JCS) for the JSON a token holds: object keys sorted by their UTF-16 code units, no
 * whitespace, and ECMAScript's own string and number forms, which RFC 8785 adopts.
 */
export function jcs(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(jcs).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${jcs(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** A token's proof (applier, *The MCP binding*): HMAC-SHA256 over its JCS form without `proof`, base64url without padding. */
export function proof(unsigned: Record<string, unknown>, key: string): string {
  return createHmac("sha256", key).update(jcs(unsigned)).digest("base64url");
}

/**
 * A confirmation token for `a`, as the harness's client issues one: expiring 60 s ahead on the
 * subject's clock, signed with the key the harness registered. `extra` changes the token before it
 * is signed, so a test can make one that names another action or expires otherwise.
 */
export function sign(ctx: TestContext, a: Asked, extra: Record<string, unknown> = {}): Record<string, unknown> {
  must(ctx.tokenKey !== undefined, "the harness registered no token key");
  const unsigned = { token_id: randomUUID(), issuer: HARNESS_CLIENT, target: a.target, action: a.action, args: a.args, via: a.via,
    brain: a.brain, for: a.for, expires: new Date(ctx.time.now() + 60_000).toISOString(), ...extra };
  return { ...unsigned, proof: proof(unsigned, ctx.tokenKey!) };
}
