export const MIN_SPEED = 0.25;
export const MAX_SPEED = 4.0;
export const SPEED_STEP = 0.05;
export const PRESETS = Object.freeze([1, 1.5, 2.0]);

/** @param {number} value @returns {number} */
export function clampSpeed(value) {
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, value));
}

/** @param {number} value @returns {number} */
export function normalizeSpeed(value) {
  return parseFloat((Math.round(value / SPEED_STEP) * SPEED_STEP).toFixed(2));
}

/**
 * @param {unknown} value
 * @returns {{ valid: true, value: number } | { valid: false, error: string }}
 */
export function validateSpeed(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { valid: false, error: 'speed must be a finite number' };
  }
  if (value < MIN_SPEED) {
    return { valid: false, error: `speed must be at least ${MIN_SPEED}` };
  }
  if (value > MAX_SPEED) {
    return { valid: false, error: `speed must be at most ${MAX_SPEED}` };
  }
  return { valid: true, value: normalizeSpeed(value) };
}
