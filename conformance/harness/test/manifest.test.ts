import { describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { allIds, conformanceRoot, constantMs, loadConstants, loadManifest, manifestRoot, packageRoot } from "../src/manifest.js";

describe("manifests and constants", () => {
  it("loads each standard's manifest", () => {
    const applier = loadManifest("applier");
    expect(applier.find((r) => r.id === "GA-PLAN-1")?.negative_subjects.map((s) => s.subject)).toContain("plans-with-side-effect");
    expect(allIds().has("GA-BRIDGE-17")).toBe(true);
  });

  it("reads a bound in ms from the constants", () => {
    expect(constantMs("applier", "plan-expiry")).toBe(60_000);
    expect(constantMs("bridge", "status-interval")).toBe(10_000);
    expect(loadConstants("applier").some((c) => c.guess)).toBe(true);
    expect(() => constantMs("applier", "no-such-constant")).toThrow(/no constant/);
  });
});

describe("where the manifests are read from", () => {
  const dirWith = (files: string[]) => {
    const d = mkdtempSync(join(tmpdir(), "harness-manifests-"));
    for (const f of files) writeFileSync(join(d, f), "[]");
    return d;
  };

  it("reads the repository's own manifests when the harness sits in it", () => {
    const repo = dirWith(["applier-requirements.json"]);
    const copy = dirWith(["applier-requirements.json"]);
    expect(manifestRoot([repo, copy])).toBe(repo);
  });

  it("reads the package's copy when installed, where the repository's are not there", () => {
    const outside = dirWith([]);
    const copy = dirWith(["applier-requirements.json"]);
    expect(manifestRoot([outside, copy])).toBe(copy);
  });

  it("says where it looked when neither holds them", () => {
    expect(() => manifestRoot([dirWith([]), dirWith([])])).toThrow(/applier-requirements\.json/);
  });

  it("the build copies every manifest and constants file into the package", () => {
    const copied = readdirSync(join(packageRoot, "manifests")).sort();
    const source = readdirSync(conformanceRoot).filter((f) => /-(requirements|constants)\.json$/.test(f)).sort();
    expect(copied).toEqual(source);
  });
});
