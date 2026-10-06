---
title: Checking the bridge standard by hand
status: draft
last_verified:
area: architecture
audience: dev, pm
author: Galatea maintainers
related:
  - standard/bridge.md
  - standard/applier.md
  - standard/steward.md
  - standard/brain.md
  - docs/reference/2026-09-24-home-reference-scenarios.md
  - docs/reviews/2026-09-24-bridge-0.1-applier-0.7-steward-0.3.md
  - docs/reviews/2026-09-25-bridge-0.2-applier-0.8.md
  - docs/reviews/2026-09-25-pc-standards.md
  - docs/specs/2026-09-25-pc-design.md
---

# Checking the bridge standard by hand

The automated checks prove only that the manifests match the text. This guide is for a person
who wants to see for themselves that bridge 0.4, applier 0.10, steward 0.5 and brain 0.4 hang
together. It covers the stories they are meant to carry, some edge cases, a PC bridge's among them,
and two round trips.
Nothing here needs code or hardware. It needs a terminal in the repository and about an hour.

When a check fails, write down the check's name and what you saw. Add it to the review record as
a new finding.

## Before you start

Run these from the repository root. Each should print what the comment says.

```sh
python3 conformance/check_manifest.py            # prints nothing
python3 -m unittest discover conformance         # ends with OK
grep -nE '^#+ [0-9]' standard/*.md               # prints nothing
grep -n '^version:' standard/*.md                # applier 0.9, brain 0.4, bridge 0.3, steward 0.5
```

## The two stories the bridge standard exists for

### HS17: a dead leak sensor, replaced

Open `docs/reference/2026-09-24-home-reference-scenarios.md` and find `## HS17`. For each row of
its *Decomposed* table, find the requirement id it cites and read that row in the standard's
*Requirement index*. Confirm each of these in the text:

1. **Only the owner opens the network.** Search `standard/applier.md` for `GA-PROV-1`. The row
   says `provision` belongs to the owner's configuration credential only.
2. **The window closes by itself.** Search `standard/bridge.md` for `GA-BRIDGE-25`. It should say
   the window lasts at most the lesser of `windowMs` and the transport's cap (254 s for Zigbee).
3. **A new device can do nothing yet.** Search `standard/applier.md` for `GA-ADOPT-1`. Every
   action on an unadopted device is `refuse(not_adopted)`.
4. **The valve is a valve.** Search for `opens_with`. The action that opens a `water_valve` is
   `no_voice`, whichever of `turn_on` and `turn_off` that is.
5. **The replacement inherits the rules.** Search for `GA-ADOPT-2`. `adopt` with `replaces` keeps
   the old device's `id` and safety rules. The old identifier is retired.
6. **The neighbours' bulb stays out.** Search for `GA-BRIDGE-27`. `block_rejoin` keeps it out of
   later windows. If it still holds the network key and rejoins, it is removed again with a
   `blocked_rejoin` event.

### HS18: a Matter lock shared with the phone

Find `## HS18` in the scenarios and check that:

1. **The lock is a lock from the first second.** Search `standard/applier.md` for `lock.unlock`
   in *Default tiers*. The row gives `no_voice` on any device.
2. **The owner is told about the phone.** Search for `GA-ADOPT-3`. A device with another admin is
   a notice with cause `other_admin`.
3. **The PIN never goes over MQTT.** Search `standard/bridge.md` for `GA-BRIDGE-36`.
4. **A lock that stops answering can be heard of.** Search `standard/steward.md` for `GA-RULE-2`.
   Then read the sentence after it: a rule about a device going silent triggers on its `liveness`
   event.

## Edge cases

Each case below is a question. Find the answer in the text and compare it with the expected one.

| Question | Where to look | Expected answer |
|---|---|---|
| A new leak sensor sends ten messages in its first minute. Is its freshness bound a few seconds? | `standard/bridge.md`, *Freshness and devices*, `GA-BRIDGE-13` | No. The bridge never guesses a bound from what it saw. It declares one from the protocol or the model, or publishes null, and the sensor reads `stale`. |
| The bridge cannot know a sensor's rhythm. Can the owner fix it? | `GA-STATE-6` in `standard/applier.md` | Yes. The owner's `fresh_s` is the effective bound, over a declared one or none. |
| A leak sensor checks in once an hour. Is it ever observable, given the 120 s ceiling some bridges apply? | `standard/bridge.md`, *The roster and freshness* | Yes. There is no universal ceiling; its bound is more than an hour. |
| A bridge's main loop hangs, but its MQTT connection stays up. When is it dead? | *Liveness*, `GA-BRIDGE-17`, `GA-STATE-2` | 30 s after its last `status`, which only the main loop publishes. No will fires. |
| A bridge written for an older deployment still speaks MQTT 3.1.1. Can it serve the applier? | *The MQTT binding* | Yes, at Serve and Provision. It cannot see a refused publish, so a box that claims Box needs MQTT 5. |
| A command waits in the broker longer than its bound, for a 3.1.1 bridge. Does it run late? | *The MQTT binding*, *The command's time* | No. The applier sets Message Expiry, and the broker drops the command whichever version the bridge speaks. |
| A leak comes in while the valve's bridge is reloading. Does the valve stay open? | `GA-SAFE-12` | No. The close is sent again once the valve is back, on the bridge's next `status`. |
| A leak report arrives stamped an hour in the future. Can it switch the leak rule off? | `GA-SAFE-11`, `GA-BUS-2` | No. A fast-clock value never becomes the last report seen. |
| A router rejoins after a power cut. Is it a new device? | `standard/bridge.md`, *Provisioning*, "secured rejoin" | No. It sends no `joined`. |
| A legacy Zigbee sensor rejoins through the trust centre under the well-known key. Is it the same device? | the same paragraph, and the `route_conflict` notice in `standard/applier.md` | No. It arrives unadopted. A notice says that adopting it with `replaces` restores its rules. This is the looser move in round 7 that no reader re-read. Read it critically. |
| A second bridge reports a device with the adopted valve's identifier. Does it take over the valve? | `GA-BUS-11` | No. It is a separate unadopted device, and a `route_conflict` event names both bridges. |
| Nobody can read one Zigbee remote's binding table. Can a leak rule close a valve without the owner's say? | `GA-BRIDGE-14`, `GA-SAFE-6` | No. The valve's `other_admins` stays `unknown`, and the rule needs `accepts_other_admins`. |
| The broker is a default install, with no access rules. Can the applier claim Safe? | `GA-DESC-6`, *The broker is the floor under the gate* | Not over bridges. Safe needs `box: true`, which the owner sets for a box that passes GA-BOX-1. |

