---
title: The conformance harness, for subject and test authors
status: current
last_verified:
area: conformance
audience: dev
author: Galatea maintainers
related:
  - docs/specs/2026-09-27-conformance-harness-wave-0-design.md
  - docs/guides/2026-09-27-harness-wave-0-manual-check.md
---

# The conformance harness

The harness grades a **subject**, an implementation of a Galatea standard, against that standard's
requirement manifest and reports one row per requirement id. This file is the contract for two kinds
of author: the author of a subject (a bridge, an applier), who must make it startable and testable,
and the author of a requirement test, who adds a row's proof to the harness.

The design and its reasons are in `docs/specs/2026-09-27-conformance-harness-wave-0-design.md`. To
see the harness work by hand, follow `docs/guides/2026-09-27-harness-wave-0-manual-check.md`.

## What is here

| Path | Holds |
|---|---|
| `<standard>-requirements.json` | One manifest per standard (applier, steward, bridge, brain, voice), generated from the standard's *Requirement index* and *Negative subjects* table |
| `<standard>-constants.json` | The standard's *Constants* table as data: name, value, number, unit, whether the text marks it a guess |
| `check_manifest.py` | Generates and checks the manifests, the constants and the schemas against the standards' text, and that `schemas/`'s copy of the manifest schema equals its source |
| `galatea-bridge.schema.json`, `examples/` | The finder's bridge-type manifest schema (cited by `standard/bridge.md`), with its examples |
| `schemas/` | `@ludentes/galatea-life-schemas`: JSON Schema for every message, generated TypeScript types, Ajv validators; it carries a copy of `galatea-bridge.schema.json`, so that a `pnpm deploy` bundle has it, kept equal to the source above by a test and by `check_manifest.py` (copy it again after a change there) |
| `clock/` | `@ludentes/galatea-life-test-clock`: the client a Node subject uses to take its time from the harness |
| `binding/` | `@ludentes/galatea-life-binding`: the standards' algorithms two builds must compute alike, today the confirmation token's proof (HMAC-SHA256 over RFC 8785), with test vectors in `binding/vectors/` that the reference applier's own copy agrees with |
| `sim/` | `@ludentes/galatea-life-sim`: the simulated home (broker, time server, simulated bridge and applier) and the subjects that grade the harness itself, under `sim/subjects/` |
| `harness/` | `@ludentes/galatea-life-harness`: the runner, the report, the subject contract and the requirement tests |

## Running the harness

Requirements: Node 24, pnpm 10, and either a `mosquitto` binary on `PATH` or Docker with the image
`eclipse-mosquitto:2` (the harness starts one broker per command on a free loopback port).

```bash
pnpm install
pnpm skeleton      # builds everything, runs every check, then the five walking-skeleton checks
```

Grade one subject:

```bash
node conformance/harness/dist/cli.js run|negatives --subject <dir> [--ids <id,id>] [--complete] [--workers <n>] [--out <dir>]
node conformance/harness/dist/cli.js run --subject <dir> --coverage <dir> ...
```

- `run` runs the tests of the ids the subject claims. `negatives` runs its negative mutations (see
  *Negative mutations*).
- `--subject <dir>` is a directory holding `subject.json`.
- `--ids` limits the run to the tests that cover any of the listed ids. An id in no manifest is a
  usage error: the command prints `--ids names <id>, which is in no manifest` and the usage line, and
  exits `2` before it starts anything.
- `--complete` also fails the command on any claimed id still `untested` (and, for `negatives`, any
  mutation with no test).
- `--workers <n>` sets the number of parallel lanes, an integer of at least 1. The default is half
  the machine's cores, between 1 and 4.
- `--out <dir>` sets where the report goes.
- `--coverage <dir>` (`run` only) measures reach: each check's subjects run with `NODE_V8_COVERAGE`
  set to `<dir>/t<n>`, and each row's `coverage` names that directory, the check's launches, and how
  many of its instances ended on a signal (those write no coverage). It changes nothing else.
  `scripts/reach.mjs` turns such a run into each mutation's reach.

Exit codes:

