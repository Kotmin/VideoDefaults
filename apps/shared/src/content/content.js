(async () => {
  try {
    const browser = globalThis.browser ?? globalThis.chrome;
    const { applyDefaults } = await import(browser.runtime.getURL('lib/core/settings.js'));
    const { validateSpeed } = await import(browser.runtime.getURL('lib/core/speed.js'));
    const { isMacPlatform } = await import(browser.runtime.getURL('lib/core/platform.js'));
    const {
      createState, markExtensionWrite, markManualOverride,
      clearOverride, isManualOverride, clearExtensionToken,
    } = await import(browser.runtime.getURL('lib/core/playback-state.js'));
    const { MESSAGE_TYPES, validateMessage } = await import(browser.runtime.getURL('lib/core/validation.js'));
    const { debounce } = await import(browser.runtime.getURL('lib/core/debounce.js'));
    const {
      isYouTubeWatchPage, findVideoElement, createYouTubeSiteAdapter,
      isLoggedIn, findSaveToPlaylistTrigger,
    } = await import(browser.runtime.getURL('lib/site-adapters/youtube/youtube-site-adapter.js'));
    const { createPlayerAdapter } = await import(browser.runtime.getURL('lib/player-adapters/html5-video-player-adapter.js'));
    const {
      COMMANDS, SPEED_SHORTCUTS, createShortcutController, generateLabels, filterLabelPairs,
    } = await import(browser.runtime.getURL('lib/core/keyboard-shortcuts.js'));
    const { collectJumpTargets, createJumpOverlay } =
      await import(browser.runtime.getURL('lib/ui/jump-overlay.js'));
    const { collectQueueTargets, activateQueueTarget, showQueueConfirmation } =
      await import(browser.runtime.getURL('lib/ui/queue-overlay.js'));
    const {
      openSaveToPlaylistPopup, togglePlaylistRow, driveCreateNewPlaylist, closeSaveToPlaylistPopup,
    } = await import(browser.runtime.getURL('lib/ui/playlist-popup-driver.js'));
    const { createPlaylistCache } = await import(browser.runtime.getURL('lib/core/playlist-cache.js'));
    const {
      createOverlayState, moveHighlight, typeChar, backspace, toggleHighlighted, resolveEnter,
      openCreateDialog, typeInCreateDialog, backspaceInCreateDialog, closeCreateDialog, commitCreatedPlaylist,
      resolveCreatedPlaylistChanges,
    } = await import(browser.runtime.getURL('lib/ui/playlist-overlay-state.js'));
    const {
      createPlaylistOverlay, showPlaylistProgress, finishPlaylistProgress, showNotLoggedInBadge,
    } = await import(browser.runtime.getURL('lib/ui/playlist-overlay.js'));

    const isMac = isMacPlatform(navigator);
    let settings = null;
    let state = createState();
    let player = null;
    let unsubscribeRateChange = null;
    let tokenCounter = 0;

    function nextToken() {
      return `vd-${++tokenCounter}`;
    }

    async function loadSettings() {
      const stored = await browser.storage.local.get('videodefaults_settings');
      settings = applyDefaults(stored.videodefaults_settings ?? {}, isMac);
    }

    function applySpeed(speed) {
      if (!player) return;
      if (player.getSpeed() === speed) return;
      state = markExtensionWrite(state, nextToken());
      player.setSpeed(speed);
    }

    async function setDefaultSpeedFromShortcut(speed) {
      const v = validateSpeed(speed);
      if (!v.valid) return;
      settings = { ...settings, defaultSpeed: v.value };
      await browser.storage.local.set({ videodefaults_settings: settings });
      state = clearOverride(state);
      applySpeed(v.value);
    }

    async function toggleAutoApply() {
      settings = { ...settings, youtubeEnabled: !settings.youtubeEnabled };
      await browser.storage.local.set({ videodefaults_settings: settings });
    }

    const tryInitVideo = debounce(() => {
      const el = findVideoElement(document);
      if (!el) return;

      if (unsubscribeRateChange) unsubscribeRateChange();

      player = createPlayerAdapter(el);

      unsubscribeRateChange = player.onRateChange(() => {
        if (state.extensionToken !== null) {
          state = clearExtensionToken(state);
          return;
        }
        state = markManualOverride(state);
      });

      if (settings && settings.youtubeEnabled && !isManualOverride(state)) {
        applySpeed(settings.defaultSpeed);
      }
    }, 300);

    browser.runtime.onMessage.addListener((raw) => {
      const msg = validateMessage(raw);
      if (!msg.valid) return Promise.resolve({ ok: false, error: msg.error });

      if (msg.type === MESSAGE_TYPES.GET_PLAYBACK_STATE) {
        return Promise.resolve({
          ok: true,
          speed: player ? player.getSpeed() : null,
          manualOverride: isManualOverride(state),
          hasVideo: player !== null,
        });
      }

      if (msg.type === MESSAGE_TYPES.APPLY_SPEED_TO_ACTIVE_VIDEO) {
        const v = validateSpeed(msg.payload.speed);
        if (!v.valid) return Promise.resolve({ ok: false, error: v.error });
        state = clearOverride(state);
        applySpeed(v.value);
        return Promise.resolve({ ok: true });
      }

      return Promise.resolve({ ok: false, error: 'unsupported message type' });
    });

    function goHome() {
      const logo = document.querySelector('a#logo, ytd-topbar-logo-renderer a');
      if (logo) logo.click();
      else location.assign(settings.keymap.homeUrl);
    }

    function activateTarget(el) {
      if (typeof el.focus === 'function') el.focus();
      el.click();
    }

    function setupKeyboard() {
      const overlay = createJumpOverlay(document);
      const controller = createShortcutController();
      let pendingTimer = null;
      let labelState = null;

      function closeOverlay() {
        overlay.close();
        labelState = null;
      }

      function openOverlay() {
        const targets = collectJumpTargets(document, window);
        if (targets.length === 0) return;
        const labels = generateLabels(targets.length);
        const pairs = targets.map((t, i) => ({ label: labels[i], element: t.element, rect: t.rect }));
        overlay.open(pairs);
        labelState = { pairs, typed: '', mode: 'jump' };
      }

      function openQueueOverlay() {
        const targets = collectQueueTargets(document, window);
        if (targets.length === 0) return;
        const labels = generateLabels(targets.length);
        const pairs = targets.map((t, i) => ({ label: labels[i], element: t.element, rect: t.rect }));
        overlay.open(pairs);
        labelState = { pairs, typed: '', mode: 'queue' };
      }

      const playlistOverlay = createPlaylistOverlay(document);
      const playlistCache = createPlaylistCache(browser);
      let playlistState = null;

      function closePlaylistOverlay() {
        playlistOverlay.close();
        playlistState = null;
      }

      // Always scrapes fresh: membership (which playlists already contain
      // this video) is per-video, not cacheable, and the popup is now hidden
      // while driven (see playlist-popup-driver.js) so there's no visible
      // cost to opening it on every overlay open. The cache is still written
      // (name catalog only) for other consumers that don't need membership.
      async function loadPlaylistCatalog(trigger) {
        const rows = await openSaveToPlaylistPopup(trigger, document, window);
        await closeSaveToPlaylistPopup(document, window, trigger);
        if (rows.length === 0) return null;
        const playlists = rows.map((r) => ({ name: r.name, selected: r.selected }));
        await playlistCache.write(playlists.map((p) => ({ name: p.name })));
        return playlists;
      }

      // Feature gated to logged-in users; both isLoggedIn and the trigger
      // finder are unverified best-effort (see youtube-site-adapter.js),
      // so a wrong or missing signal self-heals to a silent no-op here.
      async function openPlaylistOverlay() {
        if (!isLoggedIn(document)) {
          const videoEl = findVideoElement(document);
          const rect = videoEl ? videoEl.getBoundingClientRect() : { top: 0, left: 0 };
          showNotLoggedInBadge(document, rect);
          return;
        }
        const trigger = findSaveToPlaylistTrigger(document);
        if (!trigger) return;
        const playlists = await loadPlaylistCatalog(trigger);
        if (!playlists) return;
        playlistState = createOverlayState(playlists);
        playlistOverlay.render(playlistState);
      }

      // Applies sequentially, reopening the native popup once per playlist
      // (issue #16 resolved design — no batch confirm exists natively).
      // Idempotent per row: only clicks when the row's live state disagrees
      // with the desired one, since the native button is a plain toggle.
      async function addVideoToPlaylists(toAdd, toRemove = []) {
        const changes = [
          ...toAdd.map((name) => ({ name, shouldSelect: true })),
          ...toRemove.map((name) => ({ name, shouldSelect: false })),
        ];
        if (changes.length === 0) return;
        const trigger = findSaveToPlaylistTrigger(document);
        if (!trigger) return;
        const videoEl = findVideoElement(document);
        const rect = videoEl ? videoEl.getBoundingClientRect() : { top: 0, left: 0 };
        let applied = 0;
        showPlaylistProgress(document, rect, 0, changes.length);
        for (const { name, shouldSelect } of changes) {
          const rows = await openSaveToPlaylistPopup(trigger, document, window);
          const row = rows.find((r) => r.name === name);
          if (row) {
            if (row.selected !== shouldSelect) togglePlaylistRow(row);
            applied += 1;
          }
          await closeSaveToPlaylistPopup(document, window, trigger);
          showPlaylistProgress(document, rect, applied, changes.length);
        }
        await playlistCache.invalidate();
        finishPlaylistProgress(document, rect, applied, changes.length);
      }

      async function createNewPlaylistOnSite(name) {
        const trigger = findSaveToPlaylistTrigger(document);
        if (!trigger) return false;
        await openSaveToPlaylistPopup(trigger, document, window);
        const ok = await driveCreateNewPlaylist(document, window, name);
        await closeSaveToPlaylistPopup(document, window, trigger);
        if (ok) await playlistCache.invalidate();
        return ok;
      }

      function handlePlaylistKey(e) {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'Escape') {
          if (playlistState.subDialog) {
            playlistState = closeCreateDialog(playlistState);
            playlistOverlay.render(playlistState);
          } else {
            closePlaylistOverlay();
          }
          return;
        }

        if (playlistState.subDialog) {
          if (e.key === 'Backspace') {
            playlistState = backspaceInCreateDialog(playlistState);
            playlistOverlay.render(playlistState);
            return;
          }
          if (e.key === 'Enter') {
            const name = playlistState.subDialog.query.trim();
            if (name === '') return;
            const finalState = commitCreatedPlaylist(playlistState, name);
            closePlaylistOverlay();
            createNewPlaylistOnSite(name).then((ok) => {
              if (!ok) return;
              const { toAdd, toRemove } = resolveCreatedPlaylistChanges(finalState);
              addVideoToPlaylists(toAdd, toRemove);
            });
            return;
          }
          if (e.key.length === 1) {
            playlistState = typeInCreateDialog(playlistState, e.key);
            playlistOverlay.render(playlistState);
          }
          return;
        }

        if (e.key === 'ArrowDown') {
          playlistState = moveHighlight(playlistState, 1);
          playlistOverlay.render(playlistState);
          return;
        }
        if (e.key === 'ArrowUp') {
          playlistState = moveHighlight(playlistState, -1);
          playlistOverlay.render(playlistState);
          return;
        }
        if (e.key === 'Backspace') {
          playlistState = backspace(playlistState);
          playlistOverlay.render(playlistState);
          return;
        }
        if (e.key === ' ') {
          playlistState = toggleHighlighted(playlistState);
          playlistOverlay.render(playlistState);
          return;
        }
        if (e.key === 'Enter') {
          const result = resolveEnter(playlistState);
          if (result.type === 'create-new') {
            playlistState = openCreateDialog(playlistState);
            playlistOverlay.render(playlistState);
            return;
          }
          closePlaylistOverlay();
          addVideoToPlaylists(result.toAdd, result.toRemove);
          return;
        }
        if (e.key.length === 1) {
          playlistState = typeChar(playlistState, e.key);
          playlistOverlay.render(playlistState);
        }
      }

      function handleLabelKey(e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') { closeOverlay(); return; }
        if (e.key === 'Backspace') {
          labelState.typed = labelState.typed.slice(0, -1);
          overlay.showMatches(filterLabelPairs(labelState.pairs, labelState.typed).remaining.map((p) => p.label));
          return;
        }
        if (!/^[a-z]$/i.test(e.key)) return;
        const typed = labelState.typed + e.key;
        const { remaining, exact } = filterLabelPairs(labelState.pairs, typed);
        if (exact) {
          const { element: el, rect } = exact;
          const { mode } = labelState;
          closeOverlay();
          if (mode === 'queue') {
            activateQueueTarget(el, document, window).then((ok) => {
              if (ok) showQueueConfirmation(document, rect);
            });
          } else {
            activateTarget(el);
          }
          return;
        }
        if (remaining.length === 0) { closeOverlay(); return; }
        labelState.typed = typed;
        overlay.showMatches(remaining.map((p) => p.label));
      }

      window.addEventListener('keydown', (e) => {
        if (labelState) {
          if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) handleLabelKey(e);
          return;
        }
        if (playlistState) {
          if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) handlePlaylistKey(e);
          return;
        }

        const t = e.target;
        const isEditable = t != null && (t.isContentEditable === true
          || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

        const result = controller.handleKey({
          key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey,
          altKey: e.altKey, shiftKey: e.shiftKey, isEditable,
        }, settings.keymap);

        if (result.consume) {
          e.preventDefault();
          e.stopPropagation();
        }
        clearTimeout(pendingTimer);
        if (result.pending) pendingTimer = setTimeout(() => controller.cancel(), 2000);
        if (result.command === COMMANDS.GO_HOME) goHome();
        if (result.command === COMMANDS.SHOW_JUMP_LABELS) openOverlay();
        if (result.command === COMMANDS.SHOW_QUEUE_LABELS) openQueueOverlay();
        if (result.command === COMMANDS.SHOW_PLAYLIST_LABELS) openPlaylistOverlay();
        if (result.command in SPEED_SHORTCUTS) setDefaultSpeedFromShortcut(SPEED_SHORTCUTS[result.command]);
        if (result.command === COMMANDS.TOGGLE_AUTO_APPLY) toggleAutoApply();
      }, true);
    }

    async function init() {
      await loadSettings().catch(() => { settings = applyDefaults({}, isMac); });
      setupKeyboard();

      browser.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes.videodefaults_settings) return;
        settings = applyDefaults(changes.videodefaults_settings.newValue ?? {}, isMac);
      });

      const siteAdapter = createYouTubeSiteAdapter(document, window);
      siteAdapter.onNavigate(() => {
        if (unsubscribeRateChange) {
          unsubscribeRateChange();
          unsubscribeRateChange = null;
        }
        player = null;
        state = createState();
        if (isYouTubeWatchPage(location.href)) tryInitVideo();
      });

      if (isYouTubeWatchPage(location.href)) tryInitVideo();
    }

    init();
  } catch (e) {
    console.error('[VideoDefaults] content script init failed:', e);
  }
})();
