# Chrome Web Store (CWS) Developer & CI Publish Setup

One-time setup so CI can push new `chrome-extension` versions to the Chrome Web Store, once K's $5 developer registration exists. Mirrors `docs/release/amo-developer-setup.md`'s shape — read that one first if this is your first pass through a store pipeline.

## 1. One-Time: Google Cloud OAuth Client

CWS publishing uses OAuth2, not a static API key.

1. In Google Cloud Console, create (or reuse) a project owned by the same identity as the CWS developer account.
2. Enable the **Chrome Web Store API**.
3. Create an OAuth client: **APIs & Services → Credentials → Create Credentials → OAuth client ID**, type **Web application**. Add `https://developers.google.com/oauthplayground` as an authorized redirect URI (only needed to mint the refresh token below, not used at runtime).
4. Note the **Client ID** and **Client Secret**.
5. Go to **APIs & Services → OAuth consent screen → Audience** → **Publish App** → **In production**. Do **not** submit for verification — Google may refuse to verify this scope since it's meant for single-owner use, and staying unverified-in-production is fine at the 1-user scale this project runs at. Skipping this step leaves the app in "Testing" status, where Google expires the refresh token below after 7 days.

## 2. One-Time: Mint a Refresh Token

Done once, by hand, using the OAuth Playground:

1. Go to https://developers.google.com/oauthplayground.
2. Gear icon → check "Use your own OAuth credentials" → paste the Client ID/Secret from step 1.
3. In the left panel, enter scope `https://www.googleapis.com/auth/chromewebstore` → Authorize → sign in with the CWS developer account → Exchange authorization code for tokens.
4. Copy the **refresh token** shown. It does not expire on its own **once the OAuth consent screen is Published/In production** (step 5 above) — `chromewebstore` is not in the small set of scopes exempt from the 7-day expiry Google applies to refresh tokens minted while the app is still in "Testing" status.

## 3. Add GitHub Repository Secrets

`release-chrome.yml` reads these exact names for its Chrome publish step:

- `CWS_CLIENT_ID`
- `CWS_CLIENT_SECRET`
- `CWS_REFRESH_TOKEN`
- `CWS_EXTENSION_ID` (the store-assigned item id — only exists after step 4 below)
- `CWS_PUBLISHER_ID` (your account/group publisher id from the [Developer Dashboard](https://chrome.google.com/webstore/devconsole/) account settings — required, not a wildcard; see `docs/release/cws-api-contract-findings.md`)

## 4. First-Ever Submission Needs the Web UI Once

Same constraint as AMO: the API only updates an *existing* store item, it cannot create the first listing.

1. Go to the Chrome Web Store Developer Dashboard, pay the one-time $5 registration if not already done.
2. **New Item** → upload `dist/videodefaults-chrome-<version>.zip` from `bash scripts/package-extension.sh chrome-extension` (test it locally first per `docs/release/chrome-local-load.md`).
3. Fill in the Store Listing tab (description, screenshots, category) and the **Privacy practices** tab — a single-purpose description plus a justification for each requested permission (`storage`, `host_permissions` for `youtube.com`) is mandatory; the submission is rejected without it.
4. Submit for review. Once approved, copy the item id from the dashboard URL into the `CWS_EXTENSION_ID` secret.

## 5. What CI Automates After That

With all five secrets set, `release-chrome.yml` runs this on every push to `main` that touches Chrome-relevant paths:

1. `POST https://oauth2.googleapis.com/token` with `client_id`, `client_secret`, `refresh_token`, `grant_type=refresh_token` → short-lived access token (no npm dependency needed, plain HTTP).
2. `POST https://chromewebstore.googleapis.com/upload/v2/publishers/{CWS_PUBLISHER_ID}/items/{CWS_EXTENSION_ID}:upload` with the zip as the raw body, `X-Goog-Upload-Protocol: raw` and `X-Goog-Upload-File-Name` headers (note the `/upload/v2/` media path — not the `/v2/` metadata path used for `:publish`/`:fetchStatus`).
3. `POST .../v2/publishers/{CWS_PUBLISHER_ID}/items/{CWS_EXTENSION_ID}:publish` with a JSON body `{"publishType":"DEFAULT_PUBLISH"}` to submit the uploaded draft for review.

See `docs/release/cws-api-contract-findings.md` for the full verified contract and how the original `-`-as-publisher-id / metadata-endpoint assumptions were found to be wrong on the first live run.

> **Provenance note:** a background research agent was assigned to verify this contract but stalled (repeated idle notifications, no report delivered). The contract above was instead verified directly against Chrome's official REST reference plus the `fregante/chrome-webstore-upload` library source as a real-world cross-check, per this repo's debug-strategy rule (stop guessing after 2 failed live attempts, reassess the abstraction level rather than loop). A stalled subagent is a signal to verify directly, not a blocker.

**It cannot force the review to complete** — same caveat as AMO: a green CI run means "submitted," not "live." Track status via `:fetchStatus` or the dashboard.

## Notes

- Chrome (unlike Firefox) does not require a `browser_specific_settings`/manifest `key` field for CI builds — `apps/chrome-extension/manifest.json` has none today, so there's nothing to strip before upload. If one is ever added for a stable dev-build id, it must be removed before the zip is uploaded (the Store assigns/owns the real key).
- Edge Add-ons (Partner Center API) is a separate, simpler auth flow (`ApiKey` + `X-ClientID` header, no OAuth) — out of scope for this doc; see issue #6 item 4 when Edge publishing is greenlit.

## Related Documents

- `docs/release/chrome-local-load.md` — test the exact packaged zip locally before it ever reaches this pipeline.
- `docs/release/amo-developer-setup.md` — the Firefox/AMO equivalent this mirrors.
