#!/bin/sh
set -e
cd /app

STAMP=node_modules/.lanube-lock-sha
HASH=$(sha256sum package-lock.json | awk '{print $1}')

if [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$HASH" ]; then
  find node_modules -mindepth 1 -delete 2>/dev/null || true
  npm ci
  printf '%s' "$HASH" > "$STAMP"
fi

npx prisma migrate deploy
npx prisma db seed
