# APPORTION — project brief

- Portfolio: Build 004
- Status: Complete implementation; publication tracked in RELEASE.md
- Date: 8 September 2026
- Thesis: An allocation rule encodes a choice. Make its arithmetic and consequences inspectable rather than hiding them behind a fairness score.

## Audience and activity

For organisers and facilitators who need to explain how indivisible places are distributed in proportion to an agreed basis. Start with an example, apply your own groups, see who changes across rules, and share a discussion brief with the exact assumptions. Audience fit is a product hypothesis, not measured adoption.

## Delivered scope

One working route: bounded editable inputs; explicit immutable tie priorities; three exact methods; quota/seat comparison; all 199 adjacent transitions from 1 to 200 seats; whole-quota/remainder trace or sequential winner/candidate trace; CSV/JSON export; keyboard-labelled controls and responsive layout; local-only page state; two WebMCP tools.

Consumer revision: a ref-backed pure workspace controller protects drafts across all mutation paths; file/example replacements are staged and checked against an edit epoch; compact input backups and validated legacy-report reopening recompute outputs; readable group comparisons and a discussion brief preserve context. No private records are sent to a backend. This is deterministic intelligence, not generative AI or a fairness oracle.

## Sophistication beyond earlier builds

Build 002 separated evidence from inference; Build 003 made a synthetic physical model inspectable. This build adds exact rational comparisons, an independent algorithmic oracle, generated invariants, immutable tie semantics and a reproducible counterexample. It connects mathematical guarantees to visible consequences without presenting the model as a real-world verdict.

## Boundaries

No API, new paid service, account requirement, backend document upload, electoral advice or automatic social publishing. Local JSON opening is deliberate and bounded to 1 MiB. No claim that this model reproduces a specific election. No hidden random tie-break. No autosave or undo: keep input backups before replacement.

## Later work, not shipped

Classroom exercises co-designed and tested with educators; optional comparison notebooks; additional allocation principles with their own explanations and independent tests. Research and validate any further method before adding it. These are possibilities, not current capabilities.
