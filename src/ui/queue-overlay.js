import { collectVisibleTargets, BADGE_STYLE } from './jump-overlay.js';

// ponytail: Shorts lockups use a different wrapper class for the same "more actions"
// button (shared aria-label/class on the button itself, but that class is also reused
// by like/dislike/share buttons elsewhere, so matching on the wrapper stays specific).
// Sponsored (paid-promotion-badged) videos reuse the regular yt-lockup-view-model
// component and are already covered by the first selector.
const QUEUE_TRIGGER_SELECTOR = [
  '.ytLockupMetadataViewModelMenuButton button',
  '.shortsLockupViewModelHostOutsideMetadataMenu button',
  // Legacy search-result cards, once their button has already stamped in from a real hover.
  'ytd-video-renderer #menu button',
].join(', ');
// ponytail: legacy `ytd-video-renderer` search-result cards render their "..." trigger button
// lazily, only into `#menu`, on genuine mouse hover — confirmed as universal YouTube behavior
// (reported by the user in real, non-automated Firefox/Chrome), not automation-specific. A card
// whose button hasn't stamped yet is collected as a fallback target so it still gets a label;
// activateQueueTarget forces a synthetic hover sequence on it before looking for the button.
// That hover-forcing is best-effort and UNVERIFIED here: synthetic dispatchEvent and even real
// CDP mouse movement both failed/hung against this exact card in this repo's test harness (see
// docs/probes/add-to-queue-dom-findings.md), so it may simply not work — needs real-browser
// confirmation.
const LEGACY_CARD_SELECTOR = 'ytd-video-renderer';
const LEGACY_CARD_BUTTON_SELECTOR = '#menu button';
const LEGACY_HOVER_SETTLE_MS = 300;
// ponytail: legacy search-result cards (`ytd-video-renderer`) open a Polymer popup shaped
// differently from the view-model system's — items are `ytd-menu-service-item-renderer`
// under `#items`, not `yt-list-item-view-model [role="menuitem"]`. Confirmed via a real XPath
// captured from a live browser. Position 0 is "Add to queue" here too, same as the
// view-model shape.
// YouTube moved `role="menuitem"` off `yt-list-item-view-model` itself and onto its inner
// `<button>`/`<a>` (confirmed live, 2026-08-16) — the wrapper is now `role="presentation"`.
// Selecting the descendant instead of the wrapper keeps position-0 = "Add to queue".
const QUEUE_MENU_ITEM_SELECTOR = [
  'ytd-popup-container yt-list-item-view-model [role="menuitem"]',
  'ytd-popup-container ytd-menu-service-item-renderer',
].join(', ');
const MENU_WAIT_TIMEOUT_MS = 1500;
const MENU_WAIT_POLL_MS = 50;
const CONFIRMATION_DURATION_MS = 1400;
const CONFIRMATION_FADE_MS = 300;

function isLegacyCard(el) {
  return el.tagName === 'YTD-VIDEO-RENDERER';
}

export function collectQueueTargets(doc, win) {
  const populated = [...doc.querySelectorAll(QUEUE_TRIGGER_SELECTOR)];
  const unstampedLegacyCards = [...doc.querySelectorAll(LEGACY_CARD_SELECTOR)]
    .filter((card) => !card.querySelector(LEGACY_CARD_BUTTON_SELECTOR));
  return collectVisibleTargets(doc, win, [...populated, ...unstampedLegacyCards]);
}

// ponytail: the two-frame settle delay below narrowed but didn't close the recycling race —
// on a fast repeat activation the poll can still find the *same* node we clicked last time,
// still bound to the previous target, and re-click it (reported as a double-add: video A
// added twice instead of A then B). Node identity survives a rebind (confirmed live), so
// requiring the polled item to differ from the one we ourselves clicked last is a real
// content signal, not a timing guess: it keeps polling until YouTube actually swaps in a
// fresh (or freshly rebound) node, up to the same timeout. First-ever activation is
// unaffected (lastActivatedItem starts null, so any found item passes immediately). If the
// deadline passes without a change (e.g. the same target activated twice in a row, or a case
// where YouTube genuinely never replaces the node), falls back to whatever's there — no worse
// than the pre-fix behavior.
let lastActivatedItem = null;

function waitForFreshMenuItem(doc, win) {
  return new Promise((resolve) => {
    const deadline = Date.now() + MENU_WAIT_TIMEOUT_MS;
    (function poll() {
      const item = doc.querySelector(QUEUE_MENU_ITEM_SELECTOR);
      if (item && item !== lastActivatedItem) return resolve(item);
      if (Date.now() >= deadline) return resolve(item || null);
      win.setTimeout(poll, MENU_WAIT_POLL_MS);
    }());
  });
}

// ponytail: gives YouTube's render cycle two animation frames to start settling before
// polling begins — cheap and world-agnostic (a content script can't read YouTube's own
// "opened" state; it's a JS instance property set in the main world, invisible from the
// isolated world; tried and confirmed unusable). waitForFreshMenuItem above is what
// actually closes the recycling race this alone couldn't.
function nextFrame(win) {
  return new Promise((resolve) => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
}

let activationInFlight = false;

function forceLegacyHover(card, win) {
  return new Promise((resolve) => {
    for (const type of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter']) {
      card.dispatchEvent(new win.MouseEvent(type, { bubbles: true, cancelable: true, view: win }));
    }
    win.setTimeout(resolve, LEGACY_HOVER_SETTLE_MS);
  });
}

// ponytail: YouTube exposes no locale- or icon-based marker for "Add to queue" in the
// popup DOM (verified empty icon spans across two independent live sessions, EN + PL) —
// only its consistent first-item position. Upgrade to a real marker if YouTube ever adds
// one, or if the e2e suite (docs/specs/keyboard-shortcuts.md) catches a reorder.
export async function activateQueueTarget(triggerButton, doc, win) {
  if (activationInFlight) return false;
  activationInFlight = true;
  try {
    let button = triggerButton;
    if (isLegacyCard(triggerButton)) {
      await forceLegacyHover(triggerButton, win);
      button = triggerButton.querySelector(LEGACY_CARD_BUTTON_SELECTOR);
      if (!button) return false;
    }
    button.click();
    await nextFrame(win);
    const item = await waitForFreshMenuItem(doc, win);
    if (!item) return false;
    item.click();
    lastActivatedItem = item;
    return true;
  } finally {
    activationInFlight = false;
  }
}

export function showQueueConfirmation(doc, rect) {
  const badge = doc.createElement('span');
  badge.setAttribute('data-videodefaults-queue-confirm', '');
  badge.textContent = 'Added to queue';
  badge.setAttribute('style', BADGE_STYLE
    + '; background: #1a7f37; border-color: #1a7f37; color: #fff'
    + `; transition: opacity ${CONFIRMATION_FADE_MS}ms`
    + `; top: ${Math.max(0, rect.top)}px; left: ${Math.max(0, rect.left)}px`);
  doc.body.appendChild(badge);
  setTimeout(() => { badge.style.opacity = '0'; }, CONFIRMATION_DURATION_MS - CONFIRMATION_FADE_MS);
  setTimeout(() => badge.remove(), CONFIRMATION_DURATION_MS);
}
