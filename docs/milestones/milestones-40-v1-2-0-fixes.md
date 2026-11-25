# Milestone 40 — Arreglos de la v1.2.0

**Estado:** done (2026-11-25). Sale en la **versión 1.2.0**, junto con los milestones 34, 41, 42,
43 y 44 (una sola entrada de changelog para todo).

## Qué pidió el usuario (2026-11-25)

Cinco arreglos chicos, cada uno independiente:

1. **Temas de la portada:** un tema **no recurrente** no se puede guardar: el formulario dice que
   falta elegir las fechas aunque estén elegidas.
2. **Pantalla de registro/ingreso:** el botón de iniciar sesión y otros no tienen el mismo color que
   el resto; casi parecen deshabilitados. Revisar además las **inconsistencias de validación** de los
   formularios de esa pantalla.
3. **Reportes:** el rango personalizado solo deja elegir hasta hoy, pero hay reservas futuras. Sacar
   el límite: se puede mirar tan lejos como se quiera (puede no mostrar nada).
4. **Reprogramar una sesión de un evento:** no hay «deshacer» como en «Cancelar». Además, si se
   reprograma y después se cancela (sin guardar), al abrir «Reprogramar» aparece la fecha de la
   reprogramación anterior en lugar de la **fecha original**.
5. **Notificaciones:** se muestran, pero no hay forma de **borrar una** ni de **borrar todas**.

## F1 — Temas no recurrentes no validan

### Causa (verificada en el código)

`landingThemeInputSchema` (`src/lib/schemas/config.ts`) declara
`startMonthDay: monthDaySchema.optional().nullable()`, con `monthDaySchema` = regex `MM-DD`. El
formulario arranca con `startMonthDay: ""` / `endMonthDay: ""` (`EMPTY_LANDING_THEME`) y un tema no
recurrente nunca los toca. Entonces:

- `""` **no** es `undefined` ni `null` → corre el regex → falla («Formato MM-DD»).
- En Zod 4 los `.refine` del objeto **no corren** si un campo ya falló, así que el error que queda es
  el del campo `startMonthDay`… que en la rama no recurrente **no se dibuja** (solo se muestra el
  `FormMessage` de `startDate`/`endDate`). El submit queda bloqueado y lo que el usuario ve es el
  mensaje viejo del rango («Definí el rango de fechas») o nada.

### Diseño

- Normalizar `""` → `null` en los cuatro campos de ventana con `z.preprocess` (o un
  `emptyToNull()` compartido) **antes** del regex, así el campo vacío de la rama que no se usa no
  invalida nada.
- Pasar las reglas cruzadas a un `superRefine` que valide **solo la rama activa** (`recurring` →
  mes-día; si no → fechas) y que escriba el error en un `path` que la rama activa dibuja.
- Al cambiar el switch «Recurrente», limpiar los errores de la otra rama (`form.clearErrors`).
- Al guardar un tema no recurrente, el servidor guarda `startMonthDay/endMonthDay = null` (y al
  revés), así no quedan restos de la otra rama en la fila.

### Criterios de aceptación

- [x] Test del schema: no recurrente con `startMonthDay: ""` y fechas válidas → válido.
- [x] Test: recurrente con fechas `null` y mes-día válidos → válido; sin mes-día → error en
      `startMonthDay`.
- [x] Crear y editar un tema no recurrente desde `/admin/themes/new` funciona en el navegador.

## F2 — Pantalla de ingreso/registro: botones y validación

### Situación

`src/app/(management)/auth/signin/signin-screen.tsx` (934 líneas) tiene cuatro vistas (ingresar,
crear cuenta, recuperar contraseña, código de recuperación). Las acciones secundarias («Iniciar
sesión» desde «Crear cuenta», «Volver», etc.) usan `variant="outline"` sobre un fondo claro sin
tokens, y se leen como deshabilitadas. Las páginas de auth además **no tienen clases `dark:`**
(limitación ya anotada en el CLAUDE.md §9 y en `OPEN_QUESTIONS.md`).

### Diseño

- **Una jerarquía de botones para las cuatro vistas:** la acción principal de cada vista con el
  variante `brand` (es la acción primaria del sitio público, milestone 18); el cambio de vista
  («¿Ya tenés cuenta? Iniciar sesión», «Crear cuenta», «Volver») como `variant="link"` /
  `secondary` con contraste AA, nunca un `outline` gris sobre gris. Lo mismo en
  `/auth/signup` (completar perfil) y `/auth/reset`.
- **Colores por tokens** (`bg-card`, `text-muted-foreground`, `border-input`) en lugar de
  `bg-slate-100`/`bg-slate-200`, lo que de paso cierra la deuda de modo oscuro de esas pantallas.
  Se borra la entrada correspondiente de `OPEN_QUESTIONS.md` si queda resuelta.
