# Milestone 35 — Título de reserva y calendarios/listas sin ruido

**Estado:** done (2026-11-18), versión 1.1.0 (nació como 1.5.0; ver nota en el milestone 28).

## Qué pidió el usuario (2026-11-18)

Siete observaciones sobre cómo se ven las reservas, más una pregunta de producto:

1. «Reservas recientes» del tablero: una tarjeta dentro de otra tarjeta; tiene que ser colapsable
   (al tocar, muestra la descripción). **Evitar modales** salvo que haya una buena razón.
2. El formulario de reserva es feo; una reserva debería tener **título + descripción** (como Google
   Calendar). ¿Sirve el «tipo de reserva»?
3. La tarjeta de la reserva en el calendario (nombre + ✓ + horario + ⌛) es fea: solo el título; el
   color y una leyenda dicen el estado.
4. En el calendario de actividades, reservas y eventos muestran **título + espacio**, sin horario;
   el horario exacto se ve al tocar (la columna de horas ya lo dice).
5. El detalle de una reserva es soso: mejorarlo, con el título.
6. El detalle de un evento en el calendario de actividades también es soso.
7. El contenido de una tarjeta de calendario va **arriba**, no centrado en vertical.

## Decisiones

- **`reservations.title` (nueva columna, `NOT NULL DEFAULT ''`) y `reason` pasa a ser la
  descripción.** No se renombró `reason`: la leen las funciones SQL, el ledger, el historial y el
  conector, y renombrarla no cambia nada para quien usa la app. En código y en pantalla es
  «Descripción»; la columna se documenta así en `prisma/models/reservations.prisma`. La migración
  `20261118100000_reservation_title` rellena el título de las reservas existentes con la primera
  línea del motivo (80 caracteres), así el calendario sigue mostrando lo mismo.
- **El título es obligatorio (≤ 80), la descripción es opcional (≤ 1000).** Reglas en
  `src/lib/reservations/user-rules.ts` (`validateReservationTitle`, `validateReservationReason`,
  `titleFromDescription`), usadas por el formulario, `requestUserReservation` y el conector MCP.
  Un cliente que solo manda el texto (el conector anterior) obtiene su título de la primera línea de
  la descripción, así no se rompió el contrato MCP: `request_reservation` acepta `title` opcional y
  `reason` opcional; `list_my_reservations` devuelve `title`.
- **El título se escribe en la misma transacción que `create_reservation()`**, no como parámetro
  nuevo de la función SQL: es un dato de presentación que ninguna regla de capacidad mira (misma
  lógica que `origin`, milestone 20), y así no hay que recrear la función.
- **«Tipo de reserva»: se saca del formulario del usuario, se conserva el catálogo.** Opinión que se
  le dio al usuario: a quien reserva no le sirve (nada del flujo depende de él, y se elegía casi
  siempre «Reunión»), y los reportes por tipo de las reservas de personas quedaban dominados por
  una sola categoría. Para los **eventos** sí tiene sentido (clasifica la oferta). El servidor usa
  «Reunión» por defecto, o el primero del catálogo si un admin la borró
  (`preferredTypeCode`). No se borró la columna ni el CRUD `/admin/reservation-types`: la decisión
  de si el catálogo queda solo para eventos está abierta (ver `OPEN_QUESTIONS.md`).
- **Sin modales para ver detalles; sí para crear.** Los detalles (de una reserva, de un ítem del
  calendario) abren un **popover anclado a la tarjeta**, como Google Calendar; la lista de reservas
  recientes abre **en la propia fila** (`ExpandableList`). El **alta** de una reserva sigue en un
  `ResponsiveDialog` (diálogo en escritorio, hoja inferior en el teléfono): es un flujo corto y
  enfocado que se abre desde un hueco de la grilla, y anclar un formulario a una selección
  arrastrada era mucho más código sin ganar claridad. La confirmación de aprobar-con-conflictos
  (`ApprovalConflictsDialog`) también se queda: es una confirmación de una acción con efectos en
  otras reservas. «+N más» del mes ya no abre un diálogo con la lista: lleva a la vista de ese día.
