import shortcutsConfig from './shortcuts.config.json' with { type: 'json' };
import { validateSpeed } from './speed.js';

export const COMMANDS = Object.freeze({
  SHOW_JUMP_LABELS: 'show-jump-labels',
  GO_HOME: 'go-home',
  SET_SPEED_1: 'set-speed-1',
  SET_SPEED_2: 'set-speed-2',
  SET_SPEED_CUSTOM_1: 'set-speed-custom-1',
  SET_SPEED_CUSTOM_2: 'set-speed-custom-2',
  TOGGLE_AUTO_APPLY: 'toggle-auto-apply',
});

const KNOWN_COMMANDS = new Set(Object.values(COMMANDS));

export const RESERVED_YOUTUBE_KEYS = Object.freeze([
  ' ', 'k', 'j', 'l', 'f', 'm', 'c', 't', 'i', 'o', 'p', 'n',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  ',', '.', '<', '>', '/', '?',
  'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
]);

const FALLBACK_KEYMAP = Object.freeze({
  prefix: Object.freeze({ key: 'a', ctrl: true, meta: false }),
  chords: Object.freeze({
    o: COMMANDS.SHOW_JUMP_LABELS,
    y: COMMANDS.GO_HOME,
    1: COMMANDS.SET_SPEED_1,
    2: COMMANDS.SET_SPEED_2,
    3: COMMANDS.SET_SPEED_CUSTOM_1,
    4: COMMANDS.SET_SPEED_CUSTOM_2,
    5: COMMANDS.TOGGLE_AUTO_APPLY,
  }),
  homeUrl: 'https://www.youtube.com/',
});

export const MAX_JUMP_TARGETS = 676;

const LABEL_ALPHABET = 'ASDFGHJKLQWERTYUIOPZXCVBNM';

function isSingleChar(value) {
  return typeof value === 'string' && value.length === 1 && /[a-z0-9]/.test(value);
}

function normalizePrefix(raw) {
  const d = FALLBACK_KEYMAP.prefix;
  if (raw == null || typeof raw !== 'object') return { ...d };
  const key = isSingleChar(raw.key) ? raw.key : d.key;
  const ctrl = typeof raw.ctrl === 'boolean' ? raw.ctrl : d.ctrl;
  const meta = typeof raw.meta === 'boolean' ? raw.meta : d.meta;
  if (!ctrl && !meta) return { ...d };
  return { key, ctrl, meta };
}

function normalizeChords(raw) {
  if (raw == null || typeof raw !== 'object') return { ...FALLBACK_KEYMAP.chords };
  const chords = {};
  for (const [key, command] of Object.entries(raw)) {
    if (!isSingleChar(key)) continue;
    if (!KNOWN_COMMANDS.has(command)) continue;
    chords[key] = command;
  }
  return Object.keys(chords).length > 0 ? chords : { ...FALLBACK_KEYMAP.chords };
}

function normalizeHomeUrl(raw) {
  if (typeof raw !== 'string') return FALLBACK_KEYMAP.homeUrl;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return FALLBACK_KEYMAP.homeUrl;
    const host = parsed.hostname;
    if (host !== 'youtube.com' && !host.endsWith('.youtube.com')) return FALLBACK_KEYMAP.homeUrl;
    return raw;
  } catch {
    return FALLBACK_KEYMAP.homeUrl;
  }
}

export function normalizeKeymap(raw) {
  const src = raw != null && typeof raw === 'object' ? raw : {};
  return {
    prefix: normalizePrefix(src.prefix),
    chords: normalizeChords(src.chords),
    homeUrl: normalizeHomeUrl(src.homeUrl),
  };
}

export const DEFAULT_KEYMAP = Object.freeze(normalizeKeymap(shortcutsConfig));

const FALLBACK_SPEEDS = Object.freeze({
  [COMMANDS.SET_SPEED_1]: 1,
  [COMMANDS.SET_SPEED_2]: 2,
  [COMMANDS.SET_SPEED_CUSTOM_1]: 1.25,
  [COMMANDS.SET_SPEED_CUSTOM_2]: 1.5,
});

export function normalizeSpeedShortcuts(raw) {
  const src = raw != null && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const [command, fallback] of Object.entries(FALLBACK_SPEEDS)) {
    const v = validateSpeed(src[command]);
    out[command] = v.valid ? v.value : fallback;
  }
  return Object.freeze(out);
}

export const SPEED_SHORTCUTS = normalizeSpeedShortcuts(shortcutsConfig.speeds);

export function eventMatchesPrefix(evt, prefix) {
  return typeof evt.key === 'string'
    && evt.key.toLowerCase() === prefix.key
    && evt.ctrlKey === prefix.ctrl
    && evt.metaKey === prefix.meta
    && evt.altKey !== true;
}

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta']);

export function createShortcutController() {
  let pending = false;

  return {
    isPending() {
      return pending;
    },
    cancel() {
      pending = false;
    },
    handleKey(evt, keymap) {
      if (typeof evt.key !== 'string') return { consume: false, command: null, pending };
      if (MODIFIER_KEYS.has(evt.key)) return { consume: false, command: null, pending };

      if (!pending) {
        if (!evt.isEditable && eventMatchesPrefix(evt, keymap.prefix)) {
          pending = true;
          return { consume: true, command: null, pending };
        }
        return { consume: false, command: null, pending };
      }

      pending = false;
      if (evt.key === 'Escape') return { consume: true, command: null, pending };
      if (evt.altKey === true) return { consume: false, command: null, pending };
      const command = keymap.chords[evt.key.toLowerCase()] ?? null;
      return { consume: command !== null, command, pending };
    },
  };
}

export function generateLabels(count) {
  const n = Math.min(count, MAX_JUMP_TARGETS);
  const labels = [];
  for (const c1 of LABEL_ALPHABET) {
    for (const c2 of LABEL_ALPHABET) {
      if (labels.length >= n) return labels;
      labels.push(c1 + c2);
    }
  }
  return labels;
}

export function filterLabelPairs(pairs, typed) {
  const upper = typed.toUpperCase();
  const remaining = pairs.filter((p) => p.label.startsWith(upper));
  const exact = remaining.find((p) => p.label === upper) ?? null;
  return { remaining, exact };
}
