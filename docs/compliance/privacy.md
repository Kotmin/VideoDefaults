# Privacy Policy — VideoDefaults

**Last updated:** 2026-06-30

## Summary

VideoDefaults is a browser extension that sets your preferred video playback speed on YouTube. It stores one setting locally in your browser. It collects nothing, transmits nothing, and has no analytics.

## Data Collected

VideoDefaults collects **no personal data**.

The only data stored is your configured default playback speed (a number such as `2.0`). This value is stored in your browser's local extension storage (`browser.storage.local`) and never leaves your device.

## Data Transmitted

VideoDefaults makes **no network requests**. It does not send any data — including browsing history, video titles, URLs, or playback behaviour — to any external server, service, or third party.

## Permissions Used

| Permission | Data accessed | Why |
|------------|---------------|-----|
| `storage` | Your speed preference (a number) | Persist setting across browser sessions |
| `https://www.youtube.com/*` | None stored | Run content script on YouTube watch pages |

## Third Parties

VideoDefaults does not integrate with, send data to, or load code from any third party. There are no analytics SDKs, telemetry endpoints, CDN-loaded scripts, or remote configuration files.

## Local Storage

Your speed preference is stored under the key `videodefaults_settings` in `browser.storage.local`. You can clear it at any time by:

1. Removing and reinstalling the extension, or
2. Using your browser's extension storage management tools.

## Future Changes

Any future version that introduces network requests, analytics, or new data collection will update this policy and bump the extension's version with a prominent changelog entry before release.

## Contact

Questions or concerns: https://github.com/Kotmin/VideoDefaults/issues

See also `docs/compliance/terms-of-use.md` for the terms governing your use of the extension.
