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

---

Dated 2026-08-06. Surfaced while building the Edge Add-ons CI pipeline
(`release-edge.yml`, `docs/release/edge-developer-setup.md`). Same
batch-answer convention as above.

## Q9 — who owns the Microsoft Partner Center developer account

Same shape as the CWS question issue #6 already flagged for Google Cloud:
Partner Center registration is a paid, identity-bound account. Needs K to
actually create it and mint the `EDGE_CLIENT_ID`/`EDGE_API_KEY` before
`release-edge.yml` can run for real (it currently has no secrets set, so it
will just fail closed on first trigger — that's expected, not a bug).
**Default:** pipeline lands now, dormant until credentials exist. No default
answer possible here — this is purely K's account/identity action.

## Q10 — certification notes content

`release-edge.yml`'s submit step sends a fixed reviewer note: `"Automated
release {tag}. See CHANGELOG.md."` CWS/AMO pipelines don't send anything
equivalent (neither API has a reviewer-notes field). Fine as a permanent
default, or do you want per-release custom notes (e.g. sourced from the
changelog excerpt already extracted for the GitHub Release body)?
**Default:** keep the fixed string; revisit only if a certification reviewer
asks a clarifying question that a note could have preempted.

## Q11 — issue #6 item 5 (versioning on a needs-changes response) still open

Not resolved by this work — applies equally to Edge now that it has a real
submission flow. On a needs-changes/rejected submission from any store, do
we bump the shared version immediately or resubmit the same version after
fixes? Blocks nothing today (no store has rejected a submission yet), but
will block the first real rejection if unanswered.
**Default:** no default; flagging so it isn't lost, resubmit-same-version
is the naive assumption but unconfirmed against any store's actual policy.

## Q12 — Opera / Safari go/no-go

Filed as issue #12 per your direction, scoping-only like #6 was for
Chrome/Edge. Needs your go/no-go per browser before any research or
implementation starts (Opera is cheap to explore, Safari is a materially
different pipeline — macOS runner, paid Apple account, Xcode project).
**Default:** no work started on either until you answer in that issue.

---

Dated 2026-08-07. Surfaced while implementing issue #16 (playlist picker,
built with your sign-off from this batch). Same convention: default is what
I proceeded with, code is flagged `UNVERIFIED`/`ponytail:` at each spot.

## Q13 — native "Save to playlist" trigger button on the watch page (BLOCKING)

`docs/probes/save-to-playlist-dom-findings.md` only captured the sheet
*already open* — never the watch page's own button/menu item that opens it.
Every other piece of the feature (fuzzy search, popup driving, cache,
multi-add, create-new) is built and unit-tested, but
`findSaveToPlaylistTrigger` (`src/site-adapters/youtube/youtube-site-adapter.js`)
is a stub that always returns `null`, so `Ctrl+A, Shift+P` currently no-ops
on the live site — nothing breaks, it just does nothing. Needs a real DOM
capture of the watch page's action row (like/dislike/share/save) the same
way the existing probes captured the sheet, ideally including how it differs
(if at all) for Shorts vs. regular watch pages.
**Default:** stub in place, feature inert until this lands; no guessed
selector shipped in its place since a wrong one would look confident and
fail silently in a worse way than an honest no-op.

## Q14 — login detection (`isLoggedIn`)

`isLoggedIn` checks for `#avatar-btn` in the masthead (present when signed
in; signed-out shows a "Sign in" link instead) — a reasonable, structurally-
grounded guess, but never independently confirmed against a captured
signed-out DOM.
**Default:** ship as best-effort; if wrong, the picker either never opens
for a logged-in user (safe, just annoying) or attempts to open for a
signed-out one and then fails harmlessly at the trigger-button stub (Q13)
either way, so the failure mode is safe regardless.

## Q15 — create-new post-click UI shape

Per your "best-effort, ponytail-flagged" answer: `driveCreateNewPlaylist`
(`src/ui/playlist-popup-driver.js`) assumes clicking the footer "create new"
button reveals an inline text input/contenteditable inside the same sheet,
and submits by setting its value and dispatching an `Enter` keydown. This
was never captured — could be a separate dialog, a different submit
mechanism (dedicated button vs. Enter), or something else entirely.
**Default:** shipped as described; self-heals to a no-op (returns `false`,
overlay state left untouched) if no field appears within 1.5 s. Needs
verification during real-browser testing, same as Q13.

## Q16 — playlist identity when names collide

The picker keys playlists by name (no stable DOM id exists on the row —
only the `aria-label` text). Two playlists with the same name (YouTube
allows this) would be indistinguishable to fuzzy search, checkbox state, and
the add sequence (`rows.find((r) => r.name === name)` would always resolve
to whichever matches first).
**Default:** accepted as a known limitation, not fixed — no id-bearing DOM
signal was found in probes to key on instead. Flag if this turns out to
matter in practice (e.g. your account actually has duplicate-named
playlists).
