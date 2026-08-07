// Drives YouTube's native "Save to playlist" sheet off-screen/silently
// (issue #16) instead of showing it, mirroring queue-overlay.js's approach
// for "Add to queue". Selectors below are verified against a real captured
// DOM (docs/probes/save-to-playlist-dom-findings.md) — the newer
// yt-sheet-view-model system, matched structurally (aria-pressed state,
// footer button position) per K's direction to avoid locale text, never the
// legacy ytd-add-to-playlist-renderer popup.
const ROW_TOGGLE_SELECTOR = 'yt-list-view-model[role="menu"] toggleable-list-item-view-model button[aria-pressed]';
const CREATE_NEW_BUTTON_SELECTOR = '.ytContextualSheetLayoutFooterContainer .ytPanelFooterViewModelPrimaryButton button';
const CREATE_NAME_INPUT_SELECTOR = 'yt-sheet-view-model input, yt-sheet-view-model [contenteditable="true"]';
const SHEET_SELECTOR = 'yt-sheet-view-model[slot="dropdown-content"]';
const POPUP_WAIT_TIMEOUT_MS = 1500;
const POPUP_WAIT_POLL_MS = 50;

// Reported live: without this, the sheet is genuinely visible on screen for
// the whole drive sequence (open/toggle/close per playlist), not the
// "off-screen/silently" behavior this module already claimed. Hides the
// sheet itself rather than depending on the unverified Escape-close below —
// stays correct even if that close never actually unmounts it.
function hideOpenSheet(doc) {
  const sheet = doc.querySelector(SHEET_SELECTOR);
  if (!sheet) return;
  sheet.style.setProperty('position', 'fixed', 'important');
  sheet.style.setProperty('left', '-9999px', 'important');
  sheet.style.setProperty('top', '-9999px', 'important');
  sheet.style.setProperty('opacity', '0', 'important');
  sheet.style.setProperty('pointer-events', 'none', 'important');
}

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
  const rows = await waitForRows(doc, win);
  if (rows.length > 0) hideOpenSheet(doc);
  return rows;
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

function waitForCreateInput(doc, win) {
  return new Promise((resolve) => {
    const deadline = Date.now() + POPUP_WAIT_TIMEOUT_MS;
    (function poll() {
      const input = doc.querySelector(CREATE_NAME_INPUT_SELECTOR);
      if (input) return resolve(input);
      if (Date.now() >= deadline) return resolve(null);
      win.setTimeout(poll, POPUP_WAIT_POLL_MS);
    }());
  });
}

// UNVERIFIED: the DOM after clicking "Create new playlist" was never
// captured (see docs/ai/questions-for-K.md). Best-effort per K's direction —
// assumes an inline text field appears inside the same sheet, and submits it
// with Enter. Self-healing: resolves false without throwing if no field
// appears within the timeout, so the caller can leave the overlay state
// untouched on failure.
export async function driveCreateNewPlaylist(doc, win, name) {
  if (!activateCreateNew(doc)) return false;
  const input = await waitForCreateInput(doc, win);
  if (!input) return false;
  input.focus();
  input.value = name;
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
  input.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
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
