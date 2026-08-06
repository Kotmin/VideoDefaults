# Open Questions for K — answer in batch, work continues meanwhile

Dated 2026-07-17. Each question lists the default I proceed with until answered.

## Q1 — AMO production extension id (blocks first listed upload only)

`manifest.json` still has `"id": "videodefaults@dev"`. AMO binds the listing to
the first-uploaded id forever. Pick one, e.g. `videodefaults@kotmin.dev`.
**Default:** leaving `@dev` untouched; flagged in improvement-spec S6.

## Q2 — re-apply speed when settings change while a video is open? (spec R4)

Today changing the default speed only affects the current video via the popup's
explicit message; a settings change from another window/tab is stored but not
applied until next navigation. Re-applying live could yank speed mid-video.
**Default:** keep current behavior (store only, apply on next video).

## Q3 — Chrome/Edge distribution targets — RESOLVED 2026-08-06

Chrome pipeline landed earlier (`release-chrome.yml`, CWS API v2). K directed
Edge CI directly (2026-08-06), which doubles as the go/no-go answer to issue
#6 item 4. `release-edge.yml` now exists (Partner Center Submission API
v1.1), plus `docs/release/edge-developer-setup.md` and
`docs/release/edge-api-contract-findings.md`. Still blocked on K creating the
actual Partner Center account/credentials and the first manual listing — see
the new questions filed for that in this doc.

## Q4 — prefix key on macOS

Ctrl+A is the tmux-style prefix on Linux/Windows. On macOS, Ctrl+A inside text
fields is "go to line start" (Emacs binding) — we ignore the prefix while focus
is in any input/textarea/contenteditable anyway, so Ctrl+A stays usable there.
Options: keep Ctrl+A everywhere (consistent), or map to Cmd+A on mac (conflicts
with select-all) or Ctrl+Cmd+A.
**Default:** Ctrl+A on all platforms, configurable per-platform in settings.

## Q5 — jump-label alphabet

For the index overlay (prefix, then `o`): labels are deterministic two-char
codes assigned in document order. Proposed alphabet: home-row-first
`ASDFGHJKLQWERTYUIOPZXCVBNM` (single char while ≤26 targets, two-char after,
e.g. `AA`, `AS`). You wrote "AA Row col" — if you specifically want row/column
derived labels (label = row letter + column letter of the visual grid), say so.
**Default:** document-order home-row labels; deterministic across identical DOMs.

## Q6 — reserved YouTube shortcuts list

We never bind (single keys YouTube already uses): `k j l f m c t i o p n
0-9 < > , . / ? space arrows shift+n shift+p shift+, shift+.`. All our
bindings live behind the prefix chord, so collisions only matter for the
prefix itself. Anything else you want reserved?
**Default:** the list above, stored in the configurable definitions file.

## Q8 — keymap configuration UI

The keymap is configurable via storage (documented in
`docs/specs/keyboard-shortcuts.md`), but there is no editing UI. Options: a
dedicated options page (`options_ui`), extra controls in the popup, or leave as
storage-only for power users.
**Default:** storage-only for now; options page when you confirm you want it.

## Q7 — scope of the shortcut feature

Ship prefix-navigation in Firefox first and port to Chrome/Edge after it
stabilizes, or land it simultaneously in all three?
**Default:** shared core + Firefox first, then enable in Chrome/Edge builds
(they share the same source, so usually free).
