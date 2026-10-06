import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { packageRoot } from "../src/manifest.js";

// What a build outside the repository reaches through the package: its root, the subpaths a reference
// build's scripts and tests import, and its bins. Each target must be built and shipped.
const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
  exports: Record<string, string | { types?: string; default: string }>;
  bin: Record<string, string>;
  files: string[];
};
const shipped = (p: string) => pkg.files.some((f) => p.replace(/^\.\//, "") === f || p.replace(/^\.\//, "").startsWith(`${f}/`));

describe("the package a build reaches", () => {
  it("exports the subpaths the reference builds use, and no deep path", () => {
    expect(Object.keys(pkg.exports).sort()).toEqual([
      ".", "./database", "./package.json", "./reach", "./scripts/matrix-timing.mjs", "./scripts/reach.mjs", "./seams/mcp",
    ]);
  });

  it("ships every export's target and every bin", () => {
    const targets = [
      ...Object.values(pkg.exports).flatMap((t) => (typeof t === "string" ? [t] : [t.default, ...(t.types ? [t.types] : [])])),
      ...Object.values(pkg.bin),
    ];
    for (const t of targets) {
      expect(existsSync(join(packageRoot, t)), `${t} is built`).toBe(true);
      if (t !== "./package.json") expect(shipped(t), `${t} is in files`).toBe(true);
    }
  });

  it("names the bins a build's scripts call", () => {
    expect(Object.keys(pkg.bin).sort()).toEqual(["galatea-harness", "galatea-with-postgres"]);
  });
});
