// The pure half of Postgres's view of a heavy run (`with-postgres.mjs` collects it): statements
// from `pg_stat_statements` folded across the per-check databases, their kinds, and the report.
// Nothing here reads a file, the clock or the environment.

/**
 * `pg_stat_statements` keys an entry by user, database and query, so the same migration statement in
 * each check's fresh database is a new entry, and `CREATE DATABASE galatea_<uuid>` is one per name.
 * The collector reads and resets the view every few seconds, and folds entries by this text: the
 * test databases' and roles' names made one, and a password never kept.
 */
export function normalise(query) {
  return query
    .replace(/galatea_[0-9a-f]{32}/g, "galatea_<id>")
    .replace(/PASSWORD\s+'[^']*'/gi, "PASSWORD '<redacted>'")
    .replace(/\s+/g, " ")
    .trim();
}

/** The kinds of statement, first match wins. */
export const STATEMENT_KINDS = [
  { kind: "profiler", test: (q) => /pg_stat_|pg_catalog\.pg_stat|pg_stat_statements/.test(q) },
  { kind: "CREATE DATABASE", test: (q) => /^CREATE DATABASE\b/i.test(q) },
  { kind: "DROP DATABASE", test: (q) => /^DROP DATABASE\b/i.test(q) },
  { kind: "roles", test: (q) => /^(CREATE|DROP) ROLE\b/i.test(q) || /^DO \$\$ BEGIN CREATE ROLE/i.test(q) },
  { kind: "CREATE SCHEMA (harness)", test: (q) => /^CREATE SCHEMA\b/i.test(q) },
  { kind: "migrations", test: (q) => /^(CREATE|ALTER|DROP|COMMENT|GRANT|REVOKE)\b/i.test(q) || /\bmigrations\b/.test(q) },
  { kind: "transaction control", test: (q) => /^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|START TRANSACTION|SET|RESET|SHOW)\b/i.test(q) },
];

export const statementKind = (q) => STATEMENT_KINDS.find((k) => k.test(q))?.kind ?? "queries (subjects and harness)";

const STATEMENT_SUMS = ["calls", "total", "plan", "rows", "blkr", "blkw", "blkd", "walb"];

/** A fresh fold. */
export const newFold = () => ({ statements: new Map(), databases: new Map(), dealloc: 0, harvests: 0 });

/**
 * Adds one harvest: the statements read since the last reset, `pg_stat_statements_info.dealloc` (entries
 * the view threw away for want of room: lost time), and every database's counters, of which the last
 * seen are kept per database, since a dropped database's row vanishes.
 */
export function addHarvest(fold, { statements = [], dealloc = 0, databases = [] }) {
  for (const s of statements) {
    const text = normalise(s.q ?? "");
    const e = fold.statements.get(text) ?? { text, kind: statementKind(text), ...Object.fromEntries(STATEMENT_SUMS.map((k) => [k, 0])) };
    for (const k of STATEMENT_SUMS) e[k] += Number(s[k] ?? 0);
    fold.statements.set(text, e);
  }
  fold.dealloc += Number(dealloc ?? 0);
  for (const d of databases) fold.databases.set(String(d.datid), d);
  fold.harvests += 1;
  return fold;
}

const DB_SUMS = ["xact_commit", "xact_rollback", "blks_read", "blks_hit", "tup_returned", "tup_fetched", "tup_inserted",
  "tup_updated", "tup_deleted", "temp_bytes", "deadlocks", "sessions", "session_time", "active_time"];
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

/** The report: kinds of statement, the top statements, database and WAL totals, the container's CPU. */
export function postgresReport(fold, { wal, checkpointer, io, cgroup, wallS, top = 30 }) {
  const all = [...fold.statements.values()];
  const totalMs = all.reduce((a, s) => a + s.total, 0);
  const kinds = {};
  for (const s of all) {
    const k = (kinds[s.kind] ??= { kind: s.kind, statements: 0, calls: 0, totalMs: 0, walBytes: 0 });
    k.statements += 1;
    k.calls += s.calls;
    k.totalMs += s.total;
    k.walBytes += s.walb;
  }
  const kindList = Object.values(kinds).map((k) => ({ ...k, totalMs: round(k.totalMs), meanMs: k.calls ? round(k.totalMs / k.calls, 2) : 0,
    share: totalMs ? round((100 * k.totalMs) / totalMs) : 0 })).sort((a, b) => b.totalMs - a.totalMs);
  const statements = all.sort((a, b) => b.total - a.total).slice(0, top).map((s) => ({ kind: s.kind, calls: s.calls,
    totalMs: round(s.total), meanMs: s.calls ? round(s.total / s.calls, 2) : 0, rows: s.rows, walBytes: s.walb, text: s.text }));
  const databases = Object.fromEntries(DB_SUMS.map((k) => [k, [...fold.databases.values()].reduce((a, d) => a + Number(d[k] ?? 0), 0)]));
  databases.seen = fold.databases.size;
  const cpuS = cgroup?.usage_usec === undefined ? undefined : round(Number(cgroup.usage_usec) / 1e6);
  return { wallS, statementExecMs: round(totalMs), kinds: kindList, statements, databases, wal, checkpointer, io,
    container: { cpuS, userS: cgroup?.user_usec === undefined ? undefined : round(Number(cgroup.user_usec) / 1e6),
      systemS: cgroup?.system_usec === undefined ? undefined : round(Number(cgroup.system_usec) / 1e6),
      meanCores: cpuS === undefined || !wallS ? undefined : round(cpuS / wallS, 2), memoryPeakMB: cgroup?.memory_peak === undefined
        ? undefined : round(Number(cgroup.memory_peak) / 2 ** 20) },
    harvests: fold.harvests, dealloc: fold.dealloc };
}