### A PC's bridge

The same kind of questions, for the computers in HS19–HS24. Find `## HS19` to `## HS24` in the
scenarios for the homes they live in.

| Question | Where to look | Expected answer |
|---|---|---|
| Ольга puts the family laptop to sleep from her app. Its bridge goes away at once. Is the sleep a failure? | `standard/bridge.md`, *Computers*, "Going offline"; `GA-BRIDGE-22`, `GA-APPLY-7` | No. The bridge publishes the sleep's terminal ack, `applied`, before its graceful `offline`, so the step ends `delivered`. The laptop then reads `dead`, which is not a state change. |
| Лиза's lock rule fires just as she closes the laptop's lid. What does the lock end as? | the same paragraph; `GA-APPLY-5`, `GA-APPLY-8` in `standard/applier.md`; `GA-RULE-2`, `GA-RULE-5` in `standard/steward.md` | Never `acked`. The OS announces the suspend, so the bridge acks the lock in flight first: `failed(unreachable)` if it had not reached the OS, and the step is `unreachable`; `failed(no_confirmation)` if it had, which is no final outcome, and the step ends `failed(no_ack)` as soon as the laptop is found dead. Her rule's condition is false while the laptop is `dead`, and becomes true again when it wakes, so the rule fires then. |
| The laptop's battery dies, with no suspend announced. Is that a fault? | `standard/bridge.md`, the edge-case table's "suspends unannounced" row | No. The will fires once the broker's keepalive lapses, the laptop reads `dead`, and the applier does not count the will a `bridge_fault`. A step still waiting ends `failed(no_ack)` at once. |
| Inside her window, Лиза ends the session helper from the Task Manager and unlocks her session. Does her lock rule lose track of her? | `standard/bridge.md`, *Computers*, "Who sees what"; `GA-BRIDGE-52`; `GA-RULE-4`, `GA-RULE-5` in `standard/steward.md` | No. The system service still reads `locked`, `disconnected` and `none` without the helper, and her unlocked session reads `unknown`, never `available: false`. `not_in` counts `unknown` as not locked, so the rule's condition becomes true, it fires, and the system service locks her session again without the helper. |
| Артём, the administrator of his own PC, copies a newer version's files over an installed plugin by hand. Does the new code run? | `standard/bridge.md`, *Plugins* and *Hosting*; `GA-BRIDGE-70`, `GA-BRIDGE-43`, `GA-BRIDGE-44`, `GA-BRIDGE-45`; `GA-BUS-12` in `standard/applier.md` | No. At the server's next start its files are checked against the hashes kept at install, and its live tools against the manifest's (at once, if the tools change while it runs). On a mismatch the server is stopped, every device of the plugin is `available: false` and a `faults` entry names them, which the applier makes a notice for the owner. Only a reinstall clears it. Only an administrator could write the files at all; that is why a PC's administrators are its other admins (`GA-BRIDGE-53`). |
| Дмитрий asks for a cartoon, and the mini-PC takes 70 s to wake. Does the cartoon play? | `GA-APPLY-13` and `ack_within_s` in `standard/applier.md`; `GA-BRAIN-17` and *Constants* in `standard/brain.md` | Yes. The wake is `acked` once the mini-PC is live again and the player it hosts is live, or reporting `available: false`, within `power.wake`'s default `ack_within_s` of 90 s. The utterance lifetime (60 s) has passed, but the brain may make one further write for that utterance, on the woken computer or a device it hosts, within 60 s of the wake's `acked` outcome: the `media.launch`. That write earns no further exception. Past 90 s the wake is `failed(no_ack)`, and the brain says the PC did not wake. |

## Round trips

**Replace and return.**
1. Follow HS17 to the end: the old sensor is replaced, removed with `force` and blocked.
2. Suppose someone later puts a fresh battery in the old sensor.
3. Trace what happens. In the text, the old hardware still holds the network key and rejoins
   secured.
4. Expected: GA-BRIDGE-27 removes it again, the event is `blocked_rejoin`, and no device is added.
   The replacement keeps its id and its rules the whole time.

**Adopt, lapse, recover.**
1. Adopt a Zigbee valve whose `other_admins` is `[]`.
2. A new device joins, so one binding table is now unread.
3. Expected from GA-BRIDGE-14: `other_admins` becomes `unknown`. The applier's *Other admins*
   paragraph says this lapse is an event, not a notice. The leak rule keeps running.
4. Once the bridge has read the new table and found nothing, `[]` returns and nothing is said.

## What this guide does not prove

- Whether real zigbee2mqtt or Matter controllers behave as the text assumes. The constants marked
  ⚠️ are guesses until they are measured with the reference bridges.
- Anything the conformance harness will check. The harness does not exist yet.
- The items the review carried forward. They are listed in the review record's *Verdict*.
