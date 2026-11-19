# Milestone 31 — Eventos en los reportes

**Estado:** implementado (2026-11-17), versión **1.1.0** (nació como 1.3.0). El diseño de abajo es el acordado; lo que cambió al implementar está en «Registro de implementación».
**Depende de:** milestone 30 (check-in) para todo lo de asistencia. El resto se puede hacer
antes.

## Caso de uso

Los reportes (`/admin/reports`) hoy cubren reservas y altas de usuarios. Se suman los
eventos, con estadísticas **globales** del período y **por evento**: desde el reporte se
hace clic en un evento y se ve su detalle, por ejemplo un **gráfico de asistencia** (cuántas
personas hicieron check-in en cada sesión, para ver si se mantiene o cae).

## Global (por período)

Contando **por sesión**, igual que las reservas desde el milestone 25 (C3): una sesión cuenta
en el período en que ocurre, vía `reservation_occurrences()`, y se agrega en SQL con
`GROUP BY`.

- Eventos activos en el período y sesiones realizadas; sesiones canceladas (excepciones con
  motivo).
- Inscripciones nuevas en el período por estado (aprobadas, pendientes, rechazadas,
  canceladas por la persona).
- Ocupación: inscriptos que ocupan lugar ÷ cupo, por evento y promedio.
- Eventos con aprobación manual: tasa de aprobación.
- Tasa de cancelación propia.
- Inscriptos con cuenta en La Nube (`userId`) vs. sin cuenta, y cuántos crearon una cuenta
  después de inscribirse (si los eventos traen gente nueva al sistema).
- Por tipo de evento y por espacio; horas del espacio ocupadas por eventos vs. por reservas.
- **Con check-in (milestone 30):** asistencia por sesión, ausentes (inscriptos aprobados que
  no ingresaron), y **inscriptos vs. sin inscripción** (`source = WALK_IN`).
- Personas que vuelven: participantes (por email normalizado) en más de un evento.

## Por evento (`/admin/reports/events/[id]`)

- Ficha: fechas, sesiones, cupo, tipo, espacio.
- Curva de inscripciones en el tiempo desde que abrió la inscripción.
- Ocupación del cupo y desglose por estado.
- **Gráfico de asistencia por sesión** (barras apiladas: inscriptos que ingresaron + sin
  inscripción, con la línea del cupo / de inscriptos aprobados).
- Ausentismo por sesión.
- Totales de las respuestas de opción (selección única / múltiple) del formulario, p. ej.
  distribución por institución.

Los gráficos usan `recharts` vía `ui/chart.tsx` (ya están en el repo) y siguen la skill de
dataviz (paleta validada, ambos temas).

## Historia y retención

Los snapshots mensuales (`report_snapshots`, cron `report-snapshot`) hoy guardan solo
reservas. Se les suma el bloque de eventos con los totales globales, para que el período
anterior a la retención del detalle crudo también tenga cifras de eventos. El detalle por
evento lee de las tablas de eventos/participantes/check-ins, que no se podan.

## Fuera de alcance

- Exportar el reporte por evento a CSV (ya existe el CSV de inscriptos). **Hecho después**, en la
  versión 1.1.0: Excel y CSV de los reportes, ver `milestones-32-activity-calendar.md`, «Exportar
  reportes».

## Registro de implementación

Implementado el 2026-11-17 en `main`, commit sin firmar, versión **1.3.0** en su momento (MINOR; luego plegada en la **1.1.0**). Antes,
en el mismo pedido, se arregló la falta de guardas de página del panel (entonces 1.2.1, hoy parte de la 1.1.0, ver el
milestone 30, «Hallazgo fuera de alcance»): `/admin/reports` y la página nueva por evento
quedan detrás del `layout.tsx` de reportes (`reports:view`).

### Lo que se hizo

- **Bloque «Eventos» en `/admin/reports`** para el mismo período elegido, con su propio
  endpoint (`GET /api/admin/reports/events?from&to`, mismas validaciones y tope de 366 días
  que el de reservas, sin período de comparación): la página lo carga en paralelo y un error
  en uno no tapa al otro (`LoadError` con reintento). Contenido:
  - tiles: eventos (+ sesiones realizadas, canceladas, por venir), inscripciones por estado,
    asistencia promedio (+ ingresos de inscriptos y sin inscripción), ocupación promedio,
    con cuenta en La Nube (+ cuántos la crearon después de inscribirse), sin inscripción,
    personas que vuelven, aprobación · cancelación propia;
  - tabla por evento (sesiones, inscriptos/cupo, asistencia) — **tocar una fila abre la página
    del evento**;
  - desglose por tipo de evento (eventos, sesiones) y por espacio (eventos, horas de sesiones).
