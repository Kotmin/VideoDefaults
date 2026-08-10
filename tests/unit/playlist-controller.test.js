import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPlaylistController } from '../../src/ui/playlist-controller.js';
import {
  createOverlayState, moveHighlight, typeChar, backspace, toggleHighlighted, checkHighlighted, uncheckHighlighted,
  resolveEnter, openCreateDialog, typeInCreateDialog, backspaceInCreateDialog, closeCreateDialog, commitCreatedPlaylist,
  resolveCreatedPlaylistChanges,
} from '../../src/ui/playlist-overlay-state.js';

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function makeKeyEvent(key) {
  return { key, prevented: 0, stopped: 0, preventDefault() { this.prevented += 1; }, stopPropagation() { this.stopped += 1; } };
}

// `rows` is read fresh on every openSaveToPlaylistPopup call (a plain array
// reference, mutable by driveCreateNewPlaylistEffect) so a test can simulate
// the native sheet gaining a row after a create-new, same as real YouTube.
function makeDeps({
  rows = [], loggedIn = true, hasTrigger = true,
  driveCreateNewPlaylistOk = true, driveCreateNewPlaylistEffect = null,
} = {}) {
  const calls = [];
  const trigger = { id: 'trigger' };
  const videoEl = { getBoundingClientRect: () => ({ top: 10, left: 20 }) };

  const playlistCache = {
    written: null,
    invalidated: 0,
    async write(playlists) { this.written = playlists; },
    async invalidate() { this.invalidated += 1; },
  };
  const playlistOverlay = {
    renders: [],
    closed: 0,
    render(state) { this.renders.push(state); },
    close() { this.closed += 1; },
  };

  return {
    calls,
    trigger,
    findVideoElement: () => videoEl,
    findSaveToPlaylistTrigger: () => (hasTrigger ? trigger : null),
    isLoggedIn: () => loggedIn,
    playlistCache,
    playlistOverlay,
    openSaveToPlaylistPopup: async (t) => { calls.push(['open', t]); return rows; },
    togglePlaylistRow: (row) => { calls.push(['toggle', row.name]); },
    driveCreateNewPlaylist: async (d, w, name) => {
      calls.push(['create', name]);
      if (driveCreateNewPlaylistEffect) driveCreateNewPlaylistEffect(name);
      return driveCreateNewPlaylistOk;
    },
    closeSaveToPlaylistPopup: async () => { calls.push(['close']); },
    showPlaylistProgress: (d, rect, current, total) => { calls.push(['progress', current, total]); },
    finishPlaylistProgress: (d, rect, added, total) => { calls.push(['finish', added, total]); },
    showNotLoggedInBadge: () => { calls.push(['badge']); },
    createOverlayState, moveHighlight, typeChar, backspace, toggleHighlighted, checkHighlighted, uncheckHighlighted,
    resolveEnter, openCreateDialog, typeInCreateDialog, backspaceInCreateDialog, closeCreateDialog, commitCreatedPlaylist,
    resolveCreatedPlaylistChanges,
    playlistKeys: { toggle: ' ', check: 'ArrowRight', uncheck: 'ArrowLeft' },
  };
}

describe('open', () => {
  it('shows the not-logged-in badge and does not open when logged out', async () => {
    const deps = makeDeps({ loggedIn: false });
    const controller = createPlaylistController({}, {}, deps);
    await controller.open();
    assert.deepEqual(deps.calls, [['badge']]);
    assert.equal(controller.isOpen(), false);
  });

  it('no-ops when no trigger is found', async () => {
    const deps = makeDeps({ hasTrigger: false });
    const controller = createPlaylistController({}, {}, deps);
    await controller.open();
    assert.deepEqual(deps.calls, []);
    assert.equal(controller.isOpen(), false);
  });

  it('loads the catalog, writes the cache, and renders the overlay', async () => {
    const rows = [{ name: 'Watch later', selected: true, element: {} }, { name: 'Comedy', selected: false, element: {} }];
    const deps = makeDeps({ rows });
    const controller = createPlaylistController({}, {}, deps);
    await controller.open();
    assert.equal(controller.isOpen(), true);
    assert.deepEqual(deps.playlistCache.written, [{ name: 'Watch later' }, { name: 'Comedy' }]);
    assert.equal(deps.playlistOverlay.renders.length, 1);
    assert.deepEqual([...deps.playlistOverlay.renders[0].checked], ['Watch later']);
  });

  it('leaves the overlay closed when the sheet never yields rows', async () => {
    const deps = makeDeps({ rows: [] });
    const controller = createPlaylistController({}, {}, deps);
    await controller.open();
    assert.equal(controller.isOpen(), false);
    assert.equal(deps.playlistOverlay.renders.length, 0);
  });
});

