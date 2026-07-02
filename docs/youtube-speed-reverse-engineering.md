# YouTube Playback-Speed Reverse Engineering & Root-Cause Analysis

> Working doc, same convention as `docs/e2e-debug-state.md`: every claim is marked
> **CONFIRMED** (observed directly, either in a saved probe or a live Firefox/Playwright
> session against real `youtube.com`) or **THEORY** (inferred from code reading or
> external sources, not directly observed).

---

## 1. Executive Summary

Playback speed on YouTube is **pure client-side, in-memory JavaScript state**. There is
no server round-trip for speed, no cookie, and — contrary to the initial hypothesis —
no `localStorage`/`sessionStorage` persistence either, at least for a signed-out,
non-Premium session (**CONFIRMED**, §4.5). The state lives in two places that must be
kept in sync by hand: the raw `HTMLMediaElement.playbackRate`/`defaultPlaybackRate`
properties, and YouTube's own `#movie_player` custom element, which exposes the same
method shape as the documented IFrame Player API (`setPlaybackRate`, `getPlaybackRate`,
`getAvailablePlaybackRates`).

Two independent problems explain "our value was overwritten multiple times":

1. **A confirmed bug in our own code.** `content.js`'s `ratechange` handler compares
   `state.extensionToken` to itself, which is tautologically always true — manual
   override detection is dead code, and any externally-triggered rate reset gets
   silently swallowed instead of retried or flagged (§5.1).
2. **A confirmed YouTube behavior we don't handle.** Ad→content transitions reset
   `playbackRate`/`defaultPlaybackRate` back to `1`, and in the trial run this reset
   coincided with the page's JS execution context itself being torn down and replaced
   (confirmed via a Firefox `"Execution context was destroyed"` error and a vanished
   injected global), independent of any `yt-navigate-finish` DOM event. Any content
   script's in-memory state — including a fixed version of ours — would be wiped by this
   (§5.2).

---

## 2. Methodology & Limitations

`docs/probes/*.html` are **"Save Page As" snapshots** — the server-sent-rendered (SSR)
HTML shell captured before YouTube's Polymer/Kevlar app finishes hydrating. **CONFIRMED**:
none of the 7 probes contain a `<video>` element or a `#movie_player` div anywhere
(`grep -oE '<video|id="movie_player"'` → zero matches in all 7 files; only placeholder
`id="player"` / `id="player-wrap"` divs exist). YouTube injects the real player
client-side after JS boot, so **static HTML snapshots structurally cannot show player
runtime state** — no current speed, no `#movie_player` object, no post-hydration
`localStorage` writes made during playback. This is why the original "diff two HTML
files" approach could never find the mechanism: it isn't there to find.

To get real answers, this analysis includes a short **live session** against
`https://www.youtube.com/watch?v=dQw4w9WgXcQ` using the project's existing Playwright
MCP + Firefox setup (same tooling as the E2E harness), read-only, no code changes.

---

## 3. Probe-by-Probe Findings

| File | What it is | What it does / doesn't show |
|---|---|---|
| `..._speed_1_0.html` | Watch page, saved with player at 1.0x | No speed-related content anywhere (see §4.1 diff). Confirms player state isn't SSR'd. |
| `..._speed_2_0.html` | Same video, saved at 2.0x | Byte-for-byte identical to the 1.0x file except unrelated noise (view counters, CDN routing, nonces). **Directly falsifies** the "speed sent to server as a request list" hypothesis. |
| `..._ad.html` | Watch page while an ad was showing | No `ad-showing`/`ytp-ad-*` classes present — again, the player DOM (where those classes live) isn't in the SSR shell. Only server-rendered ad *metadata* JSON (`PlaybackRateUpsellPanelCommand` — a Premium upsell UI string, not runtime state) is present. |
| `YouTube_short_page.html` | A YouTube Shorts page | Contains `reelPlayerOverlay` in the initial JSON config, confirming Shorts uses a different player surface (`ytd-reel-video-renderer` / "reel" player) from the standard watch page's `#movie_player`. No `<video>` element present for the same SSR-vs-hydration reason. Relevant because `isYouTubeWatchPage()` in our site adapter only matches `/watch` — Shorts is out of scope today (§6.3). |
| `rickroll - search_query.html` | YouTube search results page | No player-related content; `estimatedResults` JSON present. Not relevant to speed; included in the probe set presumably to test general page-detection robustness (search pages have no video element, which our `findVideoElement` correctly returns `null` for). |
| `YouTube_main_blank.html` | Home page, signed-out | No player. Baseline for comparison with `_with_banner`. |
| `YouTube_with_banner.html` | Home page, signed-out, with a banner | Differs from `_main_blank` by exactly one thing: a hidden `<iframe name="passive_signin" src="https://accounts.google.com/ServiceLogin?...">`. This is a **passive Google sign-in probe iframe**, not a cookie/consent banner. Directly relevant: the live session (§4.3) observed this same `accounts.google.com` sign-in flow loading during an ad, correlated with the execution-context-destroy event. |

