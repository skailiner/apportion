# APPORTION — project brief

- Portfolio: Build 004
- Status: Complete implementation; publication tracked in RELEASE.md
- Date: 8 September 2026
- Thesis: An allocation rule encodes a choice. Make its arithmetic and consequences inspectable rather than hiding them behind a fairness score.

## Audience and activity

For learners and facilitators comparing how indivisible seats or slots are distributed in proportion to group weights. Start with a real mathematical surprise, then replace the synthetic inputs and examine each rule.

## Delivered scope

One working route: bounded editable inputs; explicit immutable tie priorities; three exact methods; quota/seat comparison; all 199 adjacent transitions from 1 to 200 seats; whole-quota/remainder trace or sequential winner/candidate trace; CSV/JSON export; keyboard-labelled controls and responsive layout; local-only page state; two validated WebMCP tools.

## Sophistication beyond earlier builds

Build 002 separated evidence from inference; Build 003 made a synthetic physical model inspectable. This build adds exact rational comparisons, an independent algorithmic oracle, generated invariants, immutable tie semantics and a reproducible counterexample. It connects mathematical guarantees to visible consequences without presenting the model as a real-world verdict.

## Boundaries

No API, new paid service, account requirement, document upload, electoral advice or automatic social publishing. No claim that this model reproduces a specific election. No hidden random tie-break. No autosave: export is deliberate.

## Later work, not shipped

Accessible classroom exercises co-designed with educators; import with schema validation and explicit local provenance; additional allocation principles with their own explanations and independent tests. Research and validate any further method before adding it. These are possibilities, not current capabilities.
