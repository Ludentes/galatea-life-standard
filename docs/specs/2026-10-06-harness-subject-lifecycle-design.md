---
title: The harness starts a subject once — design
status: draft
last_verified:
area: conformance
audience: dev
author: Galatea maintainers
related:
  - conformance/README.md
  - docs/guides/2026-10-05-how-builds-are-checked.md
  - docs/research/2026-10-06-matrix-cpu-profile.md
  - docs/specs/2026-09-28-storage-design.md
---

# The harness starts a subject once — design

## Changelog

| Date | Change |
|---|---|
| 2026-10-06 | First version. The maintainer approved its phased plan and nine decisions at their defaults. |
| 2026-10-06 | After its spec review (1 Blocker, 6 Important, 5 Minor). Times are now quoted at 3 jobs, and the job count is a decision of its own. Reach by coverage gets its guards. A fresh rerun is reported as `reset_suspect`. The completeness proof gains a snapshot after setup. The teardown order is now normative. The figures use the re-measure, with the migration counted once and the probes run again back to back. `database.prepare` is renamed `database.migrate`. The *Recommendation* sets out both orders, the approved one and the review's (B1), for the maintainer. |
| 2026-10-06 | The maintainer ruled decision 10: the review's order (B1). Reach skipping comes before Reset, and Reset is built only if load still causes flakes; the gates' load and flakes are watched meanwhile. |
| 2026-10-06 | The maintainer ruled decision 5 on the measure: skipping by reach is on, with a full matrix weekly and before every release; class P narrowed to checks that lost an instance to a signal. |

The gate profile's re-measure (load 16) found that one applier matrix run uses about 90 CPU s:

- the subject's processes 59 s (66%), about 0.65 CPU s per process;
- the Postgres container 14 s (16%), most of it making, migrating and dropping each check's database;
- the harness 8 s (9%);
- the Docker daemons 7 s (7%).

The first profile, under load 30, had put the subject at 69–74% and 0.75 s per process. The maintainer asked
(2026-10-06) whether the approach could be reassessed so that the harness starts a subject once.

This design measures where a start goes and what each check needs that a fresh process gives it. It
compares four ways of starting less often, and it sets out a phased plan in two orders for the maintainer to
choose between. The parts are:

- a **template database** for subjects that declare a migrate-only command;
- a **matrix that runs only the checks that reach a mutation's code**;
- a **test-only reset that a subject may declare**. The harness starts the subject once per mutation
  per lane, then resets it between checks with a fresh environment. A subject that declares no reset
  keeps a process per check.

## Summary of the numbers

All figures are medians of 3–12 probes on the 12-core desktop, while other sessions loaded it (load
6–30). They are not benchmarks. The figures the estimates use come from the second probe set: the
probes run again back to back at load 8–14, with the warm and cold setups measured through one
function with the same polling. The first set is kept where it is the only figure for something.

| What | Applier | Steward |
|---|---:|---|
| Subject, start to `ready on` (fresh database; the subject migrates) | 320 ms wall, 340 ms CPU | 270 ms CPU (+160 ms in its first second, as its link reaches the stand-in) |
| Subject, start to `ready on` (a clone of a migrated template; the migrate is a no-op) | 215 ms wall, 260 ms CPU | not measured |
| Setup on a subject just started: a client, a bridge with four devices, configure, adopt, live | 100–135 ms wall, 130–150 ms CPU | the baseline `define`: about 200 ms CPU (first set) |
| The same setup on the same subject once warm | 40–240 ms wall (quantised by the 100 ms liveness poll), 50–60 ms CPU | not measured; expected alike |
| Of a start, module loading (CPU profile, first set) | 180–220 ms | 210–240 ms |
| Of a start, the first schema compiles (ajv, zod) on first use (first set) | 60–70 ms | 110–130 ms |
| Subject idle | ~10 ms/s | ~10 ms/s |
| Rebuilding the subject in one process with a new environment, on a template clone | 15 ms CPU, 41 ms wall | not measured; same shape |
| The same rebuild on a fresh database, with its migrations | 26 ms CPU, 109 ms wall | — |
| A fresh database / a clone of a migrated template (harness side, wall) | 58 / 70–73 ms | 56 / 59–70 ms |
| The subject's migrate on a fresh database / on a clone | 90 / 12 ms | 75 / 11–12 ms |
| Bundled into one file (esbuild), at ready / after setup (first set) | 220 / 420 ms CPU | 150 / 400 ms CPU |
| `NODE_COMPILE_CACHE` alone, at ready (first set) | −10 to −30 ms, within the noise | — |

