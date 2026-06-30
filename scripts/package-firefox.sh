#!/usr/bin/env bash
set -euo pipefail
python3 "$(cd "$(dirname "$0")/.." && pwd)/tools/package-extension/package_firefox.py" "$@"
