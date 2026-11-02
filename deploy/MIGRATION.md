# Migración de Vercel al VPS (prueba, corte y vuelta atrás)

Plan en tres fases. **La base de Vercel solo se lee**; nada de esto la modifica. Mientras el DNS
apunte a Vercel, el sitio real no se entera de la prueba.

| Fase                            | Qué pasa                                                     | Qué se pierde si algo sale mal         |
| ------------------------------- | ------------------------------------------------------------ | -------------------------------------- |
| 1. Prueba                       | Copia completa de datos al VPS; se prueba todo por túnel SSH | Nada: la prueba se descarta            |
| 2. Corte                        | Vercel en solo lectura → se repite la copia → DNS            | Nada: el origen no se tocó             |
| 3. Vuelta atrás (si hace falta) | DNS de nuevo a Vercel + salir de mantenimiento               | Lo escrito en el VPS después del corte |

La copia final **reemplaza por completo** la base del VPS (`lanube-import-vercel`), así que todo lo
que se haga durante la prueba (usuarios de prueba, reservas, subidas) desaparece solo. No hay que
limpiar nada.

## Qué se migra y cómo

- **Base de datos**: `pg_dump` de Vercel → reescritura de URLs → `psql` en una sola transacción
  (o queda todo o no cambia nada). Las migraciones pendientes se aplican después.
- **URLs de archivos**: sobre el volcado, así cubre columnas, markdown y las respuestas JSON de
  inscripciones por igual:
  `https://<store>.public.blob.vercel-storage.com/<clave>` → `/uploads/<clave>` y
  `https://<store>.private.blob.vercel-storage.com/<clave>` → `local-private:<clave>`.
- **Archivos**: `scripts/export-blob.ts` baja `prod/` de Blob (público y privado) al layout del
  proveedor local (`public/` y `private/`); `rsync` al VPS. Es incremental: la segunda pasada
  (corte) baja solo lo nuevo.
- **Verificación**: `lanube-verify-uploads` revisa que **cada** archivo que la base referencia
  exista en disco. Es la red de seguridad contra una imagen rota o un adjunto perdido.
- **No se migran** los archivos de `preview/` ni `dev/` de Blob, ni las sesiones (son JWT).

### Decisión: `NEXTAUTH_SECRET`

Si en el VPS usás **el mismo** `NEXTAUTH_SECRET` que en Vercel, las sesiones abiertas sobreviven al
corte (nadie tiene que volver a entrar). Con uno nuevo, todos vuelven a iniciar sesión — es la opción
más limpia si sospechás que el secreto estuvo expuesto. `CRON_SECRET` sí debe ser nuevo.

Las passkeys y los asistentes MCP conectados **siguen funcionando**: dependen del dominio, que no
cambia (y sus datos viajan en la base).

## Fase 1 — Prueba

### 1.1 Preparar

En tu máquina (el token y la URL quedan en un archivo ignorado por git; no los pegues en chats):

```bash
vercel env pull .env.vercel --environment=production
# Usá la URL SIN pooler si existe (DATABASE_URL_UNPOOLED en Neon): pg_dump y los pools no se llevan.
```

El VPS tiene que haber hecho su primer deploy (existen la base y la app).

### 1.2 Base de datos

```bash
# en el VPS (la URL se lee sin eco y no queda en el historial)
read -rs SRC_DATABASE_URL && export SRC_DATABASE_URL
sudo -E lanube-import-vercel
```

Hace: backup de lo que haya → volcado crudo en `/var/backups/lanube/vercel-source-*.sql` (0600,
**datos personales**: borralo al terminar) → restauración → roles de la base (`lanube-db-roles`) → migraciones → comparación de filas por
tabla → levanta la app. Las diferencias de conteo en tablas nuevas de migraciones recientes son
normales; en el resto no.

Si el `pg_dump` falla por versión (el servidor de origen es más nuevo que el cliente 17), avisame.

### 1.3 Archivos

```bash
# en tu máquina
set -a; source .env.vercel; set +a        # trae BLOB_READ_WRITE_TOKEN
npx tsx scripts/export-blob.ts --dry-run   # cuántos archivos, públicos/privados, MB
npx tsx scripts/export-blob.ts --out ./blob-export
rsync -a ./blob-export/ <admin>@VPS:~/blob-import/
# en el VPS
sudo rsync -a --chown=1000:1000 ~/blob-import/ /var/lib/lanube/uploads/   # tu DATA_DIR
sudo lanube-verify-uploads                 # tiene que terminar en «faltantes: 0»
```

Si faltan archivos, la lista dice cuáles; lo más probable es que `list()` no haya devuelto algún
blob privado. Avisame con el mensaje exacto.

### 1.4 Probar la app (túnel SSH)

El VPS expone un listener **solo de loopback** (`127.0.0.1:8080`) y únicamente tu usuario puede
abrir ese túnel (nada más):

```bash
ssh -L 8080:127.0.0.1:8080 <admin>@VPS      # dejalo abierto
# navegador: http://localhost:8080
```

Para esto, en el VPS poné en `/srv/lanube/lanube.env`:
`NEXTAUTH_URL=http://localhost:8080` y aplicalo con
`cd /srv/lanube && sudo docker compose up -d --force-recreate app`. Además, agregá `localhost` a los
hostnames del widget de Turnstile (y sacalo después).