**Counting the migration once.** The template removes the migration from the start: the applier is
ready about 105 ms sooner (320 to 215 ms wall) and spends about 80 ms less CPU. The clone costs about
15 ms more than a fresh `CREATE DATABASE`. So the template saves about 90 ms of wall per check.
Everything Reset is credited with below is measured **after** the template: a cold start plus setup
(about 315 ms wall, 390 ms CPU) against a rebuild plus warm setup (about 41 ms of rebuild plus the same
poll-bound setup wall, 65 ms CPU). That is about **175 ms of wall and 325 ms of CPU per check**.

## What a check costs today

- **The applier matrix**: 83 runs (the clean build and 82 mutations), each against 88 graded ids.
  Each run takes 68–88 s of wall time (76.7 s mean), with 4 checks at a time inside it (4 lanes, about
  22 checks each). At 3 jobs that is about 35 min. The clean run's per-check times add up to 285 s
  (3.24 s mean, 2.5 s median); the shortest check takes 0.9 s, about what a start and setup take under
  load. The slowest are GA-BUS-7 (16.9 s) and GA-LOAD-2 (15.1 s).
- **The steward matrix**: 58 runs, each against 69 checks, 51 s mean per run (43–74 s). The per-check
  times add up to 186 s, with a median of 2.4 s and a minimum of 1.5 s.
- **Processes per run**: one subject per check, one for the guard, and one more per restart inside a
  check. That is about 95 per applier run and about 7,900 per applier matrix.
- **What bounds the wall time**: the checks' own real-time waits (bounds of 1 s, polls, ack windows),
  divided by the number of checks running at once (4 lanes × the jobs). An applier matrix alone keeps
  only about 3–4 cores busy. CPU matters through **flakes under load**, which cap the job count. The
  guide records the matrix at 6 jobs taking 651–1087 s, but under other sessions' load GA-APPLY-1's
  500 ms bound and GA-STATE-2's 1 s bound were missed. Those are the standard's bounds, so the default
  stays at 3 jobs. In the first profile (load 30), GA-WIT-1 failed once and passed on its own.

**All matrix times in this design are quoted at 3 jobs.** The job count is a separate decision for
the maintainer (*Decisions for the maintainer*). Raising it is the cheapest lever on wall time: today's matrix would take
about 21 min at 5 jobs and about 18 min at 6, if the bounds held. What limits it is flakes under load.
What this design's CPU savings do is raise that ceiling, so that more jobs can run before the bounds
start to slip. They do not by themselves shorten the matrix much.

### Where a start goes

The `--cpu-prof` profiles attribute each sample to an activity. A sample with a module-loader frame
on its stack counts as loading. Otherwise it counts towards the package or project file nearest the
leaf.

- **Module loading** is the largest share: 180–240 ms per start. The loader itself takes 110–150 ms of
  that (resolving, reading and compiling about a thousand files). The rest is the top-level code of
  `ajv`, `zod`, `mqtt` and the MCP SDK. Loading `@modelcontextprotocol/server` with `/node` costs
  about 100–160 ms on its own.
- **The first validation compiles its schemas**: ajv takes 50–90 ms and zod 15–35 ms, once per process.
- **The migration**: about 90 ms of wall on the subject's side, plus the server's statement time.
- **Postgres, the client side** (the pool, the transaction): 10–30 ms.
- **Node's own boot**: 20–40 ms.
- **The harness's own per-check setup**: 25–40 ms CPU (simulated bridge, proxy, MCP clients). No
  option below changes it.

The steward differs in one way: its link to the applier starts after `ready`, so about 160 ms of
loading and connecting, the MCP client SDK included, lands in its first second.

### Postgres

The profile's statement time over six runs was 55.6 s:

| Kind | Share |
|---|---:|
| Migrations | 55% |
| `CREATE DATABASE` | 16% |
| `DROP DATABASE` | 15% |
| Roles | 8% |
| The subjects' real queries | 6% |

`CREATE DATABASE` writes 4 MB of WAL per database (the default WAL_LOG strategy). Each `DROP DATABASE`
requests a checkpoint (534 in one run). A clone of a migrated template removes the migrations.
FILE_COPY measured the same as WAL_LOG.

## What per-check freshness buys

Every applier and steward check was read for what it takes from a fresh process. The flags come from
`classify.py` (a regular-expression pass over each `requirement(...)` block), and every flagged
block was then read by hand.

