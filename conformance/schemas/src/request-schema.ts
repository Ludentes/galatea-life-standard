import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The sides whose operations an MCP server lists as tools. */
export type ToolSide = "steward" | "applier";

/** A tool's `inputSchema` as MCP wants it: an object schema, self-contained. */
export type ToolInputSchema = { type: "object"; $schema: string } & Record<string, unknown>;

const DRAFT = "https://json-schema.org/draft/2020-12/schema";
/** Keywords that only frame a document; once every `$ref` is inlined they say nothing. */
const FRAMING = new Set(["$schema", "$id", "$defs", "$comment"]);
const ANNOTATIONS = new Set(["title", "description"]);

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };
const isObj = (v: Json | undefined): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** `<side>/<op>.request.json`'s operations, read from the files the package carries. */
export function requestOperations(side: ToolSide, root: string): string[] {
  return readdirSync(join(root, side)).filter((f) => f.endsWith(".request.json")).map((f) => f.slice(0, -".request.json".length)).sort();
}

/**
 * Inlines every `$ref` of the document `id`, so that a client that resolves none (MCP clients
 * do not) still sees each parameter's type. A `$ref` alone is replaced by what it points at; one
 * with siblings other than a title or description becomes an `allOf`, which keeps its meaning in
 * 2020-12 exactly. A cycle is refused: it cannot be inlined.
 */
export function bundle(id: string, root: string): Obj {
  const docs = new Map<string, Obj>();
  const doc = (docId: string): Obj => {
    let d = docs.get(docId);
    if (!d) {
      d = JSON.parse(readFileSync(join(root, docId), "utf8")) as Obj;
      docs.set(docId, d);
    }
    return d;
  };
  const at = (docId: string, pointer: string): Json => {
    let node: Json = doc(docId);
    for (const raw of pointer.split("/").slice(1)) {
      const key = decodeURIComponent(raw).replace(/~1/g, "/").replace(/~0/g, "~");
      const next: Json | undefined = Array.isArray(node) ? node[Number(key)] : isObj(node) ? node[key] : undefined;
      if (next === undefined) throw new Error(`${docId}#${pointer}: no such place`);
      node = next;
    }
    return node;
  };
  const walk = (docId: string, node: Json, stack: string[]): Json => {
    if (Array.isArray(node)) return node.map((n) => walk(docId, n, stack));
    if (!isObj(node)) return node;
    const out: Obj = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "$ref" || FRAMING.has(k)) continue;
      // "properties", "$defs"-like maps hold schemas by name; every value is walked alike.
      out[k] = walk(docId, v, stack);
    }
    const ref = node.$ref;
    if (typeof ref !== "string") return out;
    const url = new URL(ref, `galatea:/${docId}`);
    const target = url.pathname.slice(1);
    const pointer = decodeURIComponent(url.hash.replace(/^#/, ""));
    const key = `${target}#${pointer}`;
    if (stack.includes(key)) throw new Error(`${id}: a $ref cycle through ${key}`);
    const inlined = walk(target, at(target, pointer), [...stack, key]);
    const siblings = Object.keys(out);
    if (siblings.length === 0) return inlined;
    if (isObj(inlined) && siblings.every((s) => ANNOTATIONS.has(s))) return { ...inlined, ...out };
    return { ...out, allOf: [...(Array.isArray(out.allOf) ? out.allOf : []), inlined] };
  };
  const top = walk(id, doc(id), [`${id}#`]);
  if (!isObj(top)) throw new Error(`${id}: not an object schema`);
  return top;
}

/**
 * The request schema of `side`'s operation `op` (`<side>/<op>.request.json`), with every `$ref`
 * inlined: one self-contained JSON Schema 2020-12 document, its top level `type: "object"`, as
 * MCP's `tools/list` wants for a tool's `inputSchema`. Throws when the side has no request schema
 * for `op`, so that a server listing it fails at start.
 */
export function requestSchemaOf(side: ToolSide, op: string, root: string): ToolInputSchema {
  if (!requestOperations(side, root).includes(op)) throw new Error(`no request schema for ${side} operation ${op}`);
  const schema = bundle(`${side}/${op}.request.json`, root);
  if (schema.type !== "object") throw new Error(`${side}/${op}.request.json: its top level is not type: "object"`);
  return { $schema: DRAFT, ...schema } as ToolInputSchema;
}
