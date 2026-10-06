# Milestone 22 — Modo mantenimiento (parcial)

**Estado:** **implementado (2026-10-06)** en `preview`.
**Tipo:** feature — operación / comunicación con los usuarios.

## Pedido

Textual del usuario (2026-10-06), traducido:

> Una función nueva para el superadmin: modo mantenimiento. La idea es avisarle a los usuarios
> que la app está en mantenimiento. Idealmente "mantenimiento parcial": por ejemplo, si
> migramos la base (a un host nuevo, pausando las escrituras para sacar un snapshot), que la
> app quede en "solo lectura" (los usuarios ven su información, la portada está arriba, etc.).
> Si es posible, un panel para superadmins donde decidir qué está en mantenimiento y qué
> significa (función completamente no disponible, o solo las escrituras). Poder dar un motivo
> (markdown) para mostrarle a los usuarios. La pregunta abierta es dónde y cómo mostrar eso.
>
> Casos de uso inmediatos: (1) solo lectura al sacar el snapshot y migrar al VPS; (2) un
> mensaje explicando que hoy el registro, la recuperación de contraseña (y las notificaciones
> de eventos a participantes) están apagados porque el SMTP está caído; todo lo demás anda.
> Se puede definir inicio/fin (programado) o solo prender/apagar. Borrar la info al terminar
> la ventana, salvo que el historial valga la pena.

Respuestas del usuario a las preguntas del diseño inicial:

1. Registro y recuperación de contraseña **se bloquean** (no solo se avisa) mientras el SMTP
   está caído.
2. Las notificaciones por correo de eventos **se omiten** (sin reintento). Si un admin
   reprograma un evento, el cambio se ve en la página del evento y en la campanita de la app.
3. Hacer todo en un solo milestone.

Restricciones que agregó al ver el primer diseño:

