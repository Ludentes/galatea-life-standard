# Galatea standards

Galatea is an open home brain: a **brain** (a resolver and a language model) asks a **steward**,
which holds the house and decides who may do what; the steward sends actions to exactly one
**applier**, which guards the devices; **bridges** below the applier speak to the devices'
transports, and a **voice front** hears and speaks in the rooms. This repository holds the standards
each of those parts implements, and the material that grades an implementation against them. The
architecture, and how the parts fit, is in `docs/architecture.md`; the vocabulary in `CONTEXT.md`.

## The standards

| Standard | Version | Status |
|---|---|---|
| [The Galatea applier standard](standard/applier.md) | 0.15 | draft |
| [The Galatea brain standard](standard/brain.md) | 0.6 | draft |
| [The Galatea bridge standard](standard/bridge.md) | 0.6 | draft |
| [The Galatea steward standard](standard/steward.md) | 0.10 | draft |
| [The Galatea voice standard](standard/voice.md) | 0.3 | draft |

Each standard's *Requirement index* is its source of truth. Every requirement has an id
(`GA-PLAN-1`), and every MUST cites one. The standards are drafts: they move as implementations
meet real homes, and each revision passes the review in `docs/review-procedure/` before its version
changes. Its records are under `docs/reviews/`; the commit ids they cite name the history of the
private workshop where the standards are written, which is not published. The stories the standards
are graded against are in `docs/reference/`, and the design notes behind them in `docs/specs/`.

## Conformance

`conformance/` turns the standards into checks:

- `<standard>-requirements.json` and `<standard>-constants.json`: each standard's requirement index
  and constants as data, generated from the text and checked against it by `check_manifest.py`.
- Five packages, published to npm at one version:

| Package | Holds |
|---|---|
| `@ludentes/galatea-life-schemas` | JSON Schema for every message of every standard, TypeScript types, validators |
| `@ludentes/galatea-life-binding` | The algorithms two implementations must compute alike (the confirmation token's proof), with test vectors |
| `@ludentes/galatea-life-test-clock` | The client a Node subject uses to take its time from the harness |
| `@ludentes/galatea-life-sim` | The simulated home: a broker, a time server, a simulated bridge and applier |
| `@ludentes/galatea-life-harness` | The conformance harness: the runner, the report, the requirement tests, and the manifests |

Use them like any npm package:

```sh
npm install @ludentes/galatea-life-schemas            # validate messages in your own implementation
npm install --save-dev @ludentes/galatea-life-harness # grade it
```

## Grading an implementation

An implementation under test is a **subject**: a folder holding a `subject.json` that says which
standard it implements, which parts it claims, and how to start it. The harness starts a simulated
home around it (Node 24, and either `mosquitto` on `PATH` or Docker), runs the tests of every
requirement it claims, and reports one row per requirement id:

```sh
npx galatea-harness run --subject ./my-applier [--ids GA-PLAN-1,GA-PLAN-2] [--out ./report]
npx galatea-harness negatives --subject ./my-applier
```

Exit 0 is a pass, 1 a failed requirement, 2 a harness fault. A subject that keeps state in Postgres
can be run under `npx galatea-with-postgres <command>`, which provides a throwaway server on loopback
(Docker). The subject contract, the claims, negative mutations and the report are described in
`conformance/README.md`.

To work on this repository itself (Node 24, pnpm 10, Python 3.11):

```sh
pnpm install
pnpm skeleton    # build everything, check the manifests against the standards, and grade the simulated subjects
pnpm test
```

## Reference implementations

The reference steward, applier, bridges and voice front, graded by this harness, are in
[galatea-life](https://github.com/Ludentes/galatea-life). They take these packages from npm like any
other implementation.

## Licence

Apache-2.0, in `LICENSE`.