- **Cancelar se confirma en el mismo popover** (antes «Eliminar» borraba de un click). Las
  recurrentes siguen preguntando «¿solo esta o toda la serie?» (milestone 5).
- **El color es el estado; hay leyenda.** `occurrence-style.ts` es la única fuente de los colores
  del calendario de un espacio (tarjeta y `CalendarLegend`). Los eventos ahora son violeta también
  ahí (como en el calendario de actividades) en vez de compartir el azul de «Reservado».
- **Alineación arriba:** un `<button>` centra su contenido en vertical por defecto; las tarjetas de
  ambos calendarios usan `flex flex-col items-start justify-start`.
- **Calendario de actividades:** tarjeta = título + espacio (el mes conserva la hora de inicio
  porque no tiene columna de horas). El detalle (`ItemDetails`) lleva franja de color, portada y
  copete del evento, y filas con ícono (día, horario, espacio, quién reservó, descripción). La
  descripción viaja solo en las ramas que ya veían el nombre (admin, reservas propias, eventos
  públicos): `description`/`imageUrl` nunca salen para «Ocupado» ni para eventos no publicados en la
  vista de usuario.
- **El «Calendario» del admin sale de la sección «Reservas»**: ítem de primer nivel justo bajo
  «Panel» (decisión del usuario, misma sesión).

## Qué se construyó

- Migración + `Reservation.title`; `createReservation({ title })`; `requestUserReservation`;
  `POST /api/resources/[spaceId]` (acepta `title`/`reason`).
- Lecturas con título: calendario de un espacio (`resourceCalendar.ts`, una sola consulta trae
  `isRecurring` y `title`), calendario de actividades, listas de admin, tablero de usuario,
  conflictos de aprobación, conector MCP.
- UI: `BookingForm` (título grande sin caja, horario en una fila, descripción opcional, íconos),
  `OccurrenceDetails` + `CalendarLegend` + `occurrence-style.ts`, `ExpandableList`
  (`molecules/expandable-list.tsx`), `RecentReservationsList`, `ReservationDecisionActions`
  (aprobar/rechazar en el lugar, compartido con la hoja de detalle de `/admin/reservations`, que se
  conserva porque va con la línea de tiempo), `ItemPopover`/`ItemDetails` del calendario de actividades.
- Tests: reglas de título/descripción, esquema del formulario.

## Lo que no se hizo

- ~~La página `/admin/reservations` conserva su hoja lateral~~ → reemplazada por un popover (tercera tanda).
- Editar el título de una reserva existente: no hay edición de reservas (solo cancelar).
- Mostrar el espacio en el popover del calendario de un espacio (ya es el título de la página).

## Segunda tanda (misma versión, 2026-11-18)

Pedidos del usuario tras ver la primera:

1. **Esqueleto mientras cargan las reservas** del calendario de un espacio (`CalendarSkeleton`): la
   primera carga reemplaza la grilla por columnas fantasma que pulsan (`animate-pulse`); al cambiar
   de semana la grilla se atenúa y pulsa. Antes se veía vacía —como «todo libre»— hasta que
   respondía la API.
2. **Detalle de la reserva:** el estado va **a la derecha, a la altura del título**; un título largo
   **se parte en varias líneas** (se eligió partir y no cortar con «…»: es el único texto que
   identifica la reserva y un tooltip no existe en el teléfono) y nunca empuja al estado (`shrink-0`).
   El cuadro de color se alinea con la **primera línea** (`mt-[0.3125rem]` = (22 px de línea − 12 px)/2).
3. **Leyenda «No disponible»** sin cuadro: el rayado usaba clases arbitrarias de Tailwind con `_` que
   no pintaban a 12 px; ahora es un `repeating-linear-gradient` en línea.
