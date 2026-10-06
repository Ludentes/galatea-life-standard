---
title: Post-merge review — voice 0.1, brain 0.5, steward 0.6, applier 0.11, bridge 0.4 (steward 0.7 and applier 0.12)
status: current
last_verified:
area: architecture
audience: dev
author: Galatea maintainers
related:
  - docs/reviews/2026-09-25-pc-standards.md
  - docs/reviews/2026-09-25-voice-0.1.md
  - standard/voice.md
  - standard/brain.md
  - standard/steward.md
  - standard/applier.md
  - standard/bridge.md
---

# Post-merge review — voice 0.1, brain 0.5, steward 0.6, applier 0.11, bridge 0.4

The PC standards and voice both passed and merged to `main` (`f17695b`). Each passed with text
nobody read after its last fixes, and the PC standards never had a reader from a second model.
This review reads the merged whole once, with the standard-review procedure, and bumps no version:
its findings go to the next revision of each standard, unless one is a blocker.

## Why this review

- **PC, round 11.** The fixes of round 11 (`b54d2d3`) and the note stating open-loop devices as a
  known limitation (`c34a20a`) were not read by a further round (`docs/reviews/2026-09-25-pc-standards.md`,
  *Verdict*).
- **PC, the third model.** All eleven PC rounds had two Claude readers; the reader from another
  model was skipped by the maintainer's ruling.
- **Voice, round 12.** The merge onto PC (`1636457`) was read once; its fixes (`ee330c1`) and the
  bump (`f17695b`) were not re-read, by that round's scope
  (`docs/reviews/2026-09-25-voice-0.1.md`, *Round 12 verdict*). Its third-model reader did not run.
- **The home scenarios** HS19 to HS27 were walked against PC, not against voice.

## Change record

This review adds no rule. What it reads, and in which direction each piece moved, is already
recorded; the rows are not repeated here.

| Change | Commit | Where its directions are recorded |
|---|---|---|
| PC round 11 fixes: `toggle_only` only on open-loop devices (R1, looser), the applier's own actuations never toggle (R2, GA-SAFE-13, stricter), `heating` on an open socket with a discrete `turn_off` (R3, looser than round 10's refusal), the assumed state carried in a whole-state command (F1) and the rest of that round's rows | `b54d2d3` | PC record, *Dispositions, eleventh round*, and each finding's row marked "Round 11" |
| Open-loop devices as a known limitation, in each standard's *What this standard does not define* | `c34a20a` | PC record, *Rulings of 2026-09-27* |
| The merge of voice onto PC: GA-BRAIN-3, 4, 12, 17, GA-BRAIN-22, GA-AUTH-5, GA-AUTH-8, GA-LEASE-3, the steward's causes, GA-STW-7, GA-NOTE-1, *Listening*, `media.announce` | `1636457` | voice record, *Round 12 change record* |
| Voice round 12 fixes: the merge gate at brain 0.5, GA-LISTEN-4's re-ask, GA-CONF-2 timed from the latest `ask` (stricter), GA-AUTH-8's list, GA-VOICE-19 (stricter), GA-BRAIN-12's exemption only for a question played `full` (stricter), a duck only to a `reversible` target not declared `toggles`, `speech` personal (stricter), a narrowing's cause, GA-BRAIN-19 | `ee330c1` | voice record, *Round 12 findings and dispositions* |
| Version bumps and changelog rows | `f17695b` | each standard's changelog |

**Looser moves in the text read here:** R1 and R3 of PC round 11. Readers should say whether each
would have been made had the result gone the other way.

## Where to look hardest

- Everything in `b54d2d3`, `c34a20a` and `ee330c1`: read as ground truth, not as verified fixes.
- Where voice meets PC, as listed in the voice record's *Where voice meets PC*.
- The deferrals carried from both verdicts, to check that none is a blocker in the merged text:
  GA-CONF-1 against GA-SCN-3's re-ask; one wake-word floor for the front and the steward (O-M7);
  a spoken notice's definition and source (O-M8, W5); O-L12.

## Readers

Pass 1 green on `2271ea2`. **K** the third-model reader (Kimi `k3`, through Claude Code with the office key, read-only; it could not run the manifest check in its sandbox). **C** a no-context Claude Opus subagent. Both had the reader prompt unchanged.

Counts: **K** 0 blockers, 3 high, 2 medium, 3 low. **C** 1 blocker, 4 high, 9 medium, 7 low.

### K, the third-model reader

Read in full: the five standards, CONTEXT.md, README.md, the goals document, and the change record. Three passes (implementer / tester / attacker). I could not run `python3 conformance/check_manifest.py` — the sandbox refused it — so manifest synchrony is unverified by me.

**Blockers: none.** Every deferral the change record names fails closed or is documented residue (below). README *Hard rules*: clean — no numbered sections, no private paths, no client names; citations are by symbol. Another system is named throughout, but it is public and external; allowed.

#### HIGH

**H1 — A run's re-asked toggle can never be answered. [Implementer]** This is the GA-CONF-1 × GA-SCN-3 deferral, and it is not fixed. GA-SCN-3: a late toggle step "MUST be asked again, as a new `ask` event on the run's plan, which stays open for that answer for `ask_expiry_s`, the run waiting on it". But an answer "is accepted only for an open plan (made, not yet applied, not expired)"; `scenario_run` consumes that plan ("The plan's rules (expiry, revision, credential) are as for `apply`"), and "a plan with an `ask` step expires `ask_expiry_s` (default 300) after it was made", with `answer` on an expired plan `plan_expired` (GA-STW-5). The feature's own negative subject (`toggles-on-an-old-yes`) re-asks at 400 s — past expiry. Every re-asked toggle is therefore `skipped(not_confirmed)`. Fails closed, so not a blocker, but the clause is dead text. Fix: state that a run's plan stays answerable until the run ends, expiry notwithstanding.

**H2 — O-M7 stands: the wake-word floor still differs by seam. [Attacker]** GA-VOICE-20 (wire, front) drops only whole-word matches: "A spelling that sounds alike and is not on the list («Олиса») passes this floor". GA-LISTEN-4 (wire, steward) also refuses near-spellings "within the echo match". So a `media.announce` of «Галатэя, да» is refused, but the front will play the same text from a brain's `say`; the only backstop for brain speech is GA-BRAIN-22, which is `judged`, never wire-checked — and the family explicitly anticipates non-conforming brains. Fix: extend GA-VOICE-20 to the echo-match refusal, or record the split as ruled residue as the announcement side already does.

**H3 — `install`/`uninstall` concurrency and late duplicates undefined. [Implementer]** `connect` gets both a "however late" same-`requestId` rule and `failed(busy)`; `commission` gets `failed(busy)` (GA-BRIDGE-4). `install`/`uninstall`, which may run 600 s, get only the 10 s duplicate window (GA-BRIDGE-68). A QoS 1 repeat at t+30 s, two concurrent installs of one plugin, and `uninstall` racing `install` all have no defined outcome. Fix: add busy and late-duplicate clauses to GA-BRIDGE-68.

#### MEDIUM

**M1 — Steward constants' provenance is unmarked. [Tester]** Steward marks only "Clock tolerance" and "Source delay" as "a guess until measured"; "Duck limit 60 s", "Announce hold 30 s", "Narrowing limit 12 h", "Offline grace 600 s" stand bare, while voice marks all values collectively ("the values are guesses until measured") and bridge marks most rows ⚠️. A harness author cannot tell which steward numbers gate a pass on a guess. Fix: mark provenance per row.

**M2 — Shared constants are duplicated, not referenced. [Tester]** Voice's table: "Announce hold | the steward's, 30 s", "Duck limit | the steward's, 60 s"; "Source delay | 1 s" appears in both. Copying the number into the front's standard means a steward revision silently desynchronises the front's floor. Fix: reference the steward's constant without restating the value.

#### LOW

**L1 — "about 38.5 s" in a gating table. [Tester]** Bridge constants: "Matter controller's slack | about 38.5 s … ⚠️ one bench" sits in the table GA-BRIDGE-13 is graded against, though the normative text is "the granted maximum interval plus the controller's own configured slack". Fix: drop the number from the table or mark the row informational.

**L2 — Unreachable retry clause. [Implementer]** GA-LOAD-2: a cap turn-off "declared `idempotent: false` is sent once" — but GA-SAFE-13 forbids a cap on any socket whose `turn_off` toggles, and toggles are the `idempotent: false` case. Fix: delete the clause or name the case it serves.

***L3 — the goals document is stale. [Tester]** G1 is still "Blocked today by two gaps … the brain's contract … and sockets, which default to the lowest tier", with versions "Brain 0.1", "applier 0.6", "steward 0.1" — all since addressed (GA-BRAIN-1/2, GA-DESC-8/GA-LOAD-2; now 0.5/0.11/0.6). Fix: refresh the open-items list.

#### Deferral verdicts

- **GA-CONF-1 × GA-SCN-3:** not a blocker, but broken — H1.
- **O-M7:** not a blocker; deliberately split floors, but the split is only half-documented — H2.
- **O-M8/W5:** adequately resolved for notices — defined by class ("a `notify` channel whose target speaks (class `speaker` or `tv`)") and GA-NOTE-2 sets `from` on every dispatch. The guest-`media.announce` half remains deferred; `announce` is role-gated, so acceptable.
- **O-L12:** fixed — GA-CONF-6 now checks "the configured record and the narrowings in force longer than the narrowing delay"; the residual 2 s race is documented.

