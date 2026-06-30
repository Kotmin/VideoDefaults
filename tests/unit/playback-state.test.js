import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createState,
  markExtensionWrite,
  markManualOverride,
  clearOverride,
  clearExtensionToken,
  isManualOverride,
  isExtensionToken,
} from '../../src/core/playback-state.js';

describe('createState', () => {
  it('returns manualOverride false', () => assert.equal(createState().manualOverride, false));
  it('returns extensionToken null', () => assert.equal(createState().extensionToken, null));
  it('each call returns a new object', () => assert.notEqual(createState(), createState()));
});

describe('isManualOverride', () => {
  it('false on fresh state', () => assert.equal(isManualOverride(createState()), false));
  it('true after markManualOverride', () => assert.equal(isManualOverride(markManualOverride(createState())), true));
  it('false after clearOverride', () => {
    const s = clearOverride(markManualOverride(createState()));
    assert.equal(isManualOverride(s), false);
  });
});

describe('markManualOverride', () => {
  it('does not mutate input', () => {
    const s = createState();
    markManualOverride(s);
    assert.equal(s.manualOverride, false);
  });
  it('returns new object', () => {
    const s = createState();
    assert.notEqual(markManualOverride(s), s);
  });
});

describe('clearOverride', () => {
  it('resets manualOverride', () => assert.equal(clearOverride(markManualOverride(createState())).manualOverride, false));
  it('clears extensionToken', () => {
    const s = clearOverride(markExtensionWrite(createState(), 'tok'));
    assert.equal(s.extensionToken, null);
  });
  it('does not mutate input', () => {
    const s = markManualOverride(createState());
    clearOverride(s);
    assert.equal(s.manualOverride, true);
  });
});

describe('markExtensionWrite', () => {
  it('stores token', () => assert.equal(markExtensionWrite(createState(), 'abc').extensionToken, 'abc'));
  it('does not mutate input', () => {
    const s = createState();
    markExtensionWrite(s, 'x');
    assert.equal(s.extensionToken, null);
  });
  it('overwrites previous token', () => {
    const s = markExtensionWrite(markExtensionWrite(createState(), 'a'), 'b');
    assert.equal(s.extensionToken, 'b');
  });
});

describe('isExtensionToken', () => {
  it('true when token matches', () => {
    const s = markExtensionWrite(createState(), 'tok1');
    assert.equal(isExtensionToken(s, 'tok1'), true);
  });
  it('false when token differs', () => {
    const s = markExtensionWrite(createState(), 'tok1');
    assert.equal(isExtensionToken(s, 'tok2'), false);
  });
  it('false when no token set', () => assert.equal(isExtensionToken(createState(), 'tok1'), false));
  it('is pure — repeated call still true', () => {
    const s = markExtensionWrite(createState(), 'tok');
    assert.equal(isExtensionToken(s, 'tok'), true);
    assert.equal(isExtensionToken(s, 'tok'), true);
  });
});

describe('clearExtensionToken', () => {
  it('sets extensionToken to null', () => {
    const s = clearExtensionToken(markExtensionWrite(createState(), 'tok'));
    assert.equal(s.extensionToken, null);
  });
  it('does not mutate input', () => {
    const s = markExtensionWrite(createState(), 'tok');
    clearExtensionToken(s);
    assert.equal(s.extensionToken, 'tok');
  });
  it('preserves manualOverride', () => {
    const s = clearExtensionToken(markManualOverride(markExtensionWrite(createState(), 'tok')));
    assert.equal(s.manualOverride, true);
  });
});
