# Milestone 32 — Calendario de actividades

**Estado:** implementado (2026-11-17), versión **1.1.0** (nació como 1.4.0), junto con la **exportación de reportes** a Excel y CSV (pedida en la misma sesión; ver «Exportar reportes» abajo). El diseño de arriba es el acordado; lo que cambió al implementar está en «Registro de implementación».

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

Implementado el 2026-11-17 en la rama `preview`, sin commit, versión **1.4.0** en su momento (luego plegada en la **1.1.0**) (MINOR: dos cosas
nuevas para usar). En el mismo pedido se sumó la **exportación de reportes** (sección propia más
abajo); comparten versión y changelog (`src/assets/changelog/1.1.0.md`).

### Calendario: lo que se hizo

- **Páginas:** `/admin/calendar` (ítem «Calendario» del menú, justo bajo «Panel» y sin sección propia —no pertenece a «Reservas»—, permiso
  `reservations:manage`, guarda de página con `requirePagePermission`) y `/user/calendar` (ítem
  «Calendario» del menú de usuario; sesión y políticas las resuelve el layout de `/user`). Miga
  `calendar: "Calendario"` en `SEGMENT_LABELS`, con test.
- **Endpoints:** `GET /api/admin/calendar?from&to[&space]` (`reservations:manage`) y
  `GET /api/user/calendar?from&to` (`requireActiveSession`, que exige el test de `api-auth`).
- **Reglas puras** en `src/lib/calendar/activity.ts` (`activity.test.ts`):
  - `calendarRangeError`: `from < to`, rango ≤ **45 días** (`CALENDAR_MAX_RANGE_MS`: la grilla de
    mes son 42 días más un margen por la zona del navegador) y `from` ≤ fin del **año próximo** en
    la hora del predio (`calendarNavigationEndMs`). No hay tope hacia atrás (el diseño solo fijó
    el de adelante).
  - `mergeBusy`: las reservas ajenas de la vista de usuario se **unen por espacio** (los tramos que
    se tocan o se superponen) y salen como «Ocupado» sin id, nombre, motivo ni estado.
  - `closureItems`: un cierre de día completo es **un** ítem de «todo el día» que cubre su rango
    (recortado a la ventana); uno con franja da un ítem con horario por día.
  - `maintenanceItems` (solo admin): rige de `startsAt` (o `createdAt`) a `endedAt`/`endsAt`; sin
    fin y vigente, hasta el final de la ventana pedida. Va en la franja de «todo el día» con el modo
    («Solo aviso», «Solo lectura», «Fuera de servicio»).
- **Carga** en `src/lib/db/activityCalendar.ts`: una consulta sobre `reservation_occurrences()`
  (reservas de personas **y** de eventos, con sus excepciones; solo `PENDING`/`APPROVED`) con el
  espacio y quién reservó (`registered_users` / `teams` / `organizations`, resuelto en SQL), los
  eventos de esas ocurrencias (nombre, estado, formulario y cupo para saber si la inscripción está
  abierta), los cierres activos (`getActiveClosuresForWindow`) y, para admins, las ventanas de
  mantenimiento.
- **Qué ve cada uno:**
  - admin: toda reserva con quién la pidió; pendientes con borde punteado ámbar; eventos (los no
    publicados con borde punteado y su estado); cierres; mantenimiento. Filtro por espacio.
  - usuario: sus reservas (verde; pendientes punteadas), los eventos **publicados** con el botón
    «Inscribirme» (si la inscripción está abierta: `/forms/[slug]`) o «Ver evento»
    (`/events/[id]`), lo ajeno como «Ocupado» (también las sesiones de eventos no publicados,
    igual que «Reservado para un evento» en el calendario de reservas) y los cierres.
- **UI** en `src/components/organisms/activity-calendar/`: `ActivityCalendar.tsx` (barra con
  Hoy / ‹ › / título / vista / filtro, leyenda, grilla horaria, grilla de mes, diálogo de detalle y
  diálogo «+N más») y `calendar-view.ts` puro (`calendar-view.test.ts`): días de cada vista,
  navegación, títulos en español, carriles para superposiciones (`layoutLanes`), franja horaria
  (`hourBounds`) y posición vertical.

### Calendario: decisiones tomadas al implementar

