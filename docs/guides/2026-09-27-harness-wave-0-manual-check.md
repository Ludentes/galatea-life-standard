---
title: Checking the conformance harness, wave 0, by hand
status: current
last_verified:
area: conformance
audience: dev, pm
author: Galatea maintainers
related:
  - conformance/README.md
  - docs/specs/2026-09-27-conformance-harness-wave-0-design.md
---

# Checking the conformance harness, wave 0, by hand

This guide walks you through the harness once, by hand, from a clean checkout. You need Docker and
Node 24, and nothing else known. Every command runs from the repository root. The harness starts a
Mosquitto broker for each command, so a person without a `mosquitto` binary needs the Docker image.

Times below are typical for a 12-core machine; yours will differ. Report paths are under your
system's temporary directory, and each run has its own run id, so the ids you see will not match
the ones printed here.

## Before you start

1. Check the tools:

   ```bash
   node --version     # v24 or newer
   pnpm --version     # 10 or newer
   docker image ls eclipse-mosquitto   # eclipse-mosquitto:2 is listed
   ```

   If the image is not listed, run `docker pull eclipse-mosquitto:2`.
2. Install the packages:

   ```bash
   pnpm install
   ```

   Expected: it ends with "Done", or "Already up to date".

## The whole skeleton

```bash
pnpm skeleton
```

It builds every package, runs the schema tests, the manifest checks and their Python tests, and then
runs five checks of the harness on its own stand-ins. Expected: about ten seconds after the builds,
five lines that start with a check mark, each naming its report, and a last line:

```text
✓ the simulated bridge's run (report: /tmp/galatea-harness/run-...)
✓ the simulated bridge's negatives (report: /tmp/galatea-harness/run-...)
✓ the simulated applier's run (report: /tmp/galatea-harness/run-...)
✓ the simulated applier's negatives (report: /tmp/galatea-harness/run-...)
✓ the run-id guard (report: /tmp/galatea-harness/run-...)

The walking skeleton passes, in 9 s.
```

Each report is a directory holding `run.json` and `run.md` (or `negatives.json` and
`negatives.md`). The command exits `0`; check it with `echo $?`.

## A run, read by hand

1. Grade the simulated applier:

   ```bash
   node conformance/harness/dist/cli.js run --subject conformance/sim/subjects/applier
   echo "exit $?"
   ```

   Expected: "**Passed.** Tested 8 of 92 claimed ids.", a table of eight rows, all `pass`, a line
   `Report: <directory>`, and `exit 0`.
2. Open `run.md` in the printed directory. Find the row for `GA-EVT-3`: its state cell reads
   `pass (covers: ...)`. The `covers` text says which clause the test checked, so a green row never
   claims more than was run.
3. Open `run.json` in the same directory. Find the row whose `id` is `GA-EVT-3`, and read its
   `evidence`: a line such as `reported on at +0 ms, acked seen at 51 ms`. That is what decided
   the row.
4. Note that the run says "8 of 92": the other 84 claimed ids have no test yet and are `untested`
   (they are left out of `run.md`, and are in `run.json`). That is the harness saying plainly what
   it has not checked.

## The refused subject

```bash
node conformance/harness/dist/cli.js run --subject conformance/sim/subjects/applier-without-run-id
echo "exit $?"
```

This subject does not report the run id. Expected: the report says `Refused: describe.test_run_id is
undefined, not the run's. No id is reported.`, there is no table of rows, and the exit code is `1`.

## A negative run

1. Run the negatives of the simulated bridge:

   ```bash
   node conformance/harness/dist/cli.js negatives --subject conformance/sim/subjects/bridge
   echo "exit $?"
   ```

   Expected: a table with one mutation, `stamps-publication-time`, State `pass`, Failed
   `GA-BRIDGE-1`, and a detail "fails GA-BRIDGE-1 and nothing outside GA-BRIDGE-1, GA-BRIDGE-2".
   Here `pass` means the mutation did what it should: the broken requirement failed, and nothing
   else did. Exit `0`.
2. Make a negative that cannot work. In `conformance/sim/subjects/applier/subject.json`, change
   `"mutations": ["plans-with-side-effect", "speaks-only-2025"]` to `"mutations": ["stamps-publication-time"]` (a
   mutation no applier row names), and run:

   ```bash
   node conformance/harness/dist/cli.js negatives --subject conformance/sim/subjects/applier
   echo "exit $?"
   ```

   Expected: the mutation's State is `fail`, its detail is "no row of the manifest names this
   mutation", and the exit code is `1`.
3. Restore the file, and check that Git sees no change:

   ```bash
   git checkout conformance/sim/subjects/applier/subject.json
   git status --short
   ```