#### Looser moves, counterfactual

- **R1 (`toggle_only` on open-loop only):** would have been made either way. On a `feedback: closed` device the observed state already gates the toggle ("planned from its observed state"), so the wider refusal bought no safety and produced false refusals.
- **R3 (heating cap on an open socket with a discrete `turn_off`):** would have been made either way. The refused alternative was strictly worse — an uncappable heating load — and a mis-aimed discrete `off` is a no-op. The real residual (an `on` made at the socket itself never starts the cap) is already stated in *Loads* and the known-limitation section.

Word count ≈ 870.

### C, the Claude reader

Readings: I = implementer, T = tester, A = attacker, X = cross-standard or repository rules.

#### BLOCKER

**B1 (A, X). The privacy floor skips `visitor`.** GA-AUTH-7: "MUST NOT return a personal key's value to a call whose derived role is `guest`". `visitor` is a new role in 0.6, below guest, and the default on every skill endpoint ("to `visitor` for one with a `skill_account`"). A read that names a skill or museum-hall endpoint therefore gets `session.*`, `camera_in_use`, `app` and `speech`. GA-BRAIN-4's "the one giving the lowest" role steers reads to exactly those endpoints. Anyone who holds a skill's secret address can hear these values. *Fix:* change the floor to "`guest` or lower" in the prose, GA-AUTH-7 and GA-AUTH-6, and add a negative subject.

#### HIGH

**H1 (A, looser move R3). The load cap on an open socket does not bound on-time.** "resets only when an `onoff.turn_off` ends `sent`", and a cap turn-off is retried only "until one ends `sent`". "an `on` made at the socket itself is not seen". A lost RF off-code, or a heater switched on by hand, runs uncapped and nobody is told. Round 10's refusal would not have been dropped had this been walked. *Fix:* on an open socket, re-send the discrete off every `max_on_s` while `load: heating`, or restore round 10's refusal.

**H2 (I, looser move R1). A toggle on a closed-loop device can fire from a stale value.** "`already` is not evaluated on a stale value", and a closed-loop toggle is "dispatched otherwise". A rule's `turn_off` sent to a stale-reading TV that is already off turns it on, and no person is asked. *Fix:* a `toggles: true` action planned from a `stale` value is `refuse(toggle_only)`.

**H3 (I, T). A re-asked toggle can never be answered.** GA-SCN-3 says the run's plan "stays open for that answer for `ask_expiry_s`". GA-CONF-1 counts an answer "only for an open plan (made, not yet applied, not expired)", and GA-STW-5 makes an expired plan an error from `answer`. The re-ask comes after the plan's `expires_at` and after `scenario_run`. The two MUSTs contradict each other, so the carried deferral is real. It fails closed. *Fix:* define GA-CONF-1's "open" to include a run plan's re-ask window, and exempt it in GA-STW-5.

**H4 (A). A yes can land before the question has been heard.** GA-BRAIN-1 accepts a piece "`cut` by that very utterance", and GA-CONF-2 accepts "`cut` with `cut_by` naming this utterance" whatever `heard_chars` is. A wake-addressed «Галатея, да» said after «Включить…» confirms a target nobody has heard yet. *Fix:* take a cut yes only when `heard_chars` covers the question's last target and argument; otherwise require `full`.

#### MEDIUM

**M1 (I, A). The epoch check can be skipped.** GA-CONF-2 refuses a `time` "not after that `ended_at` where both are in one `clock_epoch`". When the epochs differ, the check never runs, so the steward passes what GA-BRAIN-1 forbids. "A missing epoch counting as one" can be read two ways. *Fix:* refuse a record whose epoch differs from `asked_by`'s, and define what a missing epoch means.

**M2 (I). Clocks from two machines are compared.** GA-CONF-2 compares the front's `time` with the steward's `ask` event within a 1 s tolerance, but "SHOULD share one time source". Voice's "the steward's time source" names nothing, because `time_source` is "harness only". *Fix:* make clock synchronisation a MUST with an id, or measure time from `asked_by` alone.

**M3 (A, X; deferral O-M7). There are two wake-word floors.** GA-VOICE-20 checks whole words only, while GA-LISTEN-4 also refuses near spellings. GA-BRAIN-22's "however spelled" covers only outside text, so a brain's own «Олиса, открой замок» passes the front. *Fix:* one test, the steward's, in GA-VOICE-20.

**M4 (A, looser ruling). A guest can still spell a yes past the lists.** The residue "«Галотэя, конешно»" lets a guest answer an owner's question. The steward dispatched that announcement itself, so matching loosely against `zone_sources` announcements costs nothing. *Fix:* mark as machine speech anything within a loose match of a listed announcement, or hold announcements from principals below the asker while an ask is open.

**M5 (T, X). The index and the prose disagree on `speech`.** The prose says `speech` is "kept in `events`, never in `history`", but the GA-EVT-5 and GA-STW-7 index rows require every `state` event for 7 days. *Fix:* add the exception to both rows.

**M6 (X). The bridge was not updated for voice.** Bridge 0.4 has no `speech` or `media.announce`, and its `personal` list ("any of `app`, `camera_in_use` and `microphone_in_use`") contradicts GA-DESC-9. *Fix:* revise the bridge and amend GA-BRIDGE-38.

**M7 (T). Nothing requires a barge-in to cut playback.** "MUST cut it only once the speech is a person's" only restricts cutting. A front that never cuts passes, and "the wake word cuts playback too" has no MUST. *Fix:* state both cuts as MUSTs with an id.

**M8 (I). A whole-state action can run before any state is assumed.** GA-BRIDGE-73 builds any key left out "from the model's default", so the first «22 °C» after adoption sets whatever mode the model defaults to. *Fix:* a `whole_state` action with no assumed value for a frame key is `refuse(invalid_args)` or put to a person.

**M9 (T). "Another cause ducked" cannot be seen.** GA-LISTEN-5 says "duck no device that another cause ducked", but `media.duck` is stateless. *Fix:* define it as ducks this steward dispatched for another cause.

#### LOW

**L1 (T). Guessed constants gate a pass.** The clock tolerance (1 s), the source delay, the failure bound, the arbitration window, the utterance lifetime, the late-ack slack and the rule retry spacing are all guesses. Only voice promises cases "well inside or well outside". *Fix:* the same clause in every standard.

**L2 (T, A). The front's `describe` restrictions have no id.** The front sees "only its endpoints ... the ids of the registered persons", but nothing tests it. *Fix:* fold it into GA-AUTH-8.

**L3 (A). A restart ends the follow-up duty.** GA-BRAIN-15 says "a brain's restart ends it", so a brain can escape the duty by restarting. *Fix:* persist the duty, or bound restarts in the harness.

**L4 (X). The applier gives two shapes for a transport.** *Operations* lists "`{ id, kind, up, bridge }`" with no `state`, unlike *Transports*.

**L5 (T). The brain's held-out set is out of date.** It says "HS1–HS16 ... HS19 and HS23", but HS20 to HS27 exist and the voice walk covers them.

**L6 (X, Hard rules). README.md breaks the repository's rules.** It names a private research repository by its local path and its private remote, and its `standard/` row omits voice.

**L7 (I). The voice level table is inconsistent.** It puts "skill sessions held open" under Converse, but GA-VOICE-16's hold is at Listen, and "ends a skill session after each reply" has no id.

Would R1 and R3 have been made had the result gone the other way? R3 no. It trades a safety floor for RF-socket convenience. R1 only with a stale-value guard.

## Scenario walk

**W**, a Claude Opus subagent with the scenario prompt unchanged: 1 blocker, 14 should-fix, 14 nits. HS 21 drive, 5 partly, 1 cannot (was 23, 3, 1); VS 6 drive, 5 partly (was 7, 4).

Five readers split the scenarios: HS1–9, HS10–18, HS19–23, HS24–27 and VS1–11. Each read the diffs of `b54d2d3`, `c34a20a` and `ee330c1` and checked every cited id against its index row. The lead re-checked the three findings that move a grade, and HS4's. Nothing was edited.

#### Verdicts

Only rows that changed are listed. Every other scenario keeps its grade: HS1–11, HS13–22, HS24–27, VS1–2 and VS4–11.

| Scenario | Old | New | Reason |
|---|---|---|---|
| HS12 | ✅ (ruling) | ⚠️ partly | A `whole_state` step can carry a stale assumed mode (F1) |
| HS23 | ✅ | ⚠️ partly as written | «Выключи ему компьютер» has no wake word, and nothing admits it (F2) |
| VS3 | ✅ | ⚠️ partly as written | Its brain names `front_version` 0.4. Since `ee330c1`, GA-VOICE-7 merges only for 0.5 or later (F3) |

**Counts.**
- HS: 21 drive, 5 partly (HS11, HS12, HS13, HS16, HS23) and 1 cannot (HS26). Before: 23 / 3 / 1.
- VS: 6 drive, 5 partly (VS1, VS3, VS4, VS7, VS8) and 0 cannot. Before: 7 / 4 / 0.
- HS23 and VS3 drive again once their text is fixed.

#### Findings

One blocker, 14 should-fix and 14 nits: 29 in all.

