# ADR-0001: Firefox-First Strategy

Status: Accepted  
Date: 2026-06-30

## Context

VideoDefaults targets multiple browsers eventually (Firefox, Chrome, Chromium, Edge). Browser extension APIs diverge between Firefox and Chromium in Manifest V3: Firefox does not support `background.service_worker` in the same way Chrome does, AMO has its own review process and policy surface, and Firefox MV3 is still maturing relative to Chrome MV3.

## Decision

Target Firefox Desktop with Manifest V3 as the sole supported browser for the MVP. Chromium and Edge adapters are deferred to post-MVP milestones.

## Rationale

- AMO policies are well-documented and stable; building to AMO first validates compliance posture.
- Firefox supports `background.scripts` / event-page behavior that aligns with the MVP's preference to avoid a background process entirely.
- A Firefox-first adapter design forces clean abstraction boundaries that Chromium adapters can later satisfy without core rewrites.
- Single-browser MVP reduces testing surface and allows faster initial delivery.

## Consequences

- The `BrowserAdapter` interface is designed with Firefox's `browser.*` API namespace as the reference implementation.
- A `src/browser-adapters/chromium/` placeholder is committed but empty.
- CI targets Firefox only until a Chromium adapter is added.
- The manifest declares both `background.scripts` and `background.service_worker` where cross-browser compatibility is desired in future, but the MVP may omit background entirely.
