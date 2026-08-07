# Watch-page "Save to playlist" trigger button — DOM findings

Captured 2026-08-07 via a live, headless-Firefox Playwright probe against
`https://www.youtube.com/watch?v=dQw4w9WgXcQ`, logged out (fresh browser
profile, no stored session). Resolves Q13 in `docs/ai/questions-for-K.md`:
the earlier probe (`save-to-playlist-dom-findings.md`) only ever captured
the sheet *after* it was already open — this one captures the watch page's
own action-row button that opens it.

## Action row structure

```
#actions
  #actions-inner
    #menu
      ytd-menu-renderer
        #top-level-buttons-computed   (like/dislike segmented button, Share)
        #flexible-item-buttons        (Save, Download)
          yt-button-view-model                    → Save
            button-view-model
              button[aria-label="Save to playlist"]
          ytd-download-button-renderer             → Download
            ytd-button-renderer
              yt-button-shape
                button[aria-label="Download"]
```

Save and Download are the only two children of `#flexible-item-buttons`,
and they use different wrapper components — Save is the sole
`<yt-button-view-model>` child, Download is wrapped in
`<ytd-download-button-renderer>`. That wrapper-tag distinction is the
selector used, not the `aria-label` text (locale-dependent elsewhere, though
this particular capture happened to be English since it was an unauthenticated
session with no locale customization):

```
#flexible-item-buttons > yt-button-view-model button[aria-label]
```

## Login-gate behavior confirmed live

Clicked the resolved trigger while logged out: it opens a real sheet
(`ytd-modal-with-title-and-button-renderer` inside `ytd-popup-container`),
but it's YouTube's own **"Want to watch this again later? Sign in to add
this video to a playlist."** interstitial, not the playlist-picking sheet.
This confirms the existing `isLoggedIn()` gate in `content.js` is load-
bearing, not just defensive: without it, pressing `Ctrl+A, Shift+P` while
signed out would open our overlay against YouTube's sign-in prompt instead
of a playlist list, and `openSaveToPlaylistPopup`'s row-scraping would find
nothing sensible.

## Still unverified

- **Logged-in session**: not captured (fresh automated profile has no
  stored YouTube login). Assumed structurally identical — the wrapper
  distinction (`yt-button-view-model` vs `ytd-download-button-renderer`) is
  unrelated to auth state — but not confirmed.
- **Shorts / other layouts**: not captured. A "Clip" button, if present,
  might also use the `yt-button-view-model` wrapper and share
  `#flexible-item-buttons`, which would break the "sole child" assumption
  the selector above relies on (see the `ponytail:` note on
  `findSaveToPlaylistTrigger` in `youtube-site-adapter.js`).

## Source

Live capture only (headless Firefox via the `playwright` devDependency,
run as a throwaway script, not committed) — no HTML fragment saved
alongside this doc since the page contains no personal/account data in the
logged-out state captured.
