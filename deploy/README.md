# Deploy en un VPS (Ubuntu) — runbook

Todo lo necesario para correr La Nube en un VPS propio, endurecido, con deploy automático desde
GitHub. Se probó construyendo la imagen y corriéndola con las mismas restricciones que en
producción (sistema de archivos de solo lectura, sin capabilities, usuario no root); **no** se
probó el aprovisionamiento del servidor en sí (necesita un VPS real): los scripts pasan
`bash -n`, pero la primera corrida es la verdadera prueba — por eso va en dos pasos y no puede dejarte afuera.

## 1. Cómo queda armado

```
Internet ─► Cloudflare (proxy, WAF, DDoS) ─► :443 del VPS
                                              │  UFW: 443 SOLO desde rangos de Cloudflare
                                              │  Caddy (host): cert de origen + mTLS + header secreto de NUESTRA zona
                                              ▼
                                  127.0.0.1:3000  app (Docker, read-only, sin capabilities)
                                              │
                                        red interna Docker ─► Postgres 17 (sin puerto publicado)
```

| Pieza                                                     | Decisión                                                                                                                                   | Por qué                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Caddy en el **host**, no en Docker                        | UFW gobierna su puerto                                                                                                                     | Docker publica puertos salteándose UFW; un contenedor con `-p 443` ignoraría las reglas.                                                                                                                                                                                                                                                                                                                                                                                   |
| App en `127.0.0.1:3000`                                   | Nada de Docker escucha en una interfaz pública                                                                                             | Mismo motivo. Postgres no publica ningún puerto.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 443 solo desde Cloudflare **+** mTLS **+** header secreto | El origen solo responde a pedidos que pasaron por _nuestra_ zona                                                                           | Las IPs y el certificado de «Authenticated Origin Pulls» son **compartidos por todos los clientes de Cloudflare**: con una cuenta gratis cualquiera puede apuntar un DNS a la IP del VPS y pasar ambos filtros (saltándose el WAF y las reglas de tu zona). Por eso Cloudflare agrega un header `X-Origin-Token` solo en tu zona y Caddy lo exige. Con esto `TRUST_CF_CONNECTING_IP=true` es seguro (`src/lib/request-ip.ts`): Cloudflare siempre pisa `CF-Connecting-IP`. |
| Cert de origen de Cloudflare                              | Sin Let's Encrypt, sin puerto 80                                                                                                           | Un puerto menos abierto y sin renovaciones que fallen.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Imagen construida en CI → GHCR                            | El VPS no compila ni tiene el código                                                                                                       | Menos superficie y deploys reproducibles. El tag es el SHA del commit.                                                                                                                                                                                                                                                                                                                                                                                                     |
| Deploy por **pull**, sin SSH desde CI                     | El servidor mira el tag `production` de GitHub **una vez por día, lun-jue 20:00 (hora de Argentina)**, nunca viernes (`lanube-autodeploy`) | GitHub no puede llegar al servidor por SSH; además no hay ninguna clave de CI con acceso al servidor ni puerto entrante nuevo.                                                                                                                                                                                                                                                                                                                                             |
| Crons como **timers de systemd**                          | Reemplazan `vercel.json`                                                                                                                   | Mismos horarios, `Persistent=true` (si el VPS estaba apagado, corren al volver).                                                                                                                                                                                                                                                                                                                                                                                           |
| Uploads en disco local                                    | Ruta `/uploads/[...key]` de la app                                                                                                         | Mismo código que ya valida claves; el optimizador de `next/image` también la usa.                                                                                                                                                                                                                                                                                                                                                                                          |

## 2. Antes de empezar

- VPS Ubuntu 22.04/24.04 con acceso root por SSH (el de la primera vez) y la IP.
- Dominio en Cloudflare, **proxificado** (nube naranja).
- Tu clave SSH pública, y, si querés restringir SSH por origen, el rango desde el que entrás (ver §3, `SSH_ALLOW_FROM`).
- Que el VPS tenga una **IP pública alcanzable en el puerto 443** (Cloudflare tiene que llegar al origen). Si no la tiene, avisame: la alternativa es un túnel saliente (Cloudflare Tunnel) y cambia el diseño.
- Ruta del volumen persistente (`DATA_DIR`): ahí van `postgres/` y `uploads/`.
- En Cloudflare (dominio → SSL/TLS): modo **Full (strict)**; _Origin Server_ → crear un certificado
  de origen (guardá `origin.pem` y `origin.key`); _Origin Server_ → activar **Authenticated Origin
  Pulls**; _Edge Certificates_ → «Always Use HTTPS» y TLS mínimo 1.2.