/** The short lines `with-postgres.mjs` prints. */
export function postgresLines(r, dir) {
  const kinds = r.kinds.slice(0, 4).map((k) => `${k.kind} ${round(k.totalMs / 1000)} s (${k.share}%)`).join(", ");
  return [
    `Postgres: ${dir}/postgres.md`,
    `Postgres container CPU ${r.container.cpuS ?? "?"} s (mean ${r.container.meanCores ?? "?"} cores) over ${r.wallS} s; statements' exec time ${round(r.statementExecMs / 1000)} s`,
    `Statement time by kind: ${kinds}`,
    `WAL ${r.wal ? `${round(Number(r.wal.wal_bytes) / 2 ** 20)} MB` : "?"}; checkpoints ${r.checkpointer ? `${r.checkpointer.num_timed} timed, ${r.checkpointer.num_requested} requested` : "?"}`,
  ];
}

const mb = (b) => round(Number(b ?? 0) / 2 ** 20);

/** The report as `postgres.md`. */
export function renderPostgres(r, dir) {
  const cell = (t) => t.replaceAll("|", "\\|").slice(0, 160);
  const ioRows = (r.io ?? []).filter((x) => Number(x.reads) + Number(x.writes) + Number(x.extends) + Number(x.fsyncs) > 0);
  return [
    "# Postgres's view of the heavy run", "", "```", ...postgresLines(r, dir), "```", "",
    "Statements are counted cluster-wide: `pg_stat_statements` sees every per-check database, and the "
    + `collector read and reset it ${r.harvests} times, folding each database's copy of a statement into one line `
    + "(test databases' and roles' names made `galatea_<id>`). Entries thrown away for want of room "
    + `between two reads: ${r.dealloc}${r.dealloc ? " (their time is missing)" : ""}. Exec time is the server's own, `
    + "not the client's wait; the container's CPU is its cgroup's total over its life.", "",
    "## By kind", "", "| kind | distinct | calls | total s | mean ms | share | WAL MB |", "|---|---:|---:|---:|---:|---:|---:|",
    ...r.kinds.map((k) => `| ${k.kind} | ${k.statements} | ${k.calls} | ${round(k.totalMs / 1000)} | ${k.meanMs} | ${k.share}% | ${mb(k.walBytes)} |`), "",
    `## Top ${r.statements.length} statements by total exec time`, "", "| kind | calls | total ms | mean ms | rows | WAL MB | statement |", "|---|---:|---:|---:|---:|---:|---|",
    ...r.statements.map((s) => `| ${s.kind} | ${s.calls} | ${s.totalMs} | ${s.meanMs} | ${s.rows} | ${mb(s.walBytes)} | \`${cell(s.text)}\` |`), "",
    "## Databases", "", `Summed over ${r.databases.seen} databases, each at the last read before it was dropped (a check's last few seconds are missed).`, "",
    "| counter | total |", "|---|---:|", ...Object.entries(r.databases).filter(([k]) => k !== "seen").map(([k, v]) => `| ${k} | ${round(v)} |`), "",
    "## WAL and checkpoints", "",
    r.wal ? `WAL: ${r.wal.wal_records} records, ${r.wal.wal_fpi} full-page images, ${mb(r.wal.wal_bytes)} MB, buffers full ${r.wal.wal_buffers_full}.` : "WAL: not read.",
    "",
    r.checkpointer ? `Checkpoints: ${r.checkpointer.num_timed} timed, ${r.checkpointer.num_requested} requested, ${r.checkpointer.num_done ?? "?"} done; `
      + `write ${round(Number(r.checkpointer.write_time) / 1000)} s, sync ${round(Number(r.checkpointer.sync_time) / 1000)} s, ${r.checkpointer.buffers_written} buffers written.` : "Checkpoints: not read.",
    "", "## I/O by backend type (pg_stat_io, rows with any I/O)", "",
    "| backend | object | context | reads | read ms | writes | write ms | extends | fsyncs |", "|---|---|---|---:|---:|---:|---:|---:|---:|",
    ...ioRows.map((x) => `| ${x.backend_type} | ${x.object} | ${x.context} | ${x.reads} | ${round(Number(x.read_time ?? 0))} | ${x.writes} | ${round(Number(x.write_time ?? 0))} | ${x.extends} | ${x.fsyncs} |`),
    "",
    "## The container", "", `CPU ${r.container.cpuS ?? "?"} s (user ${r.container.userS ?? "?"}, system ${r.container.systemS ?? "?"}), `
    + `mean ${r.container.meanCores ?? "?"} cores over ${r.wallS} s; memory peak ${r.container.memoryPeakMB ?? "?"} MB.`, "",
  ].join("\n");
}
