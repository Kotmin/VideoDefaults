// Drives YouTube's native "Save to playlist" sheet off-screen/silently
// (issue #16) instead of showing it, mirroring queue-overlay.js's approach
// for "Add to queue". Selectors below are verified against a real captured
// DOM (docs/probes/save-to-playlist-dom-findings.md) — the newer
// yt-sheet-view-model system, matched structurally (aria-pressed state,
// footer button position) per K's direction to avoid locale text, never the
// legacy ytd-add-to-playlist-renderer popup.
const ROW_TOGGLE_SELECTOR = 'yt-list-view-model[role="menu"] toggleable-list-item-view-model button[aria-pressed]';
const CREATE_NEW_BUTTON_SELECTOR = '.ytContextualSheetLayoutFooterContainer .ytPanelFooterViewModelPrimaryButton button';
const POPUP_WAIT_TIMEOUT_MS = 1500;
const POPUP_WAIT_POLL_MS = 50;

function parsePlaylistName(ariaLabel) {
  // ponytail: name is the first comma-separated segment of the row's own
  // aria-label ("{name}, {visibility}, {selected-state}", confirmed in probe
  // captures). This is the user's own playlist title, not locale UI text, so
  // it doesn't conflict with K's no-locale-text-matching rule for STATE —
  // but a playlist named with a literal comma would still misparse; no such
  // case was in the captured account (18 playlists, none with a comma).
  return (ariaLabel ?? '').split(',')[0].trim();
}

export function scrapePlaylistRows(doc) {
  return [...doc.querySelectorAll(ROW_TOGGLE_SELECTOR)].map((button) => ({
    name: parsePlaylistName(button.getAttribute('aria-label')),
    selected: button.getAttribute('aria-pressed') === 'true',
    element: button,
  }));
}

export function findCreateNewButton(doc) {
  return doc.querySelector(CREATE_NEW_BUTTON_SELECTOR);
}

function waitForRows(doc, win) {
  return new Promise((resolve) => {
    const deadline = Date.now() + POPUP_WAIT_TIMEOUT_MS;
    (function poll() {
      const rows = scrapePlaylistRows(doc);
      if (rows.length > 0) return resolve(rows);
      if (Date.now() >= deadline) return resolve([]);
      win.setTimeout(poll, POPUP_WAIT_POLL_MS);
    }());
  });
}

// UNVERIFIED entry point: the DOM probes only captured this sheet already
// open, never how the watch page's own action row triggers it — see
// docs/ai/questions-for-K.md. The caller supplies triggerButton (same
// dependency-injection shape as queue-overlay's activateQueueTarget); once
// clicked, everything below is driving probe-verified DOM.
export async function openSaveToPlaylistPopup(triggerButton, doc, win) {
  triggerButton.click();
  return waitForRows(doc, win);
}

export function togglePlaylistRow(row) {
  row.element.click();
}

export function activateCreateNew(doc) {
  const button = findCreateNewButton(doc);
  if (!button) return false;
  button.click();
  return true;
}

// ponytail: no explicit close/cancel control was found in either probe
// capture (consistent with "no batch Done button" — see findings doc).
// Escape is YouTube's universal sheet-dismiss key elsewhere on the site;
// self-healing best-effort here, not independently confirmed for this
// specific sheet by a live click.
export function closeSaveToPlaylistPopup(doc, win) {
  doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}
