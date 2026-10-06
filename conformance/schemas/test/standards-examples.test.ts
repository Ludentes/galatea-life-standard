import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { schemaRoot, validate } from "../src/index.js";

const standardDir = join(schemaRoot, "..", "..", "standard");

/** Every fenced json block in a standard, with the line it starts on. */
function blocks(file: string): { line: number; body: string }[] {
  const out: { line: number; body: string }[] = [];
  const lines = readFileSync(join(standardDir, file), "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim() !== "```json") continue;
    const start = i + 1;
    let end = start;
    while (end < lines.length && lines[end]!.trim() !== "```") end++;
    out.push({ line: start, body: lines.slice(start, end).join("\n") });
    i = end;
  }
  return out;
}

/** Which schema an example belongs to; a new kind of example needs a line here. */
function schemaFor(example: Record<string, unknown>): string | undefined {
  if ("matchers" in example) return "galatea-bridge.schema.json";
  return undefined;
}

describe("the standards' own JSON examples", () => {
  const all = readdirSync(standardDir)
    .filter((f) => f.endsWith(".md"))
    .flatMap((f) => blocks(f).map((b) => ({ ...b, where: `${f}:${b.line}` })));

  it("there is at least the bridge-type manifest", () => {
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it("each is valid against the schema mapped to it", () => {
    for (const b of all) {
      const example = JSON.parse(b.body) as Record<string, unknown>;
      const id = schemaFor(example);
      expect(id, `${b.where}: no schema mapped for this example`).toBeDefined();
      expect(validate(id!, example), b.where).toEqual([]);
    }
  });
});
