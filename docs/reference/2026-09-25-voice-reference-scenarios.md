---
title: Voice reference scenarios — talking with Galatea, decomposed
status: draft
last_verified:
area: voice
audience: dev, pm
author: Galatea maintainers
version: 4
related:
  - docs/reference/2026-09-24-home-reference-scenarios.md
  - standard/voice.md
  - standard/brain.md
  - standard/steward.md
  - standard/applier.md
  - docs/reviews/2026-09-25-voice-0.1.md
  - docs/architecture.md
---

# Voice reference scenarios — talking with Galatea, decomposed

| Date | Version | Change |
|---|---|---|
| 2026-09-28 | 4 | VS1–VS11 regraded against voice 0.2, brain 0.6, steward 0.8 and applier 0.13, the MCP revision pin (`docs/reviews/2026-09-28-mcp-revision-pin.md`). No grade moves. |
| 2026-09-27 | 3 | Relabelled for the merge onto the PC work, where voice's brain 0.4, steward 0.5 and applier 0.10 became brain 0.5, steward 0.6 and applier 0.11, and GA-BRAIN-18 and GA-AUTH-6 became GA-BRAIN-22 and GA-AUTH-8; grades unchanged until the voice review's round 12 walk |
| 2026-09-25 | 2 | Regraded against voice 0.1, brain 0.4, steward 0.5 and applier 0.10 at the voice review's PASS (`docs/reviews/2026-09-25-voice-0.1.md`). Every hop rewritten against the passed text, with the rewrites the review deferred: VS2's gate hint, VS4's skill endpoint raised to `guest`, VS5's `refuse(role)`, VS7's wake word, VS8's announce channel as the steward's configuration, VS9's hands-free «Галатея, да», VS10's kiosk as two endpoints and its want, VS11's verbatim transcript. 7 drive, 4 partly (VS1, VS4, VS7, VS8), 0 cannot. Each scenario's verdict keeps its first grades and adds the new ones |
| 2026-09-25 | 1 | First eleven voice scenarios, VS1–VS11, in the two homes of the home scenarios, one museum hall, and three installations with different wake words. Graded against brain 0.2 and steward 0.3: the brain and steward hops mostly hold; every voice hop cannot, because no voice standard exists. They drive the voice architecture. |

**These are the measuring stick for Galatea's voice.** The home scenarios (HS1–HS18) treat voice as
a black box that delivers text. These open the box: how an utterance comes to exist, how a reply
reaches a person, and what happens between them in a conversation. The north star is **a full
spoken conversation with the brain**: several turns, without the wake word after the first,
interrupted when a person talks over it, and answered from the speaker nearest the person. Command-only
voice as deployed today ("one wake, one utterance") is a subset of this, not the target.

Each scenario has the same shape as the home scenarios: the home, the moment, what we want, the
hops, what guards it, and a verdict. The hops name one more participant:

- **The voice front**: whatever turns sound in a room into utterances for the brain's `listen`,
  and the brain's `say` into sound. It holds the satellites, the listening modes, the wake check,
  ASR, TTS, echo marking and arbitration between devices. Which process does this (Home
  Assistant, an existing voice sidecar, a Galatea pipeline) is the architecture's question, not these
  scenarios'. The brain standard bounds its outside: text only, `listen`, `say` and `hush`
  (`standard/brain.md`, *The front*). The voice standard (`standard/voice.md`) governs the rest.

⛔ **Nobody has been interviewed**, as in the home scenarios. The numbers in *What we want* come from
a deployed voice system's measurements in one office and one museum, or are targets nobody has measured. They are to
be refuted by the first real household.

⛔ **No audio and no voice profiles enter this repository.** A scenario may need a model enrolled on
a person's voice; that model lives on the home's box and nowhere else.

## The homes

The flat and the house are those of `docs/reference/2026-09-24-home-reference-scenarios.md`,
*The two homes*. What matters for voice:

| | The flat | The house |
|---|---|---|
| Our satellites | Two: the living room (open to the kitchen) and the hall | Three: the ground-floor living room, the kitchen, the first-floor landing. Two of them hear the sofa (HS5) |
| Speakers we do not own | Two Яндекс Станции, one in the living room, one in Лиза's room | One Станция in the kitchen |
| Speech elsewhere | A TV in the living room | A TV in the living room; a radio in the kitchen that Валентина Петровна keeps on |
| Phones | Ольга's and Дмитрий's, with the app | Сергей's and Наталья's, with the app |
| Who talks to walls | Ольга, Дмитрий; Артём (15) rarely; Лиза (9) only to Алиса | Сергей, Наталья; Валентина Петровна never |

And one space that is not a home, because G5 says a museum is just another space:

| | The museum hall |
|---|---|
| Our endpoints | A kiosk box with a screen and a tap-to-talk button, used by a guide: two endpoints, a `voice` one for its microphone and a `panel` one for its screen; a satellite on the wall of the hall |
| People | Guides (`member`), visitors (guests, many, speaking over each other), an administrator (`owner`) |
| Rule of the venue | Signage says when the hall listens. Visitors never act on anything |

## VS1 · 19:10 — planning the weekend, a conversation

**The home.** The flat. Дмитрий is on the sofa; the TV is off; the living-room lights are at 80 %.
The living-room satellite listens at `wake_device`, and Ольга has turned its `follow_up` on (it is
off by default). The front claims Converse.

**The moment.** «Галатея, какая погода в субботу?» The brain answers with the forecast, three
sentences. Halfway through the second, Дмитрий cuts in: «Стоп, только днём». It answers again,
shorter. He goes on without the wake word: «А в воскресенье?» — then «Ладно, тогда сделай свет
потише» — then, to Ольга in the kitchen, «Оль, в субботу едем», which is not for Galatea. Two
minutes later the TV comes on.

**What we want.**
- One wake word, then a conversation: the follow-ups need none.
- Speech starts under 1.5 s after he stops talking, measured at the satellite, for a reply the
  brain can give from one data call. The earcon at the wake comes at once, within the 1 s
  bound a deployed system keeps for knowing a wake failed.
- «Стоп» stops the speech within half a second and the rest is not said. The brain knows what
  Дмитрий actually heard, so «только днём» is answered as a correction of what he heard, not of
  what it wrote.
- «сделай свет потише» dims the living room, inside the conversation.
- «Оль, в субботу едем» is not answered and changes nothing. The TV, two minutes later, is not a
  turn in the conversation.
- The brain's own voice, heard back by the satellite, is never a turn.

**Decomposed.**

