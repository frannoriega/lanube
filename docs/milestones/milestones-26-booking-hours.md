# Milestone 26 — Horario de reserva de 08:00 a 19:00

**Fecha:** 2026-11-16. **Estado:** implementado (sin commit).

## Qué cambió

El horario en que se puede reservar pasó de **09:00–18:00** a **08:00–19:00** (lunes a viernes,
turnos de 15 minutos).

## Sin anticipación mínima (segundo cambio, misma fecha)

Se quitó la regla de **24 h de anticipación**: ahora vale cualquier turno que empiece desde
`now` en adelante (la regla «nada en el pasado» sigue). Esa regla era también la causa de que
los primeros turnos del día no se pudieran arrastrar en el calendario.

- Se eliminaron `MINIMUM_NOTICE_*` y `hasMinimumNotice` (`booking-window.ts`). `user-rules.ts`
  ya no la valida; el calendario compara contra el reloj (`WeekCalendar`); `computeFreeWindows`
  (MCP) ofrece huecos desde `now` redondeado a la grilla de 15 min; los textos del conector
  dejaron de mencionarla.
- `isDayFullyBlocked` ahora solo bloquea un día cuyo último turno ya empezó (hoy tras las
  18:45, o días pasados).

- El horizonte de 2 semanas se rediseñó en el mismo milestone (sección siguiente).

## Horizonte de reserva: ventana deslizante exacta de 2 semanas

**Para qué existe:** que quien organiza eventos tenga certeza. Pasado el horizonte no puede
haber ninguna reserva de un usuario, así que un evento ahí nunca pisa nada (los administradores
no están sujetos al límite).

**Antes:** «semana de trabajo actual + la siguiente», solo en `WeekCalendar` (`maxWeekStart`).
La ventana real se achicaba durante la semana (de 11 días un lunes a 8 un viernes) y **el
servidor no la hacía cumplir**: la API y el conector MCP aceptaban una reserva a meses vista.

**Ahora:** hoy + 14 días, **inclusive y por día local del predio** (miércoles 1 → hasta el
cierre del miércoles 15). Decisiones:

- **Una sola función pura** (`src/lib/reservations/booking-horizon.ts`: `bookingHorizonLastDateKey`,
  `bookingHorizonEndMs`, `isBeyondBookingHorizon`, `bookingHorizonMessage`), en zona
  `ADMIN_TIMEZONE`. La usan el servidor y el calendario.
- **Servidor:** `validateUserReservationWindow` (`user-rules.ts`) rechaza lo que empieza después
  del último día, con un mensaje que dice hasta cuándo se puede. Lo comparten la web y
  `request_reservation` del MCP; `computeFreeWindows` (`get_availability`) no ofrece días
  pasado el horizonte.
- **Calendario:** la última página es la semana que contiene el último día reservable
  (`horizonWeekStart`) y **solo dibuja los días que entran** (`daysWithinHorizon`): se acorta la
  grilla, no se rayan. En el rango del encabezado, el cierre es el último día dibujado. Pueden
  verse hasta 3 páginas (p. ej. un lunes, la tercera tiene un solo día).
- **Los días pasados siguen rayados, no ocultos** (decisión del usuario), para no perder la
  referencia de la semana en curso.
- `getCurrentWorkWeekStart` ya no salta a la semana siguiente los viernes (solo sábado y
  domingo): ese salto existía porque las 24 h habían bloqueado el resto del viernes.
- `isDayBeyondHorizon` compara **fechas de calendario**, no instantes, para no depender de la
  diferencia entre la zona del navegador y la del predio.

## Diseño

- **Una sola fuente de verdad:** `BOOKING_OPEN_HOUR` / `BOOKING_CLOSE_HOUR` en
  `src/lib/reservations/booking-window.ts`. De ahí se derivan `BOOKING_OPEN_MINUTES` /
  `BOOKING_CLOSE_MINUTES` (validación del servidor, recorte de cierres parciales, huecos libres
  del MCP) y `BUSINESS_HOURS` del calendario (eje, opciones de hora, último turno, «día
  completamente cerrado»). El mensaje `outside_hours` y los textos del conector MCP
  (`tools/index.ts`, `tools/reservations.ts`) se arman con esas constantes: ya no hay horas
  escritas a mano fuera de los tests.
