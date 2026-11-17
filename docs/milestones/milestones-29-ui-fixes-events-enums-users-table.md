# Milestone 29 — Arreglos de UI: eventos en el calendario, estados legibles y tabla de usuarios

**Estado:** implementado (2026-11-17), versión **1.1.0**.
**Tipo:** calidad. Sin cambios de modelo ni migraciones.

## Origen

Pedido del usuario del 2026-11-17, junto con los milestones 30–34. Cuatro arreglos:

1. En el calendario de reservas, los eventos se muestran como una reserva más, con «Estado».
   Un evento siempre está aprobado: el estado no aporta nada. Debe verse como evento y tener
   un enlace a la página del evento.
2. El estado de una reserva se muestra como el valor del enum del sistema (`APPROVED`,
   `PENDING`). Debe ser legible, en español, con badge y color. Revisar otros enums que se
   muestren igual.
3. La tabla de usuarios del panel es muy ancha (tiene muchas columnas, está bien), pero se
   tiene que poder elegir qué columnas ver.
4. La columna «Políticas» de esa tabla confundía: los admins leían «Pendiente» como «no
   terminó el registro». Agregar una ayuda en el encabezado y, en la celda, dejar solo el
   badge, con una tarjeta flotante con el detalle (en vez del texto «Aceptó el …» / «Nunca
   aceptó» debajo).

## Diagnóstico

### 1 y 2 — el diálogo de detalle del calendario

El calendario de reservas (`organisms/calendar/WeekCalendar.tsx`) abre el mismo diálogo
«Detalle de la reserva» para cualquier ocurrencia. Ese diálogo imprime
`Estado: {selectedOccurrence.status}` en texto plano (línea ~1007): de ahí sale `APPROVED`.
Para un evento (`reservableType === "EVENT"`) muestra además «Motivo: <nombre del evento>» y,
si la inscripción está abierta, «Inscribirse».

Las ocurrencias de eventos las arma `getEventOccurrencesForSpace()`
(`src/lib/db/resourceCalendar.ts`) desde el ledger: **toda reserva `EVENT` aprobada**, sin
mirar el estado del evento. Las reservas de un evento nacen `APPROVED` con el evento, también
si está en **borrador** o **pausado** (bloquean el espacio igual; solo el soft delete las
libera). Consecuencias encontradas al revisar:

- El calendario de un usuario muestra el **nombre de un evento en borrador o pausado**, que
  todavía no se anunció (o se bajó a propósito).
- Un enlace «Ver evento» a `/events/[id]` daría **404** para esos eventos: la página pública
  solo existe para eventos publicados y no cancelados.

**Decisión (tomada al implementar, a confirmar por el usuario):** la consulta devuelve si el
evento es público (`status = PUBLISHED` y sin `deletedAt`). Si lo es, la tarjeta y el diálogo
muestran el nombre y el enlace «Ver evento» (más «Inscribirse» si la inscripción está
abierta). Si no lo es, se muestra como **«Reservado para un evento»**, sin nombre ni enlaces:
el horario sigue bloqueado y se ve por qué, pero no se filtra un evento que no se publicó.

### 2 — barrido de enums mostrados en crudo

Búsqueda de `{x.status}`, `{x.mode}`, `{x.kind}`, `{x.origin}`, `{x.reservableType}`,
`{x.role}` y equivalentes en template strings, en `src/components` y `src/app`:

- **`WeekCalendar.tsx` ~1007**: el único enum que llega crudo a la pantalla. Se reemplaza por
  `StatusBadge`.
- **`admin-service-day-timeline.tsx` ~474**: no se ve en pantalla (va al `aria-label`), pero
  tiene su propia traducción estado → español con un `res.status` crudo como último caso. Pasa
  a usar la etiqueta compartida (`reservationStatusLabel()`), así hay una sola tabla.
- El resto ya pasa por `StatusBadge` / `UserStatusBadge` / `ToneBadge` con etiquetas en
  español (dashboard de usuario, tarjetas de reserva del admin, hoja de detalle, eventos,
  check-in, usuarios). Los `{x.reason}` encontrados son texto libre, no enums.

Para que la etiqueta exista fuera del badge, `status-badge.tsx` exporta
`reservationStatusLabel(status)` (la misma tabla que usa `StatusBadge`).

### 3 — elegir columnas

`DataTable` (`src/components/ui/data-table.tsx`) es la tabla compartida de todo el panel
(TanStack Table + tarjetas en teléfonos), y la de usuarios ya la usa con su propio
`useReactTable` (paginación del lado del servidor). TanStack ya trae la visibilidad de
columnas (`columnVisibility`); falta la UI y recordar la elección.

**Diseño:** una molécula `DataTableColumnPicker` (botón «Columnas» → menú con un checkbox por
columna ocultable) y un hook `useColumnVisibility(storageKey, defaults)` que guarda la
elección en `localStorage` por tabla (con `try/catch`: sin almacenamiento, se usan los
valores por defecto). Una columna sin `meta.label`, o con `enableHiding: false`, no aparece
en el menú (selección, acciones, título). En teléfonos (tarjetas) las columnas ocultas
tampoco se muestran, porque las tarjetas leen las celdas visibles: se respeta la misma
elección.