describe('addVideoToPlaylists', () => {
  it('does nothing when there are no changes', async () => {
    const deps = makeDeps();
    const controller = createPlaylistController({}, {}, deps);
    await controller.addVideoToPlaylists([], []);
    assert.deepEqual(deps.calls, []);
  });

  it('opens once, toggles only rows whose live state disagrees, closes once, invalidates the cache', async () => {
    const rows = [
      { name: 'Comedy', selected: false, element: {} },
      { name: 'Watch later', selected: true, element: {} },
    ];
    const deps = makeDeps({ rows });
    const controller = createPlaylistController({}, {}, deps);
    await controller.addVideoToPlaylists(['Comedy'], ['Watch later']);
    assert.deepEqual(deps.calls, [
      ['progress', 0, 2],
      ['open', deps.trigger],
      ['toggle', 'Comedy'],
      ['progress', 1, 2],
      ['toggle', 'Watch later'],
      ['progress', 2, 2],
      ['close'],
      ['finish', 2, 2],
    ]);
    assert.equal(deps.playlistCache.invalidated, 1);
  });

  it('skips a toggle when the row already matches the desired state', async () => {
    const deps = makeDeps({ rows: [{ name: 'Comedy', selected: true, element: {} }] });
    const controller = createPlaylistController({}, {}, deps);
    await controller.addVideoToPlaylists(['Comedy'], []);
    assert.ok(!deps.calls.some((c) => c[0] === 'toggle'));
  });

  it('counts a change as applied only when the row was actually found', async () => {
    const deps = makeDeps({ rows: [] });
    const controller = createPlaylistController({}, {}, deps);
    await controller.addVideoToPlaylists(['Missing'], []);
    assert.deepEqual(deps.calls.filter((c) => c[0] === 'finish'), [['finish', 0, 1]]);
  });

  it('no-ops when no trigger is found', async () => {
    const deps = makeDeps({ hasTrigger: false });
    const controller = createPlaylistController({}, {}, deps);
    await controller.addVideoToPlaylists(['Comedy'], []);
    assert.deepEqual(deps.calls, []);
  });
});

describe('createNewPlaylistOnSite', () => {
  it('leaves the sheet hidden-but-open and invalidates the cache on success', async () => {
    const deps = makeDeps();
    const controller = createPlaylistController({}, {}, deps);
    const ok = await controller.createNewPlaylistOnSite('New Stuff');
    assert.equal(ok, true);
    assert.deepEqual(deps.calls, [['open', deps.trigger], ['create', 'New Stuff']]);
    assert.equal(deps.playlistCache.invalidated, 1);
  });

  it('closes the sheet and does not invalidate the cache on failure', async () => {
    const deps = makeDeps({ driveCreateNewPlaylistOk: false });
    const controller = createPlaylistController({}, {}, deps);
    const ok = await controller.createNewPlaylistOnSite('New Stuff');
    assert.equal(ok, false);
    assert.deepEqual(deps.calls, [['open', deps.trigger], ['create', 'New Stuff'], ['close']]);
    assert.equal(deps.playlistCache.invalidated, 0);
  });

  it('no-ops when no trigger is found', async () => {
    const deps = makeDeps({ hasTrigger: false });
    const controller = createPlaylistController({}, {}, deps);
    assert.equal(await controller.createNewPlaylistOnSite('New Stuff'), false);
    assert.deepEqual(deps.calls, []);
  });
});

async function openedController(rows = [{ name: 'Comedy', selected: false, element: {} }]) {
  const deps = makeDeps({ rows });
  const controller = createPlaylistController({}, {}, deps);
  await controller.open();
  deps.calls.length = 0;
  return { controller, deps };
}

