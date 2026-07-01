# VideoDefaults

Test: `bash scripts/test.sh` | Check: `bash scripts/check.sh`

Code: plain JS + JSDoc in `src/` and `apps/`; no TypeScript, no runtime deps shipped; no comments unless WHY is non-obvious

Commits: conventional (`type(scope): desc`); types: feat fix docs test refactor chore ci build perf; atomic; no AI tool names

Branches: `dev` (active, push allowed) → `main` (release only, linear, no merge commits)

MCP: playwright via `.mcp.json` (Firefox, local install)

Skills: ponytail full is the base — question YAGNI first; stdlib before custom; native platform before dependencies; minimum code that works

## Debug Strategy — stop looping on broken solutions

Before trying a fix a second time, prove the root cause with observable evidence:
1. **Capture state** — save real page HTML/JSON snapshots; never assume DOM structure
2. **One variable at a time** — change one thing, run, read the error; don't stack fixes
3. **Distinguish failure modes** — is the evaluate throwing, returning wrong type, or returning wrong value? Log the raw result
4. **Check the protocol layer** — FDP grips wrap some values (`{type:"undefined"}`, `{type:"NaN"}`, `{value:N}`); unwrap before comparing
5. **Actor staleness** — Firefox replaces `windowGlobal` mid-session; always refresh the consoleActor after navigation + sleep before asserting
6. **If stuck after 2 attempts** — document what was tried and why it failed, then reassess the abstraction level (e.g. wrong selector, wrong actor, wrong protocol assumption)