- **Auditoría de validación** (lo que hay que revisar y unificar, con un test por regla):
  - la misma regla de contraseña (largo mínimo, mensaje) en registro, reseteo y código de
    recuperación — una sola fuente en `src/lib/schemas/auth.ts`;
  - confirmación de contraseña con el mismo mensaje y en el mismo campo (`passwordConfirmation`);
  - email: mismo `trim` + normalización en las cuatro vistas;
  - mismo `mode` de react-hook-form (validar al salir del campo y revalidar al escribir) en todas;
  - mensajes en castellano y con el mismo tono; ninguno revela si una cuenta existe;
  - el formulario de completar perfil (`/auth/signup`): DNI, nombre, institución y motivo con los
    mismos límites que el servidor (`server-enforcement.test.ts` ya compara UI vs servidor en otros
    formularios: sumar estos).
- Se documentan los hallazgos concretos (cada inconsistencia y cómo quedó) en el registro de abajo.

### Criterios de aceptación

- [x] Ninguna acción habilitada de las vistas de auth se ve deshabilitada (revisado con
      `scripts/mobile-shots.mjs`, claro y oscuro).
- [x] Una sola regla de contraseña, con test.
- [x] `src/lib/contrast.test.ts` sigue verde.

## F3 — Reportes: fechas futuras

### Situación

`src/app/(management)/admin/reports/page.tsx` (rango personalizado) pasa
`disabled={{ after: now() }}` y `toDate={now()}` al calendario.

### Diseño

- Sacar ambos límites del calendario. Revisar que el endpoint (`/api/admin/reports`, export y
  eventos) no recorte `toMs` a «ahora»; si lo hace, sacarlo. El rango sigue con su tope de largo
  si existe (no cambia).
- Los presets («Este mes», etc.) **no cambian**: siguen terminando hoy. Solo el rango personalizado
  puede ir al futuro. Un período futuro sin datos muestra los vacíos normales del reporte.
- Las reservas futuras se cuentan por ocurrencia igual que las pasadas (`reservation_occurrences()`
  las expande con la regla del ledger, que llega a un año).
- Snapshots: el período futuro nunca está «antes del límite de retención», así que no aparece el
  aviso de datos resumidos.

### Criterios de aceptación

- [x] Se puede elegir un rango que termine (o empiece) en el futuro y el reporte lo muestra.
- [x] El export del mismo rango funciona.

## F4 — Reprogramar: deshacer y fecha original

### Situación (`src/components/organisms/admin/event-sessions.tsx`)

- El botón «Revertir» solo aparece si la sesión está **cancelada**. Una sesión reprogramada (staged
  o guardada) no tiene cómo volver a su horario.
- `RescheduleDialog` guarda `dateKey/start/end` en `useState(default…)`: el estado se inicializa
  **una vez** y además los `default…` salen de `occ.startMs`, que en una sesión reprogramada es el
  horario **nuevo**. Por eso, reprogramar → cancelar → «Reprogramar» muestra la fecha de la
  reprogramación anterior.

### Diseño

- «Revertir» (ícono `RotateCcw`) también para sesiones **reprogramadas**: si el cambio está sin
  guardar, lo descarta; si está guardado, encola un `revert` (mismo `revert()` que ya existe).
- El diálogo recibe el horario **nominal** de la sesión (`occurrenceDateMs` + horario regular del
  día) y **resetea su estado cada vez que se abre** (`onOpenChange(true)` → set de los tres
  valores). Arranca en la fecha original, no en la última reprogramación.
- Opcional en el mismo diálogo: una línea «Horario original: …» cuando la sesión ya está
  reprogramada, para que se vea desde dónde se mueve.
- Con el milestone 44 cada fila staged lleva además su motivo; el «Revertir» descarta también ese
  motivo.

### Criterios de aceptación

- [x] Reprogramar (sin guardar) → «Revertir» vuelve la fila a su estado anterior.
- [x] Sesión reprogramada guardada → «Revertir» + guardar la deja en su horario regular (y avisa
      «restaurada», como hoy con las canceladas).
- [x] Reprogramar → cancelar → «Reprogramar» abre con la fecha y horario originales.

## F5 — Borrar notificaciones

### Situación

El modelo `Notification` (`prisma/models/notifications.prisma`) tiene `readAt`; la API solo tiene
`GET /api/user/notifications` y `POST …/read`. La campana (`NotificationBell`) no permite borrar.

### Diseño

