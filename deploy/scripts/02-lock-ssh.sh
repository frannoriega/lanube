#!/usr/bin/env bash
# Endurece sshd con una política de acceso explícita. Correr DESPUÉS de comprobar desde otra
# terminal que `ssh <admin>@<ip>` entra con clave. Valida la configuración antes de recargar y no
# corta las sesiones abiertas.
#
#   ADMIN_USER=user1                  # entra con clave (+ túnel al listener de pruebas)
#   SSH_KEY_USERS="root"              # (opcional) otros usuarios que entran SOLO con clave
#   SSH_PASSWORD_USERS="user2"        # (opcional) usuarios que entran SOLO con contraseña
#
# Cualquier otro usuario queda sin acceso, salvo los que permita otro archivo de
# /etc/ssh/sshd_config.d (AllowUsers se acumula entre archivos; al final se listan). Este script
# escribe un único archivo, el suyo, y no toca ni borra ningún otro. Desde qué redes se puede llegar
# al puerto 22 lo decide el firewall (SSH_ALLOW_FROM en 01-bootstrap.sh), no este script.
set -euo pipefail
: "${ADMIN_USER:?falta ADMIN_USER}"
[ "$(id -u)" = 0 ] || { echo "Correr como root (sudo)"; exit 1; }

read -ra KEY_USERS <<<"$ADMIN_USER ${SSH_KEY_USERS:-}"
read -ra PASSWORD_USERS <<<"${SSH_PASSWORD_USERS:-}"
# Los nombres se interpolan en sshd_config: solo nombres de usuario válidos, nada más.
for u in "${KEY_USERS[@]}" "${PASSWORD_USERS[@]}"; do
  [[ "$u" =~ ^[a-z_][a-z0-9_-]*$ ]] || { echo "Nombre de usuario inválido: $u"; exit 1; }
  id "$u" >/dev/null 2>&1 || { echo "El usuario $u no existe: abortado"; exit 1; }
done
# Un usuario no puede entrar por las dos vías.
for u in "${PASSWORD_USERS[@]}"; do
  for k in "${KEY_USERS[@]}"; do [ "$u" != "$k" ] || { echo "$u figura con clave y con contraseña: abortado"; exit 1; }; done
done
# Cinturón y tirantes contra quedar afuera: quien entra con clave tiene que tener una instalada, y
# quien entra con contraseña tiene que tener una definida (estado «P» de `passwd -S`).
for u in "${KEY_USERS[@]}"; do
  home="$(getent passwd "$u" | cut -d: -f6)"
  [ -s "$home/.ssh/authorized_keys" ] || { echo "$u no tiene authorized_keys: abortado"; exit 1; }
done
for u in "${PASSWORD_USERS[@]}"; do
  [ "$(passwd -S "$u" | awk '{print $2}')" = "P" ] || { echo "$u no tiene contraseña definida: abortado"; exit 1; }
done
# root solo con clave si figura entre los usuarios con clave; si no, sin acceso. (sshd usa el primer
# valor que ve: si otro archivo anterior fija PermitRootLogin, prevalece el de ese archivo.)
ROOT_MODE=no
for u in "${KEY_USERS[@]}"; do [ "$u" != root ] || ROOT_MODE=prohibit-password; done

# `00-` para que gane: sshd usa el PRIMER valor que ve y los .conf de /etc/ssh/sshd_config.d se
# leen en orden alfabético (cloud-init suele dejar un 50-cloud-init.conf con PasswordAuthentication yes).
F=/etc/ssh/sshd_config.d/00-lanube-hardening.conf
BAK=/root/.lanube-sshd-hardening.bak
if [ -f "$F" ]; then cp -p "$F" "$BAK"; else rm -f "$BAK"; fi
# Si algo no valida, vuelve a lo que había (o lo quita si no había nada): nunca deja a medias.
rollback() { if [ -f "$BAK" ]; then cp -p "$BAK" "$F"; else rm -f "$F"; fi; }
cat >"$F" <<CONF
PermitRootLogin $ROOT_MODE
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
PubkeyAuthentication yes
AuthenticationMethods publickey
AllowUsers ${KEY_USERS[*]} ${PASSWORD_USERS[*]}
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
for u in "${PASSWORD_USERS[@]}"; do
  cat >>"$F" <<CONF

