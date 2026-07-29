#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHARED="$REPO_ROOT/apps/shared"

for app in firefox-extension chrome-extension edge-extension; do
  APP_DIR="$REPO_ROOT/apps/$app"
  [ -d "$APP_DIR" ] || continue
  rm -rf "$APP_DIR/lib" "$APP_DIR/src" "$APP_DIR/assets"
  cp -r "$REPO_ROOT/src" "$APP_DIR/lib"
  cp -r "$SHARED/src" "$APP_DIR/src"
  cp -r "$SHARED/assets" "$APP_DIR/assets"
done
echo "apps synced"