| Hop | What happens | Governed by |
|---|---|---|
| Person → satellite | The satellite's own wake model fires on «Галатея» and sends the word's audio with at least the minimum pre-roll before it; the front confirms that the word begins the utterance, with no speech before it (GA-VOICE-4). The earcon plays at once: a fixed clip, allowed, not required (GA-VOICE-11) | Voice |
| Satellite → front | The window's audio to the end of the turn, at most the utterance limit (GA-VOICE-1). How the end is found (silence, a turn model) is the front's | Voice |
| Front → brain | An utterance through `listen`, `addressed_by: wake` (GA-VOICE-5), with a `conversation` id, `time` when the speech began on the front's clock and its `clock_epoch` (GA-VOICE-8). The transcript is verbatim, the wake word included | Voice; Brain, *The front* |
| Brain | Reads the forecast from a data server; data never instructs (GA-BRAIN-3) | Brain |
| Brain → front → satellite | The reply in pieces, `in_reply_to` the question, each after the last (`continues`), so speech starts before the reply is written. Numbers and units are written as spoken («плюс тринадцать»), a SHOULD, so that echo matching compares what was said (brain, *The front*). The first piece's `played` carries `latency_ms`, measured, not bounded (GA-VOICE-10). The front tells the steward it speaks (GA-VOICE-12) | Brain; Voice |
| Person → satellite, during the speech | «Стоп, только днём». A barge-in window is open while the reply plays, since `follow_up` is on and listening is `wake_device` (GA-VOICE-6). The front SHOULD pause within the barge-in delay, and cuts once the speech is a person's: it does not reach the echo match against the reply, so it is no echo (GA-VOICE-6, GA-VOICE-8). It is `follow_up` (GA-VOICE-5) | Voice |
| Front → brain | `played { status: cut, heard_chars, cut_by }` for the piece, before the utterance that cut it; the pieces after it `dropped` (GA-VOICE-10). The brain answers a correction of what Дмитрий heard | Voice; Brain |
| Person → satellite, no wake word | «А в воскресенье?», inside the follow-up window that opens once a piece with `invites_reply` has played `full`, for the follow-up silence (GA-VOICE-6); `follow_up`, same `conversation` | Voice |
| Brain → steward | «Ладно, тогда сделай свет потише», in the next window: the resolver maps it to a dim of the living-room lights; `reversible`, which every role but `visitor` may (GA-TIER-3); applied inline (GA-STW-10) | Brain; Steward |
| Person → satellite | «Оль, в субботу едем». If the dim's reply invited an answer, it arrives as `follow_up`; the brain judges it is not for it, says nothing and SHOULD `hush { utterance_id }`. A follow-up draws no «Не могу ответить» (GA-VOICE-11). If no window is open, nothing is streamed (GA-VOICE-1) | Brain (judged); Voice |
| Front | The last window closed the follow-up silence (8 s) after its inviting piece ended, and the conversation ended after the conversation span (120 s) without a `wake`, `tap`, `skill` or `typed` turn (GA-VOICE-6), long before the TV comes on | Voice |
| Satellite → front | The reply heard back, where a window admits it, overlaps the playback and reaches the echo match: `echo: true` (GA-VOICE-8), which the brain reads as data (GA-BRAIN-3) | Voice; Brain |

**Trust and guardrails.** The follow-up window is where a deployed system's measurements bite: it rejected a
10 s window for commands at 0.54 false accepts an hour against a 0.1 target, and in every genuine
multi-turn case its wake word simply worked again. A conversation is a different need, because
turns without the wake word are its point. So the guard cannot be "no window". It has three parts:
- the window opens only after a reply that invites an answer, and closes on silence;
- every utterance says how it was addressed, so the brain treats a follow-up as a candidate, not
  a command;
- the steward's tiers are unchanged. A follow-up that the brain mistakes for a request can reach
  only what that endpoint's role and tier allow, and «Оль, в субботу едем» asks for nothing.

The brain's voice heard back is data (GA-BRAIN-3), and a marked echo is graded; the question was
who marks it. The front does, on overlap and matching text, never on overlap alone, so «Стоп» stays
a person's word (GA-VOICE-8).

**Verdict.** Brain 0.2 / steward 0.3: ✅ the dim, and the forecast as data. Voice: ❌ cannot. No
standard says how an utterance was addressed, that a reply invites an answer, that a reply was cut
and where, or how fast speech starts. GA-BRAIN-7 grades what the brain *said*; with barge-in, what
was *heard* differs, and nothing carries it.

**Brain 0.5 / steward 0.6:** ✅ the dim (GA-TIER-3, GA-STW-10), the forecast as data (GA-BRAIN-3).
**Voice 0.1:** ⚠️ partly. Addressing (GA-VOICE-5), windows and the barge-in cut (GA-VOICE-6), echo
(GA-VOICE-8) and `played` (GA-VOICE-10) drive. The 1.5 s to speech is measured, never bounded
(`latency_ms`, GA-VOICE-10), the pause within 0.5 s is a SHOULD, and the earcon is allowed, not
required.

## VS2 · 21:30 — «Да», said by the television

**The home.** The flat. The TV is on in the living room, a talk show. Ольга is on the sofa. The
living-room satellite has `follow_up` on and runs a gate model enrolled on Ольга's voice, which the
front declares with its measured numbers (GA-VOICE-18).

**The moment.** «Галатея, включи обогреватель у Лизы на ночь». The heater's socket is declared
`load: heating`, so turning it on is `confirm` (HS14). The brain asks: «Включу обогреватель в
комнате Лизы, он выключится через четыре часа. Включить?» Before Ольга answers, a guest on the talk
show says «Да, конечно». Ольга then says «Да», and, if that is not taken, «Галатея, да».

**What we want.** The heater goes on because Ольга said yes, not because the television did. If
the front cannot tell them apart, the TV's «да» must not count and Ольга is asked again, never the
reverse.

**Decomposed.**

| Hop | What happens | Governed by |
|---|---|---|
| Person → front → brain | The request, `addressed_by: wake`, with `speaker_hint` Ольга and `hint_basis: gate` from the gate model (GA-VOICE-5, GA-VOICE-14) | Voice |
| Brain → steward | `plan` naming Ольга as `speaker`, from that hint (GA-BRAIN-11). Her role is the lower of hers and the satellite's `max_role`, so `member`; without the hint she would be a guest, and the heater `refuse(role)` (GA-AUTH-2, GA-TIER-3). The plan returns `ask(confirm_tier)` (GA-TIER-2) | Brain; Steward |
| Brain → person | The question, in a `say` whose `asks` names the plan, with `invites_reply`. It holds no answer word; «Включить» is its own verb (GA-BRAIN-22). The front reports it `played` `full`, with `ended_at` (GA-VOICE-10) | Brain; Voice |
| TV → satellite | «Да, конечно», inside the follow-up window the question opened (GA-VOICE-6). The TV reports no text, so nothing marks it a machine's (GA-VOICE-9): it is a person's `follow_up`, with no hint, since the gate does not match (GA-VOICE-5, GA-VOICE-14) | Voice |
| Brain | Sends no `answer`: the plan named Ольга, and the utterance's hint does not name her (GA-BRAIN-1). A brain that sent it anyway would be refused: a `follow_up` yes counts only with a `gate` hint naming the plan's speaker, else `not_permitted`, changing nothing (GA-CONF-6) | Brain; Steward |
| Person → satellite | Ольга's «Да», in the same window, `follow_up`. It counts only if the gate gives her hint on one word, which a gate model hints on only where its declared numbers cover speech that short (GA-VOICE-18, GA-CONF-6). Otherwise the brain asks her to answer addressing it by name («ответьте, назвав меня по имени», brain *Answers*), and «Галатея, да» is `wake`, with her gate hint | Voice; Brain |
| Brain → steward | `answer` with the utterance record: the plan's endpoint, `addressed_by`, her hint and basis, `clock_epoch`, and `asked_by` copied from the question's `played` report (GA-BRAIN-1). The steward refuses it unless the question was played `full` and her «да» began after its `ended_at` (GA-CONF-2), and checks the addressing against the voice record (GA-CONF-6) | Brain; Steward |

**Trust and guardrails.** Today's rules would accept the TV's yes. That was acceptable while every
utterance began with the wake word, because a talk show rarely says «Галатея, да». A follow-up
window removes that protection exactly where it matters most: the spoken yes that earns a token.
The candidate guards:
- an answer to a `confirm` ask needs the wake word, so the window serves conversation but not
  consent;
