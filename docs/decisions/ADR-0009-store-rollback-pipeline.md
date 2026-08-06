# ADR-0009: Manual Store Rollback via Release Workflow Dispatch

Status: Accepted
Date: 2026-08-06

## Context

`release-chrome.yml` and `release-firefox.yml` auto-publish on every push to `main`. If a bad release reaches the Chrome Web Store or AMO, there was no pipeline to recover — only a manual re-package-and-resubmit process. Neither store supports a true rollback: both reject a new upload whose `manifest.json` version is not strictly higher than the currently published version, so "rollback" always means *publish old code under a new version number*, not restore an old artifact.

## Decision

Add an optional `rollback_ref` input to `workflow_dispatch` on `release-chrome.yml` and `release-firefox.yml`. When set to a previous release tag (e.g. `chrome-v1.4.2`, `v1.4.2`), the workflow:

1. Restores the working tree from that tag (`.github/` excluded).
2. Bumps `manifest.json`'s patch version above the highest existing release tag for that store.
3. Runs the same check → test → package → publish steps used for a normal release.

The dispatch is restricted to `github.actor == 'Kotmin'`.

## Rationale

- Reusing the existing, already-hardened release workflows (secret scanning, `check.sh`, `test.sh`, packaging, store publish, GitHub release) is a smaller and safer diff than a fourth near-duplicate pipeline.
- Version numbers are derived from existing `chrome-v*` / `v*` git tags (created only on successful publish), so no new state or store API lookup is needed.
- `main`'s linear history ([[ADR-0004-two-branch-linear-history]]) stays untouched — rollback ships forward as a new version, it does not rewrite or revert `main`.
- Restricting the actor keeps a store-publishing action gated to the repo owner, matching the sensitivity of the credentials involved.
- Edge is excluded: its release pipeline is paused pending store credentials (see `release-edge.yml`).

## Consequences

- A "rollback" always produces a new version number containing old code; it is not a true revert and does not remove the bad version from store history.
- Firefox rollback ships quickly (AMO auto-signs on submit). Chrome rollback is still subject to CWS review latency — this pipeline shortens time-to-ship, not time-to-live.
- Usage is documented in `docs/release/rollback-runbook.md`.
- If `edge-*` release automation is un-paused, the same `rollback_ref` pattern should be added to `release-edge.yml`.
