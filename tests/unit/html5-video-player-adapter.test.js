import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerAdapter } from '../../src/player-adapters/html5-video-player-adapter.js';

function makeVideoEl(initial = { playbackRate: 1.0, readyState: 4 }) {
  const el = {
    playbackRate: initial.playbackRate,
    readyState: initial.readyState,
    _listeners: {},
    addEventListener(type, fn) {
      this._listeners[type] = this._listeners[type] ?? [];
      this._listeners[type].push(fn);
    },
    removeEventListener(type, fn) {
      this._listeners[type] = (this._listeners[type] ?? []).filter(f => f !== fn);
    },
    emit(type) {
      (this._listeners[type] ?? []).forEach(fn => fn());
    },
  };
  return el;
}

describe('createPlayerAdapter.getSpeed', () => {
  it('returns videoElement.playbackRate', () => {
    const el = makeVideoEl({ playbackRate: 1.5, readyState: 4 });
    const adapter = createPlayerAdapter(el);
    assert.equal(adapter.getSpeed(), 1.5);
  });

  it('reflects updated value after external change', () => {
    const el = makeVideoEl({ playbackRate: 1.0, readyState: 4 });
    const adapter = createPlayerAdapter(el);
    el.playbackRate = 2.0;
    assert.equal(adapter.getSpeed(), 2.0);
  });
});

describe('createPlayerAdapter.setSpeed', () => {
  it('sets videoElement.playbackRate to given value', () => {
    const el = makeVideoEl({ playbackRate: 1.0, readyState: 4 });
    const adapter = createPlayerAdapter(el);
    adapter.setSpeed(1.75);
    assert.equal(el.playbackRate, 1.75);
  });

  it('getSpeed returns the new value after setSpeed', () => {
    const el = makeVideoEl({ playbackRate: 1.0, readyState: 4 });
    const adapter = createPlayerAdapter(el);
    adapter.setSpeed(2.5);
    assert.equal(adapter.getSpeed(), 2.5);
  });
});

describe('createPlayerAdapter.setSpeed movie_player sync', () => {
  it('calls moviePlayer.setPlaybackRate when closest() finds a movie_player', () => {
    const moviePlayer = { setPlaybackRate(rate) { this.lastRate = rate; } };
    const el = makeVideoEl({ playbackRate: 1.0, readyState: 4 });
    el.closest = (selector) => (selector === '#movie_player' ? moviePlayer : null);
    const adapter = createPlayerAdapter(el);
    adapter.setSpeed(1.75);
    assert.equal(moviePlayer.lastRate, 1.75);
    assert.equal(el.playbackRate, 1.75);
  });

  it('still sets videoElement.playbackRate when closest() returns null', () => {
    const el = makeVideoEl({ playbackRate: 1.0, readyState: 4 });
    el.closest = () => null;
    const adapter = createPlayerAdapter(el);
    adapter.setSpeed(1.5);
    assert.equal(el.playbackRate, 1.5);
  });

  it('still sets videoElement.playbackRate when closest() is not a function', () => {
    const el = makeVideoEl({ playbackRate: 1.0, readyState: 4 });
    const adapter = createPlayerAdapter(el);
    adapter.setSpeed(1.5);
    assert.equal(el.playbackRate, 1.5);
  });

  it('does not throw when moviePlayer lacks setPlaybackRate', () => {
    const el = makeVideoEl({ playbackRate: 1.0, readyState: 4 });
    el.closest = () => ({});
    const adapter = createPlayerAdapter(el);
    assert.doesNotThrow(() => adapter.setSpeed(1.5));
    assert.equal(el.playbackRate, 1.5);
  });
});

describe('createPlayerAdapter.onRateChange', () => {
  it('handler is called when ratechange fires on element', () => {
    const el = makeVideoEl();
    const adapter = createPlayerAdapter(el);
    let called = 0;
    adapter.onRateChange(() => called++);
    el.emit('ratechange');
    assert.equal(called, 1);
  });

  it('returns an unsubscribe function', () => {
    const el = makeVideoEl();
    const adapter = createPlayerAdapter(el);
    const unsubscribe = adapter.onRateChange(() => {});
    assert.equal(typeof unsubscribe, 'function');
  });

  it('after calling unsubscribe, handler is no longer called on ratechange', () => {
    const el = makeVideoEl();
    const adapter = createPlayerAdapter(el);
    let called = 0;
    const unsubscribe = adapter.onRateChange(() => called++);
    unsubscribe();
    el.emit('ratechange');
    assert.equal(called, 0);
  });

  it('multiple handlers can be registered independently', () => {
    const el = makeVideoEl();
    const adapter = createPlayerAdapter(el);
    let countA = 0;
    let countB = 0;
    adapter.onRateChange(() => countA++);
    adapter.onRateChange(() => countB++);
    el.emit('ratechange');
    assert.equal(countA, 1);
    assert.equal(countB, 1);
  });

  it('unsubscribing one handler does not affect others', () => {
    const el = makeVideoEl();
    const adapter = createPlayerAdapter(el);
    let countA = 0;
    let countB = 0;
    const unsubscribeA = adapter.onRateChange(() => countA++);
    adapter.onRateChange(() => countB++);
    unsubscribeA();
    el.emit('ratechange');
    assert.equal(countA, 0);
    assert.equal(countB, 1);
  });
});

describe('createPlayerAdapter.isReady', () => {
  it('returns true when readyState >= 1', () => {
    const el = makeVideoEl({ playbackRate: 1.0, readyState: 4 });
    const adapter = createPlayerAdapter(el);
    assert.equal(adapter.isReady(), true);
  });

  it('returns false when readyState === 0 (HAVE_NOTHING)', () => {
    const el = makeVideoEl({ playbackRate: 1.0, readyState: 0 });
    const adapter = createPlayerAdapter(el);
    assert.equal(adapter.isReady(), false);
  });

  it('returns true for readyState 1', () => {
    const el = makeVideoEl({ playbackRate: 1.0, readyState: 1 });
    const adapter = createPlayerAdapter(el);
    assert.equal(adapter.isReady(), true);
  });

  it('returns true for readyState 2', () => {
    const el = makeVideoEl({ playbackRate: 1.0, readyState: 2 });
    const adapter = createPlayerAdapter(el);
    assert.equal(adapter.isReady(), true);
  });

  it('returns true for readyState 3', () => {
    const el = makeVideoEl({ playbackRate: 1.0, readyState: 3 });
    const adapter = createPlayerAdapter(el);
    assert.equal(adapter.isReady(), true);
  });

  it('returns true for readyState 4', () => {
    const el = makeVideoEl({ playbackRate: 1.0, readyState: 4 });
    const adapter = createPlayerAdapter(el);
    assert.equal(adapter.isReady(), true);
  });
});