- or it needs a `speaker_hint` for the asking person, from a gate enrolled on their voice;
- or the front attributes the audio to the TV (a known source of speech, by direction or by the
  TV's own audio) and marks it as not a person.

The first is cheap and certain; the others are better and unproven. The ruling that the brain's
spoken yes is trusted for `confirm` stands. This scenario asks what the brain may count as a yes.

The standards took all three, each where it holds: a follow-up yes needs a gate hint naming the
asker (GA-CONF-6), the wake word always answers, and a device that reports its speech is marked a
machine (GA-VOICE-9). A TV reports no text, so a broadcast «Галатея, да» is a `wake` yes; here the
plan named Ольга, so it counts only if the gate takes the TV for her. That residue of trusting a
spoken yes is recorded (steward, *The confirmation dialogue*); an owner who fears it points
`confirm_on` at an app.

**Verdict.** Brain 0.2 / steward 0.3: ⚠️ correct as written, but only because a wake word stood in
front of every utterance, which no standard says. Voice: ❌ cannot. Nothing marks an utterance as a
follow-up, and nothing restricts what a follow-up may answer.

**Brain 0.5 / steward 0.6:** ✅ the TV's yes is never sent (GA-BRAIN-1) and would be refused
(GA-CONF-6); Ольга's counts, with her hint, after the question (GA-BRAIN-1, GA-CONF-2).
**Voice 0.1:** ✅ the follow-up is marked (GA-VOICE-5) and the hint carries its basis (GA-VOICE-14).

## VS3 · 20:05 — two satellites, one answer

**The home.** The house, the ground floor, as in HS5: the living-room and kitchen satellites both hear
the sofa. They are one zone, both with `follow_up` on. The front claims Zone, and the brain names a
`front_version` of 0.4 in `listen`.

**The moment.** Наталья asks a question, not a command: «Галатея, когда завтра приедет мастер по
котлу?» Both satellites hear it. The living room's transcript is «когда завтра приедет мастер по
котлу», the kitchen's «когда завтра приедет мастер по коду». The answer is spoken. Then Наталья,
walking to the kitchen, asks: «А он позвонит заранее?»

**What we want.**
- One answer, from one satellite, the one nearer Наталья. No chorus.
- The other satellite hears the answer and does not take it for a person (no reply loop).
- The follow-up is heard by the kitchen satellite, and the conversation continues there: same
  conversation, now answered from the kitchen.

**Decomposed.**

| Hop | What happens | Governed by |
|---|---|---|
| Person → two satellites | Two confirmed wakes, two transcripts that differ in one word, both `wake` (GA-VOICE-4, GA-VOICE-5). Each device's speech is placed on the front's one clock (GA-VOICE-8) | Voice |
| Front → brain | One utterance. The intervals overlap, the word overlap is 5/7 ≈ 0.71 against the merge agreement of 0.6, both are kept, and one brain of 0.4 serves both, so they merge (GA-VOICE-7): one `utterance_id`, `endpoint` the one the front will answer from (its choice, nearer Наталья), the other in `also_heard_at` with its own `addressed_by` | Voice |
| Brain → front | One `say`, to the endpoint named, which heard it (GA-BRAIN-4). The question makes no steward write. Unmerged, the two would be the brain's to arbitrate, since GA-BRAIN-5 grades only identical transcripts | Brain |
| Kitchen satellite → front | Whatever of the living room's reply the kitchen admits overlaps that playback and reaches the echo match against its text: `echo: true`, at every device the front serves, whatever zone (GA-VOICE-8). Digits in the reply («в десять тридцать») are written as words before comparing (voice, *Constants*) | Voice |
| Person → kitchen satellite | «А он позвонит заранее?», without the wake word. The reply's last piece invited an answer and played `full`, so a follow-up window opened at every endpoint of the zone with `follow_up` on, the kitchen's included (GA-VOICE-6). It is `follow_up`, in the same `conversation` | Voice |
| Brain → front | The reply to the endpoint that heard it, the kitchen (GA-BRAIN-4) | Brain |

**Trust and guardrails.** A deployed system found three separate failures here and fixed them at one server
chokepoint: double execution, the reply loop, and the chorus. Two lessons carry over:
- Duplicates are recognised by what they resolve to, never by their text, because two
  microphones give two transcripts.
- A check that the reply's *end* fell inside a playback window never fires, because the
  endpointer stamps the end about 0.6 s after the speech stopped. That system now compares the real speech
  interval, sent as durations on each machine's own clock.

The home scenarios left arbitration to the brain (HS5). A question makes it the front's problem too:
only the front knows which satellite is nearer, and which played what, when.

**Verdict.** Brain 0.2: ⚠️ one reply is possible, and the question has no steward writes, so
GA-BRAIN-5 is not even engaged. Voice: ❌ cannot. No zone, no responder, no cross-device echo
marking, no conversation that moves between satellites.

**Brain 0.5 / steward 0.6:** ✅ one reply to an endpoint that heard it (GA-BRAIN-4). **Voice 0.1:** ✅
merged (GA-VOICE-7), the reply heard elsewhere marked echo (GA-VOICE-8), the conversation moves
within its zone (GA-VOICE-6). Which endpoint answers is the front's choice, not graded.

## VS4 · 17:00 — Алиса in the room

**The home.** The flat. The living-room Станция plays music loudly. Лиза is in her room with her own
Станция. Both Станции are on the family's Yandex account, so each is its own skill endpoint, told
apart by `skill_surface`. A skill endpoint's `max_role` defaults to `visitor`; Ольга raised Лиза's to
`guest` with a `define` from her app.

**The moment.**
- Дмитрий, over the music: «Галатея, во сколько у Лизы тренировка?» Galatea answers.
- A moment later the Станция's Алиса, asked by Артём for a joke, tells it.
- In her room, Лиза says to her Станция: «Алиса, попроси Галатею выключить у меня свет». Then:
  «Алиса, попроси Галатею открыть воду».

**What we want.**
- Galatea is heard over the music: the Станция is turned down while Galatea speaks, and back up
  afterwards.
- Алиса's joke is neither a command nor a conversation turn for Galatea.
- Лиза, who talks only to Алиса, can reach Galatea through her: the light goes off. The water
  does not open: `no_voice` never passes, whichever voice asked.
- No Станция is ever a microphone for Galatea. None can be (the research note, *Speakers we do not
  own*).

**Decomposed.**

| Hop | What happens | Governed by |
|---|---|---|
| Person → our satellite | Wake over music, `wake` (GA-VOICE-4, GA-VOICE-5). The satellite's own echo cancellation removes only its own playback, not the Станция's | Voice |
| Front → steward → Станция | The front sends `speaking { endpoint, on: true }` when it starts, again every half duck limit, and `on: false` when it stops (GA-VOICE-12). The steward MAY `media.duck` the `media` targets in that room, as its configuration says; it ducks none another cause ducked, and un-ducks only its own, on `on: false`, a lost front or the duck limit (GA-LISTEN-5). The Станция's duck goes through its adapter (Yandex's local `glagol` protocol, unofficial) | Voice; Steward; Applier (the Станция is an engine behind an adapter, like any engine that does not conform) |
| Станция → our satellite | Алиса's joke is speech in the room. The adapter reports it as the `speech` state key (applier, `media`); the steward lists it in `zone_sources` within the source delay (GA-LISTEN-3). What our satellite admits of it (inside Дмитрий's follow-up window, say) is held until the source delay after it began, and marked `source: machine` where it overlaps and matches (GA-VOICE-9). It cuts no reply (GA-VOICE-6), and the brain reads it as data (GA-BRAIN-3) | Applier; Steward; Voice; Brain |
| Лиза → Станция → Yandex's cloud → ingress | Yandex hears «попроси Галатею…» and sends the skill the verbatim text (`original_utterance`). The front's ingress serves TLS the vendor validates, authenticates the request as the vendor's, by the vendor's means or the account's secret address, and delivers it only at the endpoint of the authenticated account whose `skill_surface` is Лиза's Станция (GA-VOICE-16) | Outside Galatea; Voice |
| Ingress → brain | An utterance `addressed_by: skill` (GA-VOICE-5) at that endpoint: `type: voice`, served by the brain, no person, `max_role: guest`; no `speaker_hint` can come from it | Voice; Steward, *Clients, endpoints and principals*; Brain |
| Brain → steward | The light: `reversible`, which a guest may (GA-TIER-3), applied inline (GA-STW-10). The water: `refuse(role)` for a guest (GA-TIER-3), which the steward reports before `tier` (GA-STW-4); at any role, `no_voice` through a brain-served endpoint is `refuse(tier)` (GA-TIER-1) | Steward |
| Brain → ingress → Станция | The reply's pieces, joined and checked whole for wake words, so it never says «Алиса» (GA-VOICE-20), are the skill's response, handed over at the piece marked `final` (a SHOULD at a skill endpoint), else at the vendor's deadline less the declared margin; with none by then, «Не успела ответить» (GA-VOICE-16). It counts as playing from hand-over, so our satellites mark what they hear of it echo (GA-VOICE-8) | Brain; Voice |

