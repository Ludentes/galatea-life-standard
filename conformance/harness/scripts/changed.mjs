// Reads what a change's scope is made of and works it out: the files changed against a base (git, run
// through an injected runner), the build's sources and mutation files, the registry's check files and
// the shared harness's place in the repository. The scope itself is `dist/changed.js`'s, which is pure.
// Used by the reference builds' drivers (`--changed <base>`); see docs/guides/2026-10-05-how-builds-are-checked.md,
// *What runs when*.
//
// As a command, it prints a build's scope and runs nothing:
//   node scripts/changed.mjs --build <dir> --base <ref> [--head <ref>] [--uncommitted] [--json]
//
// With `--head` other than HEAD, the build's mutation files, its sources and its conditional shared
// files are read from that head, but the registry's check files, the harness's imports and the shared
// packages' places are this checkout's; `--uncommitted` is refused with it, the working tree being
// this checkout's too.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BUILD, changedScope, conditionalChange, declared, entries, importsOf, REPOSITORY, rowEntries, rowIds, SHARED_HARNESS, sharedClosure,
  sharedFor, siteCounts, siteFiles, sourceOfBuilt, unionSites, unscoped } from "../dist/changed.js";
import { loadManifest, manifestRoot } from "../dist/manifest.js";
import { registered } from "../dist/registry.js";

const harnessRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/** A git runner in `cwd`: `git(args)` returns its standard output, and throws on a non-zero exit. */
export function gitRunner(cwd) {
  return (args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 });
}

/** The files under `dir` ending in `.ts`, but declarations, sorted. */
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name))
    : e.name.endsWith(".ts") && !e.name.endsWith(".d.ts") ? [join(dir, e.name)] : [])).sort();
}

/** git's `-z` output (or plain lines) as a list. */
const lines = (text) => text.split(/[\0\n]/).filter((l) => l.trim()).map((l) => l.replace(/^\s+|\s+$/g, ""));
/** A path in the build's folder `rel` (empty at the repository's top). */
const at = (rel, name) => (rel ? `${rel}/${name}` : name);
// Paths as they are, never quoted or relative to the working directory, and a rename as a delete and an add.
const DIFF = ["-c", "core.quotePath=false", "diff", "--name-only", "--no-renames", "--no-relative", "-z"];
const parse = (text) => (text === undefined ? undefined : JSON.parse(text));

/**
 * The folder of package `name`, resolved from the harness (it depends on each shared package), or the
 * harness's own: the nearest folder above its root export that holds its package.json.
 */
function packageDir(name) {
  if (name === "@ludentes/galatea-life-harness") return harnessRoot;
  for (let dir = dirname(fileURLToPath(import.meta.resolve(name))); dir !== dirname(dir); dir = dirname(dir)) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg) && JSON.parse(readFileSync(pkg, "utf8")).name === name) return dir;
  }
  throw new Error(`no package.json of ${name} above its root export`);
}

/** `file`'s path relative to the repository at `top`, or undefined when it lies outside (an installed package). */
function inRepo(top, file) {
  const r = relative(top, file);
  return r.startsWith("..") || isAbsolute(r) ? undefined : r;
}

/**
 * The shared harness's paths relative to the repository at `top`: none for a package installed outside
 * it. `build` is the build's folder relative to `top`, for its own paths (`BUILD`). Conditional paths
 * (`when`) are `conditionalPaths`'s.
 */
export function sharedPaths(top, shared = SHARED_HARNESS, dirOf = packageDir, build = undefined) {
  return shared.filter((s) => !s.when).flatMap((s) => {
    if (s.package === REPOSITORY) return [s.path];
    if (s.package === BUILD) return build === undefined ? [] : [at(build, s.path)];
    const dir = inRepo(top, realpathSync(dirOf(s.package)));
    if (dir === undefined) return [];
    return [dir === "" ? s.path : s.path === "" ? `${dir}/` : `${dir}/${s.path}`];
  });
}

