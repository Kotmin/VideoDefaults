# Store Rollback Runbook

Use this when a published Chrome or Firefox release is bad and needs to be replaced with a previous, known-good version. Background and rationale: `docs/decisions/ADR-0009-store-rollback-pipeline.md`.

**There is no true rollback.** Chrome Web Store and AMO both reject a version number that isn't strictly higher than what's currently live. This pipeline republishes an old tag's code under a new, higher version number — it does not remove the bad version from store history.

## Prerequisites

- You must be the repo owner (`github.actor == 'Kotmin'`); the workflow rejects the dispatch otherwise.
- Know which tag to roll back to: `chrome-v<version>` for Chrome, `v<version>` for Firefox. List them with:
  ```bash
  git tag -l 'chrome-v*'   # Chrome
  git tag -l 'v*'          # Firefox
  ```
- Pick a tag that was actually published successfully, not just any commit.

## Run it

Chrome, via GitHub CLI:

```bash
gh workflow run release-chrome.yml -f rollback_ref=chrome-v1.4.2
```

Firefox:

```bash
gh workflow run release-firefox.yml -f rollback_ref=v1.4.2
```

Or via the UI: Actions → *Release Chrome* / *Release Firefox* → **Run workflow** → fill `rollback_ref` with the tag → **Run workflow**. Leave `rollback_ref` empty for a normal release dispatch — the field defaults to empty and changes nothing about the existing push-to-`main` behavior.

## What happens

1. The workflow checks out `main` as usual, then overwrites the working tree with the content of `rollback_ref` (workflow files under `.github/` are left alone).
2. It bumps the patch version in `manifest.json` above the highest existing `chrome-v*` / `v*` tag — e.g. if the latest published Chrome version is `1.5.0`, a rollback to `chrome-v1.4.2` ships as `1.5.1`, containing `1.4.2`'s code.
3. It runs the normal check → test → package → publish → GitHub release steps. The GitHub release notes are auto-filled with "Rollback republish of `<rollback_ref>`..." instead of a CHANGELOG excerpt.

## Verify

- Watch the run in the Actions tab; it uses the same `release-chrome` / `release-firefox` concurrency group as normal releases, so it queues behind (and blocks) any release in flight.
- Confirm the new GitHub release tag was created (`chrome-v<next>` / `v<next>`) and that its assets match what you expect from the old code.
- Chrome: check the item's status in the Chrome Web Store developer dashboard — publish still goes through CWS review, so the new version won't be live immediately.
- Firefox: AMO auto-signs on submission, so the new version should be live for users shortly after the workflow completes.
- Once confirmed, `CHANGELOG.md` on `main` does **not** get a new entry automatically — add one by hand if the rollback should be reflected in the public changelog.

## Not covered

- Edge: `release-edge.yml` is paused pending store credentials and has no `rollback_ref` input yet. Add the same pattern there once Edge releases are live (see ADR-0009 consequences).
- Rolling back `main` itself (git revert/reset): deliberately out of scope — `main` stays linear and forward-only per `docs/decisions/ADR-0004-two-branch-linear-history.md`. This pipeline ships a fix forward, it does not rewrite history.
