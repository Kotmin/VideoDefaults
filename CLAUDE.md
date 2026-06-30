# VideoDefaults

Test: `bash scripts/test.sh` | Check: `bash scripts/check.sh`

Code: plain JS + JSDoc in `src/` and `apps/`; no TypeScript, no runtime deps shipped; no comments unless WHY is non-obvious

Commits: conventional (`type(scope): desc`); types: feat fix docs test refactor chore ci build perf; atomic; no AI tool names

Branches: `dev` (active, push allowed) → `main` (release only, linear, no merge commits)

MCP: playwright via `.mcp.json` (Firefox, local install)
