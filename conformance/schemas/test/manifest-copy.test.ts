import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { schemaRoot } from "../src/index.js";

/**
 * The package carries the bridge-type manifest schema it loads, so that a `pnpm deploy` bundle has
 * it (plan 4b, *The desktop run*). `conformance/galatea-bridge.schema.json` stays the source: the
 * standard cites it by path, and the Python checks read it.
 */
describe("the package's copy of the manifest schema", () => {
  it("is byte for byte conformance/galatea-bridge.schema.json: copy it again after a change there", () => {
    const source = readFileSync(join(schemaRoot, "..", "galatea-bridge.schema.json"), "utf8");
    const copy = readFileSync(join(schemaRoot, "galatea-bridge.schema.json"), "utf8");
    expect(copy).toBe(source);
  });
});
