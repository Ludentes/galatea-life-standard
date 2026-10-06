---
title: Review of the split — applier 0.6 and steward 0.1
status: draft
last_verified:
area: architecture
audience: dev
author: Galatea maintainers
related:
  - standard/applier.md
  - standard/steward.md
  - docs/specs/2026-09-24-standard-split-design.md
  - docs/reviews/2026-09-24-applier-0.5-findings.md
---

# Review of the split — applier 0.6 and steward 0.1

The text under review is commit `0c7edc4`. This record follows the `standard-review` procedure.

## Change record

Written and committed before any reader was dispatched. Directions: **stricter**, **looser**,
**moved**, **new**. "F" numbers are in `docs/reviews/2026-09-24-applier-0.5-findings.md`.

### The split itself

| Rule | Direction | Why |
|---|---|---|
| Rooms, names, aliases, groups, persons, roles, endpoints, scenarios, rules, schedules, leases, occupancy, `define`, asks: from the applier to the steward, ids kept (GA-AUTH-1, GA-PLAN-5, -6, GA-APPLY-3, GA-TIER-1…3, GA-GRP-1, GA-SCN-1…7, GA-LEASE-1…5, GA-DEF-1…4, GA-SCHED-1, GA-OCC-1) | moved | The ruling of 2026-09-24: one stateful layer above one applier |
| Levels: the applier's Scenarios and Full become Act and Safe; the steward has one level | changed | The split design, *Levels* |
| The applier resolves no names, rooms, groups or selectors; a request's `target` is a device id | stricter | Name resolution is the steward's |
| GA-PLAN-1, -2, -4, GA-APPLY-2, -4, -9, GA-EVT-2, -5, GA-LVL-1 exist at both layers: the applier keeps the ids, the steward's copies are GA-STW-1…8 | new | One id per index |
| Withdrawn: GA-SAFE-4 (replaced by GA-SAFE-8), GA-GRP-2 (exclusive groups were never defined, F14), GA-OCC-2 (no levels below Full in the steward) | removed | Listed under *Withdrawn requirements* |

### Authority (steward)

| Rule | Direction | Why |
|---|---|---|
| `via` is the endpoint's type; the client never sends it; a credential may name only the endpoints bound to it (GA-AUTH-1, reworded) | stricter | F2: the brain asserted `via` |
| The role comes from the steward's registry, capped by the endpoint's `max_role`; no person means guest (GA-AUTH-2) | stricter | F3: the client asserted the role |
| `verified` is gone | removed | F48: it gated nothing |
| A brain may name the speaker at a brain-served endpoint without a person; recorded as the brain's claim | **looser** than a registry-only identity; the same as 0.5, where the brain asserted it | Voice satellites are shared; HS16. Bounded by `max_role` and GA-TIER-1 |
| `no_voice` actions never pass through a brain, whatever the endpoint type (GA-TIER-1, reworded) | stricter | F2, G1: the model never unlocks a door |
| The confirmation dialogue: answers only from the plan's own credential and endpoint, or its `confirm_on` endpoint (GA-CONF-1) | new | F2, HS16 |
| An answer through a brain carries an utterance record, kept in history (GA-CONF-2) | new | HS16: the audit shows what the brain claims it heard |
| Tokens only for a `yes` or an authored step, bound, 60 s (GA-CONF-3) | new | The applier's backstop needs an issuer that can be tested |
| `define` only by an owner from an app endpoint not served by a brain (GA-DEF-3, reworded) | stricter | F27: authored `no_voice` laundering |
| Authored rules and scheduled runs count as confirmed by their author, and get tokens with `for` naming them (GA-SCN-4, reworded) | same as 0.5 | F4: delegated principals now travel as `for` |
| A plan-time yes stands for the whole run; tokens are issued at dispatch | new | F45 |
| `refuse(conflict)` for one target and action with different args; dispatch in request order, a selector's targets by id (GA-STW-2, GA-STW-3) | new | F44 |
| The steward's reason order (GA-STW-4): the applier's hard reasons, conflict, role, tier, already, leased, occupancy | changed | Role moved after the applier's `dead`, `duplicate_route`, `latched` |
| A `safety_rule` cause takes a `safety_rule` lease (GA-LEASE-6) | new | F9 |
| `device` and `load_cap` causes take no lease (GA-LEASE-2, reworded) | **looser** | F38: a self-changing device renewed an `external` lease without end |
| A run releases only its own leases (GA-SCN-2, reworded) | stricter | F39 |
| Vacant needs every sensor live throughout (GA-OCC-1, reworded) | stricter | F19 |
| Conditional `if` steps (GA-SCN-8); `scenario_plan` gives one step per action step (GA-SCN-6, reworded) | new | F32, F34 |
| `scenario_stop` → `not_permitted`, `ended(stopped)` (GA-SCN-9); `wait` timeouts (GA-SCN-10); a `single` start ignored returns `ignored` (GA-SCN-1) | new ids for 0.5 text | F21, F43 |
| A level-triggered rule fires once per becoming true (GA-RULE-1); held durations restart after a restart | new id; new rule | F43, F40 |
| Missed schedule runs are not run late, and are recorded (GA-SCHED-2); schedules in the home's `timezone`, with a daylight-saving rule | new | F40, F18 |
| The steward's history keeps ask, answer, lease, refused, rule_fired, scenario, schedule_missed and notice events for 7 days (GA-STW-7) | new | F11, F22, F33 |
| A safety notice is delivered before `notice_taken` (GA-NOTE-1) | new | F10 |
| `define` applies whole or not at all (GA-DEF-5) | new id for 0.5 text | F43 |
| TLS (GA-SEC-2); harness clock (GA-HARN-2) | new | F16, F35 |
| MCP tool names use `_`, not `.` | changed | F12 |

### The device (applier)

