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
    const { isYouTubeWatchPage, findVideoElement, createYouTubeSiteAdapter } =
      await import(browser.runtime.getURL('lib/site-adapters/youtube/youtube-site-adapter.js'));
    const { createPlayerAdapter } = await import(browser.runtime.getURL('lib/player-adapters/html5-video-player-adapter.js'));
    const {
      COMMANDS, SPEED_SHORTCUTS, createShortcutController, generateLabels, filterLabelPairs,
    } = await import(browser.runtime.getURL('lib/core/keyboard-shortcuts.js'));
    const { collectJumpTargets, createJumpOverlay } =
      await import(browser.runtime.getURL('lib/ui/jump-overlay.js'));

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
        labelState = { pairs, typed: '' };
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
          const el = exact.element;
          closeOverlay();
          activateTarget(el);
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
