---
title: Change record for bridge 0.4, applier 0.10, steward 0.5 and brain 0.4 (the PC standards)
status: draft
last_verified:
area: architecture
audience: dev
author: Galatea maintainers
related:
  - docs/specs/2026-09-25-pc-design.md
  - standard/bridge.md
  - standard/applier.md
  - standard/steward.md
  - standard/brain.md
  - docs/reviews/2026-09-25-bridge-0.2-applier-0.8.md
---

# Change record for bridge 0.4, applier 0.10, steward 0.5 and brain 0.4

This record follows the `standard-review` procedure. It is written before the standards' text
changes, from the approved design (`docs/specs/2026-09-25-pc-design.md`, revision 5, *Standards to
change*), so that the review to come starts from the same list of intended changes. The review
itself, once the four standards are written, appends its passes and rounds below.

## Change record

Directions: **stricter**, **looser**, **new**, **carried**, and **clarified** for a review fix that closes a reading without moving the bar. Rows added or amended by a review round name the round and the finding. Every row cites the scenario or
scenarios it serves (HS19–HS25) and the requirement ids it touches or adds; an id the design does
not number yet is marked "new" rather than guessed.

### Bridge 0.4

| Change | Ids | Direction | Scenarios |
|---|---|---|---|
| A new level, Host, independent of Provision: a PC bridge claims Host and not Provision, a Zigbee bridge the reverse; a bridge that lacks the level an operation needs answers `not_claimed` | GA-PROV-1 (amended), new | new | HS22 |
| Hosting floors on a bridge claiming Host: the install directory writable only by the bridge's own service; only the bridge verifies and starts a plugin's server; every file and tool hash re-checked at start and on every `tools/list` change; a mismatch stops the server, reports the plugin's devices `available: false`, and raises a `faults` entry | new | new | HS22 |
| No unapproved tools (the bridge MUST NOT call a tool the manifest does not map to an action); no authority to the plugin (no elicitation or sampling relayed; a tool that asks for input ends `failed(no_confirmation)`; no broker credential, confirmation token or user credential passed to it) | new | new | HS22 |
| Least privilege: a plugin's server MUST run as the account the owner chose, never elevated (never SYSTEM or root; Windows' filtered token; Linux's `no_new_privs`); its devices are `available: false` while the chosen account has no session | new | new | HS22 |
| The computer's own check-in: the bridge MUST observe its host at least every 10 s, and that observation counts as the computer's check-in; the bridge's own host joins GA-BRIDGE-13's closed list of bound sources, bound 30 s | GA-BRIDGE-37 (amended), GA-BRIDGE-13 (amended) | new | HS19, HS23 |
| A plugin device's check-in is a successful state read or change notification, at the manifest's cadence; its `basisMaxAgeMs` is 3 × that cadence, so a quiet player stays live and a wake can ack | GA-BRIDGE-13 (amended) | new | HS19 |
| Account tokens: the bridge derives a stable token per OS account, fixed at first sight and kept across restarts and renames: the OS name when it matches `[a-z0-9_-]{1,32}` and no other account holds it, otherwise the `u` form | new | new | HS20 |
| `devices` gains `host`, `personal`, `selfChanging`, `internal`, `stagedFor`, and, for a plugin's extension capabilities, their schemas, descriptions and confirming keys (which may name an argument) | GA-BRIDGE-38 (amended) | new | HS19, HS20, HS22, HS23 |
| Install and uninstall: `provision { install }` and `provision { uninstall }` answer `accepted` within the bound, then an `installed` or `install_failed` event (an `uninstalled` event after an uninstall); re-sent with the same `request_id` are answered as duplicates | new | new | HS22 |
| A bridge MUST publish `sleep`'s or `shutdown`'s terminal ack before its graceful `offline` and before clearing `lwt`; it MUST also go offline gracefully on any suspend or shutdown the OS announces (a closed lid). An unannounced suspend's will is expected, and taken as any will (round 1, L4: a will is never a `bridge_fault`, so nothing is suppressed; a safety-read device gets GA-SAFE-10's notice at once) | GA-BRIDGE-22 (amended) | stricter | HS23 |
| No remote shell among a bridge's own actions: no action executes its arguments as a command, script or code, or hands them to an OS handler that may | new | stricter | HS22, HS25 |
| A PC bridge MUST report `otherAdmins` on the computer and on each plugin device (one entry per administrator account, and per a plugin app's own network control), never `ungoverned` | new | stricter — a new reporting duty; the loosening this replaces is GA-BRIDGE-32's scoping, in its own row below, which keeps the applier's Safe claim (GA-DESC-6) intact and still binds a safety rule through `accepts_other_admins` (GA-SAFE-6) | HS22, HS23 |
| GA-BRIDGE-32 scoped on a computer: the OS's own automations (a sleep when idle, a restart for updates) and a person at the PC cancelling a scheduled action are the device's own behaviour, not an `ungoverned` path | GA-BRIDGE-32 (amended) | **looser** — ground: the same Safe claim; a local actor at the PC is like a hand on a wall switch, not a path around the applier | HS23 |
| `notify`'s `from` carried in the bridge's command value, shown on a computer in every logged-in session that is not locked | new | new | HS20 |
| The wake relay: a bridge at Serve, one per LAN segment; transport is the LAN interface, `up` while it has a link and the gateway answers ARP; `power.wake` declares `confirms: false`, so its `sent` ack is not a fault | new | new | HS19 |
| **From against an older bridge** (left open by round 5). The applier sends `notify`'s `from` only to a device whose `devices` declaration lists `from` among `notify`'s arguments; to any other it is omitted, so a 0.2 bridge never refuses a notify and GA-NOTE-1 never retries | GA-BRIDGE-4 (unchanged, read against) | new | HS20 |
| Round 1, H2: an `install` of a version already installed is a reinstall, a repair: the same manifest or `install_failed(version_conflict)`; ids and activation kept, files and hashes replaced, a GA-BRIDGE-45 fault cleared once it verifies. Corrected by round 3, OM5: as first written it bound only the manifest, so new code under the same manifest kept adoption and any lowered tier, looser than the design's "a reinstall of the adopted package" and with no ground; it now binds the package's `sha256` too, so "new" holds | GA-BRIDGE-57 (new), GA-BRIDGE-45 (amended) | new | HS22 |
| Round 1, H2: a plugin device's id after an `uninstall` and a new install is the one it had before, since it is derived by ruling (`<plugin id>:<version>:<key>`); the applier forgot the devices on `uninstalled`, so it still sees an admission | GA-BRIDGE-35 (amended) | **looser** — ground: the id's derivation is ruled (GA-BRIDGE-69), and the admission the rule protects is kept at the applier (GA-PROV-4) | HS22 |
| Round 1, F1: live tools are compared with the manifest as installed, never one read again from disk; the installed manifest and file hashes survive a restart | GA-BRIDGE-44, GA-BRIDGE-31 (amended) | stricter | HS22 |
| Round 1, M3, S2: pinning's limits stated: a server that never announces `list_changed` is compared only at its start; the interpreter and libraries are not pinned; pinning is not a sandbox; a plugin's `confirms` and `confirmedBy` are the publisher's word, so its `acked` rests on its own report | GA-BRIDGE-44 (prose) | clarified | HS22 |
| Round 1, M9: where the OS offers a way to hold a suspend, the bridge holds it until the `sleep`'s `applied` ack is published (⚠️ a bench check) | GA-BRIDGE-22 (amended) | stricter | HS20, HS23 |
| Round 1, F10: whether a Modern Standby laptop announces its sleep is ⚠️ a bench check | — (prose) | clarified | HS20 |
| Round 1, M10: a Windows account's fallback token number is assigned by the bridge and kept, never the SID's last part; tokens are keyed by the whole SID or the uid | GA-BRIDGE-52 (amended) | stricter | HS20 |
| Round 1, S6: the idle threshold is the bridge's own setting, not the owner's through the applier | — (prose, constants) | clarified | HS21 |
| Round 1, M11: an `install` ends within 600 s (⚠️ a guess) of its `accepted`, else `install_failed(timeout)` | GA-BRIDGE-68 (amended) | stricter | HS22 |
| Round 1, M12: GA-BRIDGE-56 is graded by a person from the test transport's record of what a session was asked to show | GA-BRIDGE-56 | clarified | HS20 |
| Round 1, M13: an administrator's account may run a plugin, and least privilege is best effort (Windows' filtered token is not a security boundary; `no_new_privs` does not stop polkit or D-Bus) | GA-BRIDGE-49 | **looser** — ground: the design's own text (a game launcher must run as its player); what the floor cannot hold is carried by the PC's administrators being other admins (GA-BRIDGE-53) | HS22 |
| Round 1, L2: the manifest's `needsSession` (boolean, default `false`) says whether the server runs in the chosen account's session | GA-BRIDGE-42, GA-BRIDGE-49 (amended) | new | HS19, HS22 |
| Round 1, L3: negative subjects for the clauses 0.4 adds to GA-BRIDGE-13, 22 and 37; GA-BRIDGE-48 is graded `wire`, from the test plugin's report | GA-BRIDGE-13, 22, 37, 48 | clarified | HS19, HS22, HS23 |
| Round 1, L6: a tools or files mismatch puts one `faults` entry per device of the plugin | GA-BRIDGE-45 (amended) | clarified | HS22 |
| Round 1, S1: the manifest's optional `otherAdmins` lists the app's own network control, copied to every device of the plugin; absent means none; the publisher's word | GA-BRIDGE-53 (amended) | stricter | HS22 |
| Round 1, S5: a PC's administrators are re-read at least every 24 h (⚠️ a guess), beside the OS's change reports | GA-BRIDGE-53 (amended) | stricter | HS22, HS23 |
| Round 1, M4: the owner's app shows a plugin device's manifest-declared `selfChanging` and `personal` keys at adoption, beside its tiers | — (prose) | clarified | HS22 |
| Round 1, L5: the precedent for a PC bridge's plugins being devices of their own is described in the standard's own words, not by a product's name | — (prose) | clarified | HS22 |
| Round 1, L3 follow-up: GA-BRIDGE-49 is graded `wire`, from the test plugin's report of its own privileges, as GA-BRIDGE-48 is | GA-BRIDGE-49 | clarified | HS22 |
| Round 2, H3: `conformance/check_manifest.py` kept only the last-listed negative subject of an id; fixed to record every subject an id has, as a list, in the order listed (`negative_subjects` replaces `negative_subject`/`coupled` in all four manifests and their readers), with a unit test that fails on an id with two subjects. Regenerating the manifests restored the subjects the amended ids GA-APPLY-8, GA-DESC-10, GA-SAFE-10, GA-SAFE-12 (applier), GA-BRAIN-1, GA-BRAIN-16 (brain), GA-BRIDGE-6, 13, 22, 37, 68, 53, GA-BOX-1, GA-BOX-2 (bridge) and GA-CONF-2 (steward) had already lost | — (tooling) | clarified | HS19, HS20, HS22, HS23 |
| Round 2, H1, M4: after activation a plugin device is `available: false` only while its server cannot serve it (a mismatch, `needsSession` with no session, a server that exited or answered neither a state read nor `ping` within 10 s ⚠️), never while it is starting or because the bridge stopped it going offline; a server that exits or hangs is restarted, verified, with backoff (⚠️ as GA-BRIDGE-11's), except after a mismatch | GA-BRIDGE-58 (new) | new | HS19, HS22 |
| Round 2, M1: a staged activation swaps the whole version: every old device leaves, and each new device keeps its `stagedFor` after the activation | GA-BRIDGE-69 (amended) | stricter | HS22 |
| Round 2, M3: a lost `uninstalled` is recovered from the snapshot's `devices` (*Gaps*) | — (prose; GA-PROV-4 carries it) | clarified | HS22 |
| Round 2, M5: an `uninstall`'s effects (server stopped, files removed, every device of every version removed) are part of GA-BRIDGE-68, with a subject of their own | GA-BRIDGE-68 (amended) | stricter | HS22 |
| Round 2, M6: GA-BRIDGE-70, 48 and 49 are graded on a real OS with real accounts, not the test transport's scripted OS | GA-BRIDGE-70, GA-BRIDGE-48, GA-BRIDGE-49 | clarified | HS22 |
| Round 2, M8: a manifest's `cadenceMs` is capped at 300 000 ms (⚠️ a guess), so a publisher cannot stretch a plugin device's bound; above it the install is `install_failed(invalid_manifest)` | GA-BRIDGE-68 (amended) | stricter | HS19, HS22 |
| Round 2, L2, SM1, SM2: an `install` whose `account` the computer's `accounts` does not list is `install_failed(unknown_account)`; a reinstall's `account` must be the installed one's, else `install_failed(version_conflict)` | GA-BRIDGE-68, GA-BRIDGE-57 (amended) | stricter | HS22 |
| Round 2, L3: an extension key's schema must be a scalar, else `invalid_manifest`; the example key is namespaced (`org.example.steam.running`) | GA-BRIDGE-68 (amended) | stricter | HS22 |
| Round 2, L6, SH1: `accounts` has one shape, `{ <token>: <label> }`, the steward's person mapping being its own field; an administrator's token comes from the same table as *Sessions*' tokens, and one that is no interactive account is shown by its token alone | — (prose) | clarified | HS20, HS22 |
| Round 2, L7: on resuming, a PC's bridge has the OS step its clock before its first `status`, waiting at most 10 s (⚠️ a guess), so a skewed `lastCheckIn` does not fail a wake | GA-BRIDGE-59 (new) | new | HS19 |
| Round 2, SM3: a `needsSession` account has a session while its `session.<token>` is present and not `none`; a started server keeps running while its session is locked or disconnected | GA-BRIDGE-49 (amended) | clarified | HS19, HS22 |
| Round 2, SL1: a person at the PC who shuts it down or puts it to sleep is the computer's own behaviour too | GA-BRIDGE-32 (prose) | clarified | HS23 |
| Round 2, W2: a plugin device's action carries `toolHash` in `devices`, so the applier can keep it | GA-BRIDGE-38 (amended) | new | HS22 |
| Round 2, W3: HS22 says the hand-copied files do not run *after the next start*, which is when GA-BRIDGE-43 verifies them; a running server may load them before | — (scenarios) | clarified | HS22 |
| Round 3, OH1, WM1: the bridge reads each activated plugin device's state within 10 s (⚠️ a guess) of its server's initialisation after a start, and of its own first `status` after resuming, whatever the `cadenceMs`, so a wake need not wait out a long cadence; a command to a device whose server is still starting is acked `failed(unreachable)` within 1 s | GA-BRIDGE-60 (new) | new | HS19 |
| Round 3, OH2: GA-BRIDGE-58's 10 s answer clause applies only once a server has served its first state read; a server that has not served within 120 s (⚠️ a guess) of its start makes its devices `available: false` and is restarted; `unavailable-while-starting` now starts within that bound, so it fails one clause only | GA-BRIDGE-58 (amended) | stricter | HS19, HS22 |
| Round 3, OM8: the bridge pings each server that has served at least every 10 s (⚠️ a guess) when no state read has passed, so a hung server is found whatever its cadence; subject `misses-a-hung-server` | GA-BRIDGE-58 (amended) | stricter | HS19, HS22 |
| Round 3, OH3: `notify`'s `{ rule }` and `{ scenario }` may carry `brain_authored: true`, as the steward's GA-NOTE-2 sends, so a brain-written rule's `notify` is not refused as an unknown key | — (prose, *Computers*; GA-BRIDGE-4, GA-BRIDGE-56) | clarified | HS20 |
| Round 3, OM3: the account a plugin runs as is listed in its devices' `otherAdmins`, unless listed already as an administrator: it can edit the unpinned libraries and signal the server | GA-BRIDGE-53 (amended) | stricter | HS22 |
| Round 3, OM4: the system service binds each session helper to its session by the OS identity of its connection (session id and uid); a helper's report for another session is ignored and is a `faults` entry | GA-BRIDGE-61 (new) | new | HS20, HS21, HS23 |
| Round 3, OM5: a reinstall whose package `sha256` differs from the one the version was installed from is `install_failed(version_conflict)`, as a different manifest is; the bridge keeps each installed version's `sha256` | GA-BRIDGE-57 (amended) | stricter | HS22 |
| Round 3, OM6, OL2: a computer's `notify` must list `from` (a computer is new at 0.4, so no older bridge is spared), and a `notify` to a computer is shown in every logged-in session that is not locked, graded from the notification hook's record | GA-BRIDGE-62 (new) | stricter | HS20 |
| Round 3, OL2: a computer's `cancel` with nothing scheduled is acked `applied`, now with an id and a subject | GA-BRIDGE-63 (new) | clarified | HS23 |
| Round 3, OL3, SL1: negative subjects for GA-BRIDGE-42's start in the account's session, GA-BRIDGE-52's `u` form and collision rules, GA-BRIDGE-53's demoted administrator (within the 24 h bound) and GA-BRIDGE-55's `feedback: open` and `internal` | GA-BRIDGE-42, 52, 53, 55 | clarified | HS19, HS20, HS22 |
| Round 3, OM2: *Gaps* says a lost `uninstalled` is recovered only from a well-formed `devices` that still lists the host | — (prose; GA-PROV-4 carries it) | clarified | HS22 |
| Round 3, OM7: the account-token row above said "never the OS name itself"; the design and GA-BRIDGE-52 take the OS name when it matches `[a-z0-9_-]{1,32}`, so a token may name a person (`session.liza`). The row now says what the text does; the text is unchanged, as the design decides it | GA-BRIDGE-52 (row only) | clarified | HS20 |
| Round 3, WL2: HS19's wake hop no longer says the Kodi server starts: nothing restarts on a resume, the server answers again once the PC wakes, and the bridge reads the player within 10 s of its first `status` (GA-BRIDGE-60) | — (scenarios) | clarified | HS19 |
| Round 4, OH1: a plugin device's state is defined: the manifest's `stateUri` names its MCP resource; its content is one JSON object of the device's declared keys, each a scalar, an undeclared key or a mistyped value left out (GA-BRIDGE-1); a change notification is `notifications/resources/updated` for that URI on a subscription the bridge makes where the server offers one, followed by a read; the cadence read is the floor, and whether servers honour subscriptions stays with the design's spike | GA-BRIDGE-37 (prose, *State*) | clarified | HS19 |
| Round 4, OH2, OM2: a staged swap happens only once the new server has served; while it fails its check or has not served, the old version stays, server and devices; the swap ends the old version's activation and removes it, with no `uninstalled`, so a restart never starts its server again | GA-BRIDGE-69 (amended; subjects `restarts-the-old-version`, `swaps-to-a-broken-version`) | stricter | HS22 |
| Round 4, OH4: a PC's bridge keeps its broker credential readable only by its service and the OS's administrators, and creates and owns its helpers' endpoint so no other process can bind or stand in for it; graded on a real OS. The brief's "connectable only by the service" is read as "bound only by the service", since helpers must connect | GA-BRIDGE-64 (new; subjects `credential-readable`, `helper-endpoint-open`) | new | HS20, HS23 |
| Round 4, OM3: a deleted account's token is retired, its key and `accounts` entry removed, and never given again, so a later account with the same uid or SID gets a new token; an account deleted and remade under the same uid while the bridge was down is the same account to it (named limit) | GA-BRIDGE-52 (amended; subject `reuses-a-deleted-token`) | stricter | HS20 |
| Round 4, OM4: `app`, `camera_in_use` and `microphone_in_use` are taken only from the helper of the session the OS reports active at the console | GA-BRIDGE-61 (amended; subject `trusts-a-background-helper`) | stricter | HS20, HS23 |
| Round 4, OM6: an `id`, `key` or `version` holding `+`, `#`, `/` or `:` ends the install `install_failed(invalid_manifest)`; the `id` is included beyond the brief, since the `stableIdentifier` and the topic carry it too. Plugin devices carry `plugin` and `version`, so no one parses an id | GA-BRIDGE-68 (amended; subject `accepts-a-colon-key`), GA-BRIDGE-38 (amended) | stricter | HS22 |
| Round 4, OM7: a plugin device's `feedback` (`closed`), `reachMs` (0), `model` (`{ vendor: <plugin id>, model: <key> }`) and `classEvidence` (`none`) are fixed | GA-BRIDGE-38 (amended) | clarified | HS19, HS22 |
| Round 4, OM9: GA-BRIDGE-70, 48, 49 and 64 are `pass` only on the real-OS run, so Host, and fronting a computer, are claimed only with it | — (*Conformance*) | stricter | HS22 |
| Round 4, OM10: a plugin server's restart backoff has a maximum, 300 s (⚠️ a guess) | GA-BRIDGE-58 (amended; subject `retries-once-an-hour`) | stricter | HS19, HS22 |
| Round 4, F6: GA-BRIDGE-58's times are kept on a clock that stops in suspend, or started again at resume | GA-BRIDGE-58 (amended; subject `hangs-every-server-on-resume`) | stricter | HS19 |
| Round 4, OM11: a PC's bridge that reaches its broker over loopback declares `proposedInfrastructure: true` on its computer; the owner still sets `infrastructure` | GA-BRIDGE-65 (new; subject `hides-the-broker-host`) | new | HS23 |
| Round 4, OM12: a person at the PC is anyone in a login session on it (local, SSH or Remote Desktop); an administrator is defined per OS (Windows' local Administrators; on Linux root, sudo's all-command accounts and groups, polkit's administrator identities) | GA-BRIDGE-32 (amended), GA-BRIDGE-53 (amended; subject `misses-a-polkit-admin`) | **looser** (corrected in round 5, OM1; first recorded as clarified) — ground: a remote login needs the account's credentials, and the owner governs the PC's accounts; a remote-login service is not an administrator of the PC's devices, so a person logged in over it acts as one at the keyboard would | HS20, HS23 |
| Round 4, OL1: the bridge's *Sessions* says the applier takes `none`, a logout, as `session.lock`'s answer too | — (prose; GA-EVT-3 carries it) | clarified | HS20 |
| Round 4, OL2: only `shutdown` takes `delay_s`, rounded up to the whole minute where the OS counts minutes; `sleep` takes no argument, as the design's table has it | — (prose, *Computers*) | clarified | HS23 |
| Round 4, OL3: an `install` for another `host` is `invalid_request`, and an `uninstall` of a plugin not installed `failed(unknown_plugin)`, within 1 s, nothing done | GA-BRIDGE-68 (amended; subjects `installs-for-another-host`, `uninstalls-a-stranger`) | clarified | HS22 |
| Round 4, OL7: a group granted administrator rights has a token of its own form, `g` and a number, which no account's token can take; an account named `g[0-9]+` gets the `u` form | GA-BRIDGE-52, GA-BRIDGE-53 (amended; subject `gives-a-group-a-user-token`) | stricter | HS22 |
| Round 4, SH1: an `install` or `uninstall` accepted and not ended at a restart is kept, and ends after the start in exactly one terminal event (`installed`, or `install_failed(restart)` with nothing installed; `uninstalled`) | GA-BRIDGE-31, GA-BRIDGE-68 (amended; subject `forgets-an-install-on-restart`) | stricter | HS22 |
| Round 4, SM1: *Commands* lists a plugin device whose server is still starting as a cause of `failed(unreachable)` | — (prose; GA-BRIDGE-60 carries it) | clarified | HS19 |
| Round 4, F1: a failed state read after a start or a resume is tried again at least every 10 s (⚠️ a guess) until one succeeds | GA-BRIDGE-60 (amended; subject `gives-up-after-a-failed-read`) | stricter | HS19 |
| Round 4, part A's concern (MCP 2026-07-28): that revision removed `initialize`, `ping` and `resources/subscribe`, so GA-BRIDGE-58 and GA-BRIDGE-60 no longer name them alone. A server **has started** at its first successful answer to the bridge (`initialize` before 2026-07-28, `server/discover` from it); the liveness **probe** is `ping` before 2026-07-28 and `server/discover` from it. Constants unchanged | GA-BRIDGE-58, GA-BRIDGE-60 (amended; prose, *Constants*, failure matrix, subject `hangs-every-server-on-resume` reworded) | clarified | HS19, HS22 |
| Round 4, OM4, narrowing: a person working only over Remote Desktop reports no `app`, `camera_in_use` or `microphone_in_use`, since only the console session's helper sets them | GA-BRIDGE-61 (as amended by OM4) | **looser** for that case — ground: a background session's helper could otherwise forge the computer-wide keys, and a forged `camera_in_use` or `app` misleads more than an absent one | HS20, HS23 |
| Round 5, OH2: the system service takes only `active` or `idle` from a session helper, and only for a session the OS itself reports neither locked nor disconnected; `locked`, `disconnected` and `none` come from the OS alone, so a forged helper that claims its own session `locked` cannot escape a rule on that key. Said plainly: on Linux the OS's word is logind's `LockedHint`, which the session's own screen locker sets | GA-BRIDGE-52 (amended; subject `helper-claims-locked`) | stricter | HS20 |
| Round 5, OM6: a token is retired only on a deletion the OS reports; an account merely absent from a listing (a directory account while the OS's cache of the directory has lapsed) keeps its token and its key, so it does not come back under a token no mapping names | GA-BRIDGE-52 (amended; subject `retires-a-lapsed-account`) | stricter | HS20 |
| Round 5, OM5: a computer's `notify` is shown in every logged-in session that is not locked and has a running helper; shown in none, it is acked `failed(not_shown)`, never `applied` | GA-BRIDGE-62 (amended; subject `acks-an-unshown-notify`) | stricter; **looser** for a session with no helper — ground: the system service cannot draw in a user's session, so the old text asked for what no bridge can do, and the new ack says so instead | HS20 |
| Round 5, OL4: GA-BRIDGE-65 is keyed on the bridge running on its broker's own host, reaching it over loopback or through one of its host's own addresses, not on loopback alone | GA-BRIDGE-65 (amended; subject `hides-the-broker-host-by-address`) | stricter | HS23 |
| Round 5, OM4: the box's tool also refuses, or warns on, a read grant on a device whose `personal` is not empty, since that grant reads what a person is doing (GA-AUTH-7 withholds it from a guest) | GA-BOX-2 (amended; subject `grants-personal-keys-unwarned`) | stricter | HS23 |
| Round 5, SL1: "the owner's app should say so at adoption" leaves *Hosting*'s normative reading: *What this standard does not define* names what the owner's app says at adoption, and says plainly that nothing checks a plugin's honesty | — (prose, *Hosting*, *What this standard does not define*) | clarified | HS22 |
| Round 5, F2, bridge half: GA-BRIDGE-51's floor and row carry the tool's text in `detail` on `failed(no_confirmation)`, as *Plugins* already said | GA-BRIDGE-51 (amended; subject `drops-the-tool-text`) | clarified | HS19 |
| Round 5, F3: after a successful tool call the bridge reads the plugin device's state within 1 s (⚠️ a guess) of the tool's result; GA-BRIDGE-34's late read-back stays the floor, made whatever the early read found | GA-BRIDGE-51 (amended; subject `reads-back-late-only`), *Constants* | stricter | HS19 |
| Round 5, OM1: round 4's OM12 row (SSH and Remote Desktop are "a person at the PC") is recorded **looser**, with its ground: a login needs the account's credentials, the owner governs the accounts, and a remote-login service is not an admin of the PC's devices | — (record) | clarified | HS20, HS23 |
| Round 5, OH2, its limit (a known gap): on Linux the OS's lock report, logind's `LockedHint`, is set by the session's own screen locker, so a process in the session can still fake a lock; HS20 holds against a killed or forged helper, not against a faked OS lock report. HS20's guardrails say the same | GA-BRIDGE-52 (prose, *Sessions*) | clarified (a stated limit) | HS20 |
| Round 6, OH3: an account's several sessions (console, SSH, Remote Desktop) make one `session.<token>`, the most in-use state winning, in the order `active`, `idle`, `unknown`, `locked`, `disconnected`, `none`; `session.lock` locks or disconnects every session of the account; a `needsSession` server starts in the account's console session, else the one the OS started first. An SSH login's part is settled by the OH3 follow-up row below | GA-BRIDGE-52 (amended; subject `reports-one-session`), GA-BRIDGE-42 (amended), GA-BRIDGE-66 (new; subject `locks-one-session`) | stricter | HS20, HS23 |
| Round 6, OL7, bridge half: `session.lock` is declared `confirms: true`, confirmed by `session.<token>`; it is acked `applied` only once the OS reports every session of the account locked, disconnected or ended, and `failed(not_locked)` when one is not so reported within 5 s (⚠️ a guess), so that on Linux a lock no screen locker honours ends at once and GA-RULE-7 does not retry it | GA-BRIDGE-66 (new; subject `acks-an-unhonoured-lock`), *Constants*, failure matrix | stricter | HS20 |
| Round 6, OM3: a computer's `notify` is not shown in, and not counted for, a disconnected session; shown only there, it is `failed(not_shown)` | GA-BRIDGE-62 (amended; subject `notifies-a-disconnected-session`) | stricter | HS20 |
| Round 6, SL1: a computer's `notify` acked `applied` was handed to the OS's notification service, not seen: Focus Assist or Do Not Disturb may hold it. Named as a limit | — (prose, *Computers*; *What this standard does not define*) | clarified (a stated limit) | HS20 |
| Round 6, OM4: Backup Operators on Windows and the `docker` group on Linux count as administrators; where the bridge cannot enumerate the administrator set (a polkit rule it cannot reduce to users and groups, a partial sudo grant) it adds `{ vendor: "os", label: "unknown" }`; `unknown` is never an account's token | GA-BRIDGE-53 (amended; subjects `misses-the-docker-group`, `trusts-an-incomplete-admin-list`), GA-BRIDGE-52 (amended; subject `takes-the-unknown-name`) | stricter | HS22, HS23 |
| Round 6, OM1, bridge half: the bridge's *Computers* says the applier takes `proposedInfrastructure` as the flag until the owner sets it | — (prose) | clarified | HS23 |
| Round 6, OM6: the PC's requirements bind a bridge only where it has what they are about (GA-BRIDGE-52, 53, 59, 61 to 66 where it reports a computer; 55 where it fronts relay entries; 56 where it lists `from`; the Host ids where it claims Host); the harness reports the rest not applicable, as it already does GA-BRIDGE-20's PUBACK half on MQTT 3.1.1. GA-BRIDGE-54 binds every bridge | — (*Conformance*) | clarified — a Zigbee bridge was never meant to answer for a computer; no requirement a PC's bridge answers for is loosened | HS22, HS23 |
| Round 6, OM7: `command` is an array; its first element may be an interpreter the OS provides, by name (`python3`, `node`), found in the OS's own directories and never in one the plugin's account can write; every other file it names is inside the package | GA-BRIDGE-68 (amended) | clarified; stricter for where the interpreter is found | HS22 |
| Round 6, OM8: *Who else may read* warns on a device with a non-empty `personal`, as GA-BOX-2's floor does, and the box's tool re-checks every grant whenever a device's `personal` changes | GA-BOX-2 (amended; subject `keeps-a-grant-on-a-new-personal-key`) | stricter | HS23 |
| Round 6, OL3: GA-BRIDGE-70 and GA-BRIDGE-64 are `wire`, as GA-BRIDGE-48 and GA-BRIDGE-49 are: all four are graded in the live run on a real OS | GA-BRIDGE-70, GA-BRIDGE-64 (Verify) | clarified | HS22 |
| Round 6, OL6, bridge half: `app`, `camera_in_use` and `microphone_in_use` are `personal` on every device that reports them, a plugin device included, whatever its manifest declares | — (prose, *Computers*, *Devices*; GA-BRIDGE-38 carries it) | stricter | HS19, HS23 |
| Round 6, SM1, SL3: when the OS deletes the account a plugin runs as, the bridge stops the server and does not restart it, reports the plugin's devices `available: false` with one `faults` entry per device, until the plugin is uninstalled; a reinstall of that version is `version_conflict`, whatever account it names, so the owner uninstalls and installs for another account | GA-BRIDGE-67 (new; subjects `serves-a-deleted-account`, `reinstalls-for-a-deleted-account`), GA-BRIDGE-58 (amended) | new | HS22 |
| Round 6, OH3 follow-up (ruling of round 6): a session with no display (an SSH login, or any the OS reports non-graphical) cannot be locked and has no helper; it is read from the OS alone, `active`, or `idle` where the OS reports idleness, never `unknown` for lack of a helper, and counts for in-use through the combined key. `session.lock` locks every graphical session and is acked `applied` once each reads `locked` or `disconnected`, or none remains; a non-graphical session does not block the ack | GA-BRIDGE-52 (amended; subject `ssh-reads-unknown`), GA-BRIDGE-66 (amended; subject `waits-on-an-ssh-login`), failure matrix | clarified | HS20, HS23 |
| Round 6, controller follow-up: a non-graphical session joins the account's key only while the account has no graphical session, so a lock of the graphical sessions reads `locked` with an SSH login open and the applier's read-back (GA-EVT-3) agrees with the bridge's ack; a person working only over SSH still reads `active`; subject `ssh-hides-a-lock` | GA-BRIDGE-52 (amended) | **looser** — ground: otherwise every lock with an SSH login open ends `failed(no_ack)` at the applier and GA-RULE-7 retries it all night; the cost is that an SSH login beside a locked console no longer holds up a sleep | HS20, HS21 |
| Round 6, OH3 and OL7 in HS20: the lock hop locks every graphical session of Лиза's account, an SSH login not holding up the ack; a lock no session takes ends `failed(not_locked)` within 5 s, which GA-RULE-7 does not retry | — (scenarios) | clarified | HS20 |
| Round 6, WL3: HS20's 21:25 hop reads `locked` on wake (Windows asks for sign-in by default), then `active` on sign-in, when the rule fires; a Modern Standby laptop may stay `live` asleep at 21:00 (bridge *Going offline*, ⚠️ a bench check) and the rule then fires at 21:00 | — (scenarios) | clarified | HS20 |
| Round 7, SB1, RM1: GA-BRIDGE-66's "none remains" means the account has no session at all, its key then `none`; an account whose only sessions are non-graphical (SSH) has nothing to lock and a key reading `active` or `idle`, so its lock is acked `failed(not_locked)` at once, never `applied`, and GA-RULE-7 does not retry it all night | GA-BRIDGE-66 (amended; subject `acks-an-ssh-only-lock`), failure matrix | stricter | HS20 |
| Round 7, SH1: `session.lock` is declared `idempotent: true`, as the applier's `session` column already gave it, so GA-RULE-7's retry of it after `failed(no_ack)` is defined | GA-BRIDGE-66 (amended; subject `declares-a-lock-not-idempotent`) | clarified | HS20 |
| Round 7, SH2, RM4: GA-BRIDGE-53's enumeration of administrators, its `unknown` entry included, and GA-BRIDGE-61's binding of a helper are graded on a real OS with the other privilege checks (a helper of the non-administrator's own that reports another session; a one-command sudo grant; an administrators-group change), Verify `wire`; a bridge graded only through the test transport cannot front a computer | GA-BRIDGE-53, GA-BRIDGE-61 (amended; *Conformance*) | stricter | HS20, HS22 |
| Round 7, RH1: a plugin device's `stableIdentifier` is `<computer stableIdentifier>/<plugin id>/<key>`, unique per host, so that two PCs hosting the same plugin are not one device under GA-BUS-11 or one `sid:` device under GA-META-2. Changes the design's `<plugin id>/<key>` (*Plugin devices*), which Task 2 kept; the design notes the change | GA-BRIDGE-69 (amended; subject `shares-a-plugin-identifier`) | stricter | HS19, HS22 |
| Round 7, RL2: a plugin server whose starts fail 5 times in a row (⚠️ a guess) puts one `faults` entry per device of the plugin in `status`, reaching the owner as a notice (GA-BUS-12), cleared once a restarted server has served; the bridge keeps trying | GA-BRIDGE-58 (amended; subject `crash-loops-silently`), *Constants*, failure matrix | stricter | HS19, HS22 |
| Round 7, RL6: a `command`'s interpreter is found in a directory the plugin's account cannot write without elevation; on Windows, which ships neither `python3` nor `node`, one the owner installed system-wide under Program Files counts, one in a user's profile does not | GA-BRIDGE-68 (amended; subject `runs-a-writable-interpreter`) | clarified; stricter for an administrator's account | HS22 |
| Round 7, SL1: the OS's report of a graphical session is named: logind's session `Type` (`x11`, `wayland`, `mir`) on Linux; every WTS session but session 0 on Windows | GA-BRIDGE-52 (amended) | clarified | HS20 |
| Round 7, RM3, deferred (not yet designed): `install` names an interactive account, one `accounts` lists, whose files and sessions the plugin can reach; letting it name a dedicated non-interactive account needs a design choice (who creates it, how it appears). Recorded as a gap in *Install and uninstall* and *What this standard does not define* | — (prose) | clarified (a stated gap) | HS22 |
| Round 8, H1, bridge half: an `activate` naming the version whose server runs, while another version's activation waits for its swap, cancels that pending activation; the bridge stops the new server if it runs and never swaps to it later, its own next start included, the new version staying installed and staged | GA-BRIDGE-69 (amended; subject `swaps-after-a-cancel`), failure matrix | stricter | HS22 |
| Round 8, H2, bridge half: the administrators of a computer that carries the broker reach every bridge's commands, not only this bridge's devices; the bridge lists them on the computer as on any PC, and the applier counts them for every device (GA-SAFE-6) | — (prose, *Computers*) | clarified | HS23 |
| Round 8, M1: a session has one helper, the one the service started in it, known by the process id the OS reports for the connection; a second connection from that session, or one from a plugin server's process, is refused and is a `faults` entry on the computer; a `needsSession` plugin's account is listed on the computer's `otherAdmins` as well as its devices' | GA-BRIDGE-61 (amended; subject `trusts-a-second-helper`), GA-BRIDGE-53 (amended; subject `hides-a-session-plugin-account`), failure matrix | stricter | HS20, HS23 |
| Round 8, M2, bridge half: a lock a slow screen locker takes after `failed(not_locked)` is the OS finishing the request, not the bridge carrying out the command later; the bridge sends nothing more, so GA-BRIDGE-7 holds, and the applier gives the report to the apply | — (prose, *Sessions*) | clarified | HS20 |
| Round 8, M3 and WL4, bridge half: `session.lock`'s `args` declare `account` as the tokens `accounts` lists, a retired token leaving them; a lock naming any other token is acked `failed(invalid_request)` within 1 s, nothing done | GA-BRIDGE-66 (amended; subject `locks-an-unlisted-account`), failure matrix | stricter | HS20 |
| Round 8, M4: the bridge publishes a plugin device `available: true` within 1 s (⚠️ a guess) of its server having served, after the activation and after every restart, so the applier can tell a status from before the activation from one after it | GA-BRIDGE-58 (amended; subject `stays-unavailable-after-serving`), *Constants* | stricter | HS19, HS22 |
| Round 8, SM1: on Windows an account holding `SeDebugPrivilege`, `SeTakeOwnershipPrivilege`, `SeRestorePrivilege` or `SeBackupPrivilege` through local policy, and on a domain-joined machine a member of Server Operators or Account Operators, is an administrator; a local policy the bridge cannot read adds the `unknown` entry | GA-BRIDGE-53 (amended; subject `misses-a-debug-privilege`) | stricter | HS22, HS23 |
| Round 8, L1: a bridge "reports a `computer`", for what applies, where one of its devices offers the `session` capability or a `power` action other than `wake`, whatever its `proposedClass`, or where it claims Host; never by `proposedClass` alone | — (*Conformance*) | stricter — a PC bridge proposing class null no longer escapes the PC's requirements | HS20, HS22, HS23 |
| Round 8, L4: subjects for GA-BRIDGE-22's graceful `offline` on a suspend the OS announces, GA-BRIDGE-45's clearing only on a verified reinstall or a new version, and GA-BRIDGE-58's no `available: false` while the bridge stops a server on its way offline | GA-BRIDGE-22, GA-BRIDGE-45, GA-BRIDGE-58 (subjects `dies-on-an-announced-suspend`, `clears-a-tamper-by-itself`, `unavailable-on-the-way-down`) | clarified | HS19, HS20, HS22 |
| Round 8, L5: `subscriptions/listen` is named as MCP 2026-07-28's, not "MCP's current revision" | — (prose, *State*) | clarified | HS19 |
| Round 8, SL2: `needsSession`'s "started first" is read from the session's time (Windows' `LogonTime` from `WTSQuerySessionInformation`'s `WTSSessionInfo`; logind's session `Timestamp`), a tie going to the lower session id. The brief named Windows' `CreateTime`, which `WTSINFO` does not carry; `LogonTime` is its field | GA-BRIDGE-42 (amended; subject `starts-in-the-later-session`) | clarified | HS19, HS22 |
| Round 9, H1 and L6, bridge half: the applier counts a broker host's administrators as other admins of every device unless the owner marks that computer as the applier's own host; a broker in a virtual machine or a container on the PC, reached through an address of its own, is not seen by `proposedInfrastructure`, and the owner sets `infrastructure` for it | — (prose, *Computers*) | clarified | HS19, HS23 |
| Round 9, SH2: the bridge resolves a `command`'s interpreter to an absolute path at `install`, in the plugin account's search order, checks the file, every directory on its path and every directory earlier in that order against the account's write access, records the path with the manifest as installed, and starts the server by it, never by name | GA-BRIDGE-68 (amended; subject `hijacks-the-interpreter-by-path`) | stricter | HS22 |
| Round 9, SH1 (as MEDIUM): a directory account is deleted only on the directory's own word: a Windows domain account is keyed by a SID the domain never gives again; on Linux, a directory account the directory itself reports as not existing (an authoritative answer, not a cache miss or an unreachable directory) retires its token, so a later account under its uid gets a new one; while the bridge cannot tell, the token stays | GA-BRIDGE-52 (amended; subject `keeps-a-deleted-directory-token`) | stricter | HS20, HS21 |
| Round 9, M3: a bridge that lists `from` shows a `notify` without `from` as from an unknown sender, never unmarked. Judged, as GA-BRIDGE-56 is, so no negative subject (*Negative subjects*: a subject built to fail a person's grade tests the grader); the grader's question gains the absent case | GA-BRIDGE-56 (amended) | stricter | HS23 |
| Round 9, M4: `needsSession` needs a graphical session (logind `Type` `x11`, `wayland` or `mir`; a WTS session other than session 0); an SSH login alone is none, so a server that draws on a screen is not started there and its devices stay `available: false` | GA-BRIDGE-42, GA-BRIDGE-49 (amended; subject `starts-for-an-ssh-login`), failure matrix | stricter | HS19, HS22 |
| Round 9, M5: a plugin's `id`, `key` and `version` hold only `[A-Za-z0-9._-]`, an `id` and a `key` at most 40 characters each, a `version` at most 32; anything else is `invalid_manifest`. The brief's 64 for `id` and `key` would not fit: with a computer's machine identifier (36 characters at most) the `stableIdentifier` is at most 118 and a meta-applier's `sid:` id at most 122, within the applier's 128; the device id is at most 114 | GA-BRIDGE-68 (amended; subject `accepts-a-long-id`) | stricter | HS22 |
| Round 9, L2: a `session.lock`'s `not_locked` for an account with no graphical session joins the failures acked within 1 s of receipt | GA-BRIDGE-66 (amended; subject `acks-an-ssh-only-lock` bounded) | stricter | HS20 |
| Round 9, L3: the `faults` codes the text relies on are named: `pin_mismatch` (GA-BRIDGE-45), `crash_loop` (GA-BRIDGE-58), `account_deleted` (GA-BRIDGE-67), `helper_refused` (GA-BRIDGE-61), beside the finder's `overflow` | GA-BRIDGE-45, GA-BRIDGE-58, GA-BRIDGE-61, GA-BRIDGE-67 (amended; subjects `crash-loops-silently` and `serves-a-deleted-account` name the code) | stricter | HS19, HS22 |
| Round 9, L7: GA-BRIDGE-38's floor says `stagedFor` from its staging on, kept after its version's activation, as the *Devices* table and GA-BRIDGE-69 say | — (prose, *Freshness and devices*) | clarified | HS22 |
| Round 9, SM1: `needsSession`'s tie compares session ids as numbers where both read as integers, else in the byte order of the id strings | GA-BRIDGE-42 (amended; subject `breaks-a-tie-by-text`) | clarified | HS22 |
| Round 9, SM2: a sudo grant of every command narrowed by a negation, an alias or a digest the bridge does not evaluate (`ALL, !/bin/su`) is the `unknown` entry | GA-BRIDGE-53 (amended; subject `trusts-a-narrowed-sudo-grant`) | stricter | HS22, HS23 |
| Round 9, SL1: `accounts` labels are the account's current OS name | — (prose, *Sessions*) | clarified | HS20 |
| Round 9, SL2: `failed(not_locked)` is the lock's terminal ack; GA-BRIDGE-34's read-back does not follow it | — (prose, *Sessions*) | clarified | HS20 |
| Round 9, WL1: *What this standard does not define* carries the transmitter that answers nothing, deferred with the applier's open-loop item, awaiting a ruling, so the deferral has a home in the standard that owns it | — (*What this standard does not define*) | clarified (a stated gap) | HS12, HS15 |
| Ruling 2026-09-27, assumed readings: a value derived from what was sent, not from the device, is assumed; a bridge publishes none, so GA-BRIDGE-5 stands, and a `feedback: open` device's assumed state is the applier's, marked `assumed: true` | — (prose, *A device's status*) | clarified | HS12 |
| Ruling 2026-09-27, toggles: an action the device carries out by a code that flips its state (an IR power code) is declared `toggles: true` and `idempotent: false`, one carried out by a code that sets it is not; a bridge may offer `onoff.toggle` on such a device, for a person who asks for the button (removed in round 10); which codes toggle is a bench check per model | GA-BRIDGE-71 (new; subject `declares-a-toggle-discrete`), *Devices*, *Conformance* hooks | new | HS15 |
| Ruling 2026-09-27, a silent transmitter: a transport that can answer nothing on its host link is `unknown`, never `up`, and `down` only while its host reports a write failed; any other transport is `up` or `down`; its devices are `feedback: open` and usable, a command acked `sent` once written. Closes round 9's WL1 gap and the 0.8 review's deferred item; the item leaves *What this standard does not define* | GA-BRIDGE-72 (new; subjects `mute-transmitter-up`, `answering-blaster-unknown`), *Transports*, roster `observable`, failure matrix | **looser** — ground: the maintainer's ruling. It removes, for the devices on such a transport, the floor that liveness rests on an exchange: they are `live` on `unknown` (applier GA-STATE-4), and a cut wire or a dead emitter never shows. The devices were unusable (`dead`); now they are usable on a write alone, and `sent` promises no more than that. GA-BRIDGE-23 still keeps `up` for an exchange (restated in round 10, O-M3) | HS12, HS15, HS1 |
| Round 10, B1, F1, O-M1, bridge half: by the controller's ruling, `onoff.toggle` leaves the vocabulary, so a bridge offers no button; `toggles: true` stays a property of an existing action's code. The button sat below every tier floor, latch and lease | GA-BRIDGE-71 (amended) | stricter | HS13, HS14, HS15, HS17 |
| Round 10, O-H1, F2: an `unknown` transport that went `down` on a failed write returns to `unknown` when its host link (the port or device node the bridge writes to) opens again, which the bridge retries on GA-BRIDGE-11's backoff without transmitting; "while" had read as a moment or as a lasting state | GA-BRIDGE-72 (amended; subject `stays-down-after-reopen`), failure matrix | clarified, with a new duty to retry the link | HS12, HS15 |
| Round 10, O-M3, SL2: the *a silent transmitter* row's direction restated: it removes, for devices on such a transport, the floor that liveness rests on an exchange, which the 0.8 record called the case the floor exists to refuse; the owner is told at adoption (applier GA-ADOPT-6); *What this standard does not define* names the bare LED whose wire is cut, which fails no write and never goes `down` | GA-BRIDGE-72 (row restated), *What this standard does not define* | **looser**, restated — ground: the maintainer's ruling of 2026-09-27 | HS12, HS15 |
| Round 10, O-M4, bridge half: the open-enum table gains a transport `state` it does not know, taken as `down`, so an applier older than 0.10 makes a 0.4 bridge's `unknown` transport's devices `dead`; an applier older than 0.10 ignores `toggles`, and a bridge cannot see its applier's version, so that is a stated limit, not a guard | *Compatibility*, GA-BRIDGE-71 (prose), *What this standard does not define* | clarified (a stated limit) | HS15 |
| Round 10, O-M5: an action carried out by a code learned from a remote is declared `toggles: true` unless the owner declared that code discrete when teaching it, since the bridge cannot classify it; the harness hooks gain a learned code | GA-BRIDGE-71 (amended; subject `trusts-a-learned-code`), *Conformance* hooks | stricter | HS15 |
| Round 10, O-L2: negative subjects for GA-BRIDGE-72's `down` clause (`downs-an-idle-transmitter`) and its `feedback: open` clause (`closes-a-mute-device`) | GA-BRIDGE-72 (subjects) | clarified | HS12 |
| Round 10, SH1: on Linux, any account sudo or polkit lets run any command as root is an administrator, one command being enough, since a single command often escapes to a shell and the bridge does not judge escapes; the `unknown` entry keeps only grants whose users or root target rest on an alias or digest it does not evaluate, and polkit rules it cannot reduce. The reader's premise was partly false: a partial grant was already the `unknown` entry | GA-BRIDGE-53 (amended; subject `trusts-a-one-command-grant`; `trusts-an-incomplete-admin-list` and `trusts-a-narrowed-sudo-grant` reworded) | stricter | HS22, HS23 |
| Round 10, SM1: on Linux, the account's console session is its session on `seat0` | GA-BRIDGE-42 (prose) | clarified | HS19, HS22 |
| Round 11, O-M1: a transmitter whose host removes its host link (an unplugged dongle's device node) is also `down`; `downs-an-idle-transmitter` names a present host link, and `keeps-an-unplugged-dongle` is new | GA-BRIDGE-72 (amended; subjects) | stricter | HS12 |
| Round 11, O-M2, bridge half: a command whose write its host reports failed is acked `failed(unreachable)`, since the host took nothing to transmit | GA-BRIDGE-72 (amended; subject `sends-into-a-failed-write`), failure matrix | stricter | HS12 |
| Round 11, O-M3: `toggles` also covers a code that cycles (a mode or fan button) or steps relatively (vol+, temp+), anything that reaches a state only from a known one | GA-BRIDGE-71 (amended; subject `declares-a-cycle-discrete`), `actions` | stricter | HS1, HS12 |
| Round 11, O-L2: a transmitter that can answer nothing, which has no exchange, resets its backoff when its host link opens again, so its reopen retries do not stay at the ceiling | GA-BRIDGE-11 (amended; subject `keeps-a-mute-backoff`) | stricter | HS12 |
| Round 11, O-M6, bridge half: a lock for an account whose only sessions are non-graphical is acked `failed(no_graphical_session)`, never `failed(not_locked)`, so a steward tells the two by reason, not timing | GA-BRIDGE-66 (amended; subject `acks-an-ssh-only-lock`), *Computers*, failure matrix | stricter | HS20 |
| Round 11, F1, bridge half: `wholeState` on an action whose code carries the device's whole state; the command carries the applier's assumed state in `state`, and the bridge builds the code from the command alone, never from what it last sent; an applier older than 0.10 sends none, a stated limit | GA-BRIDGE-73 (new; subject `builds-from-memory`), *Commands*, `actions`, *What this standard does not define* | new | HS1, HS12 |
| Round 11, R1, bridge half: GA-BRIDGE-71's pointer to the applier names open-loop devices and the applier's own actuations | GA-BRIDGE-71 (prose) | clarified | HS15 |

Bridge-side fields stay camelCase and milliseconds, as 0.2's wire is; this is not a change.

### Applier 0.10

| Change | Ids | Direction | Scenarios |
|---|---|---|---|
| Two new classes, `computer` (`feedback: closed`; a bridge carrying its own PC bridge is not `infrastructure` for that reason alone) and `player`, with capabilities `power` (`wake`, `sleep`, `shutdown(delay_s?)`, `cancel`) and `session` (`lock(account)`) | new | new | HS19–HS23 |
| `media.launch(search)` on a player: a typed `search` object, never `already`, `idempotent: false`; state keys `title` and `started_at`; ack compares reported values, not clocks, default `ack_within_s` 30 s; `args` gains a constraint form for an object's fields | new (media capability existing) | new | HS19 |
| Sensor keys `app`, `camera_in_use`, `microphone_in_use` added to the applier's closed sensor list | new | new | HS22, HS23 |
| `notify` gains argument `from`, optional: the applier accepts a `notify` without it, and sends `from` only to a device whose `notify` declares it. Round 1, H4, F7: this row said the applier refuses a `notify` that omits it; the text, the later decision, says the opposite | GA-APPLY-14 (new) | **looser** — ground: compatibility, since a minor version only adds and a client written for 0.8 must still be served; ruled when round 5's open item was closed (*From against an older bridge*, under *Bridge 0.4*); the steward's duty to set `from` on every dispatch (GA-NOTE-2) is unchanged | HS20 |
| `power.shutdown` is `idempotent: false`: a reissue after an ack timeout does not resend it (an errored or restarted countdown otherwise) | new | new | HS23 |
| GA-EVT-6 amended: an apply's own correlation wins over cause `device` for the `self_changing` key its own action sets (`session.lock`, `media.launch`), so a lock or a launch is still attributed to the apply that caused it | GA-EVT-6 (amended) | clarified — round 1, ledger: an attribution precedence (GA-EVT-1's correlation to a dispatched action wins over GA-EVT-6's `device`), which moves no bar; the row said stricter | HS19, HS20 |
| The standard declares `self_changing` and `personal` on specific keys; the owner cannot remove either declaration (only raise, through `configure`) | new | stricter | HS19–HS23 |
| The `session.<account>` key family: one scalar key per account, the key a `session.lock { account }` sets chosen by its argument (GA-EVT-1, GA-EVT-3, and `already` read against it) | GA-EVT-1 (amended), GA-EVT-3 (amended) | new | HS20, HS21, HS23 |
| Every computer key (session keys, `battery`, `app`, `camera_in_use`, `microphone_in_use`) and a player's `playing`, `title` and `started_at` are `self_changing` by standard | new | **looser** — ground: a person's ordinary use of a PC (a draining battery, a switched window, a lock, an episode ending) must never lease the device against a rule (HS20); the applier's general guidance to declare only keys a person does not usually set is amended for keys the standard itself declares | HS19, HS20 |
| New device fields `wake_via`, `host` and `internal`; the applier removes `power.wake` from a `wake_via`-less computer's declared actions | new | new | HS19, HS22 |
| The wake path's named exceptions: `power.wake` on a `dead` computer with a `wake_via` is planned and dispatched to the relay's entry rather than `skip(dead)` or `unreachable`; "its bridge" in the ack rule means the relay's owner; the step is `acked` when the computer and its previously-live hosted devices are live again (or definitely `available: false`) within `ack_within_s`; `power.wake` on a `live` computer is `already`, itself an exception to "stateless actions are never `already`" | GA-PLAN-4, GA-APPLY-5, GA-APPLY-7, GA-APPLY-8, GA-APPLY-9, GA-EVT-3, GA-STATE-4 (all amended, named exceptions for this one action) | **looser** — ground: Wake-on-LAN is unreliable and asleep/off look the same over the network (design *Evidence*), so a dead computer with a wake path must still be reachable for this one action | HS19 |
| The applier MUST keep, across its own restart, which of a computer's hosted devices were live at its death | GA-PERSIST-1 (amended) | new | HS19 |
| A new default-`ack_within_s` row: `power.wake`, 90 s | new | new | HS19 |
| Default tiers gain rows: `infrastructure` power (`sleep`, `shutdown`) `no_voice`; `computer` `power.shutdown` `confirm`; any extension action from a plugin `confirm`, as a floor | new | new | HS22, HS23 |
| GA-DESC-3 amended: `configure` may lower an extension action down to its floor, and no other; nothing lowers it below the floor | GA-DESC-3 (amended) | **looser** — ground: ruling 5, confirmed by the maintainer on 2026-09-25 | HS22 |
| A changed action (a replacement's changed tool hash, schema or requested tier) loses a tier the owner had set below its formula; it falls back to the formula until reset. Round 1, H3: a tier the owner raised is kept, so a publisher's edit never undoes a stricter choice | GA-DESC-11 (new) | stricter | HS22 |
| An extension described in `describe` with its schema counts as "known", amending the rule that a client MUST NOT invoke an extension it does not know | new (amends existing client rule) | **looser** — ground: a plugin's extension actions must be callable once installed and described, or the tier and the manifest work for nothing | HS22 |
| GA-STATE-3 and GA-STATE-5 exceptions for an adapter's computer: unavailable is `dead`, not `stale`; where the adapter can read the engine's availability, the computer is `live` while the engine marks it available, with no time bound; otherwise the owner's `fresh_s` is required before adoption | GA-STATE-3 (amended), GA-STATE-5 (amended) | **looser** — ground: candidate list; matches how a `feedback: open` device is already treated as live while its transport is up, and an unavailable PC really is asleep or off, not merely unheard from. Round 1, M8, the unbounded `live` taken as looser on this further ground: an adapter's engine owns its devices' liveness, as for every adapter device, and the adapter's own call every 5 s bounds the engine (GA-STATE-3) | HS24 |
| Adapters map `power` and `session` only from an allowlist keyed by the agent's model and an entity `unique_id` pattern; everything else on the computer is listed in the adapter's `ungoverned`; adapters may not map an engine entity that runs arbitrary commands to any capability (no remote shell) | new | stricter | HS24 |
| GA-PROV-1 becomes per operation: `install` and `uninstall` need Host, the other operations need Provision; `provision`'s event gains `installed`, `install_failed` and `uninstalled` | GA-PROV-1 (amended) | new | HS22 |
| A staged device (`stagedFor`) is exempt from `route_conflict`; the applier issues a `plugin_update` notice instead | new | **looser** — ground: a staged replacement with the same stable identifier is hardware replaced by itself, not a routing collision. Round 1, S7: the match rests on the manifest's own `id`, unsigned while plugin signing is open (bridge, *What this standard does not define*); the owner's `sha256` and review at adoption stand in the way, and the text now says so | HS22 |
| GA-ADOPT-2 amended: a plugin replacement may drop an action no safety rule uses; a step on it then ends `unsupported_action`, as the replacement text already says | GA-ADOPT-2 (amended) | **looser** — ground: candidate list; a plugin author dropping an unused action must not be blocked from shipping an update | HS22 |
| Round 1, H1: after the `wake_via` device's terminal ack, GA-APPLY-8's dead-bridge clause does not apply to a wake; the step waits out its `ack_within_s` | GA-APPLY-8 (amended) | clarified | HS19 |
| Round 1, M1: the applier adds `power.wake`, with its default tier and `ack_within_s`, to a computer while it has a `wake_via` | GA-DESC-10 (amended) | clarified | HS19 |
| Round 1, H2: on `uninstalled`, the applier forgets the plugin's devices (model, id map, `activate` record), so a later install is a fresh admission; an `uninstall` while a safety rule names one is refused | GA-PROV-4 (new) | new | HS22 |
| Round 1, M2: on a plugin device's replacement, the new version's manifest declarations win; GA-ADOPT-2 carries only what the owner set, a tier subject to GA-DESC-11. Corrected by round 2, SH2: `personal` and `self_changing` are the exception, kept as the union of every version's | GA-ADOPT-2 (amended) | clarified | HS22 |
| Round 1, M4, S4: the owner's app shows a plugin device's manifest-declared `self_changing` and `personal` keys at adoption, beside its tiers; no revocation mechanism | — (prose) | clarified | HS22 |
| Round 1, F6: an adapter's device's stateless action is `delivered` on the engine's word that it sent the command | GA-APPLY-7 (amended) | clarified | HS24 |
| Round 1, L4: a will after an unannounced suspend is taken as any will; none is a `bridge_fault` | — (prose) | clarified | HS23 |
| Round 1, S3: the two tier formulas for a plugin device are named, the **extension tier** and the **plugin standard tier**, and the `requested_tier` row cites them | — (prose, *Plugins' actions*) | clarified | HS22 |
| Round 2, H1: a hosted device's `available: false` ends a wake only when reported in a status received since the computer's death, which a bridge sends only when the server cannot serve (GA-BRIDGE-58); a hosted device not yet checked in is waited for | GA-APPLY-13 (amended) | stricter | HS19 |
| Round 2, M1: a staged activation leaves the old version's unreplaced devices `dead` in the model, as after `left`; the new version's other devices keep `staged_for` and their `route_conflict` exemption until adopted or the old one is forgotten | GA-BUS-15 (amended) | clarified | HS22 |
| Round 2, M2: `activate` is re-sent at least every 60 s (⚠️ a guess) while its bridge stays live, until `ok`; `failed(unknown_plugin)` is a notice with cause `bridge_fault` | GA-ADOPT-4 (amended) | stricter | HS22 |
| Round 2, M3: a plugin none of whose devices is left in its bridge's `devices` is taken as uninstalled, a device a safety rule names kept `dead` | GA-PROV-4 (amended), GA-BUS-6 (prose) | stricter | HS22 |
| Round 2, L1: `wake_via` names a device of the same applier as the computer; a meta-applier relays no wake across children, and `configure` refuses a `wake_via` on another applier's device | GA-DESC-10 (amended) | stricter | HS19 |
| Round 2, L2, SM1, SM2: `install_failed(unknown_account)` and a reinstall's `version_conflict` for another `account`, named in *Provisioning* | — (prose; GA-BRIDGE-68, GA-BRIDGE-57) | clarified | HS22 |
| Round 2, L3: an extension key's schema is always a scalar | — (prose; GA-BRIDGE-68) | clarified | HS22 |
| Round 2, L6, SH1: a computer's `accounts` is `{ <account>: label }` only; the steward's person mapping is a field of its own | — (prose) | clarified | HS20 |
| Round 2, SH2: a plugin replacement's manifest may add but never drop a `personal` or `self_changing` declaration an earlier version made (the union), as `configure` may not | GA-DESC-9 (amended), GA-ADOPT-2 (prose) | stricter | HS22, HS23 |
| Round 2, SL1: a person at the PC who shuts it down or puts it to sleep is the device's own behaviour | — (prose, *Power*) | clarified | HS23 |
| Round 2, W2: each plugin action's `tool_hash` is kept in its declaration and across restarts, so GA-DESC-11 compares a later version with the one it replaces | GA-DESC-11, GA-PERSIST-1 (amended) | new | HS22 |
| Round 3, OH1, WM1: a wake counts a hosted device only on a check-in since the computer's return, a `last_check_in` other than the one held at the death, compared as a value; the old one may still read `live` under GA-STATE-2 and does not count; the sentence saying such a device "reads `stale`" is replaced; the `last_check_in` at the death is kept across restarts | GA-APPLY-13 (amended), GA-PERSIST-1 (amended) | stricter | HS19 |
| Round 3, SM2: GA-APPLY-13's text says a plugin server that crashes after a resume ends the wake early with its `available: false`, and why that is accepted (the device cannot serve then); no new signal | — (prose; GA-APPLY-13) | clarified | HS19 |
| Round 3, OH3: `from`'s union is `{ endpoint, role } · { rule, brain_authored? } · { scenario, brain_authored? } · { notice }`, so a brain-written rule's `notify` is not refused by the applier's schema | — (prose; GA-APPLY-14) | clarified | HS20 |
| Round 3, OM1: only a `stagedFor` naming a plugin device on the same bridge and host with an equal `stable_identifier` is exempt from `route_conflict`; any other is a normal `route_conflict`. Narrows the looser staged exemption above | GA-BUS-15 (amended) | stricter | HS22 |
| Round 3, OM2: a plugin is forgotten on `uninstalled` or on the `accepted` reply to the applier's own `uninstall`; from absence only in a `devices` document parsed with no entry dropped that still lists the host, so a bad entry never forgets an adoption and a lost `uninstalled` then a reinstall cannot resurrect one | GA-PROV-4 (amended) | stricter | HS22 |
| Round 3, SM1: a `configure` change of `load` or `infrastructure` re-applies *Default tiers*, raising a stored tier now below its new floor, as GA-DESC-11 does for plugins | GA-DESC-13 (new) | stricter | HS14 |
| Round 3, WL1: at adoption GA-ADOPT-3 judges the tier before any change in the same change set lowers it, so adopting a device with other admins and lowering its action at once still raises `other_admin` | GA-ADOPT-3 (amended) | stricter | HS22 |
| Round 4, OH3: a meta-applier passes `from` to a child only when the child's `standard_version` is 0.10 or later and the child's device lists it, else leaves it out, so an 0.8 or 0.9 child never refuses the step and GA-NOTE-1 never retries for ever. The brief's reject test failed: the text confined neither the steward nor the meta-applier to 0.9 | GA-APPLY-14 (amended; subject `sends-from-to-an-old-child`) | stricter | HS20 |
| Round 4, OM2: a version with no staged devices swaps too, so before its `activate`, while another version's device is adopted, the applier issues a `plugin_update` notice naming each adopted device that will leave; *Staged versions* says the old devices leave only once the new server has served | GA-ADOPT-4 (amended; subject `evicts-without-a-word`) | stricter | HS22 |
| Round 4, OM5: the extension floor is `no_voice` on a device of class `door_lock`, `water_valve`, `gas_valve`, `gate` or `garage_door`, whose rows name only standard actions | GA-DESC-3 (amended) | stricter | HS22 |
| Round 4, OM6: plugin devices carry `plugin` and `version`, and the applier reads them, never parsing an id | — (device fields, *Plugins*) | clarified | HS22 |
| Round 4, OM11: `proposed_infrastructure` on a computer, the bridge's proposal, shown to the owner, who sets `infrastructure` | — (device fields) | new | HS23 |
| Round 4, OL1: `session.lock` is acked by `none` too, since a logout ends the session | GA-EVT-3 (amended; subject `lock-fails-on-logout`) | looser — ground: `none` was already `already` for the lock, so a logout that answers the lock is the lock's goal reached, not a failure | HS20 |
| Round 4, OL4: the changelog names GA-ADOPT-3 among the amended ids (round 3, WL1) | — (changelog) | clarified | HS22 |
| Round 4, F2: HS20's lock hop is `acked` when `session.liza` reads `locked`, or `disconnected` on Windows, as GA-EVT-3 matches | — (scenarios) | clarified | HS20 |
| Round 4, F3: HS24's first hop cites the adapter as a child the meta-applier delegates to (*The meta-applier*, its *Delegation*; GA-META-10), not GA-META-2, which covers duplicate routes | — (scenarios) | clarified | HS24 |
| Round 4, F4: HS24's adapter hop no longer maps Home Assistant's Wake-on-LAN switch as `wake_via`: it belongs to the `wake_on_lan` integration, which GA-DESC-12's allowlist does not key, so the adapter offers no `power.wake` and HS24 never wakes the PC. GA-DESC-12 is not widened | — (scenarios) | clarified | HS24 |
| Round 4, F5: at HS22's adoption Ольга sets `launch`'s `ack_within_s` to 60 s, since the manifest cannot and the default 10 s ends a slow game's launch `failed(no_ack)` | — (scenarios) | clarified | HS22 |
| Round 5, OH1, SL3: the extension floor's "tier the class, flag and load rows give its device" is the highest tier any row naming the device's class, a flag or its load gives any action, `reversible` where no row names it, so a classless device's floor is its `requested_tier` alone; every extension action on a device whose `host` is a computer with `infrastructure: true` has a `no_voice` floor, and a change of that computer's `infrastructure` re-derives its hosted devices' tiers in the same change set | GA-DESC-3, GA-DESC-13 (amended; subject `extension-under-the-box`) | stricter | HS19, HS22, HS23 |
| Round 5, OM7: `configure` refuses an extension action's tier below its floor with `invalid_request`, never clamping it | GA-DESC-3 (amended; subject `lowers-a-lock-extension`) | clarified | HS22 |
| Round 5, OM2: the owner may remove, through `configure`, a key a plugin's manifest declares `self_changing`, and the removal stands across replacements until the owner adds it back; `personal` stays union-only and never removable | GA-DESC-9 (amended; subjects `restores-a-removed-self-changing`, `removes-a-plugin-personal`) | **looser** for `self_changing` relative to round 2's union — ground: a publisher's `self_changing` makes a person's change take no lease (GA-LEASE-2), so a rule undoes it; whether a key is the device's own behaviour is the owner's call, and the design makes unremovable only the declarations the standard makes. Stricter than the publisher-only rule before round 2, since a new manifest can no longer drop the key either | HS19, HS22 |
| Round 5, OM3: `power.wake`'s default `ack_within_s` is 240 s (⚠️ a guess), a cold boot plus GA-BRIDGE-58's 120 s start bound, since a conforming bridge may take 120 s for a server to serve and must not report it `available: false` meanwhile. The smaller alternative, taking a starting server as a definite answer, was not taken: the wake would then ack before the player can take the launch GA-BRAIN-17 allows | GA-APPLY-13, GA-APPLY-8 (default and *Constants*) | **looser** — ground: the design's 90 s row fails a wake that took after a cold boot on a conforming PC; a wake that did not take is still failed, 150 s later | HS19 |
| Round 5, OM8: an extension action is `idempotent: false` unless the owner declares it `true` at adoption; the manifest's value is a proposal shown there, and an owner's `true` falls back when a replacement changes the action's tool hash | GA-DESC-4 (amended; subject `trusts-a-plugins-idempotent`) | stricter | HS19, HS22 |
| Round 5, OL1: the note on amended clauses without subjects names GA-EVT-3's `lock-fails-on-logout`, and GA-DESC-3's new subjects | — (*Negative subjects*) | clarified | HS20 |
| Round 5, OL2: a meta-applier re-issues a token with the `args` it actually delegates, without `from` where it leaves `from` out for an 0.8 child, so the child does not refuse the step `refused(token)` | GA-META-10 (amended; subject `delegates-a-token-with-from`) | stricter | HS20 |
| Round 5, F2: the `detail` of the terminal ack taken for a step is carried in its final outcome and `outcome` event, whatever the outcome, so a plugin's tool error still says why when the step ends `failed(no_ack)`; the reason is unchanged, and the text is third-party content (GA-BRAIN-3) | GA-APPLY-15 (new; subject `drops-the-ack-detail`) | new | HS19 |
| Round 5, F4: *Computers behind an adapter* no longer names an engine's Wake-on-LAN switch as a `wake_via`: an adapter's device is one only where its allowlist maps an entity to `power.wake` (GA-DESC-12), as round 4's F4 found | — (prose) | clarified | HS24 |
| Round 5, F4 follow-up: *Waking*'s example of an adapter's ack no longer says "a Home Assistant switch's `delivered`" in general, but the `delivered` of an adapter's switch that GA-DESC-12's allowlist maps to `power.wake` | — (prose, *Waking*) | clarified | HS24 |
| Round 5, OM3 follow-up: HS19's wake hop acks within the new default, 240 s, not the design's 90 s | — (scenarios) | clarified | HS19 |
| Round 6, OH2: a standard action on a device a computer hosts also takes its host's `infrastructure: true` and `computer` rows, so a plugin's `power.sleep`, `power.shutdown` or `onoff.turn_off` on a device an `infrastructure` computer hosts is `no_voice`; a change of the computer's `infrastructure` re-derives its hosted devices' standard actions too | GA-DESC-3, GA-DESC-13 (amended; subject `sleeps-the-box-through-its-player`) | stricter | HS23 |
| Round 6, OM1: a computer with `proposed_infrastructure` takes the `infrastructure: true` rows, and gives its hosted devices the `no_voice` extension floor, until the owner sets `infrastructure` either way | GA-DESC-3 (amended; subject `sleeps-the-proposed-broker-host`) | stricter | HS23 |
| Round 6, OH3, applier half: *Sessions* says an account's several sessions make one key and `session.lock` locks every one | — (prose; GA-BRIDGE-52, GA-BRIDGE-66 carry it) | clarified | HS20 |
| Round 6, OM2: an adoption whose `activate` would remove a device a safety rule names, not replaced in the same change set, is refused with `invalid_request`, as an `uninstall` is (GA-PROV-4) | GA-ADOPT-4 (amended; subject `evicts-a-safety-device`) | stricter | HS22 |
| Round 6, OM5: `configure`'s refusal of an extension action's tier below its floor moves from GA-DESC-3, a `static` check, to its own `wire` id, with `lowers-a-lock-extension` | GA-DESC-14 (new), GA-DESC-3 (clause moved) | clarified | HS22 |
| Round 6, OL1: GA-PROV-4's forgetting on `accepted`, while the devices are still in the bridge's `devices`, is a named exception to `forget`'s refusal of such a device | GA-PROV-4 (amended) | clarified | HS22 |
| Round 6, OL2: a replacement whose manifest lowers an action's `requested_tier` keeps the tier the action had, as the owner's, until the owner accepts the lower one by deleting that value through `configure` | GA-DESC-11 (amended; subject `lowers-by-a-new-manifest`) | stricter | HS22 |
| Round 6, OL5: `configure` refuses a `forget` of a device a computer's `wake_via` names; the owner clears the `wake_via` first. The smaller of the two fixes the brief offered | GA-DESC-10 (amended; subject `forgets-a-wake-path`) | stricter | HS19, HS24 |
| Round 6, OL6, applier half: `app`, `camera_in_use` and `microphone_in_use` are `personal` on every device that reports them, not only on a computer | GA-DESC-9 (amended; subject `drops-a-plugins-camera`) | stricter | HS19, HS23 |
| Round 6, WL2: HS22 gains a hop at Ольга's adoption: the device's `otherAdmins` name `artem` (GA-BRIDGE-53), and the `other_admin` notice fires though she lowers `launch` in the same change set (GA-ADOPT-3) | — (scenarios) | clarified | HS22 |
| Round 7, RH1, applier half: a plugin device's `stable_identifier` carries its host computer's identifier first; GA-BUS-15's staged match compares it whole | GA-BUS-15 (amended) | stricter | HS19, HS22 |
| Round 7, RM2: an adoption of a staged device with `replaces` is pending until the swap; until then the old device keeps the id, declarations and rules, and the new device stays unadopted; if the new server fails its check or start bound first, the pending adoption is dropped with a `plugin_update` notice and the old device stays as it was, so a failed swap no longer leaves the id pointing at nothing | GA-ADOPT-5 (new; subjects `repoints-before-the-swap`, `keeps-a-failed-swap`), GA-ADOPT-2 (prose) | stricter | HS22 |
| Round 7, RL3: GA-ADOPT-4's pre-activation `plugin_update` notice covers any `activate` that will remove an adopted device the change set does not replace, a staged version's included | GA-ADOPT-4 (amended; subject `evicts-a-sibling-without-a-word`) | stricter | HS22 |
| Round 7, RL5: GA-DESC-4's fallback of an owner's `idempotent: true` on a changed tool hash, and GA-DESC-9's replacement clause (`personal` kept, a `self_changing` removal standing across replacements), move to `wire` ids, since neither can be read from one `describe`; `drops-a-plugin-declaration` and `restores-a-removed-self-changing` move with it | GA-DESC-15 (new; subject `keeps-an-idempotent-over-a-new-tool`), GA-DESC-16 (new), GA-DESC-4, GA-DESC-9 (clauses moved) | clarified | HS22 |
| Round 7, SM1: a computer's `infrastructure` has three states, stated once in *Default tiers*: owner set `true`; owner set `false`, whatever the proposal; unset, when `proposed_infrastructure` decides, and absent a proposal it is `false` | GA-DESC-3 (prose) | clarified | HS23 |
| Round 7, SL2: `provision` bodies are compared as their RFC 8785 serialisations, never byte for byte; the prose said RFC 8785 already, and the index row now does | GA-PROV-3 (row) | clarified | HS22 |
| Round 8, H1, applier half: when GA-ADOPT-5 drops a pending replacement, the applier sends `activate` naming the old device's version, which cancels the new version's pending activation, re-sent until an `ok`, and sends no more `activate` of the new version, so the safety-named old device never leaves without the owner; if the swap came first, the adoption takes effect as at any swap, with a notice | GA-ADOPT-5 (amended; subject `leaves-a-failed-swap-pending`), GA-PERSIST-1 (amended) | stricter | HS22 |
| Round 8, H2: the administrators of a computer that carries the broker (`infrastructure` true, a `proposed_infrastructure` included, from GA-BRIDGE-65) count as other admins of every device a safety rule actuates, for GA-SAFE-6; they are admins, not `ungoverned`, so the Safe claim stands, and the owner accepts them with `accepts_other_admins`; one added is an `other_admin` notice for each rule without it | GA-SAFE-6 (amended; subject `ignores-the-broker-hosts-admins`) | stricter | HS23 |
| Round 8, M2, applier half: `failed(not_locked)` is a "may have acted" ack for attribution, as `failed(no_confirmation)` is: a `locked` inside the step's `ack_within_s` keeps the apply's cause, not `external`, so it takes no lease and no rule-failure notice treats it as someone else's | GA-EVT-1 (amended; subject `externalises-a-late-lock`) | stricter | HS20 |
| Round 8, M3 and WL4, applier half: a computer's `session.lock` declares `account`'s `args` as the tokens its `accounts` lists, so a step on a retired or unlisted token is `refuse(invalid_args)` at plan, never dispatched | GA-DESC-17 (new; subject `locks-a-retired-account`) | new | HS20 |
| Round 8, M4, applier half: GA-ADOPT-5 counts only an `available: false` published after the device went `available: true` following the `ok`, or a `faults` entry naming the device; a status from before the `ok`, re-published by a snapshot, drops nothing | GA-ADOPT-5 (amended; subject `drops-on-a-stale-status`) | clarified | HS22 |
| Round 8, SM2: a subject for GA-STATE-3's computer clause: an adapter's computer the engine marks unavailable read `stale` | GA-STATE-3 (subject `unavailable-computer-reads-stale`) | clarified | HS24 |
| Round 8, L2: `power.wake` on a computer `stale` at dispatch is `acked` on the computer's next check-in that makes it `live`, its hosted devices as GA-APPLY-13 says, dispatch standing for the death, within the same bound | GA-APPLY-13 (amended; subject `never-acks-a-stale-wake`) | clarified | HS19 |
| Round 8, L3: GA-PROV-4's forgetting on absence raises a notice with cause `plugin_update` naming the plugin; whichever way it forgets, the applier first clears any `wake_via` naming a forgotten device, with a notice naming the computer, as GA-DESC-10 keeps a `forget` from leaving one | GA-PROV-4 (amended; subjects `forgets-unseen`, `forgets-a-wake-path-device`) | stricter | HS19, HS22 |
| Round 8, L7: an `uninstall` run twice ends `failed(unknown_plugin)` at the bridge the second time, which the applier takes as done | — (prose, *Provisioning*) | clarified | HS22 |
| Round 8, SL1: the *Default tiers* table's extension row carries one sentence of the floor itself: `confirm`, or its floor where higher | GA-DESC-3 (table) | clarified | HS22 |
| Round 9, H1: a computer the owner marks `applier_host` (a new `configure` field on a computer) is exempt from the broker rule: its administrators already administer the applier and the broker it trusts, so they count only as its own and its hosted devices' other admins; the rule applies to a broker-carrying computer other than the applier's host; clearing the mark is the notice an added admin gives. `infrastructure` keeps its tiers as is | GA-SAFE-6 (amended; subject `counts-the-applier-hosts-admins`) | **looser** — ground: root, which every Linux PC lists (GA-BRIDGE-53), otherwise makes every safety rule in a home whose box runs a PC bridge need `accepts_other_admins`, and pushes the owner to set `infrastructure: false`, lowering the broker host's power tiers | HS19, HS23 |
| Round 9, M1: having forgotten a plugin on `accepted`, the applier keeps a tombstone for the plugin and host, across a restart, until `uninstalled`, `failed(unknown_plugin)` or a counting `devices` without them, and ignores its devices in any `devices` publish or snapshot meanwhile, with no GA-BUS-6 notice | GA-PROV-4, GA-PERSIST-1 (amended; subject `readmits-an-uninstalling-plugin`) | stricter | HS22 |
| Round 9, M2: a report matching a `session.lock` that ended `failed(not_locked)`, within its `ack_within_s`, is a `late_ack`, as after `failed(no_ack)`; the steward's GA-RULE-8 and the brain's GA-BRAIN-15 take it as any `late_ack` | GA-APPLY-11 (amended; subject `no-late-ack-for-a-slow-lock`) | stricter | HS20 |
| Round 9, L1: for `power.wake` on a computer, `already` is evaluated before `dead`, at plan and at dispatch, so a `live` computer with a dead relay entry is `already`, not `skip(dead)` | GA-PLAN-4 (amended; subject `skips-a-live-wake-as-dead`) | clarified | HS19 |
| Round 9, L3, applier half: GA-ADOPT-5 names the `faults` codes it drops a pending adoption on: `pin_mismatch`, `crash_loop`, `account_deleted` | GA-ADOPT-5 (amended) | clarified | HS22 |
| Round 9, SM3: the tool hash detects a changed declaration, not changed behaviour; pinning is not a sandbox (bridge *Hosting*) | — (prose, *Default tiers*) | clarified | HS22 |
| Round 9, GA-CFG-3: `configure` refuses, with `invalid_request`, an `applier_host` set on a device that is not a `computer`, or on a second computer while another holds it, so the broker rule's exemption names at most one computer | GA-CFG-3 (amended; subject `marks-two-applier-hosts`) | stricter | HS19, HS23 |
| Ruling 2026-09-27, assumed readings: a `feedback: open` device's state values carry `assumed: true` wherever the applier gives them, and no client takes one as observed (steward GA-RULE-2, brain GA-BRAIN-7) | GA-STATE-4 (amended) | clarified | HS12 |
| Ruling 2026-09-27, toggles: action declarations carry `toggles` (from the bridge); an action declared `toggles: true` is never dispatched without a token for its step, `refuse(toggle_only)` after `already` and before `token`, so a closed-loop device already in the state is still `skip(already)`; `configure` refuses a safety rule that actuates one; it is declared `idempotent: false`, so never reissued; the vocabulary gains `onoff.toggle` (stateless, not idempotent), the button, sent as requested, never `toggle_only`, leaving an assumed `on` `unknown` (removed in round 10) | GA-PLAN-8 (new; subjects `toggles-to-reach-a-state`, `asks-for-the-button`), GA-PLAN-4 (the reason order), *Capabilities and actions*, *Action declarations* | new | HS15 |
| Ruling 2026-09-27, a silent transmitter: an open device is `live` while its bridge is alive and its transport `up` or `unknown`; `describe`'s transport `up` and the `transport` event carry `unknown`; the item leaves *What this standard does not define*, with the open-loop item | GA-STATE-4 (amended; subject `kills-a-mute-transmitters-devices`) | **looser** — ground as the bridge's row | HS12, HS15 |
| Round 10, B1, F1, O-M1: by the controller's ruling, `onoff.toggle` leaves the vocabulary, with *The button*, GA-PLAN-8's clause for it and the subject `asks-for-the-button`; a person who wants the button pressed gets the same `ask(toggle_only)` and answers yes | *Capabilities and actions*, GA-PLAN-8 (amended) | stricter | HS13, HS14, HS15, HS17 |
| Round 10, O-M2: a token whose `for` names a `rule`, or a `run` without a `person`, is an author's confirmation and is taken as no token for an action declared `toggles: true`, so a rule, a schedule or a run they start never sends one; the ruling said "a rule or run", and a run a person started carries `person` and a person's yes, so it is kept | GA-PLAN-8 (amended; subject `answers-a-toggle-by-rule`) | stricter | HS15 |
| Round 10, O-H2, applier half: the steward's question says that the code toggles and the device's state is not known, not that the person can see it | GA-PLAN-8 (prose) | clarified | HS15 |
| Round 10, O-H3: `configure` refuses `load: heating` on a `feedback: open` socket, since it never reports `on` and GA-LOAD-2's cap could never count | GA-CFG-3 (amended; subject `caps-a-silent-heater`), *Loads* | stricter | HS14 |
| Round 10, O-M3, applier half: adopting a device on an `unknown` transport is a notice with cause `open_loop` (a new cause, shown as a notice by an older client) saying nothing will show if it stops working | GA-ADOPT-6 (new; subject `adopts-a-mute-device-quietly`), *Safety rules* notice causes | new | HS12, HS15 |
| Round 10, O-M4, applier half: a client takes a transport `up` it does not know (`unknown`) as `false` | *Compatibility* | clarified | HS12 |
| Round 10, F7: apply re-checks `toggle_only` at dispatch and reports `refused(toggle_only)`; GA-PLAN-8 already blocked the dispatch, only the outcome's name was missing | GA-APPLY-9 (amended; subject `re-checks-no-toggle`) | clarified | HS15 |
| Round 10, SL1: `session.lock`'s `ack_within_s` default, 10 s, is named, covering the bridge's 5 s wait for a screen locker; already a guess under *Constants* | *Action declarations*, *Constants* | clarified | HS20 |
| Round 10, F6, applier half: HS12 names both actions «включи на 22» plans, cites GA-PERSIST-1 for the assumed state the AC's whole-state codes are built from, and marks the whole-state claim ⚠️ as a bench check per model | — (scenarios) | clarified | HS12 |
| Round 11, O-L8, by the controller's ruling R1: `toggle_only` holds on a `feedback: open` device only, since the maintainer's ruling was about open-loop devices; a closed-loop device whose action toggles is planned from its observed state, as before this revision | GA-PLAN-8 (amended; subject `asks-a-closed-loop-toggle`), *Reason order* | looser | HS15 |
| Round 11, O-H2, by ruling R2: the applier's own actuations (a cap's turn-off, a safety rule's action or re-send, any retry) never send an action declared `toggles: true`; `configure` refuses a safety rule with one, and a `heating` load on a socket whose `turn_off` is one; the check runs again on every declaration change, a rule then disabled with a `rule_disabled` notice and a cap a `load_cap` notice; a socket with such a `turn_off` and no configured load is a `load_cap` notice at adoption; GA-LOAD-2's retry honours `idempotent: false`; GA-PLAN-8's safety-rule clause moves here | GA-SAFE-13 (new; subjects `toggles-by-safety-rule`, `toggles-a-cap-off`, `keeps-a-rule-on-a-re-taught-code`, `adopts-an-uncappable-socket-quietly`), GA-LOAD-2 (amended; subject `retries-a-pulse-off`), GA-PLAN-8 (amended) | stricter | HS14, HS17 |
| Round 11, O-H1, by ruling R3: round 10's refusal of `heating` on a `feedback: open` socket is replaced: such a socket carries `heating` where its `turn_off` is discrete, its cap counting from the first `turn_on` the applier sends that ends `sent` or `unanswered`, until a `turn_off` ends `sent`; an `on` made at the socket is not seen. Looser than round 10, which a real heater could only escape by being declared `other` | GA-CFG-3 (amended; subject `caps-a-silent-heater` withdrawn), GA-LOAD-2 (amended; subject `never-caps-a-silent-heater`), *Loads* | looser | HS14 |
| Round 11, O-M2, applier half: an assumed value changes only when an action ends `sent`, never on `unreachable` or `failed`, a failed write on an `unknown` transport included | GA-STATE-4 (amended; subject `assumes-a-failed-write`) | clarified | HS12 |
| Round 11, O-M7: the `open_loop` notice also when an adopted device's transport first reads `unknown` (a bridge upgraded under it), and at `configure` of a safety rule actuating a device on one | GA-ADOPT-6 (amended; subject `upgrades-a-mute-device-quietly`) | stricter | HS12 |
| Round 11, O-M8: an assumed value is never a report: it fires no safety rule's trigger and holds no safety rule's condition or latch | GA-SAFE-11, GA-SAFE-7 (amended; subjects `fires-on-an-assumed-value`, `clears-a-latch-on-an-assumed-value`) | stricter | HS4, HS12 |
| Round 11, O-L4: a transport's `up` stays a bool in `describe`, `true` only while its new `state` (`up`, `down`, `unknown`) is `up`; the `transport` event and `state` carry both, and a client takes a `state` it does not know as `down` | *Transports*, *Events and history*, *Operations*, *Compatibility* | clarified | HS12 |
| Round 11, O-L5, applier half: *Clients and tokens* carries a token for a toggle on an open-loop device | *Clients and tokens* | clarified | HS15 |
| Round 11, F1, applier half: a command for an action declared `whole_state: true` carries in `state` the device's assumed state, kept across a restart, since the bridge keeps none | GA-APPLY-16 (new; subject `sends-a-bare-setpoint`), *Action declarations*, *State and liveness* | new | HS1, HS12 |
| Round 11, F2, applier half: a token whose `for` names a `run` is an author's only with neither a `person` nor an `endpoint`, so a yes at a hall panel sends the toggle | GA-PLAN-8 (amended; subject `refuses-a-panel-toggle`), *Causes* | looser | HS15, HS21 |
| Round 11, F4, F5, F8: HS12 names the owner's declaration of learned codes as its condition and cites GA-APPLY-16; HS1 names `set_mode` and `set_setpoint`, and its skip when the codes toggle; HS22's outcome is `skip(dead)` while the desktop sleeps or the session is closed | — (scenarios) | clarified | HS1, HS12, HS22 |

**Carried, from the 0.8 review's Verdict, unresolved and not yet touched by this design:** an
idempotency key for `provision` (also covering `install` and `uninstall`); a transmitter that
answers nothing (HS12, HS15); GA-META-10's token under parallel delegated applies; an open-loop
device's state after a change made around it. These get their own task in the plan for this
revision, not folded into the PC rows above. Their dispositions:

| Item (finding) | Disposition | Ids | Direction | Scenarios |
|---|---|---|---|---|
| An owner's `provision` retry cannot reuse the `request_id` (C1-M9) | **fixed** with the mechanism `apply` already has: `provision` takes an optional `idempotency_key`, scoped to the owner's credential, bodies compared without it, kept 3600 s. The applier keeps, persisted, each key's `requestId` and what came of it (the reply; `accepted` once an `installed`, `install_failed` or `uninstalled` carries that `requestId`; or `unreachable`, updated by a later reply or event), and answers a repeat with the same body from that record, never sending it to a bridge again; a different body is `idempotency_conflict`. By controller ruling, the key rests on the applier's record, not on the bridge's duplicate window: GA-BRIDGE-68's index row now says `install` and `uninstall` duplicates use GA-BRIDGE-4's 10 s window, as its prose did. An owner who wants an `unreachable` first try sent again uses a new key, knowing it may run twice. Optional, so an owner's app written for 0.8 still works; the 0.8 sentence saying the applier re-sends "with the same `request_id`" goes | GA-PROV-3 (new), GA-PERSIST-1 (amended), GA-BRIDGE-68 (row aligned with its prose) | new | HS22 |
| GA-META-10's token under parallel delegated applies (K1-L9: two applies with one token both pass the meta-applier's check before either dispatch records it used) | **fixed** without moving when a token is used: a token is dispatched at most once, even by applies running at once (check and record are one step), and the meta-applier's re-issued `token_id` is derived from the original's `issuer` and `token_id`, so the two delegations are one token at the child, which dispatches it once. The derivation also keeps two clients' tokens that share a `token_id` apart at the child, where both would otherwise carry the meta-applier as `issuer`. Recording the token used at verification, the reader's fix, was not taken: it would use up a token whose step is then found `unreachable`, against GA-TOKEN-4. After the task review, the meta-applier's own check and record are one step as well: it holds the token from verification until the child's outcome, so a second apply is `refused(token)` there, and the derived `token_id` stays as the guard against issuer collision and as defence in depth. The derivation functions, for the re-issued `token_id` as for the meta-applier's idempotency key on the child, are left to the binding | GA-TOKEN-4 (amended), GA-META-10 (amended) | stricter | HS16 |
| A transmitter that answers nothing can never be `up` (K1-M5, S5-F3) | **closed** by the maintainer's ruling of 2026-09-27 (*Ruling 2026-09-27, a silent transmitter*, above and in *Bridge 0.4*); before it, **deferred again**, to the bridge standard, as a ruling. The applier's text is consistent with the bridge's (an open-loop device is `live` only while its transport is `up`), and now says so in *State and liveness* and *What this standard does not define*. The floor stays: liveness rests on an exchange, never on a connect. Making a mute transmitter usable (a bare IR LED, a one-way radio transmitter) means counting something else as its exchange, as a PC's bridge counts its host observation (GA-BRIDGE-37) and a wake relay its gateway's ARP (GA-BRIDGE-55); for a pin or port write that proves nothing about the emitter, which is the case the floor exists to refuse. That is bridge text and needs the maintainer's ruling. Common blasters (Wi-Fi and Zigbee IR blasters) answer on their host link, so HS12 and HS15 are served by those | — | unchanged | HS12, HS15, HS1 |
| An open-loop device's state after a change made around it (HS12's AC changed with its remote; HS15's toggle-coded TV) | **closed** by the maintainer's ruling of 2026-09-27, which chose the third answer's family: the state stays assumed and is never taken as observed, and a toggle waits for a person's yes (*Ruling 2026-09-27, assumed readings* and *toggles*); before it, **deferred again**, with the reason: nothing in the standards observes an open-loop device. A witness judges an action after the fact, never the state before it, and the closed sensor vocabulary has no power or energy key a plug could report a TV's draw with. Every answer is a new mechanism the design has not chosen: an owner-declared state source for an open-loop device (a sensor key the applier reads as its observed state), a power key in the vocabulary, or a ruling that a toggle-coded power action is not offered as `turn_on` and `turn_off`. HS12's assumed state is already said as assumed (GA-BRAIN-7); HS15's TV stays partly. Named in *What this standard does not define* | — | unchanged | HS12, HS15 |

### Steward 0.5

| Change | Ids | Direction | Scenarios |
|---|---|---|---|
| `accounts: { <account>: person id }` on a computer target, set through `define`; a request about a person is translated into `session.lock { account }` through it | GA-DEF-11, GA-STW-11 (new) | new | HS20 |
| `session.lock` is exempt from GA-LEASE-1 and GA-LEASE-3: it takes no lease, and is never refused by one | GA-LEASE-1 (amended), GA-LEASE-3 (amended) | **looser** — ground: candidate list; otherwise a child who locks her own session at 20:55 would hold the laptop against her own limit for two hours, and someone else's lease on it would stop her limit from firing again | HS20 |
| A session in use is occupancy, for computers: `ask(in_use)` when a mapped account reads `active` or `idle`; `ask(in_use_unknown)` when none does but one is `unknown`, absent, `stale`, or the computer has no `session` capability; unmapped accounts (a kiosk) never count. This check replaces the room check, in GA-STW-4's order | GA-OCC-3 (new; GA-OCC-2 is withdrawn), GA-STW-4 (amended) | new | HS21 |
| GA-SCN-4 amended: a scheduled run and a rule's own run both turn `ask(in_use)` or `ask(in_use_unknown)` into a skip, as it already does for `occupancy_unknown` | GA-SCN-4 (amended) | stricter (extends an existing rule to a new case) | HS21 |
| `scenario_status` counts `skipped(in_use)` with `skipped(occupied)` as success, and `skipped(in_use_unknown)` with the failed steps, as it already does for occupancy | GA-SCN-11 (new) | new | HS21 |
| Reads (`state`, `history`, `events`) gain an optional `endpoint` and, from a brain, a `speaker`; a personal key's value is withheld from a derived `guest` role | GA-AUTH-6 (new) | stricter | HS23 |
| Personal keys withheld wherever values appear: in `state`, `history`, `events`, `rule_fired`, and in `plan` and outcome payloads that carry state; not withheld in verdicts (`ask(in_use)`, `skip(already)`); also withheld from a brain's read naming no endpoint. Moved here from the applier's table: the floor is the steward's, since the applier knows no persons and only marks the keys (GA-DESC-9) | GA-AUTH-7 (new) | stricter | HS21, HS23 |
| The steward sets `from` on every `notify` it dispatches (`{ endpoint, role }`, `{ rule }`, `{ scenario }`, `{ notice }`); no caller may set it | GA-NOTE-2 (new) | stricter | HS20 |
| **A caller that sets `from`** (left open by round 5). The steward overwrites a caller-supplied `from`, never trusts it, and records the overwrite in the plan; a meta-applier passes an inbound `from` through unchanged | GA-NOTE-2 (new; the overwrite recorded as `from_replaced`) | stricter | HS20 |
| `internal` devices are left out of selectors and groups (beside `infrastructure` and unadopted devices), and `define` refuses them in rooms and groups | GA-PLAN-6 (amended), GA-DEF-10 (new) | stricter | HS19, HS22 |
| A rule condition may be a time window, `between: { from, until, days }`, in the home's timezone; entering it counts as the condition becoming true | GA-RULE-3 (new) | new | HS20 |
| A state condition may be `not_in: [values]`, true when the key reads none of them (`unknown` and an absent key included) | GA-RULE-4 (new) | new | HS20 |
| A rule whose trigger is conditions only is level-triggered: held for 0 s, it fires when the conditions become true together and again each time they do after being false | GA-RULE-5 (new) | new | HS20 |
| A rule gains `exceptions: [{ from, until }]`; it does not fire inside one, and fires on the exception's end if its condition still holds, as when a lease ends | GA-RULE-6 (new) | new | HS20 |
| Round 1, M6: a `{ rule }` or `{ scenario }` `from` of `brain_authored` work carries `brain_authored: true`, so a brain's standing order is not shown as the house's own message | GA-NOTE-2 (amended) | stricter | HS20 |
| Round 1, M7, F2: an action of a rule of conditions only that ends `failed` or `unreachable` while the conditions hold is fired again, no sooner than its `ack_within_s` after the last try (⚠️ the spacing a guess), until it succeeds or the conditions stop holding; a refusal or a skip is not retried | GA-RULE-7 (new), GA-RULE-5 (amended) | stricter | HS20 |
| Round 1, M12, ruling 5: the steward's *Tiers and confirmation* no longer says a declared tier is never lowered without exception; an extension action from a plugin may be lowered to its floor, as GA-DESC-3 says | — (prose) | clarified | HS22 |
| Round 1, ledger: `from_replaced` gets its row in *Steps*, and the outcomes sentence says an inline request's outcome carries it | GA-NOTE-2 | clarified | HS20 |
| Round 1, L1: `window-on-the-end-day` described as what it does, Saturday evening to Thursday morning | GA-RULE-3 (subject) | clarified | HS20 |
| Round 1, L6: *Personal readings* renamed *Personal keys*, the term the applier and CONTEXT.md use | — (prose) | clarified | HS23 |
| **HS21's `no`** (left open by round 5, no text change). Ольга's `no` to `ask(in_use)` ends `skipped(not_confirmed)`, counted as failed by `scenario_status`, as for any declined ask; the design already records this | — | unchanged | HS21 |
| Round 2, H2: GA-RULE-7 retries only what a retry can fix and cannot double: `skipped(dead)`, `unreachable` and `failed(no_ack)` (three of GA-SAFE-12's classes), only for an action declared idempotent; never another `failed` (`unsupported_action`, `invalid_request`, a device's refusal), a `refused` or another skip, and never `power.shutdown`, `media.launch` or `notify`. A lock the OS refused is no longer retried | GA-RULE-7 (amended; subject `retries-a-shutdown`) | stricter | HS20 |
| Round 2, L6, SH1: the steward's person mapping is `account_persons: { <account>: person id }`, one shape in `define` and `describe`, apart from the applier's `accounts` (`{ <account>: label }`), which `describe` passes through unchanged. Renames the first row's `accounts` | GA-DEF-11 (amended), GA-STW-11 (prose) | clarified | HS20, HS26 |
| Round 2, L4, W8: GA-AUTH-7's "(their `basis`)" dropped: `basis` is `real` or `emulated` and carries no value | GA-AUTH-7 (prose) | clarified | HS21, HS23 |
| Round 2, W1: when no mapped account reads `active`, `idle` or `unknown` (none mapped included), a computer's sleep or shutdown goes on to the room check; the session check adds to it and never removes it, so a kiosk in an occupied room is not put to sleep. Departs from the design's "replaces the room check" on this finding's disposition | GA-OCC-3 (amended; subject `sleeps-the-film`), GA-STW-4 (amended) | stricter | HS21 |
| Round 2, W5: every outcome `apply`, `outcome` and `scenario_status` return carries its `time`, the one on its `outcome` event, so a brain that polls can time GA-BRAIN-17's window | GA-STW-12 (new) | new | HS19 |
| Round 2, H3 follow-up: `ignores-leases` no longer says "since each id has one"; the manifest keeps every subject of an id | — (prose) | clarified | HS20 |
| Round 3, SH1: for `power.sleep` or `power.shutdown` on a computer with `respect_occupancy`, `ask(in_use)` and `ask(in_use_unknown)` are reported in place of `ask(confirm_tier)` (never of `refuse(tier)`), and a `yes` to them is also the step's confirmation, so one question tells the person the PC is in use and confirms the step; a scheduled or rule-started run's `skip` is unchanged | GA-STW-4 (amended; subjects `asks-the-tier-over-the-session`, `asks-the-tier-after-the-session`) | **looser** (corrected in round 4, OM1; first recorded as stricter) — ground: the ask names the use, so a yes to it is an informed yes; one question instead of two | HS21, HS23 |
| Round 3, OH4: for a reader from whom personal values are withheld, a personal key's `state` events are left out of `events` and `history` entirely, not only their values, since their times give a boolean back; a gap in `seq` is said to show only that something was left out | GA-AUTH-7 (amended; subject `times-the-camera`) | stricter | HS23 |
| Round 3, OL1: GA-OCC-3's `in_use_unknown` names the computer as `stale`, not an account's key, since liveness belongs to devices; kept to a computer with an account mapped | GA-OCC-3 (amended) | clarified | HS21 |
| Round 3, OL5: a known gap recorded in *What this standard does not define*: `power.cancel` is `reversible` and GA-RULE-7 never fires `power.shutdown` again, so anyone who may take a `reversible` action, a guest by voice included, may cancel a rule's delayed shutdown; who may cancel is policy | — (prose) | unchanged | HS20, HS23 |
| Round 4, OM1: round 3's SH1 row is recorded **looser**, with its ground: before it, an unanswered `in_use` at dispatch ended the step `skipped(not_confirmed)`; now one yes that names the use both answers it and confirms the step | — (record) | clarified | HS21, HS23 |
| Round 4, OM8: GA-OCC-3's "no `session` capability" needs no mapped account: such a computer is `in_use_unknown` whether or not one is mapped, failing closed, as the design has it; the room check follows only on a computer with a `session` capability | GA-OCC-3 (amended; subject `sleeps-a-sessionless-pc`) | clarified | HS21, HS24 |
| Round 4, OM10: GA-RULE-7's retry comes no later than 300 s after the last try, or the action's `ack_within_s` when that is longer (⚠️ a guess), so a retry once a day no longer conforms | GA-RULE-7 (amended; subject `retries-hours-later`), *Constants* | stricter | HS20 |
| Round 4, OL6: an `if` or `wait` step on a personal key is shown to a reader from whom values are withheld by its verdict only (the branch taken, the `wait` met or timed out); the value read is `withheld` in the plan, the `scenario` event and `scenario_status` | GA-AUTH-7 (amended; subject `shows-the-if-reading`) | clarified | HS23 |
| Round 4, SL1: a known gap recorded beside GA-OCC-3 and in *What this standard does not define*: without `respect_occupancy` no session is consulted, and `power.sleep` is `reversible`, so a direct request may put to sleep a PC in use; who may is policy | — (prose) | unchanged | HS21, HS23 |
| Round 4, OH3, steward half: the steward leaves `from` out of every `notify` while its applier's `describe` reports a `standard_version` below 0.10, which may refuse the unknown argument and leave a notice retried for ever (GA-NOTE-1); from 0.10 on it sets it as before | GA-NOTE-2 (amended; subject `sends-from-to-an-old-applier`) | clarified | HS20 |
| Round 5, OL5: GA-SCN-4 names a rule's own action beside scheduled and rule-started runs, so its `ask(occupancy_unknown)`, `ask(in_use)` or `ask(in_use_unknown)` under `respect_occupancy` becomes the matching skip, not `skipped(not_confirmed)`; *Rules* says a rule's action is a request's, with an optional `respect_occupancy`, as the design's "GA-SCN-4 amended … for rules" has it | GA-SCN-4 (amended; subject `lets-the-rule-ask`) | clarified | HS21 |
| Round 5, SM1: GA-RULE-7 fires again once an idempotent action that ended `unanswered` on a `feedback: open` device, at the same spacing, then no more while the conditions hold, as GA-SAFE-12 sends it once more | GA-RULE-7 (amended; subject `leaves-it-unanswered`) | stricter | HS12, HS20 |
| Round 5, SL4: `define` refuses an `internal` device as a target of a scenario's or a rule's action, not only in a room or a group; a wake relay's entry is reached through its computer's `power.wake` | GA-DEF-10 (amended; subject `rules-a-wake-relay`) | stricter | HS19, HS24 |
| Round 5, OL3, SL2: CONTEXT.md's **Rule** covers rules of conditions only and `exceptions`; **Session helper** and **Administrator** entries added | — (CONTEXT.md) | clarified | HS20, HS22, HS23 |
| Round 6, OH1: GA-STW-2's conflict does not hold between `session.lock` steps on one computer whose `account` differs: each locks another account, as GA-STW-11 resolves a person with two accounts to two steps, and as a rule locking two people's sessions has | GA-STW-2 (amended; subject `conflicts-two-accounts`) | **looser** — ground: GA-STW-11 requires one step per account, which GA-STW-2 then refused, so a person with two accounts could never be locked; steps naming different accounts contend for nothing | HS20 |
| Round 6, OL6 follow-up: *Personal keys* names `app`, `camera_in_use` and `microphone_in_use` personal on every device that reports them, a plugin's device included, as the bridge and applier now do (GA-DESC-9) | — (prose; GA-AUTH-7 carries it) | clarified | HS19, HS23 |
| Round 6, OL7 (CONTEXT), SL2, OL6: CONTEXT.md's **Personal key** says the steward's floor covers a brain's read that names no endpoint, and the three keys on every device that reports them; **Administrator** says "directly or through a group", names Backup Operators and the `docker` group, and points to the bridge's definition | — (CONTEXT.md) | clarified | HS22, HS23 |
| Round 6, WL5: HS2 and HS21 say a declined ask's step, `skipped(not_confirmed)`, is listed among the failed steps (GA-SCN-11) | — (scenarios) | clarified | HS2, HS21 |
| Round 7, WM1: a `yes` to `ask(in_use)` or `ask(in_use_unknown)` also answers the room's `occupancy_unknown` for that step, when planned and at dispatch, so a PC in a room with no sensor sleeps on the one yes instead of ending `skipped(not_confirmed)`; an `occupied` room still skips it. *The confirmation dialogue*'s "not for another reason that arises at dispatch" names this exception. HS21 says so for Артём's desktop | GA-OCC-3, GA-STW-8 (amended; subjects `asks-the-room-after-the-session`, `yes-overrides-the-room`) | **looser** — ground: the person was asked about the PC itself, and GA-OCC-3 puts the session check before the room's, so an unknown room's question after the yes asked nothing new and made the yes void; a room known to be occupied still stops the step | HS21 |
| Round 7, WM2: an action of a rule of conditions only that ends, while the conditions hold, in an outcome neither a success GA-RULE-7 names nor one it fires again for (a lock the OS refused, `failed(not_locked)`; a non-idempotent action that did not land; an `unanswered` one after its further try) raises a notice on `notice_channels`, delivered as GA-NOTE-1's, at most once per action per becoming true; `refused(leased)`, `skipped(occupied)` and `skipped(in_use)` raise none. Replaces "the owner sees the failure as any rule's", which no requirement carried. HS20 says so | GA-RULE-8 (new; subjects `fails-the-limit-silently`, `notices-every-lease`) | stricter | HS20 |
| Round 7, RL4: when a token a computer's `account_persons` maps leaves its `accounts` (retired, the OS account deleted), the steward delivers a notice naming the person, the token and the computer, since the absent key reads `in_use_unknown` and the computer's sleep asks or fails from then on; the mapping is kept | GA-NOTE-3 (new; subject `forgets-a-retired-account`) | stricter | HS20, HS21 |
| Round 7, SM2: `account_persons` on a computer with no `session` capability is kept but inert, nothing read through it until the computer reports `session`; GA-OCC-3 asks `in_use_unknown` there meanwhile | — (prose, *Sessions belong to persons*) | clarified | HS24 |
| Round 7, WL1: a target with no room is `unknown`, failing closed as a room with no sensor does | GA-OCC-1 (amended; subject `vacant-without-a-room`) | clarified | HS20, HS21 |
| Round 7, SM3: CONTEXT.md's **Session helper** is believed for `active` and `idle` only, never about a lock, a disconnection or a logout | — (CONTEXT.md) | clarified | HS20 |
| Round 7, WL2: HS19's launch hop says Дмитрий is a guest at the living-room satellite, and the launch passes because Kodi's manifest requests no tier above `reversible`; one requesting `confirm` would make it `refuse(role)` for him there | — (scenarios) | clarified | HS19 |
| Round 7, WL3: HS22 says the copied code may run until the server's next start, since pinning detects a changed package and is not a sandbox | — (scenarios) | clarified | HS22 |
| Round 7, RH1 follow-up: no text in CONTEXT.md, the steward, the brain or the scenarios quotes a plugin `stableIdentifier` in the old `<plugin id>/<key>` form, so nothing there changes | — | unchanged | HS19, HS22 |
| Round 8, M3 and WL4, steward half: `not_in`, and every other condition, on a `session.<token>` key retired from the computer's `accounts` reads false, not true, so a rule on a retired account stops firing instead of retrying every 300 s all night; GA-RULE-4's `unknown` reading stays true | GA-RULE-4 (amended; subject `fires-on-a-retired-token`) | stricter | HS20 |
| Round 8, WL1: HS20's Modern Standby branch: Windows locks the session on standby too, so `session.liza` there also reads `locked`, and the rule fires at 21:00 only if her session then reads `active`, `idle` or `unknown`, otherwise waiting for her to sign in, as for a laptop that sleeps | — (scenarios) | clarified | HS20 |
| Round 8, WL2: HS21's Modern Standby laptop, staying `live` with every mapped session `locked`, goes to the room check (GA-OCC-3); its `room` is null, so it reads `unknown` (GA-OCC-1), joining `ask(occupancy_unknown)` instead of reading «не отвечает» | — (scenarios) | clarified | HS20, HS21 |
| Round 8, WL3: HS20's routing of «ещё полчасика» to Ольга as a `notify`, rather than another response, is the brain's own judgement, ungraded (GA-BRAIN-7), as HS25's «я не могу» is | — (scenarios) | clarified | HS20, HS25 |
| Round 9, O-L4: the 0.5 changelog says the steward sets `from` on a `notify` to an applier of 0.10 or later, as the text and GA-NOTE-2 do, not 0.9 | — (changelog) | clarified | HS23 |
| Round 9, O-L5: an outcome of the steward's own (`skipped(not_confirmed)`, its own `refused(…)` and `skipped(…)`) has no `outcome` event, and carries as its `time` the moment the steward decided it | GA-STW-12 (amended) | clarified | HS19 |
| Round 9, M2, steward half: a `failed(not_locked)` raises GA-RULE-8's notice only once the lock's `ack_within_s` from its dispatch passes with no `late_ack`; a `late_ack` is a success, so a lock the OS finishes late is not reported as a failed limit | GA-RULE-8 (amended; subject `notices-a-slow-lock`) | stricter | HS20 |
| Round 9, H1, steward half: no change; the steward passes `other_admins` through and neither names other admins nor checks `accepts_other_admins`, which are the applier's | — | unchanged | HS19, HS23 |
| Round 9, WL2: HS19's *Trust and guardrails* marks as ⚠️ a bench and installation check that the mini-PC's network card keeps Wake-on-LAN armed through a suspend | — (scenarios) | clarified | HS19 |
| Round 9, WL4: HS22's *What we want* says the launch from Артём's app works only while the desktop is awake and his session open (GA-BRIDGE-49), since the desktop has no wake path | — (scenarios) | clarified | HS22 |
| Ruling 2026-09-27, toggles: the applier's `refuse(toggle_only)` is reported last in the order, as `ask(toggle_only)`, never as a refusal, and inline as `refused(toggle_only)`; a yes to it, or to an ask reported in its place, earns the step's token; in authored work it is `skip(toggle_only)`, whatever the tier, since an author's confirmation never answers a toggle; `scenario_status` lists `skipped(toggle_only)` as failed | GA-STW-4 (amended; subject `refuses-the-toggle`), GA-SCN-4 (amended; subject `authors-a-toggle`), GA-SCN-11 (amended; subject `passes-a-skipped-toggle`) | new | HS15 |
| Ruling 2026-09-27, assumed readings: no condition the steward evaluates holds on an `assumed` value: a rule's trigger or conditions, an `if` (taken as on a target that is not live, `skipped(stale)` without an `else`), a `wait` (runs to its timeout) | GA-RULE-2 (amended; subject `rule-on-an-assumed-value`), GA-SCN-8 (amended; subject `branches-on-an-assumed-value`) | stricter | HS12 |
| Ruling 2026-09-27, the held limit notice: GA-RULE-8's notice for a `failed(no_ack)`, which reaches it only for an action that is not idempotent, waits until the 60 s late-ack window of GA-APPLY-11 closes, and is sent only if no `late_ack` came; a `late_ack` is a success, as for `failed(not_locked)` since round 9 | GA-RULE-8 (amended; subject `notices-a-late-launch`) | **looser** — ground: the maintainer's ruling. The owner hears of a real failure up to 60 s later, and of an action that landed late not at all. Measured by the implementation's duty it is stricter, as round 9's twin row for `failed(not_locked)` counted it | HS20 |
| Round 10, O-H2, F3: `ask(toggle_only)` is always asked in its own words, reported in place of any `ask(confirm_tier)`, `ask(in_use)`, `ask(in_use_unknown)` or `ask(occupancy_unknown)` the step would have, never folded into them; a yes to it answers those too, and a yes to any other ask never lifts it. Who may answer stays as for any ask, with no rule about the room, since HS15's person may be across the room from the endpoint; the question, not the room, says what she answers. The reader's fix (an endpoint in the device's room, or the owner's acceptance) was not taken | GA-STW-4 (amended; subject `folds-the-toggle-into-the-tier`), *The confirmation dialogue* (*How long*) | stricter | HS15 |
| Round 10, O-M2, steward half: GA-SCN-4's `skip(toggle_only)` says the applier takes an authored token as none for a toggle | GA-SCN-4 (prose) | clarified | HS15 |
| Round 10, SH2: a `failed(not_locked)` reported less than 5 s after the lock's dispatch is the ack for an account with no graphical session, since the bridge waits 5 s for a graphical session's screen locker, and raises GA-RULE-8's notice at once: nothing will late-ack it | GA-RULE-8 (amended; subject `holds-an-ssh-only-lock`) | stricter | HS20 |
| Round 10, O-L1: GA-RULE-8's held notice waits its window plus a late-ack slack, 11 s as the applier's `fresh_slack_s` (⚠️ a guess), so a late ack in flight is not a failure; a held notice survives a restart | GA-RULE-8 (amended; subject `notices-a-slow-late-ack`), GA-PERSIST-2 (amended; subject `forgets-a-held-notice`), *Constants* | stricter for the restart; the slack delays a real failure's notice up to 11 s, **looser** — ground: the ruling of 2026-09-27's own, a late ack is a success | HS20 |
| Round 10, O-L3: `skipped(toggle_only)` raises no GA-RULE-8 notice; `define` gives one notice for a rule acting on an action declared `toggles: true`, when it defines it and when such an action comes into its selector, since the rule will never run it | GA-RULE-8 (amended; subjects `notices-every-skipped-toggle`, `defines-a-toggle-rule-silently`) | stricter at `define`, one notice in place of one per firing | HS15 |
| Round 10, F4: the flat's inventory has the living-room TV on the AC's IR blaster, its power code a toggle, and HS19 says the brain leaves it to Дмитрий, since it would need `ask(toggle_only)` | — (scenarios) | clarified | HS15, HS19 |
| Round 10, scenarios: HS15 and HS17 re-verdicted after the fixes, both ✅ as designed; HS17 fell in the walk only through `onoff.toggle` | — (scenarios) | clarified | HS15, HS17 |
| Round 11, O-L1, F6: GA-STW-4's item 5 no longer names the toggle, which item 9 alone governs | GA-STW-4 (prose) | clarified | HS15 |
| Round 11, O-M4: a yes to `ask(toggle_only)` in a person-started run stands for `ask_expiry_s` after it was given; a toggle step dispatched later is asked again, the run waiting on the answer, and `skipped(not_confirmed)` without one | GA-SCN-3 (amended; subject `toggles-on-an-old-yes`) | stricter | HS15, HS21 |
| Round 11, O-M5: round 10's O-H2 fix recorded as looser than the ruling's wording, "the person, who can see the device, says yes": whoever may answer any ask answers the toggle (GA-CONF-1), a brain's spoken yes or an app away from home included. Ground: the person answering is responsible for the answer, on a question that says the state is not known, and HS15's person may stand across the room from the endpoint that heard her. No text change | GA-STW-4 (round 10) | looser | HS15 |
| Round 11, O-M6, steward half: GA-RULE-8 raises the notice at once on `failed(no_graphical_session)`, and no longer infers that case from a `failed(not_locked)` sooner than 5 s | GA-RULE-8 (amended; subjects `holds-an-ssh-only-lock` amended, `times-the-lock`) | clarified | HS20 |
| Round 11, O-M9, F3: the toggle notice also at `define` of a schedule whose scenario, or one its `run` steps reach, acts on a toggle, and when a declaration change makes an action a rule or schedule names one | GA-RULE-8 (amended; subjects `schedules-a-toggle-silently`, `re-declares-a-toggle-silently`) | stricter | HS1 |
| Round 11, O-L3: the late-ack slack adds the applier's 6 s for each meta-applier hop | *Constants* | clarified | HS20 |
| Round 11, O-L5, steward half: the outcome list names the steward's `toggle_only` and `assumed` skips | *Apply* | clarified | HS15 |
| Round 11, O-L7: a held notice is raised even if the rule's conditions stop holding during the wait, since the limit failed while it applied | GA-RULE-8 (amended; subject `drops-a-held-notice`) | stricter | HS20 |
| Round 11, SM1: an `if` on an assumed value with no `else` ends `skipped(assumed)`, not `skipped(stale)`, so a standing fact about a device reads apart from a transient one | GA-SCN-8 (amended; subject `stales-an-assumed-if`), GA-RULE-2 (prose) | clarified | HS1, HS12 |
| Round 11, F2, steward half: a run's cause carries the endpoint it was started from | GA-SCN-3 (amended; subject `drops-the-starting-endpoint`), *Causes and history* | stricter | HS15, HS21 |
| Round 11, R1, steward half: the toggle notice names open-loop devices | GA-RULE-8 (prose) | clarified | HS15 |
| Round 11, SL1, SL2, O-L5: `CONTEXT.md` drops "plugin" from Adapter's avoid-list and adds Host, Computer, Open loop, Assumed reading and Toggle code | — (`CONTEXT.md`) | clarified | HS12, HS19–HS24 |

### Brain 0.4

| Change | Ids | Direction | Scenarios |
|---|---|---|---|
| GA-BRAIN-4 extends to `state`, `history` and `events`: a brain MUST name only an endpoint where the utterance it serves was heard; a read serving no utterance (a long `events` stream) names no endpoint and carries no personal values | GA-BRAIN-4 (amended) | stricter | HS23 |
| A brain MUST speak a personal value only in reply to the utterance whose read returned it (judged) | new | stricter | HS23 |
| GA-BRAIN-17 and GA-BRAIN-3 amended: after a `power.wake`'s `acked` outcome made for an utterance, the brain may make one further write for that utterance — on the woken computer or a device it hosts — within the utterance lifetime of the outcome's own timestamp; that write earns no further exception | GA-BRAIN-17 (amended), GA-BRAIN-3 (amended) | **looser** — ground: candidate list; a wake can take longer than an utterance's 60 s lifetime, and without this a brain could never finish HS19's launch after a slow wake | HS19 |
| The reply about a shutdown with `delay_s` says whoever sits at the PC can cancel it (judged); the reply names the `title` the device reported | new | new | HS19, HS23 |
| Round 1, M5: a `title` the steward withheld as a personal key is not said; the reply says something launched, not what. Declaring a player's keys personal by standard is deferred: who may read what is policy, left to implementations by the design | GA-BRAIN-19 (amended) | **looser** — ground: a withheld value never reaches the brain (GA-AUTH-7), so the MUST could not be met for a guest, and saying it would break GA-BRAIN-18 | HS19, HS23 |
| Round 1, F8: a read that serves no utterance is "a `history` lookup made for no utterance (an unprompted follow-up)", since an explanation asked for is an answer | GA-BRAIN-4 (prose) | clarified | HS3, HS23 |
| Round 2, L5: the personal floor the steward enforces holds for reads that name no endpoint; for a read naming one it rests on the endpoint and speaker the brain asserts (GA-BRAIN-4, GA-BRAIN-11) | GA-BRAIN-4 (prose) | clarified | HS23 |
| Round 2, L8: the delayed-shutdown reply says who may cancel as the steward allows (at the PC, and through the house by whoever may take `power.cancel`, by default anyone), not "at the PC" only | GA-BRAIN-19 (amended) | stricter | HS23 |
| Round 2, M7: the brain corpus includes HS19 and HS23, for GA-BRAIN-4, 17, 18, 19 and `acts-on-stale` | — (*Conformance*) | stricter | HS19, HS23 |
| Round 2, W5: GA-BRAIN-17's window runs from the outcome's `time`, the same in `outcome`, `apply` and the `outcome` event (GA-STW-12) | GA-BRAIN-17 (prose) | clarified | HS19 |
| Round 2, W4: HS25's reply that the brain cannot book the doctor is ungraded judgement: GA-BRAIN-7 governs outcomes and verdicts, GA-BRAIN-12 failures and refusals, and under-serving is not graded | — (scenarios) | clarified | HS25 |
| Round 2, W6: HS20's notify reads «В прихожей просят ещё 30 минут»: the hall satellite gives no hint, so the brain names nobody (as GA-BRAIN-11 does for `speaker`) | — (scenarios) | clarified | HS20 |
| Round 2, W7: HS26's utterance is heard at the hall satellite, one the flat has | — (scenarios) | clarified | HS26 |
| Round 4, OL5: GA-BRAIN-17's one further write after a wake is an `apply`, of a request or a plan, every step of which is on the woken computer or a device it hosts; never a `scenario_run` or a `define`, whose reach is not bound to the computer | GA-BRAIN-17 (amended; subject `runs-a-scene-after-a-wake`) | stricter | HS19 |
| Round 4, F7: *The flat* states each satellite's hints: the hall satellite gives one for Ольга's and Дмитрий's enrolled voices, the living-room satellite for Ольга's, neither for the children's. HS20 says Лиза's voice gets none, and HS23 that the hint names Дмитрий, as HS26 has it. The living-room clause also squares HS1 with HS14 | — (scenarios) | clarified | HS1, HS14, HS20, HS23, HS26 |
| Round 5, F1: a `media.launch` the brain said was under way that settles `acked` is spoken of again, as a contradiction is, within the failure bound of the event that carried it, and that follow-up gives the reported `title` (or says something launched, if it is withheld), since a plugin's launch may ack after the reply GA-BRAIN-8 owes. HS19's brain hop says so | GA-BRAIN-15 (amended; subject `forgets-the-title`), GA-BRAIN-19 (amended) | stricter | HS19 |
| Round 5, F5: HS20's reply to Лиза is «Передала взрослым», since the brain does not know who asked, and so whose mother to name | — (scenarios) | clarified | HS20 |
| Round 6, WL4: a follow-up GA-BRAIN-15 owes serves the utterance it follows up, so a read made for it names that utterance's endpoint; the example of a read serving no utterance is an unprompted remark, not a follow-up | GA-BRAIN-4 (amended) | clarified | HS19 |
| Round 6, WL1: *The house*'s *Hubs* row names the three satellites and their hints: each gives one for Сергей's and Наталья's enrolled voices, none for Валентина Петровна's or a guest's, so the kitchen's hints Сергей (HS24) and Наталья (HS16, HS25) | — (scenarios) | clarified | HS16, HS24, HS25 |
| Round 9, M2, brain half: a `late_ack` after `failed(not_locked)` settles the step anew, as after `failed(no_ack)` | GA-BRAIN-15 (prose) | clarified | HS20 |
| Ruling 2026-09-27, assumed readings: an `assumed` value is said as what was last sent, never as what the device is | GA-BRAIN-7 (amended) | stricter | HS12 |
| Ruling 2026-09-27, toggles: a brain requests `onoff.toggle` only when a person asks for the button itself, never to reach a state, so it cannot press the button to dodge `ask(toggle_only)` (judged, no negative subject, as the brain's other judged ids); withdrawn in round 10 | GA-BRAIN-20 (new) | new | HS15 |
| Round 10, B1, F1, O-M1, brain half: GA-BRAIN-20 withdrawn, since it covered only the button action, which left the vocabulary; *The button* says no action presses a button, and a request for the button is `ask(toggle_only)` like any other | GA-BRAIN-20 (withdrawn), *Refusals* (prose) | clarified: the MUST had nothing left to govern | HS15 |
| Round 10, O-H2, F3, brain half: a question for `ask(toggle_only)` says that the device's code toggles and that its real state is not known | GA-BRAIN-7 (amended) | stricter | HS15 |
| Round 10, F5: HS15's brain applies the lights on a plan without the TV step and puts the TV on a plan of its own, asking before applying it, so no step it applied is left `skipped(not_confirmed)` (GA-BRAIN-6) | — (scenarios) | clarified | HS15 |
| Round 11, O-L6: «нажми кнопку питания» on a toggle-coded TV is the action opposite its assumed state, so the assumed state follows the press; `turn_on` and `turn_off` on one toggling code are one action under GA-BRAIN-6 | GA-BRAIN-21 (new; subject `presses-toward-the-assumed-state`), GA-BRAIN-6 (amended; subject `presses-after-a-no`) | new | HS15 |
| Round 11, F7: a plan whose question the brain already spoke in its reply to the utterance needs no second spoken reply when it expires, so the satellite does not speak into a dark room; HS15 states the case | GA-BRAIN-12 (amended) | looser | HS15 |

## Carried forward

- **From the 0.8 review's Verdict, disposed in applier 0.10** (*Applier 0.10*, the table after the
  PC rows): the `provision` key and GA-META-10's token fixed; a transmitter that answers nothing
  deferred to the bridge standard as a ruling for the maintainer; an open-loop device's state after a
  change made around it deferred to a design that chooses how such a device is observed. HS12's
  and HS15's lines that say "deferred to applier 0.9" are to be re-pointed when the scenarios are
  regraded. Both closed by the maintainer's ruling of 2026-09-27 (*Rulings of 2026-09-27*); HS12's
  and HS15's hops now cite the new text, each with a verdict line, the grades table awaiting the
  regrade.
- **To measurement**, unchanged since the 0.8 review: GA-CONF-2's clock tolerance; the bound on a
  commission's end; every constant marked ⚠️ there (GA-SAFE-10's grace and window, the grant
  withdrawal, the box reach and reply times). Added by this revision (round 3, OL4), each marked ⚠️
  in its standard's *Constants*: an `install` ending within 600 s (GA-BRIDGE-68); a plugin's
  `cadenceMs` at most 300 000 ms (GA-BRIDGE-68); `activate` re-sent at least every 60 s
  (GA-ADOPT-4); the clock step awaited on resume, at most 10 s (GA-BRIDGE-59); a plugin server
  probed at least every 10 s, and answering within 10 s once it has served (GA-BRIDGE-58); a
  server's start bound, 120 s (GA-BRIDGE-58); a plugin device read within 10 s after a start or a
  resume (GA-BRIDGE-60); a PC's administrators re-read at least every 24 h (GA-BRIDGE-53); and the
  rule retry spacing (GA-RULE-7). Added by round 4: a plugin server's restart backoff at most 300 s
  (GA-BRIDGE-58); a failed plugin state read after a start or a resume tried again at least every
  10 s (GA-BRIDGE-60); a rule's retry at most 300 s after the last, or its `ack_within_s` when
  longer (GA-RULE-7). Added by round 5: `power.wake`'s default `ack_within_s`, 240 s
  (GA-APPLY-13); a plugin device read within 1 s of a successful tool call (GA-BRIDGE-51). Added
  by round 6: a session reported locked within 5 s of a `session.lock` (GA-BRIDGE-66); and, missing
  until round 6's OL4 check, a wake relay's gateway answering ARP within the last 30 s, asked at
  least every 10 s (GA-BRIDGE-55), and a plugin server's restart backoff reaching a ceiling of at
  least 60 s within 180 s (GA-BRIDGE-58, borrowed from GA-BRIDGE-11). That check found every
  constant its reader named (GA-BRIDGE-68, 51, 58, 59 and 60, GA-APPLY-13's 240 s, GA-ADOPT-4's
  60 s, GA-RULE-7's 300 s) already listed. Added by round 7: a plugin server's failed starts before
  a `faults` entry, 5 in a row (GA-BRIDGE-58). Added by round 8: a plugin device published
  `available: true` within 1 s of its server having served (GA-BRIDGE-58).
- **Not read after its fix.** The 0.8 review's round 6 dispositions were taken by the maintainer without a
  further read (ground: removals carry little risk, and the text had been stable for several
  rounds). This review of bridge 0.4, applier 0.10, steward 0.5 and brain 0.4 starts there: its
  first pass reads the current text, round 6's dispositions included, as the ground truth, not as
  already-verified fixes.

## Readers, first round

Both readers got the review procedure's reader prompt with the four standards and this
record. The third-model reader could not run: the subscription's weekly quota and the office key's 5-hour quota were
both spent (HTTP 403). The second reader is therefore a Sonnet subagent, another model than the
Opus reader; the maintainer then ruled to skip the third-model reader for this review.

**A no-context subagent** (Claude Opus), 23 findings, 0 blocker, 4 high, 13 medium, 6 low:
- H1 high: GA-APPLY-8 read so that every wake ends `failed(no_ack)` once the relay acks.
- H2 high: a plugin reinstall is undefined, and an uninstall and reinstall reuse ids.
- H3 high: GA-DESC-11 also drops a tier the owner raised; the record called it stricter.
- H4 high: the record said the applier refuses a `notify` without `from`; GA-APPLY-14 accepts one.
- M1 nothing adds `power.wake`; M2 a replacement's declarations contradict; M3 the pin rests on the
  plugin's own `list_changed`, and the runtime is unpinned; M4 the publisher decides `selfChanging`
  and `personal`; M5 a player's `title` is not personal, and GA-BRAIN-19 could not be met for a guest;
  M6 a brain-written rule's `notify` looks like the house's; M7 HS20's lock never fires again after
  it fails; M8 an adapter's computer is live with no time bound; M9 a sleep can suspend before its
  ack; M10 Windows tokens collide on the RID; M11 an install has no time bound; M12 GA-BRIDGE-56 has
  no grader, ruling 5 provisional, the steward says a tier is never lowered; M13 administrator
  accounts may run plugins, unrecorded looser.
- L1 `window-on-the-end-day` misdescribed; L2 no manifest field for a session; L3 amendments without
  negative subjects, GA-BRIDGE-48's Verify; L4 a vacuous "not a `bridge_fault`"; L5 an unexplained
  product precedent; L6 two terms for personal keys, a `faults` entry naming one device.

**A no-context subagent** (Claude Sonnet), 8 findings, 0 blocker, 2 high, 4 medium, 2 low:
- S1 high: a plugin app's own network control has no manifest field and no negative subject.
- S2 high: a plugin's `confirms` and `confirmedBy` are the publisher's word, unlike protocol truth.
- S3 two plugin tier formulas are easy to cross-apply; S4 as M4; S5 a PC's administrators have no
  periodic re-read; S6 the idle threshold is a "default" nobody can set.
- S7 low: staged matching on a self-declared id, beside the open signing question; S8 low:
  CONTEXT.md's liveness words read as contradicting the bridge's `status.state`.

## Scenario walk, first round

A third subagent, given the review procedure's scenario prompt. HS1–HS18 keep their grades.
HS19–HS25 drive as designed (HS20 while online; HS23 within scope); HS24 moves from ⚠️ to ✅; HS26
cannot, not designed. 20 as designed, 5 partly, 1 cannot. Findings:
- F1 medium: which manifest the live tools are compared with; GA-BRIDGE-31 keeps neither it nor the
  file hashes. F2 medium: as M7.
- F3 HS19's reply claims a season and episode the record lacks; F4 HS21's asleep laptop is a failed
  step; F5 HS22's "after a yes the first time"; F6 an adapter's `delivered`; F7 as H4; F8
  GA-BRAIN-4's "to explain a change" catches HS3; F9 residual risks in HS13 and HS15 (observation);
  F10 Modern Standby may announce no suspend (bench).

## Dispositions, first round

Fixes: `e19242f` (bridge and applier), `1403e41` (steward, brain, CONTEXT.md, scenarios, guide),
`2bb7658` (the design's ruling 5 marks). Each fix's row is in the tables above, named by round and
finding.

| Findings | Disposition |
|---|---|
| H1, H2, H3, M1, M2, M3, M4, M9, M10, M11, L2, L3, L4, L5, S1, S2, S3, S4, S5, S6, S7, F1, F6, F10 | fixed, `e19242f` |
| M8, M13 | fixed as looser rows with their ground, `e19242f` |
| L6 | fixed, `e19242f` (faults) and `1403e41` (the term) |
| H4, F7 | fixed, the row corrected, `1403e41` |
| M6, M7, F2, L1, S8, F3, F4, F5, F8, F9 | fixed, `1403e41` |
| M12 | fixed: GA-BRIDGE-56's grader `e19242f`; ruling 5 confirmed by the maintainer 2026-09-25, marks removed `1403e41`, `2bb7658`; the steward's "never lowered" `1403e41` |
| M5 | fixed in part, `1403e41` (GA-BRAIN-19 says nothing withheld); deferred in part: declaring a player's keys personal is policy the design leaves to implementations |
| Deferred minors from the task reviews | fixed, `1403e41` (`from_replaced` row, the guide's `windowMs` and wake hop, the GA-EVT-6 row) |
| Persona names in bridge and steward examples | deferred to the step 0 public-readiness check, before the repository goes public |

**The maintainer, 2026-09-25:** ruling 5 confirmed: extension actions default to `confirm`, and the owner may
lower one down to the plugin's floor, never below.

## Readers, second round

The same prompt, the four standards and this record, fresh subagents. The third-model reader was skipped by the maintainer's
ruling.

**Claude Opus**, 19 findings, 0 blocker, 3 high, 8 medium, 8 low:
- H1 high: a hosted plugin device's `available: false` before its server starts acks a wake, so
  HS19's launch fails after a cold boot.
- H2 high: GA-RULE-7 re-fires non-idempotent actions after `failed(no_ack)` and final failures for
  ever.
- H3 high: the manifests keep one negative subject per id, so the revision's new subjects for
  amended ids are in no manifest.
- M1 a staged activation drops a plugin's siblings; M2 a lost `activate` is never re-sent while the
  bridge stays live; M3 a lost `uninstalled` resurrects devices; M4 a plugin server that exits or
  hangs is undefined; M5 an uninstall's effects have no id; M6 privilege checks graded against a
  scripted OS; M7 no PC case in the brain corpus; M8 the publisher's `cadenceMs` sets the liveness
  bound, unrecorded looser.
- L1 `wake_via` across children; L2 an unknown `account`, a reinstall's `account`; L3 extension key
  schemas not scalar; L4 GA-AUTH-7 names `basis`; L5 brain.md overclaims the personal floor; L6
  `accounts` has three shapes; L7 a resumed PC's clock fails a wake; L8 any guest can cancel a
  shutdown, unlike the reply's "at the PC".

**Claude Sonnet**, 6 findings, 0 blocker, 2 high, 3 medium, 1 low:
- SH1 high: as L6. SH2 high: a replacement's narrower manifest drops a `personal` or `selfChanging`
  declaration, against GA-DESC-9; the record called it clarified.
- SM1, SM2 as L2; SM3 `needsSession`'s "has a session" is not tied to `session.<account>`'s
  values. SL1 a person's own shutdown or sleep at the PC is not named as the computer's own
  behaviour.

## Scenario walk, second round

No grade moved: 20 as designed, 5 partly, 1 cannot. 0 blocker, 0 high, 2 medium, 7 low:
- W1 medium: under GA-OCC-3 a kiosk's film in an occupied room is put to sleep by «Мы ушли».
- W2 medium: GA-DESC-11 compares tool hashes the applier never keeps.
- W3 HS22's hand-copied files run until the next start; W4 HS25's reply rests on no MUST; W5 the
  `outcome` operation carries no time for GA-BRAIN-17's window; W6 HS20's notify names a person
  nobody identified; W7 HS26's satellite does not exist; W8 as L4; W9 the grades table's columns
  are stale.

## Dispositions, second round

Fixes: `9cbf58e` (the manifest tool), `2b98d6d` (bridge and applier), `d582ef5` (a type annotation),
`7029734` (steward, brain, scenarios), `decd9a4` (the design's note on W1). Each fix's row is in the
tables above, named "Round 2".

| Findings | Disposition |
|---|---|
| H3 | fixed, `9cbf58e`: the manifests keep every negative subject of an id; 15 ids regained subjects |
| H1, M1, M2, M3, M4, M5, M6, M8, L1, L2, L3, L7, SM1, SM2, SM3, SL1, SH2, W2 | fixed, `2b98d6d` (new GA-BRIDGE-58, GA-BRIDGE-59) |
| L6, SH1 | fixed, `2b98d6d` (bridge and applier `accounts`) and `7029734` (the steward's `account_persons`) |
| H2, L4, W8, L5, L8, M7, W3, W4, W5, W6, W7 | fixed, `7029734` (W5 as GA-STW-12) |
| W1 | fixed, `7029734` and `decd9a4`: the room check still applies when no mapped account says the PC is in use or unknown; a departure from the design's "replaces", recorded there; stricter |
| W9 | deferred to the version bump, when the grades table is regraded against the new versions |

Rulings: GA-BRIDGE-58's `available: false` for a server that exits or fails a `ping` is a fact the
bridge observed (ruling 14), not silence; a device's own refusal is final and not retried by
GA-RULE-7.

## Readers, third round

The same prompt, the four standards and this record, fresh subagents; no third-model reader, by the maintainer's
ruling.

**Claude Opus**, 18 findings, 0 blocker, 4 high, 8 medium, 6 low:
- OH1 high: a wake acks on a hosted device's check-in from before the computer died. OH2 high:
  GA-BRIDGE-58's 10 s answer clause contradicts "never unavailable while starting". OH3 high:
  `brain_authored` in `from` is in no wire shape, so such a `notify` is refused. OH4 high: the
  personal floor withholds values but sends the events, and a boolean's events give it back.
- OM1 the staged exemption is unchecked; OM2 a dropped entry read as uninstalled, and a lost
  `uninstalled` resurrects an adoption; OM3 the plugin's own account is an unlisted other admin;
  OM4 nothing authenticates the session helper; OM5 a reinstall binds the manifest, not the package
  (looser, unrecorded); OM6 showing `from` is opt-in; OM7 the record says the token is never the OS
  name, the text uses it; OM8 the `ping` timing is unset.
- OL1 GA-OCC-3 says a key is `stale`; OL2 two behaviours with no id; OL3 clauses without negative
  subjects; OL4 guessed constants gate passes; OL5 any guest may cancel a rule's delayed shutdown;
  OL6 persona names and a person's name in changelog rows.

**Claude Sonnet**, 4 findings, 0 blocker, 1 high, 2 medium, 1 low:
- SH1 high: GA-STW-4 reports `ask(confirm_tier)` before `ask(in_use)`, so a shutdown's ask never says
  the PC is in use.
- SM1 a load or `infrastructure` change does not re-clamp a stored tier; SM2 a crashing plugin server
  ends a wake early with the same signal as a definite answer; SL1 no negative subject for a demoted
  administrator.

## Scenario walk, third round

No grade moved: 20 as designed, 5 partly, 1 cannot. 0 blocker, 0 high, 1 medium, 3 low:
- WM1 medium: after a resume the bridge reads a plugin's state only at `cadenceMs`, so a wake with a
  slow cadence always fails.
- WL1 an adoption that lowers a tier in the same change set raises no `other_admin` notice; WL2 HS19
  says the Kodi server starts on a resume; WL3 the grades table is stale (as W9).

## Dispositions, third round

Fixes: `66dea89` (bridge and applier; new GA-BRIDGE-60 to 63, GA-DESC-13), `19b36d6` (steward,
scenarios, this record). Each fix's row is in the tables above, named "Round 3".

| Findings | Disposition |
|---|---|
| OH1, WM1, OH2, SM2, OH3, OM1, OM2, OM3, OM4, OM5, OM6, OM8, OL2, OL3, SM1, SL1, WL1 | fixed, `66dea89` |
| SH1, OH4, OL1, OL5, OM7, WL2 | fixed, `19b36d6` |
| OL4 | fixed as a record line, `19b36d6`: this revision's ⚠️ constants are listed under *To measurement* |
| OL6 | deferred to the step 0 public-readiness check |
| WL3 | deferred to the version bump, as W9 |

Rulings: for a computer's sleep or shutdown with `respect_occupancy`, `ask(in_use)` comes before
`ask(confirm_tier)` and a yes to it is the step's confirmation (SH1). Left as they were, and named for
the next readers: a room's occupancy is still reported after `ask(confirm_tier)`, as before this
revision; a `rule_fired` event's time still shows a guest when a rule on a personal key fired, with
its values withheld.

## Readers, fourth round

The same prompt, the four standards and this record, fresh subagents; no third-model reader, by the maintainer's
ruling.

**Claude Opus**, 23 findings, 0 blocker, 4 high, 12 medium, 7 low:
- OH1 high: a plugin device's state resource is undefined (URI, content, notification). OH2 high: a
  staged swap never ends the old version's activation, so a restart brings it back. OH3 high: `from`
  reaches 0.8 appliers and children that may refuse it. OH4 high: nothing keeps the PC bridge's broker
  credential or helper endpoint from non-administrators.
- OM1 round 3's SH1 is looser, recorded stricter; OM2 a failed new version still evicts the old; OM3
  reused uids inherit tokens; OM4 any session's helper sets computer-wide personal keys; OM5 a plugin
  extension on a lock class can fall to `reversible`; OM6 the id characters have no MUST; OM7
  GA-BRIDGE-38's fields undefined for plugin devices; OM8 GA-OCC-3's "no `session` capability" clause
  ambiguous; OM9 Host claimable without the real-OS run; OM10 retry bounds are lower bounds only;
  OM11 a computer carrying the broker is `infrastructure` only by the owner's flag; OM12 remote
  sessions and Linux administrators undefined.
- OL1 a logout never acks a lock; OL2 `delay_s` rounding; OL3 replies for an unknown plugin or host;
  OL4 the changelog omits GA-ADOPT-3; OL5 GA-BRAIN-17's further write undefined for runs and
  `define`; OL6 an `if` or `wait` on a personal key shows its value; OL7 a group's token can collide
  with a uid's.

**Claude Sonnet**, 3 findings, 0 blocker, 1 high, 1 medium, 1 low:
- SH1 high: a bridge restart during an `install` loses it, with no terminal event.
- SM1 *Commands* does not list a starting server as a cause of `failed(unreachable)`; SL1 without
  `respect_occupancy` a direct request may sleep a PC in use.

## Scenario walk, fourth round

No grade moved: 20 as designed, 5 partly, 1 cannot. 0 blocker, 0 high, 1 medium, 7 low:
- F1 medium: GA-BRIDGE-60 asks for one read after a resume, not one that succeeds.
- F2 HS20's lock reads `disconnected` on Windows; F3 HS24 cites GA-META-2; F4 HS24's adapter cannot
  offer Wake-on-LAN; F5 a Steam launch slower than 10 s; F6 GA-BRIDGE-58's clock across a suspend;
  F7 the hall satellite's hints; F8 the grades table (as W9).

## Dispositions, fourth round

Fixes: `b1f3577` (bridge and applier; new GA-BRIDGE-64, GA-BRIDGE-65), `d7205b9` (steward, brain,
scenarios, the bridge's MCP wording), and the design's note on F4. Each fix's row is in the tables
above, named "Round 4".

| Findings | Disposition |
|---|---|
| OH1, OH2, OH4, OM2, OM3, OM4, OM5, OM6, OM7, OM9, OM11, OM12, OL1, OL2, OL3, OL4, OL7, SH1, SM1, F1, F6 | fixed, `b1f3577` |
| OH3, OM10 | fixed, `b1f3577` (applier, bridge) and `d7205b9` (steward) |
| OM1, OM8, OL5, OL6, SL1, F2, F3, F4, F5, F7 | fixed, `d7205b9` (F4 also in the design) |
| F8 | deferred to the version bump, as W9 |

Rulings: MCP 2026-07-28 removed `initialize`, `ping` and `resources/subscribe`
(the research note on MCP as a binding), so the bridge's plugin start and liveness are
revision-neutral: `initialize` or `server/discover`, `ping` or `server/discover`, found by part A
and fixed in `d7205b9`. A person working only over Remote Desktop reports no `app`, camera or
microphone keys, a narrowing recorded with its ground.

## Readers, fifth round

The same prompt, the four standards and this record, fresh subagents; no third-model reader, by the maintainer's
ruling.

**Claude Opus**, 15 findings, 0 blocker, 2 high, 8 medium, 5 low:
- OH1 high: a plugin extension action on a player hosted by an `infrastructure` computer gets only a
  `confirm` floor, below `power.shutdown`'s `no_voice`; the floor's wording is ambiguous. OH2 high: a
  forged helper in the session's own account can report `locked` and escape HS20.
- OM1 round 4's remote sessions are looser, recorded clarified; OM2 a publisher's `selfChanging`
  cannot be removed; OM3 the 90 s wake is shorter than the 120 s start bound; OM4 box grants ignore
  `personal`; OM5 a computer's `notify` shown nowhere has no ack; OM6 a token is retired on a
  transient absence; OM7 ruling 5's floor has no subject and no defined refusal; OM8 a publisher's
  `idempotent` gates reissue.
- OL1 a subject left out of the applier's note; OL2 a delegated token keeps `from`; OL3 CONTEXT's
  **Rule**; OL4 GA-BRIDGE-65 keyed on loopback; OL5 GA-SCN-4 omits rules' own actions.

**Claude Sonnet**, 5 findings, 0 blocker, 0 high, 1 medium, 4 low:
- SM1 GA-RULE-7 does not retry `unanswered` as GA-SAFE-12 does.
- SL1 the owner is told of self-reported confirmations only by a SHOULD; SL2 CONTEXT lacks
  **Session helper** and **Administrator**; SL3 a classless device's extension floor is implicit;
  SL4 an `internal` device may be a rule's or scenario's direct target.

## Scenario walk, fifth round

19 as designed, 6 partly, 1 cannot: HS19 falls to partly on the brain side. 0 blocker, 0 high,
1 medium, 4 low:
- F1 medium: no MUST makes the brain say which episode launched once a plugin's late ack arrives.
- F2 a plugin's "nothing matches" reaches the outcome late and without its text; F3 the launch's ack
  comes near its bound; F4 the applier still cites a Wake-on-LAN switch; F5 HS20's reply names a
  relation the brain cannot know.

## Dispositions, fifth round

Fixes: `c54b33c` (bridge and applier), `ec11478` (steward, brain, CONTEXT.md, scenarios, one applier
sentence), and the design's note on OM3. Each fix's row is in the tables above, named "Round 5".

| Findings | Disposition |
|---|---|
| OH1, SL3, OH2, OM2, OM3, OM4, OM5, OM6, OM7, OM8, OL1, OL2, OL4, SL1, F2, F3, F4 | fixed, `c54b33c` (F4 finished in `ec11478`) |
| OM1, OL3, SL2, OL5, SM1, SL4, F1, F5 | fixed, `ec11478` |

Rulings: OH2's Linux limit, where the OS's lock report can be set from inside the session, is a known
gap, not closed; it goes to the maintainer. An `internal` flag set after a rule names the device leaves that
rule as it is, named for the next readers. HS19 is expected to return to as designed with F1's fix;
the next walk regrades it.

## Readers, sixth round

The same prompt, the four standards and this record, fresh subagents; no third-model reader, by the maintainer's
ruling.

**Claude Opus**, 18 findings, 0 blocker, 3 high, 8 medium, 7 low:
- OH1 high: GA-STW-11's per-account lock steps are `refuse(conflict)` under GA-STW-2. OH2 high: a
  plugin's standard actions on a device an `infrastructure` computer hosts stay `reversible`. OH3
  high: an account's several sessions and its one key are undefined.
- OM1 the `infrastructure` proposal fails open; OM2 an adoption may evict a device a safety rule
  names; OM3 a disconnected session counts as shown; OM4 administrator sets that cannot be
  enumerated; OM5 GA-DESC-3's refusal is `static`; OM6 PC requirements bind every bridge; OM7 how
  `command` names an interpreter; OM8 *Who else may read* ignores `personal`.
- OL1 GA-PROV-4 against `forget`; OL2 a manifest lowers a standard action's tier; OL3 one Verify
  value for real-OS checks; OL4 guessed constants; OL5 `forget` of a wake relay; OL6 personal keys
  only on a computer; OL7 CONTEXT's floor, `session.lock`'s `confirms`, a lock no locker honours.

**Claude Sonnet**, 4 findings, 0 blocker, 0 high, 1 medium, 3 low:
- SM1 a plugin's account deleted is undefined. SL1 `applied` on a `notify` is not "seen"; SL2
  CONTEXT's **Administrator** drops groups; SL3 a reinstall under a retired token.

## Scenario walk, sixth round

20 as designed, 5 partly, 1 cannot: HS19 is back to as designed. 0 blocker, 0 high, 0 medium,
6 low: WL1 whose voices each satellite hints; WL2 HS22's administrators have no hop; WL3 HS20's
laptop reads `locked` on wake; WL4 which endpoint a follow-up read names; WL5 a declined ask in the
failed steps; WL6 the grades table (as W9).

## Dispositions, sixth round

Fixes: `45c4ca4` (bridge and applier; new GA-BRIDGE-66, GA-BRIDGE-67, GA-DESC-14), `7f5e802`
(steward, brain, CONTEXT.md, scenarios, the bridge's sessions without a display), and the
controller's follow-up to GA-BRIDGE-52 in this commit. Each fix's row is in the tables above, named
"Round 6".

| Findings | Disposition |
|---|---|
| OH2, OH3, OM1, OM2, OM3, OM4, OM5, OM6, OM7, OM8, OL1, OL2, OL3, OL5, OL6, OL7, SM1, SL1, SL3 | fixed, `45c4ca4` (OH3, OL6 and OL7 finished in `7f5e802` and this commit) |
| OH1, OL4, SL2, WL1, WL2, WL3, WL4, WL5 | fixed, `7f5e802` |
| WL6 | deferred to the version bump, as W9 |

Rulings: an account's sessions combine most in use first; a non-graphical session joins the key only
while the account has no graphical session (looser, recorded with its ground). The third satellite
of the house is placed upstairs by the implementer, a guess the scenarios did not settle.

## Readers, seventh round

The same prompt, the four standards and this record, fresh subagents; no third-model reader, by the maintainer's
ruling.

**Claude Opus**, 11 findings, 0 blocker, 1 high, 4 medium, 6 low:
- RH1 high: a plugin device's `stableIdentifier` is the same on every host, so two PCs hosting one
  plugin collide.
- RM1 a lock of an SSH-only account never acks and is retried; RM2 a failed staged swap leaves the
  adopted id pointing at nothing; RM3 a plugin cannot run as a service account; RM4 the helper binding
  is graded only on the scripted OS.
- RL1 the extension floor ignores the host's `computer` rows; RL2 a crash-looping server is silent;
  RL3 the staged path evicts siblings without warning; RL4 a retired token blocks sleep silently; RL5
  sequence clauses marked `static`; RL6 the interpreter rule.

**Claude Sonnet**, 8 findings, 1 blocker, 2 high, 3 medium, 2 low:
- SB1 blocker: as RM1, the bridge acks an SSH-only account's lock `applied` while its key reads
  `active`, so the applier never matches.
- SH1 high: `session.lock`'s `idempotent` is unstated. SH2 high: the `unknown` administrator entry is
  not graded on a real OS.
- SM1 the three states of `infrastructure`; SM2 `account_persons` on a computer with no `session`;
  SM3 CONTEXT's helper entry overstates. SL1 what makes a session graphical; SL2 how GA-PROV-3
  compares bodies.

## Scenario walk, seventh round

20 as designed, 5 partly, 1 cannot. 0 blocker, 0 high, 2 medium, 4 low:
- WM1 medium: whether a yes to `ask(in_use)` also answers the room behind it. WM2 medium: a rule's
  failed action that is not retried is silent.
- WL1 a target with no room; WL2 HS19's guest and a manifest that requests `confirm`; WL3 HS22's
  copied code runs until the next start; WL4 the grades table (as W9).

## Dispositions, seventh round

Fixes: `9779e87` (bridge and applier, and the design's note on RH1), `c31fce1` (steward, CONTEXT.md,
scenarios). Each fix's row is in the tables above, named "Round 7".

| Findings | Disposition |
|---|---|
| SB1, RM1, SH1, SH2, RM4, RH1, RM2, RL2, RL3, RL5, RL6, SM1, SL1, SL2 | fixed, `9779e87` |
| WM1, WM2, RL4, SM2, SM3, WL1, WL2, WL3 | fixed, `c31fce1` (WM1 looser, with its ground: the yes was given to the PC in use, and an `occupied` room still skips) |
| RM3 | deferred, not designed: a plugin runs as a person's interactive account; a service account needs a design (who creates it, how it shows); the gap is stated in the bridge |
| RL1 | rejected: taking the host's `computer` rows into the extension floor raises every plugin extension on every PC to `confirm`, which cancels ruling 5 (confirmed by the maintainer) and HS22's lowered `launch`; round 5's OH1 already covers an `infrastructure` host |
| WL4 | deferred to the version bump, as W9 |

## Readers, eighth round

The same prompt, the four standards and this record, fresh subagents; no third-model reader, by the maintainer's
ruling.

**Claude Opus**, 16 findings, 0 blocker, 2 high, 5 medium, 9 low:
- H1 high: a dropped pending replacement still swaps later and evicts a device a safety rule names.
  H2 high: the administrators of a PC that carries the broker reach every device, so the Safe claim's
  per-device scoping fails.
- M1 a plugin server can pose as its account's session helper; M2 a lock that lands after 5 s reads
  as someone else's change; M3 `session.lock` on a retired token loops; M4 when a plugin device turns
  `available: true`; M5 the round 6 looser row trades in-use for the lock's ack.
- L1 applicability self-declared; L2 a wake on a `stale` computer; L3 a silent forget on absence; L4
  clauses without subjects; L5 "current" MCP revision; L6 guessed constants; L7 a repeated
  `uninstall`; L8 as round 7's RL1.

**Claude Sonnet**, 4 findings, 0 blocker, 0 high, 2 medium, 2 low:
- SM1 Windows administrator-equivalent privileges; SM2 GA-STATE-3's computer clause has no subject.
- SL1 the *Default tiers* table row hides the extension floor; SL2 `needsSession`'s "started first".

## Scenario walk, eighth round

20 as designed, 5 partly, 1 cannot. 0 blocker, 0 high, 0 medium, 4 low: WL1 HS20's Modern Standby
branch; WL2 HS21's live laptop; WL3 HS20's «ещё полчасика» is ungraded judgement; WL4 a lock of a
retired token.

## Dispositions, eighth round

Fixes: `4792ca8` (bridge and applier), `3edc355` (steward, scenarios). Each fix's row is in the
tables above, named "Round 8".

| Findings | Disposition |
|---|---|
| H1, H2, M1, M2, M4, SM1, SM2, L1, L2, L3, L4, L5, L7, SL1, SL2 | fixed, `4792ca8` |
| M3, WL4 | fixed, `4792ca8` (the lock's arg) and `3edc355` (conditions on a retired token read false) |
| WL1, WL2, WL3 | fixed, `3edc355` |
| L6 | rejected: every constant it lists is under *To measurement* |
| L8 | rejected: as round 7's RL1 |
| M5 | deferred to the maintainer: counting a non-graphical session beside a locked console as in use needs a second reading (a key or capability for remote sessions), a design choice; round 6's looser row stands with its ground |

## Merge with discovery

Before the ninth round, `main` was merged into this branch (`42e4197`): it
carries the discovery revision, bridge 0.3 and applier 0.9, released with its own record
(`docs/reviews/2026-09-25-bridge-0.3-applier-0.9.md`). This revision therefore becomes **bridge
0.4 and applier 0.10**, layered on discovery; steward 0.5 and brain 0.4 are unchanged in number.
This branch's GA-BRIDGE-39, 40 and 41 became GA-BRIDGE-68, 69 and 70, since discovery holds
39–41. The seams read in the ninth round: "manifest" in three senses, GA-BRIDGE-41 on PC devices,
GA-DISC-2 and a PC already held, `connect` under Provision and `install` under Host (GA-PROV-1),
the retry clause replaced by `idempotency_key` (GA-PROV-3) now covering `connect`, and
`request_id` returned for a `connect` (GA-DISC-4).

## Readers, ninth round

The same prompt on the merged text, told of the discovery seam; fresh subagents; no third-model reader, by
the maintainer's ruling.

**Claude Opus**, 13 findings, 0 blocker, 1 high, 5 medium, 7 low:
- H1 high: root, always listed, makes every safety rule need `accepts_other_admins` once a PC bridge
  runs on the box itself.
- M1 a forget on `accepted` re-admits the plugin's devices; M2 a lock that lands late stays failed;
  M3 a `notify` without `from` shows unmarked; M4 `needsSession` counts an SSH session; M5 plugin ids
  can break the applier's id grammar.
- L1 `already` after `dead` for a wake; L2 `not_locked`'s ack bound; L3 unnamed `faults` codes; L4
  the steward changelog's 0.9; L5 GA-STW-12's time for the steward's own outcomes; L6 a broker in a
  VM; L7 GA-BRIDGE-38's `stagedFor` prose.

**Claude Sonnet**, 8 findings, 0 blocker, 2 high, 3 medium, 3 low:
- SH1 high: a directory account is never retired, so a reused uid inherits it (disposed as medium:
  a domain SID is not reused). SH2 high: the interpreter is resolved by name, open to an earlier
  writable `PATH` entry.
- SM1 the `needsSession` tie for non-numeric ids; SM2 sudo's "every command" undefined; SM3 the tool
  hash read as more than it is.
- SL1 `accounts` labels after a rename; SL2 `not_locked` and the read-back; SL3 GA-OCC-3's
  cross-reference.

## Scenario walk, ninth round

21 as designed (HS27 walked again on the merged text and within scope), 5 partly, 1 cannot. 0
blocker, 0 high, 0 medium, 4 low: WL1 the transmitter that answers nothing has no home in the bridge;
WL2 HS19's Wake-on-LAN through suspend; WL3 the grades table (as W9); WL4 HS22's launch needs the
desktop awake.

## Dispositions, ninth round

Fixes: `81c1563` (bridge and applier), `d9851e4` (steward, brain, applier's `applier_host`
refusal, scenarios). Each fix's row is in the tables above, named "Round 9".

| Findings | Disposition |
|---|---|
| H1, SH2, M1, M2, M3, M4, M5, SH1, SM1, SM2, SM3, L1, L2, L3, L6, L7, SL1, SL2, WL1 | fixed, `81c1563` |
| H1 (the `applier_host` refusal), M2 (steward and brain), L4, L5, WL2, WL4 | fixed, `d9851e4` |
| WL3 | deferred to the version bump (regrade) |
| SL3 | rejected: the reader found no behavioural gap; GA-OCC-3 reads the combined key |

WL1's stated gap is closed by the maintainer's ruling of 2026-09-27 (*Rulings of 2026-09-27*).

## Rulings of 2026-09-27

Rulings by the maintainer after round 9 (the first three read first by round 10; the last after round 11).

- **Open-loop devices, a minimal rule now.** A value derived from what was sent is assumed and
  never taken as observed; an action a toggling code carries out is never sent to reach a state
  until the person, who can see the device, says yes (`ask(toggle_only)`), and `onoff.toggle`
  presses the button when that is what was asked; a transmitter that can answer nothing reads
  `unknown`, its devices usable and their commands `sent` once written. Closes the 0.8 review's two
  deferred items and round 9's WL1 gap. Rows: *Ruling 2026-09-27, assumed readings*, *toggles* and
  *a silent transmitter*, in each standard's table.
- **The held limit notice.** GA-RULE-8's notice after `failed(no_ack)` waits out GA-APPLY-11's
  60 s late-ack window, as it waits out a lock's `ack_within_s` after `failed(not_locked)`. Row:
  *Ruling 2026-09-27, the held limit notice*, in *Steward 0.5*.
- **Real names out of the record.** The maintainer, and a third-model reader, in place of names,
  across the standards, reviews, reference scenarios, goals, specs and `CONTEXT.md`; front-matter
  authors and owners kept; personas kept. No requirement moves.
- **Open loop kept, as a known limitation** (after round 11). The open-loop rule stays in this
  revision although rounds 10 and 11 each found highs in it; each standard's *What this standard
  does not define* states the limitation: guarantees resting on an observed state are weaker for an
  open-loop device, and what stands in their place (assumed values, the person's yes for a toggle,
  no toggle sent by the applier on its own, the owner's notice at adoption). No requirement moves.

## Readers, tenth round

The same prompt on the text with the rulings of 2026-09-27 (`67c1397`), read hardest there; fresh
subagents.

**Claude Opus**, 13 findings, 1 blocker, 3 high, 5 medium, 4 low:
- B1 blocker: `onoff.toggle` sits below every tier floor, latch and lease.
- H1 a mute transmitter that goes `down` never comes back; H2 "the person, who can see the device"
  is asserted, never checked; H3 GA-LOAD-2 cannot act on an open-loop heating socket.
- M1 GA-BRIDGE-71 and GA-PLAN-8 disagree on the button; M2 authored work gets around
  `skip(toggle_only)`; M3 GA-BRIDGE-72's row overstates its ground; M4 the compatibility seams for
  `unknown` and `toggles`; M5 `toggles` fails open for a learned code.
- L1 the held notice's wait has no delivery slack and does not survive a restart; L2 GA-BRIDGE-72's
  clauses have no negative subjects; L3 a rule on a toggle notifies at every firing; L4 front
  matter and a persona.

**Claude Sonnet**, 6 findings, 0 blocker, 2 high, 2 medium, 2 low:
- SH1 a sudo grant of one command is root in practice; SH2 the no-session `failed(not_locked)` is
  held like a slow lock.
- SM1 "console session" undefined on Linux; SM2 the PC constants are guesses, untested together.
- SL1 `session.lock`'s ack bound only implicit; SL2 the bare-LED limit has no home in *What this
  standard does not define*.

## Scenario walk, tenth round

21 as designed, 5 partly (HS11, HS13, HS15, HS16, HS17), 1 cannot (HS26). 0 blocker, 1 high, 3
medium, 3 low: F1 `onoff.toggle` below every floor (HS13, HS14, HS15, HS17); F2 a silent transmitter
has no way back from `down`; F3 the toggle's asker may not see the device; F4 the TV is not in the
flat's inventory; F5 HS15's spoken order breaks GA-BRAIN-6; F6 HS12's whole-state claim and its two
actions; F7 GA-APPLY-9 does not re-check the toggle.

## Dispositions, tenth round

By the controller's rulings for this round: `onoff.toggle` is dropped (closing B1, F1, M1 and most
of M2), and a toggle is never answered by a rule, a schedule or an authored token. All fixes are in
one commit, "fix(standard): review round 10"; each fix's row is in the tables above, named
"Round 10".

| Findings | Disposition |
|---|---|
| B1, F1, M1, M2, H1, F2, H2, F3, H3, M3, SL2, M4, M5, L1, L2, L3, SH1, SH2, SM1, SL1, F4, F5, F6, F7 | fixed |
| SH1 | fixed as stricter; its premise was partly false: a grant of some commands was already the `unknown` entry |
| H2 | fixed without the reader's room rule: the question says the state is not known, and who may answer stays as for any ask |
| L4 | rejected: front matter bumps at release; personas stay by the maintainer's ruling |
| SM2 | rejected: every constant is a guess under the files' constants tables; bench tests are a roadmap item after the reference implementation |

HS15 and HS17 are re-verdicted ✅ as designed in the scenarios, before the regrade.

## Readers, eleventh round

The same prompt on the text after round 10 (`5756ded`); fresh subagents.

**Claude Opus**, 19 findings, 0 blocker, 2 high, 9 medium, 8 low:
- H1 a real heater on an open-loop socket can no longer be declared, and GA-DESC-8 disagrees; H2 the
  applier's own actuations (a cap's retry, a safety rule's re-send) get around GA-PLAN-8.
- M1 an unplugged dongle stays `live`; M2 the ack of a failed write is undefined; M3 `toggles`
  covers only two-state flips; M4 a person-started run's yes goes stale; M5 round 10's O-H2 moved
  looser unrecorded; M6 the steward infers the bridge's branch from a guessed 5 s; M7 the
  `open_loop` notice comes only at adoption; M8 safety rules may read assumed values; M9 a rule
  loses a device to a declaration change silently.
- L1 GA-STW-4's items 5 and 9 conflict; L2 a mute transmitter's backoff never resets; L3 the
  late-ack slack does not grow under a meta-applier; L4 `describe`'s transport `up` changed type;
  L5 lists and vocabulary not updated; L6 the brain's fixed mapping for the button; L7 the held
  notice when the conditions stop holding; L8 the toggle question is untrue for a closed-loop
  device.

**Claude Sonnet**, 3 findings, 0 blocker, 0 high, 1 medium, 2 low:
- SM1 `skipped(stale)` overloaded for a stale reading and an assumed one.
- SL1 `CONTEXT.md` avoids "plugin" for Adapter while defining Plugin; SL2 no Host or Computer entry.

## Scenario walk, eleventh round

23 as designed or within scope, 3 partly (HS11, HS13, HS16), 1 cannot (HS26). 0 blocker, 0 high,
3 medium, 5 low: F1 nothing builds HS12's whole-state IR frame after a bridge restart; F2 a yes at
a shared panel is asked for, then refused; F3 a schedule's toggle step is skipped silently every
morning (HS1); F4 HS12's "they set it" holds only for codes not learned; F5 HS1's AC step names one
action; F6 GA-STW-4's items 5 and 9 contradict; F7 an unanswered ask and a second spoken reply in
a dark room; F8 HS22's outcome name. WL3 (the grades table's "expected" for HS19–HS24) is carried
to the regrade.

## Dispositions, eleventh round

By the controller's rulings for this round: R1, `toggle_only` holds on open-loop devices only;
R2, the applier's own actuations never send a toggle, checked again on every declaration change;
R3, `heating` on an open socket whose `turn_off` is discrete, its cap counting from the assumed
`on`, in place of round 10's refusal. All fixes are in one commit, "fix(standard): review round
11"; each fix's row is in the tables above, named "Round 11".

| Findings | Disposition |
|---|---|
| H1, H2, L8, M1, M2, M3, M4, M6, M7, M8, M9, L1, L2, L3, L4, L5, L6, L7, SM1, SL1, SL2, F1, F2, F3, F4, F5, F6, F7, F8 | fixed |
| H1 | fixed by ruling R3, looser than round 10's refusal; a `turn_off` that toggles still cannot carry `heating` (R2) |
| H2 | fixed by ruling R2, as GA-SAFE-13; a rule that stops passing is disabled, as GA-META-3 disables one |
| L8 | fixed by ruling R1: the toggle rules narrow to `feedback: open` devices, so the question is true wherever it is asked |
| M5 | recorded, no text change: round 10's O-H2 is looser than the ruling's wording, on the ground in its row |
| F1 | fixed by the applier carrying the assumed state in the command (`whole_state`, `state`), the bridge keeping none |
| F7 | fixed as recommended: no second spoken reply; the steward's unanswered `ask` is what the app shows |

## Verdict

**PASS** (the maintainer, 2026-09-27, after round 11). Bridge 0.4, applier 0.10, steward 0.5 and
brain 0.4.

Across eleven rounds, each of two readers (Claude Opus; Claude Sonnet; a third-model reader skipped
by the maintainer's ruling, since its quota was spent in round 1) and a scenario walk: 317 finding
rows, 300 fixed, 10 deferred, 6 rejected, 1 recorded with no text change (round 11's M5). Two
blockers, round 7's SB1 and round 10's B1, both fixed in their round; no blocker open. Six of the
deferrals were the grades table, carried to this version bump and answered by the regrade below;
the other four are round 1's M5 (in part), round 3's OL6 (to the step 0 public-readiness check),
round 7's RM3 and round 8's M5. The walk moved from 20 as designed, 5 partly and 1 cannot in round
1 to 23 as designed or within scope, 3 partly (HS11, HS13, HS16) and 1 cannot (HS26, not designed)
in round 11, the grades against these versions in
`docs/reference/2026-09-24-home-reference-scenarios.md`.

Round 12 was not run. Round 11's fixes (`b54d2d3`) and the note that states open-loop devices as a
known limitation (`c34a20a`) were not read by a further round; the next review of these standards
starts there, reading them as the ground truth, not as verified fixes.

Kept by the maintainer's ruling, not closed:
- An SSH login beside a locked console does not hold up a sleep (round 6's looser row; round 8's
  M5): counting it as in use needs a second reading, a design choice.
- A plugin runs as a person's interactive account, never a service account (round 7's RM3): a
  service account needs a design, and the gap is stated in the bridge.
- On Linux the OS's lock report is set by the session's own screen locker (round 5's OH2): HS20
  holds against a killed or forged helper, not against a faked lock report.
- Open loop as a known limitation (*Rulings of 2026-09-27*): guarantees resting on an observed
  state are weaker for an open-loop device, and each standard's *What this standard does not
  define* says what stands in their place.

Carried forward:
- To the bench: every constant listed under *To measurement* (*Carried forward*), each marked ⚠️ in
  its standard's *Constants*, with Wake-on-LAN through a suspend, a Modern Standby laptop's
  announced sleep, which codes of a model toggle, and Windows' `LogonTime`; after the reference
  implementation.
- Not read after its fix: round 11's dispositions and the known-limitation note, as above.
