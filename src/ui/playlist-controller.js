// Orchestrates the playlist picker (issue #16): wires playlist-overlay-state
// (pure reducer) to playlist-popup-driver (native sheet driving) and
// playlist-overlay (DOM render/badges). Extracted out of content.js's
// closure so this call sequence — previously invisible to node --test and
// only verifiable by K re-testing live YouTube — has actual unit coverage.
// Same doc/win injection shape as playlist-popup-driver.js and
// queue-overlay.js, one level up.
export function createPlaylistController(doc, win, deps) {
  const {
    findVideoElement, findSaveToPlaylistTrigger, isLoggedIn,
    playlistCache, playlistOverlay,
    openSaveToPlaylistPopup, togglePlaylistRow, driveCreateNewPlaylist, closeSaveToPlaylistPopup,
    showPlaylistProgress, finishPlaylistProgress, showNotLoggedInBadge,
    createOverlayState, moveHighlight, typeChar, backspace, toggleHighlighted, checkHighlighted, uncheckHighlighted,
    resolveEnter, openCreateDialog, typeInCreateDialog, backspaceInCreateDialog, closeCreateDialog, commitCreatedPlaylist,
    resolveCreatedPlaylistChanges,
    playlistKeys,
  } = deps;

  let state = null;

  function isOpen() {
    return state !== null;
  }

  function close() {
    playlistOverlay.close();
    state = null;
  }

  function targetRect() {
    const videoEl = findVideoElement(doc);
    return videoEl ? videoEl.getBoundingClientRect() : { top: 0, left: 0 };
  }

  // Always scrapes fresh: membership (which playlists already contain this
  // video) is per-video, not cacheable, and the popup is hidden while
  // driven (see playlist-popup-driver.js) so there's no visible cost to
  // opening it on every overlay open. The cache is still written (name
  // catalog only) for other consumers that don't need membership.
  async function loadCatalog(trigger) {
    const rows = await openSaveToPlaylistPopup(trigger, doc, win);
    await closeSaveToPlaylistPopup(doc, win, trigger);
    if (rows.length === 0) return null;
    const playlists = rows.map((r) => ({ name: r.name, selected: r.selected }));
    await playlistCache.write(playlists.map((p) => ({ name: p.name })));
    return playlists;
  }

  // Feature gated to logged-in users; both isLoggedIn and the trigger
  // finder are unverified best-effort (see youtube-site-adapter.js), so a
  // wrong or missing signal self-heals to a silent no-op here.
  async function open() {
    if (!isLoggedIn(doc)) {
      showNotLoggedInBadge(doc, targetRect());
      return;
    }
    const trigger = findSaveToPlaylistTrigger(doc);
    if (!trigger) return;
    const playlists = await loadCatalog(trigger);
    if (!playlists) return;
    state = createOverlayState(playlists);
    playlistOverlay.render(state);
  }

  // Opens the native popup once and toggles every row within that same
  // session (issue #16 resolved design — no batch confirm exists natively,
  // but nothing requires closing/reopening between rows either). Reopening
  // per playlist was the original design; K reported it as slow and
  // visibly flickering the native popup — each open/close round trip pays
  // the close-verification wait, N times. Idempotent per row: only clicks
  // when the row's live state disagrees with the desired one, since the
  // native button is a plain toggle.
  async function addVideoToPlaylists(toAdd, toRemove = []) {
    const changes = [
      ...toAdd.map((name) => ({ name, shouldSelect: true })),
      ...toRemove.map((name) => ({ name, shouldSelect: false })),
    ];
    if (changes.length === 0) return;
    const trigger = findSaveToPlaylistTrigger(doc);
    if (!trigger) return;
    const rect = targetRect();
    let applied = 0;
    showPlaylistProgress(doc, rect, 0, changes.length);
    const rows = await openSaveToPlaylistPopup(trigger, doc, win);
    for (const { name, shouldSelect } of changes) {
      const row = rows.find((r) => r.name === name);
      if (row) {
        if (row.selected !== shouldSelect) togglePlaylistRow(row);
        applied += 1;
      }
      showPlaylistProgress(doc, rect, applied, changes.length);
    }
    await closeSaveToPlaylistPopup(doc, win, trigger);
    await playlistCache.invalidate();
    finishPlaylistProgress(doc, rect, applied, changes.length);
  }

  // Leaves the sheet hidden-but-open on success rather than closing it
  // here: the caller always follows a successful create with
  // addVideoToPlaylists (the new playlist is always in its toAdd, since
  // commitCreatedPlaylist checks it while it starts unselected), which
  // reopens the same sheet immediately anyway. A prior version closed
  // unconditionally and reopened a beat later, which raced the fragile
  // trigger-click close fallback against the immediate reopen and left the
  // sheet visibly stuck open (see the regression test below). Only close
  // here on failure, since then nothing else will touch the sheet
  // afterward.
  async function createNewPlaylistOnSite(name) {
    const trigger = findSaveToPlaylistTrigger(doc);
    if (!trigger) return false;
    await openSaveToPlaylistPopup(trigger, doc, win);
    const ok = await driveCreateNewPlaylist(doc, win, name);
    if (!ok) await closeSaveToPlaylistPopup(doc, win, trigger);
    if (ok) await playlistCache.invalidate();
    return ok;
  }

  function handleKey(e) {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      if (state.subDialog) {
        state = closeCreateDialog(state);
        playlistOverlay.render(state);
      } else {
        close();
      }
      return;
    }

    if (state.subDialog) {
      if (e.key === 'Backspace') {
        state = backspaceInCreateDialog(state);
        playlistOverlay.render(state);
        return;
      }
      if (e.key === 'Enter') {
        const name = state.subDialog.query.trim();
        if (name === '') return;
        const finalState = commitCreatedPlaylist(state, name);
        close();
        createNewPlaylistOnSite(name).then((ok) => {
          if (!ok) return;
          const { toAdd, toRemove } = resolveCreatedPlaylistChanges(finalState);
          addVideoToPlaylists(toAdd, toRemove);
        });
        return;
      }
      if (e.key.length === 1) {
        state = typeInCreateDialog(state, e.key);
        playlistOverlay.render(state);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      state = moveHighlight(state, 1);
      playlistOverlay.render(state);
      return;
    }
    if (e.key === 'ArrowUp') {
      state = moveHighlight(state, -1);
      playlistOverlay.render(state);
      return;
    }
    if (e.key === 'Backspace') {
      state = backspace(state);
      playlistOverlay.render(state);
      return;
    }
    if (e.key === playlistKeys.toggle) {
      state = toggleHighlighted(state);
      playlistOverlay.render(state);
      return;
    }
    if (e.key === playlistKeys.check) {
      state = checkHighlighted(state);
      playlistOverlay.render(state);
      return;
    }
    if (e.key === playlistKeys.uncheck) {
      state = uncheckHighlighted(state);
      playlistOverlay.render(state);
      return;
    }
    if (e.key === 'Enter') {
      const result = resolveEnter(state);
      if (result.type === 'create-new') {
        state = openCreateDialog(state);
        playlistOverlay.render(state);
        return;
      }
      close();
      addVideoToPlaylists(result.toAdd, result.toRemove);
      return;
    }
    if (e.key.length === 1) {
      state = typeChar(state, e.key);
      playlistOverlay.render(state);
    }
  }

  return { isOpen, open, close, handleKey, addVideoToPlaylists, createNewPlaylistOnSite };
}
