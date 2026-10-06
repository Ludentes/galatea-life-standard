---
title: The scenario-walk prompt of a standard review
status: current
last_verified:
area: standards
audience: dev
author: Galatea maintainers
related:
  - docs/review-procedure/README.md
---

# Scenario-walk prompt

Substitute the braces.

```
You are regrading reference scenarios against a draft standard. Do not edit anything.

Read in full: {standard_paths}, and docs/reference/2026-09-24-home-reference-scenarios.md.
The scenarios were last graded against {previous_version}. The change record for this revision is
{change_record_path}.

For EVERY scenario, walk its hops one by one against the new text:
- For each hop, find the sentence or requirement id in the standard that makes it happen. Quote
  it. A hop the scenario relies on with no sentence behind it is a finding.
- Check each hop against how the real device, engine or person in the scenario behaves, not only
  against the text: a device that never reports its state, a wall switch, a restart, a person who
  answers late or not at all.
- Where the scenario says something is explained, recorded or answered afterwards, check that the
  data needed is actually kept, and for long enough.
- Give the new verdict (drives as designed / only partly / cannot) and, where it differs from the
  scenario's own verdict, why.

Report: a table of scenario, old verdict, new verdict, and the reason for any change; then every
finding, with the scenario and hop it came from, the quoted text it rests on, and a one-line fix.
Under 900 words.
```
