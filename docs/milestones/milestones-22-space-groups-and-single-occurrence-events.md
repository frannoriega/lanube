# Milestone 22 — Grupos de espacios y eventos de una sola ocasión

> **Estado: diseño (2026-10-05).** Nada implementado. Rama `milestone-22`, creada desde
> `preview` a propósito: no debe entrar en el próximo release hasta estar terminado y probado.
> Este documento recoge la conversación de diseño con el usuario, lo que se verificó en el
> código y lo que **todavía no** se verificó.

## 1. Origen: dos casos de uso

1. **Eventos que usan todo el edificio**, no un solo espacio. Restricciones del usuario:
   - No crear un `Space` «Todo el edificio»: aparecería en la landing y en la navegación de
     reservas.
   - El evento debe **bloquear todos los espacios** (nadie puede reservar mientras dura).
2. **Evento continuo**: empieza el miércoles 16:00 y termina el jueves 12:00, «como una sola
   cosa».

Contexto del segundo caso: es un hackatón multi-universidad organizado por otra institución;
el coworking **adhiere** y presta el espacio (por eso aparece como evento de La Nube). El
evento es nocturno, pero **el edificio solo está disponible en su horario de apertura**. No
requiere formulario ni inscriptos. Hoy se resolvió **cargando dos eventos** (día 1 + día 2).

Respuestas del usuario que fijan el alcance:

- El caso continuo es **puntual**; no se sabe si habrá recurrencia a futuro → **no se toca el
  modelo recurrente** ahora.
- Los eventos pueden saltarse el horario de reservas (lun–vie 09:00–18:00); hasta ahora
  ninguno lo hizo.
- Se pidió pensar **grupos de espacios** en general, porque «todo el edificio» es solo el caso
  más grande; un grupo debe servir para cualquier evento que use más de un espacio.
- Agregar un espacio nuevo al edificio es **extremadamente raro** (habría que construir
  salas), así que que un espacio nuevo no entre solo a un grupo existente es aceptable.
- Los grupos son **solo para eventos**, no para reservas de usuarios (confirmado).
- Aunque el hackatón no usa inscripción, los eventos con grupo o de una ocasión **deben
  soportar formulario e inscriptos igual que los demás**.

## 2. Qué hay hoy (verificado leyendo el código)

| Hecho                                                                                                                                                                          | Dónde                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `Event.spaceId` es FK obligatoria a un único `Space`                                                                                                                           | `prisma/models/events.prisma`                                                                       |
| El formulario exige `startTime < endTime` como **hora del día** (`HH:MM`), así que hoy es imposible cruzar la medianoche                                                       | `src/lib/schemas/events.ts` (`timeOfDaySchema`, refine en la línea ~133)                            |
| `Event.startTime/endTime` ya son `BigInt` con timestamp completo; `rrule` y `recurrenceEnd` ya son nullables                                                                   | `events.prisma`                                                                                     |
| `create_event_reservation()` crea **una** reserva con `space_id`, estado `APPROVED`; la rama no recurrente solo exige `end > start` y rechaza si hay solapamiento en el ledger | migración `20260706110000_reservation_types_table`                                                  |
| `reservation_ledger` tiene `space_id` **por fila** (buckets de 15 min), id serial, **sin unicidad** por reserva+bucket                                                         | `prisma/models/reservations.prisma`                                                                 |
| `insert_into_ledger()` recibe un único `_space_id`                                                                                                                             | migración `20260706000000_unify_space_resource`                                                     |
| `rebuild_reservation_ledger_forward()` **retorna sin hacer nada** si la reserva no es recurrente o si `space_id IS NULL`                                                       | misma migración (sección 15)                                                                        |
| El cron `maintain_reservations()` solo rehace el ledger de reservas recurrentes con `space_id IS NOT NULL`                                                                     | migración que define `maintain_reservations`                                                        |
| `get_unavailable_slots`, `create_reservation` y `approve_reservation` leen el ledger por espacio                                                                               | `20260924110000_capacity_predicates` (**no releídas en detalle**)                                   |
| Las tarjetas de evento del calendario salen del ledger filtrando por `space_id` y **fusionan buckets contiguos** en un span por reserva                                        | `getEventOccurrencesForSpace`, `src/lib/db/resourceCalendar.ts`                                     |
| `WeekCalendar` ubica cada ocurrencia con `isSameDay(occStart, day)`: una tarjeta solo se dibuja **en el día en que empieza**                                                   | `src/components/organisms/calendar/WeekCalendar.tsx` (líneas ~228, ~491, ~768)                      |
| `events.ts` lee `event.space.capacity` y `event.space.name` en al menos 5 lugares (cupo y `resourceName` de tarjetas públicas)                                                 | `src/lib/db/events.ts` (~1064, 1087, 1169, 1192, 1265, 1293); también `getEventOccurrencesForSpace` |

