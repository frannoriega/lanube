#!/usr/bin/env bash
# Despliegue de una versión (milestone 26). Lo ejecuta `lanube-deploy` desde releases/<tag>/.
#
#   run.sh <tag> [--maintenance] [--rollback]
#
# Cada paso falla de forma segura: hasta el paso «migrar» la versión vieja sigue sirviendo y
# nada cambió. Si la versión nueva no levanta o no pasa el smoke test, vuelve sola a la anterior.
# Diseño y decisiones: docs/milestones/milestones-26-vps-deployment.md.
set -Eeuo pipefail

TAG="${1:?uso: run.sh <tag> [--maintenance] [--rollback]}"
shift
MAINTENANCE=0
ROLLBACK=0
for arg in "$@"; do
  case "$arg" in
    --maintenance) MAINTENANCE=1 ;;
    --rollback) ROLLBACK=1 ;;
    *) echo "run.sh: opción desconocida: $arg" >&2; exit 64 ;;
  esac
done

ROOT="${LANUBE_ROOT:-/opt/lanube}"
DATA="${LANUBE_DATA:-/srv/lanube}"
REL="$ROOT/releases/$TAG"
APP_IMAGE="${APP_IMAGE:-ghcr.io/frannoriega/lanube}"
MIGRATOR_IMAGE="${MIGRATOR_IMAGE:-ghcr.io/frannoriega/lanube-migrator}"
PORT="${APP_LOCAL_PORT:-3000}"
LOCAL="http://127.0.0.1:$PORT"
export LANUBE_ROOT="$ROOT" LANUBE_DATA="$DATA" APP_IMAGE MIGRATOR_IMAGE APP_LOCAL_PORT="$PORT"

mkdir -p "$ROOT/state" "$DATA/backups"
log() { printf '%s [deploy %s] %s\n' "$(date -u +%FT%TZ)" "${TAG:0:12}" "$*" | tee -a "$ROOT/deploys.log" >&2; }
die() { log "ERROR: $*"; exit 1; }

# Un solo deploy a la vez.
exec 9>"$ROOT/state/deploy.lock"
flock -n 9 || die "hay otro deploy en curso"

[ -f "$ROOT/.env" ] || die "falta $ROOT/.env"
# Lee UNA variable del .env sin ejecutarlo como shell (puede tener $ o espacios en valores).
env_get() {
  local v
  v="$(grep -E "^$1=" "$ROOT/.env" | tail -n1 | cut -d= -f2- || true)"
  v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
  printf '%s' "$v"
}
compose() {
  APP_TAG="${APP_TAG_OVERRIDE:-$TAG}" docker compose -p lanube \
    -f "$ROOT/compose.yml" --env-file "$ROOT/.env" "$@"
}
psql_exec() { compose exec -T postgres psql -U lanube -d lanube -tA "$@"; }

PREV="$(cat "$ROOT/state/current" 2>/dev/null || true)"
STARTED=$SECONDS
[ "$PREV" != "$TAG" ] || log "ya está desplegado $TAG; se vuelve a aplicar (idempotente)"

# --- 1. pre-vuelo ----------------------------------------------------------------------------
log "1/8 pre-vuelo"
avail_gb="$(df -BG --output=avail "$DATA" | tail -n1 | tr -dc '0-9')"
[ "${avail_gb:-0}" -ge 5 ] || die "poco disco libre en $DATA (${avail_gb:-?} GB; mínimo 5)"
if [ "${LANUBE_SKIP_WINDOW_CHECK:-0}" != 1 ]; then
  # El cron de reservas corre 05:00 UTC y es un requisito de correctitud: no se pisa.
  hhmm="$(date -u +%H%M)"
  if [ "$hhmm" -ge 0500 ] && [ "$hhmm" -lt 0510 ]; then
    die "ventana del cron de reservas (05:00–05:10 UTC): reintentá en unos minutos"
  fi
fi

# Infra de este release. Se valida el Caddyfile ANTES de instalarlo: uno roto dejaría al proxy
# en un bucle de reinicios (y al sitio inaccesible) aunque la app esté sana.
domain="$(env_get APP_DOMAIN)"
[ -n "$domain" ] || die "falta APP_DOMAIN en $ROOT/.env"
docker run --rm -e "APP_DOMAIN=$domain" -v "$REL/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2 \
  caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1 \
  || die "el Caddyfile de $TAG no es válido (docker run caddy:2 caddy validate)"
