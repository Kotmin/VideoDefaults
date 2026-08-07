import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMANDS,
  DEFAULT_KEYMAP,
  MAX_JUMP_TARGETS,
  SPEED_SHORTCUTS,
  PLAYLIST_KEYS,
  createShortcutController,
  eventMatchesPrefix,
  filterLabelPairs,
  generateLabels,
  normalizeKeymap,
  normalizeSpeedShortcuts,
  normalizePlaylistKeys,
} from '../../src/core/keyboard-shortcuts.js';

function key(k, extra = {}) {
  return { key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, isEditable: false, ...extra };
}

const prefix = key('a', { ctrlKey: true });

describe('normalizeKeymap', () => {
  it('returns defaults for garbage input', () => {
    assert.deepEqual(normalizeKeymap(null), { ...DEFAULT_KEYMAP, prefix: { ...DEFAULT_KEYMAP.prefix }, chords: { ...DEFAULT_KEYMAP.chords } });
    assert.deepEqual(normalizeKeymap('nope').prefix, { ...DEFAULT_KEYMAP.prefix });
  });

  it('rejects a prefix without ctrl or meta modifier', () => {
    const km = normalizeKeymap({ prefix: { key: 'a', ctrl: false, meta: false } });
    assert.deepEqual(km.prefix, { ...DEFAULT_KEYMAP.prefix });
  });

  it('accepts a meta-based prefix for macOS', () => {
    const km = normalizeKeymap({ prefix: { key: 'a', ctrl: false, meta: true } });
    assert.deepEqual(km.prefix, { key: 'a', ctrl: false, meta: true });
  });

  it('isMac omitted or false leaves prefix defaulting behavior unchanged', () => {
    assert.deepEqual(normalizeKeymap(null).prefix, { key: 'a', ctrl: true, meta: false });
    assert.deepEqual(normalizeKeymap(null, false).prefix, { key: 'a', ctrl: true, meta: false });
  });

  it('isMac true defaults the prefix to Cmd+A when no stored prefix is present', () => {
    assert.deepEqual(normalizeKeymap(null, true).prefix, { key: 'a', ctrl: false, meta: true });
    assert.deepEqual(normalizeKeymap({}, true).prefix, { key: 'a', ctrl: false, meta: true });
  });

  it('isMac true does not override an already-valid stored prefix', () => {
    const km = normalizeKeymap({ prefix: { key: 'a', ctrl: true, meta: false } }, true);
    assert.deepEqual(km.prefix, { key: 'a', ctrl: true, meta: false });
  });

  it('drops chords with unknown commands and invalid keys, keeping defaults for the rest', () => {
    const km = normalizeKeymap({ chords: { y: COMMANDS.GO_HOME, x: 'rm-rf', long: COMMANDS.GO_HOME } });
    assert.deepEqual(km.chords, { ...DEFAULT_KEYMAP.chords });
  });

  it('falls back to default chords when all entries are invalid', () => {
    const km = normalizeKeymap({ chords: { x: 'nope' } });
    assert.deepEqual(km.chords, { ...DEFAULT_KEYMAP.chords });
  });

  it('merges a stored partial override onto the defaults instead of replacing them', () => {
    const km = normalizeKeymap({ chords: { o: COMMANDS.GO_HOME } });
    assert.equal(km.chords.o, COMMANDS.GO_HOME);
    assert.equal(km.chords.y, DEFAULT_KEYMAP.chords.y);
    assert.equal(km.chords.v, DEFAULT_KEYMAP.chords.v);
    assert.equal(km.chords.b, DEFAULT_KEYMAP.chords.b);
    assert.equal(km.chords.n, DEFAULT_KEYMAP.chords.n);
    assert.equal(km.chords.h, DEFAULT_KEYMAP.chords.h);
  });

  it('drops shiftChord entries with unknown commands and invalid keys, keeping defaults for the rest', () => {
    const km = normalizeKeymap({ shiftChords: { p: 'rm-rf', long: COMMANDS.GO_HOME } });
    assert.deepEqual(km.shiftChords, { ...DEFAULT_KEYMAP.shiftChords });
  });

  it('merges a stored shiftChords partial override onto the defaults', () => {
    const km = normalizeKeymap({ shiftChords: { p: COMMANDS.GO_HOME } });
    assert.equal(km.shiftChords.p, COMMANDS.GO_HOME);
  });

  it('rejects non-youtube and non-https home urls', () => {
    assert.equal(normalizeKeymap({ homeUrl: 'https://evil.example/' }).homeUrl, DEFAULT_KEYMAP.homeUrl);
    assert.equal(normalizeKeymap({ homeUrl: 'http://www.youtube.com/' }).homeUrl, DEFAULT_KEYMAP.homeUrl);
    assert.equal(normalizeKeymap({ homeUrl: 'javascript:alert(1)' }).homeUrl, DEFAULT_KEYMAP.homeUrl);
    assert.equal(normalizeKeymap({ homeUrl: 'https://music.youtube.com/' }).homeUrl, 'https://music.youtube.com/');
  });

  it('accepts the speed and auto-apply commands as chords', () => {
    const km = normalizeKeymap({
      chords: {
        v: COMMANDS.SET_SPEED_1,
        b: COMMANDS.SET_SPEED_2,
        n: COMMANDS.SET_SPEED_3,
        h: COMMANDS.TOGGLE_AUTO_APPLY,
      },
    });
    assert.equal(km.chords.v, COMMANDS.SET_SPEED_1);
    assert.equal(km.chords.b, COMMANDS.SET_SPEED_2);
    assert.equal(km.chords.n, COMMANDS.SET_SPEED_3);
    assert.equal(km.chords.h, COMMANDS.TOGGLE_AUTO_APPLY);
  });
});