- **La base no valida el horario.** Ninguna función SQL ni migración lo hace (se verificó), así
  que no hace falta migración ni se toca el ledger. Las reservas existentes quedan como estaban;
  solo se amplía lo que se puede pedir.
- **Días con horario especial:** ya existen. Un `ClosedDay` con franja (milestone 23) cierra
  parte del día; «solo abierto de 09:00 a 14:00» se carga como un cierre de 14:00 a 24:00 ese
  día. No se agregó un modelo nuevo.
- **No se hizo configurable desde el panel:** requeriría guardar el horario en `SiteConfig`,
  pasarlo por props al calendario cliente (hoy lee una constante), auditoría, `revalidatePublic`
  y el MCP. Queda como siguiente paso si el horario vuelve a cambiar seguido.

## SEO

El sitio no publica `openingHours` ni JSON-LD de `LocalBusiness` (se buscó en `src/`), y el
horario de reserva no aparece en ninguna página pública. Este cambio no afecta el SEO.

## Tests

Se actualizaron los que tenían el horario escrito (`booking-window`, `user-rules`,
`calendar-utils`, `closures`, `mcp`). Con la auditoría de restricciones de UI, 672 tests en verde, `tsc` y ESLint limpios.

## Auditoría: restricciones que solo aplicaba la UI (2026-11-16)

El horizonte de 2 semanas lo aplicaba el calendario pero no la API. A partir de eso se auditó
toda la app buscando lo mismo: **reglas que la pantalla impone y el servidor no**, o sea, cosas
que un `POST`/`PUT`/`PATCH` directo (o un segundo cliente) podía hacer y la UI nunca habría
mandado.

**Método.** Se listaron las 100 rutas de `src/app/api/**` y, para cada ruta que escribe, se
comparó contra su pantalla: (1) los schemas Zod definidos en componentes contra el que usa la
ruta (`src/components/**`, `src/app/(management)/**`); (2) los `disabled=`/condiciones de
render que esconden acciones (botones por estado, selectores filtrados, listas acotadas); (3)
los chequeos que hace el cliente antes de llamar (tamaños, tipos, horarios). Luego se hizo una
segunda pasada sobre lo que quedaba (rutas de usuario, subidas, consentimiento OAuth, roles).

### Corregido

| #   | Dónde                                           | La UI impedía                                                                                                            | El servidor ahora                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `POST /api/resources/[spaceId]` (y MCP)         | Motivo de reserva de más de 1000 caracteres (`BookingForm`)                                                              | `validateReservationReason` / `RESERVATION_REASON_MAX` en `user-rules.ts`, desde `requestUserReservation`. El MCP ya tenía un tope más estricto (500) y se dejó.                                                                                                                                                                                                                                           |
| 2   | `POST /api/auth/signup`                         | Nombre/apellido de menos de 3, motivo fuera de 20–500 (schema propio de la página)                                       | `signupProfileSchema` (`schemas/profile.ts`), compartido con la página; antes solo se validaba el DNI y el resto se guardaba tal cual (vacío o de cualquier largo). Mismos topes que «Configuración → Perfil» (80/80/120).                                                                                                                                                                                 |
| 3   | `PATCH /api/admin/users/[id]`                   | El selector solo ofrece los roles otorgables                                                                             | Quien no es superadmin no puede cambiar a alguien cuyo **rol actual** no podría otorgar (antes, mandar `roleId: null` le quitaba el rol a un superadmin u otro admin: el chequeo solo miraba el rol de destino). Y a un superadmin no se le cambia el rol desde el panel, simétrico a que nunca se asigna desde ahí. La tabla muestra esos roles como texto, sin selector.                                 |
| 4   | Plantillas de formulario (`formSchemaZod`)      | Mínimo > máximo en campos numéricos; grupo sin campos                                                                    | `inputNodeSchema` rechaza `min > max` (el formulario público quedaba imposible de enviar) y `groupNodeSchema` exige al menos un hijo. Solo lo usan las rutas que escriben plantillas, así que no afecta datos ya guardados.                                                                                                                                                                                |
| 5   | Envío/edición de inscripciones (`validateForm`) | Un grupo con `countFrom` tiene exactamente la cantidad que dicta ese campo (el form la sincroniza solo)                  | `validateNodes` exige `items.length === repeatCount(...)`; si ya hay un error de mínimo/máximo, ese tiene precedencia. Lo usan cliente y servidor (misma función).                                                                                                                                                                                                                                         |
| 6   | `PUT /api/admin/events/[id]` (`sessionActions`) | El panel «Sesiones» solo ofrece las sesiones reales que no terminaron; «Reprogramar» elige un solo día y cuartos de hora | `applySessionActions` rechaza una fecha que no es sesión del evento o que ya pasó (`isUpcomingOccurrence` en `occurrences.ts`, misma regla que la lista: por fecha UTC, y una sesión reprogramada a futuro cuenta como por venir). Antes un PUT directo creaba la excepción **y mandaba el correo a los inscriptos**. `sessionActionSchema` exige grilla de 15 min y mismo día local en la reprogramación. |
| 7   | `PATCH /api/admin/reservations/[id]`            | Aprobar/Rechazar solo en reservas PENDING; rechazar exige motivo; no hay botón «cancelar»                                | Solo `APPROVED`/`REJECTED`, solo sobre PENDING (409 si ya está resuelta), motivo obligatorio para rechazar (≤ 1000). Antes se podía rechazar una aprobada, reaprobar una rechazada (con su cascada de rechazos automáticos) o pasarla a `CANCELLED`. La acción de auditoría `reservationCancel` queda sin uso pero no se renombra (está persistida).                                                       |
| 8   | Alta de passkeys                                | Botón deshabilitado al llegar a 10                                                                                       | `finishPasskeyRegistration` vuelve a contar antes de guardar: con varias altas abiertas en paralelo cada una pasaba el chequeo de `startPasskeyRegistration`.                                                                                                                                                                                                                                              |
| 9   | `PUT /api/admin/roles/[id]`                     | «Puede otorgar estos roles» no ofrece el propio rol                                                                      | `sanitizeGrantableRoleIds(ids, selfId)` lo descarta al editar: un rol que se otorga a sí mismo deja que quien lo tiene lo reparta sin límite.                                                                                                                                                                                                                                                              |

