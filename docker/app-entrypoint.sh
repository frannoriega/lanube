#!/bin/sh
set -e
if [ -n "${FAKETIME:-}" ] && [ -f /etc/faketime-ldpreload.path ]; then
  export LD_PRELOAD="$(cat /etc/faketime-ldpreload.path)"
fi
# Named volume app_node_modules starts empty; npm run dev needs local .bin/next.
if [ ! -x node_modules/.bin/next ]; then
  echo "lanube-app: installing dependencies (npm ci) — empty or incomplete node_modules volume"
  npm ci
fi
exec "$@"
