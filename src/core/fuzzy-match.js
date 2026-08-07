const MAX_TYPO_DISTANCE = 2;

export function normalizeForMatch(value) {
  return value.toLowerCase().replace(/\s+/g, '');
}

export function levenshteinDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev = Array.from({ length: cols }, (_, j) => j);
  for (let i = 1; i < rows; i += 1) {
    const curr = [i];
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    prev = curr;
  }
  return prev[cols - 1];
}

// Case/space-insensitive substring match, or edit-distance-2 typo tolerance
// against the whole playlist name (issue #16) — deterministic, not a
// fzf-style relevance scorer.
export function matchesPlaylistQuery(name, query) {
  const q = normalizeForMatch(query);
  if (q === '') return true;
  const n = normalizeForMatch(name);
  if (n.includes(q)) return true;
  return levenshteinDistance(n, q) <= MAX_TYPO_DISTANCE;
}

export function filterPlaylistsByQuery(playlists, query) {
  return playlists.filter((p) => matchesPlaylistQuery(p.name, query));
}