- **No tocar todas las rutas de la API.** Le preocupaba la complejidad de mantenimiento (una
  lista de rutas + un test que hay que mantener al día, "y rezar por no haber olvidado un caso
  borde").
- «Solo lectura» significa **el CRUD de dominio** (crear/editar eventos, reservas, noticias,
  etc.), **no** las escrituras de seguridad/mantenimiento internas (rate limit, etc.).

## Decisión central: un portero en el middleware, no un guard por ruta

`src/middleware.ts` ahora también corre para `/api/**` (matcher `"/api/:path*"`) y, **sin tocar
ninguna ruta**, responde `503` con `{ message, code: "MAINTENANCE" }` si una ventana vigente
frena el pedido. Toda la lógica está en tres archivos puros/chicos:

| Archivo                           | Qué hace                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/lib/maintenance/areas.ts`    | Catálogo de áreas, modos y la lista de **rutas exentas** de la solo lectura global.             |
| `src/lib/maintenance/evaluate.ts` | Reglas puras: estado de una ventana, qué pedido se frena, qué mensaje, qué área escribe.        |
| `src/lib/maintenance/gate.ts`     | El portero: caché en memoria, consulta al propio `GET /api/maintenance?fresh=1`, falla abierto. |

### Por qué falla del lado seguro

La solo lectura global es una **regla de método**: todo `POST/PUT/PATCH/DELETE` bajo `/api` se
frena **salvo** una lista corta de excepciones (`READ_ONLY_EXEMPT_PREFIXES`). Una ruta nueva que
escribe queda **bloqueada sola**; olvidarse de actualizar algo nunca deja pasar una escritura
durante una migración. Con el diseño anterior (guard por ruta + test que recorre las rutas) un
olvido era un agujero silencioso.

### Excepciones (rutas que la solo lectura global no frena)

NextAuth (`callback`, `signin`, `signout`, `session`, `csrf`, `providers`, `error`) y
`/api/auth/passkey` (sin eso nadie puede entrar a ver su información); `/api/oauth/token`
(renovar el token del conector); `/api/policies` (aceptar políticas: si no, el gate no se cruza;
una aceptación que se pierde en la migración se repite, es inocuo); `/api/cron` y `/api/mcp`
(se protegen adentro, ver abajo); `/api/maintenance` y `/api/admin/maintenance` (el aviso y el
propio panel — si no, no se podría apagar el mantenimiento); `/api/user/notifications`
(marcar leída la campanita); `/api/session`, `/api/dev`.

**Quedan frenados a propósito** `/api/auth/register`, `/api/auth/reset`, `/api/auth/recovery`,
las passkeys (alta/baja) y `/api/auth/signup`: una cuenta creada, una contraseña cambiada o un
passkey registrado entre el snapshot y el cambio de DNS **se pierden**, y la persona quedaría con
un correo de confirmación que apunta a una cuenta que ya no existe.

### Cómo decide el middleware sin base de datos

El middleware corre en el runtime edge (no abre una conexión de Prisma). Lee las ventanas con un
`fetch` a **su propia app**: `GET /api/maintenance?fresh=1` (`no-store`), y las recuerda **15 s**
en memoria del proceso, con una sola consulta en vuelo. Optimización: las **lecturas** casi nunca
la necesitan (solo las que caen bajo el prefijo de un área, porque `UNAVAILABLE` frena también
los `GET`), así que la mayor parte del tráfico no cuesta una consulta.

- **Falla abierto**: si la consulta falla (base caída, timeout de 1,5 s), el pedido pasa y se
  recuerda el fallo 5 s. La alternativa es que un problema con el aviso tumbe todo el sitio.
- **Origen del `fetch`**: `request.nextUrl.origin`. En producción es el host público; bajo
  `next dev -H 0.0.0.0` puede ser `0.0.0.0`, que también responde en loopback. Si alguna vez el
  origen que ve el middleware no fuera alcanzable desde la propia app (un proxy raro), el portero
  fallaría abierto y **no frenaría nada**; por eso el runbook verifica con un `curl` que el 503 sale
  de verdad antes de sacar el snapshot.
- Un cambio tarda hasta ~15 s en aplicarse a todos los pedidos (por instancia). El panel lo avisa.

## Modelo de datos

`MaintenanceWindow` (`prisma/models/maintenance.prisma`, migración `20261006100000`): una fila
por ventana, **sin interruptor global**.

- `title`, `reasonMd` (markdown), `mode` (`NOTICE | READ_ONLY | UNAVAILABLE`), `areas String[]`.
- `startsAt` / `endsAt` nulos = «rige desde que se crea» / «sin fin previsto: se apaga a mano».
- `endedAt` se completa con «Finalizar ahora».
- **Vigente** = `endedAt` nulo y ahora en `[startsAt, endsAt)`. La regla vive en
  `windowState()` (inicio inclusivo, fin exclusivo), con tests.
- `areas` es **texto**, no un enum de Postgres: sumar un área es una línea de código, no una migración.

### Historial

**Se conserva**, nunca se borra: una ventana terminada queda como fila con `endedAt` y aparece al
final de la lista del panel. Es una tabla chica, responde «¿cuándo estuvimos caídos y por qué?», y
no cuesta nada. Una ventana terminada no se puede editar (409). Además toda alta/edición/fin se
audita (`maintenance.create|update|end`, entidad `MaintenanceWindow` en el registro de auditoría).

## Modos y áreas

| Modo          | Qué hace                                                                    |
| ------------- | --------------------------------------------------------------------------- |
| `NOTICE`      | Solo muestra el mensaje. No bloquea nada.                                   |
| `READ_ONLY`   | Se puede ver todo; los cambios del área (o de todo el sitio) responden 503. |
| `UNAVAILABLE` | Cualquier método de las rutas del área responde 503, también `GET`.         |

`all` («Todo el sitio») solo admite `NOTICE` o `READ_ONLY` (el esquema Zod lo exige): apagar
**todo** el sitio no es un caso pedido y exigiría reemplazar páginas enteras.

Catálogo inicial (`MAINTENANCE_AREAS`): `all`, `signup` (`/api/auth/register`),
`password-recovery` (`/api/auth/reset`), `reservations` (`/api/resources`,
`/api/admin/reservations`), `events` (`/api/admin/events`, `/api/forms`), `news`
(`/api/admin/news`) y `event-emails` (no es de rutas: `effect: "code"`).

Si dos ventanas frenan el mismo pedido, gana el mensaje de la del **área concreta** sobre el de la
solo lectura global («el correo está caído» le sirve más a quien quiere recuperar su contraseña que
«estamos migrando»).

### `event-emails` (decisión del usuario)

Con cualquier modo distinto de `NOTICE`, los tres senders de correo de eventos
(`event-registration`, `event-decision`, `event-occurrence-update`) **no envían y no reintentan**.
No cuenta como fallo (no se intentó) y deja un `logger.info`. La campanita dentro de la app
(`notify()`) **sigue funcionando** — hay un test que lo fija. Consecuencia que hay que saber: una
persona que se inscribe durante la ventana **no recibe el correo con su enlace de edición**; el
mensaje de la ventana lo tiene que decir (el atajo «Correo fuera de servicio» ya lo dice).

### Cron y conector MCP (rutas exentas que se protegen adentro)

- **`/api/cron/maintain-reservations`** se saltea (`{ skipped: true }`) con solo lectura global.
  Es seguro: `maintain_reservations()` recalcula hacia adelante desde «hoy», así que la corrida
  siguiente recupera lo que esta dejó (verificado leyendo la función SQL). Una ventana olvidada
  abierta días se nota en el log.
- **Tools de escritura del conector MCP** (`reservations:write` → área `reservations`,
  `news:write` → área `news`): `/api/mcp` es siempre `POST`, así que el middleware no distingue
  lecturas de escrituras; `defineTool()` consulta la ventana **antes** del rate limit (un intento
  frenado no gasta cupo) y devuelve el mismo mensaje como `isError`.

## Dónde y cómo se muestra (la pregunta abierta)

1. **Aviso del sitio** (`MaintenanceBanner`): pila de avisos arriba de todo, en el sitio público,
   el panel (`/admin` y `/user`) y las páginas de inscripción (`/forms`). Título + qué implica
   («Solo lectura» / «No disponible») + horario + motivo en markdown (plegado detrás de «Ver
   detalle» si pasa de 300 caracteres). No renderiza nada si no hay ventanas, así que dejarlo
   montado no cuesta. Lo alimenta `MaintenanceProvider` (en el layout raíz) con
   `GET /api/maintenance`, que se refresca cada minuto y **al instante** cuando una acción choca con
   un 503 de mantenimiento (`apiSend`/`apiGet` disparan un evento).
2. **En el punto de la acción** (`AreaMaintenanceNotice` + `useAreaWriteBlock`): el formulario de
   registro, el de recuperación de contraseña y el de inscripción pública muestran el motivo
   **adentro** y deshabilitan el botón. Es lo más importante: quien llega a `/auth/signup` tiene que
   enterarse _antes_ de completar nada; un cartel arriba de la página no alcanza (y las pantallas de
   ingreso tienen su propio layout, sin el banner).
3. **Anuncio anticipado**: una ventana programada se muestra como «Mantenimiento programado:
   desde el …» hasta 7 días antes de empezar; recién rige en `startsAt`.
4. **El 503 mismo**: si alguien ya estaba en la página cuando empezó, la acción falla con el motivo
   en el toast (el mensaje del 503 es el texto apto para mostrar).

No hay una página `/maintenance` dedicada: con `READ_ONLY` el punto es justamente que el sitio
siga usándose.

> **Saltos de línea:** el motivo se renderiza con `<Markdown breaks />` (y la vista previa del editor
> con `breaks`): un salto simple se ve como salto, porque quien lo escribe espera eso. Es CSS
> (`white-space: pre-line` en los párrafos), sin plugin; los artículos y descripciones de eventos
> mantienen la regla estándar de CommonMark. El rótulo del modo («No disponible») no se parte.

## Panel (`/admin/maintenance`)

Permiso nuevo `maintenance:manage` — **solo SUPERADMIN** (implícito; no se agregó a ningún rol
sembrado; se sumó a `FORBIDDEN_PERMISSIONS` del conector). Está en `ADMIN_PATH_PERMISSIONS` del
middleware, en «Configuración» del menú y en las migas (`maintenance: "Mantenimiento"`).

- **Lista** (`MaintenanceManager`): vigentes primero, luego programadas, luego el historial; áreas,
  ventana y estado; «Editar» y «Finalizar ahora» (con confirmación).
- **Formulario como página** (`MaintenanceForm`, regla del proyecto: lleva editor markdown): atajos,
  título, motivo (`MarkdownEditor`), modo (tarjetas), áreas (checkboxes con su descripción), inicio
  programado y fin previsto (interruptores + `DateTimePicker`), y una **vista previa en vivo** del
  aviso en el aside.
- **Dos atajos** (`presets.ts`, solo valores iniciales editables, no plantillas guardadas):
  «Migración o respaldo (solo lectura)» y «Correo fuera de servicio».

### API

`GET /api/maintenance` (público, `?fresh=1` = `no-store` para el middleware, si no 30 s en el CDN),
`GET|POST /api/admin/maintenance`, `PUT /api/admin/maintenance/[id]`,
`POST /api/admin/maintenance/[id]/end`. Todas con el envoltorio `apiSuccess/apiError/apiCatch` y
auditadas.

## Arreglos que salieron en el camino (commits aparte, antes de esta feature)

1. **El SMTP caído ya no miente** (`7e67c38`): el reseteo respondía «enlace enviado» y dejaba el
   token en `password_reset_tokens`; el registro creaba la cuenta y dejaba un token vigente que
   nadie recibió (bloqueaba el reenvío automático 24 h). Ahora `assertMailerAvailable()`
   (`src/lib/email/transport.ts`) comprueba el SMTP **antes** de tocar la base — en el reseteo,
   antes de saber si la cuenta existe, para no permitir enumerar cuentas — y si el envío falla igual
   se borra el token y se responde 503.
2. **Los senders de correo eran Server Actions** (`a85088f`): los cinco módulos de `src/lib/email`
   tenían `"use server"`, lo que expone cada función exportada como un endpoint POST público: se
   podía llamar `sendResetEmail(correo, token)` desde el navegador. Pasan a `server-only` y
   `src/lib/email/server-only.test.ts` impide volver atrás.

## Runbook: migrar al VPS

1. `/admin/maintenance` → «Nuevo» → atajo «Migración o respaldo». Ajustar el texto, **Declarar**.
2. Esperar ~15 s y verificar que frena: `curl -s -o /dev/null -w "%{http_code}" -X POST
-H 'content-type: application/json' -d '{}' https://<host>/api/admin/events` → **503** (con la
   ventana apagada, sería 401). Si da 401, el portero no está leyendo — **no sacar el snapshot**.