describe('DEFAULT_KEYMAP', () => {
  it('chords v/b/n/h map to the speed and auto-apply commands from shortcuts.config.json', () => {
    assert.equal(DEFAULT_KEYMAP.chords.v, COMMANDS.SET_SPEED_1);
    assert.equal(DEFAULT_KEYMAP.chords.b, COMMANDS.SET_SPEED_2);
    assert.equal(DEFAULT_KEYMAP.chords.n, COMMANDS.SET_SPEED_3);
    assert.equal(DEFAULT_KEYMAP.chords.h, COMMANDS.TOGGLE_AUTO_APPLY);
  });

  it('chord p maps to show-queue-labels', () => {
    assert.equal(DEFAULT_KEYMAP.chords.p, COMMANDS.SHOW_QUEUE_LABELS);
  });

  it('shift-chord p maps to show-playlist-labels, distinct from plain p', () => {
    assert.equal(DEFAULT_KEYMAP.shiftChords.p, COMMANDS.SHOW_PLAYLIST_LABELS);
    assert.notEqual(DEFAULT_KEYMAP.shiftChords.p, DEFAULT_KEYMAP.chords.p);
  });
});

describe('SPEED_SHORTCUTS', () => {
  it('has the three expected default speeds', () => {
    assert.deepEqual(SPEED_SHORTCUTS, {
      [COMMANDS.SET_SPEED_1]: 1,
      [COMMANDS.SET_SPEED_2]: 1.5,
      [COMMANDS.SET_SPEED_3]: 2.0,
    });
  });
});

describe('normalizeSpeedShortcuts', () => {
  it('falls back to defaults for garbage input', () => {
    assert.deepEqual(normalizeSpeedShortcuts(null), SPEED_SHORTCUTS);
    assert.deepEqual(normalizeSpeedShortcuts('nope'), SPEED_SHORTCUTS);
  });

  it('falls back per-command when an entry is out of range or non-numeric', () => {
    const result = normalizeSpeedShortcuts({
      [COMMANDS.SET_SPEED_1]: 99,
      [COMMANDS.SET_SPEED_2]: 'fast',
      [COMMANDS.SET_SPEED_3]: 1.75,
    });
    assert.equal(result[COMMANDS.SET_SPEED_1], SPEED_SHORTCUTS[COMMANDS.SET_SPEED_1]);
    assert.equal(result[COMMANDS.SET_SPEED_2], SPEED_SHORTCUTS[COMMANDS.SET_SPEED_2]);
    assert.equal(result[COMMANDS.SET_SPEED_3], 1.75);
  });
});

describe('PLAYLIST_KEYS', () => {
  it('has the expected defaults from shortcuts.config.json', () => {
    assert.deepEqual(PLAYLIST_KEYS, { toggle: ' ', check: 'ArrowRight', uncheck: 'ArrowLeft' });
  });
});

describe('normalizePlaylistKeys', () => {
  it('falls back to defaults for garbage input', () => {
    assert.deepEqual(normalizePlaylistKeys(null), PLAYLIST_KEYS);
    assert.deepEqual(normalizePlaylistKeys('nope'), PLAYLIST_KEYS);
  });

  it('falls back per-action for empty or non-string entries', () => {
    const result = normalizePlaylistKeys({ toggle: '', check: 42, uncheck: 'ArrowLeft' });
    assert.equal(result.toggle, PLAYLIST_KEYS.toggle);
    assert.equal(result.check, PLAYLIST_KEYS.check);
    assert.equal(result.uncheck, 'ArrowLeft');
  });

  it('accepts a full override', () => {
    const result = normalizePlaylistKeys({ toggle: 'x', check: 'Enter', uncheck: 'Backspace' });
    assert.deepEqual(result, { toggle: 'x', check: 'Enter', uncheck: 'Backspace' });
  });
});

describe('eventMatchesPrefix', () => {
  it('matches ctrl+a against the default prefix', () => {
    assert.equal(eventMatchesPrefix(prefix, DEFAULT_KEYMAP.prefix), true);
  });

  it('rejects plain a, ctrl+meta+a, and alt combinations', () => {
    assert.equal(eventMatchesPrefix(key('a'), DEFAULT_KEYMAP.prefix), false);
    assert.equal(eventMatchesPrefix(key('a', { ctrlKey: true, metaKey: true }), DEFAULT_KEYMAP.prefix), false);
    assert.equal(eventMatchesPrefix(key('a', { ctrlKey: true, altKey: true }), DEFAULT_KEYMAP.prefix), false);
  });
});

