# Despliegue en el VPS (milestone 26)

Guía **operativa**. El diseño, las decisiones y lo que se descartó están en
[`docs/milestones/milestones-26-vps-deployment.md`](../docs/milestones/milestones-26-vps-deployment.md).
La primera migración de datos desde Vercel sigue el runbook de
[`milestones-22-maintenance-mode.md`](../docs/milestones/milestones-22-maintenance-mode.md).

## Qué hay acá

| Archivo                     | Para qué                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| `provision.sh`              | Deja un Ubuntu Server 26.04 limpio listo (Docker, usuario, firewall, swap, units). Una vez.    |
| `bootstrap/lanube-deploy`   | El launcher que se instala en `/opt/lanube/bin`. Trae la versión pedida y ejecuta su `run.sh`. |
| `run.sh`                    | El despliegue: backup → migrar → recrear → smoke → calentar → registrar, con auto-rollback.    |
| `cron-call.sh`, `backup.sh` | Los llaman los timers de systemd.                                                              |
| `systemd/`                  | Timers de cron (reemplazan a Vercel Cron) y de backup.                                         |

Todo esto viaja **dentro de la imagen `lanube-migrator:<sha>`** (`/ops`): el compose, el Caddyfile y
estos scripts son siempre los del commit que se despliega.

## Primera vez

1. **Servidor:** `scp -r deploy usuario@host:~/lanube-deploy && ssh usuario@host 'sudo bash ~/lanube-deploy/provision.sh'`.
2. **`/opt/lanube/.env`** (usuario `deploy`, `chmod 600`): partir de `env.example`, sección
   «Producción en VPS». Mínimo: `APP_DOMAIN`, `POSTGRES_PASSWORD`, `NEXTAUTH_URL`,
   `NEXTAUTH_SECRET`, `CRON_SECRET`, `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_…`, `SMTP_SERVER_*`,
   `STORAGE_ENV_ROOT=prod`, y las de almacenamiento (`BLOB_READ_WRITE_TOKEN` mientras siga Blob).
3. **GHCR:** como `deploy`, `docker login ghcr.io` con un token **solo de lectura** (`read:packages`).
4. **Llave de CI:** generar un par sin passphrase (`ssh-keygen -t ed25519 -f ci-lanube`), poner la
   pública en `/home/deploy/.ssh/authorized_keys` con el prefijo
   `restrict,command="/opt/lanube/bin/lanube-deploy"` y la privada en el secreto `DEPLOY_SSH_KEY`.
   Con esa llave lo único que se puede hacer es desplegar un tag.
5. **GitHub:** secretos `DEPLOY_HOST`, `DEPLOY_USER` (`deploy`), `DEPLOY_SSH_KEY`,
   `DEPLOY_KNOWN_HOSTS` (`ssh-keyscan -t ed25519 host`); variable `NEXT_PUBLIC_TURNSTILE_SITEKEY`.
   Opcional: aprobación manual en el entorno `production`.
6. **Datos:** runbook del milestone 22 (ventana de solo lectura → `pg_dump` → restaurar en el VPS).
7. **Primer deploy:** merge a `main` (o "Run workflow"). Después, habilitar los timers:
   `sudo systemctl enable --now lanube-cron-maintain-reservations.timer lanube-cron-report-snapshot.timer lanube-cron-sync-holidays.timer lanube-backup.timer`.
8. **Ensayo** completo antes del cutover: la lista del §11 del doc del milestone.

## Día a día

```bash
# Desplegar (lo hace CI en cada push firmado a main; a mano, en el servidor):
/opt/lanube/bin/lanube-deploy <sha>
/opt/lanube/bin/lanube-deploy <sha> --maintenance   # migración riesgosa: ventana de solo lectura

# Volver a la versión anterior (no migra: el esquema es compatible hacia atrás, ver §8.1):
/opt/lanube/bin/lanube-deploy --rollback

# Estado
cat /opt/lanube/state/current /opt/lanube/state/previous
tail -50 /opt/lanube/deploys.log
docker compose -p lanube -f /opt/lanube/compose.yml --env-file /opt/lanube/.env ps
docker compose -p lanube -f /opt/lanube/compose.yml --env-file /opt/lanube/.env logs -f app
systemctl list-timers 'lanube-*'
journalctl -u 'lanube-cron@*' -u lanube-backup --since today
```

Si un deploy falla en el paso de migración, **la versión anterior sigue sirviendo** y el script dice
cómo seguir (reintentar o restaurar `predeploy-<sha>.dump`). Si la ventana de solo lectura quedó
activa por un fallo, es a propósito: se cierra con `SELECT maintenance_end_all();` o desde
`/admin/maintenance`, **después** de decidir.

## Ensayo local (sin VPS)

Sirve para probar `run.sh` y las imágenes en una máquina con Docker (así se verificó el milestone):

1. Base descartable con migraciones + seed (`prisma migrate deploy`, `npm run db:seed`).
2. Build **en Linux**, como CI (si se compila en macOS, el bundle trae el binario de `sharp` de
   macOS): `NEXT_OUTPUT=standalone npm run build:next` dentro de `node:24-bookworm`.
3. `docker build -f docker/Dockerfile.prod --target runner|migrator -t …` y etiquetarlas como
   `ghcr.io/frannoriega/lanube[-migrator]:<tag>`.
4. Un contenedor Linux con el socket de Docker corriendo `lanube-deploy <tag>` con
   `LANUBE_ROOT`/`LANUBE_DATA` apuntando a una carpeta temporal, `APP_LOCAL_PORT=3050` y
   `LANUBE_SKIP_PULL=1 LANUBE_SKIP_WINDOW_CHECK=1` (no bajar de GHCR, ignorar la ventana del cron).
