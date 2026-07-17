#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$REPO_ROOT/scripts/package-extension.sh" firefox-extension
