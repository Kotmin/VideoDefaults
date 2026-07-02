import { PRESETS, validateSpeed } from '../../lib/core/speed.js';
import { applyDefaults } from '../../lib/core/settings.js';
import { MESSAGE_TYPES } from '../../lib/core/validation.js';
import { createStorageAdapter } from '../../lib/browser-adapters/firefox/firefox-storage-adapter.js';

const storage = createStorageAdapter(browser);
const statusEl = document.getElementById('status');
const errorEl = document.getElementById('error');
const inputEl = document.getElementById('speed-input');
const autoApplyEl = document.getElementById('auto-apply-checkbox');

async function sendToContent(msg) {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tabs.length) return null;
  try {
    return await browser.tabs.sendMessage(tabs[0].id, msg);
  } catch {
    return null;
  }
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.hidden = true;
}

async function refresh() {
  const state = await sendToContent({ type: MESSAGE_TYPES.GET_PLAYBACK_STATE });
  if (!state || !state.hasVideo) {
    statusEl.textContent = 'No video detected on this page';
    return;
  }
  const override = state.manualOverride ? ' · manual override' : '';
  statusEl.textContent = `Current: ${state.speed}×${override}`;
}

async function applySpeed(speed) {
  const v = validateSpeed(speed);
  if (!v.valid) { showError(v.error); return; }
  clearError();
  const settings = applyDefaults(await storage.getSettings());
  await storage.saveSettings({ ...settings, defaultSpeed: v.value });
  const result = await sendToContent({
    type: MESSAGE_TYPES.APPLY_SPEED_TO_ACTIVE_VIDEO,
    payload: { speed: v.value },
  });
  if (result && !result.ok) showError(result.error);
  await refresh();
}

document.getElementById('apply-btn').addEventListener('click', () => {
  applySpeed(parseFloat(inputEl.value));
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') applySpeed(parseFloat(inputEl.value));
});

const presetsEl = document.getElementById('presets');
for (const preset of PRESETS) {
  const btn = document.createElement('button');
  btn.textContent = `${preset}×`;
  btn.addEventListener('click', () => applySpeed(preset));
  presetsEl.appendChild(btn);
}

autoApplyEl.addEventListener('change', async () => {
  const settings = applyDefaults(await storage.getSettings());
  await storage.saveSettings({ ...settings, youtubeEnabled: autoApplyEl.checked });
});

async function loadAutoApplyState() {
  const settings = applyDefaults(await storage.getSettings());
  autoApplyEl.checked = settings.youtubeEnabled;
}

loadAutoApplyState();
refresh();
