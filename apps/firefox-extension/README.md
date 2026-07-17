# firefox-extension

Firefox Desktop WebExtension (Manifest V3). Applies default YouTube playback speed and exposes a popup GUI.

`src/`, `assets/`, and `lib/` are generated from `apps/shared/` and `src/` by
`scripts/sync-extension-lib.sh` — only `manifest.json` is browser-specific.

Build: `bash scripts/package-extension.sh firefox-extension`
