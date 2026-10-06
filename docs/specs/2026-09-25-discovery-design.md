---
title: Discovery — design
status: superseded
last_verified:
area: architecture
audience: dev
author: Galatea maintainers
related:
  - standard/bridge.md
  - standard/applier.md
  - docs/architecture.md
  - docs/reference/2026-09-24-home-reference-scenarios.md
---

# Discovery — design

Superseded by bridge 0.3 and applier 0.9, which carry this design as it came out of their review
(`docs/reviews/2026-09-25-bridge-0.3-applier-0.9.md`). The standards' text wins where the two differ.

**Path: architectural.** It adds a component (the finder) and changes interfaces that two
standards depend on: the bridge's documents and requests, and the applier's operations and events.

## What it is for

The gap, as the goals' open items put it: "A device is discoverable by Home Assistant or Alexa,
but not by Galatea." Today Galatea finds a device only on a radio its bridge owns: a Zigbee join, or a Matter
setup code the owner types in. A Home Assistant Voice satellite, a Shelly relay, a Hue hub or a
Tuya plug on the Wi-Fi is invisible until someone configures a bridge for it by hand.

The job: find what is on the network and on the box's own ports, tell the owner what could run it,
and let the owner take it. Nothing found is ever acted on until the owner takes it and then adopts
the device, as today.

## Rulings it stands on

- **The maintainer, 2026-09-25: a finder on the box, candidates through the applier.** A small privileged
  finder process owns the discovery listeners. Bridges declare what they can take as data, in a
  manifest shipped with each bridge, whether or not it is running. A match is a candidate that the
  applier lists beside its unadopted devices, so the owner has one place to look. A candidate a
  running bridge can take goes through the bridge's requests; one that needs a new bridge is set
  up by the owner through the box.
- **Ruling 14: the bridge reports facts, the applier gives the verdict.** The finder reports what
  it heard. The applier keeps the owner's decisions (ignored, taken).
- **Found is not adopted**, as Home Assistant and Alexa show, and
  already the applier's rule for devices (*Adoption*).
- **Opinionated until an industrial reason:** the finder speaks MQTT on the box's broker, as
  bridges do.

## Evidence

From research into how home platforms discover devices on the network:
- Home Assistant, openHAB and Homey all have the shape ruled above: the platform owns the
  listeners, drivers declare matchers as data, a stable identifier absorbs address changes, and
  the owner approves each candidate. SmartThings and Hubitat leave network discovery to each
  driver's code.
- Discovery finds the thing to set up, not the devices behind it. A hub's devices are listed by
  its integration after setup.
- The matcher vocabulary is small: an mDNS service type with name and TXT patterns, SSDP header
  values, a DHCP hostname pattern or MAC prefix, Bluetooth name, UUID or manufacturer id, and a USB
  vendor and product id. Home Assistant needs nothing else.
- DHCP sniffing needs `CAP_NET_RAW`, and mDNS and SSDP the host network.
- Nothing in discovery is authenticated.
- A Tuya plug is found with no cloud, but controlled only with a key an account link supplies.

## Rejected alternatives

- **The finder inside the applier.** It would give the gate the host network and raw sockets. The
  gate should hold as little privilege as it can.
- **Each bridge discovers for itself** (the SmartThings and Hubitat shape). Every bridge would need
  the privilege, listeners would be duplicated, and a bridge that is not running could never be
  suggested.
- **Candidates in the box only, the applier unaware.** The owner would have two places to look.
  Rejected by the ruling.
- **A discovery standard of its own.** Rejected by the ruling: the finder is a client of the box's
  broker, like a bridge, and fits the bridge standard's binding.
