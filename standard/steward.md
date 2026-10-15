---
title: The Galatea steward standard
status: draft
last_verified:
area: architecture
audience: dev
author: Galatea maintainers
version: 0.13
related:
  - standard/applier.md
  - standard/brain.md
  - standard/voice.md
  - docs/specs/2026-09-24-standard-split-design.md
  - conformance/steward-requirements.json
  - CONTEXT.md
  - docs/reviews/2026-10-06-bridge-0.6-applier-0.15.md
  - docs/reviews/2026-10-07-steward-0.11.md
  - docs/reviews/2026-10-12-steward-0.12.md
  - docs/reviews/2026-10-13-steward-0.13.md
  - docs/research/2026-10-12-manual-hold-time.md
---

# The Galatea steward standard

## Changelog

| Date | Version | Change |
|---|---|---|
| 2026-10-13 | 0.13 (passed review 2026-10-13) | The owner passes a person's hold, by the maintainer's ruling of 2026-10-13, out of first light's FL-GAP-6 (change record `docs/reviews/2026-10-13-steward-0.13.md`): the owner's work (a rule's action, a scheduled run's or a rule-started run's step, not `brain_authored` for the device) passes every person's hold once its floor has passed, where a switch covers it: a rule's `passes_holds`, a target's `owner_work_passes_holds`, or the home `hold`'s `owner_work_passes_holds`, all three implemented by every steward (GA-LEASE-12, new); the hold stays, keeps its end and is not ended, and the step takes no lease; no switch passes a `safety_rule`, `load_cap` or run's lease, and no `brain_authored` work passes; GA-LEASE-10's guest pass kept as a special case; a press rule's own actions stay a press (GA-LEASE-1, GA-LEASE-3, GA-LEASE-7, GA-LEASE-8, GA-LEASE-9, GA-LEASE-10, GA-SCN-2, GA-DEF-3 and GA-DEF-7 amended; the rule's and the target's shapes in *Change sets*). From review round 1: through a brain no switch is set, cleared or deleted, `not_permitted` at the call before any plan, the whole change set; the rule's switch follows the `run`-step chain; a passing step records `passed_hold: { holder, switch }` on its outcome (and a run's plan step), left out for a reader a personal press is withheld from; a run's lease at a passed hold's end comes before GA-LEASE-4's re-evaluation; the pinned policy pins `presence_renews` true and every other flag false; GA-LEASE-11's "whoever sends it" excepts a `brain_authored` step. From round 2: for passing, the floor also ends at the device's report of the value the person's step set; a run passes a replacing hold and never retakes a replaced lease; `passed_hold` never on a narrowing or a press; a flag's `false` always accepted; and, by the maintainer's ruling of 2026-10-13, the home's switch never passes a step that would undo a narrowing (`lock.unlock`, `valve.open`, a valve's `opens_with`), which only a rule's or a device's switch passes. Twenty-six negative subjects. The schemas carry the switches and `passed_hold` (package 0.1.6). **Review: PASS**, 2026-10-13, two rounds: round 1 with two readers (Kimi and a no-context Claude reader) and a scenario walk, round 2 with the no-context Claude reader only, Kimi skipped by the maintainer; neither round had a blocker, so the review ended after round 2 (the stopping rule) and round 2's fixes were not re-read; 47 findings, 43 fixed, 4 deferred, 0 rejected (`docs/reviews/2026-10-13-steward-0.13.md`) |
| 2026-10-12 | 0.12 (passed review 2026-10-12) | How a person's hold ends, by the maintainer's ruling of 2026-10-12 (the workshop's research note on manual hold time; change record `docs/reviews/2026-10-12-steward-0.12.md`): the quiet-room rule. A person's lease (GA-LEASE-1, an `external` change's GA-LEASE-2) ends once the device's room has been quiet for a window counted from the later of the change and the last presence, sooner when the room becomes `vacant`, with a fixed window for a device with no room or presence source, the windows possibly differing after an on, an off and any other change, and a floor from dispatch to the ack or the late-ack window (GA-LEASE-7, new); the steward declares the policy in `describe` as the home's `hold`, which the owner sets, every window of 1 s or more accepted (GA-LEASE-8, new); `hold_time_s` and its 7200 s default are gone; a `load_cap` lease ends its own window, `load_cap_s`, after the change; a hold keeps its quiet across a restart (GA-PERSIST-2); a `lease` event names how a hold ended; the renewable-lease gap restated to include presence, and stillness stated as a known limitation. From review round 1: the quiet window counts from the moment the room last became quiet, a held `true` busy until it clears; the floor bounds only the policy's own ends and not `unreachable`; the change's time, rooms and sources judged as of now, elapsed time; the heater's guard on its own `load_cap_s`; `expires` while busy; a press replaces a hold only at dispatch, a `brain_authored` step of it at `rule` precedence per device, its holder a principal naming the reported value; the press's residue stated. From review round 2: a press passes only a person's hold, a `load_cap`, safety or run lease refusing it; an optional declared `cap_s`; the change's time on the steward's clock; a room whose sources are all not `live` takes `fixed_s`; `schedule_ends` only at dispatch and never for `brain_authored` runs; removal, unadoption and `internal` end a hold; the pinned policy stated once; the floor ends at any success; `expires` never before the floor. And, by the maintainer's ruling of 2026-10-12, only a change to a key one of the device's actions sets, on an adopted device, takes a hold (GA-LEASE-2): sensor readings, sensor keys on actuators and devices not adopted take none; and a steward MAY, declaring `owner_work_passes_guest_holds`, let the owner's rules and schedules through a guest's hold (GA-LEASE-10, new); and a narrowing action (`lock.lock`, `valve.close`, an `onoff` valve's closing action) is never refused by a person's hold and takes none, as `session.lock` (GA-LEASE-11, new; GA-LEASE-1, GA-LEASE-3 amended). The schemas follow in the build. The constant `hold-time-default` stays only for the harness until it reads `home.hold`. And HS35, by the maintainer's ruling of 2026-10-12 ("Yes for physical press"): a rule whose `occurrence` trigger its author marks `press: true` acts for its own device actions at `person` precedence, replacing a person's hold and taking a fresh one, while staying the rule's for `via`, `for`, its author's confirmation and the applier's gate; a `brain_authored` one acts as a rule (GA-LEASE-9, new; GA-LEASE-5 amended; the trigger's `press`). From review rounds 3 and 4: `cap_s` `0` for none, never before the floor; a narrowing action replaces no person's hold and ends a lower lease it displaces, taking none; a press replaces a guest's hold, and one ending `unreachable` restores the hold it replaced; a guest's hold is passed only after its floor, and a run takes no lease on a device while a guest's hold stands; a scheduled step inside the floor is refused and ends nothing; vacancy judged continuously; gap times clamped; the `fixed_s` anchor; a hold ends within the hold end lateness (2 s, a guess); the harness sets flags through `define`; `last_presence` renamed `quiet_since`. **Review: PASS**, 2026-10-12, four rounds with two readers each (Kimi and a no-context Claude reader) and a scenario walk each; rounds 1 to 3 had blockers and round 4 had one, fixed; the review was ended after round 4 on the maintainer's ruling, so round 4's fixes were not re-read; 144 findings, 138 fixed, 3 deferred, 3 rejected (`docs/reviews/2026-10-12-steward-0.12.md`). The frontmatter version went to 0.12 in the build PR, after the harness rework (C3-M8); the *Constants* row `Hold time, default`, kept for the harness, was removed with its rework |
| 2026-10-11 | — | Editorial, for applier 0.16 (change record `docs/reviews/2026-10-11-applier-0.16.md`): *Tiers and confirmation* says the owner may lower a tier back to the applier's floor, not only raise it; no requirement changed |
| 2026-10-07 | 0.11 | Where the reference build departed from the text, by the maintainer's rulings: open plans survive a restart only with an `ask` step, a lost plan being `unknown_plan` (GA-PERSIST-2); a steward MAY replay a state edge from a gap once, within the `edge_replay_s` it states in `describe` (at most 300 s), its conditions judged now, the gap defined for restarts too (GA-RULE-1); it MAY coalesce the `skipped(occupancy_unknown)` notice per rule and room while the room stays unknown (GA-RULE-8); a lease's end re-evaluates only the rules it refused, a replaced lease handing them on (GA-LEASE-4); a latchless safety lease MAY end after the `safety_lease_s` it states, no shorter than its actuation's `ack_within_s` plus the late-ack window (GA-LEASE-6); `scenario_stop` of a run no person started is never a visitor's (GA-SCN-9). `notice_channels` may be empty until first set, then never empty; notices are held until a channel exists and kept across restarts, `describe` counts them, and a channel that stops qualifying is noticed (GA-DEF-8, GA-NOTE-1, GA-NOTE-4, GA-PERSIST-2). The `ask` event carries the asked steps, to readers who may see the plan, personal values withheld (GA-CONF-5, GA-AUTH-7). The shapes the shared schemas held as provisional are written in and bind (*Change sets*, GA-DEF-13; every upsert merges, GA-DEF-14), with a step's `brain_authored` and `answer`, the `confirm_define` step, `define`'s `skipped` and `no_notify_channel`, and `describe`'s `persons`; from the maintainer's walk of the deferred items, a held duration holds afresh after a restart before its rule fires (GA-RULE-1), GA-RULE-7's bound past 300 s is `ack_within_s` plus 60 s, the `define` event's diff goes only to the readers an ask's `steps` would (GA-STW-7), one record answers one plan, the harness checks GA-NOTE-1 at 7 stepped days, and renewable leases are a known gap. Reviewed in `docs/reviews/2026-10-07-steward-0.11.md`: two rounds, each of two readers (Kimi; a no-context Claude reader) and a scenario walk; round 1 found blockers, round 2 none, so round 2's fixes were not re-read (the stopping rule); 89 finding rows, 80 fixed, 8 deferred (to 0.12 and the backlog's *Measurement*), 1 recorded with no text change, 0 rejected; the deferred items walked by the maintainer on 2026-10-07. **PASS** 2026-10-07 |
| 2026-10-06 | — | Editorial: private references removed for publication; no requirement changed. Decisions once credited to another system now state what was decided and why; links to documents that are not public are reworded |
| 2026-10-06 | 0.10 | For applier 0.15 and bridge 0.6, from the Zigbee bridge's live bench run: a `live` motion sensor reading motion now keeps its room occupied, as a PIR holding `true` does (GA-OCC-1, the maintainer's ruling); `define` refuses a trigger or condition on a key its device does not declare, its `data` naming the key, the device and whether its bridge awaits it (GA-DEF-12, a partial guard); the applier's `undescribed` event relayed and kept; the vocabulary's `contact` is now `opening`. Reviewed with the `standard-review` procedure in five rounds (change record `docs/reviews/2026-10-06-bridge-0.6-applier-0.15.md`): Kimi (k3) and a no-context Claude reader, and a scenario walk each round; 183 findings: 151 fixed (round 5's highs not re-read, by the stopping rule), 24 deferred to the backlog, 6 no change, 2 rejected; the maintainer's rulings of 2026-10-06 on held-back keys (numeric only), kept settings (A), GA-OCC-1 (a motion sensor reading motion now) and cross-topic order (applier 0.16). **PASS** 2026-10-06 |
| 2026-10-01 | 0.9 | For applier 0.14 (change record `docs/reviews/2026-10-01-bridge-0.5-applier-0.14.md`): the owner may lower any extension action's tier to its floor, not only a plugin's, as the applier's extension row now covers a bridge's own extensions; the applier's `occurrence` events relayed and kept in `history`, a personal key's excepted, and withheld from a guest or visitor as its `state` events are (GA-STW-7, GA-AUTH-7 amended). Reviewed in `docs/reviews/2026-10-01-bridge-0.5-applier-0.14.md`: one round of two readers (Kimi `k3`; Claude, no context) and a scenario walk (no grade changed); 30 finding rows, 26 fixed (one in part), 3 deferred, 1 rejected; no blocker; round 1's fixes not re-read by a further round (the stopping rule); **PASS** 2026-10-01 (the maintainer, after walking the deferred items) |
| 2026-09-28 | 0.8 | The MCP binding is pinned to protocol revision `2026-07-28`: the steward serves it to every caller and reaches its applier at it where served, answering and falling back to `2025-06-18` and `2025-11-25` only (GA-BIND-2, new, with `speaks-only-2025` and `calls-its-applier-at-2025`); *Conformance* says which revisions the harness offers. Reviewed in `docs/reviews/2026-09-28-mcp-revision-pin.md`: two rounds, each of a third-model reader (Kimi) and a no-context Claude reader, with a scenario walk; round 1 found one blocker (fixed), round 2 none. **PASS** 2026-09-28 (the maintainer, confirmed at the merge, 2026-09-28); round 2's fixes were not re-read. |
| 2026-09-27 | 0.7 | Personal values withheld from a `visitor` as from a `guest` (GA-AUTH-7, a seam of the voice and PC merge); `speech` excepted from GA-STW-7's 7-day row, as the prose already said. Reviewed in `docs/reviews/2026-09-27-post-merge.md`, the post-merge review of voice 0.1, brain 0.5, steward 0.6, applier 0.11 and bridge 0.4: three rounds, each of a third-model reader (Kimi) and a no-context Claude reader, with a scenario walk; round 1 found two blockers, round 2 one more (fixed), round 3 none. The additions for adapters (an applier's own extensions, playback) were written in rounds 1 and 2 and taken out again before the bump, for the adapter design. **PASS** 2026-09-27 (the maintainer, after round 3, whose three fixes were not re-read, by the maintainer's stopping rule). |
| 2026-09-27 | 0.6 | For the voice front (`standard/voice.md`), on top of 0.5's home PCs: *Listening*: the voice record on an endpoint, `narrow` and narrowings (GA-LISTEN-1), notices on effective listening (GA-LISTEN-2), `zone_sources` (GA-LISTEN-3), announcements checked for wake words and, while an ask is open, answer words (GA-LISTEN-4), ducking (GA-LISTEN-5); the front credential (GA-AUTH-8); the `visitor` role; `other_wake_words`, `answer_words` and `audio_retention_s` on the home; the utterance record with `addressed_by` and `asked_by` (GA-CONF-2) and the follow-up and skill gate (GA-CONF-6); GA-DEF-8 for voice endpoints. Ruled residue: a principal's misspelled announced yes. Passed review on its own branch as 0.5 (`docs/reviews/2026-09-25-voice-0.1.md`, eleven rounds, PASS 2026-09-25); renumbered for the merge onto 0.5 (its GA-AUTH-6 is GA-AUTH-8) and read with it in that record's round 12, which times answers from the latest `ask` event for their step (GA-CONF-2), opens a run's re-asked toggle for `ask_expiry_s` (GA-LISTEN-4), shows the front each endpoint's `type`, `person` and `served_by` (GA-AUTH-8), ducks only a `reversible`, non-toggling target and never asks (GA-LISTEN-5), gives a narrowing its cause, and counts `speech` as personal. **PASS** 2026-09-27 (the maintainer, after round 12, whose fixes were not re-read by the round's scope). |
| 2026-09-27 | 0.5 | Home PCs, from the approved PC design (`docs/specs/2026-09-25-pc-design.md`, revision 5; change record `docs/reviews/2026-09-25-pc-standards.md`), against applier 0.10: a computer's `account_persons` map its account tokens to persons, apart from the applier's `accounts`, and a lock may name a person (GA-DEF-11, GA-STW-11); `session.lock` takes no lease and is never refused by one (GA-LEASE-1, GA-LEASE-3 amended); a session in use is occupancy for a computer's sleep and shutdown, `ask(in_use)` and `ask(in_use_unknown)` (GA-OCC-3; GA-STW-4 and GA-SCN-4 amended), counted by `scenario_status` as `occupied` and `occupancy_unknown` are (GA-SCN-11); reads name an endpoint and a speaker, and personal values are withheld from a guest and from a brain's read naming no endpoint, wherever they appear (GA-AUTH-6, GA-AUTH-7); `notify`'s `from` set by the steward on every dispatch to an applier of 0.10 or later, marked `brain_authored` for a brain's standing order, a caller's overwritten (GA-NOTE-2); `internal` devices out of selectors and groups (GA-PLAN-6 amended) and refused in rooms, groups and authored actions (GA-DEF-10); rules gain a time window, `not_in`, rules of conditions only, exceptions, and a retry of a rule's idempotent action that did not land (GA-RULE-3 to 7); every outcome returned carries its `time` (GA-STW-12). By the maintainer's rulings of 2026-09-27: the applier's `refuse(toggle_only)` is `ask(toggle_only)`, which an author's confirmation never answers, `skip(toggle_only)` in authored work and a failed step (GA-STW-4, GA-SCN-4, GA-SCN-11 amended); no condition holds on an `assumed` value (GA-RULE-2, GA-SCN-8 amended); GA-RULE-8's notice after `failed(no_ack)` waits out the late-ack window (GA-RULE-8 amended); from the review, `ask(toggle_only)` always asked in its own words, a yes to it in a person-started run standing for `ask_expiry_s`, a run's cause carrying its starting endpoint (GA-SCN-3 amended), an `if` on an assumed value `skipped(assumed)`, one notice at `define` for a rule or schedule that acts on a toggle, and GA-RULE-8's notice at once on `failed(no_graphical_session)`; open-loop devices kept as a known limitation, stated in *What this standard does not define*. Added by the review, among the ids above: a notice when a mapped account token leaves a computer's `accounts` (GA-NOTE-3 new), `ask(in_use)` before `ask(confirm_tier)` for a computer's sleep or shutdown. Reviewed in `docs/reviews/2026-09-25-pc-standards.md`: eleven rounds of two readers (Claude Opus; Claude Sonnet; a third-model reader skipped by the maintainer's ruling) and a scenario walk in each; 317 finding rows, 300 fixed, 10 deferred, 6 rejected, 1 recorded with no text change; no blocker open; **PASS** 2026-09-27 (the maintainer, after round 11; round 12 not run, so round 11's fixes and the known-limitation note were not read by a further round) |
| 2026-09-25 | 0.4 | `dispatched` for the applier's renamed outcome; GA-LEASE-1 ends a lease on `unreachable`; GA-LEASE-2 reads back leases missed in a `cursor_expired` gap; GA-LEASE-6 after `cursor_expired`; GA-RULE-2's notice for an unknown or over-long bound; GA-SCN-8's skipped `if` step; GA-OCC-1 with the slack. Reviewed in `docs/reviews/2026-09-25-bridge-0.2-applier-0.8.md`: pass 1 and six rounds of two readers (a third-model reader; a no-context Claude reader) and a scenario walk; 153 finding rows fixed, 4 deferred, 1 rejected; no blocker open; **PASS** (the maintainer, 2026-09-25, after round 6, whose fixes were mostly removals, taken without a further read) |
| 2026-09-25 | 0.3 | For the bridge standard: selectors skip unadopted devices (GA-PLAN-6) and `define` refuses them (GA-DEF-9); `not_adopted` in the reason order (GA-STW-4); GA-OCC-1 needs a known `fresh_s` within the hold; GA-RULE-2 (a rule does not act on a device that is not live; liveness has its own event); `scenario_status` gains `unanswered` and `sent_steps`; the applier's new events carried and kept. Reviewed in `docs/reviews/2026-09-24-bridge-0.1-applier-0.7-steward-0.3.md`: seven rounds of two readers (a third-model reader; a no-context Claude reader) and a scenario walk; about 203 finding rows fixed, 15 deferred, 8 rejected, 2 no action; no blocker open; **PASS** (the maintainer, 2026-09-25, after round 7, with round 7's one looser move, the trust-centre rejoin, recorded rather than re-read) |
| 2026-09-24 | 0.2 | For the brain standard: the `ask` event names where the question is put; `define`, `scenario_plan`, `scenario_stop` and `answer` name an endpoint and may name a speaker, checked (GA-AUTH-2); utterance records checked for time, reuse and steps asked (GA-CONF-2); a named speaker's plan takes only that speaker's yes; `brain_authored` work, its runs and devices a brain moved under an owner's step stay at `reversible` (GA-DEF-7); `confirm_on` never brain-served (GA-CONF-4); certificates validated (GA-SEC-2); stepped time for the harness (GA-HARN-2); level rules re-evaluated after a gap; notices retried forever. Reviewed with brain 0.1. **PASS**. Record: `docs/reviews/2026-09-24-brain-0.1-steward-0.2.md` |
| 2026-09-24 | 0.1 | First text, split from applier 0.5: the house model, persons and roles, endpoints, tiers and the confirmation dialogue, leases, occupancy, scenarios, rules, schedules and `define` move here with their ids. New: `via` comes from the endpoint, not from the brain; roles come from the steward's own registry; `no_voice` actions never pass through a brain; confirmation tokens; conditional scenario steps; the steward keeps the audit of why. Reviewed with applier 0.6, in four rounds by a third-model reader and no-context Claude readers with scenario walks. **PASS**. Record: `docs/reviews/2026-09-24-split-applier-0.6-steward-0.1.md` |

**Status: draft.** Nothing implements this yet. The reasons for the split are in
`docs/specs/2026-09-24-standard-split-design.md`.

The key words MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119 and RFC 8174. A sentence
without one of them is explanation, except that every row of *Requirement index* is normative, at
its row's level. Every requirement the conformance harness checks has an id in
*Requirement index*; the manifest, `conformance/steward-requirements.json`, is its machine-readable
copy. Ids are one namespace across the Galatea standards; an id cited here may live in
`standard/applier.md`, `standard/brain.md`, `standard/voice.md` or `standard/bridge.md`.

## What this standard governs

The contract between a steward and its **clients**: brains, panels, apps and voice fronts. The steward holds the
house on its owner's behalf: who lives there, what things are called, which room they are in, the
routines, and who may do what. Its gate guards **authority**. Below it is exactly one applier
(`standard/applier.md`), whose gate guards **the device**; the steward reaches devices only through
it, as that applier's client.

Two gates, and neither trusts the other to be the only one:
- The steward decides whether *this principal* may do *this* now: role, tier, lease, occupancy. It
  asks people and records their answers.
- The applier decides whether *this device* can take it: liveness, latches, loads, and whether a
  `confirm` or `no_voice` action carries a token the steward issued after a person said yes.

It does not govern what a brain must do (`standard/brain.md`), how a voice front hears
(`standard/voice.md`), or how the applier reaches devices.

## Conformance levels

One level in this version, **Steward**. Every requirement in the index applies.

## Compatibility

As the applier standard's *Compatibility*: `standard_version` is `major.minor`, a minor version only
adds, except where its changelog row says it renames or removes one (0.10 follows applier 0.15's
rename of `contact` to `opening`), and a client ignores what it does not know. An unknown verdict is `refuse`. *Client
obligation; not checked by the harness.*

## The house model

Every id follows the applier standard's rules. The house model has a **revision** that the steward
MUST increase on every change to the model, its applier's model included, and MUST NOT change on a
change of state (GA-HOUSE-1).

| Object | Fields |
|---|---|
| Home | `timezone` (an IANA zone), `hold` (the hold policy, *How a person's hold ends*; default: the steward's own, declared), `occupancy_hold_s` (default 300), `ask_expiry_s` (default 300), `notice_channels` (channel ids: adopted targets with `notify`, or with `media.announce`, which speak the notice's text; empty until the owner first sets it, and from then on never empty, GA-DEF-8), `other_wake_words` (default: the assistants listed under *Listening*), `answer_words` (default: the words listed under *Listening*), `audio_retention_s` (default 0: a voice front keeps no audio), `time_source` (harness only, GA-HARN-2) |
| Room | `id`, `name` |
| Target | `id` (the applier's device id), `name`, `aliases`, `room` or null, and everything the applier describes for it, `adopted`, `other_admins`, `internal` and `personal` included; on a `computer`, the applier's `accounts` and the steward's `account_persons` (*Sessions belong to persons*); the steward's `owner_work_passes_holds` (default `false`, *The owner passes a person's hold*) |
| Group | `id`, `name`, `aliases`, `room` or null, `members` (target ids), `aggregate` (`any` · `all`) |
| Person | `id`, `name`, `role` (`owner` · `member` · `guest`) |
| Endpoint | `id`, `name`, `room` (null only for an `app`), `type` (`voice` · `panel` · `app`), `person` or null, `max_role`, `served_by` (a brain client id, or null), `confirm_on` (`same`, the default, meaning none · an endpoint id), `voice` (its voice record, *Listening*, or null) |

A target belongs to at most one room. A group's `on` is `true` when any (`any`) or all (`all`) of its
members with `onoff` are on; groups aggregate `onoff` only (GA-GRP-1). Group state counts
`infrastructure` members; group actions leave them out (GA-PLAN-6).

Rooms, names and groups are the steward's, so one room can hold devices of several of the applier's
children.

### Sessions belong to persons

The applier knows accounts, not persons: a computer's `accounts` gives each interactive OS account's
token, the key of its `session.<account>`, with the OS's name as a label, `{ <account>: label }`
(`standard/applier.md`, *Computers and players*). The steward maps accounts to persons in a field
of its own, `account_persons: { <account>: person id }`, keyed by the applier's account tokens. It
is not the applier's `accounts`, and each name has one shape in every operation: `define` sets
`account_persons`, and `describe` shows it as set beside the applier's `accounts` passed through
unchanged, so an account's label is read from `accounts` and its person from `account_persons`,
an account absent from `account_persons` being mapped to nobody. `define` MUST refuse, with
`invalid_request` and changing nothing, `account_persons` on a target that is not a `computer`, or a
mapping naming a person who is not registered (GA-DEF-11). A mapping may name a token the computer
does not list yet; its key is then absent, which counts as `in_use_unknown` (GA-OCC-3). An account
with no mapping belongs to nobody the house knows, such as a kiosk account. A mapping on a computer
with no `session` capability is kept but inert: nothing is read through it until the computer
reports `session`, and until then GA-OCC-3 asks `in_use_unknown` for that computer whatever it maps.

When a token a computer's `account_persons` maps leaves that computer's `accounts` (its bridge
retired it, the OS account deleted), the steward MUST deliver a notice naming the person, the token
and the computer on the home's `notice_channels`, delivered and retried as GA-NOTE-1 delivers an
applier's, once each time a mapped token leaves (GA-NOTE-3). The mapping is kept, and its absent
key counts as `in_use_unknown` (GA-OCC-3), so the computer's sleep or shutdown under
`respect_occupancy` asks, or in a run no one answers skips and counts as failed (GA-SCN-11), until
the owner edits the mapping; the notice is how the owner learns why.

The steward reads session keys through this mapping, and translates a request about a person («lock
Лиза's session») into the applier's `session.lock { account }`: a `session.lock` step may name
`person` in place of `account`, and the steward MUST resolve it to one step per account that
computer's `account_persons` maps to that person, in the Unicode code-point order of their tokens, sending the applier
`account` only; a `person` with no account mapped on that computer is `refuse(invalid_args)`
(GA-STW-11).

## Clients, endpoints and principals

Every client has a credential registered through `define`. An **app** or **panel** credential is
bound to exactly one endpoint. A **front** credential is bound to the endpoints whose voice record's
`heard_by` names it (its `describe` shows only its endpoints, with their `type`, `person`, `served_by` and voice records, the ids of the
registered persons, and the home's `audio_retention_s` and `other_wake_words`), and may call `describe`, `zone_sources`, `narrow`,
`front_status` and
`speaking`, nothing else; any other operation from it is `not_permitted`, and so are
`front_status`, `speaking` and `zone_sources` from any other credential, and `front_status` or
`speaking` for an endpoint not bound to that front (GA-AUTH-8). A **brain** credential is bound to the endpoints whose `served_by`
names it: every voice endpoint, which names one (`define` refuses a voice endpoint without
`served_by`, GA-DEF-8), and any other endpoint the owner lets a brain
serve (a chat window in an app). An `app` endpoint always has a `person`: `define` refuses one without (GA-DEF-8). A request from an unregistered credential is `not_permitted` (GA-AUTH-4).

A request names its `endpoint`. The steward derives everything else:

- **`via` is the endpoint's `type`, and `brain` is whether a brain serves it.** A client never sends
  either. A request naming an endpoint the credential is not bound to is `not_permitted`
  (GA-AUTH-1). Both are passed to the applier and bound into its tokens.
- **The person.** For an endpoint with a `person`, that person. For a brain-served endpoint without
  one (a shared voice satellite), the brain MAY name a registered person as the speaker; that is the
  brain's claim, recorded as such. A `speaker` from any other credential or endpoint, or naming no
  registered person, is `invalid_request` (GA-AUTH-2). No person means a guest.
- **The role is the steward's, never the client's.** It is the lower of the person's registered
  role and the endpoint's `max_role` (GA-AUTH-2). `max_role` defaults to `owner` (no cap) for an
  endpoint with a person, to `visitor` for one with a `skill_account` (anyone on that account,
  anywhere, speaks there), and otherwise to `member` for `voice` and `guest` for a `panel`; the owner
  changes it through `define`.

**`via` for work with no endpoint.** A rule's actions carry `via: rule`; a run a schedule started,
`via: schedule`; a run a person started, and every run it reaches through `run` steps, the `via` and
`brain` of the endpoint it was started from; a run a rule started, and a duck while a front speaks,
`via: rule` (GA-AUTH-5).

A **principal** is one of: `{ person?, endpoint }` (a person at an endpoint, or whoever stands at a
shared panel); `{ rule }`; `{ run }` (a scenario run, which acts as whoever started it); `external`;
`{ rule, press: { target, key, value } }` (a press rule's own action, which names the rule and the
occurrence, never a person, *A press is a person's*).
A lease may also be held by `safety_rule` or `load_cap`, which are not principals.

### Roles

| Role | May |
|---|---|
| `owner` | every tier; `define` |
| `member` | every tier |
| `guest` | `reversible` actions only |
| `visitor` | no action: may ask, hear answers and `narrow` |

A guest's step above `reversible` is `refuse(role)`, and a visitor's every step, in a plan, an
apply, a scenario run or a `define`, is `refuse(role)` (GA-TIER-3). A person's registered role is
`owner`, `member` or `guest`; `visitor` comes only from an endpoint's `max_role`, for a museum hall,
a hallway guests pass, or a skill anyone on an account can speak through.

## Tiers and confirmation

Each action's tier is the effective tier the applier gives in its plan's step (`standard/applier.md`,
*Steps*): the declared tier, raised to `no_voice` for the undo of a safety rule whose latch has
cleared. The owner may set a declared tier through the applier's `configure`, at or above the
floor the applier's table gives and never below it, and so may lower a tier they raised, or an
extension action's, back to that floor and no further (`standard/applier.md`, GA-DESC-3, GA-DESC-14).

| Tier | Runs |
|---|---|
| `reversible` | whenever role and leases allow |
| `confirm` | only after the principal, or whoever answers at the `confirm_on` that applies, answered `yes` to its `ask(confirm_tier)` step |
| `no_voice` | as `confirm`, and only when the request and the answer both come from an endpoint not served by a brain |

- A `no_voice` action requested through a brain-served endpoint, or with `via: voice`, is
  `refuse(tier)`, answered or not (GA-TIER-1). The model never unlocks a door, whatever the
  endpoint.
- A `confirm` or `no_voice` action not yet answered is `ask(confirm_tier)` in a plan and
  `refused(tier)` when applied inline (GA-TIER-2).

### The confirmation dialogue

The steward owns every ask. The plan that contains the ask is the question; the steward also emits
an `ask` event for it.

- **The question.** The steward MUST emit an `ask` event for every plan with an `ask` step,
  `{ plan_id, step_ids, steps, endpoint, time }`, where `endpoint` is where the question is put: the
  plan's endpoint, or the `confirm_on` that applies to it; and `steps` holds one object per asked
  step, in the order of `step_ids`, `{ step_id, target, action, args, tier, reason }`, each field as
  the plan's step gives it (*Steps*), or, for a `confirm_define` step, that step's own shape,
  `{ step_id, reason: confirm_define, diff }`, so that the asked endpoint sees what it confirms on
  the event itself, with no read of the plan (GA-CONF-5). A run's toggle step asked again
  (GA-SCN-3) MAY carry `run_id`, the scenario run that asked. `steps` go only to readers who may
  already see the plan, decided by the endpoint a read names or derives, never by its credential:
  a read at the ask's endpoint, one whose derived role is `owner`, and one whose derived person is
  the plan's `speaker`; every other reader of `events` and `history` gets the event without `steps`,
  so a pending `notify` text reaches only those (a guest's panel only when it is the ask's endpoint)
  (GA-CONF-5). Personal values in them are withheld as in the plan (GA-AUTH-7).
- **Who may answer.** A brain credential MAY carry its own `confirm_on`, which then applies to every
  endpoint it serves that has none. An answer is accepted only for an open plan (made, not yet applied, not expired), after the plan was made, from the
  credential and endpoint the plan was made from; or, when that endpoint's `confirm_on` (or else its
  brain credential's) names another endpoint, only from a credential bound to that one. Any other answer is `not_permitted` and changes nothing
  (GA-CONF-1). `confirm_on` MUST name an endpoint not served by a brain; `define` refuses, with
  `invalid_request`, any change set after which a `confirm_on` names one, a later change to what a
  brain serves included (GA-CONF-4).
- **How long.** A plan with an `ask` step expires `ask_expiry_s` (default 300) after it was made,
  not 60 s, so that a person asked on another device has time to answer. An answer, once given,
  stands for that step, for the reason it was asked (a `yes` to an `ask(in_use)` or
  `ask(in_use_unknown)` asked in the tier's place for both, and a `yes` to `ask(toggle_only)` for
  every ask it stands in place of, GA-STW-4), until the plan is applied or expires, unless a
  later `no` from the same place replaces a `yes` before apply (a «нет, стой» after a «да»); a `yes`
  after a `no` needs a new plan; it does
  not answer an ask for another reason that arises at dispatch, except that a `yes` to `ask(in_use)`
  or `ask(in_use_unknown)` also answers the room's `occupancy_unknown` for that step (GA-OCC-3).
- **What a spoken yes carries.** An answer from a brain-served endpoint MUST carry an **utterance
  record**, `{ utterance_id, endpoint, time, clock_epoch?, transcript, addressed_by, speaker_hint?,
  hint_basis?, asked_by? }`,
  whose `endpoint` is the answer's, and whose `addressed_by`, hint and basis are that endpoint's own
  (`standard/brain.md`, *The front*); one without it, whose
  `time` is not after the latest `ask` event's for that step less the clock tolerance (*Constants*), or is after the
  answer's arrival plus that tolerance, or whose `utterance_id`
  already answered another plan, or whose `endpoint`, `time` and `transcript`
  together did, is `invalid_request` and counts for nothing. A record without `addressed_by`
  counts as `follow_up`, so that an older brain fails closed. An `utterance_id` is a UUID, unique
  within the home: a front that merges what several endpoints heard gives it one id, so one record
  answers one plan. The steward cannot tell a re-minted record from a new yes; that rests on the
  trust given the brain. The steward may forget a record once every plan whose `ask` event came before its
  `time` plus the clock tolerance has expired, since the timing check refuses it for any later plan. An answer naming a
  step not in the ask's `step_ids` is `invalid_request`. Both are the brain's word, so this catches mistakes, not
  lies. When the plan named a `speaker`, an answer through a brain naming a different one, or none,
  is `not_permitted` (GA-CONF-1).
- **A follow-up alone does not answer.** An answer whose record's `addressed_by` is `follow_up`
  or `skill` counts only when its `hint_basis` is `gate` and its
  `speaker_hint` names the plan's `speaker`, or, for a plan that named none, a registered person;
  any other is `not_permitted` and changes nothing (GA-CONF-6). A skill turn is someone else's
  assistant relaying whatever it heard, a television included. At a phone, the person holds to
  talk (`tap`) or types (`typed`): a phone on the table in a window hears the television too. A follow-up needs no wake word, so a
  television that says «да» in the pause after a question could otherwise earn a token. The phone in
  a person's hand counts; a room microphone with a person of its own does not, since the risk is
  the television, not who owns the endpoint. A `wake`, `tap` or `typed` answer is taken as before; a tap is the
  device's word, and a button pressed while a television talks is the residue, as a stolen device
  key is.
  `addressed_by` and a `gate` hint are the front's word, relayed by the brain: the steward cannot
  check them, and this catches mistakes, not lies, as for the rest of the record. What it can
  check, it does, against the configured record and the narrowings in force for longer than the
  narrowing delay (`standard/voice.md`, *Constants*): `typed` from an endpoint not `type: app`, `skill`
  from one without a `skill_account`, `follow_up` at an endpoint with a voice record whose
  `follow_up` is off or whose listening is narrower than `wake_device`, `tap` where `listening` is
  `off`, `wake` where it is `off` or `tap`, a `gate` basis where `describe`
  shows no gate model for that person at that endpoint, and a `person` basis at an endpoint whose
  person is another, are `not_permitted` (GA-CONF-6). The gate models `describe` shows are the
  front's own report, so this clause too catches mistakes, not lies. The record also names the asking `say` and
  what the front reported of it (`asked_by { say_id, status, cut_by?, ended_at?, clock_epoch? }`), so that `history` shows
  whether the question was heard. The steward MUST keep
  the record in `history` with the step it answered, and refuse as `invalid_request` a record
  from an endpoint with a voice record that has no `asked_by`; one whose `asked_by` has a `status`
  other than `full`, or `cut` with `cut_by` naming this utterance; and one whose `asked_by` is `full`
  with no `ended_at`, or whose `time` is not after that `ended_at` where both are in one
  `clock_epoch`, a missing epoch counting as one (both are the front's times, so no tolerance
  applies; a «да» begun within the interval slack of the question's end may be refused, an answer
  lost and asked again, never a false one) (GA-CONF-2). Times are RFC 3339 with an offset;
  the checks assume that endpoints, their fronts and the steward share one time source. The
  steward cannot check that the brain heard what it says it heard. **Ruling (2026-09-24):** a
  brain's yes is trusted for `confirm`, as people trust their assistants; an owner who does not
  trust a satellite points its `confirm_on` at an app, and `no_voice` never passes through a brain.
- **Unanswered.** An `ask` step with no `yes` when its plan is applied is `skipped(not_confirmed)`
  (GA-APPLY-3). A request applied inline has no plan to answer, so its asks are `refused(tier)`
  (GA-TIER-2), and a toggle's `refused(toggle_only)` (GA-STW-4). A step that was not an `ask` in the plan but becomes one at dispatch is also
  `skipped(not_confirmed)`, since no one was asked.
- **Tokens.** For each step answered `yes`, the steward issues the applier a confirmation token
  (`standard/applier.md`, *Clients and tokens*) at dispatch, bound to that step's target, action,
  args, `via`, `brain` and `for`, expiring 60 s after issue. It MUST NOT issue a token for any step no one answered `yes`,
  except an authored one (below) (GA-CONF-3). The harness sees this as the applier receiving no
  token.

**Authored work carries its author's confirmation.** A rule, and a scenario run a schedule started,
were authored through `define`; their `confirm` and `no_voice` steps count as answered by their
author, and the steward issues their tokens with `for` naming the rule or run and `brain: false`
(GA-SCN-4). This holds only for work defined from an endpoint not served by a brain. Work defined
through a brain is marked `brain_authored`: every step of it whose effective tier at dispatch is
above `reversible` is `refuse(tier)`, and its actions go to the applier with `brain: true`, so a
brain can write a standing order only for what it could do without asking (GA-DEF-7). A run that
`brain_authored` work starts (a schedule's, a rule's, or a `run` step's) is `brain_authored` too,
whoever wrote the scenario it runs, so a brain cannot reach an owner's steps through a standing
order of its own (GA-DEF-7). A step of authored work that reaches a device through a room or a
group the device joined through a brain is `brain_authored` for that device, until a `define` from
an endpoint not served by a brain upserts the device's `target` naming `room`, and upserts each
group that contains the device naming `members`, so a brain cannot move a
device under an owner's step (GA-DEF-7). A schedule exception that moves a run, made through a
brain, makes that run `brain_authored`; one that skips a run never marks anything. The mark holds
whoever applies or runs the work, an owner at their own app included, and `describe` shows it as
`brain_authored: true` on each scenario, rule, schedule and device that has it. An owner who wants
the higher steps redefines the scenario, rule or schedule whole, or the device's room and groups,
from an endpoint not served by a brain, which clears the mark. A latched undo is the exception: the applier requires
a person for it (GA-SAFE-7), so no rule can undo a safety rule.

## Leases

A lease is `{ holder: principal, targets: target id[], precedence, expires }`, where `expires` is a
time or `run_end`; a person's hold's `expires` is the time it would end as of now, which presence
may move later (*How a person's hold ends*, GA-LEASE-7). A lease's targets are always devices: a group is expanded to its members, leaving
out `infrastructure` ones.

**Precedence, highest first:** `safety_rule`; `person` (a person, `external`, `load_cap`, a run a
person started, or a press rule's own action, GA-LEASE-9); `scheduled_run`; `rule` (a rule's action, and a run a rule started).

The steward:
- MUST give each device an endpoint principal's apply dispatched a stateful action to (a `dispatched` outcome) a
  `person` lease from dispatch, which ends as its hold policy says (*How a person's hold ends*) and
  never before that policy's floor, so that no rule acts between dispatch and ack (GA-LEASE-7).
  Stateless actions take none, and neither does `session.lock`, a named exception: it only ever
  narrows use, and a lease would let a child who locks her own session at 20:55 hold the laptop
  against her own limit for as long as her hold lasts. Nor does a narrowing action (*Narrowing
  actions*), on the same model (GA-LEASE-11). A rule's later action there is `refuse(leased)`, unless
  it passes the hold as the owner's work (GA-LEASE-10, GA-LEASE-12). The lease
  ends when the step ends `unreachable`, since nothing was sent (GA-LEASE-1);
- MUST give a change the applier reports with cause `external` a `person` lease held by `external`,
  ending as an endpoint principal's does, and a change with cause `load_cap` a `person` lease held by
  `load_cap`, ending `load_cap_s` after the change, so that no rule turns a capped
  heater straight back on; a change with cause `device` takes none (GA-LEASE-2, GA-LEASE-7). Only a
  change whose keys include one that one of the device's actions sets (the key its ack is matched on,
  `standard/applier.md`, GA-EVT-3; for an extension action, its `confirmed_by`), on an adopted
  device, takes a hold: a sensor reading
  (`occupancy`, `illuminance`, `battery`, a vibration alarm's occurrence) takes none; a sensor key on
  an actuator (a plug's metering, voltage or power, a lock's `battery`) takes none; and a device not
  adopted takes none, so no lease is held on it at its adoption. A sensor reading is nobody's hand.
  An `external` narrowing change (a keypad lock, a valve closed by hand) does take a hold, while the
  same act through the steward takes none (GA-LEASE-11): deliberately, since the steward cannot tell
  a person's lock from the echo of an unlock attempt (GA-LEASE-2);
- MUST give a device a safety rule actuated a `safety_rule` lease, held until the applier reports
  that rule's latch `cleared` or `cleared_by_owner`, or, for a rule with no latch, until the rule is complete; after a
  `cursor_expired`, it reads held latches from the applier's `state`, and releases a latchless rule's
  lease once the applier's `history` shows that rule's first `rule_fired` event after the lease was
  granted, which the applier issues when the rule completes (GA-LEASE-6). It MAY also end a
  latchless rule's lease once a bound of its own has passed since the lease was granted, which it
  states in `describe` as `safety_lease_s` and omits when it never ends one early, and it MUST end
  none early while it omits it. The bound MUST be no shorter, for each lease, than the `ack_within_s`
  of the rule's actuation on that device plus the late-ack window (60 s, GA-APPLY-11), so the
  steward applies to each lease the larger of `safety_lease_s` and that actuation's floor; the lease
  then outlasts a late ack of the actuation, and a completion the steward never sees does not hold
  the device for ever. A re-send that waits for a dead device is still guarded by the applier's
  `refuse(safety)` (GA-SAFE-2). Ordinary rules may then plan on the device again, but the applier still answers them
  `refuse(safety)` until the rule completes (GA-SAFE-2); a level-triggered rule so refused is
  re-evaluated, and fires if its condition holds, when the steward sees that safety rule's
  `rule_fired` relayed (GA-LEASE-6);
- MUST lease a running scenario's `owned` targets until the run ends, and release only the leases
  that run holds (GA-SCN-2). This differs from an apply on purpose: a device a person switches off
  by an apply is held as the hold policy says, while the same off as a step of a person-started run
  is held only until the run ends. A run leases what its scenario's author made it own, for the run's
  life; when it ends the house's rules have the devices back, and a person who wants a hold changes
  the device directly. A run of the owner's work takes no lease on a device whose person's hold it
  passes, until that hold ends (GA-LEASE-10, GA-LEASE-12);
- MUST NOT give a rule's action a lease, except a press rule's own action on a device (*A press is a
  person's*) (GA-LEASE-5, GA-LEASE-9);
- MUST refuse a lower-precedence change to a leased device, and let an equal or higher one proceed
  and replace the lease, except a `session.lock`, which a lease never refuses and which replaces
  none, so that a lease someone else took on the laptop does not stop a rule from locking it again,
  and except a press rule's action, which replaces only a person's hold, and a narrowing action, which a person's hold never refuses and which replaces no person's hold, a lower lease it displaces being ended with none taken in its place, and except the owner's work, which may pass a person's hold, leaving it in place (GA-LEASE-3, GA-LEASE-9, GA-LEASE-10, GA-LEASE-11, GA-LEASE-12);
- MUST, when a lease ends, re-evaluate every level-triggered rule the lease refused an action of
  while it held, and fire it if its condition holds; MUST NOT re-evaluate a rule the lease refused
  nothing of, nor re-run edge-triggered rules (GA-LEASE-4). A lease that refused nothing ends with
  nothing re-evaluated, so a rule that fired before the lease, and still holds, does not fire again.
  When a lease is replaced, nothing is re-evaluated for the devices the new lease covers: the
  rules the replaced lease refused on them pass to the new lease, so that a second touch of a switch
  does not lose the rule the first one held back; the rules it refused on devices the new lease does
  not cover are re-evaluated then, as at an end (GA-LEASE-4). A re-evaluation fires a rule only
  outside its exceptions (GA-RULE-6). Each lease's refused rules are kept with it across a restart
  (GA-PERSIST-2). A step that passes a person's hold (GA-LEASE-10, GA-LEASE-12) is not refused by
  it, so its rule joins none of that hold's refused rules, and since passing ends nothing, it
  re-evaluates nothing.

A **level-triggered** rule's trigger is a state held for a duration ("no motion in the hall for
180 s"), or, for a rule of conditions only, its conditions held for 0 s (*Rules*); an
**edge-triggered** rule's is a change ("motion in the hall").

**Worked example (HS3).** A night light that must go off by itself is two rules: edge-triggered,
*motion in the hall after 23:00 → hall light 10 %*; level-triggered, *hall light on and no motion for
180 s → hall light off*. A person flicking the wall switch off and on, so that the dimmed light comes
back at full, leases it. Reported as one change, `on` before and after, it is an **other** change,
held for `other_s`; reported as two, off then on, the second is an **on** change, held for `on_s`.
The second rule is refused. In a hall with motion sensors only, the lease ends once the hall has been
quiet for that window (an hour either way, with the reference values below), and GA-LEASE-4
re-evaluates the rule, finds no motion for 180 s, and turns the light off; had he stayed in the hall,
each motion the sensor saw would have kept the hold. In a hall with an `occupancy` sensor that can
make it `vacant`, under `vacant_ends` the lease ends sooner, once he has gone back to bed and the hall
reads `vacant`.

### How a person's hold ends

A **person's hold** is a `person` lease an endpoint principal's apply took (GA-LEASE-1), an
`external` change took (GA-LEASE-2), or a press rule's own action took (GA-LEASE-9). How it ends is
the steward's **hold policy**, its own choice, which it declares as the home's `hold` and which the
owner may change. The standard fixes the shape of the policy and its floors, not its values: how
long a person's change should stand is a heuristic, to be learnt in use.

The policy is `{ on_s, off_s, other_s, fixed_s, load_cap_s, cap_s, presence_renews, vacant_ends,
schedule_ends, owner_work_passes_guest_holds, owner_work_passes_holds }`:

| Field | Meaning |
|---|---|
| `on_s` | The quiet window after an **on** change: one whose action sets the device's `on` to `true` (`onoff.turn_on`, or an extension action whose `confirmed_by` is `on` true), or an `external` change that moved `on` to `true` |
| `off_s` | The quiet window after an **off** change: one whose action sets the device's `on` to `false` (`onoff.turn_off`, or an extension action whose `confirmed_by` is `on` false), or an `external` change that moved `on` to `false` |
| `other_s` | The quiet window after any other change: one that sets no `on` (a level, a set point, a position, a lock, `climate.set_mode` to `off`, `cover.close`), one that leaves `on` as it was, or an action declared `toggles`, whose direction is not known when it is sent |
| `fixed_s` | The window for a device with no room, or in a room with no live presence source, whatever the change's direction, counted from its **anchor**: the latest of the change, the device's last move during the hold, and the moment its room lost its last live source; the change alone when there was neither (no room, or a room that never had a live source, and no move) |
| `load_cap_s` | The window from the change for a `load_cap` lease, the heater's guard, apart from every person's hold |
| `cap_s` | A bound on every person's hold from its change, whatever presence does; `0` for no cap |
| `presence_renews` | Whether presence in the device's room renews the hold; when `false`, in a room with a live presence source, each quiet window counts from the change alone |
| `vacant_ends` | Whether the hold ends as soon as the device's room becomes `vacant` after the change |
| `schedule_ends` | Whether a schedule's run that dispatches a step on the device ends the hold |
| `owner_work_passes_guest_holds` | Whether a guest's hold lets the owner's rules and schedules through (*A guest's hold and the owner's work*) |
| `owner_work_passes_holds` | Whether every person's hold lets all the owner's work through, the home's switch (*The owner passes a person's hold*); every steward implements it |

**The change.** Its direction comes, for an apply or a press, from what its action sets: an **on**
change sets `on` to true, an **off** change sets it to false (the `on_s` and `off_s` rows name the
actions), and every other action, `climate.set_mode` to `off` and `cover.close` included, is an
**other** change, as is an action declared `toggles` whatever it is named; for an `external` change,
from what changed: the `on` the applier reports when the change moved it, a change that left `on` as
it was being an other one. Its time is the steward's own: for an apply or a press, its dispatch; for
an `external` or `load_cap` change seen live, the moment the steward received the event. The
applier's clock moves no live hold (*not checked by the harness*, which gives both clocks from one
`time_source`). A change missed in a gap, read back from the applier's `history`, is timed by its
event's `time`, clamped as *Judged as of now* says, since the steward never received it, and takes a
hold only if the end the policy gives it, computed over the gap's presence reports as for a hold
kept across the gap, has not passed at the read-back: none is taken whose end has passed
(GA-LEASE-2).

**Presence and quiet.** A **presence source** is an adopted device in the device's room that
reports a `motion` or `occupancy` key, whatever its class (a light switch with a built-in PIR counts),
the readings GA-OCC-1 reads. It **reports presence** while it is `live` and reads motion or
presence, a held `true` counting until it clears; a source that is not `live` reports nothing, and a
room whose every presence source is not `live` counts as having none, so `fixed_s` applies, counted from its anchor (the `fixed_s` row above), so that a sensor going stale does not end a renewed hold at once. The room
is **busy** while any of its sources reports presence and **quiet** otherwise, and the readings that
move it between the two are its **presence reports**. This differs from GA-OCC-1 on purpose, twice:
an `occupancy` sensor that is not `live` still keeps its room from being `vacant` there, but renews no
hold here, so that a dead sensor stuck at `true` does not hold a device for ever; and GA-OCC-1's
`occupancy_hold_s` after a motion report does not apply here, so quiet starts the moment the last
source clears.

**Judged as of now.** The device's room, the room's presence sources and the policy are judged as of
each moment, and a policy change applies at once to the holds already held. When the device moves
room, or a source is adopted, removed or returns to `live`, during a hold, the quiet window counts
from the later of that moment and the moment the room last became quiet as now known. Windows run on
elapsed time within a run of the steward (*not checked by the harness*). Across a restart, a hold
keeps its change's time, its holder's derived role and the moment its room last became quiet as
wall-clock instants, and is judged again from them. A change or a presence report read back from a
gap, a restart's or a `cursor_expired`'s, counts at its own event's `time`, clamped: never later
than the read-back moment, and never earlier than the steward's last live reading before the gap, so
that an applier's clock running ahead or behind moves no hold beyond the gap. A hold whose end
passed inside the gap, with no presence before that end, is ended at the restart with `end_time`,
and later reports in the gap do not revive it. Under the harness one `time_source` gives every clock
(GA-HARN-2), and the harness steps it (GA-LEASE-7).

The steward MUST end a person's hold at the first of these, at no earlier time, and no later than
the hold end lateness (*Constants*) after it (GA-LEASE-7):
- with `presence_renews`, in a room with at least one live presence source: once the room has been
  quiet for the change's window (`on_s`, `off_s` or `other_s`), counted from the later of the change
  and the moment the room last became quiet; without `presence_renews`, in such a room, once that
  window has passed since the change;
- in a room with no live presence source, or for a device with no room: once `fixed_s` has passed
  since its anchor;
- with `cap_s` above 0, once `cap_s` has passed since the change, however busy the room;
- with `vacant_ends`, when the room's occupancy (GA-OCC-1) becomes `vacant` after the change, a room
  `vacant` already at the change not ending it then. It becomes `vacant` at the first moment
  GA-OCC-1's vacancy condition holds, judged continuously and not only on a report:
  `occupancy_hold_s` running out with no report makes it `vacant` too. This holds for an off hold
  too: once the room is `vacant`, a rule driven by vacancy may act on a device a person switched off;
- with `schedule_ends`, when a schedule's run dispatches a step on the device: the step is planned as
  if the hold were not there, and the hold ends when the step is dispatched; a step that is skipped or
  refused, one met inside the hold's floor included (*The floor*), leaves the hold as it was, a
  `brain_authored` run never ends a person's hold, and a step that passes a hold under GA-LEASE-10
  or GA-LEASE-12 does not end it;
- when the device is removed, or stops being adopted, or becomes `internal`;
- as every lease ends: replaced (GA-LEASE-3), or its step ended `unreachable` (GA-LEASE-1).

**The floor.** A hold an endpoint principal's apply or a press rule's action took MUST NOT end by
the policy's own ends (`quiet`, `window`, `cap`, `vacant`, `schedule`) before its step reaches a
success GA-RULE-7 names (`acked`, `delivered`, `sent` or `confirmed`), or, when none comes, before
the step's `ack_within_s` plus the late-ack window (60 s, `standard/applier.md`, GA-APPLY-11) have
passed since dispatch, so that no rule acts between dispatch and a late ack (GA-LEASE-7). Quiet, a
window, vacancy or a cap that comes inside the floor ends the hold when the floor has passed, not
before. A schedule point does not wait: a scheduled step that meets a hold inside its floor is
`refuse(leased)`, as under any hold, and leaves the hold as it was, ending it neither then nor when
the floor passes. The floor does not bound a replacement, a removal, nor a step ending
`unreachable`, after which nothing was sent and no late ack can come. On an open-loop device the
floor ends at `sent`, since no ack can come; with short windows a rule may then act on it soon after
a person's change, which is the owner's choice of window. On a closed-loop device a `delivered` step
may still be confirmed later, but the device acted, so the floor ends there too. A `cap_s` never
ends a hold before its floor either. For passing alone (GA-LEASE-10, GA-LEASE-12), the floor also
ends when the device reports the key the step's action sets at the value it set, the report its ack
will be matched on (`standard/applier.md`, GA-EVT-3), which comes before the ack; the steward judges
that report to end the floor before it judges any rule the report triggers, so that the owner's rule
on the device's own state, triggered by the person's change, is not refused by the floor of that same
change. The policy's own ends above still wait for the step's success or the late-ack window.

**The heater's guard.** A `load_cap` lease ends once `load_cap_s` has passed since the change,
presence neither renewing it nor vacancy, a schedule point or `cap_s` ending it: the cap is the
device's, not a person's wish, and presence says nothing about it. It has its own window so that an
owner shortening `fixed_s` for rooms without sensors does not shorten the heater's guard too. It
ends sooner only as every lease does, replaced (GA-LEASE-3), or when the device is removed, stops
being adopted or becomes `internal`, its end then `removed`. Its `expires` is its change plus
`load_cap_s`. Its granted `lease` event names no direction, and its end at the window is `window`
(GA-LEASE-2, GA-LEASE-7).

**`expires`.** A person's hold's `expires` is its end as now computed from the windows, the cap and
the floor: while the room is busy, now plus the window; once quiet, the moment the room became quiet
(or the change, if later) plus the window; without `presence_renews`, the change plus the window;
for a fixed window, its anchor plus that window; never later than the change plus `cap_s`, when
`cap_s` is above 0, and never earlier than the floor, the floor winning when the two disagree. It
may move later with presence, and vacancy or a `schedule_ends` run may end the hold sooner;
`expires` foresees neither (GA-LEASE-7).

**A guest's hold and the owner's work.** A **guest's hold** is a hold an endpoint principal's apply
took whose derived role was `guest` (GA-AUTH-2), which includes one taken through a brain-served
endpoint with no derived person (no `person` on the endpoint and no accepted `speaker`), the same
guest. The steward keeps the derived role with the hold (GA-PERSIST-2) and names it in the granted
`lease` event, so a later change of a person's role or an endpoint's `max_role` does not reclassify
it. The **owner's work** is a rule, a scheduled run, or a run a rule started, that is not
`brain_authored` for the device (GA-DEF-7): `define` is only ever an owner's (GA-DEF-3), and work
defined through a brain, or reaching a device through a brain's grouping, carries `brain_authored`,
so the mark alone tells the owner's work from a brain's. A steward MAY let the owner's work through
a guest's hold once that hold's floor has passed (*The floor*): the step is not `refuse(leased)` by
it, leaves the guest's hold in place, and takes no lease on that device. Inside the floor the
owner's work is `refuse(leased)`, as under any hold, so that no rule acts between the guest's
dispatch and a late ack. A run takes no lease on a device a guest's hold covers when the run starts,
nor while that hold stands, so that a device carries one lease at a time; if that hold ends while
the run goes on, the run takes its lease on the device then (GA-SCN-2). A steward does so only when
it declares `owner_work_passes_guest_holds` true, and then for every guest's hold; under this flag it
passes no other hold, a member's, an owner's, an `external` change's or a press's, and no
`brain_authored` work (GA-LEASE-10). It is the narrowest case of GA-LEASE-12 (*The owner passes a
person's hold*), whose switches pass a guest's hold too, in the same way, whatever
`owner_work_passes_guest_holds` says. A press rule's own action is not passed under this rule: GA-LEASE-9 governs it,
so it replaces a guest's hold and takes its own. This changes no role and no tier: the step is still
the rule's, with its author's confirmation (GA-SCN-4), and the applier's gate is unchanged. So a
guest at the hall satellite who switches every lamp on at 23:30 does not keep the owner's «lamps off
after 23:00» away for the hold's window (HS9).

**Declared and set.** `describe` MUST show the policy in force as the home's `hold`, every field
present, to every reader but a front, whose `describe` GA-AUTH-8 limits, `cap_s` as `0` when there is none (GA-LEASE-8). The owner sets the policy through `define`
(kind `home`): an upsert's `hold` sets only the fields it names, a field given as null returning to
the steward's own value. The steward MUST accept each window as any whole number of seconds of 1 or
more, and `cap_s` as any whole number of 0 or more, `0` meaning no cap, so an owner may always
shorten or lengthen holds, and set or lift a cap; it MUST accept every flag set `false`, and MAY refuse only setting `true` a flag it does not implement, with `invalid_request` whose `data.field` names the flag, changing nothing, never `owner_work_passes_holds`, which every steward implements (GA-LEASE-8, GA-LEASE-12). The standard sets no minimum and no maximum window: which windows suit
a home is policy, left to implementations and owners; a steward's own windows are declared and
visible in `describe`, so a short one is never hidden; and `cap_s` is the declared bound for an owner
who wants one.

**Explained.** A `lease` event that ends a person's hold names what ended it, as `end`: `quiet`
(with `quiet_since`, the moment the room last became quiet, absent when it was quiet throughout),
`window` (a window from the change), `cap`, `vacant`, `schedule` (with the run), `removed` (the
device removed, no longer adopted, or `internal`), `replaced` or `unreachable`; a granted one names
the change's direction, `on`, `off` or `other`, and, for an apply's hold, the derived role it was
taken with. A replacement ends the old hold with its own `lease` event, `end: replaced`, and the new lease's granted event follows it. When a press's step ends `unreachable`, the press's hold's event ending it `unreachable` is followed by a granted event for the hold it had replaced, marked `restored: true` (*A press is a person's*). A hold whose end fell inside a restart's gap is ended
at the restart, its event carrying the computed end as `end_time`. So `history` alone says why a rule
waited and why it then acted, a step that passed a hold naming it and its switch as `passed_hold`
(GA-LEASE-7, GA-LEASE-12, GA-STW-7).

**Reference values, an example and not a requirement:** `on_s` 3600, `off_s` 600, `other_s` 3600,
`fixed_s` 3600, `load_cap_s` 3600, `cap_s` 43200 (12 h), `presence_renews` `true`, `vacant_ends`
`true`, `schedule_ends` `false`, `owner_work_passes_guest_holds` `true`, grounded in
the workshop's research note on manual hold time and to be tested on a real installation. The research
found no cap in the field; the reference sets one so that a busy room, a cat or a stuck sensor cannot
hold a device for ever. The reference's `owner_work_passes_holds` is `false`, a choice and not a
finding, so that a person's hold
stands against the owner's work until the owner chooses otherwise. ⚠️ The quiet-room rule is untried in use; a
very still person loses the hold after the window, and a busy room may hold a device all day (*What
this standard does not define*).

### Narrowing actions

A **narrowing action** only ever closes something off, so a person's hold has nothing to protect from
it. The class is small and named: `lock.lock`; `valve.close`; and, on an `onoff` device of class
`water_valve` or `gas_valve`, the `onoff` action that is not its `opens_with` (`standard/applier.md`,
*Default tiers*). An action declared `toggles` is never narrowing, a valve's closing one included,
since its direction is not known when it is sent. `session.lock` is the first of the kind and keeps its own rule. Nothing that opens,
unlocks or switches a load on is narrowing, a heater's `turn_on` least of all, and nothing else joins
the class but by a revision of this standard.

A narrowing action, whoever sends it (a rule, a scheduled run, a person, a press), except a step
`brain_authored` for the device, MUST NOT be refused by a person's hold (GA-LEASE-1, GA-LEASE-2, GA-LEASE-9); it takes no lease and replaces no
person's hold (GA-LEASE-11). So an auto-lock rule locks a door a phone unlocked a minute ago (HS18),
and a rule closes a valve a person opened. A step of it that is `brain_authored` for the device acts
at `rule` precedence and does not pass a person's hold, as GA-LEASE-9 and GA-LEASE-10 treat a
brain's work. The exemption is against a person's hold only: against any other lease (a run's, a
`load_cap` lease, a `safety_rule` lease) a narrowing action goes by GA-LEASE-3's ordinary
precedence, by its principal, a press's by GA-LEASE-9. Where that precedence would let it replace
the lease, as a person's `lock.lock` would a run's, it ends that lease, with `end: replaced`, the
rules that lease refused re-evaluated as at any lease's end (GA-LEASE-4), and takes none in its
place, so the device has no lease after; where it would not, as a rule's `lock.lock` against a run's
lease, it is `refuse(leased)`. The applier's gate (latches, `refuse(safety)`) is unchanged, so a
door a safety rule unlocked for an escape stays as the safety rule holds it. Taking no hold, a
person's own lock leaves the device open to the house's rules; an owner who wants a lock held writes
no rule that unlocks it.

### A press is a person's

A rule whose trigger is an `occurrence` its author marks `press: true`, `{ event: { target, type:
occurrence, key, value?, press: true } }`, is a **press rule**: its author says that the occurrence
is a person's physical act on the device, such as a wall button pressed. The applier gives an event
key no such meaning (`standard/applier.md`, *Occurrences*: a vibration alarm the device never clears
is an occurrence too), so the mark is the author's alone, and nothing else makes a rule a press rule.
`define` MUST refuse `press` on a trigger that is not an `occurrence` one with `invalid_request`,
changing nothing (GA-DEF-13, GA-LEASE-9). A step of a press rule that is `brain_authored`, for the
whole rule or for one device it reaches through a room or a group the device joined through a brain
(GA-DEF-7), acts at `rule` precedence for that device, so that a brain can never put a device under
a press that overrides a person's hold (GA-LEASE-9).

A press rule fires as any rule does, its conditions still applying (*Rules*). When it fires, each of
its own actions on a device, a `{ scenario }` action excepted, MUST (GA-LEASE-9):
- be planned and dispatched at `person` precedence, a person's hold on its target not refusing it.
  Only a person's hold gives way: a `load_cap` lease, a `safety_rule` lease and a lease a run holds
  each refuse a press, though `load_cap` and a person-started run's lease are at `person` precedence
  (the press's exception to GA-LEASE-3), so a misfiring button never lifts the heater's guard;
- when its step is dispatched, and only then, unless it is a narrowing action (which passes the hold,
  and takes and replaces none, as GA-LEASE-11 says), replace a person's hold on its target, a guest's included, GA-LEASE-10 not applying to a press (GA-LEASE-3), the rules the replaced hold refused on that device passing to the new one
  (GA-LEASE-4), and take a fresh person's hold, held by `{ rule, press: { target, key, value } }`, `value` being the one the
  occurrence reported; a step that ends `skipped(already)`, skipped otherwise or refused leaves the
  earlier hold as it was. The fresh hold ends as GA-LEASE-7 says for an endpoint principal's apply,
  floor included, and while it holds refuses every rule's and every scheduled run's action on the
  device as any person's hold does (GA-LEASE-3), the owner's work that GA-LEASE-10 or GA-LEASE-12
  lets through excepted. If the step ends `unreachable`, the fresh hold ends and the hold it replaced, if any, is restored as it was, with its change's time, the moment its room last became quiet and its derived role, the rules passed to the fresh hold passing back to it; a restored hold whose end has passed in the meantime ends at once, by the end the policy gives it (*Explained* names the events). So a misfiring or spoofed press at a dead device cancels no one's hold. It is a
  person's hold, so it outlives its rule's deletion or deactivation;
- remain the rule's in everything but precedence: it carries `via: rule` and `for: { rule }`
  (GA-AUTH-5); its `confirm` and `no_voice` steps count as answered by the rule's author, as every
  rule's do, a `brain_authored` rule's above `reversible` being `refuse(tier)` (GA-SCN-4, GA-DEF-7);
  occupancy and session asks become skips (GA-SCN-4); and the applier's gate (liveness, latches,
  loads, `refuse(safety)` while a safety rule runs, `standard/applier.md`, GA-SAFE-2) is unchanged. Precedence is not a
  tier: a press reaches no device and no action it could not reach through the same rule before; it
  passes only a person's hold.

A `{ scenario }` action of a press rule starts its run as any rule's does, acting as the rule.

**Who pressed.** A press names no person, so the hold's holder is `{ rule, press }`, a principal of its
own (*Clients, endpoints and principals*), never a person, and no role is derived for it: whoever
stands at the switch, a guest included, acts with the rule author's confirmation, as through the
same rule before this revision. `state` shows the holder as given, and the `lease` event that grants
the hold carries it, so `history` says that a press on the switch, through the rule, took the device,
and never who pressed (GA-LEASE-9, GA-STW-7). When the occurrence's key is in its device's `personal`,
the press's hold and its `lease` events are withheld as that occurrence is: left out of a guest's, a visitor's, or a no-endpoint brain read's `state`, `events` and `history`, and the `holder` of a plan step it refuses (`refuse(leased)`) is withheld wherever the hold itself is, and a step that passes it carries no `passed_hold` there, in plans, outcomes and `history` (GA-AUTH-7, GA-LEASE-9, GA-LEASE-12).

### The owner passes a person's hold

A person's hold protects a person's change from the house's rules and schedules. Sometimes the owner
wants the house to win: a plug back from a power cut whose reports take a hold for an hour, a light
that must be off at night whoever switched it on. The owner then lets their own work through every
person's hold, by one mechanism, GA-LEASE-10's, with three switches of different reach.

**The owner's work** is as *A guest's hold and the owner's work* defines it: a step of a rule, of a
scheduled run or of a run a rule started, that is not `brain_authored` for the device (GA-DEF-7). A
**person's hold** is as *How a person's hold ends* defines it: an endpoint principal's apply's hold
(GA-LEASE-1), a guest's and an owner's own included; an `external` change's (GA-LEASE-2); and a
press's (GA-LEASE-9). A `load_cap` lease, a `safety_rule` lease and a run's lease are not persons'
holds, and `session.lock` and a narrowing action take none.

**The switches.** A step of the owner's work passes a person's hold when any of these covers it:
- **the rule's**, `passes_holds: true` on a rule, whatever its trigger: its own actions, and every
  step of each run its `{ scenario }` actions start and of every run reached from those through
  `run` steps, as the `brain_authored` mark (GA-DEF-7) and `via` (GA-AUTH-5) follow that chain;
- **the device's**, `owner_work_passes_holds: true` on the device's `target`, the steward's overlay
  on it (*The house model*): all the owner's work on that device. Persons still take holds on the
  device, and a hold there still stands against all work that is not the owner's, a
  `brain_authored` step included;
- **the home's**, `owner_work_passes_holds: true` in the home's `hold` (GA-LEASE-8): all the owner's
  work on every device, but a step that would undo a narrowing (*What no switch passes*).

A schedule has no switch of its own; the device's and the home's cover its runs. A switch's change
applies at once, to the holds already held too, each step being judged when the rule fires or the run
plans it, and again at its dispatch (GA-SCN-7). The switches are definitions, kept as the house model
is (GA-PERSIST-2). `describe` shows `passes_holds` on every rule and `owner_work_passes_holds` on
every target as set, `false` where never set, and both of the home's flags in its `hold` as set
(GA-LEASE-8); with the home's `owner_work_passes_holds` `true`, guests' holds are passed whatever
`owner_work_passes_guest_holds` shows. Every steward implements all three: `define` MUST NOT refuse
any of them as a flag it does not implement (GA-LEASE-8, GA-LEASE-12).

**What passing is.** It is GA-LEASE-10's pass, for every person's hold. Once the hold's floor (*The
floor*: an apply's or a press's hold, until its step's success, the device's report of the value its
step set, or its `ack_within_s` plus 60 s; an `external` change's hold has none) has passed, the step MUST NOT be `refuse(leased)` by that hold.
Inside the floor it MUST be `refuse(leased)`, as under any hold, so that no rule acts between a
person's dispatch and a late ack. The hold stays in place: the step MUST NOT end it, `schedule_ends`
included, nor move its end, and takes no lease on that device. A passed hold refused nothing, so its
rule joins none of the hold's refused rules, and since passing ends nothing, nothing is re-evaluated
by it (GA-LEASE-4). A guest's hold is passed so whatever `owner_work_passes_guest_holds` says. This
changes no role and no tier: the step is still the rule's or the run's, with its author's
confirmation (GA-SCN-4), and the applier's gate is unchanged (GA-LEASE-12).

**A run that passes a hold.** A run takes no lease on a device a hold it passes covers when the run
starts, nor while that hold stands. A hold it passes at its start is one whose floor has passed; a
hold still inside its floor is not passed, and the run's step there is `refuse(leased)` by it, as a
rule's would be. If a passed hold is replaced while the run goes on, the run passes the new hold too,
once that hold's floor has passed, inside which the run's step there is `refuse(leased)`. If a passed
hold ends otherwise than by a replacement while the run goes on, the run takes its lease on the device
then, before GA-LEASE-4 re-evaluates the rules that hold refused, so that a rule re-evaluated at that
end meets the run's lease as GA-LEASE-3 says: a scheduled run's lease refuses it, and a rule-started
run's, at its own `rule` precedence, does not. A run whose own lease a person's change replaces
mid-run (GA-LEASE-3) holds none on that device for the rest of the run, and does not take it back:
the device leaves the run's leased devices and the run goes on, its later steps there meeting the
person's hold as any step of its kind does, passing it where a switch covers them (GA-SCN-2,
GA-LEASE-12).

**What no switch passes.** No switch passes a `safety_rule` lease, a `load_cap` lease or a run's
lease, which go by GA-LEASE-3's precedence as before, and no `brain_authored` work passes any hold,
whatever switch covers it. The home's switch MUST NOT pass a person's hold for a step that would
undo a narrowing, the inverse of GA-LEASE-11's class: `lock.unlock`; `valve.open`; and, on an
`onoff` device of class `water_valve` or `gas_valve`, its `opens_with` action, declared `toggles` or
not, since a toggle may open it. Such a step is passed only where the rule's or the device's switch
covers it, so a valve a plumber closed by hand, or a door locked at its keypad, is reopened by the
owner's work only through a switch the owner set on that rule or that device (GA-LEASE-12). A safety rule's span is partly the applier's to guard too: from firing
until complete it answers `refuse(safety)` (`standard/applier.md`, GA-SAFE-2), and while a latch
holds it refuses any action changing a key the rule set (GA-SAFE-7), both before `leased` in the
reasons' order (GA-STW-4). An action on another key of a latched device reaches the applier only if
the steward passed the `safety_rule` lease, and the harness checks that (`owner-passes-safety`).
Through a brain, a rule's `passes_holds` and a target's `owner_work_passes_holds` are never set or
cleared, nor a rule or a target whose switch is `true` deleted, as
the home's settings are not (GA-DEF-3), since either would let the owner's work through persons'
holds by a brain's choice. A rule the owner marked keeps its mark when a brain later edits it; it is
then `brain_authored` and passes nothing, and passes again once the owner redefines it, clearing the
mark (GA-DEF-7): the switch was the owner's own. A step of a marked rule that reaches a device through
a room or a group the device joined through a brain is `brain_authored` for that device, and passes
nothing there (GA-LEASE-12).

**Beside the press and narrowing.** A press rule's own actions on a device act as GA-LEASE-9 says
whatever switch covers them: a rule marked both `press` and `passes_holds` replaces a person's hold
and takes its own, the press winning; its `passes_holds` governs only the runs its `{ scenario }`
actions start. A narrowing action passes a person's hold already, and takes and replaces none
(GA-LEASE-11); a switch changes nothing for it.

**Recorded.** A step that passes a hold, its floor passed, is not `refuse(leased)` and carries no
`holder`, and no `lease` event is issued for it, the hold's own events unchanged. Its outcome
wherever an outcome is returned or recorded (`apply`, `outcome`, `scenario_status`, its `outcome`
event in `events` and `history`), and, for a run's step, its plan step, MUST carry `passed_hold: {
holder, switch }`: the hold's holder, and the first switch, in the order `rule`, `device`, `home`,
`guest` (GA-LEASE-10's flag), that covers the step. A rule's own action has no plan step a client
reads, so its `passed_hold` is on its outcome and that outcome's `outcome` event. A narrowing action
(GA-LEASE-11) and a press rule's own action (GA-LEASE-9) carry no `passed_hold`: they go past a
person's hold by their own rules, not by a switch. When the passed hold is a press's on a personal
occurrence key, `passed_hold` is left out entirely for every reader the occurrence is withheld from,
in plans, outcomes and `history` alike, since even its presence would say a personal press happened,
and when (GA-AUTH-7, GA-LEASE-9). So
`history` says why a rule acted on a held device, as the switch stood then (GA-LEASE-12).

So an owner's rule marked `passes_holds` switches off a plug whose own reports, after a power cut,
took an `external` hold on it; an owner who wants one lamp always to answer the house's rules sets
its device's switch; and an owner who wants every light off at 23:00, whoever turned it on, sets the
home's.

## Occupancy

A room is `occupied`, `vacant` or `unknown`, computed from the applier's `occupancy` and `motion`
sensors in it. It is `occupied` while any `occupancy` sensor's current value is presence, or any `live` motion sensor
reads motion now or reported motion within `occupancy_hold_s` (a PIR that holds `true` while
movement goes on is occupied throughout);
`vacant` when it has at least one `occupancy` sensor, all its `occupancy` sensors have been `live` throughout the hold, each with a
known effective `fresh_s` that, with its `fresh_slack_s`, is no greater than `occupancy_hold_s`, and none has reported presence within the hold. A sensor with a
longer bound, or none known, reads `live` long after it has died, so it cannot make a room `vacant`: the room is `unknown`, and
the steward asks. An `occupancy` sensor that reports only on change may therefore never make its room `vacant`, unless its bridge
checks it often enough; that fails closed, as a room with motion sensors only does. A motion sensor cannot see a person sitting still, so a room
with motion sensors only is never `vacant`; `unknown`
otherwise, and always for a room with no such sensor. A target with no room (`room` null) is
`unknown` too, failing closed as a room with no sensor does. With `respect_occupancy`, a step in an occupied
room is `skip(occupied)` and in an unknown room `ask(occupancy_unknown)`; without it, occupancy is not
consulted (GA-OCC-1).

### A session in use

**A session in use is occupancy, for computers.** With `respect_occupancy`, a step that runs
`power.sleep` or `power.shutdown` on a computer:
- is `ask(in_use)` when any account **mapped to a person** reads `active` or `idle`;
- is `ask(in_use_unknown)` when none does, but a mapped account reads `unknown` or its key is
  absent, or, with an account mapped, the computer is not `live`; and always when the computer has no
  `session` capability at all, whether or not an account is mapped, since no mapping can then be
  read (fails closed, as GA-OCC-1 does; an adapter's computer that cannot report sessions, HS24);
- otherwise (a computer with a `session` capability, and every mapped account `locked`,
  `disconnected` or `none`, or none mapped) MUST go on
  to the room check, as GA-OCC-1 says for any device: `skip(occupied)` or
  `ask(occupancy_unknown)`, or it proceeds when the room is `vacant`. Unmapped accounts do not
  count, so the kiosk's session alone never holds up «Мы ушли»; the room it plays in still does
  (HS21).

The session check comes first for these two actions on a computer, since a session says more about
the PC than a motion sensor in its room; it adds to the room check and never removes it, so a film
playing on a kiosk in an occupied room is not put to sleep. `in_use` and `in_use_unknown` mirror
`occupied` and `occupancy_unknown`, and take GA-STW-4's occupancy place before them; when the
step would otherwise be `ask(confirm_tier)`, they take the tier's place, and a `yes` to them also
confirms the step, so the person is told the PC is in use in the one question asked. A `yes` to
`ask(in_use)` or `ask(in_use_unknown)` also answers the room's `occupancy_unknown` for that step,
when planned and at dispatch (GA-STW-8), since the person was asked about the PC itself, and a room
with no sensor would otherwise turn the yes into `skipped(not_confirmed)`; an `occupied` room still
makes the step `skip(occupied)` (GA-OCC-3). Without
`respect_occupancy` (a direct request) the tier decides (GA-OCC-3), and `power.sleep` is
`reversible` by default: a direct request may put to sleep a PC someone is using, a known gap
(*What this standard does not define*). Any other action on a computer has the room check only.

## Listening

An endpoint a voice front hears has a **voice record**, the owner's, set through `define`;
provisioning an endpoint is its first `define`:

| Field | Meaning |
|---|---|
| `listening` | `off` · `tap` · `wake_device` · `wake_server` |
| `wake_words` | The words that address it, each `{ word, model }`, `model` being a wake model's name or `transcript` |
| `zone` | The acoustic zone: endpoints in one zone hear each other, and a conversation lives in one |
| `output` | `speech` if the endpoint's device can speak, or null |
| `follow_up` | Whether a follow-up window may open here; `false` by default |
| `heard_by` | The front credential that serves it |
| `skill_account` | For an endpoint fed through someone else's assistant, the vendor account it serves; otherwise absent |
| `skill_surface` | Optionally, the vendor's device or application id within that account, so that two speakers on one family account are two endpoints |

What each mode admits, and what the front does with the record, is the voice standard's
(`standard/voice.md`). Here, the order: `off` < `tap` < `wake_device` < `wake_server`. A record is
**narrower** than another when its `listening` is lower, it has fewer wake words, or `follow_up` is
off where it was on; it is **wider** when it is higher, adds any wake word, turns `follow_up` on, or
moves the endpoint into a zone or another zone.

- **Anyone may narrow.** `narrow { endpoint, speaker?, listening?, follow_up?, until? }` MUST be
  accepted from any credential bound to the endpoint, whatever the role, a visitor's included, and
  from the endpoint's front; it asks for a `listening` no wider than the configured one, or
  `follow_up: false`, and asks for nothing wider, else it is `invalid_request`. It holds until
  `until`, at most the narrowing limit (*Constants*) from now, which is also the default; a later
  one is cut to it (GA-LISTEN-1). «Не слушай до утра» at a shared satellite is a guest's, and holds.
- **Narrowings stack.** The **effective** record is the narrowest of the configured one and every
  narrowing in force, field by field: the lowest `listening`, and `follow_up` off if any says so; one narrowing never lifts another, and when the last expires the configured
  record returns, never anything wider (GA-LISTEN-1). Narrowings are part of the house model: each
  one, and each lift and expiry, changes the revision (GA-HOUSE-1), so a front waiting on
  `describe { since_revision, wait_s }` learns of it at once.
- **Only the owner widens or lifts.** A change to the voice record, and `lift_narrowing { endpoint,
  narrowing_id? }`, are `define` change kinds, so only an owner from an endpoint not served by a
  brain makes them (GA-DEF-3). A device's mute button is not a narrowing: the front reports it as
  a reason (below), and it lifts when released.
- **What the front reports.** `front_status { models, clips, effective, frames, skills }` gives the models the
  front holds, with their measured numbers, and the texts of its fixed clips, the skill ids or secrets (by name, never by value) it binds to each `skill_account` with its hand-over margin (voice, *How a model is measured*); each endpoint's
  effective record, with its reason (`configured`, `narrowed`, `muted`, `offline`, `no_model` or
  `no_steward`); and each endpoint's frames read and discarded. When an endpoint's effective record
  has a reason other than `configured`, a narrowing or a mute, as when a wake word has no model on
  this box, the steward MUST issue a notice naming the endpoint and the
  reason, once per change of reason, the reason `offline` only once it has held for the offline
  grace; and so when narrowings not made from an owner's own endpoint (an endpoint whose `person`
  is an owner) have kept an endpoint narrowed for the narrowing notice span (*Constants*) in a row,
  since a narrowing can be renewed (GA-LISTEN-2).
- **What `describe` shows.** Each endpoint's voice record, its effective record as the front last
  reported it, the models its front declared (`standard/voice.md`, *How a model is measured*), and
  the narrowings in force, each `{ narrowing_id, listening?, follow_up?, until,
  cause }` (GA-LISTEN-2). Every narrowing, lift and expiry is a `narrowed` event in `history`, with
  its cause (GA-STW-7): `{ person?, endpoint }` for a narrowing asked at an endpoint, `{ front,
  endpoint }` for the front's own, and the `define` for a lift.
- **Sources.** `zone_sources { cursor?, wait_s? }` MUST give the front every target
  with `media` in the home whose `speech` state key is not null, playing
  or not, as `{ target, speech, speaking_for_ms }`, within the source delay of the applier's `state`
  event; and every `media.announce`, and every notice spoken through a `notify` channel whose
  target speaks (class `speaker` or `tv`), that it dispatched anywhere in the home, whether or not the target reports
  `speech`, as the same entry with the text, from dispatch until the target's `speech` reports that text
  ended, but for no more than the announce hold after dispatch where `speech` has not shown the text
  within the source delay, nor for more than the announce hold after the target last reported
  `speech`; and, at a target that reports no speech, for the announce hold. A `media.announce` to
  a target that reports no speech while an earlier one to it is listed is `refuse(conflict)`, and the spoken copy of a
  notice waits until the listing ends (GA-LISTEN-3). A front of the home gets the whole home's, since its echoes are the home's. `speaking_for_ms` is how long the text has been reported, at the response;
  the front places it on its own clock. It uses this only to mark a known machine's speech.
- **What the house may announce.** An announcement is speech in a room, so it must not address an
  assistant. A `media.announce`, or a notice spoken through a `notify` channel whose target speaks (class
  `speaker` or `tv`), whose text, normalised as the voice standard's *Constants* say but
  with no word removed, contains as whole words, each normalised the same way, or has a run of words within the echo
  match (voice, *Constants*) of, with the listed word taken as the transcript and in either reading
  (voice, *Constants*), a
  wake word of any endpoint, or a word in the home's `other_wake_words` (the assistants
  in the home: by default «Алиса», «Алекса», «Alexa», «Салют», «Сбер», «Джой», «Афина»,
  «Маруся», «Окей, Гугл», which the owner edits), MUST be `refuse(invalid_args)`
  (GA-LISTEN-4). Otherwise a brain, or a person at a panel, could make a speaker say «Галатея, да»
  in the pause after a question, or «Алиса, открой замок» to a lock Galatea does not guard. A
  spelling that sounds the same («Галатэя») is within the echo match and refused; the steward also
  lists every announcement it dispatched in `zone_sources`, and the front marks what it hears of it
  as a machine's. Another assistant reads no `zone_sources`, so a spelling not on the list («Олиса») is
  the residue the owner closes by listing it. A name in the house model that contains a listed word
  can never be spoken (below). The front applies the same wake-word check to the brain's speech
  (voice, GA-VOICE-20).
  An `ask` is **open** from its `ask` event until the step it asks about is answered, or its plan is applied or
  expires (a run's toggle step asked again is open from that `ask` event for `ask_expiry_s`, GA-SCN-3), and only where its endpoint is served by a brain (an ask on a panel or an app through
  `confirm_on` is answered by a tap, not by speech). While one is open, a `media.announce`, or a
  notice spoken through a `speaker` or `tv` target, whose normalised text, in either reading,
  contains as a run of whole words one of the home's `answer_words` (by default «да», «нет»,
  «конечно», «хорошо», «ладно», «верно», «точно», «можно», «окей», «ок», «давай», «давайте»,
  «отмена», «отменить», «подтверждаю», «согласен», «согласна», «ага», «угу», «не надо», which the
  owner edits) MUST be `refuse(invalid_args)`; a notice's spoken copy waits until no ask is open,
  for at most `ask_expiry_s`, after which it is checked again and spoken or dropped, while its other channels deliver as GA-NOTE-1 says; and a held copy
  is checked again, wake words and answer words, when it is dispatched (GA-LISTEN-4). **Ruling
  (2026-09-25):** a principal who may announce, a guest at a panel, can still spell both words past
  these lists («Галотэя, конешно») and have a speaker say a yes during an owner's question, which a
  satellite takes as a `wake` yes. That is recorded as residue, as the television's is: the owner
  who fears it points `confirm_on` at an app.
- **Ducking.** When a front reports `speaking { endpoint, on: true }`, the steward MAY apply
  `media.duck(on: true)` to the `media` targets in that endpoint's room that declare it (an
  endpoint with no room, such as a phone, ducks nothing), and
  `media.duck(on: false)` when it stops. Whether, and which, is the steward's configuration. A duck
  has the cause `{ front, endpoint }`, takes no lease, and no lease refuses it but a
  `safety_rule`'s (the one exception to GA-LEASE-3), since it lasts only as long as the speech; it is
  sent only to a target whose `media.duck` is `reversible` and not declared `toggles`, and is never
  asked. `media.duck` is stateless, so the steward keeps its own
  record of the ducks it sent. A steward that ducks MUST duck no device that another cause ducked, un-duck only what it ducked for the front, and do so
  when the front says `on: false`, loses its connection, or has said nothing for the duck limit
  (GA-LISTEN-5).
- A steward SHOULD issue a notice, at `define`, for a name, alias or scenario name that contains
  a wake word of any endpoint or a word in `other_wake_words`, or a run within the echo match of
  one: the house can never say it, and every
  mention of it would address an assistant (GA-LISTEN-6).

## Plans

### Requests and selectors

A request is `{ endpoint, speaker?, actions: [{ target | selector, action, args }],
respect_occupancy? }`; `respect_occupancy` defaults to `false`, `speaker` is a person id a brain may
name.

A **selector** is `{ room?, class?, capability? }` with at least one field. It resolves to every
device and channel matching all its fields, never to a group (GA-PLAN-5), and never to a device
declared `infrastructure` or `internal`, or not yet adopted; a group resolves to its members,
leaving those out too (GA-PLAN-6). A neighbour's bulb that joined the network is not in «все лампы»
until the owner adopts it. An `infrastructure` or `internal` device is reached only by its own id; an
`internal` one (a wake relay's entry) is never shown to people, and `describe` lists it for the
owner's app. Names and aliases are the brain's to resolve
to ids; the steward takes ids.

### Steps

A steward plan has one step per distinct `(target, action, args)` after resolution, a target reached
twice identically counting once; the same target and action reached with different args gives each
such step `refuse(conflict)` (GA-STW-2). `session.lock` steps on one computer whose `account`
differs are not a conflict: each locks another account, as the steps GA-STW-11 resolves a person
to do, and as a rule's actions that lock two people's sessions do (GA-STW-2). Steps are dispatched in the order of the request, a
selector's or group's targets in the Unicode code-point order of their ids (GA-STW-3).

| Field | Values |
|---|---|
| `step_id`, `target`, `action`, `args` | as in the applier's steps |
| `verdict` | `op` · `skip` · `ask` · `refuse` |
| `tier` | the applier's effective tier |
| `reason` | the applier's reasons, except `token`; and `conflict`, `role`, `tier`, `leased`, `occupied`, `occupancy_unknown`, `in_use`, `in_use_unknown`, `confirm_tier`, `confirm_define`, `not_confirmed` |
| `holder` | the lease holder, with `refuse(leased)` |
| `passed_hold` | `{ holder, switch }` on a step that passes a person's hold (GA-LEASE-10, GA-LEASE-12), `switch` being `rule`, `device`, `home` or `guest`; absent otherwise |
| `stale`, `basis` | from the applier's plan |
| `from_replaced` | `true` on a `notify` step whose caller-set `from` the steward overwrote (GA-NOTE-2) |
| `brain_authored` | `true` on a step of `brain_authored` work (GA-DEF-7); absent otherwise |
| `answer` | `yes` · `no`, on an asked step once an answer stands for it (*The confirmation dialogue*); absent before |

A `define` through a brain has one step of its own shape, with no target or action:
`{ step_id, verdict: ask, reason: confirm_define, diff, answer? }`, where `diff` is the readable
diff the change set would apply, its `brain_authored` marks shown in it; that plan's `request` is
the `define`'s, `{ endpoint, speaker?, changes, expected_revision }` (GA-DEF-6).

The steward plans on its applier and adds its own reasons. When more than one applies, it MUST report
the first in this order (GA-STW-4):

1. `unknown_target`, `unsupported_action`, `not_adopted`, `invalid_args` (the applier's)
2. `conflict`
3. `dead`, `duplicate_route`, `safety`, `latched` (the applier's)
4. `role`
5. `tier`: `refuse(tier)` under *Tiers and confirmation*; otherwise `ask(confirm_tier)` for an
   unanswered step whose effective tier is `confirm` or `no_voice` and that is not authored. The
   steward plans on the applier without tokens, so the applier answers such a step `refuse(token)`,
   its last reason; the steward MUST report that step as
   `ask(confirm_tier)`, or as `refuse(tier)` under the rule above, never as `refuse(token)`
   (GA-STW-4). For `power.sleep` or
   `power.shutdown` on a computer with `respect_occupancy`, an `ask(in_use)` or
   `ask(in_use_unknown)` that GA-OCC-3 gives MUST be reported in place of `ask(confirm_tier)`,
   never of `refuse(tier)`, and a `yes` to it is also the step's confirmation: one question carries
   both, and the person hears that the PC is in use before saying yes (GA-STW-4). A run no one is
   there to answer turns it into its `skip` as ever (GA-SCN-4)
6. `already` (the applier's)
7. `leased` (never on a `session.lock`, GA-LEASE-3)
8. occupancy: `skip(occupied)` or `ask(occupancy_unknown)`; for `power.sleep` or `power.shutdown`
   on a computer, `ask(in_use)` or `ask(in_use_unknown)` before them (GA-OCC-3), unless reported
   in the tier's place
9. `toggle_only`: the applier's `refuse(toggle_only)` (`standard/applier.md`, GA-PLAN-8) MUST be
   reported as `ask(toggle_only)`, never as a refusal, and inline as `refused(toggle_only)`. It is
   always asked in its own words: where the step would otherwise be `ask(confirm_tier)`,
   `ask(in_use)`, `ask(in_use_unknown)` or `ask(occupancy_unknown)`, it MUST be reported as
   `ask(toggle_only)` in their place, never folded into them, so the person always hears that the
   code toggles and that the device's real state is not known, and says whether a press will reach
   the state. A `yes` to it earns the step's token, and answers the ask it stands in place of; a
   `yes` to any other ask never lifts it (GA-STW-4). Who may answer is as for any ask (GA-CONF-1),
   with no rule about the room: the person who asked may stand across the room from the endpoint
   that heard them, or answer on a phone (HS15), and the question tells them what they answer

Tier comes before `already`, so a `confirm` action that would change nothing is still asked, and no
answer depends on state the asker cannot see.

### Planning changes nothing

`plan` MUST NOT change state, leases or the event stream, except for the `ask` event a plan with an `ask` step emits (GA-STW-1, GA-CONF-5). That event records the question and changes nothing in the house, so `plan` and `scenario_plan` keep `readOnlyHint`. A plan has `plan_id`,
`expires_at` (60 s after creation, or `ask_expiry_s` with an `ask` step), `revision`, the credential and endpoint it was made from, its
request and its steps. Apply uses the plan's request.

## Apply

`apply` takes `{ plan_id }` or `{ request }`, and an `idempotency_key`.

- An expired plan, one made at an older revision, or one made by another credential is a request
  error (`plan_expired`, `stale_revision`, `plan_not_yours`); nothing is dispatched (GA-STW-5). The
  same holds for `define { plan_id }`, whose plan's endpoint and speaker govern: a `define` naming
  others is `invalid_request`. `answer` returns these errors, checked in this order:
  `unknown_plan` (a `plan_id` the steward does not hold); `invalid_request` (a bad utterance
  record, a step not asked);
  `not_permitted` (another credential, endpoint or speaker, GA-CONF-1); `plan_expired`;
  `stale_revision`.
- An `idempotency_key` is scoped to the credential, and bodies are compared as the applier's are.
  Repeated with the same body within 3600 s it
  returns the first apply and dispatches nothing; with a different body it is `idempotency_conflict`
  (GA-STW-6).
- **Apply re-evaluates** each step's `leased` and occupancy at dispatch, keeps the answers already
  given, a `yes` to `ask(in_use)` or `ask(in_use_unknown)` answering the room's
  `occupancy_unknown` too (GA-OCC-3), and passes the applier's own re-evaluation through (GA-STW-8).
- The steward MUST apply to its applier with an inline `request`, re-planned at dispatch, never an
  applier plan made earlier: its tokens exist only at dispatch, and the applier's plans expire in
  60 s. One steward apply is one applier apply, its dispatchable steps in order. Each action carries
  `via`, `brain`, the token if any, and `for`: the steward's cause (below). Its idempotency key on
  the applier is its own `apply_id`; a rule's firing uses the rule id and a per-rule firing sequence number, a run's
  step the `run_id` and the step's index. All survive a restart (GA-STW-10).

Each outcome the steward returns, from `apply`, `outcome` or `scenario_status`, MUST carry its
`time`: the time the steward stamps on that outcome's `outcome` event, or, for an outcome of the
steward's own (`skipped(not_confirmed)`, its own `refused(…)` and `skipped(…)`), which has no
`outcome` event, the moment the steward decided it; the same in every operation that returns it
(GA-STW-12). A brain times its one write after a wake from it (`standard/brain.md`,
GA-BRAIN-17), whether it polls `outcome` or reads `events`.

Outcomes are the applier's, passed through, plus `skipped(not_confirmed)`, the steward's own
`refused(…)`, and `skipped(…)` for its own skips (`occupied`, `occupancy_unknown`, `in_use`,
`in_use_unknown`, `toggle_only`, and `assumed` for an `if` step, GA-SCN-8). An inline request's
outcome for a `notify` step carries `from_replaced` as its
plan step would (GA-NOTE-2). The outcome of a step that passed a person's hold carries its plan
step's `passed_hold`, in every operation that returns it and in its `outcome` event (GA-LEASE-12).

## Causes and history

The applier trusts the steward for `via`, `brain` and `for` on actions without a token
(`standard/applier.md`, *What the applier trusts*): every guarantee below that rests on them rests on
the steward.

The steward's cause, sent to the applier as `for` and reported on every event, is one of
`{ person, endpoint, apply }`, `{ rule }`, `{ run, schedule?, person?, endpoint? }` (`person` when a
person started the run, and `endpoint` the endpoint it was started from, which such a run MUST carry,
since the applier takes a run with neither for an authored one, GA-SCN-3), `{ front, endpoint }` (a
duck while the front speaks), or `safety_rule`, `load_cap`,
`device` and `external` as the applier reported them.

`events` and `history` work as the applier's (`standard/applier.md`, *Events and history*), with the
steward's causes and its own `seq`, relayed events included; they carry the applier's `state`,
`outcome`, `late_ack`, `latch`, `liveness`, `model`, `route_conflict`, `provision`, `freshness`,
`transport`, `other_admins`, `bridge_fault`, `occurrence` and `undescribed` events, and add these event types: `define` (the diff applied, with its cause; the diff given only to the readers an ask's `steps` would go to, by the endpoint a read names or derives: a read at the `define`'s endpoint, one whose derived role is `owner`, and one whose derived person is its `speaker`, personal values in it withheld as in a plan, and every other reader getting the event without it, GA-STW-7), `ask` (as *The
confirmation dialogue*), `answer` (with its utterance record), `lease` (granted, replaced, ended),
`narrowed` (a narrowing granted, lifted or expired, with its cause),
`refused` (a rule's or run's step refused, with its reason), `rule_fired` (the steward's rules, and
the applier's safety rules relayed), `scenario`, `schedule_missed`, `schedule_skipped` (a run an
exception suppressed), `notice`.

The steward MUST keep events at least 3600 s, and `history` MUST return every one of these event
types, and the applier's `state`, `outcome`, `late_ack`, `latch`, `liveness`, `model`, `route_conflict`, `provision`,
`freshness`, `transport`, `other_admins`, `bridge_fault`, `occurrence` and `undescribed` events, with their causes, oldest first, for
at least 7 days (GA-STW-7); `undescribed` events as received live, since the applier's history does
not keep them (the device's `undescribed` holds the list). A `state` event's `speech` key is kept only in `events`, never in
`history`: what a television said is not the house's record; so is an `occurrence` of a personal
key (*Personal keys*). The applier's history says what
happened; the steward's says why.

## Personal keys

A state key the applier marks `personal` says what a person is doing: a computer's every
`session.<account>` key; `app`, `camera_in_use`, `microphone_in_use` and `speech` on every device that reports
them, a plugin's device included; and any key a bridge or the owner marks so (`standard/applier.md`, *Personal keys*, GA-DESC-9). The applier knows no persons, so
it only marks them; the steward holds the floor on who reads them.

- **Reads name a principal.** `state`, `history` and `events` take an optional `endpoint` and, from
  a brain, a `speaker`. The steward MUST check and derive them as it does for a request: an endpoint
  the credential is not bound to is `not_permitted` (as GA-AUTH-1), a `speaker` is accepted only
  where GA-AUTH-2 accepts it and is otherwise `invalid_request`, and the role is the lower of the
  person's registered role and the endpoint's `max_role`, no person meaning a guest (GA-AUTH-6). An
  app or panel credential's read that names no endpoint takes the endpoint it is bound to. A brain
  credential's read that names none has no role.
- **The floor.** The steward MUST NOT return a personal key's value to a call whose derived role is
  `guest` or `visitor`, or to a brain credential's call that names no endpoint (GA-AUTH-7). The value is replaced
  by `withheld` wherever it appears: in `state`, `history` and `events`, in `rule_fired`, in a plan's
  steps, in the `ask` event's `steps` (an `args` value that sets a personal key; and a literal a
  `diff` shows compared with, or set on, a personal key, a clause *not checked by the harness*,
  since a `diff` is free text), and in outcomes. A personal key's `state` and `occurrence` events are left out of such a call's `events`
  and `history` entirely, not only their values: their times alone would give a boolean back, as
  `camera_in_use` alternating does, and a session's logins. GA-STW-7's `history` is read with
  this floor; a gap left in `seq` shows that something was left out, not what. An `if` or `wait`
  step on a personal key is shown to such a call by its verdict only: which branch ran, or whether
  the `wait` was met or timed out; the value read for it is `withheld` in the plan, the `scenario`
  event and `scenario_status`, as anywhere else. A call that names no endpoint of its own (`outcome`,
  `scenario_status`) takes the endpoint its app or panel credential is bound to; a brain
  credential's has no role, and gets no personal values.
- **Verdicts are not values.** The floor does not cover verdicts: `ask(in_use)`, `skip(already)` on
  a lock and the like tell whoever asked that a PC is in use. That is by design: a shared panel has
  to say why it asks (HS21).
- **The brain's side.** A brain names in a read only an endpoint where the utterance it serves was
  heard, and a read that serves no utterance (the long `events` stream) names none
  (`standard/brain.md`, GA-BRAIN-4). The steward cannot check what a brain heard; the floor is what
  it can check.
- **Beyond the floor.** Who else may read personal values (the person, a parent, the owner) is the
  steward's policy, left to implementations; this standard requires only the floor.
- **Said plainly:** personal keys are kept in the steward's `history` like any other key, for the
  7 days GA-STW-7 requires, and in the applier's, where at Box reading them needs the device's
  grant and below Box any reader of the broker sees them.

Rules may read personal keys. A rule is the owner's, or one the owner's policy let a brain define
(GA-DEF-3, GA-DEF-6).

## Notices

The steward takes each notice in the `notices` list of the applier's `events` responses, whatever
its `cause` (a safety rule, a closed join window, another admin),
delivers it on the home's `notice_channels` (`define` refuses, with `invalid_request`, a change
set that leaves them, once set, empty, GA-DEF-8), retrying at least every 60 s, and never giving up, until at
least one channel's `notify` ends `delivered`, or `sent` on a channel that never reports receipt, and only then sends `notice_taken` with its
`notice_id`, so that a notice is never lost between the two
layers (GA-NOTE-1). A channel that announces speaks each notice once, is not retried, and never
counts as delivery: a kitchen is not told of a fault every minute, and a refused announcement
(GA-LISTEN-4) loses nothing. A notice raised while no channel is set is held, and delivered as
above once the first channel is set; while the channels include no adopted channel offering
`notify`, an announcing channel speaks it once and it stays held, since an announcement never
counts as delivery, until a `notify` channel set later delivers it. Held notices coalesce per kind
(an applier notice's `cause`, or the requirement that raised the steward's own) and target, the
latest kept with a count of those it replaced, so at most one per kind and target is held. While
no adopted channel offers `notify`, `describe` shows `held_notices`, the count of notices held, and
a `define` whose change set leaves none says so in its response, `no_notify_channel: true`
(GA-NOTE-1). Every notice of the steward's own not yet delivered survives a restart (GA-PERSIST-2).

When a channel in `notice_channels` leaves adoption, or offers neither `notify` nor
`media.announce`, and when the list loses its last adopted channel offering `notify`, the steward
MUST raise a notice naming it, delivered on the remaining channels as GA-NOTE-1 delivers an
applier's, and held if none remain (GA-NOTE-4). `define` does not refuse the
list for it until a change set sets the list again (GA-DEF-8).

### Who sent a notify

A `notify` a guest asks for is free text from someone the house does not trust. Its `from` says who
sent it, so that the owner's app and a computer's screen can show it and a guest's text cannot pass
for the house's own message. The steward MUST set `from` on every `notify` it dispatches
(GA-NOTE-2):
- `{ endpoint, role }` for a request and for a run a person started: the endpoint it came from and
  the role derived for it (GA-AUTH-2);
- `{ rule }` for a rule's action and a run a rule started, naming the rule;
- `{ scenario }` for a run a schedule started, naming the scenario the schedule runs;
- `{ notice }` for a notice it delivers (GA-NOTE-1), naming the notice.

A `{ rule }` or `{ scenario }` whose rule or run is `brain_authored` (GA-DEF-7) also carries
`brain_authored: true`, so that a standing order a brain wrote is not shown as the house's own
message (GA-NOTE-2).

A `from` a caller sets is never trusted: the steward overwrites it with its own, and records that it
did, with `from_replaced: true` on the plan's step, or on the step's outcome for a request applied
inline. Refusing instead would break a client that echoes a `notify` it read. `from` is new in
applier 0.10, and an older applier may refuse an argument it does not know, which would leave a
notice retried for ever (GA-NOTE-1). So the steward MUST leave `from` out of every `notify` it
dispatches while its applier's `describe` reports a `standard_version` below 0.10, and set it only
from 0.10 on (GA-NOTE-2). An applier of 0.10 or later accepts a `notify` without `from`, forwards
`from` only to a device that declares it, and a meta-applier only to a child of 0.10 or later
(GA-APPLY-14), so beyond its applier's version this duty does not depend on the channel's.

## Scenarios

A scenario has `id`, `name`, `mode`, `owned` (target ids; groups expand to members, leaving out
`infrastructure` ones), `respect_occupancy` (default `false`) and `steps`. A step is one of:
- an action on target ids or a selector, with an optional `respect_occupancy` override for that step;
- `if(condition, then: steps, else?: steps)`, where `condition` compares a target's state key with a
  value (`current < 19`), evaluated when the step is reached; exactly one branch runs, and none
  when the target is not `live`, or the value it reads is `assumed`, and there is no `else`, in
  which case the step ends `skipped(dead)` or `skipped(stale)`, `skipped(assumed)` for an assumed
  value, which no fix will ever make observed, and is listed in `failed_steps` (GA-SCN-8);
- `delay(seconds)`;
- `wait(target, key, value, timeout_s, on_timeout: continue·stop)`, default `stop`;
- `run(scenario id)`.

`mode` is one of `single`, `restart`, `queued`, `parallel`, with Home Assistant's meaning. Every
scenario declares exactly one, one the steward lists in `describe.modes` (GA-SCN-5); a run honours
it, and a start that `single` ignores returns the running run's id with `ignored: true` (GA-SCN-1).

A `wait` that times out with `on_timeout: stop` ends the run `ended(timeout)`; with `continue`, the
run goes on. Either way a `scenario` event records the timeout (GA-SCN-10). `run` steps MUST NOT form
a cycle: `define` refuses such a change set with `cycle` (GA-DEF-4).

### Scenario runs

- **A run is planned first.** `scenario_plan` returns one step per action step of the scenario, a
  step reached through `run` included, in order, evaluated now; an action inside an `if` is planned
  as if its branch were taken, and marked `conditional`. `scenario_run` takes that plan's id. The
  plan's rules (expiry, revision, credential) are as for `apply`; a repeated `idempotency_key` within
  3600 s returns the first `run_id` and starts nothing (GA-SCN-6).
- **A run re-evaluates at dispatch.** Every step, the first included, is re-checked when dispatched,
  as for `apply`, occupancy included when `respect_occupancy` applies; an unanswered `ask` found then
  is `skipped(not_confirmed)`, since no one is there to answer, and an answered one stands
  (GA-SCN-7).
- **A run a person started acts as that person**, at `person` precedence: through a brain-served
  endpoint, its `no_voice` steps are `refuse(tier)`; a guest's steps above `reversible` are
  `refuse(role)`; its unanswered asks are `skipped(not_confirmed)`; a yes given to the run's plan
  stands for the whole run, and each token is issued at its step's dispatch (GA-SCN-3), except a
  yes to `ask(toggle_only)`, which stands only until `ask_expiry_s` after it was given, since the
  device's assumed state may have moved: a toggle step dispatched later, after a `delay` or a
  `wait`, MUST be asked again, as a new `ask` event on the run's plan, which stays open for that
  answer for `ask_expiry_s`, the run waiting on it, and without a `yes` by then the step is
  `skipped(not_confirmed)` (GA-SCN-3). `speaker`
  is as in a request: a person id a brain may name at a brain-served endpoint with no person.
- **A run a rule started** acts as that rule, at `rule` precedence; its steps count as authored.
- **A run a schedule started** acts as the scenario at `scheduled_run` precedence; its steps count
  as authored.
- **No one is there to answer** a run a schedule or a rule started, nor a rule's own action, so in
  each `ask(occupancy_unknown)` becomes `skip(occupancy_unknown)`, `ask(in_use)` becomes
  `skip(in_use)`, and `ask(in_use_unknown)` becomes `skip(in_use_unknown)`; and a step the applier
  plans `refuse(toggle_only)` becomes `skip(toggle_only)`, whatever its tier: the author's
  confirmation answers the tier, never the toggle, since no person said yes to it, and the applier
  takes an authored token as none for it (`standard/applier.md`, GA-PLAN-8) (GA-SCN-4).
- **What `scenario_status` counts.** A step that ended `skipped(occupied)` or `skipped(in_use)` is
  not in `failed_steps`: a room someone is in, or a PC someone is using, is not a failure. One that
  ended `skipped(occupancy_unknown)` or `skipped(in_use_unknown)` is: a run that knows nothing about
  a room or a PC has not succeeded with it. So is `skipped(not_confirmed)`, a declined ask included,
  and `skipped(toggle_only)`, a toggle no one could confirm (GA-SCN-11).
- `scenario_stop` by a role lower than that of the person who started the run is `not_permitted`.
  Who may stop a run no person started (a schedule's or a rule's) is otherwise the steward's
  policy, *not checked by the harness*, except that a `visitor` never may: its `scenario_stop` is
  `not_permitted`. An unknown
  `run_id` is `unknown_run`; a stopped run ends `ended(stopped)` (GA-SCN-9).

## Rules

A rule has `id`, `name`, `trigger` (a state change, a state held for a duration, an event, such as a
device's `liveness` event, or a
time; absent for a rule of conditions only), `conditions` over state and time, `actions` (each as
a request's, with an optional `respect_occupancy`), `active`, `exceptions` and `passes_holds`
(*The owner passes a person's hold*). Safety rules are the applier's, not the
steward's (`standard/applier.md`, *Safety rules*); the steward never hosts one.

A level-triggered rule MUST fire once when its condition becomes true, and not again until it has
been false; the end of a lease that refused it counts as becoming true again (GA-RULE-1,
GA-LEASE-4). After a restart, the steward
starts every held duration afresh (GA-PERSIST-2). After a restart or a `cursor_expired`, it first
reads the applier's `history` from the time of the last event it had (it keeps its applier cursor
and that time across a restart, GA-PERSIST-2), records the events it missed in its own
`history`, and grants the leases the missed `external` and `load_cap` changes would have taken
(only those GA-LEASE-2 lets take one), each timed by its event's `time`, none taken whose end has
passed at the read-back (GA-LEASE-2, GA-LEASE-7). A hold kept across a restart keeps its change's
time, its direction, its holder's derived role and the moment its room last became quiet as
wall-clock instants; a presence report read back from the gap counts at its own event's `time`, and a
hold whose end passed inside the gap, with no presence before that end, is ended at the restart with
`end_time` and not revived by later reports, so a restart neither ends a hold early nor keeps one
past its end (GA-PERSIST-2). After a restart or a `cursor_expired`, it
evaluates each level-triggered rule against current state, and one whose condition holds and has
not fired for it since it last became true fires then, outside its exceptions (GA-RULE-6), a
firing a lease refused not counting as fired; a rule whose trigger is a state held for a duration
fires only once that state has held for the whole duration afresh since the restart, since the
steward did not see it hold while it was down. The **gap** is every event from before the moment the steward resumed, after a restart as
after a `cursor_expired`, however it reaches the steward: read back from `history`, or through a
cursor that was still valid. An edge-triggered rule's events inside the gap are lost, except that a
steward MAY replay an edge from the gap, once per edge, every rule it triggers seeing it, judging
each rule's conditions as they hold now, not as they held at the edge, where all of these hold: it
states the bound in `describe` as `edge_replay_s`, at most 300 s; the edge is no older than
`edge_replay_s` when replayed; it is a state edge (a reading's change), never a time trigger, which,
as a schedule (GA-SCHED-2), is not run late; its reading still holds now; it fell inside none of the
rule's exceptions; and no `rule_fired` for it is already in `history`, so an edge fired just before
a crash is not fired twice. A steward that omits `edge_replay_s` replays none (GA-RULE-1).

A rule's conditions, taken whole, are false while any device they read is not `live`, as an `if`
step's are (GA-SCN-8); and a trigger on a state, or a state held for a duration, does not hold while
its device is not `live`, a held duration starting afresh once it is. So a rule never acts on a
stale or dead reading, and "no motion for 180 s" does not fire on a dead motion sensor (GA-RULE-2).
An `assumed` value (`standard/applier.md`, GA-STATE-4) is not an observation: no condition the
steward evaluates holds on one, a rule's trigger or conditions, an `if` step's, which runs no branch
without an `else` and ends `skipped(assumed)` (GA-SCN-8), or a `wait`'s, which runs to its timeout;
so a rule never
acts on what an IR air conditioner was last told (GA-RULE-2).
GA-RULE-2 governs values read from a device, not its liveness: a rule that should act when a device
stops answering is triggered by its `liveness` event. A rule, or a scenario's `if` step, that reads a device whose
`fresh_s` is not known can never hold on it, so `define` MUST then issue a notice naming the rule or
scenario and the device, and again when such a device is adopted into its selector, until the
owner sets a bound; and so MUST one that reads a device the owner gave a `fresh_s` longer than the
declared one, since it can then act on a dead device's last value (GA-RULE-2).

### Time windows, `not_in` and exceptions

- **A time window.** A rule's condition may be `between: { from, until, days }`: `from` and `until`
  are `HH:MM` in the home's `timezone`, and `days` ISO weekday numbers (every day when absent). The
  window holds from `from` up to, not including, `until`: the same day when `until` is later than
  `from`, the next day otherwise. `days` names the day a window starts, so 21:00–07:00 on days 7, 1,
  2, 3 and 4 runs from Sunday evening to Friday morning. A `from` or `until` that does not exist on
  a date (a daylight-saving gap) takes the first minute after it, and one that occurs twice takes
  its first occurrence, as GA-SCHED-3 does for schedules. Entering the window counts as the
  condition becoming true (GA-RULE-1), and leaving it as its becoming false. `define` refuses, with
  `invalid_request`, a window whose `from` equals its `until` (GA-RULE-3).
- **Not one of.** A state condition may be `not_in: [values]`, true when the key reads none of them:
  a key reading `unknown`, unless `unknown` is listed, and a key the device does not report are both
  true. A device that is not `live` still makes the rule's conditions false, as GA-RULE-2 says. A
  `session.<token>` key retired from the computer's `accounts` (GA-BRIDGE-52) is the one absent key
  this does not cover: every condition that reads it, `not_in` included, reads false instead, so a
  rule on a retired account stops firing rather than firing on every reading of it (GA-RULE-4).
- **A rule of conditions only.** A rule whose trigger is only conditions (a time window, state
  conditions) has as its trigger those conditions held for 0 s, and is level-triggered: it MUST
  fire when they become true together, and again each time they become true after being false, and
  at no other time but those GA-RULE-1, GA-LEASE-4, GA-RULE-6 and GA-RULE-7 name (GA-RULE-5).
- **Again, when an action did not land.** When an action of a rule of conditions only, one its
  device declares `idempotent: true`, ends in an outcome a retry can fix, and the rule's
  conditions still hold, the rule MUST fire again with that action, no sooner than the action's
  `ack_within_s` after its last try and no later than 300 s after it, or, when its `ack_within_s`
  is longer than 300 s, no later than its `ack_within_s` plus 60 s (⚠️ a guess at the spacing), and go on doing so while the
  conditions hold and the action has not ended in success: `acked`, `delivered`, `sent`,
  `confirmed` or `skipped(already)` (GA-RULE-7). The outcomes a retry can fix are three of those
  GA-SAFE-12 (`standard/applier.md`) classes as "nothing ran" or "it may have run":
  `skipped(dead)`, `unreachable` and `failed(no_ack)`. The fourth, "it may not have gone out"
  (`unanswered`, on a `feedback: open` device), is fired again once, at the same spacing, and then
  no more while the conditions hold, as GA-SAFE-12 sends it once more, since nothing will ever say
  whether it ran (GA-RULE-7). It MUST NOT fire again for any other
  outcome: not a `failed` with another reason (`unsupported_action`, `invalid_request`, or one
  saying the device or its protocol refused it, which a safety rule re-sends but a standing rule
  would meet again every `ack_within_s`), nor a `refused` or another skip; and never for an
  action that is not idempotent (`power.shutdown`, `media.launch`, `notify`), which a retry after a
  lost ack could run twice, as GA-APPLY-6 forbids the applier to. A lock whose ack was lost, or
  that met a laptop falling asleep, is tried again, so a session that stays open escapes nothing; a
  lock the OS refused is not, and the owner is told by a notice (GA-RULE-8). A lease that refused an
  action is re-evaluated when it ends (GA-LEASE-4).
- **A failure no retry will fix.** When an action of a rule of conditions only ends, while the
  rule's conditions hold, in an outcome that is neither a success GA-RULE-7 names nor one it fires
  the action again for, the steward MUST deliver a notice naming the rule, the action, its target
  and the outcome on the home's `notice_channels`, delivered and retried as GA-NOTE-1 delivers an
  applier's, at most once for that action each time the conditions become true (GA-RULE-8); a
  steward MAY coalesce the notice for `skipped(occupancy_unknown)` to one per rule and room (per
  rule and target, for a target with no room) for as long as that room's occupancy stays unknown,
  since a room no sensor can make known would otherwise raise it at every firing; the notice names
  the action and target it was first raised for, and once the room has been known again, its next
  `skipped(occupancy_unknown)` raises the notice again (GA-RULE-8). An
  `unanswered` action raises it after its one further try. `refused(leased)`, which the lease's end
  re-evaluates (GA-LEASE-4), `refused(safety)` on a device whose safety lease the steward ended
  early, which the rule's completion re-evaluates (GA-LEASE-6), and `skipped(occupied)` and `skipped(in_use)`, which are not failures
  (GA-SCN-11), raise none. A `failed(not_locked)` raises it only once the lock's `ack_within_s`
  from its dispatch, and the late-ack slack (*Constants*), have passed with no `late_ack`: the
  applier gives one when the OS locks after all (GA-APPLY-11), and a `late_ack` is a success,
  raising none. A `failed(no_graphical_session)` raises it at once: the account had nothing to lock
  and will have no late ack (`standard/bridge.md`, GA-BRIDGE-66). A `failed(no_ack)` reaches this
  notice only for an action that is not idempotent, since GA-RULE-7 fires an idempotent one again;
  it raises it only once the late-ack window, 60 s after that outcome (GA-APPLY-11), and the
  late-ack slack have passed with no `late_ack`, for the same reason. A notice held so is raised
  even if the rule's conditions stop holding during the wait, since the limit failed while it
  applied; it survives a restart, and is raised once its wait has passed with no `late_ack`
  (GA-PERSIST-2). So a child's
  limit whose lock the OS refused (`failed(not_locked)`), or a standing order that is not idempotent
  and did not land, does not fail with its only trace in `history`. `skipped(toggle_only)` raises
  none: a rule's action on an action declared `toggles: true` on a `feedback: open` device ends so
  at every firing (GA-SCN-4), so the steward MUST instead issue one notice naming the rule or
  schedule, the action and its target, saying the action will never run from it: at `define` of a
  rule acting on such an action, or of a schedule whose scenario, or a scenario a `run` step of it
  reaches, has a step on one; again when such an action comes into a selector it acts on; and when a
  device's declaration changes so that an action it names becomes one (GA-RULE-8).
- **Exceptions.** A rule has `exceptions: [{ from, until }]`, RFC 3339 times with an offset, set
  through `define`, which refuses with `invalid_request` one whose `until` is not after its `from`. A
  rule MUST NOT fire inside an exception, from its `from` up to, not including, its `until`. When
  an exception ends, a level-triggered rule whose condition then holds MUST fire; an edge-triggered rule's triggers inside the exception are lost (GA-RULE-6).

**Worked example (HS20).** A child's evening limit on a laptop is one rule of conditions only:
*between 21:00 and 07:00, days 7, 1, 2, 3 and 4, when `session.liza` is `not_in: [locked,
disconnected, none]` → `session.lock { account: liza }`*. Killing the session's helper does not
escape it: the bridge's system service sees the lock without the helper, so the key reads `locked`,
and when Лиза unlocks it reads `unknown`, which makes the condition true again. The lock takes no
lease (GA-LEASE-1) and no lease refuses it (GA-LEASE-3). The rule is false while the laptop is
`dead` (GA-RULE-2), and fires when it wakes, so the limit binds only while the laptop is online.
Лиза's «ещё полчасика» is a `notify` to her mother's channel, carrying the satellite's `from`
(GA-NOTE-2); her mother grants it in her own app with a rule exception, as her own `define`, and
when the exception ends the rule fires again if the session is still open (GA-RULE-6).

## Schedules

A schedule has `id`, `scenario`, `time` (`HH:MM` in the home's `timezone`), `days` (ISO weekday
numbers) and `exceptions`: `{ date, action: skip·move, time? }`. An exception suppresses, or moves,
exactly the run on its date (GA-SCHED-1). A time that does not exist on a date (a daylight-saving
gap) runs at the first minute after it; a time that occurs twice runs once, at its first occurrence
(GA-SCHED-3).

A run missed, however the time passed it (the steward down, or its clock stepped past the
minute), is not run late; the steward records a `schedule_missed`
event for it when it starts again (GA-SCHED-2).

## define

`define` edits the house model: the home's settings; rooms; target names, aliases and rooms, and a
computer's `account_persons`; groups; persons; endpoints and credentials; scenarios; rules and their
exceptions; schedules and exceptions. Device configuration (tiers, loads, `infrastructure`,
`internal`, safety rules, children, routes) is the applier's
`configure`, not this. A `define` names its `endpoint`, and may name a `speaker`, as a request does;
`via`, `brain` and the role come from them (GA-AUTH-1, GA-AUTH-2). So do `answer`'s and
`scenario_stop`'s.

- An owner MAY call `define` from an endpoint not served by a brain, with any change set. Anyone
  else gets `not_permitted` and nothing changes, except as below (GA-DEF-3).
- **Narrowing is not `define`.** `narrow` changes an endpoint's effective listening, from anyone at
  it and through a brain too (*Listening*). It is the one exception to "endpoints are never changed
  through a brain": it only ever takes listening away (GA-DEF-3).
- **Through a brain.** Which change sets, if any, a steward accepts through a brain-served endpoint,
  and from which roles, is the steward's own policy; this standard does not define it. Whatever it
  accepts: it is asked first, as a plan with one `ask(confirm_define)` step carrying the diff,
  answered with `answer` and applied with `define { plan_id }`, and unanswered it changes nothing:
  while the plan is open, `define { plan_id }` with no `yes` returns `skipped: not_confirmed`, and
  once it has expired, `plan_expired` (GA-STW-5) (GA-DEF-6); what it creates or changes is `brain_authored` (GA-DEF-7); and it never changes
  persons, endpoints, voice records, credentials, the home's settings, a rule's `passes_holds` or a
  target's `owner_work_passes_holds`, nor lifts a narrowing (GA-DEF-3, GA-LEASE-12). A `define`
  through a brain whose change set touches any of these (names one of those fields, set or cleared,
  creates or deletes a person, an endpoint, a voice record or a credential, deletes a rule whose
  `passes_holds` or a target whose `owner_work_passes_holds` is `true`, or lifts a narrowing) MUST be `not_permitted` at the call,
  before any plan is made: the whole change set is refused, nothing changes and no `ask` is put
  (GA-DEF-3).
- `define` refuses, with `invalid_request`, a voice record whose `heard_by` names no front
  credential, an endpoint with a voice record and no `served_by`, a `skill_account` on an endpoint
  that is not `type: voice` or that has a `person`, two endpoints with one `skill_account` and
  `skill_surface`, voice records naming more than one front, one account with both a surfaced
  endpoint and one without, and an endpoint with a null `room` that is not an `app`: one front
  serves a home, since it must know every playback the house makes to mark its echoes (GA-DEF-8).
- **Notice channels.** `notice_channels` is empty until the owner first sets it, and `define`
  accepts change sets while it is so, so that the first `define` need not name a channel. A channel
  is a target with `notify` or with `media.announce`, so a list of announcing channels alone is
  accepted. Once the list has been set, `define` MUST refuse, with `invalid_request` and changing
  nothing, a change set that leaves it empty; and a change set that sets the list MUST be refused if
  any entry it names is a device the applier has not adopted, or one that offers neither `notify`
  nor `media.announce` (GA-DEF-8). Only the entries a change set sets are checked, so a channel that
  later leaves adoption does not lock the owner out of `define`; the owner learns of it by a notice
  (GA-NOTE-4). Notices raised meanwhile are held (*Notices*).
- With `dry_run`, it MUST change nothing and return a readable diff (GA-DEF-1).
- With an `expected_revision` that is not current, or with a `plan_id` whose plan was made at a
  revision that is no longer current, it MUST return `stale_revision` and change nothing (GA-DEF-2).
- A change set is applied whole or not at all (GA-DEF-5).
- A change set that names a device the applier has not adopted (in a room, a group, a scenario or a
  rule) MUST be refused with `invalid_request`, and change nothing (GA-DEF-9). Adoption comes first,
  and only the owner adopts, through the applier's `configure`.
- A change set whose rules or scenarios that it adds or changes have a trigger or conditions, an `if`
  or a `wait` that reads a key its device does not declare (the devices its triggers, conditions, `if` and `wait` steps name) MUST be refused with
  `invalid_request`, its `data` naming `{ key, device, awaited }`, and, where the device's bridge lists it as awaited
  (a key the device's model promises and the device has never sent, `standard/bridge.md`, *Keys a
  device has not yet sent*), saying so, and change nothing (GA-DEF-12). A rule on a reading that has
  never come would never fire, and no one would know. A device declares the keys of its
  capabilities' rows, its `sensor_keys`, its extensions' `state` keys, for a trigger its extensions'
  `event` keys too, and, on a computer, the `session.<token>` of each account in `accounts`; a
  scenario a `run` step reaches is checked as its own. An adapter's device has no awaited keys. The guard is partial: a key a model promises and no one has named as missing
  is declared, and a rule on it is accepted (`standard/bridge.md`, *Keys a device has not yet sent*). A computer's `session.<token>` key counts as
  declared while its token is in the device's `accounts` (GA-RULE-4). This is checked at `define`
  only; a key that later leaves a device a rule reads (a replacement, a changed setting) is not
  caught by it, a known gap.
- A change set that puts a device the applier describes as `internal` in a room or a group, or
  names one as a target of a scenario's or a rule's action, MUST be refused with `invalid_request`,
  and change nothing (GA-DEF-10): a wake relay's entry is reached through its computer's
  `power.wake`, never by authored work. A device the owner marks
  `internal` later, through the applier's `configure`, is left out of its groups and selectors by
  GA-PLAN-6 all the same.
- A computer's `account_persons` is checked as *Sessions belong to persons* says (GA-DEF-11).

### Change sets

A change set, `changes`, is a list of `{ op, kind, value }`, applied whole or not at all
(GA-DEF-5). `op` is `upsert` or `delete`.

- **An upsert merges.** It names its item by its key (an `id`; a voice record's `endpoint`; a rule
  exception's `rule`, `from` and `until`; a schedule exception's `schedule` and `date`) and MUST set
  only the fields it names: a field it leaves out keeps its value, a field it gives as null returns
  to its default (the table's last column), and a field holding a list (a scenario's `steps`, a
  group's `members`, a rule's `actions`, `conditions` or `exceptions`, a schedule's `days` or
  `exceptions`, `aliases`, `wake_words`, `notice_channels`) is replaced whole when named. An upsert
  that creates an item MUST give the fields the table lists as created with, none of them null. So
  renaming a computer keeps its room, aliases and `account_persons`, and renaming a satellite keeps
  its `confirm_on` (GA-DEF-14).
- **A delete** removes the item its key names: `{ id }`; for kind `voice`, `{ endpoint }`; for a rule
  exception, `{ rule, from, until }`; for a schedule exception, `{ schedule, date }`. A delete of an
  item that does not exist MUST be refused with `invalid_request` (GA-DEF-14).
- **The shapes bind.** A change set any change of which does not match this section (an unknown
  `op` or `kind`, a field its kind does not name, a value not of its kind's shape, a `secret` under
  16 characters, more than 64 exceptions on a rule or a schedule) MUST be refused with
  `invalid_request`, and change nothing (GA-DEF-13). *Compatibility*'s "a client ignores what it
  does not know" governs what a client reads, not what `define` accepts.

| Kind | Value | Created with | Defaults |
|---|---|---|---|
| `home` | The settings it sets, at least one, of the Home's fields (*The house model*); a `hold` sets only the fields it names (GA-LEASE-8) | — | As *The house model* gives them; `notice_channels` empty; each of `hold`'s fields the steward's own |
| `room` | `{ id, name? }` | `name` | — |
| `person` | `{ id, name?, role? }`, `role` being `owner`, `member` or `guest` | `name`, `role` | — |
| `endpoint` | `{ id, name?, type?, room?, person?, served_by?, max_role?, confirm_on? }`, `room`, `person` and `served_by` null where there is none; its voice record is kind `voice` | `name`, `type`, `room`, `person`, `served_by` | `max_role` as *Clients, endpoints and principals* gives it; `confirm_on` `same` |
| `voice` | `{ endpoint, listening?, wake_words?, zone?, output?, follow_up?, heard_by?, skill_account?, skill_surface? }`, the endpoint's voice record (*Listening*), each wake word `{ word, model }` | `listening`, `wake_words`, `zone`, `output`, `follow_up`, `heard_by` | `skill_account` and `skill_surface` absent |
| `lift_narrowing` | `{ endpoint, narrowing_id? }` (*Listening*) | — | — |
| `credential` | `{ id, kind?, secret?, endpoint?, confirm_on? }`: `kind` is `app`, `panel`, `brain` or `front`; `secret` has at least 16 characters; `endpoint` is the one endpoint an app or panel credential is bound to; `confirm_on` is a brain credential's own (*The confirmation dialogue*) | `kind`, `secret`, and `endpoint` for an app or panel | `endpoint` and `confirm_on` none |
| `target` | `{ id, name?, aliases?, room?, account_persons?, owner_work_passes_holds? }`: the steward's overlay on the applier's device `id` | — | `name` the applier's `label` for the device, or its id; `aliases` none; `room` null; `account_persons` none; `owner_work_passes_holds` `false` |
| `group` | `{ id, name?, room?, members?, aggregate?, aliases? }`, `room` null where there is none, `aggregate` `any` or `all` | `name`, `room`, `members`, `aggregate` | `aliases` none |
| `rule` | `{ id, name?, trigger?, conditions?, actions?, active?, exceptions?, passes_holds? }`, keeping a `trigger`, `conditions` or both; `exceptions`, each `{ from, until }`, are at most 64; `passes_holds` a boolean | `name`, `actions`, and a `trigger` or `conditions` | `active` `true`; `exceptions` none; `passes_holds` `false` |
| `rule_exception` | `{ rule, from, until }`: one exception of a rule, added by an upsert | its key | — |
| `scenario` | `{ id, name?, mode?, steps?, owned?, respect_occupancy? }` | `name`, `mode`, `steps` | `owned` none; `respect_occupancy` `false` |
| `schedule` | `{ id, scenario?, time?, days?, exceptions? }`, `exceptions` at most 64, each `{ date, action, time? }` | `scenario`, `time` | `days` every day; `exceptions` none |
| `schedule_exception` | `{ schedule, date, action, time? }`: one exception of a schedule, an upsert replacing the one on its date | its key and `action` | — |

Ids are as the house model's; a `days` list is ISO weekday numbers, 1 (Monday) to 7, none twice; a
clock time is `HH:MM` in the home's `timezone`; a schedule exception's `date` is `YYYY-MM-DD` in it,
and its `time` is given for `move` and only for it.

A rule's parts:
- **A reading** is one device's state key, `{ target, key, op, value }`, `op` being `eq`, `ne`, `gt`,
  `ge`, `lt` or `le`, or `{ target, key, not_in }` (GA-RULE-4); `target` is a device id.
- **A trigger** is one of `{ state: reading }`, which fires when the reading becomes true (an edge); `{ held }`, a
  reading with `for_s` added, the reading held for `for_s` seconds while its device is `live` (level);
  `{ event: { target, type, new?, key?, value?, press? } }`, `type` being `liveness` (with `new`, the
  liveness reached) or `occurrence` (with `key` and `value`, and `press: true` when its author says
  the occurrence is a person's physical act, *A press is a person's*; `press` on any other trigger is
  refused, GA-DEF-13, GA-LEASE-9), an edge; or `{ time: { at, days? } }`,
  an edge at that minute.
- **A condition** is a reading or `{ between: { from, until, days? } }` (GA-RULE-3); `conditions`
  has at least one when present.
- **An action** is a request's action with an optional `respect_occupancy`, or `{ scenario }`, which
  starts a run of that scenario acting as the rule (*Scenario runs*).

A scenario's steps, at least one, each one of:
- an action, `{ target | selector, action, args, respect_occupancy? }`, `target` a device's or a
  group's id;
- `{ if: { target, key, op, value }, then, else? }`, each branch a list of steps, at least one;
- `{ delay: seconds }`, more than 0;
- `{ wait: { target, key, value, timeout_s, on_timeout? } }`, `on_timeout` `continue` or `stop`, by
  default `stop`;
- `{ run: scenario id }`.

## Restarts

The steward MUST keep across a restart: the house model; leases, a person's hold with its change's
time, its direction, its holder's derived role and the moment its room last became quiet (*How a
person's hold ends*); idempotency keys for their
retention; each lease's refused rules (GA-LEASE-4); open plans that have an `ask` step, and their
answers (a plan with none may be lost, and an `apply` or `answer` of it is then `unknown_plan`);
every notice of its own not yet delivered, those held for want of a channel included; the events `history` needs; each schedule's last run; and
each notice GA-RULE-8 holds for a late ack, with the end of its wait.
A scenario run a restart interrupted ends `ended(interrupted)`, and its leases are released; held
durations start afresh (GA-PERSIST-2).

## Operations

Errors as the applier's, `unknown_plan` among them (a plan the steward never made, or lost at a restart, GA-PERSIST-2), plus `unknown_run`. Every connection MUST use TLS, with the server's certificate
validated, unless both ends are on one host's loopback (GA-SEC-2).

| Operation | Request | Response |
|---|---|---|
| `describe` | `{ since_revision?, wait_s? }` (0–30; with `since_revision`, returns at the next revision or after `wait_s`) | `{ steward_id, standard_version, revision, home, rooms, targets, groups, endpoints, persons, scenarios, rules, schedules, modes, applier: { applier_id, levels, ungoverned }, edge_replay_s?, safety_lease_s?, held_notices?, test_run_id? }`. `edge_replay_s` is the bound on replaying an edge from a gap, absent when the steward replays none (GA-RULE-1); `safety_lease_s` the bound on a latchless safety lease, absent when the steward never ends one early (GA-LEASE-6); `held_notices` the count of notices held, shown while no channel has `notify` (GA-NOTE-1). `persons` is `[{ id, name, role }]`, a front's by `id` only (GA-AUTH-8); credentials never appear |
| `state` | `{ targets?, endpoint?, speaker? }` | the applier's, plus each room's occupancy, each group's state and each device's lease; personal values as *Personal keys* |
| `plan` | request | plan |
| `answer` | `{ plan_id, endpoint, speaker?, answers: { step_id: yes·no }, utterance? }` | the plan, updated |
| `apply` | `{ plan_id } \| { request }`, `idempotency_key` | `{ apply_id, outcomes }` |
| `outcome` | `{ apply_id }` | current outcomes, each with its `time` (GA-STW-12) |
| `events` | `{ cursor?, wait_s?, endpoint?, speaker? }` | `{ events, cursor }` |
| `history` | `{ targets?, from, to, endpoint?, speaker? }` | events; a `targets` filter matches only events that name one of them |
| `scenario_plan` | `{ scenario, endpoint, speaker? }` | plan |
| `scenario_run` | `{ plan_id, idempotency_key }` | `{ run_id, ignored? }` |
| `scenario_status` | `{ run_id }` | `running` · `ended(done)` · `ended(timeout)` · `ended(stopped)` · `ended(interrupted)`, with `failed_steps`, each `{ step_id, outcome }`, for every step that did not end `acked`, `delivered`, `sent`, `confirmed`, `skipped(already)`, `skipped(occupied)` or `skipped(in_use)` (GA-SCN-11), a step that ended `failed` and then had a `late_ack` before the run ended being left out; an `unanswered` step is in `failed_steps`; and `sent_steps`, each `{ step_id }`, for every step that ended `sent` without a witness, which nothing confirmed; a witnessed step counts by its verdict: a run goes on past a failed step, and ends only when every dispatched step has a final outcome, a witnessed step its verdict; `failed_steps` is as of the end |
| `scenario_stop` | `{ run_id, endpoint, speaker? }` | status |
| `define` | `{ endpoint, speaker?, changes, expected_revision, dry_run } \| { endpoint, speaker?, plan_id }` | dry run: `{ diff }`, a readable diff; through a brain: a plan to answer; `{ plan_id }` of a plan whose `confirm_define` no one answered `yes`: `{ revision, skipped: not_confirmed }`, nothing changed and the plan spent (GA-DEF-6); otherwise `{ revision }`; any of these with `no_notify_channel: true` when the house, after it, has no `notify` channel (GA-NOTE-1) |
| `narrow` | `{ endpoint, speaker?, listening?, follow_up?, until? }` | `{ narrowing_id, until }` |
| `front_status` | `{ models, clips, effective, frames, skills }` | `{}` |
| `speaking` | `{ endpoint, on }` | `{}` |
| `zone_sources` | `{ cursor?, wait_s? }` | `{ sources, cursor }`: the home's `media` targets reporting speech, and its announcements and spoken notices, each `{ target, speech, speaking_for_ms }` |

The MCP binding is the applier's, with these tools and names, and its revision rules: the steward
MUST serve protocol revision `2026-07-28` to every caller, MAY also answer `2025-06-18` and
`2025-11-25` and no other revision, and MUST reach its applier at `2026-07-28` where the applier
serves it, falling back to one of those two only for an applier that does not (GA-BIND-2).
`describe`, `state`, `plan`, `outcome`, `events`, `history`, `scenario_status` and `zone_sources`
carry `readOnlyHint: true`; `answer`,
`apply`, `scenario_run`, `scenario_stop`, `define` and `narrow` carry `destructiveHint: true`;
`front_status` and `speaking` carry `destructiveHint: false`. The hints are a server's
obligation, *not checked by the harness*.

`apply` SHOULD add no more than 200 ms to its applier's synchronous bound (GA-STW-9).

## Constants

| Constant | Value | Where |
|---|---|---|
| Plan expiry | 60 s; `ask_expiry_s` with an `ask` step | GA-STW-5, GA-CONF-1 |
| Token expiry | 60 s after issue | GA-CONF-3 |
| Ask expiry, default | 300 s | GA-CONF-1 |
| Clock tolerance | 1 s, a guess until measured | GA-CONF-2 |
| Notice retry interval | at most 60 s | GA-NOTE-1 |
| Hold end lateness | 2 s after the hold's computed end; ⚠️ a guess | GA-LEASE-7 |
| Occupancy hold, default | 300 s | GA-OCC-1 |
| Idempotency key retention | 3600 s, per credential | GA-STW-6, GA-SCN-6 |
| Event retention | 3600 s | GA-STW-7 |
| History retention | 7 days | GA-STW-7 |
| Late-ack slack | 11 s, as the applier's `fresh_slack_s` for a bridged device, plus its 6 s for each meta-applier hop; ⚠️ a guess | GA-RULE-8 |
| Edge replay bound, at most | 300 s | GA-RULE-1 |
| Rule retry spacing | at least the action's `ack_within_s`; at most 300 s, or the `ack_within_s` plus 60 s when it is longer than 300 s; ⚠️ a guess | GA-RULE-7 |
| Narrowing limit | 12 h | GA-LISTEN-1 |
| Narrowing notice span | 24 h | GA-LISTEN-2 |
| Source delay | 1 s, a guess until measured | GA-LISTEN-3 |
| Duck limit | 60 s | GA-LISTEN-5 |
| Announce hold | 30 s | GA-LISTEN-3 |
| Offline grace | 600 s | GA-LISTEN-2 |

## Requirement index

| Id | Level | Conf. | Verify | Requirement |
|---|---|---|---|---|
| GA-HOUSE-1 | MUST | Steward | wire | The house revision changes on every model change, the applier's included, and never on a state change |
| GA-AUTH-1 | MUST | Steward | wire | `via` is the endpoint's type and `brain` whether a brain serves it; a request naming an endpoint the credential is not bound to is `not_permitted` |
| GA-AUTH-2 | MUST | Steward | wire | The role is the lower of the person's registered role and the endpoint's `max_role`; no person means guest; a `speaker` is accepted only from a brain credential at a brain-served endpoint with no person, naming a registered person, and is otherwise `invalid_request` |
| GA-AUTH-4 | MUST | Steward | wire | A request from an unregistered credential is `not_permitted` |
| GA-AUTH-5 | MUST | Steward | wire | A rule's actions carry `via: rule`, a scheduled run's `via: schedule`, a person-started run's the `via` and `brain` of its starting endpoint, a rule-started run's and a front's duck `via: rule` |
| GA-AUTH-6 | MUST | Steward | wire | `state`, `history` and `events` take an optional `endpoint` and `speaker`, checked and derived as for a request: an endpoint the credential is not bound to is `not_permitted`, a `speaker` GA-AUTH-2 does not accept is `invalid_request`, the role is the lower of the person's and the endpoint's `max_role`; an app or panel read naming none takes its bound endpoint, and a brain read naming none has no role |
| GA-AUTH-7 | MUST | Steward | wire | A personal key's value is `withheld` from a call whose derived role is `guest` or `visitor` and from a brain credential's call naming no endpoint, wherever it appears: `state`, `history`, `events`, `rule_fired`, plans, the `ask` event's `steps` (an `args` value setting a personal key) and outcomes, `outcome` and `scenario_status` included; that key's `state` and `occurrence` events are left out of such a call's `events` and `history` entirely; an `if` or `wait` step on it is shown by its verdict (the branch taken, the `wait` met or timed out), its value `withheld`; verdicts are not withheld |
| GA-AUTH-8 | MUST | Steward | wire | A front credential is bound to the endpoints whose voice record's `heard_by` names it, and any operation from it but `describe`, `zone_sources`, `narrow`, `front_status` and `speaking` is `not_permitted`; `front_status`, `speaking` and `zone_sources` from any other credential, or for an endpoint not bound to that front, are `not_permitted` |
| GA-TIER-1 | MUST | Steward | wire | A `no_voice` action through a brain-served endpoint is `refuse(tier)`, answered or not |
| GA-TIER-2 | MUST | Steward | wire | An unanswered `confirm` or `no_voice` step is `ask(confirm_tier)` in a plan and `refused(tier)` inline |
| GA-TIER-3 | MUST | Steward | wire | A guest's step above `reversible`, and a visitor's every step, is `refuse(role)` |
| GA-CONF-1 | MUST | Steward | wire | An answer counts only for an open plan, from its own credential and endpoint, or, when the endpoint's `confirm_on` or else its brain credential's names another endpoint, only from a credential bound to that one; for a plan that named a `speaker`, an answer through a brain only naming the same one; any other is `not_permitted` and changes nothing |
| GA-CONF-2 | MUST | Steward | wire | An answer from a brain-served endpoint without an utterance record, or with one not timed after the latest `ask` event for its step less the clock tolerance or timed after the answer's arrival plus it, or whose `utterance_id`, or whose `endpoint`, `time` and `transcript`, already answered another plan, or naming a step not in the ask's `step_ids`, or, from an endpoint with a voice record, without `asked_by`, or whose `asked_by` shows a `status` other than `full` or `cut` by this utterance, or is `full` without `ended_at` or with a `time` not after it within one `clock_epoch`, is `invalid_request`; the record is kept in `history` with its step; a record without `addressed_by` counts as `follow_up` |
| GA-CONF-3 | MUST | Steward | wire | A token is issued only for a step answered `yes` or authored, bound to its target, action, args, `via`, `brain` and `for`, expiring 60 s after issue |
| GA-CONF-4 | MUST | Steward | wire | `define` refuses any change set after which a `confirm_on` names a brain-served endpoint |
| GA-CONF-5 | MUST | Steward | wire | Every plan with an ask step emits an `ask` event `{ plan_id, step_ids, steps, endpoint, time }`, its endpoint being the plan's or the `confirm_on` that applies, the endpoint's or else its brain credential's, and its `steps` one `{ step_id, target, action, args, tier, reason }` per asked step, in the order of `step_ids`, as the plan's step gives them, a `confirm_define` step's being `{ step_id, reason: confirm_define, diff }`; a run's re-ask MAY carry `run_id`; `steps` are returned, by the endpoint a read names or derives, only to a read at the ask's endpoint, one whose derived role is `owner`, or one whose derived person is the plan's `speaker`, every other read getting the event without them |
| GA-CONF-6 | MUST | Steward | wire | An answer whose record is `addressed_by: follow_up` or `skill` counts only with `hint_basis: gate` and a `speaker_hint` naming the plan's `speaker`, or any registered person for a plan that named none; against the configured record and the narrowings in force longer than the narrowing delay, `typed` outside an `app`, `skill` without a `skill_account`, `follow_up` where a voice record has it off or listening narrower than `wake_device`, `tap` where `listening` is `off`, `wake` where it is `off` or `tap`, a `gate` basis with no gate model for that person there (the front's own report, so a mistake caught, not a lie), and a `person` basis naming another than the endpoint's person, are refused; any refused one is `not_permitted` and changes nothing |
| GA-APPLY-3 | MUST | Steward | wire | An `ask` step with no `yes` at apply, or a step that becomes an ask at dispatch, is `skipped(not_confirmed)` |
| GA-GRP-1 | MUST | Steward | wire | A group's `on` follows its `any` / `all` rule over its `onoff` members |
| GA-PLAN-5 | MUST | Steward | wire | A selector resolves to exactly the devices and channels matching all its fields, never a group |
| GA-PLAN-6 | MUST | Steward | wire | A selector or a group never resolves to a device declared `infrastructure` or `internal`, or not adopted |
| GA-STW-1 | MUST | Steward | wire | `plan` changes nothing: state, leases and events are identical before and after, but for the plan's `ask` event |
| GA-STW-2 | MUST | Steward | wire | One step per distinct target, action and args after resolution; one target and action with different args is `refuse(conflict)`, except `session.lock` steps on one computer whose `account` differs, which are distinct steps |
| GA-STW-3 | MUST | Steward | wire | Steps are dispatched in request order, a selector's or group's targets in code-point order of their ids |
| GA-STW-4 | MUST | Steward | wire | When several reasons apply, the first in the steward's fixed order is reported, `in_use` and `in_use_unknown` in the occupancy place, before `occupied` and `occupancy_unknown`; the applier's `refuse(token)` on an unanswered step is reported as `ask(confirm_tier)` or `refuse(tier)`, never `token`; for `power.sleep` or `power.shutdown` on a computer with `respect_occupancy`, an `ask(in_use)` or `ask(in_use_unknown)` is reported in place of `ask(confirm_tier)`, never of `refuse(tier)`, and a `yes` to it is also the step's confirmation; the applier's `refuse(toggle_only)` is reported as `ask(toggle_only)` (inline `refused(toggle_only)`), never as a refusal, in place of any `ask(confirm_tier)`, `ask(in_use)`, `ask(in_use_unknown)` or `ask(occupancy_unknown)` the step would have, and only a `yes` to it earns the step's token |
| GA-STW-5 | MUST | Steward | wire | An expired, stale or foreign plan, given to `apply`, `define` or `answer`, is a request error; nothing is dispatched or answered |
| GA-STW-6 | MUST | Steward | wire | A repeated idempotency key from one credential returns the first apply within 3600 s with the same body, `idempotency_conflict` with another; nothing is dispatched |
| GA-STW-7 | MUST | Steward | wire | Events are kept 3600 s; a `define` event's diff is given only to a read at the `define`'s endpoint, one whose derived role is `owner` or one whose derived person is its `speaker`, personal values withheld, every other read getting the event without it; `history` returns define, ask, answer, lease, narrowed, refused, rule_fired, scenario, schedule_missed, schedule_skipped and notice events, and the applier's state, outcome, late_ack, latch, liveness, model, route_conflict, provision, freshness, transport, other_admins, bridge_fault, occurrence and undescribed events (`undescribed` as received live), with causes for 7 days, a `state` event's `speech` key and an `occurrence` of a personal key excepted, kept in events only |
| GA-STW-8 | MUST | Steward | wire | Apply re-evaluates `leased` and occupancy at dispatch, keeps the answers given, a `yes` to `ask(in_use)` or `ask(in_use_unknown)` answering the room's `occupancy_unknown` too, and passes the applier's re-evaluation through |
| GA-STW-9 | SHOULD | Steward | wire | `apply` adds no more than 200 ms to the applier's synchronous bound |
| GA-STW-10 | MUST | Steward | wire | The steward applies to its applier inline, re-planned at dispatch, one applier apply per steward apply, rule firing or run step, each with a key that survives a restart |
| GA-STW-11 | MUST | Steward | wire | A `session.lock` naming a `person` resolves to one step per account that computer maps to that person, in code-point order of their tokens, the applier receiving `account` only; a person with no account mapped there is `refuse(invalid_args)` |
| GA-STW-12 | MUST | Steward | wire | Every outcome returned by `apply`, `outcome` or `scenario_status` carries its `time`, the one its `outcome` event carries, or for the steward's own outcome the moment the steward decided it |
| GA-NOTE-1 | MUST | Steward | wire | Every applier notice is retried on the home's `notify` channels at least every 60 s and without giving up, until one ends `delivered`, or `sent` where no receipt exists, before the steward sends `notice_taken` (checked by the harness as still retrying after 7 stepped days); `define`, once the channels are set, refuses to leave them empty; a notice raised while none is set is held until one is, and while no adopted channel offers `notify` an announcing one speaks it once and it stays held until a `notify` channel delivers it; held notices coalesce per kind and target; while no adopted channel offers `notify`, `describe` shows `held_notices`, and a `define` leaving none answers `no_notify_channel: true` |
| GA-NOTE-2 | MUST | Steward | wire | While its applier's `standard_version` is below 0.10 no `notify` the steward dispatches carries `from`; from 0.10 on, every one carries its own `from`: `{ endpoint, role }` for a request or a person-started run, `{ rule }` for a rule or a rule-started run, `{ scenario }` for a scheduled run, `{ notice }` for a notice, a `{ rule }` or `{ scenario }` of `brain_authored` work with `brain_authored: true`; a caller's `from` is overwritten, never passed on, and the overwrite recorded as `from_replaced` on the plan's step or the inline step's outcome |
| GA-NOTE-3 | MUST | Steward | wire | When a token a computer's `account_persons` maps leaves its `accounts`, a notice naming the person, the token and the computer is delivered and retried as GA-NOTE-1's, once each time a mapped token leaves; the mapping is kept |
| GA-NOTE-4 | MUST | Steward | wire | When a channel in `notice_channels` leaves adoption or offers neither `notify` nor `media.announce`, and when the list loses its last adopted channel offering `notify`, a notice naming it is delivered on the remaining channels as GA-NOTE-1's, and held if none remain |
| GA-LEASE-1 | MUST | Steward | wire | An endpoint principal's apply leases each device it dispatched a stateful action to, from dispatch, ending as GA-LEASE-7 says, or if the step ends `unreachable`; a rule's later action there is `refuse(leased)`, unless it passes the hold (GA-LEASE-10, GA-LEASE-12); stateless actions, `session.lock` and narrowing actions (GA-LEASE-11) take no lease |
| GA-LEASE-2 | MUST | Steward | wire | An `external` or `load_cap` change takes a person-precedence lease, ending as GA-LEASE-7 says, one missed in any gap (a restart's or a `cursor_expired`'s) included, read back from the applier's `history`, timed by its event's `time` clamped as GA-LEASE-7 says, none taken whose end, computed by the policy over the gap's presence reports, has passed at the read-back; only a change whose keys include one that one of the device's actions sets (the key its ack is matched on; an extension action's `confirmed_by`), on an adopted device, takes one: a sensor reading, a sensor key on an actuator, and any change on a device not adopted take none; an `external` narrowing change takes one; a `device` change takes none |
| GA-LEASE-3 | MUST | Steward | wire | Equal or higher precedence replaces a lease; lower is refused; a `session.lock` is never refused by a lease and replaces none; a narrowing action is never refused by a person's hold and replaces no person's hold, and a lower or equal lease it would replace it ends (`replaced`), taking none (GA-LEASE-11); a press passes only a person's hold (GA-LEASE-9); the owner's work may pass a guest's hold (GA-LEASE-10), and passes a person's hold where a switch covers it, once its floor has passed (GA-LEASE-12); a duck while a front speaks is refused by no lease but a `safety_rule`'s |
| GA-LEASE-4 | MUST | Steward | wire | When a lease ends, the level-triggered rules it refused an action of are re-evaluated and fire, outside their exceptions, if their condition holds; rules it refused nothing of, and edge-triggered rules, are not; at a replacement, nothing is re-evaluated for the devices the new lease covers, the rules refused on them passing to it, and the rules refused on devices it does not cover are re-evaluated then |
| GA-LEASE-5 | MUST | Steward | wire | No rule's action takes a lease, but a press rule's own action on a device (GA-LEASE-9) |
| GA-LEASE-6 | MUST | Steward | wire | A device a safety rule actuated holds a `safety_rule` lease until the rule's latch clears, by itself or by the owner, or until the rule completes when it has none; held latches are re-read after `cursor_expired`, and a latchless rule's completion read from `history`; a steward MAY end a latchless rule's lease early only when it states `safety_lease_s` in `describe`, after the larger of that and, for each lease, the `ack_within_s` of the rule's actuation on that device plus the 60 s late-ack window; a level-triggered rule the applier then answers `refuse(safety)` is re-evaluated, and fires if its condition holds, when the rule's `rule_fired` is relayed |
| GA-LEASE-7 | MUST | Steward | wire | A person's hold (GA-LEASE-1, an `external` change's GA-LEASE-2, a press rule's GA-LEASE-9) ends at the first of these, not before, and not later than the hold end lateness after it: with `presence_renews`, in a room with a live presence source (an adopted device there reporting `motion` or `occupancy`), the room quiet for `on_s`, `off_s` or `other_s` by the change's direction (an apply's or press's by what its action sets, `on` true or false, every other action, and one declared `toggles`, being other; an `external` change's by what changed), counted from the later of the change and the moment the room last became quiet, a source reporting presence while `live` and reading it, a held `true` until it clears, with no `occupancy_hold_s` after it; without it, in such a room, that window from the change; with no room, or no live presence source, `fixed_s` from its anchor (the latest of the change, a move during the hold and the moment the room lost its last live source; the change when there was neither); with `cap_s` above 0, `cap_s` from the change; with `vacant_ends`, the room becoming `vacant` after the change, at the first moment GA-OCC-1's condition holds, judged continuously, `occupancy_hold_s` running out with no report included; with `schedule_ends`, a schedule's run, not `brain_authored`, dispatching a step on the device that does not pass the hold under GA-LEASE-10 or GA-LEASE-12; the device removed, unadopted or made `internal`; a replacement; an `unreachable` step; the change's time is the steward's: an apply's or press's dispatch, a live `external` or `load_cap` change's receipt, a gap's change by its event's `time`; room, sources and policy are judged as of now, a move or a source's adoption, removal or return to `live` restarting the count no earlier than then; a gap's change or presence report counts at its event's `time`, clamped to no later than the read-back and no earlier than the steward's last live reading before the gap, and a hold whose end passed in the gap ends at the restart with `end_time`; an apply's or press's hold never ends by `quiet`, `window`, `cap`, `vacant` or `schedule` before its step's success (`acked`, `delivered`, `sent`, `confirmed`; `sent` on an open-loop device) or, when none comes, its `ack_within_s` plus 60 s from dispatch: `quiet`, `window`, `cap` and `vacant` wait for the floor, and a scheduled step meeting the hold inside its floor is `refuse(leased)` and ends nothing; `expires` is the end as now computed from the windows, the cap and the floor, never earlier than the floor nor later than the change plus `cap_s` (when above 0) or the floor when later, and without `presence_renews` is the change plus the window; a `load_cap` lease ends `load_cap_s` after the change, or at removal, unadoption or `internal` (`removed`), its `expires` the change plus `load_cap_s`, its grant naming no direction and its end at the window `window`; an ended hold's `lease` event names its `end` (`quiet` with `quiet_since`, `window`, `cap`, `vacant`, `schedule` with the run, `removed`, `replaced`, `unreachable`), a replacement putting the old hold's ended event before the new lease's granted one, with `end_time` when the end fell in a restart's gap, and a granted one its direction and, for an apply's hold, its derived role |
| GA-LEASE-8 | MUST | Steward | wire | `describe`, to every reader but a front (GA-AUTH-8), shows the hold policy in force as the home's `hold`, `{ on_s, off_s, other_s, fixed_s, load_cap_s, cap_s, presence_renews, vacant_ends, schedule_ends, owner_work_passes_guest_holds, owner_work_passes_holds }`, every field present, `cap_s` `0` for none; `define` of the home's `hold` sets the fields it names, null returning one to the steward's own, accepts every window of 1 s or more and every `cap_s` of 0 or more, accepts every flag set `false`, and may refuse only setting `true` a flag the steward does not implement, never `owner_work_passes_holds` (GA-LEASE-12), with `invalid_request` whose `data.field` names the flag; a change applies at once to the holds held |
| GA-LEASE-9 | MUST | Steward | wire | A rule whose `occurrence` trigger its author marks `press: true` acts, for each of its own actions on a device that is not `brain_authored` for that device, at `person` precedence: not refused by a person's hold; refused by a `load_cap` lease, a `safety_rule` lease and a run's lease; only when its step is dispatched, and unless it is a narrowing action (which passes a person's hold and takes and replaces none, GA-LEASE-11), does it replace a person's hold, a guest's included (GA-LEASE-10 not applying), its refused rules passing on, and take a person's hold held by `{ rule, press: { target, key, value } }`, `value` the occurrence's, ending as GA-LEASE-7 says for an apply, outliving the rule's deletion, and refusing other rules and scheduled runs while it holds, but the owner's work GA-LEASE-10 or GA-LEASE-12 lets through; a rule marked both `press` and `passes_holds` acts so for its own device actions; a step `skipped` or refused leaves the earlier hold; a step ending `unreachable` ends the press's hold and restores the hold it replaced as it was (its change's time, its quiet, its derived role, its refused rules), with a granted `lease` event marked `restored: true` after the press's hold's ended one; on a personal occurrence key the hold, its `lease` events and the `holder` of a plan step it refuses are withheld as the occurrence is, and a step that passes it carries no `passed_hold` for such a reader (GA-AUTH-7, GA-LEASE-12); it stays the rule's in `via`, `for`, its author's confirmation, `brain_authored` and GA-SCN-4; its conditions still apply; a `{ scenario }` action is a rule's; a `brain_authored` step acts at `rule` precedence; `define` refuses `press` on any trigger but an `occurrence` one |
| GA-LEASE-10 | MUST | Steward | wire | A steward lets a step of a rule, a scheduled run or a rule-started run that is not `brain_authored` for the device through a guest's hold (an apply's hold whose derived role, kept with the hold and named in its granted `lease` event, was `guest`, a brain-served endpoint's with no derived person included) only when `describe` declares `owner_work_passes_guest_holds` true, and then always once that hold's floor has passed, inside which the step is `refuse(leased)`, the floor for passing also ending when the device reports the key the guest's step sets at the value it set (the report its ack is matched on), judged before any rule that report triggers: the step is not `refuse(leased)` by that hold, which stays in place and is not ended by `schedule_ends`, and takes no lease on that device; a run takes no lease on a device a guest's hold covers at its start or while that hold stands, and takes it when that hold ends mid-run; no other hold is passed under this flag, no `brain_authored` work passes, and a press rule's own action replaces a guest's hold as GA-LEASE-9 says; GA-LEASE-12 passes a guest's hold too, whatever this flag says |
| GA-LEASE-11 | MUST | Steward | wire | A narrowing action (`lock.lock`; `valve.close`; on an `onoff` `water_valve` or `gas_valve`, the `onoff` action that is not its `opens_with`; never an action declared `toggles`), whoever sends it, a press included, but a step `brain_authored` for the device, is never refused by a person's hold, replaces no person's hold and takes no lease; a step of it `brain_authored` for the device acts at `rule` precedence and passes no person's hold; against any other lease it goes by GA-LEASE-3's precedence by its principal (a press's by GA-LEASE-9): a lease it would replace it ends, with `end: replaced`, the rules that lease refused re-evaluated (GA-LEASE-4), and takes none, the device having no lease after; a lease it would not replace refuses it; no other action, a heater's `turn_on` included, is narrowing |
| GA-LEASE-12 | MUST | Steward | wire | A step of the owner's work (a rule's own action, a scheduled run's step or a rule-started run's step, none `brain_authored` for the device) passes a person's hold (an apply's, a guest's and an owner's own included; an `external` change's; a press's) where a switch covers it: the rule's `passes_holds`, for its own actions and every step of the runs its `{ scenario }` actions start and of the runs reached from those through `run` steps; the device's target's `owner_work_passes_holds`, for all the owner's work on that device; the home `hold`'s `owner_work_passes_holds`, for all the owner's work but a step that would undo a narrowing (`lock.unlock`; `valve.open`; on an `onoff` `water_valve` or `gas_valve`, its `opens_with` action, declared `toggles` or not), which only the rule's or the device's switch passes; a switch's change applying at once, to holds already held too, judged when the rule fires or the run plans the step and again at dispatch; it passes once that hold's floor (GA-LEASE-7, ending for passing also at the device's report of the value the person's step set, the report its ack is matched on, judged before any rule that report triggers; an `external` change's hold has none) has passed, inside which the step is `refuse(leased)`: the step is not `refuse(leased)` by that hold, which stays in place, keeps its end and is not ended, by `schedule_ends` neither, and takes no lease on that device; a run takes no lease on a device a hold it passes covers at its start (a hold whose floor has passed; one inside its floor refuses the step) or while that hold stands, passes a hold that replaces a passed one, once its floor has passed, and takes its lease when a passed hold ends mid-run otherwise than by a replacement, before GA-LEASE-4 re-evaluates what that hold refused; a run whose own lease a person's change replaces mid-run holds none on that device for the rest of the run; a passed hold adds nothing to its refused rules and passing re-evaluates nothing (GA-LEASE-4); a guest's hold is passed whatever `owner_work_passes_guest_holds` says; no switch passes a `safety_rule` lease, a `load_cap` lease or a run's lease; no `brain_authored` work passes, a marked rule a brain later edited and a marked rule's step `brain_authored` for a device passing nothing; a press rule's own device actions act as GA-LEASE-9 says, its `passes_holds` governing only its runs; a narrowing action goes by GA-LEASE-11; `describe` shows `passes_holds` on every rule and `owner_work_passes_holds` on every target as set, `false` where never set, and both home flags in its `hold` as set; `define` refuses none of the three as not implemented; through a brain neither a rule's nor a target's switch is set or cleared, nor a rule or a target whose switch is `true` deleted (GA-DEF-3); a passing step carries no `holder` and issues no `lease` event, and its outcome, returned or in its `outcome` event, and a run's step's plan step carry `passed_hold: { holder, switch }`, `switch` the first of `rule`, `device`, `home`, `guest` that covers it, a narrowing action and a press rule's own action carrying none; when the passed hold is a press's on a personal occurrence key, `passed_hold` is left out entirely for every reader the occurrence is withheld from, in plans, outcomes and `history` (GA-AUTH-7) |
| GA-OCC-1 | MUST | Steward | wire | With `respect_occupancy`, an occupied room (an occupancy sensor reading presence now, or a `live` motion sensor reading motion now or within the hold) is `skip(occupied)` and an unknown one `ask(occupancy_unknown)`; vacant needs an occupancy sensor and every occupancy sensor live throughout the hold with a known `fresh_s` that, with its `fresh_slack_s`, is no greater than `occupancy_hold_s`, none reporting presence within it; a target with no room is unknown; without the flag, occupancy is not consulted |
| GA-OCC-3 | MUST | Steward | wire | With `respect_occupancy`, a computer's `power.sleep` or `power.shutdown` is `ask(in_use)` when an account mapped to a person reads `active` or `idle`; else `ask(in_use_unknown)` when a mapped account reads `unknown` or its key is absent, or, with an account mapped, the computer is not `live`, and always when the computer has no `session` capability, an account mapped or not; else the room check applies as GA-OCC-1 says; unmapped accounts never count; the session check adds to the room check, never removes it; a `yes` to `ask(in_use)` or `ask(in_use_unknown)` also answers the room's `occupancy_unknown` for that step, and an `occupied` room still skips it |
| GA-LISTEN-1 | MUST | Steward | wire | `narrow` is accepted from any credential bound to the endpoint, any role, and from its front, if it asks for nothing wider than the configured record, else `invalid_request`; it holds at most the narrowing limit; the effective record is the narrowest of the configured one and every narrowing in force, and returns to the configured one, never wider, when the last expires; each narrowing, lift and expiry changes the revision |
| GA-LISTEN-2 | MUST | Steward | wire | `describe` shows each endpoint's voice record, its reported effective record, its front's models and the narrowings in force; an effective record with a reason other than `configured`, a narrowing or a mute is a notice naming the endpoint and reason, once per change of reason, `offline` after the offline grace, and so are narrowings not made from an owner's own endpoint (one whose `person` is an owner) keeping an endpoint narrowed for the narrowing notice span in a row |
| GA-LISTEN-3 | MUST | Steward | wire | `zone_sources` gives a front every `media` target in the home whose `speech` is not null, with `speaking_for_ms`, within the source delay of the applier's `state` event, and every `media.announce`, and notice spoken through a `speaker` or `tv` `notify` target, dispatched anywhere in the home, with its text, from dispatch until the target's `speech` reports that text ended or, at a target reporting no speech, for the announce hold, a later `media.announce` to it meanwhile being `refuse(conflict)` and a notice's spoken copy waiting; a listing at a target that reports speech ends at the latest the announce hold after dispatch if the text was not shown within the source delay, and the announce hold after the target's last `speech` report |
| GA-LISTEN-4 | MUST | Steward | wire | A `media.announce`, or a notice spoken through a `speaker` or `tv` `notify` target, whose text, normalised with no word removed, contains as whole words, or within the echo match of, a wake word of any endpoint or one of the home's `other_wake_words` (a default list, which the owner edits) is `refuse(invalid_args)`, the near-spelling test taking the listed word as the transcript; while an `ask` at a brain-served endpoint is open (from its `ask` event until answered, applied or expired), one whose text contains a run of `answer_words` is `refuse(invalid_args)`, a notice's spoken copy waiting at most `ask_expiry_s` and checked again at dispatch |
| GA-LISTEN-5 | MUST | Steward | wire | A steward that ducks for a front ducks only a target whose `media.duck` is `reversible` and not declared `toggles`, and no device another cause ducked, un-ducks only what it ducked, and does so on `on: false`, a lost connection, or the duck limit without word |
| GA-LISTEN-6 | SHOULD | Steward | wire | `define` of a name, alias or scenario name that contains a wake word of any endpoint or a word in `other_wake_words`, or a run within the echo match of one, raises a notice |
| GA-RULE-1 | MUST | Steward | wire | A level-triggered rule fires once per becoming true, the end of a lease that refused it counting as one, and after a restart or `cursor_expired` fires once, outside its exceptions, if its condition holds and it has not fired for it, a held-duration trigger only once it has held for the whole duration afresh since a restart, a firing a lease refused not counting as fired; the gap is every event from before the steward resumed, however it arrives; an edge from the gap is lost, unless the steward, having stated `edge_replay_s` (at most 300 s) in `describe`, replays it once per edge, every rule it triggers seeing it, conditions judged now: only a state edge, never a time trigger, no older than `edge_replay_s`, while its reading still holds, not one inside an exception, and not one whose `rule_fired` is already in `history`; a steward that omits `edge_replay_s` replays none |
| GA-RULE-2 | MUST | Steward | wire | A rule's conditions, whole, are false while a device they read is not `live`; a state or held-state trigger does not hold over such a device, and a held duration restarts once it is live; a rule or a scenario's `if` reading a device with no known `fresh_s`, or an owner `fresh_s` longer than the declared one, is a notice at `define` and at the device's adoption; no condition (a rule's, an `if`'s, a `wait`'s) holds on an `assumed` value |
| GA-RULE-3 | MUST | Steward | wire | A `between` window holds from `from` up to `until` in the home's timezone, on the next day when `until` is not later, `days` naming the day it starts; a time in a daylight-saving gap takes the first minute after, one that occurs twice its first occurrence; entering it is becoming true; `define` refuses a window whose `from` equals its `until` |
| GA-RULE-4 | MUST | Steward | wire | `not_in` is true when the key reads none of its values, `unknown` (unless listed) and an absent key included; a `session.<token>` key retired from the computer's `accounts` (GA-BRIDGE-52) makes every condition that reads it, `not_in` included, read false instead, so a rule on a retired account stops firing |
| GA-RULE-5 | MUST | Steward | wire | A rule of conditions only is level-triggered, held for 0 s: it fires when its conditions become true together and again each time they do after being false |
| GA-RULE-6 | MUST | Steward | wire | A rule never fires inside one of its exceptions; when one ends, a level-triggered rule whose condition holds fires; `define` refuses an exception whose `until` is not after its `from` |
| GA-RULE-7 | MUST | Steward | wire | An action of a rule of conditions only, declared idempotent, that ends `skipped(dead)`, `unreachable` or `failed(no_ack)` while the conditions hold is fired again, no sooner than its `ack_within_s` after its last try and no later than 300 s after it, or, when its `ack_within_s` is longer than 300 s, its `ack_within_s` plus 60 s, until it ends in success or the conditions stop holding; one that ends `unanswered` on a `feedback: open` device is fired again once, at the same spacing, and then no more while the conditions hold; no other outcome, and no action that is not idempotent, is fired again |
| GA-RULE-8 | MUST | Steward | wire | An action of a rule of conditions only that ends, while the conditions hold, in an outcome neither a success GA-RULE-7 names nor one it fires again for raises a notice naming the rule, the action, its target and the outcome, delivered and retried as GA-NOTE-1's, at most once for that action per becoming true; `refused(leased)`, `refused(safety)` after the steward ended a safety lease early, `skipped(occupied)` and `skipped(in_use)` raise none; a `failed(not_locked)` raises it only once the lock's `ack_within_s` from its dispatch and the late-ack slack pass with no `late_ack`, a `failed(no_graphical_session)` at once, and a `failed(no_ack)` only once the 60 s late-ack window after it and the late-ack slack pass with none, a held notice raised even if the conditions stop holding during the wait; `skipped(toggle_only)` raises none, the steward issuing one notice for a rule, or a schedule whose scenario (or one its `run` steps reach) acts on an action declared `toggles: true` on a `feedback: open` device, at its `define`, when such an action comes into its selector, and when a declaration change makes an action it names one; a steward MAY coalesce the `skipped(occupancy_unknown)` notice to one per rule and room (per rule and target for a target with no room) while that room's occupancy stays unknown, naming the action and target it was first raised for, the next one after it was known again raising it again |
| GA-SCN-1 | MUST | Steward | wire | A run honours its scenario's mode; a start `single` ignores returns the running run with `ignored` |
| GA-SCN-2 | MUST | Steward | wire | A running scenario leases its owned targets, groups expanded except `infrastructure` members, a device whose person's hold the run passes only once that hold ends (GA-LEASE-10, GA-LEASE-12), and releases only its own leases when it ends |
| GA-SCN-3 | MUST | Steward | wire | A person-started run acts as that person: its `no_voice` steps through a brain are refused; a guest's steps above `reversible` are refused; unanswered asks are `skipped(not_confirmed)`; a yes stands for the whole run, except a yes to `ask(toggle_only)`, which stands for `ask_expiry_s` after it was given, a toggle step dispatched later asked again and `skipped(not_confirmed)` without a new `yes`; a run started at an endpoint names it in its cause |
| GA-SCN-4 | MUST | Steward | wire | A scheduled run, a rule-started run and a rule's own action turn `ask(occupancy_unknown)`, `ask(in_use)` and `ask(in_use_unknown)` into the matching `skip`, and a step the applier plans `refuse(toggle_only)` into `skip(toggle_only)`, whatever its tier; a scheduled run's and rules' `confirm` and `no_voice` steps count as authored, never as answering a toggle |
| GA-SCN-5 | MUST | Steward | static | Every scenario declares exactly one mode, one the steward lists |
| GA-SCN-6 | MUST | Steward | wire | `scenario_plan` gives one step per action step in order; a repeated `scenario_run` key within 3600 s returns the first run and starts nothing |
| GA-SCN-7 | MUST | Steward | wire | A run re-evaluates every step at its dispatch, the first included, occupancy too; an unanswered ask found then is `skipped(not_confirmed)`, an answered one stands |
| GA-SCN-8 | MUST | Steward | wire | An `if` step evaluates its condition when reached and runs at most one branch, none on a target that is not live, or on an `assumed` value, without an `else`, the step then ending `skipped(dead)`, `skipped(stale)` or, on an `assumed` value, `skipped(assumed)`, in `failed_steps` |
| GA-SCN-9 | MUST | Steward | wire | `scenario_stop` by a role lower than that of the person who started the run is `not_permitted`, and so is a visitor's of a run no person started; a stopped run ends `ended(stopped)` |
| GA-SCN-10 | MUST | Steward | wire | A timed-out `wait` ends the run with `stop` and continues with `continue`, recorded either way |
| GA-SCN-11 | MUST | Steward | wire | `scenario_status` leaves `skipped(occupied)` and `skipped(in_use)` out of `failed_steps`, and lists `skipped(occupancy_unknown)`, `skipped(in_use_unknown)`, `skipped(not_confirmed)` and `skipped(toggle_only)` in it |
| GA-SCHED-1 | MUST | Steward | wire | A schedule exception suppresses or moves exactly that date's run |
| GA-SCHED-2 | MUST | Steward | wire | A run missed, however the time passed it (the steward down, or its clock stepped past it), is not run late and is recorded as `schedule_missed` |
| GA-SCHED-3 | MUST | Steward | wire | A scheduled time in a daylight-saving gap runs at the first minute after; one that occurs twice runs once |
| GA-DEF-1 | MUST | Steward | wire | `define` with `dry_run` changes nothing and returns a diff |
| GA-DEF-2 | MUST | Steward | wire | `define` at a stale revision, or for a plan made at one, returns `stale_revision` and changes nothing |
| GA-DEF-3 | MUST | Steward | wire | `define` is an owner's from an endpoint not served by a brain; through a brain, persons, endpoints, voice records, credentials, home settings, a rule's `passes_holds` and a target's `owner_work_passes_holds` are never changed (set or cleared; a rule whose `passes_holds` or a target whose `owner_work_passes_holds` is `true` never deleted) nor a narrowing lifted, a change set touching any of them `not_permitted` at the call, before any plan, whole and changing nothing, `narrow` being the one exception; anything the steward does not accept is `not_permitted` |
| GA-DEF-4 | MUST | Steward | wire | `define` refuses scenarios whose `run` steps form a cycle, with `cycle` |
| GA-DEF-5 | MUST | Steward | wire | A `define` change set applies whole or not at all |
| GA-DEF-6 | MUST | Steward | wire | `define` through a brain returns a plan with `ask(confirm_define)`; unanswered, it changes nothing |
| GA-DEF-7 | MUST | Steward | wire | A `brain_authored` step whose effective tier at dispatch is above `reversible` is `refuse(tier)`, gets no authored token, and is sent with `brain: true`; a run that `brain_authored` work starts, or whose date a brain moved, is `brain_authored`; a step of a scenario defined or changed through a brain is `brain_authored` whoever starts it, a run the owner's work starts or reaches through a `run` step included; and so is an authored step reaching a device through a room or group the device joined through a brain |
| GA-DEF-8 | MUST | Steward | wire | `define` refuses a voice endpoint, or any endpoint with a voice record, without `served_by`; an `app` endpoint without a `person`; a voice record whose `heard_by` names no front credential; voice records naming more than one front; a `skill_account` on an endpoint that is not `type: voice` or has a `person`; two endpoints with one `skill_account` and `skill_surface`; one account with both a surfaced endpoint and one without; an endpoint with a null `room` that is not an `app`; `notice_channels`, once set, left empty; and a channel in it that is not adopted or offers neither `notify` nor `media.announce`; while `notice_channels` has never been set, a change set is not refused for its being empty |
| GA-DEF-9 | MUST | Steward | wire | `define` refuses, with `invalid_request`, a change set naming a device the applier has not adopted |
| GA-DEF-10 | MUST | Steward | wire | `define` refuses, with `invalid_request`, a change set putting an `internal` device in a room or a group, or naming one as a target of a scenario's or a rule's action |
| GA-DEF-11 | MUST | Steward | wire | `define` sets a computer's `account_persons` as account token to person id, a field apart from the applier's `accounts`, which `describe` passes through unchanged beside it; it refuses, with `invalid_request`, `account_persons` on a target that is not a `computer` or naming a person not registered |
| GA-DEF-12 | MUST | Steward | wire | `define` refuses, with `invalid_request` and changing nothing, a change set whose rules or scenarios that it adds or changes have a trigger or conditions, an `if` or a `wait` that reads a key its device does not declare (as *Rules* defines declaring, a trigger's extension `event` keys included), the devices being those its triggers, conditions, `if` and `wait` steps name, its `data` `{ key, device, awaited }`, `awaited` true where the device's `awaited_keys` lists the key |
| GA-DEF-13 | MUST | Steward | wire | `define` refuses, with `invalid_request` and changing nothing, a change set with a change that does not match *Change sets*: an unknown `op` or `kind`, a field its kind does not name, a value not of its kind's shape, a credential's `secret` under 16 characters, or more than 64 exceptions on a rule or a schedule |
| GA-DEF-14 | MUST | Steward | wire | An upsert sets only the fields it names, a field left out keeping its value, a null one returning to its default and a named list replaced whole; an upsert that creates an item gives its kind's created-with fields, none null; a delete removes the item its key names, and a delete of one that does not exist is `invalid_request` |
| GA-SEC-2 | MUST | Steward | wire | Every connection uses TLS, with the server's certificate validated, unless both ends are on one host's loopback |
| GA-BIND-2 | MUST | Steward | wire | The steward serves MCP protocol revision `2026-07-28` to every caller, answering no revision but that one, `2025-06-18` and `2025-11-25`; it reaches its applier at `2026-07-28` where the applier serves it, and falls back, to one of those two only, for an applier that does not |
| GA-HARN-2 | MUST | Steward | wire | Under the harness, the steward takes all time, elapsed time included, from the `time_source` set by `define`, and honours the harness stepping it; `time_source` is accepted only while its applier reports a `test_run_id` |
| GA-PERSIST-2 | MUST | Steward | wire | The house model, leases with the rules each refused and a person's hold with its change's time, direction, holder's derived role and the moment its room last became quiet as wall-clock instants, a presence report read back from the gap counting at its event's `time`, a hold whose end passed in the gap ended at the restart with `end_time` and not revived, the applier cursor and the time of the last applier event, idempotency keys and the counters they are made from, open plans with an `ask` step and their answers, history, schedules' last runs, and every notice of the steward's own not yet delivered (those GA-RULE-8 holds for a late ack, and those held for want of a channel, included) survive a restart, a plan with no ask possibly lost, `apply` and `answer` of it then `unknown_plan`; an interrupted run ends `ended(interrupted)` |

## Conformance

The harness drives the steward as its clients (a brain, a panel, an app), over a reference applier on
the applier harness's simulated home, and watches what reaches that applier: the actions, their
`via` and `for`, and their tokens. The steward MUST take its clock from the harness (GA-HARN-2): the
harness gives it `time_source`, an NTP server, through the owner's `define` of the home's settings,
which accept `time_source` only while the steward's applier reports a `test_run_id`. The steward
takes all time from it, elapsed time included, and honours the harness stepping it, as the applier
does (GA-HARN-1); and the
steward then reports the same `test_run_id`. The
run-id guard, negative subjects and exit rules are the applier standard's (*Conformance*). The
harness checks GA-NOTE-1's "never giving up" as a notice still retried after 7 days of stepped
time. The
harness tests the hold policy the steward declares, not a value of its own: it reads the home's
`hold` from `describe`, may shorten its windows through `define` (GA-LEASE-8), and steps the
scripted presence sensors and the time (GA-HARN-2), checking that each hold ends when the declared policy says, not before and not later than the hold end lateness (*Constants*) after it (GA-LEASE-7). The **pinned policy** is windows: `on_s` 3600, `off_s`
600, `other_s` 3600, `fixed_s` 3600, `load_cap_s` 3600 and `cap_s` 0, set through `define` one field at a time, and flags: `presence_renews` `true`, which the subjects on renewal rest on, and every other flag of the home's `hold` `false` (`vacant_ends`, `schedule_ends`, `owner_work_passes_guest_holds`, `owner_work_passes_holds`), each set in a call of its own; a flag's `false` is always accepted (GA-LEASE-8), and a refused `true` skips, and says, only the subjects that rest on it, and `owner_work_passes_holds` no steward refuses (GA-LEASE-12). Every negative subject on GA-LEASE-7, GA-LEASE-9, GA-LEASE-10 and GA-LEASE-12 runs under it, so that its result does not rest on the steward's own windows, flags or switches; a
subject whose row needs a flag otherwise (`vacant_ends`, `schedule_ends`, `owner_work_passes_guest_holds` or `owner_work_passes_holds` true, `presence_renews` false) sets that flag through `define`, as it sets the windows, in a call of its own, and is skipped, and said, only when the steward refuses the flag (GA-LEASE-8), so that no refused flag rejects the pinned windows. The reference steward refuses `schedule_ends: true`, so against it the subjects on `schedule_ends` are skipped, and said. A subject on a rule's `passes_holds` or a target's `owner_work_passes_holds` sets it through `define` as it defines the rule or the target; the harness never skips a subject on GA-LEASE-12's switches, which no steward may refuse. A subject on the cap sets `cap_s` itself, as a window. The harness's summary says how
many subjects it skipped, and why. The harness reaches the hold policy, the trigger's `press`, the `{ rule, press }` principal and
GA-LEASE-12's switches and `passed_hold` through the schemas, which carry them before the harness pins
a policy. The
harness reaches the steward at `2026-07-28` where it serves it, and otherwise at `2025-11-25` or
`2025-06-18` if it answers one; the reference applier serves all three and records which the
steward used.

### Negative subjects

| Subject | Breaks | May also fail | Why those |
|---|---|---|---|
| `trusts-asserted-via` | GA-AUTH-1 | GA-TIER-1 | A brain that claims a panel's endpoint reaches `no_voice` |
| `unlocks-by-voice` | GA-TIER-1 | GA-SCN-3 | A voice-started run is the same check |
| `takes-any-answer` | GA-CONF-1 | GA-CONF-3 | A wrongly accepted yes earns a token |
| `reuses-an-utterance` | GA-CONF-2 | GA-CONF-3 | A reused yes earns a token |
| `takes-any-speaker` | GA-AUTH-2 | GA-TIER-3 | A named owner lifts a guest's role |
| `app-without-person` | GA-DEF-8 | GA-AUTH-2 | The endpoint then has no role to derive |
| `skips-the-ask-event` | GA-CONF-5 | — | |
| `asks-without-the-steps` | GA-CONF-5 | — | The `ask` event for an IR TV's `onoff.turn_off` names it by `step_ids` only, with no `steps`, so the asked app cannot say what it confirms |
| `serves-the-confirm-on` | GA-CONF-4 | GA-CONF-1 | A brain then answers the app's asks |
| `answers-unasked-steps` | GA-CONF-2 | GA-CONF-3 | The extra yes earns a token |
| `authors-a-moved-device` | GA-DEF-7 | GA-CONF-3, GA-SCN-4 | An owner's step reaches the moved device with an authored token |
| `trusts-any-applier` | GA-SEC-2 | — | |
| `speaks-only-2025` | GA-BIND-2 | — | It answers only `2025-11-25`, through its `initialize` handshake, statelessly; the harness, as a client may, falls back to it, so nothing else fails |
| `calls-its-applier-at-2025` | GA-BIND-2 | — | It reaches the reference applier, which serves `2026-07-28`, through the `2025-11-25` handshake |
| `tokens-without-a-yes` | GA-CONF-3 | GA-TIER-2, GA-APPLY-3 | An unasked step then runs |
| `vacant-on-a-slow-sensor` | GA-OCC-1 | — | |
| `rule-on-stale-reading` | GA-RULE-2 | — | |
| `rule-on-an-assumed-value` | GA-RULE-2 | — | A rule «when the IR air conditioner is on» fires on the value the applier assumed from its last command |
| `defines-unadopted` | GA-DEF-9 | — | |
| `defines-on-an-undeclared-key` | GA-DEF-12 | — | A rule on `temperature` of a sensor that declares none is accepted |
| `hides-the-awaited-key` | GA-DEF-12 | — | A rule on a key the test applier's device lists in `awaited_keys` is refused with `awaited` false |
| `widens-by-narrowing` | GA-LISTEN-1 | — | |
| `lifts-for-anyone` | GA-DEF-3 | GA-LISTEN-1 | A lifted narrowing leaves a wider effective record |
| `hides-the-fallback` | GA-LISTEN-2 | — | |
| `deaf-to-sources` | GA-LISTEN-3 | — | |
| `announces-the-wake-word` | GA-LISTEN-4 | GA-CONF-6 | A speaker's «Галатея, да» may then answer as a person |
| `front-plans` | GA-AUTH-8 | — | |
| `unducks-anything` | GA-LISTEN-5 | — | |
| `follow-up-yes` | GA-CONF-6 | GA-CONF-3 | The television's yes earns a token |
| `visitor-acts` | GA-TIER-3 | GA-SCN-3 | A visitor-started run is the same check |
| `ignores-leases` | GA-LEASE-1, GA-LEASE-3 | GA-STW-8, GA-LEASE-2, GA-LEASE-4, GA-LEASE-6, GA-SCN-2 | Every lease is held and tested by the same code. The `session.lock` exception is exercised by the conforming run (a lock after a person's apply on the laptop), not by a subject of its own |
| `reads-through-any-endpoint` | GA-AUTH-6 | GA-AUTH-7 | A brain naming an endpoint it is not bound to reads as that endpoint's role |
| `shows-a-guest-the-session` | GA-AUTH-7 | — | It withholds in `state` and leaks in `rule_fired` and `events` |
| `shows-a-visitor-the-session` | GA-AUTH-7 | — | It withholds from a guest and returns `session.*` to a read naming an endpoint whose `max_role` is `visitor` |
| `shows-the-if-reading` | GA-AUTH-7 | — | A guest's `scenario_status` of a run whose `if` read `camera_in_use` shows the value read, not only the branch taken |
| `times-the-camera` | GA-AUTH-7 | — | It withholds every value but keeps a guest's `state` events of `camera_in_use`, whose times give the values back |
| `sleeps-an-unknown-session` | GA-OCC-3 | GA-STW-4 | It reads `unknown` as free, and so reports no reason |
| `asks-the-tier-over-the-session` | GA-STW-4 | — | An unanswered `power.shutdown` with `respect_occupancy`, on a PC whose mapped session reads `idle`, is planned `ask(confirm_tier)` |
| `asks-the-tier-after-the-session` | GA-STW-4 | — | A `yes` to `ask(in_use)` on an unanswered `power.shutdown` earns no token, so the step is refused at the applier |
| `refuses-the-toggle` | GA-STW-4 | — | The applier's `refuse(toggle_only)` on an IR TV's `onoff.turn_off` is reported as a refusal, not as `ask(toggle_only)` |
| `folds-the-toggle-into-the-tier` | GA-STW-4 | — | An unanswered `onoff.turn_off` on an IR TV whose tier the owner raised to `confirm` is planned `ask(confirm_tier)`, and a `yes` to it earns the token |
| `sleeps-the-film` | GA-OCC-3 | GA-OCC-1 | A kiosk with no mapped account in an occupied room is put to sleep: the session check replaced the room check |
| `asks-the-room-after-the-session` | GA-OCC-3 | GA-STW-8 | Ольга's `yes` to `ask(in_use)` for a desktop in a room with no sensor ends `skipped(not_confirmed)` at dispatch |
| `yes-overrides-the-room` | GA-OCC-3 | — | A `yes` to `ask(in_use)` puts to sleep a PC in a room whose `occupancy` sensor reads presence |
| `vacant-without-a-room` | GA-OCC-1 | GA-OCC-3 | A laptop with `room` null and every mapped session `locked` is put to sleep under `respect_occupancy` with no `ask(occupancy_unknown)` |
| `sleeps-a-sessionless-pc` | GA-OCC-3 | — | A computer with no `session` capability and no account mapped, in a vacant room, is put to sleep under `respect_occupancy` with no `ask(in_use_unknown)` |
| `lets-the-schedule-ask` | GA-SCN-4 | GA-APPLY-3 | A scheduled run's `ask(in_use)` then ends `skipped(not_confirmed)` |
| `lets-the-rule-ask` | GA-SCN-4 | GA-APPLY-3 | A rule's own `power.sleep` with `respect_occupancy`, on a PC whose mapped session reads `active`, ends `skipped(not_confirmed)` and is counted a failure |
| `fails-a-pc-in-use` | GA-SCN-11 | — | |
| `passes-a-skipped-toggle` | GA-SCN-11 | — | A scheduled run's `skipped(toggle_only)` is left out of `failed_steps` |
| `authors-a-toggle` | GA-SCN-4 | GA-CONF-3 | A rule's `confirm` step on an action declared `toggles: true` is dispatched with an authored token, which answers the toggle too |
| `branches-on-an-assumed-value` | GA-SCN-8 | — | An `if` on the IR air conditioner's assumed `on` runs its `then` branch |
| `stales-an-assumed-if` | GA-SCN-8 | — | An `if` on the IR air conditioner's assumed `mode`, with no `else`, ends `skipped(stale)` |
| `toggles-on-an-old-yes` | GA-SCN-3 | — | A person-started run's step on the IR TV's `onoff.turn_off` is dispatched after a `delay`, 400 s after its `ask(toggle_only)` was answered `yes`, with no new ask |
| `drops-the-starting-endpoint` | GA-SCN-3 | — | A run started at the hall panel with no person is dispatched with a `for` naming no `endpoint` |
| `locks-every-session` | GA-STW-11 | — | A person's lock locks every account on the computer |
| `conflicts-two-accounts` | GA-STW-2 | GA-STW-11 | A lock of a person with two accounts mapped on one computer, or a rule locking two people's sessions there, is `refuse(conflict)` |
| `outcome-without-a-time` | GA-STW-12 | — | `outcome` returns a wake's `acked` with no `time`, so a brain that polls cannot start its window |
| `forgets-a-retired-account` | GA-NOTE-3 | — | A mapped account's token leaves the laptop's `accounts`, and no notice names the person, though the laptop's sleep under `respect_occupancy` now asks or fails every time |
| `trusts-the-callers-from` | GA-NOTE-2 | — | A guest's `from: { notice }` reaches the screen |
| `sends-from-to-an-old-applier` | GA-NOTE-2 | GA-NOTE-1 | Over a simulated applier whose `standard_version` is 0.8 and which refuses the unknown argument, a notice's `notify` carries `from`, and the notice is never taken |
| `selects-internal` | GA-PLAN-6 | GA-DEF-10 | A relay's entry joins a selector and a room's group |
| `rooms-an-internal-device` | GA-DEF-10 | — | |
| `rules-a-wake-relay` | GA-DEF-10 | — | A rule whose action is `power.wake` on a relay's entry, by its id, is accepted, and sends a bare magic packet whenever it fires |
| `maps-an-unknown-person` | GA-DEF-11 | — | |
| `window-on-the-end-day` | GA-RULE-3 | — | Sunday-to-Thursday 21:00–07:00 runs Saturday evening to Thursday morning |
| `not-in-skips-unknown` | GA-RULE-4 | GA-RULE-5 | An unlocked session with its helper killed escapes the limit |
| `fires-on-a-retired-token` | GA-RULE-4 | GA-RULE-7, GA-RULE-8 | Лиза's account is retired mid-window, and `session.lock { account: liza }` is fired again every 300 s all night with no account left to lock |
| `conditions-fire-once` | GA-RULE-5 | GA-RULE-1 | The limit fires on the window's entry and never again that night |
| `fires-in-an-exception` | GA-RULE-6 | GA-RULE-5 | The granted half hour is locked all the same |
| `locks-once-and-gives-up` | GA-RULE-7 | GA-RULE-5 | A lock that ends `failed(no_ack)` while the session stays open is never tried again that night |
| `retries-hours-later` | GA-RULE-7 | GA-RULE-5 | A lock that ended `failed(no_ack)`, with `ack_within_s` 10, is fired again only an hour later while the session stays open |
| `leaves-it-unanswered` | GA-RULE-7 | — | An IR air conditioner's idempotent `turn_off` from a rule of conditions only ends `unanswered` and is never sent again while the conditions hold |
| `retries-a-shutdown` | GA-RULE-7 | — | A rule's `power.shutdown { delay_s }` that ended `failed(no_ack)` is fired again, and the countdown restarts; its `failed(invalid_request)` is fired again every `ack_within_s` |
| `fails-the-limit-silently` | GA-RULE-8 | — | A lock that ends `failed(not_locked)` while Лиза's session stays `active` raises no notice, and the limit fails unseen that night |
| `notices-a-slow-lock` | GA-RULE-8 | — | A lock that ends `failed(not_locked)` and has a `late_ack` 3 s later, within its `ack_within_s`, raises a notice that Лиза's limit failed |
| `holds-an-ssh-only-lock` | GA-RULE-8 | — | A lock for an account logged in over SSH only ends `failed(no_graphical_session)`, and the notice comes only once its `ack_within_s` has passed |
| `times-the-lock` | GA-RULE-8 | — | A lock for an account with a graphical session ends `failed(not_locked)` 1 s after its dispatch, and the notice comes at once, before its `ack_within_s` has passed |
| `drops-a-held-notice` | GA-RULE-8 | — | A lock ends `failed(not_locked)`, the rule's window closes 5 s later, and no notice comes once the wait has passed with no `late_ack` |
| `schedules-a-toggle-silently` | GA-RULE-8 | — | `define` accepts a schedule whose scenario reaches the IR TV's `onoff.turn_off` through a `run` step, and no notice comes |
| `re-declares-a-toggle-silently` | GA-RULE-8 | — | A rule names a TV by id, whose `onoff.turn_off` its bridge re-declares `toggles: true`, and no notice comes |
| `notices-a-slow-late-ack` | GA-RULE-8 | — | A non-idempotent action's `late_ack`, made 59 s after its `failed(no_ack)`, reaches the steward 3 s later, and a notice is raised |
| `notices-every-skipped-toggle` | GA-RULE-8 | — | A rule of conditions only on the IR TV's `onoff.turn_off` raises a notice at each firing that ends `skipped(toggle_only)` |
| `defines-a-toggle-rule-silently` | GA-RULE-8 | — | `define` accepts a rule acting on the IR TV's `onoff.turn_off`, and no notice comes |
| `forgets-a-held-notice` | GA-PERSIST-2 | GA-RULE-8 | The steward restarts inside a `failed(no_ack)`'s late-ack window, and no notice comes after it closes, which is also GA-RULE-8's notice missing |
| `notices-a-late-launch` | GA-RULE-8 | — | A rule's `media.launch` that ends `failed(no_ack)` and has a `late_ack` 20 s later raises a notice that it failed |
| `notices-every-lease` | GA-RULE-8 | — | A rule's action `refused(leased)` raises a notice, though the lease's end re-evaluates it |
| `coalesces-a-failed-lock` | GA-RULE-8 | — | A lock that ends `failed(not_locked)` on a second night raises no notice, coalesced with the first night's as only `skipped(occupancy_unknown)`'s may be |
| `replays-on-old-conditions` | GA-RULE-1 | — | After a `cursor_expired`, a motion edge from the gap fires the night light's rule, judged by the conditions at the edge, though its window has closed since |
| `re-fires-at-every-lease-end` | GA-LEASE-4 | GA-RULE-1 | A level-triggered rule that fired, and whose condition still holds, fires again when a person's lease on its device ends, though the lease refused nothing of it |
| `ends-a-safety-lease-early` | GA-LEASE-6 | — | A latchless safety rule's lease on a valve ends, by its `lease` event, before its actuation's `ack_within_s`, the late-ack window and the late-ack slack have passed |
| `forgets-a-safety-refusal` | GA-LEASE-6 | — | After a latchless safety lease ended early, a level-triggered rule's action on the valve is `refuse(safety)`, and when the rule's `rule_fired` is relayed the rule is not re-evaluated, though its condition holds |
| `forgets-a-replaced-lease` | GA-LEASE-4 | GA-RULE-1 | HS3: a hand on the switch leases the hall light and refuses the off rule, and a second touch replaces the lease; either the off rule is re-evaluated at the second touch (a `refused` event in `history`), or, when the second lease ends, it is not re-evaluated and the light stays on |
| `replays-undeclared` | GA-RULE-1 | — | A steward whose `describe` has no `edge_replay_s` replays a motion edge from a `cursor_expired` gap |
| `replays-a-time-trigger` | GA-RULE-1 | — | A rule triggered at 07:00 fires at 07:02, after a restart whose gap held 07:00 |
| `broadcasts-the-steps` | GA-CONF-5 | — | A guest panel's `events` show the `steps`, with a `notify` text, of an ask put to a member's app |
| `takes-a-short-secret` | GA-DEF-13 | — | `define` accepts a credential whose `secret` has 8 characters |
| `keeps-a-dead-channel-quiet` | GA-NOTE-4 | — | With a phone and a second `notify` channel listed, the owner forgets the phone through the applier's `configure`, and no notice on the second channel says the phone's channel is gone |
| `hides-the-held-notices` | GA-NOTE-1 | — | With only a speaker's `media.announce` as channel, `describe` shows no `held_notices` while a leak notice is held |
| `forgets-an-unsent-notice` | GA-PERSIST-2 | GA-NOTE-1 | A notice held for want of a channel is gone after a restart, and is never delivered once the first `notify` channel is set |
| `renames-away-the-room` | GA-DEF-14 | GA-OCC-3 | An upsert of a computer's `target` naming only `{ id, name }` clears its `room` and `account_persons` |
| `drops-confirm-on` | GA-DEF-14 | GA-CONF-1 | An upsert renaming a satellite's `endpoint` resets its `confirm_on` to `same` |
| `deletes-the-missing` | GA-DEF-14 | — | A delete of a room that does not exist is accepted |
| `ends-a-safety-lease-undeclared` | GA-LEASE-6 | — | A steward whose `describe` has no `safety_lease_s` ends a latchless safety lease before the rule's `rule_fired` |
| `hides-no-notify-channel` | GA-NOTE-1 | — | A `define` that sets `notice_channels` to a speaker's `media.announce` alone answers without `no_notify_channel: true` |
| `lease-end-fires-in-an-exception` | GA-LEASE-4 | GA-RULE-6 | A lease that refused HS20's limit ends inside the granted half hour, and the lock is fired |
| `replays-a-fired-edge` | GA-RULE-1 | — | A motion edge whose `rule_fired` is in `history` from before a crash is replayed after the restart, and the rule's `notify` is sent twice |
| `runs-a-stepped-schedule` | GA-SCHED-2 | — | The harness steps the clock past 07:00, and the 07:00 schedule runs at 07:05 |
| `forgets-a-restart-hand` | GA-LEASE-2 | — | An `external` change made while the steward was down takes no lease after the restart, and a rule turns the lamp back |
| `sleeps-a-dead-pc` | GA-OCC-3 | — | A `dead` computer with a mapped account whose last key read `locked`, in a vacant room, has its `power.sleep` planned with no `ask(in_use_unknown)` |
| `fires-before-the-duration` | GA-RULE-1 | — | After a restart, «no motion in the hall for 180 s → light off» fires at once, though the steward has read the hall's sensor for only 10 s since |
| `broadcasts-the-diff` | GA-STW-7 | — | A guest panel's `events` show the diff of the owner's `define` made at her app |
| `visitor-stops-a-schedule` | GA-SCN-9 | — | A `scenario_stop` from an endpoint whose `max_role` is `visitor` ends a scheduled run |
| `refuses-the-first-define` | GA-DEF-8 | — | A fresh steward refuses a first change set that adds a room and names no notice channel |
| `refuses-an-announcing-channel` | GA-DEF-8 | — | A first change set whose `notice_channels` names only a speaker with `media.announce` is refused |
| `loses-an-early-notice` | GA-NOTE-1 | — | A notice raised before any channel is set is never delivered once the first `notify` channel is set |
| `asks-with-personal-args` | GA-AUTH-7 | — | An ask put to the hall panel, whose derived role is `guest`, carries in its `steps` the value a step sets on a key the owner marked personal, which the panel's `state` withholds |
| `replays-past-its-bound` | GA-RULE-1 | — | After a `cursor_expired`, an edge older than the `edge_replay_s` the steward's `describe` states fires its rule |
| `never-notices-again` | GA-RULE-8 | — | A rule's `skipped(occupancy_unknown)` in a room that was known in between raises no notice, coalesced with the one before |
| `takes-a-silent-channel` | GA-DEF-8 | GA-NOTE-1 | `define` accepts `notice_channels` naming a lamp, which offers neither `notify` nor `media.announce`, beside a `notify` channel |
| `ends-a-hold-while-busy` | GA-LEASE-7 | GA-LEASE-4 | Under the pinned policy, a member switches the lamp on from her app in a room whose motion sensor reads motion for 30 s every 600 s; the hold ends 3600 s after the change, though the room was never quiet that long, and the off rule fires |
| `never-ends-a-quiet-hold` | GA-LEASE-7 | GA-LEASE-4 | Under the pinned policy, the room has been quiet for 3600 s after an on change, and the hold, and the off rule it refused, still wait |
| `same-window-both-ways` | GA-LEASE-7 | — | Under the pinned policy, a hold after a switch-off ends only after 3600 s of quiet, not 600 s |
| `renews-on-a-dead-sensor` | GA-LEASE-7 | — | Under the pinned policy, the room's only motion sensor goes `stale` while reading motion, and the hold outlasts the later of the change and the moment it went stale, plus `fixed_s` 3600 |
| `vacant-ends-a-remote-hold` | GA-LEASE-7 | GA-LEASE-4 | Under the pinned policy, with `vacant_ends` set true, the owner switches on a lamp in a room `vacant` already, and the hold ends at the floor |
| `ends-a-hold-before-the-ack` | GA-LEASE-7 | GA-LEASE-1 | Under the pinned policy with every window set to 1 s, a rule's action reaches the lamp after dispatch and before the member's `turn_on` is acked |
| `renews-a-capped-heater` | GA-LEASE-7 | — | Under the pinned policy, a `load_cap` lease on the heater is renewed by motion in its room past 3600 s, or ends when `fixed_s` alone is set to 20 s |
| `ends-without-a-reason` | GA-LEASE-7 | — | Under the pinned policy, a person's hold ends with a `lease` event that names no `end` |
| `hides-the-hold-policy` | GA-LEASE-8 | GA-LEASE-7 | `describe`'s home has no `hold`, or one without `off_s` |
| `refuses-a-short-hold` | GA-LEASE-8 | — | `define` of the home's `hold` `{ on_s: 20, off_s: 20, other_s: 20, fixed_s: 20 }` is refused: an owner running a short test, or one who wants brief holds, cannot set them |
| `restarts-the-quiet` | GA-PERSIST-2 | GA-LEASE-7 | Under the pinned policy, after a restart with no presence in the gap, a hold whose room had been quiet for most of `on_s` before the steward stopped waits a whole `on_s` again from the restart |
| `schedule-cannot-end` | GA-LEASE-7 | — | Under the pinned policy, with `schedule_ends` set true, a schedule's run reaches a step on the lamp after the floor, and the step is `refuse(leased)`: the hold survived it |
| `roomless-on-window` | GA-LEASE-7 | — | Under the pinned policy with `fixed_s` set to 600, a lamp with no room switched on from the app is held for 3600 s (`on_s`) instead of 600 s |
| `renews-when-told-not-to` | GA-LEASE-7 | — | Under the pinned policy, with `presence_renews` set false, motion in the room keeps the hold past 3600 s from the change |
| `press-loses-the-hold` | GA-LEASE-9 | GA-LEASE-4 | Under the pinned policy, a press whose `turn_on` ends `skipped(already)` ends the member's hold on the lamp, and the off rule it refused fires |
| `brain-groups-a-press` | GA-LEASE-9 | GA-DEF-7 | Under the pinned policy, a brain adds a lamp to the group an owner's press rule acts on, and the press replaces the member's hold on that lamp |
| `refuses-the-press` | GA-LEASE-9 | GA-LEASE-3 | Under the pinned policy, HS35: Ольга switches the lamp off from her app, and button 1's press rule, marked `press`, is `refused(leased)` |
| `press-over-safety` | GA-LEASE-9 | GA-LEASE-6 | Under the pinned policy, a press rule's action reaches a valve a latchless safety rule closed, while its `safety_rule` lease holds |
| `press-without-a-hold` | GA-LEASE-9 | GA-LEASE-5 | Under the pinned policy, after the press turns the lamp on, a level rule turning it off fires within 3600 s with the room quiet: the press took no hold |
| `any-occurrence-is-a-press` | GA-LEASE-9 | — | Under the pinned policy, a rule on a vibration sensor's `event` key, not marked `press`, replaces the member's hold on the lamp |
| `brain-press-overrides` | GA-LEASE-9 | GA-DEF-7 | Under the pinned policy, a press rule a brain wrote replaces the member's hold on the lamp |
| `press-skips-conditions` | GA-LEASE-9 | — | Under the pinned policy, a press rule with a condition `between` 18:00 and 23:00 turns the lamp on at 14:00 |
| `press-asks-the-tier` | GA-LEASE-9 | GA-SCN-4 | Under the pinned policy, a press rule's `confirm` step on the plug is `skipped(not_confirmed)` though its author defined it from an app |
| `names-the-presser` | GA-LEASE-9 | — | Under the pinned policy, the press's hold is held by the rule's author, or by the endpoint the switch's room has, not by `{ rule, press }` |
| `press-on-liveness` | GA-LEASE-9 | GA-DEF-13 | Under the pinned policy, `define` accepts `press: true` on a `liveness` trigger |
| `press-over-the-cap` | GA-LEASE-9 | GA-LEASE-2 | Under the pinned policy, the applier caps the heater (`load_cap`), and a press rule's `turn_on` replaces the `load_cap` lease and switches it back on |
| `schedule-ends-without-dispatch` | GA-LEASE-7 | GA-LEASE-4 | Under the pinned policy, with `schedule_ends` set true, a schedule's step on the lamp is `skip(occupied)`, and the member's hold ends all the same, the off rule it refused firing |
| `refuses-a-flag-unnamed` | GA-LEASE-8 | — | A steward that does not implement `schedule_ends` refuses `define` of `hold: { schedule_ends: true }` with an `invalid_request` that names no flag |
| `fixed-expires` | GA-LEASE-7 | — | Under the pinned policy, `state` shows a hold's `expires` as the change plus `on_s` while motion every 600 s keeps the room busy, or, with every window set to 1 s, earlier than the floor |
| `grants-no-direction` | GA-LEASE-7 | — | Under the pinned policy, the granted `lease` event of a member's `turn_off` names no direction |
| `schedule-end-without-run` | GA-LEASE-7 | — | Under the pinned policy, with `schedule_ends` set true, a hold ends `schedule` with a `lease` event that names no run |
| `gap-end-without-time` | GA-LEASE-7 | GA-PERSIST-2 | Under the pinned policy, a hold whose quiet window ran out while the steward was down, with motion only later in the gap, is either revived by that motion or ends at the restart with a `lease` event that has no `end_time` |
| `sensor-reading-holds` | GA-LEASE-2 | GA-LEASE-3 | An adopted motion sensor's `occupancy` and `illuminance` readings, cause `external`, each take a person's lease on the sensor |
| `metering-holds` | GA-LEASE-2 | GA-LEASE-3 | An adopted plug's power reading, a sensor key on an actuator, cause `external`, takes a person's lease on the plug, and a rule's `turn_off` of it is `refuse(leased)` |
| `unadopted-holds` | GA-LEASE-2 | — | A device not adopted takes a person's lease on an `external` change, and the lease is still held when it is adopted |
| `guest-hold-blocks-the-owner` | GA-LEASE-10 | GA-LEASE-3 | Under the pinned policy, with `owner_work_passes_guest_holds` set true, a guest's `turn_on` of the lamp at a panel refuses the owner's rule turning it off at 23:00 |
| `passes-undeclared` | GA-LEASE-10 | GA-LEASE-3 | Under the pinned policy, with `owner_work_passes_guest_holds` set false, the owner's rule turns off a lamp a guest's apply holds |
| `brain-rule-passes-a-guest` | GA-LEASE-10 | GA-DEF-7 | Under the pinned policy, with `owner_work_passes_guest_holds` set true, a `brain_authored` rule's `turn_off` passes a guest's hold on the lamp |
| `passes-a-member-hold` | GA-LEASE-10 | GA-LEASE-3 | Under the pinned policy, with `owner_work_passes_guest_holds` set true, the owner's rule passes a member's hold on the lamp |
| `named-speaker-is-a-guest` | GA-LEASE-10 | — | Under the pinned policy, with `owner_work_passes_guest_holds` set true, the owner's rule passes the hold of an apply through a brain-served satellite that named a member as its `speaker` |
| `holds-the-auto-lock` | GA-LEASE-11 | GA-LEASE-3 | Under the pinned policy, HS18: an `external` unlock from the phone holds the lock, and an auto-lock rule's `lock.lock` a minute later is `refuse(leased)` |
| `narrows-a-heater` | GA-LEASE-11 | GA-LEASE-3 | Under the pinned policy, a rule's `onoff.turn_on` of a heater passes a member's hold on it, treated as narrowing |
| `narrowing-takes-a-hold` | GA-LEASE-11 | GA-LEASE-1 | Under the pinned policy, a member's `valve.close` from the app takes a person's hold, shown in `state` |
| `narrows-over-safety` | GA-LEASE-11 | GA-LEASE-6 | Under the pinned policy, a rule's `lock.lock` reaches a door a latchless safety rule unlocked, while its `safety_rule` lease holds |
| `closes-by-opens-with` | GA-LEASE-11 | — | Under the pinned policy, on an `onoff` `water_valve` declared `opens_with: turn_off`, a rule's `turn_off` passes a member's hold as narrowing |
| `press-lock-holds` | GA-LEASE-9 | GA-LEASE-11 | Under the pinned policy, a press rule whose action is `lock.lock` replaces the member's hold on the lock with a press hold, shown in `state` |
| `ignores-the-cap` | GA-LEASE-7 | — | Under the pinned policy with `cap_s` set to 7200, motion every 600 s keeps a member's hold on the lamp past 7200 s from the change |
| `keeps-a-removed-hold` | GA-LEASE-7 | — | Under the pinned policy, the owner removes the lamp from adoption and adopts it again, and the member's earlier hold still refuses a rule on it |
| `narrows-over-a-run` | GA-LEASE-11 | GA-LEASE-3 | Under the pinned policy, a rule's `lock.lock` reaches a lock a person-started run owns, while the run's lease holds |
| `missed-change-full-window` | GA-LEASE-2 | GA-LEASE-7 | Under the pinned policy, after a `cursor_expired` gap of two days, an `external` change from its start takes a fresh hold at the read-back |
| `two-leases-at-once` | GA-LEASE-10 | GA-SCN-2 | Under the pinned policy, with `owner_work_passes_guest_holds` set true, the owner's scheduled run owning the lamp starts while a guest's hold on it stands, passes that hold once its floor has passed, and also leases the lamp, `state` showing two leases |
| `narrows-by-toggle` | GA-LEASE-11 | — | Under the pinned policy, on an `onoff` `water_valve` whose closing `turn_off` is declared `toggles`, a rule's `turn_off` passes a member's hold as narrowing |
| `misses-a-vacancy` | GA-LEASE-7 | GA-OCC-1 | Under the pinned policy, with `vacant_ends` set true, a member switches on the lamp in an occupied room whose motion sensor then clears; `occupancy_hold_s` passes with no report and the room becomes `vacant`, and the hold stands until the next presence or liveness report |
| `quiet-without-its-moment` | GA-LEASE-7 | — | Under the pinned policy, a member switches on the lamp in a busy room, which then falls quiet, and the hold's `lease` event ends it `quiet` with no `quiet_since` |
| `floor-waits-past-sent` | GA-LEASE-7 | — | Under the pinned policy, with `vacant_ends` set true, a member switches on an open-loop lamp, whose step ends `sent`; the room becomes `vacant` soon after, and the hold stands until `ack_within_s` plus 60 s have passed since dispatch |
| `schedule-ends-at-the-floor` | GA-LEASE-7 | — | Under the pinned policy, with `schedule_ends` set true, a schedule's step on the lamp meets a member's hold inside its floor, is `refuse(leased)`, and the hold ends when the floor has passed, with `end: schedule` |
| `ends-a-hold-late` | GA-LEASE-7 | — | Under the pinned policy, a member's hold in a room with no presence source ends 30 s after `fixed_s` has passed since its change, past the hold end lateness |
| `press-hold-dies-with-rule` | GA-LEASE-9 | — | Under the pinned policy, the owner deletes the press rule whose press holds the lamp, and the press's hold ends with it |
| `press-cancels-on-unreachable` | GA-LEASE-9 | GA-LEASE-4 | Under the pinned policy, a press at a lamp a member holds ends `unreachable`, and the member's hold it replaced is not restored, the off rule it refused firing |
| `null-keeps-the-window` | GA-LEASE-8 | — | After the owner set `off_s`, `define` of `hold: { off_s: null }` leaves her value in force rather than the steward's own |
| `passes-inside-the-floor` | GA-LEASE-10 | — | Under the pinned policy, with `owner_work_passes_guest_holds` set true, the owner's rule turning a lamp off is dispatched while a guest's `turn_on` of it awaits its ack, inside the guest's hold's floor |
| `forgets-an-asked-plan` | GA-PERSIST-2 | — | A member answers `yes` to a plan's `ask(confirm_tier)`, the steward restarts, and the plan's `apply` is `unknown_plan` |
| `owner-passes-the-cap` | GA-LEASE-12 | GA-LEASE-2, GA-LEASE-3 | Under the pinned policy, with `owner_work_passes_holds` set true, the applier caps the heater (`load_cap`), and the owner's rule marked `passes_holds` passes the `load_cap` lease and switches it back on |
| `owner-passes-a-run` | GA-LEASE-12 | GA-LEASE-3, GA-SCN-2 | Under the pinned policy, with the lamp's `owner_work_passes_holds` and the home's set true, the owner's rule marked `passes_holds` turns off a lamp a person-started run owns, while the run's lease holds |
| `brain-rule-passes-holds` | GA-LEASE-12 | GA-DEF-7 | Under the pinned policy, a brain renames the owner's rule marked `passes_holds`, which then turns off a lamp a member's hold covers, that hold's floor passed |
| `brain-groups-past-a-hold` | GA-LEASE-12 | GA-DEF-7 | Under the pinned policy, a brain adds a lamp to the group the owner's rule marked `passes_holds` acts on, and the rule passes a member's hold on that lamp |
| `unmarked-rule-passes` | GA-LEASE-12 | GA-LEASE-3 | Under the pinned policy, with no switch set, the owner's rule turning a lamp off passes a member's hold on it, that hold's floor passed |
| `passes-a-hold-in-its-floor` | GA-LEASE-12 | — | Under the pinned policy, the owner's rule marked `passes_holds` turning a lamp off is dispatched while a member's `turn_on` of it awaits its ack, inside the member's hold's floor |
| `passing-ends-the-hold` | GA-LEASE-12 | GA-LEASE-4, GA-LEASE-7 | Under the pinned policy, after the owner's rule marked `passes_holds` turns the lamp off past a member's hold, `state` shows no hold on the lamp, or a `lease` event ends it |
| `passing-takes-a-lease` | GA-LEASE-12 | GA-SCN-2 | Under the pinned policy, with `owner_work_passes_holds` set true, the owner's scheduled run owning the lamp starts while a member's hold on it stands, passes that hold once its floor has passed, and leases the lamp, `state` showing the run's lease on it |
| `ignores-the-device-switch` | GA-LEASE-12 | — | Under the pinned policy, with the lamp's `owner_work_passes_holds` set true, the owner's rule turning the lamp off is `refuse(leased)` by a member's hold whose floor has passed |
| `ignores-the-home-switch` | GA-LEASE-12 | — | Under the pinned policy, with the home's `owner_work_passes_holds` set true, the owner's scheduled run turning the lamp off is `refuse(leased)` by an `external` change's hold on it |
| `marked-run-refused` | GA-LEASE-12 | GA-SCN-2 | Under the pinned policy, the owner's rule marked `passes_holds` starts a run whose `run` step reaches a second scenario, and that scenario's step turning the lamp off is `refuse(leased)` by a member's hold whose floor has passed |
| `marked-press-passes` | GA-LEASE-12 | GA-LEASE-9 | Under the pinned policy, a press rule also marked `passes_holds` turns the lamp on past a member's hold and leaves it in place, `state` showing the member's hold rather than the press's |
| `refuses-the-owner-switch` | GA-LEASE-12 | GA-LEASE-8 | `define` of the home's `hold: { owner_work_passes_holds: true }` is refused with `invalid_request` as a flag not implemented |
| `brain-sets-the-device-switch` | GA-DEF-3 | GA-LEASE-12 | A `define` through a brain that sets a lamp's `owner_work_passes_holds` true, deletes the target of a lamp whose switch the owner set true, or deletes a rule the owner marked `passes_holds`, returns a plan to answer rather than `not_permitted` |
| `brain-marks-a-rule` | GA-DEF-3 | GA-LEASE-12 | A `define` through a brain that creates a rule with `passes_holds` true, or clears it on the owner's marked rule, returns a plan to answer rather than `not_permitted` |
| `switch-spares-held-holds` | GA-LEASE-12 | — | Under the pinned policy, with a member's hold on the lamp standing, its floor passed, the owner sets the home's `owner_work_passes_holds` true, and the owner's rule turning the lamp off is then `refuse(leased)` by that hold |
| `pass-re-evaluates-early` | GA-LEASE-12 | GA-LEASE-4 | Under the pinned policy, a level rule the member's hold on the lamp refused fires when the owner's rule marked `passes_holds` passes that hold, before the hold ends |
| `pass-moves-the-end` | GA-LEASE-12 | GA-LEASE-7 | Under the pinned policy, after the owner's rule marked `passes_holds` passes a member's hold on the lamp, the hold's `expires` in `state` has moved |
| `pass-as-a-lease` | GA-LEASE-12 | — | Under the pinned policy, a step of the owner's rule marked `passes_holds` that passes a member's hold carries a `holder`, or a `lease` event is issued for it |
| `pass-unrecorded` | GA-LEASE-12 | — | Under the pinned policy, with the lamp's `owner_work_passes_holds` set true, the owner's rule passes a member's hold on the lamp, and its `outcome` event in `history` has no `passed_hold`, or one naming a switch other than `device` |
| `pass-reveals-a-personal-press` | GA-LEASE-12 | GA-AUTH-7, GA-LEASE-9 | Under the pinned policy, a press rule on a key the device marks `personal` holds the lamp, the owner's rule marked `passes_holds` passes that hold, and a guest's `history` shows the step's outcome with a `passed_hold`, in any form |
| `owner-passes-safety` | GA-LEASE-12 | GA-LEASE-3, GA-LEASE-6 | Under the pinned policy, with `owner_work_passes_holds` set true, a latched safety rule set the thermostat's mode to `off`, and the owner's rule marked `passes_holds` sends `climate.set_setpoint`, another key, which reaches the applier while the latch and its `safety_rule` lease hold |
| `refuses-on-the-persons-own-report` | GA-LEASE-12 | GA-LEASE-10 | Under the pinned policy, with `owner_work_passes_holds` set true, a member's app turns the lamp on, and the owner's rule *lamp on → lamp off*, triggered by the lamp's `state` report of `on` that comes before the ack, is `refuse(leased)` |
| `brain-edits-a-passing-scenario` | GA-DEF-7 | GA-LEASE-12 | Under the pinned policy, a brain changes a step of the scenario the owner's rule marked `passes_holds` starts, and that step turns off a lamp a member's hold covers, that hold's floor passed |
| `brain-sets-the-home-switch` | GA-DEF-3 | GA-LEASE-12 | A `define` through a brain that sets the home `hold`'s `owner_work_passes_holds` true returns a plan to answer rather than `not_permitted` |
| `home-switch-reopens` | GA-LEASE-12 | GA-LEASE-3 | Under the pinned policy, with only the home's `owner_work_passes_holds` set true, a valve closed by hand holds an `external` hold, and the owner's schedule's `valve.open` passes it and opens the valve |

## What this standard does not define

- What a brain must do: `standard/brain.md`. What a voice front does: `standard/voice.md`.
- More than one steward in a home.
- **Known limitation: open-loop devices.** A condition or `wait` on an open-loop device's value
  reads an assumed value, never an observed one (`skipped(assumed)`), and a rule or schedule can
  never send its toggling code (`skip(toggle_only)`); see `standard/applier.md`, *What this standard
  does not define*.
- What `define` a steward accepts through a brain, and from whom: a policy for implementations to
  settle in use, bounded by GA-DEF-3, GA-DEF-6 and GA-DEF-7.
- Permissions per person or per time of day beyond the four roles (a child's hours); an owner
  approximates them with endpoints' `max_role`.
- Who may read personal values beyond the floor (GA-AUTH-7), and who may lock whose session: the
  steward's policy. By the default tiers, anyone who may do a `reversible` action may lock any mapped
  session, which at worst makes its owner type a password. **A known gap:** `power.cancel` is
  `reversible`, and GA-RULE-7 never fires `power.shutdown` again, so anyone who may do a
  `reversible` action, a guest by voice included, may cancel a rule's delayed shutdown and so turn
  it into a suggestion. Who may cancel is policy. **A known gap:** without `respect_occupancy` (a
  direct request) no session is consulted (GA-OCC-3), and `power.sleep` is `reversible`, so anyone
  who may do a `reversible` action may put to sleep a PC someone is using. Whether a direct request
  should consult sessions too, or sleep be tiered higher, is policy. **A known gap:** a
  person-precedence lease is taken again by every action, and, under a hold policy with
  `presence_renews`, renewed by every presence report in its room, so a guest, a mistaken brain or
  another admin acting again before the hold ends, or a room that is never quiet for the window, can
  hold a device, and every rule and schedule acting on it, for as long as they keep acting or the
  room stays busy. A live sensor stuck at `true` (a lost clear), or a reading spoofed below the
  applier, renews a hold for ever in the same way. The bound is the policy's `cap_s`, declared, and
  43200 s in the reference; with it `0`, no hold is bounded, and a steward ends none before its
  declared policy says (GA-LEASE-7, GA-LEASE-8). The owner's own work need not wait on such a hold:
  GA-LEASE-12's switches let it through, though the hold stands against everything else.
- **A known residue: who is a guest.** A guest's hold (GA-LEASE-10) rests on the derived role, and
  through a brain on the brain's `speaker` claim (GA-AUTH-2), as the press rests on its author's mark:
  a brain that names a member makes the hold a member's, one that names nobody makes it a guest's.
  And only an apply's hold is a guest's: a guest at the wall switch (`external`), at a press rule's
  button, or starting a run, holds against the owner's rules as anyone would there, and a child whom a
  satellite never names is a guest at it while the same words through another ecosystem's assistant
  (`external`, HS8) hold as a person's. These follow from the ruling that passes only an apply's
  guest hold (GA-LEASE-10); an owner who wants the house's work through such holds too sets one of
  GA-LEASE-12's switches, which pass every person's hold, so that where a switch covers the work, who
  is a guest no longer matters to it.
- **A known asymmetry: narrowing by hand.** An `external` narrowing change (a keypad lock, a valve
  closed by hand) takes a hold under GA-LEASE-2, while the same act through the steward takes none
  (GA-LEASE-11): the steward cannot tell a person's lock from the echo of an unlock attempt.
- **A known residue: `press` is the author's word.** The applier says nothing of who or what made an
  occurrence, so a misfiring or spoofed occurrence on a press rule overrides a person's hold and holds
  the device as a person would, refusing rules and schedules for the hold's window (GA-LEASE-9), but
  the owner's work GA-LEASE-12 lets through. The owner marks only real buttons; a brain's mark has no
  effect.
- **A known residue: the owner's pass.** A switch (GA-LEASE-12) is the owner's word that their work
  outranks every person's change it covers: under the home's, a reader's lamp goes off at the owner's
  23:00 rule though she switched it on a minute before. A marked rule passes whoever's act fired its
  trigger, a guest's change or a brain's `reversible` action included, as any owner's rule acts on
  any trigger; the owner who marks a rule chooses that. A rule refused inside a hold's floor, before
  the device reported the person's value, is not re-evaluated when the floor passes, nor when a switch
  comes to cover that hold, only at the hold's end (GA-LEASE-4), as under GA-LEASE-10: a level rule
  triggered elsewhere in that moment waits for the whole hold, and an edge, a `time` trigger included,
  that falls inside the floor is lost. Under a switch, `schedule_ends` ends no hold a scheduled step
  passes, so it acts only on holds no switch covers; and a passed hold stays with its direction, after
  the owner's work has moved the device the other way, and still refuses all work no switch covers
  until it ends. And while a run passes a hold on a device it holds no lease there, so the owner's
  other passing work may change that device mid-run.
- **Known limitation: a person's hold and stillness.** A motion sensor does not see a person sitting
  still, so under the quiet-room rule a very still person loses the hold once the window has passed
  since the last motion it saw; the window is the owner's to lengthen (GA-LEASE-8).
- The JSON Schemas; until they exist, the tables above are the shapes.
