import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import pg from "pg";

/** A fresh name for a test's database, role and schema: lower case, so it needs no quoting, and within 63 bytes. */
export const databaseName = (): string => `galatea_${randomUUID().replaceAll("-", "")}`;

/** The admin URL's server, with `database`, and, when given, another role's credentials. */
export function databaseUrl(admin: string, database: string, login?: { user: string; password: string }): string {
  const url = new URL(admin);
  url.pathname = `/${database}`;
  if (login) {
    url.username = login.user;
    url.password = login.password;
  }
  return url.toString();
}

/** A test's database, its role and schema of one name, and the admin's way to stall it. */
export interface TestDatabase {
  url: string;
  name: string;
  drop(): Promise<void>;
  /**
   * Locks `tables` of the schema, every table of it when none is named, from the admin's own session,
   * so the subject's writes wait (and time out, and retry) until the release it resolves to.
   */
  stall(tables?: string[]): Promise<() => Promise<void>>;
}

/**
 * The harness's own clock on its database work in this process: each fresh database (its role, the
 * database and the schema) and each drop, as the client waited for them. A run reports the change
 * over its time (`Report.database`), so a matrix can say what each of its lanes spent there.
 */
export const databaseTimes = { creates: 0, createMs: 0, drops: 0, dropMs: 0 };

const IDENT = /^[a-z_][a-z0-9_]*$/;

/** `LOCK TABLE` of `tables` in `schema`, names checked: the harness builds it, never a subject. */
export function lockStatement(schema: string, tables: string[]): string {
  if (!tables.length) throw new Error("no table to lock");
  for (const t of [schema, ...tables]) if (!IDENT.test(t)) throw new Error(`not a plain table name: ${JSON.stringify(t)}`);
  return `LOCK TABLE ${tables.map((t) => `${schema}.${t}`).join(", ")} IN ACCESS EXCLUSIVE MODE`;
}

/** Runs `statements` in order on one session to `url`; resolves to the last one's rows. */
export type SqlRunner = (url: string, statements: string[]) => Promise<Record<string, unknown>[] | void>;

/**
 * A command the harness runs to its end: its exit code (null on a signal) and its last lines. `signal`
 * aborts it, its whole process group killed.
 */
export type CommandRunner = (c: { command: string; args: string[]; cwd: string; env: Record<string, string>; signal?: AbortSignal },
  timeoutMs: number) => Promise<{ code: number | null; output: string[]; timedOut?: boolean; aborted?: boolean }>;

/**
 * The subject's migrate-only command (`subject.json`'s `database.migrate`) failed, or made a template its
 * clones cannot keep: the subject is refused, a failure of its setup, never a graded fail.
 */
export class MigrateFailed extends Error {
  constructor(message: string, readonly output: string[]) {
    super(message);
  }
}

/** A database URL, which carries a password, masked in a line of output. */
const masked = (line: string) => line.replace(/postgres(?:ql)?:\/\/\S+/g, "<url>");

/** A role's first statements on a test's database: only that role may connect to it. */
const ownDatabase = (name: string) => [`REVOKE ALL ON DATABASE ${name} FROM PUBLIC`, `GRANT CONNECT, TEMPORARY ON DATABASE ${name} TO ${name}`];

/**
 * What `db-init` does for a build instance, for one test (the storage design, *Tests*): the
 * `reader` role if the server lacks it, then a fresh database, a role of the same name, and in the
 * database a schema of that name owned by the role. Only the role may connect to the database. The URL
 * logs in as the role. `drop` removes the database, ending any session the subject left open, then the role.
 */
export async function freshDatabase(admin: string, o: { sql?: SqlRunner; name?: string } = {}): Promise<TestDatabase> {
  const sql = o.sql ?? onServer;
  const name = o.name ?? databaseName();
  const password = randomUUID();
  const t0 = Date.now();
  await sql(admin, [
    // Two runs may share a server: a reader another made first, or at the same moment, is fine.
    "DO $$ BEGIN CREATE ROLE reader NOLOGIN; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END $$",
    `CREATE ROLE ${name} LOGIN PASSWORD '${password}'`,
    `CREATE DATABASE ${name}`,
    ...ownDatabase(name),
  ]);
  await sql(databaseUrl(admin, name), [`CREATE SCHEMA ${name} AUTHORIZATION ${name}`]);
  databaseTimes.creates += 1;
  databaseTimes.createMs += Date.now() - t0;
  return testDatabase(admin, name, password, sql);
}

/** A run's template (`subject.json`'s `database.migrate`): migrated once, cloned for each test. */
export interface TemplateDatabase {
  name: string;
  /** A test's database cloned from the template: as `freshDatabase`'s, with the tables already made. */
  clone(): Promise<TestDatabase>;
  drop(): Promise<void>;
}

/** Templates not yet dropped, a migrate still running included, which an interrupted harness drops (`closeOpenHomes`). */
const openTemplates = new Set<{ drop(): Promise<void> }>();

