# Keyboard Shortcuts — tmux-style prefix navigation

Status: implemented 2026-07-17 (all editions; shared source).

## Model

A prefix chord, like tmux: press the **prefix** (default `Ctrl+A`), then a
command key. Outside the prefix window the extension consumes **no** keys, so
every native YouTube shortcut (`k`, `j`, `l`, `f`, `m`, digits, arrows, …)
keeps working. The prefix is ignored while focus is in an input, textarea,
select, or contenteditable — `Ctrl+A` still selects text there.

| Chord | Command | Effect |
|---|---|---|
| `Ctrl+A` then `o` | `show-jump-labels` | Overlay deterministic two-char indexes on clickable elements; type an index to focus+click it |
| `Ctrl+A` then `p` | `show-queue-labels` | Overlay two-char indexes on every video that has an "Add to queue" option; type an index to open that video's ⋮ menu, click "Add to queue", and confirm with a badge |
| `Ctrl+A` then `y` | `go-home` | Go to the main YouTube page (clicks the logo; falls back to `homeUrl`) |
| `Ctrl+A` then `v` | `set-speed-1` | Set playback speed to preset 1's configured value (default `1`); persists as `settings.defaultSpeed` and applies to the active video |
| `Ctrl+A` then `b` | `set-speed-2` | Same as above for preset 2 (default `1.5`) |
| `Ctrl+A` then `n` | `set-speed-3` | Same as above for preset 3 (default `2`) |
| `Ctrl+A` then `h` | `toggle-auto-apply` | Flip `settings.youtubeEnabled` (auto-apply default speed on video load); persisted only, no video interaction |
| `Ctrl+A` then `Esc` | — | Cancel the pending prefix |

Pending prefix times out after 2 s. An unknown key after the prefix cancels it
and is passed through to YouTube untouched. Chord keys are accepted with Ctrl
still held (`Ctrl+A`, keep Ctrl, `o` works).

## Jump labels

- Targets: visible `a[href]`, `button`, `[role="button"]`, form controls, and
  positive-`tabindex` elements inside the viewport. Static/hidden things are
  excluded: zero-size rects, offscreen elements, `disabled`, and anything under
  `aria-hidden="true"`.
- Labels are two chars from the home-row-first alphabet
  (`ASDFGHJKLQWERTYUIOPZXCVBNM…`), assigned in row-major visual order
  (top-to-bottom in ~40 px row buckets, then left-to-right) — deterministic for
  identical layouts. First label is `AA`. Hard cap: 676 targets.
- Typing narrows matches live; `Backspace` un-types; `Esc` closes; a dead-end
  prefix closes the overlay. While the overlay is open all keys are captured so
  YouTube shortcuts cannot fire accidentally.

## Queue labels

- Shares the jump overlay's label component (`createJumpOverlay`) and target-collection/
  sort logic (`collectVisibleTargets` in `src/ui/jump-overlay.js`) — same alphabet, same
  badge styling, same row-major ordering, same `Backspace`/`Esc` behavior. Any future change
  to jump overlay's display (badge style, label alphabet, sort order) applies to the queue
  overlay automatically since both call the same shared functions.
