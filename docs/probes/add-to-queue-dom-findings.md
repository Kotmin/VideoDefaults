# "Add to queue" DOM findings

Captured via Playwright MCP (Firefox) live navigation against real youtube.com, cross-checked
against `ytInitialData` JSON extracted from `curl`-fetched SSR HTML (`Accept-Language: en-US,en;q=0.9`,
Chrome UA) for pages where live hydration was unreliable. Polish locale confirmed live via
`document.cookie = "hl=pl; PREF=...&hl=pl"` + reload (query param `?hl=pl` alone was ignored/stripped).

## Contexts captured

| Context | Renderer | Live DOM confirmed | JSON confirmed |
|---|---|---|---|
| Home feed | `ytd-rich-item-renderer` > `yt-lockup-view-model` | yes | yes |
| Search results | `ytd-video-renderer` (legacy) | partial (button never renders, see below) | yes |
| Search results — Shorts shelf | `ytm-shorts-lockup-view-model` variant | yes (popup opened) | yes |
| Channel videos grid | `ytd-rich-item-renderer` > `yt-lockup-view-model` | yes (popup opened, incl. Polish) | yes |
| Playlist page | `yt-lockup-view-model` (no `ytd-rich-item-renderer` wrapper) | yes (selector present, not clicked) | yes |
| Watch page "Up next" | `yt-lockup-view-model` (no wrapper, same as playlist) | no (page never hydrates, see below) | yes |

## Two rendering systems

YouTube currently mixes two component systems on the pages that matter for this feature:

- **Legacy Polymer** (`ytd-*`, shady DOM): only `ytd-video-renderer` on the search results page still
  uses this. Its triple-dot button lives in an initially-empty `<div id="menu">` that is populated
  lazily. In this Playwright+Firefox session it **never populated** — not via synthetic
  `mouseover`/`pointerenter` events, not via the `browser_hover` MCP tool, not via real
  `page.mouse.move()` sequences (3 independent methods tried, all failed identically). Likely tied to
  `navigator.webdriver === true` bot-detection suppressing the hover-triggered template stamp on this
  specific legacy component (the newer components below did not have this problem). Selectors below
  for this context are JSON-derived only, not live-DOM-confirmed.
- **New view-model / Lit** (`yt-*-view-model`): used everywhere else — home feed, channel grid,
  playlist, watch sidebar, and the Shorts shelf on search. The trigger button is a plain, always-present
  `<button>` (no lazy hover-gating), which is why every live capture below comes from this system.

## Selectors

### Container + trigger button (view-model system — home/channel/playlist/watch-sidebar)

```
yt-lockup-view-model                              # card root; class includes "content-id-<VIDEO_ID>"
  a[href^="/watch?v="]                             # also yields the video ID
  .ytLockupMetadataViewModelMenuButton button       # triple-dot trigger — NOT text/aria-label based
```

