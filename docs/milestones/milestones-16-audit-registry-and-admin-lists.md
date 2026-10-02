# Milestone 16 — Registro de auditoría extensible y ajustes de listas del admin

**Estado:** implementado (2026-10-02) en `preview`, sin commitear al cierre de la sesión.
**Tipo:** mixto — infraestructura (auditoría) + calidad de UI (listas del admin).

## Pedido

Textual del usuario (2026-10-02), resumido:

1. Hace poco se cambió cómo se ve en `/admin/audit` un reordenamiento de espacios (el diff,
   qué cambió — ver el seguimiento del 2026-10-02 en `milestones-2-audit-trail.md`). Quiere
   la **misma experiencia para todo lo demás**.
2. Pensando a futuro: algún tipo de **"bus/db de eventos"** para que la auditoría sea fácil de
   extender — que una funcionalidad nueva se audite con el menor dolor posible.
3. Ajustes del admin:
   1. Reordenar (espacios, y probablemente lo demás) **abre un modal**; prefiere reordenar en
      la misma pantalla y la misma tabla.
   2. En los temas de aniversario, el desde/hasta debería ser un **datepicker de rango de
      shadcn**, no dos selects de mes y día.
   3. En eventos y noticias, **checkboxes** para seleccionar uno o más y hacer **borrado en
      lote** o **"marcar como destacado"** en lote.
   4. Pregunta: en eventos, ¿tiene sentido mostrar los eventos como tarjetas, o es mejor una
      tabla con filas?

### Decisiones tomadas con el usuario

Se le preguntaron dos cosas antes de construir:

- **Alcance del "bus"** — opciones: (a) _registro tipado_ en código (`audit_logs` sigue siendo
  el almacén; `emit()` con suscriptores), o (b) _outbox en base_ (`domain_events` escrita en la
  misma transacción, con auditoría y notificaciones como proyecciones; requiere migración y
  backfill, ~el doble de trabajo). **Eligió (a), registro tipado.**
- **Eventos: tarjetas o tabla** — **eligió tabla** (`DataTable`), que en el teléfono sigue
  siendo una tarjeta por fila.

Lo demás se decidió sin preguntar, con la convención del repo como default (ver abajo cada
decisión y por qué).

## Diagnóstico

### Auditoría