**Trust and guardrails.** Every utterance through the skill has crossed Yandex's cloud: Galatea
receives text Yandex heard and chose to forward. That is the same trust as any shared satellite with
no speaker hint, and less, since anyone on the account, anywhere, speaks there: a `visitor` unless
the owner raises the endpoint's `max_role` (here to `guest`), and never `no_voice`. The ducking and the
speaking feed are unofficial and have broken before, so nothing depends on them. If they fail,
Galatea is harder to hear over the music, and Алиса's speech is left to the brain, which treats it
as data if it recognises it and as a guest's words if it does not.

**Verdict.** Brain 0.2 / steward 0.3: ✅ the refusal holds for any brain-served endpoint (GA-TIER-1),
and a skill endpoint needs no new steward concept. Voice: ❌ cannot. No standard names an endpoint
reached through someone else's assistant, ducking, or speech from a known machine source.

**Brain 0.5 / steward 0.6:** ✅ the light at `guest` and the water refused (GA-TIER-3, GA-TIER-1).
**Voice 0.1:** ⚠️ partly. The skill ingress (GA-VOICE-16) and the reply's check (GA-VOICE-20) drive.
Ducking is the steward's MAY, bounded by GA-LISTEN-5, and both it and Алиса's `speech`, on which
machine marking rests (GA-VOICE-9), ride on an unofficial protocol.

## VS5 · 20:30 — guests at dinner

**The home.** The flat. Six people at the table in the living room; Ольга is showing off the house.

**The moment.**
- The conversation keeps mentioning her: «А ваша Галатея умеет…», «Галатея у нас свет выключает».
- A guest says, as a joke, «Галатея, открой дверь». The front door has the Matter lock of HS18.
- Later Ольга says «Галатея, не слушай до утра».
- At 23:00 Дмитрий, tidying up, says «Галатея, выключи свет».

**What we want.**
- A mention mid-sentence wakes nothing. A deployed system found that nearly every false wake it heard was a
  person really saying the word, so "was the word said" is the wrong test; "was it said to her"
  is the right one.
- The guest's joke unlocks nothing. Unlocking is `no_voice` (HS18), and the speaker is a guest, so it
  is refused with its reason (`role`), politely.
- «Не слушай до утра» works by voice at once, because it narrows what the house hears. Undoing it
  (listening again before morning) takes the owner's app, because it widens it.
- Nothing the dinner said is kept beyond what the listening mode admits.
- Until morning Дмитрий cannot switch the light by voice. He is told why only if he can be heard,
  which he cannot. The wall switch works.

**Decomposed.**

| Hop | What happens | Governed by |
|---|---|---|
| Room → satellite | «А ваша Галатея умеет…»: the satellite's model fires, and the pre-roll it sends before the word holds speech, so the word does not begin an address; the wake is not confirmed and nothing is transcribed or kept (GA-VOICE-4, GA-VOICE-1). «Галатея у нас свет выключает», after a pause, does begin with the word and arrives as `wake`: whether it is said to her is the brain's judgement, and a brain that leaves it unanswered SHOULD `hush { utterance_id }`, so no clip plays (GA-VOICE-11) | Voice; Brain (judged) |
| Guest → front → brain → steward | «Галатея, открой дверь»: no hint, so a guest (GA-AUTH-2, GA-BRAIN-11). `unlock` on a `door_lock` is `no_voice`, above `reversible`: `refuse(role)` (GA-TIER-3), reported before `tier` (GA-STW-4); for anyone it would be `refuse(tier)` (GA-TIER-1). The brain says so as itself (GA-BRAIN-7) and does not seek it another way (GA-BRAIN-6) | Steward; Brain |
| Ольга → front → brain → steward | «Галатея, не слушай до утра»: the brain sends `narrow { endpoint, listening: off, until }` for the living-room endpoint, and, for an utterance merged across endpoints, for each it lists (GA-BRAIN-4 lets `narrow` name any endpoint that heard it). Any credential bound to the endpoint may narrow, whatever the role, for at most the narrowing limit, 12 h (GA-LISTEN-1); each narrowing changes the revision, `describe` shows it, and `history` keeps a `narrowed` event (GA-LISTEN-2, GA-STW-7) | Brain; Steward |
| Steward → front | The front, waiting on `describe`, applies it within the narrowing delay, 2 s, dropping any utterance in progress unread (GA-VOICE-3), and reports the effective setting `off` with the reason `narrowed` (GA-VOICE-2) | Voice |
| Front | Until morning, no frame from the living room is transcribed or kept, and the discarded frames are counted in `front_status` (GA-VOICE-1). Audio is kept only of delivered utterances, and not at all at the home's default `audio_retention_s` of 0 (GA-VOICE-15) | Voice |
| Дмитрий → satellite, 23:00 | «Галатея, выключи свет»: nothing is read, so there is no utterance, no reply and no clip. The wall switch works | Voice; the installation |
| Ольга → app → steward | Listening again before morning is `lift_narrowing`, a `define` change kind: only an owner, from an endpoint no brain serves (GA-DEF-3). The front learns of it at the next revision; no reconnect is needed | Steward; Voice |

**Trust and guardrails.** The steward's tiers make the joke harmless whatever the front hears. That
is the design's floor, taken from a deployed fleet's commitments: safety is a property of the command table, not
of a false-accept rate. What the front owes is fewer false wakes, and a listening posture that a
person can narrow by voice, so that speaking at a dinner is not an act of trust. That fleet's rule applies
unchanged: a live change may only narrow; widening needs the authority that set the mode. In the
standards that is the owner's `define` (GA-DEF-3), which the front picks up at the next revision.

**Verdict.** Brain 0.2 / steward 0.3: ✅ the unlock is refused (GA-TIER-1, GA-BRAIN-6, GA-BRAIN-7).
Voice: ❌ cannot. No standard defines listening modes, who may change them, or what is kept.

**Brain 0.5 / steward 0.6:** ✅ the unlock `refuse(role)` (GA-TIER-3, GA-BRAIN-6, GA-BRAIN-7); anyone
narrows, only the owner lifts (GA-LISTEN-1, GA-DEF-3). **Voice 0.1:** ✅ the mid-sentence mention
wakes nothing (GA-VOICE-4), the narrowing applies within 2 s (GA-VOICE-3), nothing else is kept
(GA-VOICE-1, GA-VOICE-15).

