#!/usr/bin/env bash
# Provisiona y endurece un Ubuntu 22.04/24.04 limpio para correr La Nube. Idempotente: se puede
# volver a correr. Se ejecuta como root, UNA vez, desde una sesión SSH que se deja abierta.
#
#   scp -r deploy root@VPS:/root/deploy
#   ssh root@VPS
#   ADMIN_USER=<admin> ADMIN_SSH_PUBKEY='ssh-ed25519 AAAA… yo@laptop' \
#   SSH_ALLOW_FROM='203.0.113.0/24' DOMAIN=lanube.example \
#   DATA_DIR=/mnt/data/lanube IMAGE_REPO=ghcr.io/OWNER/lanube \
#   bash /root/deploy/scripts/01-bootstrap.sh
#
# NO desactiva el login por contraseña de SSH: eso lo hace 02-lock-ssh.sh, recién cuando
# comprobaste que entrás con tu clave como ADMIN_USER. Así no hay forma de quedar afuera.
set -euo pipefail

: "${ADMIN_USER:?falta ADMIN_USER}" "${ADMIN_SSH_PUBKEY:?falta ADMIN_SSH_PUBKEY}"
: "${DOMAIN:?falta DOMAIN}"
# SSH_ALLOW_FROM (opcional, recomendado): CIDRs desde los que se permite SSH, separados por coma.
# Sin él, SSH queda abierto a cualquiera con límite de tasa. Ver deploy/README.md §3.
: "${DATA_DIR:?falta DATA_DIR (volumen persistente)}" "${IMAGE_REPO:?falta IMAGE_REPO}"
[ "$(id -u)" = 0 ] || { echo "Correr como root"; exit 1; }
[[ "$DOMAIN" =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$ ]] || { echo "DOMAIN inválido: $DOMAIN"; exit 1; }
HERE="$(cd "$(dirname "$0")/.." && pwd)"
# Copia incompleta de deploy/ (p. ej. solo scripts/): mejor fallar acá que a mitad de la instalación.
for f in Caddyfile compose.yml caddy/loopback.caddy caddy/public.caddy lanube.env.example \
  postgres.env.example systemd/lanube-autodeploy.timer scripts/lanube-deploy scripts/lanube-autodeploy \
  scripts/enable-public-site scripts/lanube-import-vercel scripts/lanube-verify-uploads; do
  [ -e "$HERE/$f" ] || { echo "Falta $HERE/$f: copiá la carpeta deploy/ ENTERA (rsync -a --delete deploy/ usuario@VPS:~/deploy/)"; exit 1; }
done
APP_DIR=/srv/lanube
export DEBIAN_FRONTEND=noninteractive

log() { printf '\n==> %s\n' "$*"; }

# ---------------------------------------------------------------------------------------------
log "Paquetes base y actualizaciones automáticas de seguridad"
# Si una corrida anterior dejó la lista de Caddy rota, `apt-get update` fallaría antes de poder
# arreglarla; se la borra y el paso de Caddy la vuelve a escribir bien.
if [ -f /etc/apt/sources.list.d/caddy-stable.list ] && ! command -v caddy >/dev/null; then
  rm -f /etc/apt/sources.list.d/caddy-stable.list
fi
apt-get update -y
apt-get upgrade -y
apt-get install -y ufw fail2ban unattended-upgrades apt-listchanges curl ca-certificates gnupg \
  rsync jq sudo logrotate
timedatectl set-ntp true || true

cat >/etc/apt/apt.conf.d/52lanube-unattended <<'CONF'
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
// Un kernel nuevo no protege hasta reiniciar. Los contenedores tienen restart: unless-stopped.
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "07:30";
CONF
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
CONF

# ---------------------------------------------------------------------------------------------
log "Usuario admin: $ADMIN_USER (sudo con contraseña; SSH solo por clave)"
if ! id "$ADMIN_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$ADMIN_USER"
  usermod -aG sudo "$ADMIN_USER"
  echo ">> Definí la contraseña de $ADMIN_USER (solo se usa para sudo; SSH será solo por clave):"
  passwd "$ADMIN_USER"
fi
install -d -m 700 -o "$ADMIN_USER" -g "$ADMIN_USER" "/home/$ADMIN_USER/.ssh"
grep -qxF "$ADMIN_SSH_PUBKEY" "/home/$ADMIN_USER/.ssh/authorized_keys" 2>/dev/null \
  || echo "$ADMIN_SSH_PUBKEY" >>"/home/$ADMIN_USER/.ssh/authorized_keys"
chown "$ADMIN_USER:$ADMIN_USER" "/home/$ADMIN_USER/.ssh/authorized_keys"
chmod 600 "/home/$ADMIN_USER/.ssh/authorized_keys"
# Los deploys son por PULL (lanube-autodeploy): ninguna clave de CI entra por SSH al servidor.
if id lanube-ci >/dev/null 2>&1; then
  echo "AVISO: existe el usuario lanube-ci de una versión anterior; ya no se usa. Quitarlo:"
  echo "       sudo deluser --remove-home lanube-ci && sudo rm -f /etc/sudoers.d/lanube-ci"
