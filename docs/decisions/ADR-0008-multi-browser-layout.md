# ADR-0008: Multi-browser layout — shared source, per-edition manifests

Date: 2026-07-17
Status: accepted

## Context

VideoDefaults started Firefox-first (ADR-0001). Chrome and Edge editions are now
required in the same repo. The extension code is already split into browser-free
core (`src/`) and UI entry points (`apps/firefox-extension/src`), synced by
script into the loadable extension dir.

## Decision

- Move UI entry points and icons to `apps/shared/`; each edition dir
  (`apps/firefox-extension`, `apps/chrome-extension`, `apps/edge-extension`)
  checks in only its `manifest.json` and `README.md`.
- `scripts/sync-extension-lib.sh` materializes `lib/`, `src/`, `assets/` into
  every edition dir (gitignored) so each dir is directly loadable by its browser.
- Shared entry points alias the API namespace once
  (`globalThis.browser ?? globalThis.chrome`) instead of shipping
  webextension-polyfill (keeps ADR-0002's zero runtime dependencies).
- Edge gets its own dir even while byte-identical to Chrome, so future
  Edge-specific manifest fields never fork shared code.

## Consequences

- One change in `apps/shared` or `src/` lands in all three editions on next sync.
- Manifest fields must be maintained in three files; `check.sh` enforces version
  parity across them.
- Packaging is parametrized (`package-extension.sh <edition>`); CI builds all
  three zips, AMO signing remains Firefox-only.