---

## 4. Live Verification Findings (Firefox / Playwright, `dQw4w9WgXcQ`)

### 4.1 Speed 1.0 vs 2.0 diff (static, confirms §3)

```
diff <(tr '>' '\n' < speed_1_0.html) <(tr '>' '\n' < speed_2_0.html)
```
filtered for per-request noise (`nonce=`, `csn`, `ei`, `clickTrackingParams`,
`serverTimeMs`, `TIMING_INFO`) leaves only: a comment `upvoteCount` +1, a
`userInteractionCount` +3, and CDN edge server reassignment (`rr2` vs `rr5`).
**CONFIRMED: zero speed-related bytes differ.**

### 4.2 `#movie_player` exists and exposes the IFrame-API method shape

**CONFIRMED**, evaluated live:

```js
document.getElementById('movie_player')
// → { setPlaybackRate: 'function', getPlaybackRate: 'function',
//     getAvailablePlaybackRates: 'function', ... }
```

`getPlaybackRate()` and `video.playbackRate` read the same live value.

### 4.3 Direct `video.playbackRate` assignment survives immediately, but was reset across an ad→content transition, coinciding with a torn-down JS context

Sequence observed:
1. Set `video.playbackRate = 2.0; video.defaultPlaybackRate = 2.0` directly on the raw
   element (bypassing `#movie_player`). Rate read back as `2` immediately. **CONFIRMED**.
2. Called `movie_player.playVideo()`. An ad began (`ad-showing`/`ad-interrupting`
   classes present, `duration: 20.0s`, a 20-second pre-roll). **CONFIRMED**.
3. During the ad, a `passive_signin` Google auth flow loaded
   (`accounts.google.com/v3/signin/identifier?...`) — same iframe identified statically
   in `YouTube_with_banner.html` (§3). Console showed **`Execution context was
   destroyed, most likely because of a navigation`**, and a global (`window.__rateLog`)
   we had injected moments earlier no longer existed on the next evaluation, even though
   `location.href` never changed. **CONFIRMED**: the page's JS execution context was
   torn down and replaced without a corresponding user-visible navigation. This directly
   corroborates the "windowGlobal replacement" **THEORY** already logged in
   `docs/e2e-debug-state.md` (§ "TC-01") — now with a concrete observed trigger
   (ad start).
4. After the ad ended (`ad-showing` → `false`, `duration` jumped from 20s to 213s —
   the real song length), `video.playbackRate` and `video.defaultPlaybackRate` were
   both back to `1`. **CONFIRMED**.

**Implication:** any content-script in-memory state (ours or a fixed version) can be
wiped by this ad-related context replacement, independent of whether `yt-navigate-finish`
fires. A correctness fix must not assume "one apply per `yt-navigate-finish`" is
sufficient.

### 4.4 `#movie_player.setPlaybackRate()` stays in sync and held steady through uninterrupted playback

After the ad ended, called `movie_player.setPlaybackRate(2.0)`. `video.playbackRate`
and `movie_player.getPlaybackRate()` both read `2` immediately and **stayed at `2` for
8+ seconds of continuous main-content playback** (no seek, no quality change, no ad).
**CONFIRMED** for this window. **Not tested**: whether `setPlaybackRate()` is any more
resilient than direct `video.playbackRate` assignment against the *same* ad-transition
trigger that reset it in §4.3 — that specific head-to-head wasn't isolated in this
session. Flagged as **THEORY** that routing through `#movie_player` is more robust,
based on third-party userscript precedent (§4.6), not directly proven here.

### 4.5 No speed/rate persistence in `localStorage` or `sessionStorage`

**CONFIRMED**, evaluated live (filtered to keys matching `/speed|rate|player/i`):

- `localStorage`: `yt-player-bandwidth` (network stats), `Vd10962ee||::yt-player::yt-player-lv`
  (empty object), `yt-player-caption-persistence` (`"true"`).
