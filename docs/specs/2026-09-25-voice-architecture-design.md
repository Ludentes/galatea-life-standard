---
title: The voice architecture — design
status: draft
last_verified:
area: voice
audience: dev
author: Galatea maintainers
related:
  - docs/reference/2026-09-25-voice-reference-scenarios.md
  - standard/brain.md
  - standard/steward.md
---

# The voice architecture — design

**Path: architectural.** A new subsystem, the voice front, sits below the brain's front. It changes
the brain standard's front and, a little, the steward's endpoints. The order the maintainer set on
2026-09-25 is scenarios, then this architecture, then the standard and its review, then
implementation. This document is the second step. It ends with what the standard must hold, not
with a plan.

## What it is for

A full spoken conversation with the brain, in the scenarios' words (VS1–VS11):
- several turns without the wake word after the first;
- interrupted when a person talks over it;
- answered from the speaker nearest the person;
- heard by satellites we own, and by the Станция or a phone where that is all there is;
- configurable per installation, down to the wake word, so that one build serves a home that
  says «Галатея» and a museum that says another word.

A command given by voice ("one wake, one utterance", as deployed voice products do it) is the simplest case of this.

## Rulings it stands on

- **Galatea runs its own pipeline** (the maintainer, 2026-09-25): option B of the research note, not Home
  Assistant's Assist. How it is implemented is decided after the standard, not here.
- Brain, steward, one applier; the brain meets people only through the front: text, `listen` and
  `say`. The baseline is the texts under review for the bridge revision
  (`docs/reviews/2026-09-25-bridge-0.2-applier-0.8.md`), which become brain 0.3 and steward 0.4 on
  its verdict; until then the tree's headers read 0.2 and 0.3. This design's changes land in the
  versions after them.
- A brain's spoken yes is trusted for `confirm`; `no_voice` never passes through a brain; an owner
  has a direct way in (2026-09-24).
- Live audio may cross the LAN to the home's own box (ruled 2026-09-24). Recordings are a separate matter.
- No audio and no voice profiles in this repository, ever.
- No premature policy: safety floors are MUSTs; defaults, sensitivity and routing are left to
  implementations.
- The wake word is configurable, chosen at provisioning (the maintainer, 2026-09-25).

## Evidence

From research into voice interfaces. What bears on the architecture:
- **A deployed voice system's shape, measured:** audio in, text out, and a process that holds no domain concepts.
  One server chokepoint arbitrates between devices. Listening modes are set by an authority and
  only narrowed live.
- **Echo cancellation:** a device cancels only its own playback (84 of 84 clips removed in the
  browser; barge-in survives, 14 of 14). A second device in the room hears the reply as a person.
- **Timing:** a deployed system's first self-heard check never fired, because the endpointer stamps an
  utterance's end about 0.6 s late. Speech intervals must be compared as durations on each
  machine's own clock.
- **Follow-up windows:** rejected for commands at 0.54 false accepts an hour against 0.1. VS2 shows
  what one does to a spoken yes.
- **The wake word:** a device's gate buys privacy and bandwidth; the server gives precision. Every
  false wake a deployed system heard was a person really saying the word.
- **Satellites:** Home Assistant's satellites speak the ESPHome native API; `wyoming-satellite`
  was archived in January 2026. Wyoming lives on only between a hub and its services, with no
  authentication.
- **Speakers we do not own** give no audio. Alice gives a verbatim transcript through a skill, and
  a local feed of her own speech and volume.
- **ASR:** GigaAM-v3 CTC, on the CPU, 564 ms median for a short utterance. **TTS:** licence-bound.

## Rejected alternatives

- **A speech-to-speech model as the brain's ear and mouth** (Moshi, OpenAI Realtime, Gemini Live).
  It is fastest, but it produces no text record the steward can check, and it puts a model's
  judgement below the front, where the standards cannot see it. It could return later as the
  front's TTS or ASR, never as the brain's path around the transcript.
- **Home Assistant's Assist as the voice path.** Rejected by ruling. It is also weaker on the needs
  this design serves: no echo marking across devices, no responder, and a follow-up window with a
  known self-hearing flaw.
- **Arbitration in the brain.** The brain standard today leaves it there (GA-BRAIN-5, HS5). Only
  the front knows which satellite heard what when, and which played what. The brain keeps merging
  duplicate *requests* by outcome; hearing one sentence twice becomes the front's job.
- **Arbitration over a broadcast** ("I am speaking" published to every device): rejected. It distributes a decision with one correct answer, and every device
  already passes through one process.
