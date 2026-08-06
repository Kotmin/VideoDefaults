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
  slot (not a partnership-badged organic video) was not reproducible live in the sessions that
  built this feature — YouTube ad units typically don't expose "Add to queue" at all, but this
  is unconfirmed; revisit with a captured DOM snapshot if one is found not to work.
  The legacy `ytd-video-renderer` used only by non-Shorts search results is not
  covered in v1 (its menu button renders lazily on hover with a structurally different path);
  revisit if that gap is reported (`docs/probes/add-to-queue-dom-findings.md`).
- Activation (`activateQueueTarget` in `src/ui/queue-overlay.js`): click the matched trigger
  button, poll (50 ms, 1.5 s timeout) for the popup's first `role="menuitem"` to appear under
  `ytd-popup-container`, then click it. **"Add to queue" is always the first menu item** —
  YouTube's popup exposes no locale- or icon-based marker to distinguish it (verified empty
  icon DOM across two independent research sessions, English and Polish), so position is the
  only usable signal. This is a documented `ponytail:` ceiling in the source: if YouTube ever
  reorders the menu, this breaks, and the e2e suite below is what would catch it.
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
  confirmation badge in real Firefox.
