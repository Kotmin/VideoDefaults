# Changelog

All notable changes to this project will be documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## [Unreleased]

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
