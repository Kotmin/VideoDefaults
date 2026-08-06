import { collectVisibleTargets, BADGE_STYLE } from './jump-overlay.js';

// ponytail: Shorts lockups use a different wrapper class for the same "more actions"
// button (shared aria-label/class on the button itself, but that class is also reused
// by like/dislike/share buttons elsewhere, so matching on the wrapper stays specific).
// Sponsored (paid-promotion-badged) videos reuse the regular yt-lockup-view-model
// component and are already covered by the first selector.
const QUEUE_TRIGGER_SELECTOR = [
  '.ytLockupMetadataViewModelMenuButton button',
  '.shortsLockupViewModelHostOutsideMetadataMenu button',
].join(', ');
// ponytail: legacy search-result cards (`ytd-video-renderer`) open a Polymer popup shaped
// differently from the view-model system's — items are `ytd-menu-service-item-renderer`
// under `#items`, not `yt-list-item-view-model[role="menuitem"]`. Confirmed via a real XPath
// captured from a live browser (the trigger button itself is hover-gated and unreachable
// from this repo's automated test harnesses, so this branch is evidence-backed but not
// live-clickthrough-tested end to end — see docs/probes/add-to-queue-dom-findings.md).
// Position 0 is "Add to queue" here too, same as the view-model shape.
const QUEUE_MENU_ITEM_SELECTOR = [
  'ytd-popup-container yt-list-item-view-model[role="menuitem"]',
  'ytd-popup-container ytd-menu-service-item-renderer',
].join(', ');
const MENU_WAIT_TIMEOUT_MS = 1500;
const MENU_WAIT_POLL_MS = 50;
const CONFIRMATION_DURATION_MS = 1400;
const CONFIRMATION_FADE_MS = 300;

export function collectQueueTargets(doc, win) {
  return collectVisibleTargets(doc, win, QUEUE_TRIGGER_SELECTOR);
}

function waitForFirstMenuItem(doc, win) {
  return new Promise((resolve) => {
    const deadline = Date.now() + MENU_WAIT_TIMEOUT_MS;
    (function poll() {
      const item = doc.querySelector(QUEUE_MENU_ITEM_SELECTOR);
      if (item) return resolve(item);
      if (Date.now() >= deadline) return resolve(null);
      win.setTimeout(poll, MENU_WAIT_POLL_MS);
    }());
  });
}

// ponytail: YouTube's popup container recycles the same item nodes across targets
// (confirmed live) instead of creating fresh ones, so a menu item can already exist
// in the DOM for the *previous* target the instant we click a new trigger — reading
// it on the very next tick can act on stale content. A content script also can't read
// YouTube's own internal "opened" state (it's a plain JS instance property set by
// page code in the main world, invisible from the extension's isolated world; tried
// and confirmed unusable). Instead, give YouTube's render cycle two animation frames
// to settle before polling — cheap, world-agnostic, and covers the observed race.
function nextFrame(win) {
  return new Promise((resolve) => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
}

let activationInFlight = false;

// ponytail: YouTube exposes no locale- or icon-based marker for "Add to queue" in the
// popup DOM (verified empty icon spans across two independent live sessions, EN + PL) —
// only its consistent first-item position. Upgrade to a real marker if YouTube ever adds
// one, or if the e2e suite (docs/specs/keyboard-shortcuts.md) catches a reorder.
export async function activateQueueTarget(triggerButton, doc, win) {
  if (activationInFlight) return false;
  activationInFlight = true;
  try {
    triggerButton.click();
    await nextFrame(win);
    const item = await waitForFirstMenuItem(doc, win);
    if (!item) return false;
    item.click();
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
