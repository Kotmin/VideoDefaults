#!/usr/bin/env bash
set -euo pipefail

js_files=$(find src apps/shared/src -name '*.js' 2>/dev/null || true)
if [ -n "$js_files" ]; then
  echo "$js_files" | xargs -I{} node --check "{}"
fi
echo "syntax ok"

python3 - <<'PYEOF'
import json, sys
apps = ['firefox-extension', 'chrome-extension', 'edge-extension']
required = ['manifest_version', 'name', 'version', 'permissions', 'content_scripts', 'action']
versions = set()
for app in apps:
    path = f'apps/{app}/manifest.json'
    with open(path) as f:
        m = json.load(f)
    missing = [k for k in required if k not in m]
    if missing:
        print(f'{path} missing fields:', missing, file=sys.stderr); sys.exit(1)
    if m['manifest_version'] != 3:
        print(f'{path}: manifest_version must be 3', file=sys.stderr); sys.exit(1)
    if not m.get('host_permissions'):
        print(f'{path}: missing host_permissions', file=sys.stderr); sys.exit(1)
    versions.add(m['version'])
if len(versions) != 1:
    print('manifest versions out of sync:', sorted(versions), file=sys.stderr); sys.exit(1)
print('manifests ok')
PYEOF
