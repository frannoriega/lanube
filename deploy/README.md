# Despliegue en un servidor (VPS)

Este documento describe cómo ejecutar La Nube en un servidor propio con Ubuntu, mediante Docker, con
despliegue automático desde GitHub. Incluye los scripts de aprovisionamiento y endurecimiento, la
configuración de la aplicación y los procedimientos de operación habituales.

Los scripts superan `bash -n` y la imagen se verificó con las mismas restricciones que en producción
(sistema de archivos de solo lectura, sin _capabilities_, usuario sin privilegios). La instalación
sobre un servidor real no se verificó de extremo a extremo: la primera ejecución es la prueba
definitiva, por lo que el aprovisionamiento se divide en dos pasos que no pueden dejar al
administrador sin acceso.

## 1. Arquitectura

```
Internet ─► Cloudflare (proxy, WAF) ─► :443 del servidor
                                         │  UFW · Caddy
                                         ▼
                                  127.0.0.1:3000  aplicación (Docker)
                                         │
                                   red interna de Docker ─► PostgreSQL 17
```

| Componente              | Función                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Cloudflare              | Proxy, WAF y TLS de cara al público                                                 |
| UFW y fail2ban          | Firewall del servidor y bloqueo de intentos de acceso repetidos                     |
| Caddy (en el servidor)  | Proxy inverso hacia la aplicación                                                   |
| Aplicación y PostgreSQL | Contenedores Docker; solo la aplicación publica un puerto, y únicamente en loopback |
| Imagen en GHCR          | Construida por CI; el servidor no compila ni contiene el código fuente              |
| Temporizadores systemd  | Tareas programadas, copias de seguridad y despliegue automático por extracción      |

## 2. Requisitos previos

- Servidor con Ubuntu 22.04 o 24.04, acceso `root` por SSH para el aprovisionamiento inicial y su IP.
- Dominio gestionado en Cloudflare, con el proxy activado.
- Clave SSH pública del administrador y, opcionalmente, el rango de red desde el que se permitirá
  SSH (`SSH_ALLOW_FROM`, sección 3).
- Dirección IP pública con el puerto 443 accesible desde Cloudflare.
- Un disco o volumen montado en `/data` (o las rutas alternativas de la sección «Rutas», más abajo).
- Claves reales de Cloudflare Turnstile para el dominio y credenciales de un servidor SMTP.
- En Cloudflare (_SSL/TLS_ del dominio):
  - Modo **Full (strict)**, _Always Use HTTPS_ y versión mínima de TLS 1.2.
  - Un certificado de origen (_Origin Server_), cuyos archivos `origin.pem` y `origin.key` se instalan
    en el servidor (sección 4), y **Authenticated Origin Pulls** activado.
  - Las rutas que consumen clientes que no son navegadores (`/api/mcp`, `/api/oauth/*` y
    `/.well-known/oauth-*`) no deben someterse a desafíos interactivos del WAF; `/uploads/` es
    contenido público estático.
  - Una regla de transformación de encabezados de petición (_Rules → Transform Rules → Modify Request
    Header_) que establezca el encabezado estático `X-Origin-Token` con el valor que muestra
    `enable-public-site` (sección 4), aplicada a todo el nombre de host. Sin ella, el sitio no
    responde. El valor es un secreto: no debe incluirse en el repositorio ni compartirse por canales
    no seguros.

## 3. Aprovisionamiento

### 3.1 Instalación base

```bash
scp -r deploy root@servidor:/root/deploy
ssh root@servidor
ADMIN_USER=<usuario> ADMIN_SSH_PUBKEY='ssh-ed25519 AAAA… usuario@equipo' \
SSH_ALLOW_FROM='<red/prefijo>' DOMAIN=<dominio> \
IMAGE_REPO=ghcr.io/<owner>/<repo> \
bash /root/deploy/scripts/01-bootstrap.sh
```

### Rutas

Todo lo que no es configuración del sistema cuelga de `/data`, con cuatro directorios hermanos. Los
valores por defecto se pueden cambiar con variables de entorno al ejecutar el bootstrap (se guardan
en `/etc/lanube/deploy.conf`, que leen todos los scripts):