## VS6 · 02:00 — «Это папа»

**The home.** The flat. The hall satellite has a gate model enrolled on Ольга's and Дмитрий's voices
(the source of a `gate` hint, per the «Галатея» results). Дмитрий has a cold.

**The moment.** Артём, at the hall satellite: «Галатея, это папа. Включи обогреватель у Лизы».
The next morning Дмитрий, hoarse: «Галатея, включи обогреватель у Лизы на час», and the gate does
not recognise him.

**What we want.**
- Артём gets a guest's answer. The name in the sentence is not evidence (GA-BRAIN-11), and a
  guest's `confirm` step is `refuse(role)` (GA-TIER-3).
- Дмитрий, unrecognised, is treated as a guest too, and is told plainly that the house did not
  recognise his voice and that the app will do it. It is not silent, and it does not guess.
- The enrolled model never leaves the box.

**Decomposed.**

| Hop | What happens | Governed by |
|---|---|---|
| Person → satellite → front | The wake is confirmed (GA-VOICE-4). The gate models the front declares for Ольга and Дмитрий at the hall endpoint, each enrolled on the box on that person's voice, score the speech: no match | Voice |
| Front → brain | An utterance `addressed_by: wake` with no `speaker_hint`: a hint is sent only with its basis, and a `gate` basis only when a declared gate model matched (GA-VOICE-14). The front never infers a speaker from the words said | Voice |
| Brain → steward | No `speaker` named, since «это папа» is not evidence (GA-BRAIN-11); the principal is a guest at the hall endpoint (GA-AUTH-2); the heater's step is above `reversible`, so `refuse(role)` (GA-TIER-3) | Brain; Steward |
| Brain → person | The refusal as itself (GA-BRAIN-7). For Дмитрий: `describe` shows a gate model for him at this endpoint (GA-LISTEN-2), so the brain can tell "the gate did not match" from "no gate here", and says that the house did not recognise his voice and that the app will do it | Brain; Steward |
| Box | The gate models stay on the box, and a person's enrolled voice is deleted within the status delay of the steward no longer listing that person (GA-VOICE-15) | Voice |

**Trust and guardrails.** The speaker gate is a household gate, not a lock. The «Галатея» evidence
says it separates the owner from 600 other voices on 1 s of speech, but its threshold rejects many of
the owner's own wake words, and it has been measured on one session with one microphone. So a
missing hint fails toward a guest, never toward a person, and the tiers do the rest. What the front
owes is to say whether a hint came from a gate at all, so that the brain can tell "no gate here" from
"the gate said no". It says it through `hint_basis` and the gate models `describe` shows per endpoint,
each with its declared false accepts (GA-VOICE-18).

**Verdict.** Brain 0.2 / steward 0.3: ✅ the name is ignored, and Артём is a guest refused for
role (GA-BRAIN-11, GA-AUTH-2, GA-TIER-3). Voice: ❌ cannot. `speaker_hint` "is not defined here", and nothing says what it rests
on or how it fails.

**Brain 0.5 / steward 0.6:** ✅ as before (GA-BRAIN-11, GA-AUTH-2, GA-TIER-3), and the gate is visible
in `describe` (GA-LISTEN-2). **Voice 0.1:** ✅ a hint only with its basis (GA-VOICE-14), declared numbers
(GA-VOICE-18), the model never leaves the box (GA-VOICE-15).

## VS7 · 18:00 — the slow brain, and the storm

**The home.** The house. The uplink is flaky (HS11). Сергей is in the living room.

**The moment.** «Галатея, сравни, сколько мы потратили на газ в этом месяце и в прошлом». The cloud
model is slow: nothing for 8 s. Сергей says «Галатея, ладно, забудь. Выключи свет». Later the
uplink drops in the middle of a conversation about the boiler; the brain switches to its local
model.

**What we want.**
- The earcon at the wake, at once. If the answer takes longer than about 2 s, something is said or
  played so that Сергей knows he was heard (a target, not a measured bound).
- «Ладно, забудь» cancels the slow answer, which is never spoken afterwards. «Выключи свет» is
  done within a second, by the resolver, while the LLM is still busy.
- On the switch to the local model, the conversation goes on, weaker but not lost. The brain says
  once what it can no longer do.
- Never silent beyond the failure bound (GA-BRAIN-12).

**Decomposed.**

| Hop | What happens | Governed by |
|---|---|---|
| Person → satellite | Wake, `wake` (GA-VOICE-4, GA-VOICE-5); the earcon, a fixed clip, allowed, not required (GA-VOICE-11) | Voice |
| Brain | Slow model. It may say a short piece («Считаю…») `in_reply_to` the question after 2 s; nothing requires it | Brain (no rule) |
| Front | If no `say` has come `in_reply_to` the question by the failure bound plus the clip slack (12 s) after its `available_at`, the front plays «Не могу ответить» once; a reply that comes later is still played (GA-VOICE-11) | Voice |
| Person → front → brain | «Галатея, ладно, забудь. Выключи свет»: `wake`, admitted at every listening mode but `off` and `tap`. Without the name it is admitted only inside a window: a follow-up window, if «Считаю…» invited a reply and `follow_up` is on, or a barge-in window while it plays (GA-VOICE-6) | Voice |
| Brain → front | The brain drops its pending reply and `hush`es anything queued at the endpoint: stopped, and each piece reported `cut` or `dropped` (GA-VOICE-10). Not saying a slow answer the person cancelled is the brain's own discipline, not graded | Brain; Voice |
| Brain → steward | «Выключи свет» by the resolver, inline (GA-STW-10); `reversible`, which every role but `visitor` may (GA-TIER-3) | Brain; Steward |
| Brain | The uplink drops; local model; one sentence saying so. An utterance it cannot serve is said so within the failure bound (GA-BRAIN-12) | Brain (GA-BRAIN-12 graded; the fallback a SHOULD) |

**Trust and guardrails.** A slow brain tempts a front to guess, or to cut off a reply that arrives
late. It must not: the front never composes words, and a late reply to a cancelled question is the
brain's to drop. The brain standard already bounds silence (GA-BRAIN-12, GA-BRAIN-15). It says
nothing about the seconds before that, which is where a spoken conversation lives or dies. The
voice standard measures them (`latency_ms`) and fills the bound with one fixed clip (GA-VOICE-11),
but requires nothing earlier.

**Verdict.** Brain 0.2: ⚠️ never silent beyond 10 s is graded; everything a conversation needs
inside those 10 s is not. Voice: ❌ cannot. No time from the end of speech to the first audio is
bounded or even measured, and nothing lets a person cancel.

**Brain 0.5 / steward 0.6:** ⚠️ partly. The light (GA-STW-10) and the 10 s bound (GA-BRAIN-12) drive;
the 2 s filler has no rule. **Voice 0.1:** ✅ the cancel (`hush`, GA-VOICE-10), the clip at the bound
(GA-VOICE-11), and the time to first audio measured (`latency_ms`, GA-VOICE-10). The cancel needs the
wake word unless a window is open (GA-VOICE-6).

## VS8 · 06:05 — the boiler, and a woman who does not talk to walls

**The home.** The house. At 06:05 the boiler stops with a fault (it belongs to Home Assistant, a
child through the adapter). Валентина Петровна is in the kitchen, where the Станция is and our
kitchen satellite is. Everyone else is asleep. Quiet hours run until 07:00.

**What we want.**
- She is told, in the room she is in, in words she understands: «Котёл остановился с ошибкой.
  Сергей увидит это в телефоне». Nobody else is woken.
