---
title: The bridge standard — design
status: draft
last_verified:
area: architecture
audience: dev
author: Galatea maintainers
related:
  - standard/applier.md
  - standard/steward.md
  - standard/bridge.md
  - docs/reference/2026-09-24-home-reference-scenarios.md
---

# The bridge standard — design

**Path: architectural.** A new standard at a new seam, between the applier (the gate) and the
processes that speak to radios and buses (the doers). It replaces the placeholder that stood
in `standard/bridge.md`, and changes the applier and, a little, the steward.

## What it is for

Three jobs, not two:

| Job | Who | Knows |
|---|---|---|
| Scenario runner | steward | what should happen, when, for whom |
| Gate | applier | whether this device may take this now: tiers, tokens, latches, loads, safety rules |
| Doer | **bridge** | how to make this radio or bus do it, and what the device said back |

The gate is security-critical and should exist once, audited. Doers are many, follow hardware, and
are written by whoever knows the protocol. Keeping them apart keeps the trust boundary small (a
buggy Zigbee doer is not a buggy gate), lets doers be swapped (zigbee2mqtt today, something else
tomorrow) without re-certifying the gate, and lets one gate serve Zigbee, Matter and IR at once, so
a safety rule that reads a Zigbee leak sensor and closes a Matter valve lives in one applier.

The standard also gives the doer its second job, found by HS17 and HS18: **provisioning**. Today no
Galatea standard can open a join window, take a Matter setup code, say what a new device is, or
replace a dead one. Both scenarios grade "cannot".

## Rulings it stands on

- Brain, steward, one applier; the applier may be a meta-applier (2026-09-24). Bridges sit below an
  applier, never beside it.
- The standards belong to no one implementation (2026-09-24): nothing may rest on any one system's
  bridge text.
- No premature policy (2026-09-24): safety floors are MUSTs; defaults and heuristics are left to
  implementations.
- **Every new device waits for an owner** (the maintainer, 2026-09-24): a device new to an applier, from a
  bridge or an adapter's engine, a Matter lock of certain type included, takes no action until an
  owner adopts it. Accepted cost: only an owner adds a device.
- Only the owner's configuration credential may `configure` an applier (GA-CFG-1), so every
  provisioning action below is owner-only and never passes through a brain. No new ruling is needed
  for that.

## Evidence

- **zigbee2mqtt**: a
  retained bridge state with a will, so its death is visible; **no reply to a command**, and state
  re-published optimistically by default, so a doer over it must build its own result from the
  device's report; per-device availability off by default, 25 h for battery devices when on;
  `permit_join` for at most 254 s, optionally through one router; no replace.
- **Matter**: setup codes of 11 or 21 digits; commissioning on the network through a
  window another admin opens (3 to 15 min); a controller can read **every fabric** on a device;
  locks need timed invokes, and every invoke returns a status; a silent node is noticed in minutes,
  not seconds. python-matter-server is archived; matterjs-server keeps its API.
- **Home Assistant and Alexa**: Home Assistant confirms every discovered integration, but adds a joined Zigbee device at once and
  exposes a new `switch` or `cover` to voice by default, so a valve that says it is a switch opens
  by voice, and a new garage door opens by voice. Alexa lets anyone near a Zigbee Echo start
  discovery, and gates unlocking and garage opening with an opt-in voice code, and valves not at
  all. Neither can replace a dead Zigbee device. Home Assistant's Matter integration lists every
  controller on a device and lets an admin remove one.

What we take: a joined device is visible but inert until an owner adopts it; the class, not the
transport, decides the gate; replacement is a re-binding; other controllers are shown. What we do
not copy: voice exposure of a new device by default, and a gate that covers locks but not valves.

## Rejected alternatives

- **No bridge standard; doers are the applier's internals.** Proposed in this conversation and
  withdrawn: it hides the seam where doers interoperate, and leaves provisioning nowhere.
- **A bridge is an Act-level child applier.** The meta-applier already routes to children, but
  every doer would then implement plans, tiers, tokens and history: the gate written once per
  protocol.
- **A request/response binding (MCP, or HTTPS+JSON as the other seams now use).** Recommended in
  the first draft, overruled (the maintainer, 2026-09-24): MQTT, opinionated until an industrial reason says
  otherwise. MQTT suits this seam: many bridges and one applier on a bus the box already runs for
  zigbee2mqtt, wills and retained state from the broker, and publish/subscribe for device events.
- **The will as the liveness rule.** A will fires only when the broker loses the
  connection; a bridge whose main loop hangs while its MQTT client keeps pinging never fires one.
  The applier pings instead (below);
  the will stays, for a quick answer when the connection does drop.