describe('createShortcutController', () => {
  it('prefix then chord key returns the command and consumes both', () => {
    const c = createShortcutController();
    const first = c.handleKey(prefix, DEFAULT_KEYMAP);
    assert.deepEqual(first, { consume: true, command: null, pending: true });
    const second = c.handleKey(key('y'), DEFAULT_KEYMAP);
    assert.deepEqual(second, { consume: true, command: COMMANDS.GO_HOME, pending: false });
  });

  it('accepts a chord key with ctrl still held', () => {
    const c = createShortcutController();
    c.handleKey(prefix, DEFAULT_KEYMAP);
    const r = c.handleKey(key('o', { ctrlKey: true }), DEFAULT_KEYMAP);
    assert.equal(r.command, COMMANDS.SHOW_JUMP_LABELS);
  });

  it('prefix then p returns show-queue-labels', () => {
    const c = createShortcutController();
    c.handleKey(prefix, DEFAULT_KEYMAP);
    const r = c.handleKey(key('p'), DEFAULT_KEYMAP);
    assert.equal(r.command, COMMANDS.SHOW_QUEUE_LABELS);
  });

  it('prefix then Shift+P returns show-playlist-labels, not show-queue-labels', () => {
    const c = createShortcutController();
    c.handleKey(prefix, DEFAULT_KEYMAP);
    const r = c.handleKey(key('P', { shiftKey: true }), DEFAULT_KEYMAP);
    assert.deepEqual(r, { consume: true, command: COMMANDS.SHOW_PLAYLIST_LABELS, pending: false });
  });

  it('shift held on a key with no shiftChord entry does not fall back to the unshifted chord', () => {
    const c = createShortcutController();
    c.handleKey(prefix, DEFAULT_KEYMAP);
    const r = c.handleKey(key('Y', { shiftKey: true }), DEFAULT_KEYMAP);
    assert.deepEqual(r, { consume: false, command: null, pending: false });
  });

  it('unknown key cancels pending without consuming', () => {
    const c = createShortcutController();
    c.handleKey(prefix, DEFAULT_KEYMAP);
    const r = c.handleKey(key('k'), DEFAULT_KEYMAP);
    assert.deepEqual(r, { consume: false, command: null, pending: false });
  });

  it('ignores the prefix while focus is in an editable element', () => {
    const c = createShortcutController();
    const r = c.handleKey({ ...prefix, isEditable: true }, DEFAULT_KEYMAP);
    assert.deepEqual(r, { consume: false, command: null, pending: false });
  });

  it('modifier keydown does not cancel pending state', () => {
    const c = createShortcutController();
    c.handleKey(prefix, DEFAULT_KEYMAP);
    c.handleKey(key('Control'), DEFAULT_KEYMAP);
    assert.equal(c.isPending(), true);
  });

  it('Escape cancels pending and is consumed', () => {
    const c = createShortcutController();
    c.handleKey(prefix, DEFAULT_KEYMAP);
    const r = c.handleKey(key('Escape'), DEFAULT_KEYMAP);
    assert.deepEqual(r, { consume: true, command: null, pending: false });
  });

  it('cancel() resets pending state', () => {
    const c = createShortcutController();
    c.handleKey(prefix, DEFAULT_KEYMAP);
    c.cancel();
    assert.equal(c.isPending(), false);
    const r = c.handleKey(key('y'), DEFAULT_KEYMAP);
    assert.deepEqual(r, { consume: false, command: null, pending: false });
  });
});

describe('generateLabels', () => {
  it('produces unique deterministic two-char labels', () => {
    const labels = generateLabels(30);
    assert.equal(labels.length, 30);
    assert.equal(new Set(labels).size, 30);
    assert.equal(labels[0], 'AA');
    assert.deepEqual(generateLabels(30), labels);
  });

  it('caps at MAX_JUMP_TARGETS', () => {
    assert.equal(generateLabels(10000).length, MAX_JUMP_TARGETS);
  });
});

describe('filterLabelPairs', () => {
  const pairs = [{ label: 'AA' }, { label: 'AS' }, { label: 'SA' }];

  it('narrows by typed prefix case-insensitively', () => {
    const { remaining, exact } = filterLabelPairs(pairs, 'a');
    assert.deepEqual(remaining.map((p) => p.label), ['AA', 'AS']);
    assert.equal(exact, null);
  });

  it('reports an exact match', () => {
    const { exact } = filterLabelPairs(pairs, 'as');
    assert.equal(exact.label, 'AS');
  });

  it('returns empty remaining for a dead-end prefix', () => {
    const { remaining, exact } = filterLabelPairs(pairs, 'x');
    assert.deepEqual(remaining, []);
    assert.equal(exact, null);
  });
});
