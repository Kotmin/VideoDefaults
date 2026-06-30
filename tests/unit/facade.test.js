import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { VideoDefaultsFacade } from '../../src/facade/video-defaults-facade.js';

function makeBrowserAdapter(overrides = {}) {
  return {
    getSettings: async () => ({}),
    saveSettings: async () => {},
    sendToActiveTab: async () => {},
    ...overrides,
  };
}

describe('VideoDefaultsFacade.getSettings', () => {
  it('returns merged settings from adapter', async () => {
    const adapter = makeBrowserAdapter({
      getSettings: async () => ({ defaultSpeed: 1.5 }),
    });
    const facade = new VideoDefaultsFacade(adapter);
    const s = await facade.getSettings();
    assert.equal(s.defaultSpeed, 1.5);
    assert.equal(s.schemaVersion, 1);
  });

  it('fills missing fields with defaults', async () => {
    const facade = new VideoDefaultsFacade(makeBrowserAdapter());
    const s = await facade.getSettings();
    assert.equal(s.defaultSpeed, 2.0);
    assert.equal(s.youtubeEnabled, true);
  });
});

describe('VideoDefaultsFacade.setDefaultSpeed', () => {
  it('saves valid speed', async () => {
    let saved = null;
    const adapter = makeBrowserAdapter({
      getSettings: async () => ({}),
      saveSettings: async (s) => { saved = s; },
    });
    const facade = new VideoDefaultsFacade(adapter);
    const result = await facade.setDefaultSpeed(1.5);
    assert.ok(result.ok);
    assert.equal(saved.defaultSpeed, 1.5);
  });

  it('rejects invalid speed', async () => {
    const facade = new VideoDefaultsFacade(makeBrowserAdapter());
    const result = await facade.setDefaultSpeed(0.01);
    assert.equal(result.ok, false);
    assert.ok(result.error);
  });

  it('rejects non-number', async () => {
    const facade = new VideoDefaultsFacade(makeBrowserAdapter());
    const result = await facade.setDefaultSpeed('fast');
    assert.equal(result.ok, false);
  });
});

describe('VideoDefaultsFacade.applySpeedToActiveTab', () => {
  it('sends APPLY_SPEED_TO_ACTIVE_VIDEO message for valid speed', async () => {
    let sent = null;
    const adapter = makeBrowserAdapter({
      sendToActiveTab: async (msg) => { sent = msg; return { ok: true }; },
    });
    const facade = new VideoDefaultsFacade(adapter);
    await facade.applySpeedToActiveTab(2.0);
    assert.equal(sent.type, 'APPLY_SPEED_TO_ACTIVE_VIDEO');
    assert.equal(sent.payload.speed, 2.0);
  });

  it('returns error for invalid speed without sending', async () => {
    let called = false;
    const adapter = makeBrowserAdapter({
      sendToActiveTab: async () => { called = true; },
    });
    const facade = new VideoDefaultsFacade(adapter);
    const result = await facade.applySpeedToActiveTab(99);
    assert.equal(result.ok, false);
    assert.equal(called, false);
  });
});

describe('VideoDefaultsFacade.getPlaybackState', () => {
  it('sends GET_PLAYBACK_STATE and returns response', async () => {
    const adapter = makeBrowserAdapter({
      sendToActiveTab: async () => ({ ok: true, speed: 1.5, manualOverride: false }),
    });
    const facade = new VideoDefaultsFacade(adapter);
    const result = await facade.getPlaybackState();
    assert.equal(result.speed, 1.5);
  });

  it('returns error when tab send fails', async () => {
    const adapter = makeBrowserAdapter({
      sendToActiveTab: async () => { throw new Error('no tab'); },
    });
    const facade = new VideoDefaultsFacade(adapter);
    const result = await facade.getPlaybackState();
    assert.equal(result.ok, false);
  });
});
