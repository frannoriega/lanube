import ExcelJS from "exceljs";
import { displayDateTime, wallClock } from "./format";
import type {
  CellValue,
  ColumnKind,
  ExportDocument,
  ExportSheet,
  ExportTable,
} from "./model";
import { injectCharts, type PlacedChart } from "./xlsx-charts";

/**
 * Salida Excel (.xlsx) de la exportación de reportes: una hoja por bloque elegido, con
 * estilos, formatos de número reales (los números son números, las fechas son fechas) y los
 * gráficos **nativos** de Excel (`xlsx-charts.ts`), que siguen a las celdas.
 *
 * Cada hoja se arma de arriba abajo, en una sola columna de bloques: título → indicadores →
 * tablas (cada una seguida de su gráfico). Así se imprime bien (apaisado, ajustado al ancho)
 * y cada tabla queda con su encabezado justo encima, lista para filtrar o copiar.
 */

const INK = "FF0E2A47"; // `la-nube-ink`: los títulos del sitio público.
const MUTED = "FF5B6472";
const ZEBRA = "FFF3F6FA";
const BORDER = "FFD9DEE5";
const CHART_ROWS = 18;
const CHART_COLS = 8;

const NUM_FMT: Partial<Record<ColumnKind, string>> = {
  int: "#,##0",
  decimal: "#,##0.0",
  pct: "0%",
  date: "dd/mm/yyyy",
  datetime: "dd/mm/yyyy hh:mm",
};

/**
 * Una fecha/hora del predio como `Date` "de reloj de pared": Excel no tiene zonas horarias y
 * ExcelJS escribe el `Date` en UTC, así que se arma un instante UTC con los números locales.
 */
function wallDate(kind: "date" | "datetime", value: CellValue): Date | null {
  if (value == null) return null;
  if (kind === "date" && typeof value === "string") {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  if (typeof value === "number") {
    const w = wallClock(value);
    return kind === "date"
      ? new Date(Date.UTC(w.y, w.m - 1, w.d))
      : new Date(Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi));
  }
  return null;
}

/** Valor de celda de Excel para un valor del modelo. */
export function excelValue(
  value: CellValue,
  kind: ColumnKind,
): string | number | Date | null {
  if (value == null) return null;
  switch (kind) {
    case "pct":
      return typeof value === "number" ? value / 100 : null;
    case "date":
    case "datetime":
      return wallDate(kind, value);
    case "int":
    case "decimal":
      return typeof value === "number" ? value : Number(value);
    default:
      return String(value);
  }
}

/** Serial de Excel (días desde 1899-12-30) de un `Date` UTC: la caché de los gráficos. */
function excelSerial(d: Date): number {
  return d.getTime() / 86_400_000 + 25_569;
}

function textWidth(value: CellValue, kind: ColumnKind): number {
  if (value == null) return 0;
  if (kind === "date") return 10;
  if (kind === "datetime") return 16;
  if (kind === "pct") return 5;
  return String(value).length;
}

class SheetWriter {
  row = 1;
  readonly charts: PlacedChart[] = [];
  private readonly widths = new Map<number, number>();

  constructor(private readonly ws: ExcelJS.Worksheet) {}

  private grow(col: number, len: number) {
    this.widths.set(col, Math.max(this.widths.get(col) ?? 0, len));
  }

  title(text: string, subtitle?: string) {
    const c = this.ws.getCell(this.row, 1);
    c.value = text;
    c.font = { bold: true, size: 16, color: { argb: INK } };
    this.ws.getRow(this.row).height = 24;
    this.row++;
    if (subtitle) {
      const s = this.ws.getCell(this.row, 1);
      s.value = subtitle;
      s.font = { size: 10, color: { argb: MUTED } };
      this.row++;
    }
    this.row++;
  }

  heading(text: string, note?: string) {
    const c = this.ws.getCell(this.row, 1);
    c.value = text;
    c.font = { bold: true, size: 12, color: { argb: INK } };
    this.row++;
    if (note) {
      const n = this.ws.getCell(this.row, 1);
      n.value = note;
      n.font = { italic: true, size: 9, color: { argb: MUTED } };
      this.row++;
    }
  }

