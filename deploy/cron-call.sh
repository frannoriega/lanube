#!/usr/bin/env bash
# Llama a una ruta de cron de la app (milestone 26). Lo ejecutan los timers de systemd
# (deploy/systemd/lanube-cron@.service) con el nombre del cron como argumento.
#
#   cron-call.sh maintain-reservations | report-snapshot | sync-holidays
#
# Si en /opt/lanube/.env hay HEALTHCHECK_URL_<NOMBRE> (healthchecks.io o similar), avisa el
# éxito o el fallo: un cron que falla en silencio es justo el modo de falla que importa acá
# (maintain-reservations es un requisito de correctitud).
set -Eeuo pipefail

name="${1:?uso: cron-call.sh <maintain-reservations|report-snapshot|sync-holidays>}"
case "$name" in
  maintain-reservations | report-snapshot | sync-holidays) ;;
  *) echo "cron desconocido: $name" >&2; exit 64 ;;
esac

ROOT="${LANUBE_ROOT:-/opt/lanube}"
PORT="${APP_LOCAL_PORT:-3000}"
env_get() {
  local v
  v="$(grep -E "^$1=" "$ROOT/.env" | tail -n1 | cut -d= -f2- || true)"
  v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
  printf '%s' "$v"
}

secret="$(env_get CRON_SECRET)"
[ -n "$secret" ] || { echo "CRON_SECRET vacío en $ROOT/.env" >&2; exit 1; }
hc_var="HEALTHCHECK_URL_$(printf '%s' "$name" | tr 'a-z-' 'A-Z_')"
hc_url="$(env_get "$hc_var")"
ping() { [ -z "$hc_url" ] || curl -fsS --max-time 10 -o /dev/null "$hc_url$1" || true; }

ping /start
if curl -fsS --max-time 300 -H "Authorization: Bearer $secret" \
  "http://127.0.0.1:$PORT/api/cron/$name"; then
  echo
  ping ""
else
  status=$?
  echo "cron $name falló (curl $status)" >&2
  ping /fail
  exit "$status"
fi
