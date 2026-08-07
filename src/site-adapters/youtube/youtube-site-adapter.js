export function isYouTubeWatchPage(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    return (host === 'youtube.com' || host.endsWith('.youtube.com'))
      && parsed.pathname === '/watch';
  } catch {
    return false;
  }
}

export function getVideoContextId(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('v') ?? parsed.pathname;
  } catch {
    return url;
  }
}

export function findVideoElement(document) {
  return document.querySelector('video');
}

// ponytail: #avatar-btn is the masthead's signed-in account button, present
// only when logged in (signed-out masthead shows a "Sign in" link instead,
// no such id). Not independently DOM-captured for issue #16 — best-effort
// per K's direction, self-healing to "not logged in" (feature no-ops) if
// wrong. See docs/ai/questions-for-K.md.
export function isLoggedIn(document) {
  return document.querySelector('#avatar-btn') !== null;
}

// Captured 2026-08-07 via a live watch-page DOM probe (logged-out session):
// the Save button is the only `#flexible-item-buttons` child wrapped in
// `<yt-button-view-model>` — Download uses a different wrapper
// (`ytd-download-button-renderer`), Share lives under
// `#top-level-buttons-computed` instead. See
// docs/probes/save-trigger-dom-findings.md.
// ponytail: assumes Save is the sole yt-button-view-model-wrapped button in
// #flexible-item-buttons — untested against a logged-in session or Shorts
// layout, where another button (e.g. Clip) might share that wrapper.
// Self-heals to a missed trigger (openPlaylistOverlay no-ops) if wrong.
export function findSaveToPlaylistTrigger(document) {
  return document.querySelector('#flexible-item-buttons > yt-button-view-model button[aria-label]');
}

export function createYouTubeSiteAdapter(document, window) {
  const handlers = new Map();

  return {
    onNavigate(callback) {
      let lastId = getVideoContextId(window.location.href);
      const handler = () => {
        const id = getVideoContextId(window.location.href);
        if (id === lastId) return;
        lastId = id;
        callback();
      };
      handlers.set(callback, handler);
      document.addEventListener('yt-navigate-finish', handler);
    },
    destroy() {
      for (const [, handler] of handlers) {
        document.removeEventListener('yt-navigate-finish', handler);
      }
      handlers.clear();
    },
  };
}
