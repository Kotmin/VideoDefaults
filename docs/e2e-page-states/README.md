# YouTube Page State Snapshots

Captured via `scripts/capture-yt-states.mjs` — Firefox with the VideoDefaults extension loaded, raw RDP evaluation.

## States

| File prefix | Description | Time after nav |
|---|---|---|
| `00-initial` | Page immediately after navigation | ~1s |
| `01-after-5s` | Full page loaded, video ready | ~5s |
| `02-after-consent-attempt` | After consent button query | ~8s |
| `03-watch-video-loaded` | After `readyState >= 1` poll | ~13s |
| `04-home` | YouTube home page | — |

## Key findings (from meta.json analysis)

### Video element selectors

- Main player video: `video.html5-main-video` (class confirmed across all watch states)
- Ancestor: `#movie_player` (use `v.closest('[id]')?.id === 'movie_player'` to confirm main player)
- Ad detection: `#movie_player.ad-showing video` (ad-showing class on player, not on video itself)

### `defaultPlaybackRate` issue

Both `playbackRate` and `defaultPlaybackRate` are `1` at all captured states.
When YouTube's HLS adapter changes the media source or calls `video.load()`, the browser resets
`playbackRate` to `defaultPlaybackRate`. The extension must set **both** properties.

Fix: `html5-video-player-adapter.js` `setSpeed()` now sets `defaultPlaybackRate = speed` before `playbackRate = speed`.

### No consent wall in this profile

The `consent_btns` array across watch states contains only player controls (Pause/Mute/Settings).
No GDPR/cookie consent banner was displayed. The `dismissConsent()` function in the E2E test
is therefore a no-op and was **removed** — it left stale boolean results in the RDP inbox
that poisoned subsequent `evaluate()` calls.

### Actor staleness

YouTube replaces the top-level `windowGlobal` (and thus the `consoleActor`) during player
initialization, roughly 7-10s after navigation. The `refreshActor()` helper picks up any pending
`target-available-form` events to stay on the live actor.

### Ads counter noise

The `ads` field in meta.jsons (24/89/93 on watch, 43 on home) counts all elements matching
`.ad-showing,.ytp-ad-player-overlay,[id*="ad"]`. The `[id*="ad"]` part matches many unrelated
elements. Real ad detection should use `.ad-showing` on `#movie_player` only.

## State machine for E2E assertions

```
navigate(url)
  → flush stale targets
  → get fresh consoleActor from target-available-form
  → sleep(5s) — let player initialize
  → refreshActor() — pick up any windowGlobal replacement
  → waitForVideo('video.html5-main-video') — poll readyState >= 1
  → refreshActor() — in case replacement happened during poll
  → sleep(3s)
  → refreshActor() — final refresh before assertion
  → getRate('video.html5-main-video') — assert playbackRate === 2.0
```
