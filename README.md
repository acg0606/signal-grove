# Signal Grove

Signal Grove is a social meeting scene for the Decentraland Friendzone Buildathon.
Players choose a conversation signal at three pedestals; the scene shares real
player signals through the SDK MessageBus and presents a touch-friendly HUD.

## Decentraland implementation

The [decentraland](decentraland/README.md) directory contains the actual SDK7
scene, its locked dependencies, setup commands, and behavioral tests.
Typechecking, nine deterministic tests, and the official SDK build passed on
2026-09-06. The room reducer handles out-of-order updates, expiry, malformed
messages and duplicate revisions.

No persistent public World, two-player runtime validation or mobile-client
validation is claimed yet. A public World and final official submission are
still pending. Follow the SDK README for those remaining checks.

## Earlier web prototype

The files at the repository root are the earlier standalone web prototype.
Its scripted companions illustrate the initial concept; they do not establish
multiplayer integration. The actual SDK scene lives in `decentraland/` and has
no simulated player companions.

Built with AI-assisted development. Project source is MIT licensed; see LICENSE.
