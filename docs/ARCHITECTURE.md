# Architecture

```text
Touch action
    |
    v
deterministic core.mjs  --->  immutable replay state
    |                              |
    v                              v
accessible UI feedback       canonical local receipt
                                   |
                                   v
                              semantic reconstruction
                                   |
                                   v
                              SHA-256 fingerprint
```

## Components

- `core.mjs`: pure deterministic state machine; validates seeds/actions, previews scripted intentions, resolves turns, reconstructs every proof turn and emits canonical replay evidence.
- `app.mjs`: DOM adapter only; no fetch, account, identity or remote persistence.
- `sw.js`: same-origin offline shell; explicitly rejects cross-origin requests handled by the worker.
- `scripts/serve.mjs`: dependency-free loopback HTTP server with restrictive security headers and a truthful health endpoint.
- `tests/core.test.mjs`: deterministic action, replay, receipt, tamper and player-isolation checks.
- `tests/server.test.mjs`: isolated loopback server, security-header, method and traversal checks.

## Migration seam

The pure state machine can be ported behind a future Godot/Decentraland adapter after the production stack is verified. That adapter does not exist in this package. Any future network or multiplayer layer must preserve the replay schema's distinction between scripted demo actors and real participants.
