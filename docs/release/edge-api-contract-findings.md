# Edge Add-ons API Contract Findings

Verified contract for the Microsoft Edge Add-ons Submission API, gathered
before writing `release-edge.yml` — not after a failed live run, unlike the
CWS case (`docs/release/cws-api-contract-findings.md`), where the endpoint
was guessed wrong on the first attempt. Fetched directly from Microsoft's
current docs rather than assumed from an older/remembered API shape, per
this repo's debug-strategy rule (verify before implementing, not after).

## Auth: use v1.1 (ApiKey / X-ClientID), not v1 (OAuth)

Microsoft supports two versions today. v1 (Azure AD client-credentials OAuth)
is on Microsoft's own deprecation schedule ("Support for v1 will end on Dec.
31, 2024" per the docs). v1.1 is the current, simpler flow:

- Generate a **Client ID** and **API key** in Partner Center → Publish API
  page → "Create API credentials." No token exchange.
- Every request carries two headers directly:
  `Authorization: ApiKey {API_KEY}` and `X-ClientID: {CLIENT_ID}`.

## Product identifier

Called **`productId`** (a GUID), not `applicationId`. Found in Partner
Center: Microsoft Edge → the extension → Extension identity section (also
visible in the dashboard URL).

## Upload a new package (async)

```
POST https://api.addons.microsoftedge.microsoft.com/v1/products/{productId}/submissions/draft/package
Authorization: ApiKey {API_KEY}
X-ClientID: {CLIENT_ID}
Content-Type: application/zip

<raw zip bytes>
```

Returns `202 Accepted` with a `Location` header containing an `operationId`.
Upload is **not synchronous** — poll before submitting:

```
GET /v1/products/{productId}/submissions/draft/package/operations/{operationId}
```

Returns `{status: "InProgress"|"Succeeded"|"Failed", errorCode, errors}`.

## Submit the uploaded draft for review (separate call, also async)

```
POST /v1/products/{productId}/submissions
Authorization: ApiKey {API_KEY}
X-ClientID: {CLIENT_ID}
Content-Type: application/json

{"notes": "release notes for certification reviewers"}
```

Returns `202 Accepted` + `Location` header with a new `operationId`, polled
via `GET /v1/products/{productId}/submissions/operations/{operationId}`.
Failure states include `CreateNotAllowed`, `NoModulesUpdated`,
`InProgressSubmission`, `UnpublishInProgress`, `ModuleStateUnPublishable`,
`SubmissionValidationError`.

## First-ever listing: Partner Center UI only — confirmed

Same constraint as AMO and CWS. Docs state directly: "There aren't REST API
endpoints for: Creating a new product. Updating a product's metadata." The
`CreateNotAllowed` error code on the submit-poll endpoint enforces this at
runtime too.

## Review turnaround

"Up to seven business days after you submit the extension" per Microsoft's
publish walkthrough. No documented rate-limit ceiling beyond a generic `429`.

## Credential lifecycle — unconfirmed, check Partner Center at creation time

Both v1.1 API keys and v1 client secrets show an **Expiry date** in the
Partner Center UI, but the docs don't state a default lifetime or forced
rotation cadence — unlike Google's 7-day-in-Testing-mode refresh-token trap
(`docs/release/cws-refresh-token-lifecycle.md`). Read the actual expiry value
off the credential-creation screen when minting it; don't assume a duration.
Revisit this doc if a credential expires unexpectedly in CI.

## Sources

Fetched and read in full:
- https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api
- https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/addons-api-reference
- https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension

## Related Documents

- `docs/release/edge-developer-setup.md` — the setup flow built from this contract.
- `docs/release/cws-api-contract-findings.md` — the Chrome equivalent, and why this doc exists as a pre-implementation step rather than a post-incident fix.
