---
title: The Galatea voice standard
status: draft
last_verified:
area: voice
audience: dev
author: Galatea maintainers
version: 0.3
related:
  - standard/brain.md
  - standard/steward.md
  - standard/applier.md
  - docs/specs/2026-09-25-voice-architecture-design.md
  - docs/reference/2026-09-25-voice-reference-scenarios.md
  - conformance/voice-requirements.json
  - CONTEXT.md
---

# The Galatea voice standard

## Changelog

| Date | Version | Change |
|---|---|---|
| 2026-10-06 | — | Editorial: private references removed for publication; no requirement changed. Decisions once credited to another system now state what was decided and why; links to documents that are not public are reworded |
| 2026-09-28 | 0.3 | Two defects in *How text is compared*, found by the reference front's stage 2a: lower case now comes before the confusables fold, and a character folds by its upper case's look-alike, or failing that its own, so no fold depends on capitalisation («OK Google» and «ok google» read alike; before, the wake-word floor missed one of them, and more lower-case Latin now folds: «het» reads «нет»); the breve of `й` is no longer removed, so «мой» and «мои» stay two words. The steward's checks (GA-LISTEN-4) read the same normalisation. Considered and kept: a person's «Галатея, да» said over the house's own question is still matched as an echo, since the words after a spoken wake word may be the house's own reply heard before the cut; a lost yes is repeated, a false one is not. Reviewed by one no-context Claude reader, whose blocker withdrew a third change (to GA-VOICE-8) and whose minor findings added tests for the wider fold. **PASS** 2026-09-28 (the maintainer, after that round, whose fixes were not re-read). Passed on its own branch as 0.2; renumbered 0.3 for the merge onto the MCP pin's 0.2, which touches none of its text. |
| 2026-09-28 | 0.2 | The front serves `listen`, `say` and `hush` at MCP protocol revision `2026-07-28`, and reaches the steward at it where served, answering and falling back to `2025-06-18` and `2025-11-25` only (GA-VOICE-21, new, with `speaks-only-2025` and `calls-the-steward-at-2025`); *Conformance* says which revisions the harness offers. Reviewed in `docs/reviews/2026-09-28-mcp-revision-pin.md`: two rounds, each of a third-model reader (Kimi) and a no-context Claude reader, with a scenario walk; round 1 found one blocker (fixed), round 2 none. **PASS** 2026-09-28 (the maintainer, confirmed at the merge, 2026-09-28); round 2's fixes were not re-read. |
| 2026-09-25 | 0.1 | First text, from `docs/specs/2026-09-25-voice-architecture-design.md`: the voice front between the rooms and the brain's `listen` and `say`. Listening modes that only narrow without the owner; wake words as configuration; addressing; follow-up windows; merging co-heard speech; echo and machine speech marked only on matching text; `played` reports; fixed clips only; audio and enrolled voices stay on the box. Reviewed in `docs/reviews/2026-09-25-voice-0.1.md` (eleven rounds, PASS 2026-09-25); merged onto the PC standards (brain 0.5, steward 0.6, applier 0.11) and read again in round 12, which has the front authenticate its brain (GA-VOICE-19), merge only for brain 0.5 (GA-VOICE-7) and list the duck limit; **PASS** 2026-09-27 (the maintainer, after round 12, whose fixes were not re-read by the round's scope). |

**Status: draft.** Nothing implements this yet.

The key words MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119 and RFC 8174. A sentence
without one of them is explanation, except that every row of *Requirement index* is normative, at
its row's level. Every requirement the conformance harness checks has an id in *Requirement index*;
the manifest, `conformance/voice-requirements.json`, is its machine-readable copy. Ids are one
namespace across the Galatea standards; an id cited here may live in another standard.

## What this standard governs

The **voice front** turns sound in the rooms of one home into utterances for a brain, and a
brain's replies into sound. It is the part of the brain standard's front (`standard/brain.md`,
*The front*) that hears and speaks. It holds:
- the links to room devices (satellites, a kiosk's browser, the owner's phone app);
- listening modes, wake words and the wake check;
- endpointing and speech recognition;
- how each utterance was addressed;
- follow-up windows and conversations;
- merging what two devices heard, and marking echoes and known machines' speech;
- speech synthesis and playback;
- the skill ingress, through which someone else's assistant hands over text.

Its rule, which a deployed voice front has run on: **audio in, text out, no house concepts.** The front knows
endpoints, their zones and their voice configuration, all read from the steward, and its own
playback. It does not know devices, roles, tiers or what a command means. It controls no device.

It stands on the rulings of 2026-09-24 and 2026-09-25 recorded in the design, among them:
- The brain meets people only through the front, as text.
- Live audio may cross the home's LAN to its own box. Audio and voices enrolled on a person never
  leave it.
- No premature policy: safety floors are MUSTs, and defaults and sensitivity are left to
  implementations.
- The wake word is configuration.

It does not govern what a brain does with an utterance (`standard/brain.md`), who may do what
(`standard/steward.md`), or the devices (`standard/applier.md`).

## Levels

| Level | Adds | Requirements |
|---|---|---|
| **Listen** | Links, listening modes, wake words, addressing, speaker hints, echo and machine marking at every device, `played` and `hush`, what the house may say, fixed clips, speaking, retention, the steward credential | every id not listed below |
| **Converse** | Follow-up windows, barge-in windows, skill sessions held open, and conversations | GA-VOICE-6 |
| **Zone** | Merging what several devices of one zone heard into one utterance | GA-VOICE-7 |

A front claims the levels it passes; Converse and Zone each require Listen. A front that does not
claim Converse opens no follow-up or barge-in window, treats `invites_reply` as absent, and ends a
skill session after each reply. A front that does not claim Zone delivers each device's speech as
its own utterance. Echo and machine marking are at every level: they are what keeps the house from
taking its own words for a person's, so no front goes without them. One front serves a home (steward,
GA-DEF-8), so it knows every playback the house makes.

## Compatibility