- Targets: every visible video card's ⋮ ("more actions") trigger button, matched by two
  structural classes joined in one selector — not by the button's `aria-label` text, which
  is translated (confirmed English "More actions" / Polish "Więcej działań"):
  - `.ytLockupMetadataViewModelMenuButton button` — the `yt-lockup-view-model` component used
    by the home feed, channel grids, playlists, and the watch-page "Up next" sidebar.
  - `.shortsLockupViewModelHostOutsideMetadataMenu button` — the separate
    `ytm-shorts-lockup-view-model` component used by Shorts shelves (confirmed live in the
    watch-page sidebar; the two components render structurally different wrapper markup
    around an identically-styled trigger button, so a shared selector misses Shorts entirely).
    This was a real production gap (Shorts silently uncovered) until confirmed and fixed via
    live DOM inspection — see `docs/probes/add-to-queue-dom-findings.md` for the original
    research and its correction note.
  Sponsored/paid-partnership videos badged "Sponsored" inside a regular `yt-lockup-view-model`
  card are already covered by the first selector (same component, just a badge). A genuine ad
  slot (not a partnership-badged organic video) was confirmed live to render via a different
  button-group wrapper with no "Add to queue" option at all (only an ad-transparency button) —
  this is native YouTube behavior, not a gap.
  Live streams/broadcasts use the same `yt-lockup-view-model` component as regular videos
  (confirmed live, `[LIVE]`-badged card, "Add to queue" still item 0) so no separate handling
  is needed.
  The legacy `ytd-video-renderer` used only by non-Shorts search results has its trigger button
  render lazily, into `#menu`, only on genuine mouse hover — confirmed as universal YouTube
  behavior (reported by a user in real, non-automated Firefox/Chrome), not automation-specific.
  Two things cover it:
  - `ytd-video-renderer #menu button` — a fourth trigger-selector branch that matches once the
    button has stamped in (real hover, or any other cause). This is the definite fix for the
    originally-reported "no response at all on search results" bug: the selector previously had
    *no* legacy branch, so even a fully-populated button was never found. Confirmed live via the
    Firefox e2e suite's `TC-18` against the exact reported search URL.
  - A card whose button hasn't stamped yet is still collected as a fallback target (see
    `collectQueueTargets` in `src/ui/queue-overlay.js`); on activation, a synthetic hover-event
    sequence is dispatched at the card before looking for the button. This part is best-effort and
    **unverified** — the same synthetic-hover approach, and even real CDP-level mouse movement,
    failed/hung against this exact card in every automated attempt tried (see
    `docs/probes/add-to-queue-dom-findings.md`) — so it may not actually work; needs real-browser
    confirmation.
  The **menu-item** side (what happens once that popup is somehow open) is covered regardless —
  see below.
- Activation (`activateQueueTarget` in `src/ui/queue-overlay.js`): click the matched trigger
  button, wait two animation frames (see below), then poll (50 ms, 1.5 s timeout) for the
  popup's first menu item to appear under `ytd-popup-container`, then click it. The item
  selector matches two shapes: `yt-list-item-view-model[role="menuitem"]` (view-model system)
  and `ytd-menu-service-item-renderer` (legacy Polymer popup, used by non-Shorts search
  results — confirmed via a real XPath captured from a live browser session, since the legacy
  trigger itself is unreachable from automation as noted above). **"Add to queue" is always the
  first menu item** in both shapes — YouTube's popup exposes no locale- or icon-based marker to
  distinguish it (verified empty icon DOM across two independent research sessions, English and
  Polish), so position is the only usable signal. This is a documented `ponytail:` ceiling in
  the source: if YouTube ever reorders the menu, this breaks, and the e2e suite below is what
  would catch it.
  - **Two-frame settle delay + re-entrancy guard**: YouTube recycles the same popup DOM nodes
    across different trigger clicks instead of creating fresh ones (confirmed live — clicking a
    second trigger while a popup is open reuses the exact same item element reference). That
    means "an item node exists in the DOM" is true even for a popup that's mid-transition to a
    *different* target, so reading it on the very next tick after a trigger click can act on
    stale content — this was the root cause of a reported double-add/stuck-open-menu bug.
    `activateQueueTarget` now (a) waits two `requestAnimationFrame` ticks after the trigger
    click before it starts polling, to give YouTube's render cycle a chance to settle, and (b)
    ignores a second activation call while one is already in flight, so a fast repeated
    shortcut press can't race itself. (YouTube's own `opened` state on the popup is a plain JS
    instance property set by page code in the main world — not visible to an extension content
    script's isolated world — so that couldn't be used as a readiness signal instead.)