| Class | What the check needs | Applier | Steward |
|---|---|---:|---:|
| P, a process restart inside the check | `ctx.restartApplier`, `ctx.subject.restart` (clean or crash), against the same store | 6: GA-APPLY-4, GA-APPLY-16, GA-BUS-5, GA-TOKEN-4, GA-EVT-4, GA-PERSIST-1 | 3 on main: GA-STW-10, GA-RULE-1, GA-SCHED-2. In flight: GA-PERSIST-2, the restart clauses of GA-RULE-8, GA-LEASE-6 and further GA-RULE-1 cases (slices 7, 11) |
| S, a second process | `ctx.startSteward` with its own environment (TLS, host) | 0 | 1: GA-SEC-2 |
| L, the subject's own broker link | the per-check `SeverableProxy` severed, stalled or restored | 8: GA-BUS-5, 6, 7, 8, 9, 11, GA-DESC-18, GA-SAFE-11 | 0 |
| D, a stalled store | `ctx.stallStore` locks the check's schema | 2: GA-TOKEN-4, GA-EVT-4 | 0 |
| G, configuration global to the subject | `box`, `time_source`, safety rules, the claims they change | 16: GA-ADOPT-1, 2, 6, GA-LVL-1, GA-EVT-8, GA-PERSIST-1, GA-DESC-6, GA-SAFE-3, 5, 6, 7, 8, 10, 11, 12, 13 | all 69: a steward has one house, and the baseline `define` sets its home, time source and notice channel |
| T, the clock stepped | `ctx.time.step` and `advance` move every client of the lane's time server | 27 | 25 |
| F, only fresh ids and a fresh store | everything else | the rest | the rest |

**What no check needs: a cold start of its own.** Every check that grades behaviour across a start
restarts the subject itself, inside the check (class P). No check reads `subject.startedAt` or the
subject's output. None asserts an absolute revision or sequence number; they read events through
cursors. So a subject that, at the start of each check, cannot be told from a freshly started one
grades every check the same.

What does need care:

