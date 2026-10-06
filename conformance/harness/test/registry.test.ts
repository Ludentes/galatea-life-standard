import { afterEach, describe, expect, it } from "vitest";
import { checkRegistry, clearRegistry, registered, requirement } from "../src/registry.js";

afterEach(() => clearRegistry());

describe("registry", () => {
  it("registers a test for its ids", () => {
    requirement("GA-X-1", { seam: "applier" }, async () => undefined);
    requirement(["GA-X-2", "GA-X-3"], { seam: "bridge", covers: "part" }, async () => undefined);
    expect(registered().map((t) => t.ids)).toEqual([["GA-X-1"], ["GA-X-2", "GA-X-3"]]);
  });

  it("refuses an id the manifests do not hold, and an id registered twice", () => {
    requirement("GA-X-1", { seam: "applier" }, async () => undefined);
    requirement(["GA-X-1", "GA-NOPE-9"], { seam: "applier" }, async () => undefined);
    const errors = checkRegistry(new Set(["GA-X-1"]));
    expect(errors).toContain("GA-NOPE-9 is not in any manifest");
    expect(errors).toContain("GA-X-1 has two tests");
  });
});
