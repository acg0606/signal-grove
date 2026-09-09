# Affinity Arena

Find your music crew. Rehearse together. Own the stage.

## Current status

Version 0.7 is a source-verified candidate: typechecking, 84 automated tests and the production build pass. These include simulated clients and SDK adapters, not physical-phone or native-renderer acceptance. The World still serves the earlier v0.5; v0.7 publication is pending. DoraHacks [BUIDL 48375](https://dorahacks.io/buidl/48375) was observed submitted and Under Review on September 9, 2026. Submission is not technical acceptance.

## Play loop

1. Choose K-pop, Brazilian Funk, Latin Urban, Afrobeats, Hip-hop or Electronic. Each has its own illustrated identity and themed studio, with equal gameplay rules.
2. Selection immediately opens a local soundcheck and a 20-second queue. Four real participants can start early. Otherwise explicitly labeled simulated performers fill empty seats for a two-crew, two-performer exhibition. Bots are never reported as real visitors. Cancel queue to leave before a show begins.
3. Play six seven-second scored rehearsal rounds. Tap C, E or G when descending notes reach the white line. Original synthesized exercises accelerate from 80 to 130 BPM. Sound is opt-in; targets are also visual.
4. Move to the main stage for five twelve-second live rounds. Four notes start after a five-second lead-in. Everyone performs; there are no cards, HP or energy costs in this version.
5. Compare rhythm, precision, harmony and consistency. Each final attribute is `(studio + 2 × live) / 3`, rounded to two decimals. The sum of four attributes, at most 400 points, determines the winner. Equal scores draw. NPC fans raise the winner's emblems; this illustrates the computed result, not a real audience vote. Results last 24 seconds before resetting. A real participant leaving cancels the show without a winner.

## Scoring

Rhythm measures successful notes; precision measures hits within 120 ms; harmony measures matching successful notes across teammates; consistency measures each performer's longest streak within each round. All four normalize to 0–100 and average over each phase. Bots use deterministic, imperfect performance independent of the human score. Affinity confers identity, not a statistical advantage.

## Venue and controls

The scene is an enclosed 32×32 nightclub across four parcels, with landscape terrain disabled, neon fixtures, speakers, six studios, main stage and 18 stylized NPC fans. Original illustrated emblems appear on selectors and signs. These are generated illustrations, not celebrity assets or native screenshots.

Density-aware controls support enlarged UI, compact crew paging, 64-logical-pixel note pads, reversible club-only view and compact result pages. Connection and pending-join feedback remain visible. Scene-local travel is requested when entering the studio and stage; if rejected, follow the signs. Reduced motion freezes decorative equalizer and celebration movement; falling notes remain essential gameplay. Physical readability, touch response, texture orientation and audio synchronization require real-device testing.

## Networking and safety

SDK MessageBus is scene/realm scoped. A visitor coordinates this casual session; no public server is run on the user's computer. Heartbeats expire after eight seconds; coordinator changes reset the lobby. Sender identity, sequence, incarnation, schema and timing checks reject stale/invalid commands. Bot IDs cannot impersonate network participants.

Midpoint ping/pong estimates clock offset. Host-arrival scoring allows 180 ms early / 350 ms late; asymmetrical delay can affect play. Notes retry at 80 ms. This peer coordinator is not cheat-proof and MessageBus is not cryptographically secret. No wagering, payments, tokens or ranked economic competition are implemented. Separate real-participant network testing remains required.

## Build and local preview

The pinned SDK7 environment is 7.27.0: `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm build:production`. No new backend is required. Use `pnpm start:local` for loopback preview only, or `pnpm start:native` for one SDK-managed client launch. Do not launch another client simultaneously. Both bind to `127.0.0.1:8347`, disable automatic browser opening and preserve normal authentication. No tunnel, firewall change or browser local-network permission is needed to build. Stop preview when finished.

This Windows workstation also crashed running standard Decentraland outside the arena with graphics error `0x887A0005`. That does not prove scene correctness; acceptance needs a working compatible device.

## Delivery gate

Verify the new World entity after publication, test on the physical Android device, test separate real participants, capture a public demo video, then publish the authorized nonduplicate X announcement with verified company mention and working links. Do not resubmit the existing BUIDL or confuse source tests with these receipts. See `../docs/AFFINITY-ARENA-V07-QUALITY.md` and `MUSIC-PROVENANCE.md`. Earlier Signal Grove and card-duel source files are preserved as historical implementations, not the active entrypoint.
