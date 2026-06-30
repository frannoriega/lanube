#!/bin/sh
set -e
# Named volume app_node_modules persists across pulls; sync deps when the lockfile changes
# (same stamp as migrate-entry.sh) or when tooling/deps are missing.
#
# Use `npm install` (incremental), NOT `npm ci`: ci deletes node_modules and rebuilds all
# ~300 packages from scratch every time the lockfile hash changes. Adding a single dep then
# triggers a full reinstall in BOTH the app and migrate containers at once — a memory spike
# that OOM-kills the container (exit 137). The stamp is only written on success, so a kill
# mid-install re-triggers on restart under `restart: unless-stopped` → crash loop. `npm install`
# pulls only the delta and reconciles to the lockfile, so it stays cheap.
#
# Run install before applying faketime so TLS connections to the registry use the real clock.
# The `LD_PRELOAD=` prefix below also clears it for this command specifically, so npm never
# inherits the fake clock even if this block is ever reordered after the export. A fake past
# date makes Node reject still-valid registry certs with CERT_NOT_YET_VALID, which crash-loops
# the container under `restart: unless-stopped`.
STAMP=node_modules/.lanube-lock-sha
HASH=$(sha256sum package-lock.json | awk '{print $1}')
if [ ! -x node_modules/.bin/next ] || [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$HASH" ]; then
  echo "lanube-app: npm install (fresh volume, lockfile changed, or missing next)"
  LD_PRELOAD= npm install --no-audit --no-fund --prefer-offline
  printf '%s' "$HASH" > "$STAMP"
fi
if [ -n "${FAKETIME:-}" ] && [ -f /etc/faketime-ldpreload.path ]; then
  export LD_PRELOAD="$(cat /etc/faketime-ldpreload.path)"
fi
exec "$@"
