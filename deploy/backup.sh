#!/usr/bin/env bash
# Backup diario de la base (milestone 26). Lo ejecuta lanube-backup.timer.
#
#  1. pg_dump -Fc → $DATA/backups/daily-<fecha>.dump  (14 diarios) y semanal los domingos (8).
#  2. Copia FUERA del servidor con restic, si hay RESTIC_REPOSITORY en .env. Un backup que vive
#     solo en el mismo disco no es un backup.
#  3. Latido a HEALTHCHECK_URL_BACKUP si está configurado.
#
# Restaurar (en una base descartable, para probar; hacerlo antes del cutover y cada trimestre):
#   docker compose -p lanube -f /opt/lanube/compose.yml --env-file /opt/lanube/.env exec -T postgres \
#     pg_restore -U lanube -d lanube_restore --no-owner < /srv/lanube/backups/daily-AAAAMMDD.dump
set -Eeuo pipefail

ROOT="${LANUBE_ROOT:-/opt/lanube}"
DATA="${LANUBE_DATA:-/srv/lanube}"
env_get() {
  local v
  v="$(grep -E "^$1=" "$ROOT/.env" | tail -n1 | cut -d= -f2- || true)"
  v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
  printf '%s' "$v"
}
hc_url="$(env_get HEALTHCHECK_URL_BACKUP)"
ping() { [ -z "$hc_url" ] || curl -fsS --max-time 10 -o /dev/null "$hc_url$1" || true; }
trap 'ping /fail' ERR

ping /start
mkdir -p "$DATA/backups"
stamp="$(date -u +%Y%m%d)"
dump="$DATA/backups/daily-$stamp.dump"

docker compose -p lanube -f "$ROOT/compose.yml" --env-file "$ROOT/.env" \
  exec -T postgres pg_dump -U lanube -Fc lanube >"$dump.tmp"
# Un dump vacío o truncado no es un backup.
[ "$(wc -c <"$dump.tmp")" -gt 1024 ] || { rm -f "$dump.tmp"; echo "dump sospechosamente chico" >&2; exit 1; }
mv "$dump.tmp" "$dump"
[ "$(date -u +%u)" != 7 ] || cp "$dump" "$DATA/backups/weekly-$stamp.dump"

ls -1t "$DATA"/backups/daily-*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f || true
ls -1t "$DATA"/backups/weekly-*.dump 2>/dev/null | tail -n +9 | xargs -r rm -f || true

repo="$(env_get RESTIC_REPOSITORY)"
if [ -n "$repo" ]; then
  export RESTIC_REPOSITORY="$repo"
  export RESTIC_PASSWORD="$(env_get RESTIC_PASSWORD)"
  export AWS_ACCESS_KEY_ID="$(env_get AWS_ACCESS_KEY_ID)"
  export AWS_SECRET_ACCESS_KEY="$(env_get AWS_SECRET_ACCESS_KEY)"
  restic backup --tag lanube "$DATA/backups" ${LANUBE_BACKUP_EXTRA:+$LANUBE_BACKUP_EXTRA}
  restic forget --tag lanube --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune
else
  echo "aviso: RESTIC_REPOSITORY no está configurado; el backup NO sale del servidor" >&2
fi
ping ""
