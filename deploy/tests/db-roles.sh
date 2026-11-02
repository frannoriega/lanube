#!/usr/bin/env bash
# Prueba de la separación de roles de Postgres (deploy/postgres/roles.sql) contra un Postgres
# descartable en Docker. No toca ningún servidor ni base real.
#
#   bash deploy/tests/db-roles.sh          # desde la raíz del repo; necesita docker y node (npm ci hecho)
#
# Qué comprueba:
#   1. roles.sql se aplica sobre una base vacía y sobre una ya migrada (idempotente);
#   2. las migraciones reales corren como lanube_owner, sin superusuario;
#   3. la app (lanube_app) SÍ puede lo que necesita: el seed completo y las funciones SQL de negocio;
#   4. la app NO puede: DDL, TRUNCATE, crear roles/extensiones, leer archivos, tocar migraciones;
#   5. una tabla nueva creada por el migrador le llega a la app sin otro paso;
#   6. los objetos a nombre del superusuario (importación/restauración) pasan a lanube_owner;
#   7. si faltan las contraseñas, el script falla antes de tocar nada.
set -uo pipefail
cd "$(dirname "$0")/../.."

NAME="lanube-roles-test-$$"
SU=lanube DB=lanube SUPW=su-test OWPW=owner-test-$$ APPW=app-test-$$
PASS=0 FAIL=0
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1; }
trap cleanup EXIT