4. **Tablero del usuario en tres secciones** (`organisms/dashboard/user-activity-sections.tsx`):
   «Eventos» (próximas sesiones de los eventos con lugar — pendiente o aprobado —, por correo
   normalizado), «Reservas» (próximas, pendientes o aprobadas) y «Reservas pasadas» (historial
   **completo y paginado**, de cualquier estado). Todo **por ocurrencia** vía
   `reservation_occurrences()`: `src/lib/db/userActivity.ts`, `GET /api/user/reservations?when=&page=`
   y `GET /api/user/upcoming-events`. Una reserva en curso cuenta como próxima; pasada = ya terminó.
   `/api/user/stats` dejó de devolver «las últimas 10» (`recentReservations`) y devuelve
   `totalReservations` (antes el tile «Reservas totales» mostraba, sin querer, el largo de esa lista
   de 10). El tablero del **admin** muestra otra cosa — lo que viene de todas las personas, para
   decidir —, así que se conserva y se renombró «Próximas reservas».
5. **Calendario de actividades:**
   - **Usuario:** solo sus reservas y los eventos publicados (+ días cerrados). Las ajenas ya no se
     piden a la base ni salen como «Ocupado», y los eventos no publicados tampoco se muestran
     (`CalendarItemKind` ya no tiene `busy`; se borró `mergeBusy`). La disponibilidad se consulta en
     el calendario de cada espacio. De yapa, es más privado: ningún dato ajeno sale de la base.
   - **Admin:** ver «Cuarta tanda» más abajo (chips de ocupación y conteos por día); los botones
     Eventos / Pendientes / Aprobadas quedan como filtro del cliente, todos activos por defecto.
   - Ideas que se le dieron al usuario: una columna por espacio (**descartada por él**: los espacios son
     configurables y pueden ser muchos); chips de ocupación y conteos por día (**hechas**, abajo).

## Tercera tanda (misma versión, 2026-11-18)

- **Un evento, una fila:** `listUserUpcomingEventSessions` devuelve solo la **próxima sesión** de cada
  evento (`DISTINCT ON (e.id)`), tanto en el tablero como en «Mis eventos».
- **`/user/events` en tres secciones** (`organisms/dashboard/user-events-sections.tsx`, datos en
  `db/userActivity.ts`):
  - **Mis eventos:** donde tengo lugar (pendiente o aprobado), con su próxima sesión.
  - **Eventos disponibles** (`GET /api/user/events/available`): publicados, sin terminar, donde **no**
    tengo lugar ni me rechazaron (una inscripción rechazada no puede repetirse, milestone 25 S5), y
    que o **no tienen formulario** (se va sin inscripción) o tienen la inscripción **abierta y con
    cupo** o **todavía no abrió** (badge «Abre el dd/mm hh:mm», sin botón de inscripción; agregado a
    pedido del usuario). Se omiten cerrados, completos y con formulario sin publicar. Misma regla de cupo que la landing
    (`SPOT_HOLDING_STATUSES`).
  - **Eventos pasados** (`GET /api/user/events/past?page=`): historial **por evento**, paginado, de
    los terminados (`COALESCE(recurrence_end, end_time) < ahora`, la regla de `eventDisplayStatus`) en
    los que me inscribí, con el estado de la inscripción. Por evento y no por sesión: un evento
    semanal de veinte sesiones sería veinte filas iguales.

## Arreglo: la reserva en curso no se dibujaba (misma versión, 2026-11-18)

Una reserva propia ya empezada (15:15–17:00, vista a las 15:25) **desaparecía del calendario del
espacio**. Causa: `getUserReservationsInWindow` filtra por el _inicio_ de cada ocurrencia y
`resourceCalendar.ts` arrancaba la ventana en `max(ahora, inicio de la semana)`, así que todo lo que
había empezado antes de «ahora» quedaba afuera (las de hoy ya pasadas también). Ahora se pide la
ventana visible entera. Además, la tarjeta de una reserva va a `z-[60]`, por encima del rayado de
las horas pasadas (`z-50`), que si no la tapaba y le bloqueaba el clic.

## Cuarta tanda (misma versión, 2026-11-18): calendario del admin

