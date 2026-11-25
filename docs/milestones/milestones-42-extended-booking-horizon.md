# Milestone 42 — Reservar más allá de las dos semanas (permiso)

**Estado:** done (2026-11-25). Versión 1.2.0.

## Qué pidió el usuario (2026-11-25)

Un permiso que, dado a un rol, le permita a quien lo tenga **reservar sin la limitación de dos
semanas**: poder reservar mucho más adelante.

**Decisión del usuario (misma sesión):** el horizonte extendido es una **ventana deslizante de un
año** (hoy + 365 días), no «sin límite» ni «hasta fin del año próximo».

## Contexto

El horizonte (milestone 26, `src/lib/reservations/booking-horizon.ts`) es una ventana deslizante
de 14 días, en día local del predio, hecha cumplir en el servidor por
`validateUserReservationWindow` (web + conector MCP) y `computeFreeWindows`, y en el calendario de
reserva, que **saca** (no grisa) los días que pasan el horizonte (`calendar-utils.ts`). Existe para
que quien organiza eventos tenga certeza: pasado el horizonte no hay reservas de usuarios. Los
administradores (reservas cargadas desde el panel) no están sujetos.

## Diseño

- **Permiso nuevo `reservations:extended-horizon`** en el catálogo (`src/lib/rbac.ts`), en el grupo
  «Reservas» del checklist de roles, con descripción en castellano («Reservar con hasta un año de
  anticipación»). No se le agrega a ningún rol sembrado (SUPERADMIN lo tiene implícito); lo asigna
  un superadmin en `/admin/roles`. **No implica `admin:access`**: un rol de usuario «socio» puede
  tenerlo sin entrar al panel.
- **Una sola función para el horizonte de una persona:**
  `bookingHorizonDaysFor(permissions)` → `14` o `365`; `bookingHorizonLastDateKey(nowMs, days)` y
  `bookingHorizonEndMs(nowMs, days)` reciben los días. Todo el resto (servidor y calendario) pasa
  por ahí; nadie compara contra `BOOKING_HORIZON_DAYS` directo.
- **Servidor:** `validateUserReservationWindow` recibe el horizonte de quien reserva, resuelto de los
  permisos de la sesión (web) o del grant (MCP, que ya resuelve permisos frescos por pedido). El
  mensaje de error dice el límite que aplica a esa persona («…hasta 1 año de anticipación: hasta el
  25/11/2027»).
- **Calendario de reserva:** el horizonte llega como prop desde el servidor (layout/página de
  `/user/spaces/[slug]`, que ya tiene el set de permisos). La navegación por semanas se extiende
  hasta ese día.
- **Conector MCP:** `get_availability` y `request_reservation` usan el mismo horizonte; la
  instrucción del servidor MCP que dice «hasta 2 semanas» pasa a «hasta 2 semanas (o lo que permita
  tu rol)».
- **Recurrentes:** si la reserva de un usuario puede ser recurrente, la serie sigue limitada a un
  año por el ledger; con este permiso, ninguna ocurrencia puede caer después del horizonte de la
  persona (misma regla, ya aplicada a la fecha de fin).
- **Sigue siendo PENDING:** el permiso no saltea la aprobación ni las reglas de horario, días
  cerrados o capacidad.

### Riesgo que se acepta (y se documenta en `booking-horizon.ts`)

La garantía del milestone 26 («pasado el horizonte no hay reservas de usuarios») deja de valer para
quienes tengan el permiso. **El usuario lo acepta explícitamente (2026-11-25):** el permiso es para
**roles de gestión**, que son los mismos que crean los eventos; una reserva lejana nunca aparece
«de la nada», la carga el equipo que también arma la agenda de eventos. No se agrega ningún aviso ni
bloqueo extra por esto.

## Criterios de aceptación

- [x] Test puro: horizonte 14 vs 365 según permisos (incluye superadmin).
- [x] Sin el permiso, reservar a 15 días → 400 con el mensaje de siempre; con el permiso, a 300 días
      → PENDING; a 366 → 400 con el mensaje del año.
- [x] El calendario muestra días hasta el horizonte de la persona.
- [x] `access.test.ts` / matriz MCP sin cambios de acceso; el conector respeta el horizonte nuevo.

## Registro

Implementado el 2026-11-25.

- Permiso `reservations:extended-horizon` («Reservar con hasta un año de anticipación»), en el grupo
  «Operación» del checklist de roles. No está en ningún rol sembrado; el superadmin lo tiene implícito.
  No hace falta tocar `FORBIDDEN_PERMISSIONS` del conector: ninguna tool lo **pide**, solo lo **lee**.
- `booking-horizon.ts`: `EXTENDED_BOOKING_HORIZON_DAYS = 365`, `bookingHorizonDaysFor(permisos)` y
  `horizonLabel()`; todas las funciones reciben `days` (por defecto 14). El comentario del módulo
  documenta el riesgo aceptado por el usuario.
- Servidor: `validateUserReservationWindow(…, horizonDays)`, `requestUserReservation({ horizonDays })`
  — la web lo resuelve de la sesión (`POST /api/resources/[spaceId]`), el conector de
  `ctx.permissions` (`request_reservation`, `get_availability` vía `computeFreeWindows({ horizonDays })`
  y el texto de `booking_rules`). La instrucción general del servidor MCP dice «hasta 2 semanas (o
  hasta 1 año si el rol de la persona lo permite)».
- Calendario: `WeekCalendar` recibe `horizonDays` (de `bookingHorizonDaysFor(user)` en
  `CalendarTemplateClient`); `isDayBeyondHorizon` / `horizonWeekStart` / `daysWithinHorizon` lo usan.
- Tests en `booking-horizon.test.ts` (permisos, último día, mensaje, regla de la ventana).
- Verificado contra el servidor local: `u1` pidiendo una reserva a 3 meses → 400 «hasta 2 semanas…
  hasta el 09/12/2026»; `sa1` → 201 (la reserva de prueba se borró); el calendario de `sa1` avanza
  semanas más allá de las dos.