## Edge cases

**The simulated home does not start.** Stop Docker, and run `pnpm skeleton` again. This only applies
on a machine with no `mosquitto` binary on the `PATH`.

Expected: the skeleton stops after its builds and checks with `the simulated home did not start:`
followed by the reason (Docker could not start `eclipse-mosquitto:2`), prints no rows, and exits
`2`. A harness fault is never reported as the subject's failure. Start Docker again afterwards.

**One id.** Run the applier with `--ids GA-DESC-1`:

```bash
node conformance/harness/dist/cli.js run --subject conformance/sim/subjects/applier --ids GA-DESC-1
```

Expected: one row, `GA-DESC-1`, `pass`; "Tested 1 of 92 claimed ids"; exit `0`.

**A typo in `--ids`.** Run the applier with an id that is in no manifest:

```bash
node conformance/harness/dist/cli.js run --subject conformance/sim/subjects/applier --ids GA-TYPO
echo "exit $?"
```

Expected: `--ids names GA-TYPO, which is in no manifest`, then the usage line, and exit `2`. Nothing
is started, and no report is written.

**Ctrl-C.** Start a run with one worker, so it takes a few seconds, and press Ctrl-C while it runs:

```bash
node conformance/harness/dist/cli.js run --subject conformance/sim/subjects/applier --workers 1
# press Ctrl-C after a second or two
echo "exit $?"
docker ps --filter label=org.galatea.harness
pgrep -af "sim/dist/applier/main.js"
```

Expected: `SIGINT: stopping the subjects and closing the home`, no report, and exit `130`. The
`docker ps` line lists no broker from this run (only a header, unless another harness is running),
and `pgrep` prints nothing: the harness stopped its subjects and its broker before it exited.

**A complete run.** Run the applier with `--complete`:

```bash
node conformance/harness/dist/cli.js run --subject conformance/sim/subjects/applier --complete
echo "exit $?"
```

Expected: "**Failed.** Tested 8 of 92 claimed ids.", and exit `1`, because `--complete` fails a run
that has any claimed id `untested`.

**Workers.** Run the applier twice, and compare:

```bash
node conformance/harness/dist/cli.js run --subject conformance/sim/subjects/applier --workers 1 --out /tmp/galatea-w1
node conformance/harness/dist/cli.js run --subject conformance/sim/subjects/applier --out /tmp/galatea-wdefault
```

Expected: both pass with the same eight `pass` rows. The first prints a longer `Took ...` line
(about 8 s against about 3.5 s on 12 cores), because it runs the tests one at a time. The default is
half the cores, between 1 and 4. `--workers 0` prints the usage line and exits `2`.

**A schema change without `gen`.**

1. In `conformance/schemas/applier/outcome.json`, add a `description` to a property. For example,
   change `"reason": { "type": "string" },` to
   `"reason": { "type": "string", "description": "why" },`. (Add a `description`, not a `title`:
   the generator drops titles, so a title change would leave the check green.)
2. Run `pnpm --filter @ludentes/galatea-life-schemas test`. Expected: one test fails, in `generated.test.ts`,
   because the generated types no longer match the schemas.
3. Run `pnpm --filter @ludentes/galatea-life-schemas gen`, then the tests again. Expected: all pass.
4. Restore everything:

   ```bash
   git checkout conformance/schemas
   git status --short
   ```

**A schema that disagrees with a standard.**

1. In `conformance/schemas/common.json`, in `stepReason`, remove `"dead", ` from the enum.
2. Run `python3 conformance/check_manifest.py`. Expected: exit `1` and the message
   `text-map: applier ### Steps table 1 → common.json#/$defs/stepReason/enum: dead in the text, not in the schema`.
3. Restore it: `git checkout conformance/schemas/common.json`, and run the check again; it prints
   nothing and exits `0`.

## Round trip

The claim of a subject needs both commands. Run the applier's two and put the JSON files side by side:

```bash
node conformance/harness/dist/cli.js run --subject conformance/sim/subjects/applier --out /tmp/galatea-rt
node conformance/harness/dist/cli.js negatives --subject conformance/sim/subjects/applier --out /tmp/galatea-rt
grep '"passed"' /tmp/galatea-rt/run.json /tmp/galatea-rt/negatives.json
```

Expected: both files hold `"passed": true`. The verdict is `conforms` only when both do. Now edit
`conformance/sim/subjects/applier/subject.json` as in *A negative run* step 2, run the `negatives`
command again into the same directory, and see `negatives.json` hold `"passed": false`: the
subject no longer conforms, though `run.json` still passes. Restore the file with `git checkout`.

When you are done, `git status --short` shows nothing changed.