- On success, a green confirmation badge ("Added to queue") appears near the target's rect and
  fades out after ~1.4 s, reusing the jump overlay's `BADGE_STYLE`.

## Configuration

`DEFAULT_KEYMAP` and the default speed-shortcut values are sourced from the
checked-in `src/core/shortcuts.config.json`, sanitized at module load through
the same `normalizeKeymap()` / `normalizeSpeedShortcuts()` functions used for
storage-provided overrides (`src/core/keyboard-shortcuts.js`) — retuning a
shortcut key or a speed value is a one-file edit, no code change needed:

```json
{
  "prefix": { "key": "a", "ctrl": true, "meta": false },
  "chords": {
    "o": "show-jump-labels",
    "p": "show-queue-labels",
    "y": "go-home",
    "v": "set-speed-1",
    "b": "set-speed-2",
    "n": "set-speed-3",
    "h": "toggle-auto-apply"
  },
  "homeUrl": "https://www.youtube.com/",
  "speeds": {
    "set-speed-1": 1,
    "set-speed-2": 1.5,
    "set-speed-3": 2.0
  }
}
```

The keymap can also be overridden per-install in settings
(`browser.storage.local`, key `videodefaults_settings.keymap`), sanitized by
the same `normalizeKeymap()` on every read:

- `prefix` must include `ctrl` or `meta` (macOS users can set
  `{ "key": "a", "ctrl": false, "meta": true }` for `⌘A`); a plain-key prefix
  is rejected so single-key YouTube shortcuts can never be shadowed.
  `RESERVED_YOUTUBE_KEYS` documents YouTube's own bindings.
- `chords` maps single keys to known commands; unknown commands are dropped.
  A stored override is merged onto the defaults key-by-key, not swapped in
  wholesale — a partial override (e.g. only remapping `o`) keeps every other
  default chord (`p`, `y`, `v`, `b`, `n`, `h`) working.
- `homeUrl` must be an `https://*.youtube.com` URL (blocks `javascript:` and
  third-party redirect targets).
- `speeds` maps each `set-speed-*` command to a numeric value validated by
  `validateSpeed()` (`src/core/speed.js`); out-of-range or non-numeric entries
  fall back to that command's default (see table above) — exposed as
  `SPEED_SHORTCUTS`.
- Settings changes apply live (storage listener); no reload needed.

The prefix's fallback default is platform-aware: on macOS it resolves to
`{ key: 'a', ctrl: false, meta: true }` (`⌘A`) instead of the OS-agnostic
`Ctrl+A`, detected via `isMacPlatform()` (`src/core/platform.js`) and threaded
through as the `isMac` parameter on `normalizeKeymap()` / `applyDefaults()` /
`migrateSettings()`. This only applies when no `keymap.prefix` is already
stored — an existing stored value (valid or user-set) always wins, and
`DEFAULT_KEYMAP` itself stays OS-agnostic (`isMac` defaults to `false`).

No options UI yet — edit via storage or wait for the options page
(see `docs/ai/questions-for-K.md` Q8).

## Verification

- Unit: `tests/unit/keyboard-shortcuts.test.js` (state machine, keymap
  sanitizing, labels), `tests/unit/jump-overlay.test.js` (target collection),
  `tests/unit/queue-overlay.test.js` (queue target collection, menu-item activation).
- E2E: `scripts/test-chrome-smoke.mjs` presses the real chords in Chromium and
  asserts overlay render, Escape close, and home navigation. `scripts/test-extension-e2e.mjs`
  (TC-15, TC-16, TC-17) dispatches the same chords over the Firefox RDP console actor
  and asserts overlay render/close, home navigation, and — for the queue overlay,
  on a watch page's "Up next" sidebar — label render, activation, and the
  confirmation badge in real Firefox. `TC-18` covers the queue overlay on a real
  search-results page (legacy `ytd-video-renderer` cards), asserting labels render for
  them — it does not attempt activation, since that path's hover-forcing is unverified
  (see above).
