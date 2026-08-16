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
//
// ponytail: the Shorts fallback below (`ytd-reel-player-header-renderer
// ytd-menu-renderer button`) is derived from a captured Shorts-page JSON
// snapshot's renderer names, not a live/rendered DOM — this sandbox has no
// working headless browser (see docs/probes/save-trigger-dom-findings.md).
// The JSON confirms `overlay.reelPlayerOverlayRenderer
// .reelPlayerHeaderSupportedRenderers.reelPlayerHeaderRenderer` sits next to
// a sibling `menu.menuRenderer` whose items include "Save to playlist", and
// this codebase's own established `<FooRenderer>` -> `ytd-foo-renderer`
// naming convention (see `ytd-menu-service-item-renderer`, `ytd-video-renderer`
// in src/ui/queue-overlay.js) is the sole basis for the DOM tag names used
// here. Best-effort, self-heals to a missed trigger (openPlaylistOverlay
// no-ops) if wrong. Needs live confirmation — see issue #20 and
// docs/ai/questions-for-K.md.
const SHORTS_SAVE_TRIGGER_SELECTOR = 'ytd-reel-player-header-renderer ytd-menu-renderer button';

export function findSaveToPlaylistTrigger(document) {
  return document.querySelector('#flexible-item-buttons > yt-button-view-model button[aria-label]')
    ?? document.querySelector(SHORTS_SAVE_TRIGGER_SELECTOR);
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
