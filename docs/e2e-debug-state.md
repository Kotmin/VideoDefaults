# E2E Test — Debug State & Knowledge Base

> Working doc. Updated as facts are confirmed. All claims marked CONFIRMED or THEORY.

---

## What Works (CONFIRMED)

| Item | Evidence |
|---|---|
| Extension loads via `web-ext run` + Playwright FF binary | TC-09/12/14 pass every run |
| Symlink dereference (`cpSync dereference:true`) | Module imports work; before fix, content script silently failed |
| Raw TCP RDP client (length-prefixed frames) | Stable across all runs |
| FDP grip unwrapping (`{type:"NaN"}`, `{value:N}`) | Fixed `[object Object]` rate result |
| `defaultPlaybackRate = speed` extension fix | Rate changed from always-1 to non-1 values |
| `waitFor` held-queue (non-matching msgs restored to inbox) | Required for correct multi-step evaluate |
| `target.url` field IS in FDP `target-available-form` messages | Logged: `nav-target url=https://...` |
| TC-09 passes (home page, no crash) | Consistent |

---

## What Is Still Failing

### TC-01 — `playbackRate = null` after `refreshActor` got `about:blank`

**Sequence:**
1. navigate → actor for `youtube.com/watch?v=A` ✓
2. `waitForVideo` → finds video (rs=0 at poll0, eventually rs≥1) ✓
3. `sleep(3000)` — events accumulate in inbox
4. `refreshActor` — **grabbed `about:blank` actor** (CONFIRMED from log)
5. `getRate` on about:blank → null → TC-01 fails

**Root cause theories:**
- THEORY A: YouTube's windowGlobal replacement creates an intermediate `about:blank` state before setting the final URL. The replacement sends: `(target=about:blank)` then `(target=youtube.com/watch?v=A)`. `refreshActor` grabbed the intermediate one.
- THEORY B: YouTube's page creates an `about:blank` iframe at ~7-10s (for auth, ads, or analytics). This iframe's target arrived before the main-frame replacement.

**Current fix attempt:** Filter `refreshActor` by `target.url.startsWith('youtube.com/watch')`. Should reject about:blank.

---

### TC-07 — `video never appeared` (cascade from TC-01)

**Sequence:**
1. After TC-01, `con` = about:blank actor (from TC-01's bad `refreshActor`)
2. TC-07 `navigate(rdp, con, YT_B)` — evaluates `window.location.href = YT_B` on about:blank actor
3. This navigates the about:blank WINDOW to YT_B, not the main tab
4. `target-available-form` for `url === YT_B` is found — but it's a different window
5. `waitForVideo` on this context → `rs=-1` (no video, different window context)

**Current fix attempt:** `navigate()` waits for `target.url === exact destination URL`. If the navigation went to a different window, there should still be a `target.url === YT_B` event. But whether that window has a proper video is TBD.

**If URL filter works:** TC-07 needs a valid actor that can navigate the MAIN TAB. After TC-01, the main tab's current actor (YouTube A's replacement windowGlobal) should be in the inbox if the URL filter correctly picks it in `refreshActor`.

---

## Firefox FDP Protocol — Confirmed Facts

| Field | Value | Notes |
|---|---|---|
| `target.url` | **PRESENT** | URL of the frame; populated for all targets |
| `target.isTopLevel` | **ABSENT** (undefined) | Not sent by this Firefox build |
| Grip format for number | `{type:"number",value:N}` OR raw `N` | Unwrap needed |
| Grip format for undefined | `{type:"undefined"}` | Unwrap needed |
| Grip format for null | `null` (JSON null) | Pass-through OK |
| `target-available-form` events after YouTube nav | 4 total: 1 main frame + 3 sub-frames | Main at ~363ms, sub-frames at 6.8-7.3s |
| windowGlobal replacement | At ~7-10s post-nav | YouTube replaces initial frame with new windowGlobal |
| Replacement intermediate state | THEORY: `about:blank` then final URL | Unconfirmed |
| Sub-frame URLs | about:blank, CDN, accounts.google.com | Confirmed from refresh logs |

