import { createHmac, timingSafeEqual } from "node:crypto";
import { canonical } from "./canonical.js";

/**
 * A confirmation token (applier, *Clients and tokens*): a client's proof that a person confirmed
 * this exact action, as `applier/token.json` gives its shape.
 */
export interface Token {
  token_id: string;
  issuer: string;
  target: string;
  action: string;
  args: unknown;
  via: string;
  brain: boolean;
  for: Record<string, unknown>;
  expires: string;
  proof: string;
}
export type UnsignedToken = Omit<Token, "proof">;

/**
 * The proof of a token (applier, *The MCP binding*): HMAC-SHA256, keyed by the client's token key as
 * UTF-8, over the token without `proof` in RFC 8785 form, as base64url without padding.
 */
export function proofOf(unsigned: UnsignedToken, key: string): string {
  return createHmac("sha256", key).update(canonical(unsigned)).digest("base64url");
}

/** `unsigned` with its proof under `key`. */
export function signToken(unsigned: UnsignedToken, key: string): Token {
  return { ...unsigned, proof: proofOf(unsigned, key) };
}

/**
 * Whether `token`'s proof verifies under `key`, compared in constant time for its length, so the time
 * a refusal takes says nothing about how much of a forged proof was right. Only the proof: whether the
 * token names its step, its issuer and its expiry are the verifier's own checks.
 */
export function proofHolds(token: Token, key: string): boolean {
  const { proof, ...unsigned } = token;
  if (typeof proof !== "string") return false;
  let expected: string;
  try {
    expected = proofOf(unsigned, key);
  } catch {
    return false; // a token holding a value RFC 8785 has no form for proves nothing
  }
  const want = Buffer.from(expected, "utf8");
  const got = Buffer.from(proof, "utf8");
  return got.length === want.length && timingSafeEqual(got, want);
}