- Las **rutas elegían a mano qué guardar**, y casi todas guardaban poco:
  - `event.create` / `event.update`: solo `after: { name, status }` — editar un evento no
    decía qué había cambiado (la fecha, el cupo, la descripción…).
  - `form.update`: solo `after: { name }` — editar las preguntas de un formulario no dejaba
    rastro legible.
  - `siteConfig.update`: todo el formulario como `after`, sin `before` — imposible saber qué
    cambió.
  - Las altas (`*.create`) guardaban uno o dos campos; las bajas, el nombre.
  - Las ediciones con `diffFields` excluían a propósito los textos largos ("para que la
    entrada sea chica y legible"): editar la descripción de un espacio no se auditaba.
- **El vocabulario estaba en cuatro lugares**: `AUDIT_ACTIONS` + `AUDIT_ACTION_LABELS`
  (`actions.ts`), y `ACTION_VERB_TAGS`, `ENTITY_TYPE_LABELS`/`ENTITY_PHRASES`,
  `FIELD_LABELS`/`VALUE_LABELS` (`humanize.ts`). Agregar una funcionalidad auditada era
  tocar los cuatro, y nada avisaba si faltaba uno (salvo la etiqueta de la acción).
- **El formato se adivinaba del valor**: un número era una capacidad o una fecha en ms
  ("Fecha de inicio: 1767225600000"); un string era un nombre o un markdown de 2000
  caracteres que se mostraba entero tachado y otra vez entero en verde.

### Listas del admin

- "Reordenar" en espacios / tipos de reserva / temas **reemplazaba la tabla** por otra lista
  (`ReorderList`); en eventos y noticias ("Reordenar destacados/as") **abría un modal**
  (`FeaturedReorderButton`).
- Los temas recurrentes usaban dos `MonthDayPicker` (cuatro selects) para un rango, sin ver
  el rango, y sin forma visible de expresar uno que cruza el fin de año.
- Eventos era una grilla de tarjetas con portada 16:9 (~6 por pantalla, sin lugar para
  selección); noticias ya era `DataTable`, sin selección.

## Diseño

### 1. Registro de auditoría (`src/lib/audit/registry.ts`)

**Una sola fuente de verdad**, cliente-safe, con dos tablas:

- `AUDIT_ENTITIES` — por entidad: `label` (chip, "Eventos"), `phrase` ("del evento"),
  `subject` (qué campo nombra al registro y con qué rótulo: `{ key: "name", label: "Evento" }`)
  y **`fields`: qué campos se auditan y de qué tipo**. Lo que no está en `fields` no se
  guarda ni se muestra — así `updatedAt`, ids internos o `featuredOrder` nunca aparecen como
  "cambio".
- `AUDIT_EVENTS` — por acción (`"event.update"`): `entity`, `kind`
  (`create | update | delete | custom`), `label` ("Editó un evento"), `verb` ("Edición"),
  `cascaded?`, y `fields?` propios del evento (p. ej. `participant.decide` agrega
  `decision`, `decided`, `reason`).

`actions.ts` **se mantuvo** como la tabla de nombres camelCase (`AUDIT_ACTIONS.eventUpdate`)
para no tocar las llamadas existentes, pero ahora con
`satisfies Record<string, AuditAction>` (un id no registrado no compila), y
`AUDIT_ACTION_LABELS` / `CASCADED_ACTIONS` **derivados** del registro. `humanize.ts` dejó
sus mapas: lee chips, frases y rótulos del registro; quedan solo tablas `LEGACY_*` para
entradas viejas o campos que el registro no describe.

Los ids se siguen persistiendo en `audit_logs.action`: **renombrar uno deja huérfano el
historial** (sin cambios respecto del milestone 2).

### 2. Tipos de campo (`src/lib/audit/fields.ts`)

Cada campo declara su `kind`, y el panel elige el diff a partir del tipo:

| kind                | formato                                                                    | diff en el panel                                                                                                          |
| ------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `text`              | tal cual                                                                   | línea roja tachada + línea verde                                                                                          |
| `longText`          | —                                                                          | **diff por líneas** con las palabras cambiadas resaltadas; líneas iguales lejanas colapsadas ("⋯ N línea(s) sin cambios") |
| `bool`              | Sí / No                                                                    | valor                                                                                                                     |
| `number`            | con unidad opcional ("12 personas")                                        | valor                                                                                                                     |
| `enum`              | traducido con `values`                                                     | valor                                                                                                                     |
| `date` / `dateTime` | ms → dd/mm/aaaa [HH:mm], **en el cliente** (zona e idioma de quien mira)   | valor                                                                                                                     |
| `monthDay`          | "12-20" → "20 de diciembre"                                                | valor                                                                                                                     |
| `image`             | URL                                                                        | **miniaturas** antes / después                                                                                            |
| `set`               | lista sin orden, ítems traducidos opcionales                               | solo agregados / quitados                                                                                                 |
| `items`             | lista de registros con id (preguntas de un formulario, FAQs de un espacio) | agregados / quitados / **modificados con el diff de cada campo**                                                          |
| `order`             | `[{ id, name }]`                                                           | el diff de reordenamiento del 2026-10-02                                                                                  |

En un **alta** el panel muestra solo líneas verdes y titula "Datos"; en una **baja**, solo
rojas y "Datos al eliminar"; el resumen de una baja no lista campos ("Eliminación del
recurso: Proyector.") y el de un alta no dice "(vacío) →".

El diff de texto (`text-diff.ts`) es LCS por líneas y, en cada par de líneas reemplazadas,
LCS por palabras (tokens con su espacio pegado, así el texto se reconstruye idéntico). Los
textos auditados son cortos, O(n·m) sobra. Un texto vacío es "cero líneas" (no "una línea
vacía") — bug encontrado al verificar en el navegador: borrar una descripción mostraba una
línea verde vacía emparejada con la roja.

### 3. El "bus" (`src/lib/audit/emit.ts`)

```ts
const audit = await beginAudit("Event", id); // foto de antes
const event = await updateEvent(id, data); // la escritura
await audit.commit(session, AUDIT_ACTIONS.eventUpdate); // foto de después + entrada
```

- **La ruta no elige campos.** `beginAudit` saca una **foto** del registro antes de escribir
  (`snapshots.ts`), `commit` saca otra después, y `pickAuditSides` (`pick.ts`, puro y
  testeado) guarda según el `kind`: alta → solo "después" sin vacíos; edición → solo lo que
  cambió (vacíos equivalentes: `null`/`""`/`[]`; los `set` se comparan sin orden); baja →
  solo "antes". **Una edición que no cambió nada auditado no escribe nada.**
- **`context` automático** con el `subject` de la entidad (`{ Evento: "Taller de IA" }`),
  combinable con `options.context`.
- `commit` acepta `extra` para lo que no sale de la foto (las sesiones canceladas /
  reprogramadas en el mismo guardado de un evento — `describeSessionActions` en
  `src/lib/events/session-audit.ts`, fechas en la zona del panel como `formatEventTimeRange`),
  `reason` y `requestId`.
- `emitAudit(session, action, { entityId, before, after, context, … })` para los eventos
  `custom` (decisiones de reservas e inscripciones, check-in, reordenamientos), donde la ruta
  arma los lados a mano. `entityType` sale del registro.
- **Suscriptores** (`AUDIT_SUBSCRIBERS`): cada entrada pasa por una lista de destinos; hoy
  solo la escritura en `audit_logs` (`recordAuditFromSession`). Es el punto donde engancharía
  una notificación o una cola sin tocar rutas. Como `recordAudit`, **nunca lanza**: cada
  suscriptor va en su `try`, y una falla de foto o de commit se loguea.

**Fotos** (`snapshots.ts`, server-only): leen el registro y lo devuelven _como lo leería una
persona_, con ids resueltos a nombres **en ese momento** (el espacio, el tipo, la plantilla
de formulario, los roles asignables), días de la semana como texto, el horario formateado y
el árbol de un formulario aplanado en preguntas (`{ id, label, section, type, required,
options }`). Por qué resolver al escribir y no al mostrar: si mañana el espacio se renombra
o la plantilla se borra, la entrada sigue contando lo que pasó.

**Agregar algo auditable** (lo que pedía el punto 2): declarar la entidad (si es nueva) con
sus campos, su foto en `SNAPSHOTS`, el evento en `AUDIT_EVENTS` + su nombre en
`AUDIT_ACTIONS`, y `beginAudit`/`commit` en la ruta. `registry.test.ts` falla si un evento
apunta a una entidad inexistente, si `AUDIT_ACTIONS` y el registro no coinciden, si un
campo no tiene rótulo, si el `subject` no es un campo, o si una entidad con eventos
`create/update/delete` no tiene foto (lee `snapshots.ts` como texto: es server-only).
`actions.test.ts` (rutas mutantes auditadas) acepta ahora `beginAudit(` / `emitAudit(`
además de `recordAudit(`.

#### Rutas migradas

Con `beginAudit`/`commit`: eventos (alta, edición — con sesiones y motivo —, cancelación),
formularios, recursos, espacios, tipos de reserva, temas, noticias (alta, edición, baja,
pedido, decisión, restauración), roles, configuración del sitio. Con `emitAudit`: reservas
(aprobar / rechazar / cancelar / auto-rechazo), rol de usuario, check-in, decisión de
inscripciones y los cinco reordenamientos.

Cambios de forma de las entradas nuevas (las viejas siguen leyéndose, ver "Compatibilidad"):

- `siteConfig.update`: `entityId` pasó de `"site-config"` a `"site"` (el id real de la fila,
  que es lo que necesita la foto); ahora guarda solo lo que cambió.
- `news.request`: guarda los campos `pending*` (título/bajada/cuerpo/portada propuestos y el
  motivo), no solo `pendingAction`.
- `news.decide`: el diff incluye el contenido aplicado al aprobar una edición pedida.
- Se dejó de usar `diffFields` en las rutas migradas (sigue en `diff.ts`, lo usan las
  reservas). Los arreglos `AUDITED_*_FIELDS` por ruta desaparecieron: ahora es el registro.

#### Compatibilidad con entradas viejas

- `participant.decide` siguió en la entidad **`Event`** (así se escribían), no en una entidad
  nueva de inscripciones: no partir el filtro por tipo del historial.
- Ids de acción y de entidad sin cambios. Un id desconocido sigue cayendo a su texto crudo;
  `auditFieldSpecs` usa los campos de la entidad de la entrada si la acción ya no existe.
- Campos sin spec en entradas viejas (`displayOrder`, `priority`, `startDate`…) se rotulan
  con `LEGACY_FIELD_LABELS` o, en último caso, con el primer rótulo de esa clave en
  cualquier entidad.

### 4. Reordenar en la misma tabla

`DataTable` acepta `reorder?: { onMove, nameOf }`. Mientras está presente:

- cada fila (o tarjeta compacta en el teléfono) se arrastra **solo desde una manija al
  final**, con la posición numerada al principio;
- se ocultan las columnas `actions` y `leading` (no se edita ni se selecciona mientras se
  ordena), y `onRowClick` queda desactivado;
- mismos sensores (mouse con distancia mínima, táctil con demora, teclado) y anuncios en
  castellano que `ReorderList` — se extrajeron como `useReorderSensors`,
  `reorderAnnouncements` y `REORDER_SCREEN_READER_INSTRUCTIONS` en `reorder-list.tsx`.

El estado vive en `useTableReorder(items, onSave)` (`molecules/table-reorder.tsx`): borrador,
`dirty`, `start/cancel/move/save`; si `onSave` lanza, el borrador queda para reintentar.
`ReorderBar` dibuja instrucciones + Cancelar / Guardar orden arriba de la tabla. El botón
"Reordenar" sigue en el encabezado de cada página.

**Eventos y noticias:** los destacados tienen un orden propio, distinto del de la lista. Se
agregó una vista **"Destacados" / "Destacadas"** (`?featured=1`; `listEvents({ featured })` /
`listAdminNewsPosts({ featured })`, sin paginar, en orden de `featuredOrder`) donde la misma
tabla se reordena. "Reordenar destacados" en el encabezado lleva a
`?featured=1&reorder=1`, que entra directo al modo (se activa en el primer render, no en
un efecto, para no pintar un cuadro sin manijas). `FeaturedReorderButton` (el modal) se
**eliminó**. `ReorderList` sigue existiendo: lo usan el constructor de formularios y las
preguntas frecuentes del espacio, que son listas dentro de un formulario, no tablas — fuera
del pedido.

### 5. Rango anual para los temas (`molecules/annual-range-picker.tsx`)

Reemplaza los dos `MonthDayPicker` (borrado). Es el `Calendar` de rango de shadcn, igual que
`DateRangePicker`, con dos diferencias porque el año no existe:

- **Encabezado solo con el mes** ("Diciembre") y **sin días de la semana** (un 20 de
  diciembre no cae siempre el mismo día). La grilla sigue desplazada según el año de
  referencia; se aceptó como detalle menor frente a inventar una grilla propia.
- **Cruzar el fin de año**: se elige el inicio en diciembre, se avanza a enero y se elige el
  fin. Internamente se dibuja sobre años de referencia (`src/lib/landing-themes/month-day.ts`):
  2024 (bisiesto) para ventanas dentro del año, 2023→2024 para las que cruzan — así el 29 de
  febrero existe donde puede aparecer (también como fin de una ventana que cruza). Lo
  guardado sigue siendo solo `"MM-DD"`; no hay cambios de modelo ni de esquema.
- El segundo click se compara contra la **fecha realmente clickeada** como inicio (estado
  `anchor`), no contra la reconstruida en el año de referencia: si no, elegir un inicio en
  la vista de 2023 y un fin en 2024 se invertía.
- Encontrado al verificar: la regla de esquema "inicio y fin" quedaba con un error colgado
  porque cada `setValue` validaba su campo con el otro todavía viejo. Ahora se setean ambos
  y se valida una vez (`form.trigger([...])`).

La lista de temas muestra la ventana como "20 de diciembre – 6 de enero (cada año)"
(`formatAnnualRange`), y la auditoría usa el mismo `formatMonthDay`.

### 6. Acciones en lote (eventos y noticias)

- `molecules/bulk-actions.tsx`: `selectionColumn()` (checkbox, rol `leading` en la tarjeta),
  `BulkActionBar` (aparece al marcar, sticky, "N seleccionados · Deseleccionar"),
  `BulkConfirmDialog` (lista **qué** se va a tocar, hasta 8 nombres + "y N más") y
  `useBulkAction(endpoint, onDone)` (llama, informa hechos y salteados con sus motivos,
  refresca).
- `POST /api/admin/events/bulk` y `POST /api/admin/news/bulk`, cuerpo
  `{ ids (≤100, sin repetidos), action: "delete" | "feature" | "unfeature" }`
  (`src/lib/schemas/bulk.ts`), respuesta `{ done, skipped: [{ id, reason }] }`.
- **Cada registro tocado deja su propia entrada** (`event.delete` / `event.update` con el
  diff de `isFeatured`, etc.), todas con el **mismo `requestId`**: `/admin/audit` las agrupa,
  y cada evento conserva su historia. No se creó una acción "bulk" nueva.
- **Destacar en lote agrega al final** del orden de destacados (`setEventsFeatured` /
  `setNewsPostsFeatured`), en el orden recibido: una acción en lote nunca pisa el orden armado
  con "Reordenar". Los cancelados / eliminados se ignoran.
- **Eventos:** "Cancelar eventos" es la misma baja lógica que el botón del evento
  (`deleteEvent`: libera reservas, conserva formulario e inscriptos, se reactiva editando).
  Las filas canceladas no se pueden marcar.
- **Noticias: mismas reglas que nota por nota.** Destacar es decisión de portada → solo
  `news:approve` (los botones ni aparecen sin el permiso; el endpoint responde 403). Sin
  `news:approve` solo se marcan las notas propias no publicadas (una publicada se _pide_
  eliminar); el endpoint lo revalida y saltea con motivo en vez de rechazar el lote. En la
  vista "Eliminadas" no hay checkboxes. El diálogo aclara que las notas alguna vez
  publicadas quedan en "Eliminadas" (restaurables) y los borradores se borran del todo
  (`shouldSoftDelete`).

### 7. Eventos: tabla en vez de tarjetas (respuesta al punto 3.4)

Recomendación dada y aceptada: **tabla**. Motivos: el admin viene a escanear fechas, estado e
inscriptos, no portadas; la tarjeta 16:9 dejaba ~6 eventos por pantalla; la selección en
lote encaja natural en filas; y es el mismo `DataTable` que el resto del admin, así que en el
teléfono sigue siendo una tarjeta por evento (compacta).

`EventsAdminTable` (`organisms/admin/events-admin-table.tsx`): selección · evento (miniatura
48 px desde `md`, ★ si es destacado, "Tipo · Espacio") · fechas (rango + días + horario) ·
estado (chip; en la tarjeta va arriba a la derecha) · inscripción (inscriptos + ventana o
"Sin formulario") · acciones (`EventCardActions` con `inline`: sin borde ni relleno propios).
Página de 20 eventos (antes 9, pensado para la grilla de 3 columnas).

## Verificación

- `npm test` (41 archivos, 366 tests, todos verdes), `npm run lint`, `tsc --noEmit`, `prettier`.
- Tests nuevos: `registry.test.ts`, `pick.test.ts`, `text-diff.test.ts`,
  `month-day.test.ts`, y casos nuevos en `humanize.test.ts` (tipos de campo, orden de los
  cambios, preguntas de formulario, resumen de alta y de baja). Un test viejo cambió a
  propósito: la capacidad ahora sale con unidad ("10 personas → 20 personas").
- En el navegador, contra la base local (superadmin):
  - Espacios: "Reordenar" deja la tabla en su lugar con manijas y posiciones; mover con
    teclado (Espacio, ↑×3, Espacio) funcionó; Cancelar restauró el orden (no se guardó).
  - Eventos: tabla, checkbox → barra en lote → "Destacar" → toast + ★. La entrada de
    auditoría quedó como `event.update`, `before {isFeatured:false}`,
    `after {isFeatured:true}`, `context {Evento: "Taller de IA"}`, con `requestId`. Se
    revirtió con "unfeature" por el mismo endpoint.
  - Auditoría: resúmenes nuevos ("Edición del evento: Taller de IA — destacado: No → Sí.");
    el detalle de una edición de rol vieja mostró el diff de texto (y el bug de la línea
    verde vacía, corregido).
  - Temas: el calendario de rango sin año, 29-02 visible, rango 20-12 → 06-01 cruzando el
    año, reabrir muestra el rango marcado de diciembre a enero; error colgado corregido.
  - `/admin/news`, `?featured=1&reorder=1` en eventos y noticias, tipos de reserva y temas
    renderizan sin errores en el log del servidor.
- El dev server en Docker necesitó `docker restart lanube-app`: Turbopack seguía buscando el
  archivo borrado (`featured-reorder-button.tsx`) y devolvía 500 en todo.

## Descartado / no hecho

- **Outbox en base (`domain_events`)**: descartado por el usuario a favor del registro
  tipado. `AUDIT_SUBSCRIBERS` es el lugar donde se conectaría si se retoma (p. ej. con
  Vercel Queues, como ya anticipa el milestone 13).
- **Unificar `notify()` con el bus de auditoría**: no se hizo. Son pipelines distintos con
  destinatarios distintos (el admin que actúa vs. el afectado); un suscriptor que notifique
  es el paso natural, pero no se pidió.
- **Acción en lote "restaurar"** (noticias eliminadas) y **"publicar/pausar" en lote**: no
  pedidas.
- **Reordenar en la misma tabla para FAQs de espacios y preguntas de formularios**: siguen
  con `ReorderList` porque son listas dentro de un formulario, no tablas del admin.
- **Migrar entradas de auditoría viejas** a la forma nueva: no corresponde reescribir
  historia, y la capa legible ya las muestra.
- La barra de acciones en lote **empuja la tabla** al aparecer (se notó al verificar: un
  segundo click cayó en otra fila). Se dejó así — es el patrón de la tabla de inscriptos —
  pero si molesta, una barra flotante fija abajo lo evitaría.

## Seguimiento (2026-10-02): formulario de temas

Reportado por el usuario con una captura del formulario de temas:

- **La pantalla se veía cortada.** El `<form>` tenía `max-w-3xl`, y la `StickySaveBar` vive
  dentro del form: se estiraba apenas más allá de la columna (por sus márgenes negativos) y
  terminaba con un borde duro a mitad de pantalla. El ancho máximo pasó al contenido
  (`FormPageLayout className="max-w-3xl"`) y el form ocupa todo el ancho, así la barra
  cubre el área completa como en eventos y noticias. Mismo problema y mismo arreglo en
  `role-form.tsx` (`max-w-4xl`) y `form-template-builder.tsx` (`max-w-3xl`): las secciones
  van en un `div` con el ancho máximo y la barra queda afuera.
- **"Emojis" y "Cantidad" desalineados.** La grilla de dos columnas estiraba el campo sin
  descripción ("Cantidad") a la altura de "Emojis" (que tiene "Separados por espacio"), y
  como `FormItem` también es una grilla, repartía el alto sobrante entre sus filas y bajaba
  el rótulo. `items-start` en la grilla contenedora lo resuelve.

- **Franja vacía debajo de la barra** al final del scroll: el `<main>` de `ManagementLayout`
  tiene `py-6`, y la barra solo compensaba el padding lateral. `StickySaveBar` suma `-mb-6`
  (comentado junto a los márgenes laterales: si cambia el padding del `<main>`, cambian
  estos). Todas las páginas que la usan la tienen como último elemento visible del form.

Verificado en el navegador.
