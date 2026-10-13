import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import formatsModule from "ajv-formats";
import { requestOperations as operationsIn, requestSchemaOf, type ToolInputSchema, type ToolSide } from "./request-schema.js";

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

const bundled = new Map<string, ToolInputSchema>();

/** `side`'s operations that have a request schema (`<side>/<op>.request.json`), sorted. */
export function requestOperations(side: ToolSide): string[] {
  return operationsIn(side, schemaRoot);
}

/**
 * The request schema of `side`'s operation `op`, every `$ref` inlined: one self-contained JSON
 * Schema 2020-12 document whose top level is `type: "object"`, ready to be an MCP tool's
 * `inputSchema`. Throws when `op` has no request schema. Each call hands out a fresh copy.
 */
export function requestSchemaFor(side: ToolSide, op: string): ToolInputSchema {
  const key = `${side}/${op}`;
  let schema = bundled.get(key);
  if (!schema) {
    schema = requestSchemaOf(side, op, schemaRoot);
    bundled.set(key, schema);
  }
  return structuredClone(schema);
}

export type { ToolInputSchema, ToolSide };
export type * from "./generated/index.js";

const COMBINATORS = ["oneOf", "anyOf", "allOf"] as const;

/**
 * `requestSchemaFor`, made fit to list as an MCP tool's `inputSchema`: no `oneOf`, `anyOf` or
 * `allOf` at its top level, since the Anthropic API refuses such a schema and Claude Code drops the
 * tool (with a debug line, nothing on screen). The properties stay, with the fields every request
 * needs; alternatives that differ only in what they require are said in the schema's
 * `description` instead. The server still validates each request against the full schema.
 */
export function toolInputSchemaFor(side: ToolSide, op: string): ToolInputSchema {
  const schema: Record<string, unknown> = requestSchemaFor(side, op);
  const said: string[] = [];
  for (const k of COMBINATORS) {
    const branches = schema[k];
    if (!Array.isArray(branches)) continue;
    delete schema[k];
    const required = branches.map((b: { required?: unknown }) => (Array.isArray(b?.required) ? (b.required as string[]) : []));
    if (k === "allOf") {
      // Every branch binds, so its properties and required fields join the top level's.
      schema.required = [...new Set([...((schema.required as string[] | undefined) ?? []), ...required.flat()])];
      for (const branch of branches as { properties?: Record<string, unknown> }[]) Object.assign((schema.properties ??= {}) as object, branch?.properties ?? {});
      continue;
    }
    const words = required.map((r) => (r.length > 1 ? `${r.slice(0, -1).join(", ")} and ${r[r.length - 1]}` : r.join(""))).join("; ");
    said.push(`Give ${k === "oneOf" ? "exactly" : "at least"} one of: ${words}.`);
  }
  if (said.length) schema.description = [schema.description, ...said].filter((d) => typeof d === "string" && d !== "").join(" ");
  return schema as ToolInputSchema;
}
