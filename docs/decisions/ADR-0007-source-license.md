# ADR-0007: Keep MIT License for Now

Status: Accepted
Date: 2026-07-03

## Context

The repository has shipped under the MIT `LICENSE` since its first commit, but that choice was never recorded as a deliberate decision — no ADR discussed alternatives. K has since raised the possibility of monetizing VideoDefaults in the future (e.g. a paid tier, donations tied to the official AMO listing, or a pro fork), which makes the license a real decision point rather than an incidental default.

Permissive licenses like MIT let anyone — including a competitor — fork, rebrand, and redistribute or resell the extension with no obligation back to the original author. Source-available or noncommercial licenses (e.g. PolyForm Noncommercial, BSL) can block that, at the cost of extra legal overhead and friction that's unusual for a small AMO-distributed extension. A fully proprietary/all-rights-reserved approach maximizes control but loses any open-source goodwill and doesn't change anything on the AMO side either way (AMO does not require an OSI-approved license).

## Decision

Keep the MIT license for now. No change to `LICENSE`.

## Rationale

- Monetization plans are not yet concrete — there's nothing specific to protect against today.
- MIT keeps zero friction for AMO reviewers and any future contributors.
- Keeping the *official* AMO listing as the authoritative, best-maintained version is what actually captures any future monetization value (trust, reviews, install count) — MIT doesn't block K from monetizing that listing itself. It only means a fork isn't exclusive.
- Relicensing later is far easier than un-relicensing: starting permissive and tightening later (via a fresh ADR) is lower-risk than starting restrictive and having to loosen it if that turns out to be the wrong call.

## Consequences

- Anyone may legally fork, modify, redistribute, or sell VideoDefaults under MIT's terms; this ADR is an explicit acknowledgment of that tradeoff, not an oversight.
- If monetization becomes concrete, open a new ADR to reconsider the license (e.g. source-available/noncommercial) rather than silently relicensing.
- If the project ever gains external contributors before any relicensing, their contributions were made under MIT — relicensing later would need either their consent or a rewrite of the affected code, per standard OSS relicensing practice.
