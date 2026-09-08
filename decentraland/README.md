# Affinity Arena — Decentraland scene

On this development branch, `src/index.ts` runs Affinity Arena. Read [AFFINITY-ARENA.md](AFFINITY-ARENA.md) for current mechanics, setup and limitations. The older Signal Grove scene remains in `src/scene.tsx`. The following sections document that earlier concept, not the active arena. Public source is not a public World or a submission receipt.

## Earlier Signal Grove description

Native SDK 7.27.0 scene, added September 6, 2026. The older web mechanic prototype in the parent directory is a separate, scripted replay.

Real visitors choose Listen, Invite or Build using three large screen buttons or world pedestals. One visitor remains in **Waiting for friend**. Two matching choices form an **Echo loop**; two complementary choices create a **Shared rhythm**; all three roles produce **Full spectrum**. The central bloom and visitor counts update across participants in the same scene and realm. This is a small, continuous social space that needs no host or scheduled event.

## Run and build

Use Node.js 22 or later and pnpm 11 (tested with 11.19.0).

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build:production
pnpm start:local
```

`start` and `start:local` serve the built scene only on `127.0.0.1:8347`. The wrapper disables CLI analytics, automatic browser/client launch, implicit installs and file watching. Build explicitly before starting and after source edits; stop the server when not in use. Configure the official desktop client to preview that local realm and parcel `0,0`. Physical phones cannot reach this loopback-only server: they require a separately approved test setup. No public tunnel or browser local-network permission is enabled by these scripts.

The allowlist in `pnpm-workspace.yaml` permits the registry packages esbuild/protobufjs to prepare their runtime. SDK commands' optional context-file postinstall is disabled; it is not required to build this scene. Builds do not install dependencies implicitly.

## What is implemented

- One parcel, primitive geometry, no downloaded art/audio, asset credentials or third-party runtime API.
- Three 58 px role buttons with dark text, explicit Selected/Pending labels, matching world pedestals and contextual cooperative guidance. Physical touch QA remains pending.
- Decentraland MessageBus transport with SDK player IDs; each remote payload must match its transport sender.
- Monotonic revision rejection, 3-second heartbeats, 30-second presence expiry and a 32-participant memory bound.
- Local state from real connected clients only. No scripted companions, simulated attendance, persistence service, payments or wallet actions.

The transport synchronizes participation within a realm. It is not an anti-cheat or economic authorization system. The SDK marks MessageBus deprecated, but the pinned 7.27.0 package and current serverless multiplayer documentation still provide it; a future SDK upgrade must revalidate the transport.

## Evidence and limits

`pnpm check`, all 19 automated tests and the official production build passed on 2026-09-07. Coverage includes nine room/identity tests, eight HUD presentation/contrast tests and two authentication-proxy safety regressions. These tests do not establish a successful login, rendered UI or live transport delivery. The retained SDK patch restores normal TLS verification and filters decompressed response framing; it does not modify authentication assets or sign a deployment.

These automated two-reducer convergence tests are not evidence of two real Decentraland clients communicating. A public World, actual desktop/mobile runtime test, measured in-client performance, multiplayer video and DoraHacks submission receipt remain pending. No World name, wallet owner, deployment transaction, personal eligibility or submission success is assumed.

## Final verification before submission

1. Open this scene in Creator Hub and preview on desktop and a physical mobile device. Confirm the scene fits the parcel, controls are reachable and there are no SDK errors.
2. Have two distinct Decentraland accounts join the same scene and realm. Choose Listen on both: both clients should show Echo loop. Change one to Invite: both should show Shared rhythm. Add a third real visitor choosing Build: both/three show Full spectrum.
3. Disconnect a client and wait at least 30 seconds: that participant and its role disappear. Reconnect and choose again. Record this real interaction; do not substitute the older scripted HTML demo.
4. Use an existing authorized Decentraland World/name and owner account in the official publication flow. Capture the public URL and verify it on mobile. Do not replace an existing world without checking its contents.
5. Complete the event's actual account/team/eligibility fields and final submission with the native source and real World/video links. Verify the portal receipt.

## Official event evidence

The organizer extended the Friendzone deadline to **September 11, 2026** in [announcement 12](https://forum.decentraland.org/t/friendzone-buildathon-news-updates-announcements/25353/12). The exact cutoff time and time zone were not stated there. [The September 5 update](https://forum.decentraland.org/t/friendzone-buildathon-news-updates-announcements/25353/14) says judging includes Decentraland Mobile. The thread describes a mobile-first, cooperative, standalone experience; this implementation targets those requirements. Eligibility and complete portal terms still need the official submission-page readback.

SDK references: [scene files](https://docs.decentraland.org/creator/scenes-sdk7/kinds-of-projects/scene-files), [serverless multiplayer](https://docs.decentraland.org/creator/scenes-sdk7/networking/serverless-multiplayer), [UI button events](https://docs.decentraland.org/creator/scenes-sdk7/2d-ui/ui_button_events).

## License

The new code in this directory is MIT licensed; see LICENSE. Decentraland SDK dependencies retain their own licenses. No external visual assets are included.
