# Firefox Manual Test Checklist

## Setup

1. Clone the repo and switch to the `dev` branch.
2. Run `bash scripts/install-git-hooks.sh` (creates the `lib` symlink in `apps/firefox-extension/`).
3. Open Firefox → `about:debugging` → This Firefox → Load Temporary Add-on.
4. Select `apps/firefox-extension/manifest.json`.
5. Confirm the extension badge appears in the toolbar.

## Test Cases

### TC-01: Default Speed on New Video

- [ ] Open `https://www.youtube.com/watch?v=<any-video-id>`.
- [ ] Wait for the video player to load.
- [ ] Confirm playback speed is `2.0×` (visible in YouTube player settings).

### TC-02: Popup — Current Speed Display

- [ ] With the video from TC-01 running at 2.0×, open the extension popup.
- [ ] Confirm the status line reads `Current: 2×` (no manual override indicator).

### TC-03: Preset Button — Change Speed

- [ ] In the popup, click `1.5×`.
- [ ] Confirm the active video immediately plays at `1.5×`.
- [ ] Confirm the popup status updates to `Current: 1.5×`.
- [ ] Close popup; navigate to a new YouTube watch page.
- [ ] Confirm new video starts at `1.5×` (new default was saved).

### TC-04: Custom Speed Input — Valid Value

- [ ] Open popup; type `1.75` in the custom speed input; press Enter (or click Set).
- [ ] Confirm no error message is shown.
- [ ] Confirm active video changes to `1.75×`.
- [ ] Confirm popup status updates to `Current: 1.75×`.

### TC-05: Custom Speed Input — Invalid Values

- [ ] Type `0` (below minimum); confirm error is shown; speed unchanged.
- [ ] Type `5` (above maximum); confirm error is shown; speed unchanged.
- [ ] Type `abc` (non-number); confirm error is shown; speed unchanged.
- [ ] Clear the field and press Enter; confirm graceful handling (error shown).

### TC-06: Manual Override Detection

- [ ] With the extension running, let default speed apply (e.g. 2.0×).
- [ ] Manually change playback speed in YouTube's player (e.g. to 1.0×).
- [ ] Open popup; confirm status shows `· manual override`.
- [ ] Do NOT apply any speed from the popup; navigate within the same video — override should persist.

### TC-07: Override Resets on New Video Context

- [ ] From TC-06 state (manual override active), navigate to a different YouTube watch page.
- [ ] Confirm default speed is applied again (override was cleared).
- [ ] Open popup; confirm no manual override indicator.

### TC-08: Popup Explicit Apply Clears Override

- [ ] Trigger manual override on a video (TC-06 steps).
- [ ] Open popup; click any preset button.
- [ ] Confirm speed changes to the preset.
- [ ] Confirm manual override indicator is gone.

### TC-09: No Video Page — Graceful Status

- [ ] Navigate to `https://www.youtube.com/` (home, not a watch page).
- [ ] Open popup.
- [ ] Confirm status reads `No video detected on this page` (no crash, no error in devtools).

### TC-10: SPA Navigation — New Context Detection

- [ ] Start on a YouTube watch page; confirm default speed applies.
- [ ] Click a recommended video link (YouTube SPA navigation, no full page reload).
- [ ] Confirm new video starts at the configured default speed.
- [ ] Open popup; confirm speed shows correctly for new video.

### TC-11: Settings Persist Across Restart

- [ ] Set a non-default speed (e.g. 1.5×) via the popup.
- [ ] Close and reopen Firefox.
- [ ] Reload the temporary extension (or re-install).
- [ ] Open a YouTube watch page.
- [ ] Confirm default speed is still `1.5×`.

### TC-12: No Network Requests

- [ ] Open Firefox DevTools → Network tab.
- [ ] Load a YouTube watch page with the extension active.
- [ ] Confirm no outgoing requests are initiated by the extension (filter by extension origin if needed).

### TC-13: Consent / Cookie Dialog — No Auto-Click

- [ ] If a YouTube consent/cookie dialog appears, confirm the extension does not automatically click any dialog button.
- [ ] Confirm no extension error in `about:debugging` console.

### TC-14: Extension Console — No Uncaught Errors

- [ ] Open `about:debugging` → This Firefox → Inspect (extension).
- [ ] Run through TC-01 through TC-10.
- [ ] Confirm zero uncaught errors in the extension console.

## Pass Criteria

All 14 test cases must pass with zero uncaught errors in the extension console before a release is promoted from `dev` to `main`.
