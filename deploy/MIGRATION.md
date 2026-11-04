# Migración desde Vercel a un servidor propio

Procedimiento en tres fases para trasladar una instalación existente en Vercel (base de datos y
archivos subidos) al servidor descrito en [`README.md`](./README.md). **La base de datos de Vercel solo
se lee**: ninguno de los pasos la modifica. Mientras el DNS siga apuntando a Vercel, el sitio en
producción no se ve afectado por la prueba.

| Fase                           | Descripción                                                                  | Qué se pierde si algo falla             |
| ------------------------------ | ---------------------------------------------------------------------------- | --------------------------------------- |
| 1. Prueba                      | Copia completa de los datos al servidor y verificación mediante un túnel SSH | Nada: la prueba se descarta             |
| 2. Conmutación                 | Vercel en solo lectura, repetición de la copia y cambio de DNS               | Nada: el origen no se modificó          |
| 3. Reversión (si es necesaria) | DNS de vuelta a Vercel y salida del modo de mantenimiento                    | Lo escrito en el servidor tras el corte |

La copia final **reemplaza por completo** la base de datos del servidor (`lanube-import-vercel`), de
modo que todo lo generado durante la prueba (usuarios de prueba, reservas, archivos) desaparece sin
necesidad de limpieza.

## Qué se migra y cómo

- **Base de datos.** `pg_dump` desde Vercel, reescritura de URLs y restauración con `psql` en una única
  transacción: o se aplica completa o no cambia nada. Las migraciones pendientes se aplican después.
- **URLs de archivos.** Se reescriben sobre el volcado, de modo que cubren por igual columnas, texto
  markdown y las respuestas JSON de las inscripciones:
  `https://<store>.public.blob.vercel-storage.com/<clave>` pasa a `/uploads/<clave>` y
  `https://<store>.private.blob.vercel-storage.com/<clave>` pasa a `local-private:<clave>`.
- **Archivos.** `scripts/export-blob.ts` descarga el prefijo `prod/` de Vercel Blob (público y privado)
  con la estructura del proveedor de almacenamiento local (`public/` y `private/`), y `rsync` los
  transfiere al servidor. Es incremental: la segunda pasada, durante la conmutación, descarga solo lo
  nuevo.
- **Verificación.** `lanube-verify-uploads` comprueba que **cada** archivo referenciado por la base de
  datos exista en disco. Es la salvaguarda frente a imágenes rotas o adjuntos perdidos.
- **No se migran** los archivos de los prefijos `preview/` y `dev/` de Blob ni las sesiones (son JWT).

### Decisión: `NEXTAUTH_SECRET`

Si el servidor utiliza el **mismo** `NEXTAUTH_SECRET` que Vercel, las sesiones abiertas se conservan
tras la conmutación y los usuarios no deben volver a autenticarse. Con un valor nuevo, todos deben
iniciar sesión de nuevo; es la opción más conservadora si existe sospecha de que el secreto se
expuso. `CRON_SECRET` debe ser siempre un valor nuevo.

Las _passkeys_ y los asistentes MCP conectados siguen funcionando: dependen del dominio, que no
cambia, y sus datos se trasladan con la base de datos.

## Fase 1: Prueba

### 1.1 Preparación

En la máquina de trabajo, descargar las variables de producción a un archivo excluido del control de
versiones (contiene credenciales; no debe compartirse por canales no seguros):

```bash
vercel env pull .env.vercel --environment=production
# Usar la URL sin _pooler_ si existe (DATABASE_URL_UNPOOLED en Neon): pg_dump no es compatible con los pools.
```

El servidor debe haber completado su primer despliegue (la base de datos y la aplicación existen).

### 1.2 Base de datos

```bash
# en el servidor (la URL se lee sin eco y no queda en el historial)
read -rs SRC_DATABASE_URL && export SRC_DATABASE_URL
sudo -E lanube-import-vercel
```

