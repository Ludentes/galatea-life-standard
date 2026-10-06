---
title: The Galatea bridge standard
status: draft
last_verified:
area: architecture
audience: dev
author: Galatea maintainers
version: 0.6
related:
  - docs/specs/2026-09-24-bridge-standard-design.md
  - docs/specs/2026-09-25-discovery-design.md
  - conformance/galatea-bridge.schema.json
  - docs/specs/2026-09-25-pc-design.md
  - docs/reviews/2026-09-25-pc-standards.md
  - standard/applier.md
  - standard/steward.md
  - conformance/bridge-requirements.json
  - docs/reviews/2026-10-01-bridge-0.5-applier-0.14.md
  - CONTEXT.md
  - docs/reference/2026-09-24-home-reference-scenarios.md
  - docs/reviews/2026-10-06-bridge-0.6-applier-0.15.md
---

# The Galatea bridge standard

## Changelog

| Date | Version | Change |
|---|---|---|
| 2026-10-06 | — | Editorial: private references removed for publication; no requirement changed. Decisions once credited to another system now state what was decided and why; *Kept and changed* is now *Compatible with a deployed fleet's binding*; the optional `issuedAt` discard's 120 s is stated as this standard's own decision, with its reason; links to documents that are not public are reworded |
| 2026-10-06 | 0.6 | From the Zigbee bridge's live bench run and the maintainer's rulings of 2026-10-06, with applier 0.15: a reading is published under a vocabulary key only where it means what that key means, a movement reading always `motion` (*Mapping by meaning*, GA-BRIDGE-78); a numeric measurement the model promises and the maker has seen missing held back until the device first reports it, listed in `awaitedKeys` meanwhile, never a boolean key, declared before its first value and never held back again (GA-BRIDGE-80); undescribed data a list on the device's entry, kept across restarts, and one `undescribed` event per name, no longer a standing `undescribed_keys` fault (GA-BRIDGE-76 changed); a duplicate of a described reading by another path not undescribed, and still a check-in; every setting listed, and each one the device confirmed kept across a restart with its observation's time, dropped when the device is interviewed again (GA-BRIDGE-79; GA-BRIDGE-1, 5, 31 and 74 changed); polling and configured reports named as the ways to know a bound (*The roster and freshness*); device settings as owner-only desired settings (*Settings*, ⚠️ tentative, outside the requirement index). Joint revision with applier 0.15. Reviewed with the `standard-review` procedure in five rounds (change record `docs/reviews/2026-10-06-bridge-0.6-applier-0.15.md`): Kimi (k3) and a no-context Claude reader, and a scenario walk each round; 183 findings: 151 fixed (round 5's highs not re-read, by the stopping rule), 24 deferred to the backlog, 6 no change, 2 rejected; the maintainer's rulings of 2026-10-06 on held-back keys (numeric only), kept settings (A), GA-OCC-1 (a motion sensor reading motion now) and cross-topic order (applier 0.16). **PASS** 2026-10-06 |
| 2026-10-01 | 0.5 | Device extensions on any bridge, by the maintainer's rulings of 2026-10-01 (change record `docs/reviews/2026-10-01-bridge-0.5-applier-0.14.md`), from the Zigbee bridge's bench spikes: `extensions` on any device, not only a plugin's; the form of an extension's name (*Extension names*); each extension key a `state` or an `event` (`kind`); an `event` key's value published once as an `occurrence` on the `event` topic, never in a retained status (*Occurrences*, GA-BRIDGE-75); `confirmedBy` on any stateful extension action, naming a `state` key; `personal` and `selfChanging` on any device's extension keys, an extension `state` key no `confirmedBy` names being `selfChanging`; a device's status carrying only the keys it declares, and what it leaves out named in an `undescribed_keys` fault for the owner (GA-BRIDGE-76); declarations that hold for the device's settings as last observed, each such setting a declared `state` key kept across restarts, the new `devices` published before the setting's new value, and no action offered on a setting never observed (*Declarations and settings*, GA-BRIDGE-74); the extension name form a MUST (GA-BRIDGE-77). Reviewed in `docs/reviews/2026-10-01-bridge-0.5-applier-0.14.md`: one round of two readers (Kimi `k3`; Claude, no context) and a scenario walk (no grade changed); 30 finding rows, 26 fixed (one in part), 3 deferred, 1 rejected; no blocker; round 1's fixes not re-read by a further round (the stopping rule); **PASS** 2026-10-01 (the maintainer, after walking the deferred items) |
| 2026-09-27 | 0.4 | Home PCs, from the approved PC design (`docs/specs/2026-09-25-pc-design.md`, revision 5; change record `docs/reviews/2026-09-25-pc-standards.md`), on top of 0.3's discovery: a level Host, independent of Provision, for plugins; *Computers* (power, the computer's own check-in, going offline, sessions and account tokens, `notify`'s `from`, the PC's administrators as `otherAdmins`); *Plugins* (the manifest, `install`, `uninstall` and `activate`, staged versions, the hosting floors); *The wake relay*; no remote shell among a bridge's own actions; `devices` gains `host`, `plugin`, `version`, `personal`, `selfChanging`, `internal`, `stagedFor`, `accounts`, `extensions`, `proposedInfrastructure`, and `confirmedBy` and `requestedTier` on actions; a plugin device's state resource (`stateUri`). GA-BRIDGE-42 to 70 new; GA-BRIDGE-13, 22, 31, 32, 35, 37 and 38, and GA-BOX-2, amended. By the maintainer's ruling of 2026-09-27, open-loop devices: an action that a toggling code carries out says so (GA-BRIDGE-71), and a transmitter that can answer nothing is `unknown`, its devices usable (GA-BRIDGE-72); from the review, a code learned from a remote, or one that cycles or steps, is declared toggling unless the owner declared it discrete, no button action is offered, an `unknown` transport that went `down` comes back when its host link opens again, and an action whose code carries the device's whole state is declared `wholeState` and built from the command's `state` alone (GA-BRIDGE-73 new); open-loop devices kept as a known limitation, stated in *What this standard does not define*. Added by the review, among the ids above: a plugin reinstall bound to its package, a plugin server's start, liveness, restart and crash-loop `faults` (GA-BRIDGE-57, 58), the clock step on resume (GA-BRIDGE-59), plugin state read after a start or resume (GA-BRIDGE-60), the session helper bound to its session (GA-BRIDGE-61), a computer's `notify` shown in every unlocked session or `failed(not_shown)` (GA-BRIDGE-62), `cancel` with nothing scheduled (GA-BRIDGE-63), the credential and helper endpoint kept from non-administrators (GA-BRIDGE-64), `proposedInfrastructure` on the broker's host (GA-BRIDGE-65), `session.lock` over every graphical session, `failed(not_locked)` and `failed(no_graphical_session)` (GA-BRIDGE-66), a plugin's account deleted (GA-BRIDGE-67). Reviewed in `docs/reviews/2026-09-25-pc-standards.md`: eleven rounds of two readers (Claude Opus; Claude Sonnet; a third-model reader skipped by the maintainer's ruling) and a scenario walk in each; 317 finding rows, 300 fixed, 10 deferred, 6 rejected, 1 recorded with no text change; no blocker open; **PASS** 2026-09-27 (the maintainer, after round 11; round 12 not run, so round 11's fixes and the known-limitation note were not read by a further round) |
| 2026-09-25 | 0.3 | Discovery, by the maintainer's ruling of 2026-09-25 (`docs/specs/2026-09-25-discovery-design.md`): the finder and its level, Find; the manifest and its schema, `conformance/galatea-bridge.schema.json`; candidates and their canonical keys; `bridgeType` in `status`, and `connections` on devices and transports, required only of a bridge whose type ships a manifest; the `connect` request, with `connected` and `connect_failed`, and no credential on the wire; GA-FIND-1 to 6, GA-BRIDGE-39 to 41; GA-BOX-1 closes `{root}/finder/` to all but the box's applier; GA-BRIDGE-22 ends a `connect` in flight at a reload, and GA-BRIDGE-27's block covers `connect`. Passed review 2026-09-25 after eight rounds and a third-model reading (`docs/reviews/2026-09-25-bridge-0.3-applier-0.9.md`) |
| 2026-09-25 | 0.2 | Decisions compatible with a deployed fleet's binding, where 0.1 had departed from it without ground, by the maintainer's rulings 1 to 14: the fleet's topic shape under `{root}`; its heartbeat (status every 10 s, dead after 30 s, the will on `lwt`), the ping removed; a declared freshness bound only, with `lastCheckIn` and no ceiling; one terminal ack (`applied`, `sent`, `failed(reason)`, `unsupported`); camelCase and milliseconds on the wire; the fleet's payload shapes, extended; `instanceId` a UUID; MQTT 3.1.1 and a password over plain TCP allowed below Box; `devices` at every level; the bridge reports facts and the applier gives the verdict, so a Box reader never gets the roster; `v` required. GA-BRIDGE-38 new. Reviewed in `docs/reviews/2026-09-25-bridge-0.2-applier-0.8.md`: pass 1 and six rounds of two readers (a third-model reader; a no-context Claude reader) and a scenario walk; 153 finding rows fixed, 4 deferred, 1 rejected; no blocker open; **PASS** (the maintainer, 2026-09-25, after round 6, whose fixes were mostly removals, taken without a further read) |
| 2026-09-25 | 0.1 | First text, superseding a placeholder: bridges and ownership, ids, devices, transports, state and liveness from `last_check_in`, commands and results, provisioning (join windows, commissioning, removal, the blocklist, admission by protocol), snapshots, restarts and native control, the box; the MQTT 5 binding. GA-BRIDGE-1 to 37, GA-BOX-1 and 2. Reviewed in `docs/reviews/2026-09-24-bridge-0.1-applier-0.7-steward-0.3.md`: seven rounds of two readers (a third-model reader; a no-context Claude reader) and a scenario walk; about 203 finding rows fixed, 15 deferred, 8 rejected, 2 no action; no blocker open; **PASS** (the maintainer, 2026-09-25, after round 7, with round 7's one looser move, the trust-centre rejoin, recorded rather than re-read) |

**Status: draft.** Nothing implements this yet. The reasons behind it are in
`docs/specs/2026-09-24-bridge-standard-design.md`. Where it agrees with a binding a deployed fleet
has run, and where and why it differs, is in *Compatible with a deployed fleet's binding*.

The key words MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119 and RFC 8174. A sentence
without one of them is explanation, except that every row of *Requirement index* is normative, at
its row's level. Every requirement the conformance harness checks has an id in
*Requirement index*; the manifest, `conformance/bridge-requirements.json`, is its machine-readable
copy. Ids are one namespace across the Galatea standards; an id cited here may live in
`standard/applier.md`.

## What this standard governs

The contract between an **applier** (`standard/applier.md`) and its **bridges**: the processes that
speak to radios and buses. A home has three jobs, and this standard keeps them apart:

| Job | Who | Knows |
|---|---|---|
| Scenario runner | steward | what should happen, when, for whom |
| Gate | applier | whether this device may take this now: tiers, tokens, latches, loads, safety rules |
| Doer | **bridge** | how to make this radio or bus do it, and what the device said back |

The gate is security-critical and exists once, audited. Doers are many, follow hardware, and are
written by whoever knows the protocol. Keeping them apart keeps the trust boundary small (a buggy
Zigbee doer is not a buggy gate), lets a doer be swapped without re-certifying the gate, and lets
one gate serve Zigbee, Matter and IR at once, so a safety rule that reads a Zigbee leak sensor and
closes a Matter valve lives in one applier.

A bridge knows nothing of persons, rooms, tiers, plans or tokens. It is trusted for what devices
report, as the applier's own reading of a device is, and for nothing else. It also provisions:
it opens join windows, commissions by setup code, removes devices, and, on a PC, installs and
hosts plugins, always at the applier's request, which the applier takes only from the owner.

It also governs the **finder**: the one process on a box that listens for devices on the network
and the box's own ports, and tells the applier which bridges could take them (*The finder*).

It does not govern what a device may do, who may ask for it, or what the house calls it: those are
the applier's and the steward's. Nor does it govern a non-conforming engine (Home Assistant,
openHAB), which an adapter presents as an applier.

## Conformance levels

A bridge claims its levels in its `status` (`levels`).

| Level | Covers |
|---|---|
| **Serve** | devices, transports, state, commands, liveness, the connection |
| **Provision** | join windows, commissioning, `connect`, removal and the blocklist |
| **Host** | plugins: `install`, `uninstall`, the manifest and the hosting floors (*Plugins*) |
| **Box** | the broker the box runs, not the bridge: grants, refusals, who may read |
| **Find** | the finder, not a bridge: listening, candidates, its own liveness |

Every bridge claims Serve, and may add Provision, Host or both; an IR blaster's bridge may claim
Serve only. Host is independent of Provision: a PC's bridge claims Serve and Host, and not
Provision; a Zigbee bridge claims Serve and Provision, and not Host; a wake relay claims Serve only
(*The wake relay*). A finder claims Find, in its own `status`, and nothing else; no bridge claims
Find. Box
is claimed by a deployment, not a bridge. An applier's bridges are only as safe as the broker they
share: on a broker that fails Box, anyone who can publish a command passes the applier's gate
(GA-BOX-1). A broker that lets readers subscribe by wildcard does not claim Box.
Galatea still works over it; an applier over such a broker cannot claim Safe (GA-DESC-6).

## Compatibility

The binding's major version is `v` in the bridge's `status`: this is version 1. `v` is how a
bridge says it meets this standard: a bridge written for an earlier binding, whose `applied` meant
less, sends none until it has made the changes this standard asks. An applier treats a `status` without `v`, or with a `v`
it does not know, as a `bridge_fault`, and the bridge's devices as `dead` (GA-BUS-14). A minor version of
this standard only adds fields, enumerated values, operations and requirements, except where its
changelog row says it removes one (0.6 removes the `undescribed_keys` fault code): only the current
version exists (the maintainer's ruling: no backward compatibility).

Field names on the wire are camelCase, and durations are in milliseconds.
Enumerated values and state keys keep the applier's words (`no_confirmation`, `setpoint`). The
applier's own seams keep their snake_case names; *The applier's names* maps one to the other.
An action's argument names and values are the applier's too, as state keys are: a command's
`value` carries them as the applier defines them (`shutdown`'s `delay_s`, in seconds), and an
extension action carries the arguments its schema names (*Extension names*).

Every enumerated value a bridge sends (a transport `kind` or `state`, a `classEvidence`, an event `type`, a
reply `status`, an ack `result`, a failure `reason`, a roster `basis`) is **open**: the applier
treats one it does not know as the least it can mean, and never rejects the message for it
(GA-BUS-3). The least each can mean:

| Unknown | Taken as |
|---|---|
| event `type` | ignored |
| reply `status` | not known: the request may have been carried out |
| ack `result` | not known, and not terminal: the step stays `dispatched`, a later known ack still counts, and otherwise it ends by its ack bound, since the bridge may have acted |
| failure `reason` | `failed` with that reason |
| transport `kind` | `other` |
| transport `state` | `down`, so an applier older than 0.10 takes a 0.4 bridge's `unknown` so, and makes its devices `dead` |
| `classEvidence` | `none` |
| `feedback` | `closed`, so the device goes `stale` when it stops checking in |
| roster `basis` | a basis with no further meaning; the declared bound still applies |

A bridge serves a request with a field it does not know as if the field were absent, except inside a
command's `value`, where an unknown key is `failed` with reason `invalid_request` (GA-BRIDGE-4).
In a deployed fleet, a closed acknowledgement `source` rejected every ack from each new kind of
bridge: the command ran, and the operator saw a timeout.

## The model

### Bridges and ownership

A bridge fronts devices over one or more **transports**. It has exactly one commanding client, its
applier; an applier may have many bridges, each registered through the applier's `configure` as
`{ id, identity }`, the identity being the one its broker credential names. A device is owned by
exactly one bridge. A device the owner has adopted keeps its bridge: the same `stableIdentifier`
under another bridge is a separate, unadopted device, and a `route_conflict` event names both
bridges (GA-BUS-11). Only when no device with that identifier is adopted is it handled as GA-META-2
handles one under two children: exposed once, its steps `refuse(duplicate_route)`, one
`route_conflict` event, until the applier's `configure` routes that identifier to one bridge.

Other clients may read what a bridge publishes, such as a content system or monitoring. Only the applier
writes commands and requests. At Box, who else may read which device is the owner's grant
(GA-BOX-1).

### Ids

A bridge's device ids are its own. The applier gives each device its own `id` when it first sees it,
unique within the applier, and keeps the map to `{ bridge, device }`; every applier operation names
the applier's id, and the applier translates. A replacement re-points an applier id at another
bridge device (`standard/applier.md`, *Adoption*). Transports are named the same way. Device ids a
bridge uses in topics never contain `+`, `#` or `/`. A device the protocol admits anew (an
unsecured association, a commission, a `connect` of hardware the bridge does not hold, by the
identifier it reads after the device proves itself) MUST get a device id the bridge has never used,
even when, outside `connect`, it shows an identifier the bridge already knows, and the old id leaves the `devices` document and the roster, its
retained status cleared as a removed device's is (GA-BRIDGE-21); so
one bridge id always means one admission, and the applier sees the new device in the re-sent
`devices` even when it missed the `joined` event (GA-BRIDGE-35). A plugin device is the one
exception: its id is `<plugin id>:<version>:<key>` (GA-BRIDGE-69), so an install of a version after
its `uninstall` gets the ids it had before. The applier forgot those devices on the `uninstalled`
event (GA-PROV-4), so it still sees an admission, new and unadopted (*Plugins*).

### Devices

The retained `devices` document describes every device the bridge has: what the owner needs to
adopt it, and what the applier needs to plan for it. It carries no values and no liveness; those
are in the device's status and the bridge's roster. Each entry:

| Field | Type | Notes |
|---|---|---|
| `id` | id | The bridge's own |
| `stableIdentifier` | string | The protocol's identity: a Matter unique id, a Zigbee IEEE address |
| `transport` | the bridge's transport id | |
| `model` | `{ vendor, model }` | As the device reports it |
| `capabilities`, `sensorKeys` | as `standard/applier.md`, *Capabilities and actions* | What the bridge can map |
| `actions` | `[{ action, idempotent, stateless, toggles?, wholeState?, args?, confirms, confirmedBy?, requestedTier?, toolHash? }]` | Each action the bridge can carry out, with the fields only it can know: `idempotent` (`false` where the device implements it as a toggle or pulse), `stateless`, `toggles` (`true` where the device carries it out by a code that reaches a state only from a known one rather than sets it, as an IR power code one press of which turns a TV on and the next off; absent is `false`, GA-BRIDGE-71), `wholeState` (`true` where the code carries the device's whole state, as an IR air conditioner's frame, built from the command's `state`; absent is `false`, GA-BRIDGE-73), `args` constraints, and `confirms`, `true` wherever its protocol path can confirm a command (GA-BRIDGE-8). For `stateless` the applier's capability column wins; `idempotent` a bridge may only lower. Tiers, `ack_within_s` and witnesses are the applier's and the owner's. A stateful extension action, on any device, carries `confirmedBy`: the state key, never an `event` key, and the value that confirm it (`{ key, value }`, where `value` may be `{ arg: <name> }`, the value of that argument of the command). On a plugin device (*Plugins*), each action also carries what its manifest declares: its `confirmedBy`, `requestedTier`, the tier the manifest requests, and `toolHash`, the manifest's `toolHashes` entry for the tool that implements it, so that the applier can tell a later version's changed tool (`standard/applier.md`, GA-DESC-11) |
| `feedback` | `closed` · `open` | `open` when the device never reports its own state |
| `reachMs` | number | How long a command may take to reach the device: 0 for one that always listens, a sleeping device's poll interval otherwise |
| `proposedClass` | a class from the applier's closed list, or null | A proposal for the owner; the class is the owner's at adoption |
| `classEvidence` | `protocol` · `model_db` · `none` | `protocol`: a Matter device type read from the device, or a PC's bridge reading its own host; `model_db`: a model database; `none`: a guess or nothing (GA-BRIDGE-15) |
| `otherAdmins` | `[{ vendor, label }]` · `unknown` | Other controllers the protocol shows (GA-BRIDGE-14); on a PC, also its administrators and a plugin app's own network control (GA-BRIDGE-53) |
| `connections` | list of identity keys | The keys by which the finder can hear the device (`["mac:D4A651A1B2C3"]`), in *The finder*'s canonical forms; required from a bridge whose type ships a manifest, optional otherwise (GA-BRIDGE-41) |
| `host` | the bridge's device id, optional | On a plugin device only: the computer that hosts it (*Plugins*) |
| `plugin`, `version` | strings, optional | On a plugin device only: its plugin's `id` and its version, as the manifest gives them, so that no one parses a device id to learn them (*Plugins*) |
| `proposedInfrastructure` | `true`, optional | On a computer only: its bridge runs on its broker's own host, reaching it over loopback or through one of its host's own addresses, so the computer carries the broker; a proposal for the owner, who sets the applier's `infrastructure` flag (*Computers*) |
| `personal` | state key[], optional | Keys that say what a person is doing: on a computer, every key *Computers* declares personal; on a plugin device, those its manifest declares and any of `app`, `camera_in_use` and `microphone_in_use` it reports; on any device, its extension keys, of either `kind`, that the bridge or manifest declares personal (a bed's vibration alarm). A bridge never leaves out a declaration the standard makes (GA-BRIDGE-38) |
| `selfChanging` | state key[], optional | Keys the device changes by its own behaviour: on a computer, every one of its state keys; on a plugin device, those its manifest declares, and on a `player`, those the applier's standard declares; on any device, every extension `state` key that no action's `confirmedBy` names and that is not a setting (a socket's power reading), and any other the bridge knows the device changes. A bridge never leaves out a declaration the standard makes (GA-BRIDGE-38) |
| `internal` | `true`, optional | Never shown to people: a wake relay's entry (*The wake relay*) |
| `stagedFor` | the bridge's device id, optional | On a staged plugin device only: the device of the installed version it would replace, kept after its version's activation (*Plugins*) |
| `accounts` | `{ <token>: <label> }`, optional | On a computer only: each interactive account's token and the OS's name for it, as a label (*Computers*) |
| `settings` | state key[], optional | The keys that are the device's settings (*Declarations and settings*) |
| `awaitedKeys` | key[], optional | Numeric measurement keys the device's model promises, and its maker's records name as seen missing, that it has not yet reported, held back from `sensorKeys` or an extension's `keys` until it does (GA-BRIDGE-80) |
| `undescribed` | `[{ name, firstSeen }]`, optional | Data the device sends that no declared key describes, each by the protocol's own name (`dp103`, `genBasic.0x4000`) and when the bridge first saw it; kept across restarts (GA-BRIDGE-76) |
| `extensions` | `[{ capability, description, actions: [{ action, description, schema }], keys: [{ key, kind?, description, schema }] }]`, optional | On any device: each extension capability the bridge can carry out or report for it beyond the applier's closed vocabulary, named as *Extension names* gives, with the JSON Schema of each action's arguments and of each key, a key's schema always a scalar, and descriptions an LLM can read. On a plugin device they are its manifest's. A key's `kind` is `state`, a value the device holds, published in its status, or `event`, an occurrence, published once (*Occurrences*); absent is `state` |

**Extension names.** An extension capability's name MUST be a namespace with at least one dot, under
one its publisher controls: a plugin's `id` for a plugin's (`org.example.steam`), and a reverse-DNS name
of the bridge's maker for the bridge's own (`org.galatea.zigbee.tuya`). Each of its actions and keys
is the capability's name, a dot, and a name matching `^[a-z][a-z0-9_]*$`
(`org.example.steam.launch`, `org.galatea.zigbee.tuya.mode`), so that the capability is everything
before the last dot. No extension takes a standard capability's name, and a key the applier's
vocabulary already names (`battery`, `on`) is reported under that name, never as an extension's.
On one device no capability's name is another's with a segment added, so the last dot is never in
doubt. A plugin manifest that breaks any of this is `invalid_manifest` (GA-BRIDGE-77). What an
extension does is said only by its description and schema: the applier understands it no further,
and gives its actions the extension tier (`standard/applier.md`, *Default tiers*).

**Mapping by meaning.** The applier's vocabulary names readings by what they mean
(`standard/applier.md`, *Sensor keys*), and a protocol or a device library may use the same word for
something else. A bridge MUST publish a reading under a vocabulary key only where the reading means
what that key means, whatever the protocol or library calls it (GA-BRIDGE-78):
- a reading that says someone is in the sensed area now, a radar's or a vision sensor's, is
  `occupancy`, whatever its name (the Zigbee converters call most of them `presence`);
- a reading that says movement was detected, a passive infrared sensor's, is `motion`, even where
  a library calls it `occupancy`; its `false` is the device's own where it sends one, and otherwise
  its library's timer's, which the bridge's maker records per model (`standard/applier.md`, *Sensor
  keys*);
- a reading whose meaning differs by model is mapped per model, and where the bridge cannot tell,
  it is an extension key, never a vocabulary key.

What each key a device declares came from, and why, belongs in its maker's records; the reference
Zigbee bridge keeps the mapping as data, one table, overridable per model.

**Keys a device has not yet sent.** A device's model may promise readings a given unit never sends
(a radar `occupancy` sensor whose model lists temperature, and whose firmware sends none). A bridge MAY hold
back such a key until the device first reports it, but only a numeric measurement the device sends
by itself from time to time (a temperature, a humidity, an illuminance, a battery level), as a
sensor key or an extension `state` key, and only one its maker's records name, for that model, as
promised and seen missing (on a bench, or in the field; *that naming is the maker's word, not checked
by the harness*). A boolean key, a capability and an action are never held back: every other key the
model promises is declared from the start, so a reading a safety rule waits for (a leak sensor's
`leak`, which it may first send at its first leak) is never held back. While a key is
held back, the bridge MUST list it in the entry's `awaitedKeys`, and its first report is never undescribed; it MUST publish the new `devices`,
with the key declared and out of `awaitedKeys`, before the status that carries its first value and
within 1 s of the device's first report of it; and it MUST keep that the key was reported across its
restarts, so a key once declared is never held back again (GA-BRIDGE-80). The guard this gives a
rule (`standard/steward.md`, GA-DEF-12) is partial: a key a model promises and its maker has not named
is declared, and a rule on it is accepted; that it never comes shows only on a bench or in the field. A key declared later is a model change
for the applier (`standard/applier.md`, GA-DESC-18): its revision moves, so a plan made before it is made
again (GA-APPLY-2), and a rule on a key the
device does not declare is refused at `define` (`standard/steward.md`, GA-DEF-12). A key held back
is never a reading until then.

**Declarations and settings.** A device's **settings** are its declared `state` keys that configure
the device rather than report the house (a sensor's sensitivity, a button pusher's mode): the keys
the bridge lists in the entry's `settings`, each one that changes only when it is written, never by
what the device senses (a siren's `alarm` is not one). A bridge MUST list every such key of a device,
and MUST NOT list a vocabulary state key (GA-BRIDGE-79). A setting changed by another controller or
by hand, on a device that reports none, stays as kept until the device reports it or is interviewed
again; the model's passport says whether it reports its settings. A device's settings can change what its actions are: a button
pusher in a click mode presses on every `onoff.turn_on`, and in a switch mode holds a position.
A device's **declarations** are its entry's `capabilities`, `sensorKeys`, `extensions`, `feedback`,
`reachMs`, `personal` and `selfChanging`, and each action's `idempotent`, `toggles`, `wholeState`,
`args`, `confirms` and `confirmedBy` (`stateless` is the applier's capability column, and never
moves). Every declaration MUST hold for the device's settings as the bridge last observed them
(GA-BRIDGE-74):
- a setting that changes a declaration MUST be one of the device's declared `state` keys, so that
  what the bridge observed is on the wire (GA-BRIDGE-74);
- when an observed setting changes a declaration, the bridge MUST publish the new `devices` before
  the status or ack that carries the setting's new value, and within 1 s of observing it
  (GA-BRIDGE-74);
- the bridge declares from each such setting's kept value (below) until the device reports it
  again;
- the bridge keeps every setting the device has confirmed, by a frame of the device's carrying the
  value (a report, or an echo of a write that carries it; a write response that carries no value
  confirms nothing), across its restarts with that observation's time, and publishes it in the device's status with
  that time until the device reports that setting again (GA-BRIDGE-79). A device interviewed again
  may carry other firmware or have been reset, so the bridge then drops every kept setting of it, and
  declares by their worst case until each is reported (GA-BRIDGE-79, GA-BRIDGE-74). A secured rejoin
  with the key the device already holds, as after a power cut, is not an interview, and keeps them;
  a device admitted anew has a new id (GA-BRIDGE-35), and nothing kept. A device that answers no read (a Tuya
  sensor's sensitivity, known only from the echo when it was written) would otherwise read unknown
  after every restart. A setting never confirmed is not published, and declarations take its worst
  case (GA-BRIDGE-74);
- while it has never observed a setting, it offers no action whose declaration depends on it.

The applier takes the change as a model change (`standard/applier.md`, GA-DESC-18).

A Matter lock that requires a PIN for remote operation: the bridge MUST hold the PIN in its own
configuration, set by the owner outside this standard, and MUST NOT send it on this binding, in a
command's `value` or in any event; without one, it offers no `unlock` and MUST say why in an entry
in its `status`'s `faults` naming the device (GA-BRIDGE-36).

### Transports

A **transport** is the unit of shared fate: a Zigbee coordinator, a Matter fabric with its Thread and
Wi-Fi paths, an IR blaster, a Modbus gateway. The bridge's `status` lists each as
`{ id, kind, state, since, retryIntervalMs?, connections? }`, with `connections` as a
device's, for a transport the finder can hear (a hub, a coordinator stick, a gateway): `state` is `up`, `down` or, for a transmitter that can answer nothing, `unknown`, `since`
is when it last changed, and `retryIntervalMs` is the current backoff while `down`. `kind` is one
of the applier's `protocol` values, and becomes each of its devices' `protocol`. An IR blaster
reached over another transport (a Zigbee blaster) is a device on that transport and, beside it, an
`ir` transport of its own, whose `state` follows the blaster's `available` and `observable`; the appliances it
drives are `ir` devices on that transport.

`up` means a successful exchange with the transport within the last 30 s: a read, a report
received, or a protocol health check the bridge made, at least every 10 s when nothing else has
passed, so that one lost exchange does not take the transport down. For a transport that only
transmits, such as an IR blaster, an exchange is the transmitter's own answer on its host link (a
status query, an acknowledged frame). A transmitter that can answer nothing on its host link (a bare
IR LED, a one-way radio transmitter) is `unknown`: never `up`, since nothing was exchanged, and
`down` only from its host reporting a write to it failed, or removing its host link (the port or
device node the bridge writes to, gone with an unplugged dongle), until that host link opens again,
which the bridge retries on GA-BRIDGE-11's backoff without transmitting anything; it is then
`unknown` again. Its devices are `feedback: open` and usable while the bridge is alive, and a
command for one is acked `sent` once written, and `failed(unreachable)` when its host reports the
write failed, since the host took nothing to transmit (GA-BRIDGE-72). A heartbeat proves only the
bridge's main loop, and a connect proves nothing
(GA-BRIDGE-23). A change of a transport's `state` re-publishes the bridge's `status` within 1 s.
`down` makes every device on the transport `dead` at the applier; `unknown` does not.

A PC's bridge has one transport, its host, of `kind` `other`: its exchange is the bridge's own
observation of its host (*Computers*), and the computer and every plugin device are on it. A wake
relay's transport is its LAN interface (*The wake relay*).

### The roster and freshness

The bridge's `status` carries a **roster**, `devices[]`: one entry per device the bridge has, with
`lastCheckIn` beside the values' `timestamp`:

| Field | Type | Notes |
|---|---|---|
| `id` | id | The bridge's own |
| `transport` | the bridge's transport id | |
| `basis` | `poll` · `subscription` · `report` · … | How the bridge learns of the device: it polls it, holds a protocol subscription, or receives what the device sends. Open |
| `cadenceMs` | number or null | The poll interval, or the subscription's granted interval; null where nothing yet comes, or where the device reports on its own rhythm |
| `basisMaxAgeMs` | number or null | The device's freshness bound (GA-BRIDGE-13); null when the bridge cannot know it, and for a `feedback: open` device |
| `timestamp` | time or null | The time of the newest observation among the device's values |
| `lastCheckIn` | time or null | When the device's latest check-in reached the bridge (GA-BRIDGE-37); null before its first, and for a `feedback: open` device |
| `observable` | bool | `lastCheckIn` and `basisMaxAgeMs` are not null and `publishedAt − lastCheckIn ≤ basisMaxAgeMs`, against the containing status's own `publishedAt`; for a `feedback: open` device, its transport is `up` or `unknown` |
| `since` | time | When `observable` last changed, or, before any change, when the entry was created |

The bridge reports **facts**: what each device said, when it last checked in, and the bound the
protocol lets it know, or null where it cannot know. Whether a value may be acted on or shown as
current is a **verdict**, and the verdict is the applier's (GA-STATE-5): only the applier knows
whether the bridge itself is still alive, what bound the owner has set, and the devices that no
Galatea bridge serves. `observable` is the bridge's own view, one input to that verdict.

A device's values say what it last reported; its `lastCheckIn` says whether it is still there. An
idle leak sensor that sends a keep-alive every hour has an old `leak` value and a recent
`lastCheckIn`, and is observable. For a bridge whose every check-in is a read, as a polling bridge's
is, `lastCheckIn` equals `timestamp`, and `observable` judges the age of its newest value.

The bound is declared: the bridge knows its devices' rhythms, and says what it knows
(GA-BRIDGE-13).
- A polled device's `basisMaxAgeMs` is at most three times its `cadenceMs`.
- A Matter device's is the subscription's maximum interval the device **granted**, plus the
  controller's slack before it declares a node gone. One bench measured grants of 33, 16, 5 and
  4 s for requests of 30, 10, 5 and 1 s, and about 38.5 s of slack; that is a guess until measured
  more widely.
- A device that reports on its own rhythm (a Zigbee sensor's keep-alive) has the bound the bridge
  knows for its model, from the protocol's reporting configuration or a model database, allowing at
  least one missed report: twice the longest interval it is configured to report at, or, where
  none is configured, the interval its model is known to report at; no more, so a bound cannot be
  stretched to keep a dead device observable.
- A bridge that cannot know a device's bound publishes null, and the applier reads the device
  `stale` until the owner sets one (GA-STATE-5, GA-STATE-6). No bound is guessed from what the
  bridge happened to see.

A bridge whose protocol lets it learn a bound SHOULD use it, rather than leave the bound to the
owner: it can **poll** a device that is always awake (a mains device, a router, a button pusher
that answers within seconds), at a cadence it chooses, its bound then three times that; and it can
**configure a report** on a sleeping device whose protocol allows one (a Zigbee device's battery or
power report with a maximum interval), its bound then twice that interval, once the device has
accepted the configuration (its protocol's configuration response says so). A model whose firmware
the bench has seen accept a configuration and then not report by it is declared null; the bridge's
maker records that per model. *These routes are a SHOULD; not checked by the harness.* Many devices report only on change and accept no
configuration (the Tuya sensors on Galatea's bench); for them the bound is null until the owner
sets one.

There is no universal ceiling on a bound: a battery leak sensor that checks in once an hour has a bound of
more than an hour. A 120 s ceiling, as one deployed binding had, makes every such sensor unobservable.

A **check-in** is any message the device's application sends to the controller: a report, an
answer to a read, or a keep-alive addressed to it (a Zigbee attribute report or check-in, a Matter
subscription report). A MAC-level poll or a link-status frame is not one: a device whose
application has hung can still make them.

The bridge's `status` is re-published within 1 s of any device's `observable` changing, and at least
every 10 s in any case (GA-BRIDGE-17, GA-BRIDGE-37), so the roster lags a device by at most one
heartbeat. The applier judges liveness from `lastCheckIn` itself, against the bound it holds (the
owner's may differ from the bridge's), allowing that one heartbeat (GA-STATE-5).

### A device's status

Each device's retained status is flat: `{ deviceId, state, timestamp,
<reading>: value, …, available, timestamps? }`.
- Every **reading** is named by the applier's state or sensor key (`on`, `level`, `position`,
  `open`, `locked`, `leak`, `temperature`), or by one of the device's extension keys of `kind`
  `state`. Its value is a scalar: a string, a number or a boolean. A device's status carries only
  the keys its entry in `devices` declares, its capabilities' state keys, its `sensorKeys` and its
  extensions' `state` keys: anything else the device sends is left out (GA-BRIDGE-1). The bridge
  lists what it left out in the device's entry in `devices`, `undescribed`, each by the protocol's own
  name (`dp108`, `genBasic.0x4000`) matching `^[A-Za-z0-9._-]{1,64}$`, with when it first saw it, at
  most 32 per device, kept across restarts; and, the first time it sees each, publishes an
  `undescribed` event `{ device, name }` (GA-BRIDGE-76). So the owner can see it, a later definition
  can pick it up, and nothing undescribed is ever a reading; and it is no fault, since nothing about
  it needs fixing. Data that repeats a reading the device already reports by another path (a Zigbee
  sensor's battery as a Tuya datapoint and as a ZCL attribute) is not undescribed: the bridge's maker
  names, per model, which path is the reading and which the duplicate, and records it with the
  model's mapping; the bridge drops the duplicate, and counts its arrival as a check-in
  (GA-BRIDGE-37). *That a path is a duplicate is the maker's word; not checked by the harness.*
  The list holds at most 32 names at once; while it is full a new name is neither listed nor
  announced. A name the device's declarations come to describe leaves the list, and frees its place.
- `state` is a universal field. For a device with `onoff` it is `"on"` or `"off"`, the same as
  the `on` reading; a device without `onoff` leaves it out.
- `timestamp` is the time of the observation the readings rest on, never the time of the message.
- `timestamps` is present only when some readings were observed at another time than
  `timestamp`: `{ <reading>: time }` for each of them. A read of some keys restamps only those
  keys (GA-BRIDGE-1, GA-BRIDGE-2).
- `available` is `false` when the bridge cannot reach the device now, and `true` otherwise.

The bridge MUST publish a device's status within 1 s of each report that changes a reading or its
time (GA-BRIDGE-37).

- A bridge never reports a value it cannot currently observe, except a setting the device confirmed, kept
  across a restart with its observation's time (GA-BRIDGE-79). It reports its own loss of contact
  with a device as `available: false`, never as a value (GA-BRIDGE-1). `available: false` means the
  bridge cannot reach the device now: the protocol itself has declared it gone (a Zigbee leave,
  a Matter node the controller marks unavailable); a route error on one command is not that, and
  its command is acked `no_confirmation`; a doer's availability that
  is only a silence timer, as zigbee2mqtt's is for a battery device, is not the protocol's word.
  Silence alone never makes a device unavailable: silence is the applier's to judge, against the
  bound and `lastCheckIn`. The applier reads `available: false` as `dead`. `unknown` as a value
  means only that the bridge read the device and could not derive the state; every reading's type
  admits the string `"unknown"` beside its own.
- A field that fails its declared type is left out, and the rest published (GA-BRIDGE-1).
- Times are RFC 3339 in UTC with milliseconds (`2026-09-24T18:03:07.412Z`). The bridge keeps its
  clock synchronised, and no time it sends is more than 1 s ahead of true time (GA-BRIDGE-3); under
  the harness, true time is the harness's; on a box with no time source outside it, the box's own
  clock, which the applier also reads. A fast clock makes a stale value look fresh; the applier's own
  check on it is GA-BUS-2.
- A reading is what the device reported, never what was commanded (GA-BRIDGE-5). A value derived
  from what was sent is **assumed**, not a reading: a bridge publishes none, and a
  `feedback: open` device's assumed state is the applier's, marked `assumed: true`
  (`standard/applier.md`, GA-STATE-4).

### Occurrences

A key of `kind` `event` is something that happens, not a value the device holds: a vibration alarm
that the device never clears, a button press, a gesture. Its value is published once per occurrence
the device reports, on the bridge's `event` topic, as
`{ seq, instanceId, type: "occurrence", device, key, value, timestamp }`, where `timestamp` is when
the device reported it and `value` a scalar its schema allows. It MUST NOT appear in the device's
retained status, MUST NOT change `available`, and MUST NOT be published again after a restart, a
reconnect or a `snapshot`: an occurrence the applier missed is lost, never replayed as if it had just
happened (GA-BRIDGE-75). The message that carried it is a check-in like any message from the device,
and moves the roster's `lastCheckIn` (GA-BRIDGE-37). A protocol frame the bridge receives twice, with
the same transaction number and the same payload within 10 s (⚠️ a guess, the converters' window),
is one occurrence; the same alarm sent again in a new transaction is another. Occurrences ride the
bridge's `event` topic, which a Box grant covers for the whole bridge, not for one device: a reader
granted it sees every device's occurrences (GA-BOX-2).

### Commands

The applier publishes a command on the device's `command` topic, in this envelope:
`{ commandId, issuedAt, resultWithinMs, value: { action, value?, state? } }`.
- `commandId` is a UUID, unique per command.
- `action` is the applier's `capability.action` (`valve.close`), or an extension action by its full
  name (`org.galatea.zigbee.tuya.mode`, *Extension names*).
- The inner `value` is the action's argument: the argument itself for an action with one
  (`set_level` carries `40`), an object of them for an action with several (`notify` carries
  `{ text, urgency }`, and `from` where the bridge lists it, *Computers*), and absent for an action
  with none.
- `state` is the device's assumed state, `{ key: value }`, as the applier holds it before the
  action, sent only for an action the bridge declares `wholeState: true` (`standard/applier.md`,
  GA-APPLY-16). A bridge keeps no state (GA-BRIDGE-5), so it MUST build such an action's code from
  the command alone, `state` with the action's `value` applied, never from what it last sent, and a
  key `state` leaves out from the model's default (GA-BRIDGE-73).
- `resultWithinMs` is the action's ack bound (`ack_within_s` in `standard/applier.md`), counted
  from the publish. It is also the command's Message Expiry.

**Before publishing**, the applier decides what it can: a device whose bridge is dead, whose
transport is `down`, which is `available: false`, or any device while the applier has lost the
broker, is `unreachable` at once, with nothing published and the token unused (GA-APPLY-5,
GA-TOKEN-4, GA-BUS-7).

**Dispatch** is a PUBACK with a success code: the step is `dispatched`, and its token counts as
used. A PUBACK of `0x10` (no matching subscribers: the bridge is between connections) or `0x87` (not
authorised, also a fault) means nothing was delivered: the step is `unreachable`, the token unused.
A connection lost before any PUBACK means the command may or may not have been delivered: the step
is `dispatched`, the token used, the command is never re-sent after reconnecting, and it is judged
as if no ack came (GA-BUS-9). A reader whose subscription matches a command topic (`demo/#`)
counts as a subscriber, so on a broker that allows one the `0x10` never comes, and a command to a
bridge that is away ends as if no ack came. Under Box no reader can match one (GA-BOX-1).

**The ack.** The bridge answers every command with exactly one terminal ack on the device's `ack`
topic: `{ commandId, source, result, reason?, detail?, timestamp }`
(GA-BRIDGE-4). `source` is the bridge's `bridgeId`; the applier takes an ack whose `source` is not
the bridge the topic names as a `bridge_fault`, and not as an ack. `timestamp` is when the ack was
published. `detail` is text for a person. `result` is one of:
- `applied`: the protocol confirmed the command (a Matter invoke's success status, a Zigbee
  default response), never on merely handing it to the radio (GA-BRIDGE-8);
- `sent`: the command was transmitted, and nothing can confirm it (an open-loop device, or a
  protocol path with no response, such as zigbee2mqtt's `set`);
- `failed`, with a `reason`:
  - `unreachable`: nothing was transmitted, since the device's transport is `down`, the device
    is `available: false`, a restart or reload found the command not yet sent, or the device is a
    plugin device whose server is still starting, so no tool can be called yet (GA-BRIDGE-6,
    GA-BRIDGE-22, GA-BRIDGE-60). The step becomes `unreachable`, and the token stays used;
  - `unknown_device`, naming it (GA-BRIDGE-6);
  - `invalid_request`: the command does not fit the device's declared `args`, or its `value`
    carries a key the bridge does not know (GA-BRIDGE-4);
  - `expired`: its time ran out before anything was transmitted (GA-BRIDGE-7);
  - `no_confirmation`: a confirmation the protocol gives never came. The applier treats it as no
    ack, since the device may have acted (GA-BRIDGE-8);
  - another reason: the device said the action was not carried out (a busy or failure status), or
    the bridge could not send it. A delivery the protocol reports lost after transmission (a Zigbee
    route or MAC failure, a missing APS ack) is `no_confirmation`, since the device may have acted;
- `unsupported`: the bridge cannot map the action.

`unreachable` and `expired` mean that nothing was transmitted. Handing a command to the protocol
stack counts as transmitting it, a coordinator's queue for a sleeping device included, since the
stack may deliver it after the bridge has given up. Once anything was transmitted, a command that
cannot finish ends `failed(no_confirmation)`, or `sent` where the action is declared
`confirms: false`, never `unreachable` or `expired`. An ack for a failure the bridge finds on
receipt (`unreachable`, `unknown_device`, `invalid_request`, `expired`, `unsupported`, or a
`session.lock`'s `no_graphical_session`, GA-BRIDGE-66) comes
within 1 s of the command's receipt; every other ack, a later `unreachable` or `expired` included,
within the command's time.
A non-terminal `received`, which some deployed bridges send, MAY be sent before the terminal ack, and the applier ignores it.

After an `applied`, a `sent` or a `failed(no_confirmation)` for a stateful action on a
`feedback: closed` device, the bridge publishes a fresh observation of every key the action sets
before the ack bound, reading it back from the device if no report came, taken as late as still lets
it be published by the command's `issuedAt` plus `resultWithinMs` less 1 s, on the bridge's clock,
so that a slow valve has had its time and the applier, counting from its publish, still sees it
within its bound. For a device with `reachMs`
above 0, the read is queued with the command so that both go at its next poll; where the stack
cannot do that, it reads at the poll after, which the ack bound allows, since it is at least twice
the reach plus 10 s (GA-CFG-3) (GA-BRIDGE-34). A target that already held produces no report of its
own, and this read is how its step is acked. The ack does not settle that case: it
answers *did the protocol take it*, and the device's status answers *what is the device doing*.

The ack is the protocol's word about the command, not about the device's state. The bridge never
starts a command whose time has run out, and never carries out, later, a command it acked `failed`
(GA-BRIDGE-7). It hands a command to a queue for a sleeping device only if the stack drops it when
its time runs out; a device it cannot reach within 145 s, so that twice its reach plus 10 s fits the
longest ack bound, is offered no action. `sent` is for an action declared `confirms: false` only
(GA-BRIDGE-8). It remembers each `commandId` for at least `resultWithinMs`: a repeated one returns
the first ack, or, while the first is still running, nothing more, and does nothing (GA-BRIDGE-4).

**The command's time.** A bridge on MQTT 5 counts the command's time as the lesser of the Message
Expiry that remains on delivery and `resultWithinMs` from receipt. A bridge on MQTT 3.1.1 sees no expiry, and counts `resultWithinMs` from the
command's receipt; the broker has already dropped a command that expired while it waited. A bridge
MAY also discard, on receipt, a command whose `issuedAt` is older than 120 s by its own clock,
acking it `failed(expired)`. A command that old was asked for a moment that has passed, and the
discard bounds, on the bridge's own clock, how late a command held in a client's queue can run,
which a bridge on MQTT 3.1.1 cannot see from an expiry. It is optional because the command's time
already bounds every command the bridge starts. The bridge did nothing, so the applier
takes `failed(expired)` as `unreachable`.

**What the applier makes of it.** Whether a stateful action took is the applier's to judge, from
state. This table restates `standard/applier.md`, *Outcomes*, which wins if they differ:

| Device `feedback` | Action | Ack `applied` | Ack `sent` | Ack `failed(r)` | No ack in bound |
|---|---|---|---|---|---|
| `closed` | stateful | `acked` when a report or the read-back matches; else `failed(no_ack)` at the bound | as `applied` | `failed(r)`, unless a matching report came first; `unreachable` for `r` = `unreachable` or `expired`; `no_confirmation` as no ack | `acked` on a matching report, else `failed(no_ack)` |
| `closed` | stateless | `delivered` | `sent` | as above | `failed(no_ack)` |
| `open` | any | `sent` | `sent` | as above | `unanswered` |

`unsupported` is `failed(unsupported_action)`. The first final outcome wins. A matching report after
`failed(no_ack)`, within the late-ack window, is a `late_ack`; after an ack `failed`, other than
`failed(no_confirmation)`, the bridge says it did not act (GA-BRIDGE-7), so a match is someone
else's change, `external` (GA-APPLY-11).

### Requests and replies

Everything the applier asks of a bridge other than a command is a **request**, on
`request/{op}`: `{ requestId, issuedAt, ... }`, where `op` is `snapshot`, `join`, `join_close`,
`commission`, `connect`, `remove`, `unblock`, `install`, `uninstall` or `activate`. The bridge replies on `reply` with
`{ requestId, op, status, data?, reason? }`, within 1 s of receiving it (GA-BRIDGE-4). A request on
an `op` the bridge does not know is `invalid_request`. The reply statuses:
- `ok`, with `data`: the request is done (`join_close`, `unblock`, `snapshot`, and `activate`,
  whose `data` is `{ plugin, version }`);
- `accepted`: the work goes on, and ends in an event (a window's `window_closed`, a commission's
  `commissioned` or `commission_failed`, a `connect`'s `connected` or `connect_failed`, a `remove`'s
  `left`, which every accepted `remove` ends in, even for hardware already gone, an `install`'s
  `installed` or `install_failed`, an `uninstall`'s `uninstalled`);
- `invalid_request`: the request does not fit the bridge (GA-BRIDGE-28);
- `failed`, with a `reason`: `unknown_device`, naming it; `busy`; `state_mismatch`
  (GA-BRIDGE-12); or another reason.

`snapshot` is the one request whose reply may take longer: `ok` once everything is re-published,
within 10 s of receiving it (GA-BRIDGE-30). `join_close`, `remove` and `unblock` are idempotent: the
same request sent again, after a reply that never came, changes nothing more, and the bridge's
`status` lists the blocklist, so the applier can see whether a block took. `install` and
`uninstall` re-sent with the same `requestId` are duplicates, answered as GA-BRIDGE-4 says, as
`remove` is; `activate` is idempotent too: activating a version already active changes nothing.

### Provisioning

At level Provision, the applier may send, always on the owner's behalf:
- `join { transport, windowMs, near? }`: opens a join window, at the router `near` names if the
  transport can, else house-wide (GA-BRIDGE-25, GA-BRIDGE-26);
- `join_close { transport }`: closes the window at once (GA-BRIDGE-25);
- `commission { transport, code, acceptUnattested? }`: a Matter device by its 11- or 21-digit setup
  code, on the network, through a commissioning window another controller opened (GA-BRIDGE-29);
- `remove { device | identifier, blockRejoin, force? }`: by the bridge's device id, or by
  `stableIdentifier` for hardware the applier has retired after a replacement; `force` drops a
  device that cannot answer, such as one with a dead battery (GA-BRIDGE-27);
- `unblock { identifier }`, by `stableIdentifier` (GA-BRIDGE-27);
- `connect { address?, keys }`: takes a device that the
  finder heard at `address`, or by its `ble:` key where it has no address (*The finder*), for a
  bridge whose manifest says `connect` (GA-BRIDGE-40). `keys` are the candidate's. A credential the
  device needs (an ESPHome API key) is never in the request: the owner sets it in the bridge's own
  configuration, outside this standard, as a lock's PIN is (GA-BRIDGE-36).

A Matter setup code travels in `request/commission`; below Box a wildcard reader sees it while the
device's commissioning window is open, and can commission the device into a fabric of its own,
one more reason Safe needs Box. A transport with no join window (Matter) refuses `join`, and one with no setup codes (Zigbee)
refuses `commission` (GA-BRIDGE-28). Events: `joined`, `interviewed` (the device's model and
capabilities are known), `left`, `window_closed` with every device that joined in it,
`commissioned` or `commission_failed` with a `reason`, and `connected { requestId, device }`, naming the device the bridge now holds, or
`connect_failed { requestId, reason }`, where `reason` is `unproven`, `unreachable`, `refused`
(the device turned the bridge away, showed none of the candidate's keys, or is blocked) or
`unsupported`. A bridge takes through `connect` only a device that **proves** its identity: one
that shows, in a handshake that discloses nothing an eavesdropper or an impostor could use, that it
holds the secret the bridge's own configuration gives for one of the candidate's keys, such as an ESPHome node's API key in
its encrypted handshake; a handshake that fails, or shows another secret, is `unproven`. Proof is
worth what the path the secret took to the device is worth, which a bridge cannot see: the owner
puts it there beforehand by a path that does not pass through the address the candidate names
(firmware flashed over USB, or the device's own setup access point), since a key set over the
network at a discovered address proves only that the bridge reached what the tool reached. A secret shared by several devices proves only that the device is one of
them, and the keys check below then rests on the device's word. A credential the device hands out
when asked, such as a hub's pairing token, proves nothing, since anyone at the address can hand one
out; such a device is set up with the box's own tool. A device that cannot prove itself, such as an
ESPHome node with no API key, is `connect_failed(unproven)`; the owner may still set it up by hand,
outside discovery, taking the risk that anyone who can reach it can pretend to be it. A proven
device must also show one of the candidate's keys, so the owner gets the device they chose. A
`connected` naming a new device is its admission, and no `joined` goes with it. A `connect` whose
proven device the bridge already holds, by the identifier it reads, is `connected` naming it, and
changes nothing: it admits, evicts and re-points nothing. A `connect` to loopback
(`127.0.0.0/8` or `::1`, however written, an IPv4-mapped IPv6 address included), to a multicast
or broadcast address, to an IPv6 link-local address (`fe80::/10`), to any address of the box's own interfaces, the host's where the bridge runs
in a container, or to the box's own container networks, where its broker and applier are, ends
`connect_failed(refused)` without opening a connection. A bridge in a container cannot see the
host's addresses, so the box gives it the list of networks to refuse in its configuration, or
enforces the refusal with an egress rule of its own.

A new device arrives at the applier unadopted, whatever joined it, and whatever identifier it
shows: a device that joins through a window or is commissioned is new, even with the identifier of
a device the applier already has. The applier refuses every action on it until the owner adopts it
(`standard/applier.md`, *Adoption*). What makes a device new is how the protocol admits it, not
when: a Zigbee association through the trust centre, a trust-centre rejoin in which the trust centre
hands over the network key under a link key everyone knows, or a Matter commissioning, is a
`joined`, window or not. A Zigbee secured rejoin with the network key the device already holds (a
router after a power cut) is not new, nor is a trust-centre rejoin under the device's own unique
link key (from its install code, or from the link-key exchange a Zigbee 3.0 device makes after it
first joins), which no one else holds unless they listened at its join (see the limit below); neither sends a `joined`, even while a window is open,
as long as the device is still in `devices`. Hardware that rejoins, in any of these ways, with no entry in
`devices` (evicted by GA-BRIDGE-35, or removed without leaving the network, and not blocked) MUST be
reported as an admission: a device id never used before and a `joined` event (GA-BRIDGE-35), so
the applier sees a new, unadopted device and never a resurrected one.

The limit: during an open Zigbee window the network key goes out under a link key everyone knows,
so a device that listened can later rejoin as the device whose identifier it claims, and any
joiner in a window that claims an adopted identifier evicts the real device (GA-BRIDGE-35), which
then reads `dead` until the owner acts. The same listener learns a device's unique link key too,
unless it came from an install code, since a Zigbee 3.0 device without one receives it under the
key everyone knows; a trust-centre rejoin under that key opens nothing the secured rejoin had not
already opened. A bridge SHOULD join devices by their install codes where they have them, which
closes this, and the owner should keep windows short and near the new device.
The rest is the Zigbee network's own security.

Commissioning over Bluetooth is not in this version: the reference box has none. A new Wi-Fi Matter
device therefore joins another ecosystem first (the owner's phone), which then opens a window for
this one. That is a cost the owner should know.

### Settings (⚠️ tentative)

⚠️ **Tentative** (the maintainer, 2026-10-06): written for the joint review to judge, and outside the
requirement index until decided. Scenarios HS28 and HS34 (`docs/reference/2026-09-24-home-reference-scenarios.md`).

A device's **settings** are what configures it rather than acts on the house: a sensor's
sensitivity, its LED, a button pusher's mode and movement limits. Today a bridge offers each writable
value outside the applier's vocabulary as an extension action, which GA-BRIDGE-7 withholds from a
device it cannot reach within 145 s, so no setting of a sleeping sensor can be changed at all; and
on an awake device a brain may ask for one at the extension tier, though a button pusher's mode
change moves its arm. Under this section:
- **Every writable value outside the vocabulary is a setting, not an action**, declared on the
  entry as a `state` key with its `args` constraint; a bridge offers an extension action only where
  its maker documents the value as something the house does (a siren's alarm), per model.
- **At level Provision, the applier may send `configure_device { device, setting, value, withinMs }`**,
  always on the owner's behalf. The bridge checks `value` against the setting's constraint (else
  `invalid_request`), replies `accepted`, and lists the pending value in the entry's
  `pendingSettings`, `[{ setting, value, until }]`.
- **It writes the value at the device's next check-in**, in the short time a sleeping device
  listens after it, at once for one that always listens; never through a stack's own queue, so that
  nothing is written after `until`.
- **It reports the end:** a `setting_applied { device, setting, value }` event once the device's
  report or echo shows the value, which then reads in the status as any confirmed setting does
  (GA-BRIDGE-79); or a `setting_expired { device, setting, value }` event at `until`, the value
  dropped and never written later. Either way the entry's `pendingSettings` loses it.
- **A setting is never a command**: it has no `commandId`, no ack and no `resultWithinMs`, and is
  never a step of a plan, a scenario or a rule. GA-BRIDGE-7 holds unchanged for actions.
- **What it would amend, once decided:** `configure_device` joins the `request/{op}` list; the entry
  gains `pendingSettings`, kept across a restart, and `movesDevice`; the `event` topic gains `setting_applied` and `setting_expired`; the
  applier's names map `within_s` to `withinMs`. Until then a bridge answers `configure_device`
  `invalid_request`, as any op it does not know.
- **What it leaves alone:** a plugin's actions, which its manifest declares (*Plugins*), stay actions;
  a bridge that claims only Serve has no settings route, and its devices' settings stay as their
  extension actions declare them.
- **⚠️ To decide before the section is adopted:** whether a device under a held latch, or one a safety rule reads or
  actuates, is refused `configure_device` (GA-SAFE-2 and GA-SAFE-7 refuse only an action on a device a
  rule actuates, today); and a setting whose write moves the device (a button pusher's mode) is
  marked `movesDevice` on the entry, so the owner's app can warn.

### Computers

A PC's bridge is a system service on the PC, and fronts its own host as one device, the
**computer**: `proposedClass` `computer`, with `classEvidence` `protocol`, since the bridge reads
it from the host itself; `feedback: closed`; and as `stableIdentifier`, the identifier the OS keeps
for the machine. The applier's standard defines the class and its capabilities: `power`, `session`,
`notify`, and the sensor keys `battery`, `app`, `camera_in_use` and `microphone_in_use`. The
plugins the bridge hosts are devices of their own (*Plugins*). The bridge is two kinds of process:
the system service, which holds the broker connection and runs every action, and a **session
helper** in each user session, which reports whether its session is active or idle, reads the
personal keys, and shows notifications, since a system service cannot see into a user's session.
The helper never starts a plugin's server (GA-BRIDGE-42). A helper runs as its session's user, so
anyone in that session can run a forged one: the system service binds each helper to its session by
the OS identity of the helper's connection (the session id and uid the OS reports for it, never
what the helper says), ignores any report a helper makes for another session, and names such a
report as a `faults` entry on the computer (GA-BRIDGE-61). A session has one helper, the one the
service itself started in it, known by the process id the OS reports for the connection: a second
connection from that session, or one from a plugin server's process, which shares its session and
uid, is refused and named as a `faults` entry on the computer, so that no other process of the
account can report the session `active` (GA-BRIDGE-61). `app`, `camera_in_use` and
`microphone_in_use` are the computer's, not a session's, so the service takes them only from the
helper of the session the OS reports active at the console (logind's active session on `seat0`;
Windows' active console session), and ignores any other helper's report of them (GA-BRIDGE-61).

The system service's broker credential is readable only by the service and by the OS's
administrators, who are other admins already (*The PC's administrators are other admins*); and the
endpoint its helpers connect to is created and owned by the service, so that no other process can
bind, replace or listen on it and stand in for the service. Helpers connect to it as any process
may, and are bound as above (GA-BRIDGE-64). A credential any account can read lets that
account publish as the bridge, and set a session's key the helper binding guards.

**Power.** An asleep or off computer's bridge is offline, so the computer is `dead`: "on" is its
liveness, and `power` has no state key.
- `sleep`, `shutdown` and `cancel` declare `confirms: true`, and are acked `applied` once the OS
  has accepted them. `shutdown` is `idempotent: false`: a second scheduled shutdown errors on
  Windows and restarts the countdown on Linux.
- `shutdown` with `delay_s` is scheduled with the OS's own warning to every session
  (`shutdown +2` on Linux, `shutdown /s /t 120 /c` on Windows); where the OS counts the delay in
  whole minutes, as Linux's `shutdown` does, `delay_s` is rounded up to the next whole minute, so
  the warning is never shorter than asked. Without `delay_s`, and always for `sleep`, which takes
  no argument, the action is immediate. `cancel` withdraws a scheduled one, and is acked `applied`
  when nothing is scheduled (GA-BRIDGE-63).
- A PC's bridge offers no `wake`: a sleeping computer runs no bridge. The wake goes through a wake
  relay (*The wake relay*), which the owner pairs with the computer at the applier.

**The computer's own check-in.** The computer is the bridge's own host, so no protocol message
checks it in. The bridge observes its host (a read of the OS's own state: its sessions, its
battery) at least every 10 s, and counts each successful observation as the computer's check-in
(GA-BRIDGE-37). Its roster entry has `basis` `poll`, `cadenceMs` 10 000 and `basisMaxAgeMs`
30 000, the entry GA-BRIDGE-13's closed list keeps for the bridge's own host. The same observation
is the exchange that keeps the host transport `up` (GA-BRIDGE-23).

**Going offline.** The terminal ack of `sleep` or `shutdown` comes before the bridge's graceful
`offline` and before it clears `lwt`, in the order GA-BRIDGE-22 gives a restart, the action acked
`applied`, not as a command in flight; otherwise the applier finds the bridge dead while the step
waits, and the step ends `failed(no_ack)`. Where the OS offers a way to hold a suspend (a delay
inhibitor, such as logind's `delay` lock, or a suspend notification it waits on, such as Windows'
`PBT_APMSUSPEND`), the bridge holds it until that ack is published, so that an immediate `sleep`
does not freeze the bridge first (GA-BRIDGE-22; ⚠️ a bench check on each OS). The bridge also goes
offline gracefully, in the same order, on any suspend or shutdown the OS announces to it: a closed
lid, a sleep when idle, a restart for updates (GA-BRIDGE-22). Whether a laptop with Modern Standby
announces its sleep, or stays connected with the service running while asleep, is ⚠️ a bench check
on that laptop class. A suspend the OS does not announce leaves the bridge no time, and its will
fires once the broker's keepalive lapses. The applier takes that will as any other: the computer
and its hosted devices read `dead` (GA-STATE-2), and a device a safety rule reads gets GA-SAFE-10's
notice at once, since only a graceful `offline` has its grace. A will is never a `bridge_fault`, so
there is none to suppress.

**Resuming.** A PC that slept kept time on its own hardware clock, which may have drifted, and a
`lastCheckIn` stamped by a clock behind true time reads old at the applier, so a wake could fail
on a computer that did come back. On resuming, where the OS offers a way to (chrony's `makestep`,
`w32tm /resync`), the bridge has the OS step its clock to its time source before its first
`status`, waiting at most 10 s (⚠️ a guess) for it; a clock the OS could not step is then named by
the applier's check (GA-BUS-2) rather than silently failing the wake (GA-BRIDGE-59).

**Sessions.** The computer has one state key per interactive OS account the bridge knows, not
system or service accounts: `session.<token>`, a scalar, one of `active`, `idle`, `locked`,
`disconnected`, `unknown` or `none` (not logged in). The bridge knows accounts, not persons
(GA-BRIDGE-52).
- `<token>` is a token the bridge derives, not the OS name: the account name when it already
  matches `[a-z0-9_-]{1,32}`, otherwise `u` and a number: on Linux the uid; on Windows a number the
  bridge assigns and keeps, never the last part of the SID, which a local and a domain account can
  share. A name that itself matches `u[0-9]+` or `g[0-9]+`, or is `unknown`, or whose token another account
  holds or once held (a new `liza` after the old one was renamed), is never taken as it is: it gets the
  `u` form, so no two accounts share a token. The bridge fixes the token when it first sees the
  account, keyed by the OS's own identity for it (the uid, the whole SID), and keeps it across its
  own restarts and the account's renames. An account the OS reports deleted (a local account
  removed from the OS's own account database) has its token **retired**: its key leaves the
  computer and `accounts`, and the token is never given again, so a later account with the same uid or SID gets a new one, its name if that is free and
  never held, else `u` and a number the bridge assigns and has never given. An account deleted and
  made again under the same uid while the bridge was not running is, to the bridge, the same
  account. An account merely absent from a listing is not deleted: a directory (LDAP or domain)
  account that the OS lists only while its cache of the directory holds it keeps its token and its
  key through a lapse, so that it does not come back under a token no mapping names
  (GA-BRIDGE-52). A directory account is deleted only on the directory's own word. On Windows a
  domain account is keyed by its SID, which the domain never gives again, so a reused one is not a
  case. On Linux, a directory account the directory itself reports as not existing (an
  authoritative answer to a lookup, not a cache miss or an unreachable directory) is deleted, and
  its token retires, so a later account under its uid gets a new token; while the bridge cannot
  tell, the token stays (GA-BRIDGE-52). It declares each token in `devices` (`accounts`) with the
  account's current OS name as its label, so «Ольга» or `john.doe` never becomes part of a key. `accounts` has this one shape,
  `{ <token>: <label> }`, one entry per interactive account; which person an account belongs to is
  the steward's, in a field of its own (`standard/steward.md`), never this one.
- **Several sessions.** An account may have several sessions at once: at the console, over SSH,
  over Remote Desktop. Its one key combines them: each session is read as below, and the key takes
  the most in-use state any of them reads, in the order `active`, `idle`, `unknown`, `locked`,
  `disconnected`, `none`, so an account locked at the console and active over Remote Desktop reads
  `active` (GA-BRIDGE-52). The OS's report says which sessions are graphical: on Linux, logind's
  session `Type`, graphical when it is `x11`, `wayland` or `mir`; on Windows, every WTS session
  except session 0. A session with no display (an SSH login, or any session the OS reports
  as non-graphical) has no screen to lock and no helper: it is read from the OS alone, `active`, or
  `idle` where the OS reports idleness (logind's `IdleHint`), never `unknown` for lack of a helper.
  It joins the combined key only while the account has no graphical session: an account with one
  is keyed by its graphical sessions alone, so a lock of them reads `locked` even with an SSH login
  open, and a person working only over SSH still reads `active` (GA-BRIDGE-52).
- `idle` means no input for the bridge's idle threshold (default 300 s), a setting in the bridge's
  own configuration, not one the owner sets through the applier. There is no idle counter, so the
  key changes only when the state does.
- **Who sees what.** The system service sees `none`, `locked` and `disconnected` without any helper
  (on Windows through WTS session notifications and flags; on Linux through logind's `State`,
  `Remote` and `LockedHint`). Telling `active` from `idle` needs the session's helper. A logged-in
  graphical session that is neither locked nor disconnected, with no helper running, reads `unknown`: a
  reading whose state cannot be derived (GA-BRIDGE-1), not loss of contact, which stays
  `available: false`. The service takes only `active` or `idle` from a helper, and only for a
  session the OS itself reports neither locked nor disconnected; `locked`, `disconnected` and
  `none` come from the OS alone, so a helper that claims its own session `locked`, forged or not,
  changes nothing, and cannot make a rule on that key read the session as closed (GA-BRIDGE-52).
  Said plainly, on Linux the OS's word is only as strong as logind's `LockedHint`, which the
  session's own screen locker sets; a process in the session that sets it lies to logind, not to
  the bridge, and this standard cannot close that.
- `session.lock` takes the account's token, and sets `session.<token>` for that account. Its
  `args` declare `account` as the tokens `accounts` lists, changing with it, so a retired token
  leaves them; a lock naming any other token is acked `failed(invalid_request)` within 1 s, nothing
  done (GA-BRIDGE-66). Its
  read-back (GA-BRIDGE-34) reads that key, and the applier takes `locked`, `disconnected` or `none`
  (a logout) as its answer. The system service locks or disconnects any session
  without the helper (`loginctl lock-session` as root on Linux, `WTSDisconnectSession` on Windows),
  and a lock locks or disconnects every graphical session of the account. `session.lock` is
  declared `confirms: true` and `idempotent: true`, confirmed by `session.<token>`: it is acked
  `applied` once the OS reports every graphical session of the account locked or disconnected, or
  once the account has no session at all, its key then reading `none`. A
  non-graphical session (an SSH login) cannot be locked and does not block the ack; with a
  graphical session present it is not in the key either, so the key reads `locked` when the ack
  says so. An account whose only sessions are non-graphical has nothing to lock, and its key reads
  `active` or `idle`, so its lock is acked `failed` with reason `no_graphical_session` within 1 s of
  its receipt, never `applied` and never `not_locked`, so that a steward tells it from a lock that
  may still land by its reason, not its timing (GA-BRIDGE-66). A graphical session the OS does not
  report locked or
  disconnected within 5 s (⚠️ a guess) of the request (on Linux, one whose screen locker, if any,
  did not honour the request and set `LockedHint`) makes the lock `failed` with reason
  `not_locked`, never `applied`, so that a rule does not retry for ever a lock nothing can take
  (GA-BRIDGE-66). A slow screen locker may still lock the session after that ack: that is the OS
  finishing what it was asked, not the bridge carrying out the command later, since the bridge
  sends nothing more, so GA-BRIDGE-7 holds. The key reports the lock, and the applier gives that
  report to the apply (`standard/applier.md`, *Causes*). `failed(not_locked)` is the lock's
  terminal ack, and no read-back follows it: GA-BRIDGE-34's follows only an `applied`, a `sent` or
  a `failed(no_confirmation)`, and the key reports as it always does.

**Declarations.** `app` (the foreground application of the active session), `camera_in_use` and
`microphone_in_use` are `personal` on every device that reports them, a plugin device included,
whether or not its manifest declares them; on a computer, so is every `session.<token>`, and every
state key is `selfChanging`: a person using the PC changes them, and must never lease it by doing so. These
are the standard's declarations, and the bridge lists them in `devices` (GA-BRIDGE-38).

**`notify`'s `from`.** The command value of `notify` may carry `from`, the source the steward set:
`{ endpoint, role }` for a request, `{ rule }` or `{ scenario }`, either with `brain_authored: true`
when a brain wrote the rule or started the run, or `{ notice }`; its keys are the applier's, as a
`value`'s are (*Compatibility*). A bridge that shows it lists `from` among its `notify` action's
`args`, and the applier sends `from` only to such a bridge; to any other it leaves it out, so a
bridge on 0.2 never refuses a `notify` for it (GA-BRIDGE-4). A bridge that lists it shows it with
the text, so that a guest's text cannot pass for the house's own message, and shows a `notify`
that carries no `from` (the applier accepts one, from an older client) as from an unknown sender,
never unmarked (GA-BRIDGE-56). A
computer is new at 0.4, so it has no older bridge to spare: its `notify` lists `from`, and a
`notify` is shown in every logged-in session that is neither locked nor disconnected and has a
running helper. Shown in none (every session locked or disconnected, or no helper running), it is
acked `failed` with reason `not_shown`, never `applied`, so that no one takes an unseen message for
a delivered one (GA-BRIDGE-62). Its `applied` says only that the helpers handed it to the OS's
notification service in those sessions, not that anyone saw it: Focus Assist or Do Not Disturb may
hold it, and nothing the bridge can read says so.

**The PC's administrators are other admins.** Anyone with administrator rights on a PC can stop
its bridge, change its plugins, read its broker credential and publish as it. At Box that reaches
only the devices this bridge hosts (GA-BOX-1), except on a computer that carries the broker
(below), so the bridge says it per device, in `otherAdmins`,
and not in `ungoverned`, which would cost the whole applier its Safe claim (GA-DESC-6): one PC must
not cost a home its leak valves. The computer and each plugin device carry one
`{ vendor: "os", label: <token> }` per administrator account, its token derived as *Sessions*
derives it and taken from the same table, so an administrator who logs in carries the token
`accounts` lists for it; a service account granted the rights has a token from the same table
that `accounts` does not list, and a group granted them has a token of its own form, `g` and a
number (on Linux its gid; on Windows a number the bridge assigns and keeps), which no account's
token can take; the owner's app shows either by that token alone. An **administrator** is an
account with the OS's administrator rights, or rights equal to them: on Windows, a member of the
local Administrators group or of Backup Operators, directly or through another group, an account
holding `SeDebugPrivilege`, `SeTakeOwnershipPrivilege`, `SeRestorePrivilege` or
`SeBackupPrivilege` through local policy, and, on a machine joined to a domain, a member of Server
Operators or Account Operators; on Linux,
root, every account that sudo's configuration or polkit lets run any command as root, directly or
through a group (`sudo`, `wheel` or `admin`, by distribution), one command being enough, since a
single command (`less`, `vim`, `find`) often escapes to a shell and the bridge does not judge
escapes, every identity polkit's administrator rules name, and every member of the `docker` group
where there is one. Where the bridge cannot enumerate that set (a polkit rule whose JavaScript
decides by more than users and groups; a sudo grant whose users, or whether it runs as root, rest
on an alias or a digest the bridge does not evaluate; on Windows, a local policy it cannot read), it adds one entry `{ vendor: "os", label: "unknown" }`,
so that no one reads an incomplete list as complete; the name `unknown` is never an account's
token (*Sessions*). Each plugin device also carries, in the same shape, the
account its plugin runs as, unless it is listed already as an administrator: that account can edit
the interpreter's libraries its server loads, which are not pinned (*Hosting*), and signal or trace
the server, so it is a second door on those devices too. The computer carries it as well where
the plugin's manifest declares `needsSession`, since that server runs in the account's session,
beside its helper, and can do there whatever the account can (GA-BRIDGE-53). The list is re-read at start, whenever the OS reports a change of the administrators group, and at
least every 24 h (⚠️ a guess) in case a change went unreported, as a Zigbee bridge re-reads its
binding tables, a change being an `other_admins_changed` event (GA-BRIDGE-14, GA-BRIDGE-53). A
plugin app's own network control (Kodi's JSON-RPC and web interface, a game client's remote) is
`otherAdmins` on that plugin's devices, never `ungoverned`: the manifest lists it in its own
`otherAdmins` (`[{ vendor: "kodi", label: "web interface" }]`), and the bridge copies each entry to
every device of the plugin; a manifest without the field says the app has none, or that the plugin
disables it (GA-BRIDGE-53). Both are the publisher's word, *not checked by the harness*.

**A computer's own behaviour.** The OS's own automations (a sleep when idle, a restart for
updates) and a person at the PC (who shuts it down or puts it to sleep, cancels a scheduled
shutdown, or locks and unlocks a session) are the computer's own behaviour, seen as the computer going `dead` or its keys changing, as a
thermostat's own schedule is seen in its state. They are not ways the doer changes a device
without the applier's request, and are not listed in `ungoverned` (GA-BRIDGE-32). **A person at
the PC** is anyone in a login session on it, local, over SSH or over Remote Desktop, whatever the
account; one whose account is an administrator is also one of the computer's other admins, above.

**A computer that carries the broker.** A PC's bridge that runs on the broker's own host, reaching
it over loopback or through one of its own host's addresses, goes down with it: a sleep or
shutdown of that computer takes the broker, and so every bridge's commands, with it. The bridge then declares `proposedInfrastructure: true` on the
computer (GA-BRIDGE-65). It proposes; the `infrastructure` flag, and the `no_voice` tier it gives
`power.sleep` and `power.shutdown`, are the owner's to set at the applier, which takes the proposal
as the flag until the owner sets it either way (`standard/applier.md`, *Default tiers*). Its
administrators run the broker and its grants, so they reach every bridge's commands, not only this
bridge's devices: the bridge lists them on the computer as on any PC, and the applier counts them as
other admins of every device it governs, unless the owner has marked that computer as the
applier's own host, whose administrators already administer the applier (`standard/applier.md`,
*Safety rules*). A broker in a virtual machine or a container on the PC, reached through an
address of its own, is not seen this way, and the bridge proposes nothing for it: the owner sets
`infrastructure` on that computer at the applier.

### Plugins

At level Host, a PC's bridge hosts **plugins**. A plugin is a package installed on the PC: a
manifest, an MCP server that does the work, started only from the package's own files, and
optionally a skill for brains, which this version does not standardise. MCP stays inside the PC:
the bridge is the MCP client of each plugin's server, and the applier sees an ordinary bridge.

**The manifest.** A plugin's manifest declares, in this binding's camelCase:
- `id`, reverse-DNS under the publisher's namespace (`org.example.kodi`), and `version`;
- `devices`, each with a `key` stable across versions, a `proposedClass` or null, its
  `capabilities` and `sensorKeys`, its `personal` and `selfChanging` keys where they apply, a state
  cadence, `cadenceMs`, at most 300 000 (⚠️ a guess), since the device's bound is three times it,
  its state resource's URI, `stateUri` (*State*), and its `actions`. Each action has its `args` with constraints,
  `idempotent`, `stateless`, `confirms`, for a stateful action the state key and value that confirm
  it (`confirmedBy`), a `requestedTier`, and the MCP `tool` that implements it. The confirming value
  may name one of the action's arguments (`{ arg: "appid" }`), so `org.example.steam.running`
  confirms against the game asked for;
- `extensions`: extension capabilities under the publisher's namespace (`org.example.steam`), named
  as *Extension names* gives, with their schemas and descriptions, so that an LLM can read them at
  run time; each key's schema is a scalar (a string, a number or a boolean), since a reading's value
  is one (*A device's status*), and its key is under the same namespace (`org.example.steam.running`);
- `toolHashes`: for each tool, a SHA-256 over the RFC 8785 canonical JSON of its `name`, `title`,
  `description`, `inputSchema`, `outputSchema` and `annotations`, those of them the tool has;
- `command`, an array of strings, which starts its server, and `hosts`, the network hosts the
  server may reach. Its first element may be an interpreter the OS provides, by name (`python3`,
  `node`), found in a directory the plugin's account cannot write without elevation, never in
  one it can: on Linux the OS's own directories; on Windows, which ships neither, an interpreter
  the owner installed system-wide, under Program Files, counts, and one in a user's profile does
  not; every other file it names is inside the package (`["python3", "server.py"]`). At `install`
  the bridge resolves that name itself to an absolute path, in the plugin account's search order,
  and checks against the account's write access the file, every directory on its path, and every
  directory earlier in that search order in which the name would have been looked for; any one the
  account can write without elevation makes the install `invalid_manifest`. It records the
  absolute path with the manifest as installed, and starts the server by that path, never by name,
  so that a file planted later earlier in the search order is never run (GA-BRIDGE-68);
- `needsSession`, a boolean, `false` when absent: `true` when the server must run in a graphical
  session of the chosen account (a player that draws on a screen), not as a background process:
  the account's console session if it has one (on Linux, its session on `seat0`), else the one of its graphical sessions the OS
  started first, by the time the OS gives the session (on Windows its `LogonTime` from
  `WTSQuerySessionInformation`'s `WTSSessionInfo`; on Linux logind's session `Timestamp`), a tie
  going to the lower session id, compared as numbers where both ids read as integers, else in the
  byte order of the id strings. A graphical session is one *Sessions* counts so (logind's `Type`
  `x11`, `wayland` or `mir`; a WTS session other than session 0); an SSH login is none;
- `otherAdmins`, optional: the app's own network control, `[{ vendor, label }]`, absent when it has
  none or the plugin disables it (*Computers*).

An `id`, a `key` and a `version` hold only `[A-Za-z0-9._-]`, since each becomes part of a device
id; an `id` and a `key` are at most 40 characters each, and a `version` at most 32. A manifest in
which one does not ends its `install` `install_failed` with reason `invalid_manifest`
(GA-BRIDGE-68). So a plugin device's `stableIdentifier`, after its computer's (the OS's machine
identifier: 32 hex digits on Linux, 36 characters on Windows), is at most 118 characters, and a
meta-applier's `sid:` id for it at most 122, both within the applier's grammar of 1–128
characters from `[A-Za-z0-9._:/-]` (`standard/applier.md`, *Identifiers and revision*); its device
id is at most 114. A plugin fetches no code at run time: that is the manifest's word, and it is not checked. The
manifest is signed by its publisher; whose keys, and what the owner sees for an unsigned package,
are open (*What this standard does not define*). In this version what binds a package is the
`sha256` in the owner's `install`.

**Install and uninstall.** At level Host, the applier may send, always on the owner's behalf:
- `install { host, package: { url, sha256 }, account }`: `host` is the computer's device id, and
  `account` the token of the OS account the plugin runs as, which the owner chooses, since a
  publisher cannot know it. It is an interactive account, one `accounts` lists, so the plugin can
  reach that account's files and sessions; a non-interactive service account for a plugin is not
  yet designed (*What this standard does not define*);
- `uninstall { host, plugin }`, `plugin` being the plugin's `id`;
- `activate { plugin, version }`, when the owner adopts the first device of that version of the
  plugin; for a version with staged devices, only when the owner adopts one of them with
  `replaces` (*Staged versions*).

The bridge replies `accepted` within 1 s (GA-BRIDGE-4). It then fetches the package, checks that
its SHA-256 is `sha256`, reads the manifest, and keeps each installed file's SHA-256. Last, it sends
an `installed` event carrying the `requestId` and the manifest, or `install_failed` with the
`requestId` and a `reason` (`hash_mismatch` for a package that is not the one named;
`invalid_manifest` for a manifest that lacks what *The manifest* lists, whose `command` names a
file outside the package other than an interpreter as its first element, whose interpreter fails
its check, whose `cadenceMs` is above 300 000, whose extension key has a schema
that is not a scalar, or whose `id`, a `key` or `version` holds a character outside
`[A-Za-z0-9._-]` or is over its length;
`unknown_account` for an `account` that is not a token the computer's `accounts` lists), as a
`commission` ends in `commissioned` or `commission_failed`. An
install not ended within 600 s (⚠️ a guess) of its `accepted` ends then, `install_failed` with
reason `timeout` and nothing installed (GA-BRIDGE-68). An `install` whose `host` is not the
bridge's computer is answered `invalid_request`, and an `uninstall` of a plugin the bridge has not
installed on it `failed` with reason `unknown_plugin`, both within 1 s and with nothing done
(GA-BRIDGE-68).

A bridge that restarts, or loses power, while an `install` or an `uninstall` it accepted has not
ended keeps it (GA-BRIDGE-31), and ends it after its start with exactly one terminal event, as if
it had not restarted: an `install` in `installed` if it can resume and finish it, else in
`install_failed` with reason `restart` and nothing installed, within 600 s of its `accepted`, or
at once after its start if that time passed while it was down; an `uninstall` in `uninstalled`, once it has finished the removal (GA-BRIDGE-68). The
manifest the `installed` event carries is
the manifest **as installed**: the bridge keeps it, with the files' hashes, across its restarts, and
checks against it, never against a manifest read again from disk (GA-BRIDGE-31, GA-BRIDGE-44). An
accepted `uninstall` stops the plugin's server, removes its files and every device of every version
of it, as GA-BRIDGE-21 removes a device, and ends in `uninstalled` with the `requestId` and the
`plugin` (GA-BRIDGE-68). To a bridge that does not claim Host, `install`, `uninstall` and
`activate` are unknown ops, so `invalid_request`.

**A reinstall.** An `install` of a plugin version the bridge already has installed is a
**reinstall**, a repair. Its package's `sha256` MUST be the one the version was installed from, its
manifest the installed one's, and its `account` the one the version was installed for, or it ends
`install_failed` with reason `version_conflict` and changes nothing: a version is one package, run
as one account, and a changed one is a new version, which goes through adoption again. The bridge
keeps each installed version's `sha256` with its manifest. Otherwise the bridge stops that version's server, replaces its files with the
package's, keeps their new hashes, and ends in `installed`; the version's device ids and its
activation stay, so its devices stay adopted at the applier, and an activated version's server
starts again, verified as at any start. A reinstall whose files and tools then verify clears that
version's GA-BRIDGE-45 fault (GA-BRIDGE-57). An install after an `uninstall` is no reinstall: the
applier forgot the plugin's devices on `uninstalled` (GA-PROV-4), so they arrive new and
unadopted, under the ids they had before (GA-BRIDGE-35).

**An account deleted.** When the OS reports deleted the account a plugin runs as, its token is
retired (*Sessions*), and the plugin can no longer run as the account it was installed for: the
bridge stops its server, reports every device of the plugin `available: false`, and puts in its
`status` one `faults` entry of code `account_deleted` per device of the plugin, naming it, as for a
mismatch (GA-BRIDGE-45),
and does not start the server again. The version stays bound to the retired token, so a reinstall
of it ends `install_failed` with reason `version_conflict`, whatever account it names, never
`unknown_account`; the owner uninstalls the plugin and installs it for another account, which
clears the entries with its devices (GA-BRIDGE-67).

**Activation.** A plugin's server never starts before its version's `activate`. On `activate`, the
bridge replies `ok` within 1 s, once it has recorded the activation, or `failed` with reason
`unknown_plugin` for a plugin or version it has not installed (GA-BRIDGE-4). It then verifies the
installed files and tools (GA-BRIDGE-43, GA-BRIDGE-44) and starts that version's server. The start
shows in the devices' status and the roster; a mismatch shows as GA-BRIDGE-45 says. The bridge keeps
the activation across its restarts, and starts an activated version's server again at each of its
own starts (GA-BRIDGE-42). Before its version's activation, a plugin device is `available: false`.
After it, the bridge publishes each device of the version `available: true` within 1 s (⚠️ a
guess) of its server having served (*A server that stops*), at its first start after the `ok` and
after every restart, so that the applier can tell a status from before the activation from one
after it (GA-BRIDGE-58).

**A server that stops.** After the activation, a plugin device is `available: false` only while
its server cannot serve it: stopped for a mismatch (GA-BRIDGE-45), waiting for a session
(GA-BRIDGE-49), or exited, not answering, or never started. A server **has started** at its
first successful answer to the bridge: to `initialize` in MCP revisions before 2026-07-28, to
`server/discover` from that revision on, which has no `initialize`. A server **has served** once it has
answered its first state read since it was started. The server is the bridge's own child process,
so its exit is the bridge's own knowledge, as a protocol's word is, not a silence. The bridge
**probes** each server that has served at least every 10 s (⚠️ a guess) when no state read has
passed, so that a hung server is found whatever its `cadenceMs`; the probe is MCP's `ping` in
revisions before 2026-07-28, and `server/discover` from that revision on, which has no `ping`. A server that exits, one that has
served and then answers neither a state read nor a probe within 10 s (⚠️ a guess), and one that
has not served within 120 s (⚠️ a guess) of its start, make every device of the plugin
`available: false` at once, and the bridge stops it if it still runs and starts it again, verified
as at any start, backing off between tries to a ceiling of at least 60 s within 180 s (⚠️ a guess,
as GA-BRIDGE-11's) and of at most 300 s (⚠️ a guess), so that a server that recovers is tried again
within minutes, not hours, reset once a restarted server has served; a server stopped for a
mismatch, or for a deleted account (*An account deleted*), is not started again. A server whose
starts fail 5 times in a row (⚠️ a guess), each one exiting, stopping answering or not serving
within its start bound, puts in the bridge's `status` one `faults` entry of code `crash_loop` per
device of the plugin, naming it, which reaches the owner as a notice (GA-BUS-12), and the bridge keeps trying; the
entries clear once a restarted server has served (GA-BRIDGE-58). These times (the 10 s answer, the 120 s start, the backoff) are
kept on a clock that stops while the host is suspended, or are started again at resume, so that a
clock that kept running through a sleep does not find every server hung on waking. A device is never reported `available: false` because its server is still
starting, within those 120 s, at the activation or at the bridge's own start, nor because the
bridge stopped it while going offline itself: that is what lets the applier take a hosted device's
`available: false` after a wake as a definite answer (`standard/applier.md`, *Waking*), and a
starting server's devices simply have no check-in yet (GA-BRIDGE-58). A command to a device whose
server is still starting is acked `failed(unreachable)` within 1 s, since no tool can be called
yet (GA-BRIDGE-60).

**Plugin devices.** Each device the manifest declares becomes a device of the bridge, hosted by
the computer: its `devices` entry has `host` naming the computer, `plugin` and `version` naming
its plugin's `id` and version, the manifest's declarations, and `stableIdentifier`
`<computer stableIdentifier>/<plugin id>/<key>`, its host's identifier first, so that two PCs
hosting the same plugin show two identifiers, never one (GA-BRIDGE-69). The fields GA-BRIDGE-38 asks of every device, which a manifest does not give,
are fixed: `feedback: closed`, since its state is read; `reachMs` 0, since its server is the
bridge's own child; `model` `{ vendor: <plugin id>, model: <key> }`; and `classEvidence` `none`,
since its `proposedClass` is the publisher's word, read from no device (GA-BRIDGE-15). Its device id is `<plugin id>:<version>:<key>`, so that two
versions never collide; the design wrote it with `/`, which a device id in a topic cannot hold
(GA-BRIDGE-18). Its devices arrive unadopted (`standard/applier.md`, *Adoption*): adoption is the
owner's approval, and the owner's app shows each action with the tier it will have, and the keys
the manifest declares `selfChanging` and `personal` (`standard/applier.md`, *Plugins*). The applier
tells the bridge of the adoption with `activate`, and the bridge starts the plugin's server only
then (GA-BRIDGE-42). The bridge calls a tool only to serve a command, and the applier sends
none for an unadopted device, so no tool is called for one (GA-BRIDGE-46). Plugin devices share the
computer's bridge, so they go `dead` with it. If the manifest declares `needsSession` and the
chosen account has no graphical session, its devices are `available: false` until one starts
(GA-BRIDGE-49). The account has one while the OS reports a graphical session of it (*The
manifest*), locked, disconnected or not; an SSH login alone, though its key reads `active`, is no
session for a server that draws on a screen. A started server keeps running while its
session is locked or disconnected; it ends with the session, at a logout, and starts again in the
next one.

**Staged versions.** A new version is installed the same way, beside the old one, and is staged:
its devices carry the same `stableIdentifier`s as the installed version's, ids with the new
version, and `stagedFor` naming the device each would replace. Staging is not an admission, so
GA-BRIDGE-35 does not evict the installed device: both stay in `devices`. The old version's server
keeps running, and its devices stay, until the owner adopts a new device in its place, which the
applier sends as the new version's `activate`. Adopting a device of the new version that has no
`stagedFor` (a new key) does not activate it and swaps nothing; only an adoption with `replaces`
does. The bridge then verifies and starts the new server, and only once that server has served
(*A server that stops*) stops the old server and removes its devices as GA-BRIDGE-21 says. It
also ends the old version's activation and removes the old version itself, its files and its
manifest as installed, so that its own next start runs the new version's server only; it sends no
`uninstalled` for it, which would make the applier forget every version of the plugin (GA-PROV-4).
While the new server fails its check (GA-BRIDGE-45) or has not yet served, the old version stays as
it was, its server running and its devices in place, and the swap waits for a start of the new
server that serves (GA-BRIDGE-69). An `activate` naming the version whose server runs, while
another version's activation waits for its swap, cancels that pending activation: the bridge
replies `ok`, stops the new version's server if it runs, and never swaps to it later, at its own
next start included; the new version stays installed and staged, its devices keeping `stagedFor`,
until a later `activate` of it (GA-BRIDGE-69). That is how the applier withdraws an adoption whose
swap failed (`standard/applier.md`, *A pending replacement*). So the activation swaps the whole version: every device of the old one leaves,
those the owner has not yet adopted a replacement for included, and each device of the new version
keeps its `stagedFor`, naming the device it replaces, since the bridge does not know which of them
the owner has adopted; the applier keeps the owner's choice for each (`standard/applier.md`,
*Plugins*). What
changed between the two manifests is for the owner's app to show. There are no automatic updates.

**Commands.** The command's arguments, named as the manifest names them, become the tool's
arguments. A tool result with `isError` is `failed(no_confirmation)`, with the tool's text in
`detail`: the tool ran and may have acted, as with a tool that asks for input (GA-BRIDGE-47), so the
applier never reads it as a command that did not act. A success is `applied` when the action
declares `confirms: true`, and `sent` otherwise. After a tool call succeeds, the bridge reads the
device's state at once, within 1 s (⚠️ a guess) of the tool's result, so that a step need not wait
for the late read-back; that read-back, as late as *Commands* gives it (GA-BRIDGE-34), stays the
floor, made whatever the early read found (GA-BRIDGE-51). An `applied` from a plugin
is the plugin's word: the step is `acked` only when the confirming key reports, as for any device.

**State.** Each plugin device's state is an MCP resource its server serves, at the URI the
manifest's `stateUri` names for the device. Its content is one JSON object, `{ <key>: <scalar> }`,
over the device's declared keys: the state keys of its capabilities, its `sensorKeys` and its
extensions' keys, each value a string, a number or a boolean. Each becomes the reading of that name
in the device's status; a key the device does not declare, or a value that fails the key's declared
type, is left out and the rest published (GA-BRIDGE-1). A **change notification** is MCP's
`notifications/resources/updated` for that URI, on a subscription the bridge makes where the server
offers one (`subscriptions/listen` from MCP 2026-07-28, `resources/subscribe` in earlier
revisions); it carries only the URI, so the bridge then reads the resource. The bridge reads it at the
manifest's `cadenceMs` in any case, and that read is the floor: a server that offers no
subscription, or drops one, is still read. Each
successful read or notification is the device's check-in (GA-BRIDGE-37): its roster entry has
`basis` `poll`, the manifest's `cadenceMs`, and `basisMaxAgeMs` three times that, GA-BRIDGE-13's
poll case. A quiet player is therefore still live. A wake must not wait out a long cadence: the
bridge reads each activated plugin device's state within 10 s (⚠️ a guess) of its server having
started (*A server that stops*), and within 10 s of its own first `status` after
resuming, when a server that slept with the OS answers again without starting; a read that fails
there (a player still reconnecting to its app answers with an error) is tried again at least every
10 s (⚠️ a guess) until one succeeds, so that the first check-in does not wait for the cadence
either (GA-BRIDGE-60). Until then the device
has no check-in since the computer's return, whatever its `lastCheckIn` from before says. Whether
servers honour MCP's resource subscriptions is not yet tried against a real one; the spike the
design names should try it, and until then the cadence read carries the state alone.

The floors a bridge claiming Host keeps are in *Hosting*: pinning, no unapproved tools, no
authority to the plugin, and least privilege.

### The wake relay

A sleeping computer runs no bridge, so something else wakes it. A **wake relay** is a bridge at
level Serve, one per LAN segment, usually on the box, that sends Wake-on-LAN, run as a separate
component, as a deployed fleet runs one (GA-BRIDGE-55).
- Its transport is the LAN interface, `kind` `other`, `up` while the interface has a link and the
  gateway has answered ARP within the last 30 s, an exchange the relay makes at least every 10 s
  (GA-BRIDGE-23).
- Each entry holds a MAC address in the relay's own configuration, set by the owner outside this
  standard, and is a device: `stableIdentifier` that MAC, `proposedClass` null, `feedback: open`,
  `reachMs` 0, `internal: true`, and one action, `power.wake`, declared `confirms: false`, since a
  magic packet confirms nothing, so its ack is `sent`.
- The owner adopts an entry like any device, and pairs it with a computer at the applier
  (`wake_via`). Neither bridge knows the other. Wake-on-LAN is unreliable on laptops and over
  Wi-Fi, and asleep and off look the same on the network; whether the wake took is the applier's
  to judge, from the computer's own status (`standard/applier.md`).

### Liveness

A bridge publishes its `status` from its main loop, not from its MQTT client's thread, every 10 s,
and within 1 s of any change of a transport's `state` or a device's `observable` (GA-BRIDGE-17). A
bridge is dead 30 s after its last `status`, or at once on its will on `lwt` or a graceful
`offline` (GA-STATE-2). A bridge found dead for any reason, or seen
again after the applier reconnects, is live again only on a `status` published after the death,
never on a retained one (GA-BUS-8).

A will fires only when the broker loses the connection; a bridge whose main loop hangs while its
MQTT client keeps the connection alive never fires one, and its `status` stops. So the will gives
a quick answer when the connection drops, and the heartbeat catches the rest. The keepalive is at
most 10 s, so that `1.5 × keepalive + 10 s < 30 s`: the will arrives before the staleness window
closes, whenever the connection drops.

### Gaps

Every `event` carries the bridge's `instanceId` and a `seq`, increasing by one from 1 within an
instance (GA-BRIDGE-33). `instanceId` is a UUID, new on every start of the process (GA-BRIDGE-31).
On a gap in `seq`, an `instanceId` it has not seen, or its own reconnection, the applier sends
`snapshot` (GA-BUS-6), and the bridge re-publishes every retained topic, then replies
(GA-BRIDGE-30). A lost ack cannot be recovered; the no-ack column above covers it. A lost
`window_closed` or `other_admins_changed` is recovered from the snapshot's `devices`: the applier
raises the same notices from any unadopted device or new other admin it had not seen. A lost
`uninstalled` is recovered from it too: a plugin none of whose devices is left in a well-formed
`devices` that still lists its host has been uninstalled, and the applier takes it so (GA-PROV-4).

### The finder

A bridge learns of a device only on a radio or bus it owns. What is on the home's Wi-Fi, or
plugged into the box, is found by the **finder**: one process per box, which listens and reports
what it hears. It is not a bridge: it has no devices and takes no command.
- It listens on the sources the box gives it: mDNS, SSDP, DHCP, Bluetooth and USB. It is the only
  Galatea process that reports devices it does not hold, and the only one that holds
  `CAP_NET_RAW` for it. A bridge finds and follows its own held devices by its protocol's own
  means (an mDNS lookup of a name it holds, a Bluetooth connection to an address it holds), and
  anyone may answer such a lookup, so each later connection to a device taken through `connect`
  repeats its proof and discloses the credential to nothing that fails it (GA-BRIDGE-40); how the
  box shares a Bluetooth adapter between the finder and a bridge is the box's.
- It sends nothing but mDNS questions for the service types the manifests name, and for the SRV
  and TXT records of the instances the answers name and the address records of the hosts their
  SRV records name, and SSDP
  M-SEARCH, each repeated at least once an hour (⚠️ a guess, RFC 6762's longest query interval)
  and no more often than RFC 6762's continuous querying allows,
  since a device that has announced itself once may never announce again, and once at start. It
  hears DHCP and Bluetooth passively, a Bluetooth `localName` only as advertised, never from a scan
  response, and reads the box's own USB ports. It never connects to a device, and holds
  no credential for any device or account (GA-FIND-2). Only what the finder's own sockets send
  counts: a host mDNS daemon that answers for the box is the box's, and the harness's test
  interface runs none.
- It reports facts: what it heard, when, and which bridge types could take it. It keeps no owner
  decision; ignoring a candidate is the applier's (`standard/applier.md`, *Discovery*).

**The manifest.** A bridge type ships a manifest, `galatea-bridge.json`, whether or not a bridge of
that type is running: `{ bridgeType, name, version, connect, matchers }`.
- `bridgeType` names the type (`esphome`, `hue`, `zigbee`), not a running bridge.
- `connect` is `true` when a running bridge of the type can take what the finder heard on the
  network or over Bluetooth, by its address or `ble:` key, through `connect`. A USB candidate's
  match always says `connect: false`: what is plugged into the box is set up with the box's own
  tool.
- `matchers` is a list, possibly empty. Each matcher has one `source` and the fields for it:

| `source` | Fields | Example |
|---|---|---|
| `mdns` | `type`; optional `name` and `properties`, each a pattern | `_esphomelib._tcp.local.`; `_matterc._udp.local.` with `properties: { CM: "[123]" }`, a glob for one character of 1, 2 or 3 |
| `ssdp` | header values, all to match; description values are not matched, since reading them means fetching from the device | `{ st: "urn:schemas-upnp-org:device:ZonePlayer:1" }` |
| `dhcp` | `hostname` pattern, `macPrefix`, or both, when both must match | `{ hostname: "shelly*" }`; `{ macPrefix: "D4A651" }` |
| `bluetooth` | `localName`, `serviceUuid`, `manufacturerId` | `{ serviceUuid: "0000fff6-0000-1000-8000-00805f9b34fb" }` |
| `usb` | `vid`, `pid`; optional `serialNumber`, `manufacturer`, `description` | a Zigbee coordinator stick |

Every field a matcher has must match; a TXT property or header named in it must be present. Patterns
are shell globs as Python's `fnmatch` reads them, compared without regard to case, and a TXT
property or header is named without regard to case. The fields are a
subset of Home Assistant's, renamed to camelCase: most of its mDNS, DHCP, Bluetooth and USB
matchers translate directly, and its SSDP matchers only where they match headers; its DHCP
`registered_devices` and its Bluetooth `connectable`, `service_data_uuid` and
`manufacturer_data_start` have no counterpart. The schema is
`conformance/galatea-bridge.schema.json` (GA-BRIDGE-39). An ESPHome bridge's manifest:

```json
{
  "bridgeType": "esphome",
  "name": "ESPHome",
  "version": "0.1.0",
  "connect": true,
  "matchers": [
    { "source": "mdns", "type": "_esphomelib._tcp.local." }
  ]
}
```

How the box installs manifests, and which bridge types it has, are the box's.

**A candidate** is one thing the finder heard that at least one installed manifest matches:
`{ id, sources, keys, address?, firstSeen, lastSeen, hints, matches }` (GA-FIND-3).
- `keys` are identity keys, in one namespace, each in one canonical form, which a bridge uses in
  `connections` too:

| Key | Form | From |
|---|---|---|
| `mac:` | 12 upper-case hex digits, no separators | a DHCP request's `chaddr` |
| `usn:` | an SSDP `USN` up to any `::`, without a leading `uuid:`, lower-cased | SSDP |
| `mdns:` | the service instance name, with its type and domain, as on the wire: a dot inside a label written `\.`, ASCII letters lower-cased, every other byte as sent (`hall-satellite._esphomelib._tcp.local.`) | mDNS |
| `ble:` | 12 upper-case hex digits, only for a public or static random address | Bluetooth |
| `usb:` | `<vid>:<pid>:<serial>`, upper-case hex ids and the serial exactly as the device reports it (everything after the second `:`); for a device with no serial, `<vid>:<pid>@<port>`, the physical port path (`1-1.2`), stable while it stays in that port | USB |

  A device that rotates a private Bluetooth address has no stable key: it may show as a new
  candidate each time, and cannot be ignored for good. Behind a repeater that rewrites MAC
  addresses, every device's `mac:` is the repeater's, so their DHCP hearings are one candidate, and
  ignoring it ignores them all.
- A hearing gives one key, from its source; `keys` and `sources` are lists so that a later version
  may join a device's hearings. Hearings with the same key are one candidate. A device
  heard over mDNS and over DHCP is two candidates, both hidden once a bridge holds it with both
  keys in `connections`.
- `id` is the finder's, a random UUID in lower case set when the candidate is first published,
  never given to another candidate, and never changed while the candidate is listed: a candidate heard again at a new address keeps its `id`, and its `address`
  changes. A candidate dropped and heard again, or heard by a
  restarted finder, may get a new `id`.
- `address` is where the announcement says the device is: for mDNS, the SRV record's port and its
  target's IPv4 address where it has one, else its numerically lowest global unicast IPv6
  address, else its lowest unique local one (`fc00::/7`), never a link-local one, which cannot be
  dialled without its interface; for SSDP, the host and port of
  `LOCATION`; for DHCP, the address the device asked for, where it asked for one, which many do not; `{ path }` for
  USB; absent for Bluetooth. A network candidate with no address cannot be taken through `connect`.
  It is `{ ip, port? }` on the network. A record may name another host, such as a proxy; since a
  bridge takes only a device that proves itself, a wrong address gains an announcer nothing.
- `hints` are what the announcement said: `{ name?, vendor?, model? }`. They are unverified.
- `matches` is `[{ bridgeType, connect }]`, one for each manifest that matches, with its
  `connect`, except that a USB candidate's is always `false`.

Discovery is unauthenticated. Anyone on the LAN can announce anything, a key already known
included: that moves the candidate's `address`. The finder is a convenience; a device the owner expects and
does not see is set up as it would be without one. Nothing trusts a candidate: a bridge takes one
only through `connect`, and only a device that proves itself with a credential the owner set,
which it never discloses to a device that has not (GA-BRIDGE-40). A bridge has no use for the
finder's topics, and at Box cannot read them (GA-BOX-1).

**What a bridge adds.** A bridge whose type ships a manifest gives its `bridgeType` in its `status`,
and every device in `devices`, and every transport in `status`, carries in `connections` every
identity key the bridge knows for it (GA-BRIDGE-41), so the applier can see that a candidate is
already held. A bridge whose type ships no manifest, as every 0.2 bridge, may leave both out; it
takes no candidate, and leaves listed the candidates its devices would match. `connections` does
not replace `stableIdentifier`, which stays the protocol's own identity; the two may share a
value.

A candidate that needs a new bridge (a Hue hub, a Tuya plug whose key comes only from the owner's
account) is set up by the owner with the box's own tool, outside this standard. A Matter device
open for commissioning is a candidate of the Matter bridge's manifest; taking it is still
`commission`, with its setup code.

## The MQTT binding

The one binding. The applier, and every bridge on a box that claims Box, use MQTT 5. A bridge that
claims only Serve, Provision or Host MAY use MQTT 3.1.1, as many deployed bridges do: a broker that speaks MQTT 5
carries both versions side by side. It gives up one thing: a publish the broker refuses is dropped,
and a 3.1.1 client still gets a plain PUBACK, so the bridge cannot see the refusal. That matters
only where grants refuse anything, which is at Box. Message Expiry is not given up: the applier
sets it, and the broker drops an expired command whichever version the bridge speaks.

Every topic sits under `{root}/bridges/{b}/`, where `{root}` is the deployment's own (`demo/{site}`,
for example), and `{b}` is the bridge's authenticated identity. One grant on `{root}/bridges/{b}/#`
covers one bridge's tree, so a bridge cannot write another bridge's devices.

| Topic | Written by | QoS | Retained | Carries |
|---|---|---|---|---|
| `status` | the bridge | 1 | yes | *The bridge's status* |
| `lwt` | the broker, as the bridge's will; the bridge, only to clear it | 1 | yes | `{ bridgeId, instanceId }` |
| `devices` | the bridge | 1 | yes | *Devices* |
| `devices/{d}/status` | the bridge | 1 | yes | *A device's status* |
| `devices/{d}/command` | the applier | 1 | never | *Commands* |
| `devices/{d}/ack` | the bridge | 1 | no | *Commands*, the ack |
| `request/{op}` | the applier | 1 | never | *Requests and replies* |
| `reply` | the bridge | 1 | no | *Requests and replies* |
| `event` | the bridge | 1 | no | `{ seq, instanceId, type, ... }`: `joined`, `interviewed`, `left`, `window_closed`, `commissioned`, `commission_failed`, `connected`, `connect_failed`, `blocked_rejoin`, `other_admins_changed`, `installed`, `install_failed`, `uninstalled`, `occurrence` (*Occurrences*), `undescribed` (*A device's status*) |

***The bridge's status.** Every field is required unless its type
says optional, and an empty list is sent as `[]`, never left out:

| Field | Type | Notes |
|---|---|---|
| `bridgeId` | string | Stable across restarts; the same string as `{b}` in its topics, the ack's `source`, and the `identity` its applier registered |
| `instanceId` | UUID | New on every start of the process (GA-BRIDGE-31) |
| `v` | number | The binding's major version: 1. A bridge sets it once it meets this standard; a `status` without it is not this binding |
| `state` | `online` · `degraded` · `offline` | Derived from the roster: `online` when every device is observable or there are none, `offline` when there are devices and none is observable, `degraded` otherwise, and `offline` with `graceful` on a clean shutdown. The applier reads only `graceful` from it (*Liveness*) |
| `graceful` | `true`, optional | Only on the last status before a clean shutdown |
| `version` | string | The bridge's software version |
| `bridgeType` | string; required where its type ships a manifest, optional otherwise | Its manifest's `bridgeType` (GA-BRIDGE-41) |
| `levels` | list | The levels it claims |
| `faults` | list | Each `{ code, device?, topic?, detail? }`. The codes this standard names: `pin_mismatch`, a plugin's files or tools failed their check (GA-BRIDGE-45); `crash_loop`, a plugin's server failed 5 starts in a row (GA-BRIDGE-58); `account_deleted`, a plugin's account was deleted (GA-BRIDGE-67); `helper_refused`, a helper's report for another session, or a second helper's connection, refused (GA-BRIDGE-61); the finder's `overflow` (GA-FIND-4). Any other code is the bridge's own |
| `ungoverned` | list | GA-BRIDGE-32 |
| `blocked` | list | The blocklist's identifiers, at Provision |
| `testRunId` | string, optional | Only on the test transport (GA-BRIDGE-16) |
| `transports` | list | *Transports* |
| `devices` | list | The roster: *The roster and freshness* |
| `publishedAt` | time | When this status was published |

**The finder's topics** sit under `{root}/finder/`. A deployment runs at most one finder on its
`{root}`; at Box, the box's registration record names its identity (GA-BOX-2), and only it may
write there (GA-BOX-1). Below Box nothing checks `finderId`: a second finder would overwrite the
first's retained list, and hide its death.

| Topic | Written by | QoS | Retained | Carries |
|---|---|---|---|---|
| `status` | the finder | 1 | yes | `{ finderId, instanceId, v, levels, sources, faults, graceful?, testRunId?, publishedAt }`; `v` is the binding's, 1; `faults` as a bridge's; `sources` is `[{ source, state, reason? }]`, `state` being `up` (listening), `down` (failing, with a `reason`) or `off` (the box does not give it: no `CAP_NET_RAW`, no adapter) |
| `lwt` | the broker, as the finder's will; the finder, only to clear it | 1 | yes | `{ finderId, instanceId }` |
| `candidates` | the finder | 1 | yes | `{ publishedAt, candidates: [...] }`, the whole list |

- The finder connects with an authenticated identity, a clean session, a keepalive of at most
  10 s and its will on `lwt`, which it clears on connecting; publishes `status` from its main loop
  every 10 s and within 1 s of a source changing state, its times as GA-BRIDGE-3 says for a
  bridge's; and on a restart or shutdown publishes a
  last `status` with `graceful: true`, clears `lwt` and disconnects cleanly (GA-FIND-1). It is dead
  as a bridge is: 30 s after its last `status`, or at once on its will or a graceful `status`.
- It re-publishes `candidates` within 1 s of a candidate appearing, changing or being dropped (a
  new `lastSeen` alone is not a change, and is published with the next change or within the
  hour),
  and at most once a second. A candidate not heard for 7 days (⚠️ a guess: a DHCP-only device is
  heard only when it broadcasts, at boot or for a new lease, since its renewals go to the server
  alone; one that stays on may not be heard for weeks) is dropped; an mDNS goodbye or a USB unplug drops it at
  once (GA-FIND-4).
- It keeps at most 512 candidates (⚠️ a guess). Past that, it drops the longest unheard and says
  so in `faults`, so a flood of announcements cannot grow the list without bound; a quiet device
  it drops is listed again when next heard (GA-FIND-4).
- Under the harness, as a bridge's test transport is (GA-BRIDGE-16), the finder runs only with the
  harness's start-up option, which names its time source, its manifest directory and the network
  interface it listens on, and then carries the run's `testRunId` in `status` (GA-FIND-6).
- `status` lists every source, `off` for one the finder cannot use, so the owner sees that DHCP is
  not heard rather than conclude nothing is there (GA-FIND-5).

**Correlation.** A command's ack is matched by `commandId`, and a reply by `requestId`, in the
payload, on fixed topics, not by Response Topic. Idempotency on them absorbs QoS 1 duplicates.

**Message Expiry.** The applier publishes a command with a Message Expiry of its `resultWithinMs`,
rounded up to whole seconds, and every other request with 10 s. A command that waited in the broker past its bound is never
delivered, so it never runs late.

**Retained state** is safe only behind the applier's two checks: the bridge is live, and the
device's `lastCheckIn` is within its bound; a value's `timestamp` says how old the value is. A
bridge MAY set Message Expiry on retained state; it is hygiene only, since it counts from
publication, not observation.

**The will.** The will is on `lwt`, retained, carrying the bridge's `instanceId`, with a Will Delay Interval of 0 on
MQTT 5, so that a death is published at once. The bridge clears
`lwt` with an empty retained payload on connecting and before a clean shutdown (GA-BRIDGE-22), and
never otherwise publishes there. The
applier ignores a will whose `instanceId` is not the one in the bridge's latest `status`: it comes
from a process that is already gone. So an old instance's will that arrives before the new
instance's first `status` still names the latest `status`, and counts as a death, which that new
`status` then ends; one that arrives after it is ignored. A new instance that dies before its first
`status` was never seen live, and its bridge is found dead by staleness. Staleness is judged on the
applier's own clock, from when the latest `status` arrived; a retained `status` delivered on
subscribing (the RETAIN flag set on delivery, the applier subscribing with Retain As Published
off) does not count as arriving. Every death, by will, by staleness or by a
graceful `offline`, ends only on a `status` whose `publishedAt` is no earlier than the death, on the
applier's clock, less 5 s; one that does not end it changes nothing (GA-BUS-8).

**Connections.**
- Every client authenticates. Over TLS, by a client certificate: the identity is taken from the
  certificate (`use_identity_as_username` in Mosquitto), and the ClientID equals it. Plain TCP with
  a password is allowed on one host's loopback interface; and on a deployment that does not claim
  Box, on its local network, as many deployed bridges connect. Anyone who can read that network then holds
  the passwords, and can publish as the applier or a bridge: that deployment's applier shows
  `box: false`, and cannot claim Safe (GA-DESC-6).
- The bridge connects with a clean session (Clean Start and Session Expiry 0 on MQTT 5), a
  keepalive of at most 10 s, and its will on `lwt`. It subscribes to `devices/+/command`
  and `request/+` (with Retain Handling 2 on MQTT 5) before it publishes its first `status`
  (GA-BRIDGE-18, GA-BRIDGE-19). It never uses a shared subscription: two instances would split the
  commands between them.
- A second instance with the same identity takes over the first one's session, visibly, through the
  first one's will. A planned restart avoids that by going offline gracefully first (GA-BRIDGE-22).
- The applier connects with MQTT 5, Session Expiry 0 and Retain Handling 0, so that retained state
  loads.

**The test transport.** A bridge runs its test transport only when the harness's start-up option
enables it, and then says so in its `status` with the harness's run id as `testRunId`
(GA-BRIDGE-16). The test transport replaces the protocol stack below the bridge's own logic: it
scripts devices, routers and other controllers, and takes the harness's faults. A harness refuses a
bridge whose `status` does not carry its run id; that guards against a mistake, not a lie, since a
bridge wired to a real radio could claim the id. A real deployment can see a test bridge.

**The broker.** At Box, every client authenticates, loopback included, and none is anonymous. Only
the applier that registered bridge `{b}` may write that bridge's `devices/+/command` and
`request/+`; only bridge `{b}` may subscribe to them, so no one else can read a lock's commands or
stand in for the bridge; and only bridge `{b}` may write the rest of its tree. A doer's own command
topics on the same broker (zigbee2mqtt's `…/set`) are writable only by its bridge. A refused
publish or subscribe is refused visibly, with reason code `0x87` on PUBACK or SUBACK to an MQTT 5
client, and a publish with no subscriber is answered `0x10`. Nothing else on the broker writes a
command or a request, a rule engine included. Only the finder the box registers writes
`{root}/finder/#`, and only the applier the box registers for it reads it (GA-BOX-1). Below Box, a wildcard reader sees every
candidate, as it sees everything else.

**Who else may read.** The applier reads the whole tree but the commands and requests. At Box,
anyone else reads only what the owner grants, device by device: the box's tool turns each grant
into a literal subscription to one device's `status` in Mosquitto's dynamic-security plugin, with
no wildcard for readers, so a new device is unreadable until the owner grants it. The finder's
topics are the box's applier's only: a candidate list is a map of the home's network. A grant gives
the device's facts, not a verdict on them: it does not read the bridge's `status` or `lwt`, whose
roster tells when every device on the bridge last checked in, and so when each motion sensor and
door last fired. A reader that must know whether a value is current asks for the applier's
liveness through the steward, as any other client does. The tool refuses,
or makes the owner confirm a warning for, a grant on a device of class `door_lock`, on any device
with an action above `reversible`, or on any device whose `personal` is not empty, reading class,
tiers and `personal` from the applier's `describe`; it refuses a grant on an unadopted device, and
checks every grant again on the applier's `model` event when a device is adopted or its tiers or
its `personal` change, withdrawing within 60 s (⚠️ a guess) a grant
that no longer passes and telling the owner (GA-BOX-2). Whether a changed role reaches a subscription a
client already holds is checked by GA-BOX-2's probes before it is relied on (⚠️ not yet seen on a
real box).

The reference box bundles Mosquitto (EPL-2.0) with its dynamic-security plugin: its plain ACL file
grants every subscribe and filters only at delivery, so a denial there would be silent. EMQX is not
used (BSL since 5.9, so no embedding in a product for others). NanoMQ (MIT) is a lighter
alternative with a much smaller community.

### The applier's names

The applier's seams keep their own names. Where the applier's standard names a bridge's field, it
means this one:

| The applier's | On the bridge's wire |
|---|---|
| `last_check_in` | roster `lastCheckIn` |
| `fresh_s` (seconds), the bridge's | roster `basisMaxAgeMs` (milliseconds) |
| `basis_time` | a device status's `timestamp`, or its entry in `timestamps` |
| `stable_identifier` | `stableIdentifier` |
| `other_admins` | `otherAdmins` |
| `self_changing` | `selfChanging` |
| `confirmed_by`, `requested_tier`, `tool_hash` | `confirmedBy`, `requestedTier`, `toolHash` |
| `staged_for` | `stagedFor` |
| `proposed_infrastructure` | `proposedInfrastructure` |
| `reach_s` | `reachMs` |
| `proposed_class`, `class_evidence` | `proposedClass`, `classEvidence` |
| `command_id`, `request_id` | `commandId`, `requestId` |
| `result_within_s` | `resultWithinMs` |
| `window_s` | `windowMs` |
| `instance` | `instanceId` |
| `test_run_id` | `testRunId` |
| `bridge_type` | `bridgeType` |
| `first_seen`, `last_seen` | `firstSeen`, `lastSeen` |
| `awaited_keys` | `awaitedKeys` |
| `undescribed` | `undescribed`, each `{ name, firstSeen }` |
| `settings` | `settings` |

## The floors

### State

A bridge MUST stamp each reading with the time of the observation it rests on, never the time of
the message; MUST NOT report a value it cannot currently observe, a setting kept under GA-BRIDGE-79
excepted; MUST report its loss of contact
with a device as `available: false`, never as a value; and MUST leave out a field that fails its
declared type, publishing the rest (GA-BRIDGE-1). A deployed fleet's bridges once restamped a cached value
and once published `unknown` on losing a device.

A read of some keys MUST restamp only the keys it read (GA-BRIDGE-2).

Times MUST be RFC 3339 in UTC with milliseconds, and MUST NOT be more than 1 s ahead of true time
(GA-BRIDGE-3). A bridge cannot see its own clock's error, so it keeps its clock synchronised; the
applier's check is GA-BUS-2.

A reading MUST be one the device reported: a bridge MUST NOT publish optimistic state after a
command, or echo a commanded value (GA-BRIDGE-5); a setting the device confirmed, kept across a
restart (GA-BRIDGE-79), is not an echo. zigbee2mqtt's optimistic mode must be turned off
under a conforming bridge. The ack may say the protocol took the command (`applied`); a reading
never does, since the applier's `acked` rests on state.

### Commands

A bridge MUST answer every command with exactly one terminal ack within its time (*The command's
time*), and every request with a reply within 1 s of receiving it (`snapshot` aside, GA-BRIDGE-30),
which the harness measures from the publish, allowing the broker's delivery time it measures on its
own probes; each with a result or status defined here. It MUST serve a request with an unknown field
as if it were absent, except a key inside a command's `value`, which is `failed(invalid_request)`,
since the action run must be the one the applier authorised. A repeated `commandId` MUST get the
first ack again, or nothing more while the first is still running, and do nothing more; a request
repeated with the same `requestId` within 10 s (a QoS 1 duplicate) MUST get the first reply and do
nothing more, so a duplicated `join` does not restart a window; a `join` on a transport whose
window is open, or a `commission` while another runs, is `failed(busy)` (GA-BRIDGE-4).

A command for a device whose transport is `down`, or which is `available: false`, when it arrives
MUST be acked `failed(unreachable)` within 1 s; one for a device the bridge does not have MUST be
acked `failed(unknown_device)`, naming it, never met with silence; and a bridge MUST ack
`failed(unreachable)` or `failed(expired)` only for a command of which it transmitted nothing
(GA-BRIDGE-6).

A bridge MUST NOT start a command whose time has run out, and MUST ack it `failed(expired)`; MUST NOT
carry out, later, a command it acked `failed`; MUST hand a command to a queue for a sleeping device
only where the stack drops it when its time runs out; and MUST NOT offer an action on a device it
cannot reach within 145 s (GA-BRIDGE-7).

A bridge MUST ack `applied` only once the protocol has confirmed the command, never on handing it
to the radio; MUST declare `confirms: true` for every action whose protocol path can confirm it;
MUST ack `sent` only for an action it declares `confirms: false`; and MUST ack a confirmation that
never came as `failed(no_confirmation)` (GA-BRIDGE-8). A bridge that could confirm and says `sent`
would let an unconfirmed command pass as transmitted. Which paths can confirm is protocol truth, a
bench check for each reference bridge. In an earlier binding `applied` meant "the write was
accepted"; here it means the protocol said so.

A bridge MUST declare `toggles: true`, with `idempotent: false`, on every action the device carries
out by a code that reaches a state only from a known one rather than sets it: one that flips it (an
IR power code one press of which turns it on and the next off), cycles it (a mode or fan button
that steps to the next) or steps it relatively (vol+, temp+); and MUST NOT declare it on one
carried out by a code that sets it (a
discrete `on` or `off`, a set value); a code learned from a remote, taught by pointing the remote
at the transmitter, is one the bridge cannot classify, so an action carried out by a learned code
MUST be declared `toggles: true` unless the owner declared that code discrete when teaching it, in
the bridge's own configuration (GA-BRIDGE-71). The applier never sends a toggle to reach a state
on a `feedback: open` device without a person's yes, nor one of its own (`standard/applier.md`,
GA-PLAN-8, GA-SAFE-13). An applier older than 0.10 does not know
`toggles` and ignores it, as it ignores any field it does not know, and a bridge cannot see its
applier's version, so that is a stated limit (*What this standard does not define*). Which of a
model's codes toggle is the model's truth, a bench check for each reference bridge.

After an `applied`, a `sent` or a `failed(no_confirmation)` for a stateful action on a
`feedback: closed` device, a bridge MUST publish a fresh observation of every key the action sets
within the ack bound, reading it from the device if no report came (GA-BRIDGE-34). Without it, a
command whose target already held ends `failed(no_ack)`.

### Faults

A fault on one device or one transport MUST NOT stop the others. Losing the broker MUST be recovered
in-process, and MUST NOT change any device's `available` or `observable` because of the loss
(GA-BRIDGE-9).

A bridge MUST NOT exit on a recoverable fault: an error from a transport or a device that a retry
could clear (GA-BRIDGE-10). A deployed fleet's Zigbee bridge exited on every coordinator loss and
restarted 916 times.

Transport reconnection MUST back off exponentially to a ceiling of at least 60 s, reached within
180 s, and the backoff MUST reset only on a successful exchange as GA-BRIDGE-23 counts one, never on
a connect, except that a transmitter that can answer nothing, which has no exchange, resets it when
its host link opens again (GA-BRIDGE-72) (GA-BRIDGE-11). A half-open gateway once kept a
connect-reset breaker at its floor for
ever.

A bridge whose persisted state disagrees with its network (its store against the Matter fabric or
the Zigbee coordinator) MUST report the fault in its `status` and serve nothing until the owner
resolves it: it publishes every transport `down`, so that no device is planned, keeps publishing
its `status`, acks every command `failed(unreachable)` and replies `failed(state_mismatch)` to every
provisioning request (GA-BRIDGE-12). How the owner resolves it (restoring a backup, re-forming the
network) is the bridge's own tool's, outside this standard.

A transport MUST be `up` only on a successful exchange within the last 30 s, never on a connect
alone, and a bridge MUST make a health exchange with each transport at least every 10 s when
nothing else has passed, so that one lost exchange does not take a quiet network down
(GA-BRIDGE-23).

A transport that only transmits and can answer nothing on its host link MUST be `unknown`, never
`up`, and `down` only from its host reporting a write to it failed, or removing its host link,
until its host link opens again, which the bridge MUST retry on GA-BRIDGE-11's backoff without
transmitting, and then `unknown` again; a command whose write its host reports failed MUST be acked
`failed(unreachable)`; any other transport MUST be `up`
or `down`, never `unknown`; and every device on an `unknown` transport MUST be `feedback: open`
(GA-BRIDGE-72).

### Freshness and devices

Every `feedback: closed` device's roster entry MUST carry `basisMaxAgeMs` and `lastCheckIn`
(GA-BRIDGE-13, GA-BRIDGE-37). `basisMaxAgeMs` MUST be a bound the bridge knows from the protocol or
the model: for a `poll` basis, at most three times its `cadenceMs`; for a Matter subscription, the
granted maximum interval plus the controller's own configured slack; for a device that reports on
its own, twice the longest interval it is configured to report at, or its model's where none is
configured, no more; for the bridge's own host, observed at least every 10 s, 30 s; for a plugin
device, read at its manifest's `cadenceMs`, three times that, as a poll. Where the bridge cannot
know it, it MUST be
null, never a guess from the intervals the bridge happened to see (GA-BRIDGE-13). The applier reads
a device with a null bound as `stale`, and the owner may set one at the applier, which wins
(GA-STATE-6). A `feedback: open` device has no check-ins; its liveness is its transport's.

`otherAdmins` MUST be read from the protocol where the protocol shows it (Matter's fabrics); for a
Zigbee device, MUST be `[]` only once the bridge has read the binding tables of the devices on the
network and found none it did not make that targets the device, and the device is in no group the
bridge did not make, and `unknown` otherwise; a sleeping device's table is read at its next
check-in, so `unknown` is the usual state of a new Zigbee network for its first hours. Zigbee does
not report a new binding, so the bridge MUST re-read every table at least every 24 h (⚠️ a guess),
and a `[]` MUST become `unknown` while any device's table is unread or older than that, a device
that has joined since included (a binding lives on its source, so a bound remote acts on a valve
without the coordinator, and a device that does not answer the read is `unknown`); MUST be
`unknown` where the protocol cannot tell; and a change MUST be an `other_admins_changed` event
(GA-BRIDGE-14).

A bridge's `status` MUST carry the fields *The bridge's status* lists, with the full roster, and the
bridge MUST publish the retained `devices` document, listing every device in the roster, at every
level it claims, each entry with the fields *Devices* gives it: on a computer `accounts`, and
`personal` and `selfChanging` with every key *Computers* declares; on a plugin device `host`,
`plugin` and `version`, its manifest's declarations, `requestedTier` on its actions, `stagedFor`
from its staging on, kept after its version's activation (*Staged versions*, GA-BRIDGE-69), and
`feedback: closed`, `reachMs` 0, `model` `{ vendor: <plugin id>, model: <key> }` and
`classEvidence` `none`; on any device with extensions, `extensions`, and `confirmedBy` on each
stateful extension action; on a wake relay's entry `internal`. A declaration the standard makes
MUST NOT be left out (GA-BRIDGE-38).

`proposedClass` MUST state its evidence, and a bridge MUST NOT claim `protocol` evidence it did not
read from the device (GA-BRIDGE-15).

A bridge type that ships a manifest MUST ship one valid against
`conformance/galatea-bridge.schema.json` (GA-BRIDGE-39). A bridge of such a type MUST give that
manifest's `bridgeType` in its `status`, and MUST carry on every device and transport, in
`connections`, every identity key the bridge knows for it, in its canonical form (GA-BRIDGE-41).

`lastCheckIn` MUST be when the device's latest check-in reached the bridge, never the
time of a publish, a restart or a read of the bridge's own cache, and MUST be kept across a restart;
and a device's status MUST be published within 1 s of each report that changes a reading or its
time (GA-BRIDGE-37). A PC's bridge MUST observe its own host at least every 10 s and count each
successful observation as the computer's check-in; a plugin device's check-in is each successful
read of its state or change notification from its server (GA-BRIDGE-37).

### Connection

A bridge MUST connect as *Connections* says, and MUST subscribe to its commands and requests before
it publishes its first `status` (GA-BRIDGE-18). Announcing `online` while unable to receive a
command is a claim the bridge cannot honour.

A bridge MUST NOT act on a retained command or request, and on MQTT 5 MUST subscribe with Retain
Handling 2 (GA-BRIDGE-19).

A bridge MUST check every SUBACK, and on MQTT 5 every PUBACK, and MUST report a refusal (`0x80` on
an MQTT 3.1.1 SUBACK, `0x87` on MQTT 5) as a fault in its `status`, naming the topic, never ignored
(GA-BRIDGE-20). Most client libraries report a refused 3.1.1 subscription as a success with a
granted QoS of 128.

A bridge MUST publish its `status` from its main loop at least every 10 s, and within 1 s of a
transport's `state` or a device's `observable` changing (GA-BRIDGE-17). A status published from the
MQTT client's own thread would go on while the main loop hangs.

A removed device's retained status MUST be cleared with an empty payload, and the device MUST leave
the roster and `devices` (GA-BRIDGE-21).

A bridge restarting or reloading MUST first unsubscribe from `devices/+/command` and `request/+`
and wait for the broker's UNSUBACK, so that no command or request arrives after it; close any open
join window, with its `window_closed`; end every `connect` in flight with the device it has
taken or `connect_failed(unreachable)`; then ack every command still in flight, as *Commands* says
for one it cannot finish: `failed(unreachable)` for one it has not yet transmitted, and
`failed(no_confirmation)` for one it has, which owes no read-back (GA-BRIDGE-34), since the
instance that sent it is going, then publish `offline` with `graceful: true`, clear its `lwt`, and
disconnect cleanly (reason `0x00` on MQTT 5) so that the broker discards its will, before its new
instance connects (GA-BRIDGE-22). A takeover without that fires the old will, and the applier
rightly counts it a death. A PC's bridge MUST publish the terminal ack of a `sleep` or `shutdown`,
`applied` once the OS accepted it, before its graceful `offline` and before clearing `lwt`; MUST,
where the OS offers a way to hold a suspend (a delay inhibitor, a suspend notification it waits
on), hold it until that ack is published (⚠️ a bench check on each OS); and MUST go offline
gracefully, in the same order, on any suspend or shutdown the OS announces to it (GA-BRIDGE-22).

The test transport MUST run only when the harness's start-up option enables it; the `status` MUST
then carry the run's `testRunId`; and the bridge MUST then take all time, elapsed time included,
from the harness's time source, which the same start-up option names, as an applier's `configure`
names it (GA-HARN-1) (GA-BRIDGE-16). It offers devices the
harness scripts to join, report, check in, fall silent, fail attestation, change controllers and die.

### Provisioning

A Zigbee transport MUST run on a network key and PAN id generated for that installation, never a
well-known default: the stack's shipped values, or a key published anywhere (GA-BRIDGE-24).

A join window lasts the lesser of its `windowMs` and the transport's own cap (254 s for Zigbee),
never longer; MUST close at once on `join_close`; and `window_closed` MUST carry every device that
joined and the window's effective `windowMs`, the lesser of the requested one and the transport's
cap, whether or not `join_close` ended it early (GA-BRIDGE-25).

`near` MUST be honoured where the transport can open a window at one router (GA-BRIDGE-26).

`remove` with `blockRejoin` MUST keep that `stableIdentifier` out of the network until `unblock`
names it: out of every later window and every `connect`, and, where hardware removed with `force` still holds the
network key and rejoins secured, removed again at once and reported by a `blocked_rejoin` event,
never as an admission, so it adds no device; `remove` with `force` MUST drop the device even if it
cannot answer; `join_close`, `remove` and `unblock` MUST be idempotent; and a `remove` of an
identifier the bridge never had MUST be `failed(unknown_device)` (GA-BRIDGE-27).

`join` on a transport that has no join window, or `commission` on one with no setup codes, MUST be
`invalid_request` (GA-BRIDGE-28).

`commission` MUST refuse a device that fails Matter's device attestation, unless the request carries
`acceptUnattested` (GA-BRIDGE-29). matter.js accepts every attestation finding by default.

A `connect` accepted by a bridge whose manifest says `connect: true` MUST end in `connected`,
naming the one device the bridge now holds, or `connect_failed` with a `reason`,
within 60 s (⚠️ a guess) of its receipt; a bridge MUST take only a device that proves its identity
as *Provisioning* defines it and shows one of the candidate's keys, ending a failed handshake, or
one showing another secret, `connect_failed(unproven)`, and one showing none of the keys
`connect_failed(refused)`, and MUST NOT disclose the credential to a
device that has not proved it (a bench check for each reference bridge, *not checked by the
harness*, whose test transport replaces the stack that makes the handshake); a `connect` whose
proven device the bridge already holds MUST be `connected` naming it, and admit, evict and
re-point nothing; a bridge MUST re-publish `devices`, with the new device's `connections`, before
its `connected`; each later connection to a device taken through `connect` MUST repeat its proof,
and MUST NOT disclose the credential to a device that fails it; a `connect` repeated with the same
`requestId` while the first runs MUST get the first reply and do nothing more, however late; a
`connect` with a new `requestId` while another runs on the same bridge MUST be `failed(busy)`; a `connect` whose identifier is blocked MUST be
`connect_failed(refused)` (GA-BRIDGE-27); a `connect` to loopback, however written, an IPv4-mapped
IPv6 address included, to a multicast or broadcast address, to an IPv6 link-local address, to an
address of the box's own interfaces, the host's included, or of the box's own container networks
MUST be `connect_failed(refused)` with no connection opened; and a bridge
whose manifest does not say `connect` MUST answer it `invalid_request` (GA-BRIDGE-40).

### Snapshots, restarts and native control

On `snapshot`, a bridge MUST re-publish its `status`, `devices` and every device's status, and then
reply `ok`, within 10 s of receiving it (GA-BRIDGE-30).

Every `event` MUST carry the bridge's `instanceId` and a `seq` that starts at 1 in each instance and
increases by one with every event (GA-BRIDGE-33). A gap is how the applier knows it missed one.

A bridge MUST keep across a restart its blocklist, each device's `lastCheckIn` and each device's
`otherAdmins`, its kept settings, the keys it has reported once and its `undescribed` list, and, at Host, each installed version's manifest as installed and its files' hashes,
and each `install` or `uninstall` it accepted and has not ended, with its `requestId`; and MUST
take a new UUID as its `instanceId` on every start (GA-BRIDGE-31). Without
them, a restart reopens the door the blocklist closed, every sleepy sensor reads `stale` until it
next checks in, every Zigbee device's other admins go back to `unknown`, a plugin whose files
were changed while the bridge was down is checked against the changed manifest, and an install
the restart cut short never ends.

A bridge MUST disable every way its doer can change a device, or open a join window, without a
request from its applier (a web frontend, a Touchlink button, a stack's own automations), or list
each one it cannot disable in its `status` as `ungoverned` (GA-BRIDGE-32). The applier lists them
in its own `ungoverned`, so an applier over such a bridge cannot claim Safe. A doer's command topic
on the broker that GA-BOX-1 closes to everyone but the bridge counts as disabled. The harness checks
the paths of the reference doers it knows; that the list is complete is the bridge author's word,
*not checked by the harness*. On a computer, the OS's own automations (a sleep when idle, a restart
for updates) and a person at the PC are the device's own behaviour, not such a way, and are not
listed; a PC's administrators and a plugin app's own network control are `otherAdmins`
(GA-BRIDGE-53), not `ungoverned` (GA-BRIDGE-32).

### Computers and the wake relay

A computer MUST carry one `session.<token>` key per interactive OS account, with the token derived
as *Sessions* says, fixed when the bridge first sees the account, keyed by the OS's own identity
for it (the uid, the whole SID), and kept across the bridge's restarts and the account's renames,
never the OS name where that fails the token rule, never a number taken from the last part of a
SID, never one another account holds or once held, and never the name where it matches `u[0-9]+`
or `g[0-9]+` or is `unknown`; an account with several sessions MUST carry one key, reading the most
in-use state any of them reads, in the order `active`, `idle`, `unknown`, `locked`,
`disconnected`, `none`; the token of an account the OS reports deleted, or of a directory account
the directory itself reports as not existing (an authoritative answer, not a cache miss or an
unreachable directory), MUST be retired, its key and its
`accounts` entry removed, and never given again, a later account with the same uid or SID getting a
new one, and an account merely absent from a listing MUST keep its token and its key; each token
MUST be declared in `accounts`; the
system service MUST read `none`, `locked` and `disconnected` itself, without the helper, and MUST
take only `active` or `idle` from a helper, and only for a session the OS reports neither locked
nor disconnected; a
logged-in graphical session that is neither locked nor disconnected, with no helper running, MUST
read `unknown`, never `available: false`; and a non-graphical one (an SSH login, or any the OS
reports so: on Linux a logind session whose `Type` is not `x11`, `wayland` or `mir`, on Windows
session 0) MUST be read from the OS alone, `active`, or `idle` where the OS reports idleness, and MUST join the account's key
only while the account has no graphical session (GA-BRIDGE-52).

A PC's bridge MUST report `otherAdmins` on the computer and on each plugin device, one
`{ vendor: "os", label: <token> }` per administrator account (an administrator as *The PC's
administrators are other admins* defines one: on Windows a member of Administrators or Backup
Operators, an account holding `SeDebugPrivilege`, `SeTakeOwnershipPrivilege`, `SeRestorePrivilege`
or `SeBackupPrivilege` through local policy, and on a domain-joined machine a member of Server
Operators or Account Operators; on Linux root, every account sudo or polkit lets run any command as
root, one command being enough, every identity polkit's administrator rules name, and every member
of the `docker` group), and per group granted the rights, whose token is `g` and a number, and MUST
add one entry `{ vendor: "os", label: "unknown" }` where it cannot enumerate that set (a polkit rule
it cannot reduce to users and groups, a sudo grant whose users or root target rest on an alias or a
digest it does not evaluate, a Windows local policy it cannot read), re-read at start, on every change
of the administrators group the OS reports, and at least every 24 h (⚠️ a guess), a change being an
`other_admins_changed` event; MUST list on each plugin device, in the same shape, the account its
plugin runs as, unless it is listed already as an administrator, and on the computer too where the
plugin's manifest declares `needsSession`; and MUST copy each entry of a
plugin's manifest's `otherAdmins`, its app's own network control, to every device of that plugin,
never reporting it as `ungoverned` (GA-BRIDGE-53). Its enumeration of the administrators, the
`unknown` entry included, is graded on a real OS (*Conformance*).

A PC's bridge MUST bind each session helper to its session by the OS identity of the helper's
connection (the session id and uid the OS reports for it), never by what the helper says; MUST
ignore a helper's report for any other session; MUST name such a report as a `faults` entry of
code `helper_refused` on the computer; MUST bind one helper per session, the one the service
started in it, and refuse, and name as a `faults` entry of code `helper_refused` on the computer, a
second connection from that session or one from a
plugin server's process; and MUST take `app`, `camera_in_use` and `microphone_in_use` only from the helper of
the session the OS reports active at the console, ignoring any other helper's report of them
(GA-BRIDGE-61). Its binding of a helper is graded on a real OS (*Conformance*).

A PC's bridge MUST keep its broker credential readable only by its system service and the OS's
administrators, and MUST create and own the endpoint its session helpers connect to, so that no
other process can bind, replace or listen on it (GA-BRIDGE-64). Graded on a real OS (*Conformance*).

A PC's bridge that runs on its broker's own host, reaching it over loopback or through one of its
own host's addresses, MUST declare `proposedInfrastructure: true` on its computer (GA-BRIDGE-65).

A computer's `notify` MUST list `from` among its `args`; a `notify` to a computer MUST be shown
in every logged-in session that is neither locked nor disconnected and has a running helper, and,
shown in none, MUST
be acked `failed` with reason `not_shown`, never `applied` (GA-BRIDGE-62). Which sessions were asked to show it
is read from the test transport's notification hook.

A computer's `cancel` MUST be acked `applied` when nothing is scheduled (GA-BRIDGE-63).

A computer's `session.lock` MUST be declared `confirms: true` and `idempotent: true`, with `args`
declaring `account` as the tokens `accounts` lists; a lock naming any other token MUST be acked
`failed(invalid_request)` within 1 s, nothing done; it MUST lock
or disconnect every graphical session of the account; it MUST be acked `applied` only once the OS
reports every one of them locked or disconnected, or the account has no session at all, a
non-graphical session (an SSH login) not blocking the ack beside a graphical one; it MUST be acked
`failed` with reason `no_graphical_session` within 1 s of its receipt, never `applied` or
`not_locked`, for an account whose only sessions are non-graphical; and it MUST be acked `failed` with reason `not_locked` when a graphical session is
not so reported within 5 s (⚠️ a guess) of the request (GA-BRIDGE-66). The harness reads which sessions were asked to
lock, and what the OS then reports, from the test transport.

A wake relay's transport MUST be `up` only while its interface has a link and the gateway has
answered ARP within the last 30 s; each entry MUST be `feedback: open`, `internal`, with
`proposedClass` null, and offer only `power.wake`, declared `confirms: false` (GA-BRIDGE-55).

On resuming, where the OS offers a way to, a PC's bridge MUST have the OS step its clock to its
time source before its first `status`, waiting at most 10 s (⚠️ a guess) for it (GA-BRIDGE-59).

A bridge that lists `from` among its `notify` action's `args` MUST show it with the text, and
MUST show a `notify` without `from` as from an unknown sender, never unmarked (GA-BRIDGE-56). What a screen shows is judged, not read from the wire: the harness records what
the test transport's notification hook was asked to show, and a person grades it (*Conformance*).

### Hosting

On a bridge claiming Host, a plugin's install directory MUST be writable only by the bridge's
system service (GA-BRIDGE-70).

A plugin's server MUST be verified and started by the bridge itself, in the chosen account's
graphical session where its manifest declares `needsSession` (its console session if it has one,
on Linux its session on `seat0`, else the graphical one the OS started first, by the session time *The manifest* names, a tie going
to the lower session id, compared as numbers where both read as integers, else in byte order),
never by a session helper, and never before its version's
`activate`; `activate` MUST be answered `ok` within 1 s, or `failed(unknown_plugin)` for a version
not installed, and the activation MUST be kept across the bridge's restarts (GA-BRIDGE-42).

`install` and `uninstall` MUST be answered `accepted` within 1 s; every accepted `install` MUST end
in exactly one `installed`, carrying the manifest, or `install_failed`, with a `reason`, within
600 s (⚠️ a guess) of its `accepted`, one not ended by then being `install_failed` with reason
`timeout` and nothing installed, and every accepted `uninstall` in `uninstalled`, once the
plugin's server is stopped, its files removed, and every device of every version of it removed as
GA-BRIDGE-21 says; a package whose SHA-256 is not the request's `sha256`, or
whose manifest's `command` names a file outside the package other than an interpreter, by name,
as its first element, found in a directory the plugin's account cannot write without elevation
(*The manifest*), MUST be `install_failed` with nothing
installed, and so MUST one whose interpreter, resolved by the bridge to an absolute path in the
plugin account's search order, is a file, or has a directory on its path or earlier in that search
order where the name would have been looked for, that the account can write without elevation, or
whose manifest has a `cadenceMs` above 300 000 (⚠️ a guess) or an
extension key whose schema is not a scalar, or an `id`, a `key` or a `version` holding a character
outside `[A-Za-z0-9._-]`, an `id` or a `key` over 40 characters or a `version` over 32, with reason
`invalid_manifest`; the bridge MUST record the interpreter's absolute path with the manifest as
installed and start the server by that path, never by name; and an `install` whose
`account` is not a token the computer's `accounts` lists, with reason `unknown_account`; an
`install` whose `host` is not the bridge's computer MUST be answered `invalid_request`, and an
`uninstall` of a plugin not installed there `failed(unknown_plugin)`, each within 1 s with nothing
done; an `install` or `uninstall` accepted and not ended when the bridge restarts MUST end after
its start in exactly one terminal event, an `install` in `installed` or in `install_failed` with
reason `restart` and nothing installed, within its 600 s or at once if they passed while the bridge
was down, and an `uninstall` in `uninstalled`; and `install` and `uninstall` repeated by `requestId` within 10 s are duplicates (GA-BRIDGE-4)
(GA-BRIDGE-68).

A plugin device MUST have `stableIdentifier` `<computer stableIdentifier>/<plugin id>/<key>`, its
host's identifier first, the device id
`<plugin id>:<version>:<key>` and `host` naming the computer; a staged device MUST name in
`stagedFor` the device it would replace; and the old version's server MUST keep running, and its
devices stay, until the new version's `activate`, which for a version with staged devices comes
only on an adoption with `replaces`, after which the new server starts, and only once it has
served the old server stops and all its devices leave as GA-BRIDGE-21 says, while every device of
the new version keeps its `stagedFor`; the old version MUST stay as it was, its server running and
its devices in place, while the new server fails its check or has not served; and the swap MUST end
the old version's activation and remove the old version, so that no later start of the bridge starts
its server, with no `uninstalled` event; and an `activate` naming the version whose server runs,
while another version's activation waits for its swap, MUST cancel that pending activation, so
that the bridge stops the new server if it runs and never swaps to it later, its own next start
included (GA-BRIDGE-69).

The bridge MUST keep each installed file's SHA-256 at install, and MUST verify the installed files
against them at every start of the plugin's server (GA-BRIDGE-43).

The bridge MUST compare the live tools with the `toolHashes` of the manifest as installed (the one
its `installed` event carried), never with a manifest read again from disk, each a SHA-256 over the
RFC 8785 canonical JSON of the tool's `name`, `title`, `description`, `inputSchema`,
`outputSchema` and `annotations`, at every start of the server and on every `tools/list` change the
server announces (`notifications/tools/list_changed`). A live tool absent from the manifest, a
missing tool, or a changed hash is a mismatch (GA-BRIDGE-44).

That is the limit of pinning. A server that never announces a change is compared only at its
start. The interpreter and libraries its `command` runs, outside the package, are not pinned.
Pinning detects a changed package; it is not a sandbox, which is GA-BRIDGE-50's. And what a
plugin's actions declare (`confirms`, `confirmedBy`) is the publisher's word, as the tools'
descriptions are: the confirming key is reported by the same server that ran the tool, so a
plugin device's `acked` rests on the plugin's own report, not on a protocol's as a Zigbee or Matter
device's does. The harness does not check a plugin's honesty; what the owner is told of it is the
owner's app's (*What this standard does not define*).

On a mismatch of files or tools, the bridge MUST stop the server, report every one of the
plugin's devices `available: false`, and put in its `status` one `faults` entry of code
`pin_mismatch` per device of the plugin, naming it, which reaches the owner as a notice
(GA-BUS-12); and MUST clear them only on a
reinstall of that version that verifies (GA-BRIDGE-57), or on a new version (GA-BRIDGE-45).

A reinstall, an `install` of a version already installed, MUST end `install_failed` with reason
`version_conflict`, changing nothing, when its package's `sha256` differs from the one the version
was installed from, its manifest from the installed one's, or its `account` from the one the
version was installed for; and
otherwise MUST replace the version's files and their hashes, keep its device ids and its
activation, start an activated version's server again, verified as at any start, and end in
`installed` (GA-BRIDGE-57).

When the OS reports deleted the account a plugin runs as, the bridge MUST stop the plugin's server
and not start it again, report every one of its devices `available: false`, and put in its `status`
one `faults` entry of code `account_deleted` per device of the plugin, naming it, until the plugin
is uninstalled; and a
reinstall of that version MUST end `install_failed` with reason `version_conflict`, whatever
account it names (GA-BRIDGE-67).

The bridge MUST NOT call a tool the manifest does not map to an action, and MUST call a tool only
to serve a command (GA-BRIDGE-46).

The bridge MUST NOT relay a plugin's elicitation or sampling; an action whose tool asks for input
MUST end `failed(no_confirmation)`, since the tool was already called and may have acted
(GA-BRIDGE-47).

The bridge MUST NOT pass a broker credential, a confirmation token or a user credential to a
plugin (GA-BRIDGE-48).

A plugin's server MUST run as the account the owner chose, and never elevated: never SYSTEM or
root; on Windows with the account's filtered token, even when the account is an administrator; on
Linux with `no_new_privs` set, so that neither sudo nor a setuid program can raise it; and if its
manifest declares `needsSession` and the account has no graphical session (*The manifest*; an SSH
login alone is none), its devices MUST be `available: false` until one starts, and a started server MUST keep
running while its session is locked or disconnected (GA-BRIDGE-49). An administrator's account is allowed, since a game launcher must run as its
player. Said plainly, this is best effort: Windows' filtered token is not a security boundary, and
a plugin running as an administrator can raise itself; on Linux, `no_new_privs` does not stop what
polkit or D-Bus grants the account. That is why the PC's administrators are other admins of its
devices (GA-BRIDGE-53).

After its version's activation, a plugin's devices MUST be `available: false` only while its server
cannot serve them (a mismatch, a `needsSession` with no graphical session, a server that exited, one that has
served and then answered neither a state read nor a probe within 10 s, or one that has not
served within 120 s of its start, each ⚠️ a guess), and at once when its server exits or stops
answering so; the bridge MUST probe each server that has served at least every 10 s (⚠️ a guess)
when no state read has passed; it MUST then start the server again, verified as at any start,
backing off to a ceiling of at least 60 s within 180 s and of at most 300 s (⚠️ a guess), except
one stopped for a mismatch or for a deleted account (GA-BRIDGE-67); when its starts fail 5 times
in a row (⚠️ a guess), each exiting, not answering or not serving within its start bound, it MUST
put in its `status` one `faults` entry of code `crash_loop` per device of the plugin, naming it,
and clear them once a
restarted server has served; it MUST keep these times on a clock that stops while the host is
suspended, or start them again at resume; it
MUST NOT publish them `available: false` because their server is still starting, within those
120 s, at the activation or at the bridge's own start, or because the bridge stopped it while going
offline; and it MUST publish them `available: true` within 1 s (⚠️ a guess) of their server having
served, after the activation and after every restart of it (GA-BRIDGE-58).

A PC's bridge MUST read each activated plugin device's state within 10 s (⚠️ a guess) of its server
having started (its first successful answer to `initialize`, or to `server/discover` from MCP
2026-07-28), and within 10 s of its own first `status` after
resuming, whatever the manifest's `cadenceMs`, and, where that read fails, MUST read again at
least every 10 s (⚠️ a guess) until one succeeds; and MUST ack a command to a plugin device whose
server is still starting `failed(unreachable)` within 1 s (GA-BRIDGE-60).

The bridge SHOULD sandbox a plugin's server to its package files and the manifest's `hosts`
(GA-BRIDGE-50).

A command to a plugin device MUST be acked `failed(no_confirmation)` on a tool result with
`isError`, since the tool ran and may have acted, with the tool's text in `detail`; on success
`applied` only for an action declared `confirms: true`, and `sent` otherwise; and after a
successful tool call the bridge MUST read the device's state within 1 s (⚠️ a guess) of the tool's
result, and still make GA-BRIDGE-34's read-back (GA-BRIDGE-51).

### No remote shell

A bridge MUST NOT offer, among its own actions, one that executes its arguments as a command, a
script or code, or hands them to an OS handler that may, such as one that opens a file or a URL
(GA-BRIDGE-54). HASS.Agent runs any payload a custom command receives, a remote shell through
MQTT, and an OS's "open this" handler runs executables and custom schemes. For a plugin's actions
this is the manifest's word, checked by the owner at adoption; that is the honest limit of the
floor. An owner who adopts a plugin that drives a browser has chosen general computer use for that
device.

### The box

The broker the box runs MUST authenticate every client, loopback included, over TLS or on one
host's loopback; MUST speak MQTT 5 to the
applier and to every bridge on it; MUST refuse a forbidden publish or subscribe visibly, with
`0x87`, and answer a publish with no subscriber with `0x10`; MUST let only the applier registered
for bridge `{b}` write its commands and requests; only bridge `{b}` subscribe to them and write the
rest of its tree; only the doer and its bridge read or write the doer's own topics (zigbee2mqtt's
whole tree); any other client read only the devices' statuses the owner granted it, each by a
literal subscription, with no wildcard; and nothing else on it may write a command or a request, a
rule engine included (GA-BOX-1). Its tool MUST refuse, or make the owner confirm a warning for, a
grant on a `door_lock`, on a device with an action above `reversible`, or on a device whose
`personal` is not empty, since a grant on it is a grant to read what a person is doing, and MUST
check every grant again whenever a device is adopted or its tiers or its `personal` change
(GA-BOX-2).

The grants are the box's: the box keeps a registration record, one applier per bridge identity,
the finder's identity and the one applier that reads it, and each reader's grants, which the owner edits with the box's own tool, outside this standard; no
applier holds the right to change the broker's grants; and a second entry for a bridge identity
already registered MUST be refused until the owner removes the first (GA-BOX-2). An ACL change MUST
be verified to have taken effect, by one forbidden and one permitted publish, and, for a reader's
grant withdrawn, by a message the reader no longer receives on a subscription it already held,
before it is relied on; and the box MUST keep a record of each verification (GA-BOX-2). The check
reads that record and replays the probes.

The broker MUST let only the finder the box registers write `{root}/finder/#`, and only the box's
applier read it (GA-BOX-1).

### The finder

The finder MUST connect, publish its `status` and go as *The finder's topics* says: an
authenticated identity, a clean session, a keepalive of at most 10 s, its will on
`{root}/finder/lwt`, carrying its `instanceId` and cleared on connecting; MQTT 5, checking every
SUBACK and PUBACK and reporting a refusal in `faults`, as a bridge does (GA-BRIDGE-20); `status`
from its main loop at least every 10 s and
within 1 s of a source changing state; and on a restart or shutdown a last `status` with
`graceful: true`, `lwt` cleared and a clean disconnect (GA-FIND-1).

On every interface, its broker connection aside, the finder MUST send nothing but
mDNS questions for the service types the installed manifests name, for the records of the
instances the answers name and for the address records of the hosts their SRV records name, and
SSDP M-SEARCH. It MUST NOT connect to a device, and MUST publish only under `{root}/finder/`
(GA-FIND-2). It MUST hold no credential for any device or account (*not checked
by the harness*). It holds the most network privilege on the box, so it does the least with it.

The finder MUST publish a candidate only for a match of an installed manifest, every field of the
matcher matching, with its `id`, `sources`, `keys` in their canonical forms, `address` as *The finder* says, a
Bluetooth `localName` only as advertised, never from a scan response,
`firstSeen`, `lastSeen`, `hints` and `matches`, a USB candidate's `connect` always `false`; MUST
make hearings that share a key one candidate; MUST make each `id` a random UUID never given to
another candidate; and MUST NOT change a candidate's `id` while it is listed (GA-FIND-3).

The finder MUST re-publish `candidates` within 1 s of a change and at most once a second, a new
`lastSeen` alone being no change, and publish a new `lastSeen` within the hour; MUST drop a
candidate at once on an mDNS goodbye or a USB unplug, and one not heard for 7 days; MUST ask its
mDNS questions and M-SEARCH at start and repeat them at least once an hour, and no more often than
RFC 6762's continuous querying allows; and MUST keep at most 512
candidates, dropping the longest unheard with a `faults` entry of code `overflow` (GA-FIND-4).

The finder's `status` MUST list every source, with `off` for one it cannot use; a finder that lists
Bluetooth or USB `up` MUST have a bench run of that source recorded with its Find claim (GA-FIND-5).

The finder MUST run under the harness only when the harness's start-up option enables it, and
then carry the run's `testRunId` in `status`, take all time from the harness's time source and
its manifests from the directory the option names, and listen only on the interface it names
(GA-FIND-6).

## Failure matrix

What must be on the wire for each fault. If a floor does not produce a cell, one of the two is wrong.

| Fault | Bridge `status` | Roster and transports | A device's status | Ack / reply / event | Floors |
|---|---|---|---|---|---|
| Persisted state disagrees with the network | a fault; still every 10 s | every transport `down` | unchanged | commands `failed(unreachable)`; provisioning `failed(state_mismatch)` | GA-BRIDGE-12 |
| Starting up | first published only after subscribing | each transport `up` only after an exchange; on first start, devices not yet heard `lastCheckIn: null`, not observable; after a restart, `lastCheckIn` as before (GA-BRIDGE-31) | values only once read, each with its own time | — | GA-BRIDGE-18, GA-BRIDGE-23, GA-BRIDGE-1 |
| A transport refuses or falls silent | re-published within 1 s | that transport `down` within 30 s, `retryIntervalMs` growing | its devices unchanged; the applier makes them `dead` | commands for them `failed(unreachable)` within 1 s | GA-BRIDGE-23, GA-BRIDGE-6, GA-BRIDGE-9, GA-BRIDGE-11 |
| A transmitter that can answer nothing | — | its transport `unknown`, never `up`; `down` from a failed write or its host link's removal until its host link opens again, retried on the backoff | its devices `feedback: open`, no readings | commands for them acked `sent` once written, `failed(unreachable)` on a failed write | GA-BRIDGE-72, GA-BRIDGE-8 |
| One device goes dark | — | its `lastCheckIn` stops; `observable` false once past its bound, re-published within 1 s | `available: false` if the protocol says it is gone; its last values kept with their old times | commands for it `failed(unreachable)` within 1 s once `available: false` | GA-BRIDGE-1, GA-BRIDGE-6, GA-BRIDGE-9, GA-BRIDGE-37 |
| A read whose state cannot be derived | — | observable | that reading `unknown`, stamped with the read | — | GA-BRIDGE-1 |
| A field of the wrong type | — | — | that field left out, the rest published | — | GA-BRIDGE-1 |
| The bridge loses the network | the broker publishes the will on `lwt` | unchanged, retained | unchanged, retained | — | GA-BRIDGE-18 |
| The broker restarts | re-published once reconnected and subscribed; `lwt` cleared | re-published; no `available` or `observable` changed by it | re-published | — | GA-BRIDGE-9, GA-BRIDGE-18 |
| A clean shutdown or reload | `offline`, `graceful: true`; `lwt` cleared; a clean disconnect | — | — | — | GA-BRIDGE-22 |
| A crash | the will on `lwt` | — | — | — | GA-BRIDGE-18 |
| A hung main loop | stops; the applier finds the bridge dead 30 s after the last | — | — | nothing | GA-BRIDGE-17 |
| A command for an unknown device | — | — | — | `failed(unknown_device)`, naming it, within 1 s | GA-BRIDGE-6 |
| An action the bridge cannot map | — | — | — | `unsupported` within 1 s | GA-BRIDGE-4 |
| A device sends data no key describes | its name in the device's `undescribed`, and an `undescribed` event the first time | — | that data left out | — | GA-BRIDGE-1, GA-BRIDGE-76 |
| A device reports an `event` key | — | its `lastCheckIn` moves | unchanged; never the value | one `occurrence` event; never again after a restart or `snapshot` | GA-BRIDGE-75 |
| An observed setting changes a declaration | — | — | the setting's new value, after `devices` | `devices` re-published first, within 1 s | GA-BRIDGE-74 |
| A command whose time ran out | — | — | — | `failed(expired)` | GA-BRIDGE-7 |
| The broker refuses a subscribe, or an MQTT 5 publish | a fault in `faults`, naming the topic | — | — | — | GA-BRIDGE-20 |
| A device is removed | — | it leaves the roster and `devices` | cleared with an empty retained payload | `left` | GA-BRIDGE-21 |
| A PC's host suspends or shuts down, announced (a `sleep`, a closed lid, an update's restart) | `offline`, `graceful: true`, after the terminal ack of the `sleep` or `shutdown` that caused it; `lwt` cleared; a clean disconnect | — | — | the `sleep` or `shutdown` acked `applied` first | GA-BRIDGE-22 |
| A PC's host suspends unannounced | the will on `lwt`, once the broker's keepalive lapses, taken as any will | unchanged, retained | unchanged, retained | — | GA-BRIDGE-18 |
| A session helper dies | — | the computer still observable | that session's key `unknown`, unless the system service reads it `locked`, `disconnected` or `none`; the readings only the helper observes (`app`) keep their old times | a `notify` for that session is not shown there | GA-BRIDGE-52, GA-BRIDGE-1 |
| A plugin's files or tools change, found at the server's start or on a `tools/list` change | one `faults` entry per device of the plugin, until a reinstall that verifies or a new version | — | each of its devices `available: false` | commands for them `failed(unreachable)` within 1 s | GA-BRIDGE-43, GA-BRIDGE-44, GA-BRIDGE-45, GA-BRIDGE-6 |
| A plugin's manifest declares `needsSession`, and its account has no graphical session (an SSH login alone) | — | — | each of its devices `available: false` | commands for them `failed(unreachable)` within 1 s | GA-BRIDGE-49, GA-BRIDGE-6 |
| A plugin's tool asks for input | — | — | — | `failed(no_confirmation)` | GA-BRIDGE-47 |
| A plugin installed, not yet activated | — | its devices in the roster, not observable | `available: false` until its version's `activate` | commands for them `failed(unreachable)` within 1 s, no tool called | GA-BRIDGE-42, GA-BRIDGE-46 |
| A plugin's server exits, having served answers neither a state read nor a probe within 10 s, or has not served within 120 s of its start | — | — | each of its devices `available: false` at once, until a restart serves again | commands for them `failed(unreachable)` within 1 s | GA-BRIDGE-58, GA-BRIDGE-6 |
| A plugin's server still starting, at activation or at the bridge's start | — | its devices not yet checked in; read within 10 s of the server having started | not `available: false` for that, within 120 s | commands for them `failed(unreachable)` within 1 s | GA-BRIDGE-58, GA-BRIDGE-6 |
| A PC resumes with plugins running | — | each activated plugin device read within 10 s of the first `status` | — | — | GA-BRIDGE-60 |
| A session helper reports for another session | a `faults` entry on the computer | — | that session's key unchanged by it | — | GA-BRIDGE-61 |
| A second helper, or a plugin server, connects as a session's helper | a `faults` entry on the computer; the connection refused | — | that session's key unchanged by it | — | GA-BRIDGE-61 |
| A PC resumes with its clock behind | first `status` after the OS steps the clock, or 10 s | — | — | — | GA-BRIDGE-59 |
| `activate` for a version not installed | — | — | — | `failed(unknown_plugin)` within 1 s | GA-BRIDGE-42 |
| An `install` that does not finish (a download that stalls) | — | — | — | `install_failed` with reason `timeout`, 600 s after its `accepted`, nothing installed | GA-BRIDGE-68 |
| A reinstall whose package `sha256`, manifest or `account` differs from the installed version's | — | — | unchanged | `install_failed` with reason `version_conflict` | GA-BRIDGE-57 |
| An `install` for an account the computer does not list | — | — | — | `install_failed` with reason `unknown_account`, nothing installed | GA-BRIDGE-68 |
| An `install` for another `host`, or an `uninstall` of a plugin not installed | — | — | — | `invalid_request`, or `failed(unknown_plugin)`, within 1 s, nothing done | GA-BRIDGE-68 |
| The bridge restarts during an accepted `install` or `uninstall` | — | — | — | after the start, one terminal event: `installed`, or `install_failed` with reason `restart`; `uninstalled` | GA-BRIDGE-31, GA-BRIDGE-68 |
| A staged version's new server fails its check or does not serve | — | — | the old version's devices unchanged; the new ones `available: false` | — | GA-BRIDGE-45, GA-BRIDGE-58, GA-BRIDGE-69 |
| `activate` names the running version while a staged version's swap waits | — | — | the old version's devices unchanged; the new server stopped, never swapped to | `ok` within 1 s | GA-BRIDGE-69 |
| A `session.lock` naming a token `accounts` does not list | — | — | unchanged | `failed(invalid_request)` within 1 s, nothing done | GA-BRIDGE-66 |
| A plugin's first state read after a resume fails | — | read again at least every 10 s until one succeeds | — | — | GA-BRIDGE-60 |
| The account a plugin runs as is deleted | one `faults` entry per device of the plugin, until it is uninstalled | — | each of its devices `available: false`; its server stopped, not started again | commands for them `failed(unreachable)` within 1 s; a reinstall `install_failed` with reason `version_conflict` | GA-BRIDGE-67, GA-BRIDGE-6 |
| A `session.lock` that a graphical session does not take (no screen locker honours it) | — | — | the account's key unchanged by it | `failed(not_locked)` within 5 s of the request, never `applied` | GA-BRIDGE-66 |
| A `session.lock` for an account whose only sessions are non-graphical (SSH) | — | — | the account's key unchanged, `active` or `idle` | `failed(no_graphical_session)` at once, never `applied` | GA-BRIDGE-66 |
| A plugin's server fails 5 starts in a row | one `faults` entry per device of the plugin, until a restarted server has served | — | each of its devices `available: false` | commands for them `failed(unreachable)` within 1 s | GA-BRIDGE-58, GA-BRIDGE-6 |
| The finder dies | the finder's will on `{root}/finder/lwt` | unchanged | unchanged | none; the applier keeps the last candidates, marked `finder: dead` | GA-FIND-1, GA-DISC-5 |

## Constants

| Constant | Value | Where |
|---|---|---|
| Status interval | at most 10 s; within 1 s of a transport or `observable` change | GA-BRIDGE-17; a deployed fleet's |
| Bridge dead after | 30 s without a `status`, or its will, or a graceful `offline` | *Liveness*; GA-STATE-2; a deployed fleet's |
| Keepalive | at most 10 s | GA-BRIDGE-18; a deployed fleet's |
| Poll bound | `basisMaxAgeMs` at most 3 × `cadenceMs` | GA-BRIDGE-13; a deployed fleet's |
| Box grant withdrawn after it stops passing | 60 s | GA-BOX-2 ⚠️ a guess |
| Broker delivery allowance in the harness | measured on its own probes | GA-BRIDGE-4, GA-BRIDGE-6; added to every 1 s bound |
| Matter controller's slack | about 38.5 s, added to the granted maximum interval | GA-BRIDGE-13 ⚠️ one bench |
| Will Delay Interval | 0 | *The will*; a delay would stretch the 30 s death |
| Binding tables re-read | at least every 24 h | GA-BRIDGE-14 ⚠️ a guess |
| `devices` re-published after a setting changes a declaration | within 1 s, before the setting's new value | GA-BRIDGE-74 |
| `devices` re-published after an awaited key's first report | within 1 s (⚠️ a guess for a loaded box), before its first value | GA-BRIDGE-80 |
| One occurrence: a repeated frame | the same transaction and payload within 10 s | GA-BRIDGE-75 ⚠️ a guess |
| Duplicate request window | 10 s | GA-BRIDGE-4 |
| Reply and fast ack within | 1 s; `snapshot` 10 s | GA-BRIDGE-4, GA-BRIDGE-6, GA-BRIDGE-30 ⚠️ a guess for a loaded box |
| Device status published | within 1 s of a report | GA-BRIDGE-37 |
| Clock ahead of true time | at most 1 s | GA-BRIDGE-3 |
| Longest reach for an action | 145 s | GA-BRIDGE-7 ⚠️ twice it plus 10 s fits the applier's longest ack bound, 300 s; not measured |
| Transport `up` window | 30 s | GA-BRIDGE-23 ⚠️ a guess |
| Health exchange when quiet | at least every 10 s | GA-BRIDGE-23 ⚠️ a guess |
| Reconnection backoff ceiling | at least 60 s, reached within 180 s | GA-BRIDGE-11; a deployed fleet's |
| Zigbee join window cap | 254 s | GA-BRIDGE-25 |
| Command Message Expiry | `resultWithinMs` | *The MQTT binding* |
| Other requests' Message Expiry | 10 s | *The MQTT binding* |
| `issuedAt` discard, optional | 120 s | *Commands*: a command that old was asked for a moment that has passed |
| The applier's fast-clock tolerance | 5 s | GA-BUS-2 ⚠️ a guess |
| The finder's status interval | at most 10 s; within 1 s of a source's change | GA-FIND-1 |
| Candidates re-published | within 1 s of a change, at most once a second | GA-FIND-4 |
| A candidate unheard is dropped after | 7 days | GA-FIND-4 ⚠️ a guess |
| mDNS questions and M-SEARCH repeated | at least once an hour | GA-FIND-4 ⚠️ a guess |
| Candidates kept | at most 512 | GA-FIND-4 ⚠️ a guess |
| A new `lastSeen` alone published | within an hour | GA-FIND-4 ⚠️ a guess |
| A `connect` ends within | 60 s of its receipt | GA-BRIDGE-40 ⚠️ a guess |
| A PC's own host observed | at least every 10 s; bound 30 s | GA-BRIDGE-37, GA-BRIDGE-13 |
| A plugin device's bound | 3 × its manifest's `cadenceMs` | GA-BRIDGE-13 |
| A session's idle threshold | 300 s by default, the bridge's own setting | *Sessions* |
| A PC's administrators re-read | at least every 24 h, beside the OS's change reports | GA-BRIDGE-53 ⚠️ a guess, as for binding tables |
| An `install` ends within | 600 s of its `accepted` | GA-BRIDGE-68 ⚠️ a guess |
| A plugin's `cadenceMs` | at most 300 000 ms | GA-BRIDGE-68 ⚠️ a guess |
| A plugin server's answer | within 10 s, to a state read or a probe (`ping`, or `server/discover` from MCP 2026-07-28), once it has served | GA-BRIDGE-58 ⚠️ a guess |
| A plugin server probed | at least every 10 s when no state read has passed | GA-BRIDGE-58 ⚠️ a guess |
| A plugin server's start | has served within 120 s of its start | GA-BRIDGE-58 ⚠️ a guess |
| A plugin device read after a start or a resume | within 10 s of the server having started, or of the first `status` after resuming | GA-BRIDGE-60 ⚠️ a guess |
| A plugin server's restart backoff | ceiling at least 60 s, reached within 180 s, and at most 300 s; timed on a clock that stops in suspend | GA-BRIDGE-58 ⚠️ a guess, as GA-BRIDGE-11's; the maximum ⚠️ a guess |
| A failed plugin state read after a start or a resume retried | at least every 10 s until one succeeds | GA-BRIDGE-60 ⚠️ a guess |
| A plugin device read after a successful tool call | within 1 s of the tool's result, beside the late read-back | GA-BRIDGE-51 ⚠️ a guess |
| Clock step awaited on resume | at most 10 s | GA-BRIDGE-59 ⚠️ a guess |
| A session reported locked after a `session.lock` | within 5 s of the request, else `failed(not_locked)` | GA-BRIDGE-66 ⚠️ a guess |
| A plugin server's failed starts before a fault | 5 in a row | GA-BRIDGE-58 ⚠️ a guess |
| A plugin device published `available: true` | within 1 s of its server having served, after the activation and every restart | GA-BRIDGE-58 ⚠️ a guess |
| Wake relay's gateway ARP | answered within the last 30 s; at least every 10 s | GA-BRIDGE-55, GA-BRIDGE-23 ⚠️ a guess, as the transport window is |

The keepalive, the status interval and the staleness window depend on one another: the will beats
the staleness window only when `1.5 × keepalive + status interval < staleness`, which is
`15 s + 10 s < 30 s` at these values. The harness checks them together.

## Compatible with a deployed fleet's binding

This binding agrees with an MQTT bridge binding a deployed fleet has run, wherever Galatea had no
ground to differ, so that bridges written for that fleet can speak this one after a short list of
changes. In common: the topic shape, per bridge;
the heartbeat status and its 10 s, 30 s and 10 s constants; the will on its own `lwt` topic,
cleared on connect; `instanceId` as a UUID; the roster in the status, with a declared
`basisMaxAgeMs` and a poll's 3 × cadence bound; the flat device status; the command envelope and
one terminal ack with `applied`, `failed` and `unsupported`; subscribing before `online`; checking
every SUBACK; clearing a removed device; time as the observation's, with no future times; fault
isolation; backoff that resets on a read; verifying an ACL change; and MQTT 3.1.1 for a bridge
below Box.

Different, each on a ruling, a protocol fact or a need the fleet did not have:
- Per-bridge device topics, so that one grant covers one bridge (fact: under `iot/{d}`, any
  bridge can write any device's status).
- No universal ceiling on a bound (fact: a sleepy sensor is never observable under 120 s), and
  `lastCheckIn` apart from the values' `timestamp` (need: an idle leak sensor).
- `applied` means the protocol confirmed the command, and `sent` is a result of its own (fact:
  zigbee2mqtt's `set` and IR confirm nothing); a machine-readable `reason` on `failed`; the
  read-back that acks a target that already held.
- `available` and `timestamps` on a device's status (need: loss of contact apart from a value, and
  a time per reading).
- QoS 1 on a device's status (fact: a sleepy device has no cadence to heal a lost message).
- The `devices` document, provisioning, adoption, other admins, `seq` and `snapshot` (rulings and
  needs: HS17, HS18).
- MQTT 5 at Box (fact: refusals are visible only on MQTT 5).
- Reads granted per device at Box (ruling).
- The finder, manifests and `connect` (need: a device on the Wi-Fi is invisible until someone
  configures a bridge by hand; the fleet's bridges are configured by hand).
- Computers, plugins at level Host, and the wake relay (0.4, the PC design's rulings). The fleet's kiosk
  supervisor and its separate wake relay are the precedent for the computer and the relay; its
  binding has no plugins.

## Requirement index

| Id | Level | Conf. | Verify | Requirement |
|---|---|---|---|---|
| GA-BRIDGE-1 | MUST | Serve | wire | Each reading's time is its observation's; nothing the bridge cannot observe is reported, a setting kept under GA-BRIDGE-79 excepted, with its observation's time; loss of contact is `available: false`, never a value; a field of the wrong type, or a key the device's entry in `devices` does not declare as a `state` key, is left out and the rest published |
| GA-BRIDGE-2 | MUST | Serve | wire | A read of some keys restamps only the keys it read |
| GA-BRIDGE-3 | MUST | Serve | wire | Times are RFC 3339 UTC with milliseconds, never more than 1 s ahead of true time |
| GA-BRIDGE-4 | MUST | Serve | wire | Every command gets exactly one terminal ack within its time, and every request but `snapshot` a reply within 1 s of its receipt, with a defined result or status; unknown fields are ignored except in a command's `value`, which is `failed(invalid_request)`; a repeated `commandId` gets the first ack, or nothing more while the first runs, and does nothing more; a request repeated by `requestId` within 10 s gets the first reply; an unmappable action is `unsupported` within 1 s |
| GA-BRIDGE-5 | MUST | Serve | wire | A reading is only what the device reported: no optimistic state, no echo of a commanded value; a setting kept under GA-BRIDGE-79 is what the device confirmed |
| GA-BRIDGE-6 | MUST | Serve | wire | A command for a device whose transport is `down` or which is `available: false` when it arrives is acked `failed(unreachable)` within 1 s; one for an unknown device `failed(unknown_device)`, naming it; `failed(unreachable)` and `failed(expired)` only for a command of which nothing was transmitted, handing it to the protocol stack counting as transmission |
| GA-BRIDGE-7 | MUST | Serve | wire | A command whose time has run out is never started, and is acked `failed(expired)`; one acked `failed` is never carried out later; a sleeping device's queue is used only where it drops a command when its time runs out; no action is offered on a device unreachable within 145 s |
| GA-BRIDGE-8 | MUST | Serve | wire | `applied` only once the protocol confirmed the command, never on handing it to the radio; `confirms: true` wherever the protocol path can confirm; `sent` only for an action declared `confirms: false`; a confirmation that never came is `failed(no_confirmation)` |
| GA-BRIDGE-9 | MUST | Serve | wire | A fault on one device or transport stops no other; losing the broker is recovered in process and changes no device's `available` or `observable` because of it |
| GA-BRIDGE-10 | MUST | Serve | wire | A recoverable fault never makes the bridge exit |
| GA-BRIDGE-11 | MUST | Serve | wire | Transport reconnection backs off to a ceiling of at least 60 s within 180 s, and resets only on a successful exchange, never on a connect, or for a transmitter that can answer nothing when its host link opens again |
| GA-BRIDGE-12 | MUST | Serve | wire | Persisted state that disagrees with the network is a fault in `status`; until the owner resolves it, every transport is `down`, `status` goes on, commands are acked `failed(unreachable)` and provisioning `failed(state_mismatch)` |
| GA-BRIDGE-13 | MUST | Serve | wire | Every `feedback: closed` device's roster entry carries `basisMaxAgeMs`: a bound the bridge knows from the protocol or the model, at most 3 × `cadenceMs` for a poll, the granted maximum interval plus the controller's configured slack for a Matter subscription, twice the longest configured report interval, or the model's where none is configured, for a device that reports on its own, no more, 30 s for the bridge's own host, observed at least every 10 s, 3 × the manifest's `cadenceMs` for a plugin device, or null where it cannot know it, never one guessed from observed intervals |
| GA-BRIDGE-14 | MUST | Serve | wire | `otherAdmins` is read from the protocol where it shows it; a Zigbee device is `[]` only when no binding on the network the bridge did not make targets it and it is in no foreign group, with every table read within 24 h; `unknown` otherwise; a change is an event |
| GA-BRIDGE-15 | MUST | Serve | wire | `proposedClass` states its `classEvidence`, and `protocol` evidence is claimed only when read from the device |
| GA-BRIDGE-16 | MUST | Serve | wire | The test transport runs only when the harness's start-up option enables it; `status` then carries `testRunId`, and the bridge takes all time from the harness's time source |
| GA-BRIDGE-17 | MUST | Serve | wire | `status` is published from the main loop at least every 10 s, and within 1 s of a transport's `state` or a device's `observable` changing |
| GA-BRIDGE-18 | MUST | Serve | wire | The bridge connects as *Connections* says (an authenticated identity, over TLS or, with a password, over plain TCP only on one host's loopback or, on a deployment that does not claim Box, on its local network, a clean session, keepalive at most 10 s, a will on `lwt` carrying its `instanceId`, `lwt` cleared on connect, no shared subscription, device ids in topics free of `+`, `#` and `/`) and subscribes to its commands and requests before its first `status` |
| GA-BRIDGE-19 | MUST | Serve | wire | A retained command or request is never acted on; on MQTT 5 requests and commands are subscribed with Retain Handling 2 |
| GA-BRIDGE-20 | MUST | Serve | wire | A refusal on a SUBACK, or on an MQTT 5 PUBACK, is reported as a fault in `status` naming the topic |
| GA-BRIDGE-21 | MUST | Serve | wire | A removed device's retained status is cleared with an empty payload, and it leaves the roster and `devices` |
| GA-BRIDGE-22 | MUST | Serve | wire | A restart or reload unsubscribes from commands and requests and waits for the UNSUBACK, closes any open window with its `window_closed`, ends every `connect` in flight with the device taken or `connect_failed(unreachable)`, acks every command in flight, `failed(unreachable)` if not yet transmitted and `failed(no_confirmation)` if transmitted, then publishes `offline` with `graceful: true`, clears `lwt` and disconnects cleanly before the new instance connects; a PC's bridge publishes a `sleep`'s or `shutdown`'s terminal ack, `applied`, before its graceful `offline` and before clearing `lwt`, holding the suspend until then where the OS offers a way to, and goes offline gracefully, in the same order, on any suspend or shutdown the OS announces |
| GA-BRIDGE-23 | MUST | Serve | wire | A transport is `up` only on a successful exchange within the last 30 s, never on a connect alone; a quiet transport gets a health exchange at least every 10 s |
| GA-BRIDGE-24 | MUST | Provision | static | A Zigbee transport runs on a network key and PAN id generated for the installation, never a well-known default; the export it is checked against is the bridge's own, so its honesty is the bridge author's word (*not checked by the harness*) |
| GA-BRIDGE-25 | MUST | Provision | wire | A join window lasts at most the lesser of `windowMs` and the transport's cap, closes at once on `join_close`, and `window_closed` carries every device that joined and the effective `windowMs` |
| GA-BRIDGE-26 | MUST | Provision | wire | `near` is honoured where the transport can open a window at one router |
| GA-BRIDGE-27 | MUST | Provision | wire | `remove` with `blockRejoin` keeps the `stableIdentifier` out of every later window, and removes it again at once, with a `blocked_rejoin` event and no admission, if it rejoins secured, until `unblock` names it; `remove` with `force` drops a device that cannot answer; a blocked identifier is refused by `connect` too; `join_close`, `remove` and `unblock` are idempotent; a `remove` of an identifier the bridge never had is `failed(unknown_device)` |
| GA-BRIDGE-28 | MUST | Provision | wire | `join` on a transport with no join window, or `commission` on one with no setup codes, is `invalid_request` |
| GA-BRIDGE-29 | MUST | Provision | wire | `commission` refuses a device that fails Matter's device attestation unless the request carries `acceptUnattested` |
| GA-BRIDGE-30 | MUST | Serve | wire | On `snapshot`, `status`, `devices` and every device's status are re-published, then `ok` is replied, within 10 s |
| GA-BRIDGE-31 | MUST | Serve | wire | The blocklist, `lastCheckIn` and `otherAdmins`, each device's kept settings, the keys it has reported once and its `undescribed` list, and at Host each installed version's manifest as installed and its files' hashes, and each accepted `install` or `uninstall` not yet ended, survive a restart; every start takes a new UUID as `instanceId` |
| GA-BRIDGE-32 | MUST | Serve | wire | Every native way the doer can change a device or open a window without the applier's request is disabled, or listed in `status` as `ungoverned`; on a computer, the OS's own automations and a person at the PC, in any login session on it (local, SSH or Remote Desktop), are the device's own behaviour, not such a way |
| GA-BRIDGE-33 | MUST | Serve | wire | Every event carries `instanceId` and a `seq` starting at 1 and increasing by one |
| GA-BRIDGE-34 | MUST | Serve | wire | After an `applied`, `sent` or `failed(no_confirmation)` for a stateful action on a `feedback: closed` device, other than one a reload sends (GA-BRIDGE-22), a fresh observation of every key it sets is published within the ack bound, read back if no report came |
| GA-BRIDGE-35 | MUST | Serve | wire | A device the protocol admits anew gets a device id the bridge never used before, whatever identifier it shows, and the old id leaves the `devices` document and the roster, its retained status cleared; a rejoin of any kind by hardware not in the `devices` document, unless it is blocked (GA-BRIDGE-27), is reported the same way, with a `joined` event; a plugin device's id is the exception, `<plugin id>:<version>:<key>` again after an `uninstall` |
| GA-BRIDGE-36 | MUST | Serve | wire | A PIN for remote operation is held in the bridge's own configuration and never sent on the binding, in a command's `value` or in an event; without one, no `unlock` is offered, and a `faults` entry in `status` names the device |
| GA-BRIDGE-37 | MUST | Serve | wire | `lastCheckIn` is when the device's latest check-in reached the bridge, never a publish, a restart or a cache read, and is kept across a restart; a device's status is published within 1 s of each report that changes a reading or its time; a PC's bridge observes its own host at least every 10 s, each successful observation the computer's check-in; a plugin device's check-in is each successful state read or change notification |
| GA-BRIDGE-38 | MUST | Serve | wire | `status` carries every field *The bridge's status* lists as required, the roster with every device and, for each, `lastCheckIn`, `basisMaxAgeMs` and `observable` present, null where *The roster and freshness* allows; the retained `devices` document lists every device the roster does, at every level, each entry with the fields *Devices* gives it (a computer's `accounts`, `personal` and `selfChanging`; a plugin device's `host`, `plugin`, `version`, declarations, `extensions`, `confirmedBy`, `requestedTier`, `toolHash` and `stagedFor`, and its fixed `feedback: closed`, `reachMs` 0, `model` `{ vendor: <plugin id>, model: <key> }` and `classEvidence` `none`; a relay entry's `internal`; any device's `extensions`, and `confirmedBy` on each of its stateful extension actions), never leaving out a declaration the standard makes |
| GA-BRIDGE-39 | MUST | Serve | static | A bridge type that ships a manifest ships one valid against `conformance/galatea-bridge.schema.json` |
| GA-BRIDGE-40 | MUST | Provision | wire | A `connect` accepted by a bridge whose manifest says `connect: true` ends within 60 s in `connected`, naming the one device it holds, or `connect_failed` with a `reason`; only a device that proves its identity, as *Provisioning* defines it, and shows one of the candidate's keys is taken; a failed handshake, or another secret, is `connect_failed(unproven)`, and none of the keys `connect_failed(refused)`; the credential is never disclosed to a device that has not proved it (a bench check, *not checked by the harness*); a proven device already held is `connected` naming it, admitting, evicting and re-pointing nothing; `devices`, with the new device's `connections`, is re-published before `connected`; each later connection to a device taken through `connect` repeats its proof and discloses the credential to none that fails it; a `connect` repeated with the same `requestId` while the first runs gets the first reply and does nothing more; one with a new `requestId` while another runs on the same bridge is `failed(busy)`; a blocked identifier is `connect_failed(refused)`; a `connect` to loopback however written (IPv4-mapped included), multicast, broadcast, IPv6 link-local, or the box's own or its host's addresses or container networks is `connect_failed(refused)`, with no connection; a bridge whose manifest does not say `connect` answers `invalid_request` |
| GA-BRIDGE-41 | MUST | Serve | wire | A bridge whose type ships a manifest gives its `bridgeType` in `status`, and every device and transport carries in `connections` every identity key the bridge knows for it, in canonical form |
| GA-BRIDGE-42 | MUST | Host | wire | A plugin's server is verified and started by the bridge itself, in the chosen account's graphical session where its manifest declares `needsSession` (its console session, else the graphical one the OS started first, by Windows' `LogonTime` or logind's `Timestamp`, a tie going to the lower session id, as numbers where both read as integers, else in byte order), never by a session helper, and never before its version's `activate`; `activate` is answered `ok` within 1 s, or `failed(unknown_plugin)` for a version not installed; the activation is kept across restarts |
| GA-BRIDGE-43 | MUST | Host | wire | Each installed file's SHA-256 is kept at install, and the installed files are verified against them at every start of the plugin's server |
| GA-BRIDGE-44 | MUST | Host | wire | The live tools are compared with the `toolHashes` of the manifest as installed, never one read again from disk (SHA-256 over the RFC 8785 JSON of `name`, `title`, `description`, `inputSchema`, `outputSchema`, `annotations`), at every start of the server and on every `tools/list` change it announces; a live tool not in the manifest, a missing tool or a changed hash is a mismatch |
| GA-BRIDGE-45 | MUST | Host | wire | On a mismatch of files or tools the server is stopped, every one of the plugin's devices is `available: false`, and one `faults` entry of code `pin_mismatch` per device names it; only a reinstall of that version that verifies (GA-BRIDGE-57), or a new version, clears them |
| GA-BRIDGE-46 | MUST | Host | wire | No tool is called that the manifest does not map to an action, and a tool is called only to serve a command |
| GA-BRIDGE-47 | MUST | Host | wire | A plugin's elicitation or sampling is never relayed; an action whose tool asks for input ends `failed(no_confirmation)` |
| GA-BRIDGE-48 | MUST | Host | wire | No broker credential, confirmation token or user credential is passed to a plugin; graded on a real OS (*Conformance*) |
| GA-BRIDGE-49 | MUST | Host | wire | A plugin's server runs as the account the owner chose, never elevated: never SYSTEM or root, with the filtered token on Windows, with `no_new_privs` on Linux; its devices are `available: false` while its manifest declares `needsSession` and the account has no graphical session (an SSH login alone is none), and a started server keeps running while its session is locked or disconnected; best effort, as *Hosting* says; graded on a real OS (*Conformance*) |
| GA-BRIDGE-50 | SHOULD | Host | judged | A plugin's server is sandboxed to its package files and the manifest's `hosts` |
| GA-BRIDGE-51 | MUST | Host | wire | A command to a plugin device is `failed(no_confirmation)` on a tool result with `isError`, since the tool ran, with the tool's text in `detail`; on success, `applied` only for an action declared `confirms: true`, and `sent` otherwise; after a successful tool call the device's state is read within 1 s of the tool's result, and GA-BRIDGE-34's read-back is still made |
| GA-BRIDGE-52 | MUST | Serve | wire | A computer carries one `session.<token>` key per interactive account; the token is derived as *Sessions* says, fixed at first sight by the OS's own identity for the account (the uid, the whole SID), never numbered from the last part of a SID, never one another account holds or held, never a name matching `u[0-9]+` or `g[0-9]+` or `unknown`, kept across restarts and renames, retired with its key only when the OS reports the account deleted, or the directory itself reports a directory account as not existing, never on its mere absence from a listing or a cache miss, and never given again, and declared in `accounts`; an account's several sessions make one key, the most in-use state any of them reads, in the order `active`, `idle`, `unknown`, `locked`, `disconnected`, `none`; `none`, `locked` and `disconnected` are read by the system service without the helper, and only `active` or `idle` is taken from a helper, only for a session the OS reports neither locked nor disconnected; a logged-in graphical session neither locked nor disconnected with no helper reads `unknown`, never `available: false`, and a non-graphical one (an SSH login; a logind `Type` other than `x11`, `wayland` or `mir`; Windows' session 0) reads from the OS alone, `active`, or `idle` where the OS reports idleness, and joins the key only while the account has no graphical session |
| GA-BRIDGE-53 | MUST | Serve | wire | A PC's bridge reports `otherAdmins` on the computer and each plugin device, one `{ vendor: "os", label: <token> }` per administrator account (on Windows Administrators and Backup Operators, an account holding `SeDebugPrivilege`, `SeTakeOwnershipPrivilege`, `SeRestorePrivilege` or `SeBackupPrivilege` through local policy, and on a domain-joined machine Server Operators and Account Operators; on Linux root, every account sudo or polkit lets run any command as root, one command being enough, every identity polkit's administrator rules name, and the `docker` group's members) and per group granted the rights, a group's token `g` and a number, and one `{ vendor: "os", label: "unknown" }` where that set cannot be enumerated (a polkit rule not reducible to users and groups, a sudo grant whose users or root target rest on an alias or a digest it does not evaluate, an unreadable Windows local policy), re-read at start, on every change of the administrators group and at least every 24 h, a change being an event; each plugin device also lists the account its plugin runs as, unless listed already as an administrator, and so does the computer for a plugin whose manifest declares `needsSession`; each entry of a plugin's manifest's `otherAdmins`, its app's own network control, is copied to every device of the plugin, never `ungoverned`; the enumeration of administrators, the `unknown` entry included, graded on a real OS (*Conformance*) |
| GA-BRIDGE-54 | MUST | Serve | wire | No action among a bridge's own executes its arguments as a command, script or code, or hands them to an OS handler that may; for a plugin's actions this is the manifest's word (*not checked by the harness*) |
| GA-BRIDGE-55 | MUST | Serve | wire | A wake relay's transport is `up` only while its interface has a link and the gateway answered ARP within the last 30 s; each entry is `feedback: open`, `internal`, `proposedClass` null, and offers only `power.wake`, declared `confirms: false` |
| GA-BRIDGE-56 | MUST | Serve | judged | A bridge that lists `from` among its `notify` action's `args` shows it with the text, and a `notify` without `from` as from an unknown sender, never unmarked; graded by a person from what the test transport's notification hook was asked to show |
| GA-BRIDGE-57 | MUST | Host | wire | An `install` of a version already installed is a reinstall: with a package `sha256` other than the one the version was installed from, or a manifest other than the installed one's, it is `install_failed(version_conflict)` and changes nothing; so is one whose `account` is not the one the version was installed for; otherwise the version's files and hashes are replaced, its device ids and activation kept, an activated server started again, verified, and it ends in `installed` |
| GA-BRIDGE-58 | MUST | Host | wire | After activation a plugin's devices are `available: false` only while its server cannot serve them (a mismatch, `needsSession` with no graphical session, a server that exited, one that has served and then answered neither a state read nor a probe within 10 s, or one that has not served within 120 s of its start), at once when it exits or stops answering; a server that has served is probed (`ping` before MCP 2026-07-28, `server/discover` from it) at least every 10 s when no state read has passed; the server is started again, verified, backing off to a ceiling of at least 60 s within 180 s and at most 300 s, unless stopped for a mismatch or a deleted account; after 5 failed starts in a row, one `faults` entry of code `crash_loop` per device of the plugin names it, cleared once a restarted server has served; these times are kept on a clock that stops in suspend, or started again at resume; never `available: false` because the server is still starting, within those 120 s, or was stopped by the bridge's own going offline; published `available: true` within 1 s of the server having served, after the activation and every restart |
| GA-BRIDGE-59 | MUST | Serve | wire | On resuming, where the OS offers a way to, a PC's bridge has the OS step its clock to its time source before its first `status`, waiting at most 10 s |
| GA-BRIDGE-60 | MUST | Host | wire | Each activated plugin device's state is read within 10 s of its server having started (its first successful answer to `initialize`, or to `server/discover` from MCP 2026-07-28), and within 10 s of the bridge's first `status` after resuming, whatever its `cadenceMs`, a failed read being tried again at least every 10 s until one succeeds; a command to a plugin device whose server is still starting is acked `failed(unreachable)` within 1 s |
| GA-BRIDGE-61 | MUST | Serve | wire | Each session helper is bound to its session by the OS identity of its connection (session id and uid), never by its own word; a helper's report for another session is ignored and named as a `faults` entry of code `helper_refused` on the computer; one helper is bound per session, the one the service started in it, and a second connection from that session, or one from a plugin server's process, is refused and named as a `faults` entry of code `helper_refused` on the computer; `app`, `camera_in_use` and `microphone_in_use` are taken only from the helper of the session the OS reports active at the console; the binding graded on a real OS (*Conformance*) |
| GA-BRIDGE-62 | MUST | Serve | wire | A computer's `notify` lists `from` among its `args`, and a `notify` to a computer is shown in every logged-in session that is neither locked nor disconnected and has a running helper, as the test transport's notification hook records; shown in none, it is acked `failed(not_shown)`, never `applied` |
| GA-BRIDGE-63 | MUST | Serve | wire | A computer's `cancel` is acked `applied` when nothing is scheduled |
| GA-BRIDGE-64 | MUST | Serve | wire | A PC's bridge's broker credential is readable only by its system service and the OS's administrators, and the endpoint its session helpers connect to is created and owned by the service, so no other process binds, replaces or listens on it; graded on a real OS (*Conformance*) |
| GA-BRIDGE-65 | MUST | Serve | wire | A PC's bridge on its broker's own host, reaching it over loopback or through one of its host's own addresses, declares `proposedInfrastructure: true` on its computer |
| GA-BRIDGE-66 | MUST | Serve | wire | A computer's `session.lock` is declared `confirms: true` and `idempotent: true`, its `args` declaring `account` as the tokens `accounts` lists, a lock naming any other token acked `failed(invalid_request)` within 1 s, nothing done; it locks or disconnects every graphical session of the account, and is acked `applied` only once the OS reports each of them locked or disconnected, or the account has no session at all, a non-graphical session (an SSH login) not blocking the ack beside a graphical one; it is `failed(no_graphical_session)` within 1 s of its receipt for an account whose only sessions are non-graphical, and `failed(not_locked)` when a graphical session is not so reported within 5 s of the request |
| GA-BRIDGE-67 | MUST | Host | wire | When the OS reports deleted the account a plugin runs as, its server is stopped and not started again, every device of the plugin is `available: false`, and one `faults` entry of code `account_deleted` per device names it until the plugin is uninstalled; a reinstall of that version ends `install_failed(version_conflict)`, whatever account it names |
| GA-BRIDGE-68 | MUST | Host | wire | `install` and `uninstall` are answered `accepted` within 1 s; an accepted `install` ends in exactly one `installed`, carrying the manifest, or `install_failed` with a `reason`, within 600 s of its `accepted`, else `install_failed(timeout)` with nothing installed, and an accepted `uninstall` in `uninstalled`, once the plugin's server is stopped, its files removed and every device of every version of it removed as GA-BRIDGE-21 says; a package whose SHA-256 is not `sha256`, or whose `command` names a file outside it other than an interpreter, by name, as its first element, found in a directory the plugin's account cannot write without elevation, is `install_failed` with nothing installed, and so is one whose interpreter, resolved by the bridge to an absolute path in the account's search order, is a file, or has a directory on its path or earlier in that order where the name would have been looked for, that the account can write, or a manifest with a `cadenceMs` above 300 000, a non-scalar extension key schema, or an `id`, `key` or `version` holding a character outside `[A-Za-z0-9._-]`, an `id` or `key` over 40 characters or a `version` over 32 (`invalid_manifest`); the interpreter's absolute path is recorded with the manifest as installed, and the server started by it, never by name; and an `account` not in the computer's `accounts` (`unknown_account`); an `install` for another `host` is `invalid_request`, and an `uninstall` of a plugin not installed `failed(unknown_plugin)`, within 1 s, nothing done; one accepted and not ended at a restart ends after the start in exactly one terminal event (`installed`, or `install_failed(restart)` with nothing installed, within its 600 s or at once if they passed; `uninstalled`); both are duplicates when repeated by `requestId` within 10 s, as GA-BRIDGE-4 says for every request |
| GA-BRIDGE-69 | MUST | Host | wire | A plugin device has `stableIdentifier` `<computer stableIdentifier>/<plugin id>/<key>`, device id `<plugin id>:<version>:<key>` and `host` naming the computer; a staged device names the device it would replace in `stagedFor`; the old version's server keeps running and its devices stay until the new version's `activate`, sent for a version with staged devices only on an adoption with `replaces`, then the new server starts, and once it has served the old one stops and all its devices leave as GA-BRIDGE-21 says, and the new version's devices keep `stagedFor`; while the new server fails its check or has not served, the old version stays as it was; the swap ends the old version's activation and removes it, so no later start runs its server, with no `uninstalled`; an `activate` naming the version whose server runs, while another's activation waits for its swap, cancels that pending activation, the new server stopped if it runs and never swapped to later, the bridge's next start included |
| GA-BRIDGE-70 | MUST | Host | wire | A plugin's install directory is writable only by the bridge's system service; graded on a real OS (*Conformance*) |
| GA-BRIDGE-71 | MUST | Serve | wire | An action the device carries out by a code that reaches a state only from a known one (flips, cycles or steps it relatively) is declared `toggles: true` and `idempotent: false`; one carried out by a code that sets it is not declared `toggles: true`; one carried out by a code learned from a remote is declared `toggles: true` unless the owner declared that code discrete |
| GA-BRIDGE-72 | MUST | Serve | wire | A transport that only transmits and can answer nothing on its host link is `unknown`, never `up`, and `down` only from its host reporting a write to it failed, or removing its host link, until its host link, retried on GA-BRIDGE-11's backoff without transmitting, opens again, then `unknown`; a command whose write failed is acked `failed(unreachable)`; any other transport is `up` or `down`; every device on an `unknown` transport is `feedback: open` |
| GA-BRIDGE-73 | MUST | Serve | wire | An action carried out by a code that carries the device's whole state is declared `wholeState: true`, and its code is built from the command alone, its `state` with the action's `value` applied, a key it leaves out from the model's default, never from what the bridge last sent |
| GA-BRIDGE-74 | MUST | Serve | wire | Every declaration on a device's entry (`capabilities`; each action's `idempotent`, `stateless`, `toggles`, `args`, `confirms` and `confirmedBy`) holds for the device's settings as last observed; `devices` is re-published within 1 s of observing a setting that changes one, before the status or ack that carries the setting's new value; a setting is declared from its kept value (GA-BRIDGE-79), and by its worst case only where none is kept |
| GA-BRIDGE-75 | MUST | Serve | wire | A key of `kind` `event` is published once per occurrence the device reports, as an `occurrence` on the `event` topic, never in a retained status, never changing `available`, and never re-published after a restart, a reconnect or a `snapshot`; a frame received twice, with the same transaction number and payload within 10 s (⚠️ a guess), is one occurrence |
| GA-BRIDGE-76 | MUST | Serve | wire | Data a device sends that the bridge maps to no declared key, other than a duplicate of a declared reading by another path (which path is the duplicate is the maker's word, *not checked by the harness*), is never published as a reading, and is named in the device's `undescribed` in `devices`, with when it was first seen, each name matching `^[A-Za-z0-9._-]{1,64}$`, kept across restarts, and announced by one `undescribed` event when it is added; at most 32 are listed at once, a new name while the list is full is neither listed nor announced, a name the declarations come to describe leaves and frees its place, and a name not listed is added when it next arrives with a place free; a held-back key's first report is not undescribed (GA-BRIDGE-80) |
| GA-BRIDGE-77 | MUST | Serve | static | An extension's capability is a namespace with at least one dot that its publisher controls, each action and key the capability's name, a dot and a name matching `^[a-z][a-z0-9_]*$`; no extension takes a standard capability's name or reports a standard key under its own; on one device no capability's name is another's with a segment added; a manifest that breaks it is `invalid_manifest` |
| GA-BRIDGE-78 | MUST | Serve | wire | A movement reading is published under `motion`, never `occupancy`, whatever the protocol or library names it, its `false` the device's own where it sends one; a reading is published under any vocabulary key only where it means what `standard/applier.md`'s *Sensor keys* defines for that key (*not checked by the harness* beyond the movement case) |
| GA-BRIDGE-79 | MUST | Serve | wire | Every setting of a device is listed in the entry's `settings`, and no vocabulary state key is; a setting that the device confirmed, by a frame of the device's carrying the value (a report, or an echo of a write that carries it; a write response that carries no value confirms nothing), is kept across the bridge's restarts with that observation's time and published with it until the device reports that setting again; every kept setting of a device interviewed again is dropped, and a secured rejoin keeps them; a setting never confirmed is never published |
| GA-BRIDGE-80 | MUST | Serve | wire | Only a numeric measurement, as a sensor key or an extension `state` key, that the maker's records name, for the model, as promised and seen missing (that naming *not checked by the harness*) may be held back until the device first reports it, and never a boolean key; while held back it is listed in the entry's `awaitedKeys` and is never a reading; it is declared, and taken out of `awaitedKeys`, in a `devices` published before the status carrying its first value and within 1 s (⚠️ a guess) of that report; once reported, it is never held back again, across restarts |
| GA-FIND-1 | MUST | Find | wire | The finder's times are as GA-BRIDGE-3 says; it connects with an authenticated identity, a clean session, a keepalive of at most 10 s and its will on `{root}/finder/lwt`, carrying its `instanceId` and cleared on connect; MQTT 5, a refused subscribe or publish reported in `faults`; publishes `status` from its main loop at least every 10 s and within 1 s of a source's change; and goes with a graceful `status`, `lwt` cleared and a clean disconnect |
| GA-FIND-2 | MUST | Find | wire | The finder sends, on every interface, its broker connection aside, nothing but mDNS questions for the manifests' service types, the records of the instances answers name and the address records of the hosts they name, and SSDP M-SEARCH, connects to no device, and publishes only under `{root}/finder/`; that it holds no device or account credential is *not checked by the harness* |
| GA-FIND-3 | MUST | Find | wire | A candidate is published only for a match of an installed manifest (its Bluetooth and USB keys checked on a bench), every field of the matcher matching, with `id`, `sources`, canonical `keys`, `address` from the announcement's records, a Bluetooth `localName` only as advertised, `firstSeen`, `lastSeen`, `hints` and `matches`, a USB candidate's `connect` always `false`; hearings that share a key are one candidate; its `id` is a random UUID never given to another, and never changes while it is listed |
| GA-FIND-4 | MUST | Find | wire | `candidates` is re-published within 1 s of a change and at most once a second, a new `lastSeen` alone not being a change and published within the hour; a candidate is dropped at once on an mDNS goodbye or a USB unplug (a bench check), and after 7 days unheard; mDNS questions and M-SEARCH are asked at start and repeat at least hourly, never faster than RFC 6762's continuous querying; at most 512 candidates are kept, the longest unheard dropped with a `faults` entry of code `overflow` |
| GA-FIND-5 | MUST | Find | wire | The finder's `status` lists every source, `off` for one it cannot use; one listing Bluetooth or USB `up` has a bench run of that source recorded with its Find claim |
| GA-FIND-6 | MUST | Find | wire | Under the harness the finder runs only when its start-up option enables it, carries `testRunId` in `status`, takes all time from the harness's time source and its manifests from the directory the option names, and listens only on the interface it names |
| GA-BOX-1 | MUST | Box | wire | Every client authenticates, loopback included, over TLS or on one host's loopback, and the applier and bridges use MQTT 5; the broker refuses visibly with `0x87` and answers `0x10` to a publish with no subscriber; only the applier registered for bridge `{b}` writes its commands and requests; only bridge `{b}` subscribes to them and writes the rest of its tree; only the doer and its bridge read or write the doer's own topics; any other reader gets only the devices' statuses the owner granted, each by a literal subscription, and never their bridge's `status` or `lwt`; nothing else writes a command or a request, a rule engine included; only the finder the box registers writes `{root}/finder/#`, and only the box's applier reads it |
| GA-BOX-2 | MUST | Box | static | The box keeps a registration record of one applier per bridge identity, the finder's identity and the one applier that reads it, and each reader's grants, which only the owner edits, refusing a second entry for a bridge; its tool, reading the applier as the owner's client, grants nothing on an unadopted device, refuses or warns on a `door_lock`, anything above `reversible` or a device with a non-empty `personal`, and checks every grant again on the `model` event whenever a device is adopted or its tiers or `personal` change, withdrawing one that no longer passes within 60 s with a word to the owner; no applier changes the grants; an ACL change is verified by one forbidden and one permitted publish, and a withdrawn read by a message no longer received on a held subscription, before it is relied on, and each verification is recorded; the record's honesty is the box author's word (*not checked by the harness* beyond replaying its probes) |

## Conformance

A claim of conformance is a run of the conformance harness against the bridge in which every
requirement at every level it claims is `pass`, except those that do not apply to it. Box is claimed by a deployment, against its
broker, not by a bridge. Find is claimed by a finder, in a run of its own.

- The harness plays the applier against the bridge subject, on a real Mosquitto with dynamic
  security, through an MQTT 5 client (paho-mqtt 2 or aiomqtt), and drives the bridge's test
  transport (GA-BRIDGE-16). It refuses a subject whose `status` does not carry its run's
  `testRunId`, so it cannot actuate a real home. A subject on MQTT 3.1.1 is graded on the same
  requirements; GA-BRIDGE-20's PUBACK half and GA-BRIDGE-19's Retain Handling do not apply to it.
- **What applies.** The PC's requirements bind a bridge only where it has what they are about:
  GA-BRIDGE-52, GA-BRIDGE-53, GA-BRIDGE-59 and GA-BRIDGE-61 to GA-BRIDGE-66 where it reports a
  `computer`: where one of its devices offers the `session` capability or a `power` action other
  than `wake`, whatever its `proposedClass`, or where it claims Host, never by `proposedClass`
  alone; GA-BRIDGE-55 where it fronts a wake relay's entries; GA-BRIDGE-56 where it lists
  `from`; the Host ids where it claims Host. The harness reads that from the bridge's `devices` and
  `levels`, and reports each requirement that does not apply as not applicable, as it does
  GA-BRIDGE-20's PUBACK half for a subject on MQTT 3.1.1; a Zigbee bridge passes the PC's
  requirements that way. GA-BRIDGE-54 binds every bridge.
- Checks are `wire` except where a physical radio is needed. Those are bench checks, listed and not
  claimed: a real window's reach, a real check-in interval.
- The harness ships **negative subjects**, each built to break named requirements. Each must fail
  those, and may also fail only the requirements listed beside it below, each for the reason given.
  They are graded in both directions: a subject that passes its requirement disarms it, and one that
  fails a requirement not listed beside it is a regression in the harness.
- Each reference bridge keeps a coverage file read from the requirement manifest: satisfied, unimplemented,
  conflicts.
- Constants that depend on each other (the keepalive, the status interval, the staleness window)
  are checked together.
- **Hooks.** Through the test transport, the harness injects transport and device faults
  (recoverable and not), scripts routers, other controllers, an IR device whose power code toggles or was learned from a remote, or whose mode button cycles,
  an IR air conditioner whose frame carries its whole state, a transmitter that can answer nothing,
  whose writes fail or whose device node goes (GA-BRIDGE-71, GA-BRIDGE-72, GA-BRIDGE-73) and a mismatch between the bridge's
  store and its network, and stalls the bridge's main loop for a time it chooses. The bridge's
  packaging provides a restart hook, a graceful-reload hook, and an export of its network
  configuration (for GA-BRIDGE-24), as GA-PERSIST-1's is. The control interface is defined with the
  harness.
- **What the test transport cannot show.** It replaces the protocol stack, so the harness grades the
  bridge's logic above it. Whether a real stack says what the bridge claims (a Matter device type,
  an invoke status, a binding table, a real window's reach, a model's reporting interval) is a
  bench check for each reference bridge, listed and not claimed.
- **A PC's bridge.** For a bridge claiming Host, or fronting a computer, the test transport stands
  in for the OS: it scripts accounts, sessions and their helpers, the administrators group, and
  suspends and shutdowns, announced and not; and it serves the harness's test plugins, whose files
  and tools the harness can change, and which report how they were started. Its notification hook
  records what each session was asked to show, and a person grades GA-BRIDGE-56 from that record
  against one question, whether the source is shown with the text, and a `notify` without one as
from an unknown sender; as for the brain standard's
  judged requirements, the grade is a person's, never the subject's own.
- **Privileges on a real OS.** A scripted OS cannot show what a process may really do, or who
  it really is, so GA-BRIDGE-48, GA-BRIDGE-49, GA-BRIDGE-64 and GA-BRIDGE-70, GA-BRIDGE-61's binding
  of a helper, and GA-BRIDGE-53's enumeration of administrators (its `unknown` entry included) are
  graded on a real OS of each kind the bridge supports, with real accounts, one an administrator
  and one not: the harness installs its test plugin there through the bridge, the plugin reports
  the account, token, `no_new_privs` flag, environment and arguments it runs with, and the harness
  reads the install directory's permissions, and the broker credential's and the helper
  endpoint's, itself, as the account that is not an administrator. As that account, in its own
  session, it runs a helper of its own that reports another session `active`, and the computer's
  key for that session must not change. It then grants that account one command through sudo, and
  the computer's `otherAdmins` must carry `{ vendor: "os", label: "unknown" }`; adds it to the
  administrators group, and they must carry its token. Those requirements are `wire`, and `pass`
  only on that run: a bridge graded only through the test transport cannot claim Host, since three
  of Host's requirements are not `pass`, and cannot front a computer, since GA-BRIDGE-53,
  GA-BRIDGE-61 and GA-BRIDGE-64 are not.
- A run that cannot start its broker or test transport reports no requirement and exits non-zero.
- A subject whose type ships a manifest names it to the harness through its packaging, as it
  provides its restart hook, and takes the harness's device credentials, and the networks a
  `connect` refuses, through the same configuration the owner would use, so the harness can grade GA-BRIDGE-39 and GA-BRIDGE-41 against it.
- **The finder's run.** The harness starts the finder with its start-up option (GA-FIND-6), plays
  announcements on a test network (mDNS, SSDP) and a scripted DHCP request, gives it manifests of
  its own, and reads what the finder publishes and sends. Bluetooth and USB are checked with the source reported `off`; a finder that lists either
  `up` claims Find only with a bench run of that source, the USB unplug's drop included, recorded
  with its claim. GA-BRIDGE-39
  validates each reference bridge type's shipped manifest against the schema.

The applier's side of this binding (its `GA-BUS` requirements, adoption and provisioning) is graded
in the applier's run, and the box's in a check against the deployment's broker.

### Negative subjects

| Subject | Breaks | May also fail | Why those |
|---|---|---|---|
| `stamps-publication-time` | GA-BRIDGE-1 | GA-BRIDGE-2 | Restamping at publication restamps keys that were not read |
| `restamps-partial-read` | GA-BRIDGE-2 | GA-BRIDGE-1 | A restamped key carries a time that is not its observation's |
| `stamps-the-future` | GA-BRIDGE-3 | — | |
| `resumes-on-a-slow-clock` | GA-BRIDGE-59 | — | The test transport resumes the host with its clock 60 s behind and offers a clock step, and the subject publishes its first `status` without asking for it |
| `double-acks` | GA-BRIDGE-4 | — | |
| `echoes-commanded-state` | GA-BRIDGE-5 | GA-BRIDGE-1 | An echoed value is one the bridge did not observe |
| `unreachable-late` | GA-BRIDGE-6 | — | |
| `unreachable-after-transmit` | GA-BRIDGE-6 | GA-BRIDGE-7 | The harness's stack takes the command, then the bridge acks it `failed(unreachable)` |
| `runs-expired-commands` | GA-BRIDGE-7 | — | |
| `applied-before-confirmation` | GA-BRIDGE-8 | — | |
| `one-fault-stops-all` | GA-BRIDGE-9 | GA-BRIDGE-6, GA-BRIDGE-4 | Commands for the healthy devices stop being acked too |
| `exits-on-fault` | GA-BRIDGE-10 | GA-BRIDGE-9, GA-BRIDGE-4, GA-BRIDGE-6, GA-BRIDGE-17, GA-BRIDGE-22, GA-BRIDGE-30 | An exit stops every other device, leaves every command unacked and its status unpublished, and is a restart without the graceful goodbye |
| `resets-on-connect` | GA-BRIDGE-11 | — | |
| `keeps-a-mute-backoff` | GA-BRIDGE-11 | GA-BRIDGE-72 | A transmitter that answers nothing goes `down` twice, its host link opening again between, and the second `down`'s `retryIntervalMs` starts at the ceiling |
| `serves-on-mismatch` | GA-BRIDGE-12 | — | |
| `inflates-a-plugin-bound` | GA-BRIDGE-13 | — | The subject declares a plugin device's `basisMaxAgeMs` above 3 × its manifest's `cadenceMs` |
| `inflates-the-bound` | GA-BRIDGE-13 | — | The harness configures a report interval, and the bridge declares more than twice it |
| `guesses-the-bound` | GA-BRIDGE-13 | — | The harness scripts a device with no reporting configuration and no model entry, so the only conforming bound is null |
| `hides-other-admins` | GA-BRIDGE-14 | — | |
| `claims-protocol-class` | GA-BRIDGE-15 | — | |
| `test-transport-unannounced` | GA-BRIDGE-16 | — | |
| `heartbeat-from-client-thread` | GA-BRIDGE-17 | GA-BRIDGE-4, GA-BRIDGE-6, GA-BRIDGE-23, GA-BRIDGE-30, GA-BRIDGE-34, GA-BRIDGE-37 | A hung main loop acks no command, answers no request and makes no exchange |
| `online-before-subscribed` | GA-BRIDGE-18 | — | |
| `acts-on-retained-request` | GA-BRIDGE-19 | — | |
| `ignores-refusals` | GA-BRIDGE-20 | — | |
| `leaves-retained-state` | GA-BRIDGE-21 | — | |
| `sleeps-before-its-ack` | GA-BRIDGE-22 | GA-BRIDGE-4 | The subject lets the test transport's host suspend, or goes offline, before the `sleep`'s `applied` ack is published, so the ack never comes |
| `dies-on-an-announced-suspend` | GA-BRIDGE-22 | — | The test transport announces a suspend (a closed lid), and the subject lets the host suspend with no graceful `offline`, so its will fires instead |
| `reloads-without-graceful` | GA-BRIDGE-22 | GA-BRIDGE-4, GA-BRIDGE-34 | A command in flight at the reload is never acked |
| `up-without-exchange` | GA-BRIDGE-23 | — | |
| `default-network-key` | GA-BRIDGE-24 | — | |
| `window-never-closes` | GA-BRIDGE-25 | — | |
| `ignores-near` | GA-BRIDGE-26 | — | |
| `forgets-the-blocklist` | GA-BRIDGE-27 | — | |
| `provisions-the-wrong-way` | GA-BRIDGE-28 | — | |
| `accepts-unattested` | GA-BRIDGE-29 | — | |
| `ignores-snapshot` | GA-BRIDGE-30 | — | |
| `forgets-on-restart` | GA-BRIDGE-31 | GA-BRIDGE-27, GA-BRIDGE-37 | A forgotten blocklist or check-in breaks those floors after a restart |
| `hides-native-control` | GA-BRIDGE-32 | — | |
| `skips-seq` | GA-BRIDGE-33 | — | |
| `computer-checks-in-on-publish` | GA-BRIDGE-37 | — | The test transport fails every host observation, and the subject still moves the computer's `lastCheckIn` with each `status` it publishes |
| `restamps-check-in` | GA-BRIDGE-37 | — | |
| `reuses-id-on-join` | GA-BRIDGE-35 | — | |
| `pin-on-the-wire` | GA-BRIDGE-36 | — | |
| `no-read-back` | GA-BRIDGE-34 | — | |
| `status-without-roster` | GA-BRIDGE-38 | GA-BRIDGE-13, GA-BRIDGE-17, GA-BRIDGE-37 | No roster carries the bound, the check-in or the heartbeat's content |
| `starts-before-activate` | GA-BRIDGE-42 | GA-BRIDGE-46 | The harness's test plugin reports its start, and any tool call, before `activate` |
| `starts-outside-the-session` | GA-BRIDGE-42 | — | A `needsSession` test plugin reports that it was started outside the chosen account's session |
| `starts-in-the-later-session` | GA-BRIDGE-42 | — | The test transport logs the chosen account in over two Remote Desktop sessions, the second started later, and a `needsSession` test plugin reports that it was started in the second |
| `breaks-a-tie-by-text` | GA-BRIDGE-42 | — | The test transport logs the chosen account in over two Remote Desktop sessions with one start time, ids `9` and `10`, and a `needsSession` test plugin reports that it was started in `10` |
| `skips-file-check` | GA-BRIDGE-43 | GA-BRIDGE-45 | A changed file goes unseen, so nothing is stopped |
| `trusts-changed-tools` | GA-BRIDGE-44 | GA-BRIDGE-45 | A changed tool goes unseen, so nothing is stopped |
| `serves-on-tamper` | GA-BRIDGE-45 | — | |
| `clears-a-tamper-by-itself` | GA-BRIDGE-45 | — | After a file mismatch, the harness restores the changed file and restarts the subject, and the `faults` entries clear, or the server starts, with no reinstall |
| `calls-unmapped-tool` | GA-BRIDGE-46 | — | |
| `relays-elicitation` | GA-BRIDGE-47 | — | |
| `passes-credentials` | GA-BRIDGE-48 | — | The harness's test plugin reports the environment and arguments it was started with |
| `runs-elevated` | GA-BRIDGE-49 | — | The harness's test plugin reports its own privileges |
| `stops-on-lock` | GA-BRIDGE-49 | GA-BRIDGE-58 | The harness locks the session a `needsSession` test plugin runs in, and the subject stops its server or reports its devices `available: false` |
| `starts-for-an-ssh-login` | GA-BRIDGE-49 | — | The chosen account of a `needsSession` test plugin is logged in over SSH only, and the subject publishes its devices `available: true` |
| `applied-without-confirms` | GA-BRIDGE-51 | GA-BRIDGE-8 | An `applied` for an action declared `confirms: false` breaks GA-BRIDGE-8 too |
| `drops-the-tool-text` | GA-BRIDGE-51 | — | A test plugin's tool returns `isError` with a text, and the subject's `failed(no_confirmation)` carries no `detail` |
| `reads-back-late-only` | GA-BRIDGE-51 | — | A test plugin's tool succeeds with its state already changed and sends no change notification, and no state read reaches it within 1 s of the tool's result, the harness's allowance added |
| `unstable-account-token` | GA-BRIDGE-52 | — | The harness renames an account, and its token changes |
| `takes-an-unsafe-name` | GA-BRIDGE-52 | — | The test transport scripts an account named `John.Doe`, and its token is not the `u` form |
| `takes-a-held-name` | GA-BRIDGE-52 | — | The test transport renames the account `liza` and adds a new account named `liza`, or one named `u7`, and the new account's token is its name |
| `reuses-a-deleted-token` | GA-BRIDGE-52 | — | The test transport deletes the account `liza` and adds an account with the same uid, or named `liza`, and the new account gets the token `liza` |
| `reports-one-session` | GA-BRIDGE-52 | — | The test transport logs one account in at the console, locked, and over Remote Desktop, active, and the account's key reads `locked` |
| `ssh-reads-unknown` | GA-BRIDGE-52 | — | The test transport logs an account in over SSH only, reported non-graphical and not idle, and the account's key reads `unknown` |
| `ssh-hides-a-lock` | GA-BRIDGE-52 | — | The test transport has an account locked at the console and logged in over SSH, and the account's key reads `active` |
| `takes-the-unknown-name` | GA-BRIDGE-52 | — | The test transport scripts an account named `unknown`, and its token is its name |
| `retires-a-lapsed-account` | GA-BRIDGE-52 | — | The test transport drops a directory account from the OS's listing for a while without reporting it deleted, and when it is listed again its token has changed |
| `keeps-a-deleted-directory-token` | GA-BRIDGE-52 | — | The test transport has the directory answer that a directory account does not exist, then lists a new account under its uid, and the new account gets the old token |
| `helper-claims-locked` | GA-BRIDGE-52 | GA-BRIDGE-61 | The test transport runs a helper in a session the OS reports unlocked and connected, which reports its own session `locked`, and the subject's key for it reads `locked`; trusting a helper's word is GA-BRIDGE-61's failure too |
| `drops-plugin-network-control` | GA-BRIDGE-53 | — | A test plugin's manifest lists an `otherAdmins` entry, and its devices do not carry it |
| `hides-pc-admins` | GA-BRIDGE-53 | GA-BRIDGE-14 | An administrators group change with no event is an unreported change of `otherAdmins` |
| `keeps-a-demoted-admin` | GA-BRIDGE-53 | — | The test transport removes an account from the administrators group, and the subject still lists it in `otherAdmins` after the OS reports the change or, unreported, 24 h after it |
| `hides-the-plugin-account` | GA-BRIDGE-53 | — | A test plugin runs as an account that is not an administrator, and its devices' `otherAdmins` do not list it |
| `misses-a-polkit-admin` | GA-BRIDGE-53 | — | The test transport names an account an administrator through polkit's rules alone, and the subject's `otherAdmins` do not list it |
| `misses-the-docker-group` | GA-BRIDGE-53 | — | The test transport adds an account that is not otherwise an administrator to the `docker` group, and the subject's `otherAdmins` list neither it nor the group |
| `trusts-an-incomplete-admin-list` | GA-BRIDGE-53 | — | The test transport has a polkit rule that decides by the time of day, and the subject's `otherAdmins` carry no `{ vendor: "os", label: "unknown" }` |
| `trusts-a-one-command-grant` | GA-BRIDGE-53 | — | The test transport grants an account one command, `/usr/bin/less`, as root through sudo, and the subject's `otherAdmins` do not list the account |
| `trusts-a-narrowed-sudo-grant` | GA-BRIDGE-53 | — | The test transport grants an account `ALL, !/bin/su` through sudo, and the subject's `otherAdmins` do not list the account |
| `gives-a-group-a-user-token` | GA-BRIDGE-53 | — | The test transport grants the rights to a group whose gid equals a listed account's uid, and the group's token is that account's `u` token |
| `misses-a-debug-privilege` | GA-BRIDGE-53 | — | The test transport grants an account that is in no administrators group `SeDebugPrivilege` through local policy, and the subject's `otherAdmins` do not list it |
| `hides-a-session-plugin-account` | GA-BRIDGE-53 | — | A `needsSession` test plugin runs as an account that is not an administrator, and the computer's `otherAdmins` do not list it |
| `offers-a-shell` | GA-BRIDGE-54 | — | The subject offers an action whose argument the test transport's OS hook sees run |
| `relay-up-without-arp` | GA-BRIDGE-55 | GA-BRIDGE-23 | A relay `up` with no answering gateway is a transport `up` without an exchange |
| `relay-entry-closed` | GA-BRIDGE-55 | — | A relay entry is declared `feedback: closed`, or without `internal` |
| `reinstall-swaps-tools` | GA-BRIDGE-57 | — | The harness reinstalls an installed version with a manifest carrying other `toolHashes`, and the subject ends it `installed` |
| `reinstall-changes-account` | GA-BRIDGE-57 | — | The harness reinstalls an installed version for another account, and the subject ends it `installed` |
| `reinstall-swaps-the-package` | GA-BRIDGE-57 | — | The harness reinstalls an installed version from a package with another `sha256` and the same manifest, and the subject ends it `installed` |
| `keeps-a-dead-server` | GA-BRIDGE-58 | — | The harness's test plugin exits, and its devices stay `available: true`, or its server is never started again |
| `unavailable-while-starting` | GA-BRIDGE-58 | — | The harness's test plugin takes 20 s after the bridge's own start to serve its first state read, within the 120 s start bound, and the subject publishes its devices `available: false` meanwhile |
| `misses-a-hung-server` | GA-BRIDGE-58 | — | The harness's test plugin, with `cadenceMs` 300 000, serves and then stops answering while it still runs, and its devices are still `available: true` 30 s later |
| `starts-for-ever` | GA-BRIDGE-58 | — | The harness's test plugin never serves a state read, and its devices are still `available: true` 130 s after its start |
| `retries-once-an-hour` | GA-BRIDGE-58 | — | The harness's test plugin exits at every start for 30 min, and two of the subject's starts of it are more than 300 s apart |
| `hangs-every-server-on-resume` | GA-BRIDGE-58 | — | The test transport resumes the host after 1 h asleep, the clock that runs through a sleep having moved 1 h, and the subject publishes the test plugin's devices `available: false` though every read and probe since the resume was answered |
| `crash-loops-silently` | GA-BRIDGE-58 | — | The harness's test plugin exits at every start, and after its fifth failed start in a row no `faults` entry of code `crash_loop` names its devices |
| `unavailable-on-the-way-down` | GA-BRIDGE-58 | — | The test transport announces a suspend, and the subject publishes the test plugin's devices `available: false` as it stops their server before its graceful `offline` |
| `stays-unavailable-after-serving` | GA-BRIDGE-58 | — | After `activate`'s `ok`, the test plugin serves its first state read, and its devices are not published `available: true` within 1 s, the harness's allowance added |
| `waits-for-the-cadence` | GA-BRIDGE-60 | — | A test plugin with `cadenceMs` 300 000 sleeps with its host, the test transport resumes it, and no state read reaches the plugin within 10 s of the subject's first `status` |
| `holds-a-command-while-starting` | GA-BRIDGE-60 | — | A command to a test plugin's device during its 20 s start is not acked `failed(unreachable)` within 1 s |
| `gives-up-after-a-failed-read` | GA-BRIDGE-60 | — | A test plugin with `cadenceMs` 300 000 answers its first state read after a resume with an error and the next with its state, and no second read reaches it within 20 s of the first |
| `trusts-a-forged-helper` | GA-BRIDGE-61 | — | The test transport runs a helper in one session that reports another session `active`, and the subject's key for that session changes |
| `trusts-a-background-helper` | GA-BRIDGE-61 | — | The test transport runs a helper in a session that is not active at the console, which reports `camera_in_use: true`, and the computer's key changes |
| `trusts-a-second-helper` | GA-BRIDGE-61 | — | The test transport connects a second helper process, not the one the subject started, from a session that already has its helper, or from a test plugin's server, which reports the session `active`, and the subject's key for it changes |
| `hides-the-sender` | GA-BRIDGE-62 | — | The computer's `notify` declaration does not list `from` |
| `notifies-one-session` | GA-BRIDGE-62 | — | Two sessions are logged in and unlocked, and the notification hook records the `notify` in one of them only |
| `acks-an-unshown-notify` | GA-BRIDGE-62 | — | Every logged-in session is locked, and the subject acks a `notify` to the computer `applied` |
| `notifies-a-disconnected-session` | GA-BRIDGE-62 | — | The only logged-in session is disconnected, with its helper running, and the subject acks a `notify` to the computer `applied` |
| `cancel-fails-when-idle` | GA-BRIDGE-63 | — | A `cancel` with nothing scheduled is acked `failed` |
| `credential-readable` | GA-BRIDGE-64 | — | The packaging leaves the broker credential readable by the account that is not an administrator |
| `helper-endpoint-open` | GA-BRIDGE-64 | — | A process of the account that is not an administrator binds the helpers' endpoint before the service starts, and the subject's helpers connect to it |
| `hides-the-broker-host` | GA-BRIDGE-65 | — | The subject connects to the harness's broker over loopback, and its computer carries no `proposedInfrastructure` |
| `hides-the-broker-host-by-address` | GA-BRIDGE-65 | — | The subject connects to the harness's broker, on its own host, through that host's LAN address, and its computer carries no `proposedInfrastructure` |
| `locks-one-session` | GA-BRIDGE-66 | — | An account has two unlocked sessions, and the test transport records a `session.lock` for it in one of them only |
| `acks-an-unhonoured-lock` | GA-BRIDGE-66 | — | The test transport accepts a `session.lock` and never reports the session locked, and the subject acks it `applied` |
| `waits-on-an-ssh-login` | GA-BRIDGE-66 | — | An account has a console session and an SSH login; the test transport reports the console session locked, and the subject acks the `session.lock` `failed(not_locked)` |
| `acks-an-ssh-only-lock` | GA-BRIDGE-66 | — | An account is logged in over SSH only, and the subject acks a `session.lock` for it `applied`, or does not ack it `failed(no_graphical_session)` within 1 s of its receipt, the harness's allowance added |
| `declares-a-lock-not-idempotent` | GA-BRIDGE-66 | — | The subject declares a computer's `session.lock` `idempotent: false` |
| `locks-an-unlisted-account` | GA-BRIDGE-66 | — | The subject's `session.lock` declares `account` without the tokens `accounts` lists, or acks a lock naming a retired token other than `failed(invalid_request)` within 1 s |
| `serves-a-deleted-account` | GA-BRIDGE-67 | — | The test transport deletes the account a test plugin runs as, and its devices stay `available: true`, or no `faults` entry of code `account_deleted` names them, or its server is started again |
| `reinstalls-for-a-deleted-account` | GA-BRIDGE-67 | GA-BRIDGE-57 | After that deletion, the harness reinstalls the version naming another account, and the subject ends it other than `install_failed(version_conflict)`; a reinstall for another account is GA-BRIDGE-57's conflict too |
| `install-never-ends` | GA-BRIDGE-68 | — | The harness stalls the package's download, and no `install_failed` comes within 600 s |
| `install-without-end` | GA-BRIDGE-68 | — | The harness serves a package whose hash is wrong, and no `install_failed` comes |
| `uninstall-leaves-a-server` | GA-BRIDGE-68 | — | The harness uninstalls a test plugin, and after `uninstalled` its server still reports running or its devices are still in `devices` |
| `accepts-a-slow-cadence` | GA-BRIDGE-68 | GA-BRIDGE-13 | A test plugin's manifest declares `cadenceMs` 3 600 000, and the subject ends it `installed`; the bound it then declares is over the cap the text sets |
| `accepts-an-object-key` | GA-BRIDGE-68 | — | A test plugin's manifest gives an extension key an object schema, and the subject ends it `installed` |
| `installs-for-no-account` | GA-BRIDGE-68 | — | An `install` names an account token the computer's `accounts` does not list, and the subject ends it `installed` |
| `accepts-a-colon-key` | GA-BRIDGE-68 | — | A test plugin's manifest declares a device `key` holding `:`, and the subject ends it `installed` |
| `installs-for-another-host` | GA-BRIDGE-68 | — | An `install` names a `host` that is not the subject's computer, and the reply is not `invalid_request` |
| `uninstalls-a-stranger` | GA-BRIDGE-68 | — | An `uninstall` names a plugin the subject never installed, and the reply is not `failed(unknown_plugin)` |
| `forgets-an-install-on-restart` | GA-BRIDGE-68 | GA-BRIDGE-31 | The harness stalls a package's download, restarts the subject, and no `installed` or `install_failed` for that `requestId` comes after the start |
| `runs-a-writable-interpreter` | GA-BRIDGE-68 | — | A test plugin's `command` names `python3`, found only in a directory the plugin's account can write without elevation, and the subject ends it `installed` |
| `hijacks-the-interpreter-by-path` | GA-BRIDGE-68 | — | The plugin account's search order puts a directory the account can write, empty at install, before the OS's directory that holds `python3`, and the subject ends a test plugin naming `python3` `installed`, or, once a `python3` is planted there, the test plugin reports it was started through it |
| `accepts-a-long-id` | GA-BRIDGE-68 | — | A test plugin's manifest declares an `id` of 41 characters, or a device `key` holding a space, and the subject ends it `installed` |
| `drops-the-old-version-early` | GA-BRIDGE-69 | — | |
| `forgets-staged-for` | GA-BRIDGE-69 | — | After the new version's `activate`, a device of it the owner has not yet adopted is listed without its `stagedFor` |
| `restarts-the-old-version` | GA-BRIDGE-69 | — | After a staged version's swap, the harness restarts the subject, and the old version's test plugin reports a start, or its devices are in `devices` again |
| `swaps-to-a-broken-version` | GA-BRIDGE-69 | — | The new version's test plugin fails its file check at the swap, and the old version's server is stopped or its devices leave |
| `swaps-after-a-cancel` | GA-BRIDGE-69 | — | A staged version's test plugin fails its start, the harness sends `activate` naming the running version, and the new server, once it serves at a restart, or at the subject's next start, still swaps the old version out |
| `shares-a-plugin-identifier` | GA-BRIDGE-69 | — | A test plugin's device carries a `stableIdentifier` that is not its computer's `stableIdentifier`, `/`, the plugin's `id`, `/` and its `key`, so two PCs hosting the plugin would show one identifier |
| `install-dir-writable` | GA-BRIDGE-70 | — | The packaging's install directory grants write to the plugin's account |
| `box-denies-silently` | GA-BOX-1 | — | |
| `grants-a-wildcard-read` | GA-BOX-1 | — | |
| `grants-the-lock-unwarned` | GA-BOX-2 | — | |
| `grants-personal-keys-unwarned` | GA-BOX-2 | — | The box's tool grants a reader a plugin device whose `personal` lists `title`, and asks the owner to confirm no warning |
| `keeps-a-grant-on-a-new-personal-key` | GA-BOX-2 | — | The owner adds a key to a granted device's `personal`, and the grant stands 60 s later with no word to the owner |
| `grants-the-roster` | GA-BOX-1 | — | |
| `trusts-an-unverified-acl` | GA-BOX-2 | — | |
| `finder-topics-open` | GA-BOX-1 | — | A bridge's identity may subscribe to `{root}/finder/candidates` |
| `bad-manifest` | GA-BRIDGE-39 | — | |
| `connect-ignored` | GA-BRIDGE-40 | — | The bridge replies `accepted` and never ends the work |
| `connect-readmits` | GA-BRIDGE-40 | GA-BRIDGE-35 | A `connect` for a held device mints a new id |
| `connect-takes-the-unproven` | GA-BRIDGE-40 | — | The harness answers at the address with a device holding no credential, and the bridge says `connected` |
| `takes-another-device` | GA-BRIDGE-40 | — | The harness's device proves it holds the key but shows none of the candidate's keys, and the bridge says `connected` |
| `connects-to-the-box` | GA-BRIDGE-40 | — | A `connect` names the broker's container address, `::ffff:127.0.0.1` or a broadcast address, and the bridge opens a connection |
| `takes-with-another-secret` | GA-BRIDGE-40 | — | The harness's device proves a secret the bridge holds for another device, and the bridge says `connected` |
| `follows-without-proof` | GA-BRIDGE-40 | — | After a taken device's name moves to the harness's impostor, the bridge reconnects and takes its readings |
| `connects-a-blocked-device` | GA-BRIDGE-40 | GA-BRIDGE-27 | A `connect` reaches an identifier removed with `blockRejoin`, and the bridge says `connected` |
| `connect-twice` | GA-BRIDGE-40 | — | Two `connect`s to one bridge, for two candidates of one device, both run |
| `no-bridge-type` | GA-BRIDGE-41 | — | The subject names a manifest and leaves `bridgeType` out of `status` |
| `partial-connections` | GA-BRIDGE-41 | — | The bridge knows a device's MAC and lists only its `mdns:` key |
| `declares-a-toggle-discrete` | GA-BRIDGE-71 | — | The test transport's IR TV has one power code for on and off, and `onoff.turn_off` is declared without `toggles` |
| `trusts-a-learned-code` | GA-BRIDGE-71 | — | The test transport's IR device has a power code learned from a remote, with nothing declared about it, and `onoff.turn_off` is declared without `toggles` |
| `mute-transmitter-up` | GA-BRIDGE-72 | GA-BRIDGE-23 | A transmitter that answers nothing is published `up`, which is also `up` without an exchange |
| `answering-blaster-unknown` | GA-BRIDGE-72 | — | An IR blaster that answers status queries on its host link is published `unknown` |
| `downs-an-idle-transmitter` | GA-BRIDGE-72 | — | A transmitter that answers nothing, whose host link is present and no write to which has failed, is published `down` |
| `keeps-an-unplugged-dongle` | GA-BRIDGE-72 | — | The test transport removes the device node of a transmitter that answers nothing, and its transport stays `unknown` |
| `sends-into-a-failed-write` | GA-BRIDGE-72 | — | The test transport fails a write to a transmitter that answers nothing, and the command is acked `sent` or `failed(no_confirmation)` |
| `declares-a-cycle-discrete` | GA-BRIDGE-71 | — | The test transport's IR air conditioner changes mode by one button that steps to the next mode, and `climate.set_mode` is declared without `toggles` |
| `builds-from-memory` | GA-BRIDGE-73 | — | The test transport's IR air conditioner's frame carries mode and setpoint; after the subject restarts, a `climate.set_setpoint` whose command's `state` carries `mode: cool` is sent with another mode, or the action is declared without `wholeState` |
| `stays-down-after-reopen` | GA-BRIDGE-72 | — | A write to a transmitter that answers nothing fails, the test transport then lets its host link open, and the transport stays `down` |
| `closes-a-mute-device` | GA-BRIDGE-72 | — | An IR air conditioner on an `unknown` transport is published `feedback: closed` |
| `finder-dies-silently` | GA-FIND-1 | — | |
| `finder-probes-devices` | GA-FIND-2 | — | |
| `new-id-on-new-address` | GA-FIND-3 | GA-FIND-4 | A new id is a candidate dropped and another added |
| `reuses-a-candidate-id` | GA-FIND-3 | — | A candidate dropped and heard again after a restart gets an id another candidate had |
| `lists-a-partial-match` | GA-FIND-3 | — | An announcement matching one field of a two-field matcher is listed |
| `address-from-the-packet` | GA-FIND-3 | — | The harness announces an SRV record naming another host, and the candidate's `address` is the packet's source |
| `offers-usb-connect` | GA-FIND-3 | — | A USB candidate's match says `connect: true` |
| `candidates-late` | GA-FIND-4 | — | |
| `grows-without-bound` | GA-FIND-4 | — | The harness announces 600 matching instances, and more than 512 are listed, or no `faults` entry says so |
| `never-drops` | GA-FIND-4 | — | The harness steps its time source 7 days past a DHCP-only candidate's last hearing, and it is still listed |
| `waits-to-be-told` | GA-FIND-4 | — | A device that announced before the finder started, and answers questions, is not listed after the start |
| `hides-an-off-source` | GA-FIND-5 | — | |
| `finder-test-unannounced` | GA-FIND-6 | — | |
| `publishes-an-undescribed-key` | GA-BRIDGE-76 | GA-BRIDGE-1 | The test transport's sensor sends a datapoint its entry does not declare, and the subject publishes it as a reading and names it nowhere in `undescribed` |
| `maps-motion-to-occupancy` | GA-BRIDGE-78 | — | The test transport's movement sensor, whose library calls its reading `occupancy`, is published under `occupancy` rather than `motion` |
| `publishes-an-unconfirmed-setting` | GA-BRIDGE-79 | GA-BRIDGE-1, GA-BRIDGE-5 | After a restart, the subject publishes a setting the test transport's sensor never reported or echoed |
| `forgets-a-confirmed-setting` | GA-BRIDGE-79 | GA-BRIDGE-31 | After the harness restarts the subject, a setting the test transport's sensor echoed before the restart, and answers no read for, is missing from its status |
| `holds-back-silently` | GA-BRIDGE-80 | — | The subject leaves out a key the test transport's sensor model promises and has not yet reported, and lists it nowhere in `awaitedKeys` |
| `holds-back-the-leak` | GA-BRIDGE-80 | — | The subject holds back the test transport's leak sensor's `leak`, a boolean, until the first leak |
| `holds-back-again-after-restart` | GA-BRIDGE-80 | GA-BRIDGE-31 | After a restart, the subject holds back again a key the test transport's sensor reported before it |
| `drops-a-setting-on-a-rejoin` | GA-BRIDGE-79 | GA-BRIDGE-74 | The subject drops the test transport's kept setting when its device makes a secured rejoin |
| `keeps-a-setting-through-an-interview` | GA-BRIDGE-79 | — | The subject keeps publishing the test transport's kept setting after its device is interviewed again, the device answering no read of it |
| `repeats-the-undescribed-event` | GA-BRIDGE-76 | GA-BRIDGE-31 | The subject publishes a second `undescribed` event for a name it announced before, across a restart |
| `declares-after-the-reading` | GA-BRIDGE-80 | GA-BRIDGE-1 | The subject publishes a held-back key's first value before the `devices` that declares it |
| `replays-an-occurrence` | GA-BRIDGE-75 | — | The subject restarts after a sensor's occurrence and publishes it again |
| `misnames-an-extension` | GA-BRIDGE-77 | — | The subject declares an extension key named `battery` under its own namespace for a device whose battery the applier's vocabulary names |
| `retains-an-occurrence` | GA-BRIDGE-75 | — | The test transport's sensor declares an `event` key, and the subject puts its value in the device's retained status as well as the occurrence |
| `keeps-a-stale-description` | GA-BRIDGE-74 | — | The test transport's button pusher reports its mode changed from switch to click, and the subject keeps `onoff.turn_on` declared idempotent |
GA-BRIDGE-56 is judged, and has no negative subject: what a screen shows is not on the wire, and
a subject built to fail a person's grade tests the grader. GA-BRIDGE-50 is a SHOULD. The clauses
0.4 adds to GA-BRIDGE-13, 22, 37, 49, 53, 57, 68 and 69, and to GA-BOX-2, have subjects of their own above; the manifest records
every subject an id has, in the order listed. The clauses it adds to GA-BRIDGE-31, 32, 35 and 38 are graded
under those ids with the PC hooks above, and have no subject of their own yet. 0.5's GA-BRIDGE-74 to 77 have
the subjects above; the clauses it adds to GA-BRIDGE-1 and 38 are graded under those ids. 0.6's
GA-BRIDGE-78 to 80 have the subjects above; the clauses it adds to GA-BRIDGE-1, 5, 31 and 74 are graded
under those ids.

## What this standard does not define

- The JSON Schemas are owed, but for the manifest's (`conformance/galatea-bridge.schema.json`). They
  are built with the conformance harness; until they exist, the tables above are the shapes, and
  the schemas must not contradict them. An AsyncAPI description
  of the topics may accompany them; it cannot state the floors, so the manifest stays the source.
- Commissioning over Bluetooth (see *Provisioning*).
- Warnings on a low battery: battery state is a reading like any other.
- **Known limitation: open-loop devices.** A bridge cannot report what an open-loop device did (a
  code written is not a code landed), and a transmitter that can answer nothing can fail unseen
  (GA-BRIDGE-72). The guarantees that rest on an observed state are weaker for such devices; what
  stands in their place is in `standard/applier.md`, *What this standard does not define*.
- How the reference bridges map zigbee2mqtt and matterjs-server onto this binding: their own plan.
- Any binding other than MQTT.
- Which discovery sources a box enables, how it installs manifests and
  starts a bridge, and how the owner's app shows candidates.
- Plugin signing: whose keys, and what the owner sees for an unsigned package. Candidates are
  MCPB's signing and a pinned commit of the plugin's source; until one is chosen, the `install`'s
  `sha256` binds.
- A plugin's skill for brains, and how it reaches one, if at all.
- Whether a person saw a notification. A computer's `notify` acked `applied` was handed to the
  OS's notification service in each session that could show it (GA-BRIDGE-62); Focus Assist or Do
  Not Disturb may hold it, and no OS tells the bridge so.
- What the owner's app says at a plugin's adoption. It should say that a plugin device's `acked`
  rests on the plugin's own report (its `confirms` and `confirmedBy` are the publisher's word,
  *Hosting*); nothing here requires it, and nothing checks a plugin's honesty.
- Whether a transmitter that answers nothing still works. A bare IR LED whose wire is cut, or whose
  emitter died, fails no write, so its transport stays `unknown` and its devices usable, their
  commands `sent`, for ever (GA-BRIDGE-72); the applier tells the owner so at adoption
  (`standard/applier.md`, GA-ADOPT-6), and only a witness can say what a command did.
- `toggles` and `wholeState` on an applier older than 0.10, which ignores both, and so may send a
  toggling code to reach a state, and sends a whole-state action no `state`, so its code is built
  from the model's defaults. A bridge cannot see its applier's version (GA-BRIDGE-71, GA-BRIDGE-73).
- A non-interactive service account for a plugin. `install` names an account `accounts` lists, an
  interactive one, whose files and sessions its plugin can reach. Letting it name a dedicated,
  unprivileged account needs a design choice not yet made: who creates the account, and how it
  appears to the applier and the owner.
