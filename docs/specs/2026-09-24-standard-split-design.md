---
title: Splitting the standard — a stateful layer above one applier
status: draft
last_verified:
area: architecture
audience: dev
author: Galatea maintainers
related:
  - standard/applier.md
  - docs/reference/2026-09-24-home-reference-scenarios.md
---

# Splitting the standard — a stateful layer above one applier

**Path: architectural.** This restructures the one normative document the repository has, and every
requirement id in it.

**Ruled 2026-09-24.** What the standard calls a meta-applier does two jobs. Separate them: a
**stateful layer** holds the house's state and authority, and sits above **one applier**, which may
be a meta-applier that only combines children. Both layers have a gate, and the gates differ:
the layer's guards *authority*, the applier's guards *the device*.

**Working name: the steward.** It holds the house on the owner's behalf and decides who may do what.
The name is pending the maintainer's choice; this document uses it so that the mapping reads.

## The documents

| Document | Contract | Version |
|---|---|---|
| `standard/steward.md` (new) | brain, panel or app ↔ steward | 0.1 |
| `standard/applier.md` (restructured) | steward ↔ applier, and meta-applier ↔ child | 0.6 |
| `standard/brain.md` (later) | what a brain must do | — |
| `standard/bridge.md` (unchanged) | applier ↔ bridge, a placeholder until the Galatea bridge standard | 0.4 |

**Requirement ids keep their numbers and move.** Ids are one namespace across the Galatea standards
(`GA-…`). A requirement that moves to the steward keeps its id, so the reference scenarios, the
harness tickets and the manifests stay valid. New ids take the next free number in their family. No
id is reused.

**Manifests: one per document.** `conformance/applier-requirements.json` and
`conformance/steward-requirements.json`. `check_manifest.py` checks each document's index against
its own manifest, that no id is in two indexes, and that every id cited anywhere in `standard/`
exists in some index.

## Levels

- **Applier:** **Act** (describe, state, plan, apply, outcomes, events, history, liveness, device
  tiers, tokens) and **Safe** (safety rules and latches, load caps, witnesses, notices). A
  meta-applier is an applier with children; it is not a level.
- **Steward:** one level in 0.1. Levels wait until a second implementation needs a partial claim.

The applier's old **Scenarios** level is dropped. An engine's own scenarios (Home Assistant's
scripts) are not exposed in 0.6; they appear as outside changes, as `ungoverned` already says.

## Where each requirement goes

| Requirement | Goes to | Change |
|---|---|---|
| GA-DESC-1, -2, -4, -5 | applier | `describe` is the device model: no rooms, names, scenarios, rules or schedules |
| GA-DESC-3 | applier | Default tiers now also follow a declared load (below) |
| GA-DESC-6 | applier | "claims Full" becomes "claims Safe" |
| GA-STATE-1, -2 | applier | — |
| GA-AUTH-1 | steward | Principals are the steward's. The applier authenticates its clients by token (new GA-TOKEN ids) |
| GA-PLAN-1, -2, -3 | both | Each layer's plan changes nothing, gives one step per target, and says real or emulated |
| GA-PLAN-4 | both | The reason order splits: the applier's (`unknown_target`, `unsupported_action`, `invalid_args`, `dead`, `duplicate_route`, `token`, `already`), and the steward's, which prepends `role`, `leased`, `tier`, `occupied` to what the applier returns |
| GA-PLAN-5, -6 | steward | Selectors resolve against the house model; `infrastructure` stays out of them |
| GA-GRP-1, -2 | steward | Groups are house-model objects |
| GA-APPLY-1, -5, -6, -7, -8 | applier | — |
| GA-APPLY-2, -4 | both | Plan expiry and idempotency at each layer |
| GA-APPLY-3 | steward | An unanswered ask is the steward's |
| GA-APPLY-9 | both | The applier re-evaluates `dead` and `already`; the steward re-evaluates `leased` |
| GA-TIER-1, -2, -3 | steward | The steward asks, and refuses by `via` and role. The applier's backstop is the token (new) |
| GA-EVT-1, -3, -4 | applier | An honest `external` cause is what the steward's leases stand on |
| GA-EVT-2, -5 | both | The applier's history says what happened; the steward's says why |
| GA-LVL-1 | both | — |
| GA-SCN-1…7 | steward | Scenarios are house-model objects |
| GA-LEASE-1…5 | steward | — |
| GA-DEF-1…4 | steward | `define` edits the house model only: rooms, names, aliases, groups, scenarios, rules, schedules, exceptions |
| GA-SCHED-1 | steward | — |
| GA-OCC-1, -2 | steward | Occupancy is computed from the applier's sensor readings |
| GA-SAFE-1, -3, -5 | applier | "with no brain connected" becomes "with no steward or brain connected" |
| GA-SAFE-2 | applier | Restated: no token, tier or client request refuses a safety rule's action |
| GA-SAFE-4 | applier | Replaced by GA-SAFE-8 (below) |
| GA-SAFE-6 | applier | Through the applier's own `configure` |
| GA-WIT-1 | applier | — |
| GA-META-1…5, -7, -8 | applier | Routing only. GA-META-3 through `configure` |
| GA-META-6 | both | The applier reports a child's own change as `external`; the steward leases it |

