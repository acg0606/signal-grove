# Affinity Arena — runtime diagnosis, September 9, 2026

Status: SOURCE_VERIFIED / NATIVE_GAMEPLAY_HOLD. This report is not gameplay acceptance.

## Observations

- Creator Hub 0.47.0 built the scene but failed its `reg query HKEY_CLASSES_ROOT\decentraland /ve` installation check. A separate read-only check found the registered Decentraland protocol and its existing launcher executable. No reinstall or registry change was made.
- Hub briefly bound its preview to `0.0.0.0:8000` and then stopped it. That was not the safe wrapper configuration; no port 8000 listener remained afterward.
- A single SDK-managed native launch with `HTTP_SERVER_HOST=127.0.0.1`, port 8347, `--explorer-alpha`, `--no-browser`, no authentication bypass and no landscape flag started successfully. The local preview reported healthy. The existing player session was recognized.
- The native game remained unresponsive during scene loading around 09:49 UTC, despite roughly 2.87 GiB free RAM before launch. Only that confirmed unresponsive game was terminated. Neither the loading screen nor a healthy preview endpoint proves gameplay success.
- A separate normal Decentraland launch, without this preview, also failed. Its process exited by itself; the native log at 09:52:06 UTC repeatedly reported `d3d11: failed to create buffer ... [0x887A0005]`, followed by crash telemetry flushing.
- The log identifies Intel UHD 620, Direct3D 11, driver 31.0.101.2135 and Unity 6000.5.9f1. Microsoft's DXGI reference identifies `0x887A0005` as `DXGI_ERROR_DEVICE_REMOVED`. This error does not establish a single hardware or driver root cause.
- The unused SDK preview was stopped. Readback found no preview listener on 8347; the shared HACKOPS loopback service on 4173 remained running. No firewall change, public tunnel, driver update, wallet operation or shared-service restart was performed.

## Interpretation and next gate

Failure also occurs outside Affinity Arena. The workstation is therefore not currently a reliable native acceptance environment. Intel UHD 620 is below the dedicated GPU families listed in the current official Windows minimum requirements. This supports testing on compatible hardware, not declaring all scene bugs solved.

The reproducible launcher now defaults to server-only mode; `--native` explicitly selects the SDK's single-client path. It rejects unknown flags, forces loopback even when inherited environment variables request a LAN binding, and does not bypass authentication. Three additional unit tests cover these properties. Run a production build before launching because preview deliberately uses `--skip-build`.

Required acceptance remains: actual controls and audible timing; supported mobile layout; four distinct participants completing rehearsal, duel and results; then v0.6 World publication/readback and public demonstration media. Existing v0.5 World publication and DoraHacks Under Review status are separate facts, not gameplay acceptance. No fake participants or simulated test result may substitute for this gate.

## Primary references checked September 9, 2026

- [Decentraland settings and performance](https://docs.decentraland.org/in-world/settings-and-performance): Windows minimum hardware and performance guidance.
- [Microsoft DXGI errors](https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/dxgi-error): meaning of the graphics error code.
