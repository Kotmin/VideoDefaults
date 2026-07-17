import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collectJumpTargets } from '../../src/ui/jump-overlay.js';
import { MAX_JUMP_TARGETS } from '../../src/core/keyboard-shortcuts.js';

function makeEl({ top = 0, left = 0, width = 20, height = 20, disabled = false, hiddenAncestor = false } = {}) {
  return {
    disabled,
    closest: (sel) => (sel === '[aria-hidden="true"]' && hiddenAncestor ? {} : null),
    getBoundingClientRect: () => ({
      top, left, width, height, bottom: top + height, right: left + width,
    }),
  };
}

function makeDoc(els) {
  return { querySelectorAll: () => els };
}

const win = { innerWidth: 1000, innerHeight: 800 };

describe('collectJumpTargets', () => {
  it('keeps visible interactive elements with their rects', () => {
    const el = makeEl({ top: 10, left: 10 });
    const out = collectJumpTargets(makeDoc([el]), win);
    assert.equal(out.length, 1);
    assert.equal(out[0].element, el);
    assert.equal(out[0].rect.top, 10);
  });

  it('excludes disabled, zero-size, offscreen, and aria-hidden elements', () => {
    const els = [
      makeEl({ disabled: true }),
      makeEl({ width: 0 }),
      makeEl({ top: 900 }),
      makeEl({ left: -50, width: 20 }),
      makeEl({ hiddenAncestor: true }),
    ];
    assert.equal(collectJumpTargets(makeDoc(els), win).length, 0);
  });

  it('keeps elements partially above the viewport top edge', () => {
    const el = makeEl({ top: -5, height: 20 });
    assert.equal(collectJumpTargets(makeDoc([el]), win).length, 1);
  });

  it('sorts row-major: top-to-bottom, then left-to-right', () => {
    const a = makeEl({ top: 100, left: 300 });
    const b = makeEl({ top: 105, left: 10 });
    const c = makeEl({ top: 10, left: 500 });
    const out = collectJumpTargets(makeDoc([a, b, c]), win);
    assert.deepEqual(out.map((t) => t.element), [c, b, a]);
  });

  it('caps the result at MAX_JUMP_TARGETS', () => {
    const els = Array.from({ length: MAX_JUMP_TARGETS + 10 }, (_, i) => makeEl({ top: i }));
    assert.equal(collectJumpTargets(makeDoc(els), win).length, MAX_JUMP_TARGETS);
  });
});
