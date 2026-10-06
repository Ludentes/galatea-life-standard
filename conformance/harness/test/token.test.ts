import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { jcs, proof } from "../src/tests/token.js";

describe("the harness's tokens", () => {
  it("canonicalises as RFC 8785: keys sorted by code unit, no whitespace, ECMAScript numbers", () => {
    expect(jcs({ b: 1, a: [true, null, "x"], "é": 1e21, B: 0.5 })).toBe('{"B":0.5,"a":[true,null,"x"],"b":1,"é":1e+21}');
  });

  it("proves with HMAC-SHA256 over that form, as base64url without padding", () => {
    const unsigned = { token_id: "t", issuer: "harness" };
    expect(proof(unsigned, "k".repeat(16))).toBe(createHmac("sha256", "k".repeat(16)).update('{"issuer":"harness","token_id":"t"}').digest("base64url"));
    expect(proof(unsigned, "k".repeat(16))).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
