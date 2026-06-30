#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

LINK="$REPO_ROOT/apps/firefox-extension/lib"
TARGET="$REPO_ROOT/src"
if [ ! -L "$LINK" ]; then
  ln -sf "$TARGET" "$LINK"
  echo "created: $LINK → $TARGET"
else
  echo "exists:  $LINK"
fi

HOOKS_SRC="$REPO_ROOT/scripts/git-hooks"
HOOKS_DEST="$REPO_ROOT/.git/hooks"
installed=0
for hook in "$HOOKS_SRC"/*; do
  [ -f "$hook" ] || continue
  name="$(basename "$hook")"
  cp "$hook" "$HOOKS_DEST/$name" && chmod +x "$HOOKS_DEST/$name"
  echo "hook:    $name"
  installed=$((installed + 1))
done
echo "setup complete ($installed hooks installed)"