| Code | Meaning |
|---|---|
| `0` | The command passed |
| `1` | The subject failed a MUST (or a negative), or was refused before any test |
| `2` | A harness fault: the home did not start, a test threw outside an assertion, the registry is wrong, or the command line is not one |
| `130`, `143` | Interrupted by SIGINT (Ctrl-C) or SIGTERM: the harness killed the subjects, closed the home and wrote no report |

`pnpm skeleton` exits the same way. The broker's Docker container carries the label
`org.galatea.harness=broker` (and `org.galatea.harness.pid`, the harness's process id), so one that a
harness killed by SIGKILL left behind can be found with
`docker ps --filter label=org.galatea.harness` and removed.

The report is written as `run.json` and `run.md` (or `negatives.json` and `negatives.md`) in the
`--out` directory, by default `galatea-harness/<run id>` under the system temporary directory. The
last line printed is `Report: <directory>`. `skeleton` prints each check's report directory in its ✓ line.

**A conformance claim needs both commands to pass.** The verdict is `conforms` only when the `run`
report and the `negatives` report both say `"passed": true`.

Report states, per id: `pass`, `fail`, `not_claimed` (above the claimed levels), `not_applicable`,
`untested` (no test yet), `needs_judgement` (a `judged` id). The run fails on a `fail` of a MUST; a
`fail` of a SHOULD does not fail it. Each `pass` row prints the test's `covers` note when the test
checks less than the whole requirement, so a green row never claims more than was run.

## The subject contract

The harness owns the subject's process; the subject only reads its environment. A subject ships a
`subject.json`, validated against `conformance/schemas/harness/subject.json`:

```json
{
  "standard": "applier",
  "claims": ["Act", "Safe"],
  "start": { "command": "node", "args": ["dist/main.js"], "ready": { "log": "ready" } },
  "state_dir": true,
  "mutations": ["reissues-on-timeout", "sends-a-bare-setpoint"]
}
```

| Field | Meaning |
|---|---|
| `standard` | Required. One of `applier`, `steward`, `bridge`, `brain`, `voice`. The harness has seams for `bridge`, `applier` and `steward`; any other standard is refused |
| `claims` | Required, at least one. The conformance levels claimed, as the manifest's `conformance` column names them: `Act`, `Safe` for an applier (a meta-applier is not a level; its ids apply whenever `describe.children` is not empty), `Serve`, `Host`, `Provision`, `Find`, `Box` for a bridge, `Steward` for a steward |
| `start.command`, `start.args` | `command` required, `args` optional. The harness runs the command **in the subject's directory** (the directory of `subject.json`), so relative paths in `args` are relative to it |
| `start.ready.log` | Required. The text a line the subject prints on stdout or stderr starts with when it is ready |
| `state_dir` | Optional. When `true` the harness sets `GALATEA_STATE_DIR` to a fresh directory, keeps the same one across a restart, and removes it once the subject has stopped at the end of the test (or of the guard) |
| `database` | Optional. When `true` the harness gives the subject a Postgres of its own for each test, as the installation's `db-init` would ([`docs/specs/2026-09-28-storage-design.md`](https://github.com/Ludentes/galatea-life/blob/main/docs/specs/2026-09-28-storage-design.md)): a fresh database, a role, and a schema of the role's name owned by it, with a `reader` role on the server. It sets `GALATEA_DATABASE_URL`, logging in as that role, keeps the database across a restart, and drops it, then the role, once the subject has stopped. The harness needs a server: `GALATEA_TEST_PG_URL`, an admin URL, or a run under `conformance/harness/scripts/with-postgres.mjs`, which starts a throwaway `postgres:18-alpine` on loopback. Without one the test is a harness fault, never a skip |
| `database.migrate` | Optional, in place of `true`: `{ "migrate": { "command": "node", "args": ["dist/migrate-main.js"] } }`. The subject's own migrate-only command. Once per run, the harness makes a template database, role and schema as above (named `galatea_t…`) and runs the command in the subject's directory. `GALATEA_DATABASE_URL` names the template, logging in as its role; no other contract variable is set, `GALATEA_MUTATION` included, so the migration is the build's own whatever mutation is graded. The command must exit 0 within 60 s. The template is then locked: its role cannot log in, and the database takes no connections. Each test's database is a clone of it (`CREATE DATABASE … TEMPLATE`), with its schema renamed to the test's role and its objects reassigned to that role, so the test's database, role and schema are as with `true`. Because of that the migration must keep to what a clone keeps: **no object's text may name the schema** (a function body, a function's `SET search_path`), since the clone renames it; **no default privileges (`ALTER DEFAULT PRIVILEGES`) and no settings of the role (`ALTER ROLE … SET`)**, which belong to the template's role, not the test's; and the subject's own migration at start **must find nothing to do on a clone**. A template with default privileges, a setting of its role, or a function naming the schema is refused after the migration, as a command that fails is: the subject is refused with the reason and the command's last lines, a failure of its setup, never a graded fail. It is unrelated to the installation's `galatea-db-prepare`, which makes a build's database, role and schema |
| `stall_tables` | Optional, with `database`. The tables of the subject's schema whose lock stops a safety rule's firing from committing, which GA-SAFE-3's crash clause stalls; every table when absent. Where the lock cannot be taken, that clause is not graded |
| `mutations` | Optional. The negative mutations the subject implements, each named as its standard's *Negative subjects* table names it (lower case, digits and `-`) |

