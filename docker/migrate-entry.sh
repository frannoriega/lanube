#!/bin/sh
set -e

cd /app

# Use `npm install` (incremental), NOT `npm ci` + a node_modules wipe: that rebuilt all deps
# from scratch on every lockfile change, in parallel with the app container doing the same —
# a combined memory spike that OOM-kills containers (exit 137). See app-entrypoint.sh.
#
# Run install before applying faketime so TLS connections to the registry use the real clock.
# The `LD_PRELOAD=` prefix below also clears it for this command specifically, so npm never
# inherits the fake clock even if this block is ever reordered after the export. A fake past
# date makes Node reject still-valid registry certs with CERT_NOT_YET_VALID.
STAMP=node_modules/.lanube-lock-sha
HASH=$(sha256sum package-lock.json | awk '{print $1}')

if [ ! -x node_modules/.bin/prisma ] || [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$HASH" ]; then
  LD_PRELOAD= npm install --no-audit --no-fund --prefer-offline
  printf '%s' "$HASH" > "$STAMP"
fi

# Apply the fake clock when running under the timemock overlay.
# Dockerfile.app installs libfaketime and writes its path to /etc/faketime-ldpreload.path.
if [ -n "${FAKETIME:-}" ] && [ -f /etc/faketime-ldpreload.path ]; then
  export LD_PRELOAD="$(cat /etc/faketime-ldpreload.path)"
fi

npx prisma migrate deploy
npx prisma db seed
