import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPlaylistCache } from '../../src/core/playlist-cache.js';

const STORAGE_KEY = 'videodefaults_playlist_cache';

function makeBrowser(store = {}) {
  return {
    storage: {
      local: {
        async get(key) {
          return key in store ? { [key]: store[key] } : {};
        },
        async set(obj) {
          Object.assign(store, obj);
        },
        async remove(key) {
          delete store[key];
        },
      },
    },
  };
}

describe('createPlaylistCache.read', () => {
  it('returns null when nothing is cached', async () => {
    const cache = createPlaylistCache(makeBrowser());
    assert.equal(await cache.read(), null);
  });

  it('returns cached playlists within TTL', async () => {
    const store = { [STORAGE_KEY]: { fetchedAt: 1000, playlists: [{ name: 'Comedy' }] } };
    const cache = createPlaylistCache(makeBrowser(store), () => 1000 + 60_000);
    assert.deepEqual(await cache.read(), [{ name: 'Comedy' }]);
  });

  it('returns null once the entry is older than 5 minutes', async () => {
    const store = { [STORAGE_KEY]: { fetchedAt: 1000, playlists: [{ name: 'Comedy' }] } };
    const cache = createPlaylistCache(makeBrowser(store), () => 1000 + 5 * 60_000 + 1);
    assert.equal(await cache.read(), null);
  });

  it('returns null for a malformed cache entry', async () => {
    const store = { [STORAGE_KEY]: { garbage: true } };
    const cache = createPlaylistCache(makeBrowser(store));
    assert.equal(await cache.read(), null);
  });
});

describe('createPlaylistCache.write', () => {
  it('stores playlists with the current timestamp', async () => {
    const store = {};
    const cache = createPlaylistCache(makeBrowser(store), () => 42);
    await cache.write([{ name: 'Comedy' }]);
    assert.deepEqual(store[STORAGE_KEY], { fetchedAt: 42, playlists: [{ name: 'Comedy' }] });
  });

  it('read after write round-trips within TTL', async () => {
    const store = {};
    let time = 0;
    const cache = createPlaylistCache(makeBrowser(store), () => time);
    await cache.write([{ name: 'Docs' }]);
    time += 60_000;
    assert.deepEqual(await cache.read(), [{ name: 'Docs' }]);
  });
});

describe('createPlaylistCache.invalidate', () => {
  it('clears the cached entry', async () => {
    const store = { [STORAGE_KEY]: { fetchedAt: 0, playlists: [{ name: 'Comedy' }] } };
    const cache = createPlaylistCache(makeBrowser(store), () => 0);
    await cache.invalidate();
    assert.equal(await cache.read(), null);
  });
});
