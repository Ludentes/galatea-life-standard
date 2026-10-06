---
title: Galatea Home architecture
status: draft
last_verified:
area: architecture
audience: dev
author: Galatea maintainers
related:
  - CONTEXT.md
  - standard/brain.md
  - standard/steward.md
  - standard/applier.md
  - standard/bridge.md
  - standard/voice.md
  - conformance/README.md
  - docs/reference/2026-09-24-home-reference-scenarios.md
---

# Galatea Home architecture

Galatea Home is a set of open standards for a home that a language model can control without being
trusted with everything, and reference builds of each part, graded against those standards. Read
this first. It says what the parts are, which standard governs each, how they talk, how a build is
graded, and what is built today. The standards hold the detail, and where this page and a standard
disagree, the standard is right.

Galatea's claim is control, not locality. It works with devices on the home's own network and with
engines in the cloud, and its model may run on the home's box or in the cloud. What it guarantees is
that the model cannot do what the home's owner did not allow: it cannot unlock a door, cannot answer
its own question, and cannot outrun a safety rule. The goals below say what that means and how we
will know it holds.

## Goals

An assistant that controls a real space needs an architecture built for it, not one added to a
system designed without it. Galatea is built for a language model to control a space, and every
part serves one of these goals. "The gate" means both gates on every action, the steward's and the
applier's (see *Two gates, and neither trusts the other*). The scenarios cited are the reference
scenarios.

- **G1 · The model must not be able to cause a dangerous action.** Whatever the model outputs,
  including text an attacker injected into its context, the gate refuses any action the principal
  may not take and asks before any action that needs a person's confirmation. The model cannot
  supply that confirmation itself. Safety holds when the brain or a cloud is down, because safety
  rules live in the applier nearest the device, and every applied action is traceable to the
  principal who asked for it. *Met when* the gate scenarios pass (HS2, HS3, HS4, HS7, the gate part
  of HS9, and HS13 to HS16), and the negative subjects, builds broken on purpose, cannot pass the
  conformance suite.
- **G2 · Changing the model does not mean rebuilding.** A local model, a cloud model, or a cloud
  model that falls back to a local one is a matter of configuration, and none of them weakens G1.
  *Met when* a brain passes the same gate scenarios on at least one commercial and one local
  model; a fixed corpus of recorded requests, replayed through the gate, gives the same outcomes
  whichever model produced the plans; and losing the uplink (HS11) degrades to a local model or an
  announced simple-commands mode, never to silent failure.
- **G3 · Changing the space does not mean rebuilding.** A different mix of engines and devices
  means different bridges, adapters, configuration and house model, not different code. Engines
  that do not conform are reached through adapters and are partly controllable, and the brain knows
  how far. *Met when* the same brain, steward and applier code run a second, differently equipped
  space with only those changed, and every path that changes a device unseen is reported in
  `describe` (`ungoverned`).
- **G4 · Others can build on it without us.** Anyone can write an applier, check it against the
  conformance suite and learn whether it conforms without asking us; an adapter can learn this
  only in part, since what its engine changes unseen cannot be checked on the wire. *Met when* the
  standards, their manifests, the harness and the guide are public; an applier we did not write,
  seeded with a known defect, fails exactly the requirement that defect breaks; and someone who has
  not read the standards builds a working home from the guide.
- **G5 · A space that is not a home is just another space.** Galatea never learns what a museum,
  an office or a shop is. A system built for such a space reaches Galatea through an adapter, keeps
  what is specific to it in namespaced extensions, and its people use Galatea's brain. *Met when* a
  space that is not a home runs under Galatea with no concept of that space in Galatea's code, and
  reaches a device it could not reach before.

Not goals: competing with the large voice assistants at their own game (the persona, the consumer
catalogue, the price of a speaker; their speakers and hubs are engines Galatea drives), and
locality as the selling point (Galatea runs locally when asked, and does not require it).

## The parts