- **Regla de Cloudflare con el token de zona** (la pide `enable-public-site` y te muestra el valor):
  Rules → Transform Rules → _Modify Request Header_ → «Set static» → nombre `X-Origin-Token`, valor el
  token, aplicada a todo el hostname. **Sin esta regla el sitio no responde a nadie** (es a propósito).
  Pasale el token a infra por un canal privado, no por el repo ni por un chat público.
- Turnstile con claves reales para el dominio, y las credenciales SMTP.

## 3. Aprovisionar y endurecer (una vez)

```bash
scp -r deploy root@VPS:/root/deploy
ssh root@VPS
ADMIN_USER=<admin> ADMIN_SSH_PUBKEY='ssh-ed25519 AAAA… yo@laptop' \
DOMAIN=lanube.example \
DATA_DIR=/ruta/del/volumen IMAGE_REPO=ghcr.io/OWNER/REPO \
bash /root/deploy/scripts/01-bootstrap.sh
```

`SSH_ALLOW_FROM` (CIDRs separados por coma) restringe el puerto 22 a esos orígenes. Averiguá desde qué IP te ve el servidor con `who -m` (aparece entre paréntesis) y usá un rango que la incluya; el script **aborta** si tu sesión actual no cae dentro, para no dejarte afuera. **Es opcional**: si el acceso al puerto 22 ya está restringido fuera del servidor (firewall del proveedor, red privada) y no controlás ese lado, no la uses — así ningún CIDR mal puesto puede dejarte afuera. Sin ella SSH queda abierto a cualquier origen que llegue al host (con límite de tasa y fail2ban, que además ignora la IP de tu sesión para no banearte). Hace: actualizaciones
automáticas de seguridad (con reinicio a las 07:30 si hace falta), usuarios, Docker con daemon
endurecido, Caddy, UFW, fail2ban (SSH + reincidentes), sysctl, timers. **No toca el login por
contraseña de SSH todavía.**

**Cerrar SSH** — solo después de comprobar, desde _otra_ terminal, que entrás con clave y que `sudo` anda:

```bash
ssh <admin>@VPS          # ¿entra sin pedir contraseña de SSH?
sudo -v
sudo ADMIN_USER=<admin> bash /root/deploy/scripts/02-lock-ssh.sh
```

Queda: sin root, sin contraseñas, `AllowUsers` mínimo, sin reenvíos (salvo un túnel del admin solo al puerto de pruebas 8080), cifrados modernos. Dejá la
sesión original abierta hasta verificar una segunda conexión.

## 4. Configuración del servidor

1. `sudo nano /srv/lanube/postgres.env`, `lanube.env` y `migrator.env` (plantillas con `CAMBIAR`).
   Son **tres** contraseñas distintas, todas hex (`openssl rand -hex 24`): `POSTGRES_PASSWORD`
   (superusuario, solo en `postgres.env`), `LANUBE_OWNER_PASSWORD` (en `postgres.env` y en la URL de
   `migrator.env`) y `LANUBE_APP_PASSWORD` (en `postgres.env` y en la URL de `lanube.env`). Secretos
   nuevos para `NEXTAUTH_SECRET` y `CRON_SECRET`. Poné `POSTGRES_PASSWORD` **antes** del primer
   deploy: Postgres la fija al inicializar el volumen (las otras dos se aplican en cada deploy).
   Ver «Roles de la base» más abajo.
2. Certificado de origen: pegar en `/etc/caddy/certs/origin.pem` y `origin.key`
   (`chown root:caddy`, `chmod 640`), luego `sudo enable-public-site TU.DOMINIO` (valida la config
   y recién ahí activa el sitio público; hasta entonces Caddy solo tiene el listener de pruebas
   en `127.0.0.1:8080`, accesible por túnel SSH del admin — ver `MIGRATION.md`).
