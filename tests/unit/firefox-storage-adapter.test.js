import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createStorageAdapter } from '../../src/browser-adapters/firefox/firefox-storage-adapter.js';

const STORAGE_KEY = 'videodefaults_settings';

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
      },
    },
  };
}

function makeErrorBrowser({ failGet = false, failSet = false } = {}) {
  return {
    storage: {
      local: {
        async get() {
          if (failGet) throw new Error('storage read failed');
        },
        async set() {
          if (failSet) throw new Error('storage write failed');
        },
      },
    },
  };
}

describe('createStorageAdapter.getSettings', () => {
  it('returns empty object when storage has no key', async () => {
    const adapter = createStorageAdapter(makeBrowser());
    const result = await adapter.getSettings();
    assert.deepEqual(result, {});
  });

  it('returns stored object when key is present', async () => {
    const saved = { defaultSpeed: 1.5 };
    const adapter = createStorageAdapter(makeBrowser({ [STORAGE_KEY]: saved }));
    const result = await adapter.getSettings();
    assert.deepEqual(result, saved);
  });

  it('rejects when storage.get throws', async () => {
    const adapter = createStorageAdapter(makeErrorBrowser({ failGet: true }));
    await assert.rejects(() => adapter.getSettings(), { message: 'storage read failed' });
  });
});

describe('createStorageAdapter.saveSettings', () => {
  it('calls storage.set with videodefaults_settings key', async () => {
    const store = {};
    const adapter = createStorageAdapter(makeBrowser(store));
    await adapter.saveSettings({ defaultSpeed: 1.5 });
    assert.ok(STORAGE_KEY in store);
  });

  it('getSettings returns what was saved', async () => {
    const store = {};
    const adapter = createStorageAdapter(makeBrowser(store));
    const settings = { defaultSpeed: 2.0, scope: 'global' };
    await adapter.saveSettings(settings);
    const result = await adapter.getSettings();
    assert.deepEqual(result, settings);
  });

  it('rejects when storage.set throws', async () => {
    const adapter = createStorageAdapter(makeErrorBrowser({ failSet: true }));
    await assert.rejects(() => adapter.saveSettings({ defaultSpeed: 1.5 }), { message: 'storage write failed' });
  });
});