Se aplica a la tabla de usuarios. Cualquier otra tabla lo adopta pasando el estado al
`useReactTable` y poniendo el botón en su barra de filtros.

### 4 — columna «Políticas»

- Encabezado: «Políticas» con un ícono de ayuda y un tooltip: «Indica si la persona aceptó
  la versión vigente de las políticas.» (texto pedido por el usuario).
- Celda: solo el badge («Al día» / «Pendiente»). Al pasar el mouse o tocarlo, una tarjeta
  flotante (Popover; en teclado se abre con foco) con:
  - qué políticas aceptó y en qué versión, con la fecha de aceptación;
  - cuáles le faltan (las que devuelve `pendingPolicies()`), con su versión vigente;
  - si nunca aceptó ninguna, «Nunca aceptó las políticas».
- Para eso `getUsersWithPagination()` pasa a devolver, en vez de `lastPolicyAcceptedAt`, un
  `policyDetail` con `{ accepted: [{ key, title, version, acceptedAt }], pending: [{ key,
title, version }] }`, calculado con el mismo `pendingPolicies()` (no se re-deriva la regla).

## Fuera de alcance

- El calendario de actividades (milestone 32) reemplaza a futuro parte de este diálogo; acá
  solo se arregla el existente.

## Verificación

- `npm test`, `tsc`, lint y formato.
- En el navegador: un evento publicado en el calendario muestra nombre, horario, «Ver evento»
  e «Inscribirse» (si corresponde), sin estado; uno en borrador se ve como «Reservado para un
  evento»; una reserva propia muestra el badge «Aprobada»/«Pendiente».
- Tabla de usuarios: ocultar y mostrar columnas, recargar y que se recuerde; tooltip y
  tarjeta de políticas en escritorio y teléfono.

## Registro de implementación

Implementado el 2026-11-17 en `main`, commit sin firmar, versión **1.1.0** (MINOR: el
selector de columnas es algo nuevo para usar).

### Lo que se hizo

- **Eventos en el calendario** — `getEventOccurrencesForSpace()` lee `status` y `deletedAt`
  del evento y devuelve `eventPublic`; para uno no público, el nombre pasa a ser
  `UNPUBLISHED_EVENT_LABEL` («Reservado para un evento») y no hay `formSlug` ni `formOpen`.
  El diálogo de `WeekCalendar` se titula con el nombre del evento, no muestra estado ni
  motivo, y ofrece «Ver evento» (`/events/[id]`, en otra pestaña) e «Inscribirse» si la
  inscripción está abierta; uno no publicado muestra una línea explicativa. El
  `aria-label` del bloque en `DayColumn` dice «Evento» en lugar de «Reservado».
- **Estados** — el diálogo usa `StatusBadge`. `status-badge.tsx` exporta
  `reservationStatusLabel()`, que reemplazó la traducción propia del `aria-label` en
  `admin-service-day-timeline.tsx`.
- **Columnas** — nueva molécula `molecules/data-table-column-picker.tsx`:
  `DataTableColumnPicker` (extraído del menú que ya tenía `participants-table.tsx`, que
  ahora lo usa) y `usePersistedColumnVisibility(storageKey)` (guarda en
  `localStorage` bajo `lanube:columns:<storageKey>`, leído en un efecto para no romper la
  hidratación). Usuarios: clave `admin-users`; «Nombre» con `enableHiding: false`.
- **`DataTable`**: las filas de «Cargando…» y «sin resultados» usaban
  `getAllLeafColumns().length` como `colSpan`; con columnas ocultas se pasaban del ancho.
  Ahora `getVisibleLeafColumns()` (también en el modo reordenar).
- **Políticas** — `getUsersWithPagination()` devuelve `policyDetail` (`accepted`: última
  aceptación por política, en el orden del registro; `pending`: de `pendingPolicies()`) en
  lugar de `lastPolicyAcceptedAt`. La celda es `PolicyStatusCell`: un Popover que se abre
  al pasar el mouse **solo con puntero de mouse** (en pantallas táctiles el navegador emula
  `mouseenter` antes del click y la tarjeta se abría y cerraba en el mismo toque) y con
  click/toque/teclado; mientras el mouse está encima, un click no la cierra. Las versiones
  de las políticas son fechas ISO, así que se muestran como «versión del 16/11/2025».

### Verificación

- `npm test` (72 archivos, 689 pruebas), `tsc`, ESLint y Prettier.
- En el navegador, contra el stack local de Docker: evento publicado (título con el nombre,
  sin estado, «Ver evento» + «Inscribirse»); el mismo evento pasado a borrador a mano en la
  base (bloque y diálogo «Reservado para un evento», sin enlaces) y vuelto a publicar;
  ocultar «Institución», recargar y que siga oculta; tooltip del encabezado; tarjeta con
  hover en una cuenta al día y con click en una cuenta sin aceptaciones («Tiene que
  aceptar… / Nunca aceptó las políticas.»).

### Pendiente de confirmar con el usuario

- Que un evento no publicado se muestre como «Reservado para un evento» sin nombre (ver
  «Diagnóstico»).
