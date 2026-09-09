# Affinity Arena v0.6 — experience refinement

Status: LOCAL_CANDIDATE / SOURCE_VERIFIED / NATIVE_ACCEPTANCE_PENDING.
Prepared September 9, 2026 UTC (September 8 in Brasilia). All player-facing copy is English.

## Delivered in the candidate

- Six equal-rule musical crews, including K-pop, remain the foundation. The cooperative rehearsal still determines resources for the team-versus-team musical duel.
- A solo seven-second warm-up teaches C/E/G timing while waiting. Replay and Next groove cover the six original 80–130 BPM grooves. Practice never creates fake teammates, sends multiplayer commands or awards match resources.
- Crew controls distinguish joined, ready, full and next-match states; the lobby describes the actual players still needed.
- Phase cues and progress follow authoritative deadlines: prepare, rehearse, choose a card, lock, play notes, reveal and return. No decorative screen transition delays input or changes the match clock.
- Both crews have visible HP meters, energy and shield. Individually unaffordable cards are disabled; the shared-budget warning remains because simultaneous teammate spending can still exceed the pool.
- Larger notes and note fields, a bottom-right desk, compact layouts, a three-step guide and a reversible stage-only view improve legibility and discovery.
- Sound remains opt-in. Original synthesized grooves are reused; no commercial recordings, lyrics, artist imagery or downloaded samples were added.
- Reduce motion disables the nonessential 800 ms stage swell. Essential falling-note motion remains. No accessibility certification or measured audio calibration is claimed.
- Opaque, unlit stage geometry and change-gated SDK component updates reduce unnecessary work. Idle production-controller tests show no repeated mutable stage writes across 600 ticks. This is not an FPS benchmark or proof that the prior client hang is fixed.

## Research and decisions

| Primary source | Applied decision | Boundary |
| --- | --- | --- |
| [Decentraland performance optimization](https://docs.decentraland.org/creator/scenes-sdk7/optimizing/performance-optimization) | Prefer event/change-driven component writes and opaque simple geometry | Actual GPU, FPS and memory improvement require native measurement |
| [Decentraland game design](https://docs.decentraland.org/creator/scenes-sdk7/designing-the-experience/design-games) | Respect platform overlays and reported interactable area; move the desk away from the observed top-right local tools | Physical phone and overlay tests remain pending |
| [W3C animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) | Provide a reduction control for nonessential stage animation | Does not disable essential rhythm cues or prove WCAG conformance |
| [Epic Festival tune-up guidance](https://www.epicgames.com/help/c-202300000001635/c-Trending_0/how-to-access-the-tune-up-settings-of-fortnite-festival-a202300000015798) | Treat audio/video/input alignment as device-dependent acceptance work; add familiarity practice | No measured latency calibration has been implemented |

The HACKOPS reference library was verified and Google DESIGN.md was selected for the scoped game design documentation (receipt `2773ef85d270080516713edf033cefb4178647d2cc6b4a29a85619fb6c329a98`). Impeccable polish/animation/optimization guidance informed selective changes. The existing Signal Grove design system and HACKOPS interface were not redesigned. The optional Impeccable tool update was not installed. A bounded detector pass returned no findings; its unrelated inherited root build-phase notice is not evidence of native visual approval.

## Verification

- TypeScript `--noEmit`: PASS.
- Automated suite: 64 tests, 64 PASS, zero failures (September 9 refresh includes three safe-preview launcher tests).
- Production SDK build: PASS.
- Candidate `bin/index.js` SHA-256: `0826E7E36C49A9B11F7A9E6BAD8798E83A8C9CC3DC25023C3025D905E5792F5C`.
- New pure tests cover practice timing, no multiplayer mutation, crew availability, exact phase gates and change suppression.
- New controller integration tests execute the actual production scene through an in-memory SDK adapter: join/ready/leave, no solo match start, warm-up/replay/return, guide/motion/stage controls and idle component writes.
- Explicit-height layout checks cover lobby, warm-up, guide, rehearsal, card choice, battle notes, win, draw and cancellation at 390×844, 844×390 and 1440×900. Controlled snapshots also verify card affordability and practice shutdown on a real match phase. These are adapter checks, not native screenshots or physical-device acceptance.

## Publication boundary and remaining acceptance

Native inspection: a single-client corrected launch reached the actual v0.6 lobby. The new bottom-right desk, crew labels and Crews / Warm-up / How to play tabs were visible at 1366×768. The scene load completed at 02:04:48 UTC, but repeated process checks returned Responding=false before interaction acceptance. Approximately 1.05 GiB physical RAM was free; that observation does not prove the cause. Only the unresponsive preview game was terminated. No new login, firewall change, reinstall or shared-service restart was performed. Initial rendering is observed; clicks, audible playback, motion quality and gameplay remain HOLD.

Creator Hub now reports the previous v0.5 scene successfully published. The World entity is `bafkreid6apqqed5o3hkt5vqrgwvpj3i36hc3rg5ygsdv6s3wk5vpf2t7s4` in `mitthie.dcl.eth`. That receipt does not include v0.6. The candidate has not been uploaded or represented as live.

September 9 update: DoraHacks BUIDL 48375 is submitted and Under Review; see AFFINITY-ARENA-DORAHACKS-RECEIPT-2026-09-09.json. This completes the portal receipt gate, not the technical acceptance gate. A new bounded runtime comparison found that the standard Decentraland client also crashes outside the preview with graphics error 0x887A0005. See AFFINITY-ARENA-RUNTIME-DIAGNOSIS-2026-09-09.md. The safe SDK native launch path is now reproducible; native gameplay remains unaccepted.

Required before final delivery: native interaction/visual inspection; listening and timing on supported hardware; physical mobile inspection; four distinct real participants through rehearsal, duel and result; final thumbnail; candidate publication/readback; public demo video; and an actual nonduplicate X post with verified company tags and the demo link. No claim of being the platform's best game is supported by comparative testing.
