---
title: The Galatea applier standard
status: draft
last_verified:
area: architecture
audience: dev
author: Galatea maintainers
version: 0.15
related:
  - standard/steward.md
  - standard/bridge.md
  - docs/specs/2026-09-25-discovery-design.md
  - docs/specs/2026-09-24-standard-split-design.md
  - conformance/applier-requirements.json
  - docs/reviews/2026-10-01-bridge-0.5-applier-0.14.md
  - CONTEXT.md
  - docs/reviews/2026-10-06-bridge-0.6-applier-0.15.md
---

# The Galatea applier standard

## Changelog

| Date | Version | Change |
|---|---|---|
| 2026-10-06 | — | Editorial: private references removed for publication; no requirement changed. Decisions once credited to another system now state what was decided and why; links to documents that are not public are reworded |
| 2026-10-06 | 0.15 | Joint revision with bridge 0.6 and steward 0.10. From the Zigbee bridge's live bench run and the maintainer's rulings of 2026-10-06: the sensor keys' names and units follow Home Assistant 2026.9.4 (released 2026-09-27), with Galatea's own meanings (*Sensor keys*); `contact` renamed `opening`, `true` meaning open, since its polarity was never defined; new sensor keys `illuminance` (lux) and `battery_low` (⚠️ tentative); `occupancy` and `motion` defined; a device's `awaited_keys`, `undescribed` and `settings` from its bridge, and the bridge's `undescribed` event relayed (GA-DESC-19); `configure` refuses a safety rule, latch or witness on an undeclared key, and a declaration change that leaves one on such a key disables it (GA-SAFE-14); an adapter maps an engine's sensors by meaning, an engine's `occupancy` as `motion` unless it sees stillness (GA-STATE-5); an error body may carry `data`; a device's settings changed through `provision`'s `configure_device` (*Settings*, ⚠️ tentative, outside the requirement index). The applier's own queued items are applier 0.16. Reviewed with the `standard-review` procedure in five rounds (change record `docs/reviews/2026-10-06-bridge-0.6-applier-0.15.md`): Kimi (k3) and a no-context Claude reader, and a scenario walk each round; 183 findings: 151 fixed (round 5's highs not re-read, by the stopping rule), 24 deferred to the backlog, 6 no change, 2 rejected; the maintainer's rulings of 2026-10-06 on held-back keys (numeric only), kept settings (A), GA-OCC-1 (a motion sensor reading motion now) and cross-topic order (applier 0.16). **PASS** 2026-10-06 |
| 2026-10-01 | 0.14 | Device extensions on any bridge, for bridge 0.5, by the maintainer's rulings of 2026-10-01 (change record `docs/reviews/2026-10-01-bridge-0.5-applier-0.14.md`): `extensions` on any device, each key a `state` or an `event` (`kind`); `confirmed_by` on any stateful extension action; the extension tier row and the not-idempotent default for any extension action, not only a plugin's; the `occurrence` event, never state, kept in `history` unless its key is personal, relayed by a meta-applier (GA-EVT-8 new); a bridge's changed declarations a model change: an undispatched step whose declarations changed `refused(declaration_changed)`, a dispatched action re-sent only where old and new both say idempotent, the owner's lowered tier and `idempotent: true` falling back (GA-DESC-18 new); a held latch refuses every extension action on a device its rule actuated. GA-DESC-3, GA-DESC-4, GA-DESC-14, GA-EVT-3, GA-EVT-5, GA-APPLY-9, GA-SAFE-7 and GA-META-8 amended. Reviewed in `docs/reviews/2026-10-01-bridge-0.5-applier-0.14.md`: one round of two readers (Kimi `k3`; Claude, no context) and a scenario walk (no grade changed); 30 finding rows, 26 fixed (one in part), 3 deferred, 1 rejected; no blocker; round 1's fixes not re-read by a further round (the stopping rule); **PASS** 2026-10-01 (the maintainer, after walking the deferred items) |
| 2026-09-28 | 0.13 | The MCP binding is pinned to protocol revision `2026-07-28`, by the maintainer's rulings of 2026-09-28: the applier serves it to every caller, the owner's configuration credential included (GA-BIND-1, new, with `speaks-only-2025`), and answers no revision but it, `2025-06-18` and `2025-11-25`; a meta-applier reaches each child at it where served (GA-BIND-3, new, with `meta-calls-a-child-at-2025`); any other client SHOULD use it; a client learns what a server serves by `server/discover`; a change of the pinned revision is not an addition. GA-SEC-1 covers every connection to an applier at any revision; GA-AUTH-3 refuses a removed client at every revision and in any session (`session-outlives-revocation`). Reviewed in `docs/reviews/2026-09-28-mcp-revision-pin.md`: two rounds, each of a third-model reader (Kimi) and a no-context Claude reader, with a scenario walk; round 1 found one blocker (fixed), round 2 none. **PASS** 2026-09-28 (the maintainer, confirmed at the merge, 2026-09-28); round 2's fixes were not re-read. |
| 2026-09-27 | 0.12 | A `whole_state` command takes each key from the latest earlier action on the device, from any apply, once dispatched and unless it ended `failed` or `unreachable`, the action's own key with the value it asks for, and nothing is held back; when such a command ends `sent` or `unanswered`, every key it carried becomes assumed (GA-APPLY-16); an `unanswered` action moves the assumed value, as `sent` does (GA-STATE-4); `speech` `self_changing` on every device that reports it (GA-DESC-9); `speech` excepted from GA-EVT-5's 7-day row. Reviewed in `docs/reviews/2026-09-27-post-merge.md`, the post-merge review of voice 0.1, brain 0.5, steward 0.6, applier 0.11 and bridge 0.4: three rounds, each of a third-model reader (Kimi) and a no-context Claude reader, with a scenario walk; round 1 found two blockers, round 2 one more (fixed), round 3 none. The additions for adapters (an applier's own extensions, playback) were written in rounds 1 and 2 and taken out again before the bump, for the adapter design. **PASS** 2026-09-27 (the maintainer, after round 3, whose three fixes were not re-read, by the maintainer's stopping rule). |
| 2026-09-27 | 0.11 | For the voice front (`standard/voice.md`), on top of 0.10's home PCs: `media.announce(text)`, stateless and not idempotent (GA-DESC-4 names it); the optional `speech` state key, kept in `events` and never in `history`. Passed review on its own branch as 0.10 (`docs/reviews/2026-09-25-voice-0.1.md`, eleven rounds, PASS 2026-09-25), and read with 0.10's text in that record's round 12, which made `speech` personal (GA-DESC-9) and added `front` to the steward's cause in `for`. **PASS** 2026-09-27 (the maintainer, after round 12, whose fixes were not re-read by the round's scope). |
| 2026-09-27 | 0.10 | Home PCs, from the approved PC design (`docs/specs/2026-09-25-pc-design.md`, revision 5; change record `docs/reviews/2026-09-25-pc-standards.md`), against bridge 0.4, on top of 0.9's discovery: classes `computer` and `player`; capabilities `power` and `session`, with the `session.<account>` key family; `media.launch` with `title` and `started_at`, acked by a new item; `args` constraints on an object's fields; sensor keys `app`, `camera_in_use` and `microphone_in_use`; `notify`'s `from`; `power.shutdown` and `media.launch` not idempotent; `self_changing` and `personal` declarations the standard makes, which the owner cannot remove; device fields `wake_via`, `host`, `plugin`, `version`, `internal`, `personal`, `accounts`, `staged_for`, `extensions` and `proposed_infrastructure`; the wake path and its named exceptions; default tiers for computers, `infrastructure` power and plugins' extension actions (ruling 5), with the extension floor; extensions `describe` lists count as known; adapters' computers; `install` and `uninstall` at Host, and `activate` on adoption; staged versions. GA-DESC-9 to 14, GA-APPLY-12 to 15, GA-EVT-7, GA-ADOPT-4, GA-PROV-4 and GA-BUS-15 new; GA-DESC-3, GA-DESC-4, GA-STATE-3, GA-STATE-4, GA-STATE-5, GA-PLAN-4, GA-APPLY-5, GA-APPLY-7, GA-APPLY-8, GA-APPLY-9, GA-EVT-1, GA-EVT-3, GA-EVT-6, GA-PERSIST-1, GA-PROV-1, GA-ADOPT-2, GA-ADOPT-3 and GA-BUS-11 amended. Carried from 0.8's review: an optional `idempotency_key` on `provision`, serving `install` and `uninstall` too, answered from the applier's own record of the key (GA-PROV-3 new, GA-PERSIST-1 amended); a token dispatched at most once by applies running at once, and a meta-applier's re-issued `token_id` derived from the original's (GA-TOKEN-4, GA-META-10 amended); by the maintainer's ruling of 2026-09-27, open-loop devices: an `assumed` value is never taken as observed, and a transmitter that can answer nothing leaves its devices usable, on an `unknown` transport (GA-STATE-4 amended); an action declared `toggles` is never sent to reach a state without a token, `refuse(toggle_only)` until a person says yes (GA-PLAN-8 new); from the review, `toggle_only` holds on open-loop devices only, the author's confirmation of a rule, a schedule or a run started by no person and no endpoint is never taken for a toggle, no button action, the applier's own actuations never send a toggle (GA-SAFE-13 new), an adoption on an `unknown` transport is an `open_loop` notice (GA-ADOPT-6 new), and a command for a whole-state code carries the assumed state (GA-APPLY-16 new); open-loop devices kept as a known limitation, stated in *What this standard does not define*. Added by the review, among the ids above: an owner's `idempotent: true` on an extension action falls back on a changed tool hash (GA-DESC-15), a replacement keeps `personal` and a `self_changing` removal (GA-DESC-16), `session.lock`'s `account` limited to the listed tokens (GA-DESC-17), a staged adoption with `replaces` pending until the swap (GA-ADOPT-5), the `applier_host` mark (GA-CFG-3 amended). Reviewed in `docs/reviews/2026-09-25-pc-standards.md`: eleven rounds of two readers (Claude Opus; Claude Sonnet; a third-model reader skipped by the maintainer's ruling) and a scenario walk in each; 317 finding rows, 300 fixed, 10 deferred, 6 rejected, 1 recorded with no text change; no blocker open; **PASS** 2026-09-27 (the maintainer, after round 11; round 12 not run, so round 11's fixes and the known-limitation note were not read by a further round) |
| 2026-09-25 | 0.9 | Discovery, for bridge 0.3 (`docs/specs/2026-09-25-discovery-design.md`): *Discovery*, with the `candidates` operation, the configuration credential's only, and no candidate event; `ignore_candidate` and `unignore_candidate`, kept by key; `provision.connect`, carrying the address the owner saw and no credential; the `provision` event's `connected` and `connect_failed`; the meta-applier offers only its own bridges; transports join the model's revision, and ignores do not. GA-DISC-1 to 5 new; GA-PROV-1 names `connect`, and GA-ADOPT-1's text; GA-CFG-2 exempts the ignores from `expected_revision`; GA-PERSIST-1 keeps `ignored_keys` and the bridges' last `connections`; `candidates` is read-only and `provision` destructive in the MCP annotations. Passed review 2026-09-25 after eight rounds and a third-model reading (`docs/reviews/2026-09-25-bridge-0.3-applier-0.9.md`) |
| 2026-09-25 | 0.8 | The applier's outcome `applied` is `dispatched`; `unreachable` always means nothing was sent, and a bridge found dead while a step waits ends it `failed(no_ack)` at once; liveness is the applier's verdict on its bridges' facts, with `fresh_slack_s`; the owner's bound always wins, with notices where it is longer than the declared one; GA-SAFE-12 re-sends a safety actuation by what its outcome says could have run; GA-SAFE-8's at-once notice; GA-SAFE-10's grace after a planned reload; `box: true` refused over plain TCP; `bridge_device` in `describe`. GA-BUS-12, 13 and 14 new. Reviewed in `docs/reviews/2026-09-25-bridge-0.2-applier-0.8.md`: pass 1 and six rounds of two readers (a third-model reader; a no-context Claude reader) and a scenario walk; 153 finding rows fixed, 4 deferred, 1 rejected; no blocker open; **PASS** (the maintainer, 2026-09-25, after round 6, whose fixes were mostly removals, taken without a further read) |
| 2026-09-25 | 0.7 | For the bridge standard: *Adoption* (GA-ADOPT-1 to 3; a device is new by how its protocol admits it; replacement keeps the id; other admins), *Provisioning* (GA-PROV-1, 2), *Bridges* (GA-BUS-1 to 11), *Transports*; outcomes `sent` and `unanswered`; the read-back; `sensor_keys` beside `sensor_key`; `fresh_s` and `fresh_basis` with the owner's precedence (GA-STATE-6); `reach_s`; `box`; GA-SAFE-6's `accepts_other_admins`, GA-SAFE-11's new report, GA-SAFE-12's re-send; GA-APPLY-11 unchanged from 0.6 in the end. Reviewed in `docs/reviews/2026-09-24-bridge-0.1-applier-0.7-steward-0.3.md`: seven rounds of two readers (a third-model reader; a no-context Claude reader) and a scenario walk; about 203 finding rows fixed, 15 deferred, 8 rejected, 2 no action; no blocker open; **PASS** (the maintainer, 2026-09-25, after round 7, with round 7's one looser move, the trust-centre rejoin, recorded rather than re-read) |
| 2026-09-24 | 0.6 | **Split.** The house's state and authority move to the steward standard (`standard/steward.md`): rooms, names, groups, persons, roles, scenarios, rules, schedules, leases, occupancy and the confirmation dialogue. This document keeps the device contract: describe, plan, apply, outcomes, events, liveness, device tiers, safety rules, and the meta-applier as routing only. The Scenarios level is dropped; the levels are Act and Safe. New: confirmation tokens, socket loads with an on-time cap, safety latches, notices that are never dropped, open-loop devices, the device's own changes as a cause, `configure`, transport security. Reviewed in four rounds by a third-model reader and no-context Claude readers with scenario walks: about 190 findings, 2 rejected, 14 deferred, the rest fixed; F1–F50 of 0.5 disposed. **PASS**. Record: `docs/reviews/2026-09-24-split-applier-0.6-steward-0.1.md` |
| 2026-09-24 | 0.5 | After a gate derivation: five wire-testable MUSTs that had no id get one (GA-LVL-1, GA-LEASE-5, GA-SAFE-5, GA-SAFE-6, GA-EVT-4); `history` returns outcome events as well as state events, so a failure's reason survives past the event window (GA-EVT-5) |
| 2026-09-24 | 0.4 | After the re-reviews of 0.3: owner-declared device keys are `key:<key>`, a namespace of their own; GA-META-1 names them; `describe.children` carries each child's `ungoverned`; group expansion leaves out `infrastructure` members everywhere, leases and `owned` included, while group state still counts them; an unknown verdict is `refuse` with no reason; version self-references made version-free |
| 2026-09-24 | 0.3 | After the re-reviews of 0.2: a child's device with a stable identifier is exposed as `sid:<identifier>`, stable across routes; owner-declared keys for devices without one; `scenario.run` re-evaluates at dispatch; `ungoverned` is per child, and what a meta-applier's Full claim covers over an adapted child; below Full, `respect_occupancy` asks (GA-OCC-2); per-step `respect_occupancy`; a scenario plan carries its scenario's flag; group expansion skips `infrastructure` devices; a level-triggered rule fires once per becoming true; an unknown verdict is `refuse`; the endpoint wording of `infrastructure` fixed; new ids GA-OCC-2, GA-SCN-7 |
| 2026-09-24 | 0.2 | After two independent reviews of 0.1 (a third-model reader; a no-context reviewer) and a hazard walk. Defaults for `respect_occupancy` and the occupancy hold; the plan stores its request; apply re-evaluates `dead`, `already`, `leased`; ack bounds and `failed(no_ack)`; argument constraints and `refuse(invalid_args)`; `wait` timeouts; scenario-run cycles and nested plans; scenario plans and keys under the apply rules; lease targets are always devices; only stateful changes take leases; the lease's "next change" clause dropped; rules that must end when a hold ends are level-triggered, with the worked example; groups aggregate `onoff` only; `already` skips stateless actions; the request field `channel` renamed `via`; one cause for scheduled runs; `infrastructure` devices; forward compatibility; the meta-applier's key derivation, event relay, correlation, routed ids and ask translation; `ungoverned` for adapters; `protocol` and `stable_identifier`; new ids GA-APPLY-8, GA-APPLY-9, GA-AUTH-1, GA-DEF-4, GA-DESC-5, GA-DESC-6, GA-META-8, GA-PLAN-6, GA-SCN-6 |
| 2026-09-24 | 0.1 | First text, written from the design spec v0.3 and its two reviews |

**Status: draft.** Nothing implements this yet. The reasons behind the split are in
`docs/specs/2026-09-24-standard-split-design.md`; this document does not repeat them.

The key words MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119 and RFC 8174. A sentence
without one of them is explanation, except that every row of *Requirement index* is normative, at
its row's level. Every requirement the conformance harness checks has an id
(`GA-…`) in *Requirement index*; the manifest, `conformance/applier-requirements.json`, is its
machine-readable copy. A MUST with no id binds a party the harness cannot test and says so. Ids are
one namespace across the Galatea standards; an id cited here may live in `standard/steward.md`.

## What this standard governs

The contract between a **client** and an **applier**, and between a **meta-applier** and its
**children** (all defined in `CONTEXT.md`). The client is a **steward** (`standard/steward.md`), or
a meta-applier acting for one. An applier executes actions on devices and guards **the device**:
what it can safely take, whether it is alive, what it reported. It does not know who a person is,
which room a device is in, or what the house's routines are; those are the steward's.

It does not govern:
- how an applier talks to devices. Its bridges speak the Galatea bridge standard
  (`standard/bridge.md`), whose MQTT binding the liveness rules here rely on; this standard holds
  only the applier's side of it (*Bridges*). An adapter speaks its engine's own interface;
- the house model, persons, roles, scenarios, rules other than safety rules, schedules, leases,
  occupancy and confirmations: `standard/steward.md`.

It does govern how a new device becomes usable (*Adoption*) and how the owner asks a bridge to
join, commission or remove one (*Provisioning*).

## Conformance levels

An applier claims its levels in `describe` (`levels`).

| Level | Adds |
|---|---|
| **Act** | `describe`, `state`, `plan`, `apply`, `outcome`, `events`, `history`, `configure`; device tiers and tokens; liveness; idempotency; ack bounds |
| **Safe** | safety rules and their latches and notices; socket loads and their on-time caps; witnesses |

An applier with children is a **meta-applier**. Its extra requirements (conformance `Meta`) apply
whenever `describe.children` is not empty, at either level.

An operation above the claimed level, or a `configure` change that needs a level not claimed (a
safety rule, a load, a witness on an applier claiming only Act), MUST return the error `not_claimed`
(GA-LVL-1).

**Adapters.** An adapter presents a non-conforming engine as an applier. It MUST list in
`describe.ungoverned` every way its engine can change a device without the adapter seeing the
request first (for Home Assistant: its own automations, its own voice pipeline, its own UI). An
applier that claims Safe MUST have an empty `ungoverned` of its own (GA-DESC-6). The list's honesty
is the adapter author's; nothing on the wire can see an engine's internals, so its completeness is
*not checked by the harness*. An applier over bridges lists, likewise, every path a bridge
declares in its own `ungoverned` (GA-BRIDGE-32), under that bridge; those paths are the applier's
own for GA-DESC-6, so an applier over such a bridge cannot claim Safe.

While its engine is unreachable, an adapter MUST report every device it exposes `dead`. It calls its
engine at least every 5 s; the engine is unreachable when a call to it has gone 10 s without an
answer or its connection is refused, and the devices read `dead` within 1 s after that, and live
again when the engine answers. A device the engine has not yet loaded after its own restart is
`dead` until it has (GA-STATE-3).

## Compatibility

`standard_version` is `major.minor`. A minor version only adds: fields, enum values, operations,
requirements, except where its changelog row says it renames or removes one (0.15 renames the
sensor key `contact` to `opening`): only the current version exists, and a client of an earlier one
is not supported (the maintainer's ruling: no backward compatibility). Nothing on the wire refuses
one, so a home moves its components to a revision together, and an owner redefines a rule stored on
a renamed key. A client MUST ignore a field it does not know, and MUST treat an enum value it does not
know as follows: an event type, ignore the event; an outcome, `failed`; a step verdict, `refuse` with
no reason; a step reason, the verdict's generic meaning with no reason; a transport's `state` in
`describe` or a `transport` event, `down`. *Client obligation; not checked by the harness.*

## The device model

### Identifiers and revision

- Every id is a string of 1–128 characters from `[A-Za-z0-9._:/-]`, case-sensitive and stable.
- An applier has an `applier_id`, stable across restarts.
- The device model has a **revision**, a non-negative integer. The applier MUST increase it on every
  change to the model (devices, transports, declarations, loads, safety rules, children, routes,
  device keys, bridges, adoptions and replacements) and MUST NOT change it on a change of state (GA-DESC-2). A
  device's `fresh_s`, `fresh_basis` and `other_admins`, and a transport's `up` and `state`, are state: they are
  reported as events, not as a new revision; their values in `describe` are a snapshot, and `state`
  is their home. Every `configure` change set that changes anything is
  a model change and increases it, an owner's `fresh_s`, `clear_latch` and `accepts_other_admins`
  included; `ignore_candidate` and `unignore_candidate` alone are not, since they change no device
  (*Discovery*).

### Devices

A device has:

| Field | Type | Notes |
|---|---|---|
| `id` | id | Unique within the applier |
| `label` | string | The engine's or bridge's own name, a hint for the steward; not a name people use |
| `class` | Class or null | From the closed list below |
| `capabilities` | capability name[] | |
| `sensor_key` | string or absent | Only with the `sensor` capability: its main key, fixed at adoption from the keys declared then, so a key declared later never displaces it |
| `sensor_keys` | string[] | Only with the `sensor` capability, which any device may carry beside its others (a lock's `battery`): every key it reports, `sensor_key` first (a leak sensor's `leak` and `battery`); for a bridge's device, which sends only `sensor_keys`, `sensor_key` is its first |
| `proposed_class`, `class_evidence` | from the bridge | Shown for an unadopted device, so the owner chooses its class with the bridge's proposal and evidence in view (`standard/bridge.md`, *Devices*) |
| `protocol` | `matter` · `zigbee` · `zwave` · `modbus` · `ir` · `other` | How the device is reached |
| `stable_identifier` | string or absent | The protocol's own identity (Matter unique id, Zigbee IEEE address, Z-Wave home and node id). MUST be present for `matter`, `zigbee` and `zwave` devices (GA-DESC-5) |
| `previous_identifiers` | string[] | The identifiers of the hardware this device replaced, oldest first; empty unless replaced (*Adoption*) |
| `adopted` | bool | `false` for a device new to the applier until the owner adopts it (*Adoption*) |
| `other_admins` | `[{ vendor, label }]` · `unknown` | Other controllers of the device that its protocol shows: another ecosystem's Matter fabric, a bound Zigbee remote. An adapter's device is `unknown` unless its engine says |
| `transport` | the applier's transport id, or absent | For a device behind a bridge (*Transports*) |
| `bridge_device` | `{ bridge, id }` or absent | For a device behind a bridge: `bridge` is the bridge's `{b}`, the identity it is registered under, and `id` the bridge's own id for the device, `{d}` in its topics, so the box's tool can match a read grant to the device |
| `reach_s` | number or absent | For a device behind a bridge, how long a command may take to reach it (a sleeping device's poll interval); its effective `ack_within_s` is at least twice `reach_s` plus 10, so a read-back fits at the poll after |
| `feedback` | `closed` · `open` | `open` when the device never reports its own state (an IR air conditioner). Every `ir` device MUST be `open` (GA-DESC-7) |
| `load` | `heating` · `motor` · `lighting` · `other` or absent | Only on a `socket`: what is plugged in. See *Loads* |
| `max_on_s` | number or absent | Only with `load: heating`. See *Loads* |
| `fresh_s` | number or null | The device's effective freshness bound (*State and liveness*); null when it is not known |
| `fresh_slack_s` | number | How long past `fresh_s` the applier may take to see the device `stale`: 11 for a device behind a bridge, whose check-ins reach it with the bridge's `status` (its 10 s interval and 1 s for delivery), 0 otherwise; under a meta-applier, plus 6 s for each hop (GA-META-7's 5 s poll and 1 s) (GA-STATE-5) |
| `fresh_basis` | `declared` · `configured` · `unknown` | Where `fresh_s` came from: the bridge's or engine's declaration, the owner's `configure`, or nowhere yet |
| `self_changing` | state key[] | Keys the device changes by its own behaviour (a thermostat's `mode` in `auto`); see *Causes*. It always holds the keys this standard declares `self_changing` (*Computers and players*) and those the device's bridge declares, less a plugin manifest's key the owner removed (GA-DESC-9) |
| `personal` | key[] | State keys, and extension keys of `kind` `event`, that say what a person is doing (*Personal keys*). It always holds the keys this standard declares personal and those the device's bridge declares (GA-DESC-9) |
| `infrastructure` | bool, default `false` | `true` when the device powers or carries the home's own equipment: the applier's host, a bridge, a coordinator, the socket a voice satellite or panel is plugged into |
| `proposed_infrastructure` | `true` or absent | Only on a computer: its bridge's proposal that it carries the broker (`standard/bridge.md`, *Computers*), shown to the owner, who sets `infrastructure`. Until the owner's `configure` sets `infrastructure` on the computer, either way, the applier takes the proposal as `infrastructure: true` for *Default tiers* (GA-DESC-3) |
| `applier_host` | bool, default `false` | Only on a `computer`: `true` when the applier itself runs on it, set by the owner's `configure`. Its administrators already administer the applier and the broker it trusts, so they are not counted as the other admins of a broker it carries (*Safety rules*); its `infrastructure` is read as for any computer |
| `internal` | bool, default `false` | `true` for a device never shown to people: a wake relay's entry, which its bridge declares `internal`, or any device the owner marks so through `configure` (*Waking*) |
| `wake_via` | device id or absent | Only on a `computer`: the device that wakes it, set by the owner's `configure` (*Waking*) |
| `accounts` | `{ <account>: label }` or absent | Only on a `computer`: each interactive account's token and the OS's name for it, from its bridge's `accounts` (*Computers and players*). This shape only: which person an account belongs to is the steward's, in a field of its own (`standard/steward.md`) |
| `host` | device id or absent | Only on a plugin device: the computer that hosts it (*Plugins*) |
| `plugin`, `version` | strings or absent | Only on a plugin device: its plugin's `id` and version, from its bridge's `plugin` and `version`, never parsed from an id (*Plugins*) |
| `staged_for` | device id or absent | Only on a staged plugin device: the device of the installed version it would replace (*Plugins*) |
| `awaited_keys` | key[] or absent | For a bridge's device, the numeric measurements its model promises, and its bridge's maker has seen missing, that the device has not yet reported, from its bridge's `awaitedKeys` (`standard/bridge.md`, *Keys a device has not yet sent*): shown to the owner and the steward, so a rule on one can be refused with the reason |
| `undescribed` | `[{ name, first_seen }]` or absent | For a bridge's device, the data it sends that no key describes, from its bridge's `undescribed` (GA-BRIDGE-76): shown to the owner and the steward |
| `settings` | key[] or absent | For a bridge's device, its keys that are settings (`standard/bridge.md`, *Declarations and settings*) |
| `extensions` | `[{ capability, description, actions: [{ action, description, schema }], keys: [{ key, kind, description, schema }] }]` or absent | Each extension capability the device's bridge declares for it (on a plugin device, its manifest's), with the JSON Schema of each action's arguments and of each key, a key's schema always a scalar, and each key's `kind`, `state` or `event` (`state` where its bridge left it out), from its bridge's `extensions` (*Extensions*) |
| `child` | applier id or absent | Under a meta-applier, the child that owns it |
| `actions` | Action declaration[] | See below |

A **channel** is a device that reaches a person outside the room, with the single action
`notify` and no state.

**Classes (closed):** `light`, `socket`, `ac`, `boiler`, `floor_heating`, `curtain`, `gate`,
`garage_door`, `door_lock`, `water_valve`, `gas_valve`, `tv`, `speaker`, `sensor`, `channel`,
`computer`, `player`.

A **computer** is a PC, one device, owned by the PC's bridge or by an adapter, and
`feedback: closed` (*Computers and players*). Carrying its own PC bridge, with the plugin devices
that bridge hosts, does not make it `infrastructure`; carrying the applier, the broker or another
bridge does, as for any device (the box, if it runs a PC bridge). A PC's bridge that runs on its
broker's own host proposes the flag (`proposed_infrastructure`), which counts for tiers until the
owner sets the flag either way. A **player** is a media player,
usually a plugin's device. A plugin device's class may be null, and so is a wake relay's
entry's.

### Transports

A **transport** is what a bridge fronts devices over, and the unit of shared fate: a Zigbee
coordinator, a Matter fabric, an IR blaster, a Modbus gateway (`standard/bridge.md`). The applier
gives each its own id, unique within the applier, and lists it in `describe` as `{ id, kind, up,
state, bridge }`, `up` a bool, `true` only while `state` is `up`, and `state` its bridge's `up`,
`down`, or `unknown` for a transmitter that can answer nothing (`standard/bridge.md`,
GA-BRIDGE-72; `state` new in 0.10, so a client of 0.9 reads such a transport's `up: false`), so
that the owner's app knows where to open a join window. A meta-applier lists its own and
the union of its children's, namespaced as its devices are. An adapter lists none.

### Capabilities and actions

The vocabulary is closed and versioned with this standard. Its names follow Home Assistant's, as of
Home Assistant 2026.9.4 (released 2026-09-27): its sensor and binary-sensor device classes, with
their units, for the sensor keys (*Sensor keys*), where one fits; the capabilities are Galatea's own.
Galatea adopts the names and units, not Home Assistant's semantics, and writes its own meanings where
Home Assistant gives none. A later Home Assistant release changes nothing here until a revision of
this standard cites it. This version's:

| Capability | Actions (arguments) | State keys | Idempotent by default | Stateless |
|---|---|---|---|---|
| `onoff` | `turn_on`, `turn_off` | `on` (bool) | yes | no |
| `level` | `set_level(level: 0–100)` | `level` | yes | no |
| `color` | `set_color(rgb: "#rrggbb")` | `color` | yes | no |
| `climate` | `set_mode(mode: off·heat·cool·auto·fan)`, `set_setpoint(celsius: number)` | `mode`, `setpoint`, `current` | yes | no |
| `cover` | `open`, `close`, `set_position(position: 0–100)` | `position` | yes | no |
| `cover` | `stop` | — | yes | **yes** |
| `media` | `pause`, `resume`, `set_volume(volume: 0–100)` | `playing`, `volume`, and `speech` where the device reports it (kept in `events`, never in `history`) | yes | no |
| `media` | `duck(on: bool)` | — | yes | **yes** |
| `media` | `announce(text: string)` | — | **no** | **yes** |
| `media` | `launch(search: { title?, series?, season?, episode?, kind?: movie·episode·music·channel })` | `playing`, `title` (string), `started_at` (time) | **no** | no |
| `valve` | `open`, `close` | `open` (bool) | yes | no |
| `lock` | `lock`, `unlock` | `locked` (bool) | yes | no |
| `sensor` | none | any of `temperature`, `humidity`, `motion`, `opening`, `leak`, `occupancy`, `illuminance`, `battery` (percent), `battery_low` (⚠️ tentative), `app` (string), `camera_in_use` (bool), `microphone_in_use` (bool) (*Sensor keys*) | — | — |
| `notify` | `notify(text: string, urgency: info·warning·critical, from?: { endpoint, role } · { rule, brain_authored? } · { scenario, brain_authored? } · { notice })` | none | **no** | **yes** |
| `power` | `wake`, `sleep`, `shutdown(delay_s?: seconds)`, `cancel` | none | yes, but `shutdown` **no** | **yes** |
| `session` | `lock(account: token)` | `session.<account>`: `active` · `idle` · `locked` · `disconnected` · `unknown` · `none` | yes | no |

An action is written `capability.action` (`cover.open`).

**Sensor keys.** What each key means, so that every bridge and adapter maps to it by meaning, not by a
word a protocol, library or engine happens to use (`standard/bridge.md`, *Mapping by meaning*). An
engine's `occupancy` class commonly labels a movement sensor, so an adapter exposes it as `occupancy`
only where the engine or the owner says it sees a person keeping still, and otherwise as `motion`
(GA-STATE-5):

| Key | Type, unit | Means | Home Assistant 2026.9.4 |
|---|---|---|---|
| `temperature` | number, °C | The air temperature where the sensor is | sensor `temperature` |
| `humidity` | number, % | Relative humidity | sensor `humidity` |
| `illuminance` | number, lx | Light level where the sensor is | sensor `illuminance` |
| `occupancy` | bool | Someone is in the sensed area now. `false` is evidence that no one is, from a sensor that can see a person keeping still (radar, vision) | binary sensor `occupancy` |
| `motion` | bool | Movement was detected. Its `false` says the movement stopped: the device's own where it sends one, and otherwise its library's timer's, as the bridge's maker records per model. Never evidence that no one is there | binary sensor `motion` |
| `opening` | bool | `true`: the door, window or lid it watches is open | binary sensor `opening` |
| `leak` | bool | `true`: water where it should not be | binary sensor `moisture` |
| `battery` | number, % | The charge left | sensor `battery` |
| `battery_low` | bool, ⚠️ tentative | `true`: the device says its battery needs replacing soon | binary sensor `battery` |

Home Assistant's `presence` (someone is home) is not a key: a home's presence is the steward's, and
the word means three things in three vocabularies. *Governance, for this standard's authors, not a
requirement:* a key enters this vocabulary only where a generic rule needs it across models (the
reference scenarios name one: dusk by `illuminance`, a battery to change by `battery_low`); anything
else a device reports stays an extension key.

**Key families.** `session.<account>` is a family: one key per interactive OS account the device's
bridge knows, `<account>` being the token the bridge derives for it (`standard/bridge.md`,
*Computers*), never the OS's name, which `accounts` carries as a label. The key an action sets is
the key its capability's row names, except for `session.lock`, whose argument chooses it:
`session.lock { account }` sets `session.<account>` for that account. That key is the one GA-EVT-1,
GA-EVT-3 and GA-BRIDGE-34's read-back read, and the one `already` is judged on.

**`from`.** `notify`'s `from` says who sent it: `{ endpoint, role }` for a request, `{ rule }` for
a steward's rule, `{ scenario }` for a scheduled run, and `{ notice }` for the house's own notices.
A `{ rule }` or `{ scenario }` carries `brain_authored: true` when a brain wrote the rule or started
the run (the steward's GA-NOTE-2), so the applier and a bridge take that key there, and pass it on
as it came.
It is optional here, so that a client written for an earlier minor version still works
(*Compatibility*): the applier accepts a `notify` without it. The steward MUST set it on every
`notify` it dispatches; that duty is the steward's (`standard/steward.md`). The applier's own notice
on a channel it owns carries `{ notice: notice_id }`. The applier MUST send `from` in the command's
value only when the request carries it, and only to a device whose `notify` declaration lists
`from` among its `args`, and MUST leave it out for any other, so that a bridge on an older version
never refuses a `notify` for it (GA-BRIDGE-4) and the steward never retries one for ever
(GA-NOTE-1); the source is then shown only in the owner's app (GA-APPLY-14). A meta-applier passes
`from` to its child unchanged, as it passes `for`, but only to a child whose `standard_version` is
0.10 or later and whose device's `notify` declaration lists `from`; to any other child it leaves it
out, as it would for a bridge, so that an 0.8 or 0.9 child never refuses the step for an argument it does
not know (GA-APPLY-14).

**Arguments that are objects.** `media.launch`'s `search` is a typed object, after Matter's Content
Launcher: the device picks the item. A device says which of an object's fields it supports through
`args`, whose constraint for an object argument is an object of the fields it supports, each with
its own constraint, or `any` where the field is unconstrained (`search: { series: any, season:
1–99, episode: 1–999, kind: [episode, movie] }`). A field the constraint does not name is not
supported, and a request that carries it is `refuse(invalid_args)`.

`media.announce` speaks a text on a device that can: a smart speaker we do not own, a television.
`speech` is the text a device is speaking now, or null; a device reports it only where its protocol
gives it, and a voice front uses it to tell the device's speech from a person's
(`standard/voice.md`).

**Extensions.** An applier MAY add capabilities under a namespace containing a dot
(`vendor.kiosk`), described by the same schema as a standard one, at any level, named as a bridge's
are (`standard/bridge.md`, *Extension names*). A client MUST NOT
invoke an extension it does not know; an extension that `describe` lists in a device's `extensions`,
with its schema, counts as known. *Client obligation; not checked by the harness.* Any bridge's
extensions reach the applier this way, from its `devices`: a plugin's (*Plugins*), and a bridge's
own for what its devices offer beyond this vocabulary (a sensor's sensitivity, a button pusher's
mode; ⚠️ were the tentative *Settings* adopted, such values would become settings, not actions;
until then they are extension actions, as here). An extension action's name is its capability's name, a dot, and a name of its own, so the
capability is everything before the last dot (`standard/bridge.md`, *Extension names*). Their
descriptions are the bridge's or the publisher's words, third-party content: a steward hands them to
a brain as data, never as instructions (GA-BRAIN-3). A key of `kind` `state` is a state key of the
device like any other; a key of `kind` `event` is never one (*Occurrences*). The closed vocabulary
is what the gate and *Default tiers* understand; an extension is understood no further than its
schema, and its actions take the extension tier.

**Declarations that change.** A device's settings can change what its actions are (a button pusher
whose mode turns `onoff.turn_on` from a position into a press), and its bridge then re-publishes
`devices` (`standard/bridge.md`, *Declarations and settings*). A `devices` document that changes a
known device's `capabilities`, `extensions`, or any action's `idempotent`, `stateless`, `toggles`,
`args`, `confirms` or `confirmed_by`, or any other declaration `standard/bridge.md` lists in
*Declarations and settings*, MUST be taken as a model change (GA-DESC-18):
- `revision` moves and a `model` event names the device, so that a plan made before it is refused
  at apply (GA-APPLY-2);
- a step of an apply under way, not yet dispatched, whose action's declarations changed is
  `refused(declaration_changed)` at dispatch, as GA-APPLY-9 re-evaluates;
- an action already dispatched keeps the outcome rules it was dispatched with, `already`, its ack
  bound and `confirmed_by` included, and is re-sent (GA-APPLY-6, GA-SAFE-12) only where both its old
  and its new declaration say idempotent;
- an owner's `idempotent: true`, and a tier the owner set below what *Default tiers* gives without
  it, on an action whose declarations changed fall back to what the bridge and the table give, until
  the owner sets them again, as a replacement's do (GA-DESC-11, GA-DESC-15).

A tier is otherwise the applier's and the owner's, and does not move with the bridge's
declarations, except as *Default tiers* derives it. Where a change makes a capped socket's
`onoff.turn_off` a toggle, GA-SAFE-13's notices follow.

### Action declarations

Every action a device offers is declared on the device:

| Field | Type | Notes |
|---|---|---|
| `action` | `capability.action` | |
| `tier` | `reversible` · `confirm` · `no_voice` | Not lower than *Default tiers* gives (GA-DESC-3) |
| `idempotent` | bool | Defaults to the capability's column; MAY be `false` where the device implements the action as a toggle or pulse. `notify`, `media.announce`, `power.shutdown` and `media.launch` MUST be `false`, and so MUST an extension action unless the owner declares it `true` at adoption: its bridge's or manifest's value is a proposal the owner's app shows then (GA-DESC-4) |
| `stateless` | bool | The capability's column; `true` for an action with no state key to confirm it |
| `toggles` | bool, default `false` | From its bridge's `toggles`: `true` where the device carries the action out by a code that reaches a state only from a known one, one that flips it (an IR power code), cycles it (a mode button) or steps it (vol+) rather than sets it (`standard/bridge.md`, GA-BRIDGE-71). Such an action is declared `idempotent: false` (GA-PLAN-8) |
| `whole_state` | bool, default `false` | From its bridge's `wholeState`: `true` where the device carries the action out by a code that carries its whole state (an IR air conditioner's frame), so the command brings the assumed state it is built from (GA-APPLY-16) |
| `args` | constraints or absent | Narrows the arguments for this device: allowed enum values (`mode: [off, cool]`), a numeric range (`celsius: 16–30`), an object's fields (*Arguments that are objects*); on `notify`, whether the device takes `from` |
| `tolerance` | number or absent | For a numeric state key, how far the reported value may differ from the requested one and still match. Defaults: `level` and `volume` 1, `setpoint` 0.5, `position` 2 |
| `ack_within_s` | number | How long a `dispatched` action may wait for `acked` or `delivered` before it is `failed(no_ack)` (GA-APPLY-8). Defaults: 240 for `power.wake`, which covers a cold boot and a plugin server's 120 s start bound (`standard/bridge.md`, GA-BRIDGE-58); 90 for `cover` and for class `gate` or `garage_door`; 60 for `valve` and for class `water_valve` or `gas_valve`; 30 for `media.launch`, since a player may still be loading after a wake; 10 for `session.lock`, which covers the bridge's 5 s wait for a screen locker (`standard/bridge.md`, GA-BRIDGE-66); 10 otherwise |
| `confirms` | bool | For a device behind a bridge, the bridge's word: whether the protocol path confirms a command. Absent otherwise |
| `confirmed_by` | `{ key, value }` or absent | Only on a stateful extension action: the state key and value that confirm it, from its bridge's `confirmedBy`; `value` may be `{ arg: <name> }`, the value of that argument of the step. It is what the action sets, for GA-EVT-1 and GA-EVT-3 |
| `tool_hash` | string or absent | Only on a plugin device's action: the SHA-256 of the MCP tool that implements it, from its bridge's `toolHash`, kept so that a later version's changed tool can be told (GA-DESC-11) |
| `requested_tier` | tier or absent | Only on a plugin device's action: the tier its manifest requests, from its bridge's `requestedTier`. It enters one of two formulas, *Default tiers*' **extension tier** for an extension action and **plugin standard tier** for a standard one; only the first may be lowered |
| `witness` | Witness or absent | Safe level only |

### Default tiers

A device's tiers MUST NOT be lower than this table gives, and `configure` may only raise them,
except an extension action's, as below (GA-DESC-3). The first row that matches wins. A computer's
`infrastructure` has three states, and every rule below that reads it reads them so: the owner set
it `true`, and it is `true`; the owner set it `false`, and it is `false`, whatever its bridge
proposes; or the owner has not set it, and then its bridge's `proposed_infrastructure` decides, a
proposal making it `true` and no proposal `false`. So a computer whose bridge proposes the flag
matches the `infrastructure: true` rows until the owner sets it either way. A standard action on a device whose `host` is a
computer also takes its host's rows: its tier is the higher of the first row that matches the
device and the first `infrastructure: true` or `computer` row that matches its host and the action,
so that a plugin's `power.sleep`, `power.shutdown` or `onoff.turn_off` on a device an
`infrastructure` computer hosts is `no_voice`, as the computer's own are.

| Class, flag or load | Action | Default tier |
|---|---|---|
| any | `lock.unlock` | `no_voice` |
| `water_valve`, `gas_valve` | `valve.open` | `no_voice` |
| `water_valve`, `gas_valve` | the `onoff` action that opens it (`opens_with`) | `no_voice` |
| `gate`, `garage_door` | `cover.close` | `confirm` |
| `gate`, `garage_door` | every other action | `no_voice` |
| `boiler` | `climate.set_mode`, `climate.set_setpoint` | `confirm` |
| `load: heating` | `onoff.turn_on` | `confirm` |
| `infrastructure: true` | `onoff.turn_off` | `no_voice` |
| `infrastructure: true` | `power.sleep`, `power.shutdown` | `no_voice` |
| `computer` | `power.shutdown` | `confirm` |
| any | an extension action (*Extensions*), a plugin's or a bridge's own | `confirm` (ruling 5), or its floor where that is higher: the higher of its `requested_tier` and the highest tier its device's class, flag or load rows give any action, and `no_voice` on a device an `infrastructure` computer hosts (*Plugins' actions*) |
| any other | any other | `reversible` |

A gate or garage door on a momentary relay is an `onoff` device of class `gate`, so its pulse is
`no_voice`, not `reversible`. A valve that its protocol presents as a switch is, likewise, an
`onoff` device of class `water_valve` or `gas_valve` once the owner adopts it as one; the
adoption's declarations say which of `onoff.turn_on` and `onoff.turn_off` opens it (`opens_with`,
`turn_on` unless declared), and the action that opens it is `no_voice`. Switching off an `infrastructure` device is `no_voice` because it can
take down the applier, and with it every safety rule and load cap; putting it to sleep or shutting
it down is `no_voice` for the same reason, so the `infrastructure` rows come before the `computer`
row they must win over. A shutdown loses unsaved work, which nothing undoes, so it is `confirm`;
`power.wake`, `power.sleep`, `power.cancel` and `session.lock` stay `reversible`.

**Plugins' actions.** A plugin device's actions take one of two formulas, never both:
- The **extension tier**, for an extension action, a plugin's or, on any device, a bridge's own.
  The extension row comes after
  every class, flag and load row, and before `any other`. Let the **floor** of such an action be
  the higher of its `requested_tier` and the tier the class, flag and load rows give its device.
  That tier is the highest tier any row naming the device's class, one of its flags or its load
  gives any action, whether or not the device offers that action, and `reversible` where no such
  row names the device: a device of no class, as most plugin devices are, has its `requested_tier`
  alone as its floor, and an extension action with no `requested_tier` (a bridge's own) has the
  device's rows alone. On a device of class `door_lock`, `water_valve`, `gas_valve`, `gate` or
  `garage_door`, whose rows name only standard actions, the floor is `no_voice`, the highest tier
  those rows give, so that a plugin's own `…unlock` or `…open` on such a device is never easier to
  reach than `lock.unlock` or `valve.open`. On a device whose `host` is a computer with
  `infrastructure: true`, or proposed so and not yet set by the owner, the floor is `no_voice`, so that a plugin's own `…system.shutdown` on
  the box's player is never easier to reach than the box's own `power.shutdown`; a `configure`
  change of a computer's `infrastructure` re-applies this to the devices it hosts, in the same
  change set (GA-DESC-13). Its tier is the owner's `configure` value if one is set, otherwise the
  higher of `confirm` and the floor. `configure` MUST refuse, with `invalid_request` and nothing
  changed, a tier below the floor, never clamping it: so it may lower an extension action, down to
  its floor and no lower, and may lower no other action, except by deleting a tier a replacement kept (GA-DESC-11) (GA-DESC-14).
- The **plugin standard tier**, for a standard action (`media.pause`, `power.sleep`) on a plugin
  device: the higher of this table's tier, its host's rows included, and its `requested_tier`,
  raised by `configure` and never lowered, as for any device.

When a replacement (*Adoption*) changes an action's tool hash, its argument schema or its
`requested_tier`, a tier the owner set for it below what its formula gives without the owner's
value is not carried over: it falls back to the formula until the owner sets it again. A tier the
owner raised is kept, since a publisher's edit must not undo a stricter choice. A replacement whose
manifest lowers an action's `requested_tier` does not lower the action's tier by itself: the tier
the action had is kept, as a tier the owner set, until the owner accepts the lower one by deleting
that value through `configure`, the one lowering of a standard action `configure` makes (GA-DESC-11). An
action's tool hash is its declaration's `tool_hash`, which the applier keeps across its restarts
(GA-PERSIST-1), so a version that arrives months later is compared with the one it replaces. The
hash detects a changed declaration, not changed behaviour: a server that keeps its tools' names,
descriptions and schemas may still change what they do, which no hash sees (`standard/bridge.md`,
*Hosting*: pinning is not a sandbox).
The extension row, and lowering an extension action to its floor, are ruling 5 of
`docs/specs/2026-09-25-pc-design.md`, confirmed on 2026-09-25.

### Loads

A socket's `load` says what is plugged into it, and is set through `configure`. A Safe applier
MUST declare a `load` on every `socket`, and treats a socket whose load was never configured as
`heating`, so that no heater hides behind an undeclared one (GA-DESC-8). Changing a load, or the
`infrastructure` flag, changes what the device is, and its default tier follows; `configure` records
it like any other change. A `configure` change of `load` or `infrastructure` MUST re-apply *Default
tiers* to the device's actions, and a computer's `infrastructure` to the actions of the devices it
hosts, extension and standard (*Default tiers*), in the same change set, raising every tier now below its new
floor to that floor, as GA-DESC-11 re-derives a plugin action's tier; a tier at or above it is kept
(GA-DESC-13). A socket turned from `lighting` to `heating` does not keep a `reversible`
`onoff.turn_on`. A `heating` load carries `max_on_s` (default 14400). A socket whose
`onoff.turn_off` is declared `toggles: true` cannot carry one, since its cap would have to press a
toggle (GA-SAFE-13); a `feedback: open` socket whose `onoff.turn_off` is discrete can.

A Safe applier MUST turn a `heating` load off by itself once it has been on continuously for
`max_on_s`, whatever any client asked and with no client connected, with cause `load_cap`. The
on-time counts from the first report of `on`, whatever caused it, on the wall clock, downtime
included, and never less than the monotonic time elapsed while running; it resets only when the
socket reports `off`; its start survives a restart. A `feedback: open` socket reports nothing, so
there it counts from the first `onoff.turn_on` the applier sends that ends `sent` or `unanswered`,
either of which may have turned it on, and resets only when an `onoff.turn_off` ends `sent`; an
`on` made at the socket itself is not seen. A cap turn-off that does not end with the socket reporting `off`, or on an open
socket ending `sent`, is retried, at least every `ack_within_s` while the socket is not `dead`, until
it does; one declared `idempotent: false` is sent once, and is a notice if it does not land. A
safety rule does not hold a heating load on against its cap. A `load_cap` turn-off that
ends `failed` or `unreachable` is sent as a notice, as GA-SAFE-8 (GA-LOAD-2). Asking for "on until
07:00" is the steward's timer; the cap is the device's limit, and holds when the steward is down.

### State and liveness

A state value is `{ key, value, basis_time }`. `basis_time` is the time of the observation it rests
on, never the time of the response or of publication (GA-STATE-1). Times are RFC 3339, with offset.

A device with `feedback: open` has no observation: its state values carry `assumed: true` wherever
the applier gives them, and rest on the last command sent. No client takes one as observed: a
steward's condition never holds on one (`standard/steward.md`, GA-RULE-2), and a brain says it as
what was last sent (`standard/brain.md`, GA-BRAIN-7); nor does the applier itself: an assumed value
is never a report, so it fires no safety rule's trigger and holds no safety rule's condition or
latch (GA-SAFE-11, GA-SAFE-7). Any action on it, stateful or stateless, ends `sent` once transmitted (for
a device behind a bridge, on the bridge's `applied` or `sent` ack), `failed(reason)` if transmission
failed, or `unanswered` if nothing said within its `ack_within_s` whether it was transmitted; never
`acked` and never `failed(no_ack)`. A plan never finds it `already` (GA-STATE-4). A computer's
`power.wake` sent through a relay's entry is the one exception: the step is the computer's, and ends
as *Waking* says (GA-APPLY-13). A stateful
action's assumed value changes when it ends `sent` or `unanswered`, and never when it ends
`unreachable` or `failed`, a write that failed on an `unknown` transport included
(`standard/bridge.md`, GA-BRIDGE-72) (GA-STATE-4). An `unanswered` action may well have gone out,
as a load's cap already counts it (*Loads*), and a whole-state code sent next then carries what was
last asked for rather than undoing it. What it actually did is a witness's to say.

An action declared `whole_state: true` is carried out by a code that carries the device's whole
state, which the bridge builds from the command alone, since it keeps no state (`standard/bridge.md`,
GA-BRIDGE-5, GA-BRIDGE-73). The applier MUST put in such a command's `state` the device's assumed
value of every key it holds one for, kept across a restart (GA-PERSIST-1), so that «22 °C» after a
restart still carries the mode last sent (GA-APPLY-16). For each key, that value is the one the
latest earlier action on the device sets, from whichever apply it came, once that action is
dispatched and unless it has ended `failed` or `unreachable`, and otherwise the key's assumed value;
the action's own key carries the value it asks for.
So «cool, 22 °C», as two steps of one apply, two steps of a run or two requests a second apart, sends
`mode: cool` in the setpoint's frame without waiting for the first to end, and nothing is held back;
an earlier action that ends `failed` or `unreachable` is not taken into commands built after it
ends. A frame carries the whole state, so when a `whole_state` command ends `sent` or `unanswered`,
every key it carried becomes the assumed value, not only its own action's: if `set_mode cool` fails
after the setpoint's frame went out carrying `mode: cool`, the device was told `cool`, and the next
frame says so (GA-APPLY-16, GA-STATE-4).

Every device has a **liveness**, the applier's verdict on the facts its bridges and engines report.
It is the one verdict every client reads, a steward and through it any endpoint or reader that must
know whether a value is current; no client rebuilds it from a bridge's roster:
- `live`: checked in within its freshness bound. For a device behind a bridge, that is its
  `last_check_in` (its latest check-in, as the bridge's roster reports it), not its values'
  `basis_time`, with one allowance: the roster reaches the applier with the bridge's `status`, at
  least every 10 s, so a bridged device is `stale` once its `last_check_in` is older than its bound
  plus 11 s, its `fresh_slack_s` (the bridge's 10 s status interval, and 1 s for delivery); a leak sensor that
  reports only on change is `live` while it keeps checking in, so a sensor with a dead battery goes
  `stale`. A `feedback: open` device has no check-ins and no `fresh_s`: it is `live` while its
  transport is `up` or `unknown` and its bridge alive. A transmitter that can answer nothing on its
  host link is `unknown` (`standard/bridge.md`, *Transports*, GA-BRIDGE-72): its devices are usable,
  their state assumed and their actions `sent` once written, as any open device's; its bridge dead
  or its transport `down` still makes them `dead` (GA-STATE-4);
- `stale`: past its freshness bound, or with no known bound, while whatever owns it (bridge, child
  or engine) is alive. The applier MUST report a device `stale` no later than 1 s after its `fresh_s` plus its
  `fresh_slack_s`, MAY from its `fresh_s`, and
  MUST report a `feedback: closed` device whose `fresh_s` is not known as `stale` (GA-STATE-5);
- `dead`: its owning bridge, transport, child or engine is dead, or its bridge reports it gone.

Every device's freshness bound is its effective `fresh_s`, whatever owns it: for a device behind a
bridge, the bridge's declared `basisMaxAgeMs` (GA-BRIDGE-13), not known while the bridge gives
none; for a Matter device, that is its granted reporting interval plus the controller's slack. For an adapter's
device, it is what the engine knows; for any other, the device's own. `configure` may set `fresh_s`
for any device, and the owner's bound MUST then be the effective one, whatever the bridge or engine
declares (GA-STATE-6): the owner may know the device better, as for an adapter's `occupancy` sensor,
or a sensor whose bridge cannot know its rhythm (`standard/bridge.md`, *Freshness and devices*).
An owner's bound longer than the device's real rhythm keeps a dead device `live` for that long, and
every rule that reads it goes on reading its last value (GA-RULE-2); that is the owner's call, and
the applier says so in the `freshness` event. An adapter MUST give a bound
for every `occupancy` sensor it exposes, from its engine or from `configure`, or that sensor reads
`stale` (GA-STATE-5). The applier judges liveness from the device's `last_check_in` and a value's age from its
`basis_time`, never from when a message arrived (GA-BUS-10).

A device behind a bridge MUST read `dead` within 1 s of any of these: its bridge found dead (30 s
without a `status`, its will, or a graceful `offline`; *Bridges*); its transport reported `down`;
the applier losing its own connection to the broker (GA-BUS-7); the bridge reporting the device
`available: false`, the protocol itself having declared it gone; or the device leaving the bridge's
`devices` or the roster, or its retained status being cleared (after `left` or a `remove`)
(GA-STATE-2). An
empty retained payload is never a value. It is live again once
none of these holds and its `last_check_in` is within its bound, however old its values are. An adapter reports a device `stale` while its
engine marks that device unavailable, except one the engine has not yet loaded after its own
restart, which is `dead` until it has, and a `computer`, which is `dead` (*Computers behind an
adapter*) (GA-STATE-3). A `stale` device is planned normally, its step marked
`stale: true`, and `already` is not evaluated on a stale value.

### Causes

Every state change the applier reports carries a `cause`, one of:
- `{ apply: apply id, client, for }`, where `for` is what the client says the apply was for:
  `{ person?, endpoint?, apply?, rule?, run?, schedule?, front? }`, the steward's own cause. The applier
  records it and reads two things from it: whether `person` is present (GA-SAFE-7), and whether it
  names a `rule`, or a `run` with neither `person` nor `endpoint` (GA-PLAN-8). A report on the
  target of a `dispatched` action is caused by that apply, and not `external`, while it moves towards
  what the action set or is a side effect of it (`set_level` turning `on`, a cover's intermediate
  `position`), until the first report that matches, `ack_within_s` passes, or the bridge's ack
  says it did not act (`failed`, other than `failed(no_confirmation)` and `failed(not_locked)`, or
  `unsupported`), whichever comes first. `failed(not_locked)` is a "may have acted" ack, as
  `failed(no_confirmation)` is: a slow screen locker may still lock the session after it
  (`standard/bridge.md`, GA-BRIDGE-66), so a `locked` inside the step's `ack_within_s` is the
  apply's, not `external`, and takes no lease. A report that moves away from it is `external`, and a report caused by a safety rule or a
  load cap keeps that cause. With two applies on one target, the later one's;
- `{ safety_rule: rule id }`;
- `load_cap`;
- `device`: a change of a key the device declares `self_changing`;
- `external`: any other change the applier did not make.

Every state change the applier did not make, other than a `self_changing` key, MUST be reported with
cause `external` (GA-EVT-1); a change of a `self_changing` key MUST be reported with cause `device`,
except a report that the first item above gives to a dispatched action on a key that action sets,
which keeps that apply's cause: an apply's correlation wins over `device` for the key its own
action sets, so a `session.lock` or a `media.launch` is still the apply's (GA-EVT-6). A person
turning a `self_changing` key by hand is indistinguishable from the device and is reported as
`device` too, and so takes no lease (the steward's GA-LEASE-2); an owner should therefore declare
only keys a person does not usually set. The keys this standard itself declares `self_changing`
depart from that on purpose (*Computers and players*): a person's ordinary use of a PC, or an
episode ending, must never lease the device against a rule.

### Computers and players

A computer's capabilities are `power`, `session`, `notify` and `sensor`, with any of the sensor keys
`battery`, `app` (the foreground application of the active session), `camera_in_use` and
`microphone_in_use` its bridge can read. A player's are `media`, `media.launch` among them, and any
extension its plugin declares.

**Power.** An asleep or off computer is `dead`: its bridge went offline gracefully. "On" is its
liveness, so `power` has no state key.
- `sleep`, `shutdown` and `cancel` end `delivered` on the bridge's `applied` ack, the OS having
  accepted them, as any stateless action does (GA-APPLY-7). The device then goes `dead`, which is
  not a state change, and so not `external`.
- `delay_s` schedules the action with the OS's own warning to every session; without it the action
  is immediate. `shutdown` is not idempotent (GA-DESC-4), so an ack timeout never reissues it
  (GA-APPLY-6): a second scheduled shutdown errors on Windows and restarts the countdown on Linux.
  `cancel` withdraws a scheduled one, and with nothing scheduled is acked all the same.
- Whoever sits at the PC can shut it down, put it to sleep or cancel a scheduled shutdown through
  the OS, and the OS sleeps when idle or restarts for updates. These are the device's own behaviour, seen as the computer going `dead`,
  not an `ungoverned` path (GA-BRIDGE-32), and so they cost the applier no Safe claim (GA-DESC-6).
- A PC's bridge goes offline gracefully on a suspend or shutdown the OS announces, after its ack of
  `sleep` or `shutdown` (GA-BRIDGE-22). Its will after a suspend the OS did not announce is
  expected, and is taken as any will: the computer and its hosted devices read `dead`
  (GA-STATE-2), and a device a safety rule reads gets GA-SAFE-10's notice at once, since only a
  graceful `offline` has its grace. A will raises no `bridge_fault` in any case.
- `wake` is routed differently from every other action (*Waking*).

**Sessions.** A computer has one `session.<account>` key per interactive account (*Key families*).
An account with several sessions (the console, SSH, Remote Desktop) still has one key, which its
bridge combines, the most in-use session winning, and `session.lock` locks every one of them
(`standard/bridge.md`, *Computers*). `unknown` is a logged-in session whose state the bridge cannot
derive, and is never read as free.
`session.lock { account }` matches when `session.<account>` reads `locked`, `disconnected` or
`none`, so any of them acks it, since a logout ends the session the lock was for (GA-EVT-3); it is
`already` when the key reads any of them. `session.lock`'s `args` MUST declare `account` as the
tokens the computer's `accounts` lists, from its bridge's declaration, so that a step naming any
other token, a retired one included, is `refuse(invalid_args)` in a plan and never dispatched,
rather than a lock no key can ever ack (GA-DESC-17). Which person an
account belongs to is the steward's (`standard/steward.md`).

**Declarations the standard makes.** Every state key of a computer is `self_changing`: its session
keys and its sensor keys. So are a player's `playing`, `title` and `started_at`: an episode ending
is not a person taking the player, and a person pausing it with the remote takes no lease either.
`speech` is `self_changing` on every device that reports it: what a television says is the device's
own behaviour, and must never lease it against a rule.
`app`, `camera_in_use`, `microphone_in_use` and `speech` are `personal` on every device that reports them, a
plugin device included, whatever its manifest declares; on a computer, so is every
`session.<account>` key. The applier MUST list in a device's `self_changing` and `personal` every key this
standard declares so and every key its bridge declares so (a plugin's manifest's), and in
`internal` every device its bridge declares `internal`; `configure` may add keys to either list,
and mark a device `internal`, but never removes a declaration the standard or the bridge makes,
except one: the owner may remove a key a plugin's manifest declares `self_changing`, since whether
a person's change of it is the device's own behaviour, taking no lease, is the owner's call, not
the publisher's (GA-DESC-9). On a plugin device's replacement, `personal` keeps every key an earlier version's
manifest declared so, a new version adding keys and never dropping one, and no `configure` removes
one; `self_changing` keeps every key an earlier version declared so, except a key the owner
removed, which stays removed, whatever a later manifest declares, until the owner adds it again
(GA-DESC-16).

**Personal keys.** A `personal` key says what a person is doing. The applier knows no persons, so it
only marks them; the steward withholds their values from readers with no right to them
(`standard/steward.md`). Said plainly, the applier keeps them in `history` like any other key, for
the 7 days GA-EVT-5 requires; at Box, reading them from the broker needs the device's grant
(GA-BOX-1); below Box, any reader of the broker sees them.

**Launching content.** `media.launch` is never `already`, and is not idempotent (GA-DESC-4): a
reissue after an ack timeout would play another episode (GA-APPLY-6). The keys it sets, for
GA-EVT-1 and GA-EVT-6, are `playing`, `title` and `started_at`. It is `acked` by a report received
after dispatch in which `playing` is `true` and `started_at` differs from the value the applier held
at dispatch, or is present where none was held: it compares values, never the PC's clock with the
applier's, a named exception to GA-EVT-3's value match (GA-EVT-7). If the item ends and the next
starts inside the ack window, the ack names the next one. The read-back reports all three keys
(GA-BRIDGE-34).

**Computers behind an adapter.** A computer an engine exposes fits the same model:
- One its engine marks unavailable is `dead`, not `stale`, since an unavailable computer is asleep
  or off: a named exception to GA-STATE-3 for class `computer`.
- Where the adapter can read the engine's availability, the computer is `live` while the engine
  marks it available, with no time bound: a named exception to GA-STATE-5, as a `feedback: open`
  device is live while its transport is `up` or `unknown`. Where it cannot, `configure` MUST refuse to adopt the
  computer until the owner has set its `fresh_s` (GA-STATE-5).
- Its `wake_via` may name any device of the same applier that offers `power.wake`, one of the same
  adapter's included where its allowlist maps an entity to `power.wake` (GA-DESC-12).
- An adapter that cannot report sessions offers no `session` capability.
- An adapter MUST map an engine's entity to `power` or `session` only through an allowlist keyed by
  the agent's model and its entities' `unique_id` pattern, never a generic button, and MUST list
  everything else the engine can do to the computer in `ungoverned`. Keying it per integration does
  not work, since an MQTT-discovery agent's entities belong to the engine's `mqtt` integration. An
  adapter MUST NOT map to any capability an entity that runs arbitrary commands, such as LNXlink's
  `bash` or a HASS.Agent custom command (GA-DESC-12). Whether the allowlist holds is *not checked
  by the harness*: the adapter cannot see what a button runs, and anyone on the engine's broker can
  announce an entity that matches the pattern.

### Waking

A computer may have a **wake path**: `wake_via`, naming another device that offers `power.wake`,
usually a wake relay's entry (`standard/bridge.md`, *The wake relay*). It is the owner's: `configure`
sets it on the applier that owns the computer, pairing the computer with the entry, since the PC's
bridge cannot know the relay. The device it names is that same applier's own: a meta-applier does
not relay a wake across its children, so a computer and its relay entry sit under one applier.
`configure` MUST refuse a `wake_via` naming a device that is not adopted, does not offer
`power.wake`, or belongs to another applier than the computer (a child's, or the parent's), and a computer MUST declare `power.wake` exactly while it
has a `wake_via`: its bridge offers none, so the applier adds it, as the capability's row declares
it (stateless), with its tier from *Default tiers* and its default `ack_within_s`, when a
`wake_via` is set, and removes it when none is (GA-DESC-10). An adapter's
device named by a `wake_via` stays as its adapter declares it.

A relay's entry has no class, is `feedback: open`, and is `internal`. An `internal` device is never
shown to people, and is never in a room, a group or a selector; that is the steward's to enforce
(`standard/steward.md`). `describe` lists it all the same, for the owner's app, and the applier
routes to it by id.

**Plan and apply.** `power.wake` on a computer is always dispatched to its `wake_via` device. The
applier MUST plan and dispatch it while the computer is `dead`, and not make it `skip(dead)` or
`unreachable` for that: its `dead` is the `wake_via` device's, so the step is `skip(dead)` in a plan,
and `unreachable` at dispatch, only when that device is `dead`. A named exception in GA-PLAN-4,
GA-APPLY-5 and GA-APPLY-9, for this action only. `power.wake` on a `live` computer is `already`: a
named exception to the rule that a stateless action is never `already` (GA-APPLY-12); on a `stale`
computer it is planned and dispatched, since only a `live` one is `already`, and is `acked` on the
computer's next check-in, a `last_check_in` other than the one it held at dispatch, once that makes
it `live`, with each adopted hosted device that was live at dispatch live on a check-in since, or
reported `available: false` in a status received since, within the same `ack_within_s`: the
*Outcome* below with dispatch in place of the computer's death (GA-APPLY-13). Any other
action on a `dead` computer is `skip(dead)` or `unreachable`, as on any device. For this step, "its
bridge" in GA-APPLY-8 means the owner of the `wake_via` device, until that device's terminal ack.
After it, GA-APPLY-8's clause for a dead bridge does not apply: the computer's own bridge is dead by
definition until the wake takes, so the step waits out its `ack_within_s` (GA-APPLY-13).

**Outcome.** An ack from the `wake_via` device, final for that device but not for the wake (the
relay's `sent`, or the `delivered` of an adapter's switch that GA-DESC-12's allowlist maps to
`power.wake`), only moves the step along. A
`failed(reason)` or `unsupported` from it ends the step as GA-APPLY-5 and GA-APPLY-7 would for that
device: `failed(unreachable)` or `failed(expired)` is reported `unreachable`, any other reason as
itself. The relay's entry is `feedback: open`, so on its own the wake would end `sent` (GA-STATE-4).
The step is `acked` when the computer becomes `live` **and** each of its adopted hosted devices
that was live when the computer died is live again on a check-in since the computer's return, or
reported `available: false` in a status received since, within the action's `ack_within_s` (240 s by
default, ⚠️ a guess: a cold boot and GA-BRIDGE-58's 120 s start bound); otherwise `failed(no_ack)` (GA-APPLY-13). A check-in since the return is a
`last_check_in` other than the one the device held when the computer died: a value compared, as
GA-EVT-7 compares `started_at`, never two clocks. The old one survives the bridge's restart
(GA-BRIDGE-31) and may still be within a plugin device's bound, so the device can read `live`
(GA-STATE-2) on a check-in from before the death; that does not count, and the step waits for a
new one. The bridge reads each
plugin device within 10 s of its server's start or of its own resume (GA-BRIDGE-60), so the wake
does not wait out a long `cadenceMs`; a command to a device whose server is still starting is
acked `failed(unreachable)` (GA-BRIDGE-60). That `available: false` is a definite answer because a
bridge reports a plugin device so only when its server cannot serve it: its account has no
session, its files failed their check, or its server exited, hung, or did not serve within its
start bound; never while its server is still starting (GA-BRIDGE-58). A server that crashes just
after the resume ends the wait early the same way, with its `available: false`, though the bridge
is about to start it again: accepted, since the device cannot serve at that moment, and a wake
answers whether the computer came back with what it can serve, not whether a restart will take;
the next command to the device finds that out. The applier MUST keep which hosted devices were live at
the computer's death, and the `last_check_in` each held then, across its own restart
(GA-PERSIST-1). A computer's own
status reappearing is the device's own report, so this is the one stateless action that ends
`acked`: a named exception to GA-APPLY-7, GA-EVT-3 and GA-STATE-4.

Beyond the design's rule: silence from the `wake_via` device does not end the wake either. With no
ack from it within its own bound (an `unanswered`), the packet may still have gone, and the step
waits for the computer (GA-APPLY-13).

### Plugins

A **plugin** is a package a PC's bridge hosts at its level Host: a manifest, an MCP server that does
the work, and optionally a skill for brains (`standard/bridge.md`, *Plugins*). The applier sees an
ordinary bridge.

**Plugin devices.** Each device a plugin's manifest declares is a device of the PC's bridge,
hosted by the computer:
- `host` names the computer. A hosted device shares the computer's bridge, so it goes `dead` with
  it (GA-STATE-2).
- Its `stable_identifier` is `<computer stable_identifier>/<plugin id>/<device key>`, the same
  across versions and unique per host, so that two PCs hosting the same plugin never show one
  identifier (GA-BUS-11, GA-META-2); its bridge's
  device id is `<plugin id>:<version>:<key>`, so two versions never collide (GA-BRIDGE-69). Its
  bridge names its plugin and version in fields of their own (`plugin`, `version`), and the applier
  takes them from there, never by parsing an id. Its `protocol` is `other`, and its class may be
  null.
- Its declarations are its manifest's: `idempotent` (for an extension action, a proposal, below), `stateless`, `confirms`, `confirmed_by`,
  `requested_tier`, `personal` and `self_changing`, and its `extensions` with their schemas. The
  applier takes each action's `requested_tier` as the requested tier of *Default tiers*. On a
  replacement by another version, these are the new version's: GA-ADOPT-2 carries over only what
  the owner set (tiers, subject to GA-DESC-11, `ack_within_s`, witnesses, keys added through
  `configure`, keys removed from `self_changing`), never the old manifest's declarations, except
  `personal` and `self_changing`: a key an earlier version declared so stays so, since a
  publisher's narrower manifest must not un-mark a private key, unless the owner removed it from
  `self_changing` (GA-DESC-16).
- An extension action's `idempotent` is the owner's: `false` unless the owner declares it `true`
  in the adoption's declarations, the manifest's value being a proposal the owner's app shows
  there, since a reissue on its word could run a publisher's action twice (GA-APPLY-6); an owner's
  `true` falls back to `false` when a replacement changes the action's tool hash, as a lowered tier
  does (GA-DESC-4, GA-DESC-15, GA-DESC-11).
- A tool result with `isError` reaches the applier as `failed(no_confirmation)`, with the tool's
  text in the ack's `detail`, which it takes as no ack: the tool ran and may have acted, so the step
  waits for a report or its bound (*Outcomes*), and the step's outcome carries that `detail`, so a
  search that matched nothing still says why when it ends `failed(no_ack)` (GA-APPLY-15).
  An `applied` from a plugin is the plugin's word; the step is `acked` only when the confirming key
  reports, as for any device.
- A plugin device arrives unadopted, as any new device (GA-ADOPT-1). **Adoption is the owner's
  approval:** the owner's app shows each of its actions with the tier it will have, and the keys
  its manifest declares `self_changing` (which take no lease, and which the owner may remove) and
  `personal`, and each extension action's proposed `idempotent`, as `describe` lists them for the
  unadopted device, since all are the publisher's word. Its server
  starts only once the applier sends `activate` (*Adoption*), and no tool is called for a device
  that is not adopted, since the applier sends no command for one.

**Staged versions.** A new version of a plugin arrives staged: its devices carry the same
`stable_identifier`s as the installed version's, and `staged_for` names the device each would
replace. A staged device whose `staged_for` names a device of the same plugin on the same bridge and
host, with the same `stable_identifier`, is not a routing collision, so it raises no
`route_conflict`, but a notice with cause `plugin_update` (GA-BUS-15). Adopting it with `replaces` is hardware replaced by itself
with the same identifier, so the identifier is not retired, and the steward's names, rooms and
rules are kept (*Adoption*). What changed between the two manifests is for the owner's app to show.
The first such adoption activates the whole version (GA-ADOPT-4): once the new version's server
has served, every device of the old version leaves its bridge (until then the old devices stay, and the new
ones have no check-in yet, or read `available: false` once their server fails its check or its start
bound, GA-BRIDGE-58), and those the owner has not yet replaced stay in the model `dead`, with their ids,
as after `left`; none of them is named by a safety rule, since such an adoption is refused
(GA-ADOPT-4), and the replaced one leaves only once its replacement has taken effect, a failed
swap being cancelled (*A pending replacement*). Each of the new version's devices keeps its `staged_for`, and so
stays exempt from `route_conflict` (GA-BUS-15), until the owner adopts it, with `replaces` naming
the old device to keep its rules, or forgets the old one.

**A pending replacement.** An adoption of a staged device with `replaces` is pending until the
swap, when the old version's devices leave its bridge's `devices`, the new server having served.
Until then the old device keeps the applier `id`, its declarations and the rules that name it, and
the new device stays unadopted, so a step on that id still reaches the old device; at the swap the
adoption takes effect as GA-ADOPT-2 says. If, before the swap, the bridge reports the new device
`available: false` after it published it `available: true` following its `ok` to the `activate`,
or names it in a `faults` entry of code `pin_mismatch`, `crash_loop` or `account_deleted`, its
server having failed its check or its starts or lost its account (`standard/bridge.md`, `faults`,
GA-BRIDGE-45, GA-BRIDGE-58, GA-BRIDGE-67), the applier MUST drop the pending adoption,
issue a notice with cause `plugin_update` naming the old and the new device, leave the old device as
it was, and send the bridge `activate` naming the old device's version, which cancels the new
version's pending activation (`standard/bridge.md`, *Staged versions*), re-sent as GA-ADOPT-4 re-sends
an `activate` until an `ok`, and send no more `activate` of the new version (GA-ADOPT-5). A status
from before the `ok`, re-published by a snapshot, counts for nothing, and neither does a server
that has not yet served within its start bound, until its failed starts raise the `faults` entry
(GA-BRIDGE-58), some minutes later by its backoff. So the old devices stay, the device a safety rule names among
them, and the owner adopts the new device again with `replaces` once its version is repaired. If
the old version's devices leave before that `ok`, the swap came first: the dropped adoption then
takes effect as at any swap, with a notice with cause `plugin_update` saying so, and the bridge's
`failed(unknown_plugin)` to the cancel, its old version gone, raises no `bridge_fault`.

The match rests on the manifest's own `id`, which nothing yet signs (`standard/bridge.md`, *What
this standard does not define*): a package that claims another plugin's `id` stages as its update,
and what stands in its way is the owner's `sha256` at install and the owner's review at adoption.

**Uninstalling.** On an `uninstalled` event, or on the bridge's `accepted` reply to the applier's
own `uninstall` of that plugin, whichever comes first, the applier MUST forget every device of that
plugin on that host, as `forget` does, though on `accepted` they are still in the bridge's
`devices`, a named exception to `forget`'s refusal of such a device: out of the model, the id map and its record of `activate`
replies, so that a later install of the plugin, whose devices come back under the same bridge ids
(GA-BRIDGE-35), is a fresh admission and its devices arrive unadopted. Forgetting on `accepted`
means a lost `uninstalled` followed by a reinstall of the same version cannot bring the old
adoption back over another package. Having forgotten them on `accepted`, the applier MUST keep a
tombstone for that plugin and host, across its own restart (GA-PERSIST-1), until the
`uninstalled`, a `failed(unknown_plugin)` to the `uninstall`, or a `devices` document that counts
below and lists none of the plugin's devices, and meanwhile ignore that plugin's devices in any
`devices` publish or snapshot, raising no GA-BUS-6 notice for them, so that they do not come back
as new devices while the bridge removes them (GA-PROV-4). An `uninstall` whose reply and `uninstalled` were both lost is
taken from the bridge's `devices` instead: when no device of an adopted plugin is left in that
host's bridge's `devices` (a snapshot's included), the applier MUST take it as the plugin's
`uninstalled`, except that a device a safety rule names is kept, `dead`, as after `left`, and MUST
issue a notice with cause `plugin_update` naming the plugin and the devices it forgot or kept, so
that a bridge that lost its state does not drop an adoption unseen. Only a
document that GA-BUS-1 parsed with no entry dropped, and that still lists the host, counts: a
device dropped as a bad entry is not absent, and a parse failure never forgets an adoption. Whichever
way it forgets a plugin's devices, the applier MUST first clear any `wake_via` naming one of them,
the computer losing its `power.wake` (GA-DESC-10), and name that computer in a notice with cause
`plugin_update`, so that no wake path names a forgotten device. It MUST refuse, with
`invalid_request` and nothing sent, an `uninstall` while a safety rule names one of the plugin's
devices, as it refuses such a `forget` (GA-PROV-4).
There are no automatic updates.

## Clients and tokens

An applier serves a fixed set of **clients**, each registered through `configure` with a credential:
stewards, and a meta-applier's parent. A request from anyone else is the error `not_permitted`
(GA-AUTH-3). The applier knows no persons and no roles. The owner's configuration credential
(GA-CFG-1) is not a client: it may call `describe`, `state`, `events`, `history`, `configure`, `provision` and `candidates` only, makes no
plan and applies nothing, and so is not "anyone but the meta-applier" in GA-META-3. The owner's
app holds it, for the child that owns a bridge as for any applier.

A client's request carries, for each action, `via` (`voice`, `panel`, `app`, `rule`, `schedule`),
`brain` (`true` when the request came through a brain), and `for` (see *Causes*). For an action whose
effective tier is `confirm` or `no_voice`, or one declared `toggles: true` on a `feedback: open`
device (GA-PLAN-8), it also carries a **confirmation token**:
`{ token_id, issuer, target, action, args, via, brain, for, expires, proof }`, issued by the client
after a person confirmed that exact action (`standard/steward.md`, *Tiers and confirmation*), or by
a meta-applier re-issuing it for a child (*The meta-applier*).

- A `confirm` or `no_voice` action with no token is `refuse(token)` in a plan and `refused(token)`
  on apply (GA-TOKEN-1).
- A token whose `target`, `action`, `args`, `via`, `brain` or `for` differ from the step's, that has
  expired, whose `expires` is more than 300 s after the applier's now, that was already used, whose
  `issuer` is not the client that sent it, or whose `proof` does not verify against that client's
  key, is treated as no token (GA-TOKEN-2).
- A `no_voice` action with `via: voice` or `brain: true` is `refuse(tier)`, with or without a token
  (GA-TOKEN-3).
- A token is used when its action is dispatched, and not before: planning does not use it, and
  neither does a target found `unreachable` before dispatch, or a command the broker refused to
  deliver (GA-BUS-9). Once dispatched, it stays used whatever outcome follows: `unreachable`,
  `failed` or `unanswered`. A token is dispatched at most once, even by applies running at once:
  checking it and recording it used are one step, so of two steps presenting the same token only
  one is dispatched, and the other counts it as already used. The applier MUST remember each used
  `(issuer, token_id)` until a deadline 3600 s after its use, persisted across a restart
  (GA-TOKEN-4).

The token is checked again at apply, not only at plan. `proof` is a message authentication code over
the other fields with the key registered for that client; its algorithm and serialisation are the
binding's. Expiry is judged on the applier's clock, with the skew allowance in *Constants*.

**What the applier trusts.** A brain is never the applier's client. For an action with no token, the
applier takes `via`, `brain` and `for` from its registered steward as given. The token catches a
steward that skips an ask, loses its place or replays an old answer; it does not catch a
compromised steward, whose key signs whatever it likes.

## Safety rules

A **safety rule** is `{ id, trigger, conditions, actions, latch?, notice? }`, configured through
`configure`, where `trigger` and `conditions` read the applier's own devices. A safety rule, latch or
witness that reads a key its device does not declare is refused with `invalid_request`, naming the
key and whether the device's bridge awaits it (GA-SAFE-14): a rule on a reading that never comes would
never fire. When a device's declarations change (a key renamed, a reading remapped), a safety rule,
latch or witness that then reads a key the device no longer declares MUST be disabled with a
`rule_disabled` notice naming the key, as GA-SAFE-13 disables one that no longer passes.

A Safe applier:
- MUST host a safety rule only if it owns every device the rule reads or actuates, and no child of
  its own owns them all; and MUST refuse, at `configure`, a rule that actuates a device with another
  admin, or with `other_admins: unknown`, unless the rule carries `accepts_other_admins: true`, set
  by the owner knowing that the other controller can undo the rule and its latch (GA-SAFE-6). For
  this check, the administrators of a computer that carries the broker, one whose `infrastructure`
  is true as *Default tiers* reads it (its bridge's proposal included, `standard/bridge.md`,
  GA-BRIDGE-65), are other admins of every device the applier governs: they run the broker and its
  grants, so they reach every bridge's commands. Its `other_admins` entries with `vendor: "os"`, or
  its `unknown`, MUST count as another admin of every device a safety rule actuates, which the owner
  accepts with `accepts_other_admins` as any other; they are admins, not `ungoverned`, so the Safe
  claim stands (GA-DESC-6). The one exception is a computer the owner marks `applier_host`: its
  administrators already administer the applier and the broker it trusts, and are no other admins
  of anything the applier governs for that reason, so its entries count only as its own and its
  hosted devices' other admins, as on any PC; a root that every Linux PC lists does not make every
  safety rule in a home whose box runs a PC bridge need `accepts_other_admins`. An administrator
  added to such a computer, or a computer becoming such a one (its `applier_host` cleared
  included), is the notice *Other admins* gives for an admin added to each device a safety rule
  actuates without `accepts_other_admins` (GA-SAFE-6);
- MUST fire it with no client connected (GA-SAFE-1);
- MUST NOT let any token, tier, request or other rule refuse or undo its action while it runs, from
  firing until it is complete; a request for any device it actuates in that time is
  `refuse(safety)` (GA-SAFE-2);
- MUST issue each actuation once, counted in physical actuations, with no reissue unless the action
  is declared idempotent (GA-SAFE-5);
- MUST fire it once each time its trigger becomes true, not again while it runs or its latch is
  held; a new report, one whose `basis_time` is later than the last the applier saw for that key
  (an `assumed` value is never one, and holds no condition, *State and liveness*),
  fires it (a value GA-BUS-2 treats as from a fast clock never becomes the last seen, and the last
  seen is kept across a restart) whatever the reporting device's liveness, so a leak reported by a
  sensor whose bound is not yet known still closes the valve; `configure` refuses two safety rules that would set one key of one device to different
  values (GA-SAFE-11);
- MUST keep sending an actuation that has not landed while the rule still wants it: while its
  latch is held or, for a rule without one, while its trigger's condition is true on the latest
  reported values, whatever the reporting devices' liveness, as GA-SAFE-11 fires. What is sent
  again depends on each attempt's final outcome, and every final outcome is one of these:
  - **landed** (`acked`, `delivered`, `sent`, or a `late_ack` or matching report): nothing more is
    sent;
  - **nothing ran** (`skipped(dead)`, `unreachable`, or a `failed` whose reason says the device or
    the protocol did not carry it out, GA-BRIDGE-7): any action is sent again as soon as its device
    is not `dead`. This is not a reissue under GA-SAFE-5;
  - **it may have run** (`failed(no_ack)`): an action the device declares idempotent is sent again
    while the device's latest report does not match it; a non-idempotent one is not, and its notice
    says so;
  - **it may not have gone out** (`unanswered`, on a `feedback: open` device): an idempotent action
    is sent once more, then no more, since nothing will ever say whether it ran;
  - **final** (`refused`, `failed(unsupported_action)`, `failed(invalid_request)`,
    `failed(unknown_device)`): sending again would change nothing.

  At most one attempt is in flight, and the next starts no sooner than the action's `ack_within_s`
  after the last began, so a busy device is not sent the action in a loop; except that a device's
  return from `dead` sends at once whatever waits for it. The re-send is pending until an attempt's outcome sends
  nothing more, or the rule stops wanting it; the rule is then complete, with the last attempt's
  outcome. While a re-send is pending the rule is not complete, so GA-SAFE-2 still guards the device
  (GA-SAFE-12). A bridge's reload or a broker restart makes
  `dead` routine, and a valve left open for it is the failure this rule exists to prevent;
- MUST count the rule complete once each actuation has a **final outcome**: `acked`, `delivered`,
  `sent`, `unanswered`, `failed`, `unreachable`, `skipped` or `refused`, with no GA-SAFE-12 re-send
  pending, and not before
  (GA-SAFE-3);
- MUST send a notice, as below, when a device any of its safety rules reads or actuates stops being
  `live`, and when it is `live` again; and when such a rule is configured, or such a device adopted,
  while the device's `fresh_s` is not known, since it can never be `live` until the owner sets one;
  and when the owner sets such a device a `fresh_s` longer than the one its bridge or engine
  declares, since a dead device then reads `live` for longer;
  a newer such notice for the same rule and device replaces an untaken older one. A device `dead`
  only because its bridge went `offline` gracefully, or because the applier lost the broker, gives
  no notice unless it is still not `live` 60 s (⚠️ a guess) later, so a planned reload does not
  flood the household; a bridge's second such death within 10 min (⚠️ a guess) gives the notice at
  once, so a bridge that reloads in a loop is seen (GA-SAFE-10).

`refuse(safety)` and latches bind requests. They do not bind another safety rule or a load cap,
which are not requests.

**Latches.** A rule may declare a latch, `{ condition }`: a condition over its own devices' state (no
leak sensor reports a leak). The latch is held from when the rule fires until the condition is true
on reported values, never on an `assumed` one, and every sensor it reads is `live`. While it is
held, every action that would change a state key
the rule set on a device it actuated (a valve's `open`, a cover's `set_position`), and every extension
action on such a device, whose effect the applier cannot know (a valve's own countdown), is
`refuse(latched)` for every request. After it clears, and until such an action next runs, its
effective tier is `no_voice`, and it runs only with a token whose `for` has a `person`
(GA-SAFE-7). The owner may clear a held latch through `configure` (`clear_latch`), for a sensor that
will never report again; the `latch` event says the owner cleared it. The applier MUST emit a `latch` event when a
latch is set and when it clears, and MUST list held latches in `state` (GA-SAFE-9).

**Notices.** A rule may carry a notice. A notice is `{ notice_id, cause, rule_id?, devices?, text,
outcomes? }`, where `cause` is `safety_rule` (with `rule_id` and `outcomes`), `liveness` (GA-SAFE-10,
with `rule_id` and `devices`), `load_cap` (GA-LOAD-2, GA-SAFE-13), `rule_disabled` (GA-META-3, GA-SAFE-13), `route_conflict` (GA-BUS-11), `window_closed`
(*Provisioning*), `other_admin` and `open_loop` (*Adoption*), `bridge_fault` (GA-BUS-12) or `plugin_update`
(GA-BUS-15); an unknown cause is shown as a notice all the same. For a safety rule, the applier MUST issue it once
the rule is complete, saying each actuation's final outcome, and, when an actuation waits for
GA-SAFE-12's re-send, MUST issue one at once saying
the rule fired and what waits, which the completion notice then replaces; MUST send it on a channel it owns, if it
has one; and MUST carry it in the `notices` list of every `events` response until a client lists its
`notice_id` in `notice_taken`, whether or not its own channel delivered it, and MUST NOT drop it. An
actuation reported `failed` that later has a `late_ack` gets a second notice saying so (GA-SAFE-8). `window_closed`, `other_admin` and `plugin_update` are issued at level Act and kept the same way
(GA-ADOPT-3, GA-PROV-2, GA-BUS-15).

A **witness** is `{ sensor: device id, expect: rises·falls·becomes(value)·toward(arg, by), within_s: number }`;
`toward(arg, by)` expects the sensor to move at least `by` towards the value of the action's
argument `arg` (an air conditioner's setpoint). `within_s` counts from dispatch. A Safe applier MUST
report a witnessed action `confirmed`, `unconfirmed`, or `unknown` when the sensor was not `live`
throughout, no later than 1 s after its `within_s`; and a witness whose sensor has no known
`fresh_s` when it is configured MUST be a notice with cause `liveness`, since its verdict can only
be `unknown`, and so MUST one whose sensor is given an owner `fresh_s` longer than the declared
one, since it can then say `confirmed` from a dead sensor (GA-WIT-1).

## Adoption

A device new to an applier, whether a bridge or an adapter's engine adds it, is `adopted: false`.
Devices the applier already had before it supported adoption are adopted as configured. An
unadopted device is in `describe` and its state is readable, but every action on it is
`refuse(not_adopted)` in a plan and `refused(not_adopted)` at apply, and `configure` refuses a
safety rule that reads or actuates it (GA-ADOPT-1). A device is new when it arrives through a join
window, a commission or a `connect` of hardware its bridge did not hold, whatever identifier it shows: an identifier is the device's own claim,
unattested for Zigbee, so a device that joins with an adopted device's identifier is a new,
unadopted device and inherits nothing (GA-ADOPT-1). A device that rejoins on its own with the key it
already holds, while it is still in its bridge's `devices`, is the same device; a Zigbee trust-centre
rejoin is the same device when it runs under the device's own unique link key, and an admission,
so new, when it runs under a link key everyone knows (`standard/bridge.md`, *Provisioning*); hardware that
rejoins with no entry there is reported as an admission (GA-BRIDGE-35), and so is new. After `left`, the device stays in the model, `dead`, with its id
and its rules, until the owner removes it or replaces it; the owner may adopt hardware that joined
again, even with the same identifier, with `replaces` naming the old id. The owner adopts it through `configure`:

`adopt: { device, class, declarations, replaces? }`

It is a model change like any other: `expected_revision`, `dry_run`, whole or nothing (GA-CFG-2),
and only the owner's configuration credential may make it (GA-CFG-1). The class is the owner's: the
owner's app shows the bridge's `proposed_class` and its `class_evidence`, and *Default tiers*
follow from the class the owner gives; it may be null for a plugin device or a wake relay's entry. A
new device therefore waits for its owner, whoever joined it.

**Activating a plugin.** A plugin's server starts only when its bridge is told of an adoption
(`standard/bridge.md`, *Plugins*). The applier MUST send its bridge the Host request `activate {
plugin, version }` when the owner adopts the first device of a version of a plugin; for a version
that has staged devices, only on an adoption with `replaces`, since adopting a staged version's new
key alone swaps nothing; and never for a version none of whose devices is adopted (GA-ADOPT-4).
The bridge answers `ok`, and keeps the activation across its restarts (GA-BRIDGE-42). The
adoption stands whatever the reply: until an `ok` comes, the applier sends `activate` again each
time the bridge is found live again, and at least every 60 s (⚠️ a guess) while it stays live,
which changes nothing on a bridge that already has it, since `activate` is idempotent. A version
with no staged devices swaps too: its `activate` removes every device of the plugin's other version
on that host (`standard/bridge.md`, *Staged versions*), and a staged version's does the same,
its devices with no replacement adopted included. Before sending any `activate` that will remove
an adopted device of another version of the same plugin on that host, one the same change set does
not replace with `replaces`, the applier MUST issue a notice with cause `plugin_update` naming
each such device, so that no adoption evicts one unseen (GA-ADOPT-4). An adoption that would send an `activate` removing a device a
safety rule names, one the same change set does not replace with `replaces`, MUST be refused with
`invalid_request` and nothing changed, as an `uninstall` is while a safety rule names a device of
the plugin (GA-PROV-4): the owner moves or deletes the rule first (GA-ADOPT-4). A
`failed(unknown_plugin)` reply MUST be a notice with cause `bridge_fault` naming the version's
adopted devices, raised once until an `ok` (GA-ADOPT-4): the bridge has lost the plugin, and its
devices stay `available: false` until the owner installs it again.

**Replacement.** `adopt` with `replaces` gives the new hardware the replaced device's applier `id`
(for a staged plugin device, at the swap, *A pending replacement* in *Plugins*),
its declarations (for a plugin device, only those the owner set: the manifest's are the new
version's, *Plugins*) and the safety rules that name it, but not an owner-set `fresh_s`: the new device's
bound is the one its bridge declares for it, or, where the bridge can declare none, unknown until
the owner sets one. `describe` then carries the new
`stable_identifier`, and the old one at the end of `previous_identifiers`, oldest first. From then
on, the old identifier is retired: if that hardware rejoins, it is a new, unadopted device, and never
takes the id back. The new device MUST offer every action and state key the old one's declarations
and safety rules use, or `configure` refuses the adoption, except that a plugin device's replacement
may drop an action no safety rule uses, and a steward's step on that action then becomes
`unsupported_action`, as below; old and new must sit under the same child;
and the replaced device's `id` MUST NOT change at any level (GA-ADOPT-2). The safety rules the new
device inherits are checked again as GA-SAFE-6 checks a new rule, against the new device's
`other_admins`, and the adoption is refused if one fails. Hardware replaced by itself, with the same
identifier, keeps that identifier: it is not retired. The steward's rules,
scenarios and leases, which name that id, are untouched. The applier cannot see what the steward's
scenarios use, so a scenario step on an action the new device lacks becomes `unsupported_action`,
visible in the plan. Removing the old hardware from its bridge is a separate `provision { remove,
force, block_rejoin }`.

A safety latch over a replaced sensor clears the ordinary way (GA-SAFE-7), once every sensor it reads
is `live` and the condition holds. A new sensor whose freshness bound is not yet known reads `stale`
(GA-STATE-5), so the latch holds until the bound is known: at once where the bridge declares it,
and otherwise once the owner sets it. That is intended: a sensor whose rhythm nobody knows is not
taken for a dry one. The owner may still `clear_latch`.

**Other admins.** A device with an action whose effective tier is above `reversible`, and with
another admin or with `other_admins: unknown`, MUST be a notice with cause `other_admin` when it is
adopted, whenever an admin is added to it, and once, for each such device already adopted, when the
applier starts supporting adoption (GA-ADOPT-3): that is where a second door opens. At adoption the
tier is judged before any change in the same change set lowers it, so that adopting a plugin device
and lowering its extension action at once still says who else can reach it (GA-ADOPT-3). When a device's
`other_admins` later becomes `[]`, a notice with cause `other_admin` says so, and replaces an untaken
earlier one for that device. A `[]` that lapses to `unknown` only because a table is unread or old
(`standard/bridge.md`, GA-BRIDGE-14) is an `other_admins` event, not a notice, and if a later read
finds `[]` again nothing is said; a read that finds an admin is a notice as above. An admin added to a
device that a safety rule actuates without `accepts_other_admins` leaves the rule running, since it
still closes the valve, and its notice says that the rule's latch no longer binds that admin. A device's `other_admins`
changing is also an `other_admins` event.

**A transmitter that answers nothing.** Adopting a device on an `unknown` transport
(`standard/bridge.md`, GA-BRIDGE-72) MUST be a notice with cause `open_loop` naming it, saying that
nothing will show if it stops working: its transport is never `up`, so a cut wire or a dead emitter
leaves it `live` and its commands `sent`. So MUST an adopted device's transport first reading
`unknown` (a bridge upgraded to 0.4 under it), and `configure` of a safety rule that actuates a
device on such a transport (GA-ADOPT-6).

## Provisioning

`provision` asks a bridge to join, commission, connect or remove devices, or to install or
uninstall a plugin: `{ join: { transport, window_s, near? } | join_close: { transport } |
commission: { transport, code, accept_unattested? } | connect: { candidate, bridge, address? } |
remove: { device | identifier, bridge?, block_rejoin, force? } | unblock: { identifier, bridge } |
install: { host, package: { url, sha256 }, account } | uninstall: { host, plugin } }`. `connect`
is in *Discovery*. `transport`, `device` and `host` are the applier's ids, `host` naming a
computer, and `near` names a device that routes. `account` is the token of the OS account the
plugin will run as, which the owner chooses, since a publisher cannot know it; `plugin` is the
plugin's `id`. `identifier` is a `stable_identifier`: `remove` takes it, with the
bridge, for hardware the applier has retired after a replacement, which no longer has an applier
id. It is at
level Act. Only the owner's configuration credential may call it; the applier passes it to the
bridge that owns the transport or device, and returns the bridge's reply, or `unreachable` when the
publish is refused or no reply comes within 2 s of its publish, a margin over the bridge's 1 s
from receipt, in which case the request may have arrived and the
owner may send it again (*Sending it again*). The level an operation needs is per operation: `install` and `uninstall` need the bridge's level Host, and every other operation,
`connect` included, its level Provision. Against a bridge that does not claim the level the
operation needs, or an adapter, it returns `not_claimed` (GA-PROV-1). It changes no
model by itself: it takes no `expected_revision` and no `dry_run`, the devices it adds arrive
unadopted, and it rolls nothing back.

**Sending it again.** The bridge's `requestId` is the applier's; `provision` returns it for a
`connect`, as `request_id` (*Discovery*), but never takes one from the owner, so a retry needs a key
of the owner's own. `provision` takes an optional `idempotency_key`, as `apply`
does: scoped to the owner's credential, bodies compared as their RFC 8785 serialisations without
the key, never byte for byte, and
kept for 3600 s. A `provision` without one is a new request each time, as it was before this
version. The applier MUST keep, for each key, the `requestId` it sent and what came of it: the
bridge's reply, `accepted` once an event carrying that `requestId` arrives (`connected`,
`connect_failed`, `installed`, `install_failed`, `uninstalled`), or `unreachable`, each replaced by a later reply or event that
carries the `requestId`. A second `provision` with a key seen in the last 3600 s and the same body
MUST be answered from that record and MUST NOT be sent to a bridge again; with a different body it
MUST be the error `idempotency_conflict`, and nothing is sent (GA-PROV-3). The key rests on the
applier's record, not on the bridge's 10 s duplicate window (GA-BRIDGE-4), which only absorbs the
broker's own duplicates. A repeat answered `accepted` says only that the bridge took the first;
whether it succeeded, the owner reads from its `provision` event (`installed` or `install_failed`,
`commissioned` or `commission_failed`, `connected` or `connect_failed`, `window_closed`, `left`,
`uninstalled`). An owner whose
first try is still `unreachable` and who wants it tried again sends a new key, knowing the first
may have arrived: an `install` or a `commission` may then run twice, and a `join` opens a second
window, which the events show; a `connect` whose device the bridge already holds ends `connected`
naming it and changes nothing (GA-BRIDGE-40); an `uninstall` run twice ends `failed(unknown_plugin)` at the
bridge the second time (GA-BRIDGE-68), which the applier takes as done, since the plugin is gone; and
`join_close`, `remove` and `unblock` change nothing more.

An `install` is `accepted` by the bridge, which then fetches the package, checks it and ends in an
`installed` event, carrying the manifest, or `install_failed` with a reason (`unknown_account` for
an `account` the computer's `accounts` does not list; `version_conflict` for a reinstall with
another manifest or `account`); an `uninstall` ends in
`uninstalled` (GA-BRIDGE-68); on it, or on the `uninstall`'s `accepted` if that comes first, the
applier forgets the plugin's devices (GA-PROV-4). Each is a `provision` event. The plugin's devices arrive unadopted,
and its server starts only on `activate` (*Adoption*). `activate` is not a `provision` operation:
the applier sends it itself, on the owner's adoption.

What joined is a `provision` event. When a join window closes, the applier MUST issue a notice with
cause `window_closed` naming every device that joined in it, kept as a safety notice is (GA-PROV-2).
The owner's app that opened the window reads the event itself; the notice goes to the home's notice
channels too, which may be a shared panel, on purpose: a device nobody claims is news for the
household.

### Settings (⚠️ tentative)

⚠️ **Tentative** (the maintainer, 2026-10-06): written for the joint review to judge, and outside the
requirement index until decided. `provision` gains `configure_device: { device, setting, value,
within_s }`, the owner's configuration credential's only, as every `provision` is (GA-PROV-1), at
the bridge's level Provision. It changes a device's setting, a value outside the vocabulary that
configures the device (`standard/bridge.md`, *Settings*): the bridge writes it at the device's next
check-in, within `within_s` or never. The applier returns the bridge's `accepted`, and relays its
`setting_applied` or `setting_expired` as a `provision` event to the owner. A setting is never an
action: no brain can ask for one, it is never a step of a plan, a scenario or a rule, and the device
reads the value it reports, never the one asked for, until the device confirms it. ⚠️ To decide with it: whether a
device under a held latch, or one a safety rule reads or actuates, is refused `configure_device`
(GA-SAFE-2 and GA-SAFE-7 refuse only an action on a device a rule actuates, today). Once decided, `provision`'s shape, its event list and the device's `pending_settings`
gain these; until then a bridge refuses the op.

## Discovery

A box's **finder** (`standard/bridge.md`, *The finder*) hears what is on the home's network and the
box's own ports, and publishes **candidates**: things an installed bridge manifest matches. The
applier that owns the box's bridges reads the finder's topics and shows the owner what could be
taken. A candidate is a fact the finder heard, unverified; it is never a device.

- **The finder's liveness.** The applier judges the finder as it judges a bridge: dead 30 s
  after its last `status`, at once on its will or a graceful `status`, and live again only as
  GA-BUS-8 says; a will whose `instanceId` is not the latest `status`'s is ignored, and a
  `publishedAt` more than 5 s off its arrival is `clock` in `finder_faults`, as it is a fault for a
  bridge (GA-BUS-2). A finder
  `status` without a `v` the applier knows makes the finder dead; with no devices behind it, that
  is not a `bridge_fault`. A dead finder leaves its last list, marked
  `finder: dead` (GA-DISC-5); a candidate on it may still be taken, its address checked against that
  list, since the device's proof, not the finder, is the guard.
- **`candidates`** takes `{ }` and returns `{ finder, finder_sources, finder_faults, candidates,
  ignored_keys }`, where `finder` is `live`, `dead`, or `none` when no finder has published;
  `finder_sources` and `finder_faults` are the `sources` and `faults` of the finder's latest
  `status`, the second with `clock` added while its clock is off, so the owner sees that DHCP is not
  heard, or that the list is full, rather than conclude nothing is there; an adapter, which has no
  box broker, always answers `finder: none`, empty lists and no candidates. The finder's death and
  its faults raise no event, for the reason below; the owner's app sees them when it calls
  `candidates`. Each candidate carries the finder's
  fields in the applier's snake_case, `{ id, sources, keys, address?, first_seen, last_seen, hints,
  matches }`, and `offers: [{ bridge_type, connect, bridges }]`, one for each of its `matches`,
  where `bridges` are this applier's live bridges whose latest `status` gives that `bridgeType`
  and, where the match says `connect`, claims Provision. It lists every candidate that shares no
  key with `ignored_keys`, nor with the `connections` it last saw on a device or transport of any bridge
  registered with this applier, live or dead, kept across a restart, so a held device is not
  offered as new while the bridges' retained documents load; a device that leaves its bridge's
  `devices` takes its `connections` with it (GA-DISC-2). A device held by an adapter's engine, or
  by a bridge whose type ships no manifest, has no `connections` here and stays listed; taking it
  through `connect` makes a second device for the same hardware, which only GA-BUS-11's
  `route_conflict` names, and only where both bridges report the same `stable_identifier`.
- **Only the owner.** Only the owner's configuration credential may call `candidates`; anyone else
  gets `not_permitted`. A candidate list is a map of the home's network, and no brain needs it.
  For the same reason there is no candidate event: `events` is one stream every client reads. The
  owner's app calls `candidates` when it shows them (GA-DISC-2).
- **Ignoring.** `configure` takes `ignore_candidate: { id }`, which adds the candidate's keys to
  `ignored_keys`, and `unignore_candidate: { key }`, which removes one; both persist across a
  restart, and neither is a model change: a change set of nothing else needs no
  `expected_revision` and never returns `stale_revision`. An ignore hides every candidate that shares a key with
  it, whatever its address or its `id` after a restart of the finder (GA-DISC-3). An `id` the
  applier does not list, or a key not in `ignored_keys`, is `invalid_request`. A candidate with no
  stable key cannot be ignored for good.
- **Taking one.** `provision` with `connect: { candidate, bridge, address? }`, where `address` is
  the one the owner was shown, required whenever the candidate has one, goes to `bridge` only if it
  is this applier's, and its latest `status` claims Provision and gives a `bridgeType` that the
  candidate's `matches` lists with `connect: true`; the applier then sends the bridge's `connect`
  request with that `address` and the candidate's `keys`. Otherwise it is `not_claimed`. A bridge
  that qualifies but is dead, or no reply within 2 s, is `unreachable`, as GA-PROV-1 says, with the `request_id` the applier
  published, since the bridge may still have the request. A
  candidate `id` the applier does not list, a missing `address`, or one that is no longer the
  candidate's, is `invalid_request`, so a key announced from elsewhere since cannot redirect it
  (GA-DISC-4). A Bluetooth candidate has no address; its `ble:` key is all the bridge has, and the
  device's proof of its identity (`standard/bridge.md`, *Provisioning*) is the guard. If neither
  `connected` nor `connect_failed` comes within 70 s of the applier's publish, or the bridge dies
  first, the applier issues the `provision` event `connect_failed` with reason `lost`; a
  `connected` that comes later is issued too, and its device arrives unadopted as any other
  (GA-DISC-4). Both events carry the `request_id` the applier published, which `provision`
  returned with the bridge's reply or with `unreachable`, so the owner's app knows which request ended, and nothing of the candidate
  reaches `events`. No credential rides on it: a
  device's credential is the bridge's own configuration (`standard/bridge.md`, *Provisioning*).
  The request ends in its reply where that is not `accepted` (`failed(busy)`, `invalid_request`),
  and otherwise in the `provision` event `connected` or `connect_failed`. A `connected` the bridge
  sent while the applier was disconnected is not recovered as an event: the applier's `snapshot`
  brings the device, unadopted, with the notice GA-BUS-6 raises, and the request ends `lost`. What the bridge takes
  arrives unadopted, as any new device does (GA-ADOPT-1).
- **Never a device.** Nothing is planned on a candidate, no step names one, and a candidate reaches
  the model only through a bridge's `devices` and the owner's adoption (GA-DISC-1). Anyone on the
  network can announce anything, and a hearing can hide a candidate by claiming its keys; the
  finder is a convenience, and a device the owner expects and does not see is set up as without
  one.

A candidate that needs a new bridge (a Hue hub, a Tuya plug whose key comes from the owner's
account) is set up with the box's own tool, outside this standard; the applier only shows that no
running bridge can take it, with `bridges` empty.

## Plans

### Requests

A request is `{ actions: [{ target, action, args, via, brain, for, token? }] }`. `target` is a device id;
the applier resolves no names, rooms, groups or selectors. A request that does not match the
operation's schema is the error `invalid_request`. An argument that matches the schema but not the
device's `args` is a step, `refuse(invalid_args)`.

### Steps

A plan has exactly one step per distinct `(target, action, args, via, brain, for, token)` in the
request, identical ones merged, and an unknown target gets a step `skip(unknown_target)`, never an error (GA-PLAN-2). Steps
are dispatched in the order of the request; a meta-applier keeps that order within each child, and
may dispatch to different children in parallel (GA-PLAN-7). A step is:

| Field | Values |
|---|---|
| `step_id` | id, unique in the plan |
| `target`, `action`, `args` | as requested |
| `verdict` | `op` · `skip` · `refuse` |
| `reason` | for `skip`: `already`, `unknown_target`, `unsupported_action`, `dead`; for `refuse`: `not_adopted`, `invalid_args`, `duplicate_route`, `safety`, `latched`, `tier`, `toggle_only`, `token`; and, at apply only, `declaration_changed` (GA-DESC-18) |
| `tier` | the action's effective tier: its declared tier, raised to `no_voice` for a latched undo |
| `stale` | bool |
| `basis` | `real` or `emulated` (GA-PLAN-3) |

An adapter that cannot plan in its engine emulates the plan from its description and marks each
step `emulated`.

### Reason order

When more than one reason applies to a step, the applier MUST report the first in this order
(GA-PLAN-4):

1. `unknown_target`
2. `unsupported_action`
3. `not_adopted`
4. `invalid_args`
5. `dead`
6. `duplicate_route`
7. `safety`
8. `latched`
9. `tier`: a `no_voice` action with `via: voice` or `brain: true`
10. `already`: the device's live, observed state already matches, within the declared `tolerance`,
   what the action would set, the key an argument chooses included (*Key families*). Not evaluated
   for a `stateless` action, a `feedback: open` device or a `stale` value, except `power.wake`,
   `already` on a `live` computer (*Waking*); never for `media.launch`
11. `toggle_only`: the action is declared `toggles: true` on a `feedback: open` device and the step
   carries no token (GA-PLAN-8)
12. `token`

`dead` for `power.wake` on a computer is its `wake_via` device's, not the computer's (GA-APPLY-12).
For that action `already` is evaluated before `dead`, at plan and at dispatch: a `live` computer's
wake is `already` whatever its `wake_via` device's liveness (GA-PLAN-4).

`token` comes last, so that a client planning before it has asked anyone still learns every other
reason; the step's `tier` tells it whether a token will be needed.

**Toggles.** An action declared `toggles: true` on a `feedback: open` device MUST NOT be dispatched
without a token for its step: without one the step is `refuse(toggle_only)`, after `already`. The
steward asks the person, in words saying that the code toggles and the device's state is not
known, and a yes earns the token
(`standard/steward.md`, *Steps*); a token names no reason, so one yes answers the tier and the
toggle together. A token whose `for` names a `rule`, or a `run` with neither a `person` nor an
`endpoint`, is an author's confirmation, never a person's yes to the toggle, and MUST be taken as no
token for such an action, so a rule, a schedule or a run they start never sends one: the step is
`refuse(toggle_only)`, which the steward reports as `skip(toggle_only)`; a run started at an
endpoint with no person (a hall panel) was asked there. Such an action MUST be declared
`idempotent: false`, so it is never reissued (GA-PLAN-8).

`toggle_only` holds on a `feedback: open` device only, whose state is assumed. A `feedback: closed`
device whose action toggles is planned from its observed state, as any other: `skip(already)` when
it already holds, and dispatched otherwise (GA-PLAN-8).

**The applier's own actuations.** The applier MUST NOT send an action declared `toggles: true`, on
any device, in an actuation of its own: a load cap's turn-off (GA-LOAD-2), a safety rule's action or
its re-send (GA-SAFE-12), or any retry, since no one is asked there and a lost report would
make the next send undo the last. `configure` MUST refuse a safety rule whose action on a device is
declared so, and a `load: heating` on a socket whose `onoff.turn_off` is declared so. The check runs
again whenever a device's declarations change (a code re-taught, a replacement): a safety rule that
no longer passes MUST be disabled with a notice with cause `rule_disabled`, and a cap that no longer
can act MUST be a notice with cause `load_cap`, and neither sends the toggle. A socket whose
`onoff.turn_off` is declared so and whose load was never configured, and so is taken as `heating`
(GA-DESC-8), MUST be a notice with cause `load_cap` at its adoption saying that its cap cannot act
(GA-SAFE-13).

### Planning changes nothing

`plan` MUST NOT change state or the event stream (GA-PLAN-1). A plan has `plan_id`; `expires_at`
(60 s after creation); `revision`; the client that made it; the request it was made from; and its
steps. Apply uses the plan's request, not anything the apply call carries.

## Apply and outcomes

### Apply

`apply` takes `{ plan_id }` or `{ request }` (inline: planned and applied in one call), and always an
`idempotency_key`.

- A plan MUST expire 60 s after it is made. Applying a plan that has expired, was made at an older
  revision, or was made by another client
  MUST be a request error (`plan_expired`, `stale_revision`, `plan_not_yours`) and MUST dispatch
  nothing (GA-APPLY-2).
- **Apply re-evaluates.** For each `op` step, and each step planned `skip(already)`, the applier MUST
  re-evaluate `not_adopted`, `dead`, `safety`, `latched`, `already`, `toggle_only`, the token and
  whether its action's declarations changed since the plan (GA-DESC-18) at dispatch, and report
  `refused(not_adopted)`, `unreachable`, `refused(safety)`, `refused(latched)`, `skipped(already)`,
  `refused(toggle_only)`, `refused(token)`, `refused(declaration_changed)` or dispatch it (GA-APPLY-9).
- An `idempotency_key` is scoped to the client. Bodies are compared in their RFC 8785 form without
  the key and without tokens, so a retry that carries freshly issued tokens is the same body. A second apply by the same client with a key seen in the last 3600 s and the same body MUST return the first apply's `apply_id` and outcomes, and
  MUST dispatch nothing (GA-APPLY-4). With a different body it MUST be the error
  `idempotency_conflict` and dispatch nothing (GA-APPLY-10).

### Outcomes

`apply` SHOULD return an `apply_id` and one outcome per step within 500 ms for up to 20 targets on a
live home, plus 300 ms for each meta-applier hop (GA-APPLY-1). The synchronous outcomes are:

- `dispatched`: dispatched. For a device behind a bridge, dispatched means the broker acknowledged the
  command with a success code (GA-BUS-9);
- `skipped(reason)`: the plan's skip reason, or `already`;
- `refused(reason)`: the plan's refuse reason, or `not_adopted`, `token`, `latched`, `safety`, `declaration_changed`;
- `unreachable`: the target is `dead` at dispatch, or the broker refused to deliver the command
  (GA-BUS-9). A `dead` target MUST NOT be `dispatched` (GA-APPLY-5), except a `dead` computer's
  `power.wake`, which is dispatched to its `wake_via` device and is `unreachable` only when that
  device is `dead` (GA-APPLY-12). A target already `skip(dead)` in the plan is `skipped(dead)`.

Later outcomes arrive through `outcome` and `events`. The first final outcome of a step is its
outcome:
- `unreachable`, after `dispatched`: the bridge acked `failed(unreachable)` or `failed(expired)`, so
  nothing was sent. The applier MUST report it so (GA-APPLY-5), and the token stays used
  (GA-TOKEN-4). `unreachable` always means nothing was sent;
- `acked`: the device's own reported state now matches, within the declared `tolerance`. The applier
  MUST NOT report `acked` before it does (GA-EVT-3). The key is the one the action sets, which for
  `session.lock` its argument chooses, and `locked`, `disconnected` or `none` matches it; a plugin's
  extension action matches its `confirmed_by`. Two actions are acked otherwise, as named
  exceptions: `media.launch` by a new item (GA-EVT-7), and `power.wake` by the computer's return
  (GA-APPLY-13). A target that already held produces no report
  of its own; the bridge reads it back after its `applied` (GA-BRIDGE-34), and that observation, made
  after dispatch, can ack the step;
- `delivered`: a `stateless` action on a `feedback: closed` device that the device or channel
  acknowledged (for a device behind a bridge, the bridge's `applied` ack; for an adapter's device,
  the engine's word that it sent the command, such as Home Assistant's success on a button, which
  says no more than that). Such an action ends `delivered`,
  `sent` where the action is declared `confirms: false` (the bridge's `sent`), or `failed`; never
  `acked`, except `power.wake`, which ends as *Waking* says (GA-APPLY-7, GA-APPLY-13). A `sent` for an action declared `confirms: true`, stateful or stateless, is
  a bridge fault, and the step waits for its report or its bound;
- `sent`: as above, and any action on a `feedback: open` device once transmitted (GA-STATE-4);
- `unanswered`: an action on a `feedback: open` device when nothing said within its `ack_within_s`
  whether it was transmitted (GA-STATE-4). It is named apart from the witness's `unknown`;
- `failed(reason)`: a bridge's ack `failed` with that `reason`, unless a matching report came
  first, except `failed(unreachable)` and `failed(expired)`, which are `unreachable` as above, and
  `failed(no_confirmation)`, which is taken as no ack: the step waits for a report or its bound
  (`standard/bridge.md`, *Commands*); a bridge's `unsupported`, as `failed(unsupported_action)`; or
  `failed(no_ack)` when a `dispatched` action on a `feedback: closed` device has no other final
  outcome within its `ack_within_s`, reported no later than 1 s after it; or at once, within 1 s,
  when its bridge, its engine (GA-STATE-3) or its child (GA-META-7) is found dead while the step still waits (for `power.wake`, the owner of the `wake_via` device, until that device's terminal ack, and after it no bridge, *Waking*), before any terminal ack other than
  `failed(no_confirmation)` or after an `applied` or `sent` whose report or read-back has not come:
  the device may or may not have acted, and waiting out the bound would say no more, since a hung
  bridge still takes a command (GA-APPLY-8). Other reasons
  are free text for a person;
- `confirmed`, `unconfirmed` or `unknown`: the witness's verdict (GA-WIT-1).

**Detail.** A bridge's ack may carry `detail`, text for a person (`standard/bridge.md`, *Commands*).
The applier MUST carry the `detail` of the terminal ack it took for a step in that step's final
outcome, in `outcome` and in its `outcome` event, whatever the outcome it ends in, a `failed(no_ack)`
after a `failed(no_confirmation)` included, and never change the outcome for it (GA-APPLY-15). A
plugin's tool error reaches a person this way. A `detail` is a bridge's or a plugin's text,
third-party content: a steward hands it to a brain as data, never as instructions (GA-BRAIN-3).

A device report that matches, within its `tolerance`, an action that ended `failed(no_ack)`,
within 60 s after that outcome MUST be reported as a `late_ack` event with that apply as its cause,
not as `external` (GA-APPLY-11). After a bridge's ack `failed`, other than
`failed(no_confirmation)` and `failed(not_locked)`, or `unsupported`, the bridge did not act
(GA-BRIDGE-7), so a later match is someone else's change, reported as `external`. A
`session.lock` acked `failed(not_locked)` ends `failed(not_locked)`, but a report matching it
(`locked`, `disconnected` or `none`) within its `ack_within_s` is the OS finishing the request, not
someone else's change: it keeps the apply's cause (*Causes*, GA-EVT-1), and MUST be reported as a
`late_ack`, as after `failed(no_ack)`, which a client takes as any `late_ack` (the steward's
GA-RULE-8, the brain's GA-BRAIN-15) (GA-APPLY-11).

### Reissue

An applier MUST NOT reissue a dispatched action on an ack timeout when the device declares that
action non-idempotent (GA-APPLY-6). It MAY reissue an idempotent action, under the same `apply_id`,
unless the device has since reported a value moving away from it.

## Events and history

`events` takes `{ cursor?, wait_s?, notice_taken? }` and returns `{ events[], cursor, notices[] }`.
`notices` holds every notice not yet acknowledged; `notice_taken` lists the ones the client
has delivered. The applier ignores `notice_taken` from the owner's configuration credential, so the
owner's app cannot keep a notice from the house's channels.

- With no cursor, it returns no events and the current cursor.
- It returns events after the cursor. With `wait_s` (0–30) and none pending, it holds the call until
  one arrives or `wait_s` passes.
- The applier MUST keep events for at least 3600 s; a cursor older than that is the error
  `cursor_expired`, and the client re-reads `describe` and `state` (GA-EVT-4).

An event is `{ seq, time, type, … }`, with `type` one of:

| Type | Carries |
|---|---|
| `state` | target, key, value, basis_time, cause |
| `outcome` | apply id or safety rule id, target, outcome, and the ack's `detail` where one came (GA-APPLY-15) |
| `late_ack` | apply id, target, value |
| `liveness` | target (or child), old and new liveness |
| `rule_fired` | safety rule id, its actuations' outcomes, the notice; issued when the rule completes, not when it fires |
| `latch` | safety rule id, `set`, `cleared` or `cleared_by_owner` |
| `model` | the new revision; for an adoption, `{ device, class, replaces? }`; for a bridge's changed declarations, the device (GA-DESC-18) |
| `occurrence` | target, key, value, basis_time, cause `device`: an `event` key's occurrence (*Occurrences*) |
| `undescribed` | target, one name newly undescribed (`name`): relayed from the device's bridge's `undescribed` event (GA-BRIDGE-76), once per name; not kept in the applier's `history`, since the device's `undescribed` holds the list (GA-DESC-19) |
| `route_conflict` | stable identifier, the children or bridges reporting it |
| `provision` | transport, bridge or host, `joined`, `left`, `window_closed`, `commissioned`, `commission_failed`, `connected`, `connect_failed`, `blocked_rejoin`, `installed`, `install_failed` or `uninstalled`, the devices, transport, identifier, plugin or manifest; `connected` and `connect_failed` carry the `request_id`; `connected` names the device the bridge now holds, and `connect_failed` its `reason` |
| `freshness` | target, its new `fresh_s` and `fresh_basis` |
| `transport` | transport, its `up` and its `state`: `up`, `down` or `unknown` |
| `bridge_fault` | bridge, what it was: a `0x87` refusal, a fast clock, a `sent` it could not give, a fault in its `status` |
| `other_admins` | target, its `other_admins` |

Every event that reports a change MUST carry its cause, and `history` MUST return the same causes in
the same order (GA-EVT-2).

`history` takes `{ targets?, from, to }` (every device when absent; a `rule_fired` or `latch` event
matches the devices its rule actuates) and returns the `state`, `outcome`, `late_ack`,
`liveness`, `rule_fired`, `latch`, `model`, `route_conflict`, `provision`, `freshness`, `transport`, `other_admins`, `bridge_fault` and `occurrence` events for those
targets in that range (a `model` event matches the devices its change names), oldest first, an
`occurrence` of a key in the device's `personal` excepted, which is kept in `events` only, as
`speech` is. The applier MUST keep them for at least 7 days (GA-EVT-5).

### Occurrences

A key of `kind` `event` is something that happens (a vibration alarm the device never clears, a
button press, a gesture), not a value the device holds. Each occurrence its bridge publishes MUST
become one `occurrence` event, and is never a state value: `state` never returns it, no step is
`already` or `acked` on it (GA-EVT-3 matches state keys only), `configure` refuses a safety rule that
reads it with `invalid_request`, and the `occurrence` event itself moves no liveness and no
freshness: the message that carried it is a check-in, and moves the device's `last_check_in` as any
does (GA-EVT-8). An occurrence missed in a gap is not recovered: a `snapshot` re-sends state, never
occurrences. An alarm modelled as a state that never clears leaves a device reading "on" for good,
which is why an occurrence is not one.

## Restarts

An applier MUST keep across a restart: its configuration; idempotency keys for their retention,
with the outcomes, or the `requestId` and result of a `provision`, each one got; used
token ids; held latches; unacknowledged notices; the wall-clock time each heating load was first
reported `on`, so that downtime counts towards its cap; and each `feedback: open` device's assumed
state; a safety rule not yet complete, which resumes waiting for its final outcomes and then issues
its notice; pending ack deadlines; each held apply's outcomes; the id map, retired identifiers
and each device's adoption state; `ignored_keys` and the `connections` last seen on each bridge;
the last `basis_time` seen for each key a safety rule reads;
which of each computer's adopted hosted devices were live when it last went `dead`, and the
`last_check_in` each held then; each plugin
action's `tool_hash`; each plugin tombstone GA-PROV-4 keeps; and whether each adopted plugin version's `activate` has had its `ok`, a
cancelling `activate` (*A pending replacement*) included (GA-PERSIST-1). Plans need not survive; applying one that did
not is `unknown_plan`.

## Operations

Every operation is a request and a response. **Errors** are for requests the applier cannot act on
at all; what happened to a target is always a step or an outcome. Error codes: `invalid_request`,
`not_claimed`, `not_permitted`, `unknown_plan`, `unknown_apply`, `plan_expired`, `stale_revision`,
`plan_not_yours`, `cursor_expired`, `idempotency_conflict`, `cycle`.

| Operation | Request | Response | Level |
|---|---|---|---|
| `describe` | `{ since_revision? }` | `{ applier_id, standard_version, levels, revision, descendants, ungoverned, box, clients, devices, transports, safety_rules, children, test_run_id? }`; with `since_revision` equal to the current one, `{ revision, unchanged: true }` | Act |
| `state` | `{ targets? }` | per target: values, liveness, `last_check_in`, `fresh_s`, `fresh_basis`, `other_admins`; each transport's `up` and `state`; held latches | Act |
| `plan` | request | plan | Act |
| `apply` | `{ plan_id } \| { request }`, `idempotency_key` | `{ apply_id, outcomes }` | Act |
| `outcome` | `{ apply_id }` | current outcomes, including late ones; `unknown_apply` if not held | Act |
| `events` | `{ cursor?, wait_s?, notice_taken? }` | `{ events, cursor, notices }` | Act |
| `history` | `{ targets?, from, to }` | events | Act |
| `configure` | `{ changes, expected_revision, dry_run }` | dry run: a readable diff; otherwise `{ revision }` | Act |
| `provision` | as *Provisioning*, `idempotency_key?` | the bridge's reply | Act |
| `candidates` | `{ }` | `{ finder, finder_sources, finder_faults, candidates, ignored_keys }`, as *Discovery* | Act |

`clients` lists the ids of the registered clients. `transports` lists each transport as `{ id,
kind, up, bridge }` (*Transports*). `children` lists each child's `applier_id`,
claimed levels and `ungoverned`. A bridge whose `status` carries `test_run_id` while the applier
is not under the harness is a `bridge_fault`, and its devices cannot be adopted (*not checked by
the harness*, which cannot be absent from its own run). `test_run_id` is present
only under the conformance harness (see *Conformance*).

### configure

- `changes` is a list of upserts and deletes of: clients (stewards and parents, with their
  credentials, and whether each is a `steward` or a `parent`); tiers (raise only, except an
  extension action, down to its floor, and deleting a tier a replacement kept, *Default tiers*); loads and
  `max_on_s`; `infrastructure`; `applier_host` on a computer (*Safety rules*); `self_changing` and `personal` keys, and `internal` (never removing
  a declaration the standard or a bridge makes, except a plugin manifest's `self_changing` key,
  GA-DESC-9); `wake_via` (*Waking*); `tolerance`;
  `ack_within_s`; witnesses; safety
  rules; `clear_latch`; children (`applier_id`, address, credential reference); routes
  (`stable_identifier` → child, or → bridge for an identifier two bridges report); device keys;
  bridges (`{ id, identity }`); `box`; `adopt` (*Adoption*); `ignore_candidate` and
  `unignore_candidate` (*Discovery*); `forget: { device }`, which removes an
  unadopted or `left` device from the model with no safety rule naming it, and is refused for one
  still in its bridge's `devices` (remove it there first), a named exception being GA-PROV-4's
  forgetting of an uninstalled plugin's devices, and for one a computer's `wake_via` names (clear
  the `wake_via` first) (GA-DESC-10); `fresh_s`;
  `accepts_other_admins` on a safety rule.
- Only the owner's configuration credential MAY call it; anyone else gets `not_permitted`
  (GA-CFG-1).
- It MUST refuse, with `invalid_request`, an `ack_within_s` below 2, below twice a device's `reach_s`
  plus 10, or above 300, a `max_on_s` above 86400, or an `applier_host` set on a device that is not
  a `computer`, or on a second computer while another holds it (clear the first in the same change
  set) (GA-CFG-3), and what *The applier's own actuations* names (GA-SAFE-13).
- `time_source` is accepted only when the subject runs under the harness, with `test_run_id` set.
- With an `expected_revision` that is not current, it MUST return `stale_revision` and change
  nothing, checked first; with `dry_run`, it MUST change nothing and return the diff; a change set MUST be applied
  whole or not at all (GA-CFG-2).

## The meta-applier

A meta-applier is an applier whose devices include its children's. It routes; it holds no house
state. Everything above applies to it, and in addition:

- **Union.** Its `describe` is the union of its own devices and its children's. A child's device
  that has a `stable_identifier` is exposed as `sid:<identifier>`, where the identifier is its
  oldest: the first of `previous_identifiers` if it has any, else its `stable_identifier`, so a
  replacement does not change the id. A retired identifier never mints a `sid:`: hardware that
  rejoins after being replaced is exposed as `<child applier_id>/<id>`, as is every other child
  device, and so is a second device one child reports with an identifier another of its devices
  already holds (GA-META-1). Its `revision` MUST change whenever a child's does
  (GA-META-9).
- **One device, one route.** A device reachable through more than one child is one device with one
  route. Routes and duplicates are keyed on the oldest identifier, as the `sid:` is. If the
  meta-applier sees one identifier under two children and no route for it,
  it MUST expose it once, as `sid:<identifier>`, make every step for it
  `refuse(duplicate_route)`, and emit one `route_conflict` event for
  that identifier, not one per poll, until a route is configured (GA-META-2). A device with no stable identifier is declared through
  `configure` as a **device key**, `{ key, members: [child device ids], route: child }`, and exposed
  as `key:<key>`.
- **Bridges stay with their owner.** Bridges, `adopt` and `provision` are the business of the
  applier that owns the bridge, as a child's loads are. A meta-applier may own bridges of its own,
  and provisions and adopts their devices as any applier does; for a transport or device a child
  owns, `provision` and an `adopt` change are `not_claimed`, and the owner's app calls the child
  that `describe.transports` names. A
  replacement across two children is refused (GA-ADOPT-2).
- **Candidates stay with the bridges' owner.** Candidates and ignores belong to the one applier
  that the box's registration record names as the finder's reader (GA-BOX-2); another applier with
  bridges on that box answers `finder: none`. Below Box anyone can publish a candidate list, and
  one click on `connect` then makes a bridge dial an address of their choosing, past the refused
  ones; the proof stops the take, not the dial. A meta-applier's `candidates` offers only
  bridges it owns itself, and says `finder: none` when it reads no finder; `provision.connect` for a
  child's bridge is `not_claimed`, and the owner's app calls the child and reads the child's
  `events` for the `connected` or `connect_failed` that ends it. A device heard by two boxes
  on one network may be listed by one child while the other's bridge holds it; taking it twice is
  the owner's choice, as configuring two engines for one device is today.
- **Levels over children.** A meta-applier's Safe claim covers its own safety rules; a child's
  sockets, loads and caps are that child's, configured on it. A meta-applier MUST NOT claim Safe
  while a child that owns a `socket` claims only Act (GA-META-11).
- **Safety stays nearest the devices.** A safety rule whose devices all belong to one child is that
  child's; `configure` on the meta-applier MUST refuse it. A safety rule whose devices span children
  is hosted by the meta-applier, which then MUST fire it with no client connected, as GA-SAFE-1;
  `configure` MUST refuse such a rule if it actuates a device of a child whose `ungoverned` is not
  empty, or whose `clients` holds anyone but the meta-applier, since either could undo it; and when
  such a child's model later changes that way, the meta-applier MUST disable the rule and send a
  notice (GA-META-3).
- **Basis passes through.** A step's `real` or `emulated` comes from the child unchanged
  (GA-META-4).
- **No cycles.** Registering a child through `configure` MUST be refused with `cycle` if the child's
  `applier_id`, or any id in its `descendants`, is the meta-applier's own (GA-META-5).
- **Delegation.** To apply to a child's devices, the meta-applier plans on the child and applies
  that plan, passing each action's `via`, `brain` and `for` unchanged. It MUST verify each token
  itself before delegating, and MUST re-issue it under its own key as that child's client, with the child's device id as `target`, itself as `issuer`, a new
  `proof`, a `token_id` derived from the original's `issuer` and `token_id`, and as `args` the
  arguments it actually delegates, without `from` where it leaves `from` out for that child
  (*`from`*), every other field unchanged, `expires` included (GA-META-10), so that the token
  matches the delegated step and the child does not refuse it (GA-TOKEN-2). The original token is
  recorded used, as GA-TOKEN-4, when the delegated step is dispatched, so a replay of it at the
  meta-applier is `refused(token)`. Its check and its record are one step, as GA-TOKEN-4 requires
  of any applier: from verifying a token until the child's outcome says whether the delegated step
  was dispatched, the meta-applier holds it, so a second apply presenting the same token meanwhile
  is `refused(token)` there; a step the child did not dispatch releases it. The derived `token_id`
  keeps two clients' tokens that share a `token_id` apart at the child, where both would carry the
  meta-applier as `issuer`, and makes any second delegation of one token the same token there,
  which the child dispatches at most once. Its idempotency key on the child is derived from the originating client's
  id, that client's idempotency key and the child's `applier_id`, so that two clients never
  collide.
- **Relay and correlation.** The meta-applier MUST relay every later `outcome`, `state`, `late_ack`,
  `liveness`, `rule_fired`, `latch`, `model`, `route_conflict`, `provision`, `freshness`,
  `transport`, `other_admins`, `bridge_fault`, `occurrence` and `undescribed` event a child reports for a device
  it exposes, and carry each child's unacknowledged notices in its own `notices`, with their
  `notice_id` prefixed `<child applier_id>/`, sending `notice_taken` to the child only after its
  own client has sent it; and list its children's held latches, prefixed the same way, in its own
  `state`. A
  child event caused by the meta-applier's own delegation MUST carry the meta-applier's apply as its
  cause and MUST NOT be reported as `external`; a child's safety rule id is reported as
  `<child applier_id>/<rule id>` (GA-META-8).
- **Around the side.** A change made on a child directly reaches the meta-applier with cause
  `external`, and the meta-applier MUST relay it as `external` and MUST NOT undo it (GA-META-6).
- **Child liveness.** The meta-applier polls each child's `events` with `wait_s` of at most 5. A
  child is dead when a call to it has gone 10 s without an answer, or its connection is refused; its
  devices then read `dead` within 1 s, and live again on the child's next answer. A call held open
  within its `wait_s` is not silence (GA-META-7).

## Bridges

The applier's side of `standard/bridge.md`'s MQTT binding. The topics, payloads and the bridge's
own floors are there; these are the applier's. The applier connects with MQTT 5, whatever its
bridges speak.

- **Liveness.** A bridge is dead 30 s after its last `status`, at once when its will arrives on
  `lwt`, or on a graceful `offline` (GA-STATE-2). A will whose `instanceId` is not the one in the
  bridge's latest `status` is ignored: it comes from a process already gone. A graceful `offline`
  makes the bridge's devices `dead` all the same, but raises no `bridge_fault`: it was planned. The
  bridge's derived `state` (`degraded`, or `offline` without `graceful`) says only how many of its
  devices are observable, and is not its death. An empty retained `lwt` is the bridge clearing its will, not a death. A `status` without `v`
  (as a bridge written for an earlier binding sends until it meets the bridge standard), with a `v` the applier does not
  know, or naming a `bridgeId` other than the `{b}` of its topic, MUST be taken as a `bridge_fault`,
  and the bridge's devices read `dead` until a valid `status` arrives live, so every step on them
  plans `skip(dead)` (GA-BUS-14).
- **An ack's source.** An ack whose `source` is not the `bridgeId` of the bridge whose topic it
  arrived on MUST be taken as a `bridge_fault`, and not as an ack: the step waits as if none came
  (GA-BUS-13).
- **One identifier, two bridges.** An adopted device keeps its bridge: the same
  `stable_identifier` reported by another bridge MUST be a separate, unadopted device, with a
  `route_conflict` event naming both bridges, never merged into the adopted one; only where neither
  is adopted is it one device whose steps are `refuse(duplicate_route)`, as GA-META-2, until
  `configure` routes it (GA-BUS-11). A new device from the same bridge that shows the
  `stable_identifier` of a device the applier holds for that bridge, in its `devices` document or
  evicted from it (GA-BRIDGE-35), is a `route_conflict` event too, so the
  owner sees that a dead device and an unadopted arrival are one piece of hardware; it is also a
  notice with cause `route_conflict`, which says that adopting the arrival with `replaces` naming
  the dead device restores its rules. A legacy Zigbee device that rejoins under the well-known
  link key arrives this way (`standard/bridge.md`, *Provisioning*). A staged plugin device is the
  exception (GA-BUS-15).
- **A staged version.** A device whose bridge declares `stagedFor` shows the `stable_identifier`
  of the installed version's device it names, and is no collision: when `stagedFor` names a plugin
  device on the same bridge, hosted by the same computer, with a `stable_identifier` equal to the
  staged device's own, compared whole, its host's identifier included, the applier MUST NOT raise a `route_conflict` event or notice for it; any
  other `stagedFor` exempts nothing, and the device is a `route_conflict` as any other, so a PC's
  bridge cannot claim a Zigbee valve's identifier unseen. For an exempt device the applier MUST
  instead issue a notice with cause `plugin_update` naming the plugin, its new version and its staged devices, once per staged
  version, kept as a safety notice is (GA-BUS-15). The owner's app shows what changed between the
  two manifests. The match is on the manifest's own, unsigned `id` (*Plugins*).
- **The broker is the floor under the gate.** A command on the broker reaches a bridge whoever sent
  it, so an applier's claim over bridges holds only on a box that passes GA-BOX-1. The owner states
  it through `configure` (`box: true`), `describe` shows it as `box`, and an applier with bridges
  MUST NOT claim Safe without it (GA-DESC-6). The applier MUST refuse `box: true` while its own
  connection to the broker is plain TCP off loopback, which it can see (GA-DESC-6). The rest of
  the claim is the owner's word, resting on the box's recorded checks (GA-BOX-2); the applier does
  not probe the broker itself, since it subscribes to no command topic (GA-BUS-9). Below Box, a bridge may speak MQTT 3.1.1, and a
  publish the broker refuses it is dropped where no one can see it; and clients may authenticate
  by password over plain TCP on the local network, where anyone who reads it can publish as the
  applier. Both are reasons Safe needs `box`.
- **A fault that names a device.** An entry in a bridge's `faults` that names an adopted device (a
  lock with no PIN, GA-BRIDGE-36) MUST also be a notice with cause `bridge_fault` naming the device,
  raised once while the entry stands (GA-BUS-12). An event alone reaches no one.
- **Parsing.** The applier MUST parse the retained `devices` document and the roster entry by
  entry, and a message field by field, so that one bad entry or field drops only itself (GA-BUS-1). A roster entry dropped for a bad field
  is not the device leaving: the device keeps its last facts and goes `stale` by its bound.
  A deployed fleet's roster once went silent for four days over one device that failed validation.
- **A fast clock.** A `basis_time` or `last_check_in` more than 5 s (⚠️ a guess) ahead of the
  applier's own clock MUST be treated as a bridge fault, and the value as of unknown age: the
  device reads `stale` until a correctly stamped report arrives. A live `status` whose `publishedAt`
  is more than 5 s ahead of or behind its arrival is a bridge fault too, so a slow clock, the
  bridge's or the applier's, is named rather than making every device `stale` or every command
  `expired` (GA-BUS-2). A bridge cannot catch its own clock's skew.
- **Open vocabularies.** An enumerated value the applier does not know MUST be taken as the least it
  can mean, never as a reason to reject the message (GA-BUS-3).
- **No reissue inside the bound.** The applier MUST NOT reissue a command inside its
  `result_within_s`; with no ack, the step waits until `result_within_s` and ends as the outcomes
  say for no ack, taking an ack that arrives within the 1 s after it all the same, since a bridge on
  MQTT 3.1.1 counts the time from receipt; a `received` ack changes nothing (GA-BUS-4). A deployed dispatcher re-sent after 1 s
  and ran commands two and three times. A reissue after the bound uses a fresh `command_id`.
- **Commands and requests are never retained, and carry their Message Expiry.** The applier MUST
  publish every command and request unretained, a command with a Message Expiry of its
  `result_within_s` and every other request with 10 s (GA-BUS-5). The broker enforces it for a
  bridge on either MQTT version.
- **Duplicates.** An event whose `(instanceId, seq)` the applier has already seen, a QoS 1
  duplicate, MUST be ignored, and so MUST a second terminal ack for a `command_id` it has already
  had one for; a `received` ack is not terminal, and never counts as the first (GA-BUS-6).
- **Gaps.** On a gap in an event's `seq`, an `instanceId` it has not seen, in an event or in a
  `status` arriving live, or its own reconnection,
  the applier MUST send `snapshot`, and raise from the re-sent `devices` any notice it missed: an
  unadopted device or a new other admin it had not seen (GA-BUS-6); a plugin with no device left
  in a `devices` document parsed whole that still lists its host is taken as uninstalled
  (GA-PROV-4).
- **Losing the broker.** While the applier's own connection to the broker is down, every device
  behind a bridge MUST read `dead`, so nothing is planned as if it could be sent (GA-BUS-7).
- **Coming back.** A bridge found dead for any reason (its status stale, its will, a graceful
  `offline`), and every bridge after the applier reconnects to the broker, MUST count as live only
  on a `status` that arrives live after that, never on a retained one delivered on subscribing, and
  whose `publishedAt` is no earlier than the death, on the applier's clock, less 5 s (GA-BUS-2's
  tolerance), so a `status` queued before the death does not revive it. A `status` that does not
  revive the bridge changes nothing (GA-BUS-8). Staleness is judged on the applier's own clock, from when the latest `status`
  arrived.
- **Dispatch.** A command is dispatched when the broker acknowledges it with a success code: the
  step is `dispatched`, and its token used. A PUBACK of `0x10` (no subscriber: the bridge is between
  connections) or `0x87` (not authorised) MUST make the step `unreachable` with the token unused,
  and `0x87` is also a fault event. A connection lost before any PUBACK leaves the step
  `dispatched`, the token used, and the command MUST NOT be re-sent after reconnecting; it is judged
  as if no ack came (GA-BUS-9). Where a reader's subscription matches a command topic, as `#` does
  below Box, the broker never answers `0x10`, and a command to a bridge that is away ends as if no
  ack came.
- **Freshness from observation.** The applier MUST NOT derive a value's age or a device's liveness
  from when a message arrived; only from the value's `basis_time` and the device's `last_check_in`
  (GA-BUS-10).
- **Loading.** The applier subscribes with Retain Handling 0, so that the retained `status`, `lwt`,
  `devices` and every device's status load when it connects. It MUST subscribe only to the topics
  it reads, never to a filter that matches a `command` or `request/` topic, so that a publish to a
  bridge that is away is answered `0x10` (GA-BUS-9).

## The MCP binding

The one normative binding for clients and children; bridges have `standard/bridge.md`'s MQTT binding.

- **Transport:** MCP over Streamable HTTP, at protocol revision `2026-07-28`
  (`https://modelcontextprotocol.io/specification/2026-07-28`). One MCP server per applier. The
  applier MUST serve that revision to every caller: its clients, the owner's configuration
  credential, and a meta-applier whose child it is (GA-BIND-1). It MAY also answer `2025-06-18` and
  `2025-11-25`, and no other revision. A meta-applier MUST reach each child at `2026-07-28` where
  the child serves it, and MAY fall back to `2025-06-18` or `2025-11-25` only for a child that does
  not (GA-BIND-3); the steward is held to the same (`standard/steward.md`, GA-BIND-2). Any other
  client SHOULD use `2026-07-28` and MAY fall back likewise. A client learns whether a server serves
  `2026-07-28` by its `server/discover` request, and falls back only as that revision's specification
  describes for a server that does not. So a client that uses `2026-07-28` reaches every conforming
  applier, and one on another revision reaches it only where the applier answers that revision. A
  change of the pinned revision is not an addition in the sense of *Compatibility*: the version that
  makes it says so. At every revision the applier checks the bearer credential on every request
  (GA-AUTH-3), and every connection to it, at any revision, and a meta-applier's to its children,
  MUST use TLS, with the server's certificate validated, unless both ends are on the same host's
  loopback interface (GA-SEC-1). Bridges' connections are `standard/bridge.md`'s.
- **Tools:** one per operation, named exactly as the operation. Each tool's input and output schema
  is the operation's JSON Schema.
- **Annotations:** `describe`, `state`, `plan`, `outcome`, `events`, `history` and `candidates`
  carry `readOnlyHint: true`; `apply`, `configure` and `provision` carry `destructiveHint: true`. No gate depends on
  them.
- **Errors:** a request error is a tool result with `isError: true` and a body
  `{ error: code, message, data? }`, `data` holding the structured details a requirement names
  (GA-SAFE-14; `standard/steward.md`, GA-DEF-12).
- **Authentication:** a bearer credential per client, registered through `configure`.
- **Token proof:** HMAC-SHA256, with the key registered for the client, over the token without its
  `proof` field serialised by the JSON Canonicalization Scheme (RFC 8785); `proof` is the MAC in
  base64url without padding.
- **Events:** by the `events` tool's long-poll, not by MCP notifications.
- **The harness's clock:** under the harness, `configure` accepts `time_source`, an NTP server the
  harness runs, and the subject takes all time from it, elapsed time included: the harness moves
  time forward by stepping that clock, and the subject honours the step (GA-HARN-1). Outside the
  harness, `configure` refuses `time_source`.

## Constants

| Constant | Value | Where |
|---|---|---|
| Plan expiry | 60 s | *Planning changes nothing* |
| Apply synchronous bound | 500 ms for ≤ 20 targets, plus 300 ms per meta-applier hop | GA-APPLY-1 ⚠️ proposed, not measured; a SHOULD until measured |
| Ack bound, defaults | 10 s for `session.lock` and otherwise; 30 s for `media.launch`; 60 s for a valve; 90 s for a cover, gate or garage door; 240 s for `power.wake`, a cold boot and a plugin server's 120 s start bound | GA-APPLY-8, GA-APPLY-13 ⚠️ guesses. Declared per action; the harness uses the declared value |
| Late verdict tolerance | 1 s | GA-APPLY-8, GA-WIT-1 |
| Late ack window | 60 s | GA-APPLY-11 |
| Idempotency key retention | 3600 s, per client, and for the owner's `provision` | GA-APPLY-4, GA-PROV-3 |
| Event retention | 3600 s | GA-EVT-4 |
| History retention | 7 days | GA-EVT-5 |
| `events` long-poll | ≤ 30 s | *Events and history* |
| Heating load cap, default | 14400 s | GA-LOAD-2 ⚠️ a guess. Declared per socket; the harness uses the declared value |
| Token expiry skew | 5 s | GA-TOKEN-2 |
| Meta-applier poll on a child | ≤ 5 s | GA-META-7 |
| Child dead after | 10 s unanswered | GA-META-7 |
| Bridge dead after | 30 s without a `status`, or its will, or a graceful `offline` | GA-STATE-2; a deployed fleet's |
| `fresh_slack_s` for a bridged device | 11 s | GA-STATE-5; the bridge's 10 s status interval, a deployed fleet's, and 1 s for delivery |
| `fresh_slack_s`, per meta-applier hop | 6 s | GA-STATE-5; GA-META-7's 5 s poll and 1 s |
| Safety notice grace after a planned reload or broker loss | 60 s | GA-SAFE-10 ⚠️ a guess |
| Reload loop window | 10 min | GA-SAFE-10 ⚠️ a guess |
| Fast-clock tolerance | 5 s | GA-BUS-2 ⚠️ a guess |
| Provisioning reply awaited | 2 s from the publish | GA-PROV-1 |
| A `connect` ended `lost` after | 70 s from the applier's publish | GA-DISC-4 ⚠️ the bridge's 60 s and a margin |
| `activate` re-sent while its bridge stays live | at least every 60 s until an `ok` | GA-ADOPT-4 ⚠️ a guess |
| `dead` reported within | 1 s of detection | GA-STATE-2, GA-STATE-3, GA-META-7, GA-BUS-7 |

## Requirement index

Ids are stable: one that changes level or is withdrawn keeps its id. `Verify` says how the harness
checks it: `wire` against a running applier, `static` against its `describe` output.

| Id | Level | Conf. | Verify | Requirement |
|---|---|---|---|---|
| GA-DESC-1 | MUST | Act | wire | `describe` returns the device model valid against its schema, with `standard_version`, `levels` and `revision` |
| GA-DESC-2 | MUST | Act | wire | `revision` changes on every model change and never on a state change |
| GA-DESC-3 | MUST | Act | static | Every action on every device declares a tier no lower than the default table gives, loads, gate classes, `infrastructure` power, a computer's shutdown and extension actions included; `configure` only raises it, except an extension action, which it may lower to its floor, the higher of its `requested_tier` (where it has one) and the highest tier any row naming the device's class, a flag or its load gives any action (`reversible` where none names it), `no_voice` on a `door_lock`, `water_valve`, `gas_valve`, `gate` or `garage_door` and on a device whose `host` is a computer with `infrastructure: true`, and no lower (ruling 5); a computer with `proposed_infrastructure` takes the `infrastructure: true` rows until the owner sets the flag either way; a standard action on a hosted device takes the higher of its own row and its host's `infrastructure: true` or `computer` row for that action |
| GA-DESC-4 | MUST | Act | static | Every action on every device declares idempotency; `notify`, `media.announce`, `power.shutdown` and `media.launch` are never idempotent, and an extension action is not idempotent unless the owner declared it so at adoption, whatever its bridge or manifest says |
| GA-DESC-5 | MUST | Act | static | Every `matter`, `zigbee` or `zwave` device declares `stable_identifier` |
| GA-DESC-6 | MUST | Safe | static | An adapter lists in `ungoverned` every way its engine changes a device unseen (not checked by the harness); an applier claiming Safe has an empty `ungoverned` of its own, and a path a bridge declares counts as its own; a child's is listed under that child; over bridges, it claims Safe only with `describe.box` true, which it refuses while its own broker connection is plain TCP off loopback |
| GA-DESC-7 | MUST | Act | static | Every `ir` device declares `feedback: open` |
| GA-DESC-8 | MUST | Safe | static | An applier claiming Safe declares a `load` on every `socket`, and treats one never configured as `heating` |
| GA-DESC-9 | MUST | Act | static | A device's `self_changing` and `personal` hold every key this standard declares so (every computer key `self_changing`; `app`, `camera_in_use`, `microphone_in_use` and `speech` `personal` on every device that reports them, and a computer's session keys; a player's `playing`, `title` and `started_at`, and `speech` on every device that reports it, `self_changing`) and every key its bridge declares so, and `internal` every device its bridge declares so; `configure` adds to them and never removes one of these, except a key a plugin's manifest declares `self_changing` |
| GA-DESC-10 | MUST | Act | wire | `configure` refuses a `wake_via` naming a device that is not adopted, does not offer `power.wake`, or belongs to another applier than the computer, and a `forget` of a device a `wake_via` names; a computer declares `power.wake` exactly while it has a `wake_via`, the applier adding it with its default tier and `ack_within_s` and removing it |
| GA-DESC-11 | MUST | Act | wire | When a replacement changes an action's tool hash, argument schema or `requested_tier`, a tier the owner set for it below what its formula gives without the owner's value is dropped, and the action falls back to the formula until the owner sets it again; a tier the owner raised is kept; a replacement that lowers an action's `requested_tier` keeps the tier it had, as the owner's, until the owner deletes that value; the tool hash compared is the action's `tool_hash`, kept across restarts |
| GA-DESC-12 | MUST | Act | static | An adapter maps an engine's entity to `power` or `session` only through its allowlist by the agent's model and `unique_id` pattern, lists the rest of what the engine can do to a computer in `ungoverned`, and maps no entity that runs arbitrary commands to any capability; whether the allowlist holds is not checked by the harness |
| GA-DESC-13 | MUST | Act | wire | A `configure` change of a device's `load` or `infrastructure` re-applies *Default tiers* to its actions, and a computer's `infrastructure` to the actions of the devices it hosts, extension and standard, in the same change set, raising every tier now below its new floor to that floor; a tier at or above it is kept |
| GA-DESC-14 | MUST | Act | wire | `configure` refuses an extension action's tier below its floor (*Default tiers*) with `invalid_request`, nothing changed, never clamping it to the floor |
| GA-DESC-15 | MUST | Act | wire | An owner's `idempotent: true` on a plugin's extension action falls back to `false` when a replacement changes the action's tool hash |
| GA-DESC-16 | MUST | Act | wire | A plugin device's replacement keeps in `personal` every key an earlier version's manifest declared so, and in `self_changing` every such key the owner has not removed, a removal standing across replacements until the owner adds the key again |
| GA-DESC-17 | MUST | Act | wire | A computer's `session.lock` declares `account`'s `args` as the tokens its `accounts` lists, so a step naming any other token, a retired one included, is `refuse(invalid_args)` in a plan and never dispatched |
| GA-DESC-18 | MUST | Act | wire | A bridge's `devices` that changes a known device's declarations (`standard/bridge.md`, *Declarations and settings*) is a model change with a `model` event naming the device; an undispatched step whose action's declarations changed is `refused(declaration_changed)`; a dispatched action keeps its dispatch-time outcome rules and is re-sent only where old and new both say idempotent; an owner's `idempotent: true` and a tier the owner lowered on a changed action fall back |
| GA-DESC-19 | MUST | Act | wire | A bridge's device carries its bridge's `awaitedKeys`, `undescribed` and `settings` in `describe` as `awaited_keys`, `undescribed` and `settings`, a meta-applier's too, and relays the bridge's `undescribed` event as its own, once per name, a name it first meets in a `devices` it receives (live, or the retained one at connect) announced too, and which names it has announced kept across restarts; a change to `awaited_keys` or `settings` is a model change, as one of `sensor_keys` is, and a change to `undescribed` alone moves no revision |
| GA-STATE-1 | MUST | Act | wire | Every state value carries the basis time of its observation, never the time of the response |
| GA-STATE-2 | MUST | Act | wire | A bridged device reads `dead` within 1 s of its bridge going 30 s without a `status`, its will on `lwt`, or a graceful `offline`, its transport going `down`, the applier losing the broker, the bridge reporting it `available: false`, or its leaving `devices` or the roster or its retained status being cleared |
| GA-STATE-3 | MUST | Act | wire | An adapter calls its engine at least every 5 s; an engine 10 s unanswered or refusing connection makes every device it exposes `dead` within 1 s, live again when it answers; a device the engine has not yet loaded after its restart is `dead` until it has; a `computer` the engine marks unavailable is `dead`, not `stale` |
| GA-STATE-4 | MUST | Act | wire | A `feedback: open` device's state is `assumed`, marked `assumed: true` wherever the applier gives it, and changes when an action ends `sent` or `unanswered`, never when one ends `unreachable` or `failed`; it is `live` while its bridge is alive and its transport `up` or `unknown`; any action on it ends `sent`, `failed(reason)` or `unanswered`, never `acked` or `failed(no_ack)`; it is never `already`; a computer's `power.wake` sent through one ends as GA-APPLY-13 says |
| GA-STATE-5 | MUST | Act | wire | A device past its effective `fresh_s` reads `stale` no later than 1 s after its `fresh_s` plus its `fresh_slack_s` (11 s for a bridged device), and MAY from its `fresh_s`, and one whose `fresh_s` is not known reads `stale`; an adapter gives a bound for every `occupancy` sensor or it reads `stale`; an adapter exposes an engine's sensor as `occupancy` only where its engine or the owner (`configure`) says it sees a person keeping still, and otherwise as `motion`; an adapter's `computer` whose engine's availability the adapter reads is `live` while the engine marks it available, with no time bound, and one whose availability it cannot read is refused adoption until the owner sets its `fresh_s` |
| GA-STATE-6 | MUST | Act | wire | An owner-set `fresh_s` is the effective bound, over a declared one or none |
| GA-AUTH-3 | MUST | Act | wire | A request from a client not registered through `configure`, or whose registration a `configure` has removed, is `not_permitted`, at every MCP revision and whatever session it arrives in |
| GA-TOKEN-1 | MUST | Act | wire | A `confirm` or `no_voice` action without a token is `refuse(token)` in a plan and `refused(token)` on apply |
| GA-TOKEN-2 | MUST | Act | wire | A token for another target, action, args, `via`, `brain` or `for`, expired past the skew, expiring more than 300 s ahead, already used, issued by another client, or not verifiable with the sending client's key counts as no token |
| GA-TOKEN-3 | MUST | Act | wire | A `no_voice` action with `via: voice` or `brain: true` is `refuse(tier)`, with or without a token |
| GA-TOKEN-4 | MUST | Act | wire | A token is used only when its action is dispatched, and stays used whatever outcome follows; it is dispatched at most once, even by applies running at once; a used `(issuer, token_id)` is remembered until a persisted deadline 3600 s after use |
| GA-PLAN-1 | MUST | Act | wire | `plan` changes nothing: state and events are identical before and after |
| GA-PLAN-2 | MUST | Act | wire | One step per distinct target, action, args, `via`, `brain`, `for` and token; an unknown target is `skip(unknown_target)`, never an error |
| GA-PLAN-3 | MUST | Act | wire | Each step says `real` or `emulated` |
| GA-PLAN-4 | MUST | Act | wire | When several reasons apply, the first in the fixed order is reported; for `power.wake` on a computer, `dead` is its `wake_via` device's, `already` is the computer being `live`, and `already` is evaluated before `dead`, at plan and at dispatch |
| GA-PLAN-7 | MUST | Act | wire | Steps are dispatched in request order, within each child for a meta-applier |
| GA-PLAN-8 | MUST | Act | wire | An action declared `toggles: true` on a `feedback: open` device is never dispatched without a token for its step: without one the step is `refuse(toggle_only)`, after `already` and before `token`; a token whose `for` names a `rule`, or a `run` with neither a `person` nor an `endpoint`, is taken as none for it; on a `feedback: closed` device such an action is planned from its observed state, with no `toggle_only`; it is declared `idempotent: false` |
| GA-APPLY-1 | SHOULD | Act | wire | Apply's synchronous response returns within 500 ms for up to 20 targets, plus 300 ms per meta-applier hop |
| GA-APPLY-2 | MUST | Act | wire | An expired plan, one made at an older revision, or one made by another client is a request error; nothing is dispatched |
| GA-APPLY-4 | MUST | Act | wire | A repeated idempotency key from the same client, with the same body apart from tokens, within 3600 s returns the first apply and dispatches nothing |
| GA-APPLY-5 | MUST | Act | wire | A `dead` target is `unreachable`, never `dispatched`, except a computer's `power.wake`, which is `unreachable` only when its `wake_via` device is `dead`; a bridge's `failed(unreachable)` or `failed(expired)` after dispatch is reported `unreachable` within 1 s |
| GA-APPLY-6 | MUST | Act | wire | No reissue on ack timeout for an action the device declares non-idempotent, counted in physical actuations, not command ids |
| GA-APPLY-7 | MUST | Act | wire | A stateless action on a `feedback: closed` device ends `delivered` (for an adapter's device, on the engine's word that it sent the command), `sent` where the action is declared `confirms: false`, or `failed`, never `acked`, except `power.wake` (GA-APPLY-13); a `sent` for any action declared `confirms: true`, stateful or stateless, is a `bridge_fault` event |
| GA-APPLY-8 | MUST | Act | wire | A `dispatched` action on a `feedback: closed` device with no other final outcome within its `ack_within_s` becomes `failed(no_ack)`, reported within 1 s after, or within 1 s of its bridge, engine or child being found dead while the step still waits (for `power.wake`, the `wake_via` device's, until that device's terminal ack, and after it none), a bridge's `failed(no_confirmation)` being no final outcome; the first final outcome wins |
| GA-APPLY-9 | MUST | Act | wire | Apply re-evaluates `not_adopted`, `dead`, `safety`, `latched`, `already`, `toggle_only` (reported `refused(toggle_only)`), the token and a changed declaration (reported `refused(declaration_changed)`, GA-DESC-18) at dispatch, for `op` steps and steps planned `skip(already)`; for a computer's `power.wake`, `dead` is its `wake_via` device's |
| GA-APPLY-10 | MUST | Act | wire | A repeated idempotency key with a different body is `idempotency_conflict`; nothing is dispatched |
| GA-APPLY-11 | MUST | Act | wire | A device report matching an action that ended `failed(no_ack)` within 60 s is a `late_ack` with that apply as cause, never `external`; so is a report matching a `session.lock` that ended `failed(not_locked)`, within its `ack_within_s` |
| GA-APPLY-12 | MUST | Act | wire | `power.wake` on a computer is dispatched to its `wake_via` device, planned and dispatched while the computer is `dead`, `skip(dead)` or `unreachable` only when the `wake_via` device is `dead`, and `already` on a `live` computer |
| GA-APPLY-13 | MUST | Act | wire | A `power.wake` step is `acked` when the computer is `live` and each adopted hosted device live at its death is live on a `last_check_in` other than the one it held at the death, or reported `available: false` in a status received since, a hosted device not yet checked in since being waited for, within `ack_within_s`, else `failed(no_ack)`; on a computer `stale` at dispatch, dispatch stands for the death, the computer's own `last_check_in` included, so the step is `acked` on its next check-in that makes it `live`; the `wake_via` device's final ack or its silence only moves it along, and its `failed(unreachable)` or `failed(expired)` ends it `unreachable`, any other `failed` or `unsupported` as itself |
| GA-APPLY-14 | MUST | Act | wire | A `notify` without `from` is accepted; `from` is sent in the command's value only when the request carries it and only to a device whose `notify` declaration lists `from` among its `args`, and left out for any other; a meta-applier passes it to a child only when the child's `standard_version` is 0.10 or later and the child's device lists it, and leaves it out otherwise |
| GA-APPLY-15 | MUST | Act | wire | The `detail` of the terminal ack taken for a step is carried in that step's final outcome and its `outcome` event, whatever the outcome, which it never changes |
| GA-APPLY-16 | MUST | Act | wire | A command for an action declared `whole_state: true` carries in `state` the device's assumed value of every key the applier holds one for, across a restart too, each key's value being the one the latest earlier action on the device sets, from any apply, once dispatched and unless it ended `failed` or `unreachable`, otherwise the assumed value, the action's own key carrying the value it asks for; no step waits for another to build it; when such a command ends `sent` or `unanswered`, every key it carried becomes assumed |
| GA-EVT-1 | MUST | Act | wire | Every state change the applier did not make, other than a `self_changing` key, appears with cause `external`; a report moving towards a dispatched action's value, until it matches or `ack_within_s` passes, is that apply's, after a `failed(no_confirmation)` or `failed(not_locked)` ack too; the key `session.lock` sets is its argument's `session.<account>` |
| GA-EVT-2 | MUST | Act | wire | Every change event carries a cause; `history` returns the same causes in order |
| GA-EVT-3 | MUST | Act | wire | `acked` arrives only after the device's reported state matches within its tolerance, on the key the action sets (for `session.lock`, its argument's, matched by `locked`, `disconnected` or `none`; for an extension action, its `confirmed_by`); `media.launch` and `power.wake` are acked only as GA-EVT-7 and GA-APPLY-13 say |
| GA-EVT-4 | MUST | Act | wire | Events are kept at least 3600 s; an older cursor is `cursor_expired` |
| GA-EVT-5 | MUST | Act | wire | `history` returns state, outcome, `late_ack`, liveness, `route_conflict`, `rule_fired`, `latch`, `model`, `provision`, `freshness`, `transport`, `other_admins`, `bridge_fault` and `occurrence` events with their causes, kept at least 7 days, a `state` event's `speech` key and an `occurrence` of a key in the device's `personal` excepted, which are kept in `events` only |
| GA-EVT-6 | MUST | Act | wire | A change of a key the device declares `self_changing` has cause `device`, except a report GA-EVT-1 gives to a dispatched action on a key that action sets, which carries that apply's cause |
| GA-EVT-7 | MUST | Act | wire | `media.launch` is `acked` only on a report received after dispatch in which `playing` is `true` and `started_at` differs from the value held at dispatch, or is present where none was held; it is never `already` |
| GA-EVT-8 | MUST | Act | wire | Each occurrence a bridge publishes is one `occurrence` event; it is never a state value, never returned by `state`, never the match of `already` or `acked`; `configure` refuses a safety rule that reads it with `invalid_request`; the event moves no liveness or freshness, while the check-in that carried it moves `last_check_in` |
| GA-LVL-1 | MUST | Act | wire | An operation, or a `configure` change, above the claimed level returns `not_claimed` |
| GA-CFG-1 | MUST | Act | wire | Only the owner's configuration credential may `configure` |
| GA-CFG-2 | MUST | Act | wire | `configure` with `dry_run` changes nothing; at a stale revision it returns `stale_revision`, except for a change set of only `ignore_candidate` and `unignore_candidate`; a change set applies whole or not at all |
| GA-CFG-3 | MUST | Act | wire | `configure` refuses an `ack_within_s` below 2, below twice a device's `reach_s` plus 10, or above 300, a `max_on_s` above 86400, or an `applier_host` set on a device that is not a `computer` or on a second computer while another holds it |
| GA-SEC-1 | MUST | Act | wire | Every connection to an applier, at any MCP revision, and a meta-applier's to its children, uses TLS with the server certificate validated, unless both ends are on one host's loopback |
| GA-BIND-1 | MUST | Act | wire | The applier serves MCP protocol revision `2026-07-28` to every caller, the owner's configuration credential included; it answers no revision but that one, `2025-06-18` and `2025-11-25` |
| GA-HARN-1 | MUST | Act | wire | Under the harness, the subject takes all time, elapsed time included, from the harness's `time_source`; outside it, `time_source` is refused |
| GA-PERSIST-1 | MUST | Act | wire | Configuration, idempotency keys with outcomes, or with the `requestId` and result of a `provision`, used tokens, latches, unacknowledged notices, heating on-times, assumed states, incomplete safety rules, ack deadlines, the id map, retired identifiers, adoption state, `ignored_keys`, the bridges' last `connections`, the last `basis_time` per safety-read key, which of a computer's hosted devices were live at its death and the `last_check_in` each held then, each plugin action's `tool_hash`, each GA-PROV-4 plugin tombstone, the `undescribed` names announced per device (GA-DESC-19), and whether each adopted plugin version's `activate`, a cancelling one included, has had its `ok` survive a restart |
| GA-SAFE-1 | MUST | Safe | wire | A safety rule fires with no client connected |
| GA-SAFE-2 | MUST | Safe | wire | From firing until complete, a request for a device a safety rule actuates is `refuse(safety)`; nothing refuses or undoes the rule's action |
| GA-SAFE-3 | MUST | Safe | wire | A safety rule is complete once each actuation has a final outcome: `acked`, `delivered`, `sent`, `unanswered`, `failed`, `unreachable`, `skipped` or `refused`, with no GA-SAFE-12 re-send pending |
| GA-SAFE-5 | MUST | Safe | wire | A safety rule issues each non-idempotent actuation once, with no reissue |
| GA-SAFE-6 | MUST | Safe | wire | `configure` refuses a safety rule the applier does not own every device of, that one of its children owns entirely, or that actuates a device with another admin or `other_admins: unknown` without `accepts_other_admins: true`; the `os` entries, or the `unknown`, of a computer whose `infrastructure` is true, a proposal included, count as another admin of every device a safety rule actuates, not as `ungoverned`, except on a computer the owner marks `applier_host`, whose entries count only for it and its hosted devices, and one added to it, or its `applier_host` cleared, is an `other_admin` notice for each such rule without `accepts_other_admins` |
| GA-SAFE-7 | MUST | Safe | wire | A latch clears only on reported values, never on an `assumed` one; while a latch is held, any action changing a key the rule set, and any extension action on a device the rule actuated, is `refuse(latched)`; after, until it next runs, its tier is `no_voice` and its token's `for` has a `person` |
| GA-SAFE-8 | MUST | Safe | wire | A notice with an id is issued when the rule completes, saying each final outcome, and at once when an actuation waits for GA-SAFE-12's re-send; it stays in `notices` until `notice_taken` names it, channel or not; a `failed` actuation's later `late_ack` gets a second notice |
| GA-SAFE-9 | MUST | Safe | wire | A `latch` event is emitted when a latch is set and when it clears; `state` lists held latches |
| GA-SAFE-10 | MUST | Safe | wire | A device a safety rule reads or actuates that stops being live, is live again, or has no known `fresh_s` when the rule is configured or the device adopted, or is given an owner `fresh_s` longer than the declared one, is a notice, a graceful bridge reload or a broker loss only after 60 s, unless it is that bridge's second within 10 min; a newer one for the same rule and device replaces an untaken older one |
| GA-SAFE-11 | MUST | Safe | wire | A safety rule fires once per trigger becoming true, on any new report (a `basis_time` later than the last seen, a fast-clock value never setting it) whatever the device's liveness, never on an `assumed` value, which holds none of its conditions, not again while it runs or is latched; `configure` refuses two safety rules setting one key of one device differently |
| GA-SAFE-12 | MUST | Safe | wire | While a safety rule's latch is held, or its trigger's condition is true on the latest reported values, an actuation that did not land is sent again by its final outcome: after `skipped(dead)`, `unreachable` or a `failed` saying it was not carried out, any action once its device is not `dead`; after `failed(no_ack)`, an idempotent one while the device's latest report does not match; after `unanswered`, an idempotent one once more; never after `refused` or a `failed` for an unsupported, invalid or unknown target; one attempt in flight, spaced by `ack_within_s`, except at once on the device's return from `dead`; the rule is not complete while a re-send is pending |
| GA-SAFE-13 | MUST | Safe | wire | No actuation of the applier's own (a cap's turn-off, a safety rule's action or re-send, a retry) sends an action declared `toggles: true`; `configure` refuses a safety rule with such an action and a `load: heating` on a socket whose `onoff.turn_off` is one; on a declaration change a safety rule that no longer passes is disabled with a `rule_disabled` notice, and a cap that cannot act is a `load_cap` notice; a socket with such a turn-off and no configured load is a `load_cap` notice at adoption |
| GA-SAFE-14 | MUST | Safe | wire | `configure` refuses, with `invalid_request` and changing nothing, a safety rule, latch or witness that reads a key its device does not declare, its `data` `{ key, device, awaited }`, `awaited` true where the device's `awaited_keys` lists the key; on a declaration change a safety rule, latch or witness that then reads an undeclared key is disabled with a `rule_disabled` notice naming the key |
| GA-LOAD-2 | MUST | Safe | wire | A `heating` load on continuously for `max_on_s`, counted across restarts, on a `feedback: open` socket from the first `onoff.turn_on` the applier sends that ends `sent` or `unanswered` until an `onoff.turn_off` ends `sent`, is turned off by the applier itself with cause `load_cap` and no client, retried while the socket is not `dead` until it reports `off` (on an open socket, until one ends `sent`), a turn-off declared `idempotent: false` sent once; a failed turn-off is a notice |
| GA-WIT-1 | MUST | Safe | wire | A witnessed action reports `confirmed`, `unconfirmed`, or `unknown` when its sensor was not live, within 1 s after `within_s` counted from dispatch; a witness configured over a sensor with no known `fresh_s`, or whose sensor is given an owner `fresh_s` longer than the declared one, is a notice |
| GA-META-1 | MUST | Meta | wire | `describe` is the union of the children's; a device with a stable identifier is `sid:<its oldest identifier>`, one declared by a device key `key:<key>`, both kept across a re-route and a replacement; a retired identifier, or one a child's other device already holds, never mints a `sid:`; others are namespaced by child |
| GA-META-2 | MUST | Meta | wire | One oldest identifier under two children without a route: steps `refuse(duplicate_route)` and one `route_conflict` event; once routed, one device |
| GA-META-3 | MUST | Meta | wire | A safety rule within one child's devices is refused at the meta-applier; one spanning children is hosted there and fires with no client connected, unless a child it actuates has a non-empty `ungoverned` or another client, which is refused at `configure` and disables the rule with a notice later |
| GA-META-4 | MUST | Meta | wire | `real` / `emulated` passes through from the child unchanged |
| GA-META-5 | MUST | Meta | wire | Registering a child whose id or descendants include the meta-applier's own id is refused with `cycle` |
| GA-META-6 | MUST | Meta | wire | A change made on a child directly is relayed as `external` and not undone |
| GA-META-7 | MUST | Meta | wire | Children are polled with `wait_s` ≤ 5; a call unanswered 10 s or a refused connection reads `dead` within 1 s; a quiet child answering empty stays live |
| GA-META-8 | MUST | Meta | wire | A child's outcome, state, `late_ack`, liveness, `rule_fired`, `latch`, `model`, `route_conflict`, `provision`, `freshness`, `transport`, `other_admins`, `bridge_fault`, `occurrence` and `undescribed` events and its notices are relayed; those caused by the meta-applier's delegation carry its own cause, never `external` |
| GA-META-9 | MUST | Meta | wire | The meta-applier's `revision` changes whenever a child's does |
| GA-META-10 | MUST | Meta | wire | The meta-applier verifies each token before delegating, holding it from verification until the child's outcome, so a second apply with it meanwhile is `refused(token)`, re-issues it under its own key for the child, `expires` unchanged, its `args` those actually delegated and its `token_id` derived from the original's `issuer` and `token_id`, and records the original used when the delegated step is dispatched |
| GA-META-11 | MUST | Meta | static | A meta-applier does not claim Safe while a child owning a `socket` claims only Act |
| GA-BIND-3 | MUST | Meta | wire | A meta-applier reaches each child at MCP protocol revision `2026-07-28` where the child serves it, and falls back, to `2025-06-18` or `2025-11-25` only, for a child that does not |
| GA-ADOPT-1 | MUST | Act | wire | A device new to the applier is `adopted: false` until the owner adopts it; every action on it is `refuse(not_adopted)` in a plan and `refused(not_adopted)` at apply; `configure` refuses a safety rule that reads or actuates it, and a `forget` of a device still in its bridge's `devices` or named by a safety rule |
| GA-ADOPT-2 | MUST | Act | wire | `adopt` with `replaces` keeps the replaced device's `id`, declarations and safety rules, for a plugin device only the declarations the owner set, its manifest's being the new version's; the old identifier goes to `previous_identifiers` and never takes the id back; a new device lacking an action or key they use, or under another child, is refused, except that a plugin device's replacement may lack an action no safety rule uses |
| GA-ADOPT-3 | MUST | Act | wire | A device with an action above `reversible` and another admin, or `other_admins: unknown`, is a notice with cause `other_admin` at adoption, the tier judged before the same change set lowers it, whenever an admin is added, and once for each such adopted device when the applier starts supporting adoption; its becoming `[]` is a notice that replaces an untaken earlier one |
| GA-ADOPT-4 | MUST | Act | wire | The applier sends a plugin's bridge `activate { plugin, version }` when the owner adopts the first device of that version, for a version with staged devices only on an adoption with `replaces`, never for a version with no adopted device, and again each time the bridge is found live and at least every 60 s while it stays live, until an `ok`; a `failed(unknown_plugin)` is a notice with cause `bridge_fault` naming the version's adopted devices, once until an `ok`; any `activate` that will remove an adopted device of another version of the plugin on that host, not replaced in the same change set, staged version or not, is preceded by a notice with cause `plugin_update` naming each such device; an adoption whose `activate` would remove a device a safety rule names, not replaced in the same change set, is refused with `invalid_request`, nothing changed |
| GA-ADOPT-5 | MUST | Act | wire | An adoption of a staged plugin device with `replaces` is pending until the swap (the old version's devices leave the bridge's `devices`): until then the old device keeps the `id`, its declarations and its rules, and the new device stays unadopted; if before the swap the bridge reports the new device `available: false` after publishing it `available: true` following its `ok` to the `activate`, or names it in a `faults` entry of code `pin_mismatch`, `crash_loop` or `account_deleted`, never on a status from before the `ok`, the pending adoption is dropped, a notice with cause `plugin_update` names both devices, the old device stays as it was, and an `activate` naming the old device's version, which cancels the new version's, is sent and re-sent as GA-ADOPT-4's until an `ok`, with no further `activate` of the new version; if the old devices leave before that `ok`, the adoption takes effect as at any swap, with a `plugin_update` notice, and the cancel's `failed(unknown_plugin)` is no `bridge_fault` |
| GA-ADOPT-6 | MUST | Act | wire | Adopting a device on an `unknown` transport, an adopted device's transport first reading `unknown`, and `configure` of a safety rule actuating a device on one are each a notice with cause `open_loop` naming it, saying that nothing will show if it stops working |
| GA-DISC-1 | MUST | Act | wire | A candidate is never a device: no step names one, nothing is planned on it, and it reaches the model only through a bridge's `devices` and adoption |
| GA-DISC-2 | MUST | Act | wire | `candidates` answers only the owner's configuration credential, gives the finder's latest `sources` and `faults`, and lists every candidate sharing no key with `ignored_keys` nor with the `connections` last seen, and kept across a restart, on a device or transport of any bridge registered with this applier, live or dead, offering only this applier's live bridges that can take it; an adapter answers `finder: none`; no event reveals a candidate |
| GA-DISC-3 | MUST | Act | wire | `ignore_candidate` adds the candidate's keys to `ignored_keys`, hiding every candidate that shares one, across restarts of the applier and the finder and changes of address, until `unignore_candidate` removes the key; an `id` not listed, or a key not in `ignored_keys`, is `invalid_request`; neither is a model change |
| GA-DISC-4 | MUST | Act | wire | `provision.connect` goes only to a bridge of this applier whose latest `status` claims Provision and gives a `bridgeType` the candidate matches with `connect: true`, with the `address` the owner gave; otherwise `not_claimed`; `unreachable` for such a bridge that is dead; the bridge's `connect` carries that `address` and the candidate's `keys`; `invalid_request` for a candidate not listed, or an `address` missing where the candidate has one, or not the candidate's; a `connect` with no end within 70 s of its publish, or whose bridge dies, ends `connect_failed(lost)`, and a `connected` after it is still issued; both events carry the `request_id` `provision` returned, `unreachable` included |
| GA-DISC-5 | MUST | Act | wire | The finder is dead 30 s after its last `status`, at once on its will (one naming the latest `status`'s `instanceId`) or a graceful `status`, or on a `status` without a known `v`, which is no `bridge_fault`; a `publishedAt` more than 5 s off its arrival is `clock` in `finder_faults`; live again only as GA-BUS-8 says; a dead finder's last list is shown marked `finder: dead` |
| GA-PROV-1 | MUST | Act | wire | `provision` is the owner's configuration credential's only, is passed to the bridge that owns the transport, device or host, or for `connect` the bridge it names, returns `unreachable` with no reply within 2 s, and is `not_claimed` against an adapter or a bridge without the level the operation needs: Host for `install` and `uninstall`, Provision for the rest |
| GA-PROV-2 | MUST | Act | wire | A closed join window is a notice with cause `window_closed` naming every device that joined, kept until taken |
| GA-PROV-3 | MUST | Act | wire | For each `provision` `idempotency_key` the applier keeps, persisted, the `requestId` it sent and what came of it (the reply, `accepted` on an event carrying that `requestId`, or `unreachable`, updated by a later reply or event); a repeat within 3600 s with the same body, bodies compared as their RFC 8785 serialisations without the key, never byte for byte, is answered from that record and never sent to a bridge again; a different body is `idempotency_conflict`, nothing sent |
| GA-PROV-4 | MUST | Act | wire | On `uninstalled`, on the `accepted` reply to the applier's own `uninstall`, or when no device of an adopted plugin is left in its host's bridge's `devices` parsed with no entry dropped and still listing the host, every device of that plugin on that host is forgotten (model, id map, `activate` record), so a later install's devices arrive unadopted, on `accepted` a named exception to `forget`'s refusal of a device still in `devices`, except, without the event, a device a safety rule names, kept `dead`, and a forgetting without the event is a notice with cause `plugin_update` naming the plugin; any `wake_via` naming a forgotten device is cleared first, with a `plugin_update` notice naming the computer; an `uninstall` while a safety rule names one of them is refused with `invalid_request`, nothing sent; forgotten on `accepted`, a tombstone for the plugin and host, kept across a restart, until `uninstalled`, `failed(unknown_plugin)` or a counting `devices` without them, makes the applier ignore the plugin's devices in any `devices` publish or snapshot, with no GA-BUS-6 notice for them |
| GA-BUS-1 | MUST | Act | wire | The retained `devices` document is parsed entry by entry and a message field by field; a bad entry or field drops only itself |
| GA-BUS-2 | MUST | Act | wire | A `basis_time` or `last_check_in` more than 5 s ahead of the applier's clock is a bridge fault, and the device reads `stale` until a correctly stamped report; a live `status` whose `publishedAt` is more than 5 s from its arrival, either way, is a bridge fault |
| GA-BUS-3 | MUST | Act | wire | An unknown enumerated value from a bridge is taken as the least it can mean, never a reason to reject the message |
| GA-BUS-4 | MUST | Act | wire | No command is reissued inside its `result_within_s`; with no terminal ack, a `received` included, the step waits until `result_within_s`, or its bridge is found dead, then ends as the outcomes say |
| GA-BUS-5 | MUST | Act | wire | A command or request is never published retained; a command carries a Message Expiry of its `result_within_s`, any other request 10 s |
| GA-BUS-6 | MUST | Act | wire | A `seq` gap, an `instanceId` not seen before or the applier's reconnection sends `snapshot`, and missed notices are raised from it; an event with an `(instanceId, seq)` already seen, or a second terminal ack for one `command_id`, is ignored; a `received` ack is not terminal |
| GA-BUS-7 | MUST | Act | wire | While the applier has lost the broker, every bridged device reads `dead` |
| GA-BUS-8 | MUST | Act | wire | A bridge found dead for any reason, and every bridge after the applier reconnects, is live again only on a `status` arriving live after that whose `publishedAt` is no earlier than the death less 5 s, a `status` that does not revive changing nothing, never on a retained one delivered on subscribing; a will whose `instanceId` is not the latest `status`'s is ignored; a graceful `offline` makes its devices `dead` but raises no `bridge_fault` |
| GA-BUS-9 | MUST | Act | wire | Dispatch is a success PUBACK; `0x10` or `0x87` is `unreachable` with the token unused, and `0x87` a `bridge_fault` event; a connection lost before PUBACK is `dispatched`, and the command is never re-sent; the applier never subscribes to a filter matching a `command` or `request/` topic |
| GA-BUS-10 | MUST | Act | wire | A value's age is judged from its `basis_time` and a device's liveness from its `last_check_in`, never from a message's arrival; only the bridge's own liveness is judged from its `status`'s arrival (GA-STATE-2) |
| GA-BUS-11 | MUST | Act | wire | An adopted device keeps its bridge: its identifier under another bridge is a separate unadopted device with a `route_conflict` event, never merged; only with neither adopted, steps `refuse(duplicate_route)` until routed; the same identifier twice under one bridge is a `route_conflict` event too, except a staged plugin device (GA-BUS-15) |
| GA-BUS-12 | MUST | Act | wire | A bridge `faults` entry naming an adopted device is a notice with cause `bridge_fault` naming it, once while the entry stands |
| GA-BUS-13 | MUST | Act | wire | An ack whose `source` is not the `bridgeId` of the bridge whose topic carried it is a `bridge_fault`, and not an ack |
| GA-BUS-14 | MUST | Act | wire | A `status` without `v`, with an unknown `v`, or naming another `bridgeId` than its topic's is a `bridge_fault`, and the bridge's devices read `dead` until a valid `status` arrives live |
| GA-BUS-15 | MUST | Act | wire | A device whose bridge declares `stagedFor` naming a plugin device on the same bridge and host with an equal `stable_identifier`, compared whole, raises no `route_conflict` event or notice, after its version's activation too, and any other `stagedFor` exempts nothing; an exempt device's staged version is one notice with cause `plugin_update`, kept until taken |

## Withdrawn requirements

- GA-SAFE-4: withdrawn in 0.6, replaced by GA-SAFE-8; a notice handed up is no longer dropped when no
  one takes it.
- GA-GRP-2: withdrawn in 0.6; exclusive groups were never defined, and groups move to the steward.
- GA-OCC-2: withdrawn in 0.6; the steward has one level, so "below Full" no longer exists.

Moved to `standard/steward.md` in 0.6, with their ids: GA-AUTH-1, GA-PLAN-5, GA-PLAN-6, GA-APPLY-3,
GA-TIER-1, GA-TIER-2, GA-TIER-3, GA-GRP-1, GA-SCN-1 to GA-SCN-7, GA-LEASE-1 to GA-LEASE-5, GA-DEF-1
to GA-DEF-4, GA-SCHED-1, GA-OCC-1.

## Conformance

A claim of conformance at a level is a run of the conformance harness against the applier in which
every requirement at or below that level, and every `Meta` requirement for an applier with children,
is `pass`. A SHOULD is reported, never failed.

- The harness drives the subject through the MCP binding, acting as its steward, at revision
  `2026-07-28` where the subject serves it, and otherwise at `2025-11-25` or `2025-06-18` if the
  subject answers one, against a simulated
  home it controls: devices behind simulated bridges on a real broker, speaking
  `standard/bridge.md`'s binding through their test transports (GA-BRIDGE-16), a clock the subject MUST
  take from it (GA-HARN-1), an actor that changes state behind the applier's back, a gate on a
  momentary relay declared non-idempotent and slower to ack than any reissue window, a socket
  declared `infrastructure`, a socket with a `heating` load, and an IR device. For the PC text it
  adds a simulated PC's bridge at Host, with a computer, accounts and the harness's test plugins, and
  a simulated wake relay (`standard/bridge.md`, *Conformance*). For an adapter, it
  also runs a simulated engine it can stop and slow, which can expose a computer; for GA-PERSIST-1 it restarts the subject
  through a hook the subject's packaging provides.
- **The harness refuses a subject that is not attached to its simulation.** Each run mints a run id
  and gives the simulated home that id, in every simulated bridge's status as `test_run_id` and in
  the simulated engine's greeting; a subject whose `describe.test_run_id` does not show it is
  refused before any test runs, so the harness cannot actuate a real home.
- The harness counts physical actuations on the simulated devices, not command ids, wherever a
  requirement is about what happened.
- The harness ships **negative subjects**, each built to break named requirements. Each must fail
  those, and may also fail only the requirements listed beside it below, each for the reason given.
  A requirement whose negative subject passes is disarmed, and the run fails.
- A run that cannot start its simulation reports no requirement and exits non-zero.
- For *Discovery*, the harness plays the finder: it publishes `status` and `candidates` on the
  simulated box's broker, with keys that some simulated bridges list in `connections` and some do
  not.

### Negative subjects

| Subject | Breaks | May also fail | Why those |
|---|---|---|---|
| `plans-with-side-effect` | GA-PLAN-1 | — | |
| `speaks-only-2025` | GA-BIND-1 | — | It answers only `2025-11-25`, through its `initialize` handshake, statelessly; the harness, as a client may, falls back to it, so nothing else fails |
| `session-outlives-revocation` | GA-AUTH-3 | — | A client reaches it at `2025-11-25` in a session, the owner removes the client, and a later request in that session is served |
| `meta-calls-a-child-at-2025` | GA-BIND-3 | — | A meta-applier subject reaches a simulated child that serves `2026-07-28` through the `2025-11-25` handshake |
| `reissues-on-timeout` | GA-APPLY-6 | GA-SAFE-5 | A safety rule's actuation goes through the same dispatch |
| `fails-a-wake-at-the-relay-ack` | GA-APPLY-8 | GA-APPLY-13 | After the relay's `sent`, the subject ends the wake `failed(no_ack)` at once, since the computer's bridge is dead |
| `never-fails-a-silent-ack` | GA-APPLY-8 | GA-APPLY-11, GA-SAFE-2, GA-SAFE-3, GA-SAFE-8, GA-SAFE-12 | A `late_ack` needs the `failed(no_ack)` first; a safety rule waits on the same outcome, and its `refuse(safety)` window with it |
| `no-late-ack-for-a-slow-lock` | GA-APPLY-11 | — | A simulated computer acks a `session.lock` `failed(not_locked)`, then reports the key `locked` within its `ack_within_s`, and no `late_ack` event comes |
| `acks-without-state` | GA-EVT-3 | — | |
| `lock-fails-on-logout` | GA-EVT-3 | — | The simulated computer answers a `session.lock` by reporting the account's key `none`, a logout, and the step ends `failed(no_ack)` |
| `externalises-a-late-lock` | GA-EVT-1 | — | The simulated computer acks a `session.lock` `failed(not_locked)` and reports the account's key `locked` 3 s later, inside the step's `ack_within_s`, and the subject reports it with cause `external` |
| `applies-without-token` | GA-TOKEN-1 | GA-TOKEN-2, GA-APPLY-9, GA-META-10, GA-SAFE-7 | Every token check is the same check |
| `trusts-any-token` | GA-TOKEN-2 | GA-TOKEN-1, GA-APPLY-9, GA-META-10 | As above |
| `lets-a-client-undo-safety` | GA-SAFE-2 | GA-SAFE-7 | A latch is the same refusal after the rule completes |
| `leaves-heat-on` | GA-LOAD-2 | — | |
| `actuates-both-routes` | GA-META-2 | — | |
| `acts-unadopted` | GA-ADOPT-1 | GA-APPLY-9 | Apply re-evaluates the same check |
| `replaces-without-rules` | GA-ADOPT-2 | — | |
| `hides-a-second-door` | GA-ADOPT-3 | — | |
| `hides-a-door-behind-a-lowered-tier` | GA-ADOPT-3 | — | The owner adopts a plugin device with another admin and lowers its only extension action to `reversible` in the same change set, and no `other_admin` notice comes |
| `provisions-for-anyone` | GA-PROV-1 | — | |
| `hides-new-devices` | GA-PROV-2 | — | |
| `resurrects-an-uninstalled-plugin` | GA-PROV-4 | GA-ADOPT-1 | The harness uninstalls and reinstalls a plugin whose devices were adopted, and they come back adopted |
| `resurrects-after-a-lost-uninstall` | GA-PROV-4 | GA-ADOPT-1 | As above, with the `uninstalled` event dropped and a snapshot's `devices` without the plugin's devices |
| `resurrects-before-the-snapshot` | GA-PROV-4 | GA-ADOPT-1 | The harness drops the `uninstalled` after an `accepted` `uninstall`, and reinstalls the same version from another package before any snapshot, and the devices come back adopted |
| `forgets-on-a-bad-entry` | GA-PROV-4 | — | The simulated bridge's `devices` carries every device of an adopted plugin as a malformed entry, and the subject forgets the plugin |
| `forgets-unseen` | GA-PROV-4 | — | The simulated bridge's `devices`, parsed whole and still listing the host, no longer carries an adopted plugin's devices, and the subject forgets them with no `plugin_update` notice naming the plugin |
| `forgets-a-wake-path-device` | GA-PROV-4 | — | A computer's `wake_via` names an adopted plugin device, the plugin is uninstalled, and the subject forgets the device with the `wake_via` still naming it |
| `readmits-an-uninstalling-plugin` | GA-PROV-4 | — | After the `accepted` reply to the applier's `uninstall`, the simulated bridge re-publishes `devices` still listing the plugin's devices, and before `uninstalled` the subject lists them again or raises a notice for them |
| `provisions-twice` | GA-PROV-3 | — | An `install` whose reply the harness drops, repeated with its key after the bridge's 10 s window, reaches the simulated bridge again |
| `live-before-known` | GA-STATE-5 | — | |
| `unavailable-computer-reads-stale` | GA-STATE-3 | — | The simulated engine marks a computer it exposes unavailable, and the subject reports it `stale`, not `dead` |
| `reuses-token-after-late-unreachable` | GA-TOKEN-4 | GA-TOKEN-2 | A reused token is also one already used |
| `one-bad-entry-silences` | GA-BUS-1 | — | |
| `trusts-a-fast-clock` | GA-BUS-2 | GA-STATE-5, GA-SAFE-11 | A value of unknown age that reads `live` is past no bound it can show |
| `ignores-owner-bound` | GA-STATE-6 | GA-STATE-5 | The device reads by the wrong bound |
| `gives-up-on-dead` | GA-SAFE-12 | GA-SAFE-3, GA-SAFE-8 | It counts the rule complete, and sends no waiting notice |
| `floods-reload-notices` | GA-SAFE-10 | — | A graceful reload of a safety device's bridge gives a notice at once |
| `silent-on-liveness` | GA-SAFE-10 | — | A safety device that stays dead past 60 s gives no notice |
| `resends-what-may-have-run` | GA-SAFE-12 | GA-SAFE-5 | A non-idempotent actuation that ended `failed(no_ack)` is sent again |
| `merges-a-claimant` | GA-BUS-11 | GA-ADOPT-1 | The claimant inherits the adopted device's id |
| `rejects-unknown-kind` | GA-BUS-3 | — | |
| `reissues-inside-the-bound` | GA-BUS-4 | GA-APPLY-6 | A reissued non-idempotent command is also a reissue on timeout |
| `retains-request` | GA-BUS-5 | — | |
| `ignores-seq-gap` | GA-BUS-6 | — | |
| `plans-through-broker-loss` | GA-BUS-7 | GA-APPLY-5, GA-STATE-2 | A device that should be `dead` gets `dispatched` |
| `trusts-retained-online` | GA-BUS-8 | GA-STATE-2 | Its devices read live behind a bridge that is not |
| `resends-after-reconnect` | GA-BUS-9 | GA-APPLY-6 | A re-sent non-idempotent command actuates twice |
| `fresh-by-arrival` | GA-BUS-10 | GA-STATE-5 | A late-arriving old value reads `live` |
| `swallows-device-fault` | GA-BUS-12 | — | |
| `hides-awaited-keys` | GA-DESC-19 | — | The subject's `describe` leaves out the test bridge's device's `awaitedKeys` |
| `drops-the-undescribed-event` | GA-DESC-19 | — | The subject relays no `undescribed` event for a name the test bridge announces |
| `accepts-a-safety-rule-on-an-undeclared-key` | GA-SAFE-14 | — | A frost rule on `temperature` of a sensor that declares none is accepted |
| `trusts-a-foreign-ack` | GA-BUS-13 | GA-APPLY-8 | The step ends on an ack another bridge sent |
| `plans-for-a-faulted-bridge` | GA-BUS-14 | GA-APPLY-5 | A step on a device behind a `status` with no `v` is dispatched |
| `accepts-a-cycle` | GA-META-5 | — | |
| `delegates-a-token-with-from` | GA-META-10 | — | A meta-applier subject delegates a `notify` raised to `confirm` and carrying `from` to a simulated child whose `standard_version` is 0.8; the step leaves `from` out, the re-issued token's `args` carry it, and the child refuses it `refused(token)` |
| `reissues-under-a-fresh-id` | GA-META-10 | GA-TOKEN-4 | Two applies presenting one token at once: the subject delegates both, under two `token_id`s, and both actuate; letting the second past its own check is GA-TOKEN-4's failure too |
| `drops-a-standard-declaration` | GA-DESC-9 | — | The subject leaves a computer's session keys out of `self_changing` |
| `drops-a-plugins-camera` | GA-DESC-9 | — | A test plugin's device reports `camera_in_use` without its manifest declaring it `personal`, and the subject leaves it out of `personal` |
| `drops-a-plugin-declaration` | GA-DESC-16 | — | A replacement's manifest no longer declares `personal` a key the old version did, and the subject drops it from `personal` |
| `offers-no-wake` | GA-DESC-10 | GA-APPLY-12 | A computer given a `wake_via` lists no `power.wake`, so its wake is never dispatched |
| `wakes-through-anything` | GA-DESC-10 | — | `configure` takes a `wake_via` naming an unadopted relay entry |
| `forgets-a-wake-path` | GA-DESC-10 | — | `configure` takes a `forget` of a `left` relay entry that a computer's `wake_via` names |
| `wakes-across-appliers` | GA-DESC-10 | — | A meta-applier's `configure` takes a `wake_via` for its own computer naming a child's relay entry |
| `lowers-by-a-new-manifest` | GA-DESC-11 | — | A replacement's manifest requests `confirm` for an action the old one requested at `no_voice`, the owner set nothing, and the subject declares it `confirm` |
| `keeps-a-lowered-tier` | GA-DESC-11 | — | A replacement whose tool hash changed keeps the owner's lowered tier |
| `forgets-a-tool-hash` | GA-DESC-11 | GA-PERSIST-1 | The harness restarts the subject between a plugin version's adoption and its replacement by a version whose tool changed, and the owner's lowered tier is kept |
| `maps-a-shell` | GA-DESC-12 | — | The simulated engine offers an agent's command entity, and the subject maps it |
| `extension-under-the-box` | GA-DESC-3 | GA-DESC-13 | The owner sets `infrastructure` on a computer hosting a test plugin's device whose extension action requests `reversible`, and the action's tier stays below `no_voice`; not re-deriving it in the change set is GA-DESC-13's failure too |
| `lowers-a-lock-extension` | GA-DESC-14 | — | `configure` sets a `door_lock` plugin device's extension action to `confirm`, and the subject accepts it, or clamps it to `no_voice`, instead of refusing it `invalid_request` |
| `sleeps-the-box-through-its-player` | GA-DESC-3 | — | A test plugin's device hosted by an `infrastructure` computer offers `power.shutdown` requesting `reversible`, and the subject declares it below `no_voice` |
| `sleeps-the-proposed-broker-host` | GA-DESC-3 | — | A simulated PC bridge's computer carries `proposedInfrastructure`, the owner has not set `infrastructure`, and the subject declares its `power.sleep` below `no_voice` |
| `trusts-a-plugins-idempotent` | GA-DESC-4 | GA-APPLY-6 | A test plugin's manifest declares an extension action `idempotent: true`, the owner adopts it without declaring it, and the subject lists it idempotent; a reissue on its word is GA-APPLY-6's failure too |
| `keeps-an-idempotent-over-a-new-tool` | GA-DESC-15 | GA-APPLY-6 | The owner declares a test plugin's extension action idempotent at adoption, a replacement changes its tool hash, and the subject still lists it idempotent; a reissue on it is GA-APPLY-6's failure too |
| `restores-a-removed-self-changing` | GA-DESC-16 | — | The owner removes a key a test plugin's manifest declares `self_changing`, and after a replacement whose manifest still declares it the subject lists it in `self_changing` again |
| `removes-a-plugin-personal` | GA-DESC-9 | — | `configure` removes a key a test plugin's manifest declares `personal`, and the subject accepts it |
| `keeps-a-tier-below-a-new-load` | GA-DESC-13 | GA-DESC-3 | The owner changes a socket's `load` from `lighting` to `heating`, and its `onoff.turn_on` stays `reversible`, a tier below the table |
| `skips-a-sleeping-computer` | GA-APPLY-12 | GA-PLAN-4, GA-APPLY-5, GA-APPLY-9 | A dead computer's wake is `skip(dead)`, which is the same reason judged at plan and at dispatch |
| `skips-a-live-wake-as-dead` | GA-PLAN-4 | GA-APPLY-12 | A `live` computer's `wake_via` device is `dead`, and its `power.wake` is `skip(dead)`, not `already`; GA-APPLY-12 names the computer's `already` too |
| `acks-a-wake-on-the-packet` | GA-APPLY-13 | GA-APPLY-7, GA-STATE-4 | The step ends on the relay's `sent`, which is the open device's outcome given to the computer |
| `acks-a-wake-before-the-player` | GA-APPLY-13 | — | The simulated PC bridge comes back with a hosted player that was live at the computer's death and whose `last_check_in` is still the one from before it, within its bound, and the subject acks the wake |
| `never-acks-a-stale-wake` | GA-APPLY-13 | — | A computer is `stale` at a wake's dispatch, checks in again within the bound, its hosted devices checking in too, and the step ends `failed(no_ack)` |
| `sends-from-to-an-old-bridge` | GA-APPLY-14 | — | A simulated bridge whose `notify` does not list `from` gets it in the command's value |
| `sends-from-to-an-old-child` | GA-APPLY-14 | — | A meta-applier subject delegates a `notify` carrying `from` to a simulated child whose `standard_version` is 0.8, and the child's apply carries `from` |
| `drops-the-ack-detail` | GA-APPLY-15 | — | A simulated bridge acks a plugin step `failed(no_confirmation)` with a `detail`, and the step's `failed(no_ack)` outcome carries none |
| `acks-launch-on-old-item` | GA-EVT-7 | GA-EVT-3 | A report of `playing` with the `started_at` held at dispatch acks the launch |
| `activates-on-a-new-key` | GA-ADOPT-4 | — | Adopting a staged version's device without `replaces` sends `activate` |
| `activates-once` | GA-ADOPT-4 | — | The simulated bridge drops the first `activate` and stays live, and no `activate` follows within 60 s |
| `evicts-a-safety-device` | GA-ADOPT-4 | — | The owner adopts a device of a plugin's new version while a safety rule names a device of the old version that the change set does not replace, and the subject accepts the adoption |
| `evicts-without-a-word` | GA-ADOPT-4 | — | The owner adopts a device of a plugin's new version that shares no key with the old one, whose devices are adopted, and `activate` is sent with no `plugin_update` notice naming them before it |
| `evicts-a-sibling-without-a-word` | GA-ADOPT-4 | — | The owner adopts one staged device of a two-device plugin with `replaces`, the other old device being adopted, and `activate` is sent with no `plugin_update` notice naming the other before it |
| `repoints-before-the-swap` | GA-ADOPT-5 | — | The owner adopts a staged device with `replaces`, the new version's test plugin has not yet served, and a step on the old device's id is sent to the new device, or the old device's rules move to it |
| `keeps-a-failed-swap` | GA-ADOPT-5 | — | The owner adopts a staged device with `replaces`, the new version's test plugin fails its file check, and the subject issues no `plugin_update` notice, or the id does not stay with the old device |
| `leaves-a-failed-swap-pending` | GA-ADOPT-5 | — | The owner adopts a staged device with `replaces`, the new version's test plugin fails its file check, and the subject sends no `activate` naming the old version, so a later start of the new server swaps the old device out |
| `drops-on-a-stale-status` | GA-ADOPT-5 | — | After `activate`'s `ok`, a snapshot re-publishes the new device's retained `available: false` from before it, with no `faults` entry, and the subject drops the pending adoption |
| `locks-a-retired-account` | GA-DESC-17 | — | The simulated computer retires the token `liza`, and a `session.lock { account: liza }` is dispatched instead of `refuse(invalid_args)` |
| `ignores-the-broker-hosts-admins` | GA-SAFE-6 | — | A simulated PC bridge's computer carries `proposedInfrastructure` and an administrator entry, and `configure` takes, without `accepts_other_admins`, a safety rule actuating a valve behind another bridge |
| `marks-two-applier-hosts` | GA-CFG-3 | GA-SAFE-6 | `configure` sets `applier_host` on a second simulated PC bridge's computer while the first still holds it, and on a plug, and the subject accepts both |
| `counts-the-applier-hosts-admins` | GA-SAFE-6 | — | A simulated PC bridge's computer carries `proposedInfrastructure` and an administrator entry, the owner marks it `applier_host`, and `configure` refuses, without `accepts_other_admins`, a safety rule actuating a valve behind another bridge that has no other admin |
| `conflicts-on-a-staged-version` | GA-BUS-15 | GA-BUS-11 | A staged device raises a `route_conflict` event, which GA-BUS-11 now exempts |
| `conflicts-on-a-sibling` | GA-BUS-15 | GA-BUS-11 | After one device of a two-device plugin is adopted with `replaces`, the other new device, whose old device has left, raises a `route_conflict` |
| `trusts-a-foreign-staging` | GA-BUS-15 | GA-BUS-11 | A simulated PC bridge declares on a new device a `stagedFor` naming nothing it hosts, with another bridge's adopted valve's `stable_identifier`, and the subject raises no `route_conflict`, which GA-BUS-11 requires |
| `plans-on-a-candidate` | GA-DISC-1 | — | The harness's finder announces a candidate whose keys match no device, and a step names it |
| `shows-candidates-to-a-client` | GA-DISC-2 | — | A steward's `candidates` is answered, or a candidate's `keys`, `address` or `hints` appear in `events` |
| `forgets-an-ignore` | GA-DISC-3 | — | The ignore is lost on a restart, or the candidate is shown again at a new address |
| `connects-to-the-wrong-bridge` | GA-DISC-4 | GA-PROV-1 | `connect` is sent to a bridge whose type the candidate's `matches` do not name with `connect: true` |
| `trusts-a-dead-finder` | GA-DISC-5 | — | The finder's `status` stops, and `candidates` still says `live` |
| `hides-the-finders-sources` | GA-DISC-2 | — | The finder's `status` gives DHCP `off`, and `candidates` does not say so |
| `event-without-request-id` | GA-DISC-4 | — | A `connected` or `connect_failed` event carries no `request_id`, or another request's |
| `never-ends-a-connect` | GA-DISC-4 | — | The bridge replies `accepted` and falls silent, and no `connect_failed(lost)` comes within 70 s |
| `ignores-the-address` | GA-DISC-4 | — | The harness's finder moves the candidate's address between `candidates` and `provision.connect`, and the applier sends the new one |
| `lists-a-held-candidate` | GA-DISC-2 | — | A candidate shares a key with a dead bridge's device, and is listed |
| `kills-a-mute-transmitters-devices` | GA-STATE-4 | — | An IR air conditioner on an `unknown` transport of a live bridge reads `dead`, and its step is `unreachable` |
| `toggles-to-reach-a-state` | GA-PLAN-8 | — | An IR TV's `onoff.turn_off`, declared `toggles: true`, is dispatched with no token |
| `answers-a-toggle-by-rule` | GA-PLAN-8 | — | A step on the same TV's `onoff.turn_off` whose valid token's `for` names a rule is dispatched |
| `asks-a-closed-loop-toggle` | GA-PLAN-8 | — | A `feedback: closed` socket's `onoff.turn_off`, declared `toggles: true` and observed `on`, is planned `refuse(toggle_only)` |
| `refuses-a-panel-toggle` | GA-PLAN-8 | — | A step on the IR TV's `onoff.turn_off` whose valid token's `for` names a `run` with an `endpoint` and no `person` is refused `toggle_only` |
| `toggles-by-safety-rule` | GA-SAFE-13 | — | `configure` accepts a safety rule whose action is the IR TV's `onoff.turn_off` |
| `toggles-a-cap-off` | GA-SAFE-13 | — | `configure` sets `load: heating` on a socket whose `onoff.turn_off` is declared `toggles: true`, and the subject accepts it |
| `keeps-a-rule-on-a-re-taught-code` | GA-SAFE-13 | — | The simulated bridge re-declares a socket's `onoff.turn_off`, which a safety rule sends, `toggles: true`, and the rule later sends it, or no notice with cause `rule_disabled` comes |
| `adopts-an-uncappable-socket-quietly` | GA-SAFE-13 | — | The owner adopts a socket whose `onoff.turn_off` is declared `toggles: true`, with no load configured, and no notice with cause `load_cap` comes |
| `never-caps-a-silent-heater` | GA-LOAD-2 | — | A `heating` socket declared `feedback: open`, turned on by a step that ended `sent`, is not turned off `max_on_s` later |
| `retries-a-pulse-off` | GA-LOAD-2 | — | A `heating` socket's `onoff.turn_off`, declared `idempotent: false`, ends `failed(no_ack)` as a cap turn-off and is sent again |
| `assumes-a-failed-write` | GA-STATE-4 | — | A write to the IR air conditioner's transmitter fails, the step ends `unreachable`, and its assumed `mode` reads the command's |
| `fires-on-an-assumed-value` | GA-SAFE-11 | — | A safety rule whose trigger reads the IR air conditioner's `mode` fires on the value assumed from its last command |
| `clears-a-latch-on-an-assumed-value` | GA-SAFE-7 | — | A latch whose condition reads the IR air conditioner's `mode` clears on the value assumed from a command |
| `upgrades-a-mute-device-quietly` | GA-ADOPT-6 | — | An adopted IR air conditioner's transport first reads `unknown` after its bridge's upgrade, and no notice with cause `open_loop` comes |
| `sends-a-bare-setpoint` | GA-APPLY-16 | — | After a restart, `climate.set_setpoint 22` on an IR air conditioner declared `whole_state: true`, last sent `mode: cool`, is published with no `mode` in its `state` |
| `sends-the-old-mode` | GA-APPLY-16 | — | With the first command's ack held back until the second is published, two applies a second apart, `climate.set_mode cool` then `climate.set_setpoint 22`, on an IR air conditioner declared `whole_state: true`, last sent `mode: off`, and the setpoint's command carries `mode: off` |
| `keeps-a-failed-mode` | GA-APPLY-16 | — | `climate.set_mode cool` ends `unreachable`, and the next `climate.set_setpoint 22` carries `mode: cool` |
| `forgets-the-unanswered` | GA-STATE-4 | — | `climate.set_setpoint 22` on that air conditioner ends `unanswered`, and `state` still gives the setpoint from before it |
| `forgets-what-the-frame-said` | GA-APPLY-16 | GA-STATE-4 | The setpoint's frame goes out carrying an in-flight `mode: cool` and ends `sent`; `set_mode cool` then ends `failed`, and the next frame carries `mode: off` |
| `adopts-a-mute-device-quietly` | GA-ADOPT-6 | — | The owner adopts an IR air conditioner on an `unknown` transport, and no notice with cause `open_loop` comes |
| `re-checks-no-toggle` | GA-APPLY-9 | GA-PLAN-8 | A plan made with a token for the IR TV's `reversible` `onoff.turn_off` is applied after the token expired, and the step is dispatched, which also sends a toggle with no token |
| `stores-an-occurrence-as-state` | GA-EVT-8 | — | The simulated bridge publishes an occurrence of a sensor's `event` key, and the subject returns its value from `state` |
| `plans-on-a-stale-declaration` | GA-DESC-18 | GA-APPLY-2, GA-DESC-2 | The simulated bridge re-publishes `devices` turning an action from idempotent to not, and the subject keeps `revision` and applies a plan made before it |
| `history-keeps-a-personal-occurrence` | GA-EVT-5 | — | A sensor's `event` key is in its `personal`, and the subject's `history` returns its occurrences |
| `latch-misses-an-extension` | GA-SAFE-7 | — | While a leak rule's latch on a valve is held, the subject dispatches the valve's extension action |
| `dispatches-a-changed-step` | GA-DESC-18 | — | An apply's second step targets a device whose declarations the simulated bridge changed after its first, and the subject dispatches it |

The clauses 0.10 adds to GA-DESC-3, GA-DESC-4, GA-STATE-3, GA-STATE-4, GA-STATE-5, GA-PLAN-4,
GA-APPLY-5, GA-APPLY-7, GA-APPLY-8, GA-APPLY-9, GA-EVT-1, GA-EVT-3, GA-EVT-6, GA-PERSIST-1,
GA-PROV-1, GA-ADOPT-2 and GA-BUS-11 are graded under those ids with the PC parts of the simulated
home; they have none of their own yet, except GA-APPLY-8's for the wake, GA-DESC-10's for adding
`power.wake`, GA-EVT-3's for a logout (`lock-fails-on-logout`), GA-STATE-3's for an unavailable
computer (`unavailable-computer-reads-stale`), GA-EVT-1's for a late lock
(`externalises-a-late-lock`) and GA-DESC-3's for the extension
floor, a hosted device's standard action and a proposed `infrastructure`, listed above (the manifest records every subject an id has, in the order listed). So is
GA-TOKEN-4's clause for applies running at once, under `reuses-token-after-late-unreachable`'s id.
The maintainer's ruling of 2026-09-27 adds GA-PLAN-8 and a clause to GA-STATE-4, with subjects of
their own above; the eleventh review round adds GA-SAFE-13 and GA-APPLY-16, with theirs.

## What this standard does not define

- The JSON Schemas are owed. Until they exist, the tables above are the shapes; the schemas must not
  contradict them.
- Anything about persons, roles, rooms or the house's routines: `standard/steward.md`.
- Any binding other than MCP for clients and children. Bridges bind to MQTT
  (`standard/bridge.md`).
- A vacuum cleaner: not in this version's vocabulary.
- How the owner's app shows candidates, and how the box starts a bridge for one.
- **Known limitation: open-loop devices.** A device that never reports its state (`feedback:
  open`: an IR or RF code, a transmitter that can answer nothing) is controlled without being
  observed, and the guarantees that rest on an observed state are weaker for it: `already` is never
  known, an ack says a code was written, not that it landed, a latch or load cap cannot see that it
  held, a state changed by the device's own remote goes unseen, and a transmitter that cannot answer
  can fail unseen (GA-BRIDGE-72). What this version puts in their place: values derived from what
  was sent are `assumed` and never taken as observed (GA-STATE-4); a toggling code is sent to reach
  a state only on a person's yes (GA-PLAN-8), never by the applier on its own (GA-SAFE-13); and the
  owner is told at adoption (GA-ADOPT-6). The limitation is accepted by the maintainer's ruling of
  2026-09-27; a design that closes it is future work.
