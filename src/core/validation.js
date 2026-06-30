import { validateSpeed } from './speed.js';

export const MESSAGE_TYPES = Object.freeze({
  GET_PLAYBACK_STATE: 'GET_PLAYBACK_STATE',
  SET_DEFAULT_SPEED: 'SET_DEFAULT_SPEED',
  APPLY_SPEED_TO_ACTIVE_VIDEO: 'APPLY_SPEED_TO_ACTIVE_VIDEO',
  GET_SETTINGS: 'GET_SETTINGS',
  SET_SETTINGS: 'SET_SETTINGS',
});

const KNOWN_TYPES = new Set(Object.values(MESSAGE_TYPES));

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateSpeedPayload(msg) {
  if (!isPlainObject(msg.payload)) {
    return { valid: false, error: 'payload must be an object with a speed field' };
  }
  const speedResult = validateSpeed(msg.payload.speed);
  if (!speedResult.valid) {
    return { valid: false, error: speedResult.error };
  }
  return { valid: true, type: msg.type, payload: msg.payload };
}

export function validateMessage(msg) {
  if (!isPlainObject(msg)) {
    return { valid: false, error: 'message must be a plain object' };
  }
  if (typeof msg.type !== 'string' || !KNOWN_TYPES.has(msg.type)) {
    return { valid: false, error: `unknown or missing message type: ${msg.type}` };
  }
  if (msg.type === MESSAGE_TYPES.SET_DEFAULT_SPEED || msg.type === MESSAGE_TYPES.APPLY_SPEED_TO_ACTIVE_VIDEO) {
    return validateSpeedPayload(msg);
  }
  if (msg.type === MESSAGE_TYPES.SET_SETTINGS) {
    if (!isPlainObject(msg.payload)) {
      return { valid: false, error: 'SET_SETTINGS requires a non-null object payload' };
    }
    return { valid: true, type: msg.type, payload: msg.payload };
  }
  return { valid: true, type: msg.type };
}
