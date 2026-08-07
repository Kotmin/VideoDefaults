# "Save to playlist" popup — DOM findings

Captured 2026-08-07 by K from a real logged-in YouTube account (watch page,
video's ⋮ menu → "Save to..."), across two sessions: one with nothing checked
(`save-to-playlist-popup.html`), one with the video already saved to "Watch
later" (`save-to-playlist-popup-selected.html`), diffed to find the selected-
state signal below. Source for both: a full "Save as complete" page save;
only the relevant fragment was kept (the `<yt-sheet-view-model>` subtree) —
the rest of each saved page and its ~19MB asset folder were discarded as
unnecessary bulk, and every real playlist name in the kept fragments was
replaced with a generic `Playlist A`..`Playlist P` placeholder (`Watch later`
and `Shorts`, YouTube's own system playlists, were left as-is). Locale of the
source account is Polish; only the alphabet/text differs from other locales,
not the structure.

## Component

Newer view-model "sheet" system, not the legacy `ytd-add-to-playlist-renderer`
Polymer popup:

```
yt-sheet-view-model[slot="dropdown-content"]
  yt-contextual-sheet-layout
    div.ytContextualSheetLayoutHeaderContainer
      yt-panel-header-view-model[aria-label="Zapisz film na playliście..."]  (~"Save video to playlist...")
        h2 > span.ytAttributedStringHost  → "Zapisz na…"  (~"Save to…")
    div.ytContextualSheetLayoutContentContainer
      yt-list-view-model.ytListViewModelHost[role="menu"][style*="max-height: 220px"]
        toggleable-list-item-view-model.toggleableListItemViewModelHost   (repeated, one per playlist)
          yt-list-item-view-model.ytListItemViewModelHost[role="menuitem"][aria-label="{name}, {visibility}, {selected-state}"]
    div.ytContextualSheetLayoutFooterContainer
      yt-panel-footer-view-model
        ...button[aria-label="Utwórz nową playlistę"]  (~"Create new playlist")
```

## Playlist rows

- One `toggleable-list-item-view-model` > `yt-list-item-view-model` per
  playlist, `role="menuitem"`.
- **Selected/unselected state resolved** — K captured a second probe
  (`save-to-playlist-popup-selected.html`, watch page for a video already
  saved to "Watch later") and diffing the two captures' identical row found
  the real signal: the row's inner
  `<button class="ytButtonOrAnchorHost ...">` carries **`aria-pressed="false"`
  / `aria-pressed="true"`** — a genuine ARIA state attribute, locale- and
  translation-independent. Use this for matching, not the `aria-label` text
  (which does also change, e.g. `"Watch later, Prywatna, Niewybrany"` →
  `"...Wybrany"`, but that's Polish-only text — `aria-pressed` is the
  structural signal to rely on). The row's SVG bookmark icon `path` also
  changes shape between states (outline vs. filled/notch-removed) as a
  secondary, redundant visual cue — not needed once `aria-pressed` is used.
- Every row carries a small thumbnail (`yt-collection-thumbnail-view-model`),
  not needed for matching.
- 18 playlists were present (16 user-created + `Watch later` + `Shorts`,
  YouTube's two built-in system playlists) and **all 18 rendered directly in
  the DOM** inside a single `yt-list-view-model` with a fixed
  `max-height: 220px` (scrollable, presumably via plain CSS overflow — no
  `overflow` value captured explicitly, but no other scroll mechanism is
  present).

## Pagination — resolved, contradicts the original open question

**No continuation tokens, no lazy-load markers found anywhere in or near this
component.** The whole-page search for `continuationCommand` /
`continuationItemRenderer` only matched unrelated recommendation-sidebar
continuations elsewhere on the page, not this popup. All playlists for this
account (18, including 16 user-created) rendered in one shot inside the fixed-
height scrollable container.

This supports K's suspicion that pagination here was legacy behavior from the
older `ytd-add-to-playlist-renderer` popup (which may have paginated) and does
not apply to the current `yt-sheet-view-model` system. **Conclusion for the
scraper: don't build continuation/load-more handling.** A scroll-and-collect
pass over the fixed-height list container is what's needed if an account ever
has enough playlists to overflow it — untested here since 18 items apparently
fit without needing to scroll (would need an account with many more playlists,
or a forced small viewport, to confirm the overflow-scroll behavior itself
actually reveals more DOM nodes vs. just clipping). Keep this a ponytail-style
documented assumption (self-healing scraper, don't hard-fail if this changes)
per K's direction, not a hard guarantee.

## Create-new-playlist control

**Not a row inside the scrollable list** — it's a separate button in the
sheet's *footer*:

```
div.ytContextualSheetLayoutFooterContainer
  yt-panel-footer-view-model
    div.ytPanelFooterViewModelPrimaryButton
      button-view-model > button   ← this is "Create new playlist"
```

**Match this structurally, not by `aria-label` text** (K's direction — the
button's `aria-label="Utwórz nową playlistę"` is Polish-only, same problem the
`aria-label` on playlist rows had). It's the sheet's only footer primary
button — the sibling `ytPanelFooterViewModelButtonRowLeftButton` slot is
present but empty/hidden in every capture so far — so
`.ytContextualSheetLayoutFooterContainer .ytPanelFooterViewModelPrimaryButton button`
(or equivalent: "the footer's primary button") is a locale-independent
selector with no text matching needed. Its icon is a plain `+` (SVG path
`M12 3a1 1 0 00-1 1v7H4a1 1 0 000 2h7v7a1 1 0 002 0v-7h7a1 1 0 000-2h-7V4a1 1 0 00-1-1Z`)
— the same icon path also used by the masthead's global "Create" button
elsewhere on the page, confirming it's YouTube's general reusable "create"
icon, not specific to this sheet; not needed as a selector once the
structural footer-button path above is used, but useful corroboration.

Our own overlay UI can still choose to present create-new as an in-list "+"
row per K's UX decision (issue #16) — that's a presentational choice in our
overlay, independent of how the native popup lays it out.

**Post-click capture done (2026-08-07, K).** Clicking it opens a separate
`<yt-dialog-view-model>` (a real dialog, not another row/sheet inside the
original `yt-sheet-view-model`):

- Title field: `<textarea>` inside
  `yt-create-playlist-dialog-form-view-model .ytCreatePlaylistDialogFormViewModelTitleField`
  — not an `<input>`/`[contenteditable]`, which is why the original selector
  (`yt-sheet-view-model input, yt-sheet-view-model [contenteditable="true"]`)
  never matched anything live.
- Visibility dropdown defaults to "Prywatna" (Private) — matches K's request
  to keep created playlists private by default; left untouched by the driver.
- A "Nawiąż współpracę" (collaborate) switch, defaulted off — left untouched.
- Submit button: `.ytSpecDialogLayoutFooterContainer .ytPanelFooterViewModelPrimaryButton button`
  (aria-label "Utwórz"/Create), a genuine submit control distinct from the
  sheet's own footer button — same structural
  `.ytPanelFooterViewModelPrimaryButton` class pattern, different container.
  Dispatching an Enter keydown on the textarea does not submit (it's a
  multi-line field); the driver now clicks this button directly instead.
- Cancel button: `.ytPanelFooterViewModelButtonRowLeftButton button`
  (aria-label "Anuluj"), not currently used by the driver.

Selectors updated in `src/ui/playlist-popup-driver.js`
(`CREATE_NAME_INPUT_SELECTOR`, new `CREATE_DIALOG_SUBMIT_SELECTOR`).

## No batch "Done"/confirm button

No `aria-label="Gotowe"` (~"Done") button or equivalent was found anywhere in
the fragment or the full source page. This is consistent with K's statement
that the native popup only supports acting on one playlist per opening: each
row's checkbox toggle appears to apply immediately (add/remove) rather than
staging changes for a batch confirm. Not independently verified by clicking
(this is a static capture), but no confirm-button markup exists to stage
changes against, so a live "click toggles immediately" model is the working
assumption until confirmed by interaction.

## Sources

- `save-to-playlist-popup.html` — nothing selected (2026-08-07).
- `save-to-playlist-popup-selected.html` — same account, video already saved
  to "Watch later" (2026-08-07), used to diff and find the `aria-pressed`
  signal above.

## Follow-ups needed before implementation

1. ~~A capture with at least one playlist already containing the video~~ —
   **done**, see `save-to-playlist-popup-selected.html` and the resolved
   selected-state signal above.
2. ~~A capture of the **post-click state of "Utwórz nową playlistę"** (create-new
   name entry UI)~~ — **done**, see the create-dialog section above.
3. Confirm live (click, not just static capture) that a checkbox toggle
   applies immediately with no separate confirm step — still needed; not
   blocking a first implementation pass, since "toggle applies immediately"
   is YouTube's standard pattern elsewhere (e.g. like/dislike, subscribe) and
   can be verified during implementation instead of via another manual probe.
4. An account with enough playlists to actually overflow `max-height: 220px`,
   to confirm scrolling reveals more DOM nodes rather than the list being
   capped/virtualized — spun out to
   [#17](https://github.com/Kotmin/VideoDefaults/issues/17), not blocking
   #16.