Match User $u
	PasswordAuthentication yes
	AuthenticationMethods password
CONF
done

# Si una comprobación falla, muestra lo que sshd realmente aplica y dónde se define cada directiva:
# sshd usa el PRIMER valor que ve, así que otro archivo de /etc/ssh/sshd_config.d (o del propio
# sshd_config) que fije la misma directiva antes que este puede anular la política.
diagnose() {  # $1 usuario, $2 expresión con las directivas relevantes
  echo "--- sshd aplica para $1:" >&2
  sshd -T -C "user=$1,host=h,addr=203.0.113.9" 2>&1 | grep -Ei "$2" >&2 || true
  echo "--- definiciones en la configuración:" >&2
  grep -rniE "$2|^[[:space:]]*(match|include)" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/ >&2 || true
}
FWD='disableforwarding|allowtcpforwarding|permitopen'
PWD_RE='passwordauthentication|authenticationmethods'

# El túnel es solo del admin: cualquier otro usuario sigue sin reenvíos (el Match no debe filtrarse).
sshd -T -C "user=nobody,host=h,addr=203.0.113.9" | grep -qx 'disableforwarding yes' \
  || { echo "Otro usuario conserva reenvíos de puertos (un Match filtrado u otro archivo de configuración): abortado, nada recargado" >&2; diagnose nobody "$FWD"; rollback; exit 1; }
sshd -T -C "user=$ADMIN_USER,host=h,addr=203.0.113.9" | grep -qx 'permitopen 127.0.0.1:8080' \
  || { echo "El túnel del admin no quedó aplicado: abortado" >&2; diagnose "$ADMIN_USER" "$FWD"; rollback; exit 1; }
for u in "${KEY_USERS[@]}"; do
  sshd -T -C "user=$u,host=h,addr=203.0.113.9" | grep -qx 'passwordauthentication no' \
    || { echo "$u debería entrar solo con clave y no quedó así: abortado, nada recargado" >&2; diagnose "$u" "$PWD_RE"; rollback; exit 1; }
done
for u in "${PASSWORD_USERS[@]}"; do
  sshd -T -C "user=$u,host=h,addr=203.0.113.9" | grep -qx 'passwordauthentication yes' \
    || { echo "$u debería entrar con contraseña y no quedó así: abortado, nada recargado" >&2; diagnose "$u" "$PWD_RE"; rollback; exit 1; }
done
sshd -t || { rollback; echo "sshd_config inválido: revertido"; exit 1; }   # si falla, `set -e` aborta antes de recargar y la config vieja sigue activa
systemctl reload ssh 2>/dev/null || systemctl reload sshd
# AllowUsers se suma entre archivos: avisa de quién más puede entrar por lo que definan otros .conf.
mine=" ${KEY_USERS[*]} ${PASSWORD_USERS[*]} "
extra=""
for u in $(sshd -T -C "user=nobody,host=h,addr=203.0.113.9" | awk '$1=="allowusers" {for (i=2; i<=NF; i++) print $i}'); do
  case "$mine" in *" $u "*) ;; *) extra="$extra $u" ;; esac
done
if [ -n "$extra" ]; then
  echo "Nota: otros archivos de /etc/ssh/sshd_config.d permiten además a:$extra"
  echo "      (esta política no los modifica; entran según lo que esos archivos definan)."
fi
echo "Hecho. NO cierres esta sesión: abrí otra y verificá el acceso de cada usuario antes."
echo "Con clave: ${KEY_USERS[*]}   |   con contraseña: ${PASSWORD_USERS[*]:-(ninguno)}"
echo "Config efectiva:  sudo sshd -T | grep -Ei 'permitrootlogin|passwordauthentication|allowusers|authenticationmethods'"
