# Milestone 12 — Auditoría de dominio: integridad de reservas, deriva al editar lo publicado, retención

> **Estado (2026-09-25): auditoría completa, las ocho slices implementadas.** Este documento
> es el registro de la auditoría corrida el **2026-09-24** contra la rama `preview` (en
> `b9729a2`, con el working tree sin commitear del milestone-11 encima), más una **segunda
> pasada** el 2026-09-25 sobre las áreas que la primera no cubrió. Los hallazgos, la evidencia
> y el razonamiento se conservan como se escribieron; las notas de implementación son
> agregados.
>
> De 28 hallazgos numerados más la lista de la Parte 4: **27 corregidos**, **1 no se
> reprodujo** (D21), **0 postergados**. Once migraciones (`20260924100000` … `20260925010000`),
> 11 tests unitarios nuevos, y cada afirmación de comportamiento re-verificada contra un
> PostgreSQL real en lugar de quedar como razonamiento.
>
> | Slice | Cubre                      | Estado                                                                           |
> | ----- | -------------------------- | -------------------------------------------------------------------------------- |
> | A     | D1, D2, D17                | **Hecha** — migración `20260924100000_ledger_integrity`                          |
> | B     | D3, D4, D5, D16            | **Hecha** — migración `20260924110000_capacity_predicates`                       |
> | C     | D6                         | **Hecha** — guarda en `updateEvent`                                              |
> | D     | D7                         | **Hecha** — migración `20260924120000_retain_reservation_history`                |
> | E     | D8, D9, D20                | **Hecha** — migraciones `…130000_news_slug_history`, `…140000_news_needs_review` |
> | F     | D10, D11, D12              | **Hecha** — advisory lock, avisar-y-confirmar en capacidad                       |
> | G     | D13–D15, D18, D19, Parte 4 | **Hecha** — D21 no se reprodujo                                                  |
> | H     | D7 (retención), D22–D28    | **Hecha** — segunda pasada + política de retención                               |

Según `docs/milestones/README.md`, un milestone es "una pieza coherente de capacidad de cara
al usuario". Igual que el milestone 10, este es deliberadamente una excepción: es un
**milestone de calidad**. Se agrupa como uno solo porque casi todos los hallazgos se remontan
a las mismas dos causas de fondo — el `reservation_ledger` es una **tabla derivada sin
integridad referencial y sin nadie que sea dueño de su ciclo de vida**, y **"publicado" se
trata como una bandera de estado y no como un compromiso con el mundo de afuera**.

## Por qué se corrió esta auditoría

Pedido directo: _"audit the code, and look for edge cases that could bring problems"_, con dos
puntos de partida nombrados:

1. ¿Hay recursos (eventos, noticias, formularios, …) que se puedan **romper si se publican y
   después se editan** — o sea, inconsistencias introducidas después del hecho?
2. ¿La **lógica de reservas** (usuarios, eventos y demás) funciona como se espera, cuidando la
   capacidad y evitando solapamientos?

No lo disparó ningún incidente. Es un barrido proactivo de la capa de dominio, y la
contraparte natural del milestone 10, que auditó el frontend del mismo árbol.

## Método

Solo análisis estático — **no se corrió ninguna base ni se ejecutó ninguna consulta**, así que
cada hallazgo de abajo sale de leer el código (migraciones SQL + TypeScript) y razonarlo, no de
observarlo. Concretamente:

- **SQL:** se enumeró cada `CREATE OR REPLACE FUNCTION` de `prisma/migrations/**` y se leyó
  completa la **última definición de cada una** (`20260706000000_unify_space_resource` para la
  mayoría, `20260713000000_fix_get_actor_size_space` para `get_actor_size`,
  `20260406200000_reservation_ledger_maintenance` para `effective_occurrence_window` /
  `recurring_reservation_has_occurrence_after`). Las copias superadas se leyeron solo para
  confirmar que estaban superadas.
- **Integridad referencial:** se extrajo de las migraciones cada `CREATE TRIGGER`,
  `CREATE INDEX` y `ADD CONSTRAINT … FOREIGN KEY` que toca `reservations`,
  `reservation_ledger`, `reservation_exceptions` y `check_ins`, y se cruzó con
  `prisma/models/reservations.prisma`. **El esquema de Prisma no es autoritativo acá**: varias
  relaciones suyas no tienen contraparte a nivel base (la FK polimórfica `reservable_id` se
  eliminó a propósito en `20260622000000`), así que se tomaron las migraciones como fuente de
  verdad.
- **Call sites:** se enumeró cada llamador de `createReservation`,
  `createReservationException`, `deleteReservation`, `updateReservation`,
  `setReservationStatus` y `approve_reservation`, y después se leyó completa cada ruta que los
  rodea.
- **Ciclo de vida:** se leyeron de punta a punta `events.ts` (`createEvent` / `updateEvent` /
  `applySessionActions` / `deleteEvent`), `forms.ts` (clonado plantilla → instancia),
  `participants.ts` (`getPublicForm` / `submitForm` / `decideParticipants`) y `news.ts`,
  buscando específicamente qué cambia cuando se edita una fila **en vivo**.

**Lo que este método no puede ver, y por lo tanto la auditoría NO cubrió:** los planes de
consulta reales y el comportamiento bajo contención; si las funciones de la base desplegada
coinciden con los archivos de migración (nada verifica la deriva); el nivel de aislamiento real
en producción; cualquier bug que solo se manifieste con concurrencia real; y la corrección del
propio renderizado de disponibilidad del frontend más allá de los datos que recibe. Varios
hallazgos (D4, D5, D10) predecían comportamiento que había que **confirmar contra una base real
antes y después del arreglo** — cada uno nombra el chequeo a correr.

> ### Las correcciones se verificaron distinto que la auditoría
>
> Cada slice se aplicó al PostgreSQL local de Docker (`npx prisma migrate deploy`) y su
> hallazgo se **reprodujo como falla y después se volvió a probar**, dentro de transacciones
> con rollback y sobre espacios creados para el test, para que el resultado no dependa de los
> datos sembrados. Eso resultó importar más de lo esperado: encontró dos defectos que la
> lectura no había visto, ambos en código escrito _para corregir_ un hallazgo de la auditoría —
>
> - `peak_space_usage` contaba doble una reserva cuando un bucket de sondeo desalineado se
>   solapaba con dos de sus filas del ledger (slice B), lo que habría salido a producción como
>   un bloqueo "conservador" de más;
> - el formulario de eventos trataba **cualquier** 409 como el aviso de sesiones perdidas, así
>   que el 409 de capacidad nuevo de la slice F habría abierto el diálogo equivocado con una
>   lista vacía.
>
> Ninguno de los dos se ve leyendo el diff. Los dos quedaron registrados en su slice.

> ### Segunda pasada (2026-09-25)
>
> A pedido, se volvió a correr la auditoría para ver si aparecían problemas nuevos o cosas que
> la primera pasada se hubiera perdido. Se apuntó deliberadamente a lo que la primera **no**
> había leído: `auth.ts` y el callback `jwt()`, `middleware.ts`, `api-auth.ts` / `page-auth.ts`,
> `ratelimit.ts`, `users.ts`, la asignación de roles, el flujo de verificación de email, y el
> cron de snapshots de reportes. Salieron siete hallazgos más (D22–D28), incluido uno —
> **D24, el baneo no se aplica en la API** — de la misma familia que los peores de la primera
> pasada: una regla que existe como redirect de UI y no como autorización.
>
> La lección de método: la primera pasada siguió los dos hilos que el pedido nombró (reservas,
> publicar-y-editar) y los siguió hasta el fondo. Lo que quedó sin mirar fue **la capa de
> autenticación y autorización**, que no estaba en ninguno de los dos hilos. Si se vuelve a
> auditar, conviene empezar por lo que la auditoría anterior declaró fuera de alcance.

## Escala de severidad

- **Crítico** — produce estado de dominio incorrecto en silencio (dobles reservas, capacidad
  perdida), sin que nadie vea un error.
- **Alto** — destruye datos, rompe una URL publicada, o deja una superficie de cara al usuario
  sistemáticamente mal.
- **Medio** — explotable, engañoso, o incorrecto en los bordes; sin corrupción silenciosa.

---

## Parte 1 — Integridad de las reservas

### La forma del problema

`reservation_ledger` es la expansión materializada de cada reserva en buckets de 15 minutos. Es
lo **único** que se consulta para capacidad y disponibilidad: la tabla `reservations` nunca se
suma. Eso hace que el ledger sea autoritativo para la pregunta "¿está libre este espacio?" al
mismo tiempo que es derivado de una tabla con la que no tiene ninguna relación.

Tres propiedades lo volverían seguro: (a) que toda escritura a `reservations.status` se propague
al ledger, (b) que todo borrado de una fila de `reservations` elimine sus filas del ledger, y
(c) que los predicados que leen el ledger sean correctos. **Ninguna de las tres se cumplía.**
D1–D5 son las formas en que eso se rompe.

### D1 — Cancelar o rechazar una reserva nunca liberaba el lugar _(Crítico)_

`setReservationStatus` (`src/lib/db/adminReservations.ts`) era:

```ts
return prisma.reservation.update({
  where: { id },
  data: { status, ...(deniedReason ? { deniedReason } : {}) },
});
```

`updateReservation` (`src/lib/db/reservations.ts`) — que respalda a `rejectReservation()` y
`cancelReservation()` — hacía lo mismo vía Prisma. Ninguna de las dos tocaba
`reservation_ledger`. Y no había ningún trigger que lo hiciera: buscando `CREATE TRIGGER` en
todas las migraciones aparecen **solo** triggers de `updated_at`
(`20260404180000_unix_timestamps_ms`, más tres en `20260622000000` y uno en `20260706110000`).
Nada sincronizaba el estado.

Los únicos writers que sí mantenían el ledger al día eran `approve_reservation()` (que
actualiza ambos, incluidas las filas que auto-rechaza) y
`rebuild_reservation_ledger_forward()` (que vuelve a leer `r.status`).

Consecuencias, en orden de gravedad:

- **Una reserva APPROVED que un admin cancela conservaba sus filas del ledger en APPROVED.** El
  espacio quedaba ocupado — capacidad consumida en un espacio no exclusivo, el horario bloqueado
  de plano en uno exclusivo — sin nada en ningún lado que indicara por qué.
- `maintain_reservations()` no lo reparaba: su loop de rebuild está limitado a
  `status IN ('PENDING','APPROVED')`, así que una reserva CANCELLED o REJECTED se saltea por
  completo y sus filas viejas nunca se reescriben. Se podan solo cuando
  `occurrence_end_time` finalmente queda en el pasado.
- En una reserva **recurrente**, las filas viejas se extienden hasta un año hacia adelante.
- Una reserva PENDING que se rechaza conserva filas del ledger en PENDING, lo que es menos
  dañino (PENDING no se suma) pero deja a la cascada de `approve_reservation` volviendo a
  "rechazar" filas ya rechazadas, y produciendo entradas de auditoría duplicadas.

### D2 — Un usuario borrando su propia reserva dejaba huérfanas sus filas del ledger _(Crítico)_

`DELETE /api/resources/[spaceId]` terminaba con:

```ts
await prisma.reservation.delete({ where: { id: reservationId } });
```

