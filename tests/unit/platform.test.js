import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isMacPlatform } from '../../src/core/platform.js';

describe('isMacPlatform', () => {
  it('returns true for a mac platform string', () => {
    assert.equal(isMacPlatform({ platform: 'MacIntel' }), true);
  });

  it('returns true for a mac userAgentData platform', () => {
    assert.equal(isMacPlatform({ userAgentData: { platform: 'macOS' } }), true);
  });

  it('returns false for Windows', () => {
    assert.equal(isMacPlatform({ platform: 'Win32' }), false);
  });

  it('returns false for Linux', () => {
    assert.equal(isMacPlatform({ platform: 'Linux x86_64' }), false);
  });

  it('returns false for undefined', () => {
    assert.equal(isMacPlatform(undefined), false);
  });

  it('returns false for an empty object', () => {
    assert.equal(isMacPlatform({}), false);
  });

  it('returns false for null', () => {
    assert.equal(isMacPlatform(null), false);
  });
});