```
   people ── rooms ──▶  voice front ─┐                 owner's tool, panels, apps
                                     │ listen / say        │
                                     ▼                     │
                                   brain                   │
                                     │ MCP                 │ MCP
                                     ▼                     ▼
                                  ┌──────────── steward ────────────┐   authority
                                  └────────────────┬────────────────┘
                                                   │ MCP (exactly one applier)
                                  ┌──────────────── applier ────────┐   the device
                                  │  (or a meta-applier over child  │
                                  │   appliers and adapters)        │
                                  └────────────────┬────────────────┘
                                                   │ MQTT 5
                      ┌────────────────┬───────────┴──────┬──────────────┐
                 Zigbee bridge    PC bridge        wake relay        finder
                      │                │
                   devices        a computer and its plugins
```

**The brain** hears people as text, reads data (a calendar, messages, web pages, the home's own
history), decides what a person meant, and asks the steward to do it. It is a resolver and a
language model together, built however its author likes; the brain standard grades only what it
does. It holds no home state and is never a client of an applier. It is trusted, with guardrails:
its relayed "yes" counts for an action that needs confirmation, but never for one that needs a
person away from any model.

**The voice front** turns sound in the rooms into utterances for the brain and the brain's replies
into speech. Audio in, text out, no house concepts: it knows endpoints, zones, listening modes and
wake words, and nothing about devices, roles or what a command means. It controls no device. A chat
window, or the conformance harness, can stand where it stands; the brain sees only the front's three
operations, `listen`, `say` and `hush`.

**The steward** holds the house on its owner's behalf: rooms, names, groups, persons, endpoints,
credentials, scenarios, rules, schedules, leases and occupancy. It decides who may do what, asks
people to confirm, issues the token that proves a person said yes, runs the home's routines, delivers
notices, and keeps the audit of why. Every client (a brain, the owner's tool, a panel, an app, the
voice front) talks to the steward, and the steward talks to exactly one applier.

**The applier** owns the devices. It plans and applies actions, reports what each device did and
whether it is alive, and runs the safety rules nearest the devices, which keep working when
everything above them is down. It knows no persons, rooms or routines.

**The meta-applier** is an applier whose devices belong to child appliers. It routes each device to
the one child that owns it and holds no house state. A home needs one only when it has more than one
applier; otherwise the steward talks to the applier directly. An **adapter** presents an engine that
does not conform (such as Home Assistant) as an applier, at the levels it can honestly reach, and
lists every way its engine can change a device behind its back.

**Bridges** are the doers below an applier: a process per radio or bus that reports what devices
say and carries out commands. A bridge knows nothing of persons, tiers, plans or tokens. It is
trusted for what devices report and for nothing else. Bridges also provision (open a join window,
commission by setup code, remove a device), and a PC's bridge hosts **plugins**: packages with an
MCP server whose tools become a computer's actions. The **finder** is the one process on a box that
listens for new devices on the network and the box's ports, and tells the applier which bridges
could take them. A device a bridge joins is visible but inert until the owner **adopts** it.

The vocabulary, with what not to call each thing, is in `CONTEXT.md`.

## Two gates, and neither trusts the other

The steward and the applier each guard something, and each checks for itself.

- **The steward's gate guards authority:** may *this principal* do *this* now? It derives the
  person and their role from the endpoint's credential (a client never asserts its own `via` or
  role), checks the action's tier, the leases on the target, the room's occupancy and a computer's
  session, and asks a person when the tier says so.
- **The applier's gate guards the device:** can *this device* take it? It checks liveness, a safety
  rule's latch, a socket's load cap, and that a `confirm` or `no_voice` action carries a valid token.

The link between them is the **confirmation token**. Each action has a tier: `reversible`,
`confirm` or `no_voice`. The applier declares it and the owner may only raise it. For `confirm`
and `no_voice`, only a person's "yes" to the steward's question earns a token. The token is an
HMAC bound to the target, the action, its arguments, `via`, whether a brain served the request, and
whom it is for. It is short-lived and used once, and the applier checks it. So a steward that is
wrong, or a client that lies to it, still cannot open a valve the applier was not shown a person
agreed to. A `no_voice` action (unlocking a door, opening a gate) runs only when both the request
and the answer come from an endpoint no brain serves, such as the owner's own app. A model that asks
and then answers its own question gets nothing (reference scenario HS16).

