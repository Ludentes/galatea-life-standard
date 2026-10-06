import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateTypes } from "../scripts/gen-types.js";
import { schemaRoot } from "../src/index.js";

describe("generated types", () => {
  it("are what the schemas generate: run `pnpm --filter @ludentes/galatea-life-schemas gen` after a schema change", async () => {
    const out = mkdtempSync(join(tmpdir(), "galatea-types-"));
    try {
      const written = await generateTypes(out);
      expect(written).toContain("applier/describe.response.ts");
      expect(written).toContain("index.ts");
      for (const rel of written) {
        const committed = readFileSync(join(schemaRoot, "src", "generated", rel), "utf8");
        expect(readFileSync(join(out, rel), "utf8"), rel).toBe(committed);
      }
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 60_000);
});
