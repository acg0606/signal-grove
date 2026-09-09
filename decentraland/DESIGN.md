---
name: Affinity Arena native neon club
description: Six music studios, readable rhythm controls, and a score-driven stage celebration.
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
  display:
    fontSize: "26px"
  display-compact:
    fontSize: "21px"
  result:
    fontSize: "24px"
  title:
    fontSize: "20px"
  body:
    fontSize: "18px"
  feedback:
    fontSize: "16px"
  label:
    fontSize: "14px"
  instrument-key:
    fontSize: "28px"
spacing:
  panel-edge: "8px"
  panel-padding: "12px"
  tile-padding: "6px"
components:
  control-primary:
    backgroundColor: "{colors.electronic}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    height: "56px"
  control-secondary:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    height: "44px"
  control-inactive:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.muted}"
    typography: "{typography.body}"
    height: "56px"
  crew-tile:
    backgroundColor: "{colors.panel}"
    padding: "{spacing.tile-padding}"
    width: "49%"
    height: "92px"
  crew-tile-compact:
    backgroundColor: "{colors.panel}"
    padding: "{spacing.tile-padding}"
    width: "49%"
    height: "86px"
  music-panel:
    backgroundColor: "{colors.ink}"
    padding: "{spacing.panel-padding}"
  note-key-c:
    backgroundColor: "{colors.kpop}"
    textColor: "{colors.ink}"
    typography: "{typography.instrument-key}"
    width: "32%"
    height: "64px"
  note-key-e:
    backgroundColor: "{colors.funk}"
    textColor: "{colors.ink}"
    typography: "{typography.instrument-key}"
    width: "32%"
    height: "64px"
  note-key-g:
    backgroundColor: "{colors.electronic}"
    textColor: "{colors.ink}"
    typography: "{typography.instrument-key}"
    width: "32%"
    height: "64px"
---

# Design System: Affinity Arena native neon club

## Overview

**Creative North Star: "Studio to Main Stage"**

An enclosed midnight club connects six music studios with a broad performance stage. Vivid crew emblems, speaker stacks, trusses and instruments establish a music venue; opaque controls make the timing game readable. The user explicitly replaced the former forest and tiny panels with this identity on September 9, 2026.

This document describes the v0.7 native SDK implementation in `src/concert-layout.ts`, `src/concert-scene.tsx`, `src/concert-world.ts`, `src/concert.ts` and `src/rhythm.ts`, following [v07-surface-brief.md](../docs/affinity-arena-design/v07-surface-brief.md). It records source behavior, not rendered acceptance. Native desktop/mobile layout, audio and gameplay remain **HOLD**: no current native screenshot was available because the computer client crashes; the user's S24 FE test awaits publication of the candidate.

**Key Characteristics:**

- Six music identities, each with an original emblem and accent.
- Large opaque rhythm controls with a white strike line and explicit feedback.
- A timed queue, disclosed simulated musicians, and visible score arithmetic.
- A stylized NPC crowd that celebrates the computed result.

## Colors

Frontmatter percentages preserve the exact normalized sRGB channels in `CONCERT_RGB`; `color()` supplies full opacity. These are native `Color4` values expressed as portable color strings, not an application CSS theme.

### Primary

Electronic cyan carries shared actions, the arena title, phase guidance and stage trim. It also identifies the Electronic studio without granting that crew a scoring advantage.

### Secondary

K-pop pink, Brazilian Funk lime, Latin Urban coral, Afrobeats mint and Hip-hop violet identify studios, tile titles, signs and results. Lane C uses pink, E uses lime and G uses cyan regardless of selected crew; visible letters identify the lanes.

### Neutral

Midnight ink grounds the overlay and floor and supplies dark text on bright controls. Deep purple panel surfaces separate tiles and rhythm tracks. Near-white supports primary text and the strike line; pale periwinkle supports disclosures and secondary controls.

**The Named State Rule.** Color supplements crew names, lane letters, queue counts and exhibition/result labels; it never supplies those meanings alone.

## Typography

Labels and buttons use the Decentraland SDK's native default font. The scene does not load a custom family or set explicit weights, line heights or letter spacing. World signage uses `TextShape` with native defaults and an ink outline of 0.06 world-text units. Do not substitute a web font stack as shipped native typography.

Frontmatter UI sizes are logical base pixels multiplied by runtime scale. Arena titles use display/compact-display; winner headings use result; studio and phase headings use title; controls use body; feedback and disclosures use their named roles. Instructions also use 17 px, moving notes use 22 px, and instrument keys use the largest control role. World text sizes are separate SDK units, from 0.8 on supporting signs to 3.5 on the entrance name.

All product-facing copy is English. Notes read C, E, G; keys also show 1, 2, 3. Pending confirmation, wrong lanes, cancelled shows and simulated participation are stated directly.

## Layout

The world occupies a 31.8 × 31.8 floor inside a 32-unit footprint. Studios sit at x=5 and x=27 with z=6, 13 and 20. A 16 × 7 stage centers on x=16, z=27.5, with a central catwalk and two performer positions. Eighteen stylized NPC fans occupy three rows before the stage.

The overlay anchors bottom-right using the panel-edge inset. `UiCanvasInformation` supplies available dimensions and interactable-area insets; the renderer also uses the interactable screen inset. Layout clamps device density to 1–3.5 and limits scaling by width/390 and height/360. XL raises base scale by 25% within width/360 and height/354 limits. Width caps at 720 logical px after a 16 px allowance; layout height caps at 680. The visible panel is at most 610 px tall, or 338 in compact mode.

