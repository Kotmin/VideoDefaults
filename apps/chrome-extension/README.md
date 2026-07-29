# chrome-extension

Chrome edition of VideoDefaults (Manifest V3). `src/`, `assets/`, and `lib/` are
generated from `apps/shared/` and `src/` by `scripts/sync-extension-lib.sh` —
only `manifest.json` is browser-specific.

Build: `bash scripts/package-extension.sh chrome-extension`
Load unpacked: run the sync script, then point `chrome://extensions` (Developer
mode → Load unpacked) at this directory.
