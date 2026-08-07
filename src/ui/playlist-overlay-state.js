import { filterPlaylistsByQuery } from '../core/fuzzy-match.js';

// Virtual last row, always shown regardless of query/match state (issue #16).
export const CREATE_NEW_ROW = Symbol('create-new');
const MAX_CONFIRM_SELECTION = 5;

export function createOverlayState(playlists) {
  return {
    playlists,
    query: '',
    highlightIndex: 0,
    checked: new Set(),
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
  return { ...state, checked };
}

// Enter: checked set if non-empty, else implicit single-select on the
// highlighted row, else opens the create-new sub-dialog (resolved 2026-08-07).
export function resolveEnter(state) {
  const row = highlightedRow(state);
  if (row === CREATE_NEW_ROW) return { type: 'create-new' };
  if (state.checked.size > 0) return { type: 'confirm', names: [...state.checked] };
  return { type: 'confirm', names: [row.name] };
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
