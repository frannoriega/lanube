#!/usr/bin/env bash
# Endurece sshd: solo claves, sin root, solo usuarios permitidos. Correr DESPUÉS de comprobar
# desde otra terminal que `ssh <admin>@<ip>` entra con clave. Valida la configuración antes de
# recargar y no corta las sesiones abiertas.
set -euo pipefail
: "${ADMIN_USER:?falta ADMIN_USER}"
[ "$(id -u)" = 0 ] || { echo "Correr como root (sudo)"; exit 1; }

# Cinturón y tirantes contra quedar afuera: el admin tiene que tener una clave instalada.
[ -s "/home/$ADMIN_USER/.ssh/authorized_keys" ] || { echo "$ADMIN_USER no tiene authorized_keys: abortado"; exit 1; }

# `00-` para que gane: sshd usa el PRIMER valor que ve y los .conf de /etc/ssh/sshd_config.d se
# leen en orden alfabético (cloud-init suele dejar un 50-cloud-init.conf con PasswordAuthentication yes).
F=/etc/ssh/sshd_config.d/00-lanube-hardening.conf
BAK=/root/.lanube-sshd-hardening.bak
if [ -f "$F" ]; then cp -p "$F" "$BAK"; else rm -f "$BAK"; fi
# Si algo no valida, vuelve a lo que había (o lo quita si no había nada): nunca deja a medias.
rollback() { if [ -f "$BAK" ]; then cp -p "$BAK" "$F"; else rm -f "$F"; fi; }
cat >"$F" <<CONF
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
PubkeyAuthentication yes
AuthenticationMethods publickey
AllowUsers $ADMIN_USER
MaxAuthTries 3
LoginGraceTime 20
MaxStartups 10:30:60
MaxSessions 4
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
PermitTunnel no
DisableForwarding yes
KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com
LogLevel VERBOSE

# El admin puede abrir UN túnel local, solo al listener de pruebas de Caddy, para probar la app
# sin exponerla (ssh -L 8080:127.0.0.1:8080 ...). Al final del archivo a propósito: un Match
# abarca todo lo que sigue. Más abajo se comprueba que no se haya filtrado a otros usuarios.
Match User $ADMIN_USER
	DisableForwarding no
	AllowTcpForwarding local
	PermitOpen 127.0.0.1:8080
CONF

# El túnel es solo del admin: cualquier otro usuario sigue sin reenvíos (el Match no debe filtrarse).
sshd -T -C "user=nobody,host=h,addr=203.0.113.9" | grep -qx 'disableforwarding yes' \
  || { echo "El Match se filtró a otros usuarios: abortado, nada recargado"; rollback; exit 1; }
sshd -T -C "user=$ADMIN_USER,host=h,addr=203.0.113.9" | grep -qx 'permitopen 127.0.0.1:8080' \
  || { echo "El túnel del admin no quedó aplicado: abortado"; rollback; exit 1; }
sshd -t || { rollback; echo "sshd_config inválido: revertido"; exit 1; }   # si falla, `set -e` aborta antes de recargar y la config vieja sigue activa
systemctl reload ssh 2>/dev/null || systemctl reload sshd
echo "Hecho. NO cierres esta sesión: abrí otra y verificá  ssh $ADMIN_USER@<ip>  antes."
echo "Config efectiva:  sudo sshd -T | grep -Ei 'permitrootlogin|passwordauthentication|allowusers'"