- `sessionStorage`: `yt-player-autonavstate` (`"2"` — autoplay-next-video toggle).

None relate to playback speed. This refines the earlier web-search claim ("YouTube does
not store per-account speed for non-Premium accounts") — it's not just absent from the
account, it's absent from `localStorage`/`sessionStorage` entirely for this session.
Speed is transient, in-memory-only state that resets on every fresh player
initialization (new tab, new session, or the context-teardown event in §4.3).

### 4.6 External precedent (web research, THEORY / not YouTube-source-verified)

Third-party YouTube speed userscripts (e.g. `splttingatms/YouTubeDefaultSpeed`) call
`document.getElementById('movie_player').setPlaybackRate(rate)` *in addition to*
`video.playbackRate = rate`, and use a `MutationObserver` on the `<video>` element's
`src` attribute (not `yt-navigate-finish`) to detect new video loads — i.e. they key off
the media-source swap itself rather than an SPA-navigation DOM event. This matches what
§4.3 observed: the ad→content swap is a source change, not a navigation.

---

## 5. Confirmed Bugs & Architecture Gaps In Our Extension

### 5.1 `isExtensionToken` tautology defeats manual-override detection (CONFIRMED by code read + test contract)

`apps/firefox-extension/src/content/content.js`:

```js
player.onRateChange(() => {
  if (isExtensionToken(state, state.extensionToken)) {   // ← compares state.extensionToken to itself
    state = clearExtensionToken(state);
    return;
  }
  state = markManualOverride(state);
});
```

`isExtensionToken(state, token)` (`src/core/playback-state.js`) is `state.extensionToken
=== token`. Calling it with `token = state.extensionToken` makes the condition
`state.extensionToken === state.extensionToken`, which is `true` for **every** value
including `null` (`null === null` is `true`). `markManualOverride()` is therefore
**unreachable** — confirmed correctness bug, not a style nit.

Proof this isn't the intended contract: `tests/unit/playback-state.test.js` asserts
```js
assert.equal(isExtensionToken(createState(), 'tok1'), false); // no token set → false
```
i.e. the pure function is designed to compare against an *independently tracked*
expected token, not the value read back from the same state object. The unit tests for
the pure module pass; the integration call site in `content.js` violates the contract
and has no test coverage of its own.

**Effect:** when YouTube resets `playbackRate` for any reason not caused by our own
`applySpeed()` call (HLS source swap, `#movie_player` resync, the ad-transition context
teardown in §4.3), the resulting `ratechange` fires while `state.extensionToken` is
either still set from our last write or already `null` from a previous clear — either
way the buggy comparison reads `true`, so the handler treats it as "our own echo,"
clears the token, and does **nothing**. No re-apply, no override flag, no signal to the
popup. The video is simply left at whatever YouTube set it to. This plausibly *is* what
K observed as "our value was overwritten multiple times" — the extension has no way to
notice.

### 5.2 Ad-transition gap: same `<video>` element, no re-trigger (CONFIRMED behavior in §4.3, gap is code-read)

`tryInitVideo` (debounced 300ms) runs once per `yt-navigate-finish` and grabs
`document.querySelector('video')` — it doesn't distinguish an ad's video from the main
content's video, because **they are the same DOM element** (confirmed in §4.3: the
element persisted across the ad→content swap, only `src`/`duration` changed). Two
consequences:

- If `tryInitVideo` fires while an ad is showing, `applySpeed(settings.defaultSpeed)`
  would change the *ad's* playback rate — conflicting with the PRD's non-goal of no ad
  manipulation (PRD §5.1, §19 "No automated ... modification of ads").
- Once the ad ends and real content starts, nothing re-triggers `applySpeed` for the new
  source — no `yt-navigate-finish` fires for an ad→content swap within the same watch
  page load — so the default speed is silently lost even if bug §5.1 were fixed.

### 5.3 Shorts pages entirely out of scope (known limitation, not a bug)

`isYouTubeWatchPage()` (`src/site-adapters/youtube/youtube-site-adapter.js`) only
matches `pathname === '/watch'`. The Shorts probe confirms Shorts pages use a different
player surface (`reelPlayerOverlay`, §3) — out of scope for the current adapter by
design, but worth flagging since a Shorts probe was specifically collected, suggesting
it may be an expected near-term target.

### 5.4 Partial prior fix for a related but distinct vector