- **A second voice path for commercial speakers** that bypasses the front: every way in, a skill
  included, enters as utterances at a registered endpoint, so the steward's rules hold unchanged.

## The model

### Components

```
 room devices                      the box                                    
 ┌──────────────┐  ESPHome API   ┌───────────────────────────────┐   listen/say   ┌───────┐  MCP   ┌─────────┐
 │ satellite    │◄──────────────►│ voice front                   │◄──────────────►│ brain │◄──────►│ steward │
 │ (mic, AEC,   │                │  device links                 │  (+ voice      └───────┘        └────┬────┘
 │  wake gate,  │  WebSocket     │  listening modes, wake check  │   fields)                            │ describe:
 │  speaker)    │◄──────────────►│  endpointing, turn ends, ASR  │                                      │ endpoints,
 └──────────────┘ (browser, app) │  addressing, conversation     │◄─────────────────────────────────────┘ voice config
                                 │  zone: co-hearing, echo,      │     speaking ►  steward ► applier ► media.duck
                                 │        responder              │     ◄ sources   (a Станция, a TV: devices,
                                 │  speaker gate (hint)          │                  never the front's)
                                 │  TTS, playback                │
 ┌──────────────┐  HTTPS webhook │  skill ingress                │
 │ Alice skill  │───────────────►│                               │
 └──────────────┘                └───────────────────────────────┘
```

The front controls no device. A Станция, an Echo or a TV is a device behind the applier, like any
other; the front only tells the steward when it speaks, and learns from it which media devices in
a zone are playing.

| Component | Does | Knows | Never |
|---|---|---|---|
| **Room device** (satellite, kiosk browser, phone app) | Captures sound, cancels its own playback (only it holds the reference), optionally gates by its own wake model or a tap, plays audio and earcons | Its own microphone and speaker | Transcribes for the brain, or decides who may act |
| **Voice front** | Turns sound into utterances and text into sound, for every endpoint of one home | Endpoints, their zones, listening modes and wake words (read from the steward), its own playback | Knows devices, tiers, persons' roles or what a command means. It composes no words except fixed system clips |
| **Brain** | Understands and answers; holds the conversation's meaning | What was said, and the house through the steward | Touches audio |
| **Steward** | Holds the house, endpoints included, with their voice configuration; decides who may do what | Who configured what, and the rules | Touches audio |

The front makes one principle into a boundary: **audio in, text out, no house
concepts.** Deletion test: without the front, echo marking, arbitration, listening modes and the
wake word would each land in the brain, the steward or the device, three places that cannot see
all of them.

### Endpoints and zones

An endpoint is still the steward's. Voice adds a small record to it, held by the steward because
the steward already decides who may change the house:

