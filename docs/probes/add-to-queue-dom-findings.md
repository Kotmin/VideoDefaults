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

## Follow-up session (2026-08-06): ads, legacy menu items, live streams, double-add/stuck-menu

- **Genuine ad slots confirmed to have no queue option.** `ytd-in-feed-ad-layout-renderer` >
  `ytd-ad-slot-renderer` renders via `yt-lockup-view-model` but with a different button-group
  wrapper (`video-display-compact-button-group-layout-view-model`, not
  `.ytLockupMetadataViewModelMenuButton`) and only exposes an "Ad Center" (ad-transparency)
  button — no "more actions"/queue menu at all. Native YouTube behavior, not a gap.
- **Live streams confirmed structurally covered.** A `[LIVE]`-badged card uses the same
  `yt-lockup-view-model` component as a regular video, with "Add to queue" as item 0 of the same
  4-item menu. No separate handling needed; the existing trigger/menu-item selectors already
  cover it.
- **Legacy `ytd-video-renderer` menu-item shape confirmed via user-supplied live XPath**:
  `//*[@id="items"]/ytd-menu-service-item-renderer[1]/tp-yt-paper-item/div/yt-formatted-string`.
  Item element is `ytd-menu-service-item-renderer` (not `yt-list-item-view-model`), "Add to
  queue" still position 0. Added as a second branch of `QUEUE_MENU_ITEM_SELECTOR` in
  `src/ui/queue-overlay.js`. The trigger-button side of this popup is still unreachable from
  automation (see the "Two rendering systems" section above and the repeated hover-stamping
  failures below) — this change is evidence-backed but only the menu-item half could be
  verified; the trigger half needs a real (non-automated) browser session.
- **Repeated confirmation the legacy hover-gated trigger can't be forced from automation**: a
  4th independent attempt (Playwright MCP, `browser_hover` with `:nth-of-type(1)` to dodge a
  strict-mode violation) timed out waiting for "visible and stable" despite the element's own
  `getBoundingClientRect()` confirming it was on-screen. Consistent with every prior attempt in
  this doc — treated as a confirmed environment ceiling, not re-attempted further.
- **Double-add / stuck-open-menu root cause**: `ytd-popup-container`'s popup DOM nodes are
  *recycled* across different triggers — clicking a second trigger while a popup is open reuses
  the exact same item element object (confirmed via reference equality, `===`, across two
  back-to-back trigger clicks). This means the old `activateQueueTarget` implementation's
  "resolve as soon as `querySelector` finds any menu item" could resolve instantly against a
  popup that still belonged to (or was mid-transition from) a different, previously-clicked
  target, and click before YouTube had rebound the item to the new target. Fixed by adding a
  two-`requestAnimationFrame` settle delay after the trigger click, before polling begins, plus
  a simple in-flight guard so a second `activateQueueTarget` call can't overlap a first.
  - A candidate fix of checking YouTube's own `tp-yt-iron-dropdown.opened` JS property (or its
    computed `display`) as a readiness signal was tried and discarded: `.opened` is a plain JS
    instance property set by Polymer/page code running in the page's *main world*, and is
    invisible to an extension content script's *isolated world* even though both worlds see the
    same underlying DOM node — confirmed by instrumenting the actual built extension against a
    static fixture (`opened` read back as `undefined` from the content script despite being set
    to `true` by the fixture's own inline script). Checking `getComputedStyle(...).display`
    instead was also tried and produced inconsistent/contradictory readings across repeated live
    probes (`display: none` in one capture, `display: block` for both open and closed states in
    a later one on the same page) — not reliable enough to build a fix on. The
    animation-frame-delay approach avoids both problems since `requestAnimationFrame` is a
    platform primitive with no cross-world visibility issue and doesn't depend on reading any
    YouTube-internal state at all.

## Follow-up: search-results page had zero queue coverage (trigger-selector gap, not just hover)

A user reported the queue overlay producing **no response at all** on
`https://www.youtube.com/results?search_query=...` in both real Firefox and Chrome — even after
manually hovering a card so its `#menu button` was confirmed on-screen and populated. That ruled
out hover-gating as the (sole) explanation: `QUEUE_TRIGGER_SELECTOR` never had a legacy-shape
branch at all, so `collectQueueTargets` couldn't find a legacy button even once it existed. Fixed
in two parts:

- **Definite fix**: added `ytd-video-renderer #menu button` as a third branch of
  `QUEUE_TRIGGER_SELECTOR`. Covers any legacy card whose button has already stamped in (real user
  hover, or — as this segment's `TC-18` Firefox e2e case demonstrates — simply having a populated
  fixture button, no hover simulation needed). Verified: Chrome smoke test's fixture gained a
  pre-populated legacy card and the queue-label count went from 2 to 3; unit tests cover the
  merge/dedupe logic in `collectQueueTargets`.
- **Best-effort fix (unverified, shipped per explicit user request)**: `collectQueueTargets` also
  collects `ytd-video-renderer` cards whose `#menu button` has *not* stamped in yet as fallback
  targets, and `activateQueueTarget` dispatches a synthetic hover-event sequence
  (`pointerover`/`pointerenter`/`mouseover`/`mouseenter`) at activation time, waits 300ms, then
  looks for the button. This exact mechanism (synthetic `dispatchEvent`-based hover) was already
  shown to fail against live YouTube in this doc's earlier sessions, and real CDP-level
  `page.mouse.move()` against this same card additionally **hung indefinitely (120s+, twice)** in
  a follow-up attempt — so this part could not be verified here at all. It ships because the user
  explicitly chose "ship it, I'll test it" over leaving the case entirely uncovered; needs
  real-browser confirmation before being considered actually fixed.
- **Live confirmation of the definite fix's real-world impact**: added `TC-18` to the Firefox e2e
  suite, navigating to the exact reported URL
  (`https://www.youtube.com/results?search_query=king+baldwin`). It found 4 real
  `ytd-video-renderer` cards and the queue overlay rendered 6 labels for them — before this fix,
  that page produced 0 queue labels since none of the pre-existing selector branches matched
  anything there. `TC-18` deliberately does not attempt to click through a label, since that would
  exercise the unverified hover-forcing path described above.