3. Sacar el snapshot (`pg_dump` es consistente de por sí).
4. Levantar la app contra la base nueva. **La ventana viaja en el snapshot**: el VPS arranca en solo
   lectura; verificarlo y recién entonces «Finalizar ahora» **en el VPS**.
5. Cambiar el DNS.

Lo que **no** se frena durante la ventana (a propósito) y por lo tanto puede perderse si ocurre
entre el snapshot y el cambio de DNS: ingresos (no escriben datos de dominio), aceptación de
políticas, renovación de tokens del conector y marcar leída la campanita. Son repetibles/inocuos.

## Botón de emergencia: funciones SQL

Migración `20261006110000_maintenance_sql_helpers`. Para cuando no se puede usar el panel (la app
no levanta, el login falla, o se está migrando y solo hay acceso a la base). Normalmente **no
hace falta**: ninguna ventana puede dejar el panel inaccesible (`all` no admite `UNAVAILABLE`, y
`/api/admin/maintenance` está exento de la solo lectura).

```sql
SELECT * FROM maintenance_status();          -- vigentes y programadas, con id, estado, áreas y fechas
SELECT maintenance_end_all();                -- termina todo; devuelve cuántas cortó
SELECT maintenance_end('<id>');              -- termina una; true si la cortó
SELECT maintenance_start('Migración', 'Texto **markdown**', 'READ_ONLY', ARRAY['all']);
SELECT maintenance_start('SMTP caído', 'Texto', 'UNAVAILABLE',
                         ARRAY['signup','password-recovery','event-emails'],
                         interval '2 hours');  -- con fin previsto (sin el último argumento, queda abierta)
```

