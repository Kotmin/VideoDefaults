# Improvement Spec — Security Audit & Hardening

Audit date: 2026-07-17. Scope: shipped extension (`apps/firefox-extension`, `src/`),
packaging (`tools/`, `scripts/`), CI (`.github/workflows/`), committed docs artifacts.

Baseline at audit time: 177/177 unit tests pass, `check.sh` green, `src/` and
`apps/firefox-extension/lib` in sync.

## Verdict

No exploitable vulnerability found. No secrets or personal data in the repo
(committed YouTube page snapshots were scanned: no session cookies, no account
identifiers; the embedded `INNERTUBE_API_KEY` is the public per-page YouTube web
key, not a credential). No dangerous sinks (`innerHTML`, `eval`, `document.write`)
in any shipped code. Storage reads are sanitized through `applyDefaults()` before
use. Below are hardening tasks, ordered by severity.

## Tasks

### S1 — `isYouTubeWatchPage` hostname suffix bypass (medium)

- [x] Fixed in `src/site-adapters/youtube/youtube-site-adapter.js`

`hostname.endsWith('youtube.com')` also matches `evilyoutube.com`. Today the
content script only runs on `www.youtube.com` (manifest match), so this is not
exploitable — but the core function is the trust boundary and must be correct
on its own (defense in depth; Chrome/Edge editions will reuse it).

```js
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
```

### S2 — content script does not validate incoming runtime messages (medium)

- [x] Fixed in `apps/firefox-extension/src/content/content.js`

`lib/core/validation.js` exports `validateMessage()` but the content script never
calls it: it reads `msg.type` directly, so a malformed message (`null`, a string)
throws inside the listener, and payload shape is only partially checked. Route
every message through the validator that already exists:

```js
browser.runtime.onMessage.addListener((raw) => {
  const msg = validateMessage(raw);
  if (!msg.valid) return Promise.resolve({ ok: false, error: msg.error });
  // ... switch on msg.type, use msg.payload (already shape-checked)
});
```

### S3 — narrow `web_accessible_resources` (low)

- [x] Fixed in `apps/firefox-extension/manifest.json`

`lib/*` exposes every module (including unused-by-content-script
`browser-adapters/` and `facade/`) to the YouTube page origin. Firefox's
per-install UUID limits fingerprinting, but Chrome uses a fixed extension ID, so
the Chrome edition would be trivially detectable. Expose only what the content
script actually imports:

```json
"web_accessible_resources": [
  {
    "resources": [
      "lib/core/*.js",
      "lib/site-adapters/youtube/*.js",
      "lib/player-adapters/*.js"
    ],
    "matches": ["https://www.youtube.com/*"]
  }
]
```

Longer-term (Chrome edition): bundle the content script into a single file and
drop `web_accessible_resources` entirely. Tracked in the multi-browser spec.

### S4 — pin third-party GitHub Actions to commit SHAs (medium, supply chain)

- [x] Fixed: `gitleaks-action` and `action-gh-release` pinned to commit SHAs in
  `release-main.yml` and `secret-scan.yml`; Dependabot (`github-actions`
  ecosystem, weekly) added to keep pins fresh. First-party `actions/*` stay on
  major tags.

Tag refs (`gitleaks/gitleaks-action@v3`, `softprops/action-gh-release@v2`) are
mutable — a compromised tag runs attacker code in a workflow that holds
`contents: write` and AMO signing secrets. Pin every third-party action to a
full commit SHA with a version comment; `actions/*` org actions may keep major
tags, but pinning those too costs nothing:

```yaml
- uses: gitleaks/gitleaks-action@<full-40-char-sha>  # v3.x.x
- uses: softprops/action-gh-release@<full-40-char-sha>  # v2.x.x
```

Left unchecked deliberately: needs network access to resolve current tag SHAs —
resolve with `gh api repos/<owner>/<repo>/git/ref/tags/<tag>` and fill in.
Add Dependabot `package-ecosystem: github-actions` to keep pins fresh.

### S5 — release workflow signs with mutable `main` HEAD (low)

- [ ] `release-main.yml`

