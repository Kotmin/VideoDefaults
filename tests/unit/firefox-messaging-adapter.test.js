import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createMessagingAdapter } from '../../src/browser-adapters/firefox/firefox-messaging-adapter.js';

describe('createMessagingAdapter', () => {
  describe('sendToActiveTab', () => {
    it('sends message to the active tab id', async () => {
      let queriedWith = null;
      let sentTo = null;
      let sentMsg = null;
      const browser = {
        tabs: {
          query: async (opts) => { queriedWith = opts; return [{ id: 42 }]; },
          sendMessage: async (id, msg) => { sentTo = id; sentMsg = msg; return { ok: true }; },
        },
        runtime: { onMessage: { addListener: () => {}, removeListener: () => {} } },
      };
      const adapter = createMessagingAdapter(browser);
      await adapter.sendToActiveTab({ type: 'PING' });
      assert.deepEqual(queriedWith, { active: true, currentWindow: true });
      assert.equal(sentTo, 42);
      assert.deepEqual(sentMsg, { type: 'PING' });
    });

    it('returns the response from sendMessage', async () => {
      const browser = {
        tabs: {
          query: async () => [{ id: 7 }],
          sendMessage: async () => ({ ok: true, speed: 1.5 }),
        },
        runtime: { onMessage: { addListener: () => {}, removeListener: () => {} } },
      };
      const adapter = createMessagingAdapter(browser);
      const result = await adapter.sendToActiveTab({ type: 'GET' });
      assert.deepEqual(result, { ok: true, speed: 1.5 });
    });

    it('throws when tabs array is empty', async () => {
      const browser = {
        tabs: {
          query: async () => [],
          sendMessage: async () => {},
        },
        runtime: { onMessage: { addListener: () => {}, removeListener: () => {} } },
      };
      const adapter = createMessagingAdapter(browser);
      await assert.rejects(() => adapter.sendToActiveTab({ type: 'PING' }), /no active tab/);
    });

    it('throws when browser.tabs.query returns null', async () => {
      const browser = {
        tabs: {
          query: async () => null,
          sendMessage: async () => {},
        },
        runtime: { onMessage: { addListener: () => {}, removeListener: () => {} } },
      };
      const adapter = createMessagingAdapter(browser);
      await assert.rejects(() => adapter.sendToActiveTab({ type: 'PING' }), /no active tab/);
    });

    it('throws when browser.tabs.query returns undefined', async () => {
      const browser = {
        tabs: {
          query: async () => undefined,
          sendMessage: async () => {},
        },
        runtime: { onMessage: { addListener: () => {}, removeListener: () => {} } },
      };
      const adapter = createMessagingAdapter(browser);
      await assert.rejects(() => adapter.sendToActiveTab({ type: 'PING' }), /no active tab/);
    });

    it('propagates rejection from browser.tabs.sendMessage', async () => {
      const error = new Error('connection refused');
      const browser = {
        tabs: {
          query: async () => [{ id: 1 }],
          sendMessage: async () => { throw error; },
        },
        runtime: { onMessage: { addListener: () => {}, removeListener: () => {} } },
      };
      const adapter = createMessagingAdapter(browser);
      await assert.rejects(() => adapter.sendToActiveTab({ type: 'PING' }), /connection refused/);
    });
  });

  describe('addMessageListener', () => {
    it('calls browser.runtime.onMessage.addListener with the handler', () => {
      let registered = null;
      const browser = {
        tabs: { query: async () => [], sendMessage: async () => {} },
        runtime: {
          onMessage: {
            addListener: (fn) => { registered = fn; },
            removeListener: () => {},
          },
        },
      };
      const adapter = createMessagingAdapter(browser);
      const handler = () => {};
      adapter.addMessageListener(handler);
      assert.equal(registered, handler);
    });
  });

  describe('removeMessageListener', () => {
    it('calls browser.runtime.onMessage.removeListener with the handler', () => {
      let removed = null;
      const browser = {
        tabs: { query: async () => [], sendMessage: async () => {} },
        runtime: {
          onMessage: {
            addListener: () => {},
            removeListener: (fn) => { removed = fn; },
          },
        },
      };
      const adapter = createMessagingAdapter(browser);
      const handler = () => {};
      adapter.removeMessageListener(handler);
      assert.equal(removed, handler);
    });
  });
});
