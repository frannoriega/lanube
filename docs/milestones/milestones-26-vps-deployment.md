# Milestone 26 — Despliegue en un VPS (Ubuntu Server 26.04 LTS)

> **Estado (2026-10-08): Fase 0 implementada y ensayada en local; falta el servidor real.**
> Nació de la decisión de salir de Vercel. Este documento fija el diseño del servidor y, sobre
> todo, **cómo se despliega y se vuelve a desplegar**. Guía operativa: [`deploy/README.md`](../../deploy/README.md).
> Lo que se verificó (y lo que no) está en el §13. El procedimiento de la _primera_ migración de datos (snapshot, solo lectura, DNS)
> ya existe en [`milestones-22-maintenance-mode.md`](./milestones-22-maintenance-mode.md)
> («Runbook: migrar al VPS»); acá se referencia, no se repite.

## 1. Objetivo y alcance

- Una sola máquina (2 vCPU, 4 GB de RAM, 60–80 GB de SSD, 2 GB de swap; el dimensionamiento sale de
  la estimación del 2026-10-07) corre **todo**: la app, PostgreSQL 17 y el proxy con TLS.
- Un despliegue es **un comando (o un push a `main`)**, repetible, con **backup previo**,
  **migraciones aplicadas antes de cambiar de versión**, **verificación** y **vuelta atrás
  automática** si la versión nueva no levanta.
- Fuera de alcance: alta disponibilidad (más de una instancia), entorno de staging en el mismo
  VPS (costaría ~1 GB de los 4), colas/workers (sigue el `TODO(scale)` de los correos).

## 2. Decisiones de diseño

| Tema                 | Elección                                                                                                                                                                            | Alternativa descartada y por qué                                                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orquestación         | **Docker Compose** + un script `deploy.sh`                                                                                                                                          | Coolify/Dokploy: la UI es cómoda pero consume ~1 GB de los 4 y es otra pieza que mantener para una sola app. Kamal: razonable, pero Compose ya es lo que usa `docker/` y alcanza. Kubernetes: desproporcionado.                         |
| Proxy / TLS          | **Caddy** (contenedor)                                                                                                                                                              | nginx + certbot: más piezas. Caddy renueva certificados solo y su sintaxis para pisar headers es una línea (ver §4.4, es crítico).                                                                                                      |
| Base de datos        | **`postgres:17` en contenedor**, volumen nombrado, sin puerto publicado                                                                                                             | PostgreSQL del apt de Ubuntu: la versión de la distro no es la 17 que usa el proyecto (hay que pinear PGDG igual). El contenedor fija versión y se parece a lo que ya corre en desarrollo.                                              |
| Build                | **En CI (GitHub Actions)**, imagen a **GHCR**; el VPS solo hace `pull`                                                                                                              | Compilar en el VPS: `next build` pica en 2–4 GB y competiría con la base en vivo (riesgo de que el OOM-killer mate Postgres).                                                                                                           |
| Artefacto            | Imagen con `output: "standalone"`, dos targets: `runner` y `migrator`. **El migrador también lleva `/ops`** (compose, Caddyfile y scripts de ese commit) y de ahí los saca el VPS   | Una sola imagen con todo `node_modules`: ~1 GB más por cada pull y por cada rollback. Copiar los archivos de operación por `scp` o `git pull` en el servidor: otra credencial, y la infraestructura podría no corresponder a la imagen. |
| Disparador           | Push a `main` **firmado** (el repo exige PR; el job `signed` lo re-verifica con la API de GitHub) → CI → SSH al VPS                                                                 | `git pull` + build en el servidor: no reproducible. Pull-based (timer que mira GHCR): sin puertos entrantes, pero más lento y más difícil de seguir; queda como alternativa si el SSH desde GitHub molesta.                             |
| Cron                 | **Timers de systemd** que llaman a las rutas `/api/cron/*` con `Bearer $CRON_SECRET`                                                                                                | Un cron dentro del contenedor: mezcla procesos. El cron de Vercel desaparece con Vercel.                                                                                                                                                |
| Downtime en redeploy | **Recrear el contenedor** (~10 s) y que Caddy **retenga** los pedidos (`lb_try_duration`). Medido en el ensayo: 119 pedidos durante un redeploy completo, todos 200, el peor 1,35 s | Blue/green: duplica ~800 MB de Node unos segundos, y los cachés por instancia (ISR, rol, `unstable_cache`) hacen que dos instancias vivas a la vez sean más sutiles de lo que parece. Es una mejora posible, no un requisito.           |

## 3. Arquitectura en el servidor

```
Internet ──443/80──▶ Caddy ──(red interna)──▶ app (Next standalone, :3000)
                       │                          │
                       │                          └──▶ postgres:17 (sin puerto publicado)
                       └─ certificados en volumen

host:  127.0.0.1:3000 ──▶ app   (solo para timers de cron, smoke tests y deploy.sh)
host:  systemd timers: cron-maintain, cron-report, cron-holidays, backup-db
```