A front is a steward client of kind `front` (`standard/steward.md`, *Clients, endpoints and
principals*) and serves the brain standard's front operations, with what the brain standard
expects of a front (*The front*: keeping utterances across restarts, `cursor_expired`), which the
harness does not check. The front's configuration binds each brain's credential on the front to
that brain's client id at the steward. A front MUST deliver an utterance only to the brain the
endpoint's `served_by` names, a merged utterance only when every endpoint in it names the same
brain, and MUST take `say` and `hush` from a brain only for endpoints that brain serves
(GA-VOICE-19): a cloud brain never hears, or speaks at, an endpoint the owner gave to a local one. Unknown
fields are ignored, as everywhere in Galatea, so a front gives every brain every field. Only merging
depends on the brain: a brain names, in `listen`, the brain standard version it was built for
(`front_version`, brain *Compatibility*), and a front merges nothing for a brain that names none or
one before 0.5 (GA-VOICE-7). The version counts as the brain last named it in `listen` when an
utterance is delivered.

## The model

### Endpoints, zones and the voice record

An endpoint is the steward's. Its **voice record** (steward, *Listening*) holds:

| Field | Meaning |
|---|---|
| `listening` | `off` · `tap` · `wake_device` · `wake_server` |
| `wake_words` | The words that address it, each with the model to use, or `transcript` |
| `zone` | The acoustic zone: endpoints in one zone hear each other |
| `output` | `speech` if its device can speak, or null |
| `follow_up` | Whether a follow-up window may open here; default off |
| `heard_by` | The front credential that serves it |
| `skill_account` | For an endpoint fed by the skill ingress, the vendor account it serves; otherwise absent |
| `skill_surface` | Optionally, the vendor's device or application id within that account |

A front MUST listen only on endpoints whose voice record names it in `heard_by`, and only as that
record and the narrowings in force allow (GA-VOICE-1). It reads them from the steward's `describe`,
waiting on it for the next revision (`wait_s`), so that a change reaches it at once.

**Order.** Listening is ordered by what leaves the room and what is transcribed: `off` < `tap` <
`wake_device` < `wake_server`. A setting is **narrower** when it is lower in that order, has fewer
wake words, or has `follow_up` off. It is **wider** when it is higher, adds any wake word (a word
swapped for another included), has `follow_up` on, or is in another zone.

**Configured and effective.** The configured setting is the owner's. The **effective** setting is
the configured one, narrowed by every narrowing in force (steward, `narrow`) and by what the front
can do: a device's mute button, a device offline, a wake word no model can check (*Wake words*). A
front MUST NOT listen wider than the effective setting, and MUST report it, with its reason, in
`front_status` within the status delay of any change (GA-VOICE-2). The reasons are `configured`,
`narrowed`, `muted`, `offline`, `no_model` and `no_steward`.

A device's own mute button is the front's, not the steward's: pressed, the endpoint is `off` with
the reason `muted`; released, it returns. It is not a narrowing, which only the owner could lift.

### What each mode admits

A front MUST NOT transcribe, keep or pass on any audio frame its effective setting does not admit
(GA-VOICE-1):

| Mode | The device sends | The front transcribes, and keeps and passes on |
|---|---|---|
| `off` | nothing | nothing |
| `tap` | a window a touch opened, lasting the tap window, with at most the pre-roll before it for detection only | one utterance that starts inside the window |
| `wake_device` | a window its own wake model opened, with at most the pre-roll before the word for detection only; at level Converse, a follow-up window and a barge-in window | an utterance the server's check confirmed; at level Converse, a follow-up or a barge-in |
| `wake_server` | speech | everything, for the wake check; it keeps and passes on only an utterance the check confirmed and, at level Converse, a follow-up or a barge-in, and discards every other transcript unread |

A tap opens a tap window at every mode but `off`. At `wake_device`, a front MUST treat an endpoint whose device does not declare, when admitted,
that it sends the word's audio and at least the minimum pre-roll before it as having no model
(`no_model`), since without them it cannot confirm that the word begins the utterance; a wake
that arrives without them is not confirmed, and the endpoint's reason does not change. The pre-roll is
never transcribed. Before a tap, it keeps speech already under way from being taken
as the command (a pre-roll rule a deployed fleet uses); before a device's wake, it shows whether speech came before
the word. A **barge-in window** is open, at level Converse, at the endpoint where the front plays a
reply `in_reply_to` an utterance, while it plays, only if that endpoint's effective `follow_up` is on
and its effective listening is `wake_device` or wider (GA-VOICE-6); it covers that endpoint only. An
utterance that begins inside any window is streamed to its end, up to the utterance limit.

Taps and a device's own wake are the device's word: the front cannot check them, and admits them
because the device holds its own key (GA-VOICE-13). A device that lies about a tap is a compromised
device, as a lying brain is a compromised brain; a real button pressed while a television talks is
a person's act, and what the television says in that window is the residue. What the front does check is its own: the wake
word at `wake_server` and in the confirmation of a device's wake, and where each window began.

A front MUST count, per endpoint and since it started, the 20 ms frames it received and transcribed
(`read`) and those it received and did not (`discarded`), and report the counts in `front_status`
(GA-VOICE-1), so that a test can see what was withheld. The counts are the front's own report; the
harness compares them with what it sent and with what was delivered.

Merging, echo marking and machine marking use only what is kept: an endpoint at `tap` or `off`, and
an unconfirmed transcript at `wake_server`, are never used to find a duplicate. That a front keeps
nothing more than it delivers cannot be seen on the wire; the harness checks what is delivered and
the frame counts, and what is stored is judged with GA-VOICE-15.

### Narrowing

A narrowing is the steward's (`narrow`). A front MUST apply a narrowing, and any other change that
narrows an endpoint's effective setting (an owner's `define` included), within the narrowing delay
of the steward accepting it, while connected, and from then on read no frame it does not admit,
dropping unread any utterance in progress (GA-VOICE-3). A front that has lost the steward MUST NOT
widen the last setting it read, which it keeps across its own restarts; a front that starts with no
setting and no steward listens nowhere (GA-VOICE-3).

### Wake words