- **Chips de ocupación** (`src/lib/calendar/occupancy.ts`, pura, con tests). En día / 3 días / semana,
  las reservas **de un mismo espacio que se pisan** (se encadenan por superposición) se resumen en
  **un chip «Coworking 12/20 · 2 pend.»**: pico de personas aprobadas a la vez (suma de `actorSize`;
  dos reservas que se tocan no suman) sobre la capacidad, y cuántas pendientes hay. Color por nivel
  (<70 % celeste, ≥70 % ámbar, completa roja). Al tocarlo, un popover con el resumen y la lista de las
  reservas (título, horario, quién, estado). Una reserva que no se pisa con ninguna sigue siendo tarjeta.
  Se agregaron `actorSize` y `capacity` a los ítems **solo del admin** (`get_actor_size()` y
  `spaces.capacity` en la consulta); el chip se arma en el cliente, nunca viene del servidor.
- **Un espacio es un carril solo mientras está ocupado**, no una columna fija: los espacios son
  configurables y pueden ser muchos (decisión del usuario al descartar «una columna por espacio»).
- **Mes del admin:** cada día muestra **conteos** (● eventos, ● aprobadas, ● pendientes) y una marca
  «Cerrado»/«Mant.»; tocar el día abre la vista de día. El mes del **usuario** conserva sus chips (tiene
  pocas reservas propias y el título importa más que el conteo).
- Las capas (Eventos / Pendientes / Aprobadas) siguen como filtro, ahora todas activas por defecto: con
  los chips ya no hace falta ocultar las aprobadas.

### Ajuste de la cuarta tanda (el usuario la vio y seguía ilegible)

Con la primera versión, una reserva que no se pisaba seguía siendo tarjeta y una cadena de reservas
formaba un bloque gigante con un solo pico. Ahora (`aggregateOccupancy`):

- **Con «Todos los espacios», todo es un chip con su número**, también una reserva sola.
- **Tramos de tiempo, no cadenas:** cada espacio se corta donde una reserva empieza o termina, y cada
  tramo lleva el número de **esa hora** (tramos contiguos con los mismos números se unen).
- **Texto corto, número primero:** «12/20 +2» (aprobadas/capacidad y +pendientes) y debajo el espacio;
  «· 2 pend.» se partía en tres líneas en los carriles angostos. Solo pendientes → trazo punteado ámbar.
- **Con un espacio elegido**, un tramo de una sola reserva sigue siendo tarjeta con su título
  (`cardsForSingles`): al mirar un espacio puntual importa saber qué es.
- Límite conocido: con muchos espacios ocupados a la misma hora los carriles son angostos; el número
  sigue legible y el popover da el detalle. Si hiciera falta, el siguiente paso sería un solo chip por
  franja con el total del edificio.

### Segundo ajuste: «todo junto» con todos los espacios (decisión del usuario)

Los chips por espacio seguían dependiendo de los **carriles**: un mismo horario puede tener tantos
chips como espacios haya (hoy 4; otra organización podría tener muchos más) y no hay forma de
arreglarlo dentro de una columna. El usuario propuso agregar todo; se hizo:

- **«Todos los espacios» (por defecto):** `aggregateOccupancy(items, { mode: "building" })` corta el
  tiempo donde cualquier reserva empieza o termina y devuelve **un bloque por tramo** — «3 reservas /
  1 pend.» (o «2 pendientes» si no hay aprobadas, con trazo punteado ámbar) — **sin espacio**. Los
  bloques no se pisan, así que es **una sola columna** y el costo visual no crece con la cantidad de
  espacios. Tramos contiguos con los mismos números se unen; un hilo del color del fondo
  (`ring-background`) separa los bloques seguidos (antes no se distinguían).
- **El detalle por espacio** está en el popover del bloque (`BuildingDetails`): las reservas de esa
  franja agrupadas por espacio, cada uno con su ocupación («Coworking 3/12»), título, horario, quién y
  estado.