fi

# ---------------------------------------------------------------------------------------------
log "Docker (repositorio oficial) con daemon endurecido"
if command -v docker >/dev/null && [ -n "$(docker ps -q 2>/dev/null)" ]; then
  echo "AVISO: ya hay contenedores corriendo; reiniciar Docker los reinicia (si tienen restart policy vuelven)."
fi
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
cat >/etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "live-restore": true,
  "no-new-privileges": true,
  "userland-proxy": false
}
JSON
systemctl enable --now docker
systemctl restart docker
# Pertenecer al grupo docker equivale a ser root sin contraseña. No se quita a un usuario que ya
# existía (puede ser de quien administra el servidor): se avisa y se decide a mano.
if id -nG "$ADMIN_USER" | grep -qw docker; then
  echo "AVISO: $ADMIN_USER está en el grupo docker (root-equivalente, sin pedir contraseña)."
  echo "       Si no lo necesita:  sudo gpasswd -d $ADMIN_USER docker"
fi

# ---------------------------------------------------------------------------------------------
log "Caddy (repositorio oficial)"
if ! command -v caddy >/dev/null; then
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  # La lista de Caddy ya trae su `signed-by`: se instala tal cual, sin tocarla.
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    >/etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi
install -d -m 750 -o root -g caddy /etc/caddy/certs
install -d -m 750 -o caddy -g caddy /var/log/caddy
install -m 644 "$HERE/Caddyfile" /etc/caddy/Caddyfile
install -d /etc/caddy/sites /usr/local/share/lanube/caddy
install -m 644 "$HERE/caddy/loopback.caddy" /etc/caddy/sites/00-loopback.caddy
install -m 644 "$HERE/caddy/public.caddy" /usr/local/share/lanube/caddy/public.caddy
# CA de «Authenticated Origin Pulls» de Cloudflare (pública, fija).
curl -fsSL https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem \
  -o /etc/caddy/certs/cloudflare-origin-pull-ca.pem
chown root:caddy /etc/caddy/certs/cloudflare-origin-pull-ca.pem

# ---------------------------------------------------------------------------------------------
log "Directorios de la app y del volumen persistente"
install -d -m 755 "$APP_DIR"
install -d -m 700 /var/backups/lanube /etc/lanube
install -d -m 700 "$DATA_DIR/postgres"       # lo reasigna al uid 999 el entrypoint de Postgres
install -d -m 755 "$DATA_DIR/uploads"
chown -R 1000:1000 "$DATA_DIR/uploads"       # uid de `node` dentro de la imagen
install -m 644 "$HERE/compose.yml" "$APP_DIR/compose.yml"
[ -f "$APP_DIR/lanube.env" ] || { install -m 600 "$HERE/lanube.env.example" "$APP_DIR/lanube.env"; NEED_ENV=1; }
[ -f "$APP_DIR/postgres.env" ] || { install -m 600 "$HERE/postgres.env.example" "$APP_DIR/postgres.env"; NEED_ENV=1; }
# Variables de interpolación de compose; `lanube-deploy` actualiza IMAGE_TAG.
[ -f "$APP_DIR/.env" ] || printf 'IMAGE_REPO=%s\nIMAGE_TAG=none\nDATA_DIR=%s\n' "$IMAGE_REPO" "$DATA_DIR" >"$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"
printf 'APP_DIR=%s\nIMAGE_REPO=%s\n' "$APP_DIR" "$IMAGE_REPO" >/etc/lanube/deploy.conf

# ---------------------------------------------------------------------------------------------
log "Scripts de operación"
for s in lanube-deploy lanube-autodeploy lanube-backup lanube-cron update-cloudflare-ips enable-public-site lanube-import-vercel lanube-verify-uploads; do
  install -m 755 -o root -g root "$HERE/scripts/$s" "/usr/local/bin/$s"
done
# ---------------------------------------------------------------------------------------------
log "Timers: crons de la app (ex Vercel Crons) y backups"
install -m 644 "$HERE"/systemd/*.service "$HERE"/systemd/*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now lanube-cron-maintain.timer lanube-cron-report-snapshot.timer \
  lanube-cron-sync-holidays.timer lanube-backup.timer lanube-cloudflare-ips.timer lanube-autodeploy.timer

# ---------------------------------------------------------------------------------------------
log "Firewall: SSH limitado + 443 solo desde Cloudflare (todo lo demás cerrado)"
sed -i 's/^IPV6=.*/IPV6=yes/' /etc/default/ufw
ufw default deny incoming
ufw default allow outgoing
SSH_IGNORE=""
if [ -n "${SSH_ALLOW_FROM:-}" ]; then
  # SSH solo desde esos orígenes. Antes de cerrar la regla abierta se comprueba que ESTA sesión venga de
  # un rango permitido: si el CIDR estuviera mal, esto aborta en vez de dejarte afuera.
  CLIENT_IP="$(who -m 2>/dev/null | grep -oE '\([0-9a-fA-F:.]+\)' | tr -d '()' || true)"
  [ -n "$CLIENT_IP" ] || { echo "No pude determinar la IP de tu sesión SSH (who -m). Corré el script desde una sesión SSH con terminal."; exit 1; }
  python3 - "$CLIENT_IP" "$SSH_ALLOW_FROM" <<'PY' || { echo "Tu sesión actual ($CLIENT_IP) NO está dentro de SSH_ALLOW_FROM=$SSH_ALLOW_FROM: abortado para no dejarte afuera. Mirá la IP con:  who -m"; exit 1; }