**Blocker**
- **F1, HS12, planning the AC.**
  - The text: GA-APPLY-16 says "as it stands before the action"; GA-STATE-4 says the state "changes when an action ends `sent`"; GA-PLAN-7 says only "Steps are dispatched in request order".
  - What goes wrong: step 2 (`set_setpoint 22`) is built before step 1 (`set_mode cool`) ends. It carries last night's `mode: off`, and the AC stays off. The text also never says what `unanswered` does to the assumed state.
  - Fix: carry the assumed state "after every earlier step of the same apply on that device", and define what `unanswered` does to it.

**Should-fix**
- **F2, HS23, the second command.** GA-VOICE-6: "a follow-up window opens only after the piece with `invites_reply` … played `full`". Nothing shows the hall satellite has `follow_up` on, so the brain never hears the command and no clip plays (GA-VOICE-11). Fix: write «Галатея, выключи ему компьютер», or add the follow-up hop.
- **F3, VS3's setup and merge hop.** GA-VOICE-7: "one brain whose `front_version` is 0.5 or later". Fix: change 0.4 to 0.5.
- **F4, HS5, person → satellites.** Same cause: the hop says "0.4 or later". Fix: change it to 0.5.
- **F5, HS23, the hall satellite.** GA-BRAIN-4: "among duplicates at endpoints giving different roles, the one giving the lowest". If the living-room satellite also hears Дмитрий, he becomes a guest. Fix: state separate zones, or record this as residue.
- **F6, HS4, a leak sensor dies.**
  - The text: GA-SAFE-7's row has only "clears only on reported values". "Every sensor it reads is `live`" appears only in the *Latches* prose.
  - Why it matters: a sensor that died on "dry" lets the latch clear, and nothing tests the clause.
  - Fix: add the clause and a negative subject to the row.
- **F7, VS3's reply.** GA-BRAIN-4 lists no `say`, so GA-BRAIN-18 does not keep a personal value at the endpoint that heard it. Fix: a `say` `in_reply_to` an utterance names an endpoint where it was heard.
- **F8, VS7, Brain → front.** GA-VOICE-11 plays the clip unless "no `hush` named it", and `hush { endpoint }` does not name the utterance. Fix: also send `hush { utterance_id }`.
- **F9, VS11, the fallback.** GA-LISTEN-2 says only "issue a notice". GA-NOTE-3 and GA-RULE-8 add "delivered and retried as GA-NOTE-1's". Fix: add that clause to GA-LISTEN-2.
- **F10, HS24, the first hop.** GA-CONF-1: "an answer through a brain only naming the same one". The wake yes also needs his `gate` hint, and a follow-up needs the kitchen's `follow_up` on (GA-VOICE-6). Fix: reword the hop.
- **F11, HS24, the grades row.** "✅ GA-BRAIN-7" predates voice. Fix: grade it on GA-BRAIN-1, 2, 11 and 22, GA-CONF-6 and GA-VOICE-14. Add HS24 and HS26 to the gate-model item under *The installation*.
- **F12, HS26, "one question".**
  - The text: *Default tiers* makes a plugin's extension action `confirm`, and the steps plan `skip(dead)` on the sleeping laptop.
  - Why it matters: the steward's ask comes later and separately from the brain's question, and the brain's question is not bound by GA-BRAIN-22.
  - Fix: record in the HS26 plan that the tiers and planning on a dead laptop decide this.
- **F13, HS27, adoption.** The *Links* section: "Each device has its own key, which the front's configuration binds to one endpoint". A replacement needs the new key bound to the existing endpoint and the old key unbound. `define` of a new endpoint would drop its gate models. Fix: reword the hop.
- **F14, VS8, the first hop.** The boiler's fault has no notice cause of its own. GA-BUS-12 covers only a bridge `faults` entry, not an adapter. Fix: cite GA-BUS-12, or say the hop rests on the adapter.
- **F15, HS2, «Ушли».**
  - The text: GA-SCN-3: "a yes to `ask(toggle_only)` … stands for `ask_expiry_s`" (300 s).
  - Why it matters: if «Ушли» selects the IR TV or AC, the scenario's `delay` remedy outlives the yes, and the step ends `skipped(not_confirmed)`.
  - Fix: say «Ушли» selects lights only, or state this cost.

**Nits**
- F16, HS11: GA-SCHED-1 and GA-RULE-1 do not say the steward runs offline. Cite the sections instead.
- F17, HS15: GA-BRAIN-12 exempts only a question "played `full`". Say what happens when she cuts it off.
- F18, HS16: the front keeps utterances "at least 3600 s", which the harness does not check, while `history` keeps the claimed yes 7 days. Say so, or make it a voice requirement.
- F19, HS5: which room wins is the brain's or front's choice (brain *One utterance*). Mark the room ungraded.
- F20, HS9: GA-LEASE-1 leases Лиза's lamps for 7200 s against any later rule. Say so.
- F21, HS6: the only Станция is in the kitchen. Name the speaker the plan ducks.
- F22, HS24: GA-DESC-12 lists the rest in `ungoverned`. Add the lock button to it.
- F23, HS25: the grades row says "✅ GA-BRAIN-7" but the verdict says the reply is ungraded. Align them.
- F24, HS26: the speaker hint gives no basis. Add `hint_basis: gate`.
- F25, *The computers in the two homes* and *How to use these*: they still name bridge 0.4 / applier 0.10 / steward 0.5 / brain 0.4, and "HS19–HS26 wait for the walk". HS20–HS23 lack a voice verdict line. Update both.
- F26, HS19 and HS23: cite GA-VOICE-4, 5 and 14, not just "Voice".
- F27, the HS23 grades row: add GA-BRAIN-1, GA-BRAIN-22 and GA-CONF-6.
- F28, VS1, VS4 and VS7: GA-STW-10 is steward → applier. Cite GA-TIER-3 or *Apply*.
- F29, VS10: a visitor's «не слушай» narrows the satellite for up to 12 h (GA-LISTEN-1). Record it as residue.

#### Deferrals (GA-CONF-1 against GA-SCN-3, O-M7, O-M8/W5, O-L12)

None is a blocker in any VS hop.
- **O-M7.** An inflected wake word («Алису») passes GA-VOICE-20's whole-word check. Echo marking and the start-only rule still save it. This is residue.
- **O-M8.** GA-LISTEN-4 holds back a spoken copy only for a `notify` to a `speaker` or `tv`, not a `media.announce` target. VS8 passes because no ask is open.

## Dispositions, round 1