| Rule | Direction | Why |
|---|---|---|
| Clients registered through `configure`; others `not_permitted` (GA-AUTH-3) | new | The applier trusts named stewards, not principals |
| `confirm` and `no_voice` actions need a steward's token bound to target, action, args, short-lived, single-use (GA-TOKEN-1, -2) | new | The device's backstop against a steward or client that skips the ask |
| `no_voice` with `via: voice` refused at the applier too (GA-TOKEN-3) | new | Defence in depth for GA-TIER-1 |
| Socket `load`; a `heating` load's `turn_on` is `confirm`; the applier turns it off after `max_on_s` (default 4 h) with no client (GA-LOAD-2, GA-DESC-3) | new, stricter | F5, F50, HS14 |
| A gate or garage door on a momentary relay is class `gate`, so `no_voice` (GA-DESC-3 via *Default tiers*) | stricter | F28 |
| `feedback: open` devices: `assumed` state, actions end `sent`, never `already` (GA-STATE-4) | new | F6, HS12 |
| Stateless actions end `delivered` on any device, not only channels (GA-APPLY-7, reworded) | changed | F7 |
| `self_changing` keys report cause `device` (GA-EVT-6) | new | F38 |
| `late_ack` within 60 s after `failed(no_ack)` (GA-APPLY-11) | new | F38 |
| Verdicts no later than 1 s after the bound (GA-APPLY-8, GA-WIT-1, reworded) | stricter | F41 |
| `tolerance` for numeric keys (GA-EVT-3, reworded) | changed | F46 |
| Adapter's engine unreachable → `dead` within 1 s (GA-STATE-3) | new | F31 |
| Idempotency keys scoped per client; a different body is `idempotency_conflict` (GA-APPLY-4 reworded, GA-APPLY-10) | new | F13 |
| Plan steps per distinct (target, action, args); dispatch in request order (GA-PLAN-2 reworded, GA-PLAN-7) | changed, new | F34, F44 |
| Apply re-evaluates `latched` and the token too (GA-APPLY-9, reworded) | stricter | Tokens and latches are new |
| GA-APPLY-1 becomes a SHOULD, plus 300 ms per meta-applier hop | **looser** | F15: unmeasured and unmeetable over an adapter |
| Safety rules configured through `configure`; latches on their undo (GA-SAFE-7) | new | F9, run 3 of the stateful-layer research |
| GA-SAFE-2 restated: no token, tier, request or other rule refuses or undoes a running safety rule | changed | Leases are no longer the applier's |
| Notices sent after the actuations settle, never dropped, re-offered until `notice_taken` (GA-SAFE-8) | new, replaces GA-SAFE-4 | F10, F37 |
| `history` keeps state, outcome, `late_ack` and `rule_fired` for 7 days (GA-EVT-5, reworded) | stricter | F22, F33 |
| `configure` owner-only, dry run, stale revision, whole or nothing (GA-CFG-1, -2) | new | Replaces `define`'s device half; F43 |
| TLS (GA-SEC-1); harness clock (GA-HARN-1); `describe.test_run_id` | new | F16, F35, F24 |
| Meta-applier: spanning safety rules hosted there (GA-META-3, reworded) | changed | F29 |
| Meta-applier relays `rule_fired`, `route_conflict`, `late_ack` (GA-META-8, reworded) | stricter | F30 |
| Meta-applier revision follows its children (GA-META-9); it checks tokens before delegating (GA-META-10) | new | F17; adapters cannot check tokens |
| Negative subjects may also fail requirements the manifest lists as `coupled` | **looser** | F42: overlapping requirements made "exactly" impossible |
| Private references removed: the bridge chapter is `standard/bridge.md` | fixed | F1 |

## Readers, first round

Both readers got the review procedure's reader prompt unchanged, with the two standards
and this record. Their reports are summarised here, one line a finding, with their own severities.

