# Permission Rationale — VideoDefaults

Required by FR-007. Every permission must be documented before AMO submission.

## Current Permissions (v0.0.1)

### `storage`

**Why needed:** The extension stores the user's default playback speed in `browser.storage.local` under the key `videodefaults_settings`. Without this permission the setting cannot persist across browser sessions.

**Scope:** Local device only. No sync storage is used in MVP (`storage.sync` is a post-MVP consideration after explicit architecture decision).

**Data stored:** A single JSON object with schema version, default speed (number), scope, and feature flags. No URLs, no history, no personal identifiers.

### `https://www.youtube.com/*`

**Why needed:** The content script must run on YouTube watch pages to detect the `<video>` element and set `video.playbackRate`. Without host permission the browser will not inject the content script.

**Scope:** Narrowly scoped to `https://www.youtube.com/*`. Does not cover `http://`, subdomains other than `www`, or any non-YouTube origin.

**Alternative considered:** `activeTab` would grant access only when the user clicks the extension icon, which is insufficient — the speed must be applied automatically when the page loads, not on user interaction.

## Permissions Intentionally Not Requested

| Permission | Reason not included |
|------------|---------------------|
| `<all_urls>` | Not needed — YouTube-only in MVP |
| `tabs` | Not requested; popup queries the active tab via messaging instead (future: re-evaluate if `tabs.query` is needed) |
| `activeTab` | Insufficient — content script must run at page load, not on user click |
| `scripting` | Not needed for MVP; content script declared in manifest |
| `webRequest` | Not needed; extension does not intercept network traffic |
| `cookies` | Not needed; extension does not read or write cookies |
| `history` | Not needed; extension does not access browsing history |

## Adding a New Permission

Any new permission requires:

1. An Architecture Decision Record in `docs/decisions/`.
2. An update to this file explaining the data accessed and why.
3. An update to `docs/release/amo-listing.md` (permissions table).
4. An update to `docs/compliance/privacy.md` if new data is collected or transmitted.