Directorios (propiedad del usuario `deploy`, salvo que se indique):

```
/opt/lanube/
  compose.yml            # docker/docker-compose.prod.yml, copiado por el deploy
  Caddyfile
  .env                   # chmod 600 — secretos de producción (NO en git)
  bin/deploy.sh  bin/rollback.sh  bin/backup.sh  bin/cron-call.sh
  state/current  state/previous   # tags desplegados (para el rollback)
/srv/lanube/
  pgdata/                # volumen de Postgres
  backups/               # dumps locales (predeploy-<tag>.dump, daily-<fecha>.dump)
  uploads/               # solo si se autoaloja el almacenamiento (ver §10, decisión 3)
```

## 4. Hallazgos del repo que condicionan el diseño

Cosas que **no** son obvias y que, si se ignoran, rompen producción. Cada una tiene su paso en el
plan.

1. **No hay Dockerfile de producción.** `docker/Dockerfile.app` es de desarrollo (monta el repo,
   `npm run dev`, instala `faketime`). Hay que escribir `docker/Dockerfile.prod` y
   `docker/docker-compose.prod.yml`. `next.config.ts` no tiene `output: "standalone"`: hay que
   agregarlo. `outputFileTracingIncludes` (los `.mdx` de `/policies/accept`) sigue valiendo en
   standalone, pero hay que **verificar a mano** que la pantalla «Ver qué cambió» funciona en la
   imagen: es exactamente el tipo de fallo que `next build` no detecta.
2. **El build necesita una base.** `npm run build` corre `prisma migrate deploy` y, desde el
   milestone 25 (P2), `/`, `/about`, `/spaces` y las políticas se **prerenderizan leyendo la
   base**. En CI eso se resuelve con un Postgres efímero (servicio del job): migrar + sembrar +
   `next build:next`. Consecuencia: las páginas estáticas salen del build con **datos de CI**, no
   los de producción. Por eso el deploy termina con un paso de **calentamiento** (§6, paso 7) que
   invalida los tags públicos. Sin él, el primer visitante tras cada deploy puede ver contenido
   de prueba hasta que expire el `revalidate = 300`.
3. **El seed nunca corre en producción.** `docker/migrate-entry.sh` hace `prisma db seed`, que
   crea 40 usuarios con la contraseña `123123123`. En producción el job de migración corre **solo**
   `prisma migrate deploy`. Los roles del sistema no dependen del seed: los siembra la migración
   `20260924000000_dynamic_roles`.
4. **Los headers de IP los tiene que pisar el proxy.** `getClientIp()` confía en `X-Real-IP` y
   después en el primer valor de `X-Forwarded-For`; en Vercel los reescribe la plataforma. Si
   Caddy los deja pasar tal cual, **todo rate limit** (ingreso, registro, reseteo, subidas) queda
   evadible. Caddyfile obligatorio:

   ```caddy
   lanube.example {
     encode zstd gzip
     reverse_proxy app:3000 {
       header_up X-Real-IP {remote_host}
       header_up X-Forwarded-For {remote_host}     # reemplaza, no agrega
       lb_try_duration 30s                         # retiene pedidos durante el redeploy
       lb_try_interval 500ms
       health_uri /api/maintenance
     }
   }
   ```

   Si más adelante se pone Cloudflare adelante: `TRUST_CF_CONNECTING_IP=true` **y** restringir
   el origen a las IPs de Cloudflare; si no, ese header lo controla el atacante.

5. **NextAuth v5 detrás de un proxy necesita `AUTH_TRUST_HOST=true`.** `src/lib/auth.ts` no
   define `trustHost`, y fuera de Vercel NextAuth rechaza el host con `UntrustedHost`. Es una
   variable de entorno, no código; verificarlo en el ensayo (§9).
6. **Variables que hay que fijar (y por qué):** `DATABASE_URL` (host `postgres` de la red
   interna), `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `CRON_SECRET`, claves reales de Turnstile
   (**agregar el dominio nuevo a la allowlist del widget**), `SMTP_SERVER_*` (sin SMTP no hay
   registro ni reseteo: `assertMailerAvailable()` responde 503), `MAINTENANCE_PROBE_ORIGIN=
http://127.0.0.1:3000` (sin eso el middleware consulta al `Host` del pedido), `STORAGE_*`,
   `NODE_ENV=production`, `HOSTNAME=0.0.0.0`.
   - **Reusar `NEXTAUTH_SECRET` de Vercel**: mantiene vivas las sesiones (JWT) y los
     descriptores de archivos firmados con HMAC (`signUploadedFile`). Cambiarlo cierra todas las
     sesiones.
   - **El dominio no debería cambiar.** Una passkey queda atada a su `rpID` (el dominio): si el
     dominio cambia, todas las passkeys dejan de servir (y los usuarios que solo tengan passkey
     dependen de contraseña/códigos de recuperación). Con el mismo dominio no hay que tocar
     `WEBAUTHN_*` ni `OAUTH_ISSUER`; el conector MCP conserva sus grants.
