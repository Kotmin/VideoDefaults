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
const QUEUE_MENU_ITEM_SELECTOR = 'ytd-popup-container yt-list-item-view-model[role="menuitem"]';
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

// ponytail: YouTube exposes no locale- or icon-based marker for "Add to queue" in the
// popup DOM (verified empty icon spans across two independent live sessions, EN + PL) —
// only its consistent first-item position. Upgrade to a real marker if YouTube ever adds
// one, or if the e2e suite (docs/specs/keyboard-shortcuts.md) catches a reorder.
export async function activateQueueTarget(triggerButton, doc, win) {
  triggerButton.click();
  const item = await waitForFirstMenuItem(doc, win);
  if (!item) return false;
  item.click();
  return true;
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
