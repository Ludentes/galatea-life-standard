import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { templateDatabase } from "../src/database.js";
import { loadSubject } from "../src/subject.js";

// The reference applier's declared migrate against the harness's template (the preflight's M7): its
// template passes the clone checks, and on a clone its own migrate, as at its start, finds nothing to do.
const applier = join(import.meta.dirname, "..", "..", "..", "reference", "applier");
const PG = process.env.GALATEA_TEST_PG_URL;

describe.skipIf(!PG || !existsSync(join(applier, "dist", "migrate-main.js")))("the reference applier's database.migrate, on a real Postgres", () => {
  it("makes a template its clones keep, and finds nothing to do on a clone", async () => {
    const spec = loadSubject(applier);
    const migrate = typeof spec.database === "object" ? spec.database.migrate : undefined;
    expect(migrate).toBeDefined();
    const t = await templateDatabase(PG!, migrate!, applier);
    const a = await t.clone();
    try {
      const inherited = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GALATEA_")));
      const r = spawnSync(migrate!.command, migrate!.args ?? [], { cwd: applier, env: { ...inherited, GALATEA_DATABASE_URL: a.url },
        encoding: "utf8", timeout: 30_000 });
      expect([r.status, r.stdout.trim()]).toEqual([0, "migrated: nothing to do"]);
    } finally {
      await a.drop();
      await t.drop();
    }
  }, 60_000);
});