Safety is not a tier. It is a property of a **safety rule**, which lives in the applier nearest its
devices: a leak closes the valve and **latches** it closed until the leak is gone and a person
confirms, and a heater on a socket is switched off when its cap runs out (HS4, HS14).

## The standards

Each standard is a document under `standard/` with a *Requirement index*, which is its source of
truth, and a *Negative subjects* table, which names the deliberately broken builds that prove its
tests can fail. A standard's **levels** are the named parts of it that a build claims and is graded
on: a bridge claims Serve and may add Provision (joining devices) or Host (plugins), the finder claims
Find, and a deployment's broker claims Box; an applier claims Act and may add Safe (safety rules,
latches, load caps, and witnesses, sensors named to confirm that an action took effect).

| Standard | Version | Governs | Levels |
|---|---|---|---|
| `standard/brain.md` | 0.6 | What a brain owes on top of the steward: data never instructs, it names a speaker only from evidence, it says what really happened, it fails loudly, and the front's operations | Brain |
| `standard/voice.md` | 0.3 | The voice front: device links, listening modes and narrowing, wake words, addressing, merging what two devices heard, marking echoes, speaking, and the skill ingress for another vendor's assistant | Listen, Converse, Zone |
| `standard/steward.md` | 0.10 | The house model, clients and principals, roles, tiers and the confirmation dialogue, leases, occupancy, listening records, plans and apply, history, personal keys, notices, scenarios, rules, schedules and `define` | Steward |
| `standard/applier.md` | 0.15 | Devices, capabilities and actions, default tiers, loads, state and liveness, causes, computers, plugins, tokens, safety rules and latches, adoption, provisioning, discovery, plans, apply and outcomes, events, `configure`, the meta-applier, and the applier's side of bridges | Act, Safe |
| `standard/bridge.md` | 0.6 | The bridge: devices, transports, the roster and freshness, commands and acks, provisioning, computers, plugins, the wake relay, the finder and its manifests, and the MQTT binding with its broker floors | Serve, Provision, Host, Find, Box |

A minor version only adds fields, values, operations and requirements, and every reader ignores
what it does not know. The standards are drafts: they change when a build or a real home shows that
they must, and each revision is reviewed by independent readers before its version moves.

**The device vocabulary.** The applier's capabilities and sensor keys are a closed vocabulary. The
revision that passed review on 2026-10-06 (applier 0.15, bridge 0.6, steward 0.10) names them
after Home Assistant's, cited by version (2026.9.4): its entity domains for capabilities and its
device classes, with their units, for sensor keys, with Galatea's own written meanings where Home
Assistant gives none (whether a `false` may make a room vacant). It renames `contact` to `opening`,
adds `illuminance`, and requires a bridge to map a reading by what it means, never by what a protocol or library calls it. What the
vocabulary does not name travels as a namespaced extension.

## The seams

| Seam | Binding | Server | Client |
|---|---|---|---|
| brain to steward | MCP | steward | brain |
| front to brain | MCP | voice front (or any front) | brain |
| voice front to steward | MCP | steward | voice front |
| owner's tool, panel or app to steward | MCP | steward | the tool |
| steward to applier | MCP | applier | steward |
| meta-applier to child | MCP | child applier or adapter | meta-applier |
| applier to bridges and finder | MQTT 5 | the broker | applier, bridges, finder |

**MCP is pinned to revision 2026-07-28** for every seam but the bridges'. Each operation is one tool,
named as the operation; errors are tool results with `isError` and a code; every request carries a
bearer credential; events come by long-poll, not by MCP notifications. Every server must serve the
pinned revision; it may also answer 2025-06-18 and 2025-11-25, and nothing else. Every connection
uses TLS with the server's certificate validated, unless both ends are on one host's loopback.

