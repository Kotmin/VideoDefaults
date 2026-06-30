# ADR-0004: Two-Branch Linear History Workflow

Status: Accepted  
Date: 2026-06-30

## Context

A clean, auditable commit history supports AMO review, rollback safety, and maintainability. Merge commits create non-linear history that obscures the change sequence. Feature branches for a solo or small-team project add overhead without proportional benefit at this stage.

## Decision

The repository uses two long-lived branches (`dev` and `main`) with strictly linear history. No merge commits are permitted. `main` is updated only via fast-forward or rebase from `dev`. Direct pushes to `dev` are allowed; `main` is protected.

## Rationale

- Linear history makes `git bisect`, `git log`, and AMO change audits straightforward.
- A single development branch (`dev`) fits the project's scale without losing the protection of a separate release branch (`main`).
- Conventional Commits on a linear history give a machine-readable changelog surface without tooling overhead.
- AMO does not require a specific branch model, but clean history supports any future source-verification requests.

## Consequences

- All commits must follow Conventional Commits format (`type(scope): description`).
- Commits must be atomic: one logical change, tests passing after each.
- A commit message validator (`tools/commit-check/validate_commit_message.py`) enforces format at commit time via a `commit-msg` git hook.
- `main` branch protection requires linear history and disables force-push except for explicit admin recovery.
- Commit messages must not mention AI assistant or tool names.
