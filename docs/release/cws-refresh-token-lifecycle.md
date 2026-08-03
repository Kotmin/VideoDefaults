# CWS Refresh Token Lifecycle

Findings on whether the Chrome Web Store (CWS) OAuth2 refresh token used by CI
(`CWS_REFRESH_TOKEN`, see `docs/release/cws-developer-setup.md`) needs any
rotation infrastructure beyond a plain GitHub Actions secret.

## Verdict

No extra infrastructure needed — no vault, no rotation cron, no renewal
reminders. A plain repo secret is sufficient long-term, conditional on one
one-time setup step below.

## Expiry behavior

Google expires a refresh token after **7 days** if the OAuth consent screen is
still in **Testing** publishing status — this applies to the
`https://www.googleapis.com/auth/chromewebstore` scope specifically, since
it's not in the small set of scopes (name/email/profile) exempt from that
7-day limit. The Chrome Web Store API's own setup guide walks you into this
trap: it tells you to add yourself as a **Test user** "without needing to go
through an approval process," which leaves the consent screen in Testing
status.

Once the consent screen is published to **In production**, the refresh token
does not expire on its own. It only dies on:

- explicit user revocation
- 6 months of no use (CI runs far more often than that)
- exceeding 100 live refresh tokens for one Google Account + client ID
- a password change with Gmail scopes involved (not applicable — this scope
  isn't a Gmail scope)

## Required one-time action

Google Cloud Console → **APIs & Services → OAuth consent screen → Audience**
→ **Publish App** → **In production**. Do **not** submit for verification —
Google may refuse to verify an app using the CWS write scope since it's
intended for single-owner/publisher use, and staying unverified-in-production
is fine at the single-user scale this project runs at (the 100-user cap is
irrelevant here).

This step is already folded into `docs/release/cws-developer-setup.md` §1
step 5 and §2 step 4.

## Per-run token minting

`release-chrome.yml` mints a new short-lived access token (1 hour,
`expires_in: 3600`) on every run rather than caching one across runs. No
quota concern, and caching wouldn't be possible across ephemeral runners
anyway.

## Sources

- https://developers.google.com/identity/protocols/oauth2
- https://developers.google.com/identity/protocols/oauth2/production-readiness/overview
- https://developer.chrome.com/docs/webstore/using-api

## Related Documents

- `docs/release/cws-developer-setup.md` — the full one-time setup flow this note feeds into.
