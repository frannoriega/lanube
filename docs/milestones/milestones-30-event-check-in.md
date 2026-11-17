# Milestone 30 — Check-in en eventos

**Estado:** diseño acordado (2026-11-17), sin implementar.
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
  el formulario completo, es un inscripto más). _A confirmar con el usuario._
- **No se le manda correo** (ni confirmación ni enlace de edición): no se pidió. _A confirmar
  con el usuario._
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
- Buscador de email con normalización (`normalizeEmailForIdentityServer`, la misma de la
  inscripción): `ana.perez+x@gmail.com` encuentra a `anaperez@gmail.com`.
- Resultado: tarjeta de la persona (nombre si el formulario lo tiene, email, estado,
  inscripta o sin inscripción, si ya ingresó en esta sesión) con el botón que corresponda.
- «No está inscripto» → «Ver inscriptos» y «Registrar sin inscripción».
- Contador de la sesión: ingresaron N de M inscriptos + K sin inscripción.
- «Ver inscriptos» abre la lista de inscriptos (la tabla existente
  `participants-table.tsx`) con una columna/botón de check-in para la sesión elegida.

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

- ¿Quien llega sin inscripción ocupa lugar en las sesiones siguientes? (propuesta: sí)
- ¿Se le manda el correo de confirmación con su enlace de edición? (propuesta: no)

## Registro de implementación

(Se completa al implementar.)
