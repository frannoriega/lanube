/**
 * Modelo intermedio de la exportación de reportes (pedido junto al milestone 32). Los reportes
 * (`ReportData`, `EventsReport`, `EventReport`) se traducen **una sola vez** a este modelo
 * (`build.ts`, puro y testeado) y de acá salen los dos formatos: CSV (`csv.ts`) y Excel
 * (`xlsx.ts`). Así un número no puede decir una cosa en el CSV y otra en la planilla.
 *
 * Reglas del modelo:
 * - **Cada tabla se describe sola**: cada fila trae su período (`Desde`/`Hasta`) o su evento.
 *   Es lo que permite «ir sumando» exportes en un solo archivo: las filas de octubre se pegan
 *   debajo de las de septiembre en la misma tabla y siguen diciendo de qué mes son.
 * - Los valores van **crudos** (números, fechas `YYYY-MM-DD`, instantes en ms): el formato
 *   (separador de miles, `%`, `dd/mm/aaaa`) lo pone cada salida.
 * - Nada de esto conoce la base ni el reloj: recibe los reportes ya calculados.
 */

/** Un valor de celda. `null` = sin dato (celda vacía). */
export type CellValue = string | number | null;

/**
 * Cómo se interpreta y se formatea el valor de una columna.
 * - `int` / `decimal`: números.
 * - `pct`: porcentaje **entero de 0 a 100** (como lo devuelven los reportes).
 * - `date`: fecha del predio, texto `YYYY-MM-DD`.
 * - `datetime`: instante en ms; se muestra en la hora del predio.
 */
export type ColumnKind =
  | "text"
  | "int"
  | "decimal"
  | "pct"
  | "date"
  | "datetime";

export interface ExportColumn {
  key: string;
  label: string;
  kind: ColumnKind;
}

/** Un gráfico nativo de Excel sobre las columnas de una tabla (no existe en CSV). */
export interface ChartSpec {
  /** `stacked`: columnas apiladas; `column`/`bar`: verticales/horizontales; `line`: línea. */
  type: "stacked" | "column" | "bar" | "line";
  title: string;
  /** Columna de la tabla que da las categorías (eje horizontal). */
  category: string;
  /**
   * Series, en orden. `line: true` dibuja esa serie como línea encima de las barras (mismo
   * eje: nunca dos escalas). `dashed` para una línea de referencia (cupo, aprobados).
   */
  series: { key: string; color: string; line?: boolean; dashed?: boolean }[];
}

export interface ExportTable {
  /**
   * Nombre del archivo CSV (sin extensión). Varias tablas con el mismo `csvName` **y las
   * mismas columnas** se escriben en un solo CSV, una debajo de la otra (p. ej. las
   * respuestas de todas las preguntas de un evento).
   */
  csvName: string;
  title: string;
  /** Aclaración que se muestra debajo del título (solo en Excel). */
  note?: string;
  columns: ExportColumn[];
  rows: Record<string, CellValue>[];
  chart?: ChartSpec;
}

/** Un indicador del bloque de resumen de una hoja (las «tarjetas» de la pantalla). */
export interface ExportFact {
  label: string;
  value: CellValue;
  kind: ColumnKind;
  /** Detalle en una línea («de 40 · 3 la crearon después»). */
  hint?: string;
}

/** Una hoja del Excel. En CSV, sus indicadores son un archivo y cada tabla otro. */
export interface ExportSheet {
  /** Nombre de la pestaña: ≤ 31 caracteres, único en el libro (lo garantiza `build.ts`). */
  name: string;
  title: string;
  subtitle?: string;
  /** Prefijo de los CSV de esta hoja (`reservas-2026-10`). */
  csvPrefix: string;
  /** Período o evento de los indicadores: se repite en cada fila del CSV de resumen. */
  factContext: {
    key: string;
    label: string;
    kind: ColumnKind;
    value: CellValue;
  }[];
  facts: ExportFact[];
  tables: ExportTable[];
}

export interface ExportDocument {
  /** Título de la portada («Reporte de actividad — La Nube»). */
  title: string;
  /** Línea de la portada debajo del título (período o evento). */
  scope: string;
  generatedAtMs: number;
  /** Nombre del archivo sin extensión. */
  fileBase: string;
  sheets: ExportSheet[];
}
