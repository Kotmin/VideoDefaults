# AMO Developer & CI Signing Setup

One-time setup to let both you (locally) and CI (`.github/workflows/release-main.yml`) sign and submit VideoDefaults to addons.mozilla.org. Assumes you already have a Mozilla AMO developer account.

## 1. Generate API Credentials

1. Log in at https://addons.mozilla.org/developers/.
2. Go to https://addons.mozilla.org/developers/addon/api/key/.
3. Generate a new API key. Mozilla gives you a **JWT issuer** and a **JWT secret** — copy both immediately, the secret is shown only once.

## 2. Add Them as GitHub Repository Secrets

`release-main.yml` reads these exact names:

1. GitHub → repo → Settings → Secrets and variables → Actions → New repository secret.
2. Add `AMO_ISSUER` = the JWT issuer from step 1.
3. Add `AMO_SECRET` = the JWT secret from step 1.

These are repository secrets, never committed to the repo, and only readable by workflows running in this repository.

## 3. First Local Dry Run (do this before trusting CI)

Confirm the credentials actually work, and see what a submission looks like, before the pipeline ever touches them:

```bash
bash scripts/sync-extension-lib.sh
npx web-ext sign \
  --api-key="$AMO_ISSUER" \
  --api-secret="$AMO_SECRET" \
  --source-dir apps/firefox-extension \
  --artifacts-dir dist \
  --channel listed
```

`web-ext` will validate the manifest, upload it to AMO, and poll until Mozilla's automated validation finishes (this is separate from human review). A signed `.xpi` lands in `dist/` on success.

## 4. First-Ever Submission Needs the Web UI Once

`web-ext sign --channel listed` uploads a **new version** to an *existing* listing — it does not create the initial listing (name, category, screenshots, summary, tags). For the very first submission:

1. Go to https://addons.mozilla.org/developers/addon/submit/distribution.
2. Choose "On this site" (listed) distribution.
3. Upload the `.zip` from `bash scripts/package-firefox.sh` (or the `.xpi` from step 3 above).
4. Fill in the listing content from `docs/release/amo-listing.md` (summary, description, category, tags, permissions explanation, screenshots).
5. Submit for review.

After this first listing exists, every subsequent `web-ext sign` (locally or via CI) uploads a new version to it automatically.

## 5. What CI Automates vs. What It Can't

Once `AMO_ISSUER`/`AMO_SECRET` are set, `release-main.yml` runs on every push to `main`: secret scan → lint/manifest check → unit tests → package → changelog → sign → GitHub Release with the signed `.xpi` attached.

CI can package, scan, test, sign, and submit the new version to Mozilla's review queue. **It cannot force Mozilla's review to complete** — listed-channel review has historically taken 1–7 days and depends on Mozilla's reviewers, not on this repository. A green CI run means "submitted for review," not "live for users." Track review status the same way as today: `docs/release/amo-release-checklist.md`'s "Post-submission" section.

## Related Documents

- `docs/release/amo-listing.md` — the listing content itself (summary, description, permissions table, screenshots needed).
- `docs/release/amo-release-checklist.md` — the full manual release checklist; CI now automates the "Local Validation" and "AMO Submission" sections, but the version-bump and manual Firefox load test steps remain manual.
- `docs/release/source-package-policy.md` — why no separate source package is required for this submission.