## 3. Pieza A — Evento de una sola ocasión (puede cruzar días)

### Diseño

- Un **modo** del evento: `WEEKLY` (hoy) o `SINGLE`. En `SINGLE` el formulario pide **fecha y
  hora de inicio** y **fecha y hora de fin** (pueden ser días distintos) en lugar de
  días-de-semana + rango de fechas + hora del día.
- Persistencia sin columnas nuevas: `rrule = NULL`, `recurrenceEnd = NULL`,
  `startTime/endTime` = el intervalo completo. `eventDisplayStatus()` ya usa
  `recurrenceEnd ?? endTime`, así que el estado ENDED sale bien.
- Se reserva **una reserva no recurrente** con el intervalo completo (p. ej. 20 h). **No hay
  lógica especial de horario de apertura**: el evento bloquea todo el intervalo. Como las
  reservas normales solo existen lun–vie 09–18, en la práctica bloquea mié 16–18 y jue 09–12.
  «El edificio solo abre en su horario» es texto del evento, no regla del sistema.
- Sin sesiones por ocurrencia: hay una sola. Reprogramar = editar el evento. El panel
  «Sesiones» no se muestra en este modo y `planEventOccurrences` se saltea.
- Validación: `end > start`, y un **tope de duración** (propuesta: 7 días, para que un error de
  tipeo no bloquee un mes). Las horas siguen siendo múltiplos de 15 min; la zona es la de
  Argentina (helpers de `admin-timezone`).
- Un `discriminatedUnion` en `eventInputSchema` por `mode`, para que cada modo valide lo suyo.

### Lo que hay que verificar o arreglar (no se verificó todo)

1. **Calendario** (confirmado): `isSameDay(occStart, day)` hace que una tarjeta que cruza la
   medianoche **no se dibuje el segundo día**. Hay que partir cada ocurrencia por día
   (recortar al día visible) en `WeekCalendar` y en la lógica pura de `calendar-utils.ts`,
   con tests.
2. Formato de fecha en tarjetas de landing, detalle, emails de inscripción y listado admin:
   un intervalo multi-día necesita «mié 15/10 16:00 → jue 16/10 12:00» (es-AR, 24 h).
3. Comprobar si hoy se puede crear un evento con `rrule = NULL` (el schema de Prisma lo
   permite; la ruta/`createEvent` pueden asumir recurrencia). **No se leyó `createEvent`.**
4. `updateEvent` y el diff de weekdays asumen reservas semanales; el modo `SINGLE` debe
   tener su propia rama (una reserva, sin diff de weekdays, sin `EventEditDropWarning`).
5. Reportes (`/admin/reports`) y `get_user_next_reservations`: confirmar que una reserva de
   20 h no rompe supuestos de «duración dentro del día».
6. La herramienta MCP `list_events`/`get_event` y los emails: revisar cómo muestran fechas.

### Fuera de alcance (a propósito)

Evento **recurrente** nocturno (cada miércoles 16:00 → jueves 12:00). Si aparece, el modelo
correcto es _inicio + duración_ en lugar de «ventana dentro del día»; nada de lo anterior lo
impide, pero no se construye ahora.

## 4. Pieza B — Grupos de espacios

### Diseño de datos

- `SpaceGroup` (id, `name`, `slug`, `description?`, timestamps BigInt ms) y
  `SpaceGroupMember` (`groupId`, `spaceId`, `@@unique([groupId, spaceId])`, FK con
  `onDelete: Cascade` desde el grupo y `Restrict` hacia el espacio mientras pertenezca).
- Tabla **aparte de `Space`**: un grupo nunca llega a la landing, a `/spaces` ni a la
  navegación de reservas (que salen de `getReservableSpaces()`).
- «Todo el edificio» es un grupo que contiene todos los espacios. Los grupos pueden
  **solaparse** (p. ej. «Planta alta» dentro de «Edificio»).
- `Event.spaceGroupId` nullable; `Event.spaceId` pasa a nullable; **CHECK** de que exactamente
  uno de los dos está seteado (`num_nonnulls(space_id, space_group_id) = 1`).