/** The conditional shared paths of a build (`SharedPath.when`), relative to the repository. */
export function conditionalPaths(shared, build) {
  return shared.filter((s) => s.when && s.package === BUILD && build !== undefined).map((s) => ({ path: at(build, s.path), when: s.when }));
}

/**
 * Per graded id, the repository-relative source of the module that registers its test, from the
 * registry (`list`, the registered tests, for a test). A test with no module recorded, or an id two
 * modules register, cannot be mapped: it throws.
 */
export async function checkFiles(top, list = undefined) {
  if (!list) await import("../dist/tests/index.js");
  const out = {};
  for (const t of list ?? registered()) {
    if (!t.file) throw new Error(`the registry recorded no module for ${t.ids.join(", ")}`);
    const f = inRepo(top, sourceOfBuilt(realpathSync(t.file)));
    if (f === undefined) continue;
    for (const id of t.ids) {
      if (out[id] !== undefined && out[id] !== f) throw new Error(`${id} is registered by ${out[id]} and ${f}`);
      out[id] = f;
    }
  }
  return out;
}

/**
 * Per module of the harness's `src` in the repository at `top`, the modules of it it imports
 * (`importsOf`): none when the harness is installed outside it.
 */
export function harnessImports(top) {
  const src = join(harnessRoot, "src");
  if (inRepo(top, realpathSync(harnessRoot)) === undefined) return {};
  const within = `${relative(top, realpathSync(src))}/`;
  return Object.fromEntries(walk(src).map((f) => {
    const r = relative(top, realpathSync(f));
    return [r, importsOf(r, readFileSync(f, "utf8")).filter((i) => i.startsWith(within))];
  }));
}

/** The harness's checks folder relative to `top`: a shared module's closure stops there. */
const checksIn = (top) => `${relative(top, realpathSync(join(harnessRoot, "src")))}/tests/`;

/**
 * The scope of the change from `base` to `head` (`git diff --name-only <base>...<head>`, and with
 * `uncommitted` the working tree's changes and untracked files too, all over the repository) for the
 * build at `buildDir`. The build's mutation files are read from its folder when `head` is HEAD, else
 * from `head`; its sources from there, and from the merge base too, so a site removed counts. Returns
 * the scope, the changed files, the merge base, per mutation how many sites the sources hold now
 * (`checkedAgainstReach` compares them with the clean run's reach), and warnings. Anything it cannot
 * read or diff makes every mutation unscoped, with why. `checks`, `shared` and `imports` give, from the
 * repository's folder, the check files, the shared harness's paths (`shared(top, build)`, the build's
 * standard's by default; closed over the imports) and the imports among the harness's modules.
 */