7. **El almacenamiento `local` no sirve tal cual.** Escribe en `public/uploads`, y un servidor
   Next de producción **no sirve archivos agregados a `public/` después del arranque**. Ver
   decisión 3 (§10): la ruta de menor riesgo es seguir con Vercel Blob en esta etapa.
   - **Hallazgo del ensayo de código:** `storageEnvRoot()` derivaba el prefijo de las claves
     (`prod/`, `preview/`, `dev/`) de `VERCEL_ENV`, que fuera de Vercel no existe: todo habría
     caído en `dev/…` y el proxy de admin habría **rechazado los archivos de participantes ya
     guardados en `prod/…`** (exige el prefijo de su entorno, milestone 25 S2). Se agregó
     `STORAGE_ENV_ROOT` (gana sobre `VERCEL_ENV`; solo acepta un segmento seguro; con test). En
     el VPS: `STORAGE_ENV_ROOT=prod`.
8. **El cron de Vercel desaparece**, y `maintain-reservations` es un requisito de correctitud
   (si falla, las recurrentes dejan de materializarse hacia adelante). Va a timers con
   `Persistent=true` y aviso si no corre (§7).
9. **`sharp`** (optimización de `next/image`) trae binarios nativos. El build en el runner y la
   imagen deben coincidir en **arquitectura** (x86_64 vs ARM) y en glibc: base `node:24-bookworm-slim`
   y verificar que una imagen de `/_next/image` responde.
10. **Una sola instancia.** `unstable_cache`/ISR viven en disco y memoria locales, y
    `revalidatePublic()` solo invalida la instancia que atiende el pedido. Dos instancias
    necesitarían un `cacheHandler` compartido. Es una restricción de este plan, no un descuido.

## 5. Cambios de código y de repo (Fase 0) — **hecho**

Lo que realmente quedó (difiere en detalles del primer borrador; los desvíos se explican abajo).

