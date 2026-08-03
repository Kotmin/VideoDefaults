# CWS API Contract Findings

Root-cause findings for the `release-chrome.yml` upload failure (`HTTP 400
Invalid JSON payload... PK`) — Google was parsing our zip's magic
bytes as JSON, which meant the endpoint/body contract was wrong, not the
credentials or the zip itself.

## What was wrong

`release-chrome.yml` POSTed the raw zip to:

```
https://chromewebstore.googleapis.com/v2/publishers/-/items/{id}:upload
```

That is the **metadata** URI for the `items` resource (it expects a JSON
body, hence it choked on zip bytes). The **media** upload URI is a
different path entirely, under `/upload/v2/`. It also used `-` as the
publisher path segment and `Content-Type: application/zip`, neither of
which is correct.

## Verified contract

Cross-checked against Chrome's official REST reference
(`media/upload`, `publishers.items/publish`) and the source of
[`fregante/chrome-webstore-upload`](https://github.com/fregante/chrome-webstore-upload)
(a maintained library many CI pipelines use for this exact task — used here
as a real-world implementation cross-check, not just docs).

**Upload** (media endpoint, not the metadata one):

```
POST https://chromewebstore.googleapis.com/upload/v2/publishers/{publisherId}/items/{extensionId}:upload
Authorization: Bearer {token}
X-Goog-Upload-Protocol: raw
X-Goog-Upload-File-Name: extension.zip
<raw zip bytes as body>
```

No `Content-Type: application/zip` — the upload protocol header replaces it.
Response is JSON: `{ name, itemId, crxVersion, uploadState }`.

**Publish:**

```
POST https://chromewebstore.googleapis.com/v2/publishers/{publisherId}/items/{extensionId}:publish
Authorization: Bearer {token}
Content-Type: application/json

{"publishType": "DEFAULT_PUBLISH"}
```

Unlike upload, publish DOES need a JSON body — `publishType` is required,
not optional.

**`publisherId` is a real value, not a wildcard.** Find it in the
[Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
account settings. `-` is not accepted as a substitute.

## Sources

- https://developer.chrome.com/docs/webstore/api/reference/rest/v2/media/upload
- https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/publish
- https://developer.chrome.com/docs/webstore/using-api
- https://github.com/fregante/chrome-webstore-upload (`source/index.ts`)

## Related Documents

- `docs/release/cws-refresh-token-lifecycle.md` — token expiry/rotation findings from the same investigation.
- `docs/release/cws-developer-setup.md` — one-time setup flow, needs a `CWS_PUBLISHER_ID` secret added per these findings.
