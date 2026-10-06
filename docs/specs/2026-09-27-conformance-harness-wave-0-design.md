---
title: The conformance harness, wave 0 — design
status: draft
last_verified:
area: architecture
audience: dev
author: Galatea maintainers
related:
  - standard/applier.md
  - standard/steward.md
  - standard/bridge.md
  - standard/brain.md
  - conformance/check_manifest.py
---

# The conformance harness, wave 0 — design

Classification: **architectural**. Nothing of the harness exists: the repository holds only the
manifests and `conformance/check_manifest.py`. Wave 0 creates the subsystem every reference build
is graded by (the roadmap's *Wave 0*).

## What wave 0 delivers

The machinery, not the tests. Wave 0 builds everything a requirement test needs, and proves it end
to end on a few requirements per seam. Each reference build then writes the tests for its own seam's
requirements first, and builds against them (tests first). So wave 0 is done when:

1. **The schemas** of every message on the seams the first release uses validate against the
   examples in the standards, and a mutated schema fails its check.
2. **The subject contract** is published: how the harness starts, restarts and stops a subject,
   hands it the run id and the time source, and turns on a negative mutation.
3. **The simulated home** runs: a real broker, a steppable clock, simulated bridges and devices, the
   `external` actor.
4. **The stand-ins** for each seam's neighbours run: a simulated bridge and a simulated applier.
   Each is a minimal implementation of its own standard. (The brain's fake steward comes with the
   agent-brain's milestone.)
5. **The runner and the report** grade a subject against its standard's manifest, one row per id.
6. **The walking skeleton** passes: a handful of requirement tests per seam, run against the
   stand-ins themselves as subjects, and one negative mutation per seam that fails exactly its ids.

Out of wave 0, and why:
- **The voice and PC harnesses**: their workstreams build them on this core (roadmap, *Workstreams
  beside the core*).
- **The meta-applier's and adapters' ids** (GA-META-*, the adapter clauses): not in the first
  release.
- **Bridge Find, Host and Box**: Find with the finder, Host with the PC workstream, Box with the
  installation (it needs Mosquitto's dynamic security).
- **Brain grading**: the agent-brain's milestone brings the corpus, the grader and the real-time
  runs, and the fake steward; wave 0 gives it only the front's schemas.
- **Story replay** (the old T-6): after the core builds exist.
- **CI**: skipped for now (the maintainer, 2026-09-27); the runner is a CLI that CI calls later.

## Approaches considered

**A. One harness, a runner of its own, stand-ins that are also minimal subjects** (chosen). One
package set graded against all manifests. The neighbours the harness plays for one seam are small
conforming implementations of their own standard, so the harness grades its own stand-ins with the
same tests: a simulated bridge must pass the bridge tests it claims, which checks the harness
against itself, and the old plan's "minimal subject" is not a separate build.

**B. A harness per standard, owned by each build.** Simpler at first, but the neighbours would be
written twice (the applier's harness needs bridges; the bridge's harness needs an applier), and the
report, the subject contract and the clock would drift apart.

**C. An off-the-shelf test framework (vitest) with a test per id, and the report parsed from its
output.** Cheap to start, but the per-id report, the subject's lifecycle per test, the negative
runs ("fails exactly these ids") and the "untested" state all fight the framework. vitest stays for
the harness's own unit tests.

## Where it lives

A pnpm workspace at the repository root, TypeScript throughout (the maintainer, 2026-09-27).

| Path | Package | Holds |
|---|---|---|
| `conformance/schemas/` | `@ludentes/galatea-life-schemas` | JSON Schema (draft 2020-12) for every message; generated TypeScript types; validators (Ajv) |
| `conformance/harness/` | `@ludentes/galatea-life-harness` | The runner, the report, the subject contract, the requirement tests |
| `conformance/sim/` | `@ludentes/galatea-life-sim` | The simulated home and the stand-ins |
| `conformance/clock/` | `@ludentes/galatea-life-test-clock` | A small client a subject MAY use to take its time from the harness's time source |
| `reference/*` | one package per build | Not in wave 0 |

`standard/` and `conformance/` never import from a reference build. `conformance/check_manifest.py`
stays Python, a repository tool.

## The schemas

- One schema per operation's request and response on the applier's MCP binding (10 tools) and the
  steward's (17 tools); one per MQTT payload of the bridge binding (`status`, `lwt`, `devices`, a
  device's `status`, `command`, `ack`, each `request/{op}` and `reply`, `event`); one per brain front
  operation (`listen`, `say`, `hush`).
- Every enum defined once, in `common.json`, and referenced.
- `additionalProperties: true` everywhere a standard's *Compatibility* says a reader ignores
  unknown fields; `false` only where a standard says a field set is closed.
- The case of each seam as the standard gives it: snake_case on MCP, camelCase and milliseconds on
  MQTT; one mapping table in the harness, from the bridge's *The applier's names*.
- **Checked against the text**, as the manifests are: `check_manifest.py` gains a check, reading
  the schema files directly, that every enum value and field a standard's tables list appears in the
  schema, and the reverse. Which table feeds which schema path is written once, in
  `conformance/schemas/text-map.json` (a table's heading, its column, the schema path, and the case
  it takes on that seam); a table not in the map is not checked, and the map is reviewed with the
  schemas.
- `conformance/galatea-bridge.schema.json`, the finder's bridge-type manifest. It stays in
  `conformance/`, where `standard/bridge.md` cites it (GA-BRIDGE-39); `@ludentes/galatea-life-schemas` loads it
  from there. The move waits for the bridge standard's next revision. Its Python tests keep running. A schema
  test validates each JSON example in the standards, and a mutation test removes an enum value and
  expects the check to fail.
- Types are generated from the schemas (json-schema-to-typescript), never written by hand.

## The subject contract

The standards leave the control interface "defined with the harness" (the bridge's *Conformance*;
review item C2-11). This is it. The harness owns the subject's process; the subject only reads its
environment.

A subject ships a `subject.json` beside its package:

```json
{
  "standard": "applier",
  "claims": ["Act", "Safe"],
  "start": { "command": "node", "args": ["dist/main.js"], "ready": { "log": "ready" } },
  "state_dir": true,
  "mutations": ["reissues-on-timeout", "sends-a-bare-setpoint"]
}
```

- **Start:** the harness runs `start` with its environment, and waits for the readiness line.
- **Environment:**
  - `GALATEA_TEST_RUN_ID`: the run id. A subject reports it as the standard says (`describe.test_run_id`
    on an MCP seam, `testRunId` in a bridge's `status`), and the harness refuses a subject that does
    not before any test runs.
  - `GALATEA_TIME_SOURCE`: the harness's time server (below). An applier and a steward also accept
    it through `configure` and `define` as GA-HARN-1 and GA-HARN-2 say; the harness uses those.
  - `GALATEA_BROKER`, `GALATEA_MCP_PORT`, and the credentials the harness minted.
  - `GALATEA_STATE_DIR`: where a subject keeps what must survive a restart, when `state_dir` is
    true.
  - `GALATEA_MUTATION`: at most one negative mutation's name, from `mutations`. A subject honours
    it only while `GALATEA_TEST_RUN_ID` is set, and never otherwise.
- **Restart** (GA-PERSIST-1, GA-PERSIST-2, the bridge's reload): SIGTERM, wait, start again with
  the same state directory. **Crash**: SIGKILL. The standards' "restart hook provided by the
  packaging" is this contract.
- **Bridges** also read `GALATEA_TEST_TRANSPORT`, which turns on the test transport (GA-BRIDGE-16)
  and names its control topic (below).

### The test transport's control protocol

A bridge's test transport (GA-BRIDGE-16) is a transport whose "radio" the harness plays. The harness
drives it with JSON messages, QoS 1, on the control topic `{root}/test/{bridgeId}/control`, and the
bridge answers each on `{root}/test/{bridgeId}/control/reply` with `{ requestId, ok, error?, unsupported? }`. Every
bridge subject implements this protocol; it is the part of the control interface the standards
leave to the harness. Wave 0's messages:

| `op` | Fields | What the test transport does |
|---|---|---|
| `join` | `device`, `model`, `capabilities`, `feedback` | A device appears on the transport, as a join would bring it |
| `report` | `device`, `values`, `observedAt` | The device reports these values, observed at that time on the harness's clock |
| `checkIn` | `device`, `at` | The device checks in with no new value |
| `silence` | `device`, `silent` | The device stops (or resumes) answering anything |
| `commandResult` | `device`, `result`, `afterMs`, `reportAfterMs` | How the device answers the next command: `confirmed`, `rejected`, `none`; after how long; and how long after the ack it reports its new state |
| `transportState` | `state` | The transport reads `up`, `down` or `unknown` |
| `link` | `carrier`, `gatewayAnswers` | A wake relay's interface: whether it has a carrier, and whether the gateway answers ARP |
| `power` | `event` (`suspend`, `resume`, `shutdown`), `announced` (true when absent), `suspendedMs` | A PC's OS suspends, resumes after that long asleep, or shuts down, announced or not |
| `clock` | `steppable` | Whether a PC's OS can step its clock at a resume |
| `account` | `osId`, `name`, `interactive`, `primaryGid`, `path` (its `PATH`, a list of directories), `state` (`present`, `renamed`, `deleted`, `absent`, `lookupFails`) | An account on a PC appears or changes, is renamed, is deleted on the OS's authority, lapses from the listing, or its directory cannot answer |
| `session` | `id`, `osId`, `graphical`, `remote`, `seat0Active`, `state` (`active`, `locked`, `disconnected`, `closed`), `idleHint`, `startedAt` | A login session on a PC opens, changes or closes, as the OS reports it |
| `helper` | `session`, `action` (`start`, `stop`, `report`, `forge`), `values`, `from` (`helper`, `sessionProcess`, `pluginServer`), `claims` | A PC's session helper connects, goes, reports for its own session or for the one `claims` names; or another process of the session connects |
| `admins` | `groups` (`[{ name, gid, members }]`, members as osIds), `sudo` (`[{ osId, root }]`), `polkit` (`{ identities, unrecognised }`), `reported` (true when absent) | A PC's raw administrator facts change, and the OS reports the change or not |
| `file` | `path` (absolute), `exists` (true when absent), `executable`, `writableBy` (osIds) | A file or directory on a PC, as its bridge's write check and `PATH` resolution see it; one not named does not exist |
| `lockBehaviour` | `session`, `result` (`locks`, `ignores`), `afterMs` | How a PC session's locker answers the next lock |
| `stall` | `ms` | The bridge's main loop stalls that long |

A device's command, as the transport receives it, is published by the bridge on
`{root}/test/{bridgeId}/control/received` (`{ device, action, args, state? }`), so the harness counts
physical actuations, not command ids. A wake relay's `power.wake` carries
`args: { interface, port, packet }`, the packet as hex. A PC bridge's scripted OS puts there, as
`os.*` actions, what the bridge asked of the OS (the PC design's *The scripted OS*).

A subject's transport may have no meaning for an op: a wake relay has no devices that join or
report, and a simulated bridge no interface for `link`. It answers such an op `ok: false` with
`unsupported: true`, and the harness reports the test that sent it `not_applicable`, with the
refusal as its evidence. Any other `ok: false` is the subject's failure of the test.
A refusal is the subject's own declaration, and it takes the id out of the coverage denominator,
which `--complete` does not catch: any subject could refuse `join` or `report` and drop GA-BRIDGE-1.
A later harness plan should report a refusal distinctly and cross-check it against the ops the
subject declares unplayable in `subject.json`.

More ops arrive with the builds that need them (IR codes, attestation failures, other
controllers), each added here first.

### Fixture faults of the stand-ins

A stand-in also misbehaves in ways no conforming subject would, so that the harness can test how a
subject treats a bad neighbour: a simulated bridge that publishes a `status` without `v`, sends no
will, or stamps a wrong time. These are **fixture faults**: a test asks for them through the
stand-in's own options when it starts the stand-in (in-process, below). They are not part of the
subject contract, and not negative subjects.

## Time

Two clocks, kept apart on purpose:
- **Subject time** is stepped. The harness runs a small SNTP server whose time it sets; the offset
  jumps when a test steps it. A subject takes every time it uses from that source, elapsed time
  included (GA-HARN-1). `@ludentes/galatea-life-test-clock` does this for a Node subject: it polls the source every
  50 ms, gives `now()` as its own monotonic time plus the source's offset, and fires the subject's
  timers against that time, so a step of an hour fires an hour's timers at once. A subject may use
  its own client instead, provided it polls at least every 100 ms and steps to each answer (never
  slews); the harness checks only the behaviour.
- **Protocol time** is real. Mosquitto's keepalive, a will's delivery and Message Expiry run on the
  wall clock, since the broker is real. A test of a bound the broker enforces (a will within 30 s)
  waits in real time; a test of a subject's own timer (a load cap of an hour) steps the clock.
- **How the harness knows a step took effect:** the SNTP server records each client's queries, and
  a step counts as taken once the subject has queried the source after it; the harness then waits
  one more poll interval (100 ms) before asserting anything that depends on it. No seam carries the
  subject's time back, so the harness watches the source instead. The time server forgets a client
  that stays silent 500 ms after a step (five polls), instead of failing the step, so a subject
  that polls slower than that misses steps.
- **A step is a jump.** `advance` is time passing: steps of 20 s or less, each taken by every
  client before the next, so periodic work runs in each. A test waits in real time only for a bound
  the broker enforces.
- **The broker's delivery allowance** is measured on the harness's own probe messages at start, and
  added to every 1 s bound, as the bridge's *Conformance* says.

Brain runs are real time with no stepped clock (the brain's *Conformance*); they are not in wave 0.

## The simulated home and the stand-ins

- **The broker:** Mosquitto 2, started by the harness as a child process (the binary on `PATH`, or
  the `eclipse-mosquitto:2` image), one per run, on a free port.
- **Two launch modes.** A stand-in runs **in-process** in the harness when it is a neighbour (the
  applier's bridges), where a test sets its fixture faults directly, and **as a subject** through
  its own `subject.json` when the harness grades it. Same code, two entry points.
- **The simulated bridge** (bridge stand-in, claims Serve, implements the test transport's control
  protocol): devices defined by a fixture — a lamp, a
  dimmer, a leak sensor, a momentary-relay gate that acks in 3 s and counts physical pulses, a
  socket with a `heating` load, an `infrastructure` socket, an IR TV whose power code toggles, an IR
  air conditioner whose codes carry the whole state. It can die with a will or silently, stall, fall
  silent per device, and report with known observation times. Physical actuations are counted, not
  command ids. It also implements the bridge standard's Serve MUSTs a stand-in needs to be a fair
  neighbour: a repeated `commandId` is answered from its first result and not actuated twice
  (GA-BRIDGE-4); a transport that is down makes each command's ack `failed(unreachable)` and stops
  the heartbeat (GA-BRIDGE-6, GA-BRIDGE-17); a command past `issuedAt` plus `resultWithinMs` is
  `failed(expired)` (GA-BRIDGE-7); a handler's errors go to stderr.
- **The `external` actor** is the test transport's `report`: a device changing state as a hand at
  the wall would.
- **The simulated applier** (applier stand-in, claims Act; minimal, see *Decisions this design makes*): an MQTT client of the bridge binding
  over simulated bridges on the run's broker, as the applier's *Conformance* grades an applier; plans,
  apply, outcomes and events kept in memory; a run id, a `standard_version` it can be told to report (0.8 for the
  steward's `sends-from-to-an-old-applier`), and a record of every action, `via`, `for` and token
  that reaches it, for the steward's tests.
- **Stand-ins stay minimal.** Each claims the lowest level that serves its role, keeps no state
  across a restart unless a test needs it, and is graded by the same tests as a real subject.

The steward's *Conformance* says it is graded over "a reference applier on the applier harness's
simulated home"; this design grades it over the simulated applier, which the harness can watch and
make old. That sentence is the first standards fix this build shows (*Standards fixes the harness
shows*).

## The runner and the report

- **A requirement test** is a module that registers one or more manifest ids:
  `requirement("GA-APPLY-6", { seam: "applier", fixture: { devices: ["gate"] } }, async (ctx) => { ... })`. The context
  gives the subject's client, the simulated home, the clock and assertions that name the observable
  result on the wire.
- **The harness refuses to build** if a test names an id the manifests do not hold, or an id twice.
- **A run:** `galatea-harness run --subject <dir> [--ids ...] [--complete] [--workers <n>] [--out <dir>]`
  reads the subject's `subject.json`, the standard's manifest and its constants, starts the simulated
  home, and runs every test of the claimed levels, each with a fresh subject.
  Wave 0 gives every test a fresh subject; a test that may share one arrives when run time asks for it.
- **Lanes and speed.** Tests run on parallel lanes, each with its own time server, since a step
  moves every subject on its source; the broker is shared, and each test's MQTT root carries the
  run id. Targets: the skeleton under a minute after the builds; a build's `run` and `negatives`
  under 5 minutes on 4 workers. Every report prints its wall time and its five slowest tests.
- **One vocabulary of states**, per id:
  - `pass`, `fail`;
  - `not_claimed`: above the subject's claimed levels;
  - `not_applicable`: the standard's own named cases (a 3.1.1 bridge's MQTT 5 halves), and a test
    whose op the subject's test transport answered `unsupported`;
  - `untested`: the harness has no test for the id yet;
  - `needs_judgement`: a `judged` id, with the record a person or a grader needs.

  A SHOULD shows `pass` or `fail` and never fails the run. The run fails on any `fail` of a MUST; it
  reports coverage (tested ids of the claimed levels) beside it, and `--complete` also fails on
  any `untested`.
- **The report** is JSON (one row per id: state, time, evidence, the messages that decided it) and a
  Markdown summary.
- **If the simulated home cannot start**, the run reports no id and exits non-zero.

## Constants

No manifest holds constants today, and the harness must not copy them by hand.
`check_manifest.py --write` gains a second output per standard, `conformance/<standard>-constants.json`,
generated from its *Constants* table: name, value, unit, and whether the text marks it a guess
(⚠️). A test reads a bound from there, and from a subject's declared values where the standard says
so (an action's `ack_within_s`, a socket's `max_on_s`).

## Negative subjects

The standards list 447 subject rows. Each names a subject, the id it breaks, and the ids it may also
fail (`coupled`).
- **A subject mutation** is a switch in the subject's own code, named as the standard names it, on
  only when `GALATEA_MUTATION` holds that name and a run id is set. Reference builds carry theirs
  (the steward's in the steward, the applier's in the applier), added with the tests for their
  seam.
- **An environment mutation** is the harness's: the simulated home misbehaves as the row says (a
  dropped reply, a slow ack), selected by the same name.
- **Environment mutations are for negative rows only.** A positive test that needs a bad neighbour
  uses a fixture fault (*Fixture faults of the stand-ins*), never an environment mutation, so the
  `negatives` command selects only rows of a standard's *Negative subjects* table.
- **A negative run:** `galatea-harness negatives --subject <dir>` runs, for each mutation the
  subject lists and each environment mutation of its standard, the tests of the broken id and its
  `coupled` ids. It passes only if the broken id fails and no id outside that set fails. It
  reports every manifest row it could not run (no mutation, or no test) as `untested`.

Wave 0 proves the loop on one mutation per stand-in; the rows arrive with each build.

**A conformance claim needs both commands to pass**: `run` for the requirements, and `negatives`
for the subject's mutations (the applier's *Conformance*: a disarmed negative fails the run). The
report's verdict says `conforms` only when both did.

## The walking skeleton

Wave 0 is accepted when, on the maintainer's machine, one command runs these, each green:

- **Bridge seam**, the simulated bridge as subject: GA-BRIDGE-1 (each reading's time is its
  observation's), GA-BRIDGE-16 (`status` carries `testRunId`; time from the harness's source) and
  GA-BRIDGE-17 (`status` at least every 10 s).
- **The applier over a bad bridge:** GA-BUS-14 (a `status` without `v` makes the bridge's devices
  `dead`), the simulated applier as subject, its bridge started with the fixture fault that drops
  `v`.
- **Applier seam**, the simulated applier as subject, over in-process simulated bridges: GA-DESC-1,
  GA-PLAN-1, GA-APPLY-4, GA-EVT-3.
- **The run-id guard:** a subject that does not report the run id is refused, and no id is reported.
- **Time:** a test that steps the clock an hour and sees a subject's timer fire.
- **One negative per stand-in:** the simulated bridge's `stamps-publication-time` fails GA-BRIDGE-1
  and nothing outside its `coupled` ids (GA-BRIDGE-2); the simulated applier's
  `plans-with-side-effect` fails GA-PLAN-1 and nothing outside its `coupled` ids.
- **Schemas:** every JSON example in the four standards validates, and the mutation check fails.

## Error handling

- A subject that does not become ready in 30 s, or exits during a test: that test `fail`s with the
  subject's last output as evidence; the run goes on with a fresh subject.
- A harness fault (the broker dies, a port is taken): the run stops, reports no further ids, and
  exits with a code distinct from a subject's failure.
- A test that throws outside an assertion is a harness bug: reported as such, never as the
  subject's `fail`.

## Testing the harness itself

- Unit tests (vitest) for the runner, the report, the schema checks, the SNTP server and the clock
  client.
- The stand-ins graded by the harness (the walking skeleton) are the harness's integration tests:
  a stand-in that fails its own claimed ids is either a stand-in bug or a test bug, and either way
  the run is red.

## Standards fixes the harness shows

Not made now (spec review has stopped); queued for the next revision of each standard:
- The steward's *Conformance*: graded over the harness's simulated applier, not a reference applier.
- The bridge's *Conformance*: names Python MQTT clients (paho-mqtt, aiomqtt); name none, or the
  harness's.
- `describe.test_run_id` has no requirement id (review K-L6); GA-PERSIST-2 needs the restart this
  contract gives; voice has no run-id guard.
- Each standard's *Conformance* points at this contract for the control interface.
- GA-STW-12's requirement (the Requirement index) says each `scenario_status` failed step carries its
  `time`, but the steward's operations table omits it; the schema follows the requirement (the
  index is the source of truth).

Shapes the standards leave open, which the schemas fill and mark **provisional in the schemas until
the standard says**:
- the applier's `configure` change: `{ op: upsert·delete, kind, value }`;
- the applier's `state` response: `{ targets: { <id>: { values, liveness, last_check_in, fresh_s, fresh_basis, other_admins } }, transports, latches }`;
- the bridge's `devices` document: `{ devices: [ … ], publishedAt }`;
- an outcome on the wire: `skipped(already)` is `{ outcome: "skipped", reason: "already" }`, and a
  scenario's `ended(done)` is `{ status: "ended", reason: "done" }`;
- the steward's plan names "the credential" it was made from with no field (`client`, optional);
- the steward's `state` response, "the applier's, plus" occupancy, group state and leases, names
  no fields;
- an applier step's `tier` is required although `skip(unknown_target)` has no action to take one
  from;
- an applier `outcome` event's apply id has no field name (`apply_id`);
- a subject's MQTT identity and `{root}` reach it through the broker URL's user name and
  `GALATEA_ROOT`, which the text does not name.

## Decisions this design makes, for the maintainer to overrule

- The harness owns the subject's process; hooks are signals and environment variables, not a
  control endpoint on the subject.
- Subject time is an SNTP source with a jumping offset; protocol time is real.
- Negative mutations live in each reference build, switched by environment, only under a run id.
- Wave 0 grades its own stand-ins; the reference builds' tests are written with the builds.
- The simulated applier is minimal: no tiers, tokens, safety rules, latches, loads or witnesses until
  the steward's tests need them.
- Levels: the applier's `claims` are `Act` and `Safe` only. Meta is not claimed; it applies whenever
  `describe.children` is not empty (`standard/applier.md`, *Conformance levels*).
