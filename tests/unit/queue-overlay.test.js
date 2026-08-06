import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collectQueueTargets, activateQueueTarget } from '../../src/ui/queue-overlay.js';

function makeEl({ top = 0, left = 0, width = 20, height = 20, disabled = false } = {}) {
  return {
    disabled,
    closest: () => null,
    clicked: 0,
    getBoundingClientRect: () => ({
      top, left, width, height, bottom: top + height, right: left + width,
    }),
    click() { this.clicked += 1; },
  };
}

function makeDoc(els) {
  return { querySelectorAll: () => els };
}

const win = { innerWidth: 1000, innerHeight: 800, setTimeout: (fn) => fn() };

describe('collectQueueTargets', () => {
  it('keeps visible trigger buttons with their rects', () => {
    const el = makeEl({ top: 10, left: 10 });
    const out = collectQueueTargets(makeDoc([el]), win);
    assert.equal(out.length, 1);
    assert.equal(out[0].element, el);
  });

  it('excludes disabled and offscreen buttons', () => {
    const els = [makeEl({ disabled: true }), makeEl({ top: 900 })];
    assert.equal(collectQueueTargets(makeDoc(els), win).length, 0);
  });
});

describe('activateQueueTarget', () => {
  it('clicks the trigger, waits for the first menu item, and clicks it', async () => {
    const trigger = makeEl();
    const menuItem = makeEl();
    let queried = false;
    const doc = {
      querySelector: (sel) => {
        assert.equal(sel, 'ytd-popup-container yt-list-item-view-model[role="menuitem"]');
        queried = true;
        return menuItem;
      },
    };
    const ok = await activateQueueTarget(trigger, doc, win);
    assert.equal(ok, true);
    assert.equal(trigger.clicked, 1);
    assert.equal(menuItem.clicked, 1);
    assert.equal(queried, true);
  });

  it('resolves false when no menu item appears before the timeout', async () => {
    const trigger = makeEl();
    let now = 0;
    const doc = { querySelector: () => null };
    const fastWin = {
      setTimeout: (fn) => { now += 50; fn(); },
    };
    const realNow = Date.now;
    Date.now = () => now;
    try {
      const ok = await activateQueueTarget(trigger, doc, fastWin);
      assert.equal(ok, false);
    } finally {
      Date.now = realNow;
    }
  });
});
