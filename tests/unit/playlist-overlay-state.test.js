import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CREATE_NEW_ROW,
  createOverlayState,
  visibleRows,
  moveHighlight,
  typeChar,
  backspace,
  toggleHighlighted,
  resolveEnter,
  openCreateDialog,
  typeInCreateDialog,
  backspaceInCreateDialog,
  closeCreateDialog,
  commitCreatedPlaylist,
  resolveCreatedPlaylistChanges,
} from '../../src/ui/playlist-overlay-state.js';

const PLAYLISTS = [{ name: 'Comedy' }, { name: 'Documentaries' }, { name: 'Watch later' }];

describe('visibleRows', () => {
  it('returns all playlists for an empty query', () => {
    const s = createOverlayState(PLAYLISTS);
    assert.equal(visibleRows(s).length, 3);
  });

  it('filters by fuzzy query', () => {
    const s = typeChar(createOverlayState(PLAYLISTS), 'com');
    assert.deepEqual(visibleRows(s).map((p) => p.name), ['Comedy']);
  });
});

describe('moveHighlight', () => {
  it('wraps forward past the create-new row back to index 0', () => {
    let s = createOverlayState(PLAYLISTS);
    for (let i = 0; i < 4; i += 1) s = moveHighlight(s, 1);
    assert.equal(s.highlightIndex, 0);
  });

  it('wraps backward from index 0 to the create-new row', () => {
    const s = moveHighlight(createOverlayState(PLAYLISTS), -1);
    assert.equal(s.highlightIndex, 3);
  });

  it('wraps within a single-row (create-new only) list', () => {
    const s0 = typeChar(createOverlayState(PLAYLISTS), 'zzz-no-match');
    assert.equal(visibleRows(s0).length, 0);
    const s1 = moveHighlight(s0, 1);
    assert.equal(s1.highlightIndex, 0);
  });
});

describe('typeChar / backspace', () => {
  it('typing resets highlight to 0', () => {
    const s0 = moveHighlight(createOverlayState(PLAYLISTS), 1);
    const s1 = typeChar(s0, 'c');
    assert.equal(s1.highlightIndex, 0);
    assert.equal(s1.query, 'c');
  });

  it('backspace removes the last typed character', () => {
    const s = backspace(typeChar(createOverlayState(PLAYLISTS), 'co'));
    assert.equal(s.query, 'c');
  });
});

