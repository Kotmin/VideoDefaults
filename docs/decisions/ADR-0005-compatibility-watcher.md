# ADR-0005: Scheduled Compatibility Watcher Tool

Status: Accepted  
Date: 2026-06-30

## Context

YouTube changes its DOM structure periodically. Firefox and AMO policies evolve. A live extension that works today may silently break within weeks without any code change on the maintainer's part. Manual monitoring is unreliable and easy to forget.

## Decision

Add a compatibility watcher tool (`tools/compatibility-watch/compatibility_watch.py`) that runs on a cron schedule and via manual GitHub Actions trigger. The tool inspects open repository issues for compatibility signals and produces a severity-rated JSON and Markdown report.

## Rationale

- Automated scanning of open issues for keywords (`youtube changed`, `speed not working`, `review rejected`, `broken`, etc.) provides early warning before user reports accumulate.
- A GitHub Actions `workflow_dispatch` trigger allows the maintainer to run a check on demand before any release.
- Python standard library only — no external packages needed — keeps the tool consistent with the no-runtime-dependencies policy spirit and avoids npm supply-chain surface in CI.
- Severity thresholds (`low` / `medium` / `high`) give the watcher actionable output without requiring human judgment for every run.

## Consequences

- The tool uses only `GITHUB_TOKEN` with least-privilege read permissions.
- It does not send issue data to external services in MVP (AI insight integration is a post-MVP optional feature documented separately in `tools/issue-insights/`).
- The compatibility watcher workflow (`.github/workflows/compatibility-watch.yml`) is separate from the dev CI workflow (`ci-dev.yml`).
- A watchlist file (`docs/compliance/compatibility-watchlist.json`) defines the labels and keywords to monitor; it is versioned and can be updated without changing the tool script.
