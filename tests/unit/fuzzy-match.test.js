import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeForMatch,
  levenshteinDistance,
  matchesPlaylistQuery,
  filterPlaylistsByQuery,
} from '../../src/core/fuzzy-match.js';

describe('normalizeForMatch', () => {
  it('lowercases and strips whitespace', () => {
    assert.equal(normalizeForMatch('Watch  Later'), 'watchlater');
    assert.equal(normalizeForMatch(' Sci-Fi '), 'sci-fi');
  });
});

describe('levenshteinDistance', () => {
  it('is 0 for identical strings', () => {
    assert.equal(levenshteinDistance('abc', 'abc'), 0);
  });

  it('counts a single substitution as 1', () => {
    assert.equal(levenshteinDistance('cat', 'cot'), 1);
  });

  it('counts insertions and deletions', () => {
    assert.equal(levenshteinDistance('cat', 'cats'), 1);
    assert.equal(levenshteinDistance('cats', 'cat'), 1);
  });

  it('handles empty strings', () => {
    assert.equal(levenshteinDistance('', 'abc'), 3);
    assert.equal(levenshteinDistance('abc', ''), 3);
  });
});

describe('matchesPlaylistQuery', () => {
  it('matches an empty query against anything', () => {
    assert.equal(matchesPlaylistQuery('Watch later', ''), true);
  });

  it('matches case-insensitively', () => {
    assert.equal(matchesPlaylistQuery('Watch later', 'WATCH'), true);
  });

  it('matches space-insensitively', () => {
    assert.equal(matchesPlaylistQuery('Sci Fi Favorites', 'scifi'), true);
  });

  it('matches a substring anywhere in the name', () => {
    assert.equal(matchesPlaylistQuery('My Favorite Playlist', 'favorite'), true);
  });

  it('tolerates a 2-edit typo against the whole name', () => {
    assert.equal(matchesPlaylistQuery('Playlist A', 'Playlst B'), true);
  });

  it('rejects a query with distance > 2 and no substring match', () => {
    assert.equal(matchesPlaylistQuery('Playlist A', 'Something entirely different'), false);
  });

  it('rejects a short query that is neither substring nor close by edit distance', () => {
    assert.equal(matchesPlaylistQuery('Documentaries', 'xyz'), false);
  });
});

describe('filterPlaylistsByQuery', () => {
  it('filters a list of {name} objects by query', () => {
    const playlists = [{ name: 'Watch later' }, { name: 'Shorts' }, { name: 'Comedy' }];
    const out = filterPlaylistsByQuery(playlists, 'wat');
    assert.deepEqual(out.map((p) => p.name), ['Watch later']);
  });
});