- **Página por evento** `/admin/reports/events/[id]` (toda la vida del evento, no un
  período): tiles (sesiones, inscripciones por estado, ocupación, asistencia promedio, con
  cuenta), **gráfico de asistencia por sesión** (barras apiladas: inscriptos que ingresaron +
  sin inscripción, línea de referencia «Inscriptos aprobados» y «Ver como tabla»), curva
  acumulada de inscripciones (escalones, con la línea del cupo) y totales de las preguntas de
  opciones (barras en HTML con su número).
- **Snapshot mensual:** el cron `report-snapshot` guarda también el bloque de eventos (clave
  `events` dentro de `data`).
- Migas: `/admin/reports/events` no es un link (no tiene página) y el id se lee «Evento».

### Decisiones tomadas al implementar

- **Sesiones expandidas en TypeScript, no con `reservation_occurrences()`.** Esa función
  devuelve el horario efectivo pero no el inicio **nominal** (la clave de los check-ins) ni las
  sesiones canceladas, que este reporte cuenta. Se usa `expandAllEventOccurrences`, que aplica
  la misma regla que el SQL y es la que usan la agenda pública y el check-in. Una sesión cuenta
  en el período en que **empieza** (horario efectivo). Las cuentas son puras
  (`src/lib/events/report-stats.ts`, con tests); la carga, en `src/lib/db/eventReports.ts`.
- **Eventos cancelados afuera:** cancelar un evento borra sus reservas, así que no le quedan
  sesiones.
- **Asistencia = inscriptos que ingresaron ÷ inscriptos aprobados _hoy_**, promediado sobre las
  sesiones realizadas. No hay historia de estados de una inscripción, así que el denominador es
  el actual; la pantalla lo dice. Quien llegó sin inscripción no entra en ese porcentaje: se
  muestra aparte.
- **Inscripciones del período** = las recibidas por el formulario en el período (por
  `createdAt`), con su estado actual; quienes llegaron sin inscripción se cuentan aparte.
  «Personas que vuelven» = emails inscriptos (no cancelados) en 2+ eventos del período.
- **Una sesión que solo sobrevive en sus check-ins** (sus reservas se podaron por la retención
  de 12 meses, o se quitó ese día de la semana del evento) sigue en el gráfico de asistencia con
  su inicio nominal: la asistencia registrada no se pierde.
- **Preguntas de opciones:** solo las de primer nivel (selección única, múltiple y casilla).
  Las de un grupo repetible quedan afuera: se contestan por integrante y mezclarían personas con
  grupos (lo resolvería el campo «Participante» del milestone 34). Cuentan las respuestas de
  quienes ocupan lugar (pendientes y aprobados, con o sin inscripción).
- **Horas por espacio** son solo las de sesiones de eventos: el reporte de reservas ya cuenta
  las reservas de eventos en sus minutos por espacio, así que una comparación «eventos vs.
  reservas» habría contado dos veces.
- **Colores** (skill de dataviz): posiciones 1 y 2 de la paleta categórica de referencia (azul
  `#2a78d6`/`#3987e5`, naranja `#eb6834`/`#d95926`, con paso propio para oscuro), validadas con
  `validate_palette.js` contra las superficies reales de las tarjetas (`glass-card`: slate-200
  y slate-700): pasan todo salvo contraste (2.6–2.9:1, aviso), que la skill admite con alivio —
  acá la tabla «Ver como tabla», la leyenda, el tooltip y los números visibles. La separación de
  2 px entre segmentos usa el color de la tarjeta (`--chart-gap`), no `--card` (al principio se
  usó `--card` y en oscuro dibujaba un borde negro: la tarjeta es translúcida y más clara).
- Sin gráfico en el bloque por período: los totales se leen mejor como números (tiles) y la
  comparación por evento como tabla.

### Verificación

- `npm test` (pruebas nuevas de `report-stats` y de migas), `tsc`, ESLint, Prettier,
  `release:check`.
- En el navegador, contra el stack local, con datos de prueba en el evento «E2E Taller de
  prueba» (16 sesiones de lunes desde agosto; 4 inscripciones más, una cancelada, 2 personas
  sin inscripción y 55 ingresos con asistencia que baja desde mediados de octubre; todo
  marcado `m31test` y borrado al terminar):
  - el endpoint por período (agosto–noviembre) devuelve 3 eventos, 25 sesiones, 16 del E2E con
    69 % de asistencia, ocupación 75 %, cancelación propia 20 %, por tipo y por espacio;
  - el bloque en «Mes anterior» (octubre) y la fila que abre la página del evento;
  - el gráfico de asistencia (la caída se ve, la línea de aprobados, la separación entre
    segmentos), la curva con la línea del cupo y la tarjeta de la casilla de términos.
- `node scripts/mobile-shots.mjs m31 report` (toma nueva `admin-report-event`): sin desborde
  horizontal en teléfono (claro y oscuro), tablet y escritorio.
- **No se corrió el cron de snapshots** en local: además de guardar el snapshot poda el
  detalle crudo de reservas viejas. El cambio es agregar el bloque al JSON que ya se guardaba.
