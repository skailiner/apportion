---
title: APPORTION
emoji: 🧮
colorFrom: blue
colorTo: indigo
sdk: static
app_file: dist/client/index.html
pinned: false
short_description: Explore who gets the next seat.
---

# APPORTION — Who gets the next seat?

Build 004 in the World Builds portfolio. A free, browser-only allocation lab for educators, students and anyone exploring the consequences of proportional rules.

Edit 2–12 group weights, allocate 1–200 seats, compare Hamilton, D’Hondt/Jefferson and unmodified Sainte-Laguë, inspect the exact arithmetic and scan every adjacent seat total for losses. Download CSV comparisons or JSON with full provenance and the selected allocation trace.

Publication status and verified links: [RELEASE.md](./RELEASE.md).

## Run and verify

Use Node.js 22.20 or a compatible newer version, with npm.

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 4177
npm test
npm run lint:app
npm run typecheck
npm run build
node scripts/verify-static.mjs
```

The production artifact is **dist/client/**. Serve that directory with a static HTTP server. The app needs no backend, API key, database or account. Keep the development server on loopback; it is not a production host. The GitHub repository contains reproducible source; the Hugging Face snapshot also contains the generated static artifact.

## Exact model

For group weight p, total weight P and H seats, the ideal quota is H × p / P.

- Hamilton: floor each quota, then award the remaining seats by descending exact remainder H × p mod P.
- D’Hondt / Jefferson: repeatedly maximize p / (a + 1), where a is the group's seats already awarded.
- Sainte-Laguë: repeatedly maximize p / (2a + 1).

All comparisons use BigInt cross-products. Decimals are display approximations, never decision inputs. Exact fractions are serialized as decimal strings in JSON. Weights are positive integers up to 1 billion; zero weights and zero seats are deliberately outside this release.

Exact ties use the smaller immutable priority, independent of group names and row order. This is this lab's convention, not a claim about institutional tie rules. The trace distinguishes tied intermediate awards from a tie crossing the final cutoff; the latter reports the full affected quotient class, including earlier winners.

The initial synthetic example has weights 1500, 1500, 900, 500, 500, 200. Hamilton allocates 25 seats as 7,7,4,3,3,1 and 26 seats as 8,8,5,2,2,1. Groups D and E lose a seat. No tie crosses either cutoff, so the loss is not a tie-breaking artifact.

## What this does not claim

This is not a complete election system, an AI analyzer, a universal fairness score or a policy recommendation. It excludes thresholds, guaranteed seats, districts, eligibility, reserved seats and jurisdiction-specific ties. Proportionality does not capture need or rights. It does not claim quota and house monotonicity are universally incompatible.

The comparison shows lower quota (rounded down), upper quota (rounded up), weight share, seat share and deviation. Integral quotas have identical lower and upper bounds. Hamilton respects those bounds; the two divisor methods can violate them.

## Primary sources

Reviewed 8 September 2026; the app implements the formulas, not contemporary election law.

- [US Census Bureau: Hamilton and Jefferson](https://www.census.gov/about/history/historical-censuses-and-surveys/census-programs-surveys/decennial-census/methods.html)
- [European Parliament: D’Hondt briefing, 2019](https://www.europarl.europa.eu/RegData/etudes/BRIE/2019/637966/EPRS_BRI(2019)637966_EN.pdf)
- [New Zealand Electoral Commission: Sainte-Laguë](https://www.electionresults.govt.nz/electionresults_2023/statistics/sainte-lague-formula.html)

## Verification and privacy

Eleven mathematical/input/export test groups cover known fixtures, 160 generated cases across all three methods, an independently ranked quotient oracle, scaling and row-order invariance, divisor-prefix behavior over 1–200 seats, full cutoff membership, exact quota bounds, atomic rejection and CSV formula neutralization.

Both WebMCP tools passed the focused contract check: a multi-field configuration updates the visible app; read-back is unchanged after rejected input; invalid read arguments are rejected. This is not a broad visual, device or assistive-technology audit.

Inputs exist only in page memory. Reloading resets them. Downloads contain the applied configuration, not unfinished edits. There is no upload or telemetry added by the app; hosting providers may retain normal delivery logs. Do not publish private input records accidentally when sharing downloads.

The retained starter includes development/server dependencies with locally reported advisories. Only static browser assets are published; no RSC server or development endpoint is deployed. See [SECURITY-NOTES.md](./SECURITY-NOTES.md). App-source lint and type checking pass. Full-starter lint has existing diagnostics in unused vendored components; those components were not rewritten to suppress them.
