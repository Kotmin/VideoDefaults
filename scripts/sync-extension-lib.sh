#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
rm -rf "$REPO_ROOT/apps/firefox-extension/lib"
cp -r "$REPO_ROOT/src" "$REPO_ROOT/apps/firefox-extension/lib"
echo "lib synced"
