import { applyDefaults } from '../../lib/core/settings.js';
import { validateSpeed } from '../../lib/core/speed.js';
import {
  createState, markExtensionWrite, markManualOverride,
  clearOverride, isManualOverride, isExtensionToken, clearExtensionToken,
} from '../../lib/core/playback-state.js';
import { MESSAGE_TYPES } from '../../lib/core/validation.js';
import { debounce } from '../../lib/core/debounce.js';
import { isYouTubeWatchPage, findVideoElement, createYouTubeSiteAdapter } from '../../lib/site-adapters/youtube/youtube-site-adapter.js';
import { createPlayerAdapter } from '../../lib/player-adapters/html5-video-player-adapter.js';

let settings = null;
let state = createState();
let player = null;
let tokenCounter = 0;

function nextToken() {
  return `vd-${++tokenCounter}`;
}

async function loadSettings() {
  const stored = await browser.storage.local.get('videodefaults_settings');
  settings = applyDefaults(stored.videodefaults_settings ?? {});
}

function applySpeed(speed) {
  if (!player) return;
  const token = nextToken();
  state = markExtensionWrite(state, token);
  player.setSpeed(speed);
}

const tryInitVideo = debounce(() => {
  const el = findVideoElement(document);
  if (!el) return;

  player = createPlayerAdapter(el);
  state = clearOverride(state);

  player.onRateChange(() => {
    if (isExtensionToken(state, state.extensionToken)) {
      state = clearExtensionToken(state);
      return;
    }
    state = markManualOverride(state);
  });

  if (settings && !isManualOverride(state)) {
    applySpeed(settings.defaultSpeed);
  }
}, 300);

browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === MESSAGE_TYPES.GET_PLAYBACK_STATE) {
    return Promise.resolve({
      ok: true,
      speed: player ? player.getSpeed() : null,
      manualOverride: isManualOverride(state),
      hasVideo: player !== null,
    });
  }

  if (msg.type === MESSAGE_TYPES.APPLY_SPEED_TO_ACTIVE_VIDEO) {
    const v = validateSpeed(msg.payload?.speed);
    if (!v.valid) return Promise.resolve({ ok: false, error: v.error });
    state = clearOverride(state);
    applySpeed(v.value);
    return Promise.resolve({ ok: true });
  }

  return Promise.resolve({ ok: false, error: 'unknown message' });
});

async function init() {
  if (!isYouTubeWatchPage(location.href)) return;

  await loadSettings().catch(() => { settings = applyDefaults({}); });
  tryInitVideo();

  const siteAdapter = createYouTubeSiteAdapter(document, window);
  siteAdapter.onNavigate(() => {
    player = null;
    state = createState();
    if (isYouTubeWatchPage(location.href)) tryInitVideo();
  });
}

init();
