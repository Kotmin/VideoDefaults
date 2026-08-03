import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMANDS,
  DEFAULT_KEYMAP,
  MAX_JUMP_TARGETS,
  SPEED_SHORTCUTS,
  createShortcutController,
  eventMatchesPrefix,
  filterLabelPairs,
  generateLabels,
  normalizeKeymap,
  normalizeSpeedShortcuts,
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
