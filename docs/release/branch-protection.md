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

`Release Main` (`.github/workflows/release-main.yml`) runs the full publish pipeline on every push to `main`: secret scan, check, test, package, changelog, AMO signing, GitHub Release. It requires `AMO_ISSUER` and `AMO_SECRET` repository secrets — see `docs/release/amo-developer-setup.md` for how to generate and add them. Without those secrets configured, the signing/release steps of the workflow will fail (the check/test/package/secret-scan steps still run and provide useful signal on their own).

## Emergency Recovery

If `main` is in a broken state and a force-push is absolutely required:

1. Confirm the intended target SHA with `git log --oneline main origin/main`.
2. Temporarily disable branch protection in GitHub Settings.
3. Force-push: `git push --force-with-lease origin main`.
4. Immediately re-enable branch protection.
5. Document the recovery in a follow-up commit on `dev`.
