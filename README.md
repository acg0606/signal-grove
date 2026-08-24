# Signal Grove

Signal Grove is a mobile-first cooperative social mechanic created for the Decentraland Friendzone Mobile Buildathon. A player reads two scripted companions' intentions and chooses one complementary role: listen, invite, or build. Four deterministic rounds make group care and echo-loop risk playable and auditable.

## Current truth

- `FACT`: this public repository contains the tested open-source web mechanic and deterministic replay core.
- `DEMO_REPLAY`: companions, rounds, receipts, and outcomes are synthetic local demonstrations.
- `LIVE=false`: there is no public Decentraland World, Godot runtime, multiplayer session, persistent world state, wallet, token, or chain connection in this version.
- `UNKNOWN`: the final platform adapter, public World URL, mobile persistence receipts, final video, and DoraHacks submission do not exist yet.

This release satisfies the source-review and setup portion of the project. It does not claim that the platform-native judged path is complete.

## Run locally

Node.js 20 or newer is sufficient; the project has no runtime dependencies.

```powershell
node .\scripts\serve.mjs
```

Open <http://127.0.0.1:4327/>. The development server refuses non-loopback binding.

## Test

```powershell
npm test
```

The tests cover the deterministic social loop, receipt reconstruction, replay integrity, loopback-only serving, security headers, rejected mutations, and path traversal failures.

## Architecture

The browser proposes a role action, while `core.mjs` owns deterministic state transitions and the canonical replay receipt. `app.mjs` is a DOM adapter only. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SECURITY-PRIVACY.md](docs/SECURITY-PRIVACY.md).

## Planned official path

The next release must port the same role-and-receipt contract into the official Decentraland World workflow, then prove public deployment, mobile performance, persistence, and truthful participant provenance. The local replay remains a secondary fallback and review tool.

## License

MIT. See [LICENSE](LICENSE).
