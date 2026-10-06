---
title: Review — pinning the MCP binding to revision 2026-07-28 (applier 0.13, steward 0.8, brain 0.6, voice 0.2)
status: current
last_verified:
area: architecture
audience: dev
author: Galatea maintainers
related:
  - standard/applier.md
  - standard/steward.md
  - standard/brain.md
  - standard/voice.md
  - docs/reviews/2026-09-27-post-merge.md
---

# Review — pinning the MCP binding to revision 2026-07-28

Until now the standards said only "MCP over Streamable HTTP" and named no protocol revision. MCP's
revisions are not wire-compatible: 2026-07-28 removed sessions and the `initialize` handshake, which
every earlier revision needs. So two conforming implementations could fail to talk. The research
note on MCP as a binding recommended pinning the brain to steward seam to
2026-07-28, and left the service seams open between (a) MCP pinned and (b) a plain HTTPS+JSON
binding, with MCP as a projection.

**Ruling (the maintainer, 2026-09-28):** pin every MCP seam the standards define to 2026-07-28. This
is option (a) for the service seams; HTTPS+JSON is not adopted.

## Round 1 change record

| Where | Rule | Direction | Why |
|---|---|---|---|
| applier, *The MCP binding* | Every connection the standard defines, client to applier and meta-applier to child, MUST speak MCP revision `2026-07-28` (GA-BIND-1, new) | **new**, stricter | The ruling. Without a revision, a client on one revision and a server on another conform and cannot talk |
| applier, *The MCP binding* | An applier MAY also answer other revisions, for clients the standard does not define; a later revision becomes the binding only in a later version of the standard | **new**, a permission | An owner's LLM client on an older SDK can still read an applier; nothing the standard defines may depend on it. A new MCP revision does not change conformance by itself |
| applier, *Negative subjects* | `speaks-only-2025` breaks GA-BIND-1 and nothing else | **new** | Arms GA-BIND-1. The harness negotiates, so it still reaches the subject through the 2025 handshake and grades everything else |
| steward, *Operations* | The steward's binding is the applier's at the same revision (GA-BIND-2, new): it serves `2026-07-28` to its clients and uses it to its applier | **new**, stricter | The steward serves brains and owners' endpoints and is its applier's client; the binding was already "the applier's", and the id lets the steward's harness grade it |
| brain, *The binding* | A brain MUST speak `2026-07-28` to its steward and its front (GA-BRAIN-23, new); its outside data servers speak whatever revision each serves | **new**, stricter for the steward and front; unchanged for data servers | The front's binding is the steward's. Data servers are third parties the standards do not define |

**Not changed, on purpose:**

- `standard/bridge.md`: a plugin's server is an MCP server the bridge hosts. The bridge already
  handles both eras (a server has started at its answer to `initialize` before 2026-07-28, and to
  `server/discover` from it on). Plugins are third-party code; pinning them would refuse existing
  plugins for no safety gain.
- The bridge binding stays MQTT 5.
- No looser move is made in this change.

**Versions:** applier 0.12 → 0.13, steward 0.7 → 0.8, brain 0.5 → 0.6, on a PASS. Round 2 adds voice
0.1 → 0.2.

## Where to look hardest