| Archivo                                                                   | Qué                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next.config.ts`                                                          | `output: "standalone"` **solo si `NEXT_OUTPUT=standalone`**: opt-in para no tocar el build de Vercel ni `npm start` mientras los dos destinos convivan.                                                                                                                                                                                                               |
| `src/lib/storage/types.ts`                                                | `STORAGE_ENV_ROOT` (ver §4.7), con `env-root.test.ts`.                                                                                                                                                                                                                                                                                                                |
| `.dockerignore`                                                           | Reescrito: deja pasar solo `.next/standalone` y `.next/static`; excluye `.env*`, `docs`, `graphify-out`, `logos*`.                                                                                                                                                                                                                                                    |
| `docker/Dockerfile.prod`                                                  | `runner`: `node:24-bookworm-slim` (562 MB sin comprimir), usuario no-root, `HEALTHCHECK` contra `/api/maintenance`. `migrator`: **solo `prisma` y `dotenv`** con la versión exacta del lockfile (no un `npm ci` completo; 695 MB sin comprimir, la mayoría es la base de Node) + `prisma/` + `prisma.config.ts` + `/ops`. No compila: empaqueta lo que ya compiló CI. |
| `docker/docker-compose.prod.yml`                                          | Servicios `app`, `postgres`, `caddy`, `migrate` (perfil `tools`, `restart: "no"`). Ver §5.1.                                                                                                                                                                                                                                                                          |
| `docker/Caddyfile`                                                        | El de §4.4, con el dominio de `.env`.                                                                                                                                                                                                                                                                                                                                 |
| `deploy/bootstrap/lanube-deploy`                                          | Launcher (se instala una vez): valida el tag, extrae `/ops` de la imagen y ejecuta su `run.sh`. Es lo único que la llave de CI puede ejecutar. `--rollback` vuelve al tag anterior.                                                                                                                                                                                   |
| `deploy/run.sh`, `cron-call.sh`, `backup.sh`, `provision.sh`, `README.md` | Ver §6–§7. `provision.sh` deja un Ubuntu limpio listo (idempotente; SSH endurecido solo con `HARDEN_SSH=1`).                                                                                                                                                                                                                                                          |
| `deploy/systemd/`                                                         | Template `lanube-cron@.service`, tres timers de cron, y el servicio + timer de backup.                                                                                                                                                                                                                                                                                |
| `src/app/api/cron/revalidate-public/route.ts`                             | `GET` con `Bearer CRON_SECRET` que llama `revalidatePublic()` para **todos** los `PUBLIC_TAGS`. Vive bajo `/api/cron` para quedar exento del portero de solo lectura (`READ_ONLY_EXEMPT_PREFIXES`) y heredar el patrón de auth de los otros crons. Con test (503 sin secreto, 401 con otro, 200 invalida todo).                                                       |
| `.github/workflows/deploy.yml`                                            | Ver §8.                                                                                                                                                                                                                                                                                                                                                               |
| `env.example`                                                             | Sección «Producción en VPS» con las variables de §4.6.                                                                                                                                                                                                                                                                                                                |
| `CLAUDE.md` («Environment & Deploy», §4 Cron) y `README.md`               | «Vercel o VPS», con enlace a este doc y a `deploy/README.md`.                                                                                                                                                                                                                                                                                                         |

### 5.1 Límites de recursos en el compose

Para que un pico no lleve al OOM-killer a matar la base:

- `app`: `mem_limit: 1536m`, `NODE_OPTIONS=--max-old-space-size=1024`, `init: true`,
  `stop_grace_period: 30s`, `restart: unless-stopped`, `healthcheck` contra `/api/maintenance`
  (200 ⇒ app **y** base responden), publicado solo en `127.0.0.1:3000`.
- `postgres`: `mem_limit: 1g`, `oom_score_adj: -500`, sin puerto publicado, parámetros para
  4 GB compartidos: `shared_buffers=256MB`, `effective_cache_size=1GB`, `work_mem=8MB`,
  `maintenance_work_mem=128MB`, `max_connections=50`. El `pg.Pool` de la app, a ≤ 15 conexiones.
- `caddy`: sin límite (usa ~30 MB). Logs de todos los contenedores con rotación
  (`json-file`, `max-size: 10m`, `max-file: 5`).

## 6. El despliegue, paso a paso (`lanube-deploy <sha>` → `run.sh`)

Corre en el VPS como `deploy`. Se serializa con `flock` (dos deploys a la vez no existen).
**Cada paso falla de forma segura**: hasta el paso 4 la versión vieja sigue sirviendo y nada
cambió.

1. **Pre-vuelo.** Disco libre > 5 GB, no estamos dentro de la ventana de crons (05:00–05:10
   UTC) ni hay otro deploy (`flock`). Se **valida el Caddyfile** del release
   (`caddy validate`) antes de instalarlo: el ensayo encontró que uno roto deja a Caddy en un
   bucle de reinicios con el sitio inaccesible y la app sana.
2. **Pull.** `docker pull` de `lanube:<sha>` (runner) y `lanube-migrator:<sha>`. Si falla, se
   aborta sin tocar nada.
3. **Backup previo.** `pg_dump -Fc` a `/srv/lanube/backups/predeploy-<sha>.dump` (se conservan
   los últimos 5). Es lo que permite revertir una migración mala; barato porque la base es chica.
4. **Migrar.** `docker compose run --rm migrate` (`prisma migrate deploy`). Corre **mientras la
   app vieja sigue viva**, así que la migración tiene que ser compatible con ella (regla de §8.1).
   Si falla: abortar, la app vieja no se tocó; ver «migración fallida» en §8.2.
5. **Cambiar de versión.** `APP_TAG=<sha> docker compose up -d --wait app`. Compose recrea el
   contenedor y espera el healthcheck; Caddy retiene los pedidos esos ~10–20 s.
6. **Humo.** Desde el host: `GET 127.0.0.1:3000/`, `/api/maintenance` y `/api/auth/session` → 200. Si algo no da, **auto-rollback** (§8.2) y salir con error. Después se comprueba que
   **Caddy esté corriendo** (si no, el deploy falla sin revertir la app: el problema es el proxy)
   y se mira `https://<dominio>/` por Caddy (solo aviso: depende del DNS/TLS).
7. **Calentar.** `GET /api/cron/revalidate-public` con el `Bearer`, y luego `GET /`, `/about`,
   `/spaces`, `/news` y `/policies` para que el HTML con datos reales quede generado antes de que
   llegue un visitante. (`/events` no existe como página: solo `/events/[id]`.)
8. **Registrar y limpiar.** `state/current = <sha>`; se anota la línea en
   `/opt/lanube/deploys.log` (fecha, sha, duración, resultado); `docker image prune` dejando las
   últimas 3 imágenes (el rollback necesita la anterior **local**).

**Deploys con una migración «riesgosa»** (cambia el significado de datos, reescribe una tabla
grande, reemplaza una función SQL de reservas): antes del paso 4, declarar una ventana
`READ_ONLY` con `maintenance_start(...)` (milestone 22; vale ~15 s en el portero) y finalizarla
con `maintenance_end_all()` tras el humo. `deploy.sh --maintenance "motivo"` lo hace. No
reemplaza la regla de compatibilidad: la complementa.

## 7. Operación continua

