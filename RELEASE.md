# Release record

Model edition: apportion/v1 · 1.0.0 · 8 September 2026.

- Numerical/input/export tests: 11 groups passed, including 160 generated cases and independent quotient-oracle comparisons.
- App-source lint: passed. Type check: passed.
- Independent review: corrected complete cutoff-tie membership, new-group ID independence and the empty Hamilton scan explanation.
- Focused WebMCP check: both tools register and work; valid tied Sainte-Laguë allocation returned A,B,C as the cutoff class; rejected mixed-field input preserved read-back; rejected invalid read; restored the 25-seat Hamilton example with D,E next-seat losses.
- Static build: passed; final packaging validation to be recorded.
- Sites public release: pending.
- GitHub public source: pending.
- Hugging Face free static Space: pending.

The generated public files live only in dist/client/. Server build intermediates must never be published. No broad visual/device QA was requested or performed.