| Field | Meaning | Changed by |
|---|---|---|
| `listening` | `off` · `tap` · `wake_device` · `wake_server` | Owner through `define`, from an endpoint not served by a brain. Narrowed by anyone (below) |
| `wake_words` | The words that address this endpoint, each with the model the front should use, or `transcript` (the server's check on the transcript alone, stated as weaker) | Owner through `define`: provisioning is the first `define` of the endpoint |
| `zone` | The acoustic zone; endpoints in one zone hear each other, and a conversation lives in one zone | Owner; the front may propose zones it infers from co-hearing, never apply them |
| `output` | `speech` (the endpoint's device can speak), or none. The brain reads it to know where it can speak | Owner |
| `follow_up` | Whether a follow-up window may open here at all (default: no). A window takes speech without a wake word, so it is a widening | Owner |

How an endpoint is reached (our own device, a skill, the owner's phone from outside) is the front's
own configuration, not the steward's. Which front serves an endpoint is the steward's: the voice
record names it (`heard_by`, a front client id), as `served_by` names a brain, and the front's
credential is bound to exactly those endpoints. A skill endpoint is trusted
exactly as its `max_role` and `person` say.

- **Narrower is defined.** The modes are ordered by what leaves the room and what is transcribed:
  `off` < `tap` < `wake_device` < `wake_server`. Removing a wake word narrows; adding one widens.
  Turning `follow_up` off narrows; on widens. Moving an endpoint into a zone, or changing its zone,
  widens (it lets another endpoint's conversation continue there).
- **A narrowing is its own steward operation**, `narrow { endpoint, listening, follow_up?, until }`,
  and GA-DEF-3 ("endpoints are never changed through a brain") gains one stated exception for it:
  a narrowing, which only ever takes listening away. The steward accepts it:
  - from a brain, for any endpoint the utterance was heard at, `also_heard_at` included, whoever
    spoke, a guest included («не слушай до утра» silences every satellite that heard it, VS5);
  - from the front's own credential (below), for a device's mute button.

  It records a `narrowed` event with its cause. `until` is at most 12 h (a constant, chosen).
  **Narrowings stack and never lift each other.** The effective configuration is the narrowest of
  the owner's and of every narrowing in force. A later `narrow` that asks for more than one already
  in force changes nothing until the earlier one expires. Only the owner lifts a narrowing early,
  through `define`, with a change kind `lift_narrowing { endpoint }`. When the last one expires, the owner's configuration returns, never anything
  wider. The front applies a narrowing on the next frame.
- **Widening needs the owner**, through `define`, from an endpoint not served by a brain. A device
  cannot be reconfigured into recording something it was not started to record.
- **The front has a credential of its own** at the steward, a new client kind `front`, bound to the
  endpoints it serves. It may:
  - read `describe`: endpoints and their voice records, by revision;
  - call `narrow`, for a device's mute button;
  - call `front_status { models, effective }`: the wake models it holds, each with its measured
    numbers, and each endpoint's effective listening with its reason (below).

  It may do nothing else: no `plan`, no `apply`, no `define`.
- **The front reads the configuration from the steward** and refuses to listen on an endpoint it
  has no configuration for. A front that has lost the steward keeps the last configuration and may
  only narrow it.
- **Configured and effective.** What the owner configured and what the front can do may differ: a
  wake word with no model on this box, a satellite without a wake model. The front
  computes the effective mode, always the configured one or narrower, and reports it with its
  reason. The steward shows it in `describe` and raises a notice when it differs, so the owner is
  never silently given less than they chose (VS11).
- **Speakers we do not own are devices, not endpoints** (below). A Станция reached through a skill
  is also an endpoint, `type: voice`, served by the brain, which the front's skill ingress feeds.
  So VS4's refusal of the water (GA-TIER-1) needs no new rule.

### The wake word (VS11)

- The word is configuration: the endpoint's `wake_words`, set at provisioning. The satellite's
  model, the server's check and the rule that strips the word from the transcript all read it. No
  component names a word in code.
- The front declares which wake models it has, each with its measured numbers (recall on held-out
  real speech, false wakes an hour on declared pools), and reports them in `front_status`. `define` accepts any word; it does not refuse one
  the front lacks a model for, because models come and go with the front. A word with no model
  on this box makes the effective mode weaker, with a notice, now or whenever a model disappears.
  The fallback never widens what leaves the room: at `wake_server` it is the server's transcript
  check; at `wake_device` it is `tap`, because the transcript check needs all speech streamed.
- More than one word on an endpoint is allowed, and the cost is stated: false wakes add up (about
  1.6 an hour for three models on one device, against 0.4 for one).
- Whether the satellite gates by its own model (`wake_device`) or streams speech for the server's
  check (`wake_server`) is the listening mode. Both run the server's check; the device gate only
  decides what leaves the room.

### Utterances, as the front delivers them

The brain's front today delivers `{ utterance_id, endpoint, time, available_at, transcript,
speaker_hint?, echo? }`. Voice adds:

| Field | Meaning | Scenarios |
|---|---|---|
| `addressed_by` | `wake` · `tap` · `follow_up` · `skill` · `typed`. The front derives it; a device never sets it. `typed` is valid only at `type: app`. `skill` is only the utterance that opens a skill session; later turns in that session are `follow_up` | VS1, VS2, VS4, VS10 |
| `conversation` | An id the front gives a run of turns in one zone; a follow-up carries the id of the conversation it continues | VS1, VS3 |
| `also_heard_at` | Other endpoints in the zone whose microphones heard the same speech, each as its own `{ endpoint, addressed_by, speaker_hint?, hint_basis? }` | VS3 |
| `hint_basis` | What `speaker_hint` rests on: `gate` (a model enrolled here said so), `person` (the endpoint's own person), or absent | VS6, VS9 |
| `source` | `person`, or `machine` when the front attributes the speech to a known machine (a Станция's own speech from its feed); a `machine` utterance is delivered as data, like `echo` | VS2, VS4 |

`addressed_by`, `speaker_hint` and `hint_basis` belong to the endpoint that heard, never to the
merged utterance as a whole: what one endpoint's microphone or gate established is no evidence at
another.

**One sentence heard twice is one utterance.** The front merges what two microphones in one zone
heard when their speech intervals overlap **and** their transcripts agree closely. Identical text
cannot be required, because two microphones give two transcripts. Two different sentences
spoken at once stay two utterances. The merged utterance keeps the better transcript, names in
`endpoint` the one the front will answer from (the responder), and lists the others in
`also_heard_at`.
- The endpoints in `also_heard_at` are **arbitrated duplicates** in GA-BRAIN-4's sense. A write the
  brain makes for the utterance names the endpoint of lowest role among all of them, whichever one
  the front chose to answer from. A visitor's shout heard by the guide's kiosk and the wall
  satellite acts as the wall satellite's guest (VS10).
- An utterance was heard at every endpoint it lists. So a `yes` merged from the plan's endpoint and
  another may answer at the plan's endpoint, and at no endpoint the utterance does not list. The
  utterance record the answer carries (GA-CONF-2) names the plan's endpoint, with **that
  endpoint's own** `addressed_by`, hint and basis, never the responder's.
- When one copy of merged speech is marked an echo and another is a person, the merged utterance
  is a person.
- **Only admitted audio is used.** Merging, echo marking and zone inference use frames that each
  endpoint's effective listening already admits. An endpoint at `tap` or `off` is never
  transcribed to find a duplicate.
- **Merging is for brains that understand it.** A brain that does not declare the new front
  version gets every copy as its own utterance, as today, so GA-BRAIN-4 keeps holding for it.
- **One merged utterance answers one plan.** Its `utterance_id` is one id across the zone, and the
  steward's reuse check (GA-CONF-2) keys on it, so a yes heard at two endpoints cannot answer a
  plan at each. The record's `time` is the start of the speech on the box's clock, which every
  device's durations are converted to.
- GA-BRAIN-5 remains as the brain's backstop for what the front did not merge.

**Echoes are the front's to mark, everywhere in the zone, without ever marking a person.** The
front knows every playback it made: where, and from when to when on that device's clock. A barge-in
overlaps the playback it interrupts, so overlap alone cannot be the test: «Стоп», and a «нет» that
replaces a yes, must stay a person's words.
- **One test, at every device in the zone, the one that played included:** an utterance is
  `echo: true` if its speech interval overlaps a playback in the zone **and** its transcript
  matches the text that was playing at that moment. At the device that played, echo cancellation
  removes most of it first; the test catches the residue. Speech that overlaps but does not match
  is a person, and is delivered as one.
- **The house must never hear its own yes.** A question the brain asks does not contain the words
  that would answer it, the wake word with them («Скажите „Галатея, да“» is not allowed); with the
  test above, a reply the house hears back cannot pass as a person's wake-addressed yes.
- **When unsure, deliver it as a person.** A missed echo reaches the brain as a person's words,
  where GA-BRAIN-3's rule on its own speech heard back and the brain's own matching still apply.
  A person's words wrongly marked as an echo would be lost.
- Intervals travel as durations on each device's own clock, never as timestamps compared across
  machines (see *Timing* under *Evidence*).

### Replies, as the brain gives them

`say` gains:

| Field | Meaning | Scenarios |
|---|---|---|
| `say_id` | Returned by `say`; names this piece of speech | VS1, VS7 |
| `continues` | The `say_id` this one follows: a reply spoken sentence by sentence, starting before it is all written | VS1, VS7 |
| `invites_reply` | After this piece is played, the front opens a follow-up window at the zone that heard it | VS1, VS2 |
| `endpoint` | As today, for every `say`, prompted or not. Where to speak unprompted is the brain's choice: it reads occupancy and the endpoints' `output` from the steward. The front has no house concepts and does not route | VS8 |

And the front reports what became of each piece, through `listen`, as a second kind of item beside
utterances:

| Item | Meaning |
|---|---|
| `played { say_id, endpoint, status: full · cut · dropped, heard_chars? }` | Played in full; cut by a barge-in or a cancel after `heard_chars` characters; or never played (the device was gone, or the conversation was cancelled) |

A brain may cancel its own pending speech with `hush { endpoint | say_id }`. A person's barge-in
stops playback at once in the front, which reports `cut` (VS1 «Стоп», VS7 «Ладно, забудь»).
**GA-BRAIN-7 keeps grading what the brain said**. With `played`, a brain can also tell what was
heard, and a grader can check that a correction answers what was heard.

### The follow-up window, and what it may answer

- The front opens a window only after a `say` with `invites_reply` has finished playing, and only
  at endpoints of that zone whose voice record has `follow_up` on and whose effective listening is
  `wake_device` or wider. It closes it after a silence (a constant for the standard, unmeasured). An
  utterance inside it is `addressed_by: follow_up`.
- **A window never exceeds what the endpoint may hear.** At a `wake_device` endpoint, the device
  streams speech during the window only, as it does after a wake. No window opens at `off` or
  `tap`, nor after a `say` that is not `in_reply_to` an utterance of the conversation.
- **A conversation ends** after a bounded time without a `wake`, `tap`, `skill` or `typed` turn (a
  constant, unmeasured),
  so a brain that invites a reply every time cannot keep a room listening. After that, only the
  wake word or a tap addresses Galatea there.
- **A follow-up alone never answers a `confirm` ask at a shared endpoint** (VS2). The steward's
  utterance record (GA-CONF-2) gains `addressed_by` and `hint_basis`. An answer from a brain-served
  endpoint is accepted only if its record says one of:
  - `addressed_by` is `wake`, `tap`, `skill` or `typed`;
  - `addressed_by` is `follow_up` at an endpoint of `type: app`: the phone in the person's hand,
    held to talk or open (VS9). A room microphone with a person of its own does not count: the risk
    is a TV in the room, not who owns the endpoint;
  - `addressed_by` is `follow_up`, `hint_basis` is `gate`, and the hint names the plan's `speaker`,
    or, for a plan that named none, any registered person.

  A record without `addressed_by` is refused (`invalid_request`), so an older brain or front fails
  closed. When a follow-up yes is refused, the brain asks for «Галатея, да», or the owner's
  `confirm_on` applies as today. This is a safety floor, not a policy: it keeps the TV from earning
  a token.
- Everything else a follow-up may start, a reversible action included, is left to the brain and
  the steward's role rules. The measured 0.54 false accepts an hour says a window is not free,
  and the tiers say what a false accept can reach.

### Conversation state

The brain holds the conversation's meaning: context, history, what "it" refers to. The front holds
only the mechanics: the window, the conversation id, and which zone it lives in. A conversation lives
in one zone. In VS3 both satellites hear the sofa, so they share a zone, and Наталья walking to
the kitchen stays inside it. A follow-up heard only in another zone starts nothing; it needs the
wake word. Widening where a conversation may continue is widening `zone`, which is the owner's.

### Speakers we do not own, and other media

**As devices.** A Станция, an Echo, a TV or a museum kiosk is a device of the applier, reached
through a bridge or an adapter, of class `speaker` or `tv`, with the `media` capability. The applier
already declares `media.duck(on)`, stateless. What the vendors allow:

| Device | Through | Gives | Evidence |
|---|---|---|---|
| Станция | Yandex's local protocol, behind an adapter | `media` (pause, resume, volume, duck), speaking a text, and what Алиса is saying | AlexxIT's YandexStation; unofficial |
| Echo | Alexa Media Player, or Home Assistant's *Alexa Devices*, behind an adapter | Announcing a text, volume | Unofficial, broke repeatedly in 2025 |
| Sber | Unofficial integrations | Control only; no speech output shipped | Competing reverse-engineered projects |
| A TV | Vendor protocols (Android TV Remote, `pyatv`, Wake-on-LAN), behind a bridge | Power, apps, volume | Research on TV control |

- **Speaking through them is an action, not a `say`.** An announcement on a Станция is an applier
  action on that device (`media.announce(text)`, a new stateless action, below), which the brain
  requests through the steward like any other, under the tiers and in `history`. The front speaks
  only through the devices it links to. VS8's boiler notice goes to the kitchen satellite by `say`,
  or to the kitchen Станция by `media.announce`, as the brain chooses.
- **Ducking is the steward's.** The front tells the steward when it starts and stops speaking at an
  endpoint (`speaking { endpoint, on }`, on its credential). The steward may duck the `media`
  devices in that endpoint's room that declare `duck`, and restore them afterwards. It records the
  cause as the front's speech, and applies through the applier, so a duck is an outcome like any
  other. Whether to duck, and which devices, is the steward's configuration (no premature policy).
  A failure costs audibility, not safety (VS4).
- **What the front learns: sources.** The steward gives the front, for each zone, the `media`
  devices in its rooms that are playing, with the text a device reports it is speaking where it
  reports one (a Станция's own speech, as a namespaced state key). The front uses this only to mark
  speech `source: machine`: an utterance in that zone whose speech interval overlaps the device's
  speech **and** whose transcript matches its text. Anything else, a «Стоп» said over her included,
  is a person, as with echoes. A TV or a kiosk video reports no text, so its speech cannot be
  marked. There the only defence is the wake word, which VS2's rule for a follow-up yes already
  relies on.

**As a text front.** The Alice skill ingress gives utterances with `addressed_by: skill`, and replies
go back as the skill's response. It uses Yandex Dialogs, which is official, and needs a public HTTPS
endpoint Yandex can reach. Sber has none shipped.
- **A skill session is a follow-up window.** A Dialogs session stays open when the reply says so;
  the front keeps it open only where the endpoint's `follow_up` is on, and marks its later turns
  `follow_up`, so the confirm rule applies to them as to any window.
- **Anyone on the skill's account, anywhere, speaks at that endpoint.** Its `max_role` should be low,
  and `visitor` where available.
- **The skill ingress is the only internet-facing part of the front.** It authenticates Yandex's
  requests and forwards text. A skill identifies an account, not a device, so one skill account is
  one endpoint: two Станции on one account share it, and are told apart only by giving each room
  its own account. Nothing else in
  the front is reachable from outside. A household that does not want it does not enable it.

### The owner's phone (VS9)

The app is a room device that happens to be outside. It reaches the front through the box's remote
access, over TLS, with the credential of an `app` endpoint that has a `person`. It sends audio, or
the phone's own transcript as `typed`. Its utterances carry `hint_basis: person`, and a follow-up
there may answer a `confirm` ask, because the endpoint is `type: app`. That changes
nothing about the tiers, because it is still brain-served.

### Latency

The budget for VS1's target, "speech starts under 1.5 s after the person stops", on the box's
CPU with a local model for the short reply:

| Stage | Budget | Evidence |
|---|---|---|
| End of turn detected | 300 ms (silence, or a turn model sooner) | A deployed endpointer's hangover is 600 ms; a turn model is the upgrade |
| ASR | 500 ms | GigaAM, median 564 ms on utterances under 4 s |
| Brain, first sentence | 500 ms | Unmeasured; a local model on the box, or a cloud model |
| TTS, first audio | 150 ms | Silero reports a real-time factor of about 0.04 on a CPU |
| Network and playback | 50 ms | LAN |

This is a target, not a floor. The standard should require the front to **measure and expose** it
per utterance (from the end of speech to the first audio), not to meet it. A number nobody measures
is not a requirement.

### Failure handling

| Failure | What happens | Why |
|---|---|---|
| The brain does not answer | If the brain has said nothing `in_reply_to` an utterance by the failure bound, the front plays a fixed system clip («Не могу ответить»), once. A reply that arrives later is still played: it is the truth, and the clip only said the house was slow. The clips' language is the installation's | The front composes no words, but a person must not be met with silence. GA-BRAIN-12 remains the brain's |
| The steward is unreachable | The front keeps its last configuration and may only narrow it | Never widen without authority |
| A satellite drops mid-reply | The piece is `played … dropped`; nothing is retried on another device unasked | The brain decides whether to repeat elsewhere |
| ASR fails on an utterance | No utterance; the earcon at the wake already told the person they were heard. A second failure in a row plays a fixed clip | Experience from a deployed fleet: failures speak, once, then fall silent |
| A wake word with no model, or a model that disappears | The effective mode becomes weaker (the transcript check at `wake_server`, `tap` at `wake_device`), reported in `front_status`, with a notice to the owner | VS11: never silently, never wider |
| A Станция's or Echo's adapter breaks | Its duck and announce fail as applier outcomes; no `machine` marking in its zone; our satellites still speak | Best effort; nothing depends on an unofficial path |
| The skill ingress is down | Алиса says the skill is unavailable; nothing else changes | It is only a way in |

### Security

- Device links: the ESPHome native API with its encryption key; WebSocket over TLS for browsers and
  the app, loopback excepted. Wyoming, where the front uses it for its own services, stays on one
  host.
- The front authenticates to the brain as the brain standard's front does (a bearer credential,
  TLS).
- A connection that has not been admitted gets nothing: no model, no transcription.
- The skill ingress is the one outside surface (above).
- **Audio and voice models stay on the box.** The front keeps no audio by default; what it may
  keep, and for how long, is configuration the owner sets, and none of it leaves the box. Models
  enrolled on a person's voice (the speaker gate) live on the box, are never exported, and are
  deleted with the person.
- **Transcripts do leave the box** when the owner's brain runs in the cloud. That is the brain's
  deployment, not the front's, and the owner chooses it.

### Heard, but never acting (VS10)

A guest may do anything `reversible` (GA-TIER-3), so a museum hall, or a hallway that guests pass,
cannot today be an endpoint where people may ask but never act. **Proposed:** a role below guest,
`visitor`. A visitor's plan, apply, scenario or define step is `refuse(role)`, and a visitor may
still ask questions and hear answers, and narrow listening. An endpoint's `max_role` may be
`visitor`. A new role is a steward change with its own ruling; the design needs it for VS10 and
offers this shape.

## What moves in the standards

| Standard | Change | Why |
|---|---|---|
| **A new voice standard** (`standard/voice.md`) | The front's obligations: listening modes and narrowing; wake words as configuration with declared models; addressing; merging co-heard speech; echo marking by intervals; `played` reports; the follow-up window; fixed clips only; latency measured; the measurement procedure for a wake model | VS1–VS11 |
| **Brain 0.4** | The front's new fields (`addressed_by`, `conversation`, `also_heard_at`, `hint_basis`, `source`; `say_id`, `continues`, `invites_reply`; `played`; `hush`). A `machine` utterance is data (GA-BRAIN-3). The front merges one sentence heard twice, and `also_heard_at` counts as arbitrated duplicates for GA-BRAIN-4 (GA-BRAIN-5 stays as a backstop). `narrow` joins the steward writes GA-BRAIN-3, GA-BRAIN-5 and GA-BRAIN-17 list, and GA-BRAIN-4 lets it name any endpoint the utterance was heard at (not only the lowest-role one), so a brain narrows only where it was asked. GA-BRAIN-1 also requires that the asking `say` was played (`full`, or `cut` after the question). Unprompted speech goes where the brain chooses | VS1, VS2, VS3, VS7, VS8 |
| **Applier (next)** | `media.announce(text)`, stateless, for a `speaker` or `tv` that can speak a text; a namespaced state key for the text a device is speaking, where it reports one | VS4, VS8 |
| **Steward 0.5** | The endpoint's voice record (`listening`, `wake_words`, `zone`, `output`, `follow_up`) and its effective mode; `narrow` from any principal at the endpoint and from the front, stacking, widening only by the owner from an endpoint not served by a brain; the client kind `front`, with `front_status`, `speaking` and the zone sources it reads, bound through the voice record's `heard_by`; GA-DEF-3's exception for a narrowing, and `lift_narrowing` for the owner; GA-CONF-2's reuse check keyed on a merged utterance's one id; the utterance record gains `addressed_by` and `hint_basis`, with the rule for a follow-up answer; a role below guest (proposed below, ruling owed) | VS2, VS5, VS10, VS11 |

## Conformance

- The harness plays devices, adapters and the brain. It needs audio to test a front, and ⛔ no
  audio enters this repository: test audio is **synthesised at test time** by a TTS the harness
  names, or supplied from outside the repository by the tester. Only its descriptions and expected
  results are committed.
- What the harness can check on the wire: listening modes (no frames read outside what the mode
  admits, from the front's counters), narrowing, co-heard merging and echo marking (by playing one
  synthesised sentence to two fake devices with known offsets), `played` after a cut, the follow-up
  record's effect on a `confirm` answer, the wake word as configuration, and fixed clips on a silent
  brain.
- What it cannot: recognition quality, false wakes in a real room, and latency on real hardware.
  Those are measured by the procedure for wake models, on the home's own satellite, and reported.

## Scenarios

| Scenario | Served by |
|---|---|
| VS1 | `addressed_by`, `invites_reply`, `continues`, `played`, echo marking, latency measured |
| VS2 | `follow_up` does not answer `confirm`; `source: machine` where a feed exists |
| VS3 | Zones, co-heard merging (lowest role for writes), responder, echo in the zone without losing a barge-in, a conversation that lives in its zone |
| VS4 | The Станция as a device: ducking by the steward on the front's `speaking`; its speech as `machine` from the sources; the skill ingress |
| VS5 | Listening modes, `narrow` by anyone for at most 12 h, widening by the owner, nothing kept |
| VS6 | `hint_basis`, failing toward a guest |
| VS7 | `continues`, `hush`, `played`, fixed clips; the brain's own fallback unchanged |
| VS8 | Unprompted `say` to an endpoint the brain chooses from occupancy and `output`, or `media.announce` on a Станция |
| VS9 | An `app` endpoint, where a follow-up yes counts because the phone is in the person's hand |
| VS10 | Modes set by the owner, tap windows, the lowest role among co-heard endpoints, and `visitor` |
| VS11 | `wake_words` as configuration, declared models, the effective mode and its notice |

## Compatibility

### Lessons from a deployed voice system

The design draws on experience from a deployed fleet with a voice front of its own. What that
experience decided here, and why:
- **A live change only narrows.** The modes `tap`, `wake_server` and `wake_device` are joined by
  `off`, given an explicit order, and narrowings stack, so a live change never widens.
- **Configured and effective modes, with a notice when they differ,** so a degraded endpoint is
  never silent about it.
- **No follow-up window by default** (`follow_up` off): a window costs false accepts.
- **The earcon at the wake, fixed failure clips, and failures that speak once,** then fall silent.
- **Admission before audio:** a device link that has not been admitted gets nothing.
- **The echo test matches text, not overlap alone.** An overlap check marks a barge-in as an echo;
  this one does not. Excising a system's own clips by text distance at a threshold of 0.34 proved
  unsafe (a person scored 0.263), so the match must be tight, measured per phrase, and "when
  unsure, a person".
- **Addressing is enforced by the front.** The steward checks addressing only for a `confirm`
  answer; whether it should check every write is a question for the standard.
- **No capture mode.** Recording every addressed segment has no place here; what is kept is the
  owner's retention setting.
- **Content playback.** A kiosk or TV is a device of a child applier (G5), class `tv`. `pause` and
  `resume` are already in the closed vocabulary. «тише» and «громче» against an absolute volume:
  the brain reads `volume` and sets `media.set_volume`, as it reads a setpoint for «на 2 градуса
  теплее». Playing a named item, `next`, `seek` and the like are namespaced extensions
  (`vendor.kiosk.play`); Galatea never learns what content is. Power, reboots and app control are
  declared `no_voice` by the applier and enforced by the steward and the applier whatever the
  brain does, which is stronger than an allowlist in a resolver. A tier is per action, not per
  state, so a device that voice must not touch in some state is refused by its applier or not
  exposed. A rule on an argument (a folder only some roles may play) is not expressible, since
  roles apply to actions; it stays with the implementation.
- **Naming rules for voice** (one to three words, stems, numbers up to 20, ask on ambiguity) are
  general: a guide for naming the house model. With configurable wake words, `define` should warn
  when a name contains a wake word of an endpoint that hears it.

### Home Assistant

**As components: fully compatible.** Its satellites (Voice Preview units, `linux-voice-assistant`)
speak the ESPHome native API the front uses. Its wake options map to `wake_device` (microWakeWord)
and `wake_server` (openWakeWord). Its speech services over Wyoming can serve the front on one host.
Whether a unit serves two voice pipelines at once is unverified (*Open*).

**As a whole front: partial**, like any engine that does not conform. A Galatea adapter acting as
Home Assistant's conversation agent gets `text`, `satellite_id`, `device_id` and `conversation_id`,
and can return `continue_conversation`:

| Need | Through Home Assistant |
|---|---|
| Text, endpoint, conversation; `invites_reply` | ✅ |
| `addressed_by` | ✅ derived: the adapter knows which turn followed its own `continue_conversation` |
| Unprompted speech | ✅ through its satellite announce and start-conversation actions (not re-checked for this year's release) |
| Wake word per satellite | ✅ among its models |
| Narrowing | ⚠️ only to `off`, by the satellite's mute switch; nothing enforces who widens |
| `played`, `hush`, barge-in reports | ❌ the agent is never told |
| Merging, echo across devices, a responder | ❌ each satellite is alone |
| `speaker_hint` | ❌ fails toward a guest |

Graded: VS2, VS6, VS8, VS9 and VS11 hold; VS1, VS5 and VS7 partly; VS3, VS4 and VS10 cannot
(VS4's Станция works beside it, as a device).

## Open

**Left to the standard and its review** (details a standard author must fix, found by the design
review, with no architectural choice in them):
- which piece of a `continues` chain carries `asks`, and how "cut after the question" is found in
  `heard_chars`;
- what `played` means for a skill reply, which the front cannot observe, and so whether a skill
  question can be answered;
- what a speaker gate must resist before `gate` with `follow_up` may answer a `confirm` ask (a TV
  playing the person's own recorded voice);
- the constants: the follow-up silence, the conversation's end, the merge window, the 12 h bound.

**Open questions:**

- ⚠️ **Whether a Voice Preview unit can serve two ESPHome clients' voice pipelines at once**, or only
  one. If only one, adopting it into the front takes it away from Home Assistant. Unverified.
- ⚠️ **Turn detection in Russian**: whether Smart Turn v3's languages include Russian at useful
  quality.
- ⚠️ **The follow-up window's silence, the merge window and the latency budget** are guesses until
  measured on the home's satellites.
- **The role below guest** (VS10): proposed as `visitor` above; a ruling is owed.
- **TTS licence bar**, owed from the research note.
- **Unprompted speech** (VS8): the brain chooses where. Whether the brain standard should add a
  floor ("never to an endpoint in a room that is not `occupied`, except for a safety notice"), or
  leave it as a SHOULD, is for the brain revision.
