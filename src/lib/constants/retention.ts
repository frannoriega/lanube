/**
 * Cuánto tiempo se conserva el historial de reportes, y en qué forma.
 *
 * La política tiene dos niveles, porque las dos preguntas que se le hacen al historial son
 * distintas:
 *
 *  - **Detalle crudo** (`reservations`): filas individuales, con quién reservó, por qué y
 *    en qué espacio. Es lo que permite auditar un caso puntual, y lo que más crece.
 *    Se conserva {@link RAW_RETENTION_MONTHS} meses.
 *  - **Agregados** (`report_snapshots`): el reporte ya calculado de cada mes/año — totales,
 *    duraciones, uso por espacio. Es lo que responde "¿cómo venimos comparado con el año
 *    pasado?". Ocupa una fila por mes y se conserva {@link SNAPSHOT_RETENTION_YEARS} años.
 *
 * El orden importa: **nunca se borra detalle crudo de un mes que todavía no fue
 * compactado**. `prune_reservation_history()` exige que exista el snapshot mensual que cubre
 * esa fila antes de borrarla, así una corrida fallida del snapshot no puede provocar pérdida
 * de datos — solo retrasa la limpieza.
 */

/**
 * Meses de detalle crudo (`reservations`) que se conservan. Pasado ese plazo, y solo si el
 * mes ya fue compactado, las filas se borran y el mes vive únicamente como agregado.
 */
export const RAW_RETENTION_MONTHS = 12;

/** Años que se conservan los snapshots de reportes (mensuales y anuales). */
export const SNAPSHOT_RETENTION_YEARS = 3;

/** Los mismos valores en milisegundos, para los cálculos de corte. */
export const RAW_RETENTION_MS = RAW_RETENTION_MONTHS * 30 * 24 * 60 * 60 * 1000;
export const SNAPSHOT_RETENTION_MS =
  SNAPSHOT_RETENTION_YEARS * 365 * 24 * 60 * 60 * 1000;
