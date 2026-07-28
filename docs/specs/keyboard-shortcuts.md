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
| `Ctrl+A` then `y` | `go-home` | Go to the main YouTube page (clicks the logo; falls back to `homeUrl`) |
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

## Configuration

The keymap lives in settings (`browser.storage.local`, key
`videodefaults_settings.keymap`) and is sanitized by
`normalizeKeymap()` (`src/core/keyboard-shortcuts.js`) on every read:

```json
{
  "keymap": {
    "prefix": { "key": "a", "ctrl": true, "meta": false },
    "chords": { "o": "show-jump-labels", "y": "go-home" },
    "homeUrl": "https://www.youtube.com/"
  }
}
```

- `prefix` must include `ctrl` or `meta` (macOS users can set
  `{ "key": "a", "ctrl": false, "meta": true }` for `⌘A`); a plain-key prefix
  is rejected so single-key YouTube shortcuts can never be shadowed.
  `RESERVED_YOUTUBE_KEYS` documents YouTube's own bindings.
- `chords` maps single keys to known commands; unknown commands are dropped.
- `homeUrl` must be an `https://*.youtube.com` URL (blocks `javascript:` and
  third-party redirect targets).
- Settings changes apply live (storage listener); no reload needed.

No options UI yet — edit via storage or wait for the options page
(see `docs/ai/questions-for-K.md` Q8).

## Verification

- Unit: `tests/unit/keyboard-shortcuts.test.js` (state machine, keymap
  sanitizing, labels), `tests/unit/jump-overlay.test.js` (target collection).
- E2E: `scripts/test-chrome-smoke.mjs` presses the real chords in Chromium and
  asserts overlay render, Escape close, and home navigation. `scripts/test-extension-e2e.mjs`
  (TC-15, TC-16) dispatches the same chords over the Firefox RDP console actor
  and asserts overlay render/close and home navigation in real Firefox.
