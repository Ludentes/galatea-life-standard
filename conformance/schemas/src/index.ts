import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import formatsModule from "ajv-formats";

/** conformance/schemas/, from src/ under vitest and from dist/ when built. */
export const schemaRoot = fileURLToPath(new URL("..", import.meta.url));
const SCHEMA_DIRS = ["bridge", "applier", "steward", "brain", "harness"];
/**
 * The finder's bridge-type manifest schema, as the package carries it, so that a `pnpm deploy`
 * bundle has it: a copy of `conformance/galatea-bridge.schema.json`, the source the standard cites
 * and the Python checks read, kept equal to it by a test.
 */
const BRIDGE_MANIFEST = join(schemaRoot, "galatea-bridge.schema.json");

export type Schema = { $id: string } & Record<string, unknown>;

function walk(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith(".json") ? [path] : [];
  });
}

function load(): Schema[] {
  const paths = [join(schemaRoot, "common.json"), ...SCHEMA_DIRS.flatMap((d) => walk(join(schemaRoot, d)))];
  const schemas = paths.map((p) => JSON.parse(readFileSync(p, "utf8")) as Schema);
  schemas.push({ ...JSON.parse(readFileSync(BRIDGE_MANIFEST, "utf8")), $id: "galatea-bridge.schema.json" });
  return schemas;
}

const addFormats = ((formatsModule as unknown as { default?: unknown }).default ?? formatsModule) as (
  ajv: Ajv2020,
) => Ajv2020;

let ajv: Ajv2020 | undefined;
function validator(): Ajv2020 {
  if (!ajv) {
    const fresh = new Ajv2020({ allErrors: true, strict: false });
    addFormats(fresh);
    // Ajv 8.20.0 cannot resolve a relative $ref such as "../common.json#/..." from a relative $id
    // (bridge/status.json): it treats each schema as its own base and never finds the sibling. An
    // absolute $id gives every schema a shared root to resolve relative $refs against.
    for (const schema of load()) fresh.addSchema({ ...schema, $id: "/" + schema.$id });
    // Kept only once every schema loaded: a failed load is tried again, never remembered half done.
    ajv = fresh;
  }
  return ajv;
}

/** Every schema document, common.json first, and the bridge-type manifest last. */
export function loadSchemas(): Schema[] {
  return load();
}

export function schemaIds(): string[] {
  return load().map((s) => s.$id);
}

export function validate(id: string, value: unknown): string[] {
  const fn = validator().getSchema("/" + id);
  if (!fn) throw new Error(`no schema ${id}`);
  return fn(value) ? [] : (fn.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`);
}

export function assertValid(id: string, value: unknown): void {
  const errors = validate(id, value);
  if (errors.length) throw new Error(`${id}: ${errors.join("; ")}`);
}

export type * from "./generated/index.js";
