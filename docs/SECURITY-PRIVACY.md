# Security and privacy

- Runtime is static and loopback-only.
- The local server rejects non-loopback binding, mutating methods, malformed paths and traversal segments before resolving a file.
- No personal data fields, accounts, telemetry, camera, microphone, geolocation or analytics.
- No wallet, RPC, token, MANA or transaction path.
- No application API call or remote runtime URL. The service worker uses same-origin `fetch` only to cache local app-shell files and rejects cross-origin requests.
- Content Security Policy restricts script/style/connect to self and forbids frames, objects, base remapping and form submission.
- Replay companions are explicitly scripted; the exported receipt cannot describe them as live users.
- Receipt verification reconstructs all four turns, validates the truth boundary and then checks the SHA-256 fingerprint. The fingerprint still proves deterministic content equality only; it is not a signature, identity proof, blockchain receipt or submission receipt.
- The public source release was scanned for common credential signatures, personal contact data and machine-specific paths before publication.
- Runtime health reports `publishable: false`: this static replay is not the public Decentraland World and cannot authorize a submission.
- Offline navigation may fall back to the cached shell; a missing non-navigation asset returns an explicit `503` and is never disguised as HTML.

Residual risk: browser extensions, the operating system and the host environment are outside this package's control.
