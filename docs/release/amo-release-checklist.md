# AMO Release Checklist

Run this checklist before every submission to addons.mozilla.org.

## Pre-release: Local Validation (VD-905)

- [ ] Switch to `dev`, confirm CI is green on the latest push.
- [ ] Run `bash scripts/install-git-hooks.sh` (creates `apps/firefox-extension/lib` symlink).
- [ ] Run `bash scripts/check.sh` — expect `syntax ok` and `manifest ok`.
- [ ] Run `bash scripts/test.sh` — expect all tests passing, 0 failures.
- [ ] Run `bash scripts/package-firefox.sh` — confirm `dist/videodefaults-<version>.zip` is created.
- [ ] Unzip and inspect contents — only `manifest.json`, `src/`, `assets/` should be present; no `lib/`, `node_modules/`, `tests/`, or dotfiles.

## Manual Firefox Load Test (full checklist in `docs/release/firefox-manual-test-checklist.md`)

- [ ] Load `dist/videodefaults-<version>.zip` as a temporary add-on in `about:debugging`.
- [ ] TC-01: Default speed applies on new YouTube video.
- [ ] TC-02: Popup shows current speed.
- [ ] TC-03: Preset buttons change speed and save default.
- [ ] TC-04: Custom input applies valid speed.
- [ ] TC-05: Custom input rejects invalid values with error.
- [ ] TC-06: Manual override detected and shown in popup.
- [ ] TC-07: Override resets on new video context.
- [ ] TC-08: Popup explicit apply clears override.
- [ ] TC-09: No-video page shows graceful status.
- [ ] TC-10: SPA navigation triggers new context.
- [ ] TC-11: Settings persist across Firefox restart.
- [ ] TC-12: No network requests made by extension.
- [ ] TC-13: No auto-click on consent dialogs.
- [ ] TC-14: Zero uncaught errors in extension console.

## Compliance Review

- [ ] `docs/compliance/permissions.md` is up to date — every manifest permission documented.
- [ ] `docs/compliance/privacy.md` is accurate — no new data collected/transmitted.
- [ ] `docs/compliance/youtube-policy-posture.md` reviewed — no policy-violating behaviour added.
- [ ] `docs/release/source-package-policy.md` reviewed — source submission not required (no build step).
- [ ] `docs/release/amo-listing.md` reflects current feature set and permission table.

## Version Bump

- [ ] Update `version` in `apps/firefox-extension/manifest.json`.
- [ ] Update `CHANGELOG.md` with release notes.
- [ ] Commit: `chore(release): bump version to <version>`.
- [ ] Promote `dev` to `main` via fast-forward: `git checkout main && git merge --ff-only dev && git push origin main`.
- [ ] Tag: `git tag v<version> && git push origin v<version>`.

## AMO Submission

- [ ] Log in to https://addons.mozilla.org/developers/.
- [ ] Navigate to the extension → Upload new version.
- [ ] Upload `dist/videodefaults-<version>.zip`.
- [ ] Confirm no source package required (see `docs/release/source-package-policy.md`).
- [ ] Fill release notes for reviewer (what changed, how to test).
- [ ] Submit for review.
- [ ] Note submission timestamp and AMO review queue status in a GitHub issue labeled `release`.

## Post-submission

- [ ] Monitor AMO review queue (typically 1–7 days for listed extensions).
- [ ] If reviewer requests changes: open a `fix(amo): ...` branch, apply changes, re-submit.
- [ ] On approval: update GitHub release with AMO listing URL.
- [ ] Close the release tracking issue.