El script realiza, en orden: copia de seguridad del contenido actual, volcado en bruto en
`/data/backup/lanube/vercel-source-*.sql` (permisos `0600`; contiene **datos personales** y debe
eliminarse al terminar), restauración, migraciones, comparación del número de filas por tabla y
arranque de la aplicación. Las diferencias de conteo en tablas creadas por migraciones recientes son
esperables; en el resto, no.

Si `pg_dump` falla por incompatibilidad de versión (el servidor de origen es más reciente que el
cliente 17 incluido en la imagen), debe usarse un cliente de versión igual o superior.

### 1.3 Archivos

```bash
# en la máquina de trabajo
set -a; source .env.vercel; set +a         # incorpora BLOB_READ_WRITE_TOKEN
npx tsx scripts/export-blob.ts --dry-run    # número de archivos, públicos y privados, tamaño total
npx tsx scripts/export-blob.ts --out ./blob-export
rsync -a ./blob-export/ usuario@servidor:~/blob-import/
# en el servidor
sudo rsync -a --chown=1000:1000 ~/blob-import/ /data/volumenes/lanube/uploads/   # DATA_DIR/uploads
sudo lanube-verify-uploads                  # debe finalizar con «faltantes: 0»
```

Si faltan archivos, el informe indica cuáles. La causa más probable es que `list()` no haya devuelto
algún blob privado.

### 1.4 Verificación de la aplicación

El servidor expone un _listener_ únicamente de loopback (`127.0.0.1:8080`), al que solo el usuario
administrador puede abrir un túnel SSH:

```bash
ssh -L 8080:127.0.0.1:8080 <administrador>@servidor      # mantener abierto
# navegador: http://localhost:8080
```

Para esta prueba, en `/data/docker/lanube.env` se establece `NEXTAUTH_URL=http://localhost:8080` y se
aplica con `cd /data/docker && sudo docker compose up -d --force-recreate app`. Además, `localhost` debe
agregarse a los nombres de host del widget de Turnstile y retirarse al finalizar.

Alternativamente, si se dispone de un **dominio de pruebas** en Cloudflare, la verificación recorre el
mismo camino que producción (Cloudflare, TLS y el resto de la cadena). Para ello se instala el
certificado de origen que cubra ese dominio, se ejecuta `sudo enable-public-site <dominio-de-pruebas>`
y se establecen `NEXTAUTH_URL`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` y `OAUTH_ISSUER` con dicho dominio.
Los mismos cuatro valores se cambian al dominio real durante la conmutación. El certificado de origen
debe cubrir ambos dominios, y la regla de Cloudflare que establece `X-Origin-Token` (sección 2 del
`README.md`) debe existir en las zonas de los dos. No se prueba mediante la IP pública del servidor.

Las _passkeys_ y el conector MCP dependen del host: lo que se registre en el dominio de pruebas no es
válido en el dominio real.

> **Precaución.** La copia contiene usuarios y participantes **reales**. Registrarse, restablecer la
> contraseña o inscribirse con una dirección de correo propia es seguro. En cambio, enviarán correos
> a personas reales las acciones sobre eventos con inscriptos: aprobar o rechazar participantes,
> cancelar o reprogramar sesiones. Deben evitarse durante la prueba. Las tareas programadas no envían
> correos.

Lista de verificación:

- [ ] Iniciar sesión con una cuenta existente y con una cuenta de administrador.
- [ ] Registrar una cuenta nueva con un correo propio: llega el correo de confirmación (SMTP) y se confirma.
- [ ] Solicitar el restablecimiento de contraseña: llega el correo y se cambia la contraseña.
- [ ] Inscribirse en un evento de prueba: llega el correo de confirmación.
- [ ] Imágenes en inicio, espacios, eventos y noticias: las migradas se muestran y ninguna está rota.
- [ ] Subir una imagen nueva desde el panel de administración y verla (escritura en el volumen).
- [ ] Abrir desde el panel de administración el adjunto de una inscripción (archivos privados migrados).
- [ ] Crear una reserva y verla en el panel de administración.
- [ ] Captcha (Turnstile) en el registro y en el restablecimiento de contraseña.
- [ ] `sudo lanube-cron maintain-reservations` responde correctamente; `systemctl list-timers 'lanube-*'`.
- [ ] `sudo lanube-backup all` y restauración del volcado en una base de datos descartable.
- [ ] `sudo reboot` y comprobación de que todo se recupera solo (aplicación, PostgreSQL, Caddy, temporizadores).
- [ ] Un despliegue real mediante GitHub Actions (cualquier commit) se completa de extremo a extremo.

## Fase 2: Conmutación

Requisitos previos: el certificado de origen está instalado y `sudo enable-public-site <dominio>`
ejecutado, y quien administra el DNS puede cambiarlo cuando se solicite. Se recomienda un momento de
baja actividad.

1. **Poner Vercel en modo de mantenimiento de solo lectura** (`/admin/maintenance`, modo «solo lectura
   global», con un mensaje claro) y esperar unos minutos a que finalicen las escrituras en curso.
2. **Realizar la copia final**, que reemplaza la anterior:
   ```bash
   read -rs SRC_DATABASE_URL && export SRC_DATABASE_URL && sudo -E lanube-import-vercel
   ```
   A continuación, transferir los archivos nuevos (incremental) con `export-blob.ts`, `rsync` y
   `sudo rsync …`, y ejecutar `sudo lanube-verify-uploads`, que **debe informar cero faltantes**.
3. **Configuración definitiva en el servidor.** Ejecutar `sudo enable-public-site <dominio-real>`. En
   `/data/docker/lanube.env`, establecer `NEXTAUTH_URL`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` y
   `OAUTH_ISSUER` con el dominio real y las claves reales de Turnstile, y aplicar con
   `cd /data/docker && sudo docker compose up -d --force-recreate app`. Retirar `localhost` o el dominio
   de pruebas de Turnstile.
