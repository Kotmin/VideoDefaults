# Chrome Local Load — Test Before Store Upload

How to run VideoDefaults in Chrome locally, before any Chrome Web Store (CWS) upload. Two levels: fast iteration (unpacked source dir) and a true pre-upload check (the actual packaged `.zip`).

## 1. Fast Iteration — Load Unpacked from Source

1. `bash scripts/sync-extension-lib.sh` (materializes `apps/chrome-extension/{src,assets,lib}` from `apps/shared`, gitignored).
2. Chrome → `chrome://extensions`.
3. Enable **Developer mode** (top right toggle).
4. **Load unpacked** → select `apps/chrome-extension/`.
5. Confirm the extension appears with the VideoDefaults icon and no errors.

Re-run step 1 and click the refresh icon on the extension card after any source change.

## 2. Pre-Upload Check — Load the Actual Packaged Zip

This is what CWS will actually receive, so test this exact artifact before ever uploading it, not just the loose source dir from step 1:

```bash
bash scripts/package-extension.sh chrome-extension
```

This writes `dist/videodefaults-chrome-<version>.zip`. Chrome's "Load unpacked" only accepts a directory, not a `.zip`, so extract it to a scratch dir first:

```bash
rm -rf /tmp/vd-chrome-check && mkdir -p /tmp/vd-chrome-check
unzip dist/videodefaults-chrome-*.zip -d /tmp/vd-chrome-check
```

Then **Load unpacked** → select `/tmp/vd-chrome-check`. Run through `docs/release/firefox-manual-test-checklist.md`'s test cases (same behavior is expected across editions — Firefox is the source of truth per `apps/firefox-extension/manifest.json`).

## 3. Remove When Done

`chrome://extensions` → remove the card. Loaded-unpacked extensions don't auto-update and aren't visible to other Chrome profiles, so this is fully local and reversible.

## Related Documents

- `docs/release/cws-developer-setup.md` — one-time CWS API credential setup and what CI can automate once this local check passes.
- `docs/release/firefox-manual-test-checklist.md` — the test cases to run against the loaded extension.