3. Registro de imágenes: `sudo docker login ghcr.io` con un **token clásico** con el único permiso `read:packages` (los fine-grained no soportan GHCR) (o hacé público el paquete y salteá esto).
4. Verificá el firewall: `sudo ufw status numbered` (22 limitado + 443 por rango de Cloudflare).

## 5. GitHub Actions

En el repo → Settings → Secrets and variables → Actions:

| Nombre                                   | Valor                                                   |
| ---------------------------------------- | ------------------------------------------------------- |
| variable `NEXT_PUBLIC_TURNSTILE_SITEKEY` | la sitekey real (se incrusta en el bundle al construir) |

No hay secretos: el deploy es por pull. Para que el VPS pueda bajar las imágenes, o hacés público el
paquete `lanube` en GHCR (recomendado: la imagen no lleva secretos) o hacés `docker login ghcr.io`
con un token clásico `read:packages`.

Recomendado (cada punto cierra un camino a producción):

- **Restringir el entorno `production` a `main`**, para que una rama o una corrida manual no pueda usarlo:
  `gh api -X PUT repos/frannoriega/lanube/environments/production --input - <<< '{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}'`
  y luego `gh api -X POST repos/frannoriega/lanube/environments/production/deployment-branch-policies -f name=main`.
- _Required reviewers_ en ese entorno, si querés aprobar cada deploy.
- Proteger `main` (Settings → Branches): quien pueda empujar ahí despliega a producción.
- Activar _Dependabot_ (ya hay `.github/dependabot.yml`): las acciones están fijadas por SHA.

Desde ahí, **cada push a `main`** corre lint + formato + tests, construye las imágenes (app y
migraciones), las sube a GHCR y mueve el tag `production` al commit. El VPS lo detecta en su próxima
ventana (lun-jue 20:00 ART; si empujás el viernes, sale el lunes) y corre `lanube-deploy`. No se ve el resultado en GitHub: se mira en el servidor (ver §7).

## 6. Qué hace un deploy (`lanube-deploy`)

1. `docker pull` de la app y del migrador **del mismo commit**.
2. `pg_dump` previo (`/var/backups/lanube/db-predeploy-<sha>.dump`).
3. Migraciones (`prisma migrate deploy`). Si fallan, la versión anterior sigue sin tocar.
4. Recrea la app y espera el healthcheck; si no queda sana, **vuelve a la imagen anterior**.

⚠️ El rollback de imagen **no revierte migraciones**. Escribí las migraciones compatibles hacia
atrás (agregar → migrar datos → recién después quitar), así la versión anterior corre contra el
esquema nuevo. Si una migración dañó datos: restaurar el dump (abajo).

Deploy/rollback manual a un commit: `sudo lanube-deploy deploy <sha40>`.

### Deploy manual

El deploy automático es solo una comodidad; todo se puede hacer a mano, cualquier día (incluido
viernes: las restricciones de horario son únicamente del timer). Siempre desde el VPS, por SSH:

| Quiero…                                                                | Comando (en el VPS)                                                                                    |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Desplegar **ya** lo último que publicó CI, sin esperar a la noche      | `sudo lanube-autodeploy --now`                                                                         |
| Desplegar **un commit concreto** (también sirve para **volver atrás**) | `sudo lanube-deploy deploy <sha de 40 caracteres>`                                                     |
| Ver qué hay desplegado                                                 | `grep IMAGE_TAG /srv/lanube/.env`                                                                      |
| Ver qué verá el próximo deploy automático                              | `curl -s https://api.github.com/repos/frannoriega/lanube/git/ref/tags/production \| jq -r .object.sha` |
| Pausar los deploys automáticos                                         | `sudo systemctl disable --now lanube-autodeploy.timer` (volver: `enable --now`)                        |
| Seguir el último deploy                                                | `sudo journalctl -u lanube-autodeploy -n 100` (si fue a mano, la salida está en tu terminal)           |

Notas:

- `lanube-deploy` necesita que las **imágenes de ese commit existan en GHCR**, o sea que CI las haya
  construido (todo commit que llegó a `main` y pasó los tests las tiene). Un sha que nunca se
  construyó falla en el `docker pull`, sin tocar nada.
