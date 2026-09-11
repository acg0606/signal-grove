# Affinity Arena — Studio Life

Find your music crew. Rehearse together. Own the stage.

The current published game source is in [festival/](festival/). Earlier files outside that directory are preserved historical prototypes, not the current release.

## Play

Open Decentraland Mobile and enter the World **mitthie.dcl.eth**. The current scene is **Affinity Arena - Studio Life Preview**. Walk from the street entrance to a themed studio and tap its panel to join a music crew.

Six identities share fair gameplay rules: K-pop, Brazilian Funk, Latin Urban, Afrobeats, Hip-hop and Electronic. The festival repeats a 30-second crew selection, 30-second rehearsal and a 30-second live final for the two qualifying crews, with transitions and results between rounds. Rehearsal develops rhythm, precision, harmony and consistency; live performance has double weight. Spectators can watch and queue for the next round. World-space note scores, touch pads, front-facing stage monitors, audience reactions and themed cabins make the venue part of the interaction.

Server-side authority validates participation and scores. Standings and memory records are implemented; real hosted persistence acceptance remains pending. Clearly labeled simulated exhibitions are not human victories. Decorative residents are not real participants. There are no wagers, payments or token rewards in the game.

Original synthesized exercises and sound effects are used, not commercial recordings or artist voices. The game and public materials are in English. Created by Andre Gomes with AI-assisted development. Source is MIT licensed; see [LICENSE](LICENSE).

## Build and inspect

In `festival/`, install the pinned dependencies with `pnpm install --frozen-lockfile`, then run `pnpm check`, `pnpm test` and `pnpm build`. The lockfile pins Decentraland SDK and build dependencies. Node.js 24.19.0 is the build environment used for this release. Asset generator scripts are included. Do not use the older root package to build this version.

The publication copy deliberately omits the owner's Creator Hub project identifier and borrowed World deployment target. Configure your own authorized World before publishing a fork. Running a local build is not a deployment.

## Evidence and limitations

The September 11 world-sign release was published with Creator Hub conversion complete and all 59 public content hashes matched. The active entity and bundle checksum are recorded in [festival/PUBLIC-RELEASE.json](festival/PUBLIC-RELEASE.json). The deployed bundle is 674,584 bytes with SHA-256 `704a38bc6e66f55471d0b74ba781280cdfcab83cd467392b5011c54137ae5af2`.

89 automated tests, type checking and production build passed. These are not a substitute for real multiplayer or physical-device testing. The creator has played preceding versions on a Samsung Android phone and provided iterative UI feedback. Final visual acceptance of this latest lettering update, real multiplayer acceptance, hosted persistence acceptance, and a public demonstration video remain pending. No completed acceptance, prize eligibility or award is claimed.

The existing [DoraHacks submission](https://dorahacks.io/buidl/48375) was rechecked on September 11 as **Under Review**, track **Friendzone**. Do not submit a duplicate. After the official submission deadline, freeze the judged project until judging ends and keep the World publicly accessible.
