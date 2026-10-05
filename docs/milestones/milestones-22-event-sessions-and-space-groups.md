# Milestone 22 — Eventos por sesiones, grupos de espacios y cupo flexible

> **Estado: diseño (2026-10-05, segunda versión).** Nada implementado. Rama `milestone-22`,
> creada desde `preview` a propósito: no debe entrar en el próximo release hasta estar
> terminado y probado. Este documento recoge la conversación de diseño con el usuario, lo que se
> verificó en el código y lo que **todavía no** se verificó.
>
> La primera versión de este doc proponía un modo «una sola ocasión» al lado del modo semanal.
> Se reemplazó por el modelo **sessions-first** (§4) tras analizarlo con el usuario: resuelve el
> caso nocturno sin un caso especial y elimina la maquinaria de excepciones para eventos.

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

### Respuestas del usuario que fijan el alcance

- El caso continuo es **puntual**. En producción existe **solo ese caso** (los dos eventos
  del hackatón) y **ningún evento es sin fecha de fin**.
- **Evento recurrente sin fin** («todos los miércoles, para siempre»): una buena función, pero
  **se modelará aparte, más adelante, si el caso de uso aparece**, y usará `rrule`. Queda
  anotado en §9; no se construye ahora y este milestone no debe cerrarle la puerta.
- Los eventos pueden saltarse el horario de reservas (lun–vie 09:00–18:00); hasta ahora ninguno
  lo hizo.
- Se pidió pensar **grupos de espacios** en general: «todo el edificio» es solo el caso más
  grande. Agregar un espacio nuevo es **extremadamente raro** (habría que construir salas), así
  que un espacio nuevo que no entre solo a un grupo existente es aceptable.
- Los grupos son **solo para eventos**, no para reservas de usuarios.
- Aunque el hackatón no usa inscripción, los eventos con grupo o con sesiones libres **deben
  soportar formulario e inscriptos igual que los demás**.
- **Cupo**: el valor por defecto es la **suma** de las capacidades de los espacios; es
  **sobrescribible** y puede **superar** la capacidad física (traen sillas, o la gente está de
  pie, como en el aniversario). Además debe existir **«sin límite»**: no importa cuánta gente
  se anote. Capacidad = «sillas/escritorios disponibles».
- **Duración máxima de una sesión: 7 días.**
- Las reservas de un evento se **ocultan** en la gestión de reservas de admin; se modifican
  solo con las herramientas de eventos (ver §8, que se corrige aparte en `preview`).

## 2. Qué hay hoy (verificado leyendo el código)

| Hecho                                                                                                                                                                               | Dónde                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `Event.spaceId` es FK obligatoria a un único `Space`                                                                                                                                | `prisma/models/events.prisma`                                                                     |
| El formulario exige `startTime < endTime` como **hora del día** (`HH:MM`), igual para todos los días de la semana: hoy es imposible cruzar la medianoche o tener horarios distintos | `src/lib/schemas/events.ts` (`timeOfDaySchema`, refine ~133)                                      |
| `Event.startTime/endTime` ya son `BigInt` con timestamp completo; `rrule` y `recurrenceEnd` ya son nullables                                                                        | `events.prisma`                                                                                   |
| `create_event_reservation()` crea **una** reserva con `space_id`, estado `APPROVED`; la rama no recurrente solo exige `end > start` y rechaza si hay solapamiento en el ledger      | migración `20260706110000_reservation_types_table`                                                |
| `reservation_ledger` tiene `space_id` **por fila** (buckets de 15 min), id serial, **sin unicidad** por reserva+bucket                                                              | `prisma/models/reservations.prisma`                                                               |
| `insert_into_ledger()` recibe un único `_space_id` y inserta fila por fila (loop plpgsql)                                                                                           | migración `20260706000000_unify_space_resource`                                                   |
| `rebuild_reservation_ledger_forward()` **retorna sin hacer nada** si la reserva no es recurrente o si `space_id IS NULL`                                                            | misma migración (sección 15)                                                                      |
| El cron `maintain_reservations()` solo rehace el ledger de reservas **recurrentes** con `space_id IS NOT NULL`, y borra no recurrentes terminadas (`end_time < today`)              | migración que define `maintain_reservations` (**revisar la rama de borrado** con `space_id` nulo) |
| `get_unavailable_slots`, `create_reservation` y `approve_reservation` leen el ledger por espacio                                                                                    | `20260924110000_capacity_predicates` (**no releídas en detalle**)                                 |
| Las tarjetas de evento del calendario salen del ledger filtrando por `space_id` y **fusionan buckets contiguos** en un span por reserva                                             | `getEventOccurrencesForSpace`, `src/lib/db/resourceCalendar.ts`                                   |
| `WeekCalendar` ubica cada ocurrencia con `isSameDay(occStart, day)`: una tarjeta solo se dibuja **en el día en que empieza**                                                        | `src/components/organisms/calendar/WeekCalendar.tsx` (líneas ~228, ~491, ~768)                    |
| `events.ts` lee `event.space.capacity` y `event.space.name` en al menos 5 lugares (cupo y `resourceName`)                                                                           | `src/lib/db/events.ts` (~1064, 1087, 1169, 1192, 1265, 1293)                                      |
| La gestión de reservas de admin **incluye** reservas `EVENT` (con dueño nulo)                                                                                                       | `src/lib/db/adminReservations.ts` — es un bug, ver §8                                             |