  facts(sheet: ExportSheet) {
    if (!sheet.facts.length) return;
    this.heading("Resumen");
    for (const f of sheet.facts) {
      const label = this.ws.getCell(this.row, 1);
      label.value = f.label;
      label.font = { color: { argb: MUTED } };
      const value = this.ws.getCell(this.row, 2);
      value.value = excelValue(f.value, f.kind);
      value.font = { bold: true, size: 12, color: { argb: INK } };
      value.alignment = { horizontal: f.kind === "text" ? "left" : "right" };
      if (NUM_FMT[f.kind]) value.numFmt = NUM_FMT[f.kind]!;
      if (f.value == null) value.value = "—";
      if (f.hint) {
        const hint = this.ws.getCell(this.row, 3);
        hint.value = f.hint;
        hint.font = { italic: true, size: 9, color: { argb: MUTED } };
      }
      this.grow(1, f.label.length);
      this.grow(2, Math.min(28, textWidth(f.value, f.kind) + 2));
      this.row++;
    }
    this.row++;
  }

  table(sheetName: string, t: ExportTable) {
    this.heading(t.title, t.note);
    const headerRow = this.row;
    t.columns.forEach((c, i) => {
      const cell = this.ws.getCell(headerRow, i + 1);
      cell.value = c.label;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
      cell.alignment = {
        vertical: "middle",
        wrapText: true,
        horizontal: c.kind === "text" ? "left" : "center",
      };
      cell.border = { bottom: { style: "thin", color: { argb: INK } } };
      this.grow(i + 1, Math.min(22, c.label.length));
    });
    this.ws.getRow(headerRow).height = 30;
    this.row++;

    const firstData = this.row;
    if (t.rows.length === 0) {
      const cell = this.ws.getCell(this.row, 1);
      cell.value = "Sin datos en este período.";
      cell.font = { italic: true, color: { argb: MUTED } };
      this.row += 2;
      return;
    }
    t.rows.forEach((r, ri) => {
      t.columns.forEach((c, ci) => {
        const cell = this.ws.getCell(this.row, ci + 1);
        cell.value = excelValue(r[c.key] ?? null, c.kind);
        if (NUM_FMT[c.kind]) cell.numFmt = NUM_FMT[c.kind]!;
        cell.border = { bottom: { style: "thin", color: { argb: BORDER } } };
        if (ri % 2 === 1) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: ZEBRA },
          };
        }
        this.grow(ci + 1, textWidth(r[c.key] ?? null, c.kind));
      });
      this.row++;
    });
    const lastData = this.row - 1;
    this.row++;

    if (t.chart) this.chart(sheetName, t, headerRow, firstData, lastData);
  }

  private chart(
    sheetName: string,
    t: ExportTable,
    headerRow: number,
    fromRow: number,
    toRow: number,
  ) {
    const spec = t.chart!;
    const colIndex = (key: string) => t.columns.findIndex((c) => c.key === key);
    const catIdx = colIndex(spec.category);
    const catCol = t.columns[catIdx];
    const isDate = catCol.kind === "date" || catCol.kind === "datetime";
    const categories = t.rows.map((r) => {
      const v = r[spec.category] ?? null;
      if (isDate) {
        const d = excelValue(v, catCol.kind);
        return d instanceof Date ? excelSerial(d) : 0;
      }
      return v == null ? "" : String(v);
    });
    // Barras horizontales: un renglón por categoría, así ninguna etiqueta se pisa.
    const rows =
      spec.type === "bar"
        ? Math.max(10, Math.min(40, t.rows.length * 2 + 5))
        : CHART_ROWS;
    this.charts.push({
      sheetName,
      spec,
      category: {
        col: catIdx + 1,
        fromRow,
        toRow,
        values: categories,
        numFormat: isDate ? NUM_FMT[catCol.kind] : undefined,
      },
      series: spec.series.map((s) => {
        const i = colIndex(s.key);
        return {
          headerRow,
          col: i + 1,
          label: t.columns[i].label,
          values: t.rows.map((r) => {
            const v = r[s.key];
            return typeof v === "number" ? v : null;
          }),
          color: s.color,
          line: s.line,
          dashed: s.dashed,
        };
      }),
      anchor: { col: 0, row: this.row - 1, cols: CHART_COLS, rows },
    });
    this.row += rows + 1;
  }

  finish() {
    for (let c = 1; c <= Math.max(CHART_COLS, ...this.widths.keys()); c++) {
      const w = this.widths.get(c) ?? 10;
      this.ws.getColumn(c).width = Math.max(11, Math.min(45, w + 2));
    }
  }
}

