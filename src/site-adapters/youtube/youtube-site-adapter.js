export function isYouTubeWatchPage(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('youtube.com') && parsed.pathname === '/watch';
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

export function createYouTubeSiteAdapter(document, window) {
  const handlers = new Map();

  return {
    onNavigate(callback) {
      const handler = () => callback();
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