The AMO sign step packages whatever `main` HEAD is at run time. With linear
history and branch protection (documented in `docs/release/branch-protection.md`)
this is acceptable, but signing from the verified tag/commit that CI tested is
stricter. Minimal step: assert the packaged zip's manifest version matches the
tag being created (already implicit) **and** enable required status checks on
`main` so untested commits cannot trigger signing. Process task, no code.

### S6 — replace dev AMO id before listing (low)

- [ ] `apps/firefox-extension/manifest.json`

`"id": "videodefaults@dev"` is a placeholder. AMO permanently binds the listing
to the first-uploaded id. Decide the production id (e.g.
`videodefaults@kotmin.dev` or a UUID) before the first listed upload. One-line
change; blocked on owner decision (see `docs/ai/questions-for-K.md`).

### S7 — page-snapshot hygiene policy (low, process)

- [ ] `docs/probes/`, `docs/e2e-page-states/`

Raw YouTube DOM dumps are committed for debugging. This round they were captured
logged-out and are clean, but a snapshot taken while logged in would embed
account name, avatar URLs, and feed personalization. Policy: capture probes only
in a clean profile (web-ext temporary profile already guarantees this for E2E),
and add a one-line README note in each dir. Optionally move future probes under a
gitignored `dist/probes/`.

## Robustness fixes (not security, found during audit)

### R1 — stale `ratechange` listener survives SPA navigation

- [x] Fixed in `apps/firefox-extension/src/content/content.js`

`siteAdapter.onNavigate` resets `player = null` and `state` but never calls
`unsubscribeRateChange()`. The old video element's listener keeps firing (YouTube
reuses the element) against the fresh state and can mark a manual override the
user never made:

```js
siteAdapter.onNavigate(() => {
  if (unsubscribeRateChange) { unsubscribeRateChange(); unsubscribeRateChange = null; }
  player = null;
  state = createState();
  if (isYouTubeWatchPage(location.href)) tryInitVideo();
});
```

### R2 — no-op speed write leaves a stale extension token

- [x] Fixed in `apps/firefox-extension/src/content/content.js`

`applySpeed()` marks an extension-write token, but if the video already plays at
the target speed no `ratechange` event fires, so the token is never consumed.
The user's next *manual* speed change then consumes the stale token and is
misclassified as an extension write — manual override detection silently misses
one change:

```js
function applySpeed(speed) {
  if (!player) return;
  if (player.getSpeed() === speed) return;
  state = markExtensionWrite(state, nextToken());
  player.setSpeed(speed);
}
```

### R3 — add `web-ext lint` to CI

- [x] Fixed in `ci-dev.yml` + `release-main.yml`

`web-ext` is already a devDependency; its linter (addons-linter) catches
manifest errors, MV3 incompatibilities, and AMO review blockers before upload:

```yaml
- name: Lint extension (addons-linter)
  run: npx web-ext lint --source-dir apps/firefox-extension --no-input
```

Requires `lib/` to be synced first (`bash scripts/sync-extension-lib.sh`).

### R4 — settings changes are not re-applied to an open video (behavioral, decide)

- [ ] `apps/firefox-extension/src/content/content.js`

The `storage.onChanged` listener updates the in-memory `settings` but never
re-applies speed; only the explicit popup message does. Cross-window: changing
the default in window A does nothing in window B until next navigation. Possibly
intended (avoid yanking playback speed mid-video). Question for K logged in
`docs/ai/questions-for-K.md`; no change until answered.

### R5 — unused modules shipped in the package (cosmetic)

- [ ] `tools/package-extension/package_firefox.py`

`lib/facade/` and `lib/browser-adapters/firefox/firefox-messaging-adapter.js`
are shipped but imported by nothing in the extension. Harmless dead weight
(~2 KB); AMO reviewers flag unused files occasionally. Either wire the popup
through the facade (it duplicates facade logic today) or exclude unused paths at
packaging time. Low priority; revisit after the multi-browser restructure, which
changes what "unused" means.

## Roadmap pointers

Follow-up milestones specced separately:

- Multi-browser (Chrome/Edge/Firefox) restructure — `docs/specs/multi-browser.md`
- Prefix-key navigation (tmux-style `Ctrl+A` chords) — `docs/specs/keyboard-shortcuts.md`