- **No se reusó `DayColumn`.** El diseño decía reusarlo, pero al leerlo resultó ser una pieza del
  calendario de reservas: maneja arrastre/toque para elegir horario, rayados de «no disponible» y
  el horario 08–19 fijo, y **no** resuelve superposiciones (las reservas se apilan una sobre otra).
  Para solo lectura con superposiciones hacía falta otra columna; se escribió una propia en el
  organismo nuevo y la lógica pura (carriles, franja) quedó testeada aparte. `WeekCalendar` y
  `DayColumn` no se tocaron, como pedía el diseño.
- **La semana es de lunes a domingo** (7 columnas), no de lunes a viernes como el de reservas: un
  calendario de actividades tiene que mostrar un evento o un cierre de fin de semana.
- **La franja horaria se adapta:** arranca en 08–19 y se amplía para que entre todo lo visible
  (un evento a las 18:30–23:00 estira la grilla hasta las 23).
- **Vista por defecto:** la guardada en `localStorage` (`lanube:activity-calendar:view`); si no hay,
  por ancho: día (< 640 px), 3 días (< 768 px), semana. Se lee `window.matchMedia` en el efecto de
  montaje y **no** `useMediaQuery`: durante la hidratación ese hook devuelve su valor de servidor y
  un teléfono abría en «Semana» (lo mostró la primera tanda de capturas).
- Una ocurrencia cuenta si **empieza** en la ventana (regla de `reservation_occurrences()`); una
  que empezara antes de la medianoche y siguiera después no se dibuja en el segundo día. No pasa
  con el horario actual.
- **Mes:** hasta 3 ítems por día (lo de todo el día primero) y «+N más» abre la lista del día;
  tocar el número del día abre la vista de ese día.
- **Fuera de alcance:** el conector MCP no tiene herramienta de calendario (no se pidió).

## Exportar reportes (pedido junto con este milestone)

### Pedido

Exportar los reportes a **CSV** («lo que se pueda expresar de verdad como CSV») y a **Excel con
estilos y gráficos**. Generación **en el momento**; si no entrara en un pedido, dejarlo como
milestone con workers y envío por email. Elegir qué exportar con casillas: las estadísticas
generales (el reporte de antes de los eventos) y **cada evento**, con más granularidad si
conviene. Lo mismo, solo para ese evento, en la página de cada evento, que además tiene que tener
su versión imprimible. Y, si se puede, que el Excel se pueda ir «sumando» a una planilla existente.

### Lo que se hizo

- **Endpoint** `GET /api/admin/reports/export` (`reports:view`), con la query
  `format=xlsx|csv`, `from`/`to`, `sections=reservations,daily,events`, `event=<id>` (repetible,
  hasta `MAX_EXPORT_EVENTS` = 50) y `parts=summary,attendance,curve,choices` (por defecto todas).
  Validación pura en `src/lib/reports/export/request.ts`.
- **Un modelo intermedio** (`model.ts`): documento → hojas → indicadores + tablas (+ gráfico por
  tabla). `build.ts` (puro) traduce **los mismos objetos** que dibuja la pantalla
  (`ReportData`, `EventsReport`, `EventReport`) a ese modelo; `csv.ts` y `xlsx.ts` lo escriben.
  Así un número no puede decir una cosa en el CSV y otra en la planilla. Orquestación en
  `server.ts`. Tests en `export.test.ts` (incluye abrir el .xlsx generado con ExcelJS y JSZip).
- **Qué se puede elegir:**
  - por período: «Usuarios y reservas» (indicadores con el período anterior, por servicio con
    gráfico apilado, duraciones), «Actividad diaria» (una fila por día, gráfico apilado
    aprobadas/pendientes/rechazadas) y «Eventos del período» (indicadores, por evento, por tipo,
    por espacio con gráfico de horas);
  - por evento (toda su vida, como su página): «Ficha y resumen», «Asistencia por sesión»
    (gráfico apilado inscriptos/sin inscripción + línea punteada de inscriptos aprobados, con
    ausentes), «Curva de inscripciones» (línea + cupo punteado) y «Respuestas de opciones» (una
    tabla y un gráfico de barras por pregunta).
