# Branch Protection Checklist

## Branch Model

| Branch | Role | Push policy |
|--------|------|-------------|
| `dev` | Active development | Direct push allowed |
| `main` | Release snapshots | Protected; promotion only from `dev` |

## Rules for `main`

Configure via GitHub → Settings → Branches → Branch protection rules for `main`:

- [x] Require linear history (no merge commits)
- [x] Require status checks to pass before merging
  - Required check: `CI Dev / Check / Test / Package`
- [x] Require branches to be up to date before merging
- [x] Restrict pushes that create matching branches
- [x] Do not allow force pushes (except admin recovery)
- [x] Do not allow deletions

## Rules for `dev`

- Direct pushes allowed for maintainers
- No merge commits — rebase or fast-forward only
- Pre-push hook validates commit messages before they leave the local machine
- CI runs automatically on every push to `dev`

## Promotion: `dev` → `main`

Promotion should use a fast-forward or rebase strategy to preserve linear history:

```bash
git checkout main
git merge --ff-only dev
git push origin main
```

Never use `git merge dev` (creates a merge commit). Never force-push `main` except for emergency admin recovery.

## Workflow File Protection

`.github/workflows/` is protected by `CODEOWNERS`. Changes require a review from `@Kotmin` before merging. This prevents untrusted contributors from gaining CI-level access via workflow modifications.

## Release Pipeline

Two per-edition workflows run the publish pipeline on pushes to `main`, each gated by an `on.push.paths` filter so a change to one edition doesn't trigger a release for the other:

- `Release Firefox` (`.github/workflows/release-firefox.yml`): secret scan, check, test, package, changelog, AMO signing, GitHub Release (tag `v<version>`). Requires `AMO_ISSUER` and `AMO_SECRET` repository secrets — see `docs/release/amo-developer-setup.md` for how to generate and add them.
- `Release Chrome` (`.github/workflows/release-chrome.yml`): secret scan, check, test, package, changelog, Chrome Web Store publish, GitHub Release (tag `chrome-v<version>`). Requires `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_EXTENSION_ID` repository secrets — see `docs/release/cws-developer-setup.md`.

Without those secrets configured, the signing/publish/release steps of the relevant workflow will fail (the check/test/package/secret-scan steps still run and provide useful signal on their own).

## Secret Scanning

`Secret Scan` (`.github/workflows/secret-scan.yml`) runs `gitleaks` on every push (all branches), every pull request, and on demand — independent of the release pipeline. This closes the gap where commits pushed directly to `dev` would otherwise go unscanned until a `main` release. `Release Main` keeps its own secret-scan step as a final gate before signing/release.

## Emergency Recovery

If `main` is in a broken state and a force-push is absolutely required:

1. Confirm the intended target SHA with `git log --oneline main origin/main`.
2. Temporarily disable branch protection in GitHub Settings.
3. Force-push: `git push --force-with-lease origin main`.
4. Immediately re-enable branch protection.
5. Document the recovery in a follow-up commit on `dev`.
