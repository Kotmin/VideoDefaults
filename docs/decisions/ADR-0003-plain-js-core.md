# ADR-0003: Plain JavaScript with JSDoc for Shipped Extension Code

Status: Accepted  
Date: 2026-06-30

## Context

TypeScript offers static typing and IDE tooling benefits but requires a compilation step that transforms source before shipping. This introduces a build toolchain as a supply-chain surface, produces artifacts that differ from the authored source, and makes AMO source review harder (reviewers must verify that compiled output matches the declared source). JSDoc provides most of the type-documentation benefit without compilation.

## Decision

All code shipped in the extension uses plain JavaScript (ES2020+) with JSDoc-style type annotations. TypeScript is not used in shipped code for the MVP.

## Rationale

- No build step means the files committed to the repo are exactly the files shipped in the extension zip.
- AMO can review source code directly without a separate source submission.
- JSDoc annotations provide type hints and editor autocompletion without a compiler.
- Removing TypeScript from the shipped path eliminates `tsc`, `ts-node`, and related packages from the supply-chain surface of the extension itself.

## Consequences

- TypeScript may be reconsidered for non-shipped tooling (scripts, tools) after an explicit architecture decision.
- All `.js` files under `apps/firefox-extension/` and `src/` use JSDoc `@param`, `@returns`, and `@typedef` for type documentation.
- The syntax checker (`scripts/check.sh`) validates JS syntax with `node --check` rather than `tsc`.
- No `tsconfig.json` is needed unless TypeScript is introduced for tooling in a future ADR.