- CRUD de superadmin en `/admin/space-groups` (consistente con `/admin/spaces`): permiso nuevo
  en el catálogo de `src/lib/rbac.ts`, entrada en `ADMIN_PATH_PERMISSIONS` (middleware), en
  `configNavigation` y en `SEGMENT_LABELS` de las migas de pan (ver CLAUDE.md §3 y §10).
  Auditoría: entidad `SpaceGroup` en el registro + loader en `SNAPSHOTS`, con campos
  legibles (los miembros como `set` con nombres, no ids — CLAUDE.md §11).
- Selector de «dónde» en el formulario del evento: espacio **o** grupo.

### Decisión pendiente de confirmar: cómo se bloquean los espacios

Se evaluaron tres formas. **Esta sección cambió durante la sesión de diseño** y conviene que
el usuario la confirme.

**Opción 1 — una reserva por grupo + ledger expandido a los espacios miembros.**
Una sola `Reservation` con `space_group_id`, y `insert_into_ledger` escribe filas para cada
espacio miembro. Era la propuesta inicial: una sola reserva, una sola excepción por sesión.
_Problema encontrado al leer el SQL:_ `Reservation.space_id` tendría que ser nullable, y
`rebuild_reservation_ledger_forward()` **retorna sin hacer nada si `space_id IS NULL`** y
`maintain_reservations()` **filtra `space_id IS NOT NULL`**. Un descuido ahí hace que el cron
nocturno **deje de materializar hacia adelante** las reservas de grupo, y los conflictos
dejan de detectarse en silencio — justo el modo de falla que CLAUDE.md §4 marca como
requisito de correctitud, y la clase de bug que encontró el milestone 12. Habría que tocar
`create_event_reservation`, `rebuild_reservation_ledger_forward`, `maintain_reservations`, y
revisar `effective_occurrence_window`, `approve_reservation`, el guard de reprogramación y
todo JOIN `reservations → spaces` de la app.

**Opción 2 — chequeo doble (propuesta original del usuario).** Reservas de grupo aparte y
una disponibilidad que consulta «grupo primero, espacio después». Funciona, pero cada
consulta de disponibilidad (SQL y app) aprende a unir ambos mundos; es la más invasiva.

**Opción 3 (recomendada) — una reserva ordinaria por cada espacio miembro.**
Crear el evento de grupo = el mismo `create_event_reservation()` de hoy invocado **una vez por
espacio** del grupo (y por día de la semana), todas con `reservable_id = event.id`, en **una
sola transacción**. Para el SQL el resultado son reservas normales: **cero cambios en las
funciones** (ledger, cron, aprobación, guard de reprogramación siguen igual). El calendario
de cada espacio ya muestra la tarjeta nombrada porque lee el ledger por `space_id`.

Costos de la opción 3, aceptados:

- N veces más filas (≈ nº de espacios × días); irrelevante a esta escala.
- Las sesiones (`ReservationException`) se replican por espacio: en `updateEvent`, resolver
  «weekday» pasa a «weekday × espacio». Se centraliza en un helper que devuelve las reservas
  del evento.
- **No es retroactivo**: un espacio agregado a un grupo después no queda bloqueado en eventos
  ya creados. El usuario lo aceptó (agregar espacios físicos es rarísimo). Si algún día
  molesta, se agrega una acción «re-sincronizar» explícita; no se construye ahora.
- Un conflicto en **cualquier** espacio aborta todo el alta (rollback) y el mensaje debe
  **nombrar el espacio** que choca.

Gate de decisión: si el usuario prefiere la opción 1, el primer paso del slice es un
inventario completo de funciones SQL y JOINs afectados y un test que haga fallar el build si
el cron salta una reserva de grupo.

### Cambios de aplicación que la opción 3 sí exige

- `events.ts`: cupo y nombre dejan de depender de `event.space`: para un evento de grupo, el
  nombre mostrado es el del grupo y el cupo **no tiene respaldo de capacidad del espacio**
  (propuesta: `capacity` obligatoria en eventos de grupo, o suma de capacidades — decidir).
- `getEventOccurrencesForSpace`: la tarjeta de un evento de grupo aparece en cada espacio; el
  `meta` del cupo usa `e.space.capacity` → debe tolerar `space = null`.
- Listas admin, landing y tool MCP: etiqueta «Edificio» / nombre del grupo junto al espacio.
- `deleteEvent` (soft delete) debe liberar **todas** las reservas del evento (hoy ya itera por
  `reservableId`, **verificar**).
