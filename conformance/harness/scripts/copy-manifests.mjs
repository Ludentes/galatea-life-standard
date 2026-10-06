#!/usr/bin/env node
// Copies the standards' manifests and constants (conformance/*-requirements.json, *-constants.json)
// into the package's manifests/, so the harness finds them when installed from the registry. The
// repository's copies stay the source: src/manifest.ts reads them first when they are there.
import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(pkg, "..");
const target = join(pkg, "manifests");
const files = readdirSync(source).filter((f) => /-(requirements|constants)\.json$/.test(f));
if (!files.length) throw new Error(`no manifests in ${source}`);
rmSync(target, { recursive: true, force: true });
mkdirSync(target);
for (const f of files) copyFileSync(join(source, f), join(target, f));