## 3. Por qué sessions-first

Se evaluó, en orden: (a) un modo «una sola ocasión» junto al semanal, (b) grupos con
expansión del ledger sobre reservas recurrentes, (c) sesiones cargadas una por una. Se eligió
(c) porque **elimina** más de lo que agrega:

- **Lo nocturno sale gratis:** cada sesión tiene su propio inicio y fin (datetime), pueden ser
  días distintos. Un evento de una sola ocasión es un evento con **una** sesión. No hay modo.
- **Horarios distintos por día:** hoy todos los días de la semana comparten una ventana.
- **Desaparece la maquinaria de excepciones para eventos:** `ReservationException`,
  `effective_occurrence_window`, el flujo 409 `EventEditDropWarning`, y las claves
  «weekday + fecha nominal». Cancelar o reprogramar una sesión = editar/borrar la sesión.
- **Se acaba la dependencia del cron para eventos:** las reservas pasan a ser no recurrentes,
  así que `rebuild_reservation_ledger_forward` y `maintain_reservations` (rama recurrente) no las
  tocan. Esto elimina el peligro encontrado en la v1 de este doc (una reserva de grupo con
  `space_id` nulo que el cron saltea en silencio, justo el modo de falla de CLAUDE.md §4).
- **Se acaba la expansión RRULE duplicada** (SQL y cliente) para eventos.

Lo que cuesta:

1. **El generador pasa a ser solo UI.** «Agregar una sesión» y «agregar varias» (días de la
   semana + rango + horas, la misma lógica de hoy) **llenan la lista de sesiones del
   formulario**; nada persiste la regla. Una vez generadas y reacomodadas no se puede
   «reaplicar». El usuario lo aceptó. Encaja con lo que ya existe: el panel de sesiones es
   hoy una UI de **staging** que no persiste hasta guardar el evento.
2. **Más filas:** un bootcamp de 6 meses diarios son ~130 sesiones. Se mitiga con inserción de
   ledger **set-based** y ocultando las reservas de evento de la gestión de reservas (§8).
3. **Migración** de los eventos semanales existentes (§6). En producción hay solo el caso del
   hackatón (dos eventos), pero las bases locales/preview pueden tener más: la migración debe
   ser general.
4. **Las notificaciones** de «sesión cambiada» pasan a clavarse por id de sesión en vez de
   «weekday + fecha». Más simple, pero es un cambio.

## 4. Diseño: sesiones

- Tabla `EventSession`: `id`, `eventId` (FK, cascade), `startTime`, `endTime` (BigInt ms),
  `status` (`ACTIVE` | `CANCELLED`), `cancelReason?`, `cancelledAt?`, `previousStartTime?` /
  `previousEndTime?` (para el aviso «se reprogramó de X a Y»). **La sesión es la fuente de
  verdad; la reserva se deriva.** Validaciones: `end > start`, duración ≤ **7 días**,
  múltiplos de 15 min, zona Argentina (helpers de `admin-timezone`), y **un evento debe tener
  al menos una sesión activa**.