A subject that cannot be read, or does not validate, is **refused**: the run reports no rows and exits
`1`.

- **Ready.** The harness waits up to 30 s for the readiness line. A subject that does not print it,
  or exits first, fails the test with its last 50 lines of output as evidence.
- **Restart.** SIGTERM, wait up to 5 s, then SIGKILL; then start again with the same environment
  and the same state directory. **Crash.** SIGKILL. A subject should shut down on SIGTERM and exit.
  The subject runs in a process group of its own, and every signal goes to the whole group, so a
  subject started through a wrapper (`sh -c`, `pnpm start`) is stopped with its real process.
- **The run-id guard.** Before any test, the harness starts the subject once and checks that it
  reports the run id: a bridge's `status` carries `testRunId`, an applier's or a steward's
  `describe` carries `test_run_id`. A subject that does not is refused, and no id is reported.
  Nothing is actuated by the guard.
- **A steward's applier.** A steward is graded against a stand-in applier the harness runs in its own
  process (the simulated applier, scripted: no broker, its devices set by the test), with an adopted
  notify channel `sim-bridge:channel` and a lamp `sim-bridge:lamp`, and the steward registered as its
  client `steward`. Before each test the harness waits until the steward's `describe` shows the
  channel, then defines a baseline house as the bootstrap owner, in one change set whose `home`
  carries `time_source` and `notice_channels`; the change set is `baselineChanges` in
  `harness/src/steward-home.ts`. A test that needs the stand-in on TLS (GA-SEC-2) gets it on the
  host's address that is not loopback, with a certificate the steward is not told to trust, and no
  baseline.

### The environment

The harness passes only the variables below. Any `GALATEA_*` variable the harness's own environment
already holds is removed first.

