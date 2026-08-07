// Drives YouTube's native "Save to playlist" sheet off-screen/silently
// (issue #16) instead of showing it, mirroring queue-overlay.js's approach
// for "Add to queue". Selectors below are verified against a real captured
// DOM (docs/probes/save-to-playlist-dom-findings.md) — the newer
// yt-sheet-view-model system, matched structurally (aria-pressed state,
// footer button position) per K's direction to avoid locale text, never the
// legacy ytd-add-to-playlist-renderer popup.
const ROW_TOGGLE_SELECTOR = 'yt-list-view-model[role="menu"] toggleable-list-item-view-model button[aria-pressed]';
const CREATE_NEW_BUTTON_SELECTOR = '.ytContextualSheetLayoutFooterContainer .ytPanelFooterViewModelPrimaryButton button';
// Verified against a real captured DOM (K, 2026-08-07): clicking
// CREATE_NEW_BUTTON_SELECTOR opens a separate <yt-dialog-view-model>, not
// another row inside the sheet — the title field is a <textarea>, not an
// <input>/[contenteditable]. Structural selector, not the Polish "Tytuł"
// label text.
const CREATE_NAME_INPUT_SELECTOR = 'yt-create-playlist-dialog-form-view-model textarea';
// Same dialog's primary ("Utwórz"/Create) submit button. Distinguished from
// CREATE_NEW_BUTTON_SELECTOR by its container class
// (ytSpecDialogLayoutFooterContainer, the dialog's own footer) rather than
// aria-label text, which is locale-specific.
const CREATE_DIALOG_SUBMIT_SELECTOR = '.ytSpecDialogLayoutFooterContainer .ytPanelFooterViewModelPrimaryButton button';
const SHEET_SELECTOR = 'yt-sheet-view-model[slot="dropdown-content"]';
const POPUP_WAIT_TIMEOUT_MS = 1500;
const POPUP_WAIT_POLL_MS = 50;
const CLOSE_VERIFY_TIMEOUT_MS = 250;
const CLOSE_VERIFY_POLL_MS = 25;

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

// Undoes hideOpenSheet's overrides. Reported live: without this, the sheet
// stays permanently hidden after the first drive — YouTube reuses the same
// sheet DOM node across opens rather than remounting it, so the leftover
// !important styles also broke the native Save button, not just our own
// overlay flow. Called synchronously right before the Escape dispatch in
// closeSaveToPlaylistPopup so there's no intermediate paint to flash.
function restoreSheetVisibility(doc) {
  const sheet = doc.querySelector(SHEET_SELECTOR);
  if (!sheet) return;
  sheet.style.removeProperty('position');
  sheet.style.removeProperty('left');
  sheet.style.removeProperty('top');
  sheet.style.removeProperty('opacity');
  sheet.style.removeProperty('pointer-events');
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
// clicked, everything below is driving probe-verified DOM. Idempotent: if
// the sheet is already open (e.g. a prior close attempt didn't finish),
// re-clicking the trigger would toggle it shut instead of opening it — skip
// the click and just read whatever's already there. K reported stale data
// on a reopen right after an add; a same-cycle double-toggle-closed is the
// most likely cause given close was flaky (see closeSaveToPlaylistPopup).
export async function openSaveToPlaylistPopup(triggerButton, doc, win) {
  if (!isSheetOpen(doc)) triggerButton.click();
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

// Fills the title field of the real create-playlist dialog and clicks its
// own submit button — reported live: dispatching an Enter keydown never
// worked here because the field is a <textarea> (Enter inserts a newline,
// it doesn't submit), and the old input selector never matched a real
// element at all (see CREATE_NAME_INPUT_SELECTOR above), so nothing was
// ever typed and YouTube's own dialog was left sitting open empty.
// Leaves the dialog's visibility dropdown untouched — it already defaults
// to Private, which is the plugin's intended default (K, 2026-08-07).
// Self-healing: resolves false without throwing if the field or submit
// button never appear, so the caller can leave the overlay state untouched
// on failure.
export async function driveCreateNewPlaylist(doc, win, name) {
  if (!activateCreateNew(doc)) return false;
  const input = await waitForCreateInput(doc, win);
  if (!input) return false;
  input.focus();
  input.value = name;
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
  const submit = doc.querySelector(CREATE_DIALOG_SUBMIT_SELECTOR);
  if (!submit) return false;
  submit.click();
  return true;
}

function isSheetOpen(doc) {
  return !!doc.querySelector(SHEET_SELECTOR);
}

function waitForSheetClosed(doc, win) {
  return new Promise((resolve) => {
    const deadline = Date.now() + CLOSE_VERIFY_TIMEOUT_MS;
    (function poll() {
      if (!isSheetOpen(doc)) return resolve(true);
      if (Date.now() >= deadline) return resolve(false);
      win.setTimeout(poll, CLOSE_VERIFY_POLL_MS);
    }());
  });
}

// ponytail: no explicit close/cancel control was found in either probe
// capture (consistent with "no batch Done button" — see findings doc).
// Escape is YouTube's universal sheet-dismiss key elsewhere on the site but
// reported live as unreliable for this sheet (K found it left open at the
// end of a drive sequence) — verifies the close actually happened instead
// of trusting it blindly, and falls back to re-clicking the trigger (a
// standard toggle-button pattern) when Escape didn't work. Ceiling: if
// neither closes it, the sheet is left as-is rather than looping forever.
// Stays hidden throughout the attempt (K reported the verify wait itself
// being visibly on screen) — restoreSheetVisibility only runs at the very
// end, a no-op once the sheet is actually gone, a fallback so it's at least
// visible/usable if both close attempts failed.
export async function closeSaveToPlaylistPopup(doc, win, triggerButton) {
  if (isSheetOpen(doc)) {
    doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    if (!(await waitForSheetClosed(doc, win)) && triggerButton) {
      triggerButton.click();
      await waitForSheetClosed(doc, win);
    }
  }
  restoreSheetVisibility(doc);
}