- Semilla: crear el grupo «Todo el edificio» en `prisma/seed.ts` y, por migración de datos,
  en producción (los superadmins pueden luego editarlo).

## 5. Interacción entre A y B

El hackatón real es **grupo «edificio» + una ocasión + intervalo de 20 h**. Con la opción 3 y
el modo `SINGLE` se resuelve con N reservas no recurrentes (una por espacio) en una
transacción. Probar esa combinación explícitamente (test de `createEvent` con grupo + modo
`SINGLE`).

## 6. Plan por slices

Cada slice se commitea aparte (sin firmar, mensaje en español) y deja el árbol verde.

1. **A1 — Esquema y dominio del modo `SINGLE`:** `eventInputSchema` (unión por `mode`), rama de
   `createEvent`/`updateEvent`, tests de la lógica pura.
2. **A2 — Calendario y formatos multi-día:** partir ocurrencias por día en `WeekCalendar` /
   `calendar-utils.ts`, formateo es-AR de intervalos, emails, landing, listado admin. Tests
   de `calendar-utils`.
3. **A3 — Formulario:** conmutador de modo en `event-form.tsx` (secciones, `StickySaveBar`,
   shadcn Form + Zod como el resto), ocultar «Sesiones» en `SINGLE`.
4. **B1 — Modelo de grupos:** `prisma/models/space-groups.prisma`, migración (a mano, **no
   descartar** el aviso de la FK polimórfica de `reservable_id`, ver CLAUDE.md), CHECK en
   `events`, semilla, CRUD de superadmin con permiso, auditoría, migas de pan.
5. **B2 — Eventos de grupo:** alta/edición/baja con una reserva por espacio, helper de
   «reservas del evento», sesiones replicadas, mensajes de conflicto con el nombre del
   espacio, adaptación de `events.ts` a `space = null`.
6. **B3 — Superficies:** etiquetas en landing/admin/MCP/reportes, tarjeta en cada espacio.
7. **C — Documentación:** CLAUDE.md (Modelo de datos, §5 Eventos, §11 si hay entidades
   auditadas, §3 del RBAC), este doc con lo realmente construido, `docs/OPEN_QUESTIONS.md`,
   el índice de `docs/milestones/README.md`.

Cada slice que toque una pantalla corre `node scripts/mobile-shots.mjs` (CLAUDE.md §13).

## 7. Decisiones y alternativas descartadas

- **Un `Space` oculto «Todo el edificio»:** descartado por el usuario — un caso especial que
  cada consulta de espacios tendría que filtrar, y no generaliza a otros grupos.
- **Grupos como relación en `Space` (un campo `groupKey`):** descartado: un espacio puede
  estar en varios grupos (edificio y planta alta).
- **Modelar la ocasión múltiple como varias «sesiones» de un evento:** descartado — es
  esencialmente lo que hoy se hace con dos eventos; no da «una sola cosa» en la landing.
- **Cambiar ya el modelo a _inicio + duración_ para toda recurrencia:** descartado por
  alcance (el usuario no sabe si habrá recurrencia nocturna).
- **Reglas de horario de apertura dentro del evento:** descartado; es texto del evento.
- **Reservas de grupo para usuarios comunes:** fuera de alcance (confirmado por el usuario).

## 8. Preguntas abiertas

1. Confirmar la **opción 3** (una reserva por espacio) frente a la 1 (§4).
2. Cupo de un evento de grupo: ¿obligatorio y manual, o suma de las capacidades de los
   espacios?
3. Tope de duración del modo `SINGLE`: ¿7 días?
4. ¿Se migran los dos eventos actuales del hackatón (día 1 + día 2) a uno solo, o se dejan?
   (No hay migración automática prevista.)
5. ¿Los grupos solapados pueden usarse en dos eventos simultáneos? Con la opción 3 el choque
   por espacio ya lo impide, que es el comportamiento deseado; confirmar.

## 9. Qué NO se verificó

- `create_reservation`, `approve_reservation`, `get_unavailable_slots` (`20260924110000`),
  `effective_occurrence_window` y el guard de reprogramación — solo se confirmó que leen el
  ledger por espacio.
- `createEvent` / `updateEvent` / `deleteEvent` completos y las rutas `/api/admin/events`.
- Cuántos JOIN `reservations → spaces` existen en la app (relevante solo si se elige la
  opción 1).
- Reportes y la tool MCP con intervalos largos.