The wake word is configuration, never code: every check a front makes (a device's model, the
server's check, the rule that strips the word from the transcript) MUST read it from the endpoint's
`wake_words` (GA-VOICE-4). An utterance is addressed by the wake word only when it begins with one
of that endpoint's words, with no speech before the word in the pre-roll; a mention later in a
sentence («А ваша Галатея умеет…») addresses nothing (GA-VOICE-4).

A front declares, in `front_status`, the models it holds (*How a model is measured*). A word whose
named model neither this box nor the endpoint's device can run never widens what leaves the room
(GA-VOICE-4):
- at `wake_server`, the server checks the word on the transcript alone, which wakes falsely more
  often; the reason is `no_model`;
- at `wake_device`, the word is not checked, since the transcript check needs all speech streamed;
  the endpoint's other words still wake it, and with none left it falls back to `tap`; the reason
  is `no_model`.

More than one word on an endpoint is allowed; their false wakes add up. The house never speaks a
wake word (*Speaking*), so a common word («компьютер») made a wake word can no longer be said in
any reply in the home; an owner picks a word that replies do not need. The delivered transcript
is what was said, the wake word included; the word is stripped only inside the front's own checks.

### Utterances

A front delivers utterances through `listen` as the brain standard defines them, with these fields:

| Field | Meaning |
|---|---|
| `addressed_by` | `wake` · `tap` · `follow_up` · `skill` · `typed` |
| `conversation` | The id of the conversation the utterance belongs to |
| `also_heard_at` | Other endpoints that heard the same speech, each `{ endpoint, addressed_by, speaker_hint?, hint_basis? }` |
| `hint_basis` | What `speaker_hint` rests on: `gate` or `person` |
| `source` | `person`, or `machine` |
| `echo` | As the brain standard's |
| `clock_epoch` | The front's clock mapping `time` was written by (*Where speech happened*) |

`utterance_id` is a UUID, so that it is unique within the home whatever front made it.

**Addressing is the front's.** A front MUST set `addressed_by` on every utterance from what opened
it, and MUST NOT take it from a device (GA-VOICE-5):
- `wake`: the utterance began with one of the endpoint's wake words, as *Wake words* says, and the
  front's check confirmed it;
- `tap`: it began inside a tap window;
- `follow_up`: it began inside a follow-up window or a barge-in window (GA-VOICE-6), or it is a
  later turn of a skill session, and it is not `wake`: a confirmed wake word gives `wake`, inside a
  window too;
- `skill`: the turn that opens a skill session;
- `typed`: text a person typed into the phone app, only at an endpoint of `type: app`; that it was
  typed is the app's word, as a tap is a device's, bound to the app's own key. Speech the
  phone recognised is addressed by what opened it: `tap` when held to talk, `wake` or `follow_up`
  hands-free, so that a radio in the car cannot pass for typing.

**Speaker hints carry their basis.** A front MUST send `speaker_hint` only with `hint_basis`: `gate`
when a gate model it declares for that person, enrolled on this box on that person's voice,
matched the speech;
`person` when the endpoint has a person of its own and the hint names that person (GA-VOICE-14). A
front never infers a speaker from the words said. A `gate` hint is the front's word: the steward
takes it on trust (steward, GA-CONF-6), so a gate model's false accepts are declared and measured
like a wake model's (GA-VOICE-18).

### Where speech happened

Overlap is decided on one timeline, the front's own monotonic clock. Speech a device streams live
the front times itself: each frame at its sample position from an anchor. A frame's **sample
position** is the number of samples the device captured before it in the stream, counted from the
link's frame sequence where the link has one and otherwise from the samples received (a front that
cannot see a dropped frame places what follows early by the gap, for at most the anchor window).
The **anchor** is the least, over the trailing anchor window of frames after the stream's head, of
a frame's arrival less its sample position, and a frame is placed when its utterance is delivered. A device that sends only speech ends its
stream at each end of speech it sends (a stall is no gap), and the next frame opens a new stream with a new anchor. A barge-in's cut is
decided on the anchor as it then stands, and the verdict stands for the cut. A frame never arrives before it
was captured, so a stall shorter than the window, which only delays arrivals, does not move the
audio, and a device clock that runs fast or slow is corrected within the window; a longer stall is
the residue. The head of a stream that a tap or a
device's wake opened (the pre-roll, and the word) was captured before the stream began: it is a
buffered stretch of the length the device sends, and the sample count starts after it. The
harness expects every interval within the interval slack of when its fake device captured it,
except, for the anchor window, audio after a drop that the link does not number. A device that buffers, the speech it heard or the
playback it makes (a satellite that fetches its reply by URL starts it later than it was sent),
reports each stretch as `{ duration_ms, ended_ago_ms }`, measured on its own clock when it sends the report, and the front places it on its
clock at arrival: it ended `ended_ago_ms` before arrival and began `duration_ms` before that. A front MUST NOT compare timestamps from two
machines (GA-VOICE-8). An utterance's `time` is when its speech began, and a `played` report's
`ended_at` when its playback ended, both on the front's clock written as RFC 3339 by one mapping of
its monotonic clock to wall time, each instant converted by the mapping in force when it happened. When the
wall clock and the mapping diverge by more than the clock tolerance (steward, *Constants*), by a
step or by drift, the front MUST anchor a new mapping and count up `clock_epoch`, which every utterance
and `played` report carries, never reusing one, across its restarts too (GA-VOICE-8), so that a brain can tell a «да» said over the question from one said
after it, and compares the two only within one epoch (brain, GA-BRAIN-1): across a re-anchoring an
answer is lost, never false. Two intervals **overlap** when they overlap once each is widened by the
interval slack. A deployed system's first self-heard check never fired because its endpointer stamps an
utterance's end about 0.6 s after the speech ends; a device reports when speech ended, not when it
decided so.

### Merging what two devices heard

At level Zone, one sentence heard at several endpoints of one zone is one utterance. A front MUST
merge copies when, and only when, all of these hold (GA-VOICE-7); a **copy** is an utterance at
another device of the zone whose interval overlaps:
- their intervals overlap;
- every pair of their transcripts reaches the merge agreement (*Constants*);
- each copy is kept (*What each mode admits*);
- every endpoint's `served_by` names the same brain, which named a `front_version` of 0.5 or later.

Two different sentences spoken at once stay two utterances.

The merged utterance has one `utterance_id` across the zone. `endpoint` names the endpoint the
front will answer from, and `transcript` is that endpoint's; `also_heard_at` lists the others. Each
endpoint's `addressed_by`, hint and basis are kept as that endpoint's own, never lent to another
(GA-VOICE-7).