4. **Comprobar** que la aplicación y Caddy responden: `curl -s http://127.0.0.1:3000/api/maintenance` y
   `systemctl is-active caddy`.
5. **Cambiar el DNS**: registro `A` del dominio hacia la IP del servidor, con el proxy de Cloudflare
   activado. La propagación es rápida con el proxy activo (TTL automático).
6. **Prueba de humo.** Abrir el sitio real, iniciar sesión, comprobar las imágenes, registrarse y
   restablecer la contraseña con un correo propio, y observar el tráfico real con
   `sudo tail -f /var/log/caddy/access.log`.
7. Si todo es correcto, **mantener Vercel en modo de mantenimiento durante unos días** como vía de
   reversión y después pausar el proyecto. Las tareas programadas de Vercel siguen ejecutándose contra
   la base de datos antigua hasta que se pause el proyecto; es inocuo.

## Fase 3: Reversión

Si tras el cambio de DNS se produce un fallo grave, se debe restablecer el DNS hacia Vercel y retirar
a Vercel del modo de mantenimiento. La base de datos de Vercel permanece intacta, tal como quedó al
congelarla. Lo escrito en el servidor durante ese lapso **no se traslada automáticamente** a Vercel;
existe un `pg_dump` del servidor para recuperarlo manualmente si es relevante. Por ello se recomienda
realizar la conmutación en un horario de baja actividad.

## Riesgos conocidos

- **Alcance de las pruebas.** El volcado, la reescritura de URLs y la restauración se probaron con una
  base de datos local migrada, repetidos dos veces. `export-blob.ts` no se probó contra un
  almacenamiento Vercel Blob real: su opción `--dry-run` y `lanube-verify-uploads` permiten detectar
  problemas antes de la conmutación y no durante ella.
- **Deriva del origen.** Cuanto más tiempo transcurra entre la prueba y la conmutación, más cambia el
  origen. No es relevante, porque la copia final reemplaza todo.
- **Enlaces en correos ya enviados.** Los correos que ya están en las bandejas de los usuarios
  (confirmación, edición de inscripción) apuntan al dominio real y siguen funcionando tras la
  conmutación, porque los tokens se trasladan con la base de datos.
