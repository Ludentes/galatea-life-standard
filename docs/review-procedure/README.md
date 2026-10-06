---
title: How a Galatea standard is reviewed
status: current
last_verified:
area: standards
audience: dev
author: Galatea maintainers
related:
  - docs/review-procedure/reader-prompt.md
  - docs/review-procedure/scenario-prompt.md
---

# Reviewing a standard

Every revision of a Galatea standard passes this procedure before its version is bumped; the review
records under `docs/reviews/` are its output. Commit ids in those records name the workshop's history,
where the standards are written, which is not published.

A standard fails differently from code or an argument. It fails through a MUST nobody can test, a
requirement no broken implementation fails, two implementers reading one sentence two ways, a
guardrail loosened in passing, a reference scenario that quietly stops driving, or drift between
the standards. A careful generic reviewer finds consistency bugs well. It misses what only the
reference scenarios and the trust boundary expose. **The version is bumped only on a PASS from
this procedure** (FR-REV-01).

## The five passes

| Pass | Who | Output |
|---|---|---|
| 1. Mechanical | author, by command | green, or stop |
| 2. Change record | author, **before any reader** | `docs/reviews/<date>-<standard>-<version>.md`, committed |
| 3. Two blind readers | Kimi and a no-context subagent, the same prompt | two reports, appended to the record |
| 4. Scenario walk | a third, separate subagent | a regrade of every reference scenario |
| 5. Disposition and verdict | author | every finding disposed; the verdict; a changelog row |

### 1. Mechanical

```sh
python3 conformance/check_manifest.py
python3 -m unittest discover conformance
grep -rnE "\b[A-Za-z][A-Za-z/-]*:(docs|src|standard)/" standard/
grep -nE '^#+ [0-9]' standard/*.md
```

The first two must pass, and the greps must print nothing: the first finds a citation into another
repository, the second a numbered heading. The manifest check also fails a
MUST that cites no requirement id, unless it says it is *not checked by the harness*. Anything red
stops the review here.

### 2. Change record

Write it and commit it before dispatching anyone. It lists every rule that is new, removed, moved or
changed. Each carries a direction (**stricter**, **looser**, **moved**, **new**) and one line of why.
A looser rule names the scenario or finding that asked for it. Readers get this record. It exists
so that a rule loosened to make a result come out right is written down before anyone could argue
for it.

### 3. Two blind readers

Use `reader-prompt.md`, unchanged, for both. One goes to Kimi and one to a subagent with no context
from the authoring session, on another model. Two subagents of the same model are one reader. Give
each the document paths and the change record, and nothing about the verdict you expect.

### 4. Scenario walk

Use `scenario-prompt.md` with a third subagent. It regrades every scenario in
`docs/reference/2026-09-24-home-reference-scenarios.md` hop by hop against the new text. **It is
not optional because the readers were thorough.** Against four known defects in v0.5, a careful
generic reader found one, came near two, and missed the fourth. What it missed came from the
scenarios: an IR air conditioner that can never be acked, and an explanation that needs lease events
`history` does not keep.

### 5. Disposition and verdict

Every finding gets exactly one disposition in the record:
- **fixed**: the commit that fixed it;
- **deferred**: why, and where it is tracked (a later version's changelog, an open question);
- **rejected**: why, with the text that shows it is wrong. "Not a problem" is not a reason.

**PASS** requires all of these: pass 1 green on the final text; both readers dispatched; the
scenario walk done; no blocker open; and every finding disposed. A fix made after the readers ran
reruns pass 1. A fix that changes a rule's direction goes back into the change record, and the
readers see it.

**When to stop** (the maintainer's ruling, 2026-09-27). Readers always find something, so "no
findings" never arrives. A round with no blocker ends the review: its highs are fixed and recorded
as not re-read, everything else is disposed, and the verdict is given. Before a round, pull out any
addition whose fixes keep breeding highs, and take it to a design note of its own: removals
converge, additions do not. Then add the changelog row: the version, what changed, both readers, the finding
counts per disposition, and PASS.

## Common mistakes

| Mistake | Instead |
|---|---|
| The author rejects a finding as "not a problem" | Quote the text that shows the finding is wrong, or defer it |
| Two subagents counted as two readers | One must be another model (Kimi) |
| The change record written after the readers report | Written and committed first; otherwise it follows the findings |
| Readers told what was fixed and "should now pass" | Paths and change record only |
| Skipping the scenario walk because the readers were thorough | It finds a different class of defect; run it |
| Bumping the version with deferred blockers | A deferred blocker is an open blocker |