- **Fixture ids are the same in every check.** The simulated bridge is `sim-bridge`, its devices are
  `lamp`, `dimmer` and so on, and their `stableIdentifier` is `"test:<id>"`. A grep of the tests finds
  about 536 references to fixture ids (`LAMP = "sim-bridge:lamp"` and literal `"sim-bridge:…"`) in 38
  files. Settled: the ids **stay the same across checks**. Making them unique per check would rewrite
  every test, and the ids are not where contamination hides once the store is new. A state a reset
  leaked would be keyed by such an id (a device's tier, liveness or latch kept in memory), and the next
  check would meet it under the same id. The snapshot after setup (*Proving a reset complete*) exists to
  catch exactly that. The same ids also rule out sharing a subject: a second `sim-bridge:lamp` in one
  subject is refused as one piece of hardware on two bridges, as the warm-setup probe found.
- **Retained messages** outlive a check on the broker. Every check has a root of its own
  (`demo/<run>/t<i>`) and an MQTT identity of its own (`applierIdentity`), and a reset moves the
  subject to the new root. It never subscribes under an earlier check's root, so a retained message
  there is never delivered to it.
- **Process-wide state in the reference**: none. The steward's trust in its applier's CA, and the
  `trusts-any-applier` mutation's lack of it, are held by the applier link's own agent, made with each
  session (the install-core design, *The builds' entry points*), so nothing in the process changes its
  TLS defaults. Every module-level value is a constant set or a pure format cache.

## Clock and concurrency today

A run has one broker and one lane per worker (`startHomes`, 4 lanes by default). Each lane has its own
`TimeServer`, an SNTP source that a check steps and the subject polls. A lane runs one check at a time,
so a step moves only that check's subject. At the start of each check the runner calls
`home.time.reset()`, which puts subject time back to 2030-01-01T08:00Z. The subject is new, so time
never goes backwards for any one process.

- **A long-lived subject** would see the clock jump back at every check. Today's `TestClock` keeps its
  timers on the clock, so a jump back leaves an earlier check's timers due far in the future, and a jump
  forward fires them. A reset therefore closes the subject's old `TestClock` (`close` clears every
  timer) **before** the harness resets the lane's time server to the epoch, and builds a new clock on
  the new `GALATEA_TIME_SOURCE`. The harness calls `home.time.reset()` only after the reset has
  answered. Time is not carried forward across checks either: that would start each check at a
  different wall time in Europe/Moscow, and the schedule and window checks would then depend on the
  order of checks.
- **Several checks at once inside one subject** would share its clock: a step by one would move the
  others. The 27 applier and 25 steward checks that step time could not share a subject unless they
  were serialised. They would also share its broker link (class L), its store (class D) and its global
  configuration (class G).

## The options

### Reset: one process per lane, reset between checks

The subject declares a test-only reset in `subject.json`. The harness starts it once per lane, so once
per mutation per lane in the matrix. Before each later check, the harness calls the reset with the
check's new environment. The subject then behaves as if it had just started with that environment,
without the process exiting. *The reset contract* has the details.

- **Saves, after the template database**: about 175 ms of wall and 325 ms of subject CPU per check
  that is reset. That is about 27 of the subject's 59 CPU s per applier run (−45%), and about a third
  of the run's CPU once phase 1 has taken Postgres's share down. Wall time per run falls by about 4 s
  (22 checks per lane × 0.175 s), or −5%. At 3 jobs the applier matrix goes from about 34.5 to about
  32.7 min. The main gain is CPU headroom for more jobs, not minutes at 3 jobs.
- **Starts per applier matrix**: about 1,100 instead of about 7,900. That is 4 lanes × 83 runs, plus
  about 7 restarts per run inside checks, plus fresh processes for the clean run, the mutations' own
  rows and failed checks.
- **Breaks**: nothing by construction, if the reset is complete.
  - Class P restarts with the check's environment, so a restart keeps the check's store, as the
    steward's restart cases need.
  - Classes L and D get a new proxy and a new database per check, both named in the reset's environment.
  - Classes G and T see a subject whose configuration and clock are new.
  - Class S is a second process anyway.

  The risk is a reset that is not complete, so that a check passes because of an earlier check's state.
  *Proving a reset complete* deals with that.
- **Cost to subjects**: optional. A subject that declares no reset gets a process per check, as today,
  and a third party is graded the same way. For the references, `main.ts` becomes a `run(env)`
  function that returns a stop. The DI already confines environment, argv and file reads to
  `main.ts`. The in-process rebuild probe built and stopped the applier ten times in one process this
  way, and RSS grew by about 2 MB over ten rebuilds on template clones.

### Share: one subject, many checks, each in its own namespace

- **Saves**: the same start costs as Reset, and the per-check reset (~15 ms CPU).
- **Breaks**:
  - the 43 applier checks of classes P, L, D, G or T, and all 69 steward checks (one house per
    steward);
  - the shared fixture ids;
  - `describe`'s revision, `notices` and the events stream, which would carry other checks' changes;
  - a restart, a severed link or a stalled store, which would hit every check sharing the subject.
- **Verdict**: rejected.

### In-process: the reference applier and steward embedded as a library

- **Saves**: what Reset saves, plus the MCP hop over loopback HTTP (a few ms per call).
- **Stops proving**:
  - the built artifact's `main.ts` wiring;
  - real restarts and crashes (class P would still need processes);
  - isolation from the harness's event loop. The 1 s bounds would share timers with the harness and the
    simulated bridges.
- **Applies to the references only**, so a third-party subject would be graded on a different path.
- **Verdict**: rejected. The references' own vitest suites already test them in-process.

### Cheaper starts

- **A migrated template database, cloned per check**: about −90 ms of wall per check, and about half of
  Postgres's CPU.
  - **Why the subject declares a command:** the harness cannot know a subject's migrations. A template
    made by starting the subject once would carry what that start wrote (its `meta`, the clean-stop
    marker).
  - **How it works:** the subject declares a migrate-only command (`database.migrate`). The harness
    runs it once per run into a template database. For each check it clones the template, renames the
    schema to the check's role and reassigns its objects (`ALTER SCHEMA … RENAME`, `REASSIGN OWNED`).
    The probe confirmed that the subject's own migrate then finds nothing to do.
- **`NODE_COMPILE_CACHE`**, set by the matrix drivers to one directory per build: −10 to −30 ms at ready,
  within the noise. Free, with no risk.
- **Bundling** (esbuild): −15 to −20% of a start. Not recommended: the bundle broke `import.meta.url`
  paths, so the gate would grade a different artifact from the one that ships (ruled, decision 8).
- **Lazy imports**: the same kind of saving as a bundle, at the cost of first-call latency. Not
  recommended.

### The matrix's own structure: reach

Each mutation run grades all 88 ids so that the verdict can say "nothing fails outside the mutation's
row". A mutation's row and its coupled ids average 1.5 ids (1.46 applier, 1.49 steward; at most 6).
The other ~86 checks of each run exist only to show that nothing else broke.

- **Reach-based skipping**: a check whose clean run never evaluates a mutation's site cannot behave
  differently under that mutation, except by timing. Skipping such a check leaves the verdict unchanged.
  V8 coverage (`NODE_V8_COVERAGE`, inherited by the subject) of a clean run gives each check's reach.
- **The mutation sites**: 84 direct comparisons (`mutation === "…"` or `!==`) in the applier and 63 in
  the steward. There are also indirect sites, where the mutation is passed into a helper as a value or a
  derived flag: `acksWithoutState` in the applier's dispatch rules, the steward's window and retry
  helpers. Some are wired at start-up: `retainsRequests` in the applier's `main.ts`, and
  `trusts-any-applier` and `calls-its-applier-at-2025` in the steward's.
- **Its guards** (the review's I2):
  1. **The coverage is a union.** Each matrix's own clean run collects coverage, and a matrix skips
     using the union of its clean run's coverage and the clean runs before it since the build last
     changed. A branch reached only under some timing is then kept once any clean run reached it.
  2. **Class P checks are always in reach.** A process ended by SIGKILL writes no coverage, so the crash
     checks' reach cannot be read. GA-TOKEN-4 and GA-EVT-4 crash; all six class P checks are kept for
     the applier, and the steward's restart checks likewise.
  3. **A start-up mutation reaches every check.** A mutation whose flag is read at start-up, in `main.ts`
     or a constructor (`retains-request`, `trusts-any-applier`, `calls-its-applier-at-2025`), runs
     against all checks.
  4. **A lint keeps every site direct.** Every mutation site must be a direct comparison against its
     name, so that coverage of that one line is reach. An indirect site is rewritten as direct, or
     listed in the lint's start-up list.
  5. **A full matrix still runs** weekly and before every release, so a reach that is wrong shows up
     within a week.
  6. **The known couplings are kept.** All 26 couplings in the `known-outside.json` lists are
     within-process, so a check that reaches the site reaches the coupling.
- **What it would add**: the matrix would shrink from 83 × 88 ≈ 7,300 checks to the sum of each
  mutation's reach, which is unknown until measured. The lower bound is about 120 checks for the
  mutations' own rows (82 × 1.46), plus 88 for the clean run: about 210 in all. With a reach of about
  15 checks per mutation, about 1,300.
- **What it changes**: the guarantee becomes "nothing fails outside the row among the checks that reach
  the mutated code". A check that a mutation's timing alone could break is no longer run, except in the
  full matrix. The maintainer rules on this after the measurement (decision 5).
- **Smaller**: the matrix driver could share one broker across its runs (today each run starts a
  `galatea-mqtt-*` container). Runs are already isolated by root.

## The reset contract

A subject may add to `subject.json`:

```json
"reset": { "tool": "harness_reset" },
"database": { "migrate": { "command": "node", "args": ["dist/migrate-main.js"] } }
```

`database` stays valid as `true`. `database.migrate` is the subject's own migrate-only command, which
the harness runs into its template. It is unrelated to the installation's `galatea-prepare`, which
makes a build's database, role and schema.

- **The call.** The harness calls the tool over MCP as the current check's owner credential, with
  `{ "test_run_id": "<run id>", "environment": { "GALATEA_…": "…" } }`.
  - The subject lists and honours the tool only when it was started with `GALATEA_TEST_RUN_ID`, and only
    for that id. Otherwise the tool does not exist, as for any client.
  - Under the harness, the tool shows in `tools/list`. No standard fixes an exact tool set: a grep of
    `standard/applier.md` and `standard/steward.md` finds no rule against an extra tool, and no check
    reads `tools/list`.
  - The subject answers `ok` first. It then stops everything it runs (the MCP sessions, the bus, the
    store, its `TestClock`) and rebuilds itself from the new environment as a start would.
  - Once it serves again it prints its ready line again. The harness waits for a new ready line, as it
    does after a start, then checks `whoAnswers`.
- **What may change at a reset**: `GALATEA_ROOT`, `GALATEA_BROKER` (a new identity, through the check's
  new proxy), `GALATEA_TIME_SOURCE`, `GALATEA_OWNER_CREDENTIAL`, `GALATEA_DATABASE_URL`,
  `GALATEA_STATE_DIR`, and for a steward `GALATEA_APPLIER_URL`, `_CLIENT`, `_CREDENTIAL` and
  `_TOKEN_KEY`.
- **What may not**: `GALATEA_TEST_RUN_ID`, `GALATEA_MUTATION`, `GALATEA_MCP_PORT`, and the host and
  TLS variables. A check whose environment differs in one of these gets a fresh process. Today that is only GA-SEC-2's
  second steward, which is a separate process anyway.
- **The port stays**, so a reset never races for a port (`onFreshPort` runs once per lane).
- **A restart after a reset** uses the latest environment. `SubjectProcess` keeps the environment the
  reset gave it, and `restart` launches with that. A class P check therefore restarts against its own
  store, and the restarted process stays as the lane's subject.
- **The order between two checks is normative** (the review's I5):
  1. The harness closes its own clients of the ending check: its MCP seams, the simulated bridge, the
     proxy, the stall sessions.
  2. It calls the reset with the next check's environment. The subject closes its old store cleanly
     and opens the new one.
  3. It resets the lane's time server.
  4. Only after that does it drop the old database and role.

  Dropping first would end the live subject's sessions (`DROP DATABASE … WITH (FORCE)`). The subject
  would read that as a store fault and exit (`process.exit(1)` in `main.ts`). A harness test covers
  this: after a reset, the old database is dropped, and the subject must still answer `describe` and
  must not have exited. A fake subject that does fault on its old store must be seen as a failed reset,
  and the lane must fall back to a fresh process.
- **When the harness does not reset**: after a check that failed or was not_applicable; after the
  subject exited, unasked or by a crash it was not asked to recover from; after a reset that failed,
  timed out or did not pass the completeness check. In each case the harness stops the process and
  starts a fresh one.

The reset is plumbing for the harness, in the subject contract (`conformance/README.md`,
`conformance/schemas/harness/subject.json`), like `test_run_id` and the time source. No standard names
it, and no row grades it (ruled, decision 1).

## Proving a reset complete

The steward session asked for this as a hard requirement: a check must never pass because of an
earlier check's state. The harness proves it in layers.

1. **By construction.** Every external resource a check can touch is new at each reset: the database,
   the MQTT root and identity, the broker proxy, the owner and client credentials, the steward's
   stand-in applier, and the time server (reset to the epoch after the subject closed its old clock).
   Only the subject's memory can carry state over. In the reference, `run(env)` builds every object
   from the environment, so after a reset nothing is reachable from the old graph except module-level
   and process-wide state. Two things check this:
   - **A lint in each reference build** fails on mutable module-level state: a top-level `let` or
     `var`, or a mutating call (`set`, `add`, `push`, `delete`, `clear`) on a top-level binding. An
     allowlist holds pure caches such as the steward's window format cache.
   - **A count of active handles.** After a reset's stop, the process's active handles (timers,
     sockets) must be back to the count it had before the first build.
2. **Two snapshots against a fresh process.** The harness keeps, per run, a reference taken on a freshly
   started process:
   - **Before setup**: what the owner sees of an empty subject. That is `describe` (revision, devices,
     clients, claims), `state`, the events from the first cursor, and the standing notices.
   - **After setup**, per fixture: the same reads once the check's setup has finished. They cover the
     fixture's devices, their classes, tiers, liveness and freshness, latches and the configuration
     the setup made, with times taken relative to the check's epoch.

   After every reset, the harness takes the same snapshots and compares them with the reference. Any
   difference is reported against the lane as `reset_incomplete`. The lane goes back to a fresh process
   per check for the rest of the run, and the report says so. The snapshot after setup is the one that
   catches a state kept under a fixture id that every check shares. The reference for a fixture is
   taken the first time a fresh process runs that fixture. Each snapshot costs about four calls.
3. **A stale-credential canary.** After the reset, the earlier check's owner and client credentials
   must be refused.
4. **The harness's own tests.** A deliberately leaky fake subject must be caught by layers 2 and 3.
   Its leaks are:
   - a client kept;
   - a timer kept that fires into the next check;
   - a state **keyed by a fixture id**, such as a tier raised on `sim-bridge:dimmer` or a latch on the
     valve, which survives into the next check under the same id. That case passes a snapshot taken
     before setup and must fail the one taken after.

   These are vitest tests of the harness, not manifest rows.
5. **No dependence on order.** Each run shuffles its checks with a seed it records in the report.
6. **Failures under reset are never silent** (the review's I3). The baselines stay on fresh processes:
   the clean run, and each mutation's own row and coupled ids. Reset is used only for the checks that
   show "nothing else broke". If one of those fails under reset, the harness reruns it on a fresh
   process.
   - If the fresh rerun also fails, the failure stands.
   - If the fresh rerun passes, the row is reported **`reset_suspect`**, with both outcomes and their
     evidence. The lane falls back to fresh processes for the rest of the run. The matrix's verdict
     lists it as a problem, and the run fails.
   - Each `reset_suspect` counts in the flake tally that the guide's probation keeps. A subject whose
     resets are suspect stays on fresh processes until someone looks.

What this does not prove: state that the owner cannot see and that changes no later check's behaviour.
Such state does not affect grading. The RSS of each lane is in the report, so a leak is visible.

## What must never be lost

- **The harness grades only the standard's text.** Reset and reach change which processes run which
  checks. No check and no assertion changes, and `TestContext` is unchanged.
- **A conforming third-party subject stays gradable.** Reset and `database.migrate` are optional, and
  without them nothing changes. Reach-based skipping is the matrix's, and applies only to builds that
  carry mutations.
- **Flakes go down, not up.**
  - Less CPU under load is the main cause.
  - Contamination is guarded as above, and a suspect pass is reported, never hidden.
  - The clock is never carried across checks.
  - Failed checks are never followed by a reset.
- **The restart and crash clauses keep real process restarts.** `restartApplier` and
  `subject.restart` still send SIGTERM or SIGKILL to the real process and start a new one.

## Seam changes, and how the in-flight slices rebase

The steward's slices 7, 10 and 11 are in flight, and the applier's slices 5 and 7 are next. Every change
below leaves the test files and `TestContext` alone, so test work in flight rebases onto each phase
without edits. The changes are named so that each slice's author can see what moves under it. The
phases are named by content; their order is *Recommendation*'s question.

| Step | File | Change | Who it touches |
|---|---|---|---|
| Template | `conformance/schemas/harness/subject.json`, `conformance/README.md` | optional `database.migrate` (`database` also takes an object) | nobody until a subject declares it |
| Template | `conformance/harness/src/database.ts`, `runner.ts`, `home.ts` | a template made once per run through `database.migrate`, checked and locked, and a clone per check, beside `freshDatabase`; the runner holds it, `contractEnv` clones it | nobody; `contractEnv` chooses |
| Template | [`reference/applier`](https://github.com/Ludentes/galatea-life/tree/main/reference/applier) | a `dist/migrate-main.js` entry (runs `migrate` and exits); `subject.json` declares it. The steward declares its own after its slices 7, 10 and 11 | new files only; no change to `main.ts` |
| Template | the matrix drivers (`full-matrix.mjs`, both builds) | `NODE_COMPILE_CACHE` set to one directory per matrix; the applier's driver names its migrate script from the build's directory in its subject copies | scripts only |
| Reach | the matrix drivers, a coverage helper, a lint in each reference build | coverage of the clean run, the union, the guards; the direct-site lint; skipping after the ruling; the weekly full matrix | scripts and lints; mutation sites written indirectly are rewritten as direct |
| Reset | `conformance/schemas/harness/subject.json`, `conformance/README.md` | optional `reset` | nobody until a subject declares it |
| Reset | `conformance/harness/src/subject.ts` | `SubjectProcess.reset(env)`, which calls the tool and waits for a new ready line; `restart` launches with the latest environment | the harness only |
| Reset | `conformance/harness/src/runner.ts` | each lane keeps its subject; `runTest` resets or starts it; the normative order between checks; no reset after a failure; shuffle and seed; the fresh rerun and `reset_suspect` | the harness only |
| Reset | `conformance/harness/src/home.ts` | `startOnSeam` and `startSteward` split the check's environment (`contractEnv` and the seams) from the process (`lane.subject.ready(env)`); the snapshots before and after setup, and the canary | the harness only |
| Reset | `conformance/harness/src/registry.ts` | `TestOptions.process?: "fresh"`, an opt-out that no check needs today, for a future check that grades a cold start | none of today's tests |
| Reset | [`reference/applier/src/main.ts`](https://github.com/Ludentes/galatea-life/blob/main/reference/applier/src/main.ts), then [`reference/steward/src/main.ts`](https://github.com/Ludentes/galatea-life/blob/main/reference/steward/src/main.ts) | `run(env)` returning a stop; the reset tool on the owner's MCP; the steward's TLS trust set once per process; the module-state lint | **every slice that edits `main.ts`**: the applier first, the steward's only after slice 11 merges (ruled, decision 9) |

## Recommendation

**The order: the review's (B1), ruled by the maintainer on 2026-10-06.** The maintainer first approved the plan in
the first order below; the spec review's Blocker argued for the second, and the maintainer agreed with it:
reach skipping before Reset, and Reset only if load still causes flakes, watching the gates' load and
flakes meanwhile. Both orders stay below for the record. Both start with the same phase 1, and both measure reach before any skipping.

All times are for the applier matrix at **3 jobs**, from one model:

- 83 runs;
- 22 checks per lane;
- 3.24 s per check today;
- 5 s of fixed overhead per run.

Phase 1 saves 0.09 s per check, and Reset another 0.175 s. The clean run always stays on fresh
processes. The reach is unknown until measured, so each order is given at 15 and at 30 checks per
mutation.

| | The approved order (A) | The review's order (B1) |
|---|---|---|
| Phase 1 | template database and compile cache: **35.4 → 34.5 min** | the same: **34.5 min** |
| Phase 2 | measure reach (coverage of the clean run, the guards); no change in time | the same |
| Phase 3 | **Reset**: harness, then the applier's `main.ts`, then the steward's after slice 11: **32.7 min** | **reach-based skipping**, on the maintainer's ruling: **8.1 min** (reach 15), **13.5 min** (reach 30) |
| Phase 4 | reach-based skipping, if ruled: **7.8 min** (reach 15), **12.9 min** (reach 30) | re-measure CPU and flakes; **Reset only if CPU still causes flakes**: then **7.8 / 12.9 min** |
| Contract change | in phase 3 | only if phase 4 is needed |
| Risk taken first | contamination (guarded), `main.ts` in every slice | a narrower guarantee, outside the full matrix (guarded) |

- **The argument for A**: it was approved. Its CPU saving applies to every harness run, not only the
  matrix: `pnpm conformance`, the preflight and third-party builds that declare a reset. It also
  raises the job ceiling for whatever the matrix still runs.
- **The argument for B1**: skipping cuts the matrix about fourfold with no contract change and no
  `main.ts` change in the slices in flight. Once the matrix shrinks, its CPU load shrinks with it, so
  Reset may no longer be worth its risk. Reset on top of skipping saves only about 0.3 min at 3 jobs.

The steward's matrix (58 runs, about 17 min at 3 jobs) scales in the same proportions in both orders.

Not recommended in either order: Share, In-process, bundling, lazy imports.

## Decisions for the maintainer

The maintainer ruled on 1–9 on 2026-10-06, at their defaults. The review changes the wording of 3 and 4, and
adds 10–12. Ask one at a time.

1. **A test-only reset in the subject contract only**, never in a standard. *Ruled: yes.*
2. **No reset after a failed check**; a fresh process instead. *Ruled: yes.*
3. **A mutation's own row and coupled ids always on fresh processes**. Reset is used only for the
   checks that show "nothing else broke". A failure there under reset is rerun fresh, and if the rerun
   passes it is reported `reset_suspect`, the lane falls back to fresh processes, and the flake tally
   counts it. *Ruled: yes; `reset_suspect` added by the review.*
4. **An optional migrate-only command for the template database**, now named `database.migrate`.
   *Ruled: yes; renamed by the review.*
5. **Reach-based skipping**: measure first, then rule. *Ruled: measure first; then, on the
   measure, yes (the maintainer, 2026-10-06). The gate's matrix skips by reach, and a full matrix
   (`--full`) runs weekly and before every release. Class P is only a check that lost an instance
   to a signal, since a restart on SIGTERM writes its coverage (the controller's ruling, stated to
   the maintainer). See the checks guide, *Skipping by reach*.*
6. **Shuffled check order with a recorded seed.** *Ruled: yes.*
7. **The matrix's clean run stays on fresh processes.** *Ruled: yes.*
8. **No bundling; compile cache only.** *Ruled: yes.*
9. **The steward's `main.ts` changes for Reset after slice 11.** *Ruled: yes.*
10. **The order: A (approved) or B1** (*Recommendation*). *Ruled: B1 (the maintainer, 2026-10-06), watching the gates' load and flakes.*
11. **The job count**, separately from this plan. It is bounded by flakes under load: the 6-job runs
    missed GA-APPLY-1's and GA-STATE-2's bounds under other sessions' load. *Default: stay at 3 until
    a fresh profile after phase 1 (and after Reset, if it lands) shows the bounds holding at more.*
12. **A `reset_suspect` row fails the matrix's verdict.** *Default: yes.*

## How it was measured

Every probe is a throwaway script kept with this design's working notes, outside the repository. None of
them is committed.

- `imports.sh`: CPU and wall of importing each dependency alone in a fresh Node, from the subject's
  directory, with and without the compile cache.
- `start-probe.mjs`: run under `with-postgres.mjs`. It measures a bare start to the ready line and the
  harness's own `startOnSeam`, reading the subject's CPU from `/proc`. It can also profile
  (`--cpu-prof`), use a cache, or start a given entry (the bundle).
- `prof-inclusive.py`, `prof-loading.py`: attribute a profile's samples to module loading, garbage
  collection, or the package nearest the leaf.
- `warm-vs-cold-probe.mjs` (after the review): per round, a fresh or template database, a bare start,
  then one setup function three times on the same subject, with startOnSeam's poll intervals. This
  gives the cold and warm setup through the same code. Its teardown stops the simulated bridges out of
  order and prints `client disconnecting` from them; that is the probe's, not the subject's.
- `warm-setup-probe.mjs` (first set): further namespaces added to a running applier after
  `startOnSeam`.
- `rebuild-probe.mjs`: builds the applier as `main.ts` does, stops it, and builds it again ten times in
  one process, on fresh databases or (`--template`) on template clones.
- `template-probe.mjs`: a fresh database plus migrations, compared with a clone of a migrated template
  (both strategies) plus the subject's no-op migrate. It was run back to back with `rebuild-probe.mjs`.
- `classify.py`: flags each `requirement(...)` block's use of restarts, the link, stalls, global
  configuration and time steps, for the table above.
- The matrix times come from the archived reports of one full applier matrix and one full steward
  matrix. The CPU split comes from the gate profile's re-measure.