**Bridges speak MQTT 5**, on one topic tree per bridge (`{root}/bridges/{b}/...`), so one broker
grant covers one bridge and no bridge can write another's devices. A bridge publishes a retained
status every 10 s, with its roster of devices and their freshness bounds; the broker publishes its
will when it dies; and each command gets exactly one terminal ack (`applied`, `sent`, `failed` with
a reason, or `unsupported`). The applier, not the bridge, decides whether a device is `live`,
`stale` or `dead`. A bridge that does not claim the Box level (where the box's broker grants each
bridge only its own topics, and a refused publish must be visible) may still use MQTT 3.1.1. Its
topic shape, heartbeat and constants agree with a bridge binding already proven on a running fleet,
so bridges written for that fleet can speak this one after a short list of changes; the bridge standard's
*Compatible with a deployed fleet's binding* section lists where the two agree and where they differ, and why.

## How conformance grades a build

Everything under `conformance/` exists to answer one question about an implementation: does it
do what its standard says, and could the tests have noticed if it did not?

- **Manifests.** `conformance/<standard>-requirements.json` is generated from each standard's
  *Requirement index* and *Negative subjects* table, and `<standard>-constants.json` from its
  *Constants*. `conformance/check_manifest.py` regenerates and checks them, and checks the schemas
  against the tables in the text. The text always wins: a change to a standard is followed by
  regenerating its manifest.
- **Schemas.** One JSON Schema per message on every seam (`conformance/schemas`), with generated
  TypeScript types and validators.
- **The harness** (`conformance/harness`) runs a **subject**, any implementation that ships a
  `subject.json` naming its standard, the levels it claims and how to start it. It reports one row
  per requirement id: `pass`, `fail`, `untested`, `not_claimed`, `not_applicable` or
  `needs_judgement`. A row that tests less than the whole requirement says so, so a green row never
  claims more than was run.
- **Stand-ins.** The harness plays each subject's neighbours: a broker, a time server, a test
  transport whose radio it controls, a simulated bridge for an applier, and a scripted applier for a
  steward (`conformance/sim`). A subject takes all its time from the harness's clock, so the harness
  can make an hour pass in a moment.
- **Negative subjects.** Each standard names builds broken on purpose, one requirement each (an
  applier that reissues a non-idempotent command on timeout, a steward that trusts a client's
  claimed `via`). A subject implements them as switches it turns on only under the harness. The
  `negatives` command runs each one and checks that it fails exactly the ids it breaks and nothing
  else. **A build conforms only when both `run` and `negatives` pass.**
- **The matrix.** A reference build's `conformance:matrix` script runs every graded id on the clean
  build and on every mutation, and fails on an id a mutation breaks that its row does not name. Once
  per pull request, it is the conformance pass.

A green run is a floor, not a verdict on quality: the standards are also read and reviewed against
the reference scenarios (`docs/reference/2026-09-24-home-reference-scenarios.md`), the stories of
two households, HS1 to HS34, that the standards are graded against. The harness grades bridges,
appliers and stewards today; brains and voice fronts have manifests but no seam in the harness yet.

## The reference builds