- **Excel** (`xlsx.ts` con **ExcelJS 4.4**): hoja «Índice» (qué hay y cómo sumar el archivo a uno
  propio), una hoja por bloque y una por evento; títulos con el color de marca, encabezados de
  tabla oscuros, filas cebra, formatos de número reales (`#,##0`, `0%`, `dd/mm/yyyy`,
  `dd/mm/yyyy hh:mm`), anchos de columna calculados, impresión apaisada A4 ajustada al ancho con
  pie «Página N de M».
- **Gráficos nativos de Excel** (`xlsx-charts.ts`): ExcelJS no escribe gráficos y una imagen no se
  edita ni sigue a los datos, así que después de armar el libro se abre el paquete (JSZip) y se le
  agregan las partes DrawingML a mano (`xl/charts/chartN.xml`, `xl/drawings/…`, las relaciones, el
  `<drawing>` en la hoja en el lugar que exige el esquema y los tipos en `[Content_Types].xml`).
  Las series **referencian las celdas** de su tabla y llevan además una copia de los valores
  (`numCache`/`strCache`) para los programas que no recalculan. Verificado abriendo el archivo
  con LibreOffice (exportado a PDF): barras apiladas, líneas punteadas de referencia, fechas en el
  eje y leyenda se ven bien.
- **CSV** (`csv.ts`): un archivo por tabla; los indicadores de cada hoja van a su propio
  `…-resumen.csv` (una fila por indicador, con su período o evento). Si hay más de un archivo, van
  en un **.zip**; si hay uno solo, se baja el .csv. Las respuestas de todas las preguntas de un
  evento van juntas en un CSV (formato largo: evento, pregunta, opción, personas).
- **UI:** `ReportExportPanel` (`organisms/admin/report-export.tsx`): tarjeta «Exportar» plegada
  («Elegir qué exportar»), formato Excel/CSV, casillas de bloques, **una `DataTable` con selección
  para los eventos del período** (convención: listas largas en tablas de página, no en un modal) y
  las partes de cada evento (aparecen cuando hay algún evento marcado). Formulario con RHF + Zod.
  Descarga con `apiDownload` (nuevo en `src/lib/api/client.ts`): mismo manejo de errores que el
  resto del cliente (`ApiError`, políticas, mantenimiento) y nombre de archivo de
  `Content-Disposition`.
- **Página de cada evento:** botón «Imprimir» (la vista ahora lleva la clase `admin-report`, y
  `print.css` se movió al `layout.tsx` de la sección para que aplique a las dos páginas; impreso
  muestra «Reporte del evento — La Nube · Generado: …») y el mismo panel, solo con las partes de
  ese evento.

### Decisiones tomadas al implementar

- **En el momento, sin cola.** Medido contra el stack local: el Excel de agosto–noviembre con los
  tres bloques y 3 eventos se arma en **~0.4–0.5 s** (el primer pedido tardó 7.7 s por la
  compilación de la ruta en desarrollo) y el CSV en ~0.1 s. Un año de días y 50 eventos
  (~3 consultas por evento, de a uno) entra holgado en un pedido, así que **no se abrió el
  milestone de workers + email**. Si algún día se exportaran cientos de eventos o el detalle de
  reservas una por una, ese sería el momento.
- **GET, no POST:** exportar no cambia nada; un GET no se audita (no lo exige el test de
  auditoría, que mira mutaciones) y no lo frena el modo «solo lectura» del mantenimiento.
- **«Sumar a una planilla existente»: sí, pero sin subir el archivo.** Se descartó que la persona
  suba su planilla y el servidor le agregue hojas: ExcelJS, al releer y volver a escribir un libro,
  **pierde lo que no entiende** (gráficos, tablas dinámicas, validaciones), así que podría romper
  justo el archivo maestro; además sería procesar archivos subidos en el servidor. En su lugar el
  formato está pensado para juntarse:
  - cada hoja tiene nombre propio (`Reservas 2026-10`, `Eventos 2026-10`, el nombre del evento),
    así se copia a un libro existente sin pisar otra («Mover o copiar…» en Excel, «Copiar a» en
    Google Sheets) — y el gráfico viaja con la hoja;
  - **cada fila de cada tabla dice de qué período (`Desde`/`Hasta`) o de qué evento es**, así las
    filas de un mes nuevo se pegan debajo de las del anterior en la misma tabla (y los CSV se
    pueden concatenar tal cual). La hoja «Índice» lo explica.
