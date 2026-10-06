import { describe, expect, it, vi } from "vitest";

/** One read of the manifest schema fails, as it did in a deployed bundle without the file. */
const failNext = vi.hoisted(() => ({ manifest: false }));
vi.mock("node:fs", async (original) => {
  const fs = await original<typeof import("node:fs")>();
  const readFileSync = ((path: unknown, ...rest: unknown[]) => {
    if (failNext.manifest && String(path).endsWith("galatea-bridge.schema.json")) {
      failNext.manifest = false;
      throw Object.assign(new Error(`ENOENT: no such file or directory, open '${String(path)}'`), { code: "ENOENT" });
    }
    return (fs.readFileSync as (...a: unknown[]) => unknown)(path, ...rest);
  }) as typeof fs.readFileSync;
  return { ...fs, readFileSync, default: { ...fs, readFileSync } };
});

const { validate } = await import("../src/index.js");

describe("the validator after a failed load", () => {
  it("throws the load's error, then loads again at the next call rather than keeping a half-filled validator", () => {
    failNext.manifest = true;
    expect(() => validate("bridge/command.json", {})).toThrow(/ENOENT/);
    expect(validate("bridge/command.json", {}).length).toBeGreaterThan(0);
    expect(validate("galatea-bridge.schema.json", {}).length).toBeGreaterThan(0);
  });
});
