# Affinity Arena — current festival release

**Current published version:** [Studio Life / festival source, play instructions and verified release evidence](FESTIVAL-RELEASE.md). Build from `festival/`, not the older prototype below. DoraHacks BUIDL 48375 is already submitted, Under Review; this does not mean eligibility or a prize has been approved.

## Historical development branch

This branch contains the music-affinity evolution of Signal Grove: walk to a genre instrument, rehearse C/E/G notes for 21 seconds, review your attributes, then walk to a stage microphone for a live show that counts twice. Includes K-pop, Brazilian Funk, Latin Urban, Afrobeats, Hip-hop and Electronic with equal mechanics. A 10-second queue fills empty seats with explicitly labeled simulated performers. Original musical icons and synthesized lead tones respond to hits; wrong or missed notes trigger a short error sound. No commercial recording is used. Compact translucent guidance and minimizable panels keep the venue visible. The original Signal Grove source and main branch are preserved.

Read [the current arena rules and limitations](decentraland/AFFINITY-ARENA.md) and [v0.8 verification report](docs/AFFINITY-ARENA-V08-QUALITY.md). Version 0.8 is a source candidate, NOT DEPLOYED: typecheck, 88 automated tests and production build pass, but physical Android audio, touch, walking and real-participant acceptance remain pending. Version 0.7 was accepted by the World server on September 9, 2026; its public bundle matched its local build byte for byte ([historical deployment receipt](docs/AFFINITY-ARENA-V07-WORLD-RECEIPT.json)). The user subsequently tested that version on Android and requested this refinement. Do not mistake the current source for the live World. Public demo video and X announcement remain pending. DoraHacks BUIDL 48375 was observed submitted and Under Review on September 9, 2026. The peer-coordinated prototype has no economic rewards and is not cheat-proof.

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

The preceding Signal Grove test counts are historical. For current Affinity Arena
evidence and outstanding acceptance work, use the linked arena document above.

Preview defaults are loopback-only, with no browser or client auto-launch.
No public inbound port, private-key export or disabled TLS validation is needed
for this source package. Configure publication separately for an authorized
World; no borrowed World or private support transcript is included here.

## Earlier web prototype

The files at the repository root are the earlier standalone web prototype.
Its scripted companions illustrate the initial concept; they do not establish
multiplayer integration. The actual SDK scene lives in `decentraland/`. Unlike
the historical Signal Grove scene, v0.7 includes explicitly labeled exhibition bots.

To run the earlier web prototype with Node.js 20 or newer:

```sh
node scripts/serve.mjs
npm test
```

Open `http://127.0.0.1:4327/`. Its development server accepts only loopback
connections. The existing [architecture](docs/ARCHITECTURE.md) and
[security notes](docs/SECURITY-PRIVACY.md) describe the standalone replay.

Built with AI-assisted development. Project source is MIT licensed; see LICENSE.