describe('toggleHighlighted', () => {
  it('checks then unchecks the highlighted playlist', () => {
    const s0 = createOverlayState(PLAYLISTS);
    const s1 = toggleHighlighted(s0);
    assert.ok(s1.checked.has('Comedy'));
    const s2 = toggleHighlighted(s1);
    assert.ok(!s2.checked.has('Comedy'));
  });

  it('does nothing when the create-new row is highlighted', () => {
    const s0 = moveHighlight(createOverlayState(PLAYLISTS), -1);
    const s1 = toggleHighlighted(s0);
    assert.equal(s1.checked.size, 0);
  });

  it('caps checked selection at 5 and ignores a 6th toggle', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}` }));
    let s = createOverlayState(many);
    for (let i = 0; i < 6; i += 1) {
      s = toggleHighlighted(s);
      s = moveHighlight(s, 1);
    }
    assert.equal(s.checked.size, 5);
    assert.ok(!s.checked.has('P5'));
  });
});

describe('resolveEnter', () => {
  it('confirms the checked set as an add when non-empty', () => {
    const s = toggleHighlighted(moveHighlight(createOverlayState(PLAYLISTS), 1));
    const result = resolveEnter(s);
    assert.deepEqual(result, { type: 'confirm', toAdd: ['Documentaries'], toRemove: [] });
  });

  it('implicitly single-selects the highlighted row when nothing is checked', () => {
    const s = createOverlayState(PLAYLISTS);
    assert.deepEqual(resolveEnter(s), { type: 'confirm', toAdd: ['Comedy'], toRemove: [] });
  });

  it('opens create-new when the create-new row is highlighted', () => {
    const s = moveHighlight(createOverlayState(PLAYLISTS), -1);
    assert.deepEqual(resolveEnter(s), { type: 'create-new' });
  });

  it('pre-checks playlists the video is already in', () => {
    const seeded = [{ name: 'Comedy', selected: true }, { name: 'Documentaries', selected: false }];
    const s = createOverlayState(seeded);
    assert.ok(s.checked.has('Comedy'));
    assert.ok(!s.checked.has('Documentaries'));
  });

  it('unchecking a pre-checked playlist and confirming resolves it as a removal', () => {
    const seeded = [{ name: 'Comedy', selected: true }, { name: 'Documentaries', selected: false }];
    const s = toggleHighlighted(createOverlayState(seeded));
    const result = resolveEnter(s);
    assert.deepEqual(result, { type: 'confirm', toAdd: [], toRemove: ['Comedy'] });
  });

  it('implicit single-select on a highlighted row adds it without dropping pre-checked playlists', () => {
    const seeded = [{ name: 'Comedy', selected: true }, { name: 'Documentaries', selected: false }];
    const s = moveHighlight(createOverlayState(seeded), 1);
    const result = resolveEnter(s);
    assert.deepEqual(result, { type: 'confirm', toAdd: ['Documentaries'], toRemove: [] });
  });
});

describe('resolveCreatedPlaylistChanges', () => {
  it('diffs the checked set against original selected flags', () => {
    const seeded = [{ name: 'Comedy', selected: true }, { name: 'Documentaries', selected: false }];
    let s = toggleHighlighted(createOverlayState(seeded));
    s = { ...s, playlists: [...s.playlists, { name: 'New Stuff', selected: false }], checked: new Set([...s.checked, 'New Stuff']) };
    assert.deepEqual(resolveCreatedPlaylistChanges(s), { toAdd: ['New Stuff'], toRemove: ['Comedy'] });
  });
});

describe('create-new sub-dialog', () => {
  it('opens with an empty query and preserves prior checked state', () => {
    const s0 = toggleHighlighted(createOverlayState(PLAYLISTS));
    const s1 = openCreateDialog(s0);
    assert.deepEqual(s1.subDialog, { query: '' });
    assert.ok(s1.checked.has('Comedy'));
  });

  it('types and backspaces within the sub-dialog only', () => {
    let s = openCreateDialog(createOverlayState(PLAYLISTS));
    s = typeInCreateDialog(s, 'N');
    s = typeInCreateDialog(s, 'e');
    assert.equal(s.subDialog.query, 'Ne');
    s = backspaceInCreateDialog(s);
    assert.equal(s.subDialog.query, 'N');
  });

  it('typing when no sub-dialog is open is a no-op', () => {
    const s0 = createOverlayState(PLAYLISTS);
    const s1 = typeInCreateDialog(s0, 'x');
    assert.equal(s1, s0);
  });

  it('closeCreateDialog clears the sub-dialog and keeps checked state', () => {
    const s0 = toggleHighlighted(createOverlayState(PLAYLISTS));
    const s1 = closeCreateDialog(openCreateDialog(s0));
    assert.equal(s1.subDialog, null);
    assert.ok(s1.checked.has('Comedy'));
  });

  it('commitCreatedPlaylist appends the new playlist, checks it, and preserves prior checks', () => {
    const s0 = toggleHighlighted(createOverlayState(PLAYLISTS));
    let s1 = openCreateDialog(s0);
    s1 = typeInCreateDialog(s1, 'New Stuff');
    const s2 = commitCreatedPlaylist(s1, 'New Stuff');
    assert.equal(s2.subDialog, null);
    assert.ok(s2.checked.has('Comedy'));
    assert.ok(s2.checked.has('New Stuff'));
    assert.ok(s2.playlists.some((p) => p.name === 'New Stuff'));
  });
});

describe('CREATE_NEW_ROW', () => {
  it('is a unique symbol not equal to any playlist row', () => {
    assert.equal(typeof CREATE_NEW_ROW, 'symbol');
  });
});
