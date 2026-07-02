#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$REPO_ROOT/scripts/sync-extension-lib.sh"
python3 "$REPO_ROOT/tools/package-extension/package_firefox.py" "$@"
