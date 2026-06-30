# ADR-0002: No External Runtime Dependencies in Shipped Extension

Status: Accepted  
Date: 2026-06-30

## Context

Browser extensions are distributed as source bundles reviewed by AMO. Any bundled third-party library increases the review surface, may violate AMO's policy against unnecessary bundled code, and introduces supply-chain risk. The extension's core functionality (reading/writing `video.playbackRate`, messaging, local storage) is fully achievable with browser-native APIs.

## Decision

The shipped extension (files under `apps/firefox-extension/`) must contain zero external runtime libraries. No npm packages, no polyfills, no bundled third-party code, no CDN-loaded scripts.

## Rationale

- AMO policy requires add-ons to be self-contained and avoid unnecessary files or code.
- Supply-chain attacks via npm are a real and growing risk; removing npm from the extension's runtime surface eliminates this vector entirely.
- The browser provides `browser.storage.local`, `browser.runtime.sendMessage`, and native DOM APIs — no polyfill layer is needed for the MVP feature set.
- No build step means AMO reviewers can read the shipped source directly.

## Consequences

- Development tooling (`@dietrichgebert/ponytail`, `@playwright/mcp`, future `web-ext`) lives in `devDependencies` only and is never included in the extension zip.
- The Python packaging script (`tools/package-extension/package_firefox.py`) must enforce a forbidden-file check that fails if any `node_modules` path or npm artifact leaks into the zip.
- TypeScript is also excluded from shipped code (see ADR-0003).
- `web-ext` is deferred as an optional, pinned release-validation tool, not a build dependency.
