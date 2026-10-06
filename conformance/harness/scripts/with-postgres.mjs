#!/usr/bin/env node
// Runs a command with GALATEA_TEST_PG_URL set: to the server already named, or to a
// throwaway postgres:18-alpine on loopback, started here and removed when the command ends. The
// throwaway server trusts every connection, which is safe only because it listens on loopback and
// holds nothing but test data.
//
// The throwaway server loads `pg_stat_statements` and times its I/O. When GALATEA_PROFILE_DIR is set
// (`tools/heavy.sh` sets it), it is read and reset every 5 s while the command runs, and before the
// server stops its view of the run is written there as `postgres.json` and `postgres.md`
// (`postgres-profile.mjs`): statements by kind and the slowest, database, WAL, checkpoint and I/O
// totals, and the container's CPU from its cgroup.
import { execFile, spawn, spawnSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { addHarvest, newFold, postgresLines, postgresReport, renderPostgres } from "./postgres-profile.mjs";

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("usage: with-postgres.mjs <command> [args...]");
  process.exit(2);
}
const run = (env) => new Promise((resolve) => {
  const child = spawn(command, args, { stdio: "inherit", env: { ...process.env, ...env } });
  child.on("error", () => resolve(2));
  child.on("exit", (code) => resolve(code ?? 2));
});
if (process.env.GALATEA_TEST_PG_URL) process.exit(await run({}));

const profileDir = process.env.GALATEA_PROFILE_DIR;
const docker = (...a) => spawnSync("docker", a, { encoding: "utf8" });
const dockerAsync = promisify(execFile);
const name = `galatea-harness-pg-${process.pid}`;
const started = docker("run", "-d", "--rm", "--name", name, "-p", "127.0.0.1::5432",
  "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "--tmpfs", "/var/lib/postgresql", "postgres:18-alpine",
  "-c", "shared_preload_libraries=pg_stat_statements", "-c", "track_io_timing=on", "-c", "pg_stat_statements.max=10000");
if (started.status !== 0) {
  console.error(`could not start postgres:18-alpine: ${started.stderr.trim()}`);
  process.exit(2);
}
// The profiler counts this container's processes as the run's, and another's as outside it.
if (profileDir) {
  try {
    appendFileSync(join(profileDir, "containers"), `${started.stdout.trim()}\n`);
  } catch {
    // The profile is a side line.
  }
}
// Ctrl-C reaches the command; this process stays to remove the server.
process.on("SIGINT", () => undefined);
process.on("SIGTERM", () => undefined);

/** One SQL statement's single value, through psql in the container. */
async function sql(...statements) {
  const { stdout } = await dockerAsync("docker", ["exec", name, "psql", "-U", "postgres", "-d", "postgres", "-X", "-q", "-At",
    ...statements.flatMap((s) => ["-c", s])], { maxBuffer: 512 * 2 ** 20 });
  return stdout;
}

const HARVEST = `SELECT json_build_object(
  'statements', (SELECT coalesce(json_agg(json_build_object('q', query, 'calls', calls, 'total', total_exec_time,
    'plan', total_plan_time, 'rows', rows, 'blkr', shared_blks_read, 'blkw', shared_blks_written,
    'blkd', shared_blks_dirtied, 'walb', wal_bytes)), '[]') FROM pg_stat_statements),
  'dealloc', (SELECT dealloc FROM pg_stat_statements_info),
  'databases', (SELECT coalesce(json_agg(d), '[]') FROM pg_stat_database d))`;
const fold = newFold();
let harvesting = Promise.resolve();
const harvest = () => {
  // Read and reset in one psql call: what lands between the two is the only loss.
  harvesting = harvesting.then(async () => {
    const out = await sql(HARVEST, "SELECT pg_stat_statements_reset()");
    // json_agg puts line breaks between elements: the reset's one line is the last.
    const text = out.trimEnd();
    addHarvest(fold, JSON.parse(text.slice(0, text.lastIndexOf("\n"))));
  }).catch((err) => console.error(`with-postgres: a statistics read failed: ${err instanceof Error ? err.message : String(err)}`));
  return harvesting;
};

async function writeProfile(wallS) {
  await harvest();
  const one = async (q) => JSON.parse((await sql(`SELECT coalesce(json_agg(t), '[]') FROM (${q}) t`)).trim());
  const [wal] = await one("SELECT * FROM pg_stat_wal");
  const [checkpointer] = await one("SELECT * FROM pg_stat_checkpointer");
  const io = await one("SELECT * FROM pg_stat_io");
  const cgroup = {};
  const cpuStat = docker("exec", name, "cat", "/sys/fs/cgroup/cpu.stat").stdout ?? "";
  for (const line of cpuStat.split("\n")) {
    const [k, v] = line.split(" ");
    if (k && v !== undefined) cgroup[k] = v;
  }
  const peak = docker("exec", name, "cat", "/sys/fs/cgroup/memory.peak").stdout?.trim();
  if (peak) cgroup.memory_peak = peak;
  const report = postgresReport(fold, { wal, checkpointer, io, cgroup, wallS });
  writeFileSync(join(profileDir, "postgres.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(profileDir, "postgres.md"), renderPostgres(report, profileDir));
  console.error(`\n${postgresLines(report, profileDir).join("\n")}`);
}

let code = 2;
let timer;
try {
  const port = docker("port", name, "5432/tcp").stdout.trim().split("\n")[0].split(":").pop();
  // Ready over TCP inside the container: the image's first start runs a socket-only server, then restarts.
  const deadline = Date.now() + 60_000;
  while (docker("exec", name, "pg_isready", "-q", "-h", "127.0.0.1", "-U", "postgres").status !== 0) {
    if (Date.now() > deadline) throw new Error("postgres:18-alpine was not ready in 60 s");
    spawnSync("sleep", ["0.5"]);
  }
  if (profileDir) {
    try {
      await sql("CREATE EXTENSION IF NOT EXISTS pg_stat_statements", "SELECT pg_stat_statements_reset()");
      timer = setInterval(harvest, 5000);
    } catch (err) {
      console.error(`with-postgres: no statement statistics: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const t0 = Date.now();
  code = await run({ GALATEA_TEST_PG_URL: `postgres://postgres@127.0.0.1:${port}/postgres` });
  if (timer) {
    clearInterval(timer);
    // The profile is a side line: a fault here never changes the command's code.
    await writeProfile(Math.round((Date.now() - t0) / 100) / 10).catch((err) =>
      console.error(`with-postgres: no Postgres profile: ${err instanceof Error ? err.message : String(err)}`));
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
} finally {
  clearInterval(timer);
  docker("stop", name);
}
process.exit(code);
