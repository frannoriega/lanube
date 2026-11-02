-- Separación de roles de Postgres. Idempotente: se corre en cada deploy, siempre como el
-- superusuario del contenedor (POSTGRES_USER), vía `lanube-db-roles`.
--
--   superusuario (POSTGRES_USER)  solo administración: backups, restauración, este script.
--                                 NO está en ninguna variable de la app.
--   lanube_owner                  dueño del esquema y de los objetos; lo usa SOLO el migrador
--                                 (DDL: tablas, funciones, triggers). Sin superusuario.
--   lanube_app                    lo que usa la app en runtime: solo SELECT/INSERT/UPDATE/DELETE,
--                                 secuencias y funciones. No puede crear, borrar ni alterar nada.
--
-- Por qué importa: una vulnerabilidad en la app (inyección SQL, ejecución de código) dejaba de
-- tener el control total del servidor de base de datos: ya no puede DROP/ALTER/TRUNCATE, crear
-- roles ni extensiones, leer archivos del contenedor (COPY … PROGRAM) ni tocar el historial de
-- migraciones.
--
-- Las contraseñas se leen del ENTORNO del contenedor (postgres.env), no de la línea de comandos.

\set ON_ERROR_STOP on
\getenv owner_pw LANUBE_OWNER_PASSWORD
\getenv app_pw LANUBE_APP_PASSWORD

-- Falla fuerte (y antes de tocar nada) si faltan las contraseñas o son iguales.
SELECT (:'owner_pw' <> '' AND :'app_pw' <> '' AND :'owner_pw' <> :'app_pw'
        AND :'owner_pw' <> 'CAMBIAR' AND :'app_pw' <> 'CAMBIAR') AS pw_ok \gset
\if :pw_ok
\else
  \echo 'ERROR: LANUBE_OWNER_PASSWORD y LANUBE_APP_PASSWORD deben estar en postgres.env, ser distintas y no ser CAMBIAR'
  -- psql ignora el argumento de \quit: se aborta con un error para que el código de salida sea != 0
  SELECT 1/0 AS abortado;
\endif

SELECT current_database() AS db \gset

-- --- Roles (sin DO $$: psql no interpola variables dentro de bloques dollar-quoted) ----------
SELECT 'CREATE ROLE lanube_owner' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lanube_owner') \gexec
SELECT 'CREATE ROLE lanube_app'   WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lanube_app')   \gexec
ALTER ROLE lanube_owner WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'owner_pw';
ALTER ROLE lanube_app   WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'app_pw';
-- Un tope de conexiones evita que un bug de la app agote el servidor y deje afuera al migrador.
ALTER ROLE lanube_app   CONNECTION LIMIT 40;
ALTER ROLE lanube_owner CONNECTION LIMIT 5;

-- --- Base y esquema ------------------------------------------------------------------------------
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db" TO lanube_owner, lanube_app;
ALTER DATABASE :"db" OWNER TO lanube_owner;
ALTER SCHEMA public OWNER TO lanube_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO lanube_app;

-- --- Dueño de lo que ya existe -------------------------------------------------------------------
-- Una restauración (o la importación de Vercel, con --no-owner) deja los objetos a nombre del
-- superusuario. REASSIGN OWNED no sirve acá (el superusuario del contenedor es el del sistema),
-- así que se cambia objeto por objeto, solo los que no son ya de lanube_owner.
SELECT format('ALTER %s %I.%I OWNER TO lanube_owner',
         CASE c.relkind WHEN 'S' THEN 'SEQUENCE' WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW'
                        WHEN 'f' THEN 'FOREIGN TABLE' ELSE 'TABLE' END, n.nspname, c.relname)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','S','f')
   AND pg_get_userbyid(c.relowner) <> 'lanube_owner'
   -- las secuencias de columnas identity/serial cambian de dueño junto con su tabla
   AND NOT (c.relkind = 'S' AND EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype IN ('a','i'))) \gexec

SELECT format('ALTER %s %s OWNER TO lanube_owner',
         CASE p.prokind WHEN 'p' THEN 'PROCEDURE' WHEN 'a' THEN 'AGGREGATE' ELSE 'FUNCTION' END,
         p.oid::regprocedure)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND pg_get_userbyid(p.proowner) <> 'lanube_owner' \gexec

SELECT format('ALTER TYPE %I.%I OWNER TO lanube_owner', n.nspname, t.typname)
  FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
 WHERE n.nspname = 'public' AND t.typtype IN ('e','d','c')
   AND (t.typtype <> 'c' OR EXISTS (SELECT 1 FROM pg_class c WHERE c.oid = t.typrelid AND c.relkind = 'c'))
   AND pg_get_userbyid(t.typowner) <> 'lanube_owner' \gexec

-- --- Permisos de la app --------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM lanube_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM lanube_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO lanube_app;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO lanube_app;
GRANT EXECUTE                        ON ALL FUNCTIONS IN SCHEMA public TO lanube_app;
-- El historial de migraciones es solo del migrador: la app no lo lee ni lo escribe.
SELECT 'REVOKE ALL ON TABLE public._prisma_migrations FROM lanube_app'
 WHERE to_regclass('public._prisma_migrations') IS NOT NULL \gexec

-- Lo que cree el migrador de acá en adelante (tablas, secuencias, funciones nuevas) le llega a la
-- app sin tocar nada más. Se borran y se vuelven a poner para que sean idempotentes.
ALTER DEFAULT PRIVILEGES FOR ROLE lanube_owner IN SCHEMA public REVOKE ALL ON TABLES    FROM lanube_app;
ALTER DEFAULT PRIVILEGES FOR ROLE lanube_owner IN SCHEMA public REVOKE ALL ON SEQUENCES FROM lanube_app;
ALTER DEFAULT PRIVILEGES FOR ROLE lanube_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lanube_app;
ALTER DEFAULT PRIVILEGES FOR ROLE lanube_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO lanube_app;
-- (Las funciones nuevas ya son ejecutables por PUBLIC, que incluye a lanube_app.)

\echo 'Roles de Postgres aplicados: lanube_owner (migraciones) y lanube_app (runtime).'