- **Con un espacio elegido** se mantiene el modo por espacio (chips «12/20 +2», tarjeta si es una sola).
- **No se muestran franjas «no disponibles» a nivel edificio**, como anticipó el usuario: no se puede
  saber qué espacio está ocupado ni conviene calcular la unión de todos (costo sin valor). Para
  disponibilidad se usa el calendario de cada espacio.
- Los eventos siguen como tarjetas violeta (son pocos y bloquean su espacio entero).

## Tercera tanda (misma versión, 2026-11-18): tablero del admin por espacio

El usuario notó que el tablero del admin había quedado parecido al del usuario (una lista plana de
filas) y pidió volver a lo que el admin necesita: **decidir mirando superposiciones**.

- **`AdminSpaceBoard`** (`templates/admin/admin-space-board.tsx`) reemplaza a `DashboardRecentReservations`
  (borrado, igual que `RecentReservationsList`). **Una sección por espacio** (en el orden configurado,
  incluso los vacíos), con la ventana «esta semana y la siguiente»: lunes a domingo, la primera arranca
  **hoy** (lo ya pasado no se decide). Flechas ±1 semana (no se retrocede de la primera) y «Hoy».
  `mondayOfDateKey()` (`admin-timezone.ts`, con test) calcula el lunes en la hora del predio.
- Cada día con reservas es una **tarjeta**: cuántas reservas, chip de pendientes y «Se pisan» (hay
  sobrecarga, `spacesInConflictCount`). Al tocarla se abre **debajo** la línea de tiempo de ese día
  (`AdminServiceDayTimeline`, la de antes) con su leyenda. Solo se consideran reservas vivas
  (PENDING/APPROVED): las rechazadas no ayudan a decidir. Una sola consulta trae todos los espacios.
  El filtro «Pendientes» (con el total) deja solo los días con algo por decidir; la línea de tiempo
  sigue mostrando todo ese día, porque las aprobadas son el contexto del conflicto.
- **Los bloques de la línea de tiempo ahora llevan texto**: título (negrita) y persona, cortados con
  «…» si no entran (antes eran cuadros vacíos). `SLOT_WIDTH_PX` 16 → 20 para que se lean.
- **El detalle es un popover, no una hoja lateral** (`organisms/admin/reservation-popover.tsx`):
  franja de color del estado, título + estado, quién reservó (con correo), día y horario, espacio,
  personas, descripción, chip «Vía asistente», aviso **con qué reservas se superpone** (título, persona,
  horario) y, si está pendiente, `ReservationDecisionActions`. Se cierra solo al rechazar. Lo usa también
  `/admin/reservations` (`AdminReservationDetailSheet` borrado): `AdminServiceDayTimeline` recibe
  `processing`/`onAction` en vez de `onSelectReservation`.
- `AdminReservationsCardsPanel` perdió la variante `dashboard` (ya no la usa nadie).
- Los tipos de reserva de admin se importan de `@/lib/api/admin-reservations`; el re-export desde la
  plantilla borrada ya no existe.
- **Sin verificar en el navegador** al cerrar esta tanda: tipos, lint, formato y 803 tests pasan, pero
  falta mirar el tablero con datos reales (`node scripts/mobile-shots.mjs`).

### Cuarta tanda: de a un día (misma versión, 2026-11-18)

Con muchas reservas, las tarjetas por día (una por día, fecha larga) ocupaban media pantalla por espacio;
una tira de calendario compacta (probada primero) tampoco convenció. Quedó **paginar los días**: cada
sección de espacio muestra **un día a la vez**, empezando por el primer día con reservas de la ventana,
con flechas ‹ › que saltan al **anterior / siguiente día que tenga reservas** (los vacíos no existen) y
«Día N de M». El encabezado del día lleva fecha, «Hoy», conteo, pendientes y «Se pisan»; la línea de
tiempo está **abierta debajo**, sin clic previo. Con «Pendientes» se pagina solo por los días con algo
pendiente. El nombre del espacio pliega/despliega la sección. Si el día elegido desaparece (se decidió
la última reserva, cambió la ventana o el filtro) se vuelve al primero. La navegación por semanas de
arriba sigue acotando qué se pide.
