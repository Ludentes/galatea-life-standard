import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { schemaIds, schemaRoot, validate } from "../src/index.js";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".json") ? [path] : [];
  });
}

/** examples/valid/bridge/status/online.json → bridge/status.json */
function schemaOf(example: string, kind: "valid" | "invalid"): string {
  const rel = relative(join(schemaRoot, "examples", kind), example).split(sep);
  return `${rel.slice(0, -1).join("/")}.json`;
}

describe("schemas", () => {
  it("every schema compiles", () => {
    expect(schemaIds().length).toBeGreaterThan(10);
    for (const id of schemaIds()) expect(() => validate(id, {}), id).not.toThrow();
  });

  it("every valid example passes its schema", () => {
    const examples = files(join(schemaRoot, "examples", "valid"));
    expect(examples.length).toBeGreaterThan(10);
    for (const f of examples) {
      expect(validate(schemaOf(f, "valid"), JSON.parse(readFileSync(f, "utf8"))), f).toEqual([]);
    }
  });

  it("every invalid example fails its schema", () => {
    for (const f of files(join(schemaRoot, "examples", "invalid"))) {
      expect(validate(schemaOf(f, "invalid"), JSON.parse(readFileSync(f, "utf8"))), f).not.toEqual([]);
    }
  });

  it("every schema's $id is its path", () => {
    for (const id of schemaIds().filter((i) => i !== "galatea-bridge.schema.json")) {
      const schema = JSON.parse(readFileSync(join(schemaRoot, id), "utf8"));
      expect(schema.$id).toBe(id);
      expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    }
  });

  it("configure needs expected_revision unless every change is an ignore (applier, *Discovery*; GA-CFG-2; the 5b preflight's I4)", () => {
    const ig = { op: "upsert", kind: "ignore_candidate", value: { id: "x" } };
    const un = { op: "upsert", kind: "unignore_candidate", value: { key: "mac:01" } };
    const cl = { op: "upsert", kind: "client", value: {} };
    const ok = (b: unknown) => validate("applier/configure.request.json", b).length === 0;
    expect(ok({ changes: [ig, un], dry_run: false })).toBe(true);
    expect(ok({ changes: [ig], expected_revision: 3, dry_run: false })).toBe(true);
    expect(ok({ changes: [cl], expected_revision: 3, dry_run: false })).toBe(true);
    expect(ok({ changes: [cl], dry_run: false })).toBe(false);
    expect(ok({ changes: [ig, cl], dry_run: false })).toBe(false);
    expect(ok({ changes: [], dry_run: false })).toBe(false);
  });
});