**Si infra te dio un dominio de pruebas** (mejor que el túnel: pasa por Cloudflare, TLS y mTLS de verdad):
instalá el certificado de origen que lo cubra, `sudo enable-public-site DOMINIO-DE-PRUEBAS`, y poné
`NEXTAUTH_URL`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` y `OAUTH_ISSUER` apuntando a ese dominio (con el mismo
`docker compose up -d --force-recreate app`). Los mismos cuatro cambian al dominio real en el corte.
No se prueba por la IP pública: Caddy exige el certificado de cliente de Cloudflare y UFW solo admite
sus rangos, por diseño. Passkeys y el conector MCP dependen del host, así que lo que se registre en el
dominio de pruebas no sirve en el real. Pedile a infra que el certificado de origen cubra **ambos**
dominios, que Full (strict) y Authenticated Origin Pulls estén activos en la zona del dominio real, y que
la regla de Cloudflare con el `X-Origin-Token` exista en las zonas de **los dos** (README §2).

**Con quién tener cuidado**: la copia tiene usuarios y participantes **reales**. Registrarte, resetear
tu contraseña o inscribirte con _tu_ correo es seguro. Lo que **envía correo a gente real** es
tocar eventos con inscriptos: aprobar/rechazar participantes, cancelar o reprogramar sesiones. No lo
hagas en la prueba. (Los crons no envían correos.)

Checklist:

- [ ] Entrar con una cuenta existente (tu usuario real) y con la de un admin.
- [ ] Registro de una cuenta nueva con tu correo → llega el mail de confirmación (SMTP) → confirmar.
- [ ] «Olvidé mi contraseña» → llega el mail → cambiarla.
- [ ] Inscripción a un evento de prueba → llega el mail de confirmación.
- [ ] Imágenes: landing, espacios, eventos, noticias (las migradas se ven; ninguna rota).
- [ ] Subir una imagen nueva desde el admin y verla (escritura al volumen).
- [ ] Adjunto de una inscripción: abrirlo desde el admin (archivos privados migrados).
- [ ] Hacer una reserva y verla en el admin.
- [ ] Captcha (Turnstile) en registro y reseteo.
- [ ] `sudo lanube-cron maintain-reservations` responde OK; `systemctl list-timers 'lanube-*'`.
- [ ] `sudo lanube-backup all` y probar la restauración del dump en una base descartable.
- [ ] `sudo reboot` y comprobar que todo vuelve solo (app, Postgres, Caddy, timers).
- [ ] Un deploy real por GitHub Actions (cualquier commit) pasa de punta a punta.

## Fase 2 — Corte

Antes de empezar: infra tiene el certificado de origen instalado (`sudo enable-public-site DOMINIO`),
y avisaron que pueden cambiar el DNS cuando se lo pidas. Elegí un momento de poco uso.

1. **Vercel → mantenimiento en solo lectura** (`/admin/maintenance`, modo «solo lectura global»,
   con un mensaje claro). Esperá un par de minutos a que terminen las escrituras en curso.
2. **Copia final** (es la misma de la fase 1; reemplaza la anterior):
   ```bash
   read -rs SRC_DATABASE_URL && export SRC_DATABASE_URL && sudo -E lanube-import-vercel
   ```
   y los archivos nuevos (incremental): `export-blob.ts` → `rsync` → `sudo rsync …` →
   `sudo lanube-verify-uploads` (**debe dar 0 faltantes**).
3. **Configuración definitiva en el VPS**: `sudo enable-public-site DOMINIO-REAL`, `NEXTAUTH_URL`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` y `OAUTH_ISSUER` al dominio real en
   `/srv/lanube/lanube.env`, claves reales de Turnstile, y
   `cd /srv/lanube && sudo docker compose up -d --force-recreate app`. Sacá `localhost` de Turnstile.
4. Confirmá: `curl -s http://127.0.0.1:3000/api/maintenance` y `systemctl is-active caddy`.
5. **Infra cambia el DNS** (`A` de DOMINIO → IP del VPS, con proxy de Cloudflare). Propaga rápido
   (proxy = TTL automático de ~5 min).
6. **Humo**: abrir el sitio real, entrar, ver imágenes, registrar/resetear con tu correo, y
   `sudo tail -f /var/log/caddy/access.log` para ver el tráfico real llegar.
7. Si todo está bien: **dejá Vercel en mantenimiento unos días** (es tu vuelta atrás) y después
   pausá el proyecto. Los Vercel Crons siguen corriendo contra la base vieja hasta que lo pauses
   (inofensivo).

## Fase 3 — Vuelta atrás

Si algo falla gravemente después del DNS: pedí a infra que devuelva el DNS a Vercel y sacá a
Vercel del modo mantenimiento. La base de Vercel está intacta como quedó al congelarla. Lo que se
haya escrito en el VPS en ese lapso **no vuelve solo** a Vercel: hay un `pg_dump` del VPS para
recuperarlo a mano si importa. Por eso conviene el corte en horario tranquilo.

## Riesgos conocidos

- **No pude probar contra tu Vercel real** (sin credenciales): el volcado/reescritura/restauración
  sí se probó con una base local migrada de verdad, repetido dos veces; `export-blob.ts` no. Su
  `--dry-run` y `lanube-verify-uploads` están para que lo descubras antes del corte, no durante.
- Cuanto más tiempo pase entre la prueba y el corte, más cambia el origen; no importa, porque la
  copia final reemplaza todo.
- Los correos con enlaces que ya estén en bandejas (confirmación, edición de inscripción) apuntan
  al dominio real y seguirán funcionando después del corte (los tokens viajan en la base).
