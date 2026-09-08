# Affinity Arena

Find your music crew. Rehearse together. Duel together.

## Current status

Native SDK7 implementation, not a verified public World. The source typecheck and 43 automated tests pass. Tests include four simulated transport clients; they are **not** four real Decentraland visitors. Phone, keyboard and multiplayer runtime QA, public demo video and final hackathon submission remain pending. The old Signal Grove code and tests are preserved as an earlier concept, not the active experience.

## Play loop

1. Choose K-pop, Brazilian Funk, Latin Urban, Afrobeats, Hip-hop or Electronic. Two crews can occupy a lobby, with two people each. Affinities give identity, not statistical advantages.
2. All four real people press Ready. Six 7-second rehearsal rounds begin automatically. Watch your cue for two seconds, then remember and select ONE, TWO or THREE. Each teammate has their own cue. There are no timing/audio precision requirements.
3. Each correct cue contributes to battle energy; both teammates correct in the same round earn harmony. Battle starts at 100 HP each, 4–8 shared energy and 0–12 shield, depending on training. Training cannot generate an unlimited advantage.
4. Five simultaneous 12-second card turns decide the match. Each person chooses one card. Attack costs 2 for 13 damage; Guard costs 1 to block 10; Charge is free and restores 3 energy; Combo costs 3 per person for 5 damage alone or 36 total if both teammates choose it. Costs use the crew's energy at the start of the turn. If their combined cost exceeds that budget, **all paid cards fail**, while Charge still restores energy. Each turn restores another 1 energy, capped at 12. No choice means pass. Shield absorbs damage after Guard. All damage resolves simultaneously.
5. Highest remaining HP after five turns wins; equal HP is a draw. A depleted team ends the match early. Results last 18 seconds before a fresh lobby. Departures cancel the match without awarding a winner.

## Access and interface

The native HUD uses the renderer's interactable area, actual pixel dimensions, large 46px buttons, named actions and text feedback. It supports a compact layout when height is limited; if insufficient room remains, close client overlays or use a larger landscape viewport. Device validation is still required. World scenery is primitive geometry, two stages, speakers and a scoreboard. There are no artist assets, lyrics, recordings, streaming embeds, ads, payments or token rewards.

## Networking limits

SDK MessageBus is scoped to the scene/realm. An automatically elected visitor coordinates this casual session; users do not run a public Internet server. A healthy coordinator stays during a match; a disconnected coordinator triggers a new lobby. Heartbeats expire after eight seconds. Session incarnations make quick reconnects safe for command deduplication. Spectators can watch and join the next round. Reload may lose a local pending-choice label even when the host retains the locked choice.

Transport sender identity is bound to each command; schemas, sizes, roster, costs and timing are checked. Public snapshots redact ongoing choices, but **MessageBus command traffic is not cryptographically secret and the peer coordinator is not cheat-proof**. This is not suitable for wagers, economic rewards or ranked competition. Do not claim server-authoritative anti-cheat. Network partitions and clock skew need real-client validation before release.

## Build

Use the existing pinned SDK7 7.27.0 environment: `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm build:production`. No new backend or infrastructure is required for this prototype. Local preview remains loopback-only and stopped when unused. No browser local-network permission, tunnel or firewall change is required merely to build the project.

## Delivery gate

Do not mark submitted until there is a verified World entity, public link, real phone and four-client acceptance, demo video and official portal receipt. The post-delivery X announcement also needs a public video and verified company mention. Source publication is a separate state.
