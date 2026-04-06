#!/bin/sh
set -e
if [ -n "${FAKETIME:-}" ] && [ -f /etc/faketime-ldpreload.path ]; then
  export LD_PRELOAD="$(cat /etc/faketime-ldpreload.path)"
fi
# Named volume app_node_modules persists across pulls; reinstall when lockfile changes
# (same stamp as migrate-entry.sh) or when tooling/deps are missing.
STAMP=node_modules/.lanube-lock-sha
HASH=$(sha256sum package-lock.json | awk '{print $1}')
if [ ! -x node_modules/.bin/next ] || [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$HASH" ]; then
  echo "lanube-app: npm ci (fresh volume, lockfile changed, or missing next)"
  npm ci
  printf '%s' "$HASH" > "$STAMP"
fi
exec "$@"
