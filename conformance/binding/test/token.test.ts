import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonical, proofHolds, proofOf, signToken, type UnsignedToken } from "../src/index.js";

type Case = { name: string; key: string; unsigned: UnsignedToken; canonical: string; proof: string };
const { cases, invalid_args: invalid } = JSON.parse(readFileSync(new URL("../vectors/token.json", import.meta.url), "utf8")) as
  { cases: Case[]; invalid_args: { name: string; js: string }[] };

describe("the token's proof (applier, The MCP binding)", () => {
  it("holds vectors, the reference applier's own test token among them", () => {
    expect(cases.length).toBeGreaterThanOrEqual(3);
    // The form the reference applier's token test asserts for its token, written out.
    expect(cases[0]!.canonical).toBe('{"action":"cover.close","args":{},"brain":false,"expires":"2030-01-01T08:01:00.000Z","for":{"person":"demo"},'
      + '"issuer":"steward","target":"hall:gate","token_id":"t-1","via":"app"}');
  });

  for (const c of [...cases]) {
    it(`gives each vector's RFC 8785 form and proof: ${c.name}`, () => {
      expect(canonical(c.unsigned)).toBe(c.canonical);
      expect(proofOf(c.unsigned, c.key)).toBe(c.proof);
      expect(c.proof).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(signToken(c.unsigned, c.key)).toEqual({ ...c.unsigned, proof: c.proof });
    });
  }

  it("sorts keys by UTF-16 code units, as RFC 8785 says, not by code points", () => {
    // U+1F600 is the surrogate pair D83D DE00, which sorts before U+FFFF in UTF-16 and after it by code point.
    expect(canonical({ "￿": 1, "😀": 2, z: 3, "é": 4 })).toBe('{"z":3,"é":4,"😀":2,"￿":1}');
    expect(canonical({ a: undefined, c: -0, d: 1e21 })).toBe('{"c":0,"d":1e+21}');
  });

  for (const v of invalid) {
    it(`refuses a value RFC 8785 has no form for, failing closed: ${v.name}`, () => {
      const args = new Function(`return ${v.js}`)() as Record<string, unknown>;
      const unsigned = { ...cases[1]!.unsigned, args };
      expect(() => canonical(unsigned)).toThrow(TypeError);
      expect(() => signToken(unsigned, cases[1]!.key)).toThrow(TypeError);
      expect(proofHolds({ ...signToken(cases[1]!.unsigned, cases[1]!.key), args }, cases[1]!.key)).toBe(false);
    });
  }

  it("refuses an undefined value outside an object's key", () => {
    expect(() => canonical(undefined)).toThrow(TypeError);
  });

  it("verifies a proof in constant time, and refuses another key, a changed field and a changed proof", () => {
    const c = cases[1]!;
    const t = signToken(c.unsigned, c.key);
    expect(proofHolds(t, c.key)).toBe(true);
    expect(proofHolds(t, `${c.key}x`)).toBe(false);
    expect(proofHolds({ ...t, args: { level: 41 } }, c.key)).toBe(false);
    expect(proofHolds({ ...t, for: { ...t.for, apply: "a-other" } }, c.key)).toBe(false);
    expect(proofHolds({ ...t, proof: `${t.proof.slice(0, -1)}${t.proof.endsWith("A") ? "B" : "A"}` }, c.key)).toBe(false);
    expect(proofHolds({ ...t, proof: t.proof.slice(1) }, c.key)).toBe(false);
  });
});
