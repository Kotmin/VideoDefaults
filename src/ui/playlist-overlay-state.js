import { filterPlaylistsByQuery } from '../core/fuzzy-match.js';

// Virtual last row, always shown regardless of query/match state (issue #16).
export const CREATE_NEW_ROW = Symbol('create-new');
const MAX_CONFIRM_SELECTION = 5;

// Playlists the current video is already in are pre-checked (issue #16
// follow-up) so unchecking one and confirming reads as "remove from this
// playlist" — see resolveEnter's diff against the original selected flags.
export function createOverlayState(playlists) {
  return {
    playlists,
    query: '',
    highlightIndex: 0,
    checked: new Set(playlists.filter((p) => p.selected).map((p) => p.name)),
    touched: false,
    subDialog: null,
  };
}

export function visibleRows(state) {
  return filterPlaylistsByQuery(state.playlists, state.query);
}

function rowCount(state) {
  return visibleRows(state).length + 1;
}

function highlightedRow(state) {
  const rows = visibleRows(state);
  return state.highlightIndex >= rows.length ? CREATE_NEW_ROW : rows[state.highlightIndex];
}

export function moveHighlight(state, delta) {
  const count = rowCount(state);
  const next = ((state.highlightIndex + delta) % count + count) % count;
  return { ...state, highlightIndex: next };
}

export function typeChar(state, char) {
  return { ...state, query: state.query + char, highlightIndex: 0 };
}

export function backspace(state) {
  return { ...state, query: state.query.slice(0, -1), highlightIndex: 0 };
}

// Space: local checkbox state only, capped at 5 (issue #16) — a 6th toggle
// attempt is ignored rather than silently dropping an earlier pick at
// confirm time, so the checked set the user sees is always what gets added.
export function toggleHighlighted(state) {
  const row = highlightedRow(state);
  if (row === CREATE_NEW_ROW) return state;
  const checked = new Set(state.checked);
  if (checked.has(row.name)) {
    checked.delete(row.name);
  } else {
    if (checked.size >= MAX_CONFIRM_SELECTION) return state;
    checked.add(row.name);
  }
  return { ...state, checked, touched: true };
}

// Diffs the desired checked set against each playlist's original (native)
// selected flag, so a confirm can both add newly-checked playlists and
// remove ones the user unchecked that the video was already in.
function diffSelection(playlists, desired) {
  const originallySelected = new Set(playlists.filter((p) => p.selected).map((p) => p.name));
  const toAdd = [...desired].filter((name) => !originallySelected.has(name));
  const toRemove = [...originallySelected].filter((name) => !desired.has(name));
  return { toAdd, toRemove };
}

// Enter: if the user has toggled anything (Space, at least once) or the
// create-new dialog isn't involved, confirm the checked set as-is; else
// (nothing ever toggled) implicit single-select adds the highlighted row on
// top of whatever's already checked, so it isn't lost when the video is
// already saved elsewhere (resolved 2026-08-07).
export function resolveEnter(state) {
  const row = highlightedRow(state);
  if (row === CREATE_NEW_ROW) return { type: 'create-new' };
  const desired = state.touched ? state.checked : new Set([...state.checked, row.name]);
  return { type: 'confirm', ...diffSelection(state.playlists, desired) };
}

export function resolveCreatedPlaylistChanges(state) {
  return diffSelection(state.playlists, state.checked);
}

export function openCreateDialog(state) {
  return { ...state, subDialog: { query: '' } };
}

export function typeInCreateDialog(state, char) {
  if (!state.subDialog) return state;
  return { ...state, subDialog: { query: state.subDialog.query + char } };
}

export function backspaceInCreateDialog(state) {
  if (!state.subDialog) return state;
  return { ...state, subDialog: { query: state.subDialog.query.slice(0, -1) } };
}

export function closeCreateDialog(state) {
  return { ...state, subDialog: null };
}

// New playlist checked by default, prior checks intact, back to main
// checklist (issue #16 resolved create-new UX).
export function commitCreatedPlaylist(state, name) {
  const checked = new Set(state.checked);
  checked.add(name);
  return {
    ...state,
    playlists: [...state.playlists, { name, selected: false }],
    subDialog: null,
    query: '',
    highlightIndex: 0,
    checked,
  };
}