cp "$REL/compose.yml" "$ROOT/compose.yml"
cp "$REL/Caddyfile" "$ROOT/Caddyfile"

# --- 2. imágenes -----------------------------------------------------------------------------
if [ "${LANUBE_SKIP_PULL:-0}" = 1 ]; then
  log "2/8 imágenes: pull omitido (LANUBE_SKIP_PULL=1)"
else
  log "2/8 pull de $APP_IMAGE:$TAG"
  docker pull "$APP_IMAGE:$TAG" >/dev/null || die "no se pudo bajar la imagen de la app"
fi

# La base tiene que estar arriba para backup y migración (en el primer deploy, no lo está).
log "    base de datos arriba"
compose up -d --wait --quiet-pull postgres >/dev/null 2>&1 || die "Postgres no levantó"

# --- 3. backup previo ------------------------------------------------------------------------
if [ "$ROLLBACK" = 1 ]; then
  log "3/8 backup: omitido (rollback)"
elif [ -z "$PREV" ]; then
  log "3/8 backup: omitido (primer deploy)"
else
  dump="$DATA/backups/predeploy-$TAG.dump"
  log "3/8 backup previo → $dump"
  compose exec -T postgres pg_dump -U lanube -Fc lanube >"$dump.tmp" || { rm -f "$dump.tmp"; die "falló el backup previo"; }
  mv "$dump.tmp" "$dump"
  # Se conservan los 5 más recientes.
  ls -1t "$DATA"/backups/predeploy-*.dump 2>/dev/null | tail -n +6 | xargs -r rm -f || true
fi

# --- 3b. ventana de solo lectura (opcional) --------------------------------------------------
WINDOW_ID=""
if [ "$MAINTENANCE" = 1 ] && [ -n "$PREV" ]; then
  log "    declarando ventana de solo lectura (milestone 22)"
  WINDOW_ID="$(psql_exec -c "SELECT maintenance_start('Actualización de La Nube', 'Estamos actualizando el sitio. Podés navegar, pero por unos minutos no se pueden guardar cambios.', 'READ_ONLY', ARRAY['all'])")" \
    || die "no se pudo declarar la ventana de mantenimiento"
  sleep 17 # el portero cachea las ventanas ~15 s
fi

# --- 4. migrar -------------------------------------------------------------------------------
if [ "$ROLLBACK" = 1 ]; then
  log "4/8 migrar: omitido (rollback; el esquema es compatible hacia atrás)"
else
  log "4/8 migrar (prisma migrate deploy) con la versión anterior todavía viva"
  if ! compose run --rm migrate; then
    log "ERROR: falló la migración. La versión anterior (${PREV:-ninguna}) sigue sirviendo."
    log "       Revisá el estado: compose run --rm migrate npx prisma migrate status"
    log "       Si dejó el esquema a medias: restaurar $DATA/backups/predeploy-$TAG.dump."
    [ -z "$WINDOW_ID" ] || log "       La ventana de solo lectura $WINDOW_ID QUEDA ACTIVA (a propósito)."
    exit 1
  fi
fi

# --- 5. cambiar de versión -------------------------------------------------------------------
log "5/8 recreando la app → $TAG (Caddy retiene los pedidos)"
rollback_to_prev() {
  if [ -n "$PREV" ] && [ "$PREV" != "$TAG" ]; then
    log "    VOLVIENDO a $PREV"
    if APP_TAG_OVERRIDE="$PREV" compose up -d --wait --no-deps app >/dev/null 2>&1; then
      log "    rollback hecho: sirve $PREV"
    else
      log "    ¡el rollback también falló! intervención manual."
    fi
  else
    log "    no hay versión anterior a la que volver"
  fi
}
if ! compose up -d --wait --wait-timeout 120 --no-deps --quiet-pull app >/dev/null 2>&1; then
  log "ERROR: la app $TAG no quedó sana"
  compose logs --tail 40 app >&2 || true
  rollback_to_prev
  [ -z "$WINDOW_ID" ] || log "    La ventana $WINDOW_ID queda activa."
  exit 1
