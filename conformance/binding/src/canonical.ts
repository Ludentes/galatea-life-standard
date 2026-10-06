/**
 * RFC 8785 (JCS) for the JSON values the standards' algorithms hold: object keys sorted by their
 * UTF-16 code units (JavaScript's own string order), no whitespace, and ECMAScript's own number and
 * string serialisation, which RFC 8785 adopts. A key whose value is undefined is left out, as JSON
 * leaves it out. Anything RFC 8785 has no form for is refused, never given a form of this package's
 * own: an undefined value (but an object's key), a number that is not finite, a function, a symbol, a
 * bigint. The reference applier's `core/canonical.ts`, from which this was copied, writes some of them
 * (an undefined array element as nothing, a non-finite number as `null`); no value read from the wire
 * holds them, and the applier's move onto this package removes the difference (the backlog). Every
 * TypeScript build computes the form here so that two builds cannot disagree.
 */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((x) => canonical(x)).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  throw new TypeError(`RFC 8785 has no form for ${typeof value === "number" ? String(value) : typeof value}`);
}
