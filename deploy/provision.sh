#!/usr/bin/env bash
# Prepara un Ubuntu Server 26.04 LTS limpio para correr La Nube (milestone 26). Idempotente:
# se puede volver a correr. Hay que ejecutarlo como root, con esta carpeta `deploy/` copiada al
# servidor (el script instala desde sus archivos hermanos):
#
#   scp -r deploy usuario@servidor:~/lanube-deploy
#   ssh usuario@servidor 'sudo bash ~/lanube-deploy/provision.sh'
#
# Qué hace: paquetes base, Docker, usuario `deploy`, directorios, swap, firewall, zona horaria
# UTC + hora sincronizada, rotación de logs de Docker, actualizaciones automáticas de seguridad
# (con reinicio a las 07:30 UTC, fuera de la ventana de los crons) e instala el launcher y los
# timers de systemd. NO crea el .env, NO baja imágenes y NO habilita los timers: eso va después
# del primer deploy (ver deploy/README.md).
#
# Opt-in: HARDEN_SSH=1 desactiva el ingreso por contraseña y de root por SSH. Probalo recién
# cuando ya entraste con tu llave en OTRA sesión; si no, podés quedarte afuera.
set -Eeuo pipefail

[ "$(id -u)" -eq 0 ] || { echo "ejecutar como root (sudo)" >&2; exit 1; }
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$HERE/bootstrap/lanube-deploy" ] || { echo "falta $HERE/bootstrap/lanube-deploy: copiá toda la carpeta deploy/" >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive
say() { printf '\n==> %s\n' "$*"; }

say "Paquetes base"
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg ufw fail2ban unattended-upgrades chrony restic jq

say "Zona horaria UTC y reloj sincronizado"
# El RRULE se expande en SQL con now(): un reloj corrido movería reservas.
timedatectl set-timezone UTC
systemctl enable --now chrony

say "Docker"
if ! command -v docker >/dev/null 2>&1; then
  . /etc/os-release
  # Se usa el repo oficial de Docker SOLO si ya publica esta versión de Ubuntu; si no, el
  # paquete de la distro. Verificado en vivo porque 26.04 es reciente.
  if curl -fsI "https://download.docker.com/linux/ubuntu/dists/${VERSION_CODENAME}/Release" >/dev/null 2>&1; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
      >/etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  else
    echo "Docker todavía no publica '${VERSION_CODENAME}': se usa docker.io de Ubuntu."
    apt-get install -y docker.io docker-compose-v2
  fi
fi
docker compose version >/dev/null || { echo "falta el plugin 'docker compose'" >&2; exit 1; }
if [ ! -f /etc/docker/daemon.json ]; then
  # Los logs de los contenedores crecen sin límite por defecto.
  cat >/etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "5" } }
JSON
  systemctl restart docker
fi
systemctl enable --now docker

say "Usuario deploy"
id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "La Nube deploy" deploy
# ⚠️ El grupo docker equivale a root en este servidor: por eso el usuario es solo para esto y la
# llave de CI va con `restrict,command=` (ver README).
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

say "Directorios"
install -d -m 755 -o deploy -g deploy /opt/lanube /opt/lanube/bin /opt/lanube/state /opt/lanube/releases
install -d -m 755 -o deploy -g deploy /srv/lanube /srv/lanube/backups
install -d -m 755 /srv/lanube/pgdata   # lo reasigna el contenedor de Postgres
install -m 755 -o deploy -g deploy "$HERE/bootstrap/lanube-deploy" /opt/lanube/bin/lanube-deploy
[ -f /opt/lanube/.env ] || { touch /opt/lanube/.env; chown deploy:deploy /opt/lanube/.env; }
chmod 600 /opt/lanube/.env

say "Swap de 2 GB"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi
echo 'vm.swappiness=10' >/etc/sysctl.d/99-lanube.conf
sysctl --system >/dev/null

say "Firewall"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

say "Actualizaciones automáticas de seguridad"
cat >/etc/apt/apt.conf.d/52lanube-unattended <<'CONF'
// Reinicia solo si hace falta (kernel), fuera de la ventana de los crons (05:00 UTC).
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "07:30";
CONF
systemctl enable --now unattended-upgrades

say "fail2ban (sshd)"
systemctl enable --now fail2ban

if [ "${HARDEN_SSH:-0}" = 1 ]; then
  say "Endurecer SSH"
  cat >/etc/ssh/sshd_config.d/10-lanube.conf <<'CONF'
PasswordAuthentication no
PermitRootLogin no
CONF
  sshd -t && systemctl reload ssh
else
  echo "(SSH sin endurecer: corré de nuevo con HARDEN_SSH=1 cuando ya entres con tu llave)"
fi

say "Units de systemd (instaladas, NO habilitadas)"
install -m 644 "$HERE"/systemd/*.service "$HERE"/systemd/*.timer /etc/systemd/system/
systemctl daemon-reload

cat <<'NEXT'

LISTO. Falta, en este orden (detalle en deploy/README.md):
  1. Crear /opt/lanube/.env (plantilla: env.example, sección «Producción en VPS»).
  2. Como `deploy`:  docker login ghcr.io   (token de solo lectura, read:packages).
  3. Agregar la llave de CI a /home/deploy/.ssh/authorized_keys:
       restrict,command="/opt/lanube/bin/lanube-deploy" ssh-ed25519 AAAA… ci-lanube
  4. Primer deploy; después:  sudo systemctl enable --now \
       lanube-cron-maintain-reservations.timer lanube-cron-report-snapshot.timer \
       lanube-cron-sync-holidays.timer lanube-backup.timer
NEXT
