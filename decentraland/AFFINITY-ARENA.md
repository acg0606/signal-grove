# Affinity Arena

Walk to your music. Make the melody. Own the stage.

## Current status

Version 0.8 is the current source candidate: typecheck, 88 automated tests and production build pass. It has NOT been deployed or tested on the physical Android device. The public World previously accepted v0.7; see `../docs/AFFINITY-ARENA-V07-WORLD-RECEIPT.json`. DoraHacks BUIDL 48375 was observed submitted and Under Review on September 9, 2026. Submission, deployment and gameplay acceptance are separate.

## Play loop

1. Enter the neon club with a compact translucent introduction. Expand How to play when needed; every panel can be minimized.
2. Walk to a K-pop, Brazilian Funk, Latin Urban, Afrobeats, Hip-hop or Electronic studio and tap its actual instrument. This joins the crew and normally enables sound, preserving a prior mute choice.
3. A 10-second queue fills empty seats with explicitly labeled simulated performers. Four humans may begin earlier. Play three seven-second rehearsal rounds: 21 seconds total, half the previous duration.
4. Match the musical silhouettes to the white strike line using C/E/G pads or the three action keys. Correct notes produce a synthesized lead; wrong or missed notes produce a brief error sound. Percussion continues without an automatic lead melody. Local audio feedback is immediate; only confirmed network input sets scores.
5. Review rhythm, precision, harmony and consistency. Minimize the recap and walk up the catwalk. Tap a stage microphone to check in. There is no automatic teleport or automatic stage start. All humans must be ready; bots are pre-ready. A 120-second check-in timeout cancels without a winner.
6. Play five twelve-second live rounds. Each final attribute is `(studio + 2 × live) / 3`, rounded to two decimals. The total of four attributes (maximum 400) determines the winner; equal totals draw. NPC fans celebrate the computed score, not a real audience vote. Results reset after 24 seconds.

## Scoring and controls

Rhythm measures successful notes; precision measures correct hits within 120 ms; harmony measures corresponding successful notes across teammates; consistency measures the longest streak within a round. Attributes normalize to 0–100 and average across each phase. Bot skill is deterministic and independent of the human score; crews have no genre-specific statistical advantage.

The venue spans four parcels, 32×32, with six themed studios, stage, sound equipment and NPC fans. No landscape terrain is included. UI has a compact arrival dock, 420-logical-pixel maximum expanded width, translucent surfaces, authored quarter/flagged/paired note icons and 72-logical-pixel pads. Menu expands sound, text size, reduced motion, help and session exit. Minimized gameplay keeps running; round boundaries do not reopen it. Phase changes can show a new rehearsal, attribute or result panel. Physical readability and collision reachability require native testing.

## Networking and safety

SDK MessageBus is scoped to scene/realm. A visitor coordinates this casual session; your computer is not a public Internet server. Sender identity, sequence/incarnation and schema/timing checks reject invalid commands. Host changes reset the lobby. Real participant departures cancel without awarding a win. Stage proximity is a local UX check, not a cheat-proof location attestation.

Midpoint ping/pong estimates clock offset. Host-arrival scoring permits 180 ms early / 350 ms late; asymmetric delay can affect scoring. Notes retry at 80 ms. Local melody feedback does not establish that the coordinator accepted a note. This peer coordinator is not cheat-proof and commands are not cryptographically secret. No wagering, payments, tokens or ranked economic competition.

## Build and acceptance

Use the pinned SDK7 7.27.0 environment: `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm build:production`. No new backend is required. Preview commands retain loopback-only binding at 127.0.0.1:8347; no tunnel, firewall change or authentication bypass.

See `../docs/AFFINITY-ARENA-V08-QUALITY.md`, `DESIGN.md` and `MUSIC-PROVENANCE.md`. Native Android/desktop rendering, audible response, physical touch hitboxes and separate real-participant sessions remain HOLD. Publish with a fresh World receipt before testing this candidate, then create the public demo and nonduplicate X announcement. Do not resubmit the existing BUIDL. Historical Signal Grove and card-duel implementations remain in source, not the active entrypoint.