| Variable     | Valor por defecto        | Contenido                                                                                      |
| ------------ | ------------------------ | ---------------------------------------------------------------------------------------------- |
| `APP_DIR`    | `/data/docker`           | `compose.yml`, `.env`, `lanube.env` y `postgres.env`                                           |
| `DATA_DIR`   | `/data/volumenes/lanube` | Datos vivos: `postgres/`, `uploads/` y `autodeploy/` (estado del despliegue automático)        |
| `BACKUP_DIR` | `/data/backup/lanube`    | Volcados de la base (`db-*.dump`) e instantáneas de `uploads/`                                 |
| `SCRIPT_DIR` | `/data/script/lanube`    | Scripts de operación (`lanube-*`, `enable-public-site`…), la plantilla de Caddy y `offsite.sh` |

- En `/usr/local/bin` quedan **enlaces simbólicos** a los scripts, para conservar los nombres cortos
  y que las unidades de systemd y `sudo` los encuentren. `SCRIPT_DIR` debe ser de `root` y no
  escribible por otros: lo ejecuta `root`.
- `compose.yml` monta los datos con rutas **relativas al archivo** (`../volumenes/lanube/postgres` y
  `../volumenes/lanube/uploads`), por lo que `DATA_DIR` debe ser `<APP_DIR>/../volumenes/lanube`; el
  bootstrap lo comprueba y se detiene si no coincide. Si se quiere otra estructura, hay que ajustar
  también esos montajes.
- Dueños: `uploads/` del uid 1000 (usuario `node` de la imagen) y `postgres/` del uid 999 (lo asigna
  PostgreSQL al inicializar). Hay que conservarlos al mover los datos; `lanube-doctor` lo comprueba.
- La caché de Next (`next_cache`) es un volumen de Docker: es regenerable y no necesita copia.
- La configuración del sistema permanece en `/etc/lanube` (`deploy.conf`) y `/etc/caddy` (Caddyfile,
  sitios, certificados de origen y `origin-token`).

El script `01-bootstrap.sh` instala Docker, Caddy, UFW, fail2ban y las actualizaciones automáticas de seguridad (con
reinicio a las 07:30 cuando un paquete lo requiere; otro archivo de `/etc/apt/apt.conf.d/` posterior
puede desactivarlo), crea el usuario administrador, aplica los ajustes de `sysctl`, e instala los
scripts `lanube-*` y sus temporizadores. Es idempotente. **No modifica todavía el acceso por
contraseña de SSH.**

`SSH_ALLOW_FROM` (CIDR, separados por coma) limita el puerto 22 a esos orígenes. El script aborta si la sesión desde la que se ejecuta no pertenece a un rango permitido.
Es opcional: sin él, SSH queda abierto con límite de tasa.
El origen de la sesión se toma de `SSH_CLIENT_IP` si se define, y en su defecto de `who -m` o de
`SSH_CONNECTION` (primer campo, que se consulta con `echo $SSH_CONNECTION`). Los orígenes permitidos se excluyen del bloqueo
de fail2ban. Los valores de fail2ban se instalan en `/etc/fail2ban/jail.d/00-lanube.conf`: cualquier
ajuste propio en un archivo `.local` (`jail.local` o `jail.d/*.local`) prevalece sobre ellos y el
bootstrap nunca lo modifica.

**El bootstrap se puede volver a ejecutar sin pisar ajustes ajenos.** Solo escribe archivos con nombre
propio y deja que prevalezca lo que otro defina después: `00-lanube.conf` (fail2ban),
`52lanube-unattended` (apt; no toca `20auto-upgrades` ni `50unattended-upgrades`),
`60-lanube-hardening.conf` (sysctl, por debajo de cualquier `99-*`) y, en UFW, solo reglas con
comentario `lanube-ssh`, `lanube-ssh-allowed` y `cloudflare-443`. El `Caddyfile` es el único archivo
compartido que reemplaza (los sitios propios van en `/etc/caddy/sites/*.caddy`); si encuentra uno que
no es de La Nube, guarda antes una copia `Caddyfile.bak-*`.

Si varios administradores acceden a través de una VPN o un NAT, el servidor los ve con la misma
dirección: un bloqueo o el límite de tasa los afectaría a todos a la vez. Por eso conviene indicar en
`SSH_ALLOW_FROM` el rango completo de esa red.

### 3.2 Política de acceso SSH

Una vez comprobado, desde **otra** terminal, que el usuario administrador accede con su clave y que
`sudo` funciona, se aplica la política de acceso:

```bash
sudo ADMIN_USER=<usuario1> \
     SSH_KEY_USERS="root" \
     SSH_PASSWORD_USERS="<usuario2>" \
     bash /root/deploy/scripts/02-lock-ssh.sh
```

