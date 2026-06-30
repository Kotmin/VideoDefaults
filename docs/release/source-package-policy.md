# Source Package Policy — VideoDefaults

## When AMO Requires Source Submission

Mozilla AMO requires a separate source code package when the submitted extension differs from the original source — i.e. when any of the following are used:

- Minification (uglify, terser, esbuild)
- Transpilation (TypeScript, Babel)
- Bundling (webpack, rollup, esbuild)
- Code generation or preprocessing

**VideoDefaults MVP does not use any of these.** The files inside the `.zip` artifact are identical to the files in `apps/firefox-extension/` (plus shared modules copied from `src/` during packaging). No transformation occurs.

## Current Status: No Source Package Required

The packager (`tools/package-extension/package_firefox.py`) performs a straight file copy into a zip archive. AMO reviewers can inspect the submitted `.zip` and match it directly to `apps/firefox-extension/` in the repository.

## If Minification Is Introduced in the Future

If a future milestone introduces a build step that transforms source files, the following must happen before the next AMO submission:

1. Open an ADR documenting the build tool and the supply-chain justification.
2. Update `tools/package-extension/package_firefox.py` to produce both the extension zip and a separate source zip.
3. Add a `scripts/package-source.sh` wrapper.
4. Update `ci-dev.yml` to upload both artifacts.
5. Update this document with the new source submission procedure.

## Procedure for Preparing a Source Package (Future)

```bash
# Build extension artifact
bash scripts/package-firefox.sh

# Build source artifact (exclude node_modules, dist, hidden files)
python3 tools/package-extension/package_source.py
```

The source zip must include everything needed to reproduce the extension artifact from a clean checkout, including `package.json`, `package-lock.json`, and any build scripts.

## References

- AMO source code submission policy: https://extensionworkshop.com/documentation/publish/source-code-submission/
