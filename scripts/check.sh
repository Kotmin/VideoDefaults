#!/usr/bin/env bash
set -euo pipefail

js_files=$(find src apps/firefox-extension/src -name '*.js' 2>/dev/null || true)
if [ -n "$js_files" ]; then
  echo "$js_files" | xargs -I{} node --check "{}"
fi
echo "syntax ok"

python3 - <<'PYEOF'
import json, sys
with open('apps/firefox-extension/manifest.json') as f:
    m = json.load(f)
required = ['manifest_version', 'name', 'version', 'permissions', 'content_scripts', 'action']
missing = [k for k in required if k not in m]
if missing:
    print('manifest missing fields:', missing, file=sys.stderr); sys.exit(1)
if m['manifest_version'] != 3:
    print('manifest_version must be 3', file=sys.stderr); sys.exit(1)
if not m.get('host_permissions'):
    print('manifest missing host_permissions', file=sys.stderr); sys.exit(1)
print('manifest ok')
PYEOF