- It is said once, not repeated every minute.
- She does not have to answer, and the house does not wait for her to.
- Сергей's phone has the notice (the home's notice channels, GA-NOTE-1).

**Decomposed.**

| Hop | What happens | Governed by |
|---|---|---|
| Home Assistant → adapter → meta-applier | The boiler's fault arrives as state and a notice | Applier |
| Steward → phone | The notice is retried on the home's `notify` channels, at least every 60 s, until one ends `delivered` (GA-NOTE-1) | Steward |
| Steward → Станция | The home's `notice_channels` also hold the kitchen Станция through `media.announce` (steward, *The house model*). A channel that announces speaks each notice once, is never retried and never counts as delivery (steward, *Notices*). Whether it speaks at 06:05, in which language, for which urgencies, and only while the kitchen is occupied, is that channel's configuration in the steward, which the standards leave to implementations | Steward; Applier (`media.announce`) |
| Steward | The spoken copy is checked first: no wake word, near spellings included; no ask is open, and the text holds no answer word anyway (GA-LISTEN-4). It is listed in `zone_sources` from dispatch, until the Станция reports it ended or, where it reports no speech, for the announce hold, a second notice's spoken copy to it meanwhile waiting for the listing to end (GA-LISTEN-3) | Steward |
| Kitchen satellite → front | Whatever the satellite admits of it overlaps a listed announcement and matches its text: `source: machine` (GA-VOICE-9), data to the brain (GA-BRAIN-3) | Voice; Brain |
| Brain | Says nothing: it SHOULD NOT say again in a room what the steward announced there (brain, *Recommendations*). An unprompted `say` of its own goes where it chooses, from the steward's occupancy (brain, *The front*); a `say` at the Станция's skill endpoint outside a turn is `dropped`, `reason: no_turn` (GA-VOICE-10) | Brain; Voice |

**Trust and guardrails.** Speaking unprompted is the one time the house talks without being asked.
A deployed fleet's rule was "failures speak; success does not"; a conversation keeps that for unprompted speech.
Where to speak is a matter of policy (quiet hours, which rooms), which the standards leave to
implementations. A floor may still be needed: an unprompted `say` must not wake a room nobody is in,
and must not repeat what the notice channels already carry. The standards keep the floor that the
channel speaks once and nothing waits for an answer; where and when it speaks (language, urgency,
hours, occupancy) stays the steward's configuration.

**Verdict.** Steward 0.3: ✅ the notice reaches the phone. Brain 0.2: ⚠️ an unprompted `say` names
an endpoint; nothing says which one, or who chooses. Voice: ❌ cannot. Nothing routes speech by
occupancy, and a speaker we do not own is not an endpoint.

**Brain 0.5 / steward 0.6:** ⚠️ partly. The phone (GA-NOTE-1), the announcement said once and
checked (GA-LISTEN-4, GA-LISTEN-3) drive. "Nobody else is woken" rests on the announce channel's
configuration, not on a rule. **Voice 0.1:** ✅ the announcement heard back is a machine's
(GA-VOICE-9).

## VS9 · 18:40 — on the way home

**The home.** The flat. Ольга is driving home and talks to Galatea through the app on her phone:
hold to talk, or hands-free while the app is open. The app's endpoint has Ольга as its `person`.

**The moment.** «Включи обогреватель у Лизы, мы будем через двадцать минут». Galatea asks;
hands-free, she says «Галатея, да». Then: «И открой воду, я её утром закрыла». The water valve's
`valve.open` is `no_voice` (HS4).

**What we want.**
- The same conversation as in the flat: the same brain, the same voice, follow-ups.
- The speaker is certain: it is her phone and her account, not a guess from a voice.
- The heater's yes counts.
- The water is refused by voice even here, because the conversation runs through the brain. She
  opens it with one tap in the same app, as HS4 already requires.

**Decomposed.**

| Hop | What happens | Governed by |
|---|---|---|
| Phone → front | Audio from the app, over its link encrypted to the box through the box's remote access, authenticated with the app's own key: the one way live audio leaves the home's LAN (GA-VOICE-13). Or text the phone's own recogniser made, whose origin is the app's word, bound to its key | Voice |
| Front → brain | An utterance at the app's voice endpoint, `type: app`, which has Ольга as its `person` (GA-DEF-8) and is served by the brain. Held to talk it is `tap`; hands-free, `wake` or `follow_up`; typed, `typed` (GA-VOICE-5). Its hint is Ольга with `hint_basis: person` (GA-VOICE-14) | Voice; Steward |
| Brain → steward | The heater: `confirm`, `ask(confirm_tier)` (GA-TIER-2); the brain puts the question, played `full` on her phone | Brain; Steward |
| Person → phone | Hands-free, «Галатея, да»: `wake`, taken as before. A bare «да» hands-free would be `follow_up` in the window her app opens for its own reply (GA-VOICE-6), and a `follow_up` yes counts only with a `gate` hint, which a `person` basis is not (GA-CONF-6): the radio in the car cannot answer for her. Held to talk, a bare «да» is `tap` and counts | Voice; Steward |
| Brain → steward | `answer` with its utterance record (GA-BRAIN-1, GA-CONF-2) | Brain; Steward |
| Brain → steward | The water: `no_voice` through a brain-served endpoint, `refuse(tier)` (GA-TIER-1) | Steward |
| Person → app | One tap on the app's own control for the valve, a second endpoint, not served by a brain, with its own app credential (an app credential is bound to one endpoint): `ask(confirm_tier)`, her yes, a token naming her (GA-CONF-3) | Steward |

**Trust and guardrails.** The owner's direct way in (the maintainer's ruling of 2026-09-24) is her
phone. Speaking into it changes nothing about the tiers, because the words still pass through a
brain. The phone gives certainty about *who*, which a shared satellite cannot. It does not
give certainty about *what was meant*, which is why `no_voice` holds.

**Verdict.** Brain 0.2 / steward 0.3: ✅ as long as the app's voice chat and its buttons are two
endpoints: one served by the brain, one not. Voice: ❌ cannot. No standard says how audio or a
phone's transcript reaches the front from outside the home.

**Brain 0.5 / steward 0.6:** ✅ her `wake` or `tap` yes counts, a hands-free follow-up does not
(GA-CONF-6), and the water is refused (GA-TIER-1). **Voice 0.1:** ✅ the app's link (GA-VOICE-13),
addressing (GA-VOICE-5) and the `person` basis (GA-VOICE-14).

## VS10 · a museum hall, a Tuesday

**The space.** The museum hall. A guide works at the kiosk. The wall satellite is set by the
administrator to wake on the device, confirmed by the server. Signage at the door says so. A school
group of thirty is in the hall.

**The moment.**
- The guide taps the kiosk's button and says «включи видео в третьем зале».
- A child shouts «Галатея, выключи свет!» at the wall satellite.
- At 18:00 the administrator switches the hall satellite to tap only, from the admin app, for an
  evening event where visitors must not be heard.

