#!/bin/sh
set -e

cd /app

# Run npm ci before applying faketime so TLS connections to the registry use the real clock.
STAMP=node_modules/.lanube-lock-sha
HASH=$(sha256sum package-lock.json | awk '{print $1}')

if [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$HASH" ]; then
  find node_modules -mindepth 1 -delete 2>/dev/null || true
  npm ci
  printf '%s' "$HASH" > "$STAMP"
fi

# Apply the fake clock when running under the timemock overlay.
# Dockerfile.app installs libfaketime and writes its path to /etc/faketime-ldpreload.path.
if [ -n "${FAKETIME:-}" ] && [ -f /etc/faketime-ldpreload.path ]; then
  export LD_PRELOAD="$(cat /etc/faketime-ldpreload.path)"
fi

npx prisma migrate deploy
npx prisma db seed
