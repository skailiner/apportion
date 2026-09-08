# Release security notes

The app is a local-in-browser computation with bounded inputs, React-escaped labels, deterministic exact arithmetic and explicit downloads. There is no application upload endpoint, Server Function, authentication, database or external fetch. Public hosting must use only dist/client/.

## Starter dependency triage

The initial installed starter reported 11 affected dependency entries, including 8 high-severity entries. A fresh external npm audit was not authorized by the automatic approval review because it would transmit dependency metadata to npm; it was not retried or routed around. The existing installation log's advisory response was inspected locally.

That local report identifies Vite 8.0.13 (Windows development-server file access), React Server DOM 19.2.6 (server-function denial of service), and tooling/runtime paths through ws, undici, sharp, image-size and esbuild. This does not certify a clean dependency audit. The reported attack paths are not provided by this static release; no server, image-processing or development endpoint is published.

Do not expose the development server to the internet. Review and update those toolchains before adopting server-backed features. A compatible future RSC upgrade must cover React, React DOM, React Server DOM and the RSC plugin's vendored runtime together; updating only a top-level dependency is insufficient. Forced transitive overrides were not applied without compatibility evidence.

## Other boundaries

- Never commit .env files, credentials, caches or node_modules.
- CSV labels beginning with formula markers are neutralized and quotes escaped.
- Invalid control requests fail before applied state is changed.
- JSON preserves exact numerator/denominator strings and the tie convention.
- Downloads may contain user-entered group names; sharing them is the user's choice.
- Browser-only does not mean hosting providers collect no access logs.
