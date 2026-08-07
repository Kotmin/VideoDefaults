const STORAGE_KEY = 'videodefaults_playlist_cache';
const TTL_MS = 5 * 60 * 1000;

// Shared across tabs via browser.storage.local (issue #16) rather than a
// tab-local variable, so a scrape in one tab benefits others. Caches only
// the playlist catalog (name), not per-video membership — membership
// reflects the *current* video's aria-pressed state and would be wrong to
// serve to a different video, so it's always freshly scraped when the
// native popup opens. See docs/ai/questions-for-K.md.
export function createPlaylistCache(browser, now = Date.now) {
  return {
    async read() {
      const result = await browser.storage.local.get(STORAGE_KEY);
      const entry = result[STORAGE_KEY];
      if (entry == null || typeof entry !== 'object') return null;
      if (typeof entry.fetchedAt !== 'number' || !Array.isArray(entry.playlists)) return null;
      if (now() - entry.fetchedAt > TTL_MS) return null;
      return entry.playlists;
    },
    async write(playlists) {
      await browser.storage.local.set({ [STORAGE_KEY]: { fetchedAt: now(), playlists } });
    },
    async invalidate() {
      await browser.storage.local.remove(STORAGE_KEY);
    },
  };
}