`div.ytLockupMetadataViewModelMenuButton` is a structural, non-translated CSS class — confirmed to
survive the Polish locale switch (the `<button>` inside still has `aria-label="Więcej działań"` in
Polish vs `"More actions"` in English, but the class-based selector doesn't care). This is the
locale-independent selector to use; do **not** select by `aria-label="More actions"` text.

Container tag differs by context:
- Home feed / channel grid: `ytd-rich-item-renderer > yt-lockup-view-model`
- Playlist page / watch "Up next": bare `yt-lockup-view-model` inside a plain `<div>` (no
  `ytd-rich-item-renderer` wrapper) — confirmed both live (playlist) and via JSON (watch sidebar).

### Popup portal

```
ytd-popup-container                    # singleton, lives inside ytd-app, NOT a direct child of <body>
  tp-yt-iron-dropdown
    #contentWrapper
      yt-sheet-view-model[slot="dropdown-content"]
        yt-contextual-sheet-layout
          yt-list-view-model[role="menu"]
            yt-list-item-view-model[role="menuitem"]   # one per menu item
              button .ytListItemViewModelTitle          # translated text lives here
```

### "Add to queue" item — no reliable DOM icon marker found

The underlying data model has a genuinely locale-independent icon identifier
(`iconName`/`imageName`/`iconType` = `"ADD_TO_QUEUE_TAIL"`, trigger = `"MORE_VERT"`), confirmed
consistently across all 6 contexts' JSON. **However this does not surface as a DOM attribute.**
Every `yt-list-item-view-model`'s icon wrapper (`span.ytIconWrapperHost > span.yt-icon-shape`) was
checked and found completely generic and empty — no distinguishing class, no
`background-image`/`mask-image`/`webkit-mask-image` (all `"none"` via `getComputedStyle`), no shadow
DOM, no `<svg>`/`<img>`, no `content` on `::before`. This was verified on **two independent live
popups** (Shorts shelf on search, channel-grid card) with identical results both times — this is a
confirmed finding, not a single fluke sample.

**Confirmed working alternative: position.** "Add to queue" was item **index 0** (first item) in
every live popup captured (Shorts: 2 items, channel: 4 items) and in every JSON sample checked
(search legacy `videoRenderer.menu`, channel/playlist/watch `lockupViewModel.menuButton`) — always
first when present. Combined with the structural non-text button selector above, a pragmatic
locale-independent implementation is:

```js
document.querySelectorAll('yt-list-item-view-model[role="menuitem"]')[0]
```

Recommend NOT hard-coding `[0]` blindly — pair it with a small multilingual text allowlist
(`Add to queue`, `Dodaj do kolejki`, ...) as a sanity check / fallback, since position-0 is an
empirical observation across a handful of samples, not a documented contract.

Confirmed live in Polish (`?hl=pl` cookie trick): popup titles were
`["Dodaj do kolejki", "Zapisz na playliście", "Pobierz", "Udostępnij"]` — "Add to queue" still item 0.
See `add-to-queue-popup-pl.html` (sibling file) for the full captured markup.

### Legacy `ytd-video-renderer` (search results) — JSON only

```json
"menu": { "menuRenderer": { "items": [
  { "menuServiceItemRenderer": { "icon": { "iconType": "ADD_TO_QUEUE_TAIL" }, "text": {...} } },
  ...
]}}
```

Same enum, same position-0 pattern. DOM container is `ytd-video-renderer #menu` (currently always
empty in this environment — see limitation above). If a real (non-automated) browser renders this
normally, the legacy `ytd-menu-service-item-renderer` typically exposes icon type via a `<yt-icon
icon="...">` custom element attribute (a known legacy YouTube convention) — this was **not**
independently confirmed live and should be re-checked by whoever implements this, since it could not
be reproduced in this session.

## Exceptions to "every card has Add to queue" (task step 4)

- **Live streams**: contradicts the assumption — a `[LIVE]`-badged item on the home feed **did**
  have "Add to queue" as item 0 in its popup (same 4 items as a normal video: queue/save/download/share).
  Not exhaustively tested (only one live sample), but this is empirical evidence against blanket-excluding
  live content.
- **Shorts**: confirmed to have "Add to queue" via their "More actions" popup, but with a reduced
  item set (`["Add to queue", "Send feedback"]` only — no save/download/share). Still item 0.
- **Currently-playing video on its own watch page**: not applicable — it's the player, not a card,
  no triple-dot menu exists for it in this UI.
- **Mixes/radio**: not tested — none appeared in the sampled feed/search pages within the time budget.
  Flag as unverified.
- **Watch page "Up next" sidebar**: never reached live (page consistently fails to hydrate — see
  below); JSON confirms the same `lockupViewModel`/`ADD_TO_QUEUE_TAIL` shape as playlist, so no
  exception is expected there, but unconfirmed live.

## Environment limitation: some pages never hydrate

`ytd-page-manager` had **zero children** on the home page and watch page across 4+ separate
navigation attempts and wait times (4s–8s), even though `window.ytInitialData`/`ytcfg` are present
and all custom elements are registered. This was NOT the case for search results or the channel/
playlist pages, which hydrated reliably within 4-6s. Root cause not conclusively proven, but
circumstantial evidence points at `navigator.webdriver === true` (confirmed `true` in this session)
triggering a degraded/skeleton experience for some page types — the watch page's video player
rendered directly under `<body>` (`#movie_player` → `#player-wrap` → `#player` → `body`), completely
outside the `ytd-app`/`ytd-page-manager` SPA tree, on every attempt. Whoever implements the feature
should re-verify the watch-page "Up next" sidebar selectors against a live, non-automated browser
session before shipping.

## curl SSR fetch gotcha

Plain `curl` (no `-L`) against channel (`/@handle/videos`) and playlist URLs returned `size=0` —
YouTube issues a redirect (to `?cbrd=1&ucbcb=1`, a cookie/consent bootstrap redirect) that must be
followed with `-L`. Once added, both fetched fine (200, ~1.2-2.1 MB). Search and watch URLs did not
need `-L`.

## Files

- `add-to-queue-video-card.html` — outerHTML of a `yt-lockup-view-model` card (channel grid, Polish
  locale), showing the `content-id-<VIDEO_ID>` class and the `.ytLockupMetadataViewModelMenuButton`
  structural selector for the trigger.
- `add-to-queue-popup-pl.html` — outerHTML of the open `tp-yt-iron-dropdown` popup in Polish,
  confirming "Add to queue" (`Dodaj do kolejki`) is item 0 and that icon spans are empty in every
  locale checked.

## Independent re-verification (second Playwright session)

Re-ran the home-feed trigger-button click and menu-item inspection independently (Polish locale
picked up automatically from the environment this time, no cookie trick needed). Confirmed:
- `div.ytLockupMetadataViewModelMenuButton button` opens the menu reliably.
- `yt-list-item-view-model[role="menuitem"]`'s only own-properties are Lit signal internals
  (`_signalProps`, `_signalValues`) holding `["ytListItemViewModelHost", null, "menuitem"]` — no
  icon/type data reachable synchronously from the element, confirming the "no JS-property escape
  hatch" hypothesis (this session checked for one; the original session only checked DOM/CSS/shadow
  DOM). Position-0 stands as the only usable signal.
