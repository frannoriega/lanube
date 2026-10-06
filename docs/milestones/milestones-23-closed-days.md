# Milestone 23 — Días cerrados (feriados, vacaciones y cierres parciales)

**Estado:** **en implementación** en la rama `milestone-23` (aparte de `preview`, para que un
release desde `preview` no promueva una feature a medio hacer). Diseño acordado el 2026-10-06.
Slices hechos: 1.
**Tipo:** feature — dominio de reservas + administración + sincronización externa.

## Pedido

Hoy La Nube (el coworking de la ciudad) tiene dos empleados: uno cubre el turno mañana y otro
el turno tarde. El sistema no tiene forma de registrar que el espacio **está cerrado** un día
(vacaciones, feriados, etc.), así que se pueden pedir y aprobar reservas para días en que nadie
atiende.

Textual del usuario, traducido:

> Sobre feriados, quiero saber si hay una fuente de verdad (cron u otra) con las fechas. No
> confiaría de entrada en Google Calendar: si un feriado cae en fin de semana suele moverse al
> lunes siguiente o al viernes anterior. Si hay un servicio de feriados nacionales con las
> fechas correctas, nos apoyamos en eso. Los feriados de la ciudad no están publicados en
> ningún lado legible por un sistema, pero son pocos: que se puedan cargar a mano.
>
> Sobre vacaciones, quiero saber si tiene sentido sumar algo; me preocupa que crezca hasta ser
> un sistema de RRHH (en cuyo caso tendría más sentido otra app junto a ésta en el VPS, y que
> ésta consuma sus datos).
>
> (Acuerdo con la propuesta.) Sumo una cosa al día cerrado: un **motivo/título**, para
> mostrarlo (como evento en el calendario u otra forma) y que los usuarios entiendan por qué
> está cerrado. Los **cierres parciales** son parte de esto: un cierre puede ser de día completo
> o de algunas horas, y conviene usar el mismo modelo.

## Decisiones

### 1. Fuente de feriados nacionales: ArgentinaDatos

`GET https://api.argentinadatos.com/v1/feriados/{año}` (verificado el 2026-10-06 con el año
2026). Devuelve `{ fecha, tipo, nombre }` con `tipo` ∈ `inamovible` / `trasladable` / `puente`,
y la fecha ya es la **efectiva** (p. ej. Güemes figura el 2026-06-15 y el nombre conserva el
«17/6» original), que es justo el caso de traslado que preocupaba. Los `puente` son los días no
laborables con fines turísticos.

Límites que se asumen:

- **No es un servicio oficial**: agrega los decretos del Boletín Oficial, que no tiene API.
  Puede equivocarse o desaparecer.
- La lista 2026 incluye «2026-11-09 Visita del papa León XIV»; no se pudo confirmar si es un
  decreto real. Un dato malo cerraría el espacio sin que nadie lo note.

Por eso **la sincronización propone, no aplica** (ver 3).

### 2. Un solo modelo: `ClosedDay`

Un día cerrado es un **rango de fechas con motivo y, opcionalmente, una franja horaria**. Un
feriado, unas vacaciones de invierno y «mañana cerrado de 14 a 18» son la misma cosa.

Campos (nombres definitivos al escribir el schema, en `prisma/models/closed-days.prisma`):

| Campo                     | Notas                                                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                      | CUID2                                                                                                                                                                                                   |
| `title`                   | **Obligatorio.** Lo que ven los usuarios («Feriado: Día de la Soberanía», «Vacaciones de invierno», «Cerrado por la tarde»). Texto plano, ≤ 100 caracteres                                              |
| `startDate` / `endDate`   | Fechas de calendario locales (`YYYY-MM-DD`, inclusivas), no instantes: «el 25 de mayo» es un día del reloj de pared de Concepción del Uruguay, no un intervalo UTC fijo                                 |
| `startTime` / `endTime`   | Opcionales, minutos desde medianoche local. **Ambos nulos = día completo.** Múltiplos de 15 (los buckets del ledger son de 15 min). Con franja, el cierre aplica a esa franja **en cada día del rango** |
| `source`                  | `NATIONAL_SYNC` · `MANUAL_HOLIDAY` (feriado de la ciudad) · `MANUAL_OTHER` (vacaciones y otros)                                                                                                         |
| `status`                  | `PENDING_REVIEW` (propuesto por la sincronización) · `ACTIVE` · `DISMISSED` (un admin lo descartó; se conserva para que la sincronización no lo vuelva a proponer)                                      |
| `externalKey`             | Solo `NATIONAL_SYNC`: identifica la fila del origen (p. ej. `ar:2026-06-15`) para que la sincronización sea idempotente                                                                                 |
| `holidayKind`             | Solo `NATIONAL_SYNC`: `inamovible` / `trasladable` / `puente`, para mostrar «puente turístico, opcional»                                                                                                |
| `createdAt` / `updatedAt` | BigInt ms, como el resto                                                                                                                                                                                |