- **MQTT 3.1.1.** zigbee2mqtt still defaults to it, but it has no reason codes on a refused publish
  and no message expiry, so a denied grant is silent and a late command runs late. MQTT 5 only.

## The model

A **bridge** fronts devices over one or more **transports**: a Zigbee coordinator, a Matter fabric
with its Thread and Wi-Fi paths, an IR blaster, a Modbus gateway. A transport is the unit of shared
fate. A bridge has exactly one client, its applier; an applier may have many bridges, each
registered through `configure` as `{ id, identity }`, the identity its broker certificate names. A device is owned by exactly one
bridge. A `stable_identifier` seen under two bridges with no route is handled as GA-META-2 handles
one under two children: exposed once, its steps `refuse(duplicate_route)`, one `route_conflict`
event, until `configure` routes it to one bridge.

**Ids.** A bridge's device ids are its own. The applier gives each device its own `id` when it
first sees it, unique within the applier, and keeps the map to `{ bridge, device }`. Every applier
operation (`adopt`, `provision`'s `near` and `remove`, plans) names the applier's id; the applier
translates. Replacement re-points an applier id at another bridge device. Transports are named the
same way: the applier gives each its own id, unique within the applier, and a meta-applier's union
of its children's transports is namespaced as its device ids are.

A bridge knows nothing of persons, rooms, tiers, plans or tokens. It is trusted for what devices
report, as the applier's own reading of a device is, and for nothing else.

- **Devices.** Each: `id` (the bridge's), `stable_identifier`, `transport`, `model` (`vendor`,
  `model`), `capabilities` and actions, `feedback` (`closed` or `open`), `proposed_class` (from the
  applier's closed class list, or null) with its
  `class_evidence` (`protocol`: a Matter device type; `model_db`: a model database; `none`),
  `fresh_s` with its `fresh_basis` (`declared`, `observed` or `unknown`), `other_admins` (the other
  controllers the protocol shows, each `{ vendor, label }`; `[]`; or `unknown` where the protocol
  cannot tell), and `available`.
- **Transports.** Each: `id`, `kind` (one of the applier's `protocol` values, which becomes each of
  its devices' `protocol`), and `up` or `down`. `up` means a successful exchange with the
  transport (a read, a report received, or a protocol health check the bridge made) within the
  last 30 s; a ping proves only the bridge's main loop, and a connect proves nothing.
  `down` makes every device on the transport `dead`. How quickly a protocol notices a silent device
  (minutes for Matter) does not matter to the applier: it judges staleness itself, from each
  value's `basis_time` and the device's `fresh_s`. For Matter, `fresh_s` is the subscription's
  interval the device **granted**, plus the controller's slack before it declares a node gone
  (one bench measured grants of 33, 16, 5 and 4 s for requests of 30, 10, 5 and 1 s, and about 38.5 s
  of slack, on one bench: a guess until measured more widely).
- **State.** `{ key, value, basis_time }`, the time of the observation, never of the message. A
  bridge never reports a value it cannot currently observe, and reports its own loss of contact as
  `available: false`, never as a value (a deployed fleet had both: a bridge that restamped a cached
  value, and bridges that published `unknown` on losing a device). `unknown` as a value means
  only that the bridge read the device and could not derive the state. A field that fails its
  declared type is left out, and the rest published. Times are RFC 3339 in UTC with milliseconds,
  never ahead of the bridge's clock.
- **Commands.** `command { command_id, device, action, args, result_within_s }`, idempotent on
  `command_id`. Over MQTT nothing is synchronous, so the applier decides what it can before it
  publishes: a device whose bridge is dead, whose transport is `down`, or which is `available:
  false`, or any device while the applier has lost the broker, is `unreachable` at once, with
  nothing published and the token unused (GA-APPLY-5, GA-TOKEN-4, as today). Otherwise the
  applier publishes the command, and **dispatch is a PUBACK with a success code**: the step is
  `applied`, and the token counts as used. A PUBACK of `0x10` (no matching subscribers: the bridge
  is between connections) or `0x87` (not authorized, also a fault event) means nothing was
  delivered: the step is `unreachable`, the token unused. A connection lost before any PUBACK
  means the command may or may not have been delivered: the step is `applied`, the token counted
  as used, the applier never re-sends it after reconnecting, and it is judged as below, as if the
  bridge's result never came. On one host this fits GA-APPLY-1's
  500 ms. `result_within_s` is the action's ack bound, counted from the publish; it
  is also the command's Message Expiry, so the bridge works to whatever expiry remains when the
  command reaches it, and never starts one whose expiry has run out. The bridge answers with a
  `reply` within 1 s: `accepted`; `unreachable` if it knows better than the applier did (the
  step becomes `unreachable` after `applied`: *Outcomes* is amended to allow that, and the token
  stays used, since it was dispatched); or `failed(reason)`, for a device it does not have
  (`unknown_device`) or an action it cannot map (`unsupported_action`), which ends the step
  `failed(reason)`. An accepted command ends in exactly one **result** event
  within `result_within_s`: `done` (the protocol confirmed the command: a Matter invoke's success status,
  a Zigbee default response), `sent` (nothing can confirm it: an open-loop device, or a protocol
  path with no response, as zigbee2mqtt's `set`), or `failed(reason)`. The result is the
  protocol's word about the command, not about the device's state. **Whether a stateful action
  took is the applier's to judge**, as today: `acked` when a state report matches within the
  action's `tolerance` and ack bound, `failed(no_ack)` when none does, `late_ack` within its window
  (GA-APPLY-8, GA-APPLY-11), with one addition: a command whose target state
  already holds produces no report, so a `done` result while the device's fresh value already
  matches is `acked`. The first terminal outcome wins. A bridge's `failed(reason)` ends a stateful
  step `failed(reason)` unless a matching report came first; a matching report after it, within
  the late-ack window, is a `late_ack`, and so is one after a bridge's post-dispatch
  `unreachable` (the bridge was wrong). **Any action on a `feedback: open` device** (HS12's IR air
  conditioner), stateful or stateless, has no state to judge from: it ends `sent` on the bridge's
  `done` or `sent`, which is when a stateful action's `assumed` value changes, `failed(reason)` on a
  bridge failure, and `unanswered` if no result arrives within `result_within_s` (never
  `failed(no_ack)`). `unanswered` is a new final actuation outcome, named apart from the witness
  verdict `unknown` (GA-WIT-1). GA-STATE-4 and GA-APPLY-7's open-device clause are restated this
  way, and *Outcomes* and GA-SAFE-3's list of final outcomes gain `unanswered`, so a safety rule
  whose IR actuation goes unanswered completes, and its notice says so. **On a `feedback: closed`
  device**, a stateless action is
  `delivered` on `done`, `sent` on `sent`, and `failed(no_ack)` if no result arrives within
  `result_within_s` (a lost reply or result included): GA-APPLY-7 and GA-APPLY-8 are amended so that a stateless
  action a protocol cannot confirm ends `sent`, not `failed(no_ack)` (else every `cover.stop`
  through zigbee2mqtt fails). A bridge's `failed(reason)` is a stateless step's `failed(reason)`
  at once. GA-APPLY-11, and GA-SAFE-8's second notice, are amended so that a stateful step's later
  matching report is a `late_ack` after any `failed`, not only `failed(no_ack)`. A bridge's `unreachable` is
  the step's `unreachable`: GA-APPLY-5 and *Outcomes* are amended so that `unreachable` also
  covers a target whose bridge answers so after dispatch, and GA-TOKEN-4 so that a token, once
  dispatched, stays used whatever outcome follows (`unreachable`, `failed`, `unanswered`). A bridge remembers each `command_id` for at least
  `result_within_s`; the applier's own reissue uses a fresh one. The `reply` and the `result` are on
  different topics, so they may arrive in either order; the applier takes a result for a command
  whose reply it has not seen.
- **Provisioning** (level Provision): `join { transport, window_s, near? }`, where `near` names a
  router so that the window opens there and not house-wide; `join_close`; `commission { transport,
  code }` for Matter, by setup code, on the network (through a window another controller opened;
  commissioning over Bluetooth with network credentials is left out of 0.1, since the reference box
  has no Bluetooth, which means every new Wi-Fi Matter device joins another ecosystem first, as in
  HS18; a cost the owner should know); `commission` refuses a device that fails Matter's device
  attestation unless the owner passes `accept_unattested` (matter.js accepts every finding by
  default); `remove { device, block_rejoin, force? }`; `unblock { identifier }`. Events: `joined`, `interviewed`, `left`, `window_closed` with the devices that
  joined in it.
- **Liveness.** The applier sends each bridge a `ping` request every 5 s, answered from the
  bridge's main loop, not its MQTT client's thread. A bridge with no answer for 10 s is dead
  (GA-META-7's constants, reused), and so is one whose will arrives. **Losing the broker:** while
  the applier's own connection to the broker is down, every bridge is dead and every device behind
  one `dead`, at once, so nothing is planned as if it could be sent. After reconnecting, a bridge is
  live again only once it answers a fresh ping; its retained `online` is not enough.
- **Gaps.** Every `event` carries the bridge's `instance` and a `seq`. On a gap in `seq`, a new
  `instance`, or its own reconnection, the applier sends `snapshot`, which re-sends every retained
  topic. A lost `result` cannot be recovered; the no-result rule above covers it. A lost
  `window_closed` or `other_admins_changed` is recovered from the snapshot's `devices`: the applier
  raises the same notices from any unadopted device or new other admin it had not seen. The ping also proves both grants: the applier may write the bridge's
  requests, and the bridge may write its replies.

**Levels.** **Serve**: devices, transports, state, commands, liveness. **Provision**: join,
commission, remove. An IR blaster's bridge may be Serve only.

**Binding: MQTT 5.** From the research's sketch, decided here. Every topic sits under
`galatea/v1/bridge/{b}/`, where `{b}` is the bridge's authenticated identity; device ids in topics
are the bridge's own.

| Topic | Written by | QoS | Retained | Carries |
|---|---|---|---|---|
| `status` | the bridge; the broker, as its will | 1 | yes | `online` or `offline`, the bridge's `instance` (the will carries it too: the applier ignores a will whose `instance` is older than one it has already seen `online`; a will that arrives before the new instance's `online` counts as a death, which the new instance's answer to a ping then ends, as floor 17 says; a retained old-instance `offline` found on reconnecting is settled by a fresh ping) and levels, and `graceful: true` on an `offline` published before a clean disconnect (a planned restart, not an alarm); the will is `offline` without it |
| `devices` | the bridge | 1 | yes | *Devices*, without values |
| `transports` | the bridge | 1 | yes | *Transports* |
| `state/{device}` | the bridge | 1 | yes | the device's values with their `basis_time`, and `available` |
| `request/{op}` | the applier | 1 | never | `{ request_id, ... }`; `op` is `ping`, `command`, `snapshot`, `join`, `join_close`, `commission`, `remove` or `unblock`; Message Expiry of `result_within_s` on a command, 10 s otherwise |
| `reply` | the bridge | 1 | no | `{ request_id, op, status, data or error }` |
| `event` | the bridge | 1 | no | `{ seq, instance, type, ... }`: `result`, `joined`, `interviewed`, `left`, `window_closed`, `other_admins_changed`. A device's `available` lives only in its `state` |

- Correlation is the `request_id` (a command's is its `command_id`) in the payload, on fixed topics,
  not Response Topic; idempotency on it absorbs QoS 1 duplicates.
- A command's Message Expiry means a command that waited in the broker past `result_within_s` is
  never delivered, so it never runs late.
- Retained state is safe only behind the two checks the applier already makes: the bridge is live,
  and each value's `basis_time` is within the device's `fresh_s`. Message Expiry on retained state
  is hygiene only, since it counts from publication, not observation. `snapshot` re-sends
  everything, for an applier that wants a fresh copy.
- **Connections.** TLS with client certificates, the identity taken from the certificate
  (`use_identity_as_username` in Mosquitto), ClientID equal to it; plain TCP only on one host's
  loopback. The bridge: Clean Start, Session Expiry 0, keepalive at most 6 s (5 s recommended),
  its will on `status`, subscribing to `request/#` with Retain Handling 2 before it publishes
  `online`; never a shared subscription (two instances would split the commands between them); a
  second instance with the same identity takes the first one's session over, visibly, through its
  will. The applier: Session Expiry 0, Retain Handling 0 so that retained state loads. Device ids
  that appear in topics never contain `+`, `#` or `/`.
- **The test transport** is enabled by a start-up option the harness passes, and a bridge running
  it says so in `status` with the harness's run id (as GA-HARN's `test_run_id`), so a harness
  refuses a bridge wired to a real radio, and a real deployment can see a test bridge.
- **The broker's floor.** Only the applier may write `request/#`, and only bridge `{b}` may write
  under its own prefix; a refused publish or subscribe is refused visibly, with reason code `0x87`
  on PUBACK or SUBACK. Nothing else on the broker writes a request, a rule engine included. The
  reference box bundles Mosquitto (EPL-2.0) with its dynamic-security plugin: its plain ACL file
  grants every subscribe and filters only at delivery, so a denial would be silent. EMQX is out
  (BSL since 5.9, no embedding in a product for others); NanoMQ (MIT) is a lighter alternative with
  a much smaller community.

## The floors (bridge.md)

Each becomes a requirement with an id (`GA-BRIDGE-n`):

1. `basis_time` is the observation's, per value (a partial read restamps nothing it did not
   read); never a value it cannot observe; loss of contact is `available: false`.
   Times are RFC 3339 UTC with milliseconds, and never ahead of the bridge's clock: a fast
   clock makes a stale value look fresh.
2. Exactly one result per accepted command, within its `result_within_s`; a repeated
   `command_id` returns the first answer and does nothing.
3. **A state report is the device's.** A bridge never reports a value the device did not report:
   no optimistic state after a command (zigbee2mqtt's default must be turned off), no echo of the
   commanded value. The command's result may say the write was accepted (`done`), but a state
   value never does, since the applier's `acked` rests
   on state.
4. A command for a device whose transport is down, or which is unavailable, is replied
   `unreachable` within 1 s; one for a device the bridge does not have is replied
   `failed(unknown_device)`, naming it, never met with silence; a command whose remaining
   expiry has run out is never started. `done` is sent only once the protocol has confirmed, never
   on handing the command to the radio.
5. A fault on one device or one transport does not stop the others. A bridge does
   not exit on a recoverable fault (a deployed fleet's Zigbee bridge exited on every coordinator
   loss and restarted 916 times). Transport reconnection backs off exponentially to a ceiling of at
   least 60 s within 180 s, and the backoff resets only on a successful **read**, never a connect
   (a half-open gateway kept a connect-reset breaker at its floor for ever). Losing
   the broker is recovered in-process and changes no device's `available`. A bridge
   whose persisted state disagrees with its network (its store against the Matter fabric or the
   Zigbee coordinator) reports the fault in `status` and serves nothing until it is resolved.
6. `fresh_s` for every device: `declared` from what the bridge knows of the model; `observed` once
   it has seen the device check in twice, as at least 1.5 times the longest interval seen (the
   margin a guess), growing if a longer one is seen; `unknown` until then.
7. `other_admins` is read from the protocol where the protocol shows it (Matter); `[]` for a
   Zigbee device with no direct bindings, `unknown` for one with them (a bound remote or Touchlink
   controls it without the coordinator), and `unknown` otherwise; a change is an event.
8. `proposed_class` states its evidence; a bridge never claims `protocol` evidence it did not read.
9. A Zigbee transport runs on a network key and PAN id generated for that installation, never a
   default. A join window never outlasts its `window_s`, capped by the transport's own cap (254 s for
   Zigbee); `near` is honoured where the transport can; every device that joined is in
   `window_closed`.
10. `remove` with `block_rejoin` keeps that identifier out of later windows, until the applier's
    `provision { unblock }` lifts it. `join` on a transport that has no join window (Matter), or
    `commission` on one with no setup codes (Zigbee), is `invalid_request`.
11. A test transport, enabled only in a harness run: devices the harness scripts to join, report,
    check in, fall silent, change controllers and die.
12. `ping` is answered from the main loop within 1 s; the bridge subscribes to its requests before
    it publishes `online`; keepalive at most 6 s, with a will on `status`.
13. The bridge subscribes to its requests with Retain Handling 2, so it never acts on a retained
    request.
14. A PUBACK or SUBACK refusal (`0x87`) is a fault the bridge reports in `status`, never ignored.
15. A removed device's retained topics are cleared with an empty payload.
16. `commission` refuses a device that fails Matter's device attestation, unless the owner passes
    `accept_unattested`.
17. A bridge restarts or reloads by publishing `offline` with `graceful: true` and disconnecting
    cleanly (reason `0x00`, so the broker discards the will) before its new instance connects. A
    takeover without that fires the old will, and the applier rightly counts it a death.
18. A transport is `up` only on a successful exchange within 30 s, never on a connect alone.
Floors that bind others than the bridge:
- **The applier's**, as `GA-*` ids in applier 0.7 with its own negative subjects: it parses the
  retained `devices` document entry by entry, and a message field by field, so one bad entry or
  field drops only itself (a deployed fleet's roster went silent for four days over one unverified device;
  `one-bad-entry-silences`); a `basis_time` more than 5 s ahead of its own clock is a bridge fault
  and the value is of unknown age: the device reads `stale` until a correctly stamped report
  arrives (a bridge's own clock cannot catch its own skew; `trusts-a-fast-clock`); an enumerated value it does not know is taken as the least
  it can mean, never a reason to reject the message (`rejects-unknown-kind`); it never reissues a command inside `result_within_s`, and an
  `accepted` reply extends its wait to the result, still no later than `result_within_s` (a deployed dispatcher re-sent after 1 s and ran
  commands two and three times; `reissues-inside-the-bound`); it never retains a
  request (`retains-request`); sends `snapshot` on a gap or a new instance (`ignores-seq-gap`);
  treats every bridged device `dead` while it has lost the broker (`plans-through-broker-loss`);
  counts a bridge live after reconnecting only on a fresh ping (`trusts-retained-online`); keeps a
  token used after a late `unreachable` (`reuses-token-after-late-unreachable`); never derives
  freshness from a message's arrival (`fresh-by-arrival`).
- **The box's**, as a `Box` level in bridge.md's own index, checked against the broker the box
  runs: it refuses visibly with `0x87`, lets only the applier write requests and only bridge `{b}`
  write under its prefix, and runs nothing else that writes a request, a rule engine included; an ACL change is verified to have taken effect before it is relied on.
  Negative subject: `box-denies-silently`.

The standard carries a **failure matrix**: one row per fault (starting
up, a transport refusing or silent, one device dark, a read with an underivable state, a field of
the wrong type, the bridge losing the network, the broker restarting, a clean shutdown, a crash, a
command for an unknown device, an action it cannot map, a command while the transport is down,
the broker refusing a publish, a removed device), each cell saying what must be on the wire. If a
floor does not produce a cell, one of the two is wrong.

**Open vocabularies.** Every enumerated value a bridge sends (a transport `kind`, a
`class_evidence`, an event `type`, a failure reason) is open: the applier treats an unknown one as
the least it can mean, never rejects the message. In a deployed fleet, a closed list of ack sources rejected the acks
of every new kind of bridge: the command ran and the operator saw a timeout.

Also in the standard: the will, retained status, the short keepalive, the subscribe check, clearing
a removed device. Left out on purpose: a roster in `status` (the applier keeps its own map),
staleness judged by status cadence (the ping replaces it), and a fixed ceiling on a basis age (a
120 s ceiling makes every sleepy sensor unobservable).

## The applier's side (applier 0.7)

- **Adoption.** A device new to an applier, whether a bridge or an adapter's engine adds it, is
  `adopted: false` (devices present when an applier moves to 0.7 are adopted as configured): in `describe`, its state readable, every
  action `refuse(not_adopted)`, placed in GA-PLAN-4's fixed order right after
  `unsupported_action`, and added to GA-APPLY-9's checks at apply as `refused(not_adopted)`; no
  safety rule may read or actuate it. `configure { adopt:
  { device, class, declarations, replaces? } }` adopts it, as a model change like any other
  (`expected_revision`, `dry_run`, whole or nothing, GA-CFG-2); only the owner may (GA-CFG-1). The
  class is the owner's, shown the bridge's proposal and evidence; *Default tiers* follow from it.
- **Valves that say they are switches.** *Default tiers* gains a row: on a `water_valve` or
  `gas_valve`, `onoff.turn_on` is `no_voice`, as `valve.open` is. HS17's valve is inert until Ольга
  says it is a `water_valve`, and then «включи» on it is `refuse(tier)`.
- **Replacement.** `adopt` with `replaces` gives the new hardware the old device's applier `id`,
  declarations and safety rules. The device's `describe` then carries the new `stable_identifier`
  and `previous_identifiers`, oldest first. The id the steward sees does not change at any level:
  GA-META-1 is amended so that a meta-applier builds a child device's `sid:` id from its oldest
  identifier, and routes and GA-META-2's duplicates are keyed on it too. `adopt` itself changes only
  the model, so it stays whole or nothing (GA-CFG-2); from then on the applier keeps the old
  identifier retired: if it rejoins, it is a new unadopted device and never takes the old id back.
  Removing the old hardware from its bridge is the owner's separate `provision { remove, force,
  block_rejoin }`, where `force` drops a device that cannot answer (a dead battery). So the steward's rules, scenarios and leases, which name that id, are
  untouched. The new device must offer every action and state key the old one's declarations and
  rules use, or `configure` refuses. It cannot see what the steward's scenarios and rules use, so
  a scenario step on an action the new device lacks becomes `unsupported_action`, visible in the
  plan. Old and new hardware must sit under the same child; a replacement across two children is
  refused in 0.1.
- **The latch after a replacement.** HS17's latch clears the ordinary way, once every sensor it
  reads is `live` and none reports a leak. A new sensor whose `fresh_basis` is `unknown` reads
  `stale`, so the latch holds until its bound is known: at once where the bridge declares it from
  the model, or after two check-ins (perhaps hours for a battery sensor). That is intended: a
  sensor that has not yet shown it reports is not taken for a dry one. Meanwhile Ольга has the
  notice that the latch is held, and `clear_latch` (GA-CFG-1) as today.
- **Where it happens.** Bridges, `adopt` and `provision` are configured on the applier that owns
  the bridge, as a child's loads are (a meta-applier only routes). `describe` lists each applier's
  `transports`, with their bridge, so the owner's app knows where to open a window; a meta-applier's
  is the union of its children's.
- **Provisioning as its own operation**, at level Act, not a `configure` change set: `provision { join |
  join_close | commission | remove | unblock }`, callable only with the owner's configuration credential, like
  `configure`, and passed to the bridge that owns the transport. It changes no model by itself (no
  `expected_revision`, no `dry_run`); the devices it adds arrive unadopted, and it rolls nothing back.
  What joined is an event, and a notice at `window_closed`. The owner's app that opened the window
  reads `window_closed` itself; the notice also goes to the home's `notice_channels`, which may be
  a shared panel, on purpose: a device nobody claims is news for the household. `provision` on a
  transport whose bridge claims only Serve is `not_claimed`.
- **What the applier no longer excludes.** *What this standard governs* drops "pairing devices",
  and its bullet on how an applier talks to devices points at `standard/bridge.md` as Galatea's;
  *What this standard does not define* drops "Pairing, and anything below an applier's bridges".
  An adapter reports no transports, and `provision` against it is `not_claimed`.
- **Notices beyond safety rules.** A notice gains a `cause` (`safety_rule`, `window_closed`,
  `other_admin`), with `rule_id` only for a safety rule's. These two are Act-level: every applier
  issues them and keeps them in `notices` until taken, as GA-SAFE-8 does at Safe; the steward
  delivers them as any notice (GA-NOTE-1, reworded from "a safety notice" to "a notice").
- **Other controllers.** `describe` carries each device's `other_admins`. A device whose actions
  include any above `reversible` that has another controller is a notice at adoption, and again
  whenever one is added: that is where a second door opens. HS18's lock arrives with the phone's
  fabric, so Ольга is told when she adopts it.
- **Liveness, restated.** GA-STATE-2 is restated: a device is `dead` within 1 s of its bridge
  being found dead (a ping unanswered 10 s, or its will), its transport going `down`, or the
  applier losing its connection to the broker. A device the bridge reports
  `available: false` is `dead` too: the protocol itself has declared it gone (zigbee2mqtt's
  availability, a Matter node the controller marks unavailable), so it is `skip(dead)` in a plan
  and `unreachable` at apply, as GA-APPLY-5 and GA-APPLY-9 already say for `dead`. An adapter's
  unavailable device stays `stale`, as today: an engine's "unavailable" also means "not loaded
  yet" (Home Assistant at boot, HS7). GA-STATE-5
  takes `fresh_s` from the bridge (a Matter device's is its granted interval plus slack); a device whose `fresh_basis` is `unknown` reads `stale` until it
  is known. The applier's `fresh_s` field becomes every device's effective bound, whatever owns it: a
  bridge's, an adapter's from what its engine knows, or the device's own; `configure` may set it
  where none is known (an owner's value for a Home Assistant presence sensor). An adapter MUST give
  one for every `occupancy` sensor it exposes, from its engine or from `configure`, or the sensor
  reads `stale`. The applier's
  citations of the earlier bridge text go.
- **Harness.** The simulated home is simulated bridges speaking this binding.

## The steward's side (steward 0.3)

- Occupancy: an occupancy sensor counts towards `vacant` only if its effective `fresh_s` is known
  and at most `occupancy_hold_s`; otherwise the room is `unknown`, and the steward asks. Found by
  tracing a deployed fleet: a sensor with an hour's bound reads `live` for an hour after it dies. This will
  likely downgrade HS2: a Zigbee presence sensor that reports only on change observes a bound well
  above 300 s, so its room cannot be `vacant` unless its bridge probes it often enough (a mains
  sensor can be probed; a battery one cannot). Where an
  adapter's engine gives no usable bound (Home Assistant marks a mains device unavailable after
  2 h), the applier's rule above applies, and the room stays `unknown` until one is set: failing
  closed, as a motion-only room already does.
- `scenario_status` counts `unanswered` as a final outcome and puts it in `failed_steps` (not a
  success), so a run with an IR step does not hang; and a step with a `late_ack` after any
  `failed` is left out of `failed_steps`, as one after `failed(no_ack)` already is. GA-BRAIN-7
  already says an unknown outcome as a failure.
- `describe` passes `adopted` and `other_admins` through. `define` refuses, with
  `invalid_request`, a change set that names an unadopted device (in a room, a group, a scenario
  or a rule): adoption comes first, and only the owner adopts.

## Conformance

The harness plays the applier against a bridge subject, on a real Mosquitto with dynamic security
(an MQTT 5 client such as paho-mqtt 2 or aiomqtt), driving the test transport. Payloads are
checked against JSON Schemas shipped with the standard; an AsyncAPI description of the topics may
accompany them, but it cannot state the behavioural floors, so the manifest stays the source. Checks are
`wire` except where a physical radio is needed; those are bench checks, listed and not claimed (a
real window's reach, a real check-in interval). Negative subjects, one per floor at least:
`stamps-publication-time`, `echoes-commanded-state`, `double-results`, `window-never-closes`,
`ignores-near`, `hides-other-admins`, `claims-protocol-class`, `forgets-the-blocklist`,
`dies-quietly` (its main loop hangs while its MQTT client keeps the connection alive),
`unreachable-late` (floor 4), `one-fault-stops-all` (5), `observed-too-early` (6: declares a bound
before two check-ins), `acts-on-retained-request` (13), `runs-expired-commands` (4: starts a
command the harness delivered with its expiry already spent), `ignores-refusals` (14),
`leaves-retained-state` (15), `online-before-subscribed` (12), `restamps-partial-read` (1),
`done-before-confirmation` (4), `default-network-key` (9), `accepts-unattested` (16),
`reloads-without-graceful` (17), `up-without-exchange` (18), and floor 5 split three ways:
`exits-on-fault`, `resets-on-connect`, `serves-on-mismatch`.
The negative subjects are graded in both directions (a subject that passes
disarms its floor; one that fails what it should not is a regression), each reference bridge keeps
a coverage file (satisfied, unimplemented, conflicts) read from the manifest, and the constants
that depend on each other (keepalive, ping interval, the 10 s rule) are checked together, not one
by one. The applier's and the box's floors
are graded in the applier's run and a box check, not here.

The applier's new rules get their own subjects: `acts-unadopted` (plans an action on a device not
yet adopted), `replaces-without-rules` (adopts a replacement but leaves the safety rules on the old
hardware), `live-before-known` (treats a device whose freshness bound is unknown as `live`).

## Reference bridges

Two shims, built with the reference applier, in their own plan after the text passes review: **Zigbee over zigbee2mqtt** (MQTT below, this binding
above; optimistic off; results from reports; `permit_join` with `device` for `near`), and **Matter
over matterjs-server** (its WebSocket API below; `commission_on_network` and `commission_with_code`;
fabrics read for `other_admins`). Another system's bridges reach Galatea through the same kind of
shim, or through that system as an adapted applier.

## Scenarios

HS17 moves from ❌ to ✅ if every floor above holds. HS18 moves to ⚠️: commissioning, the class and
the other controller are covered, but a low battery is not (out of scope for 0.1: battery state is
a sensor key like any other, and nothing yet warns on it). HS4 and HS12 are regraded on the new
liveness rules (HS12's last will and `BRIDGE_STALENESS_MS` become the 10 s rule, and `dies-quietly`
replaces "a bridge with no last will"), and HS2 on the occupancy rule, which may turn more rooms
`unknown`. HS10's flow changes: Ольга opens the window and adopts the lamp in the app, as the owner,
before the brain's `define` puts it into «Кино»; a member could not add a lamp.

## Ids and documents

`standard/bridge.md` is rewritten whole (version 0.1 of the Galatea bridge standard, levels Serve, Provision
and Box), with `conformance/bridge-requirements.json` regenerated from its index. Applier 0.7
and steward 0.3 in the same revision. `CONTEXT.md` gains *bridge*, *transport*, *adoption*,
*other admin* (another ecosystem's controller of a device; CONTEXT's avoid-lists keep "controller" for our own components). One `standard-review` for the three.

## Open

Rulings wanted from the maintainer, one at a time:
1. **Adoption for every new device. Ruled (2026-09-24): every device**, as recommended; only an
   owner adds a device.
2. **A notice for another admin, as a MUST**, for devices with actions above `reversible`. Ruled
   (2026-09-24): show it in `describe` and notify the owner, as recommended.
3. **The binding. Ruled (2026-09-24): MQTT**, against the recommendation of MCP: "it is ok to be
   opinionated until we have industrial reason not to. So let's use MQTT in this version of the
   standard until we have proof that it is harming some cases." The binding above is designed
   from research into MQTT 5 for this seam.

4. **Service seams off MCP. Ruled (2026-09-24):** steward→applier and meta-applier→child bind to
   plain HTTPS+JSON described by OpenAPI, one binding, after
   research into MCP as a binding; "we probably should move away from MCP in other
   standards as well". Not in this revision: the move of every service and brain seam to
   HTTPS+JSON gets its own design and revision after this one, since it rewrites every binding
   section and harness driver, and this revision's applier and steward changes do not depend on
   it.
5. **The brain's seams off MCP too. Ruled (2026-09-24):** the steward's brain-facing operations and
   the front (`listen`, `say`) bind to HTTPS+JSON. An LLM host reaches them through a thin MCP
   adapter, or any tool-calling layer, outside the standard. The same later revision carries it
   (the brain's binding section and harness driver; its floors are black-box and do not move). Third-party
   data servers stay whatever they are. Every Galatea seam is then HTTPS+JSON, except bridges
   (MQTT 5).

Guesses to measure: the two check-ins that make `fresh_s` observed.
