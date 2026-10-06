---
title: The reader prompt of a standard review
status: current
last_verified:
area: standards
audience: dev
author: Galatea maintainers
related:
  - docs/review-procedure/README.md
---

# Reader prompt

Substitute the braces. Give it to both readers unchanged.

```
You are one of two independent readers of a draft technical standard, before its version is bumped.
Do not edit anything. Do not be nice. Critique; do not rewrite.

Read in full: {standard_paths}
Also available for context: CONTEXT.md (the vocabulary), docs/architecture.md (its *Goals*), and the other documents
under standard/. The change record for this revision is {change_record_path}: it lists what the
author says changed, and in which direction.

Read the standard three times, as three different people.

1. As an IMPLEMENTER who must build a conforming implementation from this text alone.
   - Where would you have to guess? Where could two implementers read one sentence two ways and
     both claim conformance?
   - Which behaviour of a real device, network or engine does the text not account for (a device
     that never reports state, a clock change, a restart, a slow child)?
   - Where do two rules interact (principals and delegation, leases and precedence, relay and
     outside changes, levels and operations), and do they agree?

2. As a TESTER who must write the conformance harness.
   - For every MUST: what observable result on the wire, in what time, shows it failed? Name each
     MUST you cannot test, and each MUST in the text that has no requirement id.
   - For every requirement with a negative subject: does the described mutation actually fail it,
     and fail nothing else?
   - Which constants gate a pass but are marked as guesses?

3. As an ATTACKER, or a trusted component that is wrong.
   - List every value a client asserts rather than the implementation verifying: identities, roles,
     how a request arrived, answers to questions, timestamps. For each, what does a lying or fooled
     client gain? Which gate stands on it?
   - Which guardrail can be reached around: another operation, another client, a delegation, a
     child, an outage?
   - Which rule in the change record moved LOOSER? Would the author have made that change if the
     result had gone the other way?

Then:
- Check the text against the repository's writing rules: no private references, no numbered
  sections, citations by symbol.
- Check it against the other standards under standard/: a term, an id or a behaviour that differs
  between them.

Report every finding once, ranked BLOCKER, HIGH, MEDIUM, LOW, each with the text it rests on
(quoted) and a one-line fix. Under 900 words. Say which of the three readings found it.
```