/** Drops every template still open, killing a migrate still running; for a harness that is being interrupted. */
export async function dropOpenTemplates(): Promise<void> {
  for (const t of [...openTemplates]) await t.drop().catch(() => undefined);
}

/** How long the subject's migrate command may take. */
export const MIGRATE_MS = 60_000;

/**
 * What a clone of `template` would not keep, one row (`what`) each (the subject contract,
 * `database.migrate`): default privileges and settings of the template's role, which belong to a role the
 * clone does not log in as, and functions whose text or settings name the schema, which the clone renames.
 */
export const TEMPLATE_FIT = (template: string): string =>
  "SELECT 'default privileges (ALTER DEFAULT PRIVILEGES)' AS what FROM pg_default_acl"
  + ` UNION ALL SELECT 'a setting of its role (ALTER ROLE … SET)' FROM pg_db_role_setting s JOIN pg_roles r ON r.oid = s.setrole WHERE r.rolname = '${template}'`
  + " UNION ALL SELECT format('function %s(%s) names the schema in its text or its settings', p.proname, pg_get_function_identity_arguments(p.oid)) FROM pg_proc p"
  + " JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')"
  + ` AND (p.prosrc LIKE '%${template}%' OR coalesce(array_to_string(p.proconfig, ' '), '') LIKE '%${template}%')`;

/**
 * The template for a run: a database, role and schema made as `freshDatabase` makes a test's (named
 * `galatea_t…`), then the subject's migrate-only command run once in the subject's directory, with
 * `GALATEA_DATABASE_URL` naming it as its role and no other contract variable. A command that fails,
 * takes longer than `timeoutMs` or is interrupted, or a template a clone would not keep (`TEMPLATE_FIT`),
 * drops the template and throws `MigrateFailed` with the command's last lines, the URL masked. Once
 * migrated the template is locked: its role cannot log in, the database takes no connections, and any
 * session left on it is ended, so nothing can hold it while a clone is made.
 */
