# Milestone 27 — Mis reservas: historial y listado propio

**Estado:** **planificado** (no implementado). Surgió el 2026-11-16, al revisar el horizonte de
reserva (milestone 26).

## Situación actual (verificada en el código)

Una persona **no tiene dónde ver sus reservas pasadas** ni un listado completo de las propias:

- El calendario del espacio (`/user/spaces/[slug]`) solo muestra **desde hoy hacia adelante**
  (`getCalendarDataBySpace` pide `max(ahora, inicio de la ventana)`, y «Anterior» no pasa de la
  semana actual).
- El tablero (`/user/dashboard`) tiene «Reservas Recientes», pero son las **últimas 10 por fecha
  de creación** (`dashboardStats.ts`, `orderBy createdAt desc, take 10`) y se muestran 5: no es
  un historial, mezcla pasadas y futuras, y no pagina. La tarjeta «Reservas Totales» cuenta esas
  10 como máximo, no el total real.
- No existe `/user/reservations` ni un endpoint de listado propio. El conector MCP tiene
  `list_my_reservations`, pero solo las **próximas**.

## Caso de uso

> Como persona que usa La Nube, quiero ver todas mis reservas —pasadas, próximas, canceladas y
> rechazadas— con su estado, para saber qué usé, qué me aprobaron y repetir una anterior.

## Alcance propuesto

- Página **«Mis reservas»** en `/user` (con su entrada en la navegación y su label en
  `SEGMENT_LABELS`): pestañas Próximas / Pasadas, filtro por espacio y estado, paginada.
- Cada fila: espacio, día y horario (es-AR, 24 h), motivo, estado (`StatusBadge`), origen
  (web / asistente) y, si corresponde, «Cancelar» (próximas) y «Reservar de nuevo» (precarga el
  calendario con el mismo espacio y horario).
- Por **ocurrencia**, no por serie (como los reportes del milestone 25, C3): una reserva
  recurrente aporta una fila por fecha, con sus excepciones aplicadas. Hay que reutilizar la
  expansión de `get_user_reservations_window` / `reservation_occurrences()`.
- Endpoint `GET /api/user/reservations` con `requireActiveSession()` (lo exige
  `api-auth.test.ts`) y el envelope `apiSuccess`/`apiCatch`.
- Corregir el tablero: que «Reservas Totales» sea el total real y «Reservas Recientes» ordene
  por fecha del turno, o reemplazarlo por un enlace a esta página.
- MCP: `list_my_reservations` con un parámetro `when: upcoming | past` (hoy solo hay próximas).

## Preguntas abiertas

- ¿Cuánto historial se conserva para el usuario? El cron nocturno poda el ledger y la política de
  retención (milestone 12) guarda 12 meses de detalle crudo: el historial propio debería leerse
  de `reservations`, no del ledger.
- ¿Se muestran las reservas canceladas o rechazadas, o solo las que se usaron? (Propuesta: sí,
  con filtro, porque explican por qué algo no ocurrió.)
- Si se implementa el puntaje de uso por check-in (ver memoria del proyecto), este historial es
  el lugar natural para mostrarlo.
