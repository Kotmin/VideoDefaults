import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isYouTubeWatchPage,
  getVideoContextId,
  findVideoElement,
  createYouTubeSiteAdapter,
  isLoggedIn,
  findSaveToPlaylistTrigger,
} from '../../src/site-adapters/youtube/youtube-site-adapter.js';

function makeEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      if (listeners.has(type))
        listeners.set(type, listeners.get(type).filter(f => f !== fn));
    },
    emit(type) {
      (listeners.get(type) ?? []).forEach(fn => fn());
    },
  };
}

describe('isYouTubeWatchPage', () => {
  it('returns true for www.youtube.com/watch with query param', () => {
    assert.equal(isYouTubeWatchPage('https://www.youtube.com/watch?v=abc'), true);
  });

  it('returns true for youtube.com/watch without query param', () => {
    assert.equal(isYouTubeWatchPage('https://youtube.com/watch'), true);
  });

  it('returns false for youtube.com root path', () => {
    assert.equal(isYouTubeWatchPage('https://www.youtube.com/'), false);
  });

  it('returns false for non-youtube domain with /watch path', () => {
    assert.equal(isYouTubeWatchPage('https://www.google.com/watch'), false);
  });

  it('returns false for youtube.com with extra path segments after /watch', () => {
    assert.equal(isYouTubeWatchPage('https://www.youtube.com/watch/extra'), false);
  });

  it('returns false for malformed URL', () => {
    assert.equal(isYouTubeWatchPage('not-a-url'), false);
  });

  it('returns false for lookalike domain ending in youtube.com', () => {
    assert.equal(isYouTubeWatchPage('https://evilyoutube.com/watch?v=abc'), false);
  });

  it('returns false for youtube.com as a subdomain of another domain', () => {
    assert.equal(isYouTubeWatchPage('https://youtube.com.evil.example/watch'), false);
  });

  it('returns true for mobile subdomain m.youtube.com/watch', () => {
    assert.equal(isYouTubeWatchPage('https://m.youtube.com/watch?v=abc'), true);
  });
});

describe('getVideoContextId', () => {
  it('returns v param value when present', () => {
    assert.equal(getVideoContextId('https://www.youtube.com/watch?v=abc123'), 'abc123');
  });

  it('returns pathname when v param is absent', () => {
    assert.equal(getVideoContextId('https://www.youtube.com/shorts/xyz'), '/shorts/xyz');
  });

  it('returns raw url string when URL is malformed', () => {
    assert.equal(getVideoContextId('not-a-url'), 'not-a-url');
  });
});

describe('findVideoElement', () => {
  it('returns element when querySelector finds one', () => {
    const el = {};
    const doc = { querySelector: () => el };
    assert.equal(findVideoElement(doc), el);
  });

  it('returns null when querySelector finds nothing', () => {
    const doc = { querySelector: () => null };
    assert.equal(findVideoElement(doc), null);
  });
});

describe('isLoggedIn', () => {
  it('returns true when the avatar button is present', () => {
    const doc = { querySelector: (sel) => (sel === '#avatar-btn' ? {} : null) };
    assert.equal(isLoggedIn(doc), true);
  });

  it('returns false when the avatar button is absent', () => {
    const doc = { querySelector: () => null };
    assert.equal(isLoggedIn(doc), false);
  });
});

describe('findSaveToPlaylistTrigger', () => {
  const SAVE_SELECTOR = '#flexible-item-buttons > yt-button-view-model button[aria-label]';
  const SHORTS_SELECTOR = 'ytd-reel-player-header-renderer ytd-menu-renderer button';

  it('returns the button matching the Save wrapper selector', () => {
    const btn = {};
    const doc = { querySelector: (sel) => (sel === SAVE_SELECTOR ? btn : null) };
    assert.equal(findSaveToPlaylistTrigger(doc), btn);
  });

  it('returns null when neither the watch-page nor the Shorts selector matches', () => {
    const doc = { querySelector: () => null };
    assert.equal(findSaveToPlaylistTrigger(doc), null);
  });

  it('prefers the watch-page selector over the Shorts fallback when both match', () => {
    const watchBtn = {};
    const shortsBtn = {};
    const doc = {
      querySelector: (sel) => {
        if (sel === SAVE_SELECTOR) return watchBtn;
        if (sel === SHORTS_SELECTOR) return shortsBtn;
        return null;
      },
    };
    assert.equal(findSaveToPlaylistTrigger(doc), watchBtn);
  });

  it('falls back to the Shorts header menu button when the watch-page selector finds nothing', () => {
    const shortsBtn = {};
    const doc = {
      querySelector: (sel) => (sel === SHORTS_SELECTOR ? shortsBtn : null),
    };
    assert.equal(findSaveToPlaylistTrigger(doc), shortsBtn);
  });
});

function makeWindow(href) {
  return { location: { href } };
}

describe('createYouTubeSiteAdapter', () => {
  it('calls onNavigate callback when video id changes', () => {
    const doc = makeEventTarget();
    const win = makeWindow('https://www.youtube.com/watch?v=abc');
    const adapter = createYouTubeSiteAdapter(doc, win);
    let called = 0;
    adapter.onNavigate(() => called++);
    win.location.href = 'https://www.youtube.com/watch?v=xyz';
    doc.emit('yt-navigate-finish');
    assert.equal(called, 1);
  });

  it('does not call onNavigate callback when yt-navigate-finish fires but video id is unchanged', () => {
    const doc = makeEventTarget();
    const win = makeWindow('https://www.youtube.com/watch?v=abc');
    const adapter = createYouTubeSiteAdapter(doc, win);
    let called = 0;
    adapter.onNavigate(() => called++);
    doc.emit('yt-navigate-finish');
    assert.equal(called, 0);
  });

  it('calls all registered onNavigate callbacks', () => {
    const doc = makeEventTarget();
    const win = makeWindow('https://www.youtube.com/watch?v=abc');
    const adapter = createYouTubeSiteAdapter(doc, win);
    let a = 0, b = 0;
    adapter.onNavigate(() => a++);
    adapter.onNavigate(() => b++);
    win.location.href = 'https://www.youtube.com/watch?v=xyz';
    doc.emit('yt-navigate-finish');
    assert.equal(a, 1);
    assert.equal(b, 1);
  });

  it('does not call callbacks after destroy()', () => {
    const doc = makeEventTarget();
    const win = makeWindow('https://www.youtube.com/watch?v=abc');
    const adapter = createYouTubeSiteAdapter(doc, win);
    let called = 0;
    adapter.onNavigate(() => called++);
    adapter.destroy();
    win.location.href = 'https://www.youtube.com/watch?v=xyz';
    doc.emit('yt-navigate-finish');
    assert.equal(called, 0);
  });

  it('destroy() can be called multiple times without error', () => {
    const doc = makeEventTarget();
    const win = makeWindow('https://www.youtube.com/watch?v=abc');
    const adapter = createYouTubeSiteAdapter(doc, win);
    adapter.onNavigate(() => {});
    assert.doesNotThrow(() => {
      adapter.destroy();
      adapter.destroy();
    });
  });
});