---

## Key Variables / State Machine

### Page states (per `docs/e2e-page-states/` snapshots)

| State | Selector | Notes |
|---|---|---|
| Main player video | `video.html5-main-video` | Class confirmed; also `#movie_player` ancestor |
| Ad playing | `#movie_player.ad-showing` | Class on player div, not on video |
| Consent banner | `button[aria-label*="Accept" i]` | Not present in test profile (already accepted) |
| YouTube Home | `url === 'https://www.youtube.com/'` | No video elements |
| YouTube Watch | `url.includes('/watch')` | Has main player video |

### Extension state variables (in content.js)

| Variable | Type | Meaning |
|---|---|---|
| `settings` | `{defaultSpeed: number}\|null` | Loaded from storage; null until `loadSettings()` resolves |
| `state` | `{manualOverride, extensionToken}` | Reset on `yt-navigate-finish` |
| `player` | PlayerAdapter\|null | Set in `tryInitVideo`; null on non-watch pages |
| `state.extensionToken` | string\|null | Set before `setSpeed()`, cleared on matching `ratechange` |
| `state.manualOverride` | boolean | Set when non-extension `ratechange` detected |

### RDP state variables (in test)

| Variable | Meaning | Risk |
|---|---|---|
| `con` | Current consoleActor for evaluation | Goes stale when windowGlobal is replaced |
| `proc` | web-ext child process | Must be SIGKILL'd; SIGTERM leaves orphan Firefox processes |
| inbox (`#inbox`) | Buffered RDP messages | Stale evaluationResult/target events poison next operations |

---

## What To Check Next (ordered by impact)

1. **Does URL filter on `refreshActor` fix TC-01?**
   - Expected: `refresh-ok url=https://www.youtube.com/watch?v=jNQXAC9IVRw`
   - If still `about:blank`: the YouTube windowGlobal replacement sends ONLY `about:blank` initially; need to wait for the subsequent event with the final URL
   - If no event found (timeout): the replacement event arrived before `refreshActor` was called (consumed by `waitForVideo`'s `waitFor` held-queue); need to drain at navigate time and store the actor

2. **Does URL filter on `navigate` fix TC-07 cascade?**
   - Expected: TC-07 uses the live YouTube A actor (from TC-01's `refreshActor`) to navigate to YT_B
   - If TC-07 still fails: the actor used for navigation is still wrong

3. **Is `playbackRate === 2.0` after extension runs?**
   - If rate is now null or wrong value, the extension might not be applying speed (check: is `defaultSpeed` being loaded correctly?)
   - Diagnostic: evaluate `JSON.stringify({rate: video?.playbackRate, defRate: video?.defaultPlaybackRate})` via `getRate`

4. **windowGlobal replacement — how many events?**
   - Need to know if the replacement sends ONE event (final URL) or TWO events (about:blank then final URL)
   - Diagnostic: add `stderr.write` for EVERY `target-available-form` that arrives during a 15s window after navigation

---

## Sources / References

| Topic | Where to look |
|---|---|
| Firefox FDP Watcher protocol | Firefox source: `devtools/server/actors/watcher.js` |
| Frame target descriptor fields | Firefox source: `devtools/server/actors/descriptors/frame.js` |
| `evaluateJSAsync` grip format | Firefox source: `devtools/server/actors/webconsole/eval-with-debugger.js` |
| YouTube SPA navigation events | `yt-navigate-finish` custom event on `document` |
| `defaultPlaybackRate` spec | MDN: HTMLMediaElement.defaultPlaybackRate |
| Extension content script | `apps/firefox-extension/src/content/content.js` |
| Player adapter | `src/player-adapters/html5-video-player-adapter.js` |
| Page state snapshots | `docs/e2e-page-states/*.meta.json` |
| E2E test script | `scripts/test-extension-e2e.mjs` |
