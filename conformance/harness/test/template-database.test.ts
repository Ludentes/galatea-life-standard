import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { dropOpenTemplates, MigrateFailed, TEMPLATE_FIT, templateDatabase, type CommandRunner, type SqlRunner } from "../src/database.js";

const ADMIN = "postgres://postgres:pw@127.0.0.1:5433/postgres";
const fixtures = join(import.meta.dirname, "fixtures");

/** A server that records what it is told, by the URL's database; `answer` gives the rows of a statement it knows. */
function recorder(answer: (statement: string) => Record<string, unknown>[] = () => []): { sql: SqlRunner; log: string[] } {
  const log: string[] = [];
  return { log, sql: async (url, statements) => {
    let rows: Record<string, unknown>[] = [];
    for (const s of statements) {
      log.push(`${new URL(url).pathname.slice(1)}: ${s}`);
      rows = answer(s);
    }
    return rows;
  } };
}

const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };

describe("the template database", () => {
  it("is made like a test's database, then migrated once by the subject's command with only its URL", async () => {
    const { sql, log } = recorder();
    const runs: { command: string; args: string[]; cwd: string; url?: string; other: string[] }[] = [];
    const exec: CommandRunner = async (c) => {
      runs.push({ command: c.command, args: c.args, cwd: c.cwd, url: c.env.GALATEA_DATABASE_URL,
        other: Object.keys(c.env).filter((k) => k.startsWith("GALATEA_") && k !== "GALATEA_DATABASE_URL") });
      return { code: 0, output: [] };
    };
    process.env.GALATEA_ROOT = "demo/leak";
    try {
      const t = await templateDatabase(ADMIN, { command: "node", args: ["migrate.mjs"] }, "/subject", { sql, exec });
      expect(runs).toHaveLength(1);
      expect(runs[0]).toMatchObject({ command: "node", args: ["migrate.mjs"], cwd: "/subject", other: [] });
      expect(new URL(runs[0]!.url!).username).toBe(t.name);
      expect(new URL(runs[0]!.url!).pathname).toBe(`/${t.name}`);
      expect(t.name).toMatch(/^galatea_t[0-9a-f]{32}$/);
      expect(log).toEqual([
        expect.stringMatching(/^postgres: DO \$\$ BEGIN CREATE ROLE reader/),
        expect.stringMatching(new RegExp(`^postgres: CREATE ROLE ${t.name} LOGIN PASSWORD '`)),
        `postgres: CREATE DATABASE ${t.name}`,
        `postgres: REVOKE ALL ON DATABASE ${t.name} FROM PUBLIC`,
        `postgres: GRANT CONNECT, TEMPORARY ON DATABASE ${t.name} TO ${t.name}`,
        `${t.name}: CREATE SCHEMA ${t.name} AUTHORIZATION ${t.name}`,
        // After the migrate: what a clone could not keep, then the template locked to everyone but the admin.
        `${t.name}: ${TEMPLATE_FIT(t.name)}`,
        `postgres: ALTER ROLE ${t.name} NOLOGIN`,
        `postgres: ALTER DATABASE ${t.name} WITH ALLOW_CONNECTIONS false`,
        `postgres: REVOKE ALL ON DATABASE ${t.name} FROM ${t.name}`,
        `postgres: SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${t.name}' AND pid <> pg_backend_pid()`,
      ]);
    } finally {
      delete process.env.GALATEA_ROOT;
    }
  });

  it("clones each test's database from it: its own role, the template's schema renamed and handed to that role", async () => {
    const { sql, log } = recorder();
    const t = await templateDatabase(ADMIN, { command: "true" }, "/subject", { sql, exec: async () => ({ code: 0, output: [] }) });
    log.length = 0;
    const a = await t.clone();
    const b = await t.clone();
    expect(a.name).not.toBe(b.name);
    expect(new URL(a.url).username).toBe(a.name);
    expect(new URL(a.url).pathname).toBe(`/${a.name}`);
    expect(a.name).toMatch(/^galatea_[0-9a-f]{32}$/);
    expect(log.slice(0, 6)).toEqual([
      expect.stringMatching(new RegExp(`^postgres: CREATE ROLE ${a.name} LOGIN PASSWORD '`)),
      `postgres: CREATE DATABASE ${a.name} TEMPLATE ${t.name}`,
      // Only the check's role may connect to the check's database.
      `postgres: REVOKE ALL ON DATABASE ${a.name} FROM PUBLIC`,
      `postgres: GRANT CONNECT, TEMPORARY ON DATABASE ${a.name} TO ${a.name}`,
      `${a.name}: ALTER SCHEMA ${t.name} RENAME TO ${a.name}`,
      `${a.name}: REASSIGN OWNED BY ${t.name} TO ${a.name}`,
    ]);
    log.length = 0;
    await a.drop();
    await t.drop();
    expect(log).toEqual([
      `postgres: DROP DATABASE IF EXISTS ${a.name} WITH (FORCE)`, `postgres: DROP ROLE IF EXISTS ${a.name}`,
      `postgres: DROP DATABASE IF EXISTS ${t.name} WITH (FORCE)`, `postgres: DROP ROLE IF EXISTS ${t.name}`,
    ]);
  });

  it("refuses with the command's last lines, its URL masked, and drops the template, when the command fails", async () => {
    const { sql, log } = recorder();
    const exec: CommandRunner = async (c) => ({ code: 3, output: ["boom", `at ${c.env.GALATEA_DATABASE_URL}`] });
    const err = await templateDatabase(ADMIN, { command: "node", args: ["migrate.mjs"] }, "/s", { sql, exec }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MigrateFailed);
    expect((err as MigrateFailed).message).toMatch(/exited 3/);
    expect((err as MigrateFailed).output).toEqual(["boom", "at <url>"]);
    expect(log.at(-2)).toMatch(/DROP DATABASE IF EXISTS galatea_\w+ WITH \(FORCE\)/);
  });

  it("refuses a template a clone could not keep, naming what, and drops it", async () => {
    const { sql, log } = recorder((st) => st.startsWith("SELECT 'default privileges") ? [{ what: "default privileges (ALTER DEFAULT PRIVILEGES)" },
      { what: "function count_notes() names the schema in its text or its settings" }] : []);
    const err = await templateDatabase(ADMIN, { command: "true" }, "/s", { sql, exec: async () => ({ code: 0, output: [] }) }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MigrateFailed);
    expect((err as MigrateFailed).message).toMatch(/a template its clones cannot keep: default privileges \(ALTER DEFAULT PRIVILEGES\); function count_notes\(\) names the schema/);
    expect(log.at(-2)).toMatch(/DROP DATABASE IF EXISTS galatea_t\w+ WITH \(FORCE\)/);
  });

  it("is dropped, its migrate's whole process group killed, when the harness is interrupted mid-migrate", async () => {
    const dir = mkdtempSync(join(tmpdir(), "galatea-migrate-int-"));
    try {
      const { sql, log } = recorder();
      // The command and a child of its own, both of which the interrupt must end.
      const pending = templateDatabase(ADMIN, { command: "sh", args: ["-c", "echo $$ > pid.t && mv pid.t pid; sleep 30 & echo $! > child.t && mv child.t child; wait"] }, dir, { sql })
        .catch((e: unknown) => e);
      // Each file is renamed into place whole, and `child` last, so both are there and full once it is.
      for (let i = 0; i < 500 && !existsSync(join(dir, "child")); i++) await new Promise((r) => setTimeout(r, 20));
      const pids = ["pid", "child"].map((f) => Number(readFileSync(join(dir, f), "utf8")));
      await dropOpenTemplates();
      const err = await pending;
      expect((err as MigrateFailed).message).toMatch(/interrupted/);
      await new Promise((r) => setTimeout(r, 100));
      expect(pids.map(alive)).toEqual([false, false]);
      expect(log.filter((l) => l.includes("DROP DATABASE"))).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("finishes when the command has exited, though a child of it keeps its output open, and ends that child", async () => {
    const dir = mkdtempSync(join(tmpdir(), "galatea-migrate-bg-"));
    try {
      const { sql } = recorder();
      const t0 = Date.now();
      const t = await templateDatabase(ADMIN, { command: "sh", args: ["-c", "sleep 30 & echo $! > child; echo migrated"] }, dir, { sql });
      expect(Date.now() - t0).toBeLessThan(5000);
      await new Promise((r) => setTimeout(r, 100));
      expect(alive(Number(readFileSync(join(dir, "child"), "utf8")))).toBe(false);
      await t.drop();
      const t1 = Date.now();
      const slow = await templateDatabase(ADMIN, { command: "sh", args: ["-c", "sleep 30 & sleep 30"] }, dir, { sql, timeoutMs: 200 }).catch((e: unknown) => e);
      expect((slow as MigrateFailed).message).toMatch(/did not finish in 200 ms/);
      expect(Date.now() - t1).toBeLessThan(5000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs the real command in the subject's directory and reads its exit and output", async () => {
    const dir = mkdtempSync(join(tmpdir(), "galatea-migrate-"));
    try {
      const { sql } = recorder();
      const ok = await templateDatabase(ADMIN, { command: "sh", args: ["-c", "pwd > where; echo done"] }, dir, { sql });
      expect(readFileSync(join(dir, "where"), "utf8").trim()).toBe(dir);
      await ok.drop();
      const bad = await templateDatabase(ADMIN, { command: "sh", args: ["-c", "echo no table; exit 4"] }, dir, { sql }).catch((e: unknown) => e);
      expect((bad as MigrateFailed).output).toEqual(["no table"]);
      const slow = await templateDatabase(ADMIN, { command: "sleep", args: ["5"] }, dir, { sql, timeoutMs: 200 }).catch((e: unknown) => e);
      expect((slow as MigrateFailed).message).toMatch(/did not finish in 200 ms/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

const PG = process.env.GALATEA_TEST_PG_URL;

describe.skipIf(!PG)("the template database, on a real Postgres", () => {
  it("is migrated once; each clone logs in as its own role, holds the tables in its own schema, writes apart, and the reader keeps its grant", async () => {
    const dir = mkdtempSync(join(tmpdir(), "galatea-migrate-count-"));
    process.env.MIGRATE_COUNT_FILE = join(dir, "count");
    try {
      const t = await templateDatabase(PG!, { command: "node", args: ["migrate.mjs"] }, join(fixtures, "migrating-subject"));
      const a = await t.clone();
      const b = await t.clone();
      for (const [db, value] of [[a, "a"], [b, "b"]] as const) {
        const c = new pg.Client({ connectionString: db.url });
        await c.connect();
        try {
          expect((await c.query("SELECT current_user, current_schema()")).rows[0]).toEqual({ current_user: db.name, current_schema: db.name });
          await c.query("INSERT INTO notes (body) VALUES ($1)", [value]);
          expect((await c.query("SELECT body FROM notes")).rows).toEqual([{ body: value }]);
          // The schema and every object in it, table, its sequence and the view, are the clone's role's.
          const owners = (await c.query(`SELECT c.relname, pg_get_userbyid(c.relowner) AS owner FROM pg_class c
            JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = current_schema() AND c.relkind IN ('r', 'v', 'S') ORDER BY 1`)).rows;
          expect(owners).toEqual(["notes", "notes_id_seq", "notes_v"].map((relname) => ({ relname, owner: db.name })));
          expect((await c.query("SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname = current_schema()")).rows)
            .toEqual([{ owner: db.name }]);
          const reader = (await c.query(`SELECT has_schema_privilege('reader', current_schema(), 'USAGE') AS usage,
            has_table_privilege('reader', 'notes_v', 'SELECT') AS view, has_table_privilege('reader', 'notes', 'SELECT') AS table`)).rows[0];
          expect(reader).toEqual({ usage: true, view: true, table: false });
        } finally {
          await c.end();
        }
      }
      // The template is locked: no clone's role reaches it, and no check's role reaches another's database.
      const reach = async (url: URL, db: string) => {
        url.pathname = `/${db}`;
        const c = new pg.Client({ connectionString: url.toString() });
        try { await c.connect(); await c.end(); return "connected"; } catch (e) { return (e as Error).message; }
      };
      expect(await reach(new URL(a.url), t.name)).toMatch(/not currently accepting connections|permission denied/);
      expect(await reach(new URL(a.url), b.name)).toMatch(/permission denied for database/);
      const release = await a.stall();
      await release();
      // Nothing in a clone depends on the template's role any more: it drops while the clones live.
      await t.drop();
      await a.drop();
      await b.drop();
      expect(readFileSync(process.env.MIGRATE_COUNT_FILE, "utf8")).toBe("x");
      const admin = new pg.Client({ connectionString: PG });
      await admin.connect();
      try {
        const left = await admin.query("SELECT datname FROM pg_database WHERE datname = ANY($1)", [[a.name, b.name, t.name]]);
        const roles = await admin.query("SELECT rolname FROM pg_roles WHERE rolname = ANY($1)", [[a.name, b.name, t.name]]);
        expect([left.rows, roles.rows]).toEqual([[], []]);
      } finally {
        await admin.end();
      }
    } finally {
      delete process.env.MIGRATE_COUNT_FILE;
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});

describe.skipIf(!PG)("a template its clones could not keep, on a real Postgres", () => {
  // The preflight's probe (2026-10-06): a third-party migrate doing what a clone's rename and new role
  // lose. Each is refused after the migrate, as a subject-setup failure, and the template dropped.
  for (const [unfit, why] of [
    ["default-acl", /default privileges \(ALTER DEFAULT PRIVILEGES\)/],
    ["role-setting", /a setting of its role \(ALTER ROLE … SET\)/],
    ["function-text", /function count_notes\(\) names the schema in its text or its settings/],
    ["function-config", /function count_notes\(\) names the schema in its text or its settings/],
  ] as const) {
    it(`refuses ${unfit}`, async () => {
      process.env.UNFIT = unfit;
      try {
        // The real server, through a runner that notes the template's name as it is made.
        let made = "";
        const sql: SqlRunner = async (url, statements) => {
          const c = new pg.Client({ connectionString: url });
          await c.connect();
          try {
            let rows: Record<string, unknown>[] = [];
            for (const st of statements) {
              made ||= /^CREATE DATABASE (galatea_t\w+)$/.exec(st)?.[1] ?? "";
              rows = (await c.query(st)).rows;
            }
            return rows;
          } finally {
            await c.end();
          }
        };
        const err = await templateDatabase(PG!, { command: "node", args: ["migrate.mjs"] }, join(fixtures, "unfit-subject"), { sql })
          .catch((e: unknown) => e);
        expect(err).toBeInstanceOf(MigrateFailed);
        expect((err as MigrateFailed).message).toMatch(why);
        expect(made).toMatch(/^galatea_t/);
        const admin = new pg.Client({ connectionString: PG });
        await admin.connect();
        try {
          const left = await admin.query("SELECT datname AS x FROM pg_database WHERE datname = $1 UNION ALL SELECT rolname FROM pg_roles WHERE rolname = $1", [made]);
          expect(left.rows).toEqual([]);
        } finally {
          await admin.end();
        }
      } finally {
        delete process.env.UNFIT;
      }
    }, 30_000);
  }
});
