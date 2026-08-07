# "Save to playlist" popup — DOM findings

Captured 2026-08-07 by K from a real logged-in YouTube account (watch page,
video's ⋮ menu → "Save to..."). Source: a full "Save as complete" page save;
only the relevant fragment was kept as `save-to-playlist-popup.html` (the
`<yt-sheet-view-model>` subtree) — the rest of the saved page and its 19MB
asset folder were discarded as unnecessary bulk, and every real playlist name
in the kept fragment was replaced with a generic `Playlist A`..`Playlist P`
placeholder (`Watch later` and `Shorts`, YouTube's own system playlists, were
left as-is). Locale of the source account is Polish; only the alphabet/text
differs from other locales, not the structure.

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
- **No `aria-checked` or other ARIA state attribute.** Selected/unselected
  state is only exposed as the last comma-segment of `aria-label`, e.g.
  `"Playlist A, Publiczna, Niewybrany"` (Public, Unselected) — this capture
  has nothing checked, so the "selected" text value wasn't observed directly;
  need a second capture with at least one playlist already containing the
  video to confirm the exact selected-state string. **This is locale text**
  (Polish `Niewybrany`/`Wybrany`, `Publiczna`/`Prywatna`/`Niepubliczna`), so a
  real scraper can't match on it directly the same way the queue-overlay menu
  item text isn't matched — needs either a translation table or (preferably)
  a structural/icon-based signal once found. Not yet located in this capture;
  flagged as a follow-up probe target (does the row grow a checkmark icon
  element when selected? no icon-related class was found in this empty state,
  which is what we'd expect for the *unchecked* case, so it doesn't rule one
  in for the checked case).
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
sheet's *footer* (`ytContextualSheetLayoutFooterContainer` →
`yt-panel-footer-view-model`), `aria-label="Utwórz nową playlistę"`
(~"Create new playlist"). Our own overlay UI can still choose to present
create-new as an in-list "+" row per K's UX decision (issue #16) — that's a
presentational choice in our overlay, independent of how the native popup
lays it out. The scraper driving the native popup just needs to look for this
footer button separately from the list items, not expect a checkbox-shaped
row for it.

Clicking it was not captured in this session (this fragment shows the
pre-click state only) — a follow-up capture of what appears after clicking
"Utwórz nową playlistę" (a name-entry field? inline or a second sheet?) is
still needed before implementing the create-new flow.

## No batch "Done"/confirm button

No `aria-label="Gotowe"` (~"Done") button or equivalent was found anywhere in
the fragment or the full source page. This is consistent with K's statement
that the native popup only supports acting on one playlist per opening: each
row's checkbox toggle appears to apply immediately (add/remove) rather than
staging changes for a batch confirm. Not independently verified by clicking
(this is a static capture), but no confirm-button markup exists to stage
changes against, so a live "click toggles immediately" model is the working
assumption until confirmed by interaction.

## Follow-ups needed before implementation

1. A capture with **at least one playlist already containing the video**, to
   read the actual "selected" aria-label text/structural signal.
2. A capture of the **post-click state of "Utwórz nową playlistę"** (create-new
   name entry UI).
3. Confirm live (click, not just static capture) that a checkbox toggle
   applies immediately with no separate confirm step.
4. If possible, an account with enough playlists to actually overflow
   `max-height: 220px`, to confirm scrolling reveals more DOM nodes rather
   than the list being capped/virtualized.