Each build is its own package under [`reference/`](https://github.com/Ludentes/galatea-life/tree/main/reference), in TypeScript on Node 24 with pnpm, except the
voice front, which is Python. Builds meet only over the wire: none imports another, and each
depends only on the schemas, the shared algorithms (`binding`) and the test clock. Builds that keep
state share one Postgres, each in a schema and role of its own ([`reference/install`](https://github.com/Ludentes/galatea-life/tree/main/reference/install)).

| Build | Standard | What is built | What is still to come |
|---|---|---|---|
| [`reference/applier`](https://github.com/Ludentes/galatea-life/tree/main/reference/applier) | applier, Act and Safe | The bus to bridges and its liveness rules, the device model and declarations, adoption, plans, tokens, apply and outcomes, idempotency and late acks; safety rules, latches, load caps and witnesses; part of the restart work | Provisioning and discovery (the finder and candidates); the rest of the restart work; the meta-applier and adapters |
| [`reference/steward`](https://github.com/Ludentes/galatea-life/tree/main/reference/steward) | steward | The house model and `define`, principals and roles, plans and the confirmation dialogue, tokens and apply, leases, occupancy, notices, rules with retries and failure notices, scenarios in mode `single` with a run limit, schedules | History and safety-rule leases; computers, sessions and personal keys; listening records; work through a brain; restarts; ducking and three of the four scenario modes |
| [`reference/zigbee-bridge`](https://github.com/Ludentes/galatea-life/tree/main/reference/zigbee-bridge) | bridge, Serve and Provision | Zigbee on zigbee-herdsman and its converters: devices described and read, actions, join windows, removal and the blocklist, graded against a scripted doer and checked on a real coordinator on the bench | The packaged install, and the first lamp switched end to end in a real home |
| [`reference/pc-bridge`](https://github.com/Ludentes/galatea-life/tree/main/reference/pc-bridge) | bridge, Serve and Host (the harness grades Serve; hosting is checked by the build's own tests) | A computer as a device: sessions, power, notifications, and plugin hosting (install, pinning, servers, probes), on Linux | Windows; the desktop checks on a full graphical session |
| [`reference/wake-relay`](https://github.com/Ludentes/galatea-life/tree/main/reference/wake-relay) | bridge, Serve | A device that wakes a computer over the LAN | |
| [`reference/plugins/mpv`](https://github.com/Ludentes/galatea-life/tree/main/reference/plugins/mpv) | a PC plugin | A media player as a plugin's devices, served over MCP | |
| [`reference/voice-front`](https://github.com/Ludentes/galatea-life/tree/main/reference/voice-front) | voice | Speech recognition, wake words and taps, the steward client, the brain server, speaking through a Wyoming synthesiser, its store | Composing the parts into one running front, device links and satellites; it claims no level yet |
| [`reference/install`](https://github.com/Ludentes/galatea-life/tree/main/reference/install) | | One Postgres with a role and schema per build, provisioning and checked nightly backups, restore and upgrade scripts | The broker, the builds' own services, TLS, credentials and the broker's rules |

Not built yet: the owner's tool (a command line for adoption, `configure`, `define`, answering
`no_voice` questions and reading notices), the demonstration brain (an agent with context files,
skills and the steward's MCP configuration), the meta-applier and adapters, a Matter bridge, the
finder, and CI. The first release is a self-sufficient home: one broker, one applier, our own
bridges, no vendor cloud and no Home Assistant in the chain.

## Using a part on its own

The parts are meant to be taken one at a time, through releases rather than by cloning:

- **Packages** from the npm registry, named `@ludentes/galatea-life-<part>`: `schemas` (every
  message's JSON Schema, types and validators), `binding` (the algorithms two builds must compute
  alike, today the token's proof: HMAC-SHA256 over the RFC 8785 form, with test vectors),
  `test-clock` (the client a subject uses to take its time from the harness) and `harness` (to grade
  your own implementation).
- **Container images** for the steward, the applier and the bridges, configured by environment and a
  Postgres connection.
- **A Python package** for the voice front.

Because the seams are the standards, each part works beside parts written by someone else: a
steward over any conforming applier (the harness grades the reference steward over a scripted
stand-in), an applier under any steward, a bridge under any applier, and any implementation graded
by the same harness.

**The packages are released; the rest is not yet.** The standard's five packages (`schemas`,
`binding`, `test-clock`, `sim`, `harness`) are on the npm registry at 0.1.0 since 2026-10-06, as
`@ludentes/galatea-life-<part>`, and the standard's repository `Ludentes/galatea-life-standard` is
public. No container image is built yet: the services are
packaged once the steward's remaining parts are built, after a small refactor that keeps each
build's core free of process environment, files, MCP and the database driver, so that it can be
wired by a host other than its own `main.ts`.

## Where things live

Two public repositories are filled from one workshop:
- **`galatea-life-standard`**: `standard/`, `conformance/` (manifests, schemas, the binding, the test
  clock, the harness, the stand-ins and examples) and the reference scenarios. Everything an
  implementer needs, versioned by the standards' versions.
- **`galatea-life`**: the reference builds, the install and the architecture documents. It
  takes the standard's packages from the registry like any outside implementer.

The licence is Apache-2.0 for the standards, the conformance material and the builds alike.
