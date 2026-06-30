import { validateSpeed } from '../core/speed.js';
import { applyDefaults } from '../core/settings.js';

export class VideoDefaultsFacade {
  /** @param {{ getSettings, saveSettings, sendToActiveTab }} browserAdapter */
  constructor(browserAdapter) {
    this._adapter = browserAdapter;
  }

  async getSettings() {
    const raw = await this._adapter.getSettings();
    return applyDefaults(raw);
  }

  /** @param {number} speed @returns {Promise<{ok:boolean,error?:string}>} */
  async setDefaultSpeed(speed) {
    const v = validateSpeed(speed);
    if (!v.valid) return { ok: false, error: v.error };
    const current = await this.getSettings();
    await this._adapter.saveSettings({ ...current, defaultSpeed: v.value });
    return { ok: true };
  }

  /** @param {number} speed @returns {Promise<{ok:boolean,error?:string}>} */
  async applySpeedToActiveTab(speed) {
    const v = validateSpeed(speed);
    if (!v.valid) return { ok: false, error: v.error };
    try {
      return await this._adapter.sendToActiveTab({
        type: 'APPLY_SPEED_TO_ACTIVE_VIDEO',
        payload: { speed: v.value },
      });
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /** @returns {Promise<object>} */
  async getPlaybackState() {
    try {
      return await this._adapter.sendToActiveTab({ type: 'GET_PLAYBACK_STATE' });
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
}