fi
compose up -d --no-deps --quiet-pull caddy >/dev/null 2>&1
# Si el Caddyfile cambió con el contenedor ya corriendo, se recarga sin cortar conexiones.
compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || true
sleep 3
if [ -z "$(compose ps --status running --services caddy 2>/dev/null)" ]; then
  compose logs --tail 20 caddy >&2 || true
  die "Caddy no está corriendo: el sitio NO es accesible desde afuera (la app $TAG sí está sana)"
fi

# --- 6. smoke test ---------------------------------------------------------------------------
log "6/8 smoke test"
smoke_ok=1
for path in / /api/maintenance /api/auth/session; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$LOCAL$path" 2>/dev/null || true)"
  code="${code:-000}"
  if [ "$code" != 200 ]; then log "    $path → $code (esperado 200)"; smoke_ok=0; fi
done
if [ "$smoke_ok" != 1 ]; then
  log "ERROR: falló el smoke test de $TAG"
  rollback_to_prev
  [ -z "$WINDOW_ID" ] || log "    La ventana $WINDOW_ID queda activa."
  exit 1
fi
if [ "${LANUBE_SKIP_PUBLIC_SMOKE:-0}" != 1 ]; then
  # Por Caddy, resolviendo el dominio a este mismo host (no depende del DNS ni de la IP pública).
  code="$(curl -sSk -o /dev/null -w '%{http_code}' --max-time 20 --resolve "$domain:443:127.0.0.1" "https://$domain/" 2>/dev/null || true)"
  code="${code:-000}"
  [ "$code" = 200 ] && log "    https://$domain/ → 200" || log "    aviso: https://$domain/ → $code (Caddy/TLS; no se revierte por esto)"
fi

# --- 7. calentar el caché público ------------------------------------------------------------
log "7/8 invalidando y calentando el sitio público"
secret="$(env_get CRON_SECRET)"
if [ -n "$secret" ]; then
  curl -fsS --max-time 30 -H "Authorization: Bearer $secret" "$LOCAL/api/cron/revalidate-public" >/dev/null \
    || log "    aviso: no se pudo invalidar el caché público (se corrige solo en ≤ 5 min)"
else
  log "    aviso: CRON_SECRET vacío; no se invalida el caché (el build trae datos de CI hasta 5 min)"
fi
for path in / /about /spaces /news /policies; do
  curl -fsS -o /dev/null --max-time 30 "$LOCAL$path" || log "    aviso: calentar $path falló"
done

# --- 8. registrar y limpiar ------------------------------------------------------------------
log "8/8 registrando"
if [ -n "$WINDOW_ID" ]; then
  psql_exec -c "SELECT maintenance_end('$WINDOW_ID')" >/dev/null && log "    ventana $WINDOW_ID finalizada"
fi
if [ "$ROLLBACK" = 1 ]; then
  # Intercambia: el que dejamos pasa a ser «anterior» (por si el rollback fue un error).
  [ -z "$PREV" ] || printf '%s' "$PREV" >"$ROOT/state/previous"
else
  [ -z "$PREV" ] || [ "$PREV" = "$TAG" ] || printf '%s' "$PREV" >"$ROOT/state/previous"
fi
printf '%s' "$TAG" >"$ROOT/state/current"
ln -sfn "releases/$TAG" "$ROOT/current"

# Limpieza (mejor esfuerzo: nada de esto puede hacer fallar un deploy ya sano).
set +e
# Imágenes: quedan las 3 más nuevas (más la actual y la anterior, que el rollback necesita local).
keep=" $TAG ${PREV:-} $(cat "$ROOT/state/previous" 2>/dev/null) "
for image in "$APP_IMAGE" "$MIGRATOR_IMAGE"; do
  for old in $(docker image ls "$image" --format '{{.Tag}}' | grep -v '<none>' | tail -n +4); do
    case "$keep" in *" $old "*) ;; *) docker rmi "$image:$old" >/dev/null 2>&1 ;; esac
  done
done
docker image prune -f >/dev/null 2>&1
# Releases: las 5 más recientes.
for old in $(ls -1t "$ROOT/releases" | tail -n +6); do
  case "$keep" in *" $old "*) ;; *) rm -rf "${ROOT:?}/releases/$old" ;; esac
done
set -e

log "LISTO: $TAG en $((SECONDS - STARTED)) s (anterior: ${PREV:-ninguna})"
