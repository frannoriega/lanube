# Milestone 30 — Check-in en eventos

**Estado:** implementado (2026-11-17), versión **1.2.0**. El diseño de abajo es el acordado; lo que cambió al implementar está en «Registro de implementación».
**Depende de:** nada. **Alimenta:** milestone 31 (reportes de eventos: asistencia).

## Caso de uso

Al configurar un evento, un admin puede activar el **check-in** (opcional). Con eso aparece
una pantalla de gestión del evento para usar **en la puerta**, mientras se recibe a la gente:

- Se busca a la persona por **email** (siempre presente en una inscripción).
- Si está inscripta, se marca su ingreso.
- Si el email **no está inscripto**, se avisa claramente, y hay un acceso rápido a la lista
  de inscriptos (por si la persona se inscribió con otro email o con un error de tipeo).
- Desde esa lista se puede marcar el ingreso de cualquier inscripto con un botón.
- Se puede registrar a alguien que **no se inscribió** («se presentó sin inscripción»): haya
  lugar o no — aunque el cupo esté lleno, se lo deja pasar. Queda marcado como tal, para
  distinguir en las estadísticas a los inscriptos de los que llegaron sin inscribirse (es un
  dato valioso sobre el uso del sistema).

## Decisiones del usuario (2026-11-17)

- **Búsqueda solo por email.** Se descartó el DNI: depende de que el formulario tenga ese
  campo y puede haber varios (eventos con «grupos de trabajo», donde cada integrante tiene
  el suyo).
- **Inscripciones grupales:** una persona inscribe a todo el grupo (para eso están los
  grupos repetibles del formulario). Por ahora **se hace check-in de quien inscribió al
  grupo**. Hacer check-in de cada integrante por separado queda para el milestone 34 (tipo de
  campo «Participante»).
- **Quien llega sin inscripción completa el formulario completo del evento** (lo carga el
  admin en la puerta), no solo email y nombre.

## Decisiones de diseño (propuestas en este doc)

### Check-in por sesión, no por evento

Los eventos son semanales y tienen varias sesiones. La asistencia que importa es por sesión
(el gráfico de asistencia del milestone 31 muestra si se mantiene o cae). Un check-in es:
inscripción + sesión + cuándo + quién lo registró.

La sesión se identifica por el **inicio nominal de la ocurrencia** (la misma clave que usan
las acciones de sesión del milestone 14: día + horario nominal, que sobrevive a una
reprogramación) más el `reservationId` de esa ocurrencia. Una sesión cancelada no admite
check-in.

### Modelo

```prisma
model EventCheckIn {
  id            String   @id @default(cuid())
  participantId String   @map("participant_id")
  eventId       String   @map("event_id")       // redundante, para agregar por evento sin join
  reservationId String   @map("reservation_id") // la reserva (día de la semana) de la sesión
  // Inicio nominal de la ocurrencia (UNIX ms): la clave de la sesión.
  occurrenceStart BigInt @map("occurrence_start")
  checkedInAt   BigInt   @default(dbgenerated(...)) @map("checked_in_at")
  checkedInBy   String?  @map("checked_in_by")  // RegisteredUser del admin
  participant   EventParticipant @relation(..., onDelete: Cascade)

  @@unique([participantId, occurrenceStart])
  @@index([eventId, occurrenceStart])
  @@map("event_check_ins")
}
```

- No se reusa `CheckIn` (el de reservas): está atado a un usuario registrado y a una reserva
  de espacio; un participante de evento puede no tener cuenta.
- Deshacer un check-in (error de la persona en la puerta) borra la fila; queda en la
  auditoría.

En `Event`: `checkInEnabled Boolean @default(false)`.

En `EventParticipant`: `source ParticipantSource @default(REGISTERED)` con
`enum ParticipantSource { REGISTERED WALK_IN }`. Se eligió un campo de **origen** y no un
estado nuevo: quien llega sin inscripción queda `APPROVED` (está adentro) y todo lo que ya
filtra por estado sigue funcionando; el origen es lo que distingue en las estadísticas.

### Quien llega sin inscripción

- El admin completa el formulario del evento (el mismo `validateForm`/`pruneAnswers` que la
  inscripción pública; los archivos, si los hubiera, por la misma subida firmada) desde la
  pantalla de check-in.
