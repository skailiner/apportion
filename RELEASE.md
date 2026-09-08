# Release record

Model edition: apportion/v1 · 1.0.0 · 8 September 2026.

- Numerical/input/export tests: 11 groups passed, including 160 generated cases and independent quotient-oracle comparisons.
- App-source lint: passed. Type check: passed.
- Independent review: corrected complete cutoff-tie membership, new-group ID independence and the empty Hamilton scan explanation.
- Focused WebMCP check: both tools register and work; valid tied Sainte-Laguë allocation returned A,B,C as the cutoff class; rejected mixed-field input preserved read-back; rejected invalid read; restored the 25-seat Hamilton example with D,E next-seat losses.
- Static build: passed. The 18-file client artifact passed path, linked-asset and recognized credential-pattern checks. A Tailwind mask-* false positive was corrected with token boundaries and positive/negative scanner fixtures. No server directory or source map was included.
- GitHub public source: [skailiner/apportion](https://github.com/skailiner/apportion), release source 4a03def5e6bc4c26abd58d35b63fb7bb66fb499d verified against the remote branch.
- Hugging Face free static Space: [skailiner/apportion](https://huggingface.co/spaces/skailiner/apportion), release snapshot 399ce74b3898cdb3bff73b0e55be4fa3a89c5602 verified against the remote branch. The provider reports Running and displays the actual APPORTION app. An unauthenticated HTTPS check returned 200 for the page and its JavaScript entry, with the expected title and JavaScript content type.
- Sites version 1: privately deployed successfully at https://apportion-allocation-lab.skaihai.chatgpt.site. Public access was rejected by the action-time safety review because it requires explicit approval for this particular Sites audience change. Do not retry that access change without new user approval. The separate GitHub and Hugging Face publication requested by the user is complete.

## Reproducible release provenance

- Sites project: appgprj_6a9fa1cc1cac819184d2bca98c819461
- Saved version: appgprj_6a9fa1cc1cac819184d2bca98c819461~appgver_af9013c55d8c819181e918f95e88c18f
- Successful private deployment: appgdep_6a9faa21043481918bf27ca3147bc017
- Exact pushed/built source: 4a03def5e6bc4c26abd58d35b63fb7bb66fb499d
- Deployment archive SHA-256: 0d93c2bf535b892825895d4548ab0c670e883c25c3b89f83371634783a61cdb7
- Later documentation-only commits record publication results; they do not change the tested app or this deployed artifact.
- Dependency caveats are documented in SECURITY-NOTES.md. No clean or fresh npm audit is claimed; the reviewed release includes static browser files only.

The generated public files live only in dist/client/. Server build intermediates must never be published. No broad visual/device QA was requested or performed.
