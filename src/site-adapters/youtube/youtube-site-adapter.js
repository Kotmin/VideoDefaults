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

// UNVERIFIED STUB: the watch page's native "Save to playlist" trigger button
// was never captured in DOM probes (only the already-open sheet was — see
// docs/probes/save-to-playlist-dom-findings.md). Returns null until a real
// capture resolves this, so the playlist overlay self-heals to a silent
// no-op rather than driving a fabricated selector. See
// docs/ai/questions-for-K.md (blocking item).
export function findSaveToPlaylistTrigger(document) {
  return null;
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
