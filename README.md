# Affinity Arena — development branch

This branch contains the music-affinity evolution of Signal Grove: two real-player crews rehearse together, earn bounded resources and duel using four cards. Includes K-pop, Brazilian Funk, Latin Urban, Afrobeats, Hip-hop and Electronic with equal mechanics. The original Signal Grove source and main branch are preserved.

Read [the current arena rules and limitations](decentraland/AFFINITY-ARENA.md). Automated tests and compilation are source evidence only. **No public World deployment, real four-client/phone QA, demo video or hackathon submission is claimed.** The peer-coordinated prototype has no economic rewards and is not cheat-proof.

## Earlier Signal Grove overview

Signal Grove is a social meeting scene for the Decentraland Friendzone Buildathon.
Players choose a conversation signal at three pedestals; the scene shares real
player signals through the SDK MessageBus and presents a touch-friendly HUD.

## Decentraland implementation

The [decentraland](decentraland/README.md) directory contains the actual SDK7
scene, its locked dependencies, setup commands, and behavioral tests.
Typechecking, 19 automated tests, and the official production build passed on
2026-09-07. Coverage includes room identity/expiry, HUD state and text contrast,
and authentication-proxy safety regressions. Proxy tests do not prove login
success. The HUD now distinguishes pending and locally applied choices.

No persistent public World, two-player runtime validation or mobile-client
validation is claimed yet. A public World and final official submission are
still pending. Follow the SDK README for those remaining checks.

Preview defaults are loopback-only, with no browser or client auto-launch.
No public inbound port, private-key export or disabled TLS validation is needed
for this source package. Configure publication separately for an authorized
World; no borrowed World or private support transcript is included here.

## Earlier web prototype

The files at the repository root are the earlier standalone web prototype.
Its scripted companions illustrate the initial concept; they do not establish
multiplayer integration. The actual SDK scene lives in `decentraland/` and has
no simulated player companions.

To run the earlier web prototype with Node.js 20 or newer:

```sh
node scripts/serve.mjs
npm test
```

Open `http://127.0.0.1:4327/`. Its development server accepts only loopback
connections. The existing [architecture](docs/ARCHITECTURE.md) and
[security notes](docs/SECURITY-PRIVACY.md) describe the standalone replay.

Built with AI-assisted development. Project source is MIT licensed; see LICENSE.