- Se crea un `EventParticipant` con `source = WALK_IN`, `status = APPROVED` **sin chequear
  cupo, ventana de inscripción ni aprobación manual**, y en la misma transacción su
  check-in de la sesión elegida. Toma el mismo advisory lock que `submitForm`.
- Queda como participante del evento: **ocupa lugar en las sesiones siguientes** (completó
  el formulario completo, es un inscripto más). **Confirmado por el usuario** (2026-11-17):
  «los admins lo manejan en persona; en el peor caso, no dejan pasar a quien llega sin
  inscripción (o a una persona puntual)».
- **No se le manda correo** (ni confirmación ni enlace de edición). **Confirmado por el
  usuario** (2026-11-17).
- Si el email ya existe en el evento:
  - `PENDING` → se ofrece «Aprobar y registrar ingreso» (aprueba con el mismo
    `decideParticipants`, que manda su correo de aprobación).
  - `REJECTED` → se muestra el estado; el admin puede re-aprobar (mismas reglas del
    milestone 25: si el cupo no da, el check-in igual permite registrarlo como asistencia de
    la sesión, sin re-aprobar; el detalle se cierra al implementar).
  - `CANCELLED` → se ofrece reactivarla como `WALK_IN`.

### Pantalla

`/admin/events/[id]/checkin`, pensada para **teléfono** (se usa parado en la puerta):

- Selector de sesión, por defecto la de hoy (la que está en curso o la próxima); se puede
  elegir una sesión pasada para cargar asistencia después. No se puede hacer check-in de una
  sesión futura.
- Contador de la sesión: ingresaron N de M inscriptos + K sin inscripción.
- **Tabla de inscriptos** (solo el email, el estado y el botón de ingreso, a la derecha),
  paginada, con un **buscador de texto por email**. Si la búsqueda no encuentra a nadie, la
  tabla ofrece «Registrar sin inscripción» con ese email.

(Este es el diseño final, tras el rediseño pedido por el usuario antes del deploy; el primero
— buscador + tarjeta + lista en un diálogo — está descrito en «Rediseño de la pantalla».)

Accesos: desde la tabla de eventos (acción «Check-in», solo si está activo) y desde la página
del evento.

### Permiso

Nuevo `events:checkin` («Registrar ingresos a eventos»), separado de `events:manage`, para
poder crear un rol de recepción que no edite eventos. `events:manage` no lo implica
automáticamente; el seed se lo agrega a los roles que hoy tienen `events:manage`.

### API y auditoría

- `GET /api/admin/events/[id]/checkin?session=<ms>&email=…` — búsqueda y estado de la sesión.
- `POST /api/admin/events/[id]/checkin` — `{ participantId, session }`.
- `DELETE /api/admin/events/[id]/checkin` — deshacer.
- `POST /api/admin/events/[id]/checkin/walk-in` — `{ session, email, answers }`.
- Todas con `requirePermission("events:checkin")`, auditadas (entidad `EventCheckIn`, eventos
  custom `eventCheckIn.create` / `eventCheckIn.delete` / `eventParticipant.walkIn`).
- Mantenimiento: las rutas escriben, así que el modo solo lectura las bloquea solo (área
  «eventos»). Correcto.

### Conector MCP

Fuera de alcance. `list_event_participants` podría sumar el origen y la asistencia más
adelante.

## Preguntas abiertas

Ninguna: las dos de este milestone (lugar en las sesiones siguientes, correo) las contestó el
usuario el 2026-11-17 (ver «Quien llega sin inscripción»).

## Registro de implementación

Implementado el 2026-11-17 en `main`, commit sin firmar, versión **1.2.0** (MINOR).

### Modelo y migración (`20261117100000_event_check_in`)

Tal como el diseño: `events.check_in_enabled`, el enum `participant_sources` +
`event_participants.source` (las existentes quedan `REGISTERED`) y `event_check_ins`
(`@@unique([participantId, occurrenceStart])`, FK a la inscripción y al evento con cascada,
**sin FK** a `reservations`). La misma migración agrega `events:checkin` a los roles que tienen
`events:manage` (en local: ADMIN; SUPERADMIN lo tiene implícito). Se verificó con
`prisma migrate diff` contra la base migrada que el SQL a mano coincide con el schema (solo
aparece el ruido de las expresiones de `DEFAULT` que ya tenían todas las tablas).

### Lo que cambió respecto del diseño