Reglas:

- Solo `status = ACTIVE` cierra el espacio.
- Un cierre es **del espacio entero** (La Nube), no por recurso: la atención es lo que falta, no
  un equipo. Si más adelante hace falta cerrar un solo espacio o recurso, es una columna
  opcional nueva, no un modelo nuevo.
- **Nada sobre empleados.** No se guarda quién se toma vacaciones, ni saldos, ni
  aprobaciones. Ése es el límite con RRHH (ver 5).
- Zona horaria: Argentina (UTC-3, sin horario de verano). Las reglas de reserva ya trabajan con
  `BUSINESS_HOURS` y hora de Argentina; el cierre usa la misma conversión que
  `src/lib/admin/admin-timezone.ts`.

### 3. La sincronización propone y el admin confirma

Un job (cron mensual en `vercel.json`, y botón «Sincronizar ahora» en el panel) trae el año en
curso y el siguiente y hace upsert por `externalKey`:

- Fila nueva → `PENDING_REVIEW`.
- Fila ya existente → **no se toca el `status`**, solo se refrescan fecha y nombre si el origen
  cambió y la fila todavía está `PENDING_REVIEW`. Si cambió una fila `ACTIVE`, se marca para
  revisión (no se mueve sola).
- Filas manuales y `DISMISSED` nunca se tocan.
- Si el origen falla, se registra y no se cambia nada: el sistema sigue funcionando con lo que
  hay en la base y los admins cargan a mano.

Los `puente` son opcionales para La Nube (puede decidir abrir), otra razón para que decida una
persona. En la pantalla se confirman en lote («Confirmar todos los feriados inamovibles»).

⚠️ Recordar de CLAUDE.md §4: `report-snapshot` existe pero **no** está en `vercel.json`. Hay
que agregar la entrada del cron nuevo y verificar que realmente quede programada.

### 4. Qué hace un cierre (el trabajo real está en reservas)

1. **Pedir una reserva** que se solape con un cierre activo se rechaza con un mensaje en
   español que incluye el `title` («El espacio está cerrado: Vacaciones de invierno»). Va en las
   funciones de dominio compartidas (`requestUserReservation` y las reglas puras de
   `user-rules.ts`), así web y asistente MCP obtienen la misma regla y el mismo mensaje.
   Se refuerza **también en SQL** (`create_reservation()`), porque la regla de capacidad ya
   vive allí y el cliente puede estar desactualizado.
2. **Calendario de reservas** (`WeekCalendar` / `DayColumn` / `DayStrip`): el cierre se dibuja
   como una tarjeta de solo lectura con el título (mismo patrón que las ocurrencias de eventos
   en `getEventOccurrencesForType()`), no como un bloque anónimo «no disponible». Un cierre
   parcial bloquea solo su franja.
3. **Reservas ya existentes que caen en un cierre nuevo → se marcan para que el admin las
   resuelva.** No se cancelan solas (un cierre se anuncia con tiempo y una cancelación masiva
   automática es difícil de deshacer). Al crear/confirmar el cierre, el admin ve la lista de
   afectadas (patrón de `ApprovalConflictsDialog`: solicitante, contacto, ventanas, por qué) y
   decide caso por caso (cancelar con motivo, o dejar). Cancelar usa el flujo existente, con
   su notificación.
4. **Reservas recurrentes (RRULE) y eventos**: la expansión ocurre en SQL
   (`generate_series`, `rebuild_reservation_ledger_forward`,
   `effective_occurrence_window`), así que el cierre tiene que consultarse ahí. Para eventos se
   reutiliza `ReservationException` (cancelar la sesión con razón), no un mecanismo paralelo.
   **Pregunta abierta de implementación** (se resuelve en el slice 3 leyendo las funciones
   vigentes, que la última redefinición es `20260924110000_capacity_predicates`): si la
   exclusión va dentro del ledger o como filtro de disponibilidad.
5. **Superficies públicas**: el asistente MCP (`get_availability`) y la página de contacto /
   «Espacios» dicen cuándo el espacio está cerrado y por qué.
6. `/admin/reservations` ya excluye reservas de evento (`EXCLUDE_EVENT_RESERVATIONS`); el listado
   de «reservas afectadas por un cierre» debe respetar ese mismo filtro y mostrar los eventos
   afectados por separado.

### 5. Vacaciones: dónde se corta

El sistema solo necesita saber que **el espacio está cerrado**, no quién está de vacaciones. Un
cierre es un rango con motivo; lo de RRHH (saldos, aprobaciones, acumulación, quién cubre) no se
construye. Si más adelante hay una app de gestión de empleados en el VPS, puede crear cierres
por un endpoint autenticado o por el conector MCP/OAuth existente, **sin cambios acá**: el modelo
`ClosedDay` es la frontera. No se construye esa integración ahora.

