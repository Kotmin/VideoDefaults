# AMO Listing Draft — VideoDefaults

## Extension Name

VideoDefaults

## Summary (max 250 chars)

Sets your preferred YouTube playback speed automatically, on every video. Respects manual changes. No accounts, no data collection, no ads — just your setting, stored locally.

## Description

Tired of resetting your playback speed on every single YouTube video? VideoDefaults fixes that.

It applies a configurable default playback speed to every new YouTube video you open, so you never have to change it manually again. Only speeds YouTube's own player actually supports are offered — anywhere from 0.25× to 4× — so there's nothing to configure that wouldn't already work by hand.

**Features:**
- Sets your preferred playback speed automatically on YouTube watch pages
- Detects YouTube single-page navigation — works without full page reloads
- Respects manual changes: if you adjust speed during a video, VideoDefaults stops interfering for that video
- Popup with one-click preset buttons (1×, 1.5×, 2×) and a custom speed input
- Shows the current detected playback speed and override status
- All settings stored locally — nothing leaves your browser

**Privacy:**
VideoDefaults stores only your playback speed preference in your browser's local extension storage. It does not collect, transmit, or share any data. It makes no network requests.

**Permissions:**
- `storage` — saves your default speed setting locally
- Access to `youtube.com` — applies the speed to YouTube videos

## Category

Productivity

## Tags

youtube, video, playback speed, productivity, accessibility

## Permissions Explanation (for AMO reviewer)

| Permission | Reason |
|------------|--------|
| `storage` | Stores the user's configured default playback speed locally in the browser. No data leaves the device. |
| `https://www.youtube.com/*` | Required to inject the content script that detects and sets `video.playbackRate` on YouTube watch pages. |

No other permissions are requested. The extension does not use `tabs`, `activeTab`, `scripting`, or broad `<all_urls>`.

## Screenshots Needed (before submission)

1. YouTube watch page with extension active — speed applied at 2×
2. Popup showing current speed and preset buttons
3. Popup showing manual override state

## Support Contact

GitHub Issues: https://github.com/Kotmin/VideoDefaults/issues

## Legal

Terms of Use: `docs/compliance/terms-of-use.md`
Privacy Policy: `docs/compliance/privacy.md`

## Notes to Reviewer (paste into AMO submission)

No account or login is required to test this extension — it works entirely on public YouTube watch pages with no sign-in.

**Version notes:** see `CHANGELOG.md` for the version being submitted; paste that release's entries here.

**How to test:**
1. Install the extension and open any `youtube.com/watch` video.
2. Confirm the configured default speed (2× by default) is applied automatically.
3. Open the toolbar popup — confirm it shows the current speed and preset buttons (1×, 1.5×, 2×) work.
4. Manually change speed via YouTube's own controls — confirm the extension stops overriding for that video (manual override), and resumes defaults on the next video.

Full manual test matrix: `docs/release/firefox-manual-test-checklist.md`.
