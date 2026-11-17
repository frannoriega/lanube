# Milestone 31 — Eventos en los reportes

**Estado:** diseño acordado (2026-11-17), sin implementar.
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

- Exportar el reporte por evento a CSV (ya existe el CSV de inscriptos).

## Registro de implementación

(Se completa al implementar.)