Con un empleado por turno, la ausencia de uno deja medio día sin cubrir, no un día entero: por
eso los cierres parciales entran desde el principio.

### 6. Permisos y auditoría

- Permiso nuevo `closed-days:manage` en el catálogo de `src/lib/rbac.ts`; se asigna a ADMIN
  (quien opera el coworking). No va a SUPERADMIN-only: es operación diaria, no configuración
  técnica. Agregarlo también a `ADMIN_PATH_PERMISSIONS` en `src/middleware.ts` (ruta
  `/admin/closed-days`) y a `configNavigation` — las tres listas se mantienen sincronizadas
  (CLAUDE.md §5).
- Lectura de cierres: pública (calendario y sitio) y sin permiso.
- Cada mutación audita con `beginAudit`/`commit`: entidad `ClosedDay` declarada en
  `src/lib/audit/registry.ts` (campos `title`, fechas, franja, `source`, `status`), eventos
  create/update/delete + custom para confirmar/descartar propuestas. `actions.test.ts` lo exige.
  Confirmar un lote escribe **una entrada por cierre** con un `requestId` compartido.
- Agregar al registro del MCP: ningún tool de **escritura** de cierres (la gestión por MCP es de
  solo lectura salvo borradores de noticias, y `FORBIDDEN_PERMISSIONS` es una decisión del
  usuario). Lectura pública de cierres: sí.

### 7. UI de administración

`/admin/closed-days` (etiqueta en `SEGMENT_LABELS` de `management-crumbs.ts`):

- `DataTable` (nunca un `<Table>` a mano) con título, fechas, franja («Todo el día» / «14:00–18:00»),
  origen (chip con `ToneBadge`), estado. Pestañas: «Próximos», «Por revisar» (con contador),
  «Pasados».
- Crear/editar es **una página**, no un diálogo (rango de fechas + selector de franja +
  vista de reservas afectadas superan el criterio «≤ ~4 campos simples»). Formulario con shadcn
  Form + RHF + Zod; rango con `DateRangePicker`; franja con un interruptor «Todo el día».
- Acciones en lote para propuestas (`selectionColumn()` + `BulkActionBar`): confirmar /
  descartar.
- Fechas siempre en `es-AR` (24 h).

## Plan por slices

1. **Modelo + dominio puro** ✅ (`prisma/models/closed-days.prisma`, migración
   `20261006100000_closed_days` con CHECKs que hacen cumplir en la base el formato de fechas, el
   orden, la franja múltiplo de 15 y «clave externa ⇔ NATIONAL_SYNC»; lógica pura en
   `src/lib/closed-days/closures.ts`, 17 tests): schema, migración, `ClosedDay` helpers, función pura
   `closureFor(range, closures)` con tests (rangos, franjas, límites de 15 min, medianoche).
2. **Regla de reserva**: rechazo en `user-rules.ts`/`requestUserReservation` y en SQL; tests; MCP
   hereda el mensaje.
3. **Recurrentes y eventos**: leer las funciones SQL vigentes y resolver la pregunta abierta de
   (4.4); tests contra Postgres.
4. **Admin CRUD + auditoría + permiso**: página, API con `requirePermission`, registro de
   auditoría, rbac/middleware/nav.
5. **Calendario**: tarjetas de cierre en `WeekCalendar`/`DayStrip`, mensajes en reserva móvil.
6. **Reservas afectadas**: diálogo de resolución al crear/confirmar un cierre.
7. **Sincronización**: cliente de ArgentinaDatos, upsert idempotente, cron en `vercel.json`,
   botón manual, pantalla «Por revisar».
8. **Superficies públicas y MCP**: `get_availability`, página de contacto/espacios.
9. **Docs**: CLAUDE.md (modelo, regla, sync), este doc, README de milestones, `OPEN_QUESTIONS.md`.

## Fuera de alcance (a propósito)

- Datos por empleado, saldos, aprobaciones de vacaciones (RRHH).
- Cierres por espacio o recurso individual.
- Cierres recurrentes anuales de la ciudad («siempre el 4 de marzo»): se cargan cada año a
  mano; si molesta, es una mejora posterior.
- Cancelación automática de reservas afectadas.
- Escritura de cierres desde el MCP.

## Fuentes

- [ArgentinaDatos — feriados 2026](https://api.argentinadatos.com/v1/feriados/2026)
- [Feriados Argentina API (GitHub)](https://github.com/ggomez0/Feriados-Argentina-API)
- [Banco Central do Brasil — Feriados Argentina (fuente alternativa)](https://olinda.bcb.gov.br/olinda/servico/SML/versao/v1/odata/FeriadosArgentina)