### 7.1 Cron (systemd timers)

`cron-call.sh <ruta>` hace `curl -fsS --max-time 120 -H "Authorization: Bearer $CRON_SECRET"
http://127.0.0.1:3000<ruta>` y, si hay `HEALTHCHECK_URL_<nombre>`, avisa a un monitor de latido.

| Timer                          | `OnCalendar` (UTC)    | Ruta                              |
| ------------------------------ | --------------------- | --------------------------------- |
| `lanube-maintain-reservations` | `*-*-* 05:00:00 UTC`  | `/api/cron/maintain-reservations` |
| `lanube-report-snapshot`       | `*-*-01 06:00:00 UTC` | `/api/cron/report-snapshot`       |
| `lanube-sync-holidays`         | `*-*-01 07:00:00 UTC` | `/api/cron/sync-holidays`         |

Todos con `Persistent=true`: si el VPS estaba apagado a esa hora, corren al volver. Los tres son
idempotentes (y el de reservas se saltea solo durante una ventana de solo lectura global, §17 de
`CLAUDE.md`). **El latido es obligatorio para `maintain-reservations`**: un cron que falla en
silencio es justo el modo de falla que describe `CLAUDE.md`.

### 7.2 Backups

- `backup.sh` (timer diario 03:30 AR = 06:30 UTC): `pg_dump -Fc`, 14 diarios + 8 semanales
  locales, y **copia fuera del servidor** (`restic` o `rclone` a un bucket S3-compatible, cifrado).
  Un backup que vive solo en el mismo disco no es un backup.
- Objetivo: RPO ≤ 24 h (≤ 6 h si se agrega un timer cada 6 h; la base es chica). PITR con WAL
  queda descartado por ahora: complejidad desproporcionada para este volumen.
- **Un backup no probado no cuenta**: restaurar en una base descartable una vez antes del
  cutover y una vez por trimestre (`pg_restore` + `SELECT count(*)` de usuarios, reservas,
  `audit_logs` y `policy_acceptances`: estas dos últimas son evidencia append-only).

### 7.3 Monitoreo

- Chequeo externo (UptimeRobot / Better Stack) a `https://<dominio>/api/maintenance` cada 1–5
  min, con aviso por mail/Telegram.
- Latidos de cron y backup (healthchecks.io o equivalente).
- Alertas de disco (> 80 %) y de memoria; `docker stats` a mano para el primer mes.
- Logs: `docker compose logs` con rotación; los errores de la app salen por `logger` (sin
  secretos, por la convención del repo). Sin stack de logs aparte.

### 7.4 Sistema operativo

- Usuario `deploy` sin root; SSH solo con llave (sin password, sin login de root); `ufw` con
  22/80/443; `fail2ban` para sshd; la llave que usa GitHub Actions lleva
  `command="/opt/lanube/bin/deploy.sh $SSH_ORIGINAL_COMMAND",restrict` en `authorized_keys`: lo
  único que puede hacer es desplegar.
- `unattended-upgrades` activo, con reinicio automático **fuera** de la ventana de crons
  (p. ej. 07:30 UTC); los contenedores vuelven solos (`restart: unless-stopped`).
- Zona horaria **UTC**, reloj sincronizado (el RRULE se expande en SQL con `now()` de Postgres;
  un reloj corrido movería reservas). 2 GB de swap, `vm.swappiness=10`.
- Docker: instalar desde el repositorio oficial de Docker **verificando que ya soporte la
  26.04** al momento de instalar; si no, usar el paquete `docker.io` de Ubuntu. No dar por
  hecho: comprobarlo en el servidor.

## 8. Versiones nuevas: cómo cambiar sin romper

### 8.1 Regla de compatibilidad de migraciones (expand / contract)

El rollback es **solo de imagen** (la base no se des-migra). Entonces una migración publicada en
la versión N **tiene que funcionar con el código de la N-1**, porque (a) corre con la N-1 viva
(paso 4) y (b) volver atrás deja a la N-1 sobre el esquema nuevo.

- Permitido en un solo release: agregar tablas/columnas **nulas o con default**, índices,
  funciones SQL **nuevas**, relajar un `NOT NULL`.
- En **dos** releases (primero expandir, después limpiar): borrar o renombrar una columna/tabla,
  agregar un `NOT NULL` sin default, cambiar el tipo, **cambiar la firma o el resultado de una
  función SQL** que usa el código (`create_reservation`, `approve_reservation`,
  `reservation_occurrences`…: la lógica de reservas vive ahí).
- Las migraciones de este repo son **escritas a mano** y pueden contener SQL no transaccional;
  `prisma migrate dev` propone re-agregar la FK de `reservable_id` — **descartarla** (ya está
  en `CLAUDE.md`). Un test en CI aplica **todas** las migraciones desde cero (§9) para que una
  rota no llegue al VPS.