- Whether "every connection this standard defines" and the MAY for other revisions contradict each
  other, or leave a connection that is defined but unpinned (a meta-applier to an adapted child,
  an owner's configuration client, the front).
- Whether GA-BIND-1 is testable on the wire as written, and whether the negative subject can fail
  it without failing anything else.
- Whether any scenario (HS1–HS27, VS1–VS11) relies on an MCP feature that 2026-07-28 removed:
  sessions, server-initiated requests, `ping`, the GET stream, resumability.
- Whether the steward and brain texts, which say the binding is "the applier's" and "the
  steward's", now agree with each other and with the applier text on the revision.

## Round 1 readers

- **Kimi** (`k3`, read-only agent): 1 blocker, 3 high, 5 medium, 2 low.
- **A no-context Claude reader** (Opus): no blocker, 3 high, 4 medium, 5 low.
- **Scenario walk** (Opus, HS1–HS27): no verdict moves (23 drive as designed, 3 only partly, 1
  cannot, as before). Nothing in the scenarios uses what 2026-07-28 removed: every push is a cursor
  long-poll, liveness of a child comes from `events`, and a yes goes through `answer`. 7 findings.

All three found the same three gaps: the voice front was not pinned, so a 2025-only front and a
conforming brain could not talk (Kimi's blocker); the pin broke *Compatibility*, since an applier
or child that conformed at 0.12 on 2025 could no longer be reached by a 0.13 client; and it caught
the owners' own clients, such as Claude Code on the direct way in.

Claude Code speaks 2026-07-28 only on its newer MCP runtime (TypeScript SDK 2), which is its default
only in some deployments, and falls back to the older handshake otherwise; the Claude API's MCP
connector names no 2026-07-28 support (`code.claude.com/docs/en/mcp`,
`platform.claude.com/docs/en/agents-and-tools/mcp-connector`, read 2026-09-28).

**Ruling (the maintainer, 2026-09-28):** the pin binds servers only. Every applier, steward and
front MUST serve 2026-07-28 and MAY also answer earlier revisions; a client SHOULD use 2026-07-28
and MAY fall back.

## Round 1 dispositions

| Finding | Reader | Disposition |
|---|---|---|
| The voice front is not pinned (Kimi B1, Claude H1, walk F1) | all | **fixed**: GA-VOICE-21, with `speaks-only-2025`; voice 0.2 |
| The pin breaks *Compatibility*; a meta-applier cannot reach a child older than 0.13 (Claude H2, walk F2) | Claude, walk | **fixed** by the ruling: clients MAY fall back, so a server older than 0.13 is still reached; GA-BIND-1 is an added requirement, as *Compatibility* allows. A change of the pinned revision is stated to be breaking |
| GA-BIND-2 and GA-BRAIN-23 bind owners' tools and agent brains that may not speak 2026-07-28 (Claude H3, walk F5) | Claude, walk | **fixed** by the ruling: GA-BIND-2 binds only what the steward serves; GA-BRAIN-23 is withdrawn before release, and a brain SHOULD use 2026-07-28 |
| The MUST, the MAY and the harness's fallback contradict each other (Kimi H2) | Kimi | **fixed**: GA-BIND-1 binds what the applier serves; a client's fallback, the harness's included, is a MAY |
| GA-BIND-2 and GA-BRAIN-23 are unarmed; does the steward inherit the MAY (Kimi H3) | Kimi | **fixed**: `speaks-only-2025` arms GA-BIND-2; GA-BRAIN-23 withdrawn; the steward's text states its own MAY and SHOULD |
| The revision is not cited (Kimi H4) | Kimi | **fixed**: the applier's binding cites the revision's specification |
| TLS read as covering only unpinned clients (Claude M4, walk F4) | Claude, walk | **fixed**: every connection to an applier, at any revision, and a meta-applier's to its children, uses TLS; GA-SEC-1's row says so (stricter) |
| The owner's configuration credential is on both sides of the line (Claude M5, Kimi M5, walk F3) | all | **fixed**: GA-BIND-1 names it |
| GA-BIND-1 is graded on the handshake alone; the meta-applier's use is untested (Claude M6, Kimi M7) | Claude, Kimi | **fixed** by the ruling for the meta-applier (a SHOULD); **deferred** for the handshake: the harness reaches the subject at 2026-07-28 and runs every test there, so a subject that serves `tools/call` only on the fallback fails the rest of the run. A test that forbids the fallback after a 2026-07-28 answer is left to wave 1 of the harness |
| A lost response is not re-issued safely for `provision` without a key, `answer`, `say`, `hush` (Claude M7) | Claude | **deferred**: not made by this change; every revision before it could lose a response too. Tracked for the next steward and voice revisions |
| The brain harness's data server names no revision (Claude L8) | Claude | **fixed**: the brain harness's servers serve 2026-07-28 and the 2025 revisions and report which the brain used |
| The MAY is a looser move, recorded as a permission; the bearer checked on every request (Claude L9) | Claude | **fixed**: recorded as looser in the round 2 change record; the bearer is checked on every request at every revision (GA-AUTH-3) |
| `speaks-only-2025` holds only for a stateless 2025 subject (Claude L10) | Claude | **fixed**: its row says statelessly |
| A brain.md line past the wrap width (Claude L11) | Claude | **fixed** in the rewrite |
| GA-LISTEN-5's "loses its connection" names nothing under 2026-07-28 (walk F6) | walk | **deferred** to the next steward revision: the duck limit still bounds the duck, and a front on the fallback may still hold a connection |
| A 2026-07-28 plugin server announces tool changes only on `subscriptions/listen` (walk F7) | walk | **deferred** to the next bridge revision; HS22 holds through the next start |
| GA-HARN-1's refusal half is untestable and unmarked (Kimi M6) | Kimi | **deferred**: text this change did not touch; for the next applier revision |
| Constants that gate a pass are guesses (Kimi M8) | Kimi | **deferred** to the next applier revision, to mark each unmeasured one; measured in the reference builds. (Round 1 said each was already marked; round 2's Kimi showed several are not) |
| A steward behind its applier's clock issues tokens already expired (Kimi M9) | Kimi | **deferred** to the next steward and applier revisions: not made by this change, and a harness run shares one clock |
| Binding bullets with MUST force and no id (Kimi L10) | Kimi | **deferred**: text this change did not touch; graded through every test that calls a tool |
| A child's trust in its meta-applier's `via`, `brain` and `for` (Kimi L11) | Kimi | **deferred** to the next applier revision: not made by this change |

## Round 2 change record

Against round 1's text, after the ruling:

| Where | Rule | Direction | Why |
|---|---|---|---|
| applier, *The MCP binding*; GA-BIND-1 | The applier MUST serve `2026-07-28` to every caller, the owner's configuration credential included; it MAY answer earlier revisions. A client SHOULD use `2026-07-28` and MAY fall back. A change of the pinned revision is breaking | **looser** for clients (a MUST became a SHOULD); stricter for the configuration credential's connection | The ruling, from round 1's three gaps. Had no owner's tool and no older applier been left out, the author would have kept both ends pinned: this move is made for them, and says so |
| applier, *The MCP binding*; GA-SEC-1 | TLS on every connection to an applier at any revision, and on a meta-applier's to its children | **stricter** | Round 1: the MAY must not open an unencrypted way in |
| applier, *The MCP binding* | The bearer credential is checked on every request, at every revision (GA-AUTH-3) | **stricter**, a statement of what GA-AUTH-3 already asks | Round 1: a 2025 session must not outlive a revoked credential |
| applier, *Conformance* | The harness reaches the subject at `2026-07-28` where it is served, otherwise at the revision the subject answers | **new** | So that GA-BIND-1 fails alone |
| steward, *Operations*; GA-BIND-2 | The steward MUST serve `2026-07-28` to every caller, MAY answer earlier revisions, SHOULD use `2026-07-28` to its applier; `speaks-only-2025` arms it | **looser** for its use of its applier; otherwise as round 1 | The ruling |
| brain, *The binding*; GA-BRAIN-23 | Withdrawn before release; a brain SHOULD use `2026-07-28`. The brain harness serves both eras and reports which the brain used | **looser** | The ruling: agent tools a brain runs in may not speak 2026-07-28 yet (goals, G2) |
| voice, *Links, security and retention*; GA-VOICE-21 | A front MUST serve `listen`, `say` and `hush` at `2026-07-28`, MAY answer earlier revisions, SHOULD use `2026-07-28` to the steward; `speaks-only-2025` arms it | **new**, stricter | Round 1's blocker |

## Round 2 readers

- **Kimi** (`k3`, read-only agent): no blocker, 3 high, 6 medium, 2 low.
- **A no-context Claude reader** (Opus): no blocker, 3 high, 5 medium, 4 low.
- **Scenario walk** (Opus, HS1–HS27 and VS1–VS11): no verdict moves (HS 23 / 3 / 1, VS 7 / 4 / 0,
  as before). Every MCP hop has a server MUST behind it. 7 findings, three of them round 1's
  deferrals carried.

Both readers found that the pin, loosened for clients, no longer fixed the defect it was made for:
a steward on 2025 only and an applier serving only 2026-07-28 both conformed and could not talk.

**Ruling (the maintainer, 2026-09-28):** the clients Galatea defines, the steward to its applier, a
meta-applier to its children and a front to the steward, MUST reach their server at 2026-07-28
where it is served, and may fall back only for a server that does not. The SHOULD stays for brains
and owners' tools.

## Round 2 change record

| Where | Rule | Direction | Why |
|---|---|---|---|
| applier, *The MCP binding*; GA-BIND-3 (new, Meta) | A meta-applier MUST reach each child at `2026-07-28` where served, falling back only for a child that does not | **stricter** than round 2's text | The ruling |
| steward; GA-BIND-2 | The steward MUST reach its applier at `2026-07-28` where served; `calls-its-applier-at-2025` arms it | **stricter** | The ruling |
| voice; GA-VOICE-21 | The front MUST reach the steward at `2026-07-28` where served; `calls-the-steward-at-2025` arms it | **stricter** | The ruling |
| applier, steward, voice | A server answers no revision but `2026-07-28`, `2025-06-18` and `2025-11-25`; a client falls back to those two only | **stricter** | Both readers: 2024-11-05 has no Streamable HTTP and 2025-03-26 no `structuredContent`, which the binding needs |
| applier, *The MCP binding* | A client learns what a server serves by `server/discover`, and falls back as that revision's specification describes | **new** | Kimi: the negotiation was unstated |
| applier; GA-AUTH-3 | A client whose registration was removed is `not_permitted` at every revision and in whatever session; `session-outlives-revocation` arms it | **stricter** | Both readers: round 1 claimed this in prose only |
| brain, *The binding* | A voice front serves `2026-07-28`; any other front SHOULD | **new**, a SHOULD | Claude reader: a chat front was left unbound |
| steward and voice, *Conformance* | The harness's fallback, and that the reference applier and fake steward serve all three revisions and record which one was used | **new** | Both readers |

## Round 2 dispositions

| Finding | Reader | Disposition |
|---|---|---|
| The client SHOULD leaves the defect in place for Galatea's own clients (Claude H1, Kimi H1, walk F1) | all | **fixed** by the ruling: GA-BIND-2, GA-BIND-3, GA-VOICE-21 |
| "A client on any revision reaches every conforming applier" is false (Claude H2, Kimi M4, walk F2) | all | **fixed**: "a client that uses `2026-07-28` reaches every conforming applier" |
| A chat front is not pinned (Claude H3) | Claude | **fixed**: a front other than a voice front SHOULD serve `2026-07-28`; the brain standard does not bind fronts, and only the voice standard defines one |
| The negotiation mechanism is undefined (Kimi H2) | Kimi | **fixed**: `server/discover`, and the revision's own fallback rules |
| "Earlier revisions" has no floor; the negative subject names no revision (Claude M1, L1, Kimi L10) | all | **fixed**: `2025-06-18` and `2025-11-25` only; the negative subjects speak `2025-11-25` |
| GA-BIND-1's row claims the configuration credential, which the harness does not test (Claude M2) | Claude | **deferred** to wave 1 of the harness: the test's `covers` says the credential is not checked, so the report claims no more than was run |
| The bearer check on every request is prose only (Claude M3, Kimi H3) | both | **fixed**: GA-AUTH-3's row, and `session-outlives-revocation` |
| The steward and voice harnesses name no revision (Claude M4, Kimi M6) | both | **fixed**: each *Conformance* says what the harness offers and records |
| A fallback reopens sampling and elicitation, and 2026-07-28's input requests, as a way around `answer` (Claude M5) | Claude | **deferred** to the next brain and steward revisions. A yes counts only through `answer` and its checks (GA-CONF-2), and a brain takes data as data (GA-BRAIN-3), so neither gate stands on such a request; stating that a client declines them is a new rule, for its own review |
| A 0.x version cannot say which bump is breaking (Claude L2) | Claude | **fixed**: a change of the pinned revision is "not an addition in the sense of *Compatibility*: the version that makes it says so" |
| A fallback front's TLS has no id of its own (Claude L3) | Claude | **deferred** to the next voice revision; GA-BRAIN-16 grades it from the brain's side |
| GA-BRAIN-23 not recorded as withdrawn; long lines (Claude L4, Kimi M5) | both | **fixed** |
| Constants that gate a pass are unmarked (Kimi M7) | Kimi | **deferred**, as round 1's corrected row says |
| Binding bullets with no id (Kimi M8) | Kimi | **deferred**, as in round 1 |
| `front_version` is asserted by the brain (Kimi M9) | Kimi | **deferred** to the next voice revision: not made by this change, and a brain that lies gets duplicates, not a way past a gate |
| The revision-change sentence and loopback wording differ between standards (Kimi L11) | Kimi | **fixed** for the revision rule, which the steward, voice and brain now take from the applier by reference; **deferred** for the loopback wording, not made by this change |
| GA-VOICE-3's "while connected" and "lost the steward" name nothing at 2026-07-28 (walk F3) | walk | **deferred** to the next voice and steward revisions, with GA-LISTEN-5 (round 1, walk F6): the narrowing delay and the duck limit still bound both |
| A re-sent `say` may play twice (walk F6) | walk | **deferred** to the next voice revision, with round 1's Claude M7 |
| The scenario files grade against the old versions (walk F7) | walk | **fixed** at the verdict: a row in each scenario file's changelog |

## Verdict

Pass 1 is green on the final text. Two rounds ran, each with Kimi and a no-context Claude reader,
and a scenario walk. Round 1 found one blocker (the voice front unpinned), which is fixed; round 2
found none, which ends the review by the maintainer's stopping rule. Every finding is disposed:
round 1, 21 rows (12 fixed, 8 deferred, 1 fixed in part and deferred in part); round 2, 19 rows
(10 fixed, 8 deferred, 1 in part each), none rejected. Round 2's fixes, made under the
maintainer's second ruling, were not read by a further round.

**PASS** 2026-09-28 (the maintainer, confirmed at the merge, 2026-09-28): applier
0.13, steward 0.8, brain 0.6, voice 0.2.