| Variable             | Acceso                                                                   | Obligatoria |
| -------------------- | ------------------------------------------------------------------------ | ----------- |
| `ADMIN_USER`         | Solo con clave pública (y túnel de pruebas, ver `MIGRATION.md`)          | Sí          |
| `SSH_KEY_USERS`      | Otros usuarios que acceden únicamente con clave pública; `root` incluido | No          |
| `SSH_PASSWORD_USERS` | Usuarios que acceden únicamente con contraseña                           | No          |

Cualquier otro usuario queda sin acceso. Si `root` no figura en `SSH_KEY_USERS`, su acceso por SSH se
deshabilita. Antes de recargar, el script comprueba que cada usuario con clave tenga una
`authorized_keys` instalada y que cada usuario con contraseña la tenga definida, y valida la
configuración resultante; ante cualquier fallo, no recarga. Las sesiones abiertas no se interrumpen,
pero debe verificarse el acceso de cada usuario desde una sesión nueva antes de cerrar la original.

Si el servidor ya define una política de acceso en `/etc/ssh/sshd_config.d/`, rige el primer valor
que sshd lee, en orden alfabético de archivo: un archivo anterior a `00-lanube-hardening.conf`
prevalece sobre este script. Conviene revisar el resultado con `sudo sshd -T`.

Los ajustes comunes son: `MaxAuthTries 3`, sin reenvíos de puertos ni de agente (salvo el túnel del
administrador), algoritmos criptográficos modernos y registro detallado.

## 4. Configuración del servidor

1. Editar `/data/docker/postgres.env` y `/data/docker/lanube.env`, instalados como plantillas con valores
   `CAMBIAR`. La contraseña de PostgreSQL debe coincidir en ambos (valor hexadecimal recomendado:
   `openssl rand -hex 24`). Generar secretos nuevos para `NEXTAUTH_SECRET` y `CRON_SECRET`. La
   contraseña de la base de datos debe definirse **antes del primer despliegue**, porque PostgreSQL la
   fija al inicializar el volumen.
2. Instalar el certificado de origen en `/etc/caddy/certs/origin.pem` y `origin.key` (propietario
   `root:caddy`, permisos `640`) y ejecutar `sudo enable-public-site <dominio>`. Si el certificado lo
   emite un tercero, la clave se genera en el servidor y solo se entrega la solicitud de firma:
   `sudo openssl req -new -newkey rsa:2048 -nodes -keyout /etc/caddy/certs/origin.key -out origin.csr -subj "/CN=<dominio>"`.
   El token `X-Origin-Token` puede definirse antes escribiéndolo en `/etc/caddy/origin-token`; si el
   archivo no existe, el comando genera uno. El
   comando valida la configuración antes de activar el sitio público y muestra el valor de
   `X-Origin-Token` para la regla de Cloudflare (sección 2). Hasta entonces, Caddy solo atiende un
   _listener_ de pruebas en `127.0.0.1:8080`, accesible mediante túnel SSH (ver `MIGRATION.md`).
3. Autenticar el servidor en el registro de imágenes: `sudo docker login ghcr.io` con un _personal
   access token_ clásico con el único permiso `read:packages` (los tokens de granularidad fina no son
   compatibles con GHCR). Si el paquete es público, este paso no es necesario.
4. Ejecutar `sudo lanube-doctor` (sección 7) para comprobar el estado general.

## 5. GitHub Actions

En el repositorio, en _Settings → Secrets and variables → Actions_:

| Nombre                                   | Valor                                                                   |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| variable `NEXT_PUBLIC_TURNSTILE_SITEKEY` | La _sitekey_ real de Turnstile (se incorpora al _bundle_ al construir). |

No se requieren secretos: el despliegue es por extracción. Para que el servidor pueda descargar las
imágenes, el paquete `lanube` en GHCR debe ser público (recomendado, ya que la imagen no contiene
secretos) o el servidor debe autenticarse con `docker login ghcr.io` (sección 4).

Medidas recomendadas:

- Restringir el entorno `production` a la rama `main`:
  `gh api -X PUT repos/<owner>/<repo>/environments/production --input - <<< '{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}'`
  y a continuación
  `gh api -X POST repos/<owner>/<repo>/environments/production/deployment-branch-policies -f name=main`.