| Variable | Form | Read by |
|---|---|---|
| `GALATEA_TEST_RUN_ID` | The run id, for example `run-1a2b3c4d` | Every subject |
| `GALATEA_TIME_SOURCE` | `host:port` of the harness's SNTP server | Every subject |
| `GALATEA_BROKER` | `mqtt://<identity>@host:port`; the user name is the subject's MQTT identity, the bridge id or the applier's client id. An applier's is its own for each test (`subject-applier-<run>-t<n>`), since its ClientID is its identity and the broker is shared, and it reaches the broker through a proxy of the test's, which a test may cut. A bridge reaches it through a link of the test's (`ctx.bridgeLink`), which a test may cut, read and have answer a subscription or a publish with a refusal | Every subject |
| `GALATEA_ROOT` | The MQTT `{root}` of this test, for example `demo/run-1a2b3c4d/t3` | Every subject |
| `GALATEA_STATE_DIR` | A directory path, set only when `state_dir` is `true` | Every subject that keeps state |
| `GALATEA_DATABASE_URL` | A Postgres URL, set only when `database` is `true` or names a `migrate` command: the test's own database (a clone of the run's template, with `migrate`), or, for the `migrate` command alone, the template; only its role may connect to it. It carries a password, so a subject never prints it | Every subject that keeps state in Postgres |
| `GALATEA_MUTATION` | At most one mutation name, from `mutations`; set only in a `negatives` run | Every subject |
| `GALATEA_TEST_TRANSPORT` | The test transport's control topic, `{root}/test/{bridgeId}/control` | A bridge |
| `GALATEA_MCP_PORT` | A free loopback port to serve MCP on (streamable HTTP, path `/mcp`). The standards pin revision 2026-07-28 (GA-BIND-1, GA-BIND-2). The harness still negotiates, falling back to the 2025 `initialize` handshake, so a subject on another revision fails the binding id and is graded on the rest | An applier, a steward |
| `GALATEA_OWNER_CREDENTIAL` | The owner's credential, used as a bearer token on MCP. A steward makes its first owner with it on a store that holds no person: person `owner`, endpoint `owner-app`, an app credential bound to it | An applier, a steward |
| `GALATEA_APPLIER_URL` | The steward's applier, `http://127.0.0.1:<port>/mcp`, or `https://<address>:<port>/mcp` | A steward |
| `GALATEA_APPLIER_CLIENT` | The steward's client id at its applier (`steward`) | A steward |
| `GALATEA_APPLIER_CREDENTIAL` | The steward's credential at its applier, a bearer token | A steward |
| `GALATEA_APPLIER_TOKEN_KEY` | The key the applier holds for the steward, which signs its confirmation tokens | A steward |

A subject honours `GALATEA_MUTATION` only while `GALATEA_TEST_RUN_ID` is set, and never otherwise.

## Time

A subject takes **every** time it uses from `GALATEA_TIME_SOURCE`, elapsed time included
(GA-HARN-1, GA-BRIDGE-16). The harness steps that source to make an hour pass in a moment, so a
subject that reads the system clock or measures elapsed time by its own monotonic clock will not see
the step.

- The source is an SNTP server. Its time starts at `2030-01-01T08:00:00Z` in each test and runs
  with the wall clock from there, as a real clock does; a test's step adds a jump to it.
- Poll it **at least every 100 ms**, and step to each answer; never slew. An NTP daemon slews, so it
  does not do.
- The server forgets a client that stays silent 500 ms after a step (five polls) instead of failing
  the step. A subject that polls slower than that misses steps.
- The server knows a client by its UDP address and port. Keep **one socket** for the whole run and
  send every poll from it: a subject that opens a new socket per poll looks like a new client each
  time, and the harness cannot tell when it has taken a step.
- A Node subject uses `@ludentes/galatea-life-test-clock`: `await clockFromEnv()` returns a client on
  `GALATEA_TIME_SOURCE` (polling every 50 ms), or the system clock when the variable is not set. It
  offers `now()`, `setTimeout`, `setInterval`, `clear` and `close`. Schedule periodic work by rescheduling a
  `setTimeout` from its own callback, so a step of an hour runs it once and not once per period.
- The broker's timers are real: keepalive, a will's delivery and Message Expiry run on the wall
  clock.

For test authors: `ctx.time.stepAndWait(ms)` is a **jump**, as a power cut or a suspended machine
would be. `ctx.time.advance(ms)` is **time passing**: steps of 20 s or less, each taken by every
client before the next, so periodic work runs in each. Never wait in real time for anything the
subject times; wait in real time only for a bound the broker enforces.

## Speed

- The skeleton runs in under a minute after the builds.
- A build's `run` and `negatives` each run in under 5 minutes on 4 workers.
- Tests run on parallel lanes (`--workers`), each lane with its own time server, since a step moves
  every subject on its source. The broker is shared, and each test's MQTT root carries the run id.
- A subject that declares `database.migrate` is migrated once per run, and each test's database is a
  clone of that template (*The subject contract*); one that declares `database: true` gets a fresh
  database per test and migrates it at every start.
- Every report prints its wall time and its five slowest tests.
- A test that needs a long real-time wait says so in its `covers`.

## The test transport