- **Inscripciones no aprobadas: «dejar pasar», sin `decideParticipants`.** El diseño
  proponía aprobar una `PENDING` con `decideParticipants` (con su correo) y re-aprobar una
  `REJECTED` con las reglas de cupo del milestone 25. Al implementar se unificó con la
  decisión del usuario sobre quien llega sin inscripción («los admins lo manejan en
  persona»): registrar el ingreso de una inscripción `PENDING`, `REJECTED` o `CANCELLED`
  pide una confirmación con el texto de su estado (`ADMISSION_PROMPT`) y la deja `APPROVED`,
  **sin chequear cupo y sin correo**, igual que a quien llega sin inscripción. La auditoría
  guarda desde qué estado se admitió (`admittedFrom`). Deshacer el ingreso **no** revierte la
  admisión.
- **La búsqueda filtra la tabla en el navegador** (por el email tal como se escribió y por el
  normalizado), sin pedido al servidor: la tabla ya trae a todos los inscriptos. La tabla de
  inscriptos de la gestión no cambió (salvo que su badge de estado pasó a
  `ParticipantStatusBadge`, compartido).
- **Auditoría sobre `Event`**, como `participant.decide`: tres eventos custom
  `participant.checkIn` (con `admittedFrom`), `participant.checkInUndo` y
  `participant.walkIn`, con `Evento` + `Participante` en el contexto. No hay entidad
  `EventCheckIn` en el registro. El `checkInEnabled` del evento se audita como un campo más de
  `event.update` («Check-in en la puerta»).
- **Una entrada para la recepción:** `/admin/events/checkin` («Check-in», en la sección
  «Eventos» del menú, con `events:checkin`) lista los eventos con check-in que están en curso o terminaron
  hace menos de 30 días, los que tienen sesión hoy primero. Desde la tabla de eventos hay
  además una acción «Check-in» (ícono de puerta) en las filas con check-in habilitado.
- **Subida de archivos de quien llega sin inscripción:** `POST /checkin/upload`, la misma
  `handleParticipantUpload` (mismo prefijo, firma atada al evento) detrás de
  `events:checkin`, sin el límite por IP de la ruta pública. Exenta de auditoría como el resto
  de las subidas.
- **Lista desactualizada:** si la pantalla cree aprobada a una inscripción que ya no lo está,
  el servidor responde 409 con la inscripción al día (`AdmissionRequiredError`); la pantalla
  la actualiza y abre la confirmación de «dejar pasar». Registrar un ingreso que ya existía
  es idempotente («Ya tenía el ingreso registrado»).
- **Solo el email en la puerta** (y en la auditoría): no se muestra nada de las respuestas del
  formulario, que puede ser cualquiera (ver «Rediseño de la pantalla»).
- **Qué sesiones admiten ingresos:** las de **hoy o antes** (por día, en la hora del predio:
  la gente llega antes de que empiece), nunca una cancelada. La sesión por defecto es la de
  hoy que todavía no terminó, si no la última de hoy, si no la última que pasó, si no la
  primera futura (que se muestra sin poder registrar). Reglas puras en
  `src/lib/events/checkin.ts`, con tests.

### Piezas

- `src/lib/events/checkin.ts` (+ test): sesiones, sesión por defecto, admisión.
- `src/lib/db/event-checkin.ts`: evento + sesiones, lista con totales, ingreso,
  deshacer, quien llega sin inscripción, lista de la recepción.
- `src/app/api/admin/events/[id]/checkin/` — `route.ts` (GET/POST/DELETE), `participants/`,
  `walk-in/`, `upload/`.
- `src/components/organisms/admin/event-checkin.tsx`: la pantalla. Reusa `NodeList` y
  `UploadContext` de `public-form.tsx` (ahora exportados) para el formulario de quien llega sin
  inscripción, con la misma validación (`validateForm`) que la inscripción pública.
- Páginas `/admin/events/checkin` y `/admin/events/[id]/checkin` (`requirePagePermission`).
- `src/lib/schemas/checkin.ts`, permiso en `rbac.ts` (grupo «Eventos y formularios»), switch
  en el formulario del evento (sección «Inscripción»), ítem de menú, acción en la tabla.
- `scripts/mobile-shots.mjs`: tomas `admin-events-checkin` y `admin-event-checkin` (esta
  última solo si hay un evento con check-in).

### Verificación

