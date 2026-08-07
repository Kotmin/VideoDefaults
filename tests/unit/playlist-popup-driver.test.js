import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  scrapePlaylistRows,
  findCreateNewButton,
  openSaveToPlaylistPopup,
  togglePlaylistRow,
  activateCreateNew,
  driveCreateNewPlaylist,
  closeSaveToPlaylistPopup,
} from '../../src/ui/playlist-popup-driver.js';

function makeRowButton({ name, selected = false }) {
  return {
    clicked: 0,
    getAttribute(attr) {
      if (attr === 'aria-label') return `${name}, Private, Unselected`;
      if (attr === 'aria-pressed') return selected ? 'true' : 'false';
      return null;
    },
    click() { this.clicked += 1; },
  };
}

function makeDoc(rowButtons, createNewButton = null) {
  return {
    querySelectorAll: () => rowButtons,
    querySelector: () => createNewButton,
  };
}

const win = { setTimeout: (fn) => fn() };

describe('scrapePlaylistRows', () => {
  it('parses name and selected state from each row button', () => {
    const rows = [
      makeRowButton({ name: 'Watch later', selected: true }),
      makeRowButton({ name: 'Comedy', selected: false }),
    ];
    const out = scrapePlaylistRows(makeDoc(rows));
    assert.deepEqual(out.map((r) => [r.name, r.selected]), [['Watch later', true], ['Comedy', false]]);
    assert.equal(out[0].element, rows[0]);
  });

  it('returns an empty list when no rows are present', () => {
    assert.deepEqual(scrapePlaylistRows(makeDoc([])), []);
  });
});

describe('findCreateNewButton', () => {
  it('returns the footer create-new button', () => {
    const btn = { id: 'create' };
    assert.equal(findCreateNewButton(makeDoc([], btn)), btn);
  });
});

function makeStyleTarget() {
  const style = new Map();
  return {
    style: { setProperty: (prop, value) => style.set(prop, value) },
    getStyle: (prop) => style.get(prop),
  };
}

describe('openSaveToPlaylistPopup', () => {
  it('clicks the trigger and resolves once rows appear', async () => {
    const trigger = { clicked: 0, click() { this.clicked += 1; } };
    const row = makeRowButton({ name: 'Comedy' });
    let calls = 0;
    const doc = {
      querySelectorAll: () => {
        calls += 1;
        return calls < 3 ? [] : [row];
      },
      querySelector: () => null,
    };
    const rows = await openSaveToPlaylistPopup(trigger, doc, win);
    assert.equal(trigger.clicked, 1);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Comedy');
  });

  it('resolves with an empty list when rows never appear before the timeout', async () => {
    const trigger = { clicked: 0, click() { this.clicked += 1; } };
    let now = 0;
    const doc = { querySelectorAll: () => [], querySelector: () => null };
    const fastWin = { setTimeout: (fn) => { now += 100; fn(); } };
    const realNow = Date.now;
    Date.now = () => now;
    try {
      const rows = await openSaveToPlaylistPopup(trigger, doc, fastWin);
      assert.deepEqual(rows, []);
    } finally {
      Date.now = realNow;
    }
  });

  it('hides the sheet once rows appear so it is not visible while driven', async () => {
    const trigger = { clicked: 0, click() { this.clicked += 1; } };
    const row = makeRowButton({ name: 'Comedy' });
    const sheet = makeStyleTarget();
    const doc = { querySelectorAll: () => [row], querySelector: () => sheet };
    await openSaveToPlaylistPopup(trigger, doc, win);
    assert.equal(sheet.getStyle('opacity'), '0');
    assert.equal(sheet.getStyle('pointer-events'), 'none');
  });

  it('does not attempt to hide anything when no rows appear', async () => {
    const trigger = { clicked: 0, click() { this.clicked += 1; } };
    let queried = false;
    const doc = { querySelectorAll: () => [], querySelector: () => { queried = true; return null; } };
    let now = 0;
    const fastWin = { setTimeout: (fn) => { now += 100; fn(); } };
    const realNow = Date.now;
    Date.now = () => now;
    try {
      await openSaveToPlaylistPopup(trigger, doc, fastWin);
      assert.equal(queried, false);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('togglePlaylistRow', () => {
  it('clicks the row element', () => {
    const row = { element: makeRowButton({ name: 'Comedy' }) };
    togglePlaylistRow(row);
    assert.equal(row.element.clicked, 1);
  });
});

describe('activateCreateNew', () => {
  it('clicks the create-new button and returns true when found', () => {
    const btn = { clicked: 0, click() { this.clicked += 1; } };
    assert.equal(activateCreateNew(makeDoc([], btn)), true);
    assert.equal(btn.clicked, 1);
  });

  it('returns false when no create-new button is found', () => {
    assert.equal(activateCreateNew(makeDoc([], null)), false);
  });
});

function makeCreateNewWin(extra = {}) {
  return {
    setTimeout: (fn) => fn(),
    Event: class { constructor(type, init) { this.type = type; Object.assign(this, init); } },
    KeyboardEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } },
    ...extra,
  };
}

function makeInputElement() {
  return {
    value: null,
    focused: false,
    dispatched: [],
    focus() { this.focused = true; },
    dispatchEvent(evt) { this.dispatched.push(evt); },
  };
}

describe('driveCreateNewPlaylist', () => {
  it('clicks create-new, fills the field, and submits with Enter', async () => {
    const btn = { clicked: 0, click() { this.clicked += 1; } };
    const input = makeInputElement();
    const doc = { querySelector: (sel) => (sel === '.ytContextualSheetLayoutFooterContainer .ytPanelFooterViewModelPrimaryButton button' ? btn : input) };
    const ok = await driveCreateNewPlaylist(doc, makeCreateNewWin(), 'New Stuff');
    assert.equal(ok, true);
    assert.equal(btn.clicked, 1);
    assert.equal(input.value, 'New Stuff');
    assert.equal(input.focused, true);
    assert.deepEqual(input.dispatched.map((e) => e.type), ['input', 'keydown']);
    assert.equal(input.dispatched[1].key, 'Enter');
  });

  it('returns false when the create-new button is not found', async () => {
    const doc = { querySelector: () => null };
    assert.equal(await driveCreateNewPlaylist(doc, makeCreateNewWin(), 'New Stuff'), false);
  });

  it('returns false when no input field appears before the timeout', async () => {
    const btn = { clicked: 0, click() { this.clicked += 1; } };
    let calls = 0;
    const doc = {
      querySelector: (sel) => {
        if (sel === '.ytContextualSheetLayoutFooterContainer .ytPanelFooterViewModelPrimaryButton button') return btn;
        calls += 1;
        return null;
      },
    };
    let now = 0;
    const realNow = Date.now;
    Date.now = () => now;
    try {
      const fastWin = makeCreateNewWin({ setTimeout: (fn) => { now += 100; fn(); } });
      assert.equal(await driveCreateNewPlaylist(doc, fastWin, 'New Stuff'), false);
      assert.ok(calls > 0);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('closeSaveToPlaylistPopup', () => {
  it('dispatches an Escape keydown on the document', () => {
    let dispatched = null;
    const doc = { dispatchEvent: (evt) => { dispatched = evt; } };
    const fakeWin = { KeyboardEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } } };
    closeSaveToPlaylistPopup(doc, fakeWin);
    assert.equal(dispatched.type, 'keydown');
    assert.equal(dispatched.key, 'Escape');
  });
});
