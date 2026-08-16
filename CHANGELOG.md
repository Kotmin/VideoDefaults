# Changelog

All notable changes to this project will be documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## [Unreleased]

### Fixed
- Queue overlay ("Add to queue") stopped working everywhere: YouTube moved `role="menuitem"` off the popup item wrapper onto its inner button/link, so the item was never found after the trigger opened the menu.
- Playlist picker (`Ctrl+A, Shift+P`) no-op'd on the Shorts standalone player; it now also checks the Shorts header "..." menu for the Save-to-playlist trigger (best-effort, not yet live-confirmed — see `docs/ai/questions-for-K.md`).

## [0.3.0] - 2026-08-10

### Added
- Playlist picker: `Ctrl+A, Shift+P` opens a fuzzy-search overlay to add the current watch-page video to one or more playlists, or create a new one, without leaving the keyboard. Gated to logged-in users; catalog is cached across tabs. Pre-checks playlists the video already belongs to and supports removing it from them in the same session. Toggle/check/uncheck keys and arrow-driven scroll-follow are configurable.
- Unit coverage for the playlist orchestration logic (`src/ui/playlist-controller.js`), extracted from `content.js`'s previously untested closure so the open/close sequencing, idempotent toggling, and create-then-add flow are verified by `node --test` instead of only by live-site manual testing.

### Fixed
- Native "Save to playlist" sheet is hidden while driven, verified closed (falling back to a trigger re-click), and restored on close, instead of flashing visibly through each scripted step.
- Create-new-playlist sub-dialog now drives the real native dialog (typing, submit, Cancel-button close) instead of a phantom field, and no longer performs a redundant close after a successful create.

## [0.2.0] - 2026-08-06

### Added
- Queue overlay: `Ctrl+A p` labels every video with an "Add to queue" option (feed, channel, playlist, Up next sidebar, Shorts, and search-result cards) and adds the selected one to the queue via the labeled shortcut, with a confirmation badge.
- Edge Add-ons publish pipeline (manual-only bootstrap zip plus CI publish workflow), currently paused pending Partner Center credentials.
- Manual rollback dispatch for the Chrome and Firefox release pipelines — republish a previous known-good tag under a new version when a live release needs replacing.

### Fixed
- Queue overlay now covers Shorts and legacy (`ytd-video-renderer`) search-result cards, which previously had no "Add to queue" trigger at all or silently failed to render one.
- A popup render/activation race that could re-click a stale, recycled menu item on a fast repeat "add to queue", double-adding the previous video instead of the new one.

## [0.1.1] - 2026-08-03

### Added
- Declarative shortcuts config with `Ctrl+A` prefix chords `ca-1`..`ca-5` for jumping straight to preset playback speeds, plus an auto-apply chord.

### Changed
- Speed chords rebound to `v`/`b`/`n`/`h`; stored per-site overrides now merge with the new shortcut set instead of being replaced.

## [0.1.0] - 2026-07-29

### Added
- Chrome and Edge extension editions alongside Firefox (source of truth), sharing source via `apps/shared` (ADR-0008).
- Tmux-style prefix-key navigation: `Ctrl+A` chord prefix with a configurable keymap, a jump-label overlay for clicking visible links/buttons by two-char label, and a go-home shortcut.
- Compatibility watcher tool and scheduled CI workflow that classifies open issues by severity and flags active breakage.

### Changed
- CI now pins third-party GitHub Actions to commit SHAs and scans every branch for secrets, not just `main`.
- Release pipeline packages all three editions (Firefox, Chrome, Edge) instead of Firefox only.

## [0.0.3] - 2026-07-07

### Fixed
- Popup's "Auto-apply default speed on video load" checkbox had no effect on already-open tabs — settings were cached once at page load and never refreshed. Content script now listens for `storage.onChanged` and picks up the toggle live.
- Manual speed overrides could get silently reverted after a short delay: an internal state reset ran unconditionally right before the guard that was supposed to check it, making the guard permanently dead. Overrides now persist until a genuine new-video navigation.
- Fixed a related listener leak where repeated video re-inits could stack duplicate `ratechange` listeners on the same video element.

## [0.0.2] - 2026-07-03

### Fixed
- Declared `browser_specific_settings.gecko.data_collection_permissions` (`required: ["none"]`), required by AMO for all new submissions.
- Raised `strict_min_version` to 140.0 (gecko) and added `gecko_android.strict_min_version` 142.0, the minimum versions that support `data_collection_permissions`.
- Bumped `actions/checkout`, `actions/setup-node`, `actions/upload-artifact` to their Node24-native majors in CI, clearing the Node20 deprecation warning.