- `maintenance_start` valida lo mismo que el panel (título y motivo no vacíos, modo válido, al
  menos un área, `all` + `UNAVAILABLE` prohibido) y devuelve el id (`sql_<uuid>`).
- La base **no conoce el catálogo de áreas** (vive en código): un id inexistente se ignora en
  silencio. Los ids vigentes están en el comentario de la migración.
- **No escriben en la auditoría**: quedan solo las filas de `maintenance_windows`.
- Se aplica con la misma demora de ~15 s del portero.
- Como son parte de las migraciones, **viajan con el snapshot** al VPS.

## Alternativas descartadas

- **Un guard por ruta + un test que recorre las rutas** (primer diseño): obliga a tocar ~65
  archivos, y el test es una lista que hay que mantener; un olvido deja pasar una escritura sin
  avisar. El usuario lo rechazó por complejidad de mantenimiento.
- **`ALTER DATABASE … SET default_transaction_read_only = on`** como cinturón extra: bloquearía
  también las escrituras de seguridad permitidas (rate limit, passkeys, tokens del conector). El
  `pg_dump` ya es consistente, y el riesgo residual es solo lo de la sección anterior.
- **Middleware con runtime Node y Prisma directo**: evitaría el `fetch` propio, pero cambia el
  runtime del middleware de autenticación de toda la app, y un error ahí deja la app en blanco sin
  que el build lo detecte. Se prefirió dejar el runtime y consultar por HTTP.
