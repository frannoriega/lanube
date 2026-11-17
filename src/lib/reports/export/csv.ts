import { isoDateTime } from "./format";
import type {
  CellValue,
  ColumnKind,
  ExportColumn,
  ExportDocument,
  ExportTable,
} from "./model";

/**
 * Salida CSV de la exportación de reportes. Un CSV es **una tabla**: lo que en el Excel son
 * los indicadores de una hoja va a su propio archivo (`…-resumen.csv`, una fila por indicador)
 * y cada tabla a otro. Los gráficos no existen en CSV.
 *
 * Formato (RFC 4180), pensado para planillas y para herramientas de datos:
 * - separador coma, fin de línea CRLF, comillas dobles cuando hace falta;
 * - UTF-8 **con BOM**, para que Excel lea bien los acentos al abrirlo con doble clic;
 * - números sin separador de miles y con punto decimal, porcentajes como enteros 0–100,
 *   fechas `YYYY-MM-DD` y fecha-hora `YYYY-MM-DD HH:mm` (hora de Argentina): formatos que
 *   cualquier programa entiende igual, en vez de los de un idioma.
 * - **Inyección de fórmulas**: un texto que empieza con `=`, `+`, `-`, `@`, tab o retorno se
 *   escribe precedido de `'`. Nombres de eventos y opciones de formularios los escribe gente;
 *   sin esto, una planilla podría ejecutar `=HYPERLINK(…)` al abrir el archivo.
 */

export interface CsvFile {
  name: string;
  content: string;
}

const BOM = "﻿";
const FORMULA_START = /^[=+\-@\t\r]/;

/** Texto seguro para una celda de planilla (ver «inyección de fórmulas» arriba). */
export function neutralizeFormula(text: string): string {
  return FORMULA_START.test(text) ? `'${text}` : text;
}

/** Valor de una celda según el tipo de su columna, ya como texto CSV (sin comillas). */
export function csvValue(value: CellValue, kind: ColumnKind): string {
  if (value === null || value === undefined) return "";
  switch (kind) {
    case "datetime":
      return typeof value === "number" ? isoDateTime(value) : String(value);
    case "int":
    case "decimal":
    case "pct":
    case "date":
      return String(value);
    default:
      return neutralizeFormula(String(value));
  }
}

/** Comillas RFC 4180: solo si el campo tiene coma, comillas o saltos de línea. */
export function quoteCsv(field: string): string {
  return /[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

function line(fields: string[]): string {
  return fields.map(quoteCsv).join(",");
}

function tableLines(columns: ExportColumn[], rows: ExportTable["rows"]) {
  return rows.map((r) =>
    line(columns.map((c) => csvValue(r[c.key] ?? null, c.kind))),
  );
}

function sameColumns(a: ExportColumn[], b: ExportColumn[]): boolean {
  return a.length === b.length && a.every((c, i) => c.key === b[i].key);
}

/**
 * Los CSV de un documento, en el orden de las hojas. Las tablas que comparten `csvName` (y
 * columnas) se juntan en un archivo; si comparten nombre pero no columnas, la segunda lleva un
 * sufijo (no debería pasar: `build.ts` usa nombres distintos).
 */
export function documentToCsv(doc: ExportDocument): CsvFile[] {
  const files = new Map<string, { columns: ExportColumn[]; lines: string[] }>();
  const add = (name: string, columns: ExportColumn[], lines: string[]) => {
    let key = name;
    let n = 2;
    while (files.has(key) && !sameColumns(files.get(key)!.columns, columns)) {
      key = `${name}-${n++}`;
    }
    const f = files.get(key);
    if (f) f.lines.push(...lines);
    else files.set(key, { columns, lines: [...lines] });
  };

  for (const sheet of doc.sheets) {
    if (sheet.facts.length) {
      const columns: ExportColumn[] = [
        ...sheet.factContext.map((c) => ({
          key: c.key,
          label: c.label,
          kind: c.kind,
        })),
        { key: "metric", label: "Indicador", kind: "text" },
        { key: "value", label: "Valor", kind: "text" },
        { key: "detail", label: "Detalle", kind: "text" },
      ];
      const context = sheet.factContext.map((c) => csvValue(c.value, c.kind));
      add(
        `${sheet.csvPrefix}-resumen`,
        columns,
        sheet.facts.map((f) =>
          line([
            ...context,
            neutralizeFormula(f.label),
            csvValue(f.value, f.kind),
            f.hint ? neutralizeFormula(f.hint) : "",
          ]),
        ),
      );
    }
    for (const t of sheet.tables) {
      add(t.csvName, t.columns, tableLines(t.columns, t.rows));
    }
  }

  return [...files.entries()].map(([name, f]) => ({
    name: `${name}.csv`,
    content:
      BOM +
      [line(f.columns.map((c) => neutralizeFormula(c.label))), ...f.lines].join(
        "\r\n",
      ) +
      "\r\n",
  }));
}