### 8.2 Rollback y migración fallida

- **La versión nueva no levanta o falla el humo** (pasos 5–6): `deploy.sh` revierte solo
  (`APP_TAG=<previous> docker compose up -d --wait app`) y sale con error. Gracias a §8.1 la
  versión anterior funciona sobre el esquema nuevo.
- **Rollback manual** (se detecta un bug después): `rollback.sh` = `deploy.sh <previous>` sin
  migrar. Dos deploys atrás: `deploy.sh <sha>` explícito (la imagen sigue en GHCR).
- **Migración fallida a mitad** (paso 4): Prisma la marca como fallida. La app vieja no se tocó.
  Decidir entre (a) corregir y reintentar con `prisma migrate resolve --rolled-back <nombre>` si la
  migración no dejó nada a medias, o (b) restaurar `predeploy-<sha>.dump` si dejó el esquema
  inconsistente. Con una migración riesgosa, lo segundo es el plan por defecto y por eso se
  declara la ventana de solo lectura antes (no se pierden escrituras entre el dump y la
  restauración).
- **Restaurar el dump** es el único camino que **descarta datos** (todo lo escrito desde el
  backup): se hace solo con la ventana de solo lectura vigente.

### 8.3 Qué tipo de cambio es cada redeploy

| Cambio                                             | Qué hace el deploy                                                        | Atención                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Código sin migración                               | Pasos 1–8; ~15 s de pausa retenida por Caddy                              | El caso normal.                                                                                             |
| Con migración aditiva                              | Igual; el paso 4 aplica y la vieja sigue viva                             | Cumplir §8.1.                                                                                               |
| Con migración riesgosa                             | `--maintenance "motivo"` (solo lectura)                                   | Backup previo verificado a mano.                                                                            |
| Cambia una variable de entorno                     | Editar `/opt/lanube/.env` y `docker compose up -d app` (sin imagen nueva) | Las `NEXT_PUBLIC_*` se **hornean en el build**: cambiar `NEXT_PUBLIC_TURNSTILE_SITEKEY` exige imagen nueva. |
| Cambian dependencias                               | Imagen nueva (CI)                                                         | Revisar que `sharp` y Prisma cargan en `slim`.                                                              |
| Nueva versión de políticas / texto en `src/assets` | Código normal                                                             | El **gate** de aceptación se activa al desplegar (milestone 19): avisar antes, no en hora pico.             |
| Cambio de tema de landing o contenido público      | No es deploy: se edita en el panel (`revalidatePublic` ya lo cubre)       | —                                                                                                           |

Calendario de despliegue: evitar 05:00–05:10 UTC (cron), las aperturas de inscripción de un
evento (picos por el lock del `submitForm`) y los viernes tarde.

## 9. CI/CD (`.github/workflows/deploy.yml`)

Disparador: push a `main` (más `workflow_dispatch` con `redeploy_tag`, que saltea el build para
volver a desplegar un tag que ya está en GHCR). Entorno de GitHub `production` con aprobación
manual opcional.

0. **signed** — `gh api …/commits/<sha>` y exige `verification.verified == true`: un push sin
   firma nunca se construye ni se despliega, aunque la protección de la rama se relaje. (Los
   merges de PR por la web de GitHub salen firmados por GitHub.)
1. **verify** — `npm ci`, `npm run lint`, `npm run format:check`, `npm test` (el typecheck lo
   hace `next build`). Servicio `postgres:17`.
2. **migrations-from-scratch** — en el Postgres del job: `prisma migrate deploy` (valida que las
   migraciones a mano aplican de cero) + `db:seed`.
3. **build** — `npm run build:next` contra esa base (prerender con datos de prueba, ver §4.2),
   sin `NODE_ENV` raro. `docker buildx` empaqueta lo ya compilado en `runner` y arma `migrator`.
   Push a GHCR con tags `<sha>` y `main`. _(El build se hace en el runner y no dentro de
   `docker build` porque la base del job no es alcanzable desde un build aislado; mismo Node 24 y
   misma arquitectura que el VPS — ver decisión 1.)_
4. **deploy** — `ssh deploy@<host> <sha>` (la llave forzada de §7.4 ejecuta `deploy.sh`), con
   `docker login ghcr.io` ya hecho en el VPS con un token de solo lectura (`read:packages`). El
   job falla si `deploy.sh` sale con error, y se ve en GitHub.

Secretos de GitHub: host, llave SSH de deploy, `known_hosts` fijado. Los secretos de la app
**no** pasan por CI: viven en `/opt/lanube/.env` del VPS.

## 10. Decisiones

Resueltas el 2026-10-08:

1. **Arquitectura:** x86_64 (a confirmar al contratar; si fuera ARM, cambiar `platforms` en el
   workflow y usar un runner ARM: `sharp` es nativo).