function setupPrint(ws: ExcelJS.Worksheet) {
  ws.pageSetup = {
    orientation: "landscape",
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.5,
      right: 0.5,
      top: 0.6,
      bottom: 0.6,
      header: 0.3,
      footer: 0.3,
    },
  };
  ws.headerFooter.oddFooter = "&L&8La Nube&R&8Página &P de &N";
}

const SHEET_DESCRIPTIONS = (s: ExportSheet) =>
  [
    s.facts.length ? "resumen" : null,
    ...s.tables.map((t) => t.title.toLowerCase()),
  ]
    .filter(Boolean)
    .join(" · ");

function coverSheet(wb: ExcelJS.Workbook, doc: ExportDocument) {
  const ws = wb.addWorksheet("Índice", {
    views: [{ showGridLines: false }],
  });
  const w = new SheetWriter(ws);
  w.title(
    doc.title,
    `${doc.scope} · Generado el ${displayDateTime(doc.generatedAtMs)} (hora de Argentina)`,
  );
  w.heading("Hojas de este archivo");
  doc.sheets.forEach((s) => {
    const name = ws.getCell(w.row, 1);
    name.value = s.name;
    name.font = { bold: true, color: { argb: INK } };
    ws.getCell(w.row, 2).value = SHEET_DESCRIPTIONS(s);
    w.row++;
  });
  w.row++;
  w.heading("Cómo llevar todo en un solo archivo");
  for (const line of [
    "Cada hoja tiene un nombre propio (su período o su evento), así que se puede copiar a un libro existente sin pisar otra: en Excel, clic derecho en la pestaña → «Mover o copiar…»; en Google Sheets, «Copiar a» → «Hoja de cálculo existente».",
    "Cada fila de cada tabla dice de qué período (Desde/Hasta) o de qué evento es: las filas de un mes nuevo se pueden pegar debajo de las del mes anterior en la misma tabla.",
    "Los gráficos leen las celdas de su hoja: si se corrige un número, el gráfico cambia.",
  ]) {
    const c = ws.getCell(w.row, 1);
    c.value = `• ${line}`;
    c.alignment = { wrapText: true, vertical: "top" };
    ws.mergeCells(w.row, 1, w.row, 6);
    ws.getRow(w.row).height = 32;
    w.row++;
  }
  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 70;
  setupPrint(ws);
}

/** El .xlsx de un documento de exportación. */
export async function documentToXlsx(doc: ExportDocument): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "La Nube";
  wb.created = new Date(doc.generatedAtMs);
  wb.title = doc.title;

  coverSheet(wb, doc);
  const charts: PlacedChart[] = [];
  for (const s of doc.sheets) {
    const ws = wb.addWorksheet(s.name);
    const w = new SheetWriter(ws);
    w.title(s.title, s.subtitle);
    w.facts(s);
    for (const t of s.tables) w.table(s.name, t);
    if (!s.facts.length && !s.tables.length) {
      ws.getCell(w.row, 1).value = "No hay datos para las partes elegidas.";
    }
    w.finish();
    setupPrint(ws);
    charts.push(...w.charts);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return injectCharts(buffer as ArrayBuffer, charts);
}