A bridge's test transport (GA-BRIDGE-16) is a transport whose radio the harness plays. Every bridge
subject implements it when `GALATEA_TEST_TRANSPORT` is set. The harness sends JSON, QoS 1, on
`{root}/test/{bridgeId}/control`, each message with a `requestId` and an `op`; an op that names a
`device` names it with at least one character. The bridge answers each on
`{root}/test/{bridgeId}/control/reply` with `{ requestId, ok, error?, unsupported? }`,
`unsupported: true` for an op its transport cannot play. A command the transport receives is
published on `{root}/test/{bridgeId}/control/received` as `{ device, action, args, state? }`, so
tests count physical actuations, not command ids.

| `op` | Fields | What the test transport does |
|---|---|---|
| `join` | `device`, `model`, `capabilities`, `feedback` | A device appears on the transport, as a join would bring it |
| `report` | `device`, `values`, `observedAt` | The device reports these values, observed at that time on the harness's clock |
| `checkIn` | `device`, `at` | The device checks in with no new value |
| `silence` | `device`, `silent` | The device stops (or resumes) answering anything |
| `commandResult` | `device`, `result`, `afterMs`, `reportAfterMs`, `detail`, `source` | How the device answers the next command: `confirmed`, `rejected`, `none`, or the ack it names (`sent`, `unreachable`, `expired`, `no_confirmation`, `unsupported`, or the non-terminal `received` some deployed bridges send); after how long; how long after the ack it reports its new state; the ack's `detail`; and a `source` other than the bridge's own |
| `commands` | `subscribed` | The bridge stops (or resumes) subscribing to its commands, as a bridge between connections, so the broker answers a command `0x10` |
| `transportState` | `state` | The transport reads `up`, `down` or `unknown` |
| `stall` | `ms` | The bridge's main loop stalls that long. The reply comes before the hold, so a test's next step runs while the loop is held; a command that arrives during the hold has its receipt stamped when it arrived, before the hold ends, so its time runs out during it |
| `describe` | `device`, `entry`, `bySetting` | A doer describes the device with this `devices` entry (its id left out), the device joining if it is new; `bySetting { key, entries }` makes the declarations depend on a setting, `entries` giving what changes for each of its values. What a doer derives from the network's facts (the bound, the class and its evidence, `otherAdmins`) is not taken from the entry: `reporting`, `classFrom` and `foreignBinding` script those facts |
| `setting` | `device`, `key`, `value`, `observedAt` | The device reports a setting; where `bySetting` names it, the doer describes the device again before the report |
| `occur` | `device`, `key`, `value`, `frameId`, `observedAt` | The device reports an occurrence of an `event` key, in the protocol frame `frameId`; the same frame again is a repeat |
| `undescribed` | `device`, `names` | The device sent data the doer maps to no key, by the protocol's names |
| `admit` | `device`, `how` | The device is admitted again, as `association`, `tcRejoinWellKnown`, `securedRejoin` or `tcRejoinUniqueKey` |
| `leave` | `device` | The device leaves the network |
| `windowState` | `open` | A join window opens or closes at the coordinator |
| `protocolResult` | `device`, `result`, `reason`, `detail` | What the stack says of the next command: `confirmed`, `transmitted`, `refused`, `lost` or `notSent`; a `refused` carries another reason than the standard's named ones (`refused` when none is given), a `notSent` `unreachable` (the default) or `expired`, and no other result a reason |
| `hostLink` | `open`, `answers` | The transport's host link (a coordinator's serial or TCP link) is there, and the far end answers an exchange; a host link with no answer is opened on each try and exchanges nothing, so a bridge shows the transport `down` only once its window of 30 s since the last exchange has passed (GA-BRIDGE-23) |
| `stateMismatch` | `disagrees` | The network disagrees (or agrees again) with what the bridge persisted, as a coordinator that answers with another network would |
| `reporting` | `device`, `configuredMs`, `modelMs` | The device's reporting facts: the intervals it is configured to report at (`[]` for none), and the interval its model is known to report at (null for no model entry); a doer describes it again from them |
| `foreignBinding` | `device`, `target` | A binding the bridge did not make, in `device`'s binding table, targets `target` |
| `classFrom` | `device`, `proposedClass`, `from` | Where the doer found the device's class: read from the device (`device`), from a model database (`modelDb`), or a guess (`guess`); a doer describes it again |
| `nativeControl` | `way`, `canDisable` | The network offers a way to change a device or open a window without the applier (a Touchlink, a stack's web frontend), which the doer can or cannot disable |
| `lockPin` | `device`, `requiresPin`, `pin` | The lock does (or does not) require a PIN for remote operation; `pin`, when given, is the owner setting it in the bridge's own configuration, which the test transport stands in for |

The last fifteen are a doer's ops: only the Zigbee bridge's scripted doer plays them, and every
other test transport answers each `unsupported`.

The `external` actor of the applier standard's *Conformance* is the transport's `report`: a device
changing state as a hand at the wall would. The schemas are `schemas/harness/test-control.json`,
`test-control-reply.json` and `test-received.json`.

## Negative mutations

A negative mutation is a switch in the subject's own code that breaks one requirement on purpose, so
the harness can check that its tests can fail.

- The subject lists its mutations in `subject.json`, each named as its standard's *Negative
  subjects* table names it. It turns one on only when `GALATEA_MUTATION` holds the name and
  `GALATEA_TEST_RUN_ID` is set.
- `negatives` runs, for each mutation, the tests of the id the mutation breaks and of the ids the
  table lists as `coupled` to it, with `GALATEA_MUTATION` set. A mutation **passes** only if every
  broken id the harness can test fails, and no id outside the broken and coupled ids fails. It fails
  if a broken id still passes ("still passes ..."), if an id outside the set also fails, or if no row
  of the manifest names the mutation. Since only the set's tests run, "outside the set" means a test
  that names an id of the set and also another id; a mutation that fails an id whose tests are all
  outside the set is not seen. A subject that wants that check runs every id under each mutation
  itself, as the reference applier's `conformance:matrix` does.
- A test catches a mutation only when its body ran and failed an assertion (or met a `SubjectFault`).
  A test whose setup fails, whose subject is not ready, or whose subject exits under any other error,
  does not: the mutation fails with "the mutation stopped the subject in ..., so it proves nothing
  there". So does a subject that exits during a test's body when the harness did not stop, crash
  or restart it, whatever the error its death then causes: the row's error reads "the subject exited
  during the test: ...". A subject that makes every mutation exit does not pass `negatives`.
- Each mutation's entry in `negatives.json` lists, in `errors`, the error that failed each id's
  test, so a reader sees why an id counted as caught (`failed`) or not (`stopped`).
- `negatives` assumes the subject passes `run`: it runs no unmutated baseline, so a test that fails
  without the mutation too is counted as catching it. Run `run` first; a claim needs both.
- A mutation whose broken ids have no test yet is `untested`: it does not fail the command unless
  `--complete` is given.
- The command's `passed` is true when no mutation failed. `conforms` needs both `run` and
  `negatives` to pass.
- A mutation in the environment (the simulated home misbehaves) selected by the same name is the
  harness's own; wave 0 has none.
- A mutation whose fault is the exit itself (the bridge's `exits-on-fault`, `EXIT_MUTATIONS` in
  `runner.ts`) is the one exception to the rule above: under it, a test in which the subject exited
  unasked has caught it, and the row's error still reads "the subject exited during the test: ...".

## Writing a requirement test

Tests live under `conformance/harness/src/tests/<seam>/` (`bridge` or `applier` in wave 0) and are
imported from `conformance/harness/src/tests/index.ts`.

```ts
import { mustWithin } from "../../assert.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import { HOUR, LAMP, turnOn } from "../util.js";

requirement("GA-HARN-1", {
  seam: "applier", covers: "after a step of an hour, a plan's expires_at is the source's time plus the plan expiry",
}, async (ctx) => {
  await ctx.time.stepAndWait(HOUR);
  const plan = await ctx.mcp!.callOk("plan", { actions: [turnOn(LAMP)] });
  ctx.evidence(`expires_at ${plan.expires_at}`);
  mustWithin(Date.parse(plan.expires_at), ctx.time.now() + constantMs("applier", "plan-expiry"),
    1000 + ctx.allowanceMs, "expires_at");
});
```

- `requirement(ids, { seam, covers?, fixture?, timeoutMs? }, fn)`. `ids` is one id or a list; the
  harness refuses to run if an id is in no manifest, or has two tests. `covers` says which clause the
  test checks when it checks less than the whole requirement. `fixture` is `{ devices?, faults? }`
  for the simulated bridge of an applier test. `timeoutMs` defaults to 120 s.
- Assertions: `must(cond, message)`, `mustEqual(actual, expected, message)` and
  `mustWithin(actual, expected, tolerance, message)`. A failed assertion is the subject's `fail`. So
  is a `SubjectFault`, which the seam clients throw when the subject misbehaves on its seam: no reply
  on the test transport, a refusal, an MCP call that cannot connect or times out, a body that is not
  JSON. Any other thrown error is a harness fault, and stops the run.
- The `ctx` holds `runId`, `root`, `time`, `allowanceMs`, `subject` (restart, crash, output),
  `evidence(note)`, and by seam: `bridgeId`, `watch`, `transport`, `applier` and `bridgeLink` for a
  bridge; `mcp`, `bridge` for an applier.
- `ctx.bridgeLink` is the bridge subject's own way to the broker, a TCP proxy that reads the MQTT
  packets it carries. `records` lists them in the order they passed: the subject's `connect`
  (client id, clean start, keepalive, will), `subscribe` (each filter with its options),
  `unsubscribe`, `publish` (by its real topic, an MQTT 5 Topic Alias resolved) and `disconnect`,
  and the broker's `suback`, `unsuback` and `puback` (a QoS 2 publish's PUBREC among them); the
  broker's PUBLISHes to the subject are not recorded. `connected` is true once the broker's
  CONNACK has accepted a connection that is still open. `sever()` cuts every connection and refuses
  new ones until `restore()`; a connection the subject closes itself has the broker's side ended
  only once all it wrote has passed. `refuse({ subscribe, publish })` answers the subscriptions and
  publishes it names with a refusal (`0x87` on MQTT 5, `0x80` on a 3.1.1 SUBACK; on a QoS 2
  publish, on its PUBREC) in place of the broker's own answer, which accepted them.