### Echoes and machine speech

A barge-in overlaps the speech it interrupts, so overlap alone never marks an echo: «Стоп», and a
«нет» that replaces a yes, stay a person's words. A front MUST mark an utterance `echo: true` when,
and only when, either its interval overlaps a playback the front made anywhere in the home **and**
its transcript reaches the echo match against the text playing then (*Constants*), or it is a copy
of an echo as below (GA-VOICE-8). It marks at every device it serves: at the device that played,
after echo cancellation removed most of it, and elsewhere, so that a reply heard in another zone is
still the house's own. A reply handed to a skill vendor counts as playing from hand-over for the
announce hold, since the vendor's speaker says it later. An utterance whose interval overlaps one
marked echo at any other device in the home, and whose transcript reaches the merge agreement with
it, is an echo too, whatever its length, so that a satellite's garbled copy of the house's own words never passes for a person.
Speech that overlaps and does not match is a person, and so, unless it is such a copy, is an
utterance of fewer than the echo minimum of words that does not begin with a wake word: «нет», «стоп», «да» are too short to tell from
a fragment of a reply, and a person's short word must never be lost; «Галатея, да» is never too
short, since it is what an echo must not be taken for.

The steward gives the front the `media` devices anywhere in the home that report speech, and
every announcement and spoken notice it dispatched, with the text and how long it has been spoken (steward,
`zone_sources`). A front MUST mark an utterance `source: machine` when, and only when, its interval
overlaps speech the steward reported to it by the time it delivers the utterance **and** its
transcript reaches the echo match against that text (GA-VOICE-9), the echo minimum applying as for
echoes. It MUST hold an utterance heard as audio that begins with a wake word or has at least the echo
minimum of words, until the source delay after its speech began, to learn of such speech
(GA-VOICE-9): a machine's speech that the utterance matches began with it, so a longer utterance
waits for nothing. An announcement or notice is listed from dispatch, so its «Галатея, да» is
always marked; a speaker's own speech is marked only when its device, its bridge, the applier and
the steward together report it within the hold, and a device slower than that goes unmarked, as a
television does. A device that reports no text (a TV, a kiosk's video) gets no marking; there the
wake word is the defence, and not a whole one: a broadcast «Галатея, да» is a `wake` yes. That is
the residue of trusting a spoken yes (steward, *The confirmation dialogue*); an owner who has a
television within earshot of a satellite points its `confirm_on` at an app.

### Speaking

A `say` may be one **piece** of a longer reply (`continues`), so that speech starts before the
reply is written. A front plays the pieces of one reply in order, at the endpoint named. The piece
that puts a question carries `asks`.

- **`played`.** For every piece, a front MUST report through `listen` one `played { say_id,
  endpoint, status, reason?, heard_chars?, cut_by?, ended_at?, clock_epoch, latency_ms? }` within the report delay after the piece
  ends or is dropped (GA-VOICE-10); a piece for an endpoint whose `output` is null is `dropped`. `status` is `full`; `cut`, by a barge-in or `hush`, after `heard_chars`
  characters of its text; or `dropped`, never played (the device was gone, a `hush`, an earlier
  piece cut, or a piece at a skill endpoint that answers no turn, `reason: no_turn`). `latency_ms`, on the first piece of a reply `in_reply_to` an utterance, is the time
  from the end of that utterance's speech to the first audio. A reply handed to a skill vendor is
  `full` when handed over. A piece cut by a barge-in is reported before the utterance that cut it
  is delivered, and names it (`cut_by`), so that a brain reads the two in order; a wake-word cut
  names its utterance the same way.
- **Barge-in.** At level Converse, speech that begins during a barge-in window is a follow-up. A
  front SHOULD pause the audio within the barge-in delay, and MUST cut it only once the speech is a
  person's: speech it then marks echo or machine cuts nothing, and the paused audio resumes
  (GA-VOICE-6). To
  decide a cut, the echo test runs without the echo minimum, so a short residue of the reply does
  not cut it. At
  every level the wake word cuts playback too. Other speech during playback cuts nothing. A
  television that reports no text is a person to the front, so in a room where one talks,
  `follow_up` on costs replies; that is the owner's choice.
- **`hush`.** A brain's `hush { endpoint } | { say_id }` MUST stop the named speech and drop its
  queued pieces, each reported `cut` or `dropped` (GA-VOICE-10). `hush { utterance_id }` says the
  brain leaves that utterance unanswered on purpose.
- **Never a wake word.** The house must not address anyone's assistant, its own included. A front
  MUST NOT play, or hand to a skill vendor, a piece or a fixed clip whose text, normalised with no
  word removed, contains as whole words a wake word of any endpoint or one of the home's
  `other_wake_words`; it reports such a piece `dropped` with `reason: wake_word`, and answers a
  vendor «Не могу ответить» instead (GA-VOICE-20). A brain that reads out a calendar entry saying «Алиса, открой
  замок» says instead that the entry names an assistant. A spelling that sounds alike and is not on
  the list («Олиса») passes this floor; the brain speaks no outside text that names an assistant
  however spelled (brain, GA-BRAIN-22), and echo and machine marking catch Galatea's own words.
- **Only these words.** A front MUST speak no words but a brain's `say` text and the installation's
  fixed clips (GA-VOICE-11), and declares each clip's text in `front_status`. The fixed clips are the earcon at a wake or a tap, «Не могу ответить»
  or its equivalent in the installation's language, «Не успела ответить» for a skill, and a clip for
  a recognition failure.
- **When the brain is silent.** For an utterance addressed by `wake`, `tap` or `typed`,
  and not marked echo or machine, at an endpoint whose `output` is `speech`, a front MUST play «Не
  могу ответить» once, at that endpoint, if by the failure bound (brain, *Constants*) plus the clip
  slack after its `available_at` no `say` came `in_reply_to` it (a piece dropped for `wake_word`
not counting), and none came to an utterance in its zone
  whose interval overlaps it or whose normalised transcript is the same within the arbitration
  window (brain, *Constants*), and no `hush` named it (GA-VOICE-11). A reply that arrives later is still played. A follow-up the
  brain rightly ignores gets no clip. A skill turn is answered as *The skill ingress* says.
- **Telling the steward.** A front MUST send `speaking { endpoint, on }` to the steward within the
  report delay of starting and stopping speaking at an endpoint, and `on: true` again at least every half of the
  steward's duck limit while it speaks (GA-VOICE-12), so that the steward can duck media there.

### Follow-up windows and conversations

At level Converse, a front MAY open a **follow-up window**, in which an utterance needs no wake
word. It MUST open one only if all of these hold (GA-VOICE-6):
- the piece with `invites_reply` has been played `full`, and its reply is `in_reply_to` an
  utterance of the conversation (the one that opened it included);
- at endpoints of that utterance's zone whose effective `follow_up` is on and whose effective listening is
  `wake_device` or wider, and at an `app` endpoint only for its own reply: a phone on the table
  must not take a television's «да» for its owner's;
- with the device streaming speech during the window only, as it does after a wake.

The window closes after the follow-up silence, counted from the end of that piece. A
**conversation** is the utterances and replies in one zone joined by windows; a `wake`, `tap`,
`skill` or `typed` turn in a zone whose conversation has not ended joins it. It ends after the
conversation span without a `wake`, `tap`, `skill` or `typed` turn, and no window opens in it after
that (GA-VOICE-6): follow-ups alone do not keep it going, so a television that answers every
invitation cannot keep a room listening. A follow-up heard only in another zone opens nothing
there. A brain holds what a conversation means; the front holds only its mechanics.

### The skill ingress

A front MAY accept text from someone else's assistant, such as a Yandex Dialogs skill («Алиса,
попроси Галатею…»). It MUST serve the ingress over TLS with a certificate the vendor
validates, and authenticate every request as the vendor's, by the vendor's own means where it has
one and otherwise by a secret in the ingress's address that only the vendor holds, one for each
`skill_account` (each account's skill its own, with its own address), and
deliver text only at
the endpoints of the `skill_account` that the front's configuration binds to the skill id the
vendor authenticated, or to the secret, never of an account the request's body names instead: there, at the endpoint whose `skill_surface` is the request's, or,
where the account names no surface at any endpoint, at its one endpoint; a request that reaches no
endpoint is answered «Не могу ответить» (GA-VOICE-16). A skill
identifies an account, and at most a surface (`skill_surface`, the vendor's device or application
id, where the vendor gives one), not a person: anyone on that account, anywhere, speaks at that
endpoint, so
the steward caps it at `visitor` unless the owner says otherwise. A visitor acts on nothing but may
ask and hear answers, so whoever learns a secret address hears what the brain tells a visitor
(who is home, the calendar, a device's state) until the owner changes it, or, where the owner raised it, what the highest `max_role` among the
account's endpoints allows, since under a secret the surface is the request's word;
that is the residue of a vendor that signs nothing (steward, *Clients, endpoints and
principals*).

- A skill endpoint's `output` is `speech`: the vendor's device speaks. Its `wake_words` are unused,
  every listening mode but `off` delivers, and its `zone` says where the vendor's device stands,
  for the brain and the clip rule.
- A skill endpoint listens as its record says: where its effective listening is `off`, narrowed
  or configured, the ingress MUST deliver nothing and answer the vendor with «Не могу ответить»
  (GA-VOICE-16). «Не слушай» said through the skill silences the skill.
- A session held open by the vendor is a follow-up window: the front MUST keep it open only where that
  endpoint's effective `follow_up` is on (GA-VOICE-16), and marks its later turns `follow_up` (GA-VOICE-5).
- The pieces of a reply `in_reply_to` a skill turn that arrive before the hand-over,
  joined in order with a space, are the skill's response, checked whole (GA-VOICE-20), and MUST be
  handed over at a piece that says `final`, or else at the vendor's deadline less the hand-over
  margin, which the front declares in `front_status` under `skills`, with the skill ids or secrets
  (by name) it binds to each `skill_account`, and which is at most half the deadline; a piece that
  arrives after the hand-over is `dropped` with `reason: late` (GA-VOICE-16). `final` means nothing at other endpoints. If none has come by the hand-over, the front MUST answer the vendor with the text of «Не успела ответить»,
  which says the house may still act, and report a later reply `dropped` (GA-VOICE-16). The front
  plays nothing at a skill endpoint.

### Links, security and retention

- **Admission.** A front MUST authenticate a device link, whichever end dialled, before it reads a
  frame: a link not yet authenticated has no model loaded, nothing transcribed, and is closed after
  the admission timeout (GA-VOICE-17). Each device has its own key, which the front's configuration binds to one
  endpoint, so a device cannot speak for another.
- **Encryption.** Device links MUST be encrypted, for example the ESPHome native API with its
  encryption key, or a WebSocket over TLS, unless both ends are on one host's loopback; the owner's phone app,
  reaching the box from outside through its remote access, authenticates with its own key, and its
  link, encrypted to the box, is the one way live audio leaves the home's LAN (GA-VOICE-13). A front's own services (speech recognition, synthesis, wake checks) MAY speak
  Wyoming on one host.
- A front reaches the steward over TLS, as every steward client does (GA-SEC-2), and serves the
  brain over TLS, which the brain checks (GA-BRAIN-16).
- **MCP revision.** A front MUST serve the brain standard's front operations at MCP protocol
  revision `2026-07-28`, MAY also answer `2025-06-18` and `2025-11-25` and no other revision, and
  MUST reach the steward at `2026-07-28` where the steward serves it, falling back to one of those
  two only for a steward that does not (GA-VOICE-21; applier, *The MCP binding*).
- **Audio stays on the box.** A front MUST NOT send audio it captured, or a model enrolled on a
  person's voice, off the home's box (the speech it plays goes where it is played); MUST keep audio only of utterances it delivered, and no longer than the
  home's `audio_retention_s` (steward, *The house model*; 0, the default, keeps none); and MUST delete a person's enrolled voice within the
  status delay of the steward no longer listing the person (GA-VOICE-15). Transcripts reach the brain, which may run in the cloud; that is the brain's
  deployment, which the owner chooses.
- **Time.** A front SHOULD take its clock from the steward's time source; the steward checks an
  answer's `time` against its own within the clock tolerance (GA-CONF-2).
- A front's steward credential does only what `front` may (steward, GA-AUTH-8).

## How a model is measured

A front declares its fixed clips' texts in `front_status`, and each model it holds as `{ model, kind, words?, person?,
endpoints, measured }`: `kind` is `wake` (with the `words` it checks) or `gate` (a speaker model, with the
`person` it was enrolled on, and the `endpoints` it runs at). The steward shows them in
`describe`, so that the owner, and a brain,
see what a wake word costs and whether a gate exists at an endpoint. Their `measured` numbers MUST
come from this procedure (GA-VOICE-18); they are declared, not verified. The rules come from measuring wake words in a deployed fleet:
- The pass mark is registered before any recording is made or scored.
- Human test sets are never trained on, and are held out by session and by speaker.
- The cutoff is chosen on a calibration pool only, at the false-accept budget, and reported on a
  separate report pool.
- The hours counted are the hours scored.
- A stimulus that ends on the word is scored with its post-roll.
- A false wake is listened to before it is counted.
- A number is reported with two seeds, from an averaged checkpoint.

`measured` holds: for a wake model, recall on held-out real speech and false wakes an hour on each
named pool; for a gate model, recall on held-out real speech of the enrolled person and false
accepts on other speakers, on speech as short as the shortest the model gives a hint for (a single
«да» if it gives one there), with that length declared; for both, the cutoff and the calibration pool it was chosen on. The
numbers are declared, not graded: the harness checks that they are present and have this shape.

## Constants

| Constant | Value | Used by |
|---|---|---|
| Pre-roll | at most 1 s, detection only; at `wake_device` at least the minimum pre-roll | GA-VOICE-1, GA-VOICE-4 |
| Minimum pre-roll | 0.3 s | GA-VOICE-4 |
| Tap window | 8 s | GA-VOICE-1 |
| Utterance limit | 30 s | GA-VOICE-1 |
| Status delay | 10 s | GA-VOICE-2 |
| Narrowing delay | 2 s | GA-VOICE-3 |
| Follow-up silence | 8 s | GA-VOICE-6 |
| Conversation span | 120 s without a `wake`, `tap`, `skill` or `typed` turn | GA-VOICE-6 |
| Interval slack | 0.25 s | GA-VOICE-7, GA-VOICE-8, GA-VOICE-9 |
| Anchor window | 10 s | GA-VOICE-8 |
| Merge agreement | a word overlap of at least 0.6 | GA-VOICE-7 |
| Echo match | a character edit distance of at most 0.15 | GA-VOICE-8, GA-VOICE-9 |
| Echo minimum | 3 words | GA-VOICE-8, GA-VOICE-9 |
| Source delay | 1 s | GA-VOICE-9 |
| Announce hold | the steward's, 30 s | GA-VOICE-8 |
| Duck limit | the steward's, 60 s | GA-VOICE-12 |
| Report delay | 1 s | GA-VOICE-10 |
| Clip slack | 2 s | GA-VOICE-11 |
| Barge-in delay | 0.5 s | SHOULD |
| Admission timeout | 5 s | GA-VOICE-17 |

**How text is compared.** Text is **normalised** first: Unicode NFKD, with format characters
(zero-width spaces, soft hyphens) and combining marks (stress marks, and the accents of letters that
came precomposed) removed, except the breve of `й`, which stays a letter of its own, then NFKC; every run of digits that touches no letter written as a cardinal number in words, in the
nominative; lower case; then every character whose upper case, or failing that the character itself, has a
Cyrillic letter as its look-alike in the Unicode confusables table (UTS #39), a digit that touches a
letter included («С6ер»), folded to that letter in lower case, so that no fold depends on how a word was capitalised («OK» and «ok» both read «ок»); `ё` as `е`; every other character that is neither a letter nor whitespace a space.
For a wake-word check (GA-VOICE-20, GA-LISTEN-4) the text is read twice, once so and once with
those characters (never the original whitespace) deleted where they stand between letters, and it
contains the word if either reading does; the steward's check also refuses near spellings
(GA-LISTEN-4). This check is a floor, not a wall: a
spelling that no floor catches (a word glued to the next, a homophone) is the residue, which the
brain's own rule on outside text closes (brain, GA-BRAIN-22). For
merging and echo marking, the endpoint's wake words are then removed from the start; the steward's
check of an announcement (GA-LISTEN-4) removes nothing. The **word overlap** of two transcripts is
the number of distinct words they share divided by the number of distinct words in either
(Jaccard). The **edit distance** of a transcript from a played or reported text is the Levenshtein
distance, in characters, from the transcript to the run of whole words of that text closest to it,
divided by the transcript's length; so a fragment heard from a long reply is compared with the
words it came from, and «да» is never found inside «когда».

The definitions are normative; the values are guesses until measured on real satellites in real
rooms, and a harness grades against the values of the version it runs. Its cases sit well inside
or well outside each threshold, so that a pass does not hang on a guess. The delays a front must
meet (narrowing, report, status) are ceilings on the front itself, not guesses about a room. The echo match is kept tight
on purpose: a deployed system found a person's real sentence at a distance of 0.26 from a reply clip, and a looser
match would have cut it.

## Requirement index

| Id | Level | Conf. | Verify | Requirement |
|---|---|---|---|---|
| GA-VOICE-1 | MUST | Listen | wire | The front listens only on endpoints whose voice record names it in `heard_by`; it transcribes, keeps and passes on only what its effective setting admits, the pre-roll serving detection only, a tap window lasting the tap window, and an unconfirmed transcript at `wake_server` discarded unread; it counts frames read and discarded per endpoint in `front_status` |
| GA-VOICE-2 | MUST | Listen | wire | The effective setting is the configured one narrowed by every narrowing in force and by what the front can do, never wider, and is reported with its reason in `front_status` within the status delay of a change |
| GA-VOICE-3 | MUST | Listen | wire | A narrowing, or any change that narrows the effective setting or removes an endpoint from the front, applies within the narrowing delay of the steward accepting it, an utterance in progress dropped unread; a front that has lost the steward never widens its last setting, kept across restarts, and with none listens nowhere |
| GA-VOICE-4 | MUST | Listen | wire | Every wake check reads the endpoint's `wake_words`; an utterance is wake-addressed only when it begins with one, with no speech before it in the pre-roll, at `wake_device` an endpoint whose device does not declare that it sends the word's audio and at least the minimum pre-roll being `no_model`, and a wake without them unconfirmed; a word no model can check falls back to the transcript check at `wake_server` and to `tap` at `wake_device`, with the reason `no_model` |
| GA-VOICE-5 | MUST | Listen | wire | Every utterance carries `addressed_by`, set by the front from what opened it, never taken from a device; a confirmed wake word gives `wake`, inside a window too; `typed` only for text typed at an `app` endpoint, phone speech addressed by what opened it; `skill` only for the turn opening a skill session, later turns `follow_up` |
| GA-VOICE-6 | MUST | Converse | wire | A barge-in window opens only at the endpoint playing a reply `in_reply_to` an utterance, with effective `follow_up` on and effective listening `wake_device` or wider; a follow-up window opens only after the piece with `invites_reply`, in a reply `in_reply_to` an utterance of the conversation, played `full`, at endpoints of that zone with effective `follow_up` on and effective listening `wake_device` or wider, an `app` endpoint only for its own reply; it closes after the follow-up silence; a barge-in cuts playback only once the speech is not echo or machine; a conversation ends after the conversation span without a `wake`, `tap`, `skill` or `typed` turn |
| GA-VOICE-7 | MUST | Zone | wire | Copies merge when, and only when, their intervals overlap, every pair of transcripts reaches the merge agreement, each is kept, and every endpoint is served by one brain whose `front_version` is 0.5 or later; a merged utterance has one id across the zone, and each endpoint keeps its own `addressed_by`, hint and basis |
| GA-VOICE-8 | MUST | Listen | wire | An utterance is `echo` when, and only when, its interval overlaps a playback the front made anywhere in the home and its transcript reaches the echo match against the text playing then, at every device the front serves, a reply handed to a skill vendor playing for the announce hold from hand-over; an utterance overlapping one marked echo at any other device in the home and reaching the merge agreement with it is an echo, whatever its length; otherwise an utterance under the echo minimum that does not begin with a wake word is never an echo; overlap is decided on the front's clock, never from two machines' timestamps; every new mapping of that clock to wall time counts up `clock_epoch`, never reused, restarts included |
| GA-VOICE-9 | MUST | Listen | wire | An utterance is `source: machine` when, and only when, its interval overlaps speech or an announcement the steward reported to the front by the time it delivers the utterance and its transcript reaches the echo match against that text; an utterance under the echo minimum that does not begin with a wake word is never marked; an audio utterance that begins with a wake word or has at least the echo minimum of words is held until the source delay after its speech began |
| GA-VOICE-10 | MUST | Listen | wire | Every piece of speech is reported `played` (`full`, `cut` with `heard_chars`, or `dropped`) within the report delay of its end or drop, with `ended_at` on the front's clock, a piece cut by a barge-in or a wake word before the utterance that cut it, naming it in `cut_by`, a piece for an endpoint with no `output` `dropped`, the first piece of a reply with `latency_ms`; `hush` stops the named speech and drops its queued pieces |
| GA-VOICE-11 | MUST | Listen | wire | The front speaks no words but the brain's `say` text and the installation's fixed clips; at an endpoint with `output: speech`, it plays «Не могу ответить» once for a `wake`, `tap` or `typed` utterance that is no echo or machine and that, by the failure bound plus the clip slack after its `available_at`, has no reply (a piece dropped for `wake_word` not counting), no reply to an utterance in its zone that overlaps it or has the same normalised transcript within the arbitration window, and no `hush`; a later reply is still played |
| GA-VOICE-12 | MUST | Listen | wire | The front sends `speaking { endpoint, on }` to the steward within the report delay of starting and stopping speaking at an endpoint, and `on: true` again at least every half duck limit while it speaks |
| GA-VOICE-13 | MUST | Listen | wire | Device links are encrypted (the ESPHome native API's encryption, or a WebSocket over TLS) unless on one host's loopback, and each device key is bound to one endpoint |
| GA-VOICE-14 | MUST | Listen | wire | `speaker_hint` is sent only with `hint_basis`: `gate` from a declared gate model enrolled on the box on that person's voice, `person` only at an endpoint whose own person it names |
| GA-VOICE-15 | MUST | Listen | judged | No captured audio and no model enrolled on a person's voice leaves the box; audio is kept only of delivered utterances and no longer than the home's `audio_retention_s`, none by default; a person's enrolled voice is deleted within the status delay of the steward no longer listing the person |
| GA-VOICE-16 | MUST | Listen | wire | The skill ingress is served over TLS the vendor validates, authenticates every request as the vendor's and by the vendor's means or otherwise a secret address, one per `skill_account`; delivers text only at an endpoint of the authenticated account, the one whose `skill_surface` is the request's or, where the account names no surface, its one endpoint, else answers «Не могу ответить»; hands over the pieces that arrived before the hand-over, joined with a space, at `final` or at the deadline less the margin it declares in `front_status` under `skills`, at most half the deadline, a later piece `dropped` `late`; keeps a vendor session open only where the endpoint's effective `follow_up` is on; where that endpoint's effective listening is `off` it delivers nothing and answers «Не могу ответить»; with no reply by the hand-over, it answers «Не успела ответить» and reports a later reply `dropped` |
| GA-VOICE-17 | MUST | Listen | wire | A device link is authenticated, whichever end dialled, before a frame is read; an unauthenticated link has nothing loaded or transcribed and is closed after the admission timeout |
| GA-VOICE-18 | MUST | Listen | static | Each declared model's `measured` numbers are present, in the procedure's shape: for a wake model recall and false wakes an hour on named pools, for a gate model its person, recall and false accepts, for both the cutoff and its calibration pool |
| GA-VOICE-19 | MUST | Listen | wire | An utterance is delivered only to the brain the endpoint's `served_by` names, authenticated by its credential, and `say` and `hush` are taken from a brain only for endpoints it serves; a caller with no brain's credential gets nothing and speaks nowhere |
| GA-VOICE-20 | MUST | Listen | wire | No piece, clip or skill response whose normalised text contains, as whole words, a wake word of any endpoint or one of the home's `other_wake_words` is played; it is reported `dropped` with `reason: wake_word` |
| GA-VOICE-21 | MUST | Listen | wire | The front serves `listen`, `say` and `hush` at MCP protocol revision `2026-07-28`, answering no revision but that one, `2025-06-18` and `2025-11-25`; it reaches the steward at `2026-07-28` where the steward serves it, and falls back, to one of those two only, for a steward that does not |

## Conformance

A claim of conformance is a run of the voice harness in which every requirement of the claimed
levels is `pass`.

- **What the harness plays.** Everything around the front:
  - a **fake steward** that gives voice records, narrowings and `zone_sources`, and records
    `narrow`, `front_status` and `speaking`;
  - a **fake brain** that reads `listen`, says, hushes and names a `front_version`, or none;
  - a **restart** of the front, which the harness can order at any time;
  - **a link that stalls and drops frames**, and a wall clock that steps and drifts;
  - **fake devices**: a satellite over the ESPHome native API and a browser over WebSocket (a front
    is tested with those it serves), which
    stream audio with their intervals, report taps and mutes, and record what they are sent;
  - a **fake skill vendor**, signing some requests and not others.
- **Audio.** ⛔ No audio is committed to this repository. The harness synthesises its speech at run
  time, with a speech synthesiser the report names, or takes it from a directory outside the
  repository that the tester supplies. Only the cases' texts, timings and expected results are
  committed. The speech is clear, so a front whose recogniser fails it fails the case. Echo, merging
  and machine speech are tested by playing one synthesised sentence into two fake devices with known
  offsets, with the played text and a person's overlapping text.
- **What was spoken.** The harness transcribes what each fake device was sent, with its own
  recogniser, and matches it against the `say` texts and the fixed clips (GA-VOICE-11).
- **What the harness can check** is on the wire: frames read and discarded against the mode, the
  effective setting and its narrowing, addressing, windows and their ends, merging and its ids,
  echo and machine marking, `played` and `hush`, the clip on a silent brain, `speaking`, the skill's
  authentication, admission and encryption.
- **Egress.** The front runs where only the servers the harness plays are reachable; any audio it
  sends elsewhere fails GA-VOICE-15. What it stores is judged by inspecting its storage during the run, the status delay after a
  person is removed, and after it.
- **What it cannot**: recognition quality in a real room, false wakes and false accepts, and latency
  on real hardware. Those are declared (GA-VOICE-18, `latency_ms`) and measured in the home.
- **MCP revisions.** The fake brain reaches the front at `2026-07-28` where it serves it, and
  otherwise at `2025-11-25` or `2025-06-18` if it answers one; the fake steward serves all three and
  records which the front used.
- **Negative subjects** are the applier standard's (*Conformance*): each must fail what it breaks,
  and may also fail only what is listed beside it.

### Negative subjects

| Subject | Breaks | May also fail | Why those |
|---|---|---|---|
| `hears-before-the-tap` | GA-VOICE-1 | — | |
| `speaks-only-2025` | GA-VOICE-21 | — | It answers only `2025-11-25`, through its `initialize` handshake, statelessly; the harness, as a client may, falls back to it, so nothing else fails |
| `calls-the-steward-at-2025` | GA-VOICE-21 | — | It reaches the fake steward, which serves `2026-07-28`, through the `2025-11-25` handshake |
| `wider-than-configured` | GA-VOICE-2 | GA-VOICE-1 | It then reads frames the setting does not admit |
| `ignores-a-narrowing` | GA-VOICE-3 | GA-VOICE-1, GA-VOICE-2, GA-VOICE-6 | It reads what the narrowing withholds, and reports the wider setting |
| `hardcoded-wake-word` | GA-VOICE-4 | GA-VOICE-1, GA-VOICE-5, GA-VOICE-11 | It keeps speech the record's word would not admit, addresses it `wake`, and that draws the clip |
| `trusts-the-device` | GA-VOICE-5 | — | It copies an `addressed_by` field the fake device sends |
| `window-without-invitation` | GA-VOICE-6 | GA-VOICE-1, GA-VOICE-5 | It keeps speech no window admits, and addresses it `follow_up` |
| `merges-by-time` | GA-VOICE-7 | — | |
| `overlap-is-echo` | GA-VOICE-8 | GA-VOICE-9, GA-VOICE-11 | The same test decides machine speech; a person marked echo draws no clip |
| `never-marks-echo` | GA-VOICE-8 | GA-VOICE-6, GA-VOICE-11 | An unmarked echo cuts the reply and may draw the clip |
| `reuses-an-epoch` | GA-VOICE-8 | — | After a restart with a stepped clock, it counts the epoch from 0 again |
| `never-marks-machine` | GA-VOICE-9 | GA-VOICE-11 | As above, for a machine |
| `never-reports-played` | GA-VOICE-10 | — | |
| `speaks-its-own-mind` | GA-VOICE-11 | — | |
| `silent-speaker` | GA-VOICE-12 | — | |
| `plaintext-link` | GA-VOICE-13 | — | |
| `hint-without-basis` | GA-VOICE-14 | — | |
| `open-skill-ingress` | GA-VOICE-16 | — | |
| `reads-before-admission` | GA-VOICE-17 | GA-VOICE-1 | |
| `undeclared-numbers` | GA-VOICE-18 | — | |
| `tells-every-brain` | GA-VOICE-19 | GA-VOICE-7 | It also merges across brains |
| `serves-any-caller` | GA-VOICE-19 | — | A `listen` with no credential reads every transcript in the home |
| `says-the-wake-word` | GA-VOICE-20 | — | The front plays a piece that contains an endpoint's wake word |

## What this standard does not define

- Which speech recogniser, synthesiser, wake or gate models, or turn detector a front uses.
- The device protocol's details beyond admission and encryption.
- Where unprompted speech goes: the brain chooses (`standard/brain.md`).
- Whether and what the steward ducks: the steward's configuration.
- Sensitivity presets, and every constant's final value.
- Recognising a speaker beyond saying what a hint rests on.
- A skill vendor's deadline, which is the vendor's.
- Which endpoint a merged utterance is answered from: the front's choice.