export async function templateDatabase(admin: string, migrate: { command: string; args?: string[] }, cwd: string,
  o: { sql?: SqlRunner; exec?: CommandRunner; timeoutMs?: number } = {}): Promise<TemplateDatabase> {
  const sql = o.sql ?? onServer;
  const abort = new AbortController();
  // Registered before anything is made, so an interrupt drops the template and kills a migrate still running.
  let base: TestDatabase | undefined;
  const pending = { drop: async () => { openTemplates.delete(pending); abort.abort(); await base?.drop(); } };
  openTemplates.add(pending);
  const refuse = async (err: MigrateFailed): Promise<never> => {
    openTemplates.delete(pending);
    await base?.drop().catch(() => undefined);
    throw err;
  };
  base = await freshDatabase(admin, { sql, name: `galatea_t${randomUUID().replaceAll("-", "")}` }).catch(async (err: unknown) => {
    openTemplates.delete(pending);
    throw err;
  });
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([k, v]) => !k.startsWith("GALATEA_") && v !== undefined)) as Record<string, string>;
  const timeoutMs = o.timeoutMs ?? MIGRATE_MS;
  let r: Awaited<ReturnType<CommandRunner>>;
  try {
    r = await (o.exec ?? runCommand)({ command: migrate.command, args: migrate.args ?? [], cwd,
      env: { ...inherited, GALATEA_DATABASE_URL: base.url }, signal: abort.signal }, timeoutMs);
  } catch (err) {
    return refuse(new MigrateFailed(`the subject's database.migrate could not be run: ${err instanceof Error ? err.message : String(err)}`, []));
  }
  if (r.aborted || abort.signal.aborted) return refuse(new MigrateFailed("the subject's database.migrate was interrupted", r.output.map(masked)));
  if (r.code !== 0 || r.timedOut) {
    const why = r.timedOut ? `did not finish in ${timeoutMs} ms` : `exited ${r.code ?? "on a signal"}`;
    return refuse(new MigrateFailed(`the subject's database.migrate ${why}`, r.output.map(masked)));
  }
  const template = base.name;
  const unfit = ((await sql(databaseUrl(admin, template), [TEMPLATE_FIT(template)])) ?? []).map((row) => String(row.what));
  if (unfit.length) {
    return refuse(new MigrateFailed(`the subject's database.migrate made a template its clones cannot keep: ${unfit.join("; ")}`
      + " (the subject contract, database.migrate)", r.output.map(masked)));
  }
  await sql(admin, [`ALTER ROLE ${template} NOLOGIN`, `ALTER DATABASE ${template} WITH ALLOW_CONNECTIONS false`,
    `REVOKE ALL ON DATABASE ${template} FROM ${template}`,
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${template}' AND pid <> pg_backend_pid()`]);
  const made: TemplateDatabase = {
    name: template,
    clone: async () => {
      const name = databaseName();
      const password = randomUUID();
      const t0 = Date.now();
      // The clone holds the template's schema, owned by the template's role: the test's role takes both,
      // so the test's database, role and schema are of one name, as freshDatabase's are.
      await sql(admin, [`CREATE ROLE ${name} LOGIN PASSWORD '${password}'`, `CREATE DATABASE ${name} TEMPLATE ${template}`, ...ownDatabase(name)]);
      try {
        await sql(databaseUrl(admin, name), [`ALTER SCHEMA ${template} RENAME TO ${name}`, `REASSIGN OWNED BY ${template} TO ${name}`]);
      } catch (err) {
        await sql(admin, [`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`, `DROP ROLE IF EXISTS ${name}`]).catch(() => undefined);
        throw err;
      }
      databaseTimes.creates += 1;
      databaseTimes.createMs += Date.now() - t0;
      return testDatabase(admin, name, password, sql);
    },
    drop: async () => {
      openTemplates.delete(made);
      await base.drop();
    },
  };
  openTemplates.delete(pending);
  openTemplates.add(made);
  return made;
}

/** How long a command that has exited, or been killed, may keep its output open before it is taken as ended. */
const CLOSE_GRACE_MS = 500;

/**
 * Runs a command to its end in its own process group, keeping its last 50 lines. At the timeout or an
 * abort the group is killed. Once the command has exited (or been killed), it resolves when its output
 * closes or, at the latest, `CLOSE_GRACE_MS` later, since a child it left may hold the output open; that
 * child, in the same group, is killed then.
 */
const runCommand: CommandRunner = (c, timeoutMs) => new Promise((resolve, reject) => {
  const child = spawn(c.command, c.args, { cwd: c.cwd, env: c.env, stdio: ["ignore", "pipe", "pipe"], detached: true });
  const output: string[] = [];
  const keep = (line: string) => { output.push(line); if (output.length > 50) output.shift(); };
  createInterface({ input: child.stdout! }).on("line", keep);
  createInterface({ input: child.stderr! }).on("line", keep);
  const killGroup = () => { try { process.kill(-child.pid!, "SIGKILL"); } catch { /* gone already */ } };
  let timedOut = false;
  let aborted = false;
  let done = false;
  let grace: NodeJS.Timeout | undefined;
  const finish = (code: number | null) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    clearTimeout(grace);
    c.signal?.removeEventListener("abort", onAbort);
    killGroup();
    child.stdout!.destroy();
    child.stderr!.destroy();
    resolve({ code, output, timedOut, aborted });
  };
  const ending = (code: number | null) => { grace ??= setTimeout(() => finish(code), CLOSE_GRACE_MS); };
  const timer = setTimeout(() => { timedOut = true; killGroup(); ending(null); }, timeoutMs);
  const onAbort = () => { aborted = true; killGroup(); ending(null); };
  if (c.signal?.aborted) onAbort();
  else c.signal?.addEventListener("abort", onAbort, { once: true });
  child.once("error", (err) => { done = true; clearTimeout(timer); clearTimeout(grace); reject(err); });
  child.once("exit", (code) => ending(code));
  child.once("close", (code) => finish(code));
});

/** A test's database of one name with its role and schema: its URL as the role, its drop and its stall. */
function testDatabase(admin: string, name: string, password: string, sql: SqlRunner): TestDatabase {
  const stalls = new Set<() => Promise<void>>();
  let dropping: Promise<void> | undefined;
  return {
    url: databaseUrl(admin, name, { user: name, password }),
    name,
    // Once: an interrupt and the run's own end may both drop a template.
    drop: () => (dropping ??= (async () => {
      // A stall a failed test never released ends first; the drop would end its session anyway.
      await Promise.all([...stalls].map((release) => release()));
      const t1 = Date.now();
      await sql(admin, [`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`, `DROP ROLE IF EXISTS ${name}`]);
      databaseTimes.drops += 1;
      databaseTimes.dropMs += Date.now() - t1;
    })()),
    stall: async (tables) => {
      const client = new pg.Client({ connectionString: databaseUrl(admin, name), connectionTimeoutMillis: 5000 });
      // A session the server ends (the drop's FORCE, a restart) is no fault of the harness's process.
      client.on("error", () => undefined);
      await client.connect();
      try {
        const names = tables ?? (await client.query<{ tablename: string }>(
          "SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename", [name])).rows.map((r) => r.tablename);
        await client.query("BEGIN");
        await client.query(lockStatement(name, names));
      } catch (err) {
        await client.end().catch(() => undefined);
        throw err;
      }
      const release = async () => {
        if (!stalls.delete(release)) return;
        await client.query("ROLLBACK").catch(() => undefined);
        await client.end().catch(() => undefined);
      };
      stalls.add(release);
      return release;
    },
  };
}

async function onServer(url: string, statements: string[]): Promise<Record<string, unknown>[]> {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    let rows: Record<string, unknown>[] = [];
    for (const sql of statements) rows = (await client.query(sql)).rows;
    return rows;
  } finally {
    await client.end();
  }
}
