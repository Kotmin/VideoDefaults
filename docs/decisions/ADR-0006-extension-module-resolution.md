# ADR-0006: Extension Module Resolution Strategy

Status: Accepted  
Date: 2026-06-30

## Context

The repository separates shared platform-independent logic (`src/core/`, `src/facade/`, `src/browser-adapters/`) from Firefox extension files (`apps/firefox-extension/`). When a Firefox content script or popup script needs to import from the shared `src/` modules, the import path must resolve correctly both during local extension development (Firefox temporary install from `apps/firefox-extension/`) and in the packaged zip artifact.

A browser extension load sees only files relative to its own root (`apps/firefox-extension/`). An import from `content.js` to `../../src/core/speed.js` resolves outside the extension root and is inaccessible to the browser at runtime.

## Decision

Use a development symlink plus packaging-time copy:

1. A symlink `apps/firefox-extension/lib` → `../../src` is created locally (not committed to git; listed in `.gitignore`).
2. Extension scripts import shared modules as `../../lib/core/speed.js` (relative to their own path inside the extension).
3. The Python packaging script (`tools/package-extension/package_firefox.py`) resolves the symlink and copies `src/` into `lib/` inside the zip, preserving the same relative paths.
4. The `.gitignore` entry `apps/firefox-extension/lib` prevents the symlink from being tracked.

An installer script (`scripts/install-git-hooks.sh`) also creates the symlink as part of dev setup.

## Rationale

- No bundler, no build step, no transpilation — the shipped source is exactly what is reviewed.
- The symlink approach is the lowest-overhead mechanism that keeps the development inner loop fast (Firefox reloads the extension from disk on each change).
- AMO reviewers see clean, readable source files; the zip structure makes paths transparent.
- Copying rather than symlinking inside the zip ensures the artifact is self-contained and reproducible without the local dev environment.

## Consequences

- `scripts/install-git-hooks.sh` must create the symlink after cloning.
- `apps/firefox-extension/lib` is added to `.gitignore`.
- The packaging script must copy `src/` into `lib/` before zipping and must verify no path escapes the extension root.
- If `src/` grows significantly, the lib copy in the zip grows proportionally — keep core modules small.
- TypeScript or transpiled artifacts must never land in `src/` (enforced by ADR-0003).
