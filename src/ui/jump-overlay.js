import { MAX_JUMP_TARGETS } from '../core/keyboard-shortcuts.js';

const TARGET_SELECTOR = [
  'a[href]',
  'button',
  '[role="button"]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const ROW_BUCKET_PX = 40;

export function collectJumpTargets(doc, win) {
  const targets = [];
  for (const el of doc.querySelectorAll(TARGET_SELECTOR)) {
    if (el.disabled) continue;
    if (typeof el.closest === 'function' && el.closest('[aria-hidden="true"]')) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (rect.bottom < 0 || rect.right < 0) continue;
    if (rect.top > win.innerHeight || rect.left > win.innerWidth) continue;
    targets.push({ element: el, rect });
  }
  targets.sort((a, b) => {
    const rowA = Math.round(a.rect.top / ROW_BUCKET_PX);
    const rowB = Math.round(b.rect.top / ROW_BUCKET_PX);
    if (rowA !== rowB) return rowA - rowB;
    return a.rect.left - b.rect.left;
  });
  return targets.slice(0, MAX_JUMP_TARGETS);
}

const BADGE_STYLE = [
  'position: fixed',
  'z-index: 2147483647',
  'background: #111',
  'color: #ffd54a',
  'font: bold 12px/1.4 monospace',
  'padding: 1px 4px',
  'border-radius: 3px',
  'border: 1px solid #ffd54a',
  'pointer-events: none',
].join('; ');

export function createJumpOverlay(doc) {
  let container = null;
  let badges = new Map();

  return {
    isOpen() {
      return container !== null;
    },
    open(labelledTargets) {
      this.close();
      container = doc.createElement('div');
      container.setAttribute('data-videodefaults-overlay', '');
      for (const { label, rect } of labelledTargets) {
        const badge = doc.createElement('span');
        badge.textContent = label;
        badge.setAttribute('style', BADGE_STYLE
          + `; top: ${Math.max(0, rect.top)}px; left: ${Math.max(0, rect.left)}px`);
        container.appendChild(badge);
        badges.set(label, badge);
      }
      doc.body.appendChild(container);
    },
    showMatches(labels) {
      const visible = new Set(labels);
      for (const [label, badge] of badges) {
        badge.hidden = !visible.has(label);
      }
    },
    close() {
      if (container) container.remove();
      container = null;
      badges = new Map();
    },
  };
}
