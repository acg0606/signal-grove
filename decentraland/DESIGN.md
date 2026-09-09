---
name: Affinity Arena walk-up music club
description: Explore first, tap an instrument, rehearse, then walk onto the live stage.
colors:
  ink: "rgb(2.5% 1.8% 6.5%)"
  panel: "rgb(8% 4.5% 15%)"
  white: "rgb(98% 98% 100%)"
  muted: "rgb(79% 83% 96%)"
  kpop: "rgb(100% 46% 76%)"
  funk: "rgb(76% 100% 22%)"
  latin: "rgb(100% 65% 36%)"
  afrobeats: "rgb(32% 96% 76%)"
  hiphop: "rgb(76% 62% 100%)"
  electronic: "rgb(22% 90% 100%)"
typography:
  title: { fontSize: "20px" }
  body: { fontSize: "17px" }
  caption: { fontSize: "14px" }
spacing:
  edge: "8px"
  padding: "12px"
components:
  note-pad: { width: "32%", height: "72px" }
  note-icon: { size: "52px" }
  action: { height: "46px" }
---

# Affinity Arena 0.8 — walk-up interaction

## Overview

Experience mode. The club is the first thing a visitor sees, not a six-tile crew menu. A compact translucent introduction points toward real studio instruments. The user liked the 0.7 venue on Android but asked for less obstruction, meaningful music input and a walking intermission. This contract supersedes the 0.7 overlay design while preserving its neon venue and six crew identities.

Read `../docs/affinity-arena-design/v08-surface-brief.md`. Source checks are not native visual or audio acceptance. The user's phone feedback covers 0.7, not this new candidate.

## Colors

Preserve CONCERT_RGB. The compact dock uses midnight ink at 0.80 alpha; open panels transition from 0.80 to 0.92 alpha over 180 ms. Secondary controls use purple at 0.94 alpha. Pads use 0.75 alpha; visible notes retain opaque colored silhouettes. Legibility belongs to text and symbols; transparency is for seeing the venue, not a decorative glass effect. No blur, bloom or custom lighting is claimed.

## Typography

Native Decentraland fonts. English copy only. Main titles are 20 logical px; actions 17; feedback 15; disclosures 14. Density scaling is shared with v0.7. C/E/G and keyboard hints accompany icons instead of encoding lane identity solely in color.

## Layout

Keep the four-parcel 32×32 club and six studios. Seven instrument colliders cover six crews; both Afrobeats drums are usable. Stage microphones are at (12,27) and (20,27), with low steps leading from the audience catwalk.

Arrival shows only a dock, maximum 360 logical px wide and 134 high with introduction (100 after dismissal). Expanded controls cap at 420 wide, 444 high; compact screens cap at 330 high. Every panel has a 44 px Minimize control. Secondary sound, size, motion and help controls live behind Menu rather than occupying a permanent footer.

No crew grid remains. No automatic movement is requested. ReactEcs coordinates use the interactable safe area; layout tests cover portrait, landscape and high-density inputs, not physical-device rendering.

## Elevation & Depth

World depth remains native geometry. UI surfaces are flat and translucent. Opening a panel changes its opacity over 180 ms; reduced motion jumps to its stable state. Round changes do not reopen a minimized panel. Phase changes after deliberate participation can open the rehearsal, attribute summary, live instrument or result.

## Shapes

Original musical silhouettes replace moving rectangles: quarter note, flagged note and paired notes. `assets/images/note-symbols.svg` is the authored vector source; `note-symbols.png` is the 384×128 RGBA atlas used by the SDK. These are geometric musical symbols, not emoji or generated gameplay artwork. Existing generated crew emblems remain unchanged with their provenance.

## Components

- Walk-up instrument: pointer interaction within five scene units, with named genre and sound disclosure. Joining normally enables audio; an explicit mute preference is preserved.
- Rehearsal: 10-second crew queue, then three 7-second scored rounds (21 seconds, half the previous duration). Empty seats remain labeled bots.
- Music instrument: three transparent lanes, white strike line, 52 px falling icons, 72 px pads with 44 px symbols and note labels. Correct input plays the corresponding synthesized lead immediately; errors and expired notes play a brief dissonant cue. Only coordinator-confirmed input determines scores.
- Audio: percussion-only 7-second beds, downbeats aligned with targets; three 0.55-second C/E/G leads; 0.19-second mistake sound. There is no prerecorded lead continuing through misses. Audio persists while gameplay is minimized, and mute remains available through Menu.
- Rehearsal summary: four attributes are shown before the stage. Walk to stage only minimizes the panel; it does not teleport or mark readiness.
- Stage check-in: touching a nearby stage microphone marks that participant ready. Every human must check in; bots are pre-ready. Waiting does not change training scores. After 120 seconds without all performers, cancel without awarding a winner.
- Live show: same five scored rounds and 2× weighting. The five-second first-note lead-in gives players time to prepare. Highest summed attributes wins; NPC fans visualize the result, not real audience votes.
- Results: all four final attributes remain available, one crew at a time. Other crew switches the recap; Minimize exposes the venue.

## Do's and Don'ts

Do let walking and named instruments lead the flow. Do keep every menu reversible. Do distinguish immediate local audio feedback from confirmed network scoring. Do preserve muted, delayed, disconnected, cancelled and bot states. Do keep native phone/audio QA as HOLD until tested.

Do not restore an initial full-height selector. Do not auto-teleport a performer or silently start the live show while people are still walking. Do not play the lead for a missed note. Do not claim current Android acceptance or publication from automated tests.