Compact mode begins below 490 logical px of available height. Normal crew selection shows three rows of two tiles. Compact selection shows one pair, with Previous / More crews cycling three pages. Rows are 98 px normally and 90 px compact. Three footer controls each use 32% width. A returned `wide` flag above 760 logical px does not currently alter the UI.

Compact results page through both totals, first crew attributes and second crew attributes. The footer's Attributes / Totals control cycles pages, and phase changes reset the page. Below 290 logical px layout width or 320 px height, a recovery panel asks the visitor to close overlays or rotate the device; Reset UI size clears XL mode.

**The Native Evidence Rule.** Logical dimensions and source review describe layout intent and implementation; only a rendered device check can establish safe-area clearance, wrapping and usable physical touch sizes.

## Elevation & Depth

Depth comes from room geometry, raised stages, overlapping speaker forms and tonal layers. Basic materials disable cast shadows; the opaque overlay has no custom shadow system. Bright structural lines establish the neon character; the source does not establish bloom, emissive lighting or a post-processing glow.

Fourteen stage bars animate during battle or scored results. NPC placards rise for a winner or draw. Reduce motion freezes bar heights and removes placard oscillation while preserving raised result signs; it retains moving rhythm notes. World visual refreshes are capped to one per 100 ms. Audio defaults off with explicit Sound on / Mute controls.

## Shapes

Boxes, spheres and textured planes form platforms, speaker cabinets and cones, straight trusses, instruments, NPCs and square crew artwork. Native controls are rectangular; no explicit rounded-corner token is set. Lane rails have 1 px scaled borders and the strike line is 4 px scaled. No custom browser hover/focus treatment is defined.

## Components

### Crew selector and studio emblems

Tiles pair artwork with genre names and `Enter studio · n/2`. Clicking the emblem or title enters an available studio. Matches support two crews of two members; unavailable choices use muted titles and `Crew full`. Joining moves the visitor toward the studio and opens unscored soundcheck. Movement failure reports that studio/stage signs remain available; native behavior still requires runtime QA.

The shipping raster [crew-atlas-v07.png](assets/images/crew-atlas-v07.png) is sampled in a 3-column × 2-row grid: K-pop, Brazilian Funk, Latin Urban / Afrobeats, Hip-hop, Electronic. Selectors, studio banners and fan signs reuse it. The [provenance receipt](../docs/affinity-arena-design/crew-atlas-v07.provenance.json) records built-in image generation, prompt and source file. These original illustrative emblems are neither artist branding nor gameplay screenshots.

### Queue and phase guidance

The first entrant starts a 20-second queue; four real participants can start sooner. Leave queue cancels lobby participation. Empty seats become labeled bots when the show starts; `BOT_EXHIBITION` remains distinct from `HUMAN_MATCH`. Bots are deterministic simulated musicians, never real attendance. Lobby soundcheck repeats original exercises while waiting.

### Rhythm instrument

Three lanes carry four notes per round toward a white strike line. Large C/E/G keys and three SDK action bindings submit notes. A note appears up to 1.7 seconds before its target. Feedback distinguishes confirmed notes, wrong lanes, mistimed input and unconfirmed actions. Spectators see phase guidance without active performance input. Timing tolerance is 180 ms early and 350 ms late: casual transport-arrival scoring, not latency-compensated competitive timing.

Six rehearsal rounds last 7 seconds each, with tempos from 80 to 130 BPM. Five live rounds last 12 seconds each; stage notes begin after a 5-second lead-in. The stage transition moves joined performers to the main stage. Sound is opt-in using local original exercise WAV clips; visual timing remains available while muted.

### Result and NPC celebration

Rhythm, precision, harmony and consistency are each normalized to 0–100. Each final attribute is `(studio + 2 × live) / 3`; the four sum to a maximum of 400. The larger total wins; equal totals draw. Expanded results show every attribute and arithmetic; compact paging preserves access to this information. The next-show timer lasts 24 seconds.

Winner placards adopt the winning crew's color and emblem and rise above the NPC fans. Draws raise mixed crew placards and the scoreboard celebrates both crews. Cancelled shows award no winner. Fan-zone and result copy explicitly identify NPCs: placards visualize scores, not votes by real visitors.

### Persistent controls and recovery

Sound on / Mute, Larger UI / Size: XL and View club occupy the footer, except when compact result paging replaces the size control. View club hides the panel and leaves Open music controls available; a new non-lobby phase restores the panel. How to play exposes instructions and Reduce motion. Reset UI size recovers from XL sizing when the instrument no longer fits.

## Do's and Don'ts

### Do:

- Do preserve the six named music identities and their shared scoring rules.
- Do keep opaque controls, lane letters and the white strike line readable against the venue.
- Do disclose bot exhibitions and NPC score celebrations wherever results are shown.
- Do preserve compact crew/score paging, XL recovery and access to the club view.
- Do keep generated-art provenance with the shipping crew atlas.
- Do retain native desktop/mobile and S24 FE acceptance as HOLD until tested in the current candidate.

### Don't:

- Don't restore the discarded forest or tiny cue desk as this scene's design identity.
- Don't claim custom fonts, DOM/CSS rendering, bloom or native visual acceptance from source tokens.
- Don't present generated emblems as artist assets or gameplay captures.
- Don't describe simulated musicians, NPC fans or score-derived placards as real players or audience voting.
- Don't infer publication, gameplay PASS or submission from a build or this documentation.
- Don't redesign HACKOPS while producing this scene.