`reservation_ledger` **no tenía foreign key** a `reservations`. La tabla se crea en
`20251015211848_init` con una primary key y nada más, y la única restricción agregada después
es `reservation_ledger_reservable_status_idx` (un índice, en `20260610000000`). El modelo de
Prisma tampoco tenía `@relation`. Así que no se disparaba ninguna cascada y las filas del ledger
sobrevivían a la reserva que describían.

Y como sobrevivían con el estado que tenían — `APPROVED` para todo lo que el admin hubiera
aprobado — **la reserva borrada seguía ocupando el lugar**. Es peor que D1 en un aspecto: con D1
al menos queda una fila para inspeccionar y reparar; acá la evidencia se fue.

`maintain_reservations()` poda solo `occurrence_end_time < today_start_ms`, así que una reserva
_futura_ borrada hoy bloqueaba su horario hasta que llegara ese día, y una reserva _recurrente_
borrada bloqueaba un horario semanal por hasta un año.

Dos problemas más en el mismo handler:

- Saltea `deleteReservation()` (`src/lib/db/reservations.ts`), que al menos se niega a borrar
  una reserva que ya empezó. Por esta ruta un usuario podía borrar reservas pasadas.
- `check_ins_reservation_id_fkey` es `ON DELETE SET NULL` (`20251015211848_init`), así que
  borrar una reserva pasada desvinculaba en silencio sus registros de ingreso de la reserva que
  los justificaba.

### D3 — `approve_reservation()` nunca validaba la reserva que estaba aprobando _(Crítico)_

La función (última definición, `20260706000000_unify_space_resource`) leía la reserva y su
espacio, y después **inmediatamente**:

```sql
UPDATE reservations SET status = 'APPROVED', … WHERE id = _reservation_id;
UPDATE reservation_ledger SET status = 'APPROVED' WHERE reservation_id = _reservation_id;
```

Solo _después_ de eso miraba otras filas, y solo para decidir cuáles **pendientes**
auto-rechazar. No había ningún chequeo de que la reserva que se estaba aprobando todavía
entrara.

`create_reservation()` sí chequea capacidad y exclusividad — pero al momento de la
**creación**. Todo lo que ocupe el lugar entre la creación y la aprobación es invisible:

- un admin crea un evento en ese espacio (las reservas de evento se escriben como `APPROVED`
  con `actor_size` = la capacidad completa del espacio);
- otra reserva pendiente se aprueba primero, y el test `used > cap` de la cascada justamente
  perdona a esta;
- un superadmin baja la `capacity` del espacio.

En todos esos casos la aprobación tenía éxito y producía un sobrecupo o una doble reserva
genuinos, con el ledger de acuerdo en que todo estaba bien.

Vale notar la asimetría que eso creaba: la _cascada_ aplicaba capacidad sobre las reservas
pendientes de todos los demás, mientras la reserva sobre la que realmente se estaba actuando
quedaba exenta.

### D4 — Los chequeos de capacidad no exclusiva pasaban en silencio con horarios desalineados _(Crítico)_

Toda suma de capacidad del código estaba escrita como un **join por igualdad sobre el inicio del
bucket**. De `create_reservation`:

```sql
SELECT COALESCE(MAX(slot_sum), 0) INTO overlap
FROM (
  SELECT COALESCE((
           SELECT SUM(l.actor_size) FROM reservation_ledger l
           WHERE l.space_id = _space_id
             AND l.status = 'APPROVED'
             AND l.occurrence_start_time = gs          -- ← igualdad
         ), 0) AS slot_sum
  FROM generate_series(_start_ms, _end_ms - 1, 900000::bigint) AS gs
  WHERE gs < _end_ms
) slot_check;
```

`reservation_window_conflicts()` (la guarda de reprogramación) tenía la forma idéntica.

`insert_into_ledger()` escribe los buckets con
`generate_series(_occurrence_start_ms, _occurrence_end_ms - 1, 900000)` — es decir, **desde el
inicio propio de cada reserva**, no desde una grilla compartida. Así que la igualdad solo
coincide cuando todas las reservas del espacio empiezan en el mismo múltiplo de 15 minutos desde
epoch. Nada lo exigía:

- `POST /api/resources/[spaceId]` recibía `startTime` como milisegundos crudos del cliente.
  Validaba finitud, orden, "no en el pasado", "no hoy", día de semana y una ventana horaria —
  **nunca** divisibilidad por 900000.
- `timeOfDaySchema` en `src/lib/schemas/events.ts` era `/^([01]\d|2[0-3]):[0-5]\d$/` —
  cualquier minuto. Un evento a las `10:07` escribía buckets a las 10:07 / 10:22 / 10:37 … con
  los que ninguna reserva de usuario se iba a comparar nunca.

Cuando las grillas no coinciden, `slot_sum` es `0` en todos los buckets, `overlap` es `0`, y
`(overlap + actor_size) > cap` es falso por más lleno que esté el espacio. El chequeo no
fallaba: **tenía éxito vacuamente**.

Dos formas distintas en las que muerde:

1. **Por accidente.** Un admin agenda un evento en un horario fuera del cuarto de hora. A partir
   de ahí la ocupación de ese evento es invisible para toda reserva de usuario en el mismo
   espacio, y viceversa. El camino exclusivo no se ve afectado (compara rangos, no igualdad),
   así que esto solo aparece en espacios por capacidad — donde también es más difícil de notar,
   porque unas personas de más en una sala de coworking parece plausible.
2. **A propósito.** Un request con `startTime = <valor alineado> + 1` reserva por encima de la
   capacidad sin límite. Probablemente la UI ofrezca solo horarios alineados; la API no los
   exigía.

**Para confirmar contra una base real:** insertar dos reservas en un espacio no exclusivo de
capacidad 2, la segunda desplazada 1 ms, y observar que la segunda se acepta donde una alineada
se habría rechazado.

### D5 — `get_unavailable_slots()` sumaba el rango entero en lugar de cada slot _(Crítico)_

`20260706000000_unify_space_resource`:

```sql
SUM(l.actor_size) OVER (
  PARTITION BY l.space_id
  ORDER BY l.occurrence_start_time
  RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
) AS total_used
…
WHERE (is_exclusive = true) OR (total_used >= capacity)
```

Con un frame de `UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`, el `ORDER BY` queda inerte y el
frame es la **partición entera**: cada fila del ledger de ese espacio dentro de la ventana
pedida `[_from_ms, _to_ms]`. Así que `total_used` era una sola constante: el total de
persona-slots reservados en todo el rango.

Entonces `total_used >= capacity` no significaba "este slot está lleno", significaba "este
espacio tiene al menos `capacity` unidades de bucket reservadas **en algún punto de la
ventana**" — y cuando era verdad, marcaba **todas** las filas devueltas como no disponibles.

Concretamente, en un espacio de coworking de capacidad 20 consultado por una semana: una persona
reservando 5 horas (20 buckets × `actor_size` 1) hacía que la semana completa se dibujara como
totalmente reservada en `getCalendarDataBySpace` → `WeekCalendar`. Cuanto más usado el espacio,
más de él desaparecía.

La semántica buscada — "qué slots individuales de 15 minutos están llenos" — necesita
`PARTITION BY l.space_id, l.occurrence_start_time`.

Este es el modo de falla inverso a D4: D4 bloquea de menos en el camino de escritura, D5 bloquea
de más en el de lectura. Se venían tapando mutuamente, que es probablemente la razón por la que
ninguno se reportó: el calendario se ve conservadoramente lleno, así que nadie intenta la reserva
que expondría D4.

### D6 — Editar un evento publicado sobre un horario ocupado no se chequeaba _(Crítico)_

Esta es la pregunta 1 del pedido, en su forma más aguda.

`updateEvent` (`src/lib/db/events.ts`) evita deliberadamente borrar-y-recrear para que las
excepciones por ocurrencia sobrevivan. Para un día de la semana que existe antes y después de la
edición hacía:

```ts
await tx.reservation.update({
  where: { id: r.id },
  data: {
    reason: input.name,
    startTime: p.startMs,
    endTime: p.endMs,
    recurrenceEnd: p.recurrenceEndMs,
  },
});
await rebuildLedger(tx, r.id);
```

`rebuild_reservation_ledger_forward()` **no hace ningún chequeo de conflicto** — su propio
comentario en `20260702000000_reschedule_overlap_guard` lo dice, que es justamente por qué
`reservation_window_conflicts()` se agregó como guarda aparte.

Esa guarda se aplicaba en exactamente dos lugares: `assertRescheduleFree` (para reprogramar una
sesión individual) y `createReservationException`. **No** se aplicaba en el camino de edición de
evento.

Mientras tanto el camino de creación _sí_ está protegido: `create_event_reservation()` levanta
`'Space % already booked …'` si hay solape. Así que el invariante se cumplía cuando un evento
nace y cuando se mueve una sola sesión, y se soltaba precisamente cuando se reescribe la agenda
de un evento en vivo.

Reproducción: publicar el evento A los martes de 14:00 a 16:00; publicar el evento B los martes
de 18:00 a 20:00 en el mismo espacio; editar la ventana horaria de B a 14:00–16:00 y guardar.
Los dos quedan APPROVED sobre los mismos buckets, los dos se dibujan en el calendario, los dos
aceptan inscripciones.

La rama de cambio de espacio de la misma función estaba bien: borra y re-inserta vía
`insertEventReservations`, que pasa por la función SQL protegida.

### D7 — El cron nocturno borraba el historial de reservas, y los reportes lo leen _(Alto)_

`maintain_reservations()` terminaba con:

```sql
DELETE FROM reservation_ledger WHERE reservation_id IN (
  SELECT id FROM reservations WHERE is_recurring = false AND end_time < today_start_ms);
DELETE FROM reservations WHERE is_recurring = false AND end_time < today_start_ms;
```

más el par equivalente para las recurrentes sin ocurrencias restantes. Corre todos los días a
las 05:00 UTC (`vercel.json`). Eso es un **borrado duro del registro de dominio**, no una poda
de la tabla derivada.

`src/lib/db/adminReports.ts` arma cada reporte de uso desde exactamente esa tabla:

```ts
prisma.reservation.findMany({
  where: {
    startTime: { gte: startMs, lte: endMs },
    status: { not: "CANCELLED" },
  },
  select: {
    startTime: true,
    endTime: true,
    status: true,
    space: { select: { name: true } },
  },
});
```

Así que cualquier reporte sobre un período pasado devolvía aproximadamente nada — solo
sobrevivían las reservas recurrentes que todavía tuvieran una ocurrencia futura, y esas se
contaban por su fila _plantilla_, no por sus ocurrencias. `/admin/reports` no estaba un poco
mal: era estructuralmente incapaz de reportar historial.

Daño colateral: `check_ins.reservation_id` quedaba en NULL para cada reserva borrada
(`ON DELETE SET NULL`), así que el historial de ingresos perdía su vínculo; y cada entrada de
`audit_logs` con `entityType = 'Reservation'` apuntaba a un id que ya no resolvía.

El propósito declarado del cron — "si no corre, las reservas recurrentes dejan de materializarse
hacia adelante" (CLAUDE.md) — lo cumple enteramente el rebuild del **ledger**. El borrado de las
filas de `reservations` era algo aparte, y nada dependía de él.

### D17 — El ledger no tenía índice en su camino caliente _(Medio)_

`reservation_ledger` tenía exactamente un índice,
`reservation_ledger_reservable_status_idx` sobre `(reservable_id, reservable_type, status)`,
agregado en `20260610000000` para la guarda de solapamiento entre espacios.