- `npm test`, `tsc`, ESLint, Prettier, `release:check`.
- En el navegador, contra el stack local de Docker, con el evento «E2E Taller de prueba»
  (sesiones los lunes; se usó la del lunes anterior):
  - activar el check-in desde el formulario del evento (auditado como
    `{"checkInEnabled": true}`); para guardar hubo que ponerle una imagen de portada al evento
    de prueba, que no tenía (dato del seed, no del cambio);
  - la lista «Check-in de eventos» con la próxima sesión y la última;
  - buscar `E2E@Example.com` (mayúsculas) y encontrar `e2e@example.com`, con el nombre
    «Juan» sacado del formulario; registrar el ingreso; deshacerlo;
  - buscar un email no inscripto → «No está inscripto» → «Registrar sin inscripción» con el
    formulario completo del evento (nombre, PDF obligatorio subido por la ruta nueva, términos)
    → la persona queda `APPROVED` + `WALK_IN` con su ingreso, el PDF guardado con firma, y el
    contador «0 de 1 inscriptos · 1 sin inscripción»;
  - con la lista abierta mostrando a «Juan» aprobado, pasarlo a `REJECTED` en la base y tocar
    «Registrar ingreso» → la fila se actualiza y aparece «¿Dejar pasar?» con el texto de
    rechazada → confirmar → ingreso registrado y auditado con `admittedFrom: "REJECTED"`;
  - las entradas en `/admin/audit`, con el evento y la persona en el contexto.
- `node scripts/mobile-shots.mjs m30 checkin`: sin desborde horizontal en teléfono (claro y
  oscuro), tablet y escritorio.
- Los datos de prueba se revirtieron en la base local (imagen, check-in, la inscripción sin
  inscripción, los ingresos, el estado de «Juan» y el PDF subido).

### Rediseño de la pantalla (2026-11-17, antes del deploy)

La primera versión tenía un buscador por email (`POST /checkin/lookup`), una tarjeta con el
resultado y «Ver inscriptos» en un diálogo (cajón en el teléfono). Al probarla el usuario
marcó:

1. las tarjetas se veían «centradas»: `Card` ya trae `py-6` y se le sumaba `p-4` en
   `CardContent`, así que quedaban 40 px vacíos arriba y abajo (mismo error en la lista de la
   recepción; corregido en las dos);
2. en la tarjeta, el badge y el botón quedaban en la misma columna que el texto, y los esperaba
   a la derecha;
3. la tarjeta mostraba un nombre sacado de las respuestas (`participantDisplayName()`: los
   textos cortos de primer nivel cuya pregunta decía «nombre»/«apellido»). El formulario puede
   ser cualquiera, así que esa información no es confiable: **solo el email**;
4. con muchos inscriptos, una lista en un diálogo o un cajón no sirve.

Se simplificó a una sola vista: la sesión, el contador y la **tabla de inscriptos** (email,
estado, botón a la derecha; en el teléfono, una tarjeta por fila), paginada de a 25, con un
buscador de texto por email que filtra en el navegador. Se quitaron la ruta `lookup`, su
esquema y sus exenciones en los tests, `findCheckInParticipant` y `participantDisplayName`
(con sus pruebas); la auditoría guarda solo el email. Se plegó al mismo commit de la versión
1.2.0 (no hubo versión nueva: todavía no estaba desplegada).

En el mismo pedido, el **menú del panel se dividió en secciones** (Personas, Reservas,
Eventos, Contenido, Análisis, Sistema; «Panel» queda solo arriba): «Check-in» (antes «Check-in
de eventos») va en «Eventos» junto a Eventos y Formularios. Ver CLAUDE.md §10.

Verificado en el navegador con 30 inscripciones de prueba (borradas al terminar): filtrar,
registrar un ingreso desde la fila, el estado vacío con «Registrar sin inscripción» y el
formulario con el email ya cargado; `mobile-shots` sin desborde en teléfono, tablet y
escritorio.

### Hallazgo fuera de alcance (para decidir)

Las páginas de gestión de eventos (`/admin/events`, `/admin/events/[id]`,
`/admin/events/[id]/participants`) **no exigen `events:manage` en la página**: solo el
`admin:access` del middleware. Las APIs sí lo exigen, pero `participants/page.tsx` arma la
tabla de inscriptos (con sus respuestas) en el servidor, así que cualquier rol con
`admin:access` — un Comunicador, o el rol de recepción que habilita este milestone — puede
verla entrando por la URL. No se tocó: se avisó al usuario.