- **Borrado real (`DELETE`), no un `dismissedAt`.** Una notificación in-app es un aviso efímero:
  no es evidencia de nada (la auditoría vive en `audit_logs`, y el correo, si hubo, ya salió). Un
  borrado lógico solo agregaría una columna y un filtro en cada lectura.
- `DELETE /api/user/notifications/[id]` (solo las propias: `where: { id, recipientId }`; 404 si no es
  suya, sin distinguir) y `DELETE /api/user/notifications` (todas las propias). Ambas con
  `requireActiveSession()` (lo exige `api-auth.test.ts`) y el sobre `apiSuccess/apiCatch`.
- Modo mantenimiento: la campana ya está en `READ_ONLY_EXEMPT_PREFIXES`; confirmar que el prefijo
  cubre las rutas nuevas (borrar un aviso propio no es una escritura de negocio).
- UI: cada ítem de la campana con un botón «×» (`aria-label="Borrar notificación"`) a la derecha;
  al pie del popover, «Borrar todas» con confirmación **en el mismo popover** (no modal, regla de
  «evitar modales»). Optimista con rollback y toast si falla.

### Criterios de aceptación

- [x] Borrar una la saca de la lista y del contador; recargar no la trae.
- [x] «Borrar todas» deja la campana vacía con su estado vacío.
- [x] No se puede borrar una notificación ajena (test de la consulta).

## Registro

Implementado el 2026-11-25.

- **F1:** `blankable()` en `src/lib/schemas/config.ts` (unión con `""`, no `z.preprocess`, para que el
  tipo de entrada del formulario siga siendo `string`) para `startMonthDay`/`endMonthDay`/`emojiList`;
  las reglas cruzadas pasaron a un `superRefine` que valida solo la rama activa. Se encontró el mismo
  problema en `emojiList` (efecto «Ninguno» con la lista vacía): arreglado igual. `toWriteData`
  (`db/landingThemes.ts`) trata `""` como vacío. El switch «Recurrente» limpia los errores de la otra
  rama. Tests en `config.test.ts`.
- **F2 — hallazgos y cómo quedaron** (`signin-screen.tsx`, `/auth/signup`, `schemas/auth.ts`):
  - Los botones principales eran `bg-slate-200 text-black` **y además** quedaban deshabilitados hasta
    que el formulario fuera válido (ingreso, registro, envío de enlace), así que se veían grises y
    apagados. Ahora son `variant="brand"` y solo se deshabilitan mientras se envía (o si el área está
    en mantenimiento); los errores se muestran al tocar/enviar. «Crear una cuenta» era idéntico al
    botón principal: pasó a `outline` (acción secundaria). El de passkey perdió sus colores a mano.
  - Modos distintos: registro validaba con `mode: "all"`, el resto al enviar. Las cuatro vistas y el
    perfil usan `mode: "onTouched"`.
  - El ingreso exigía «al menos 8 caracteres» en la contraseña: ahora solo que no esté vacía (el error
    de credenciales sigue siendo genérico). El servidor (`authorize`) usa el mismo schema.
  - La confirmación de contraseña repetía las reglas de largo (dos mensajes «al menos 8»): ahora solo
    «Repetí la contraseña» y «Las contraseñas no coinciden».
  - **Hallazgo durante la verificación:** los `<form>` de auth no tenían `method`, así que un envío
    antes de que cargue el JS (red lenta, recién desplegado) hacía un GET y dejaba el email y la
    **contraseña en la URL** (historial, logs). Ahora los seis formularios de auth llevan
    `method="post"`.
  - Textos en voseo («Ingresá», «Accedé»), enlaces con el color de marca (`text-la-nube-selected`) en
    lugar de `text-blue-900`.
  - Las páginas de auth fuerzan el tema claro (`auth/layout.tsx`, `forcedTheme="light"`), así que la
    deuda de modo oscuro de `OPEN_QUESTIONS.md` no aplica a ellas; los inputs `bg-slate-200` quedan
    (dan contraste sobre la tarjeta de vidrio).
- **F3:** el servidor nunca recortaba a «hoy» (solo limita el largo a 366 días); se sacaron
  `disabled`/`toDate` del calendario del rango personalizado.
- **F4:** `EventOccurrence.nominalEndMs` (fin del horario regular); el diálogo recibe el horario
  nominal y **resetea su estado al abrirse**; «Revertir» también para reprogramadas; el diálogo de una
  reprogramada muestra el horario original.
- **F5:** `deleteNotifications()` (`db/notifications.ts`), `DELETE /api/user/notifications` y
  `DELETE /api/user/notifications/[id]` (404 indistinto para ajenas/inexistentes), «×» por aviso y
  «Borrar todas» con confirmación en el popover. El comentario de `READ_ONLY_EXEMPT_PREFIXES` dice que
  borrar también queda exento.