2. **Dominio:** se mantiene el actual. Bajar el TTL del DNS 24–48 h antes del cutover.
3. **Archivos subidos:** **se sigue con Vercel Blob por ahora** (cero cambios; conserva los
   archivos privados de participantes). Después se autoaloja; mi recomendación para ese milestone
   es **el sistema de archivos, no Garage**:
   - Una sola máquina: Garage (S3 distribuido, ~100–200 MB de RAM, su propia base de metadatos que
     también hay que respaldar) agrega un servicio sin dar nada que el disco local no dé. Su valor
     aparece con varios nodos o con subidas directas del navegador (URLs prefirmadas), y hoy las
     subidas pasan por la app.
   - Con disco: los públicos se sirven **directo por Caddy** (rápido, sin pasar por Node) desde un
     volumen de solo lectura; los privados siguen por el proxy autenticado de admin
     (`fetchPrivate`, ya soportado por `LocalStorage` con el esquema `local-private:`); el backup
     es el mismo `restic` que ya corre.
   - Hace falta: `LocalStorage` con raíz configurable (`STORAGE_LOCAL_DIR`) en vez de
     `public/uploads`, `STORAGE_PUBLIC_HOST`/CSP sin cambios (mismo origen), un script que baje lo
     de Blob y **reescriba las URLs** (`events`, `news`, `spaces`, respuestas de participantes) y
     la prueba del proxy de admin con claves `prod/…`.
   - Si más adelante se quiere S3 (otro servidor, CDN), la interfaz `StorageProvider` ya lo
     permite: Garage entraría como un proveedor más, sin tocar los call sites.
4. **Disparador:** cada push a `main` despliega solo, siempre que el commit esté firmado (el repo
   exige PR). Aprobación manual: opcional en el entorno `production`.

Siguen abiertas:

5. **SMTP de producción:** ¿qué proveedor? El VPS puede tener bloqueados los puertos de salida;
   comprobarlo antes.
6. **Backups fuera del servidor:** ¿qué bucket / proveedor? (`restic` con cualquier S3.)
7. **`NEXTAUTH_SECRET`:** reusar el de Vercel (recomendado; conserva sesiones y archivos firmados).
8. **Cloudflare adelante:** escudo contra ataques y cacheo del sitio público, pero obliga a
   `TRUST_CF_CONNECTING_IP=true` y a restringir el origen a sus IPs. ¿Sí o no por ahora?
9. **Qué pasa con Vercel después del cutover:** una vez que el VPS acepta escrituras, volver
   atrás **pierde** lo escrito en el VPS. El rollback del cutover solo existe mientras sigue en
   solo lectura (milestone 22); después se corrige hacia adelante. Mantener el proyecto de
   Vercel pausado un par de semanas como red de seguridad.

## 11. Orden de trabajo y verificación

Orden: **Fase 0** (código, §5) → servidor (§7.4, Docker, compose, Caddy) → **ensayo completo**
con un dump de producción restaurado y un dominio de prueba → CI/CD (§9) → cutover (runbook del
milestone 22) → semana de observación.

**El ensayo no se saltea.** Debe pasar, en el VPS real y con TLS:

- [ ] `https://<dominio>/` sirve la landing con **datos reales** (no los de CI) tras el calentamiento.
- [ ] Ingreso con contraseña y con passkey; sesión persistente tras un redeploy.
- [ ] `/policies/accept` muestra «Ver qué cambió» (los `.mdx` están en la imagen).
- [ ] Un rate limit cuenta la **IP real**, no la que manda el cliente en `X-Real-IP` /
      `X-Forwarded-For` (probar con `curl -H 'X-Real-IP: 1.2.3.4'` y mirar la clave en `rate_limits`).
- [ ] Registro y reseteo mandan correo reales; una subida de imagen y una de archivo de
      participante funcionan, y el proxy de admin las sirve con el CSP `sandbox`.
- [ ] Un `/_next/image` responde (sharp cargó).
- [ ] Los tres crons corren desde sus timers y avisan al monitor.
- [ ] **Redeploy en seco**: un deploy sin cambios, uno con migración aditiva y uno que
      **falla a propósito** (healthcheck roto) y revierte solo.
- [ ] Rollback manual a la versión anterior.
- [ ] Backup → copia externa → **restauración** en una base descartable.
- [ ] Reiniciar el servidor: todo vuelve solo y los timers `Persistent` se ponen al día.
- [ ] `docker stats` bajo una prueba de carga corta: memoria dentro de los límites de §5.1.

## 12. Riesgos

