# Chrome Web Store (CWS) Developer & CI Publish Setup

One-time setup so CI can push new `chrome-extension` versions to the Chrome Web Store, once K's $5 developer registration exists. Mirrors `docs/release/amo-developer-setup.md`'s shape — read that one first if this is your first pass through a store pipeline.

## 1. One-Time: Google Cloud OAuth Client

CWS publishing uses OAuth2, not a static API key.

1. In Google Cloud Console, create (or reuse) a project owned by the same identity as the CWS developer account.
2. Enable the **Chrome Web Store API**.
3. Create an OAuth client: **APIs & Services → Credentials → Create Credentials → OAuth client ID**, type **Web application**. Add `https://developers.google.com/oauthplayground` as an authorized redirect URI (only needed to mint the refresh token below, not used at runtime).
4. Note the **Client ID** and **Client Secret**.

## 2. One-Time: Mint a Refresh Token

Done once, by hand, using the OAuth Playground:

1. Go to https://developers.google.com/oauthplayground.
2. Gear icon → check "Use your own OAuth credentials" → paste the Client ID/Secret from step 1.
3. In the left panel, enter scope `https://www.googleapis.com/auth/chromewebstore` → Authorize → sign in with the CWS developer account → Exchange authorization code for tokens.
4. Copy the **refresh token** shown. This does not expire on its own; it's the credential CI uses to mint short-lived access tokens.

## 3. Add GitHub Repository Secrets

`release-main.yml` will read these exact names once the Chrome publish step is added:

- `CWS_CLIENT_ID`
- `CWS_CLIENT_SECRET`
- `CWS_REFRESH_TOKEN`
- `CWS_EXTENSION_ID` (the store-assigned item id — only exists after step 4 below)

## 4. First-Ever Submission Needs the Web UI Once

Same constraint as AMO: the API only updates an *existing* store item, it cannot create the first listing.

1. Go to the Chrome Web Store Developer Dashboard, pay the one-time $5 registration if not already done.
2. **New Item** → upload `dist/videodefaults-chrome-<version>.zip` from `bash scripts/package-extension.sh chrome-extension` (test it locally first per `docs/release/chrome-local-load.md`).
3. Fill in the Store Listing tab (description, screenshots, category) and the **Privacy practices** tab — a single-purpose description plus a justification for each requested permission (`storage`, `host_permissions` for `youtube.com`) is mandatory; the submission is rejected without it.
4. Submit for review. Once approved, copy the item id from the dashboard URL into the `CWS_EXTENSION_ID` secret.

## 5. What CI Can Automate After That

With all four secrets set, a publish step can, per push to `main`:

1. `POST https://oauth2.googleapis.com/token` with `client_id`, `client_secret`, `refresh_token`, `grant_type=refresh_token` → short-lived access token (no npm dependency needed, plain HTTP).
2. `POST https://chromewebstore.googleapis.com/v2/publishers/{publisher_id}/items/{CWS_EXTENSION_ID}:upload` with the zip.
3. `POST .../items/{CWS_EXTENSION_ID}:publish` to submit the uploaded draft for review.

**It cannot force the review to complete** — same caveat as AMO: a green CI run means "submitted," not "live." Track status via `:fetchStatus` or the dashboard.

## Notes

- Chrome (unlike Firefox) does not require a `browser_specific_settings`/manifest `key` field for CI builds — `apps/chrome-extension/manifest.json` has none today, so there's nothing to strip before upload. If one is ever added for a stable dev-build id, it must be removed before the zip is uploaded (the Store assigns/owns the real key).
- Edge Add-ons (Partner Center API) is a separate, simpler auth flow (`ApiKey` + `X-ClientID` header, no OAuth) — out of scope for this doc; see issue #6 item 4 when Edge publishing is greenlit.

## Related Documents

- `docs/release/chrome-local-load.md` — test the exact packaged zip locally before it ever reaches this pipeline.
- `docs/release/amo-developer-setup.md` — the Firefox/AMO equivalent this mirrors.
