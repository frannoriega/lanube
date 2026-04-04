#!/bin/sh
set -e
if [ -n "${FAKETIME:-}" ] && [ -f /etc/faketime-ldpreload.path ]; then
  export LD_PRELOAD="$(cat /etc/faketime-ldpreload.path)"
fi
exec /usr/local/bin/docker-entrypoint-original.sh "$@"