ok()   { PASS=$((PASS+1)); printf '  ok    %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf '  FALLA %s\n' "$1"; }

# psql como un rol, por la IP del contenedor: la imagen oficial deja `trust` en 127.0.0.1 y en el
# socket, así que por ahí NO se probaría la contraseña; por la IP externa sí (scram-sha-256).
q() { local role=$1 pw=$2; shift 2
  docker exec -e PGPASSWORD="$pw" "$NAME" psql -h "$IP" -U "$role" -d "$DB" -At -v ON_ERROR_STOP=1 "$@" 2>&1; }
su() { q "$SU" "$SUPW" "$@"; }
app() { q lanube_app "$APPW" "$@"; }
owner() { q lanube_owner "$OWPW" "$@"; }

expect_ok()   { local d=$1; shift; if out=$("$@" 2>&1); then ok "$d"; else bad "$d  -> $out"; fi; }
expect_deny() { local d=$1; shift; out=$("$@" 2>&1) && bad "$d  (debía fallar y funcionó)" || {
  if grep -qiE "permission denied|must be (owner|superuser)|no existe permiso|permiso denegado|insufficient privilege|authentication failed" <<<"$out"; then ok "$d"
  else bad "$d  (falló, pero por otra razón: $out)"; fi; }; }
apply_roles() { docker exec -i "$NAME" sh -c 'psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f -' <deploy/postgres/roles.sql; }

echo "== Postgres descartable"
docker run -d --name "$NAME" -p 127.0.0.1::5432 -e POSTGRES_USER=$SU -e POSTGRES_PASSWORD=$SUPW -e POSTGRES_DB=$DB \
  -e LANUBE_OWNER_PASSWORD=$OWPW -e LANUBE_APP_PASSWORD=$APPW postgres:17-bookworm >/dev/null
for _ in $(seq 60); do docker exec "$NAME" pg_isready -U $SU -d $DB -h 127.0.0.1 >/dev/null 2>&1 && break; sleep 1; done
sleep 3   # el entrypoint reinicia el servidor una vez tras initdb
IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$NAME")
[ -n "$IP" ] || { echo "No pude obtener la IP del contenedor"; exit 1; }
PORT=$(docker port "$NAME" 5432/tcp | head -1 | sed 's/.*://')
for _ in $(seq 30); do su -c 'select 1' >/dev/null 2>&1 && break; sleep 1; done
URL() { echo "postgresql://$1:$2@127.0.0.1:$PORT/$DB?schema=public"; }

echo "== 7. Sin contraseñas, falla antes de tocar nada"
out=$(docker exec -i -e LANUBE_APP_PASSWORD= "$NAME" sh -c 'psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f -' <deploy/postgres/roles.sql 2>&1); rc=$?
[ $rc -ne 0 ] && grep -q "deben estar en postgres.env" <<<"$out" && ok "falta LANUBE_APP_PASSWORD -> error claro (rc=$rc)" || bad "no falló como debía: rc=$rc $out"
[ "$(su -c "select count(*) from pg_roles where rolname like 'lanube_%'")" = 0 ] && ok "no se creó ningún rol" || bad "se crearon roles pese al error"

echo "== 1. roles.sql sobre base vacía"
expect_ok "se aplica" apply_roles
echo "== 2. Migraciones reales como lanube_owner (sin superusuario)"
if out=$(DATABASE_URL=$(URL lanube_owner "$OWPW") npx prisma migrate deploy 2>&1); then ok "prisma migrate deploy como lanube_owner"; else bad "migrate deploy: $(tail -5 <<<"$out")"; fi
[ "$(su -c "select rolsuper from pg_roles where rolname='lanube_owner'")" = f ] && ok "lanube_owner no es superusuario" || bad "lanube_owner es superusuario"
n=$(su -c "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','S') and pg_get_userbyid(c.relowner)<>'lanube_owner'")
[ "$n" = 0 ] && ok "todas las tablas/secuencias son de lanube_owner" || bad "$n objetos con otro dueño"

echo "== 1b. Idempotencia (segunda aplicación sobre base migrada)"
expect_ok "se vuelve a aplicar sin errores" apply_roles

echo "== 3. La app puede lo que necesita"
if out=$(DATABASE_URL=$(URL lanube_app "$APPW") npx tsx prisma/seed.ts 2>&1); then ok "seed completo ejecutado como lanube_app (Prisma real, DML)"; else bad "seed como lanube_app: $(tail -8 <<<"$out")"; fi
[ "$(app -c 'select count(*) from registered_users')" -gt 0 ] 2>/dev/null && ok "la app lee lo que escribió" || bad "no hay usuarios tras el seed"
expect_ok "función de negocio: maintenance_status()" app -c 'select * from maintenance_status()'
expect_ok "función de negocio: reservation_occurrences()" app -c "select count(*) from reservation_occurrences(0, 4102444800000)"
expect_ok "advisory lock (inscripciones)" app -c "begin; select pg_advisory_xact_lock(hashtextextended('event-form:x',0)); commit;"
expect_ok "UPDATE y DELETE" app -c "update rate_limits set attempts = attempts where false; delete from rate_limits where false"

echo "== 4. La app NO puede"
expect_deny "CREATE TABLE"            app -c 'create table public.x(i int)'
expect_deny "DROP TABLE"              app -c 'drop table public.registered_users'
expect_deny "ALTER TABLE"             app -c 'alter table public.registered_users add column x int'
expect_deny "TRUNCATE"                app -c 'truncate public.registered_users cascade'
expect_deny "DROP SCHEMA"             app -c 'drop schema public cascade'
expect_deny "CREATE FUNCTION"         app -c 'create function public.f() returns int language sql as $$select 1$$'
expect_deny "CREATE TRIGGER"          app -c 'create trigger t before insert on public.rate_limits for each row execute function maintenance_now_ms()'
expect_deny "CREATE ROLE"             app -c 'create role pwn superuser'
expect_deny "ALTER ROLE propio -> superuser" app -c 'alter role lanube_app superuser'
expect_deny "CREATE EXTENSION"        app -c 'create extension if not exists pgcrypto'
expect_deny "COPY … PROGRAM"          app -c "copy (select 1) to program 'id'"
expect_deny "leer archivos del servidor" app -c "select pg_read_file('/etc/passwd')"
expect_deny "leer el historial de migraciones" app -c 'select * from _prisma_migrations'
expect_deny "borrar el historial de migraciones" app -c 'delete from _prisma_migrations'
expect_deny "desactivar triggers"     app -c 'alter table public.reservations disable trigger all'
expect_deny "SET ROLE al dueño"       app -c 'set role lanube_owner'
expect_deny "conectarse como superusuario sin su contraseña" q "$SU" "$APPW" -c 'select 1'
[ "$(app -c "select rolsuper or rolcreaterole or rolcreatedb or rolbypassrls or rolreplication from pg_roles where rolname='lanube_app'")" = f ] \
  && ok "lanube_app sin atributos peligrosos" || bad "lanube_app tiene atributos de más"

echo "== 5. Una tabla nueva del migrador le llega a la app (default privileges)"
expect_ok "owner crea tabla + secuencia" owner -c 'create table public.nueva(id serial primary key, v text); create function public.nf() returns int language sql as $$select 1$$'
expect_ok "app inserta en la tabla nueva y usa su secuencia" app -c "insert into public.nueva(v) values ('a'); select nf()"
expect_deny "…pero no puede borrar la tabla nueva" app -c 'drop table public.nueva'

echo "== 6. Objetos a nombre del superusuario (importación) pasan a lanube_owner"
su -c "create table public.legado(i int); create type public.estado as enum ('a'); create function public.fl() returns int language sql as \$\$select 1\$\$; create sequence public.sq;" >/dev/null
expect_ok "roles.sql tras la importación" apply_roles
[ "$(su -c "select count(*) from pg_class where relname in ('legado','sq') and pg_get_userbyid(relowner)='lanube_owner'")" = 2 ] && ok "tabla y secuencia reasignadas" || bad "tabla/secuencia siguen del superusuario"
[ "$(su -c "select pg_get_userbyid(typowner) from pg_type where typname='estado'")" = lanube_owner ] && ok "enum reasignado" || bad "enum sin reasignar"
[ "$(su -c "select pg_get_userbyid(proowner) from pg_proc where proname='fl'")" = lanube_owner ] && ok "función reasignada" || bad "función sin reasignar"
expect_ok "la app opera sobre el objeto reasignado" app -c 'insert into public.legado values (1)'
[ "$(su -c "select pg_get_userbyid(nspowner) from pg_namespace where nspname='public'")" = lanube_owner ] && ok "esquema public es de lanube_owner" || bad "esquema public sin reasignar"

echo "== 6b. DROP SCHEMA + CREATE SCHEMA como superusuario (lo que hace lanube-import-vercel) y luego migrar"
su -c 'drop schema public cascade; create schema public;' >/dev/null
expect_ok "roles.sql tras recrear el esquema" apply_roles
if out=$(DATABASE_URL=$(URL lanube_owner "$OWPW") npx prisma migrate deploy 2>&1); then ok "las migraciones corren sobre el esquema recreado"; else bad "migrate tras recrear: $(tail -5 <<<"$out")"; fi
expect_ok "la app tiene acceso a las tablas recreadas" app -c 'select count(*) from registered_users'

echo
echo "== Resultado: $PASS ok, $FAIL con falla"
[ "$FAIL" = 0 ]