| Riesgo                                                       | Mitigación                                                                                |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| El OOM-killer mata a Postgres en un pico o durante un deploy | Build fuera del servidor; `mem_limit` por servicio; `oom_score_adj` de Postgres; swap.    |
| Rate limit evadible por headers de IP                        | Caddyfile que **pisa** `X-Real-IP`/`X-Forwarded-For`; prueba explícita en el ensayo.      |
| Sitio público con datos de CI tras un deploy                 | Paso 7 (invalidación + calentamiento); chequeo en el ensayo.                              |
| Migración rompe a la versión vieja o a la nueva              | Regla expand/contract, backup previo, ventana de solo lectura, migraciones de cero en CI. |
| Cron caído sin que nadie lo note                             | `Persistent=true` + latido obligatorio.                                                   |
| Backup inexistente o inservible                              | Copia externa + restauración probada.                                                     |
| Disco lleno (imágenes, dumps, logs)                          | Poda de imágenes en cada deploy, rotación de logs y dumps, alerta al 80 %.                |
| Reloj corrido                                                | Sincronización de hora + UTC.                                                             |
| La llave SSH de CI queda comprometida                        | `command=`+`restrict`: solo puede ejecutar `deploy.sh` con un SHA.                        |
| Perder sesiones/passkeys en el cutover                       | Mismo dominio y mismo `NEXTAUTH_SECRET` (§4.6).                                           |

## 13. Qué se verificó en el ensayo local (2026-10-08) y qué no

Hecho en una máquina con Docker (Mac, arm64), con un Postgres descartable y un contenedor Linux
corriendo `lanube-deploy`. **No** sustituye el ensayo en el VPS real (§11), pero sacó a la luz
cuatro fallos que habrían llegado a producción.

**Verificado**

- Las 61 migraciones aplican desde cero con la imagen `migrator` (sin seed); el seed corre en CI.
- `next build` con `NEXT_OUTPUT=standalone` **dentro de `node:24-bookworm`** (como CI): la imagen
  `runner` arranca sana, sirve `/`, `/about`, `/spaces`, `/api/maintenance`, `/api/auth/session`,
  los `.mdx` de las políticas están en la imagen, y `/_next/image` devuelve WebP (**`sharp`
  funciona** con el binario Linux). Corre como usuario `node`.
- `lanube-deploy`: primer deploy; redeploy con backup previo; **tag roto que nunca queda sano →
  vuelta automática a la versión anterior** (tarda ~70 s por el `start_period` del healthcheck) con
  el sitio respondiendo 200; `--rollback` manual; deploy con `--maintenance` (declara y cierra la
  ventana vía `maintenance_start`/`maintenance_end`).
- 119 pedidos durante un redeploy completo por Caddy: todos 200, el peor 1,35 s.
- Los tres crons (`cron-call.sh`) responden por el `Bearer`; `backup.sh` genera el dump y **el
  dump restaura** en otra base (61 migraciones, 4 roles).
- **Caddy pisa `X-Real-IP` y `X-Forwarded-For`**: con `6.6.6.6` falsos del cliente, el upstream
  recibió la IP real del par. (Es lo que protege todos los rate limits.)

**Fallos encontrados y corregidos**

1. `email {$ACME_EMAIL:}` vacío rompía el Caddyfile (`wrong argument count`) y Caddy quedaba
   reiniciándose **sin que el smoke test lo notara** → se quitó el bloque, se valida el Caddyfile
   antes de instalarlo y se comprueba que Caddy esté corriendo.
2. Un build hecho en macOS empaqueta el binario de `sharp` de macOS (el ensayo lo mostró): CI
   compila en Linux; la guía de ensayo local lo dice.
3. `/events` no existe como página (el calentamiento fallaba en silencio).
4. El estado de un `curl` fallido se mostraba como `000000`.

**No verificado** (queda para el ensayo en el VPS)

- Ubuntu Server 26.04: `provision.sh` se revisó con `bash -n` pero **no se corrió**; falta
  comprobar la disponibilidad del repo de Docker para 26.04 (el script cae al `docker.io` de la
  distro), `fail2ban`, `ufw` y `unattended-upgrades`.
- El workflow de GitHub Actions: YAML válido y lógica revisada, **no ejecutado**. Primera vez:
  verificar `docker/build-push-action`, el login a GHCR y que el repositorio/paquetes sean
  accesibles con el token de solo lectura del VPS.
- TLS real (Let's Encrypt) y DNS; los timers de systemd (`systemd-analyze verify` no estaba
  disponible); `restic` hacia un bucket real; los latidos.
- Carga: la memoria bajo uso real contra los límites de §5.1 (pendiente la prueba corta de
  `docker stats`).
- Un redeploy lento aislado: el paso 5 tardó ~60 s en una corrida y ~8 min en otra (en esta última
  el sondeo mostró un único pedido de 489 s), frente a 9–10 s en las demás. **Causa no
  determinada**; no se reprodujo en las dos corridas siguientes. Si aparece en el VPS, mirar
  `docker compose logs app` y el `stop_grace_period`.