describe('handleKey', () => {
  it('closes the overlay on Escape', async () => {
    const { controller, deps } = await openedController();
    controller.handleKey(makeKeyEvent('Escape'));
    assert.equal(controller.isOpen(), false);
    assert.equal(deps.playlistOverlay.closed, 1);
  });

  it('moves the highlight on ArrowDown/ArrowUp and re-renders', async () => {
    const { controller, deps } = await openedController([
      { name: 'A', selected: false, element: {} },
      { name: 'B', selected: false, element: {} },
    ]);
    controller.handleKey(makeKeyEvent('ArrowDown'));
    assert.equal(deps.playlistOverlay.renders.at(-1).highlightIndex, 1);
  });

  it('checks/unchecks the highlighted row via configured keys', async () => {
    const { controller, deps } = await openedController();
    controller.handleKey(makeKeyEvent('ArrowRight'));
    assert.deepEqual([...deps.playlistOverlay.renders.at(-1).checked], ['Comedy']);
    controller.handleKey(makeKeyEvent('ArrowLeft'));
    assert.deepEqual([...deps.playlistOverlay.renders.at(-1).checked], []);
  });

  it('Enter on a highlighted row confirms it and calls addVideoToPlaylists, closing the overlay', async () => {
    const { controller, deps } = await openedController();
    controller.handleKey(makeKeyEvent('Enter'));
    assert.equal(controller.isOpen(), false);
    await flushMicrotasks();
    assert.deepEqual(deps.calls, [
      ['progress', 0, 1], ['open', deps.trigger], ['toggle', 'Comedy'], ['progress', 1, 1], ['close'], ['finish', 1, 1],
    ]);
  });

  it('Enter on the create-new row opens the sub-dialog instead of confirming', async () => {
    const { controller, deps } = await openedController();
    controller.handleKey(makeKeyEvent('ArrowUp'));
    controller.handleKey(makeKeyEvent('Enter'));
    assert.equal(controller.isOpen(), true);
    assert.ok(deps.playlistOverlay.renders.at(-1).subDialog);
    assert.deepEqual(deps.calls, []);
  });

  it('typing then Enter in the sub-dialog creates the playlist, then adds it, without a redundant close', async () => {
    // The native sheet gains an unselected row for the new playlist once
    // creation lands (mirrors real YouTube behavior) — regression coverage
    // for 30ef16b: createNewPlaylistOnSite must leave the sheet
    // hidden-but-open on success so this reopen doesn't race a close.
    const rows = [{ name: 'Comedy', selected: false, element: {} }];
    const deps = makeDeps({
      rows,
      driveCreateNewPlaylistEffect: (name) => rows.push({ name, selected: false, element: {} }),
    });
    const controller = createPlaylistController({}, {}, deps);
    await controller.open();
    deps.calls.length = 0;

    controller.handleKey(makeKeyEvent('ArrowUp'));
    controller.handleKey(makeKeyEvent('Enter'));
    for (const ch of 'New') controller.handleKey(makeKeyEvent(ch));
    controller.handleKey(makeKeyEvent('Enter'));
    assert.equal(controller.isOpen(), false);
    await flushMicrotasks();
    assert.deepEqual(deps.calls, [
      ['open', deps.trigger], ['create', 'New'],
      ['progress', 0, 1], ['open', deps.trigger], ['toggle', 'New'], ['progress', 1, 1], ['close'], ['finish', 1, 1],
    ]);
    assert.equal(deps.calls.filter((c) => c[0] === 'close').length, 1);
  });

  it('ignores an empty-name Enter in the sub-dialog', async () => {
    const { controller, deps } = await openedController();
    controller.handleKey(makeKeyEvent('ArrowUp'));
    controller.handleKey(makeKeyEvent('Enter'));
    controller.handleKey(makeKeyEvent('Enter'));
    assert.equal(controller.isOpen(), true);
    assert.deepEqual(deps.calls, []);
  });

  it('Escape inside the sub-dialog closes only the sub-dialog, not the whole overlay', async () => {
    const { controller, deps } = await openedController();
    controller.handleKey(makeKeyEvent('ArrowUp'));
    controller.handleKey(makeKeyEvent('Enter'));
    controller.handleKey(makeKeyEvent('Escape'));
    assert.equal(controller.isOpen(), true);
    assert.equal(deps.playlistOverlay.renders.at(-1).subDialog, null);
  });
});