- El sha completo sale de `git rev-parse HEAD` o de `gh run list -R frannoriega/lanube --workflow deploy.yml`.
- Un deploy manual **no se pisa**: el timer solo actúa cuando el tag `production` cambia respecto de
  lo último que vio o de lo que está desplegado. Si hacés rollback a un commit viejo, queda así hasta
  que alguien publique algo nuevo.
- **Construir sin pasar por `main`**: `gh workflow run deploy.yml -R frannoriega/lanube --ref <rama>`
  construye esa rama pero **no** mueve el tag `production` (solo `main` lo mueve), así que no sale sola.
  Para desplegar esas imágenes a mano, usá `sudo lanube-deploy deploy <sha de la rama>`.
- El rollback automático (si la app nueva no queda sana) vale igual para los deploys manuales.
- Si el servidor está en el medio de un deploy (el timer o vos), el segundo intento espera/avisa: hay
  un candado (`/var/lock/lanube-deploy`).

## 7. Operación

```bash
cd /srv/lanube
sudo docker compose ps ; sudo docker compose logs -f app
systemctl list-timers 'lanube-*'                      # próximos crons/backups
sudo journalctl -u lanube-cron-maintain -n 50         # último cron de reservas
sudo lanube-cron maintain-reservations                # forzarlo a mano
sudo tail -f /var/log/caddy/access.log
sudo fail2ban-client status sshd
sudo journalctl -u lanube-autodeploy -n 50            # qué desplegó (o por qué no)
sudo ls /var/lib/lanube/autodeploy ; sudo cat /var/lib/lanube/autodeploy/last-seen
```

**Restaurar la base** (con la app detenida):

```bash
cd /srv/lanube && sudo docker compose stop app
sudo lanube-db-roles   # los roles tienen que existir antes (el volcado trae dueños y permisos)
sudo docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  < /var/backups/lanube/db-<etiqueta>.dump
sudo lanube-db-roles   # y de nuevo, por si el volcado era de antes de la separación
sudo lanube-deploy deploy <sha-que-andaba>   # o: docker compose up -d app
```

**Emergencia de mantenimiento**: las funciones SQL `maintenance_*` (CLAUDE.md §17) siguen
funcionando con `docker compose exec postgres psql`.

### Roles de la base

Tres roles, definidos en `deploy/postgres/roles.sql` y aplicados en cada deploy por `lanube-db-roles`
(idempotente; también lo corren la importación de Vercel y, a mano, la restauración):

| Rol                            | Para qué                                                                                                                                                                          | Dónde está su contraseña               |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `POSTGRES_USER` (superusuario) | Solo administración: backups, restauración, aplicar los roles. Ninguna variable de la app lo tiene.                                                                               | `postgres.env`                         |
| `lanube_owner`                 | Dueño del esquema y los objetos. Lo usa **solo** el migrador (DDL). Sin superusuario.                                                                                             | `postgres.env` + URL en `migrator.env` |
| `lanube_app`                   | La app en runtime: `SELECT/INSERT/UPDATE/DELETE`, secuencias y funciones. No puede crear, borrar ni alterar objetos, ni tocar `_prisma_migrations`, ni crear roles o extensiones. | `postgres.env` + URL en `lanube.env`   |

- Una tabla o función nueva creada por una migración le llega a la app sola (permisos por defecto del
  dueño); `lanube-db-roles` corre igual después de migrar, por si acaso.
- Si una migración futura necesita algo de superusuario (`CREATE EXTENSION`, por ejemplo), va a fallar
  como `lanube_owner`: se aplica a mano una vez como superusuario
  (`sudo docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE EXTENSION …"'`)
  y la migración queda sin efecto. Hoy ninguna lo necesita.
- `roles.sql` se instala con el bootstrap (`/usr/local/share/lanube/postgres/`): si cambia en el repo,
  copiá `deploy/` y volvé a correr el bootstrap.
