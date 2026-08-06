# Microsoft Edge Add-ons Developer & CI Publish Setup

One-time setup so CI can push new `edge-extension` versions to the Microsoft
Edge Add-ons store, once K's Partner Center developer account exists. Mirrors
`docs/release/cws-developer-setup.md`'s shape, which itself mirrors
`docs/release/amo-developer-setup.md` — read either one first if this is your
first pass through a store pipeline. Contract verified in
`docs/release/edge-api-contract-findings.md`.

## 1. One-Time: Partner Center API Credentials

Edge Add-ons uses a simple API key pair, not OAuth — no token-mint step like
CWS.

1. Register a Partner Center developer account (one-time registration fee,
   separate from AMO/CWS).
2. Partner Center → Microsoft Edge → **Publish API** page → **Create API
   credentials**.
3. Note the **Client ID** and **API key** shown. Also note the **Expiry
   date** shown on that same screen — Microsoft's docs don't state a fixed
   credential lifetime, so this is the only place that value is visible
   (see `docs/release/edge-api-contract-findings.md` §"Credential
   lifecycle").

## 2. Add Them as GitHub Repository Secrets

`release-edge.yml` reads these exact names for its Edge publish step:

- `EDGE_CLIENT_ID`
- `EDGE_API_KEY`
- `EDGE_PRODUCT_ID` (the store-assigned product GUID — only exists after
  step 3 below; find it on the extension's Overview page in Partner Center)

## 3. First-Ever Submission Needs the Web UI Once

Same constraint as AMO and CWS — confirmed directly in Microsoft's docs, not
assumed by analogy: the API has no endpoint to create a new product, only to
update an existing one.

1. Partner Center → Microsoft Edge → **New extension**.
2. Upload `dist/videodefaults-edge-<version>.zip` from
   `bash scripts/package-extension.sh edge-extension` (test it locally first
   — load the extracted zip via `edge://extensions` → Developer mode → Load
   unpacked, same process as `docs/release/chrome-local-load.md` since Edge
   is Chromium-based).
3. Fill in the Store Listing properties (description, screenshots,
   category) and the **Privacy** tab — a privacy policy URL and property
   declarations are required; reuse `docs/privacy_policy/` content.
4. Submit for certification. Once approved, copy the product GUID from the
   extension's Overview page into the `EDGE_PRODUCT_ID` secret.

## 4. What CI Automates After That

With all three secrets set, `release-edge.yml` runs this on every push to
`main` that touches Edge-relevant paths:

1. `POST /v1/products/{EDGE_PRODUCT_ID}/submissions/draft/package` with the
   zip as the raw body, `Authorization: ApiKey`/`X-ClientID` headers →
   `202` + an `operationId` to poll.
2. Poll `GET .../draft/package/operations/{operationId}` until `Succeeded`
   or `Failed`.
3. `POST /v1/products/{EDGE_PRODUCT_ID}/submissions` with release notes →
   another `202` + `operationId`.
4. Poll `GET .../submissions/operations/{operationId}` until `Succeeded` or
   `Failed`, surfacing Microsoft's error codes on failure.

See `docs/release/edge-api-contract-findings.md` for the full verified
contract this implements.

**It cannot force certification to complete** — same caveat as AMO/CWS: a
green CI run means "submitted," not "live." Microsoft's own docs state
certification can take up to seven business days. Track status via the
`submissions/operations/{operationId}` poll or the Partner Center dashboard.

## Notes

- Edge is Chromium-based and currently byte-identical to the Chrome edition
  (ADR-0008) — the packaged zip differs only by edition-suffix filename, not
  content, until Edge-specific manifest fields are ever added.
- Unlike CWS, there is no OAuth refresh-token rotation concern here (v1.1
  uses a static API key pair), but the credential does show an expiry date
  in Partner Center — check it periodically rather than assuming
  indefinite validity.

## Related Documents

- `docs/release/edge-api-contract-findings.md` — the verified REST contract this setup and `release-edge.yml` implement.
- `docs/release/chrome-local-load.md` — local load-and-test steps that also apply to Edge (Chromium-based, same `edge://extensions` flow).
- `docs/release/cws-developer-setup.md` — the Chrome/CWS equivalent this mirrors.
- `docs/release/amo-developer-setup.md` — the Firefox/AMO equivalent, the original shape both CWS and this doc follow.
