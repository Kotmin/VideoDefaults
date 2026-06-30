import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  applyDefaults,
  migrateSettings,
  validateSettings,
} from '../../src/core/settings.js';

describe('DEFAULT_SETTINGS', () => {
  it('has schemaVersion 1', () => assert.equal(DEFAULT_SETTINGS.schemaVersion, 1));
  it('has defaultSpeed 2.0', () => assert.equal(DEFAULT_SETTINGS.defaultSpeed, 2.0));
  it('has scope global', () => assert.equal(DEFAULT_SETTINGS.scope, 'global'));
  it('has youtubeEnabled true', () => assert.equal(DEFAULT_SETTINGS.youtubeEnabled, true));
  it('has captionsMode leave', () => assert.equal(DEFAULT_SETTINGS.captionsMode, 'leave'));
  it('has volumeMode leave', () => assert.equal(DEFAULT_SETTINGS.volumeMode, 'leave'));
  it('is frozen', () => assert.ok(Object.isFrozen(DEFAULT_SETTINGS)));
});

describe('applyDefaults', () => {
  it('empty object returns full settings identical to DEFAULT_SETTINGS', () => {
    assert.deepEqual(applyDefaults({}), DEFAULT_SETTINGS);
  });

  it('valid defaultSpeed 1.5 is kept', () => {
    assert.equal(applyDefaults({ defaultSpeed: 1.5 }).defaultSpeed, 1.5);
  });

  it('rest of keys filled from defaults when only defaultSpeed given', () => {
    const result = applyDefaults({ defaultSpeed: 1.5 });
    assert.equal(result.scope, DEFAULT_SETTINGS.scope);
    assert.equal(result.youtubeEnabled, DEFAULT_SETTINGS.youtubeEnabled);
    assert.equal(result.captionsMode, DEFAULT_SETTINGS.captionsMode);
    assert.equal(result.volumeMode, DEFAULT_SETTINGS.volumeMode);
  });

  it('defaultSpeed below range replaced with default', () => {
    assert.equal(applyDefaults({ defaultSpeed: 0.01 }).defaultSpeed, DEFAULT_SETTINGS.defaultSpeed);
  });

  it('defaultSpeed above range replaced with default', () => {
    assert.equal(applyDefaults({ defaultSpeed: 99 }).defaultSpeed, DEFAULT_SETTINGS.defaultSpeed);
  });

  it('defaultSpeed as string replaced with default', () => {
    assert.equal(applyDefaults({ defaultSpeed: '2.0' }).defaultSpeed, DEFAULT_SETTINGS.defaultSpeed);
  });

  it('defaultSpeed NaN replaced with default', () => {
    assert.equal(applyDefaults({ defaultSpeed: NaN }).defaultSpeed, DEFAULT_SETTINGS.defaultSpeed);
  });

  it('youtubeEnabled false is kept', () => {
    assert.equal(applyDefaults({ youtubeEnabled: false }).youtubeEnabled, false);
  });

  it('youtubeEnabled non-boolean replaced with true', () => {
    assert.equal(applyDefaults({ youtubeEnabled: 1 }).youtubeEnabled, true);
  });

  it('youtubeEnabled null replaced with true', () => {
    assert.equal(applyDefaults({ youtubeEnabled: null }).youtubeEnabled, true);
  });

  it('captionsMode leave is kept', () => {
    assert.equal(applyDefaults({ captionsMode: 'leave' }).captionsMode, 'leave');
  });

  it('captionsMode unknown value replaced with leave', () => {
    assert.equal(applyDefaults({ captionsMode: 'auto' }).captionsMode, 'leave');
  });

  it('volumeMode leave is kept', () => {
    assert.equal(applyDefaults({ volumeMode: 'leave' }).volumeMode, 'leave');
  });

  it('volumeMode unknown value replaced with leave', () => {
    assert.equal(applyDefaults({ volumeMode: 'off' }).volumeMode, 'leave');
  });

  it('settings survive JSON round-trip', () => {
    const original = { defaultSpeed: 1.5, youtubeEnabled: false };
    const roundTripped = JSON.parse(JSON.stringify(original));
    const result = applyDefaults(roundTripped);
    assert.equal(result.defaultSpeed, 1.5);
    assert.equal(result.youtubeEnabled, false);
    assert.equal(result.captionsMode, DEFAULT_SETTINGS.captionsMode);
  });
});

describe('migrateSettings', () => {
  it('valid v1 settings pass through unchanged', () => {
    const input = { ...DEFAULT_SETTINGS };
    assert.deepEqual(migrateSettings(input), applyDefaults(input));
  });

  it('unknown schemaVersion treated as v1 without crash', () => {
    const result = migrateSettings({ schemaVersion: 99, defaultSpeed: 2.0 });
    assert.equal(typeof result, 'object');
    assert.ok(result !== null);
  });

  it('unknown schemaVersion produces valid settings', () => {
    const result = migrateSettings({ schemaVersion: 99 });
    assert.deepEqual(result, applyDefaults({}));
  });

  it('null input returns defaults', () => {
    assert.deepEqual(migrateSettings(null), applyDefaults({}));
  });

  it('non-object input returns defaults', () => {
    assert.deepEqual(migrateSettings('corrupted'), applyDefaults({}));
  });

  it('empty object returns defaults', () => {
    assert.deepEqual(migrateSettings({}), applyDefaults({}));
  });
});

describe('validateSettings', () => {
  it('valid DEFAULT_SETTINGS returns valid true with settings', () => {
    const result = validateSettings({ ...DEFAULT_SETTINGS });
    assert.equal(result.valid, true);
    assert.ok('settings' in result);
  });

  it('valid result has no errors field', () => {
    const result = validateSettings({ ...DEFAULT_SETTINGS });
    assert.equal(result.errors, undefined);
  });

  it('invalid defaultSpeed returns valid false', () => {
    const result = validateSettings({ ...DEFAULT_SETTINGS, defaultSpeed: 0.01 });
    assert.equal(result.valid, false);
  });

  it('invalid defaultSpeed includes errors array', () => {
    const result = validateSettings({ ...DEFAULT_SETTINGS, defaultSpeed: 0.01 });
    assert.ok(Array.isArray(result.errors));
    assert.ok(result.errors.length > 0);
  });

  it('invalid youtubeEnabled returns valid false', () => {
    const result = validateSettings({ ...DEFAULT_SETTINGS, youtubeEnabled: 'yes' });
    assert.equal(result.valid, false);
  });

  it('invalid captionsMode returns valid false', () => {
    const result = validateSettings({ ...DEFAULT_SETTINGS, captionsMode: 'unknown' });
    assert.equal(result.valid, false);
  });

  it('invalid volumeMode returns valid false', () => {
    const result = validateSettings({ ...DEFAULT_SETTINGS, volumeMode: 'unknown' });
    assert.equal(result.valid, false);
  });

  it('multiple invalid fields accumulate errors', () => {
    const result = validateSettings({ ...DEFAULT_SETTINGS, defaultSpeed: 0.01, youtubeEnabled: 'yes' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.length >= 2);
  });
});