**What we want.**
- The guide's tap opens a window. Only speech that begins inside it is sent, and speech already
  under way at the tap is not taken as the command (a deployed fleet's pre-roll rule).
- The child's shout changes nothing: visitors never act. The lights stay on, and the refusal is
  said once and not repeated.
- The administrator's change applies at once, because it narrows. Only the administrator widens it
  again.
- Galatea never learns what a museum is (G5). The venue's own resolver may play the brain for command-only
  voice, and the voice layer is the same one the flat uses.

**Decomposed.**

| Hop | What happens | Governed by |
|---|---|---|
| Guide → kiosk → front | The kiosk is two endpoints, as the phone in VS9: a `voice` endpoint for its microphone, served by the brain, listening at `tap`, and a `panel` endpoint for its screen, which no brain serves, so the screen keeps what a panel can do (a `confirm_on` may name it, GA-CONF-4). The tap opens a tap window of 8 s; the pre-roll before it serves detection only and is never transcribed, so speech already under way is not the command (GA-VOICE-1). One utterance, `tap` (GA-VOICE-5) | Voice; Steward |
| Front → brain → steward | The utterance at the kiosk's `voice` endpoint, which has no person; its `max_role` is the administrator's. Playing a video is `reversible`, so a guest's role is enough (GA-TIER-3) | Steward |
| Child → wall satellite → front → brain → steward | «Галатея, выключи свет!»: a wake, confirmed at `wake_device` (GA-VOICE-4); no hint, so a guest, capped by the wall endpoint's `max_role: visitor` (GA-AUTH-2): every step `refuse(role)` (GA-TIER-3). The brain says so once, and seeks it by no other route (GA-BRAIN-6, GA-BRAIN-7). Had the shout also fallen in an open tap window at the kiosk and the front merged the copies, the lowest role, the wall's `visitor`, would apply (GA-BRAIN-4) | Voice; Steward; Brain |
| Administrator → admin app → steward → front | 18:00: a `define` of the hall endpoint's voice record, `listening: tap`, which only an owner makes, from an endpoint no brain serves (GA-DEF-3). It narrows, so the front applies it within the narrowing delay, dropping any utterance in progress (GA-VOICE-3), and reports the new effective setting (GA-VOICE-2). Widening it again is another `define` by the administrator, which the front reads at the next revision | Steward; Voice |

**Trust and guardrails.** The steward has no role below guest, so an endpoint whose listeners may
hear but never act cannot be expressed. The candidates:
- a `max_role` below guest (say `none`, which may ask questions but not act);
- a listening mode that admits only enrolled or tapped speakers;
- the venue's resolver refusing.

The first is a steward change; the second a voice one. In a home the same gap appears as a
satellite in a hallway that guests pass. The standards took the first: a role `visitor`, below
guest, which an endpoint's `max_role` alone gives, may ask, hear answers and narrow, and does
nothing (GA-TIER-3).

The modes, the tap window, the rule that a live change only narrows, and a check at the one place
every command passes are what museum halls in a deployed fleet already run. If Galatea's voice
layer serves this hall unchanged, a venue's own voice system can become a deployment of it rather
than a second implementation.

**Verdict.** Steward 0.3: ❌ the child, a guest, may turn the lights off: no role says "hears, never
acts". Voice: ❌ cannot.
Listening modes, tap windows and who may change them are in no Galatea standard.

**Brain 0.5 / steward 0.6:** ✅ the child is a `visitor`, `refuse(role)` (GA-TIER-3), the lowest role
among merged copies (GA-BRAIN-4), and only the owner changes a voice record (GA-DEF-3). **Voice
0.1:** ✅ the tap window and its pre-roll (GA-VOICE-1), the narrowing within 2 s (GA-VOICE-3).

## VS11 · installation day — one software, three names

**The spaces.** Three installations of the same software:
- the flat, whose family calls the house «Галатея»;
- the museum hall of VS10, where the venue's product answers to «Ника»;
- a second flat, bought boxed, where the children want to call it «Кузя».

**The moment.** The installer provisions each box and its satellites. The wake word is chosen at
that point, like the network and the rooms. A year later the flat's family wants a second name for
the grandmother, who keeps saying «Компьютер».

**What we want.**
- The wake word is configuration, not code: one build serves «Галатея», «Ника» and «Кузя».
- It is chosen at provisioning, for the whole installation or per endpoint. Every place that
  checks it (the satellite's model, the server's check) follows the one setting. None of them
  hardcodes a word. The brain gets what was said, the word included.
- A word the installation has no measured model for is refused at provisioning, or accepted with
  a stated weaker mode (the server's transcript check alone), never silently.
- Adding «Компьютер» is a re-provisioning of the endpoints that hear her. The cost is stated:
  A deployed system measured about 1.6 false wakes an hour for three models on one device, against about
  0.4 for one. In the flat, replies that name the computer («Бужу компьютер в гостиной», HS19;
  «Компьютер Артёма выключится…», HS23) say «ПК» instead, or GA-VOICE-20 drops them.
- The name the house answers to does not change what it may do: tiers, roles and the brain are
  untouched.

**Decomposed.**

| Hop | What happens | Governed by |
|---|---|---|
| Installer → box | Provisioning is each endpoint's first `define`: its voice record, with `listening` and `wake_words`, each `{ word, model }`, `model` a wake model's name or `transcript` (steward, *Listening*). An owner's `define`, so only an owner (GA-DEF-3) | Steward |
| Front | Declares in `front_status` the models it holds, each with its words and its `measured` numbers from the stated procedure (GA-VOICE-18); `describe` shows them (GA-LISTEN-2) | Voice; Steward |
| Box → satellites | Every check reads the endpoint's `wake_words` (GA-VOICE-4): the satellite gets its model, or, for a word no model this box or the device can run, the front falls back: at `wake_server` to the transcript check, at `wake_device` to the endpoint's other words, or `tap` with none left; the reason is `no_model` (GA-VOICE-4, GA-VOICE-2), and the steward issues a notice naming the endpoint and the reason (GA-LISTEN-2) | Voice; Steward |
| Front → brain | An utterance `addressed_by: wake` (GA-VOICE-5), its transcript verbatim, the word included; the word is stripped only inside the front's own checks. The brain need not know which word it was | Voice; Brain, *The front* |
| Owner → steward | «Компьютер» added a year later: a `define` that widens the record, so only the owner's (GA-DEF-3). The false wakes of the two words add up. The house never speaks a wake word (GA-VOICE-20, GA-LISTEN-4), so «компьютер» can no longer be said in a reply, and a name containing it draws a notice at `define` (a SHOULD) | Steward; Voice |

**Trust and guardrails.** A wake word is only as good as its model, and a model is only as good as
its measurement. Work on two wake words, «Галатея» among them, showed this. So a configurable word is a
choice among *measured* words, each with its model and its numbers, plus an honest fallback. The
licence of a distributed model matters too: a boxed product may ship only models that pass the
licence bar (a decision still owed).

**Verdict.** Brain 0.2 / steward 0.3: ✅ untouched by the name. Voice: ❌ cannot. No standard makes
the wake word a setting, names where it is held, or says what happens for a word with no measured
model.

**Brain 0.5 / steward 0.6:** ✅ untouched by the name; the record is the owner's (GA-DEF-3), a fallback
is a notice (GA-LISTEN-2). **Voice 0.1:** ✅ the word is configuration (GA-VOICE-4), the fallback is
stated (GA-VOICE-4, GA-VOICE-2), the models' numbers declared (GA-VOICE-18).

## The grades

| # | Scenario | Brain 0.5 / steward 0.6 | Voice 0.1 |
|---|---|---|---|
| VS1 | Planning the weekend, a conversation | ✅ the dim (GA-TIER-3, GA-STW-10); data as data (GA-BRAIN-3) | ⚠️ time to speech measured, not bounded (`latency_ms`, GA-VOICE-10); the pause a SHOULD under GA-VOICE-6; the earcon allowed |
| VS2 | «Да», said by the television | ✅ the TV's yes never sent (GA-BRAIN-1) and refused (GA-CONF-6); Ольга's after the question (GA-CONF-2) | ✅ `follow_up` marked (GA-VOICE-5); hint with its basis (GA-VOICE-14) |
| VS3 | Two satellites, one answer | ✅ one reply where it was heard (GA-BRAIN-4) | ✅ merged (GA-VOICE-7); echo home-wide (GA-VOICE-8); the conversation moves in its zone (GA-VOICE-6) |
| VS4 | Алиса in the room | ✅ the light at `guest`, the water refused (GA-TIER-3, GA-TIER-1) | ⚠️ ducking a MAY (GA-LISTEN-5) and Алиса's `speech` (GA-VOICE-9) ride on an unofficial protocol; the ingress drives (GA-VOICE-16, GA-VOICE-20) |
| VS5 | Guests at dinner | ✅ the unlock `refuse(role)` (GA-TIER-3); anyone narrows, only the owner lifts (GA-LISTEN-1, GA-DEF-3) | ✅ mid-sentence mentions (GA-VOICE-4); the narrowing in 2 s (GA-VOICE-3); nothing kept (GA-VOICE-1, GA-VOICE-15) |
| VS6 | «Это папа» | ✅ the name ignored; a guest (GA-BRAIN-11, GA-AUTH-2, GA-TIER-3); the gate in `describe` (GA-LISTEN-2) | ✅ a hint only with its basis (GA-VOICE-14); declared numbers (GA-VOICE-18); the model stays on the box (GA-VOICE-15) |
| VS7 | The slow brain, and the storm | ⚠️ only the 10 s bound is graded (GA-BRAIN-12); the 2 s filler has no rule | ✅ `hush` (GA-VOICE-10); the clip at the bound (GA-VOICE-11); the cancel needs the wake word outside a window (GA-VOICE-6) |
| VS8 | The boiler at dawn | ⚠️ the phone (GA-NOTE-1) and the checked announcement (GA-LISTEN-3, GA-LISTEN-4) drive; who is woken is the announce channel's configuration | ✅ the announcement heard back is a machine's (GA-VOICE-9) |
| VS9 | On the way home | ✅ a `wake` or `tap` yes counts, a hands-free follow-up does not (GA-CONF-6); the water refused (GA-TIER-1) | ✅ the app's link (GA-VOICE-13); addressing (GA-VOICE-5); the `person` basis (GA-VOICE-14) |
| VS10 | A museum hall | ✅ `visitor`, `refuse(role)` (GA-TIER-3); the lowest role (GA-BRAIN-4); only the owner changes the mode (GA-DEF-3) | ✅ the tap window and pre-roll (GA-VOICE-1); the narrowing in 2 s (GA-VOICE-3) |
| VS11 | One software, three names | ✅ untouched by the name; the fallback a notice (GA-LISTEN-2) | ✅ the word is configuration (GA-VOICE-4); the fallback stated (GA-VOICE-2); numbers declared (GA-VOICE-18) |

**Counts,** taking the lower of the two columns: 7 drive as designed (VS2, VS3, VS5, VS6, VS9,
VS10, VS11), 4 partly (VS1, VS4, VS7, VS8), 0 cannot. Against brain 0.2 and steward 0.3 with no
voice standard, every voice hop could not.

What keeps the four partly:
- **Measured, not bounded.** How fast speech starts is reported (`latency_ms`) and graded nowhere,
  and nothing is required inside the 10 s failure bound but one fixed clip at its end (VS1, VS7).
  The numbers belong to real satellites in real rooms.
- **Someone else's protocol.** Ducking the Станция and hearing what Алиса says ride on Yandex's
  unofficial local protocol (VS4).
- **Configuration, not a floor.** Where and when an announce channel speaks is the steward's
  configuration, by the rule of no premature policy (VS8).

Recorded residue, by ruling, that no scenario grades down: a television that reports no text can
say «Галатея, да» as a `wake` yes (VS2), and a principal who may announce can spell a wake word and
a yes past every list; the owner who fears either points `confirm_on` at an app.

## What the scenarios ask of the voice layer

Gathered for the architecture, in the scenarios' words, with the requirements that now answer each.

| Need | Scenarios | Answered by |
|---|---|---|
| An utterance says how it was addressed: wake word, tap, follow-up, through someone else's assistant | VS1, VS2, VS4, VS10 | GA-VOICE-5 |
| A reply can say it invites an answer; the front opens a follow-up window only then, and closes it on silence | VS1, VS2 | GA-VOICE-6 |
| What a follow-up may do is bounded: at least, a follow-up alone does not answer a `confirm` ask, unless a stronger signal says who spoke | VS2 | GA-CONF-6 |
| The front reports whether each `say` was played in full or cut, and where | VS1, VS7 | GA-VOICE-10 |
| Speech starts before the whole reply is written; the time from the end of speech to the first audio is measured and reported | VS1, VS7 | `continues` (brain, *The front*); `latency_ms`, GA-VOICE-10 |
| A person can cancel a pending reply | VS7 | `hush`, GA-VOICE-10 |
| Echoes are marked across devices by speech intervals in an acoustic zone, not by comparing timestamps from two machines | VS1, VS3 | GA-VOICE-8, across the whole home |
| One responder per zone; a conversation can move to the satellite nearest the person | VS3 | GA-VOICE-7, GA-VOICE-6; the responder is the front's choice |
| Speech from known machines (a Станция, a TV) can be marked as not a person when a feed says so | VS2, VS4 | GA-VOICE-9, GA-LISTEN-3, the applier's `speech` |
| Speakers we do not own are endpoints for output, and, through a skill, for text in | VS4, VS8 | `media.announce` (applier), GA-LISTEN-4, GA-VOICE-16 |
| Unprompted speech is routed by a policy (occupied rooms, quiet hours), never to an empty room | VS8 | Not a floor: the brain's choice, and the steward's configuration for announce channels |
| Listening modes per endpoint; a live change only narrows; widening needs the authority that set it | VS5, VS10 | GA-VOICE-1, GA-VOICE-3, GA-LISTEN-1, GA-DEF-3 |
| A `speaker_hint` says what it rests on (a gate enrolled here, or none), and fails toward a guest | VS6 | GA-VOICE-14, GA-VOICE-18 |
| Utterances from outside the home (a phone) arrive at an endpoint with a person | VS9 | GA-VOICE-13, GA-DEF-8 |
| The wake word is configuration chosen at provisioning, per installation or endpoint, read by every check; a word with no measured model is refused or runs in a stated weaker mode | VS11 | GA-VOICE-4, GA-VOICE-18, GA-LISTEN-2 |
| An endpoint whose listeners may be heard but never act (a steward role below guest, or a mode that admits only some speakers) | VS10 | `visitor`, GA-TIER-3 |
| Nothing kept beyond what the mode admits; enrolled voices never leave the box | VS5, VS6 | GA-VOICE-1, GA-VOICE-15 |

## Not covered, on purpose or yet

- **Music and media by voice**: conceded to the Станция, as in the home scenarios. Only ducking
  appears (VS4).
- **Languages other than Russian in one home**: a guest who speaks English (VS5) is served or not
  by the ASR's languages. No scenario tests mixed-language speech yet.
- **Wake word training and measurement**: covered by separate wake-word work, not by a
  lived moment.
- **Accessibility**: a person who cannot speak, or cannot hear the reply. Add once the first
  household or venue asks.
- **Intercom between rooms, calls, and messages read aloud**: plausible uses of the same satellites,
  not Galatea's control claim.

## How to use these

- **Before a change to the voice architecture, the brain's front or a voice standard,** name the
  scenarios it serves.
- **After it,** regrade them. A verdict moves only on evidence: a test, a run on a real satellite in
  a real room, or a real household.
- **The first real home replaces these moments.** The maintainer's own flat comes first; where its story
  differs, it wins.