- Direct `page.goto()` to a watch URL never mounts `#page-manager` (0 children) even after an 8s wait,
  same failure as the original session — confirms this is a stable environment limitation, not a
  fluke, and reinforces that the Up Next sidebar needs a real-browser (non-automated-nav) check before
  shipping, e.g. via this repo's own Firefox e2e harness which drives real in-app navigation.

**Decision for implementation:** use position-0 as the primary and only signal (no multilingual text
dictionary) — it's been confirmed in 2 locales across 2 independent sessions and this repo's existing
e2e suite will catch a regression immediately if YouTube ever reorders the menu. Documented as a
`ponytail:` ceiling in code.

## Correction: Shorts trigger button was never actually covered

The table above and the "Two rendering systems" section correctly identify Shorts as rendering via
`ytm-shorts-lockup-view-model`, a component distinct from `yt-lockup-view-model` — but the trigger
selector that shipped (`.ytLockupMetadataViewModelMenuButton button`) only matches
`yt-lockup-view-model`'s wrapper markup. Shorts' trigger button is styled identically and shares the
same `aria-label`/button classes, but sits inside a different wrapper:
`.shortsLockupViewModelHostOutsideMetadataMenu`. Since the two components were (incorrectly) treated
as interchangeable when the selector was written, Shorts cards were silently excluded from the queue
overlay in production — reported by a user, reproduced and confirmed live (watch-page "Up next"
sidebar, real youtube.com, 2026-08-06). Fixed by adding the Shorts wrapper class as a second branch of
the trigger selector in `src/ui/queue-overlay.js`; the popup/activation logic needed no change since
Shorts' "Add to queue" is item 0 in its (shorter, 2-item) menu, same as everywhere else.