The maintainer ruled on 2026-09-27: fix both blockers now, and with them two gaps an adapter needs
(an applier's own extensions, and playback), as steward 0.7 and applier 0.12, reviewed by one
bounded round of this procedure on that change alone. Fixes in `473d227`.

| Finding | Disposition |
|---|---|
| C-B1 the privacy floor skips `visitor` | fixed: GA-AUTH-7, *Personal keys* (stricter); negative subject `shows-a-visitor-the-session` |
| W-F1 a `whole_state` step built from the state before an earlier step | fixed: GA-APPLY-16 builds it after every earlier step of the apply on that device; `unanswered` moves the assumed value as `sent` does (GA-STATE-4); negative subject `sends-the-old-mode` |
| K-H1, C-H3 a run's re-asked toggle cannot be answered (GA-CONF-1 against GA-SCN-3) | deferred: fails closed; the steward's next revision, as carried from voice round 12 |
| K-H2, C-M3 two wake-word floors (O-M7) | deferred: a structural choice carried from voice round 12; the next revision of voice and the steward |
| C-H1 the cap on an open socket does not bound on-time (R3) | deferred: the readers split (K would keep R3); a safety floor for the maintainer to rule on in the next applier revision |
| C-H2 a toggle on a closed-loop device from a stale value (R1) | deferred: as C-H1, with R1 |
| C-H4 a cut yes before the question was heard | deferred: the brain's and the steward's next revision |
| K-H3 `install` and `uninstall` concurrency and late duplicates | deferred: the bridge's next revision |
| C-M1, C-M2 the epoch check and two clocks compared | deferred: the steward's next revision |
| C-M4 a guest's misspelled announced yes | deferred: ruled residue from voice; reopened for the next revision |
| C-M5 `speech` kept only in `events`, the index rows silent | deferred: the steward's and applier's next revision |
| C-M6 the bridge not updated for voice (`speech`, GA-BRIDGE-38's list) | deferred: the bridge's next revision |
| C-M7 no MUST that a barge-in cuts playback | deferred: voice's next revision |
| C-M8 a whole-state action before any state is assumed | deferred: the applier's next revision |
| C-M9 "another cause ducked" not observable | deferred: the steward's next revision |
| K-M1, K-M2, C-L1 constants' provenance and duplication | deferred: one pass over every standard's *Constants* |
| C-L2 the front's `describe` restrictions have no id | deferred: voice's next revision |
| C-L3 a restart ends the follow-up duty | deferred: the brain's next revision |
| C-L4 two shapes for a transport in the applier | deferred: the applier's next revision |
| C-L5 the brain's held-out set out of date | deferred: the brain's next revision |
| C-L6 README names a private repository; its `standard/` row omits voice | deferred: step 0, public readiness |
| C-L7 the voice level table | deferred: voice's next revision |
| K-L1 a measured slack in a gating table | deferred: the bridge's next revision |
| K-L2 GA-LOAD-2's unreachable retry clause | deferred: the applier's next revision |
| K-L3 the goals document stale | deferred: the next goals refresh |
| W-F2 to W-F29 | deferred: the scenarios' next regrade, `docs/reference/2026-09-24-home-reference-scenarios.md` and the voice scenarios; HS12 returns to ✅ with W-F1's fix, to be confirmed by this round's walk |

## Round 2: steward 0.7 and applier 0.12

### Change record

| Rule | Where | Direction | Why |
|---|---|---|---|
| A personal key's value is withheld from `visitor` as from `guest` | steward, *Personal keys*, GA-AUTH-7 | stricter | C-B1 |
| A `whole_state` command is built only once every earlier step of the apply on the same device has ended, and carries the state they left | applier, *State and liveness*, GA-APPLY-16 | stricter | W-F1 |
| An `unanswered` action moves the assumed value, as `sent` does | applier, GA-STATE-4 | new (the text was silent) | W-F1: a whole-state code sent next carries what was last asked for rather than undoing it; a load's cap already counts `unanswered` |
| `extensions` in `describe` on any device, not only a plugin's: an applier's own, such as an adapter's for its engine's services | applier, the device fields, *Extensions* | looser | an adapter could not describe an extension, so a brain could never invoke one (the maintainer's question, 2026-09-27: can Galatea control an existing system and Home Assistant through adapters) |
| An applier's own extension action takes the extension tier: `confirm`, or its floor from its device's class, flag and load rows, lowerable only to that floor | applier, *Default tiers*, GA-DESC-3 | new | as above; the same floor a plugin's extension has, with no `requested_tier` |
| An applier's own extension action is not idempotent unless the owner declares it so at adoption | applier, *Extensions*, GA-DESC-4 | new | a reissue on an engine's word could run it twice (GA-APPLY-6) |
| `media.stop`, `media.next`, `media.previous`, `media.seek(position_s)`; `next` and `previous` never idempotent | applier, the vocabulary, *Playback*, GA-DESC-4 | new | general playback for a television, a kiosk or an engine's media player, after Matter's Media Playback cluster |

**The looser move:** `extensions` beyond plugins. What keeps it from loosening a guard: the
extension tier's floor (an adapter's `…unlock` on a `door_lock` stays `no_voice`), `confirm` by
default, and no idempotency on the engine's word.

### Readers

Pass 1 green on `6869db4`. **K2** the third-model reader (Kimi `k3`, office key, read-only; it could not run the checks). **C2** a no-context Claude Opus subagent. Counts: **K2** 0 blockers, 2 high, 3 medium, 3 low. **C2** 1 blocker, 2 high, 5 medium, 4 low.

#### K2

I have read steward.md and applier.md in full (all 1231 and 2051 lines), CONTEXT.md, README *Hard rules*, the change record (both rounds), and checked bridge.md, brain.md and voice.md where the round-2 text touches them. Three readings done: implementer, tester, attacker.

Note on process: the sandbox refused `python3 conformance/check_manifest.py` and `python3 -m unittest discover conformance` ("This command requires approval"), so manifest synchrony is unverified by me — same limitation as round 1's K reader.

##### Findings

###### HIGH

**H1 — The `speech` contradiction ships in this bump. [Tester]** Round 1's C-M5 was deferred to "the steward's and applier's next revision"; this is that revision, and the change record does not include it. GA-EVT-5 still requires `history` to return "state, outcome, `late_ack`, liveness, … events with their causes, kept at least 7 days", while the capability table says `speech` is "kept in `events`, never in `history`". Steward side identical: GA-STW-7's row lists "the applier's state … events … for 7 days" against the prose "A `state` event's `speech` key is kept only in `events`, never in `history`". A harness written from the rows fails an implementation written from the prose; the bump versions the contradiction. Fix: add the `speech` exception to the GA-EVT-5 and GA-STW-7 rows.

**H2 — GA-STATE-4's new `unanswered` clause has no negative subject. [Tester]** "A stateful action's assumed value changes when it ends `sent` or `unanswered`" is the load-bearing half of W-F1's fix ("a whole-state code sent next then carries what was last asked for rather than undoing it"), yet no subject fails if an implementation leaves the assumed value unchanged on `unanswered`. `assumes-a-failed-write` covers only `unreachable`. Such an implementation passes the whole run while reintroducing the undo. Fix: a subject — IR AC's `set_setpoint 22` ends `unanswered`, the next `set_mode` frame must carry setpoint 22.

###### MEDIUM

**M1 — GA-APPLY-16's serialization stops at the apply boundary. [Implementer]** "Within one apply, such a command is built only once every earlier step of that apply on the same device has ended." Two applies on one `whole_state` device — a person's `set_setpoint` and a rule's retry of `set_mode` (GA-RULE-7 spacing permits overlap) — interleave: the second command is built before the first ends `sent`/`unanswered`, so the assumed state has not moved; it is sent after the first and silently reverts it. The W-F1 blocker was exactly this failure, one scope wider. Fix: build a `whole_state` command only once every earlier *dispatched, unended* step on that device has ended, not only within the apply.

**M2 — An applier's own extension action has no ack path. [Implementer]** Round 2 admits extensions "on any other device, those the applier adds itself", but `confirmed_by` is "Only on a plugin's stateful extension action", and GA-EVT-3 acks a stateful action "on the key the action sets", which an extension's schema (`actions`, `keys` listed separately) never links. A non-stateless adapter extension cannot ever be `acked`; one implementer declares all own extensions stateless, another invents a key — both claim conformance. Fix: allow `confirmed_by` on the applier's own extension actions, or require them stateless.

**M3 — GA-DESC-14 still names only plugins. [Tester]** "`configure` refuses a plugin's extension action's tier below its floor … never clamping it" — the wire-visible refusal does not cover the applier's own extension actions round 2 admits, and `lowers-a-lock-extension` exercises only a plugin device. An implementation that clamps an adapter's `…unlock` on a `door_lock` instead of refusing passes. Fix: extend the row to "an extension action, a plugin's or the applier's own", with a subject variant.

###### LOW

**L1 — Stale floor wording outside the standards. [Cross-standard]** CONTEXT.md *Personal key*: "withholds its value, and its `state` events, from a guest" — no `visitor`. Brain.md's prose: "the floor that keeps personal values from a guest rests on…". Both predate the C-B1 fix they describe. Fix: add `visitor` in both.

**L2 — `confirm_on` may name a `visitor` endpoint. [Attacker]** GA-CONF-4 blocks only brain-served endpoints: "`confirm_on` MUST name an endpoint not served by a brain". An owner who points it at a museum-hall panel (`max_role: visitor`, the role whose whole point is untrusted space) lets any passer-by answer the owner's asks and earn tokens. Owner-set, as the residue rulings say — but the standard already guards the parallel brain case. Fix: `define` refuses a `confirm_on` naming an endpoint whose `max_role` is `visitor`.

**L3 — Four new vocabulary rows rest on a non-normative table. [Tester]** The intro makes only MUST-sentences and *Requirement index* rows normative; `media.stop`/`next`/`previous`/`seek` live in the capability table, which no index row pins as a whole (GA-DESC-4 covers only `next`/`previous` idempotency). Pre-existing pattern, but round 2 widened it. Fix: one index row making the vocabulary table normative.

###### The looser move, counterfactual

`extensions` beyond plugins is the only looser row. The guards ported with it — the floor from class/flag/load rows (`no_voice` on a `door_lock`), `confirm` by default, no idempotency on the engine's word, and GA-DESC-12's ban on arbitrary-command entities reading "any capability", extensions included — hold for every case the change record names. The soft spot (floor `reversible` on a no-class device) is ruling 5, identical to plugins. The author would have made it either way: it opens a seam that was closed entirely and relaxes no existing guard — but M2 and M3 show the port is incomplete, and H2/M1 show W-F1's fix is one race narrower than its own reasoning. No rule in this round moved looser in a way a reversed result would have prevented.

###### Deferred items assigned to this revision but absent

Besides H1: C-M8 (a first-ever `whole_state` command still carries model defaults), C-M9, K-L2, C-L4. If 0.7/0.12 is "the steward's/applier's next revision" the disposition table promised, these need either text or a re-deferral naming 0.8/0.13.

Repository rules: clean — no numbered sections, no private references, citations by symbol; the other system named is public and external.

#### C2

Read in full: `standard/steward.md`, `standard/applier.md`, and the diff of `473d227`. Readings: I = implementer, T = tester, A = attacker.

##### BLOCKER

**B1 (A).** An applier's own extension can reach any device, but its floor is taken from the device it is *listed on*. Quotes: "on any other device, those the applier adds itself, such as an adapter's for a service of its engine that no standard capability covers", and "its floor is the tier the class, flag and load rows give its device, and `reversible` where none names it". Home Assistant services take target entities. An adapter can put `script.turn_on` or `call_service` on a speaker or sensor device, and then:
- it is `confirm`, which a brain's spoken yes answers, and the owner may lower it to `reversible`;
- it unlocks a door or opens a valve by voice, although "The model never unlocks a door, whatever the endpoint";
- leases, `internal`, `refuse(safety)` and latches are keyed on the target, so none of them sees it.

The change record's defence, "an adapter's `…unlock` on a `door_lock` stays `no_voice`", holds only if the adapter author chooses that device, and nothing on the wire can test that choice. Counterfactual: the change came from a product question, and nobody checked it against the service model.
*Fix:* an applier's own extension action MUST change only the device it is declared on, and take no argument that names another entity or device; otherwise its floor is `no_voice`.

##### HIGH

**H1 (I).** The fix for W-F1 covers only one apply. GA-APPLY-16 says "within one apply it is built only once every earlier step on that device has ended". GA-STW-10 says "one applier apply per steward apply, rule firing or run step". So the scenario steps «cool» and «22» are two applier applies, and so are a brain's two requests, or a rule firing during a person's apply. The setpoint frame still carries the old mode. HS12 may not really be ✅.
*Fix:* for each `whole_state` device, build every command after all earlier dispatched steps on that device have ended, whichever apply they came from.

**H2 (I/T).** The wait has no synchronous outcome and outlives its token.
- A step waiting on an earlier one (up to `ack_within_s`, which may be 300 s) has none of `dispatched`, `skipped`, `refused` or `unreachable` to return. So `apply` either blocks, breaking GA-APPLY-1 and GA-STW-9, or invents an enum value.
- The step's token "expir[es] 60 s after issue", so a `confirm` whole-state step behind a slow step ends `refused(token)`.

*Fix:* add a synchronous `queued` outcome. Also either judge the token when the step is queued, or state that the steward re-issues it.

##### MEDIUM

**M1 (I, cross-standard).** Lowering an extension's tier is still limited to plugins in four places:
- the `configure` list: "except an extension action from a plugin";
- GA-DESC-14: "a plugin's extension action";
- GA-DESC-15: "on a plugin's extension action";
- the steward's *Tiers and confirmation*: "except an extension action from a plugin".

Against *Default tiers* ("its kiosk's `…navigate` is `confirm` until the owner lowers it"), two implementations can differ here and both claim conformance. *Fix:* write "an extension action" in all four.

**M2 (I).** An applier's own stateful extension action can never be acked. GA-EVT-3 matches only "for a plugin's extension action, its `confirmed_by`", and `confirmed_by` is "Only on a plugin's stateful extension action". *Fix:* extend `confirmed_by` to the applier's own extensions, or require them to be `stateless`.

**M3 (A/I).** An engine can add an extension to an already adopted device, or change its schema, at any time. When it does:
- no owner reviews it;
- it can never be declared idempotent ("at adoption");
- a lowered tier or an `idempotent: true` survives the schema change, since GA-DESC-11 and GA-DESC-15 fire only on a plugin's replacement.

*Fix:* an extension action that is new or changed on an adopted device is refused until the owner accepts it through `configure`. On a change, the owner's values fall back.

**M4 (I).** "`pause`, `resume` and `stop` set `playing`". A paused player therefore reads `already` for `media.stop` and never gets it, although stopping is not pausing (Matter's Stop is distinct from Pause). *Fix:* make `stop` stateless and never `already`, or give it a state of its own.

**M5 (T).** Gaps in the negative subjects:
- `sends-the-old-mode` passes a subject that copies the earlier step's arguments without waiting. No subject has the earlier step end `unreachable`, where the frame must keep the old mode.
- No subject covers GA-STATE-4's new `unanswered` clause.
- No subject covers the floor of an applier's own extension (for example, an adapter's `door_lock` extension lowered to `reversible`).
- `sends-the-old-mode` lists GA-PLAN-7 under *May also fail* with no reason.

*Fix:* add these subjects and the reason.

##### LOW

**L1 (cross-standard).** CONTEXT.md, *Personal key*: "withholds its value … from a guest". *Fix:* add "or a visitor".

**L2 (A, the looser move in GA-STATE-4).** An assumed value may now come from an `unanswered` command that never went out. The brain still says it "as what was last sent" (GA-BRAIN-7). *Fix:* the brain's wording becomes "last asked for".

**L3 (T).** "`next` and `previous` **no**" is graded only statically by GA-DESC-4. No subject reissues a `media.next`. *Fix:* add `reissues-a-next`.

**L4.** The frontmatter still says 0.6 and 0.11, and neither changelog has a 0.7 or 0.12 row. *Fix:* add them at the bump.

##### Other checks

- **Repository rules** (no private references, no numbered sections, citations by symbol): nothing found in either file. `check_manifest.py` is clean.
- **The visitor fix (GA-AUTH-7):** sound. `role` sorts before every occupancy and `in_use` reason, so a visitor's verdicts leak nothing.

Counts: BLOCKER 1, HIGH 2, MEDIUM 5, LOW 4.

### Scenario walk

**W2**, Claude Opus: HS 21 drive, 5 partly (HS1, HS11, HS13, HS16, HS23), 1 cannot (HS26). HS12 back to ✅; HS1 down for N1. Eight new findings (1 blocker, 4 should-fix, 3 nits); round 1's 21 carried unchanged. VS not walked.

In scope: the home scenarios only. The VS scenarios are in another file, and the prompt did not name it. Nothing was edited.

##### Verdicts

Only rows that changed are listed. Every other scenario keeps its round 1 grade.

| Scenario | Old | New | Reason |
|---|---|---|---|
| HS12 | ⚠️ partly | ✅ | W-F1 is fixed within one apply. GA-APPLY-16: "Within one apply, such a command is built only once every earlier step of that apply on the same device has ended". GA-STATE-4 also moves the assumed value on `unanswered` |
| HS1 | ✅ | ⚠️ partly | Its AC steps (`set_mode heat`, then `set_setpoint 22`, "as HS12's") run in a scheduled run. Each run step is its own applier apply, so the fix does not reach them (N1) |

Counts: 21 drive, 5 partly (HS1, HS11, HS13, HS16, HS23), 1 cannot (HS26). Round 1 had the same numbers, 21 / 5 / 1, with HS12 in place of HS1.

##### New findings

**Blocker**
- **N1, HS1, the hop "Steward → applier".**
  - The text: GA-STW-10 says "one applier apply per steward apply, rule firing or run step". GA-APPLY-16 orders the steps only "within one apply". GA-STATE-4 says the assumed value "changes when an action ends `sent`".
  - What goes wrong: run step 2 is re-planned and dispatched once step 1 is `dispatched`, and the bridge's `sent` may not have come yet. Step 2's frame then carries `mode: off`, and the AC ends off. This is W-F1 again, by another path. It also hits two back-to-back applies from a brain.
  - Fix: build a `whole_state` command only once every earlier action dispatched to that device, from any apply, has ended. Add a negative subject over two run steps.

**Should-fix**
- **N2, HS9, the gate's trust paragraph ("nobody opens it by voice"). This may be a blocker.**
  - The text: an adapter's own extension may be "a service of Home Assistant's that no standard capability covers". Its floor is "the tier the class, flag and load rows give its device, and `reversible` where none names it".
  - What goes wrong: in the house, the gate is in Home Assistant. An adapter that maps a Home Assistant script or scene as an extension on a device with no class gives it `confirm`, and the owner may lower it to `reversible`. «Галатея, да» with Сергей's hint, or a brain that answers itself (HS16), then opens the gate. The floor follows the class of the device that carries the extension, not what the service does. That breaks the ruling that `no_voice` never passes through a brain.
  - Fix: an applier's own extension that can move other devices (a script, scene, automation or generic service call) is `no_voice`, or is left unmapped and listed in `ungoverned`.
- **N3, HS24, the hop "Adapter".**
  - The text: GA-DESC-12 requires an allowlist only to map an entity "to `power` or `session`".
  - What goes wrong: an extension on the study PC needs no allowlist. The allowlist is what stops anyone on the engine's broker from announcing a matching entity, including a generic button that runs a shell.
  - Fix: apply the allowlist to every capability an adapter maps on a computer, extensions included.
- **N4, HS6, the vacuum (now reachable as an adapter extension).**
  - The text: `confirmed_by` is "Only on a plugin's stateful extension action".
  - What goes wrong: an adapter's stateful extension (the vacuum's pause) has no key that can confirm it, so it can only end `failed(no_ack)`.
  - Fix: allow `confirmed_by` on any extension action.
- **N5, HS12, the hop "Applier, AC, applying".**
  - The text: the synchronous outcomes are only `dispatched`, `skipped`, `refused` and `unreachable`. The steward issues tokens "at dispatch … expiring 60 s after issue".
  - What goes wrong: a step GA-APPLY-16 holds back has no synchronous outcome to report. A held `confirm` step can also outlive its token, since an earlier `unanswered` may take up to 300 s.
  - Fix: name a pending outcome, and check a held step's token when it is actually dispatched, or issue the token then.

**Nits**
- N6, HS12: the hop still cites "as it stands before the action". Add GA-APPLY-16's within-apply clause to the hop and to the grades row.
- N7, HS6: the "(no vacuum)" in the grades row, and the applier's line "A vacuum cleaner: not in this version's vocabulary", are now only half true. Say that an adapter extension can reach it, at `confirm`.
- N8, HS13: the residual-risk paragraph names only "a plugin's extension action". Add an applier's own.

##### Carried from round 1, re-checked and unchanged

The scenario text has not been edited since round 1, so none of these is fixed. W-F6 still stands in the applier as well: GA-SAFE-7's row has no "every sensor it reads is `live`".
- **Should-fix (9):** F2 and F5 (HS23), F4 (HS5), F6 (HS4), F10 and F11 (HS24), F12 (HS26), F13 (HS27), F15 (HS2).
- **Nits (12):** F16 (HS11), F17 (HS15), F18 (HS16), F19 (HS5), F20 (HS9), F21 (HS6), F22 (HS24), F23 (HS25), F24 (HS26), F25 (*The computers in the two homes*, *How to use these*), F26 (HS19, HS23), F27 (HS23).

##### Checked with no finding
- **GA-AUTH-7 for `visitor`:** no home scenario has a visitor endpoint.
- **`unanswered` moving the assumed value:** consistent with HS15's toggle and the loads' cap.
- **Playback actions:** no scenario uses them.
- **HS22's lowered extension tier:** unchanged.
- **HS19's launch:** unchanged.

##### Totals

- 8 new findings: 1 blocker, 4 should-fix (N2 possibly a blocker) and 3 nits.
- 21 carried from round 1: 9 should-fix and 12 nits.

### Dispositions, round 2

Fixes in `fccb449`; pass 1 green after them.

| Finding | Disposition |
|---|---|
| W2-N1, C2-H1, K2-M1 GA-APPLY-16 ordered only within one apply | fixed: each key from the latest earlier action on the device, from any apply, once dispatched and unless it ended `failed` or `unreachable`; subjects `sends-the-old-mode` (two applies), `keeps-a-failed-mode` |
| W2-N5, C2-H2 a held step has no synchronous outcome and outlives its token | fixed by the same change: nothing is held back |
| C2-B1, W2-N2 an applier's own extension reaches other devices under its host device's floor | fixed: it acts only on its device, with no argument naming another; scripts, scenes, automations and generic service calls are not offered, and stay in `ungoverned` (GA-DESC-18, stricter) |
| C2-M3 an extension added or changed after adoption | fixed: `refuse(not_adopted)` until the owner accepts it; a changed schema drops the owner's lowered tier and `idempotent: true` (GA-DESC-18) |
| C2-M1, K2-M3 lowering worded for plugins only | fixed: *configure*, GA-DESC-14, the extension tier, the steward's *Tiers and confirmation*; subject `lowers-an-adapters-unlock`. GA-DESC-15's tool hash stays a plugin's; GA-DESC-18 covers the applier's own |
| C2-M2, K2-M2, W2-N4 no ack path for an applier's own stateful extension | fixed: `confirmed_by` on any stateful extension action; GA-EVT-3 |
| W2-N3 the computer allowlist skips extensions | fixed: GA-DESC-12 covers an adapter's own extensions on a computer |
| C2-M4 `stop` shared `playing` with `pause` | fixed: `stop` stateless |
| K2-H1 `speech` against the history rows (round 1's C-M5) | fixed: GA-EVT-5 and GA-STW-7 |
| K2-H2, C2-M5 no subject for the `unanswered` clause; gaps in subjects | fixed: `forgets-the-unanswered`, `keeps-a-failed-mode`; `sends-the-old-mode` no longer names GA-PLAN-7 |
| C2-L3 no subject reissues a `media.next` | fixed: `reissues-a-next` |
| C2-L1, K2-L1 CONTEXT and brain prose name only a guest | fixed in CONTEXT; the brain's sentence deferred to the brain's next revision (it describes the floor, and rests on GA-AUTH-7, which is right) |
| C2-L2 the brain says an assumed value "as what was last sent" | deferred: the brain's next revision ("last asked for") |
| C2-L4 front matter and changelogs | fixed at the bump |
| K2-L2 `confirm_on` may name a visitor endpoint | deferred: the steward's 0.8; a stricter floor, outside this change |
| K2-L3 the vocabulary table has no index row | deferred: applier 0.13 |
| W2-N6 to N8, and round 1's W findings | deferred: the scenarios' next regrade |
| K2's list of round 1 deferrals not taken up (C-M8, C-M9, K-L2, C-L4) | re-deferred to steward 0.8 and applier 0.13; round 1's "next revision" means the one after this |

## Round 3: the round 2 fixes

### Change record

| Rule | Where | Direction | Why |
|---|---|---|---|
| A `whole_state` command takes each key from the latest earlier action on the device, from any apply, once dispatched and unless it ended `failed` or `unreachable`; nothing is held back | applier, *State and liveness*, GA-APPLY-16 | moved (replaces round 2's wait within one apply) | W2-N1, C2-H1, C2-H2 |
| An applier's own extension acts only on its device and names no other; scripts, scenes, automations and generic service calls are not extensions | applier, *Extensions*, GA-DESC-18 | stricter | C2-B1, W2-N2 |
| An extension added or changed on an adopted device waits for the owner; a changed schema drops the owner's lowered tier and `idempotent: true` | applier, *Extensions*, GA-DESC-18 | stricter | C2-M3 |
| `confirmed_by` on any stateful extension action | applier, the action fields, GA-EVT-3 | looser (a plugin's only before) | C2-M2: otherwise an adapter's stateful extension could never be acked |
| Lowering an extension's tier to its floor covers the applier's own | applier, *configure*, GA-DESC-14; steward, *Tiers and confirmation* | moved (round 2 said so in *Default tiers* only) | C2-M1 |
| The computer allowlist covers an adapter's own extensions | applier, GA-DESC-12 | stricter | W2-N3 |
| `media.stop` stateless | applier, the vocabulary, *Playback* | moved | C2-M4 |
| `speech` excepted in `history` | applier GA-EVT-5, steward GA-STW-7 | moved (the prose already said so) | K2-H1 |

### Readers

Pass 1 green on `2de19e4`. **K3** Kimi `k3` (office key, read-only; could not run the checks): 0 blockers, 1 high, 3 medium, 4 low. **C3** Claude Opus, no context: 0 blockers, 2 high, 5 medium, 5 low.

#### K3

The sandbox refused `python3 conformance/check_manifest.py` and the unittest discover, so manifest synchrony is unverified by me — same limitation as round 1's and round 2's K readers.

#### Round 3 reader report — steward 0.6→0.7, applier 0.11→0.12

Read in full: `standard/steward.md`, `standard/applier.md`, CONTEXT.md, README.md, the goals document, the change record (all three rounds), and the diff of `fccb449`; bridge.md and brain.md where the round-3 text touches them. Readings: I = implementer, T = tester, A = attacker, X = cross-standard / repository rules.

##### HIGH

**H1 (I). GA-DESC-18's acceptance has no operation.** "one an engine adds to an adopted device, or whose schema it changes, is `refuse(not_adopted)` until the owner accepts it through `configure`" — but the *configure* change list (`clients; tiers; loads…; adopt; ignore_candidate…; fresh_s; accepts_other_admins`) enumerates every kind `configure` takes and has none that accepts an extension. The owner of an adapter whose engine added a service has no defined way to lift the refusal short of re-`adopt`ing a device that is already adopted. Two implementers will pick different mechanisms (a tier set? a dedicated kind? re-adoption?) and both claim conformance. Fix: add an `accept_extension` change kind to the *configure* list and name it in GA-DESC-18.

##### MEDIUM

**M1 (I). GA-APPLY-16: the action's own key in `state`.** "carries in `state` the device's assumed value of every key the applier holds one for … the one the latest earlier action on the device sets". "Earlier" excludes the command's own action, so for `climate.set_setpoint 22` the `setpoint` entry of `state` is the *old* value, and the frame is correct only because GA-BRIDGE-73 builds the code from "`state` with the action's `value` applied". An implementer who omits the own key, or carries the requested value, reads the same sentence differently; all three claim conformance and the wire differs upstream of the bridge's fix-up. Fix: say the action's own key is carried with the requested value, or excluded, explicitly.

**M2 (T). GA-DESC-18's schema-change half has no negative subject.** `slips-in-a-new-service` covers only "the engine *adds* an extension action". Nothing exercises "whose schema changes … drops the owner's lowered tier and `idempotent: true`" for an applier's own extension — the exact attack GA-DESC-11/GA-DESC-15 guard for plugins. A subject that keeps a lowered adapter `…unlock` across a schema change passes. Fix: add `keeps-a-lowered-tier-over-a-new-schema`.

**M3 (T). `sends-the-old-mode` has an uncontrolled race.** "Two applies a second apart, `climate.set_mode cool` then `climate.set_setpoint 22` … and the setpoint's command carries `mode: off`". If the simulated bridge acks the first command `failed` within that second, `mode: off` is the *correct* frame and a conforming subject fails the subject. Fix: the subject must hold the first command's ack until the second is published.

##### LOW

**L1 (I). A false sentence in GA-APPLY-16's prose.** "an earlier action that ends `failed` or `unreachable` leaves the mode as it was". If `set_mode cool` ends `failed` after the `set_setpoint` frame already went out carrying `mode: cool`, the device *is* cool. The sentence is true only of which value a later command carries; as written it misstates the outcome. Fix: scope it to command construction ("…is not taken into later commands").

**L2 (X). The steward's lowering sentence still omits GA-DESC-11.** Steward *Tiers and confirmation*: "The owner may raise a declared tier through the applier's `configure`, and never lower it, except an extension action…". The applier allows one further lowering: deleting a tier a replacement kept when the new manifest lowered `requested_tier` ("the one lowering of a standard action `configure` makes (GA-DESC-11)"). Round 3 touched this sentence and left the contradiction. Fix: name the GA-DESC-11 case.

**L3 (A/T). GA-DESC-18's "not checked by the harness" concedes more than needed.** The single-device clause is uncheckable for what an engine *does*, but the declared schema is in `describe`: a static check that no argument of an applier's own extension names a device or entity is possible. Fix: grade the schema check `static`, keep only the behavioural half unchecked.

**L4 (X). Round-1 C-L6 confirmed still unfixed** (deferred to step 0): README's "What does not" names a private repository's local path and remote. No action beyond the existing disposition.

##### Verified fixes (round 3's change record)

- GA-APPLY-16 cross-apply ordering: text and row now read "from whichever apply it came, once dispatched and unless it has ended `failed` or `unreachable`", with subjects `sends-the-old-mode` (two applies), `keeps-a-failed-mode` and `forgets-the-unanswered`; the token-outliving problem of round 2's wait is gone because nothing is held back. Sound modulo M1/L1.
- GA-DESC-18: the C2-B1 hole is closed in prose and row; GA-DESC-12's allowlist now covers "an extension of its own" on a computer, prose and row; GA-DESC-14 and the *configure* list say "a plugin's or the applier's own"; subject `lowers-an-adapters-unlock` present.
- `confirmed_by` on any stateful extension action: field table and GA-EVT-3 agree; bridge's `confirmedBy` is the plugin path, "from the applier itself" the other.
- `media.stop` stateless: table, *Playback* and GA-APPLY-7 consistent; C2-M4's `already`-on-pause gone.
- GA-EVT-5 and GA-STW-7 rows now carry the `speech` exception; steward prose and CONTEXT agree.
- Repository rules: no numbered sections, no private references, citations by symbol — clean in the diff.

##### Looser move, counterfactual

The only looser row is `confirmed_by` widened from plugin-only to any stateful extension. The alternative (forcing adapters' stateful extensions to be stateless) loses the ack path entirely (HS6's vacuum); a misdeclared key fails closed as `failed(no_ack)`. It would have been made had the round-2 outcome gone the other way.

Frontmatter versions still read 0.6 / 0.11 with no 0.7 / 0.12 changelog rows — expected pre-bump (C2-L4); verify at the bump.

#### C3


I read both files in full, and the round 3 change record. Readings: I is the implementer, T the tester, A the attacker, X the cross-standard and repository checks.

##### BLOCKER

None.

##### HIGH

**H1 (I, A). GA-APPLY-16 without the wait brings W-F1 back through a race.** The rule takes each key from "the latest earlier action … once that action is dispatched and unless it has ended `failed` or `unreachable`". An earlier `set_mode cool` that is still in flight is therefore carried into the setpoint's frame. If that earlier action then ends `failed` or `unreachable`, the setpoint frame has already put the AC in `cool`. GA-STATE-4, however, moves only "a stateful action's assumed value", which is the setpoint and not the mode. The assumed mode stays `off`, and the next frame turns the AC off. The prose claim, "an earlier action that ends `failed` or `unreachable` leaves the mode as it was", is false in this case. The change record calls this change "moved", but it is looser: it drops round 2's guarantee in exchange for a synchronous outcome. *Fix:* when a `whole_state` command ends `sent` or `unanswered`, every key its frame carried becomes assumed. Add a subject where step 1 ends `failed` after step 2 has been built.

**H2 (I). `speech` is not `self_changing`, so every speaking TV is leased by `external`.** GA-DESC-9 declares `speech` `personal` only. GA-EVT-1 says "Every state change the applier did not make, other than a `self_changing` key, MUST be reported with cause `external`". `media.announce` is stateless and sets no key, so even the speech that the steward's own announcement causes is `external`. GA-LEASE-2 then gives the TV a `person` lease for `hold_time_s` every time it speaks, and every rule on it is `refuse(leased)`. After a `cursor_expired`, the read-back from `history` finds none of these leases, because `speech` is "kept in `events` only". So the live path and the recovered path disagree. *Fix:* add `speech` to the keys this standard declares `self_changing`, in GA-DESC-9. Also check `playing` on a `tv`.

##### MEDIUM

**M1 (I). No `configure` kind exists to accept an extension, and nobody is told one is waiting.** GA-DESC-18 says an added or changed extension is refused "until the owner accepts it through `configure`". *configure*'s list has no such change kind, and no notice announces the arrival. GA-DESC-4 still reads "unless the owner declared it so at adoption", so an extension accepted later can never be idempotent (C2-M3 is half fixed). *Fix:* add `accept_extension { device, capability, idempotent?, tier? }`, a notice when an extension arrives or changes, and "at adoption or acceptance" in GA-DESC-4.

**M2 (A). GA-DESC-18 re-reviews only a changed schema.** "whose schema it changes" leaves out a changed `confirmed_by`, a change to `stateless`, and a changed description. An engine that repoints `confirmed_by` or makes an action stateless changes how it is acked, and the owner never sees it. There is also no `tool_hash` equivalent for an engine's service. *Fix:* any change to an extension's declaration requires acceptance again.

**M3 (A). A `whole_state` frame gets around the tiers.** A guest's `reversible` `set_setpoint` frame carries the assumed `on` and `mode`. If the unit was switched off by its remote, which nothing sees, the frame turns it on. It does this even where the owner raised `onoff.turn_on` to `confirm`. *Fix:* a `whole_state` step's effective tier is the highest tier of the actions whose keys its frame carries. Otherwise, name it as residue in *What this standard does not define*.

**M4 (A, a looser move not marked). `media.stop` stateless.** The record says "moved". But a stateless action takes no lease ("Stateless actions take none", GA-LEASE-1), and it ends `delivered` on the engine's word instead of `acked` on `playing: false`. A person's «стоп» no longer holds the TV against a rule's `resume` or `launch`, while their «пауза» still does. *Fix:* record it as looser, or keep `stop` stateful on `playing: false` with a named exception from `already`.

**M5 (T). `forgets-the-unanswered` cannot fail GA-STATE-4.** By GA-APPLY-16, the "latest earlier action" (the `unanswered` setpoint 22, which is not `failed` or `unreachable`) supplies 22 whatever the assumed value is. So the mutation passes. *Fix:* observe the assumed `setpoint` in `state`, or across a restart.

##### LOW

**L1 (X).** *Outcomes* still reads "a plugin's extension action matches its `confirmed_by`". This contradicts round 3's field row and GA-EVT-3 ("for an extension action"). *Fix:* write "an extension action".

**L2 (T).** GA-DESC-18 is `Verify: wire`, but its first clause is "(not checked by the harness)". *Fix:* split it into a row of its own. Also add subjects for a changed schema that drops a lowered tier or `idempotent: true`, and for an applier's own `confirmed_by` ack. Neither has one.

**L3 (T).** *Conformance* gives the simulated engine the ability to "stop and slow" and to "expose a computer". It does not say the engine can expose a `door_lock` with its own extension, or add or change extensions. `slips-in-a-new-service`, `lowers-an-adapters-unlock` and `trusts-an-engines-idempotent` all need that. *Fix:* say so.

**L4 (T).** In `slips-in-a-new-service` (may fail GA-ADOPT-1) and `lowers-an-adapters-unlock` (may fail GA-DESC-3), *Why those* describes the mutation instead of explaining the extra failure. *Fix:* give the reasons.

**L5 (I).** `refuse(not_adopted)` is used for an adopted device's unaccepted extension. A steward or brain will tell the person the device is not adopted. *Fix:* say in the reason table that this reason covers an unaccepted extension, or add a reason.

##### Other checks

- **Repository rules:** clean. No numbered sections, no private references (the other system named is public), citations by symbol, and every `docs/` path cited exists.
- **Round 3's other moves:**
  - GA-DESC-12's extension clause: sound.
  - GA-DESC-14 and the steward's *Tiers and confirmation*: they agree.
  - The `speech` exception in GA-EVT-5 and GA-STW-7: agrees with the prose, apart from H2.
- **Counterfactual:** the author would probably not have made H1's change if the race had been shown. M4 would probably have been made anyway, but it should be recorded as looser.

Counts: BLOCKER 0, HIGH 2, MEDIUM 5, LOW 5.

### Scenario walk

**W3**, Claude Opus, HS and VS: HS 22 drive, 4 partly (HS11, HS13, HS16, HS23), 1 cannot (HS26); VS 6 drive, 5 partly. 12 new findings (0 blockers, 3 should-fix, 9 nits); 31 carried; W2-N1 to N5 fixed.


W3, five Claude Opus readers (HS1–9, HS10–18, HS19–23, HS24–27, VS1–11). Each walked every hop of its range against the round 2 and 3 text. The lead checked the two merged should-fix findings and E2 against the text. Nothing was edited. Round 2 (W2) walked HS only, so VS is compared with round 1's walk. Two readers read only the sections their hops cite, not every standard end to end.

##### Verdicts

| Scenario | Old | New | Reason |
|---|---|---|---|
| HS1 | ⚠️ partly | ✅ | N1 is fixed. GA-APPLY-16 takes each key from "the latest earlier action on the device, from any apply, once dispatched", so the run's `set_setpoint 22` carries `mode: heat` |
| HS12 | ✅ | ✅ (new basis) | "no step waits for another to build it" (GA-APPLY-16) keeps W-F1 fixed and removes W2-N5's held step. The edge case below (G1) is off its path |
| All others | — | unchanged | None of the round 2/3 rules (GA-APPLY-16, GA-STATE-4's `unanswered`, GA-DESC-12/14/18, `confirmed_by`, playback, `speech` out of `history`, GA-AUTH-7's `visitor`) moves a hop in them |

**Counts.**
- HS: 22 drive, 4 partly (HS11, HS13, HS16, HS23), 1 cannot (HS26). Before: 21 / 5 / 1.
- VS: 6 drive, 5 partly (VS1, VS3, VS4, VS7, VS8), 0 cannot. Before: 6 / 5 / 0.

##### New findings

Twelve: three should-fix and nine nits. Two readers found G1, and two found G2.

**Should-fix**
- **G1 (A2, B1), HS12's "Applier, AC, applying" and HS1's AC steps.**
  - The text: GA-APPLY-16 takes the mode from "the latest earlier action … once dispatched and unless it ended `failed` or `unreachable`". GA-STATE-4 says "A stateful action's assumed value changes when it ends `sent` or `unanswered`", and it moves only that action's own key.
  - What goes wrong: `set_mode cool` is dispatched, and the setpoint frame goes out carrying `mode: cool`. `set_mode` then ends `failed`. The AC is cooling, but the assumed mode stays `off`. The next whole-state frame switches the AC off, and until then the brain says it is off. This is W-F1 again, by another path. The lead confirmed it in the text.
  - Fix: a `whole_state` command that ends `sent` or `unanswered` sets the assumed value of every key in its `state`. Add a subject for it.
- **G2 (A1, D1), HS6's vacuum, HS7's upgrade and HS24's adapter.**
  - The text: GA-DESC-18 makes an extension an engine adds or changes "`refuse(not_adopted)` until the owner accepts it through `configure`".
  - What goes wrong: `configure`'s change list has no kind that accepts an extension (checked). No notice or `describe` field shows that one is waiting, and GA-PERSIST-1 keeps no accepted schema to compare against after a restart. So a new or changed Home Assistant service stays refused for good, and HS7's upgrade silently disables it.
  - Fix: add a `configure` change `accept_extension { device, capability }`, keep accepted schemas under GA-PERSIST-1, list pending extensions in `describe`, and send a notice when one appears.
- **G3 (E1), VS7's cancelled gas question.**
  - The text: GA-BRAIN-12 requires a brain to say so when it does not serve an utterance "because its model, uplink, steward or a data server failed or has not answered". It exempts no question the person cancelled, yet the hop calls staying silent "not graded".
  - Fix: the brain answers with a short `say` `in_reply_to` the question. This also stops the failure clip, which closes F8. Alternatively, add the exemption to GA-BRAIN-12.

**Nits**
- **A3, applier.** The *Outcomes* prose and the `idempotent` row still say "a plugin's extension action". Round 3 widened both. Fix: "an extension action".
- **A4, HS1, "Steward → applier".** The hop does not cite GA-APPLY-16. Fix: cite it (as N6 asks for HS12).
- **B2, HS17, the valve's adoption.** `other_admins` reads `unknown` on a fresh Zigbee network, so GA-ADOPT-3 gives an `other_admin` notice at adoption and another when it reads `[]`. Fix: name both notices in the hop.
- **C1, HS23.** "Never answers a guest" and its grades row predate GA-AUTH-7's visitor fix. Fix: write "a guest or a visitor".
- **C2, HS21, "Steward: Артём's desktop".** Windows may lock the session after 40 minutes idle. Every account then reads `locked`, and the steward "MUST go on to the room check", so the question becomes `ask(occupancy_unknown)`. Fix: add a locked branch to the hop, like the laptop's Modern Standby branch.
- **C3, applier, GA-DESC-14's row.** A stray comma: "the applier's own, (*Default tiers*)". Fix: drop it.
- **D2, HS24.** Home Assistant's Wake-on-LAN switch belongs in `ungoverned` (GA-DESC-12), but the hop lists only `bash`. This is F22's gap for a different entity. Fix: list it.
- **D3, HS26, the open design.** A laptop-to-NAS copy names a second device, which GA-DESC-18 forbids for the applier's own extensions. As a plugin's extension, nothing binds it, and its tier floor comes from the laptop alone: the gap C2-B1 closed for adapters. Fix: record in HS26's open list that such an action needs its own tier rule.
- **E2, VS10.** The hop says "Playing a video is `reversible`". But *Playback* reaches a kiosk's own items as extensions, which are `confirm` ("its kiosk's `…navigate` is `confirm` until the owner lowers it"), and the guide has no person, so is a guest (GA-AUTH-2). Fix: make the step `media.launch` on the hall-3 player, and say the guide acts as a guest.

##### Carried findings

**Fixed by the new text:**
- W2-N1 and W2-N5 by GA-APPLY-16 (any apply, nothing held).
- W2-N2 by GA-DESC-18, with GA-DESC-14.
- W2-N3 by GA-DESC-12 ("an extension of its own").
- W2-N4 by `confirmed_by` on any stateful extension and GA-EVT-3.

**Still standing, 31 in all:**
- **Should-fix (14):** F2, F4, F5, F6, F10, F11, F12, F13 and F15 (HS), and F3, F7, F8, F9 and F14 (VS). F6's GA-SAFE-7 row still lacks the rule that every sensor the latch reads is `live`.
- **Nits (17):** F16 to F27 (HS), F28 and F29 (VS), and W2-N6, N7 and N8. N6 is reworded: the HS12 hop and its grades row should now cite GA-APPLY-16's any-apply rule.

**Deferred items that now bite:** C2-L2 bites in HS12. An `unanswered` blast moves the assumed value, and the brain says it "as what was last sent". C-M7 (nothing requires a barge-in to cut playback) is one more reason VS1 stays partly. O-M7 and O-M8 block no VS hop.

##### Totals

- HS 22 / 4 / 1, VS 6 / 5 / 0.
- New findings: 12, with 0 blockers, 3 should-fix and 9 nits.
- Carried findings: 31 still stand and 5 are fixed.

### Dispositions and verdict

No blocker in round 3. By the maintainer's word of 2026-09-27, this is the last round.

**The maintainer's rulings, 2026-09-27, after round 3.**
- **A stopping rule for reviews:** PASS when no blocker is open. Highs found in the last round are
  fixed and recorded as not re-read; everything else is disposed and carried.
- **The additions for adapters come out of this bump:** an applier's own extensions (and with them
  GA-DESC-18, the owner's acceptance of an engine's extension, `confirmed_by` on any extension,
  the allowlist and the lowering floor for them) and playback (`media.stop`, `next`, `previous`,
  `seek`). Each round's fixes to them bred the next round's highs; they go to the adapter design
  note, with the seam to an existing system and the Home Assistant adapter, and are designed there as one piece.
- **Spec review stops here; wave 0 of the reference builds starts.**

| Finding | Disposition |
|---|---|
| C3-H1, W3-G1, K3-L1 an in-flight value carried by a frame whose action then fails | fixed: when a `whole_state` command ends `sent` or `unanswered`, every key it carried becomes assumed (GA-APPLY-16); the false sentence scoped to commands built after the failure; subject `forgets-what-the-frame-said` |
| K3-M1 the action's own key in a whole-state `state` | fixed: carried with the value it asks for |
| C3-H2 `speech` not `self_changing`, so a speaking TV is leased | fixed: `speech` `self_changing` on every device that reports it (GA-DESC-9) |
| K3-M3 `sends-the-old-mode` races the first ack | fixed: the first ack held back until the second is published |
| C3-M5 `forgets-the-unanswered` cannot fail | fixed: it reads the assumed setpoint in `state` |
| K3-H1, W3-G2, C3-M1, C3-M2, C3-L1, C3-L2, C3-L3, C3-L4, C3-L5, K3-M2, K3-L3 the acceptance of an extension, its re-review on change, its subjects and grading | withdrawn with the extensions; carried to the adapter design note |
| C3-M4 `media.stop` stateless gives up its lease | withdrawn with playback; carried to the adapter design note |
| C3-M3 a `whole_state` frame carries keys whose actions have higher tiers (a guest's setpoint turns the unit on) | deferred: applier 0.13, a tier for the frame or a stated residue |
| K3-L2 the steward's lowering sentence omits GA-DESC-11 | deferred: steward 0.8 |
| W3-G3 GA-BRAIN-12 and a cancelled question (VS7) | deferred: the brain's next revision |
| K3-L4 README's private reference | deferred: step 0, as round 1's C-L6 |
| W3's nine nits and the 31 carried walk findings | deferred: the scenarios' next regrade |
| Round 2's dispositions of the extension and playback findings (C2-B1, W2-N2, W2-N3, W2-N4, C2-M1 to M4, K2-M2, K2-M3, C2-L3) | superseded: withdrawn with the additions, carried to the adapter design note |

## Verdict

**PASS** (the maintainer, 2026-09-27, after round 3), on the text of `fccb449` with the additions for
adapters withdrawn and round 3's fixes applied; those fixes were not re-read, by the stopping rule.
**Steward 0.7 and applier 0.12.** Voice 0.1, brain 0.5 and bridge 0.4 unchanged.

Three rounds, each of two readers from different models (Kimi `k3` through Claude Code with the
office key; a no-context Claude Opus) and a scenario walk. Blockers: two in round 1 (C-B1, W-F1),
one in round 2 (C2-B1, with W2-N1), none in round 3; all fixed or withdrawn with the text that
caused them. The walk ends at HS 22 drive, 4 partly, 1 cannot; VS 6 drive, 5 partly.

Carried forward:
- **To the adapter design note:** an applier's own extensions and their acceptance, playback, an
  engine's own routines, rooms from an engine, an engine's causes on `external`, with every
  withdrawn finding above.
- **To steward 0.8 and applier 0.13:** round 1's deferrals named "the next revision", C3-M3,
  K2-L2, K2-L3, K3-L2.
- **To voice, brain and bridge:** their rows above.
- **To step 0:** C-L6, K3-L4.
- **To the scenarios' regrade:** every W, W2 and W3 finding still open.