- **Vendor listeners in the finder** (Tuya's UDP broadcast, Sonos topology). The finder hears only
  the five generic sources. A Tuya plug is still found, by its DHCP hostname or MAC prefix, as Home
  Assistant finds it. What is behind a hub or an account is listed by its bridge.

## The model

**The finder** is one process on the box. It listens on the sources the box gives it (mDNS, SSDP,
DHCP, Bluetooth, USB) and matches what it hears against the manifests of the bridges the box has
installed. It is the only Galatea component that holds `CAP_NET_RAW`, the host network or the
Bluetooth adapter for discovery.
- It sends nothing but discovery queries: mDNS questions for the service types in the manifests,
  and SSDP M-SEARCH. It never connects to a device, never holds a credential, and publishes only
  on its own topics.
- It reports facts: what it heard, when, and which bridge types could take it. It keeps no owner
  decision.

**A manifest** is a file shipped with a bridge type (`galatea-bridge.json`):
`{ bridgeType, name, version, connect, matchers }`.
- `bridgeType` names the type (`esphome`, `hue`, `zigbee`), not a running instance.
- `connect` is true when a running bridge of this type can take a device the finder found by its
  address (the `connect` request below).
- `matchers` is a list. Each matcher has one `source` and the fields for it:

| `source` | Fields | Example |
|---|---|---|
| `mdns` | `type`; optional `name` and `properties`, each a pattern | `_esphomelib._tcp.local.`; `_matterc._udp.local.` with `properties: { CM: "[123]" }` |
| `ssdp` | header or description values, all to match | `{ st: "urn:schemas-upnp-org:device:ZonePlayer:1" }` |
| `dhcp` | `hostname` pattern, or `macPrefix` | `{ hostname: "shelly*" }`; `{ macPrefix: "D4A651" }` |
| `bluetooth` | `localName`, `serviceUuid`, `manufacturerId` | `{ serviceUuid: "0000fff6-..." }` |
| `usb` | `vid`, `pid`; optional `serialNumber`, `manufacturer`, `description` | a Zigbee coordinator stick |

Patterns are case-insensitive shell globs, as Home Assistant's are. The fields are Home
Assistant's, renamed to camelCase, so a Home Assistant manifest translates line for line.

**A candidate** is one thing the finder heard that at least one manifest matches:
`{ id, sources, keys, address?, firstSeen, lastSeen, hints, matches }`.
- `keys` are stable identity keys, in one namespace: `mac:<hex>`, `usn:<uuid>`,
  `ble:<address>`, `usb:<vid>:<pid>:<serial>`, `mdns:<instance name>`.
- Hearings that share a key are one candidate: a Shelly heard over mDNS and over DHCP is one, with
  both sources and every key it has shown. A new key is added to `keys`. If a hearing links two
  candidates, they merge into the older.
- `id` is set when the candidate is first published and never changes while the finder runs; a
  merge keeps the older `id`. A candidate heard again at a new address keeps its `id`; its
  `address` changes. A restarted finder may give new ids; nothing depends on an id surviving,
  since ignores are kept by key.
- `address` is where it was heard (an IP and port, a USB path), when it has one.
- `hints` are what the announcement said: a name, a vendor, a model, and the raw record. They are
  unverified: anyone on the LAN can announce anything, including a key already known, which moves
  that candidate's `address`. What protects a credential sent with `connect`, and a device a
  bridge follows to a new address, is the protocol's own authentication in the bridge, never the
  candidate.
- `matches` lists `{ bridgeType, connect }` for each manifest that matches, copying its `connect`
  flag, so the applier needs no manifest of its own.
- A `ble:` key is used only for a public or static address. A device that rotates a private address
  has no stable key and may show as a new candidate each time; that is accepted.

**`bridgeType`** is a new optional field of the bridge's `status`: the type its manifest names. It is how the
applier knows which running bridges can take a candidate. A bridge without one takes no candidate.

**`connections`** is a new optional field of a device in the bridge's `devices` document, and of a
transport in its `status`: the identity keys by which the finder can hear that device or transport
(`["mac:D4A651..."]`, `["usb:10C4:EA60:..."]`). A hub, a coordinator stick or a gateway that a bridge
runs as a transport carries its keys there, so its candidate goes once a bridge holds it.
`connections` does not replace `stableIdentifier`, which stays the protocol's own identity; the two
may share a value.

## The flow

1. The finder hears an announcement, matches it against the manifests, and publishes the candidate.
2. The applier lists each candidate that is not ignored and that shares no key with a device's
   `connections`, on a device or a transport. For each match it names the live bridges whose
   `status` gives that `bridgeType`.
3. The owner, in their app, either:
   - **ignores** it, through `configure`: the applier keeps the candidate's keys across restarts
     and hides any candidate that shares one;
   - **takes** it with a running bridge, through `provision { connect: { candidate, bridge,
     credential? } }`, which the applier passes to that bridge as a `connect` request;
   - **sets up a new bridge** through the box (starting a bridge instance, and, for a hub or an
     account, pressing its link button or linking the account). That is the box's own tool, outside
     the standards, as the box's grant tool is.
4. The bridge, once it holds what was found, lists it with its `connections`: a device in `devices`,
   unadopted, or a transport in `status` (a hub, a stick), whose devices arrive unadopted as the
   bridge finds them. The candidate stops being listed. Adoption goes on as today.

A Matter device open for commissioning is a candidate too (`_matterc._udp`, `CM` not 0), matching
the Matter bridge's manifest. Taking it is the existing `commission`, which still needs the setup
code; the candidate only tells the owner it is there.

A bridge MAY read the finder's candidates to follow a device it holds to a new address, by its
`connections` keys, so a bridge needs no listener of its own for that.

## The binding (bridge 0.3)

Under `{root}/finder/`:

| Topic | Written by | QoS | Retained | Payload |
|---|---|---|---|---|
| `status` | the finder | 1 | yes | `{ finderId, instanceId, v, levels, sources, publishedAt }`; `sources` is `[{ source, state: up · down · off, reason? }]`, `off` for a source the box does not give it (no `CAP_NET_RAW`, no adapter) |
| `lwt` | the broker | 1 | yes | the will, `{ finderId, instanceId }` |
| `candidates` | the finder | 1 | yes | `{ publishedAt, candidates: [...] }`, the whole list |

- The finder publishes `status` every 10 s and within 1 s of a source changing state, with the
  same keepalive, will and death rules as a bridge (GA-BRIDGE-17, GA-BRIDGE-18). The applier judges
  its liveness as it judges a bridge's.
- It re-publishes `candidates` within 1 s of a candidate appearing, changing address or being
  dropped. A candidate not heard for 24 h (⚠️ a guess) is dropped; an mDNS goodbye or a USB unplug
  drops it at once.
- The manifests are files on the box. How the box installs them is the box's.
- At Box, only the finder writes `{root}/finder/#`, and only bridges and the applier read it. Below
  Box, a wildcard reader sees every candidate, as it sees everything else.
- The finder claims one level, **Find**, in a `levels` field of its `status`.

A new request, at level Provision, for a bridge whose manifest says `connect: true`:
`connect { requestId, issuedAt, address, keys, credential? }`. The bridge replies `accepted`, and the
work ends in a `connected` event naming the new device or transport, or `connect_failed` with a
`reason` (`unreachable`, `refused`, `unsupported`). A bridge whose manifest does not say `connect`
answers `invalid_request`. `credential` is what the device needs (an ESPHome API
key); like a Matter setup code, it travels on the binding, readable by a wildcard reader below Box.

## The applier's side (applier 0.9)

- **`candidates`**, a new operation, `{ } → { finder: live · dead · none, candidates }`. Each
  candidate carries the finder's fields, in the applier's snake_case (`first_seen`), and `offers: [{ bridge_type, connect, bridges }]`, the live
  bridges whose `status` gives that `bridgeType`. It is at level Act. Only the owner's configuration
  credential may call it, and *Clients and tokens* adds it to that credential's list beside
  `provision`: a candidate reveals what is on the home's network, and no brain needs it.
- **`configure`** gains `ignore_candidate { id }`, which stores the candidate's keys, and
  `unignore_candidate { id }`, which removes them; both persist.
- There is no `candidate` event: `events` is one stream every client reads, and a candidate is the
  configuration credential's only. The owner's app calls `candidates` when it shows them.
- **`provision`** gains `connect: { candidate, bridge, credential? }`. The applier checks that the
  bridge is one of its own and that its latest `status` claims Provision and gives a `bridgeType`
  the candidate's `matches` lists with `connect: true`; then it sends the request. Otherwise it
  returns `not_claimed`, as GA-PROV-1 does for `commission`. A bridge that qualifies but is dead,
  or no reply within 2 s, is `unreachable`, as in GA-PROV-1. A candidate id the applier does not list is `invalid_request`,
  for `connect` and `ignore_candidate` alike. What the bridge takes arrives unadopted, by the
  adoption rules.
- **The `provision` event** gains `connected { bridge, device or transport }` and
  `connect_failed { bridge, reason }`, so GA-EVT-5's history and GA-META-8's relay carry them.
- **Under a meta-applier**, as for `provision` today: candidates and ignores belong to the applier
  that owns the bridges on a box and reads that box's finder. The meta-applier offers only bridges
  it owns itself (`finder: none` if it owns none); `provision.connect` for a child's bridge is
  `not_claimed`, and the owner's app calls the child. A device heard by two boxes on one LAN may be
  listed by one child while the other's bridge holds it; taking it twice is the owner's choice, as
  configuring two engines for one device is today.
- **The finder's topics** are read like a bridge's: its `status` and will give its liveness; a dead
  finder leaves the last list, marked `finder: dead`. A finder `status` without a known `v` makes the
  finder `dead`; with no devices behind it, that is not a `bridge_fault`.

## The floors

Bridge standard, the finder (new ids GA-FIND-1 to 5, at level Find):
- GA-FIND-1: the finder connects, publishes `status` and dies as a bridge does.
- GA-FIND-2: it sends nothing but mDNS queries and SSDP M-SEARCH, connects to no device, holds no
  credential, and publishes only under `{root}/finder/`.
- GA-FIND-3: a candidate is published only for a match of an installed manifest, with its
  `sources`, `keys`, `firstSeen`, `lastSeen` and `matches`; hearings that share a key are one
  candidate, and its `id` never changes.
- GA-FIND-4: `candidates` is re-published within 1 s of a change; a candidate not heard for 24 h is
  dropped.
- GA-FIND-5: `status` lists every source and says `off` for one the finder cannot use.

Bridge standard, bridges (new ids GA-BRIDGE-39 to 41; 39 and 41 at Serve, 40 at Provision):
- GA-BRIDGE-39: a bridge type that ships a manifest ships one valid against its schema, and its
  bridges give that manifest's `bridgeType` in their `status`.
- GA-BRIDGE-40: `connect` on a bridge whose manifest says `connect: true` ends in `connected` or
  `connect_failed`; otherwise the request is `invalid_request`.
- GA-BRIDGE-41: a device's or transport's `connections` carries every identity key the bridge
  knows for it.

Box: GA-BOX-1 gains: only the finder writes `{root}/finder/#`; only the box's bridges and the box's
applier read it.

Applier (new ids GA-DISC-1 to 4, at Act):
- GA-DISC-1: a candidate is never a device: nothing is planned on it, and it reaches the model only
  through a bridge's `devices` and adoption.
- GA-DISC-2: `candidates` lists each candidate that is neither ignored nor sharing a key with a
  device's or transport's `connections`, only to the owner's configuration credential, with the
  live bridges that can take it.
- GA-DISC-3: `ignore_candidate` hides every candidate that shares a key with the ignored one, across
  restarts and changes of address.
- GA-DISC-4: `provision.connect` goes only to a bridge of this applier that claims Provision and
  whose `bridgeType` the candidate matches with `connect: true`; otherwise `not_claimed`, or
  `unreachable` for a dead bridge.

Everything a person chooses stays out of the standards: which sources the box enables, whether to
run a subnet sweep, how the owner's app shows candidates, how the box starts a bridge.

## Conformance

- The harness plays the finder for the applier's run: it publishes `status` and `candidates` and
  checks GA-DISC-1 to 4.
- A finder is checked in its own run: the harness plays announcements on a test network (mDNS,
  SSDP) and a scripted DHCP request, and reads what the finder publishes. Bluetooth and USB are
  checked with the source reported `off`, or on a bench.
- Negative subjects: `plans-on-a-candidate` (GA-DISC-1), `shows-candidates-to-a-client`
  (GA-DISC-2), `forgets-an-ignore` (GA-DISC-3), `connects-to-the-wrong-bridge` (GA-DISC-4),
  `finder-probes-devices` (GA-FIND-2), `new-id-on-new-address` (GA-FIND-3),
  `connect-ignored` (GA-BRIDGE-40: `connect` accepted and never ended).

## Scenarios

A new reference scenario, **HS27 · a satellite and a plug, found**, in the flat:
- Ольга plugs in a Home Assistant Voice satellite (ESPHome) and a Tuya Wi-Fi plug.
- The finder hears `_esphomelib._tcp` and a DHCP request with a Tuya MAC prefix. Two candidates
  appear in her app.
- The satellite: the ESPHome bridge is running, so she takes it with `connect` and its API key;
  it arrives unadopted, and she adopts it as a `channel` in the hall.
- The plug: no Tuya bridge runs. The box offers to start one, which needs her Smart Life account
  linked once. The Tuya bridge then lists the plug with its MAC in `connections`, the candidate
  goes, and she adopts the plug.
- A guest's phone on the Wi-Fi announces a fake `_hue._tcp`. It is a candidate and nothing more:
  no one takes it, and taking it would fail at the Hue link button.

It is graded against bridge 0.3 and applier 0.9.

## Ids and documents

- `standard/bridge.md` 0.3: *The finder* section in the model and in the binding; the Find level;
  the manifest; `bridgeType` in `status` and `connections` on devices and transports, both
  optional so a 0.2 bridge still conforms; `connect` in the `op` list of *Requests and replies*;
  `connected` and `connect_failed` in the binding's `event` row; the Find row in the levels table;
  GA-FIND-1 to 5, GA-BRIDGE-39 to 41; GA-BOX-1's finder clause.
- `standard/applier.md` 0.9: `candidates` (and the configuration credential's list),
  `ignore_candidate`, `provision.connect`, the `connected` and
  `connect_failed` provision events, the meta-applier's rule; GA-DISC-1 to 4.
- `conformance/`: the manifest schema (`galatea-bridge.schema.json`), the new subjects.
- `CONTEXT.md`: *Finder*, *Candidate*, *Manifest*.
- `docs/reference/2026-09-24-home-reference-scenarios.md`: HS27.
- The goals' open items: the discovery item addressed.

The items already carried to applier 0.9 (an idempotency key for `provision`, a transmitter that
answers nothing, GA-META-10 under parallel applies, an open-loop device's state) are not part of
this design.

## Open

- Whether the finder should report Matter nodes on other fabrics (`_matter._tcp`), as a count for
  the owner. Left out: nothing acts on it yet.
- A reference finder: which library for each source. That is implementation work, after the
  standards.