Todo lo demás era un scan secuencial:

- cada chequeo de capacidad/exclusividad en `create_reservation`,
  `create_event_reservation`, `approve_reservation` y `reservation_window_conflicts` filtra por
  `(space_id, status, occurrence_start_time)`;
- `get_unavailable_slots` filtra por `(space_id, status)` más un rango;
- `getEventOccurrencesForSpace` filtra por `(reservable_type, status, space_id)` más un rango;
- **`DELETE FROM reservation_ledger WHERE reservation_id = …`** corre al inicio de cada
  `rebuild_reservation_ledger_forward` — y `maintain_reservations` lo llama una vez por reserva
  recurrente, cada noche. Eso es un scan completo de tabla por reserva recurrente por noche.

La tabla crece como (reservas × ocurrencias × duración/15min), así que es por lejos la más
grande del esquema.

### D18 — `actor_size` deriva, y un equipo vacío reserva gratis _(Medio)_

`get_actor_size()` (`20260713000000`) devuelve `COUNT(*)` de miembros para `TEAM` y
`ORGANIZATION`. `COUNT(*)` devuelve `0`, no `NULL`, así que el `COALESCE(size, 1)` del final no
atrapaba el caso vacío: **un equipo sin miembros tenía `actor_size` 0 y no consumía capacidad
alguna**, por más reservas que hiciera.

Aparte, `actor_size` se fotografía en el ledger al momento de escribir. Los cambios de
membresía posteriores no se reflejan para las reservas no recurrentes (nunca se reconstruyen), y
_sí_ se re-establecen en silencio para las recurrentes en la próxima corrida del cron — así que
una reserva recurrente de equipo puede crecer calladamente más allá de la capacidad que se
chequeó cuando se creó.

`EVENT` está bien acá — resuelve a la capacidad del espacio, coincidiendo con lo que escribe
`create_event_reservation` — pero implica que la ocupación de un evento se re-establece a la
capacidad _actual_ del espacio en cada rebuild, lo que interactúa con D11.

### D14 — La validación de la ventana de reserva estaba mal, y su mensaje la contradecía _(Medio)_

`src/app/api/resources/[spaceId]/route.ts`:

```ts
const dayOfWeek = startDateTime.getUTCDay();
const startHour = startDateTime.getUTCHours();
const endHour   = endDateTime.getUTCHours();
…
if (startHour < 12 || endHour > 21 || (endHour === 18 && endDateTime.getMinutes() > 0))
  return apiError("Las reservas deben estar entre las 9:00 AM y las 6:00 PM", 400);
```

Tres problemas separados:

1. **El mensaje estaba mal.** `12 ≤ h ≤ 21` UTC es 09:00–18:00 en UTC−3, así que la _intención_
   coincidía con el mensaje — pero ver (2).
2. **`endHour === 18 && minutes > 0` es lógica muerta de una versión anterior a UTC.** 18:00 UTC
   son las 15:00 locales. Tal como estaba, cualquier reserva que terminara entre 15:01 y 15:59
   locales se rechazaba con un mensaje sobre las 6 de la tarde. Nada más en la app insinúa un
   límite a las 15:00.
3. **El límite superior estaba corrido una hora.** `endHour > 21` permite un fin a las 21:59 UTC
   = 18:59 local, una hora después del cierre declarado.

El chequeo de día de semana tenía el mismo defecto UTC-vs-local (`getUTCDay()`): una reserva del
viernes a las 21:30 local es sábado 00:30 UTC y se habría rechazado como fin de semana. La
ventana 9–18 lo volvía inalcanzable, pero los dos chequeos eran inconsistentes entre sí y con
`ADMIN_TIMEZONE`, que es lo que usa el resto de la app.

Tampoco había duración máxima ni rate limit en este endpoint.

### D15 — La vista previa de aprobación siempre informaba "no se rechaza a nadie" _(Medio)_

`previewConflictingPending()` (`src/lib/db/adminReservations.ts`) era:

```ts
export async function previewConflictingPending(): Promise<string[]> {
  return [];
}
```

`PATCH /api/admin/reservations/[id]` con `preview: true` devolvía
`{ approvedId: null, autoRejectedIds: [] }` sin condiciones. Al admin se le mostraba "esta
aprobación no afecta a nadie", confirmaba, y el `approve_reservation()` real después rechazaba
reservas de otras personas y les mandaba mail. Notar el argumento comentado en el call site
(`previewConflictingPending(/*resolvedParams.id*/)`): es un stub que nunca se completó, no un
no-op deliberado.

### D16 — Los errores de solapamiento entre espacios salían como 500 _(Medio)_

`create_reservation` levanta:

```sql
RAISE EXCEPTION 'Overlap with approved reservation at %', conflict_space_name;
```

`createReservation` intentaba traducirlo con:

```ts
const overlapMatch = error.message?.match(
  /Overlap with approved reservation at (.+?) \(/,
);
```