- **Una bandera en variable de entorno o en Global Config**: no permite motivo markdown ni historial,
  y exige un deploy/herramienta externa para prender y apagar.
- **`UNAVAILABLE` para todo el sitio**: no es un caso pedido; exigiría reemplazar páginas enteras.
- **Una página `/maintenance`**: contradice el propósito de la solo lectura.
- **Borrar la ventana al terminar**: ver «Historial».
- **Bloquear lecturas bajo `READ_ONLY`**: no; «solo lectura» es exactamente poder ver todo.

## Verificación

- Tests puros (`evaluate.test.ts`, `gate.test.ts`): estados, rutas exentas, fail-closed para rutas
  nuevas, prioridad del mensaje, caché/«falla abierto» del portero, catálogo. Test del envío de
  correos de eventos con la ventana activa (mails omitidos, campanita sigue). 532 tests en total.
- A mano contra el stack local (Docker + Postgres): con una ventana `READ_ONLY` sobre `all`,
  `POST /api/admin/events` y `POST /api/auth/register` → **503** con el mensaje; los `GET` y
  `POST /api/policies/accept` pasan; con una ventana `UNAVAILABLE` sobre `signup` y
  `password-recovery`, el reseteo responde 503 con el mensaje del área. Aviso del sitio,
  aviso dentro del formulario de registro (botón deshabilitado) y el panel (lista + formulario)
  verificados en el navegador, tema oscuro y claro de auth.
- **No verificado**: el portero contra un deploy real en Vercel o detrás de un proxy (origen del
  `fetch` propio), ni el comportamiento ante un SMTP realmente caído (solo las pruebas de la ruta).

## Cosas a tener en cuenta

- Server Actions: el repo no usa ninguna (verificado con `grep "use server"` tras el arreglo de
  correos). Si alguna vez se agregan, **no pasan por `/api`** y el portero no las ve.
- `GET` que escriben: `GET /api/auth/confirm-email` consume el token y marca el correo verificado;
  con solo lectura global no se frena (el portero solo mira métodos que escriben).
- Una ventana de solo lectura global olvidada abierta frena el cron de reservas cada día: se nota en
  el log (`cron/maintain-reservations skipped`).
