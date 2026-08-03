import { validateSpeed } from './speed.js';
import { DEFAULT_KEYMAP, normalizeKeymap } from './keyboard-shortcuts.js';

export const DEFAULT_SETTINGS = Object.freeze({
  schemaVersion: 1,
  defaultSpeed: 2.0,
  scope: 'global',
  youtubeEnabled: true,
  captionsMode: 'leave',
  volumeMode: 'leave',
  keymap: DEFAULT_KEYMAP,
});

const VALID_CAPTIONS_MODES = Object.freeze(['leave']);
const VALID_VOLUME_MODES = Object.freeze(['leave']);

function resolveDefaultSpeed(value) {
  return validateSpeed(value).valid ? validateSpeed(value).value : DEFAULT_SETTINGS.defaultSpeed;
}

function resolveYoutubeEnabled(value) {
  return typeof value === 'boolean' ? value : DEFAULT_SETTINGS.youtubeEnabled;
}

function resolveCaptionsMode(value) {
  return VALID_CAPTIONS_MODES.includes(value) ? value : DEFAULT_SETTINGS.captionsMode;
}

function resolveVolumeMode(value) {
  return VALID_VOLUME_MODES.includes(value) ? value : DEFAULT_SETTINGS.volumeMode;
}

export function applyDefaults(partial, isMac = false) {
  const src = partial != null && typeof partial === 'object' ? partial : {};
  return {
    schemaVersion: DEFAULT_SETTINGS.schemaVersion,
    defaultSpeed: resolveDefaultSpeed(src.defaultSpeed),
    scope: DEFAULT_SETTINGS.scope,
    youtubeEnabled: resolveYoutubeEnabled(src.youtubeEnabled),
    captionsMode: resolveCaptionsMode(src.captionsMode),
    volumeMode: resolveVolumeMode(src.volumeMode),
    keymap: normalizeKeymap(src.keymap, isMac),
  };
}

export function migrateSettings(raw, isMac = false) {
  if (raw == null || typeof raw !== 'object') {
    return applyDefaults({}, isMac);
  }
  return applyDefaults(raw, isMac);
}

export function validateSettings(obj) {
  const errors = [];

  if (!validateSpeed(obj.defaultSpeed).valid) {
    errors.push(`defaultSpeed: ${validateSpeed(obj.defaultSpeed).error}`);
  }
  if (typeof obj.youtubeEnabled !== 'boolean') {
    errors.push('youtubeEnabled: must be a boolean');
  }
  if (!VALID_CAPTIONS_MODES.includes(obj.captionsMode)) {
    errors.push(`captionsMode: must be one of ${VALID_CAPTIONS_MODES.join(', ')}`);
  }
  if (!VALID_VOLUME_MODES.includes(obj.volumeMode)) {
    errors.push(`volumeMode: must be one of ${VALID_VOLUME_MODES.join(', ')}`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, settings: { ...obj } };
}