- Cada sesión activa tiene su reserva **no recurrente** (`reservableType=EVENT`,
  `reservableId=event.id`, vínculo a la sesión), estado `APPROVED`, creada con
  `create_event_reservation()` (rama no recurrente, ya existente). Cancelar una sesión libera
  su reserva (el ledger sigue la FK/estado, ver milestone 12) y deja la sesión como historial.
- `Event.startTime/endTime` pasan a **derivarse** (primera sesión / última sesión) para
  listados y estado (`eventDisplayStatus`: ENDED cuando la última sesión activa terminó).
  `rrule`/`recurrenceEnd` dejan de escribirse; **las columnas se conservan** para el futuro
  evento recurrente sin fin (§9).
- **Formulario** (sección «Agenda» de `event-form.tsx`): la lista de sesiones **reemplaza** a
  días-de-semana + rango + hora. Acciones: «Agregar una sesión» (inicio + fin) y «Agregar
  varias» (días de la semana, rango de fechas, hora de inicio y de fin: la misma lógica de hoy,
  `planEventOccurrences`, generando filas). Cada fila se edita/borra; las no guardadas llevan el
  badge «Sin guardar». **Nada se persiste ni se envía un correo hasta guardar el evento** (el
  comportamiento actual). Lista paginada de a 10 (ya existe).
- **Guardar/publicar crea las reservas** en una transacción; un conflicto de espacio aborta todo
  y el mensaje **nombra la sesión y el espacio** que chocan. Editar un evento guardado: diff de
  sesiones por id (agregar / cambiar / cancelar); cancelar o reprogramar exige **motivo** (regla
  vigente) y notifica a los participantes **después de que la transacción confirme**.
- Notificaciones: `event-occurrence-update.ts` y `event.sessionChanged` se re-claveyan por
  sesión; el correo por lote (un correo por participante con todos los cambios) se mantiene.

## 5. Diseño: grupos de espacios

- `SpaceGroup` (`id`, `name`, `slug`, `description?`, timestamps BigInt ms) y
  `SpaceGroupMember` (`groupId`, `spaceId`, `@@unique([groupId, spaceId])`; `Cascade` desde el
  grupo, `Restrict` hacia el espacio mientras pertenezca).
- Tabla **aparte de `Space`**: un grupo nunca llega a la landing, a `/spaces` ni a la
  navegación de reservas (que salen de `getReservableSpaces()`).
- «Todo el edificio» es un grupo con todos los espacios. Los grupos pueden **solaparse**
  (p. ej. «Planta alta» ⊂ «Edificio»).
- `Event.spaceGroupId` nullable y `Event.spaceId` nullable, con **CHECK**
  `num_nonnulls(space_id, space_group_id) = 1`. Selector «dónde» en el formulario: espacio o
  grupo.
- CRUD de superadmin en `/admin/space-groups`: permiso nuevo en `src/lib/rbac.ts`, entrada en
  `ADMIN_PATH_PERMISSIONS` (middleware), en `configNavigation` y en `SEGMENT_LABELS` de las migas
  (CLAUDE.md §3 y §10). Auditoría: entidad `SpaceGroup` en el registro + loader en `SNAPSHOTS`,
  miembros como `set` **con nombres** (CLAUDE.md §11).

### Decisión pendiente de confirmar: cómo se bloquean los espacios del grupo

El usuario planteó que el fan-out podría ser lento/costoso y difícil de mantener. Análisis:

- **Costo:** el ledger ya es una fila por bucket de 15 min **por espacio**, así que la cantidad
  de filas de ledger es **igual en cualquier opción**; solo se multiplican las filas de
  `reservations`. Con ~10 espacios: hackatón (20 h, edificio) ≈ 800 filas de ledger; bootcamp de
  6 meses diarios de 9 h en todo el edificio ≈ 65 mil. Postgres lo resuelve; lo único que
  conviene es insertar el ledger **set-based** en vez del loop fila por fila.
- **Mantenimiento:** el riesgo real de «una reserva por espacio» es el invariante en la app
  (acciones sobre una sola de las N reservas, ediciones que no replican). Se contiene con un
  helper único «reservas del evento» y con el §8 (las reservas de evento no se tocan desde la
  gestión de reservas).

Con sessions-first aparecen **dos opciones viables**:

- **Opción 1′ — una reserva por sesión con `space_group_id` y el ledger expandido a los
  miembros.** Ahora es viable porque las reservas son **no recurrentes**: el cron recurrente
  nunca las toca. Mantiene en ~130 las filas de `reservations` del bootcamp. Requiere:
  `Reservation.space_id` nullable + CHECK, que `create_event_reservation` acepte un grupo y
  escriba el ledger de cada miembro, y revisar la rama de borrado de `maintain_reservations`
  y todo JOIN `reservations → spaces`. Es retroactiva si cambia la membresía (con un rebuild).
- **Opción 3 — una reserva ordinaria por (sesión × espacio)**, todas en una transacción, con el
  `create_event_reservation()` de hoy: **cero cambios de SQL**; ~1.300 reservas en el bootcamp
  de edificio; no retroactiva (aceptado por el usuario).

**Propuesta: 3 para empezar** (sin tocar el SQL delicado; se puede migrar a 1′ más adelante sin
cambiar el modelo de sesiones), y re-evaluar si el volumen molesta. Pendiente de confirmación.

## 6. Migración de eventos existentes

Una migración de datos genera, para cada evento con `rrule`, una `EventSession` por ocurrencia
**con sus excepciones aplicadas**: ocurrencias canceladas se omiten (o quedan `CANCELLED` con su
motivo si ya había participantes avisados), las reprogramadas toman su ventana efectiva. Después
las reservas semanales recurrentes del evento se reemplazan por las reservas de sesión. Los
participantes cuelgan del evento, no de la sesión: no se tocan. Debe poder correr sobre una base
vacía de eventos sin efecto, y se prueba con una base sembrada con eventos semanales y
excepciones. **No se borran las columnas** `rrule`/`recurrenceEnd`.

## 7. Cupo

- `Event.capacity Int?` se mantiene y se agrega `Event.unlimitedCapacity Boolean @default(false)`.
- Reglas: `unlimitedCapacity` → sin tope. Si no, `capacity` explícita **sobrescribe** (puede
  exceder la capacidad física). Si `capacity` es NULL → el valor por defecto: capacidad del
  espacio, o **suma de las capacidades de los espacios del grupo** (membresía actual).
- Se usa un flag y no «NULL = ilimitado» porque NULL hoy significa «caer a la capacidad del
  espacio» en todos los eventos existentes; reutilizarlo obligaría a un backfill y congelaría
  el valor si cambia la capacidad de un espacio.
- El formulario muestra el valor por defecto precargado y un interruptor «Sin límite».
  `isFull`, la regla única `SPOT_HOLDING_STATUSES`, las tarjetas de landing y de calendario, y el
  correo de inscripción deben entender «ilimitado» (no mostrar `x/cap`, nunca cerrar por lleno).
  `events.ts` deja de depender de `event.space` (nombre del grupo, suma de capacidades).

## 8. Reservas de evento ocultas en la gestión de reservas (bug, se corrige en `preview`)

La gestión de reservas de admin lista las reservas `EVENT` (y las trata con dueño nulo). Nunca
fue la intención: **un evento se modifica con las herramientas de eventos, no desde
reservas**, y con sessions-first la lista se llenaría de cientos de filas. Se corrige **antes y
aparte de este milestone**, en la rama `preview` (no depende de nada de aquí): excluir
`reservableType = 'EVENT'` de las consultas de la gestión de reservas. Los reportes de uso
siguen contando los eventos. Detalle de lo que se cambió: ver el commit en `preview` y la nota
de milestone 22 que lo referencia al integrarse.

## 9. Anotado para más adelante (no se construye acá)

- **Evento recurrente sin fin** («todos los miércoles, siempre»). Usará `rrule`; es una función
  aparte, a modelar cuando haya un caso de uso. Por eso `Event.rrule`/`recurrenceEnd` se
  conservan. Antes de construirlo habrá que decidir cómo convive con las sesiones (probablemente
  una regla que materializa sesiones hacia adelante, como hoy el cron con las reservas).
- **Re-sincronizar un grupo** cuando cambia su membresía (solo si se elige la opción 3 y molesta
  que no sea retroactivo).
- **Calendario multi-día:** la tarjeta de una sesión que cruza la medianoche hay que partirla
  por día (ver slice 3).