- Exigir _required reviewers_ en ese entorno si se desea aprobar cada despliegue.
- Proteger `main` (_Settings → Branches_): quien pueda escribir en esa rama despliega a producción.
- Mantener activo Dependabot (`.github/dependabot.yml`); las acciones están fijadas por SHA.

Cada _push_ a `main` ejecuta _lint_, comprobación de formato y pruebas; construye las imágenes (de la
aplicación y de las migraciones), las publica en GHCR y mueve el tag `production` al commit. El
servidor detecta el cambio en su siguiente ventana (de lunes a jueves a las 20:00, hora de Argentina;
un _push_ del viernes se despliega el lunes) y ejecuta `lanube-deploy`. El resultado no se refleja en
GitHub: se consulta en el servidor (sección 7).

## 6. Despliegue (`lanube-deploy`)

1. Descarga las imágenes de la aplicación y del migrador **del mismo commit**.
2. Genera un volcado previo de la base de datos (`/data/backup/lanube/db-predeploy-<sha>.dump`).
3. Aplica las migraciones (`prisma migrate deploy`). Si fallan, la versión anterior no se modifica.
4. Recrea la aplicación y espera a que supere la comprobación de estado; si no queda saludable,
   **restablece la imagen anterior**.

> **Advertencia.** El restablecimiento de la imagen **no revierte las migraciones**. Estas deben ser
> compatibles hacia atrás (agregar, migrar datos y solo después eliminar), de modo que la versión
> anterior funcione con el esquema nuevo. Si una migración dañó datos, debe restaurarse el volcado
> (sección 7).

### Despliegue manual

El despliegue automático es una comodidad; todo puede hacerse manualmente, cualquier día de la
semana (las restricciones horarias pertenecen únicamente al temporizador). Los comandos se ejecutan en
el servidor:

| Objetivo                                                        | Comando                                                                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Desplegar de inmediato la última versión publicada por CI       | `sudo lanube-autodeploy --now`                                                                               |
| Desplegar un commit concreto (también sirve para volver atrás)  | `sudo lanube-deploy deploy <sha de 40 caracteres>`                                                           |
| Consultar la versión desplegada                                 | `grep IMAGE_TAG /data/docker/.env`                                                                           |
| Consultar la versión que desplegará el próximo ciclo automático | `curl -s https://api.github.com/repos/<owner>/<repo>/git/ref/tags/production \| jq -r .object.sha`           |
| Pausar los despliegues automáticos                              | `sudo systemctl disable --now lanube-autodeploy.timer` (para reanudar: `enable --now`)                       |
| Consultar el resultado del último despliegue automático         | `sudo journalctl -u lanube-autodeploy -n 100` (en un despliegue manual, la salida se muestra en el terminal) |

Observaciones:

- `lanube-deploy` requiere que las imágenes del commit existan en GHCR, es decir, que CI las haya
  construido (todo commit que llegó a `main` y superó las pruebas las tiene). Un SHA que nunca se
  construyó falla en la descarga, sin modificar nada.
- El SHA completo se obtiene con `git rev-parse HEAD` o con
  `gh run list -R <owner>/<repo> --workflow deploy.yml`.
- Un despliegue manual no es sobrescrito por el temporizador: este solo actúa cuando el tag
  `production` cambia respecto de la última versión observada o de la desplegada. Tras volver a un
  commit anterior, el servidor permanece en él hasta que se publique una versión nueva.
- Para construir una rama sin pasar por `main`:
  `gh workflow run deploy.yml -R <owner>/<repo> --ref <rama>`. Construye las imágenes pero no mueve el
  tag `production`; para desplegarlas, usar `sudo lanube-deploy deploy <sha de la rama>`.
- El restablecimiento automático ante una aplicación no saludable rige también para los despliegues manuales.
- Un bloqueo (`/var/lock/lanube-deploy`) impide que dos despliegues se ejecuten a la vez.

## 7. Operación

`sudo lanube-doctor` revisa la instalación sin modificar nada ni mostrar secretos: configuración,
contenedores y puertos publicados, Caddy y certificados, firewall, fail2ban, acceso SSH (solo
lectura), temporizadores, copias y estado general del sistema. Cada comprobación termina en `OK`,
`AVISO`, `FALLO` o `INFO`, y el código de salida es distinto de cero si hay algún fallo.

