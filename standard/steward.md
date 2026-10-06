---
title: The Galatea steward standard
status: draft
last_verified:
area: architecture
audience: dev
author: Galatea maintainers
version: 0.10
related:
  - standard/applier.md
  - standard/brain.md
  - standard/voice.md
  - docs/specs/2026-09-24-standard-split-design.md
  - conformance/steward-requirements.json
  - CONTEXT.md
  - docs/reviews/2026-10-06-bridge-0.6-applier-0.15.md
---

# The Galatea steward standard

## Changelog

| Date | Version | Change |
|---|---|---|
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
`standard/applier.md`, `standard/brain.md` or `standard/voice.md`.

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

## Conformance

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
| Home | `timezone` (an IANA zone), `hold_time_s` (default 7200), `occupancy_hold_s` (default 300), `ask_expiry_s` (default 300), `notice_channels` (channel ids, at least one: targets with `notify`, or with `media.announce`, which speak the notice's text), `other_wake_words` (default: the assistants listed under *Listening*), `answer_words` (default: the words listed under *Listening*), `audio_retention_s` (default 0: a voice front keeps no audio), `time_source` (harness only, GA-HARN-2) |
| Room | `id`, `name` |
| Target | `id` (the applier's device id), `name`, `aliases`, `room` or null, and everything the applier describes for it, `adopted`, `other_admins`, `internal` and `personal` included; on a `computer`, the applier's `accounts` and the steward's `account_persons` (*Sessions belong to persons*) |
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
shared panel); `{ rule }`; `{ run }` (a scenario run, which acts as whoever started it); `external`.
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
cleared. The owner may raise a declared tier through the applier's `configure`, and never lower it,
except an extension action, a plugin's or a bridge's own, which the owner may lower to its floor and no further
(`standard/applier.md`, GA-DESC-3).

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
  `{ plan_id, step_ids, endpoint, time }`, where `endpoint` is where the question is put: the
  plan's endpoint, or the `confirm_on` that applies to it (GA-CONF-5).
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
  within the home: a front that merges what several endpoints heard gives it one id, so one yes
  answers one plan. The steward may forget a record once every plan whose `ask` event came before its
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
  narrowing delay: `typed` from an endpoint not `type: app`, `skill`
  from one without a `skill_account`, `follow_up` at an endpoint with a voice record whose
  `follow_up` is off or whose listening is narrower than `wake_device`, `tap` where `listening` is
  `off`, `wake` where it is `off` or `tap`, a `gate` basis where `describe`
  shows no gate model for that person at that endpoint, and a `person` basis at an endpoint whose
  person is another, are `not_permitted` (GA-CONF-6). The record also names the asking `say` and
  what the front reported of it (`asked_by { say_id, status, cut_by?, ended_at?, clock_epoch? }`), so that `history` shows
  whether the question was heard. The steward MUST keep
  the record in `history` with the step it answered, and refuse as `invalid_request` a record
  from an endpoint with a voice record that has no `asked_by`; one whose `asked_by` has a `status`
  other than `full`, or `cut` with `cut_by` naming this utterance; and one whose `asked_by` is `full`
  with no `ended_at`, or whose `time` is not after that `ended_at` where both are in one
  `clock_epoch`, a missing epoch counting as one (both are the front's times, so no tolerance
  applies; a «да» begun within the interval slack of the question's end may be refused, an answer
  lost and asked again, never a false one) (GA-CONF-2). Times are RFC 3339 with an offset;
  endpoints, their fronts and the steward SHOULD share one time source. The
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
an endpoint not served by a brain sets the device's room and groups again, so a brain cannot move a
device under an owner's step (GA-DEF-7). A schedule exception that moves a run, made through a
brain, makes that run `brain_authored`; one that skips a run never marks anything. The mark holds
whoever applies or runs the work, an owner at their own app included, and `describe` shows it as
`brain_authored: true` on each scenario, rule, schedule and device that has it. An owner who wants
the higher steps redefines the scenario, rule or schedule whole, or the device's room and groups,
from an endpoint not served by a brain, which clears the mark. A latched undo is the exception: the applier requires
a person for it (GA-SAFE-7), so no rule can undo a safety rule.

## Leases

A lease is `{ holder: principal, targets: target id[], precedence, expires }`, where `expires` is a
time or `run_end`. A lease's targets are always devices: a group is expanded to its members, leaving
out `infrastructure` ones.

**Precedence, highest first:** `safety_rule`; `person` (a person, `external`, or a run a person
started); `scheduled_run`; `rule`.

The steward:
- MUST give each device an endpoint principal's apply dispatched a stateful action to (a `dispatched` outcome) a
  `person` lease for `hold_time_s`, from dispatch, so that no rule acts between dispatch and ack.
  Stateless actions take none, and neither does `session.lock`, a named exception: it only ever
  narrows use, and a lease would let a child who locks her own session at 20:55 hold the laptop
  against her own limit for two hours. A rule's later action there is `refuse(leased)`. The lease
  ends when the step ends `unreachable`, since nothing was sent (GA-LEASE-1);
- MUST give a change the applier reports with cause `external` a `person` lease held by `external`
  for `hold_time_s`, and a change with cause `load_cap` a `person` lease held by `load_cap` for
  `hold_time_s`, so that no rule turns a capped heater straight back on; a change with cause
  `device` takes none (GA-LEASE-2);
- MUST give a device a safety rule actuated a `safety_rule` lease, held until the applier reports
  that rule's latch `cleared` or `cleared_by_owner`, or, for a rule with no latch, until the rule is complete; after a
  `cursor_expired`, it reads held latches from the applier's `state`, and releases a latchless rule's
  lease once the applier's `history` shows that rule's first `rule_fired` event after the lease was
  granted, which the applier issues when the rule completes (GA-LEASE-6);
- MUST lease a running scenario's `owned` targets until the run ends, and release only the leases
  that run holds (GA-SCN-2);
- MUST NOT give a rule's action a lease (GA-LEASE-5);
- MUST refuse a lower-precedence change to a leased device, and let an equal or higher one proceed
  and replace the lease, except a `session.lock`, which a lease never refuses and which replaces
  none, so that a lease someone else took on the laptop does not stop a rule from locking it again
  (GA-LEASE-3);
- MUST, when a lease ends, re-evaluate every level-triggered rule whose trigger or actions name one
  of its devices, and fire it if its condition holds; MUST NOT re-run edge-triggered rules
  (GA-LEASE-4).

A **level-triggered** rule's trigger is a state held for a duration ("no motion in the hall for
180 s"), or, for a rule of conditions only, its conditions held for 0 s (*Rules*); an
**edge-triggered** rule's is a change ("motion in the hall").

**Worked example (HS3).** A night light that must go off by itself is two rules: edge-triggered,
*motion in the hall after 23:00 → hall light 10 %*; level-triggered, *hall light on and no motion for
180 s → hall light off*. A person switching the light on by hand leases it; the second rule is
refused; when the lease ends two hours later, GA-LEASE-4 re-evaluates it, finds no motion for 180 s, and
turns the light off.

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
  absent, or, with an account mapped, the computer is `stale`; and always when the computer has no
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
  grace; and so when narrowings not made from an owner's own endpoint have kept an endpoint
  narrowed for 24 h in a row, since a narrowing can be renewed (GA-LISTEN-2).
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
  match (voice, *Constants*) of, with the listed word taken as the transcript and in either reading, a
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
  mention of it would address an assistant.

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
| `stale`, `basis` | from the applier's plan |
| `from_replaced` | `true` on a `notify` step whose caller-set `from` the steward overwrote (GA-NOTE-2) |

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
  `invalid_request` (an unknown `plan_id`, a bad utterance record, a step not asked);
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
plan step would (GA-NOTE-2).

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
`transport`, `other_admins`, `bridge_fault`, `occurrence` and `undescribed` events, and add these event types: `define` (the diff applied, with its cause), `ask` (as *The
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
`history`: what a television said is not the house's record. The applier's history says what
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
  steps, and in outcomes. A personal key's `state` events are left out of such a call's `events`
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
set that leaves them without a `notify` channel), retrying at least every 60 s, and never giving up, until at
least one channel's `notify` ends `delivered`, or `sent` on a channel that never reports receipt, and only then sends `notice_taken` with its
`notice_id`, so that a notice is never lost between the two
layers (GA-NOTE-1). A channel that announces speaks each notice once, is not retried, and never
counts as delivery: a kitchen is not told of a fault every minute, and a refused announcement
(GA-LISTEN-4) loses nothing.

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
- `scenario_stop` by a principal of lower precedence than the run's, or by a role lower than that of
  the person who started it, is `not_permitted`; an unknown
  `run_id` is `unknown_run`; a stopped run ends `ended(stopped)` (GA-SCN-9).

## Rules

A rule has `id`, `name`, `trigger` (a state change, a state held for a duration, an event, such as a
device's `liveness` event, or a
time; absent for a rule of conditions only), `conditions` over state and time, `actions` (each as
a request's, with an optional `respect_occupancy`), `active` and `exceptions`. Safety rules are the applier's, not the
steward's (`standard/applier.md`, *Safety rules*); the steward never hosts one.

A level-triggered rule MUST fire once when its condition becomes true, and not again until it has
been false; a lease ending counts as becoming true again (GA-RULE-1). After a restart, the steward
starts every held duration afresh (GA-PERSIST-2). After a `cursor_expired`, it first reads the
applier's `history` from the time of the last event it had, records the events it missed in its own
`history`, and grants the leases the missed `external` and `load_cap` changes would have taken, for
what is left of their `hold_time_s` (GA-LEASE-2). After a restart or a `cursor_expired`, it
evaluates each level-triggered rule against current state, and one whose condition holds and has
not fired for it since it last became true fires then; an edge-triggered rule's events inside the gap
are lost (GA-RULE-1).

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
  `ack_within_s` after its last try and no later than 300 s after it, or its `ack_within_s` when
  that is longer (⚠️ a guess at the spacing), and go on doing so while the
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
  applier's, at most once for that action each time the conditions become true (GA-RULE-8). An
  `unanswered` action raises it after its one further try. `refused(leased)`, which the lease's end
  re-evaluates (GA-LEASE-4), and `skipped(occupied)` and `skipped(in_use)`, which are not failures
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
  an exception ends, a level-triggered rule whose condition then holds MUST fire, as when a lease
  ends (GA-LEASE-4); an edge-triggered rule's triggers inside the exception are lost (GA-RULE-6).

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

A run missed while the steward was down is not run late; the steward records a `schedule_missed`
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
  answered with `answer` and applied with `define { plan_id }`, and unanswered it changes nothing
  (GA-DEF-6); what it creates or changes is `brain_authored` (GA-DEF-7); and it never changes
  persons, endpoints, voice records, credentials or the home's settings, nor lifts a narrowing
  (GA-DEF-3).
- `define` refuses, with `invalid_request`, a voice record whose `heard_by` names no front
  credential, an endpoint with a voice record and no `served_by`, a `skill_account` on an endpoint
  that is not `type: voice` or that has a `person`, two endpoints with one `skill_account` and
  `skill_surface`, and voice records naming more than one front: one front serves a home, since it
  must know every playback the house makes to mark its echoes (GA-DEF-8).
- With `dry_run`, it MUST change nothing and return a readable diff (GA-DEF-1).
- With an `expected_revision` that is not current, or with a `plan_id` whose plan was made at a
  revision that is no longer current, it MUST return `stale_revision` and change nothing (GA-DEF-2).
- A change set is applied whole or not at all (GA-DEF-5).
- A change set that names a device the applier has not adopted (in a room, a group, a scenario or a
  rule) MUST be refused with `invalid_request`, and change nothing (GA-DEF-9). Adoption comes first,
  and only the owner adopts, through the applier's `configure`.
- A change set whose rules or scenarios that it adds or changes have a trigger or conditions, an `if`
  or a `wait` that reads a key its device does not declare (for a selector, a key no device it matches declares) MUST be refused with
  `invalid_request`, its `data` naming `{ key, device, awaited }`, and, where the device's bridge lists it as awaited
  (a key the device's model promises and the device has never sent, `standard/bridge.md`, *Keys a
  device has not yet sent*), saying so, and change nothing (GA-DEF-12). A rule on a reading that has
  never come would never fire, and no one would know. A device declares the keys of its
  capabilities' rows, its `sensor_keys`, its extensions' `state` keys, for a trigger its extensions'
  `event` keys too, and, on a computer, the `session.<token>` of each account in `accounts`; a
  scenario a `run` step reaches is checked as its own. An adapter's device has no awaited keys. For a
  selector, `data` names no `device`. The guard is partial: a key a model promises and no one has named as missing
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

## Restarts

The steward MUST keep across a restart: the house model; leases; idempotency keys for their
retention; open plans and their answers; the events `history` needs; each schedule's last run; and
each notice GA-RULE-8 holds for a late ack, with the end of its wait.
A scenario run a restart interrupted ends `ended(interrupted)`, and its leases are released; held
durations start afresh (GA-PERSIST-2).

## Operations

Errors as the applier's, plus `unknown_run`. Every connection MUST use TLS, with the server's certificate
validated, unless both ends are on one host's loopback (GA-SEC-2).

| Operation | Request | Response |
|---|---|---|
| `describe` | `{ since_revision?, wait_s? }` (0–30; with `since_revision`, returns at the next revision or after `wait_s`) | `{ steward_id, standard_version, revision, home, rooms, targets, groups, endpoints, scenarios, rules, schedules, modes, applier: { applier_id, levels, ungoverned }, test_run_id? }`. Persons appear by id, name and role only; credentials never |
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
| `define` | `{ endpoint, speaker?, changes, expected_revision, dry_run } \| { endpoint, speaker?, plan_id }` | dry run: a diff; through a brain: a plan to answer; otherwise `{ revision }` |
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
`front_status` and `speaking` carry `destructiveHint: false`.

`apply` SHOULD add no more than 200 ms to its applier's synchronous bound (GA-STW-9).

## Constants

| Constant | Value | Where |
|---|---|---|
| Plan expiry | 60 s; `ask_expiry_s` with an `ask` step | GA-STW-5, GA-CONF-1 |
| Token expiry | 60 s after issue | GA-CONF-3 |
| Ask expiry, default | 300 s | GA-CONF-1 |
| Clock tolerance | 1 s, a guess until measured | GA-CONF-2 |
| Hold time, default | 7200 s | GA-LEASE-1 |
| Notice retry interval | at most 60 s | GA-NOTE-1 |
| Occupancy hold, default | 300 s | GA-OCC-1 |
| Idempotency key retention | 3600 s, per credential | GA-STW-6, GA-SCN-6 |
| Event retention | 3600 s | GA-STW-7 |
| History retention | 7 days | GA-STW-7 |
| Late-ack slack | 11 s, as the applier's `fresh_slack_s` for a bridged device, plus its 6 s for each meta-applier hop; ⚠️ a guess | GA-RULE-8 |
| Rule retry spacing | at least the action's `ack_within_s`; at most 300 s, or the `ack_within_s` when longer; ⚠️ a guess | GA-RULE-7 |
| Narrowing limit | 12 h | GA-LISTEN-1 |
| Source delay | 1 s, a guess until measured | GA-LISTEN-3 |
| Duck limit | 60 s | *Listening* |
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
| GA-AUTH-7 | MUST | Steward | wire | A personal key's value is `withheld` from a call whose derived role is `guest` or `visitor` and from a brain credential's call naming no endpoint, wherever it appears: `state`, `history`, `events`, `rule_fired`, plans and outcomes, `outcome` and `scenario_status` included; that key's `state` and `occurrence` events are left out of such a call's `events` and `history` entirely; an `if` or `wait` step on it is shown by its verdict (the branch taken, the `wait` met or timed out), its value `withheld`; verdicts are not withheld |
| GA-AUTH-8 | MUST | Steward | wire | A front credential is bound to the endpoints whose voice record's `heard_by` names it, and any operation from it but `describe`, `zone_sources`, `narrow`, `front_status` and `speaking` is `not_permitted`; `front_status`, `speaking` and `zone_sources` from any other credential, or for an endpoint not bound to that front, are `not_permitted` |
| GA-TIER-1 | MUST | Steward | wire | A `no_voice` action through a brain-served endpoint is `refuse(tier)`, answered or not |
| GA-TIER-2 | MUST | Steward | wire | An unanswered `confirm` or `no_voice` step is `ask(confirm_tier)` in a plan and `refused(tier)` inline |
| GA-TIER-3 | MUST | Steward | wire | A guest's step above `reversible`, and a visitor's every step, is `refuse(role)` |
| GA-CONF-1 | MUST | Steward | wire | An answer counts only for an open plan, from its own credential and endpoint, or, when the endpoint's `confirm_on` or else its brain credential's names another endpoint, only from a credential bound to that one; for a plan that named a `speaker`, an answer through a brain only naming the same one; any other is `not_permitted` and changes nothing |
| GA-CONF-2 | MUST | Steward | wire | An answer from a brain-served endpoint without an utterance record, or with one not timed after the latest `ask` event for its step less the clock tolerance or timed after the answer's arrival plus it, or whose `utterance_id`, or whose `endpoint`, `time` and `transcript`, already answered another plan, or naming a step not in the ask's `step_ids`, or, from an endpoint with a voice record, without `asked_by`, or whose `asked_by` shows a `status` other than `full` or `cut` by this utterance, or is `full` without `ended_at` or with a `time` not after it within one `clock_epoch`, is `invalid_request`; the record is kept in `history` with its step; a record without `addressed_by` counts as `follow_up` |
| GA-CONF-3 | MUST | Steward | wire | A token is issued only for a step answered `yes` or authored, bound to its target, action, args, `via`, `brain` and `for`, expiring 60 s after issue |
| GA-CONF-4 | MUST | Steward | wire | `define` refuses any change set after which a `confirm_on` names a brain-served endpoint |
| GA-CONF-5 | MUST | Steward | wire | Every plan with an ask step emits an `ask` event `{ plan_id, step_ids, endpoint, time }`, its endpoint being the plan's or the `confirm_on` that applies, the endpoint's or else its brain credential's |
| GA-CONF-6 | MUST | Steward | wire | An answer whose record is `addressed_by: follow_up` or `skill` counts only with `hint_basis: gate` and a `speaker_hint` naming the plan's `speaker`, or any registered person for a plan that named none; against the configured record and the narrowings in force longer than the narrowing delay, `typed` outside an `app`, `skill` without a `skill_account`, `follow_up` where a voice record has it off or listening narrower than `wake_device`, `tap` where `listening` is `off`, `wake` where it is `off` or `tap`, a `gate` basis with no gate model for that person there, and a `person` basis naming another than the endpoint's person, are refused; any refused one is `not_permitted` and changes nothing |
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
| GA-STW-7 | MUST | Steward | wire | Events are kept 3600 s; `history` returns define, ask, answer, lease, narrowed, refused, rule_fired, scenario, schedule_missed, schedule_skipped and notice events, and the applier's state, outcome, late_ack, latch, liveness, model, route_conflict, provision, freshness, transport, other_admins, bridge_fault, occurrence and undescribed events (`undescribed` as received live), with causes for 7 days, a `state` event's `speech` key and an `occurrence` of a personal key excepted, kept in events only |
| GA-STW-8 | MUST | Steward | wire | Apply re-evaluates `leased` and occupancy at dispatch, keeps the answers given, a `yes` to `ask(in_use)` or `ask(in_use_unknown)` answering the room's `occupancy_unknown` too, and passes the applier's re-evaluation through |
| GA-STW-9 | SHOULD | Steward | wire | `apply` adds no more than 200 ms to the applier's synchronous bound |
| GA-STW-10 | MUST | Steward | wire | The steward applies to its applier inline, re-planned at dispatch, one applier apply per steward apply, rule firing or run step, each with a key that survives a restart |
| GA-STW-11 | MUST | Steward | wire | A `session.lock` naming a `person` resolves to one step per account that computer maps to that person, in code-point order of their tokens, the applier receiving `account` only; a person with no account mapped there is `refuse(invalid_args)` |
| GA-STW-12 | MUST | Steward | wire | Every outcome returned by `apply`, `outcome` or `scenario_status` carries its `time`, the one its `outcome` event carries, or for the steward's own outcome the moment the steward decided it |
| GA-NOTE-1 | MUST | Steward | wire | Every applier notice is retried on the home's `notify` channels, which `define` refuses to leave without one, at least every 60 s and without giving up, until one ends `delivered`, or `sent` where no receipt exists, before the steward sends `notice_taken` |
| GA-NOTE-2 | MUST | Steward | wire | While its applier's `standard_version` is below 0.10 no `notify` the steward dispatches carries `from`; from 0.10 on, every one carries its own `from`: `{ endpoint, role }` for a request or a person-started run, `{ rule }` for a rule or a rule-started run, `{ scenario }` for a scheduled run, `{ notice }` for a notice, a `{ rule }` or `{ scenario }` of `brain_authored` work with `brain_authored: true`; a caller's `from` is overwritten, never passed on, and the overwrite recorded as `from_replaced` on the plan's step or the inline step's outcome |
| GA-NOTE-3 | MUST | Steward | wire | When a token a computer's `account_persons` maps leaves its `accounts`, a notice naming the person, the token and the computer is delivered and retried as GA-NOTE-1's, once each time a mapped token leaves; the mapping is kept |
| GA-LEASE-1 | MUST | Steward | wire | An endpoint principal's apply leases each device it dispatched a stateful action to, from dispatch, for the hold time, ending if the step ends `unreachable`; a rule's later action there is `refuse(leased)`; stateless actions and `session.lock` take no lease |
| GA-LEASE-2 | MUST | Steward | wire | An `external` or `load_cap` change takes a person-precedence lease for the hold time, one missed in a `cursor_expired` gap included, read back from the applier's `history` for what is left of it; a `device` change takes none |
| GA-LEASE-3 | MUST | Steward | wire | Equal or higher precedence replaces a lease; lower is refused; a `session.lock` is never refused by a lease and replaces none; a duck while a front speaks is refused by no lease but a `safety_rule`'s |
| GA-LEASE-4 | MUST | Steward | wire | When a lease ends, level-triggered rules naming its devices are re-evaluated and fire if their condition holds; edge-triggered rules are not |
| GA-LEASE-5 | MUST | Steward | wire | No rule's action takes a lease |
| GA-LEASE-6 | MUST | Steward | wire | A device a safety rule actuated holds a `safety_rule` lease until the rule's latch clears, by itself or by the owner, or until the rule completes when it has none; held latches are re-read after `cursor_expired`, and a latchless rule's completion read from `history` |
| GA-OCC-1 | MUST | Steward | wire | With `respect_occupancy`, an occupied room (an occupancy sensor reading presence now, or a `live` motion sensor reading motion now or within the hold) is `skip(occupied)` and an unknown one `ask(occupancy_unknown)`; vacant needs an occupancy sensor and every occupancy sensor live throughout the hold with a known `fresh_s` that, with its `fresh_slack_s`, is no greater than `occupancy_hold_s`, none reporting presence within it; a target with no room is unknown; without the flag, occupancy is not consulted |
| GA-OCC-3 | MUST | Steward | wire | With `respect_occupancy`, a computer's `power.sleep` or `power.shutdown` is `ask(in_use)` when an account mapped to a person reads `active` or `idle`; else `ask(in_use_unknown)` when a mapped account reads `unknown` or its key is absent, or, with an account mapped, the computer is `stale`, and always when the computer has no `session` capability, an account mapped or not; else the room check applies as GA-OCC-1 says; unmapped accounts never count; the session check adds to the room check, never removes it; a `yes` to `ask(in_use)` or `ask(in_use_unknown)` also answers the room's `occupancy_unknown` for that step, and an `occupied` room still skips it |
| GA-LISTEN-1 | MUST | Steward | wire | `narrow` is accepted from any credential bound to the endpoint, any role, and from its front, if it asks for nothing wider than the configured record, else `invalid_request`; it holds at most the narrowing limit; the effective record is the narrowest of the configured one and every narrowing in force, and returns to the configured one, never wider, when the last expires; each narrowing, lift and expiry changes the revision |
| GA-LISTEN-2 | MUST | Steward | wire | `describe` shows each endpoint's voice record, its reported effective record, its front's models and the narrowings in force; an effective record with a reason other than `configured`, a narrowing or a mute is a notice naming the endpoint and reason, once per change of reason, `offline` after the offline grace, and so are narrowings not made from an owner's own endpoint keeping an endpoint narrowed 24 h in a row |
| GA-LISTEN-3 | MUST | Steward | wire | `zone_sources` gives a front every `media` target in the home whose `speech` is not null, with `speaking_for_ms`, within the source delay of the applier's `state` event, and every `media.announce`, and notice spoken through a `speaker` or `tv` `notify` target, dispatched anywhere in the home, with its text, from dispatch until the target's `speech` reports that text ended or, at a target reporting no speech, for the announce hold, a later `media.announce` to it meanwhile being `refuse(conflict)` and a notice's spoken copy waiting; a listing at a target that reports speech ends at the latest the announce hold after dispatch if the text was not shown within the source delay, and the announce hold after the target's last `speech` report |
| GA-LISTEN-4 | MUST | Steward | wire | A `media.announce`, or a notice spoken through a `speaker` or `tv` `notify` target, whose text, normalised with no word removed, contains as whole words, or within the echo match of, a wake word of any endpoint or one of the home's `other_wake_words` (a default list, which the owner edits) is `refuse(invalid_args)`, the near-spelling test taking the listed word as the transcript; while an `ask` at a brain-served endpoint is open (from its `ask` event until answered, applied or expired), one whose text contains a run of `answer_words` is `refuse(invalid_args)`, a notice's spoken copy waiting at most `ask_expiry_s` and checked again at dispatch |
| GA-LISTEN-5 | MUST | Steward | wire | A steward that ducks for a front ducks only a target whose `media.duck` is `reversible` and not declared `toggles`, and no device another cause ducked, un-ducks only what it ducked, and does so on `on: false`, a lost connection, or the duck limit without word |
| GA-RULE-1 | MUST | Steward | wire | A level-triggered rule fires once per becoming true, and after a restart or `cursor_expired` fires once if its condition holds and it has not fired for it |
| GA-RULE-2 | MUST | Steward | wire | A rule's conditions, whole, are false while a device they read is not `live`; a state or held-state trigger does not hold over such a device, and a held duration restarts once it is live; a rule or a scenario's `if` reading a device with no known `fresh_s`, or an owner `fresh_s` longer than the declared one, is a notice at `define` and at the device's adoption; no condition (a rule's, an `if`'s, a `wait`'s) holds on an `assumed` value |
| GA-RULE-3 | MUST | Steward | wire | A `between` window holds from `from` up to `until` in the home's timezone, on the next day when `until` is not later, `days` naming the day it starts; a time in a daylight-saving gap takes the first minute after, one that occurs twice its first occurrence; entering it is becoming true; `define` refuses a window whose `from` equals its `until` |
| GA-RULE-4 | MUST | Steward | wire | `not_in` is true when the key reads none of its values, `unknown` (unless listed) and an absent key included; a `session.<token>` key retired from the computer's `accounts` (GA-BRIDGE-52) makes every condition that reads it, `not_in` included, read false instead, so a rule on a retired account stops firing |
| GA-RULE-5 | MUST | Steward | wire | A rule of conditions only is level-triggered, held for 0 s: it fires when its conditions become true together and again each time they do after being false |
| GA-RULE-6 | MUST | Steward | wire | A rule never fires inside one of its exceptions; when one ends, a level-triggered rule whose condition holds fires; `define` refuses an exception whose `until` is not after its `from` |
| GA-RULE-7 | MUST | Steward | wire | An action of a rule of conditions only, declared idempotent, that ends `skipped(dead)`, `unreachable` or `failed(no_ack)` while the conditions hold is fired again, no sooner than its `ack_within_s` after its last try and no later than 300 s after it, or its `ack_within_s` when longer, until it ends in success or the conditions stop holding; one that ends `unanswered` on a `feedback: open` device is fired again once, at the same spacing, and then no more while the conditions hold; no other outcome, and no action that is not idempotent, is fired again |
| GA-RULE-8 | MUST | Steward | wire | An action of a rule of conditions only that ends, while the conditions hold, in an outcome neither a success GA-RULE-7 names nor one it fires again for raises a notice naming the rule, the action, its target and the outcome, delivered and retried as GA-NOTE-1's, at most once for that action per becoming true; `refused(leased)`, `skipped(occupied)` and `skipped(in_use)` raise none; a `failed(not_locked)` raises it only once the lock's `ack_within_s` from its dispatch and the late-ack slack pass with no `late_ack`, a `failed(no_graphical_session)` at once, and a `failed(no_ack)` only once the 60 s late-ack window after it and the late-ack slack pass with none, a held notice raised even if the conditions stop holding during the wait; `skipped(toggle_only)` raises none, the steward issuing one notice for a rule, or a schedule whose scenario (or one its `run` steps reach) acts on an action declared `toggles: true` on a `feedback: open` device, at its `define`, when such an action comes into its selector, and when a declaration change makes an action it names one |
| GA-SCN-1 | MUST | Steward | wire | A run honours its scenario's mode; a start `single` ignores returns the running run with `ignored` |
| GA-SCN-2 | MUST | Steward | wire | A running scenario leases its owned targets, groups expanded except `infrastructure` members, and releases only its own leases when it ends |
| GA-SCN-3 | MUST | Steward | wire | A person-started run acts as that person: its `no_voice` steps through a brain are refused; a guest's steps above `reversible` are refused; unanswered asks are `skipped(not_confirmed)`; a yes stands for the whole run, except a yes to `ask(toggle_only)`, which stands for `ask_expiry_s` after it was given, a toggle step dispatched later asked again and `skipped(not_confirmed)` without a new `yes`; a run started at an endpoint names it in its cause |
| GA-SCN-4 | MUST | Steward | wire | A scheduled run, a rule-started run and a rule's own action turn `ask(occupancy_unknown)`, `ask(in_use)` and `ask(in_use_unknown)` into the matching `skip`, and a step the applier plans `refuse(toggle_only)` into `skip(toggle_only)`, whatever its tier; a scheduled run's and rules' `confirm` and `no_voice` steps count as authored, never as answering a toggle |
| GA-SCN-5 | MUST | Steward | static | Every scenario declares exactly one mode, one the steward lists |
| GA-SCN-6 | MUST | Steward | wire | `scenario_plan` gives one step per action step in order; a repeated `scenario_run` key within 3600 s returns the first run and starts nothing |
| GA-SCN-7 | MUST | Steward | wire | A run re-evaluates every step at its dispatch, the first included, occupancy too; an unanswered ask found then is `skipped(not_confirmed)`, an answered one stands |
| GA-SCN-8 | MUST | Steward | wire | An `if` step evaluates its condition when reached and runs at most one branch, none on a target that is not live, or on an `assumed` value, without an `else`, the step then ending `skipped(dead)`, `skipped(stale)` or, on an `assumed` value, `skipped(assumed)`, in `failed_steps` |
| GA-SCN-9 | MUST | Steward | wire | `scenario_stop` by a lower-precedence principal, or a lower role than the run's starter, is `not_permitted`; a stopped run ends `ended(stopped)` |
| GA-SCN-10 | MUST | Steward | wire | A timed-out `wait` ends the run with `stop` and continues with `continue`, recorded either way |
| GA-SCN-11 | MUST | Steward | wire | `scenario_status` leaves `skipped(occupied)` and `skipped(in_use)` out of `failed_steps`, and lists `skipped(occupancy_unknown)`, `skipped(in_use_unknown)`, `skipped(not_confirmed)` and `skipped(toggle_only)` in it |
| GA-SCHED-1 | MUST | Steward | wire | A schedule exception suppresses or moves exactly that date's run |
| GA-SCHED-2 | MUST | Steward | wire | A run missed while the steward was down is not run late and is recorded as `schedule_missed` |
| GA-SCHED-3 | MUST | Steward | wire | A scheduled time in a daylight-saving gap runs at the first minute after; one that occurs twice runs once |
| GA-DEF-1 | MUST | Steward | wire | `define` with `dry_run` changes nothing and returns a diff |
| GA-DEF-2 | MUST | Steward | wire | `define` at a stale revision, or for a plan made at one, returns `stale_revision` and changes nothing |
| GA-DEF-3 | MUST | Steward | wire | `define` is an owner's from an endpoint not served by a brain; through a brain, persons, endpoints, voice records, credentials and home settings are never changed nor a narrowing lifted, `narrow` being the one exception; anything the steward does not accept is `not_permitted` |
| GA-DEF-4 | MUST | Steward | wire | `define` refuses scenarios whose `run` steps form a cycle, with `cycle` |
| GA-DEF-5 | MUST | Steward | wire | A `define` change set applies whole or not at all |
| GA-DEF-6 | MUST | Steward | wire | `define` through a brain returns a plan with `ask(confirm_define)`; unanswered, it changes nothing |
| GA-DEF-7 | MUST | Steward | wire | A `brain_authored` step whose effective tier at dispatch is above `reversible` is `refuse(tier)`, gets no authored token, and is sent with `brain: true`; a run that `brain_authored` work starts, or whose date a brain moved, is `brain_authored`, and so is an authored step reaching a device through a room or group the device joined through a brain |
| GA-DEF-8 | MUST | Steward | wire | `define` refuses a voice endpoint, or any endpoint with a voice record, without `served_by`; an `app` endpoint without a `person`; a voice record whose `heard_by` names no front credential; voice records naming more than one front; a `skill_account` on an endpoint that is not `type: voice` or has a `person`; two endpoints with one `skill_account` and `skill_surface`; one account with both a surfaced endpoint and one without; an endpoint with a null `room` that is not an `app`; and `notice_channels` without a `notify` channel |
| GA-DEF-9 | MUST | Steward | wire | `define` refuses, with `invalid_request`, a change set naming a device the applier has not adopted |
| GA-DEF-10 | MUST | Steward | wire | `define` refuses, with `invalid_request`, a change set putting an `internal` device in a room or a group, or naming one as a target of a scenario's or a rule's action |
| GA-DEF-11 | MUST | Steward | wire | `define` sets a computer's `account_persons` as account token to person id, a field apart from the applier's `accounts`, which `describe` passes through unchanged beside it; it refuses, with `invalid_request`, `account_persons` on a target that is not a `computer` or naming a person not registered |
| GA-DEF-12 | MUST | Steward | wire | `define` refuses, with `invalid_request` and changing nothing, a change set whose rules or scenarios that it adds or changes have a trigger or conditions, an `if` or a `wait` that reads a key its device does not declare (as *Rules* defines declaring, a trigger's extension `event` keys included) (for a selector, a key no matched device declares, `data` then naming no `device`, and `awaited` true where any matched device awaits the key), its `data` `{ key, device, awaited }`, `awaited` true where the device's `awaited_keys` lists the key |
| GA-SEC-2 | MUST | Steward | wire | Every connection uses TLS, with the server's certificate validated, unless both ends are on one host's loopback |
| GA-BIND-2 | MUST | Steward | wire | The steward serves MCP protocol revision `2026-07-28` to every caller, answering no revision but that one, `2025-06-18` and `2025-11-25`; it reaches its applier at `2026-07-28` where the applier serves it, and falls back, to one of those two only, for an applier that does not |
| GA-HARN-2 | MUST | Steward | wire | Under the harness, the steward takes all time, elapsed time included, from the `time_source` set by `define`, and honours the harness stepping it; `time_source` is accepted only while its applier reports a `test_run_id` |
| GA-PERSIST-2 | MUST | Steward | wire | The house model, leases, idempotency keys and the counters they are made from, open plans and answers, history, schedules' last runs and the notices GA-RULE-8 holds for a late ack survive a restart; an interrupted run ends `ended(interrupted)` |

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
  should consult sessions too, or sleep be tiered higher, is policy.
- The JSON Schemas; until they exist, the tables above are the shapes.