El patrón exige un ` (` literal después del nombre del espacio. El SQL no emite nada después.
Así que el match nunca tenía éxito, la rama nunca corría, y el error caía a `throw error` →
`apiCatch` → un 500 genérico. Un error de usuario legítimo y esperado ("ya tenés una reserva
aprobada en otro lado en ese horario") se informaba como falla interna, y el mensaje en español
cuidadosamente escrito era código muerto.

---

## Parte 2 — Deriva al editar lo publicado

Esta es la pregunta 1 del pedido. El patrón en los cuatro recursos publicables — Event,
Noticia, plantilla de Form, EventForm — es que la publicación se modela como una columna de
estado, y las ediciones se validan contra la _forma_ de la entrada pero no contra los
**compromisos ya tomados con quienes vieron la versión publicada**.

### D8 — Renombrar el slug de una Noticia publicada rompía todos los links compartidos _(Alto)_

`updateNewsPost` (`src/lib/db/news.ts`):

```ts
const slug =
  input.slug === existing.slug
    ? existing.slug
    : await uniqueSlugFor(input.slug || input.title, id);
```

No había tabla de historial de slugs, ni redirect, ni ninguna guarda que distinguiera un DRAFT
(donde renombrar es gratis) de una nota PUBLISHED (donde la URL vieja ya está circulando).

Los segmentos de **fecha** de `/news/yyyy/mm/dd/slug` sí estaban bien resueltos — la página de
detalle recalcula la ruta canónica y hace 308 si están viejos
(`src/app/(public)/news/[yyyy]/[mm]/[dd]/[slug]/page.tsx`), y `newsDetailPath` documenta que el
slug solo es la clave de búsqueda. Pero **el slug** es esa clave, y cambiarlo dejaba en 404 cada
link existente sin ningún rastro.

Esto contradice directamente la regla que el repo se pone a sí mismo en CLAUDE.md: _"Renombrar
una implica agregar un redirect permanente desde la ruta vieja — los links compartidos viven
para siempre."_ Esa regla se había aplicado a los renombres de rutas (`/noticias` → `/news`) y no
a los slugs de contenido que viven debajo.

### D9 — Despausar una Noticia reescribía su fecha de publicación _(Alto)_

Misma función:

```ts
const becomingPublished = input.status === "PUBLISHED" && existing.status !== "PUBLISHED";
…
publishedAt: becomingPublished ? BigInt(Date.now()) : existing.publishedAt,
```

`NewsPostStatus` incluye `PAUSED`, descrito en `prisma/models/news.prisma` como "estuvo en
línea, se bajó sin borrarla". Una transición `PAUSED → PUBLISHED` satisface
`existing.status !== "PUBLISHED"`, así que **restaurar una nota pausada la sellaba con la fecha
de hoy**.

El comentario del propio modelo declara la semántica buscada: _"Se setea en el momento en que el
estado pasa a PUBLISHED **por primera vez**."_ El código implementaba "cada vez que pasa a
PUBLISHED". Un artículo de dos años atrás, bajado una semana y restaurado, salta al tope de
`/news` (el orden es `publishedAt desc`), cambia el segmento de fecha de su URL canónica, y su
fecha de autoría miente.

`REJECTED → PUBLISHED` es discutiblemente el mismo bug, aunque ahí la nota nunca fue pública, así
que sellarla es defendible. La condición que distingue es `existing.publishedAt == null`, no el
estado.

### D20 — Un Comunicador no podía editar su propia Noticia publicada sin bajarla _(Medio)_

`assertAuthorTransition` (`src/lib/news/transitions.ts`) lanzaba 403 cuando el estado enviado era
`PUBLISHED` o `PAUSED` y el autor no tenía `news:approve`. `PUT /api/admin/news/[id]` limita
correctamente a un Comunicador a sus propias notas, y después pasaba el estado que viniera.

Así que para un Comunicador editando su propio artículo en vivo había exactamente dos
resultados:

- enviar `status: "PUBLISHED"` (el estado actual de la nota) → **403, la edición se rechaza**;
- enviar `DRAFT` / `PENDING_REVIEW` → la edición se guarda y **el artículo en vivo desaparece
  del sitio** hasta que un admin lo vuelva a aprobar.

No había ningún camino de "corregir en el lugar, marcar para re-revisión", ni ningún aviso de que
la segunda opción bajaba la página. Corregir un typo en un artículo publicado costaba su
disponibilidad. Que las correcciones deban volver a revisión es una decisión de producto; el
comportamiento de entonces era, como mínimo, imposible de descubrir.

### D19 — Clonar una plantilla de formulario dejaba afuera los campos agrupados _(Medio)_

`cloneTemplateToInstance` (`src/lib/db/forms.ts`) derivaba las filas planas legacy con:

```ts
const rows = schema.nodes.filter(isInputNode).map(…)
```

— **solo los nodos de primer nivel**. Los otros dos writers, `createFormTemplate` y
`updateFormTemplate`, usan `schemaToRows` → `schemaToPublicFields`, que aplana los hijos de los
grupos en orden de árbol. Así que una instancia clonada de una plantilla con un grupo tenía un
conjunto de `form_fields` incompleto, mientras su `Form.schema` estaba completo.

Inofensivo hoy, porque todos los lectores prefieren el schema: `formSchema()` en
`participants.ts` cae a las filas planas solo cuando `schema` es null, y `getEventFormColumns`
lee el schema directo. Pero ese camino de fallback está documentado como vivo ("un formulario
creado por código viejo durante una ventana de deploy"), y por ahí a un participante se le
mostraría un formulario al que le faltan sus preguntas agrupadas — en silencio, con sus
respuestas podadas para coincidir.

### D21 — Las ediciones del slug del formulario de evento se descartan en silencio _(Medio)_

`syncEventForm` (`src/lib/db/events.ts`), en la rama común donde la plantilla no cambió,
actualiza solo `opensAt`, `closesAt` e `isPublished`. `slug` no está en el objeto `data`.

Ese **comportamiento** es el correcto — la URL pública `/forms/[slug]` tiene que quedar estable
una vez que circula, y `eventFormBindingSchema` genera el slug del lado del cliente para que la
URL se conozca antes del primer guardado. Pero `eventToFormDefaults` devuelve `form.slug` al
formulario de edición, así que si el campo fuera editable el admin podría cambiarlo, guardar con
éxito, y ver volver el valor viejo sin ninguna explicación. El invariante está bien y lo que
falta es la devolución.

---

## Parte 3 — Inscripciones y capacidad de eventos

### D10 — El chequeo de capacidad de inscripciones no tenía guarda de concurrencia _(Alto)_

`submitForm` (`src/lib/db/participants.ts`) corre dentro de `prisma.$transaction`, pero el test
de capacidad es un leer-y-después-escribir:

```ts
const capacity = await resolveCapacity(eventForm.event);
if (capacity > 0 && eventForm.event._count.participants >= capacity)
  return { ok: false, status: "full" };
…
await tx.eventParticipant.create({ … });
```

El conteo viene de un `_count` en el `findUnique` del inicio de la transacción. Con el
`READ COMMITTED` por defecto de PostgreSQL (Prisma no lo eleva acá), dos envíos concurrentes
observan `capacity - 1` y los dos insertan. No había `SELECT … FOR UPDATE`, ni advisory lock
sobre el evento, ni ninguna restricción que pudiera rechazar la segunda escritura —
`@@unique([eventId, email])` evita _personas_ duplicadas, no personas de más.

La exposición es exactamente proporcional a cuán buscado sea el evento: un taller cuyos últimos
lugares se disputan es el caso en el que esto se dispara.

`decideParticipants` tampoco re-chequea capacidad, lo que es seguro **solo** porque PENDING ya
ocupa un lugar (`SPOT_HOLDING_STATUSES`) — aprobar una fila PENDING la mueve entre dos estados
que ambos ocupan lugar. Ese razonamiento es sólido y está documentado; simplemente hereda el
sobrecupo que produjera D10.

### D11 — La capacidad podía bajar por debajo de las inscripciones existentes _(Alto)_

`resolveCapacity` es `event.capacity ?? event.space?.capacity ?? 0`. Dos ediciones a un evento
**publicado** la cambian retroactivamente:

- bajar `Event.capacity` (un campo numérico común del formulario de evento, sin validación
  contra la cantidad actual de inscriptos);
- mover el evento a un **espacio más chico**, lo que cambia el valor por defecto.

Nada detectaba el sobrecupo resultante. `spotsLeft` es `Math.max(0, capacity - taken)`, así que
se clampea a 0 y el formulario cierra como "completo" — que es el comportamiento _público_
correcto — pero los ya inscriptos por encima del nuevo tope nunca se le mostraban al admin,
nunca se les pedía reconfirmar, y en un evento con `requiresApproval` eran indistinguibles de
cualquier otro en la cola de aprobación.

Un superadmin editando la capacidad de un `Space` tiene el mismo efecto sobre cada evento que la
hereda, con menos indicación todavía del alcance — y, vía D18, re-establece en silencio la
ocupación de esos eventos en el ledger en la próxima corrida del cron.

### D12 — Una falla del mail de inscripción informaba que la inscripción falló _(Alto)_

`src/app/api/forms/[slug]/route.ts`:

```ts
// Best-effort confirmation email (don't fail the registration if it bounces).
if (result.token && result.eventName) {
  await sendEventRegistrationEmail(…);
}
```

El comentario declaraba la intención; el código no la implementaba. El `await` estaba dentro del
único `try` externo de la ruta, así que cualquier throw — timeout de SMTP, 4xx del proveedor, DNS
— llegaba a `apiCatch` y devolvía un 500 **después** de haber commiteado la fila del participante
(la transacción de `submitForm` ya había cerrado).

Del lado del participante: "no se pudo completar la inscripción", entonces reintenta, y el
reintento cae en la rama `existing && (PENDING || APPROVED)` → _"Ya estás inscripto con ese
email"_. Dos mensajes contradictorios, y ningún mail de confirmación en ninguno de los dos casos
— el único mensaje que lleva su `editToken`, y por lo tanto su única vía para editar o cancelar.

Vale notar que este es exactamente el modo de falla sobre el que el repo ya razona en otro lado:
las notificaciones de sesiones de evento y de decisiones se recolectan deliberadamente y se
envían **después** de que la transacción commitea, con las fallas sin permiso de hacer rollback
de la escritura. Ese patrón no se había aplicado acá.

### D13 — El rate limiting se podía evadir con un header falsificable _(Medio)_

Cuatro lugares resolvían la IP del cliente, todos con la misma precedencia:

```ts
h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? (solo dev) x-forwarded-for
```

— `src/app/api/forms/[slug]/route.ts`, `src/lib/events/participant-upload.ts`,
`src/app/api/auth/register/route.ts`, `src/app/api/auth/reset/route.ts`.

`cf-connecting-ip` lo pone Cloudflare. El destino de deploy es **Vercel** (`vercel.json`,
CLAUDE.md), que pone `x-real-ip` y `x-forwarded-for` y no filtra los headers de request
desconocidos. Así que `cf-connecting-ip` llegaba enteramente controlado por el cliente y se
confiaba en él **primero**.

Rotándolo por request, todo endpoint con rate limit tenía presupuesto ilimitado: registro, reset
de contraseña, envío del formulario público y subida de archivos de participantes.
`checkRateLimit` indexa por `(key, endpoint)`, así que la evasión además llenaba `rate_limits` —
una fila por valor falsificado — como efecto secundario.

La rama `x-forwarded-for` solo-en-dev muestra que la precedencia de headers se pensó; la
conclusión simplemente no coincide con la plataforma.

Menor, en la misma zona: `participant-upload.ts` devolvía `e.message` tal cual en su respuesta
500, contra la convención de `src/lib/api/response.ts` de que el cliente nunca ve texto de error
interno.

---

## Parte 4 — Hallazgos menores

- **`getCalendarDataBySpace` cortaba las ocurrencias propias del usuario en 100.**
  `getUserNextReservations(userId, undefined, 100, 0)` (`src/lib/db/resourceCalendar.ts`) viene
  ordenado ascendente desde ahora y el resultado se filtra _después_ a la semana visible. Un
  usuario con varias reservas recurrentes agota 100 ocurrencias en unas pocas semanas, y a partir
  de ahí sus propias reservas — y sus bloques de conflicto entre espacios — dejan de dibujarse en
  las semanas siguientes, en silencio.
- **El tope de 365 días de recurrencia truncaba en silencio.** `create_reservation`,
  `create_event_reservation`, `rebuild_reservation_ledger_forward` y
  `recurring_reservation_has_occurrence_after` clampean todos con
  `LEAST(COALESCE(_recurrence_end_ms, start + 365d), start + 365d)`. Un evento definido sobre un
  rango más largo se aceptaba, y simplemente dejaba de existir a mitad de camino, sin aviso al
  crearlo.
- **`/api/admin/checkin/current` seguía usando `isAdminByEmail`.** Su hermano
  `PATCH /api/admin/checkin/[id]` se migró a `requirePermission("checkin:manage")` en el
  milestone 9, con un comentario que explica exactamente por qué ("un Comunicador podría dar de
  baja el ingreso de alguien"). El mismo razonamiento aplica a leer quién está en el edificio; el
  GET no se migró. Enumerar los llamadores del helper encontró **dos más con el mismo defecto**:
  `/api/admin/reports` y `/api/admin/stats`.
- **`news.update` / `news.delete` estaban escritos como literales de string** en
  `src/app/api/admin/news/[id]/route.ts` en lugar de vía `AUDIT_ACTIONS`. Los valores coincidían
  con el registro, así que nada estaba roto y el test pasaba — pero la regla de CLAUDE.md es
  "nunca un string de acción libre", y un renombre de la constante no habría llegado a estos.
  Revisar el resto de `src/app/api/admin/**` encontró **12 más**.
- **`cancelParticipant` aceptaba cualquier estado y cualquier momento.** Movía una inscripción
  `REJECTED` a `CANCELLED`, y aceptaba una baja mucho después de que el evento terminara. Ninguna
  de las dos es dañina; las dos son ruido en la lista de inscriptos.
- **`uniqueSlugFor` tenía un loop sin cota y una carrera.** Una consulta por iteración, y dos
  creaciones concurrentes con el mismo título resuelven el mismo slug libre, así que la segunda
  choca con el `@unique` y sale como 500.
- **`searchPublishedNews` concatenaba sin `COALESCE`.**
  `to_tsvector('spanish', title || ' ' || summary || ' ' || body)` — hoy `summary` y `body` son
  no nulos, así que esto era latente y no vivo, pero un solo null habría sacado la nota de los
  resultados de búsqueda enteramente en lugar de dar error. Tampoco había un índice GIN
  respaldándolo, así que cada búsqueda era un seq scan que recalculaba `to_tsvector` por fila.
- **`reservation_ledger.space_id` era nullable en la base** pero no nullable (`String`) en el
  modelo de Prisma — un resto del cambio de columna de `20260706000000`, que la agregó nullable y
  nunca la ajustó. Inofensivo hoy porque todos los writers la setean, pero es otro lugar donde el
  esquema y la base discrepan.

---

## Parte 5 — Segunda pasada (2026-09-25)

Barrido de las áreas que la primera pasada no había leído: autenticación, autorización, rate
limiting, asignación de roles, verificación de email y el cron de snapshots de reportes.

### D22 — La tabla `report_snapshots` no existía _(Alto)_

`/api/cron/report-snapshot` hace `INSERT INTO report_snapshots (…)` desde SQL crudo. Buscando
`report_snapshots` en todo `prisma/` no aparece **nada**: ninguna migración la crea y ningún
modelo de Prisma la declara. Confirmado contra la base local: `\dt report_snapshots` →
_"Did not find any relation named report_snapshots"_.

Así que el endpoint habría fallado con `relation "report_snapshots" does not exist` en cada
invocación. No se notó porque tampoco estaba agendado en `vercel.json` — el propio
`OPEN_QUESTIONS.md` lo anotaba como "el endpoint existe pero no está en `crons`", sin advertir
que además no tenía tabla. Dos faltantes que se tapaban mutuamente: sin agenda nunca corría, y al
nunca correr nadie descubría que no tenía dónde escribir.

### D23 — `getRegisteredUserByEmailAndPassword` estaba roto, exportado y sin usar _(Medio)_

`src/lib/db/users.ts` tenía:

```ts
const passwordHash = await hashPassword(password);
const user = await prisma.registeredUser.findFirst({
  …
  where: { user: { email, passwordHash } },
});
```

Compara el **hash de bcrypt directamente**. `hashPassword` genera un hash nuevo con salt nuevo en
cada llamada, así que esa consulta **nunca puede coincidir**: la función siempre devuelve null.
Estaba exportada desde el módulo, así que parecía un helper de autenticación usable. Sin
llamadores (el login real usa `getUserByEmailAndPassword`, que sí hace `bcrypt.compare`).

Código muerto y equivocado a la vez: el riesgo no es lo que hace, es que el próximo que busque
"cómo verifico email+password acá" encuentre esta primero.

### D24 — El baneo no se aplicaba en las rutas de API _(Alto)_

`src/middleware.ts` redirige a los usuarios suspendidos a `/banned`:

```ts
if (requiresSession && isBanned) {
  return NextResponse.redirect(new URL("/banned", request.url));
}
```

Pero su matcher es `["/", "/user/:path*", "/admin/:path*", "/auth/:path*"]` — **`/api/**`no está
ahí**. Y ni`requirePermission`ni`requirePagePermission` miraban el baneo: las dos chequeaban
sesión y permiso, nada más. Las rutas de usuario (`/api/resources/[spaceId]`,
`/api/user/profile`) usaban `auth()` directo y tampoco.

Resultado: un usuario suspendido con un JWT vivo podía seguir llamando a la API directamente —
crear reservas, editar su perfil — y un admin suspendido podía seguir haciendo mutaciones de
admin. El baneo existía como redirect de UI, no como regla de autorización.

Es la misma forma que D1/D2/D6: una regla que se aplica en un camino y no en el otro, donde el
camino sin cubrir no tiene nada que avise.

### D25 — `verifyCaptcha` fallaba abierto con la clave de prueba de Turnstile _(Alto)_

`src/lib/auth.ts`:

```ts
secret: process.env.TURNSTILE_SECRET_KEY ?? "1x0000000000000000000000000000000AA",
```

`1x0000000000000000000000000000000AA` es la clave **de prueba** documentada de Turnstile: la que
**siempre responde `success: true`**. Así que si `TURNSTILE_SECRET_KEY` faltaba en producción, el
captcha quedaba desactivado en silencio en los dos endpoints que más lo necesitan — registro y
reset de contraseña — y no había ninguna forma de notarlo desde afuera: el flujo se ve idéntico.

Además `await res.json()` no tenía manejo de error, así que un fallo de red del verificador
propagaba como 500 en lugar de una respuesta controlada.

### D26 — El rate limiter nunca volvía a bloquear después del primer bloqueo _(Medio)_

En `src/lib/ratelimit.ts`, el `ON CONFLICT` resetea `attempts` y `windowStart` al rotar la
ventana, pero el `CASE` de `blockedUntil` era:

```sql
WHEN rate_limits.attempts + 1 > ${maxAttempts} AND rate_limits."blockedUntil" IS NULL
  THEN ${blockUntilMs}
  ELSE rate_limits."blockedUntil"
```

y **nada volvía a poner `blockedUntil` en NULL**. Entonces: la clave se bloquea una vez, el
bloqueo vence, y a partir de ahí `blockedUntil IS NULL` es siempre falso, así que nunca se vuelve
a bloquear. El límite por ventana sigue aplicando (`allowed = attempts <= maxAttempts`), así que
no queda sin protección — pero la penalidad extendida de `blockDurationMs`, que es el mecanismo
para frenar un atacante persistente, servía **una sola vez por clave** en toda la vida de la
fila.

### D27 — Un no-superadmin con `users:roles:manage` podía otorgar superadmin _(Medio, latente)_

`PATCH /api/admin/users/[id]` bloqueaba cambiar **tu propio** rol ("podría dejar afuera al último
superadmin"), pero no que se otorgara un rol con `isSuperadmin`. `updateUserRole` escribe el
`roleId` que reciba, y `/api/admin/roles/assignable` devolvía **todos** los roles, incluidos los
superadmin.

Camino de escalada: alguien con `users:roles:manage` otorga SUPERADMIN a una cuenta títere, entra
como esa cuenta, control total.

**Honestamente: hoy no es explotable.** El rol ADMIN sembrado no tiene `users:roles:manage` (ver
`src/lib/db/roles.seed.test.ts`) — solo lo tiene SUPERADMIN, y un superadmin otorgando superadmin
es legítimo. Pero `users:roles:manage` es un permiso asignable del catálogo, así que un superadmin
podría delegar la asignación de roles a alguien que no lo es, y en ese momento el agujero se abre.
Defensa en profundidad: quien no es superadmin no debería poder crear superadmins, punto.

### D28 — `verification_tokens` y `rate_limits` crecían sin techo _(Medio)_

- `consumeEmailVerificationToken` devuelve null si el token venció, pero **no borra la fila**. Los
  tokens vencidos quedan para siempre (los de reset de contraseña igual).
- `rate_limits` tiene una fila por `(key, endpoint)`, para siempre. Con D13 arreglado ya no crece
  por IP falsificada, pero las reales tampoco se van nunca.

Ninguna de las dos es un dato de negocio: una fila vencida o una ventana de rate limit ya cerrada
no le sirve a nadie.

---

## Lo que ya estaba bien (no "arreglar" esto)

Se deja explícito, porque la mitad del valor de una auditoría es confirmar los invariantes que sí
se cumplen:

- **La guarda de solapamiento entre espacios es correcta y simétrica.** `create_reservation`
  rechaza una reserva que se solape con una reserva aprobada del mismo actor en otro lado, y
  `approve_reservation` auto-rechaza el caso espejo. Las dos comparan rangos, no la igualdad rota
  de D4.
- **La exclusividad se aplica comparando rangos en todos lados** — `create_reservation`,
  `create_event_reservation`, `approve_reservation` y `reservation_window_conflicts` usan todas
  `start < _end AND end > _start`. Los espacios exclusivos no se ven afectados por D4.
- **`effective_occurrence_window` se aplica de forma consistente.** Todos los caminos de
  expansión — creación, rebuild, `recurring_reservation_has_occurrence_after`,
  `get_user_next_reservations` — superponen las excepciones igual, y el desempate
  `ORDER BY re.created_at DESC LIMIT 1` es el mismo en todos.
- **Los cambios de sesión notifican después del commit, no durante.** `updateEvent` recolecta
  `OccurrenceChange[]` dentro de la transacción y recién despacha cuando commitea, así que una
  edición con rollback nunca le manda mail a nadie. `decideParticipants` hace lo mismo. Este es el
  patrón que D12 debería haber seguido.
- **`SPOT_HOLDING_STATUSES` se usa de forma uniforme.** Cada conteo que decide "¿está completo
  este evento?" — `getPublicForm`, `submitForm`, `getEventOccurrencesForSpace`, las tarjetas del
  inicio — pasa por la única constante. No se encontró ningún filtro de estado ad hoc.
- **El clonado plantilla → instancia de formularios es una foto genuina.** Ids de nodo nuevos,
  referencias de ramificación remapeadas, respuestas indexadas por id de campo. Editar o borrar
  una plantilla realmente deja intactos los eventos ya vinculados, como está documentado. (D19 es
  un defecto en las _filas espejo legacy_, no en la foto.)
- **La propiedad de una Noticia se valida del lado del servidor.** `assertOwnedOrPrivileged` se
  aplica igual en GET, PUT y DELETE; un Comunicador no puede llegar a la nota de otro autor por
  id. (D20 es sobre lo que puede hacer con _la propia_.)
- **La superficie pública de formularios valida en el orden correcto.** `getPublicForm` y
  `submitForm` chequean `deletedAt`, `status === PUBLISHED`, la última ocurrencia, y la ventana
  de apertura/cierre, en ese orden, y `EventForm.isPublished` se mantiene como espejo y no como
  segunda fuente de verdad.
- **La autenticación del cron es sólida** — `CRON_SECRET` obligatorio, 503 cuando falta en lugar
  de quedar abierto, bearer comparado completo.
- **Los tokens de verificación están bien manejados en lo esencial** (segunda pasada): se guardan
  hasheados (`hash(token)`), se chequea el vencimiento, y se borran al consumirse, así que son de
  un solo uso. Lo único que falta es limpiar los vencidos (D28).
- **El callback `jwt()` es deliberadamente paranoico y hay que dejarlo así.** Toma solo
  `{ token }` e ignora los argumentos `trigger`/`session` de NextAuth, recalculando
  `signedUp`/`banned`/`role`/`permissions` contra la base en cada llamada. Eso es lo que impide
  que un `useSession().update({...})` del cliente falsifique estado de sesión.
- **El split `users:roles:manage` / `roles:manage` está bien pensado.** Asignar un rol y definir
  qué puede hacer un rol son permisos distintos, y `/api/admin/roles/assignable` ya devolvía solo
  identidad, nunca las listas de permisos. (D27 es sobre qué roles ofrece esa lista.)

---

## Plan de implementación

Ordenado por "detener la corrupción activa" primero, después "recuperar funcionalidad perdida", y
por último endurecimiento. Cada slice es desplegable y verificable de forma independiente.

### Slice A — Integridad del ciclo de vida del ledger (D1, D2, D17) — **HECHA**

Vuelve al ledger estructuralmente incapaz de sobrevivir a su reserva o de discrepar con ella.

Salió como la migración **`20260924100000_ledger_integrity`** más tres cambios de código:

1. **Purgar y reparar, en ese orden.** Se borran las filas huérfanas (`reservation_id` sin fila
   en `reservations`) — son irrecuperables y estaban bloqueando lugares — y después cada fila
   sobreviviente se resincroniza con el estado actual de su reserva, reparando la deriva que
   venía acumulando D1. Las dos cosas tienen que pasar _antes_ de agregar la FK, o el
   `ALTER TABLE` falla contra las huérfanas existentes.
2. **`reservation_ledger_reservation_id_fkey … ON DELETE CASCADE ON UPDATE CASCADE`.**
3. **Tres índices:** `(reservation_id)` para el `DELETE` que abre cada
   `rebuild_reservation_ledger_forward`, `(space_id, status, occurrence_start_time)` para los
   predicados de capacidad/disponibilidad, y `(occurrence_start_time, occurrence_end_time)` para
   las lecturas por rango (`get_unavailable_slots`, `getEventOccurrencesForSpace`, la poda del
   cron).
4. **Trigger `sync_reservation_ledger_status`** — `AFTER UPDATE OF status ON reservations`,
   protegido por `IS DISTINCT FROM` para que sea no-op cuando el estado no cambió, y por
   `AND status <> NEW.status` en el `UPDATE` interno para no tocar filas al azar. Un trigger y no
   un arreglo en `setReservationStatus` + `updateReservation`, porque la propiedad que se quiere
   es "el ledger siempre coincide con su reserva" y hoy hay tres writers. Es idempotente respecto
   de las funciones SQL que ya actualizan ambos (`approve_reservation`).
5. **`DELETE /api/resources/[spaceId]` ahora llama a `deleteReservation()`** en lugar de
   `prisma.reservation.delete` directo, así aplica la guarda de "ya empezó". Los dos
   `throw new Error` de esa guarda pasaron a `DomainError` (404 / 409) para que el usuario lea el
   motivo en lugar de un 500 genérico.
6. **`prisma/models/reservations.prisma` refleja la FK y los índices**, con un comentario en
   `ReservationLedger` que explica por qué existen las dos garantías — el esquema venía
   describiendo una relación que la base no tenía.

**Verificado** contra el PostgreSQL local de Docker (`npx prisma migrate deploy` aplicó limpio
sobre una base que ya tenía las 34 migraciones previas; `\d reservation_ledger` confirma la FK y
los cuatro índices; `pg_trigger` confirma el trigger). Después funcionalmente, en una transacción
con rollback: `create_reservation` → 4 buckets PENDING → `UPDATE … SET status='APPROVED'` → todos
los buckets APPROVED → `'CANCELLED'` → todos CANCELLED → `DELETE FROM reservations` → 0 buckets.
D1 y D2 se reproducen como corregidos.

**Notado al verificar, no corregido acá:** `reservation_ledger.space_id` es nullable en la base
pero no nullable (`String`) en el modelo de Prisma. Se resolvió en la slice G.

### Slice B — Corrección de los predicados de capacidad (D3, D4, D5, D16) — **HECHA**

Salió como la migración **`20260924110000_capacity_predicates`** más la capa de TypeScript que
tiene que mostrar lo que los predicados nuevos rechazan.

**Dos helpers SQL nuevos**, porque las mismas dos preguntas se re-formulaban a mano en cinco
lugares con tres redacciones distintas:

- `peak_space_usage(space, win_s, win_e, exclude_reservation)` — recorre la ventana en buckets de
  15 minutos y devuelve la ocupación APPROVED más alta que se solapa con algún bucket.
- `space_window_is_taken(space, win_s, win_e, exclude_reservation)` — la contraparte para
  espacios exclusivos.

Las dos comparan **rangos**, que es la corrección real de D4: una fila del ledger cuenta contra un
bucket cuando se solapa con él, así que la respuesta ya no depende de que las dos reservas
compartan grilla. `create_reservation` (los caminos único y recurrente),
`reservation_window_conflicts` y la cascada de `approve_reservation` ahora las llaman.

> **Un bug que encontró la verificación, no la lectura.** La primera versión de
> `peak_space_usage` sumaba _filas_ del ledger que coincidían. Sondear con una ventana
> desalineada se solapa con **dos** buckets contiguos de la misma reserva, así que cada reserva se
> contaba dos veces — el test que debía imprimir un pico de 2 imprimió 4. Eso bloquea de más en
> lugar de sobrevender, así que habría salido como "nomás conservador" y habría sido muy difícil
> de rastrear después. El helper ahora agrupa por `reservation_id` primero (`MAX(actor_size)` por
> reserva, después `SUM`), que es lo que significa "cuántos actores hay en la sala durante este
> bucket". Re-probado: 2.

**`get_unavailable_slots`** ahora particiona por `(space_id, occurrence_start_time)` en lugar de
solo `space_id`, así que `total_used` es por slot y no un total de la ventana entera (D5).

**`approve_reservation`** ganó un loop de precondición (D3): antes de promover nada, vuelve a
chequear cada ocurrencia propia de la reserva contra el espacio tal como está ahora — capacidad o
exclusividad, más el chequeo entre espacios para que el mismo actor no termine aprobado en dos
lugares. Levantar excepción aborta la sentencia, así que una aprobación rechazada no deja estado
parcial. La cascada posterior no cambia, salvo que su test de capacidad también pasó a
`peak_space_usage`.

**TypeScript:**

- `translateApprovalError` en `adminReservations.ts` mapea las tres excepciones nuevas
  `Approval conflict: …` a `DomainError` en español (409).
- `PATCH /api/admin/reservations/[id]` pasó de `apiServerError` a `apiCatch` — si no, el rechazo
  nuevo, que es deliberadamente de cara al usuario, se habría aplanado a "Error interno del
  servidor".
- **D16 se incluyó acá** en lugar de dejarlo para la slice G, porque es el mismo patrón de
  traducción dos funciones más arriba. El regex exigía un `" ("` final que el SQL nunca emite;
  ahora ancla en fin de línea y opcionalmente consume el sufijo `" on occurrence <ms>"` de la
  variante recurrente. Chequeado contra las tres formas reales del mensaje, incluida la
  multilínea que envuelve Prisma.
- Nuevo `src/lib/constants/reservations.ts` (`LEDGER_SLOT_MS`, `isOnLedgerGrid`) con tests
  unitarios, aplicado en `POST /api/resources/[spaceId]` y vía un `timeOfDaySchema` más estricto
  (`:00|:15|:30|:45`). Notar que esto ahora es **defensa en profundidad, no la corrección**: los
  predicados por rango volvieron seguros los datos desalineados; la grilla se exige porque
  mantiene los buckets fusionables y los índices nuevos selectivos.

**Verificado** contra el PostgreSQL local, reproduciendo cada hallazgo como falla y volviéndolo a
probar (todo dentro de transacciones con rollback, sobre espacios creados para el test para que el
resultado no dependa de los datos sembrados):

| Chequeo                                                                  | Resultado                                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| D4 — espacio de capacidad 2 lleno, tercera reserva **alineada**          | rechazada (como antes)                                                    |
| D4 — igual, tercera reserva **desplazada 1 ms**                          | **rechazada** (antes se aceptaba en silencio)                             |
| D4 — `peak_space_usage` sondeado con ventana desalineada                 | `2` (correcto; `0` antes del arreglo, `4` antes del arreglo del GROUP BY) |
| D5 — espacio de capacidad 4, un usuario reservando 4 h                   | **0** slots no disponibles (antes se bloqueaba el rango entero)           |
| D5 — mismo espacio con una hora genuinamente llena a 4                   | exactamente **4** slots no disponibles                                    |
| D3 — aprobar una pendiente después de que el espacio se llenó por detrás | **levanta** `Approval conflict: capacity exceeded`                        |

Más `npx tsc --noEmit`, `eslint`, `prettier` y 236 tests pasando (4 nuevos).

**Cambio de comportamiento a tener en cuenta:** `TimeSelect` conserva deliberadamente un valor
fuera de grilla al editar ("así el modo edición nunca pierde el horario"). Con el schema más
estricto, un evento guardado antes con un horario fuera de grilla ya no se puede guardar sin
cambios — el admin tiene que elegir un cuarto de hora válido. Es el resultado buscado, pero es un
cambio visible para cualquier evento así que ya exista.

### Slice C — Guarda de conflicto al editar un evento (D6) — **HECHA**

`assertEventOccurrencesFree(tx, eventId)` en `src/lib/db/events.ts`, llamada al final de la rama
**en el lugar** de `updateEvent` — después de actualizar y reconstruir todos los días de la
semana. Es una sola consulta: unir las filas del ledger del evento con
`reservation_window_conflicts`, ordenar por ocurrencia, tomar el primer golpe, y levantar un
`DomainError` nombrando la fecha.

Tres razones por las que tiene esa forma y no un chequeo por día dentro del loop:

- `reservation_window_conflicts` ya excluye la reserva sobre la que se le pregunta, así que una
  ocurrencia nunca choca consigo misma;
- dos días distintos del mismo evento no pueden solaparse, así que el evento nunca es su propio
  conflicto — pero chequear a mitad del loop compararía un día ya reconstruido contra un hermano
  _viejo_, que es un falso positivo esperando a pasar;
- correr una vez sobre el estado final es también lo que necesitaría la rama de cambio de espacio
  si alguna vez dejara de pasar por `create_event_reservation`.

Solo se protege la rama en el lugar, deliberadamente: el camino de inserción (día nuevo, o cambio
de espacio) pasa por `create_event_reservation`, que ya levanta `'Space % already booked …'`, y
duplicar la guarda produciría dos mensajes distintos para la misma condición. El `DomainError`
atraviesa limpio el catch `translateSqlError` existente de `updateEvent`, que solo reescribe
mensajes que contienen `"already booked"` o `"not found"`.

**Verificado** contra la base local replicando exactamente lo que hace `updateEvent`. Dos eventos
publicados en un espacio exclusivo, martes 14:00–16:00 y 18:00–20:00 — la consulta de la guarda
devuelve **0 conflictos**. Después `UPDATE reservations SET start_time/end_time …` +
`rebuild_reservation_ledger_forward` para mover el segundo al horario del primero, que es la
edición que antes tenía éxito en silencio — la guarda ahora devuelve una ocurrencia en conflicto.
(Informa la primera ocurrencia _futura_ y no la primera nominal, porque
`rebuild_reservation_ledger_forward` solo materializa `win_e > now_ms`. Eso es correcto: una
ocurrencia pasada ya no se puede doble-reservar.)

### Slice D — Dejar de destruir el historial (D7) — **HECHA**

La migración **`20260924120000_retain_reservation_history`** reescribe `maintain_reservations()`.
Las dos sentencias `DELETE FROM reservations` desaparecieron; todas las operaciones sobre el
ledger se conservan.

La función ahora hace tres cosas, en orden: poda los buckets del ledger enteramente en el pasado;
rematerializa hacia adelante cada reserva recurrente viva (la mitad crítica — si no corre, la
recurrencia deja de expandirse y los chequeos de conflicto empiezan a pasar en silencio); y poda
las filas de ledger que quedaron de reservas que ya no pueden ocurrir, **conservando las reservas
mismas**.

La firma de retorno cambió, así que hubo que dropear y recrear en lugar de reemplazar: la tercera
columna ahora es `pruned_expired_ledger`, no `deleted_reservations`.
`/api/cron/maintain-reservations` se actualizó para coincidir (su tipo `MaintainRow`, la clave de
la respuesta y el comentario) — es el único consumidor.

**Verificado** contra la base local: una reserva que terminó en el pasado, con cuatro filas de
ledger, sobrevive a una llamada a `maintain_reservations()` con sus filas podadas —
`reservations_after = 1`, `ledger_after = 0`. La corrida también informó
`deleted_past_ledger = 432, rebuilt_recurring = 10` contra los datos sembrados, confirmando que la
mitad conservada sigue haciendo su trabajo.

`/admin/reports` no necesitó cambios: `fetchRangeData` lee `prisma.reservation` directo, así que
empieza a ver historial real en cuanto el historial deja de borrarse.

### Slice E — Contratos al editar lo publicado (D8, D9, D20) — **HECHA**

**D8 — historial de slugs.** Tabla nueva `news_post_slugs` (migración
`20260924130000_news_slug_history`): `slug` como primary key, FK a la nota con
`ON DELETE CASCADE`.

La primary key es sobre **todas** las notas a propósito, y es la parte que vale defender: un slug
retirado tiene que quedar _inreclamable_, o una nota posterior podría tomarlo y secuestrar en
silencio los links entrantes del artículo viejo. Por eso `uniqueSlugFor()` chequea las dos tablas,
y trata como libre un slug retirado por _esta_ misma nota (volver a un título anterior es normal).
`updateNewsPost` retira el slug viejo al renombrar — pero solo en una nota que realmente estuvo
pública, porque el slug de un borrador nunca circuló — y borra la reserva del slug que está
tomando ahora, así que un slug canónico nunca puede redirigir a sí mismo. La página de detalle y
`generateMetadata` caen en `getPublishedNewsByRetiredSlug` y dejan que el `redirect()` canónico
existente haga el resto, así que la URL vieja hace 308 a la nueva.

De paso, el loop sin cota `for (let i = 2; ; i++)` de `uniqueSlugFor` ganó una cota
(`MAX_SLUG_ATTEMPTS`, después un sufijo con timestamp) — era uno de los ítems de la Parte 4.

**D9 — `publishedAt`.** Ahora depende de `existing.publishedAt == null` en lugar de la transición
de estado, así que `PAUSED → PUBLISHED` ya no lo vuelve a sellar. Extraído como predicado puro,
`shouldStampPublishedAt`, en un `src/lib/news/publishing.ts` nuevo — la misma forma que el
`news/transitions.ts` existente, que es lo que lo hace testeable en el setup de Vitest en entorno
node de este repo. `shouldRetireSlug` vive al lado.

**D20 — corregir en el lugar.** Resuelto por el usuario (2026-09-24) como \*\*"corregir en el lugar

- marcar para re-revisión"\*\*: la nota sigue PUBLISHED y en línea mientras su autor la edita, y
  queda en cola para una revisión posterior.

Este necesitó cuatro capas para funcionar de punta a punta, y la primera pasada solo hizo dos:

1. `NewsPost.needsReview` (migración `20260924140000_news_needs_review`).
2. `isAmendInPlace` + un tercer argumento `existingStatus` en `assertAuthorTransition`, para que
   PUBLISHED → PUBLISHED por el dueño esté permitido; `shouldFlagForReview` decide la marca. Los
   dos son predicados deliberadamente separados — uno responde "¿está permitido?", el otro
   "¿necesita seguimiento?" — para que ampliar uno nunca amplíe el otro en silencio.
3. **`newsPostAmendInputSchema`.** Encontrado al volver a leer la ruta después de cablear 1–2:
   `newsPostInputSchema.status` es `z.enum(["DRAFT","PENDING_REVIEW"])`, así que el `PUBLISHED` de
   un autor común lo rechazaba Zod _antes_ de que `assertAuthorTransition` llegara a correr. La
   corrección era código muerto hasta que la ruta aprendió a elegir un tercer schema según el
   estado guardado de la nota. `PAUSED` sigue ausente: bajar una nota en línea es de nivel
   aprobación, no una edición.
4. La UI: `news-form.tsx` ofrece "Publicada" primero al corregir, con una descripción que explica
   las dos ramas ("los cambios se ven en el sitio al instante y un administrador los revisa
   después" vs. "la nota sale del sitio hasta que la aprueben"). La lista de admin muestra una
   insignia "Editada — revisar" al lado del estado y gana un chip de filtro, y `decideNewsPost` o
   cualquier guardado de admin baja la marca.

**Verificado.** El historial de slugs contra la base local: después de un renombre, el slug viejo
resuelve a la nota con su slug nuevo y `status = PUBLISHED`; una segunda nota insertando el slug
retirado la rechaza la primary key; borrar la nota cascadea sus slugs retirados a cero. Más 20
tests unitarios nuevos entre `publishing.test.ts` y `transitions.test.ts` cubriendo cada par de
estados para los tres predicados — incluidos los casos que deben _seguir_ rechazados (un autor
común publicando un borrador, o pausando una nota en línea).

**También incluido:** `news.ts` ahora usa `nowMs()` de `@/lib/clock` en lugar de `Date.now()`,
siguiendo la convención del resto del código para el tiempo simulado.

**Follow-up (2026-09-25) — "corregir en el lugar" reemplazado por pedido/decisión.** El
mecanismo de arriba (`needsReview` + `isAmendInPlace`) dejaba la corrección en línea de
inmediato y la marca era la única señal de que había pasado — sin que un admin pudiera negarla
antes de que el público la viera. Se reemplazó (migración `20260925120000_news_pending_actions`)
por un ciclo de pedido/decisión igual al de `PENDING_REVIEW`, pero contra una nota ya
`PUBLISHED`:

- Un autor sin `news:approve` ya no puede escribir sobre su propia nota publicada en absoluto —
  `newsPostInputSchema` volvió a ser la única entrada de un `PUT` de autor (se borró
  `newsPostAmendInputSchema`) — sino que propone una acción vía `POST
/api/admin/news/[id]/request`: `EDIT` (contenido propuesto guardado en columnas
  `pending_*`, la nota en vivo sin tocar), `PAUSE` o `DELETE`. `assertCanRequestPendingAction`
  (`src/lib/news/transitions.ts`) exige que la nota esté `PUBLISHED` y que no haya ya un pedido
  pendiente _distinto_; volver a pedir la misma acción está permitido y pisa el pedido anterior
  (corregir un typo en un pedido no decidido no necesita empezar de nuevo).
- `POST /api/admin/news/[id]/decision` (ya existente para `PENDING_REVIEW`) ahora también
  resuelve el pedido pendiente de una nota `PUBLISHED`: aprobar un `EDIT` aplica el snapshot
  `pending_*` a los campos en vivo, aprobar un `PAUSE`/`DELETE` ejecuta esa transición
  (`DELETE` es soft — ver `shouldSoftDelete`, mismo criterio que `shouldRetireSlug`: si
  `publishedAt` no es null hay slug/historia que conservar, así que es `deletedAt`, no un
  `DELETE` de fila), y rechazar en cualquiera de los dos casos limpia `pending_*` sin tocar la
  nota. `decideNewsPost` elige entre "hay una revisión pendiente" y "hay un pedido pendiente"
  mirando `status`/`pendingAction`, así que la ruta de decisión no cambió de forma.
- `POST /api/admin/news/[id]/restore` (nuevo, `news:approve`) limpia un `deletedAt`.
- `needsReview`, `isAmendInPlace`, `shouldFlagForReview` y `newsPostAmendInputSchema` se
  eliminaron enteros — ya no hay una tercera rama de la compuerta de aprobación, solo "propuesta
  pendiente sí/no".
- La UI: la lista de admin cambia la insignia "Editada — revisar" por el pedido pendiente
  (`EDIT`/`PAUSE`/`DELETE`) con las mismas acciones de aprobar/rechazar que ya tenía
  `PENDING_REVIEW`; `news-form.tsx` deja de ofrecer "Publicada" como destino de guardado para un
  autor común y en su lugar arma el pedido.
- ⚠️ **`src/lib/email/news-decision.ts` se borró sin reemplazo**, y con él el aviso por mail al
  autor de _cualquier_ decisión — la de una revisión `PENDING_REVIEW` incluida, no solo la de un
  pedido nuevo sobre una nota `PUBLISHED`. `decision/route.ts` ya no llama a nada de correo. Esto
  no está en el enunciado del follow-up (que es sobre el mecanismo de pedido, no sobre avisos);
  si la pérdida del mail de decisión no fue intencional, restaurarlo es cablear el envío de
  vuelta en esa ruta contra el `NewsPost` que ya devuelve `decideNewsPost`.

### Slice F — Integridad de las inscripciones (D10, D11, D12) — **HECHA**

**D10 — la carrera de sobreventa.** `submitForm` ahora toma un advisory lock con alcance de
transacción como primera sentencia:

```sql
SELECT pg_advisory_xact_lock(hashtextextended('event-form:' || <slug>, 0))
```

Elegido sobre las alternativas porque no necesita columna extra, se libera al commitear _o_ al
hacer rollback, y se compone con la transacción que ya envuelve todo el submit. Va indexado por el
**slug** y no por el id del evento porque el slug es lo que identifica al formulario antes de leer
la fila del evento — lockear después de esa lectura dejaría la lectura misma sin serializar.

Vale repetir por qué la restricción existente no cubre esto: `@@unique([eventId, email])` evita
_personas_ duplicadas, no personas de más.

**Verificado** con dos sesiones concurrentes de psql contra la base local: A tomó el lock y durmió
3 s; B, arrancando 1 s después, lo adquirió a las `15:09:09.909` — 1 ms después de que A commiteó
a las `15:09:09.908`. Esperó todo el tiempo restante en lugar de seguir, que es el comportamiento
del que depende la corrección.

**D11 — capacidad que se achica.** Resuelto por el usuario (2026-09-24) como
**avisar-y-confirmar**, no bloquear: una sala realmente puede achicarse, y negar el guardado
obligaría al admin a rechazar gente antes de poder registrar la realidad.

- `EventCapacityWarning` nuevo (inscriptos + capacidad), lanzado por `updateEvent` cuando el cupo
  efectivo — `input.capacity ?? space.capacity`, así que mover a un espacio más chico también
  cuenta — quedaría por debajo del conteo de `SPOT_HOLDING_STATUSES`.
- `PUT /api/admin/events/[id]` lo devuelve como **409** con un body `capacityWarning`, y acepta
  `forceCapacity: true` para seguir. Deliberadamente un **flag separado de `force`**: confirman
  cosas distintas, y confirmar sesiones perdidas no debe confirmar un sobrecupo en silencio.
- El formulario de evento ganó un segundo diálogo de confirmación que nombra el excedente y dice
  explícitamente que **a nadie se lo da de baja automáticamente** — decidir quién pierde el lugar
  sigue siendo una decisión humana.
- La vista de inscriptos ahora dice `26 / 20 inscriptos` y, cuando está por encima, muestra una
  nota destacada con el excedente. `getEvent` selecciona `space.capacity` para hacerlo posible.

> **Un bug que esto introdujo y que el refactor atrapó.** El `catch` del formulario de evento
> trataba **cualquier** 409 como el aviso de sesiones
> (`setDropWarning({ dropped: body?.dropped ?? [] })`). Con un segundo 409 confirmable en la misma
> ruta, un sobrecupo habría abierto el diálogo "se perderán cambios de sesiones" con una lista
> vacía. Ahora el handler discrimina por el body (`capacityWarning` vs. `dropped`) y cae al toast
> si no es ninguno, y `save()` toma `{ force, forceCapacity }` en lugar de un booleano posicional.

**D12 — el mail que hacía fallar la inscripción.** El `await` sobre
`sendEventRegistrationEmail` estaba pelado dentro del `try` externo de la ruta, así que una falla
de SMTP devolvía un 500 _después_ de haber commiteado la fila del participante. Ahora está
envuelto en su propio `try`/`catch` que loguea vía `logger.error` (el mail lleva su único
`editToken`, así que una falla importa) sin hacer fallar una inscripción que ya salió bien. Es el
patrón que ya usaban las notificaciones de sesiones y decisiones; simplemente no se había
aplicado acá.

Verificado con `npx tsc --noEmit`, `eslint`, 256 tests, y un `npm run build:next` completo.

### Slice G — Endurecimiento (D13–D15, D18, D19, Parte 4) — **HECHA**

Agrupada porque cada ítem es chico y local. Tres migraciones
(`20260924150000_actor_size_and_approval_preview`, `20260924160000_news_search_index`,
`20260924170000_ledger_space_id_not_null`) más cambios de código.

**D13 — clave de rate limit falsificable.** Nuevo `src/lib/request-ip.ts` (`getClientIp`), que
reemplaza cuatro resolvedores inline idénticos en `forms/[slug]`, `participant-upload`,
`auth/register` y `auth/reset`. Confía solo en headers que pone la _plataforma_ — `x-real-ip`,
después el `x-forwarded-for` de más a la izquierda — y lee `cf-connecting-ip` **solo** cuando
`TRUST_CF_CONNECTING_IP=true` declara que el deploy realmente está detrás de Cloudflare.
Documentado en `env.example` con el motivo, porque el modo de falla es silencioso.

**D14 — validación de la ventana de reserva.** Extraída a
`src/lib/reservations/booking-window.ts` y comparada en `ADMIN_TIMEZONE` en lugar de UTC. Las
reglas no cambian de intención (días de semana, 09:00–18:00 local); lo que cambió es que ahora se
aplican de verdad. 7 tests unitarios, uno por defecto que tenía el código viejo: un fin a las
18:59 local pasaba, un fin entre 15:01 y 15:59 local se rechazaba _con un mensaje sobre las 6 de
la tarde_, y una reserva del viernes a la noche era sábado según `getUTCDay()`. También se agregó
un rechazo explícito `overnight` — el chequeo de horario es por día, así que una ventana que cruza
la medianoche local no tenía respuesta bien definida.

**D15 — la vista previa de aprobación.** `preview_approval_conflicts()` replica en solo lectura
los dos loops de cascada de `approve_reservation()`, usando el mismo test `peak_space_usage` que
el camino de escritura, y `previewConflictingPending(id)` la llama (era `return []`, con el id
comentado en su único call site). **Verificado que la vista previa y la acción coinciden**, que es
la propiedad que importa: en un espacio de capacidad 2 con tres pendientes solapadas las dos
informan que **no se rechaza nada** (correcto — aprobar una todavía deja lugar); en un espacio
exclusivo las dos informan **`t_x2, t_x3`**, idénticamente. Las dos funciones quedaron en la misma
migración, contiguas, porque la falla que hay que evitar es que se separen.

> **Seguimiento (2026-10-03).** La vista previa devolvía solo los ids (cuid2) y el diálogo de
> confirmación los listaba tal cual, así que el admin seguía aprobando a ciegas. Ahora la ruta
> responde con `getApprovalPreview(id)` (`src/lib/db/adminReservations.ts`): mismos
> `autoRejectedIds` (de `previewConflictingPending`, sin cambiar la lógica) más, por cada reserva
> afectada, quién la pidió (nombre, correo, institución), su motivo, cuándo la pidió, personas,
> si es recurrente, **todas las franjas en que choca** (buckets del ledger unidos con
> `mergeWindows`) y **por qué se rechazaría** (`EXCLUSIVE` / `CAPACITY` / `SAME_PERSON`, con
> `classifyConflict`); tipos y helpers puros en `src/lib/reservations/approval-conflicts.ts`
> (testeados). El diálogo es `organisms/admin/approval-conflicts-dialog.tsx`, compartido por el
> dashboard y `/admin/reservations`. Además: **sin conflictos ya no se pide confirmación** (se
> aprueba directo) y el diálogo usa `aboveSheet`, porque en el teléfono quedaba detrás del
> detalle de la reserva (un `Sheet` en `z-[120]`) y no se podía confirmar. Verificado contra la
> base local con tres reservas sembradas (una de cada motivo, una recurrente con 4 fechas
> superpuestas) y capturas a 390 px y 1440 px.

**D18 — `actor_size`.** `GREATEST(COALESCE(size, 1), 1)` en `get_actor_size`, así que un equipo
vacío ocupa un lugar en lugar de cero. Verificado: `get_actor_size('TEAM', <equipo vacío>)` ahora
devuelve `1`. Si un equipo vacío debería poder reservar es una pregunta de producto y se dejó
como estaba.

**D19 — campos agrupados perdidos al clonar.** `cloneTemplateToInstance` ahora usa el mismo helper
`schemaToRows` que los dos writers de plantillas, en lugar de
`schema.nodes.filter(isInputNode)` (solo primer nivel). Tres writers, una regla de aplanado.

**Ítems de la Parte 4, todos hechos:**

- `/api/admin/checkin/current`, `/api/admin/reports` y `/api/admin/stats` pasaron de
  `isAdminByEmail` a `requirePermission("checkin:manage")` / `("reports:view")`. La auditoría solo
  había visto el de check-in; enumerar los llamadores del helper encontró los otros dos, con el
  mismo defecto — `isAdminByEmail` responde `admin:access`, que tienen todos los roles del panel,
  así que un Comunicador podía leer reportes de uso y agregados del panel.
- **Los 14 strings de acción de auditoría libres** pasaron a `AUDIT_ACTIONS` (la auditoría había
  encontrado 2; revisar `src/app/api/admin/**` encontró 12 más, en spaces, resources,
  reservation-types, roles, news/decision y users).
- `participant-upload.ts` deja de devolver `e.message` a un llamador sin autenticar; loguea y
  devuelve un mensaje controlado.
- `cancelParticipant` solo actúa sobre una inscripción que ocupa lugar.
- El loop sin cota de `uniqueSlugFor` acotado (hecho en la slice E).
- `searchPublishedNews` pasa por un helper IMMUTABLE `news_search_text()` — null-safe e
  **indexable**. Se agregó el índice GIN que faltaba. Verificado con `EXPLAIN`: el planner prefiere
  un seq scan en la tabla chica actual, y con `enable_seqscan=off` usa `news_posts_search_idx`,
  confirmando que la expresión del índice coincide con la de la consulta.
- El límite de ocurrencias de `getCalendarDataBySpace` subió de 100 a 500 con un warning de
  desarrollo cuando se alcanza. Deliberadamente **no** es la corrección real: el límite se consume
  con todo lo que hay entre hoy y la semana visible, así que la respuesta correcta es meter la
  ventana dentro de `get_user_next_reservations`. Eso cambia su firma y tiene otros callers, así
  que se deja anotado en lugar de colarlo.
- El tope de 365 días de recurrencia ahora **falla la validación** en lugar de truncar en
  silencio.
- `reservation_ledger.space_id` puesto en `NOT NULL`, cerrando la discrepancia esquema/base
  notada al verificar la slice A.

**D21 — no se reprodujo.** La auditoría anotó que `syncEventForm` descarta en silencio las
ediciones del slug. El comportamiento es real, pero **el formulario de evento no tiene ningún
input de slug** — se genera del lado del cliente (`createId()` en `onSelectTemplate`) y solo se
muestra vía `CopyFormUrl`. No hay forma de que un admin escriba un slug y se lo ignore, así que no
hay nada que corregir. Se registra en lugar de borrarse, porque el _invariante_ (una URL pública
de formulario tiene que quedar estable una vez que circula) vale conocerlo antes de que alguien
agregue ese input.

Verificado con `npx tsc --noEmit`, `eslint`, **263 tests** (7 nuevos), un `npm run build:next`
completo, y `prisma migrate status` informando las 42 migraciones aplicadas sin deriva.

**Encontrado pero fuera de alcance, no corregido:** `src/assets/policies/privacy.mdx:1` importa
`{ email }` de `@/lib/constants/contact`, que ya no lo exporta — el valor se movió dentro de
`DEFAULT_SITE_CONFIG` cuando la configuración del sitio pasó a ser editable por superadmin
(`20260901000000`). El build lo informa como warning (`Attempted import error`) y tiene éxito, así
que la página de privacidad se renderiza con un email undefined. Es anterior a este milestone
(commit `bd295bb`) y es contenido de políticas, no lógica de dominio, así que queda señalado y no
cambiado.

### Slice H — Retención y segunda pasada (D7 retención, D22–D28) — **HECHA**

**Política de retención (cierra D7).** Definida por el usuario (2026-09-25): 3 años de historial
de reportes, compactado, con un plazo más corto para el detalle crudo. Implementada en dos
niveles, en `src/lib/constants/retention.ts`:

- **Detalle crudo** (`reservations`): `RAW_RETENTION_MONTHS = 12`.
- **Agregados** (`report_snapshots`): `SNAPSHOT_RETENTION_YEARS = 3`.

La garantía que hace que esto sea seguro está en `prune_reservation_history()`: **una fila cruda
solo se borra si ya existe el snapshot mensual que la cubre**. Si el cron de snapshots falla, la
limpieza se posterga; nunca se pierde información. La función además devuelve
`skipped_unsnapshotted`, que es la señal de monitoreo: si ese número crece mes a mes, el snapshot
está fallando.

`/api/cron/report-snapshot` ahora hace snapshot → poda de crudo → poda de snapshots, en ese orden,
y **quedó agendado en `vercel.json`** (día 1 de cada mes, 06:00 UTC) — antes no estaba, que es
parte de por qué D22 nunca se notó.

Del lado de la lectura, `ReportData` gana `coverage` (`rawFromMs`, `hasPrunedPortion`,
`snapshots`) y `/admin/reports` muestra un aviso cuando parte del rango pedido ya pasó la
retención. Sin eso el reporte mentiría por omisión: pasada la retención, un rango viejo devuelve
cero reservas, que se ve exactamente igual que un período sin actividad.

**Verificado** contra la base local, incluida la garantía completa: con tres reservas viejas y
ningún snapshot, `prune_reservation_history` informa `0 borradas / 3 salteadas` y las tres
sobreviven. Después de compactar **solo** enero 2024, la misma llamada informa `2 borradas / 1
salteada` y la de febrero — sin snapshot — sigue viva. `prune_report_snapshots` con corte 2027
borra el snapshot de 2024.

> **Un bug que atrapó el test, no la lectura.** La primera versión de
> `prune_reservation_history` usaba tablas temporales `ON COMMIT DROP`. Esas sobreviven hasta el
> commit, así que **una segunda llamada dentro de la misma transacción fallaba** con
> `relation "_prune_candidates" already exists`. El cron llama una sola vez por request, así que
> nunca se habría visto en producción — pero rompió su propio test, y una función que no se puede
> llamar dos veces es una trampa para el que venga. Reescrita con CTEs.

**D22 — `report_snapshots` no existía.** Creada de verdad por
`20260925000000_report_snapshots_and_retention`, más el modelo Prisma `ReportSnapshot` en
`prisma/models/reports.prisma` (que tampoco existía).

**D23 — función de password rota.** `getRegisteredUserByEmailAndPassword` eliminada. Comparaba
hashes de bcrypt (`where: { user: { email, passwordHash } }`) con un hash recién generado, así que
nunca podía coincidir; estaba exportada y sin usar.

**D24 — el baneo no se aplicaba en la API.** Nuevo `requireActiveSession()` en
`src/lib/api-auth.ts`, que exige sesión y **que el usuario no esté suspendido**, y del que ahora
depende `requirePermission()`. Aplicado también en `POST`/`DELETE /api/resources/[spaceId]` y en el
`PUT` de `/api/user/profile`. Los GET de lectura propia (`/api/user/profile`, `/api/session`) se
dejaron accesibles a propósito: son datos propios que la página `/banned` puede necesitar.

**D25 — captcha fallando abierto.** `verifyCaptcha` ahora **rechaza** cuando falta
`TURNSTILE_SECRET_KEY` en producción (con `logger.error`), usa la clave de prueba solo en
desarrollo y con un warning, y envuelve el fetch en try/catch que **falla cerrado**.

**D26 — el rate limiter no volvía a bloquear.** El `CASE` de `blockedUntil` ahora se limpia a NULL
al rotar la ventana y se vuelve a poner cuando se excede de nuevo.

**D27 — escalada a superadmin.** `PATCH /api/admin/users/[id]` rechaza con 403 asignar un rol
`isSuperadmin` si quien lo hace no es superadmin, y `/api/admin/roles/assignable` filtra esos roles
del selector. Registrado con su severidad honesta: hoy no es explotable con los roles sembrados,
porque solo SUPERADMIN tiene `users:roles:manage`.

**D28 — tablas transitorias sin techo.** `prune_transient_rows()`
(`20260925010000_prune_transient_tables`) borra los tokens de verificación vencidos y las ventanas
de rate limit ya cerradas, con un margen de 1 día para no pisar una request en vuelo. La llama el
cron diario. Verificado: podó 3 filas viejas de `rate_limits` en la base local.

De paso, `action: "user.role.update"` pasó a `AUDIT_ACTIONS.userRoleUpdate`.

## Preguntas abiertas

1. **¿La base desplegada está en sincronía con las migraciones?** Nada verifica que las funciones
   que corren en producción coincidan con `prisma/migrations/**`. El incidente de `get_actor_size`
   — una reescritura que se salteó una función, rompiendo toda operación de ledger de EVENT hasta
   que `20260713000000` lo atrapó — es el precedente. Vale un chequeo, y quizá una aserción de
   arranque. Este milestone agrega funciones SQL nuevas, así que la superficie creció.
2. **¿La retención de reportes y la de auditoría deberían tener la misma respuesta?** El historial
   de reportes quedó en 3 años compactado. `audit_logs` sigue creciendo sin política (pregunta
   abierta del milestone 2). Son la misma clase de decisión y probablemente merecen una sola
   respuesta.
3. **¿Poner la ventana dentro de `get_user_next_reservations`?** La slice G subió el techo de
   ocurrencias del calendario de 100 a 500 y agregó un warning, pero la corrección real es que la
   función SQL reciba el rango y devuelva solo eso. Cambia su firma y tiene otros callers.