import ipaddress, sys
ip = ipaddress.ip_address(sys.argv[1])
sys.exit(0 if any(ip in ipaddress.ip_network(c.strip(), strict=False) for c in sys.argv[2].split(",")) else 1)
PY
  IFS=',' read -ra CIDRS <<<"$SSH_ALLOW_FROM"
  for c in "${CIDRS[@]}"; do ufw allow from "${c// /}" to any port 22 proto tcp comment 'ssh-allowed'; done
  # Fuera la regla abierta (y la de una corrida anterior), de atrás para adelante.
  ufw status numbered | grep -E '# ssh$' | sed -E 's/^\[ *([0-9]+)\].*/\1/' | sort -rn \
    | while read -r n; do ufw --force delete "$n" >/dev/null; done || true
  SSH_IGNORE="${SSH_ALLOW_FROM//,/ }"
else
  echo "SSH queda abierto a cualquier origen que llegue al host (con límite de tasa y fail2ban). Es lo esperado"
  echo "si la restricción de acceso al puerto 22 la aplica otra capa (firewall del proveedor)."
  # Sin lista de orígenes permitidos no se cierra nada, pero sí se evita que fail2ban banee la IP
  # desde la que se corre esto (que puede ser compartida): ignorar un origen solo
  # evita bloqueos, nunca restringe el acceso.
  CLIENT_IP="$(who -m 2>/dev/null | grep -oE '\([0-9a-fA-F:.]+\)' | tr -d '()' || true)"
  [ -z "$CLIENT_IP" ] || SSH_IGNORE="$CLIENT_IP"
  ufw limit 22/tcp comment 'ssh'         # limit = bloquea 6+ conexiones nuevas en 30 s desde una IP
fi
ufw --force enable                     # ya con SSH permitido: no hay forma de cortarse
/usr/local/bin/update-cloudflare-ips   # abre 443 por rango de Cloudflare + genera el include de Caddy
# Caddy arranca siempre con el listener de pruebas (loopback). El sitio público se agrega aparte,
# con `enable-public-site`, cuando ya están los certificados de origen.
if [ -s /etc/caddy/certs/origin.pem ] && [ -s /etc/caddy/certs/origin.key ]; then
  /usr/local/bin/enable-public-site "$DOMAIN"
else
  rm -f /etc/caddy/sites/10-public.caddy
  systemctl enable caddy
  systemctl restart caddy
  echo "AVISO: sin certificados de origen todavía; solo está activo el listener de pruebas (loopback)."
fi

# ---------------------------------------------------------------------------------------------
log "fail2ban (SSH) y sysctl"
cat >/etc/fail2ban/jail.d/lanube.local <<CONF
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 4
backend  = systemd
# Que un error de tipeo no banee tu propia IP (ni la de otros admins que salgan por la misma).
ignoreip = 127.0.0.1/8 ::1 $SSH_IGNORE

[sshd]
enabled = true

# Reincidentes: una semana afuera.
[recidive]
enabled  = true
bantime  = 1w
findtime = 1d
maxretry = 3
CONF
systemctl enable --now fail2ban
systemctl restart fail2ban

cat >/etc/sysctl.d/99-lanube-hardening.conf <<'CONF'
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.tcp_syncookies = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
kernel.yama.ptrace_scope = 1
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
# ip_forward queda como lo deja Docker (lo necesita).
CONF
sysctl --system >/dev/null

# ---------------------------------------------------------------------------------------------
cat <<MSG

======================================================================
Listo. Faltan pasos MANUALES (ver deploy/README.md, secciones 3 a 6):

 1. En OTRA terminal, comprobá:  ssh $ADMIN_USER@<ip>   (con tu clave) y  sudo -v
 2. Recién ahí:  sudo ADMIN_USER=$ADMIN_USER bash $HERE/scripts/02-lock-ssh.sh   (cierra root y contraseñas)
 3. Completar $APP_DIR/lanube.env y $APP_DIR/postgres.env (misma contraseña de Postgres en ambos).
 4. Cuando tengas el certificado de origen de Cloudflare: /etc/caddy/certs/origin.pem y origin.key
    (root:caddy, 640) y luego:  sudo enable-public-site $DOMAIN
 5. docker login ghcr.io   (como root, con un token de solo lectura: read:packages)
 6. Primer deploy: empujar a main; el servidor lo levanta solo (lun-jue 20:00 ART, lanube-autodeploy),
    o ya mismo:  sudo lanube-autodeploy --now   (o: sudo lanube-deploy deploy <sha>).
======================================================================
MSG
[ -z "${NEED_ENV:-}" ] || echo "(Se crearon lanube.env y postgres.env con valores CAMBIAR.)"
