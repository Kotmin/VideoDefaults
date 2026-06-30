import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateSpeed, clampSpeed, normalizeSpeed, PRESETS, MIN_SPEED, MAX_SPEED, SPEED_STEP } from '../../src/core/speed.js';

describe('validateSpeed', () => {
  it('accepts 2.0', () => assert.deepEqual(validateSpeed(2.0), { valid: true, value: 2.0 }));
  it('accepts minimum', () => assert.deepEqual(validateSpeed(0.25), { valid: true, value: 0.25 }));
  it('accepts maximum', () => assert.deepEqual(validateSpeed(4.0), { valid: true, value: 4.0 }));
  it('rejects below min', () => assert.equal(validateSpeed(0.1).valid, false));
  it('rejects above max', () => assert.equal(validateSpeed(5.0).valid, false));
  it('rejects string', () => assert.equal(validateSpeed('2').valid, false));
  it('rejects NaN', () => assert.equal(validateSpeed(NaN).valid, false));
  it('rejects Infinity', () => assert.equal(validateSpeed(Infinity).valid, false));
  it('rejects null', () => assert.equal(validateSpeed(null).valid, false));
  it('rejects undefined', () => assert.equal(validateSpeed(undefined).valid, false));
  it('normalizes to step — 2.257 → 2.25', () => {
    const r = validateSpeed(2.257);
    assert.ok(r.valid);
    assert.equal(r.value, 2.25);
  });
  it('valid result has no error field', () => assert.equal(validateSpeed(1.5).error, undefined));
  it('invalid result has error string', () => assert.equal(typeof validateSpeed(0).error, 'string'));
});

describe('clampSpeed', () => {
  it('clamps below min', () => assert.equal(clampSpeed(0.1), MIN_SPEED));
  it('clamps above max', () => assert.equal(clampSpeed(10), MAX_SPEED));
  it('leaves valid value unchanged', () => assert.equal(clampSpeed(1.5), 1.5));
  it('leaves min boundary unchanged', () => assert.equal(clampSpeed(MIN_SPEED), MIN_SPEED));
  it('leaves max boundary unchanged', () => assert.equal(clampSpeed(MAX_SPEED), MAX_SPEED));
});

describe('normalizeSpeed', () => {
  it('rounds down to step', () => assert.equal(normalizeSpeed(2.257), 2.25));
  it('rounds up to step', () => assert.equal(normalizeSpeed(2.276), 2.30));
  it('leaves exact step value unchanged', () => assert.equal(normalizeSpeed(2.0), 2.0));
  it('step size is 0.05', () => assert.equal(SPEED_STEP, 0.05));
});

describe('PRESETS', () => {
  it('contains 1, 1.5, 2.0', () => assert.deepEqual([...PRESETS], [1, 1.5, 2.0]));
  it('is frozen', () => assert.ok(Object.isFrozen(PRESETS)));
});

describe('constants', () => {
  it('MIN_SPEED is 0.25', () => assert.equal(MIN_SPEED, 0.25));
  it('MAX_SPEED is 4.0', () => assert.equal(MAX_SPEED, 4.0));
});