- `ctx.applier` is the harness as the bridge's applier: `command(device, value, opts)` publishes on
  `devices/{d}/command` with `issuedAt` from the harness's time source, `resultWithinMs` (10 s unless
  given) and a Message Expiry of it rounded up to whole seconds, and `opts.extra` adds envelope
  fields the standard does not define; `request(op, fields)` publishes on `request/{op}` with a 10 s
  expiry; neither is retained unless `retain` asks it, as no applier would (`clearRetained()` clears
  them), and neither lets an added field replace the envelope's own. `ack`,
  `reply`, `event` and `events` read what the bridge answered, through the test's watcher.
- Take a bound from the constants, never a copy: `constantMs(standard, key)` reads
  `<standard>-constants.json`. Add `ctx.allowanceMs`, the broker's measured delivery allowance, to
  every 1 s bound.
- Count physical actuations from `ctx.transport.received` (or the simulated bridge's record), never
  command ids.
- Write the tests first, before the build they grade.

## Schemas

- One schema per message under `schemas/`, in draft 2020-12, with an `$id` equal to its path (for
  example `bridge/status.json`). Every enum is defined once, in `schemas/common.json`. Objects are
  open (`additionalProperties` left out), because the standards' *Compatibility* says a reader
  ignores unknown fields.
- The case of each seam as its standard gives it: camelCase and milliseconds on MQTT, snake_case
  and seconds on MCP.
- After a change to a schema, run `pnpm --filter @ludentes/galatea-life-schemas gen`. It regenerates the
  TypeScript types under `schemas/src/generated/`; never write those by hand. The schemas' tests fail
  when the generated files drift from the schemas.
- `schemas/text-map.json` says which table of a standard feeds which schema path. `check_manifest.py`
  reads the map and fails when a value or field the text lists is missing from the schema ("dead in
  the text, not in the schema" is one of its messages), and the reverse. A table not in the map is
  not checked.
- Some shapes are provisional, because the standards leave them open. They are listed in the spec's
  *Standards fixes the harness shows*, and stay so until the standards say.
- After any change to `check_manifest.py` or the schemas, run
  `python3 conformance/check_manifest.py && python3 -m unittest discover conformance`.
