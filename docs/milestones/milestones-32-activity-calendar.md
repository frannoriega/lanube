# Milestone 32 — Calendario de actividades

**Estado:** diseño acordado (2026-11-17), sin implementar.

## Caso de uso

Un calendario (solo calendario, sin reservar desde ahí) con **todo lo que pasa en La Nube**,
con vistas de **día, 3 días, semana y mes**, al estilo Google Calendar. La navegación llega
hasta **fin del año siguiente** (es hasta dónde se puede navegar, no algo que se cargue
entero).

## Quién ve qué

- **Admins** (`/admin/calendar`, permiso `admin:access` + el de ver reservas): todas las
  reservas con el nombre de quien reservó (las pendientes, distinguidas), los eventos, los
  días cerrados y las ventanas de mantenimiento. Filtro por espacio.
- **Usuarios** (`/user/calendar`): sus reservas, los eventos publicados, y lo que otros
  reservaron como **«Ocupado»** (sin nombre ni motivo). Al hacer clic en un evento, la
  tarjeta tiene un botón que lleva a la página de inscripción (decisión del usuario). Los
  días cerrados también se muestran.

## Diseño

- **Componente propio, no una librería** (se evaluó FullCalendar): el modo oscuro, los
  tokens de diseño y el formato `es-AR` pelearían con los estilos de la librería, y ya
  tenemos casi todo:
  - Día / 3 días / semana: se reusa `DayColumn` (ya resuelve superposiciones y tarjetas de
    evento) y la lógica pura de `calendar-utils.ts`, en un organismo nuevo de solo lectura.
    El calendario de reservas (`WeekCalendar`) no se toca: está hecho para elegir horarios.
  - Mes: grilla nueva, con «+N más» cuando un día no entra.
- **Datos por rango visible:** un endpoint por vista (`GET /api/admin/calendar?from&to`,
  `GET /api/user/calendar?from&to`) sobre `reservation_occurrences()` (ya expande cada serie
  con sus excepciones), los eventos y los días cerrados. Rango máximo por pedido acotado (una
  vista de mes + márgenes), y el tope de navegación se valida también en el servidor.
- El endpoint de usuario nunca devuelve quién reservó ni el motivo de reservas ajenas.
- En teléfonos, la vista por defecto es día / 3 días (como el calendario de reservas).
- La vista elegida se recuerda en `localStorage`.

## Registro de implementación

(Se completa al implementar.)