export async function scopeOfChange({ buildDir, base, head = "HEAD", uncommitted = false, git = gitRunner(buildDir),
  declarations = ["mutations.ts", "mutations.js"], checks = checkFiles, shared = undefined, imports = harnessImports }) {
  if (uncommitted && head !== "HEAD") throw new Error("--uncommitted adds this checkout's working tree: it cannot go with another --head");
  let mutations = [];
  try {
    return await scope();
  } catch (err) {
    const why = `${String(err.stderr || err.message).trim().split("\n")[0]}`;
    return { scope: unscoped(mutations, why), changed: [], base, siteCounts: {}, warnings: [] };
  }

  async function scope() {
    const warnings = [];
    const top = realpathSync(git(["rev-parse", "--show-toplevel"]).trim());
    const build = realpathSync(buildDir);
    const rel = inRepo(top, build);
    if (rel === undefined) throw new Error(`the build ${build} is outside the repository ${top}`);
    const show = (ref, path) => { try { return git(["show", `${ref}:${path}`]); } catch { return undefined; } };
    const readNow = (name) => (head === "HEAD" ? (existsSync(join(build, name)) ? readFileSync(join(build, name), "utf8") : undefined)
      : show(head, at(rel, name)));
    const filesOf = (read) => ({ subject: parse(read("subject.json")), proposed: parse(read("proposed-rows.json")),
      known: parse(read("known-outside.json")) });
    const now = filesOf(readNow);
    mutations = declared(now);
    let mergeBase;
    let changed;
    try {
      mergeBase = git(["merge-base", base, head]).trim();
      changed = lines(git([...DIFF, `${base}...${head}`]));
    } catch (err) {
      throw new Error(`git cannot diff ${base}...${head}: ${String(err.stderr || err.message).trim().split("\n")[0]}`);
    }
    if (uncommitted) changed.push(...lines(git([...DIFF, "HEAD"])), ...lines(git(["ls-files", "-z", "--others", "--exclude-standard", "--full-name", "--", ":/"])));
    else if (head === "HEAD" && lines(git(["status", "--porcelain", "-z"])).length) {
      warnings.push("the working tree has changes the scope leaves out: commit them, or pass --uncommitted");
    }
    changed = [...new Set(changed)].sort();
    const before = filesOf((name) => show(mergeBase, at(rel, name)));
    const sourcesAt = (ref) => lines(git(["ls-tree", "-r", "-z", "--name-only", "--full-tree", ref, "--", at(rel, "src")]))
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts")).map((f) => ({ file: f, text: git(["show", `${ref}:${f}`]) }));
    const sources = head === "HEAD" ? walk(join(build, "src")).map((f) => ({ file: relative(top, f), text: readFileSync(f, "utf8") }))
      : sourcesAt(head);
    const standard = now.subject?.standard;
    // The manifest at the base and now, from git when it sits in the repository; an installed one cannot change.
    const manifestFile = standard && inRepo(top, join(realpathSync(manifestRoot()), `${standard}-requirements.json`));
    const manifestAt = (ref) => parse(show(ref, manifestFile)) ?? [];
    const manifest = !standard ? [] : head !== "HEAD" && manifestFile ? manifestAt(head) : loadManifest(standard);
    const manifestBefore = manifestFile ? manifestAt(mergeBase) : manifest;
    const graph = imports(top);
    const list = sharedFor(standard);
    const sharedChanged = conditionalPaths(list, rel).filter((c) => changed.includes(c.path))
      .filter((c) => conditionalChange(c.when, show(mergeBase, c.path),
        uncommitted ? (existsSync(join(top, c.path)) ? readFileSync(join(top, c.path), "utf8") : undefined) : show(head, c.path)))
      .map((c) => `${c.path} (${c.when === "declarations" ? "outside its MUTATIONS list" : "a field other than its mutations"})`);
    const result = changedScope({
      changed, mutations, sites: unionSites(siteFiles(mutations, sourcesAt(mergeBase), declarations), siteFiles(mutations, sources, declarations)),
      rows: rowIds(mutations, manifest, now), checkFiles: await checks(top), before: entries(before), after: entries(now), imports: graph,
      rowsBefore: rowEntries(mutations, manifestBefore, before), rowsAfter: rowEntries(mutations, manifest, now),
      shared: sharedClosure(shared ? shared(top, rel) : sharedPaths(top, list, packageDir, rel), graph, checksIn(top)), sharedChanged,
    });
    return { scope: result, changed, base, mergeBase, siteCounts: siteCounts(mutations, sources, declarations), warnings };
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; };
  const buildDir = arg("--build");
  const base = arg("--base");
  const head = arg("--head") ?? "HEAD";
  const uncommitted = process.argv.includes("--uncommitted");
  if (!buildDir || !base || (uncommitted && head !== "HEAD")) {
    console.error("usage: changed.mjs --build <dir> --base <ref> [--head <ref> | --uncommitted] [--json]");
    process.exit(2);
  }
  const { scopeLines } = await import("../dist/changed.js");
  const r = await scopeOfChange({ buildDir: resolve(buildDir), base, head, uncommitted });
  if (process.argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else console.log([`Changed files: ${r.changed.length}`, ...r.warnings.map((w) => `Warning: ${w}`), ...scopeLines(r.scope, base)].join("\n"));
}
