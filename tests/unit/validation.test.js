import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGE_TYPES, validateMessage } from '../../src/core/validation.js';

describe('MESSAGE_TYPES', () => {
  it('has GET_PLAYBACK_STATE', () => assert.equal(MESSAGE_TYPES.GET_PLAYBACK_STATE, 'GET_PLAYBACK_STATE'));
  it('has SET_DEFAULT_SPEED', () => assert.equal(MESSAGE_TYPES.SET_DEFAULT_SPEED, 'SET_DEFAULT_SPEED'));
  it('has APPLY_SPEED_TO_ACTIVE_VIDEO', () => assert.equal(MESSAGE_TYPES.APPLY_SPEED_TO_ACTIVE_VIDEO, 'APPLY_SPEED_TO_ACTIVE_VIDEO'));
  it('has GET_SETTINGS', () => assert.equal(MESSAGE_TYPES.GET_SETTINGS, 'GET_SETTINGS'));
  it('has SET_SETTINGS', () => assert.equal(MESSAGE_TYPES.SET_SETTINGS, 'SET_SETTINGS'));
  it('is frozen', () => assert.ok(Object.isFrozen(MESSAGE_TYPES)));
});

describe('validateMessage — null and non-object inputs', () => {
  it('rejects null', () => assert.equal(validateMessage(null).valid, false));
  it('rejects string', () => assert.equal(validateMessage('hello').valid, false));
  it('rejects number', () => assert.equal(validateMessage(42).valid, false));
  it('rejects undefined', () => assert.equal(validateMessage(undefined).valid, false));
  it('rejects array', () => assert.equal(validateMessage([]).valid, false));
});

describe('validateMessage — missing or unknown type', () => {
  it('rejects empty object (no type)', () => assert.equal(validateMessage({}).valid, false));
  it('rejects unknown type', () => assert.equal(validateMessage({ type: 'UNKNOWN' }).valid, false));
  it('invalid result has error string', () => {
    const r = validateMessage({ type: 'UNKNOWN' });
    assert.equal(typeof r.error, 'string');
  });
});

describe('validateMessage — GET_PLAYBACK_STATE', () => {
  it('accepts message with no payload', () => {
    const r = validateMessage({ type: 'GET_PLAYBACK_STATE' });
    assert.equal(r.valid, true);
    assert.equal(r.type, 'GET_PLAYBACK_STATE');
  });
  it('valid result has no error field', () => {
    assert.equal(validateMessage({ type: 'GET_PLAYBACK_STATE' }).error, undefined);
  });
});

describe('validateMessage — GET_SETTINGS', () => {
  it('accepts message with no payload', () => {
    const r = validateMessage({ type: 'GET_SETTINGS' });
    assert.equal(r.valid, true);
    assert.equal(r.type, 'GET_SETTINGS');
  });
});

describe('validateMessage — SET_DEFAULT_SPEED', () => {
  it('accepts valid speed payload', () => {
    const r = validateMessage({ type: 'SET_DEFAULT_SPEED', payload: { speed: 2.0 } });
    assert.equal(r.valid, true);
    assert.equal(r.type, 'SET_DEFAULT_SPEED');
  });
  it('rejects speed below minimum (0.01)', () => {
    assert.equal(validateMessage({ type: 'SET_DEFAULT_SPEED', payload: { speed: 0.01 } }).valid, false);
  });
  it('rejects missing payload', () => {
    assert.equal(validateMessage({ type: 'SET_DEFAULT_SPEED' }).valid, false);
  });
  it('rejects string speed', () => {
    assert.equal(validateMessage({ type: 'SET_DEFAULT_SPEED', payload: { speed: 'fast' } }).valid, false);
  });
  it('rejects speed above maximum', () => {
    assert.equal(validateMessage({ type: 'SET_DEFAULT_SPEED', payload: { speed: 10 } }).valid, false);
  });
  it('accepts minimum valid speed', () => {
    assert.equal(validateMessage({ type: 'SET_DEFAULT_SPEED', payload: { speed: 0.25 } }).valid, true);
  });
});

describe('validateMessage — APPLY_SPEED_TO_ACTIVE_VIDEO', () => {
  it('accepts valid speed payload', () => {
    const r = validateMessage({ type: 'APPLY_SPEED_TO_ACTIVE_VIDEO', payload: { speed: 1.5 } });
    assert.equal(r.valid, true);
    assert.equal(r.type, 'APPLY_SPEED_TO_ACTIVE_VIDEO');
  });
  it('rejects missing payload', () => {
    assert.equal(validateMessage({ type: 'APPLY_SPEED_TO_ACTIVE_VIDEO' }).valid, false);
  });
  it('rejects invalid speed', () => {
    assert.equal(validateMessage({ type: 'APPLY_SPEED_TO_ACTIVE_VIDEO', payload: { speed: 0.01 } }).valid, false);
  });
});

describe('validateMessage — SET_SETTINGS', () => {
  it('accepts non-null object payload', () => {
    const r = validateMessage({ type: 'SET_SETTINGS', payload: { defaultSpeed: 2.0 } });
    assert.equal(r.valid, true);
    assert.equal(r.type, 'SET_SETTINGS');
  });
  it('rejects missing payload', () => {
    assert.equal(validateMessage({ type: 'SET_SETTINGS' }).valid, false);
  });
  it('rejects null payload', () => {
    assert.equal(validateMessage({ type: 'SET_SETTINGS', payload: null }).valid, false);
  });
  it('rejects non-object payload (string)', () => {
    assert.equal(validateMessage({ type: 'SET_SETTINGS', payload: 'config' }).valid, false);
  });
});
