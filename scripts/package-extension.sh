#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${1:-firefox-extension}"
case "$APP" in
  firefox-extension|chrome-extension|edge-extension) ;;
  *) echo "usage: $0 [firefox-extension|chrome-extension|edge-extension]" >&2; exit 1 ;;
esac
bash "$REPO_ROOT/scripts/sync-extension-lib.sh"
python3 "$REPO_ROOT/tools/package-extension/package_extension.py" "$APP"
