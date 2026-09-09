# Affinity Arena

Find your music crew. Rehearse together. Duel together.

## Current status

Version 0.6 is the current source candidate. Typechecking, 61 automated tests and the production build pass, including simulated transport and production-controller tests. They are **not** four real Decentraland visitors or physical-phone acceptance. The earlier v0.5 has a server-accepted World deployment, but public gameplay has not been accepted; v0.6 is not deployed. Native interaction, audio, phone, keyboard and multiplayer QA, public demo video and final submission remain pending. Signal Grove is preserved as the earlier concept, not the active experience.

## Play loop

1. Choose K-pop, Brazilian Funk, Latin Urban, Afrobeats, Hip-hop or Electronic. Two crews can occupy a lobby, with two people each. Affinities give identity, not statistical advantages.
2. All four real people press Ready. Six 7-second rehearsal rounds begin. Tap C, E or G when each descending note reaches the gold line. Four notes begin after a two-second count-in; tempo rises from 80 to 130 BPM. Equivalent teammate positions on rival crews face equal difficulty. These are original exercises, not transcribed songs. Sound is opt-in; every target is also visual.
3. At least three of four correctly timed notes earns one rehearsal success. Both teammates succeeding in the same round earn harmony. Battle starts at 100 HP each, 4–8 shared energy and 0–12 shield, depending on training. The advantage is bounded.
4. Five simultaneous 12-second turns decide the match. Choose one card within 3.5 seconds; the desk then switches to four notes starting at 5 seconds. Riff/Attack costs 2 for 13 damage; Rest/Guard costs 1 to block 10; Amp/Charge is free and restores 3 energy; Chord/Combo costs 3 per person for 5 damage alone or 36 total together. Every two correct crew notes add one attack damage, capped at +4, only for a funded attack/combo. Costs use start-of-turn energy. Overspending makes **all paid cards fail**, while Amp still restores energy. Each turn restores another 1 energy, capped at 12. No card means pass; notes alone never deal damage. Shield absorbs damage after Rest. Damage resolves simultaneously at the deadline; confirmed HP loss triggers a short pulse and chord.
5. Highest remaining HP after five turns wins; equal HP is a draw. A depleted team ends the match early. Results last 18 seconds before a fresh lobby. Departures cancel the match without awarding a winner.

## Access and interface

The bottom-right HUD uses interactable-area pixels, 46px gameplay buttons, three touch lanes and text feedback. Crews, Warm-up and How to play tabs introduce the experience. Solo seven-second practice cycles through six grooves without awarding match resources or manufacturing teammates. Phase progress, crew availability and both HP bars remain visible where relevant. Reduce motion disables the decorative stage swell; falling notes remain essential timing cues. Stage-only view is reversible. Controlled layout checks cover 390x844, 844x390 and 1440x900 viewports, not physical devices. Close platform overlays if they obscure controls. Scenery uses charcoal twin stages, gold frames, speaker cones, crew signs, a central board and response pulses. Visitors bring their own avatars; the concept illustration's costumes are not custom wearable assets. MUSIC-PROVENANCE.md documents six original synthesized clips and a result chord. No artist assets, lyrics, commercial recordings, streaming embeds, payments or token rewards are used. Device validation is still required.

## Networking limits

SDK MessageBus is scoped to the scene/realm. An automatically elected visitor coordinates this casual session; users do not run a public Internet server. A healthy coordinator stays during a match; a disconnected coordinator triggers a new lobby. Heartbeats expire after eight seconds. Session incarnations make quick reconnects safe for command deduplication. Spectators can watch and join the next round. Reload may lose a local pending-choice label even when the host retains the locked choice.

Transport sender identity is bound to each command; schemas, roster, costs and timing are checked. Midpoint ping/pong estimates clock offset. Host-arrival scoring allows 180ms early / 350ms late; asymmetric delay and poor connections can still affect play. Notes retry at 80ms and may supersede an unconfirmed earlier note so it cannot block the next target. Only the current intent receives local acknowledgement feedback. Public snapshots redact choices, but **MessageBus commands are not cryptographically secret and the peer coordinator is not cheat-proof**. No wagering, economic rewards or ranked competition. Network partitions, skew and audio timing need real-client validation.

## Build

Use the existing pinned SDK7 7.27.0 environment: `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm build:production`. No new backend or infrastructure is required for this prototype. Local preview remains loopback-only and stopped when unused. No browser local-network permission, tunnel or firewall change is required merely to build the project.

## Delivery gate

Do not mark submitted until there is a verified World entity, public link, real phone and four-client acceptance, demo video and official portal receipt. The post-delivery X announcement also needs a public video and verified company mention. Source publication is a separate state.
