# AMO Listing Draft — VideoDefaults

## Extension Name

VideoDefaults

## Summary (max 250 chars)

Applies your preferred video playback speed to YouTube automatically. Respects manual changes. No accounts, no data collection, no ads — just your settings, stored locally.

## Description

VideoDefaults remembers how you like to watch videos.

The extension applies a configurable default playback speed to every new YouTube video you open, so you never have to change it manually again. The default is 2×, but you can set any value between 0.25× and 4×.

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
