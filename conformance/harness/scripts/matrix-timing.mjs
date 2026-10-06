// The timing lines a full matrix (`reference/*/scripts/full-matrix.mjs`) prints after its verdict:
// total wall, each run's wall, each job lane's, the harness's waits on its databases per lane, and the
// slowest ids by mean time across runs. Pure: the matrix hands in what it measured and read.

const s = (ms) => (ms / 1000).toFixed(1);
const median = (xs) => {
  const v = [...xs].sort((a, b) => a - b);
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
};

/**
 * `runs` holds one entry a run: its `lane` (0-based), `wallMs` as the matrix timed it (the harness's
 * start included), and its report (`run.json`) when there is one, whose rows carry `ms` and whose
 * `database` the harness's waits on its test databases. `profile` is lines of the heavy run's profile
 * so far, if any. `checks`, in a skipping matrix, holds each mutation's checks run (`ran`) of its graded
 * ids (`of`).
 */
export function timingLines({ wallMs, runs, lanes, top = 15, profile = [], checks = [] }) {
  const out = ["", `Timing: wall ${s(wallMs)} s, ${runs.length} runs on ${lanes} lanes.`];
  if (checks.length) {
    const ran = checks.reduce((a, c) => a + c.ran, 0);
    const of = checks.reduce((a, c) => a + c.of, 0);
    const each = checks.map((c) => c.ran);
    out.push(`Checks under the mutations: ${ran} run, ${of - ran} skipped, of ${of} (${Math.round((100 * ran) / of)}%); `
      + `per mutation min ${Math.min(...each)}, median ${median(each)}, max ${Math.max(...each)}.`);
  }
  if (runs.length) {
    const walls = runs.map((r) => r.wallMs);
    out.push(`Run wall: min ${s(Math.min(...walls))} s, median ${s(median(walls))} s, max ${s(Math.max(...walls))} s.`);
  }
  for (let lane = 0; lane < lanes; lane++) {
    const mine = runs.filter((r) => r.lane === lane);
    if (!mine.length) continue;
    const db = mine.map((r) => r.report?.database).filter(Boolean);
    const sum = (k) => db.reduce((a, d) => a + d[k], 0);
    const creates = sum("creates");
    const dbText = creates
      ? `; databases ${creates} made in ${s(sum("createMs"))} s (mean ${Math.round(sum("createMs") / creates)} ms), `
        + `${sum("drops")} dropped in ${s(sum("dropMs"))} s (mean ${Math.round(sum("dropMs") / Math.max(1, sum("drops")))} ms)`
      : "";
    out.push(`Lane ${lane + 1}: ${mine.length} runs, busy ${s(mine.reduce((a, r) => a + r.wallMs, 0))} s${dbText}.`);
  }
  const byId = new Map();
  for (const r of runs) {
    for (const row of r.report?.rows ?? []) {
      if (row.ms === undefined) continue;
      const e = byId.get(row.id) ?? { total: 0, n: 0 };
      e.total += row.ms;
      e.n += 1;
      byId.set(row.id, e);
    }
  }
  const slow = [...byId].map(([id, e]) => ({ id, mean: e.total / e.n })).sort((a, b) => b.mean - a.mean).slice(0, top);
  if (slow.length) out.push(`Slowest ids (mean over runs): ${slow.map((x) => `${x.id} ${s(x.mean)} s`).join(", ")}.`);
  if (profile.length) out.push("Profile so far:", ...profile.map((l) => `  ${l}`));
  return out;
}