## 10. Plan por slices

Cada slice se commitea aparte (sin firmar, mensaje en español) y deja el árbol verde. Cada
slice que toque una pantalla corre `node scripts/mobile-shots.mjs` (CLAUDE.md §13).

1. **Sesiones — dominio y datos:** `EventSession`, schema Zod (`sessions[]` en
   `eventInputSchema`), migración (a mano; **no descartar** el aviso de la FK polimórfica de
   `reservable_id`), `createEvent`/`updateEvent`/`deleteEvent` con una reserva por sesión,
   migración de datos (§6), tests de la lógica pura (generador, diff de sesiones, validaciones).
2. **Sesiones — notificaciones:** re-clavear `event-occurrence-update` y `event.sessionChanged`
   por sesión; lote por participante; correo «reprogramada/cancelada/restaurada».
3. **Calendario y formatos multi-día:** partir ocurrencias por día en `WeekCalendar` /
   `calendar-utils.ts`, formateo es-AR de intervalos («mié 15/10 16:00 → jue 16/10 12:00»),
   landing, detalle, correos, listado admin, MCP. Tests de `calendar-utils`.
4. **Formulario de agenda:** lista de sesiones, «Agregar una sesión / varias», staging con
   «Sin guardar», conflictos nombrando espacio y sesión.
5. **Grupos de espacios:** modelo, CHECK en `events`, semilla («Todo el edificio»), CRUD de
   superadmin con permiso, auditoría, migas, selector en el formulario, reservas por espacio
   (opción 3, §5), adaptación de `events.ts` a `space = null`.
6. **Cupo flexible:** `unlimitedCapacity`, valor por defecto (suma), formulario, y todas las
   superficies que muestran o validan cupo.
7. **Documentación:** CLAUDE.md (modelo de datos, §5 Eventos, el apartado de sesiones —que se
   reescribe—, §11 si hay entidades auditadas, RBAC), este doc con lo realmente construido,
   `docs/OPEN_QUESTIONS.md`, índice de `docs/milestones/README.md`.

## 11. Decisiones y alternativas descartadas

- **Un `Space` oculto «Todo el edificio»:** descartado por el usuario — caso especial que cada
  consulta de espacios tendría que filtrar y que no generaliza.
- **Grupo como campo del `Space`:** descartado: un espacio puede estar en varios grupos.
- **Modo `SINGLE` junto a `WEEKLY` (v1 de este doc):** reemplazado por sessions-first.
- **Mezclar sesiones con `rrule` para el mismo evento:** descartado: generar y luego reacomodar
  vuelve confusa la regla. `rrule` queda reservado al futuro evento recurrente sin fin.
- **Reglas de horario de apertura dentro del evento:** descartado; es texto del evento.
- **Reservas de grupo para usuarios comunes:** fuera de alcance (confirmado).
- **«NULL = cupo ilimitado»:** descartado (ver §7).
- **Cambiar ya todo a _inicio + duración_:** innecesario con sesiones: cada una trae inicio y fin.

## 12. Preguntas abiertas

1. Confirmar opción 3 (una reserva por sesión × espacio) para empezar, con 1′ como evolución.
2. Una sesión **cancelada** de un evento ya publicado: ¿se conserva como historial visible en
   el admin (propuesto) o desaparece?
3. ¿Un evento publicado puede quedarse sin sesiones activas (todas canceladas)? Propuesta: no;
   hay que cancelar el evento entero.
4. Tope de sesiones por evento (propuesta: ~400, para acotar el costo de una carga errónea).

## 13. Qué NO se verificó

- `create_reservation`, `approve_reservation`, `get_unavailable_slots` (`20260924110000`),
  `effective_occurrence_window` y el guard de reprogramación — solo se confirmó que leen el
  ledger por espacio.
- `createEvent` / `updateEvent` / `deleteEvent` completos, las rutas `/api/admin/events` y cómo
  `event-sessions.tsx` y `planEventOccurrences` se reutilizan como generador.
- La rama de borrado de `maintain_reservations` con reservas no recurrentes (¿necesita
  `space_id`?) — relevante solo para la opción 1′.
- Reportes (`/admin/reports`) y la tool MCP frente a sesiones muy largas o numerosas.
