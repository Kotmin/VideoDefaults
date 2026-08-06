import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collectQueueTargets, activateQueueTarget } from '../../src/ui/queue-overlay.js';

function makeEl({
  top = 0, left = 0, width = 20, height = 20, disabled = false, tagName = 'BUTTON',
} = {}) {
  return {
    tagName,
    disabled,
    closest: () => null,
    clicked: 0,
    dispatched: [],
    getBoundingClientRect: () => ({
      top, left, width, height, bottom: top + height, right: left + width,
    }),
    click() { this.clicked += 1; },
    dispatchEvent(evt) { this.dispatched.push(evt.type); },
    querySelector: () => null,
  };
}

function makeLegacyCard(props, button = null) {
  const card = makeEl({ ...props, tagName: 'YTD-VIDEO-RENDERER' });
  card.querySelector = (sel) => (sel === '#menu button' ? button : null);
  return card;
}

function makeDoc(triggerEls, legacyCardEls = []) {
  return {
    querySelectorAll: (sel) => (sel === 'ytd-video-renderer' ? legacyCardEls : triggerEls),
  };
}

const win = {
  innerWidth: 1000,
  innerHeight: 800,
  setTimeout: (fn) => fn(),
  requestAnimationFrame: (fn) => fn(),
};

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

  it('includes an unstamped legacy card as a fallback target', () => {
    const card = makeLegacyCard({ top: 10, left: 10 });
    const out = collectQueueTargets(makeDoc([], [card]), win);
    assert.equal(out.length, 1);
    assert.equal(out[0].element, card);
  });

  it('excludes a legacy card whose button has already stamped in', () => {
    const button = makeEl();
    const card = makeLegacyCard({ top: 10, left: 10 }, button);
    const out = collectQueueTargets(makeDoc([], [card]), win);
    assert.equal(out.length, 0);
  });
});

describe('activateQueueTarget', () => {
  it('clicks the trigger, waits a frame, then clicks the first menu item', async () => {
    const trigger = makeEl();
    const menuItem = makeEl();
    let queried = false;
    let frames = 0;
    const doc = {
      querySelector: (sel) => {
        assert.equal(
          sel,
          'ytd-popup-container yt-list-item-view-model[role="menuitem"], '
          + 'ytd-popup-container ytd-menu-service-item-renderer',
        );
        queried = true;
        return menuItem;
      },
    };
    const frameWin = { ...win, requestAnimationFrame: (fn) => { frames += 1; fn(); } };
    const ok = await activateQueueTarget(trigger, doc, frameWin);
    assert.equal(ok, true);
    assert.equal(trigger.clicked, 1);
    assert.equal(menuItem.clicked, 1);
    assert.equal(queried, true);
    assert.equal(frames, 2);
  });

  it('resolves false when no menu item appears before the timeout', async () => {
    const trigger = makeEl();
    let now = 0;
    const doc = { querySelector: () => null };
    const fastWin = {
      ...win,
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

  it('ignores a second activation while one is already in flight', async () => {
    const triggerA = makeEl();
    const triggerB = makeEl();
    const menuItem = makeEl();
    const doc = { querySelector: () => menuItem };
    let resolveFirstFrame;
    let calls = 0;
    const stallingWin = {
      ...win,
      requestAnimationFrame: (fn) => {
        calls += 1;
        if (calls === 1) { resolveFirstFrame = fn; return; }
        fn();
      },
    };
    const first = activateQueueTarget(triggerA, doc, stallingWin);
    const second = await activateQueueTarget(triggerB, doc, win);
    assert.equal(second, false);
    assert.equal(triggerB.clicked, 0);
    assert.equal(menuItem.clicked, 0);
    resolveFirstFrame();
    const firstOk = await first;
    assert.equal(firstOk, true);
    assert.equal(menuItem.clicked, 1);
  });

  it('waits for a fresh item instead of re-clicking the one just activated', async () => {
    const triggerA = makeEl();
    const triggerB = makeEl();
    const itemA = makeEl();
    const itemB = makeEl();
    const okA = await activateQueueTarget(triggerA, { querySelector: () => itemA }, win);
    assert.equal(okA, true);

    let polls = 0;
    const docB = {
      querySelector: () => {
        polls += 1;
        return polls < 3 ? itemA : itemB;
      },
    };
    const okB = await activateQueueTarget(triggerB, docB, win);
    assert.equal(okB, true);
    assert.equal(itemA.clicked, 1);
    assert.equal(itemB.clicked, 1);
  });

  it('falls back to the same item if it never changes before the timeout', async () => {
    const triggerA = makeEl();
    const triggerB = makeEl();
    const item = makeEl();
    const doc = { querySelector: () => item };
    const okA = await activateQueueTarget(triggerA, doc, win);
    assert.equal(okA, true);

    let now = 0;
    const fastWin = { ...win, setTimeout: (fn) => { now += 50; fn(); } };
    const realNow = Date.now;
    Date.now = () => now;
    try {
      const okB = await activateQueueTarget(triggerB, doc, fastWin);
      assert.equal(okB, true);
    } finally {
      Date.now = realNow;
    }
    assert.equal(item.clicked, 2);
  });

  it('force-hovers an unstamped legacy card before clicking its button', async () => {
    const button = makeEl();
    const card = makeLegacyCard({}, button);
    const menuItem = makeEl();
    const doc = { querySelector: () => menuItem };
    const hoverWin = { ...win, MouseEvent: function MouseEvent(type) { this.type = type; } };
    const ok = await activateQueueTarget(card, doc, hoverWin);
    assert.equal(ok, true);
    assert.deepEqual(card.dispatched, ['pointerover', 'pointerenter', 'mouseover', 'mouseenter']);
    assert.equal(button.clicked, 1);
    assert.equal(menuItem.clicked, 1);
  });

  it('resolves false when a legacy card never grows a button after hover-forcing', async () => {
    const card = makeLegacyCard({}, null);
    const doc = { querySelector: () => null };
    const hoverWin = { ...win, MouseEvent: function MouseEvent(type) { this.type = type; } };
    const ok = await activateQueueTarget(card, doc, hoverWin);
    assert.equal(ok, false);
  });
});