## New requirements

**Applier.**
- **Loads.** A `socket` may declare a `load`: `heating`, `motor`, `lighting`, `other`. A `heating`
  load raises `onoff.turn_on` to `confirm` and carries a maximum on-time (a constant, 4 h by default),
  after which the applier turns it off itself, with no steward or brain (closes HS14).
- **Latches.** A safety rule may declare a latch on its own undo: the action that undoes it (a
  valve's `open`) is refused while the rule's condition holds, whoever asks (Run 3).
- **Notices, GA-SAFE-8.** A safety rule's notice is delivered on a channel the applier owns, or held
  and re-offered until the steward takes it. It is never dropped because the steward was down.
- **Tokens.** A `confirm`- or `no_voice`-tier action is applied only with a confirmation token from
  a steward the applier trusts, bound to the target, the action and its arguments, and short-lived.
  Without one it is `refuse(token)`. A meta-applier checks tokens for children that cannot.
- **`configure`.** The applier's own configuration, owner-only: children, routes, device keys,
  tiers (raise only), loads, `infrastructure`, safety rules. The house model is not here.
- **Clients.** The applier trusts a named set of steward identities, each by credential.

**Steward.**
- **The confirmation dialogue.** The steward owns every ask. It puts the question to the endpoint
  the request came from, and accepts an answer only from that endpoint's token, after the question
  was put, for that plan. The audit records who answered (closes HS16 for panels and apps).
- **`via` from the endpoint.** A request carries the endpoint it came from; `via` is that endpoint's
  type, not a field the brain asserts.
- **Voice.** A spoken yes reaches the brain first. 0.1 accepts it from the brain as an *utterance
  record* (endpoint, time, transcript), so the audit can show it; a check the brain cannot pass by
  itself is an open question, carried to the brain standard.
- **Two histories.** The steward's history adds why: rule, lease, scenario, person.

## Still open

- The steward's name.
- The voice path for a confirmation (see *Voice*).
- One steward or several in a home (an existing system's own steward as a second).
- `lease` and `rule_fired` events in the steward's history (HS3).
- Open-loop devices, settled by a witness rather than an ack (HS12); a vacuum in the vocabulary
  (HS6). Both applier changes, not part of this split; they go in a later minor version.

## Order of work

1. The maintainer confirms the name.
2. `check_manifest.py` learns two documents, tests first.
3. Write `standard/steward.md` 0.1 and restructure `standard/applier.md` to 0.6, from the mapping
   above; regenerate both manifests; the checks pass.
4. Two independent reviews of both documents; fix; record them in each changelog.
5. Update `CONTEXT.md` (steward, token, latch, load), the reference scenarios' hops, the goals and
   the roadmap.
