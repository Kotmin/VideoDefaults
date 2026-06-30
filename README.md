# VideoDefaults

Firefox WebExtension that preserves default video playback settings.

**MVP:** Applies a configurable default playback speed (default `2.0`) to YouTube videos. Provides a popup with preset buttons (`1x`, `1.5x`, `2x`) and a custom speed input. Respects manual speed changes on the current page without overriding them.

## Status

Active development on `dev` branch. Not yet published to AMO.

## Requirements

- Firefox Desktop (Manifest V3)
- No external runtime dependencies

## Development

```bash
npm install          # install dev tooling (not shipped in extension)
npm test             # run unit tests (requires scripts/test.sh — available at Milestone 5)
npm run check        # syntax check + manifest validation
```

## Repository Structure

```
apps/firefox-extension/   Firefox extension source (manifest + content/popup scripts)
src/                      Shared core logic and adapters
tests/                    Unit tests and HTML fixtures
tools/                    Dev and CI tooling (packager, compatibility watcher)
scripts/                  Shell helpers and git hooks
docs/                     ADRs, specs, compliance, and release notes
```

## Branch Model

- `dev` — active development
- `main` — release only; updated via rebase from dev

## License

MIT