- **CSV estándar, no «a la argentina»:** coma, CRLF, UTF-8 **con BOM** (Excel lee bien los
  acentos), números con punto decimal y sin miles, porcentajes 0–100, fechas `YYYY-MM-DD` y
  `YYYY-MM-DD HH:mm` en la hora del predio. Un Excel en español con separador `;` puede abrir el
  CSV con doble clic en una sola columna; para Excel está el .xlsx, y el CSV queda para planillas
  (Google Sheets lo importa bien) y herramientas de datos.
- **Inyección de fórmulas:** nombres de eventos y opciones los escribe gente. En CSV, todo texto
  que empieza con `=`, `+`, `-`, `@`, tab o retorno va precedido de `'`. En el .xlsx no hace falta:
  las celdas de texto son texto (el test lo comprueba con `=Taller de Python`).
- **Colores de los gráficos** (skill de dataviz, fondo blanco): estados de reserva con la paleta de
  **estado** de referencia (verde `#0CA30C`, amarillo `#FAB219`, rojo `#D03B3B`), como en pantalla;
  series de eventos con las posiciones 1 y 2 de la categórica (azul `#2A78D6`, naranja `#EB6834`,
  `validate_palette.js --mode light`: todo PASS, ΔE daltonismo 24.7); referencias en gris punteado.
  Separación blanca de 1 pt entre segmentos. Nunca dos ejes: la línea de aprobados/cupo comparte
  el eje de las barras.
- **Reporte de cada evento desde la página general = toda su vida**, como su página (no recortado
  al período): el recorte por período ya está en la tabla «Por evento» de la hoja «Eventos».
- **Dependencias nuevas:** `exceljs@4.4.0` y `jszip@3.10.1` (esta ya venía con ExcelJS; se declaró
  porque se usa directo). `npm audit` suma un aviso **moderado** por `uuid` dentro de ExcelJS
  (falta de chequeo de límites al pasar un `buf` a v3/v5/v6); ExcelJS no usa ese camino con datos
  externos. Los demás avisos de `npm audit` ya estaban antes.
- **Docker local:** la imagen de desarrollo guarda `node_modules` en un volumen, así que después
  de este cambio hay que correr `npm install` dentro de `lanube-app` (o recrear el volumen).

### Verificación

- `npm test` (786 pruebas; nuevas: `export.test.ts`, `activity.test.ts`,
  `calendar-view.test.ts`, migas), `tsc`, ESLint, Prettier, `release:check`.
- Contra el stack local, con Playwright (sa1 y u1):
  - calendario del panel en semana y mes (con «+N más» y el diálogo de detalle); la primera
    corrida dio **500** porque el SQL usaba `'ORG'` en vez del valor real del enum,
    `'ORGANIZATION'` — corregido;
  - un `from` en 2028 → 400; u1 pidiendo `/api/admin/calendar` → 403; en `/api/user/calendar` de
    u1 ningún ítem trae `requester` ni reservas ajenas como `reservation` (35 ítems: propias,
    «Ocupado» y eventos);
  - exportación: Excel y CSV (.zip con 18 CSV) de agosto–noviembre con los 3 eventos; descarga
    desde el panel de `/admin/reports` y desde la página de un evento; u1 → 403; el Excel real
    abierto en LibreOffice;
  - la página de un evento en modo impresión (sin menú, sin panel, sin botón).
- `node scripts/mobile-shots.mjs m32 activity` (tomas nuevas `user-activity-calendar` y
  `admin-activity-calendar`): sin desborde horizontal en teléfono (claro y oscuro), tablet y
  escritorio; en teléfono abre en la vista de un día.
- **No se probó** en Excel de Microsoft ni en Google Sheets reales (no hay acceso desde acá): el
  paquete sigue el esquema de OOXML y lo abren ExcelJS y LibreOffice. Vale la pena abrir un
  archivo exportado en ambos antes de publicar.

> **Actualización (milestone 35, 2026-11-18):** el detalle de un ítem ya no es un modal sino un popover anclado a la tarjeta; las tarjetas muestran título + espacio (sin horario) y «+N más» del mes lleva a la vista de día. Ver el milestone 35.