Tests nuevos: `src/lib/schemas/server-enforcement.test.ts` (1, 2, 4, 6), `isUpcomingOccurrence`
en `occurrences.test.ts` y el caso `countFrom` en `form-engine.test.ts`. Las rutas (3, 7) no
tienen test unitario (el repo no testea route handlers); se verificaron leyendo el flujo.

### Revisado y bien (no se tocó)

Cancelar reservas propias (filtrado por dueño), solicitudes de cambio de DNI/motivo (valor
igual, pendiente duplicada, DNI tomado, nunca la propia), cambios de perfil, edición/cancelación
de inscripciones (estados terminales, enlace vencido), subidas de participantes (tamaño, tipo y
campo por servidor), noticias (transiciones de autor, pedidos sobre publicadas, destacar en lote),
roles (sistema, en uso, superadmin), mantenimiento (no se edita ni termina uno terminado, modo
`UNAVAILABLE` con «todo el sitio»), días cerrados (el origen no cambia al editar), espacios (el
`kind` no cambia al editar), eventos en lote (cancelados), check-out, captcha en registro,
reseteo, recuperación y «pedir un enlace nuevo», tope de passkeys al iniciar el alta.

### Descartado a propósito

- **Decidir inscripciones de un evento sin aprobación manual.** La barra Aprobar/Rechazar solo
  aparece si `requiresApproval`, y el servidor no lo exige. No se forzó: si un evento pasa de
  manual a automático quedan inscripciones PENDING que hoy no tienen otra salida, y exigirlo las
  dejaría trabadas. Es un problema de producto previo (¿qué pasa con las pendientes al apagar la
  aprobación?), no de esta auditoría.
- **Transiciones de una noticia para quien tiene `news:approve`.** El formulario ofrece solo
  los pasos «siguientes» según el estado, pero el schema de admin acepta cualquier estado. Es un
  actor con control total sobre las notas; los botones son guía, no un permiso.
- **Destacar una noticia desde el formulario sin `news:approve`.** El interruptor se muestra a
  todos (no es una restricción de UI), aunque destacar en lote sí está restringido. Una nota
  destacada no aparece hasta que alguien con `news:approve` la publica.
- **Tipo MIME de las subidas de admin** (`*/upload`): se toma de `file.type`. No es una
  restricción de UI y el archivo se sirve con ese mismo tipo de imagen.
- **Texto del conector MCP desplegado** que todavía dice «09:00 a 18:00, 24 h»: el código ya
  está actualizado; se corrige al desplegar.