**The third-model reader** (k3, through its CLI's read-only agent), 20 findings:
- K1 blocker: a conforming child cannot verify a token the meta-applier passes on unchanged.
- K2 blocker: the steward's `safety_rule` lease refuses, for two hours, the undo the latch lets through.
- K3 high: GA-TOKEN-3 and GA-SAFE-7 rest on `via` and `for`, which the token does not bind.
- K4 high: the token's MAC input is not serialised.
- K5 high: delegated idempotency keys collide across clients.
- K6 high: `load_cap` takes no lease, so a rule turns a capped heater straight back on (a looser rule).
- K7 medium: re-offering a notice on every `events` call contradicts the cursor.
- K8 medium: a 60 s plan expiry silently bounds how long a person has to answer.
- K9 medium: `CONTEXT.md` contradicts the split.
- K10 medium: a missing utterance record has no defined failure.
- K11 medium: used tokens are not required to survive a restart.
- K12 medium: `already` and tolerance.
- K13 medium: no freshness bound for an adapter's single unavailable device.
- K14 medium: the coupling list is unbounded and in the manifest, not the text (a looser rule).
- K15–K20 low: `ir` is `open` without an id; guessed constants gate passes; "one `route_conflict`"
  per what; a changelog phrase near a private reference; the steward's `destructiveHint`s; no
  failed-run status.

**A no-context subagent** (Claude), 26 findings:
- R1 blocker: as K1.
- R2 blocker: as K3, for `for`.
- R3 blocker: a latched undo of a `reversible` action can never get a token.
- R4 high: the steward cannot compute its reason order when the applier reports `token` above
  `already`.
- R5 high: "already used" is undefined against plan, delegation and `unreachable`.
- R6 high: as K2.
- R7 high: GA-SAFE-2 has no observable failure.
- R8 high: the `no_voice` answer's origin is untested; `confirm_on` may point at a brain.
- R9 high: a named speaker plus the brain's own answer gates `confirm` on the brain alone.
- R10 high: nothing is said about restarts.
- R11 high: as K9.
- R12 medium: as K14. R13 medium: as K5. R14 medium: as K4, plus clock skew.
- R15 medium: liveness of open-loop devices and event-only sensors.
- R16 medium: GA-LOAD-2's on-time is ambiguous; `floor_heating` and `boiler` have no cap.
- R17 medium: as K7. R18 medium: the latch condition is undefined.
- R19 medium: a spanning safety rule over an adapted child reaches around the Safe claim.
- R20 medium: GA-TOKEN-3 cannot see a brain-served chat endpoint.
- R21 medium: normative text without ids (daylight saving, held durations, the whole-run yes, the
  occupancy re-check, delegation pass-through).
- R22 medium: an `external` lease has no duration.
- R23–R26 low: GA-STATE-2's row names a child; GA-LEASE-1 leases on `applied`; a run's cause names
  no person; "id order" has no collation.

## Scenario walk, first round

A third subagent, given the review procedure's scenario prompt. Against 0.5's own grades
(12 as designed, 2 partly, 2 cannot) it found 10, 5 and 1:

| Scenario | 0.5 | Split | Why |
|---|---|---|---|
| HS1 | ✅ | ⛔ | Voice cannot add a schedule exception: `define` was app-only |
| HS4 | ✅ | ⚠️ | The safety lease blocks reopening; a slow valve's notice says "failed" |
| HS6 | ✅ | ⚠️ | Saving a scene by voice is `define`; still no vacuum |
| HS9 | ✅ if the brain is honest | ✅ | `via` comes from the endpoint |
| HS10 | ✅ | ⚠️ | Naming a lamp is `define` |
| HS12 | ⚠️ IR | ✅ | `feedback: open`, `sent`, the witness |
| HS13 | ⚠️ | ⚠️ | The fooled brain answers its own asks for the router and heater |
| HS14 | ⛔ | ✅ | The heating load, if declared |
| HS16 | ⛔ | ⚠️ | Solved only with `confirm_on` |

The rest are unchanged at ✅. Its findings:
- W1: a brain's own yes earns a token (with R9).
- W2: HS2 uses a `skipped(declined)` that does not exist; an answered ask against a re-ask at
  dispatch.
- W3: GA-STW-7 leaves out `state` and `outcome`.
- W4: leases across a steward restart.
- W5: as K2.
- W6: a 10 s ack is too short for valves, curtains and gates, and a late ack never corrects the
  notice.
- W7: an undeclared socket load stays `reversible` and uncapped.
- W8: on-time across a restart; a cap that cannot reach the plug is silent.
- W9: GA-STATE-3 has no detection bound.
- W10: per-person and per-time permissions are no longer listed as undefined.
- W11: voice edits of the house (HS1, HS6, HS10) are impossible.
- W12: the scenario document's "Governed by" column, HS8's child and HS12's wording are stale.
- W13: the steward has no latency bound.

## Ruling during the review

**The maintainer, 2026-09-24:** a brain's spoken yes is trusted for `confirm`, with a per-endpoint opt-out
(`confirm_on` an app). This answers R9 and W1 and keeps HS13 and HS16 partly driven by design.

## Change record, second round

What changed after the first readers, with directions. The second-round readers get this.

| Rule | Direction | Finding |
|---|---|---|
| Tokens bind `via`, `brain` and `for`; `brain: true` is a new request field; GA-TOKEN-3 refuses `no_voice` with `brain: true` | stricter | K3, R2, R20 |
| The meta-applier re-issues each token under its own key for a child that verifies tokens (GA-META-10) | changed | K1, R1 |
| A token is used only at dispatch, remembered across a restart until it expires (GA-TOKEN-4) | new | R5, K11 |
| The token's MAC is HMAC-SHA256 over its RFC 8785 serialisation; a 5 s expiry skew | new | K4, R14 |
| Delegated idempotency keys include the originating client | stricter | K5, R13 |
| The applier's plan step carries its effective `tier`; `token` is the last reason; the steward plans without tokens | changed | R4 |
| A latched undo's effective tier is at least `confirm`, so the steward asks for it | stricter | R3 |
| A latch declares its own condition, held until that is true with its sensors live; `latch` events | changed | R18 |
| GA-SAFE-2: a request for a device a running safety rule actuates is `refuse(safety)` | stricter | R7 |
| Notices sit in a `notices` list on every `events` response until `notice_taken`; a late ack gets a second notice | changed | K7, R17, W6 |
| Ack defaults per class: 60 s for a valve, 90 s for a cover, gate or garage door | **looser** | W6: a 10 s default failed healthy slow devices |
| A Safe applier declares a `load` on every socket (GA-DESC-8) | stricter | W7 |
| GA-LOAD-2: continuous on-time, from the first `on`, reset only by `off`, across restarts; a failed cap is a notice | stricter | R16, W8 |
| An `ir` device is `open` (GA-DESC-7) | new id | K15 |
| Report-on-change devices are live while their owner is; an adapter's unavailable device is `stale` | changed | R15, K13 |
| An adapter's engine is unreachable after 10 s unanswered (GA-STATE-3) | stricter | W9 |
| A spanning safety rule may not actuate a device of a child with a non-empty `ungoverned` (GA-META-3) | stricter | R19 |
| What survives an applier restart (GA-PERSIST-1) and a steward restart (GA-PERSIST-2) | new | R10, W4, K11 |
| The steward's `safety_rule` lease ends when the latch clears, or when an unlatched rule completes (GA-LEASE-6) | **looser** than the draft's two hours | K2, R6, W5 |
| `load_cap` and `external` changes take a `person` lease for the hold time (GA-LEASE-2) | stricter | K6, R22 |
| GA-LEASE-1 leases from dispatch | stricter | R24 |
| `confirm_on` must name an endpoint not served by a brain (GA-CONF-4) | stricter | R8 |
| A plan with an ask expires after `ask_expiry_s`, 300 s | **looser** | K8: a person asked on a phone needs longer than 60 s |
| An answer stays answered through apply; a step that becomes an ask at dispatch is `skipped(not_confirmed)` | changed | W2 |
| A missing utterance record is `invalid_request` (GA-CONF-2) | stricter | K10 |
| **`define` through a brain**: an owner or member may change names, aliases, schedule exceptions, and scenarios, rules and schedules with no `no_voice` step, after a `yes`; never persons, endpoints, credentials or home settings (GA-DEF-3) | **looser** than the draft's app-only | W11: HS1, HS6 and HS10 are voice stories, and the scenarios win. F27's laundering stays closed, because no `no_voice` step can be authored through a brain |
| Negative subjects and what each may also fail are a table in each standard, with a reason; the checker compares the manifest with it | stricter | K14, R12 |
| GA-STW-7 includes the applier's state, outcome and latch events | stricter | W3 |
| New ids for text that had none: GA-SCHED-3 (daylight saving), the whole-run yes in GA-SCN-3, the occupancy re-check in GA-SCN-7 | new ids | R21 |
| A run's cause names the person who started it; `ended(interrupted)`; `failed_steps` | new | R25, K20 |
| Code-point order of ids (GA-STW-3); one `route_conflict` per identifier (GA-META-2) | clarified | R26, K17 |
| The steward's `destructiveHint`s; GA-STW-9, a 200 ms SHOULD | new | K19, W13 |
| Per-person and per-time permissions listed as not defined | clarified | W10 |
| `CONTEXT.md` updated: steward, client, token, latch, load; applier, selector, group, rule, via, cause and principal reworded | fixed | K9, R11 |

## Readers, second round

The same prompt, both standards and this record, to the third-model reader and to a new no-context subagent.

**The third-model reader**, 18 findings:
- K21 blocker: the steward's 300 s ask cannot survive the applier's 60 s plan expiry.
- K22 blocker: GA-SAFE-7 needs the applier to read `for`, which it calls opaque.
- K23 high: `define` through a brain launders `confirm`, since authored steps count as answered (a
  looser rule).
- K24 high: the `yes` for a brain's `define` has no mechanism.
- K25 high: GA-LOAD-2's "monotonic clock that survives a restart" contradicts itself.
- K26 high: empty `notice_channels` holds a notice for ever.
- K27 high: `max_role` defaults cover two of four endpoint cases.
- K28–K34 medium:
  - GA-STATE-2 points at two bridge bounds;
  - `vacant` is unreachable for motion-only sensors;
  - re-issued token fields contradict;
  - "same body" is undefined;
  - `latch` and `ask` events have no MUST;
  - a latch clearing during `cursor_expired` strands the lease;
  - a duplicate-route device in `describe`.
- K35–K38 low: `CONTEXT.md` and the goals document drift; guessed constants gate nothing; `history`
  shapes differ; GA-APPLY-11 and tolerance.

**The no-context subagent**, 27 findings:
- R27 blocker: a safety rule with a `notify` or an IR actuation never completes.
- R28 blocker: `latch`, `model` and notices are not relayed by a meta-applier.
- R29 blocker: as K23, and a selector resolved at dispatch reaches a `no_voice` gate relay.
- R30–R33 high:
  - a Safe meta-applier over Act children;
  - the adapter token exemption against Act;
  - as K24;
  - the raised latch tier has no end, and `for` has no schema.
- R34–R44 medium:
  - as K21;
  - `brain` is missing from the request schema;
  - stateless on IR: `delivered` or `sent`;
  - declared huge `ack_within_s` or `max_on_s` pass;
  - clocks (used tokens on the wall clock, downtime, how the harness clock arrives);
  - an idle adapter never detects a dead engine;
  - a hand-turned `self_changing` key reads as `device`;
  - the steward's idempotency key to the applier;
  - `latch` events without a MUST;
  - safety rules against each other and the cap;
  - the token is no backstop against a steward.
- Lows:
  - lease holders that are not principals;
  - GA-SCN-7's skip reason;
  - a guest stopping an owner's run;
  - `late_ack` missing from the steward's history;
  - bridge id prefixes;
  - "key" is ambiguous;
  - index order;
  - uncapped `floor_heating`, `boiler` and heating air conditioners;
  - a voice endpoint's `served_by` may be null;
  - `CLAUDE.md` still says the brain talks to one applier;
  - `history`'s `targets`.

## Scenario walk, second round

11 as designed, 5 partly (HS4, HS10, HS12's air conditioner, HS13, HS16), 0 cannot. Findings:
- V1: as K24.
- V2: HS4's shared panel has no person, so it cannot reopen a latched valve.
- V3: target rooms are not in a brain's `define`.
- V4: witnesses cannot be configured, and `expect` cannot follow the args.
- V5: a fooled brain can switch off the hub's own socket (`confirm`).
- V6: a report-on-change sensor with a dead battery stays `live`.
- V7: loads move between sockets; a kettle declared `heating` means an ask every time.
- V8: an utterance time is not compared with the ask.
- V9: as GA-SCN-7's reason.
- V10: a panel with no person and its lease.
- V11: the scenarios document is stale.

## Change record, third round

| Rule | Direction | Finding |
|---|---|---|
| Work `define`d through a brain is `brain_authored`: its steps above `reversible` are `refuse(tier)` at dispatch and get no authored token (GA-DEF-7) | stricter | K23, R29 |
| `define` through a brain returns a plan with `ask(confirm_define)`, answered with `answer` and applied with `define { plan_id }` (GA-DEF-6) | new | K24, R32, V1 |
| Target rooms may be set through a brain | **looser** | V3: HS10 puts a lamp in a room by voice |
| `for` has a schema; the applier reads only whether `person` is present; the raised latch tier lasts until the undo next runs | changed | K22, R33 |
| The steward applies to its applier inline, re-planned at dispatch, keyed by `apply_id` and `step_id` (GA-STW-10) | new | K21, R34, R41 |
| A safety rule completes on `acked`, `delivered`, `sent` or `failed` (GA-SAFE-3) | changed | R27 |
| The meta-applier relays `latch` and `model` events and its children's notices, and passes `notice_taken` down only after its own client's (GA-META-8) | stricter | R28 |
| A meta-applier does not claim Safe over a socket-owning child that claims only Act (GA-META-11) | new | R30 |
| `latch` events and held latches in `state` (GA-SAFE-9); the steward re-reads them after `cursor_expired` (GA-LEASE-6) | new | K32, K33, R42 |
| `ask` events with their time (GA-CONF-5); an utterance timed before its ask is `invalid_request` (GA-CONF-2) | new, stricter | K32, V8 |
| Switching off an `infrastructure` device is `no_voice` | stricter | V5 |
| A report-on-change sensor is `live` only while it checks in within its freshness bound | stricter | V6 |
| A motion sensor that sent nothing reported no presence, so `vacant` is reachable | **looser** | K29: `vacant` was unreachable |
| GA-STATE-2 names both bridge bounds; an adapter calls its engine at least every 5 s (GA-STATE-3) | stricter | K28, R39 |
| GA-LOAD-2 counts from the wall-clock time of the first `on`, downtime included | stricter | K25, R38 |
| Used token ids are remembered 3600 s whatever the clock does (GA-TOKEN-4) | stricter | R38 |
| The harness clock is an NTP server passed as `configure.time_source` | new | R38 |
| `ack_within_s` at most 300 and `max_on_s` at most 86400; both, and witnesses, are in `configure` | stricter | R37, V4 |
| Witness `toward(arg, by)` | new | V4 |
| `notice_channels` is never empty (GA-NOTE-1) | stricter | K26 |
| `max_role` defaults for every endpoint; an app always has a person; a voice endpoint always names its brain | clarified | K27, R-low |
| A guest may not stop a run a higher role started (GA-SCN-9) | stricter | R-low |
| An unanswered ask at a run's dispatch is `skipped(not_confirmed)`; an answered one stands (GA-SCN-7) | clarified | V9 |
| Bodies compared in RFC 8785 form; re-issued tokens change `issuer` and `proof` only | clarified | K30, K31 |
| A duplicate-route device appears once, as `sid:` | clarified | K34 |
| Stateless on a `feedback: open` device ends `sent` (GA-APPLY-7); `late_ack` within tolerance | clarified | R36, K38 |
| `brain` in the applier's request schema; `history`'s `targets` optional at both layers | fixed | R35, K37 |
| An endpoint principal with no person holds `person` lease precedence; `safety_rule` and `load_cap` are named lease holders | clarified | V10, R-low |
| A hand-turned `self_changing` key reads as `device`: stated as a limitation | clarified | R40 |
| Latches and `refuse(safety)` bind requests only, not other safety rules or the cap | clarified | R43 |
| The steward's history keeps `late_ack` | stricter | R-low |
| Index rows sorted by family; bridge ids cited in full | clarified | R-low |
| The goals' "the gate" and `CONTEXT.md`'s token updated | fixed | K35 |
| The scenarios document regraded against the split, HS4's notice says «в приложении» | fixed | V2, V11 |
| Every child verifies tokens (an adapter is an applier, and Act includes tokens); the meta-applier always re-issues them (GA-META-10) | stricter | R31 |

## Readers, third round

**The third-model reader was not run.** The call was refused: "403 You've reached your weekly (7-day) usage limit."
The third round therefore has one reader, which does not meet FR-REV-01 for the third-round changes.

**The no-context subagent**, 26 findings:
- R45 blocker: a safety rule never completes when an actuation ends `unreachable` or `skipped`.
- R46–R53 high:
  - GA-SAFE-8's body against GA-SAFE-3, and a notice lost when the applier's own channel fails;
  - a latch covers one action, not the state (`set_position` gets past a latch on `open`);
  - a meta-hosted rule is bypassed through a child that has another client;
  - side effects of the applier's own action read as `external`;
  - the brain chooses the principal, so a guest can be routed through the owner's chat endpoint;
  - `define` through a brain edits the owner's own work (a looser rule);
  - notices have no identity;
  - no engine simulator and no restart hook in the harness.
- R54–R64 medium:
  - the two `for` shapes differ;
  - `brain: false` on brain-authored tokens;
  - a token's `expires` is unbounded, and used ids are not per issuer;
  - an unreachable cap is never retried, and a clock stepped back stretches it;
  - what a yes covers;
  - inline asks: `refused(tier)` or `skipped(not_confirmed)`;
  - incomplete couplings;
  - motion sensors cannot see a still person, so a sleeping room reads `vacant` (a looser rule);
  - a Safe home with an adapter child that owns sockets;
  - the steward's batching and the keys of rules and runs;
  - GA-TOKEN-4's clock under the harness.
- Lows:
  - the freshness bound is cited by the wrong rule of the earlier bridge text;
  - limits and rules without ids;
  - `issuer`, `test_run_id` and `time_source`;
  - GA-APPLY-1 as a SHOULD;
  - the kiosk extension's namespace names a closed product.

## Scenario walk, third round

13 as designed, 3 partly (HS12's air conditioner, HS13, HS16), 0 cannot, unchanged; HS12's reason
moves to the witness sensor that dies with the bridge. Findings:
- X1: a spoken schedule exception must not mark its schedule `brain_authored`.
- X2: a voice edit turns an app-authored scenario `brain_authored` (with R51).
- X3: HS2's kitchen, recently occupied, is skipped silently.
- X4: a witness needs an `unknown` verdict.
- X5: no one is told when a safety rule's sensor goes dead.
- X6: "delivers" is undefined; no retry.
- X7: a dead leak sensor holds the latch for ever.
- X8: HS3's no-neutral dimmer on power-up.
- X9: `failed_steps` is undefined.
- X10: Home Assistant booting makes curtains `stale`, not `dead`.
- X11: a fooled brain answers its own `ask(confirm_define)`.
- X12: HS12's verdict text is stale.

## Change record, fourth round

| Rule | Direction | Finding |
|---|---|---|
| A safety rule completes on any final outcome, `unreachable`, `skipped` and `refused` included (GA-SAFE-3) | changed | R45 |
| A notice has an id, is issued on completion, and stays in `notices` until named in `notice_taken`, whatever its own channel did (GA-SAFE-8); the meta-applier prefixes a child's | stricter | R46, R52 |
| A latch refuses every action changing a key the rule set; the undo after it is `no_voice`, not `confirm` | stricter | R47, R50 |
| The owner may clear a latch through `configure` (`clear_latch`), recorded | **looser** | X7: a dead sensor held the water off for ever |
| A spanning safety rule is refused over a child with another client; `describe.clients` | stricter | R48 |
| Reports on an applied target within its `ack_within_s` belong to that apply (GA-EVT-1) | changed | R49 |
| A safety rule's sensor or actuator going dead, or coming back, is a notice (GA-SAFE-10) | new | X5 |
| A witness can end `unknown` (GA-WIT-1) | new | X4 |
| `for` gains `apply`; tokens expiring more than 300 s ahead, or issued by another client, count as none; used `(issuer, token_id)` kept 3600 s of monotonic time | stricter | R54, R56, R64 |
| Brain-authored actions go with `brain: true` (GA-DEF-7) | stricter | R55 |
| The cap never counts less than monotonic time, and an unreachable cap is retried (GA-LOAD-2) | stricter | R57 |
| An answer covers only the reason it was asked for; inline asks are `refused(tier)` | clarified | R58, R59 |
| A room with motion sensors only is never `vacant` | stricter, reverses round three's looser rule | R62 |
| The steward sends one applier apply per steward apply, rule firing or run step, each keyed to survive a restart (GA-STW-10) | clarified | R63 |
| A safety notice is retried until a channel delivers it (GA-NOTE-1); `failed_steps` defined | stricter, clarified | X6, X9 |
| A schedule exception never marks its schedule `brain_authored` | clarified | X1 |
| Couplings completed; `ack_within_s` and `max_on_s` limits get GA-CFG-3; voice endpoints name a brain (GA-DEF-8); plan expiry is a MUST | new ids | R60, R-low |
| Freshness cited by the right rule; `vendor.kiosk`; `time_source` only under the harness; the harness has an engine simulator and a restart hook | fixed | R-low, R53 |

## Ruling during the review, second

**The maintainer, 2026-09-24**, on what a brain may `define`: "Not sure this is standard worthy. This reads
as either shooting yourself in the foot for future applications or leaving a security hole. Only
real life applications can judge what is what so standardizing one of the failure modes seems
premature."

| Rule | Direction | Finding |
|---|---|---|
| Which `define` change sets a steward accepts through a brain, and from whom, is the steward's policy, listed as not defined. The standard keeps only the floors: asked first (GA-DEF-6), `brain_authored`, with every step above `reversible` refused (GA-DEF-7), and never persons, endpoints, credentials or the home's settings (GA-DEF-3) | removed | R51, X2, X11, by ruling |

## Readers, fourth round

By the maintainer's instruction ("Review with a subagent"), two subagent readers read the text at
`01d4084`: one on the default Claude model and one on Sonnet. The third-model reader was then run as a third reader,
through the office API key and the read-only `kimi-ticket-reader` agent (the maintainer: "Take the key from
… KIMI_OFFICE"). All three used the unchanged reader prompt.

**The third-model reader**, 13 findings:
- K39 blocker: the *Steps* table raises a latched undo to `confirm`, while the latch rule says
  `no_voice`.
- K40 blocker: GA-STW-4 says the applier's `token` reason "is never reported", but the applier
  reports `refuse(token)` for every unanswered step, and nothing maps it to an ask.
- K41 high: GA-META-3 is checked only at `configure`.
- K42 high: `external` leases let a chattering device starve every rule.
- K43–K47 medium:
  - monotonic retention against the harness clock;
  - how `test_run_id` reaches the subject;
  - GA-META-5 trusts the child's own report;
  - two safety rules on one device;
  - notices as an unbounded queue.
- K48–K53 low:
  - `history` targets for `rule_fired` and `latch`;
  - `dry_run` with a stale revision;
  - a run's `via`;
  - overlapping applies in the ack window;
  - the witness's start point;
  - the goals' open items stale.

**The Claude reader, default model**, 21 findings, no blocker:
- Q1–Q5 high:
  - as K39;
  - the ack-window attribution swallows hand changes and safety causes;
  - a capped heater that fails to turn off is not retried;
  - retries with fresh tokens conflict with idempotency;
  - a named speaker lifts a guest to member.
- Q6–Q21 medium:
  - occupancy by last report, not current value;
  - the witness's start point and a missing `unknown` outcome;
  - index rows without an RFC keyword in the body;
  - GA-LVL-1 cannot fail;
  - harness plumbing;
  - state lost across a restart;
  - a meta-applier's children's latches;
  - as K41;
  - flag changes lower tiers;
  - no safe default load;
  - safety rule firing and opposition;
  - couplings;
  - notices on `sent` channels and taken by any client;
  - the token claim overstated;
  - `stale` without an id;
  - runs started by a rule.
- Lows:
  - `max_role` overlap;
  - merged steps with different `for`;
  - GA-PLAN-7 across children;
  - GA-SEC-1's scope;
  - `clear_latch`'s record;
  - a whole-run yes across hours;
  - the `define` ruling recorded as "removed" though it is looser;
  - GA-APPLY-1 unmeasured;
  - `CLAUDE.md` drift;
  - `CONTEXT.md`'s token.

**The Claude reader, Sonnet**, 5 findings, no blocker:
- S1 high: `via` for rule and schedule actions.
- S2 medium: the completeness of an adapter's `ungoverned` has no id, and is untestable.
- S3 medium: a load cap against a safety rule on one circuit.
- S4 low: the steward text does not point at the applier's trust boundary.
- S5 low: an Act applier still has uncapped heating sockets.

## Scenario walk, fourth round

11 as designed, 5 partly (HS1, HS6 and HS10 now depend on each steward's `define` policy; HS12's
air conditioner; HS13; HS16), 0 cannot. Findings:
- Y1: the `define` hops cite text that was removed.
- Y2: no `define` event and no record of a suppressed run.
- Y3: HS2 has five asks, not three, now that motion-only rooms are never `vacant`.
- Y4: HS4 cites the old completion rule.
- Y5: as K39.
- Y6: the brain picks the endpoint, and so the role.
- Y7: `confirm_on` can be sidestepped through a sibling endpoint.
- Y8: the ack window swallows a contrary outside change and invites a flip-flop reissue.
- Y9: Home Assistant booting (as X10).
- Y10: HS12's witness ends `unknown`.
- Y11: HS16's delegation text is stale.
- Y12: HS3's no-neutral dimmer (as X8).

## Change record, fifth round

| Rule | Direction | Finding |
|---|---|---|
| A latched undo's effective tier is `no_voice` in the *Steps* table too | fixed | K39, Q1, Y5 |
| The steward reports the applier's `refuse(token)` on an unanswered step as `ask(confirm_tier)` or `refuse(tier)` (GA-STW-4) | fixed | K40 |
| A report is an apply's only while it moves towards the action's value, until it matches or `ack_within_s` passes; one moving away is `external`; safety and cap causes keep theirs; no idempotent reissue after a contrary report (GA-EVT-1, *Reissue*) | stricter | Q2, Y8, K51 |
| A cap turn-off is retried until the socket reports `off`; a safety rule does not hold a heating load on against its cap (GA-LOAD-2) | stricter | Q3, S3 |
| Idempotent bodies are compared without tokens | changed | Q4 |
| An `occupancy` sensor counts by its current value | changed | Q6 |
| A witness counts from dispatch; `unknown` is an outcome | clarified | Q7, K52 |
| Every index row is normative at its level | clarified | Q8 |
| GA-LVL-1 covers `configure` changes needing a level not claimed | stricter | Q9 |
| Harness plumbing: `test_run_id` in simulated bridge status and engine greeting; harness time includes elapsed time; `time_source` refused outside the harness (GA-HARN-1) | clarified | Q10, K43, K44 |
| Incomplete safety rules, ack deadlines and held outcomes survive a restart (GA-PERSIST-1); used tokens kept to a persisted deadline (GA-TOKEN-4) | stricter | Q11, K43 |
| A meta-applier lists its children's latches, and disables a hosted rule with a notice when a child later gains a client or an `ungoverned` entry (GA-META-3) | stricter | Q12, Q13, K41 |
| Changing a load or `infrastructure` changes the device, and its tier follows; an unconfigured socket counts as `heating` (GA-DESC-8) | stricter | Q14, Q15 |
| A safety rule fires once per trigger; opposing rules are refused (GA-SAFE-11) | new | Q16, K46 |
| Couplings of `never-fails-a-silent-ack` corrected | fixed | Q17 |
| Notices accept `sent` on channels without receipts; liveness notices coalesce per rule and device (GA-NOTE-1, GA-SAFE-10) | changed | Q18, K47 |
| The token's claim restated: it catches a steward that skips an ask, not a compromised one; a brain is never the applier's client | clarified | Q19 |
| `stale` gets an id and a declared bound for other devices (GA-STATE-5, `fresh_s`) | new | Q20 |
| Runs started by a rule act as the rule; `via` for rules, schedules and runs (GA-AUTH-5) | new | Q21, S1, K50 |
| A device an engine has not loaded after its restart is `dead` (GA-STATE-3) | stricter | Y9, X10 |
| A brain credential may carry `confirm_on` for all its endpoints | new | Y7 |
| `define` and `schedule_skipped` events (GA-STW-7) | new | Y2 |
| `max_role` defaults ordered; merged steps include `for` and token; GA-PLAN-7 per child; GA-SEC-1's scope and certificate validation; revision checked before `dry_run`; `history` matches rule events by actuated devices | clarified | Q-lows, K48, K49 |
| The adapter's `ungoverned` completeness marked *not checked by the harness*; the steward points at the applier's trust boundary | clarified | S2, S4 |
| The goals' open items and `CONTEXT.md`'s token updated | fixed | K53, Q-low |
| The second ruling's row, marked "removed", is **looser**: a steward may now accept any `define` through a brain its policy allows, including edits of owner-authored work, bounded by GA-DEF-3, GA-DEF-6 and GA-DEF-7 | correction | Q-low |

## Disposition

**Fixed.** Every finding named in a change-record row above is fixed, at the commit that carries
that row: first round `8329ced`, second `458bd94`, third `aca4877`, the second ruling `01d4084`,
fifth the commit that carries this section. The 0.5 register (F1–F50) is disposed in the table
after this list. The rest are these:

| Finding | Disposition | Why, and where it is tracked |
|---|---|---|
| R9, W1, Y6, Q5, R50 (a brain's yes, a speaker it names, the endpoint it picks) | deferred by ruling | The maintainer, 2026-09-24: a brain is trusted for `confirm`, with `confirm_on` as the opt-out; `no_voice` never passes through a brain. Whether a brain can prove what it heard, and who spoke, is carried to the brain standard |
| W11, X2, X11, R51 (what a brain may `define`) | deferred by ruling | Steward policy, bounded by GA-DEF-3, GA-DEF-6 and GA-DEF-7; to be settled by real use |
| R16, S5, and the round-two low on heating classes (`floor_heating`, `boiler`, an air conditioner heating; uncapped sockets on an Act applier) | deferred | These rely on their own thermostats; an Act applier makes no safety claim. Listed in the goals' *Open items* |
| V7 (a heater moved to a socket declared otherwise; a kettle declared `heating` means an ask each time) | deferred | Needs metering data from real sockets; the goals' *Open items* |
| R40 (a hand-turned `self_changing` key reads as `device`) | deferred | Stated as a limitation in *Causes*; a device that reports who turned it would fix it, and none in the home kit does |
| L4, Q-low (GA-APPLY-1 is a SHOULD, unmeasured) | deferred | Measured when the reference applier runs, in the roadmap's *The standard, runnable* |
| Q-low (a whole-run yes across hours of `delay`) | deferred | Runs are authored; a bound needs real routines to set. Next steward minor version |
| K42 (a chattering device starves rules through `external` leases) | rejected | A device that keeps changing is being changed, by a person or a fault; holding rules off is the safe side. A device that changes itself is declared `self_changing`, which takes no lease (GA-LEASE-2) |
| K45 (GA-META-5 trusts the child's `descendants`) | rejected | Children are registered by the owner through `configure` (GA-CFG-1); a child that lies about its descendants is a misconfigured owner's device, not an attacker the standard defends against. Relayed events cannot be used to detect a cycle, because GA-META-8 requires the meta-applier's own cause on them |
| X3, X8, Y1, Y3, Y4, Y10, Y11, Y12 (scenario text) | fixed | The scenarios document, version 4 |
| `CLAUDE.md` still says the brain talks to one applier, names HS1–HS12, and shows the manifest check for one standard | deferred | `CLAUDE.md` holds the maintainer's rulings; the edit is proposed to him, not made here |
| R23 (GA-STATE-2's row names a child) | fixed | `458bd94`: the row now names the bridge's bounds only; children are GA-META-7 |
| R44 (the token is no backstop against a steward) | fixed | This commit: *What the applier trusts* says so (with Q19) |
| R61 (a Safe home over an adapter child that owns sockets) | deferred | GA-META-11 keeps a meta-applier over such a child at Act; the flat's leak rule and heater cap live in its conforming child, which can claim Safe. Revisit when the house is built |
| K12 (`already` and tolerance) | fixed | `8329ced`: *Reason order* evaluates `already` within the declared `tolerance` |
| K16, K36 (guessed constants gate a pass) | fixed | `8329ced`: `ack_within_s` and `max_on_s` are declared per device and the harness uses the declared value; GA-CFG-3 bounds them |
| K18 (a changelog phrase near a private reference) | fixed | `8329ced`: the 0.5 row says "after a gate derivation" |
| W12, X12 (the scenarios document is stale) | fixed | `8cb5bfc` (version 3) and version 4 |
| The third round had one reader (the third-model reader's quota) | recorded | The fourth round had three, the third-model reader included, on the text after the third round's fixes |

## Disposition of the 0.5 register

Every finding in `docs/reviews/2026-09-24-applier-0.5-findings.md`. "Fixed" means fixed in the
commits of this review (`0c7edc4` to this one), at the rule named.

| # | Severity | Disposition |
|---|---|---|
| F1 | blocker | fixed: the bridge chapter is `standard/bridge.md`; no private path in either standard |
| F2 | blocker | fixed: `via` and `brain` come from the endpoint (GA-AUTH-1); `no_voice` never passes through a brain (GA-TIER-1); answers only from the asking endpoint (GA-CONF-1). The brain's yes for `confirm` is trusted by ruling, with `confirm_on` as the opt-out |
| F3 | blocker | fixed: roles come from the steward's registry, capped by the endpoint (GA-AUTH-2) |
| F4 | blocker | fixed: delegation carries `for`, bound into tokens; the applier knows no principals |
| F5 | blocker | fixed: socket `load`, `confirm` to turn a heating load on, the cap (GA-LOAD-2, GA-DESC-8) |
| F6 | high | fixed: `feedback: open`, `sent`, `assumed` (GA-STATE-4, GA-DESC-7); a physical remote's change stays invisible, graded ⚠️ in HS12 |
| F7 | high | fixed: GA-APPLY-7 applies to any device |
| F8 | high | fixed: engines' own changes are `external`, `self_changing` keys `device` (GA-EVT-6); safety rule ids namespaced (GA-META-8) |
| F9 | high | fixed: `safety_rule` lease (GA-LEASE-6) and latches (GA-SAFE-7) |
| F10 | high | fixed: GA-SAFE-8, GA-NOTE-1 |
| F11 | medium | fixed: GA-STW-7 |
| F12 | medium | fixed: tool names use `_` |
| F13 | medium | fixed: GA-APPLY-4, GA-APPLY-10, GA-STW-6 |
| F14 | medium | fixed: GA-GRP-2 withdrawn |
| F15 | medium | fixed: GA-APPLY-1 is a SHOULD with a per-hop allowance |
| F16 | medium | fixed: GA-SEC-1, GA-SEC-2 |
| F17 | medium | fixed: GA-META-9 |
| F18 | low | fixed: the home's `timezone`, GA-SCHED-3, RFC 3339 times |
| F19 | low | fixed: `vacant` needs live sensors, and a silent motion sensor reported no presence (GA-OCC-1) |
| F20 | low | fixed: the text was rewritten, and every id cited is checked |
| F21 | low | fixed: `ended(stopped)`, `ignored` (GA-SCN-9, GA-SCN-1) |
| F22 | low | fixed: 7 days at both layers (GA-EVT-5, GA-STW-7) |
| F23 | low | fixed: no "candidate", no lowercase "must" |
| F24 | low | fixed: `describe.test_run_id` |
| F25 | low | fixed: the checker fails a MUST without an id; none remains |
| F26 | low | deferred: a vacuum is a vocabulary addition for a later minor version; HS6 stays ✅ without it |
| F27 | blocker | fixed: `define` by an owner outside a brain; through a brain only limited change sets, asked first, and `brain_authored` steps above `reversible` refused (GA-DEF-3, GA-DEF-6, GA-DEF-7) |
| F28 | blocker | fixed: class `gate` on a relay is `no_voice` (*Default tiers*) |
| F29 | high | fixed: GA-META-3 hosts spanning rules |
| F30 | high | fixed: GA-META-8 relays `rule_fired`, `route_conflict`, `latch`, notices |
| F31 | high | fixed: GA-STATE-3 |
| F32 | high | fixed: `if` steps (GA-SCN-8) |
| F33 | high | fixed: `refused` and `rule_fired` in the steward's history; 7 days |
| F34 | high | fixed: one step per action step (GA-SCN-6); `already` re-checked at dispatch (GA-SCN-7) |
| F35 | high | fixed: GA-HARN-1, GA-HARN-2, `configure.time_source` |
| F36 | medium | fixed: rooms are the steward's |
| F37 | medium | fixed: GA-SAFE-8 waits for the actuations to settle |
| F38 | medium | fixed: `device` cause, `late_ack` (GA-EVT-6, GA-APPLY-11) |
| F39 | medium | fixed: a run releases only its own leases (GA-SCN-2) |
| F40 | medium | fixed: GA-SCHED-2; held durations restart (GA-PERSIST-2) |
| F41 | medium | fixed: 1 s bounds in GA-APPLY-8 and GA-WIT-1 |
| F42 | medium | fixed: *Negative subjects* tables, with what each may also fail and why, checked against the manifests |
| F43 | medium | fixed: GA-SCN-9, GA-SCN-10, GA-RULE-1, GA-DEF-5, GA-CFG-2 |
| F44 | medium | fixed: GA-STW-2, GA-STW-3, GA-PLAN-2, GA-PLAN-7 |
| F45 | medium | fixed: a yes stands for the whole run (GA-SCN-3) |
| F46 | medium | fixed: `tolerance` |
| F47 | low | fixed: `CONTEXT.md` updated for the split |
| F48 | low | fixed: `verified` removed |
| F49 | low | fixed: the scenarios document, version 3 |
| F50 | low | fixed: by the declared load (F5) |

## Verdict

**PASS**, 2026-09-24, for applier 0.6 and steward 0.1, both still `status: draft`.

| Condition | Met |
|---|---|
| Pass 1 green on the final text | yes: `check_manifest.py`, the 30 unit tests and both greps, after the last fix |
| Both readers dispatched | yes: the third-model reader (rounds 1, 2 and 4) and no-context Claude subagents (rounds 1 to 4, one on Sonnet in round 4). Round 3 had no third-model reader (quota); round 4 read the text after round 3's fixes |
| Scenario walk done | yes, in each of the four rounds; the last graded 11 as designed, 5 partly, 0 cannot, and version 4 of the scenarios document regrades 13, 3 and 0 on its stated scope |
| No blocker open | yes: every blocker of every round is fixed (R1–R3, K1–K2, R27–R29, K21–K22, R45, K39–K40) |
| Every finding disposed | yes: about 190 numbered findings across four rounds, 2 rejected, 14 deferred (9 of them by the maintainer's two rulings), the rest fixed; F1–F50 of the 0.5 register, 49 fixed and 1 deferred |

What the verdict does not say: the readers kept finding new issues in every round, down to no
blocker from two of three readers in the fourth. A fifth round would find more. The standards are
drafts that no implementation has yet tested; the harness and the reference applier are what will
test them next.
