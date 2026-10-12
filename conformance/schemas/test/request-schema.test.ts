import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import formatsModule from "ajv-formats";
import { describe, expect, it } from "vitest";
import { requestOperations, requestSchemaFor, schemaRoot } from "../src/index.js";

const addFormats = ((formatsModule as unknown as { default?: unknown }).default ?? formatsModule) as (a: Ajv2020) => Ajv2020;

/** A fresh validator that knows no other schema: a bundled schema must stand on its own. */
function alone(schema: object) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  expect(ajv.validateSchema(schema), JSON.stringify(ajv.errors)).toBe(true);
  return ajv.compile(schema);
}

function examples(kind: "valid" | "invalid", side: string, op: string): { name: string; value: unknown }[] {
  const dir = join(schemaRoot, "examples", kind, side, `${op}.request`);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json"))
    .map((f) => ({ name: `${kind}/${side}/${op}.request/${f}`, value: JSON.parse(readFileSync(join(dir, f), "utf8")) }));
}

describe("requestSchemaFor", () => {
  for (const side of ["steward", "applier"] as const) {
    describe(side, () => {
      const ops = requestOperations(side);

      it("lists every <op>.request.json of the side", () => {
        const files = readdirSync(join(schemaRoot, side)).filter((f) => f.endsWith(".request.json")).map((f) => f.slice(0, -".request.json".length));
        expect([...ops].sort()).toEqual(files.sort());
        expect(ops.length).toBeGreaterThan(5);
      });

      for (const op of ops) {
        it(`${op}: self-contained, a 2020-12 object schema, keeping its examples' verdicts`, () => {
          const schema = requestSchemaFor(side, op);
          expect(schema.type).toBe("object");
          expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
          expect(JSON.stringify(schema)).not.toMatch(/"\$(ref|dynamicRef|id|defs)"/);
          const check = alone(schema);
          for (const e of examples("valid", side, op)) expect(check(e.value), `${e.name}: ${JSON.stringify(check.errors)}`).toBe(true);
          for (const e of examples("invalid", side, op)) expect(check(e.value), e.name).toBe(false);
        });
      }
    });
  }

  it("steward plan: actions is an array of objects", () => {
    const schema = requestSchemaFor("steward", "plan") as { properties: Record<string, { type?: string; items?: { type?: string } }> };
    expect(schema.properties.actions!.type).toBe("array");
    expect(schema.properties.actions!.items!.type).toBe("object");
    expect(schema.properties.endpoint!.type).toBe("string");
  });

  it("applier plan bundles too", () => {
    const schema = requestSchemaFor("applier", "plan");
    expect(schema.type).toBe("object");
    expect(JSON.stringify(schema)).not.toContain("$ref");
  });

  it("has examples to check against for steward plan", () => {
    expect(examples("valid", "steward", "plan").length).toBeGreaterThan(0);
    expect(examples("invalid", "steward", "plan").length).toBeGreaterThan(0);
  });

  it("refuses an operation with no request schema", () => {
    expect(() => requestSchemaFor("steward", "no_such_op")).toThrow(/no request schema/);
  });

  it("hands out a copy: changing one leaves the next call untouched", () => {
    const a = requestSchemaFor("steward", "plan") as { properties: Record<string, unknown> };
    delete a.properties.actions;
    expect((requestSchemaFor("steward", "plan") as { properties: Record<string, unknown> }).properties.actions).toBeDefined();
  });
});