Commit `da75c1b` ("set `defaultPlaybackRate` alongside `playbackRate`") already fixed
one overwrite vector: YouTube's HLS/MSE adapter resets `playbackRate` to
`defaultPlaybackRate` on source change / `video.load()`. That fix is real but only
covers the video-element level — it doesn't address §5.1 (detection is broken so even a
correct re-apply never gets triggered) or the `#movie_player`-level state in §4.6.

---

## 6. Proposed Remediations

Ranked by confidence × impact. Items 1 and 2 have since been **applied**
(`apps/firefox-extension/src/content/content.js`, `src/player-adapters/html5-video-player-adapter.js`,
with new coverage in `tests/unit/html5-video-player-adapter.test.js`); items 3-5 remain
proposals for K to decide on next.

1. **APPLIED — Fix the `isExtensionToken` call site.**
   Replaced the tautological comparison with a check of whether a write is actually
   pending: `if (state.extensionToken !== null) { state = clearExtensionToken(state); return; } state = markManualOverride(state);`
   This matches the tested contract of the pure `playback-state.js` module without
   changing that module at all. The now-unused `isExtensionToken` import was dropped
   from `content.js` (the pure function and its own unit tests are untouched).

2. **APPLIED — Route speed writes through `#movie_player.setPlaybackRate()` when
   present, in addition to the raw `<video>` element.** `setSpeed()` in
   `player-adapters/html5-video-player-adapter.js` now does
   `videoElement.closest('#movie_player')` and calls `setPlaybackRate()` on it first
   (guarded by `typeof ... === 'function'` so it's a no-op on generic HTML5 pages or in
   the existing plain-object test doubles), then still sets `defaultPlaybackRate` and
   `playbackRate` directly as before. Keeps YouTube's own internal player state in sync,
   matching documented-API precedent (§4.6) and confirmed live behavior (§4.4), while
   staying safe for non-YouTube/generic HTML5 video (post-MVP scope per PRD §9).

3. **Detect ad state and gate/re-trigger around it.** Watch `#movie_player`'s
   `classList` for `ad-showing` (via a scoped `MutationObserver` on the `class`
   attribute, consistent with NFR-003's "no tight polling" requirement) instead of only
   `yt-navigate-finish`. Do not apply default speed while `ad-showing` is present (avoids
   the ad-manipulation non-goal); re-apply once it's removed and the underlying media
   source has actually changed (e.g. compare `video.duration` before/after, since it
   jumps from the ad's short duration to the real video's duration, as observed in §4.3).

4. **(Speculative — flagged explicitly, not a confirmed fix) Treat context teardown as
   a first-class re-init trigger, not just `yt-navigate-finish`.** §4.3 showed the page's
   JS execution context itself can be replaced mid-session without a "navigation" the
   content script would recognize. If this replaces the content script's own execution
   context too (not just the page's), the extension gets reloaded fresh by the browser
   and `init()` reruns naturally — this needs to be confirmed with the extension actually
   loaded (not just a bare page), since Firefox content-script lifecycle across a
   windowGlobal replacement is exactly the open question already tracked in
   `docs/e2e-debug-state.md`. Do not implement speculatively; resolve the E2E TC-01
   investigation first, since it answers the same question.

5. **Shorts support** — separate future site-adapter effort (different player surface,
   different navigation model), not a quick fix. Out of scope for this remediation pass.

---

## 7. Open Questions / Suggested Next Probes

- Does `#movie_player.setPlaybackRate()` survive the *exact* ad-transition trigger that
  reset direct `video.playbackRate` assignment in §4.3? Needs a controlled A/B: set via
  `#movie_player` before an ad starts, observe through ad→content, compare against the
  direct-assignment trial in this doc.
- Does the extension's *content script* (not just the bare page) actually get
  re-injected/reset across the windowGlobal replacement observed in §4.3? This is the
  same open question as `docs/e2e-debug-state.md` TC-01/TC-07 — resolving the E2E
  actor-refresh work will answer both at once.
- Static "Save Page As" probes cannot show player runtime state by construction (§2).
  Future probing should capture a **live DOM/JS snapshot** instead — e.g. a small script
  run via the existing Playwright/RDP tooling that dumps `#movie_player` state,
  `ratechange` event traces with timestamps, and full `localStorage`/`sessionStorage`
  contents to a JSON file under `docs/e2e-page-states/`, rather than browser "Save As".