- **Probarlo sin tocar el servidor**, desde tu máquina (necesita Docker y `npm ci`; ~1 minuto):
  `bash deploy/tests/db-roles.sh`. Levanta un Postgres descartable, aplica los roles, migra como
  `lanube_owner`, corre el seed completo como `lanube_app` y comprueba ~40 permisos (lo que la app
  puede y lo que no). También corre en CI (job `db-roles`) y bloquea el deploy si falla.
- **Migrar un servidor que ya estaba andando con el superusuario**: poné las dos contraseñas nuevas en
  `postgres.env`, creá `migrator.env`, cambiá la URL de `lanube.env` a `lanube_app`, corré
  `sudo lanube-db-roles` y reiniciá la app (`docker compose up -d app`). Volver atrás: poné de nuevo
  la URL del superusuario en `lanube.env`.

### Mantenimiento mensual (a mano, a propósito)

Las actualizaciones automáticas cubren solo los paquetes de Ubuntu. Lo siguiente **no** se actualiza solo,
y los parches de seguridad de Docker, Caddy y Postgres dependen de que lo hagas:

```bash
sudo apt update && sudo apt upgrade        # incluye Docker y Caddy (repos de terceros)
cd /srv/lanube && sudo docker compose pull postgres && sudo docker compose up -d postgres   # parches menores de Postgres (corte de segundos)
```

Guardá una copia de `/srv/lanube/lanube.env` y `postgres.env` en tu gestor de contraseñas: no están en
ningún backup, y sin ellos reconstruir el servidor significa rotar todos los secretos.

## 8. Lo que este setup NO resuelve (decisiones pendientes tuyas)

- **Backups fuera del servidor.** Los de `/var/backups/lanube` viven en el mismo disco: cubren un
  error o una migración mala, **no** perder el VPS. Dejá un ejecutable en `/etc/lanube/offsite.sh`
  (recibe el directorio de backups; rclone/restic a B2 o S3) — el timer diario ya lo invoca. Probá
  una restauración al menos una vez.
- **Datos de producción actuales** (la app corre hoy en Vercel): el plan de prueba, corte y vuelta
  atrás está en [`MIGRATION.md`](./MIGRATION.md).
- **Monitoreo/alertas**: nada avisa si el sitio cae o un cron falla. Mínimo: un monitor externo
  (UptimeRobot/Better Stack) sobre `https://DOMINIO/api/maintenance`.
- **Filtrado de salida** de los contenedores y **auditd/AIDE**: no incluidos; el egreso de la app
  necesita SMTP, Turnstile, DNS.
- **Restricción de SSH por origen**: es `SSH_ALLOW_FROM` (§3). Conviene además que el firewall del
  proveedor limite el 22, así hay dos capas independientes.
- **Aviso de fallos de deploy**: GitHub queda en verde apenas mueve el tag; si el deploy falla en el
  servidor, solo lo ves en el journal. Un monitor externo del sitio cubre lo grave.
- **El usuario administrador y el grupo `docker`**: pertenecer a él equivale a ser root sin contraseña
  (`docker run -v /:/h …`), y también da acceso a todos los secretos (`docker inspect`). Si tu usuario
  está en ese grupo, la contraseña de `sudo` no protege nada; sacalo (`sudo gpasswd -d <admin> docker`)
  si no lo necesitás, y usá `sudo docker …`.
- **Roles de Postgres separados** (ver «Roles de la base»): la app no es superusuaria ni dueña del
  esquema. Lo que sigue pudiendo una app comprometida es leer y escribir los **datos** (es lo que
  hace normalmente); no puede alterar el esquema, leer archivos ni ejecutar comandos en el contenedor.
- **Las imágenes se identifican por tag (`:<sha>`), que en un registro es mutable**: quien pueda
  empujar a GHCR podría reemplazar la imagen de un commit. Es el mismo grupo que puede empujar a `main`,
  por eso importa proteger la rama y las cuentas con acceso de escritura (activá 2FA). Fijar por
  digest o firmar con cosign lo cerraría; no está hecho.
- **Quién escribe en el repo despliega a producción.** Ese es el modelo de confianza completo del
  deploy por pull; las mitigaciones son las del punto de GitHub de §5.
- **Recursos del contenedor** (`mem_limit`/`cpus`): dependen del tamaño del VPS; no se fijaron.
- Acciones de GitHub fijadas por tag mayor, no por SHA.
