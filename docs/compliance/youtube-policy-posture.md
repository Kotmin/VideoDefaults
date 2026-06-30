# YouTube Policy Posture — VideoDefaults

This document maps VideoDefaults MVP behaviour against YouTube API Services Developer Policies and general Terms of Service to confirm the extension does not violate them.

## What VideoDefaults Does

1. Reads `video.playbackRate` (a standard HTML5 property) on `<video>` elements.
2. Writes `video.playbackRate` to set the user's preferred speed.
3. Listens for `ratechange` events on the video element to detect manual user changes.
4. Listens for `yt-navigate-finish` events on `document` to detect SPA navigation.
5. Stores one user preference (a speed value) in local extension storage.
6. Provides a popup UI for the user to change their preference.

## What VideoDefaults Does NOT Do

| Prohibited behaviour | Status |
|---------------------|--------|
| Use YouTube Data API or YouTube API Services | ✗ Not used |
| Block, skip, or modify ads | ✗ Not done |
| Download video or audio | ✗ Not done |
| Inject overlays onto the YouTube player surface | ✗ Not done |
| Automate clicks on YouTube UI controls | ✗ Not done |
| Accept cookie/consent dialogs automatically | ✗ Not done |
| Initiate or force video autoplay | ✗ Not done |
| Collect or transmit user data | ✗ Not done |
| Interfere with YouTube's own controls or metrics | ✗ Not done |
| Manipulate YouTube's recommendation, search, or advertising systems | ✗ Not done |

## API Usage

VideoDefaults uses only the standard HTML5 `HTMLMediaElement` interface (`playbackRate`, `readyState`, `ratechange` event) and the non-proprietary YouTube SPA navigation event (`yt-navigate-finish`). Neither requires a YouTube API key or consent under YouTube API Services policies.

## Risk Assessment

**Risk level: Low.**

The extension modifies only `video.playbackRate`, which is a user-initiated, user-visible, client-side-only property. This is equivalent to what YouTube's own native speed controls do. There is no API key, no data exfiltration, no ad interference, and no UI manipulation.

## Ongoing Monitoring

The compatibility watcher (`tools/compatibility-watch/compatibility_watch.py`) includes keyword detection for AMO review rejections and YouTube-related regression reports. Any future extension of behaviour that touches YouTube's player UI more deeply must be reviewed against this document before implementation.
