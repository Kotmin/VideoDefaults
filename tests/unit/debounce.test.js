import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { debounce } from '../../src/core/debounce.js';

describe('debounce', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }));
  afterEach(() => mock.timers.reset());

  it('does not call fn before delay', () => {
    let calls = 0;
    const fn = debounce(() => calls++, 100);
    fn();
    mock.timers.tick(99);
    assert.equal(calls, 0);
  });

  it('calls fn after delay', () => {
    let calls = 0;
    const fn = debounce(() => calls++, 100);
    fn();
    mock.timers.tick(100);
    assert.equal(calls, 1);
  });

  it('resets timer on repeated calls — only fires once', () => {
    let calls = 0;
    const fn = debounce(() => calls++, 100);
    fn(); fn(); fn();
    mock.timers.tick(100);
    assert.equal(calls, 1);
  });

  it('passes arguments to fn', () => {
    let received = null;
    const fn = debounce((x) => { received = x; }, 50);
    fn(42);
    mock.timers.tick(50);
    assert.equal(received, 42);
  });

  it('uses last call args when debounced', () => {
    let received = null;
    const fn = debounce((x) => { received = x; }, 50);
    fn(1); fn(2); fn(3);
    mock.timers.tick(50);
    assert.equal(received, 3);
  });
});
