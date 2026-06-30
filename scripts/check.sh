#!/usr/bin/env bash
set -euo pipefail
js_files=$(find src apps/firefox-extension/src -name '*.js' 2>/dev/null || true)
if [ -n "$js_files" ]; then
  echo "$js_files" | xargs -I{} node --check "{}"
fi
echo "syntax ok"