```bash
cd /data/docker
sudo docker compose ps ; sudo docker compose logs -f app
systemctl list-timers 'lanube-*'                      # próximas tareas programadas y copias
sudo journalctl -u lanube-cron-maintain -n 50         # última ejecución del cron de reservas
sudo lanube-cron maintain-reservations                # ejecutarlo manualmente
sudo journalctl -u lanube-autodeploy -n 50            # qué se desplegó (o por qué no)
sudo tail -f /var/log/caddy/access.log
sudo fail2ban-client status sshd
```

### Restauración de la base de datos

Con la aplicación detenida:

```bash
cd /data/docker && sudo docker compose stop app
sudo docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  < /data/backup/lanube/db-<etiqueta>.dump
sudo lanube-deploy deploy <sha-de-la-versión-estable>   # o: docker compose up -d app
```

### Mantenimiento de emergencia

Las funciones SQL `maintenance_*` permiten gestionar las ventanas de mantenimiento sin la aplicación,
mediante `docker compose exec postgres psql`. Su descripción está en
`docs/milestones/milestones-22-maintenance-mode.md`.

### Mantenimiento periódico

Las actualizaciones automáticas cubren únicamente los paquetes de Ubuntu. Docker, Caddy y PostgreSQL
requieren actualización manual:

```bash
sudo apt update && sudo apt upgrade        # incluye Docker y Caddy
cd /data/docker && sudo docker compose pull postgres && sudo docker compose up -d postgres   # parches menores; corte de unos segundos
```

Se recomienda conservar una copia de `/data/docker/lanube.env` y `postgres.env` en un gestor de
secretos: `lanube-backup` no los incluye (están en `APP_DIR`, no en `BACKUP_DIR`), y sin ellos
reconstruir el servidor implica rotar todos los secretos. Si existe una copia externa que abarque
`/data`, `/etc/caddy` o `/etc/lanube`, esos secretos, la clave del certificado de origen y el
`origin-token` viajan en ella: hay que proteger el destino como si fuera el servidor.

## 8. Limitaciones y decisiones pendientes

- **Copias de seguridad fuera del servidor.** Las de `/data/backup/lanube` residen en el mismo disco:
  cubren un error o una migración defectuosa, pero no la pérdida del servidor. Un ejecutable en
  `/data/script/lanube/offsite.sh` (que recibe el directorio de copias; por ejemplo, rclone o restic
  hacia un almacenamiento de objetos) es invocado por el temporizador diario. Si en cambio se copia
  el disco entero con una herramienta externa, conviene **excluir `/data/volumenes/lanube/postgres`**:
  copiar los archivos de un PostgreSQL en marcha no garantiza una copia consistente, y los volcados de
  `/data/backup/lanube` son el punto de restauración fiable. Se recomienda verificar una restauración
  al menos una vez.
- **Migración de datos desde Vercel.** El procedimiento está en [`MIGRATION.md`](./MIGRATION.md).
- **Monitorización y alertas.** Nada notifica si el sitio deja de responder o falla una tarea
  programada. Se recomienda un monitor externo sobre `https://<dominio>/api/maintenance`.
- **Notificación de fallos de despliegue.** GitHub registra el flujo de trabajo como exitoso en cuanto
  mueve el tag; si el despliegue falla en el servidor, solo se aprecia en el registro de `journald`.
- **Grupo `docker`.** Pertenecer a él equivale a ser superusuario y permite leer todos los secretos de
  `lanube.env` (`docker inspect`). Conviene limitarlo a quien lo necesite.
- **Privilegios en PostgreSQL.** La aplicación se conecta como superusuario del contenedor de la base
  de datos. Separar un rol de aplicación con permisos mínimos del propietario del esquema (utilizado
  por las migraciones) requiere un trabajo específico, porque las migraciones crean funciones y
  _triggers_.
- **Etiquetas de imagen mutables.** Las imágenes se identifican por etiqueta (`:<sha>`), que en un
  registro puede reasignarse. Quien puede publicar en GHCR podría sustituir la imagen de un commit; es
  el mismo grupo que puede escribir en `main`. Se recomienda proteger la rama y exigir autenticación en
  dos pasos. Fijar las imágenes por _digest_ o firmarlas mitigaría el riesgo; no está implementado.
- **Modelo de confianza del despliegue.** Quien puede escribir en el repositorio despliega a
  producción; las mitigaciones son las de la sección 5.
- **Recursos de los contenedores.** `mem_limit` y `cpus` dependen del tamaño del servidor y no se
  han fijado.
