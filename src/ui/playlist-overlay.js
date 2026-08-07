import { visibleRows } from './playlist-overlay-state.js';

const PANEL_STYLE = [
  'position: fixed',
  'z-index: 2147483647',
  'top: 72px',
  'left: 50%',
  'transform: translateX(-50%)',
  'background: #111',
  'color: #fff',
  'font: 13px/1.4 monospace',
  'border: 1px solid #ffd54a',
  'border-radius: 4px',
  'padding: 8px',
  'min-width: 260px',
  'max-height: 320px',
  'overflow-y: auto',
].join('; ');

const LABEL_STYLE = 'color:#ffd54a; margin-bottom:6px; white-space:pre';
const ROW_STYLE = 'padding:2px 4px; white-space:nowrap';
const ROW_HIGHLIGHT_STYLE = `${ROW_STYLE}; background:#333; border-radius:2px`;
const CREATE_ROW_STYLE = 'padding:2px 4px; white-space:nowrap; color:#9be89b';
const CREATE_ROW_HIGHLIGHT_STYLE = `${CREATE_ROW_STYLE}; background:#333; border-radius:2px`;

function renderMain(doc, container, state) {
  const query = doc.createElement('div');
  query.setAttribute('style', LABEL_STYLE);
  query.textContent = `/ ${state.query}`;
  container.appendChild(query);

  const rows = visibleRows(state);
  rows.forEach((row, i) => {
    const el = doc.createElement('div');
    el.setAttribute('style', i === state.highlightIndex ? ROW_HIGHLIGHT_STYLE : ROW_STYLE);
    el.setAttribute('data-videodefaults-playlist-row', row.name);
    el.textContent = `${state.checked.has(row.name) ? '[x]' : '[ ]'} ${row.name}`;
    container.appendChild(el);
  });

  const createRow = doc.createElement('div');
  const createHighlighted = state.highlightIndex === rows.length;
  createRow.setAttribute('style', createHighlighted ? CREATE_ROW_HIGHLIGHT_STYLE : CREATE_ROW_STYLE);
  createRow.setAttribute('data-videodefaults-playlist-create-new', '');
  createRow.textContent = '+ Create new';
  container.appendChild(createRow);
}

function renderSubDialog(doc, container, state) {
  const label = doc.createElement('div');
  label.setAttribute('style', LABEL_STYLE);
  label.textContent = 'New playlist name:';
  container.appendChild(label);

  const query = doc.createElement('div');
  query.setAttribute('style', LABEL_STYLE);
  query.setAttribute('data-videodefaults-playlist-create-input', '');
  query.textContent = `/ ${state.subDialog.query}`;
  container.appendChild(query);
}

export function createPlaylistOverlay(doc) {
  let container = null;

  return {
    isOpen() {
      return container !== null;
    },
    render(state) {
      if (!container) {
        container = doc.createElement('div');
        container.setAttribute('data-videodefaults-playlist-overlay', '');
        container.setAttribute('style', PANEL_STYLE);
        doc.body.appendChild(container);
      }
      container.textContent = '';
      if (state.subDialog) renderSubDialog(doc, container, state);
      else renderMain(doc, container, state);
    },
    close() {
      if (container) container.remove();
      container = null;
    },
  };
}
