import JSZip from "jszip";
import type { ChartSpec } from "./model";

/**
 * Gráficos **nativos** de Excel para la exportación de reportes.
 *
 * ExcelJS escribe celdas y estilos pero no gráficos, y una imagen de un gráfico no se puede
 * editar ni sigue a los datos. Así que, después de que ExcelJS arma el libro, este módulo abre
 * el paquete (un .xlsx es un zip de XML) y le agrega las partes de DrawingML a mano:
 *
 *   xl/charts/chartN.xml                       el gráfico (series → rangos de la hoja)
 *   xl/drawings/drawingM.xml (+ _rels)          dónde se ancla cada gráfico en la hoja
 *   xl/worksheets/_rels/sheetK.xml.rels         la hoja apunta a su dibujo
 *   <drawing r:id/> en sheetK.xml               ídem, dentro de la hoja
 *   [Content_Types].xml                          los tipos de las partes nuevas
 *
 * Las series **referencian las celdas** (`'Hoja'!$B$5:$B$20`): si alguien corrige un número,
 * el gráfico cambia; y al copiar la hoja a otro libro el gráfico viaja con ella. Además se
 * guarda una copia de los valores (`numCache`/`strCache`) para los programas que no recalculan
 * al abrir.
 *
 * Orden de los elementos: el esquema de OOXML es una secuencia estricta (Excel declara el
 * archivo dañado si un elemento está fuera de lugar), así que el orden de cada bloque de abajo
 * es el del esquema, no estético.
 */

/** Un gráfico ya ubicado en una hoja, con los rangos reales de sus datos. */
export interface PlacedChart {
  sheetName: string;
  spec: ChartSpec;
  /** Columna (1 = A) y filas (1-based, inclusivas) de las categorías. */
  category: {
    col: number;
    fromRow: number;
    toRow: number;
    /** Valores en caché: textos, o números si `numFormat` (fechas como serial de Excel). */
    values: (string | number)[];
    numFormat?: string;
  };
  series: {
    /** Fila del encabezado (el nombre de la serie). */
    headerRow: number;
    col: number;
    label: string;
    values: (number | null)[];
    color: string;
    line?: boolean;
    dashed?: boolean;
  }[];
  /** Ancla (0-based): esquina superior izquierda y tamaño en celdas. */
  anchor: { col: number; row: number; cols: number; rows: number };
}

const NS = {
  c: "http://schemas.openxmlformats.org/drawingml/2006/chart",
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  xdr: "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
  pkgRels: "http://schemas.openxmlformats.org/package/2006/relationships",
  relDrawing:
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing",
  relChart:
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart",
  ctChart: "application/vnd.openxmlformats-officedocument.drawingml.chart+xml",
  ctDrawing: "application/vnd.openxmlformats-officedocument.drawing+xml",
};

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 1 → A, 27 → AA. */
export function columnLetter(col: number): string {
  let s = "";
  let n = col;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** `'Hoja de Ana'!$B$5:$B$20` (las comillas simples del nombre se duplican). */
export function rangeRef(
  sheet: string,
  col: number,
  fromRow: number,
  toRow = fromRow,
): string {
  const c = columnLetter(col);
  const quoted = `'${sheet.replace(/'/g, "''")}'`;
  return fromRow === toRow
    ? `${quoted}!$${c}$${fromRow}`
    : `${quoted}!$${c}$${fromRow}:$${c}$${toRow}`;
}

function strCache(values: string[]): string {
  return `<c:strCache><c:ptCount val="${values.length}"/>${values
    .map((v, i) => `<c:pt idx="${i}"><c:v>${escapeXml(v)}</c:v></c:pt>`)
    .join("")}</c:strCache>`;
}

function numCache(values: (number | null)[], format = "General"): string {
  return `<c:numCache><c:formatCode>${escapeXml(format)}</c:formatCode><c:ptCount val="${values.length}"/>${values
    .map((v, i) => (v == null ? "" : `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`))
    .join("")}</c:numCache>`;
}

function richText(text: string, size: number, bold: boolean): string {
  return `<c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="${bold ? 1 : 0}"/></a:pPr><a:r><a:rPr lang="es-AR" sz="${size}" b="${bold ? 1 : 0}"/><a:t>${escapeXml(text)}</a:t></a:r></a:p></c:rich>`;
}

const AXIS_TEXT = `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"><a:solidFill><a:srgbClr val="404040"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="es-AR"/></a:p></c:txPr>`;

const CAT_AX_ID = 50010;
const VAL_AX_ID = 50020;

function catRef(chart: PlacedChart): string {
  const { col, fromRow, toRow, values, numFormat } = chart.category;
  const f = escapeXml(rangeRef(chart.sheetName, col, fromRow, toRow));
  return numFormat
    ? `<c:cat><c:numRef><c:f>${f}</c:f>${numCache(values as number[], numFormat)}</c:numRef></c:cat>`
    : `<c:cat><c:strRef><c:f>${f}</c:f>${strCache(values.map(String))}</c:strRef></c:cat>`;
}

function seriesXml(
  chart: PlacedChart,
  s: PlacedChart["series"][number],
  idx: number,
  kind: "bar" | "line",
): string {
  const { fromRow, toRow } = chart.category;
  const tx = `<c:tx><c:strRef><c:f>${escapeXml(rangeRef(chart.sheetName, s.col, s.headerRow))}</c:f>${strCache([s.label])}</c:strRef></c:tx>`;
  const val = `<c:val><c:numRef><c:f>${escapeXml(rangeRef(chart.sheetName, s.col, fromRow, toRow))}</c:f>${numCache(s.values)}</c:numRef></c:val>`;
  if (kind === "bar") {
    // Separación entre segmentos y barras del color del fondo (skill de dataviz).
    const spPr = `<c:spPr><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr>`;
    return `<c:ser><c:idx val="${idx}"/><c:order val="${idx}"/>${tx}${spPr}<c:invertIfNegative val="0"/>${catRef(chart)}${val}</c:ser>`;
  }
  const dash = s.dashed ? `<a:prstDash val="dash"/>` : "";
  const spPr = `<c:spPr><a:ln w="${s.dashed ? 19050 : 28575}" cap="rnd"><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill>${dash}<a:round/></a:ln></c:spPr>`;
  return `<c:ser><c:idx val="${idx}"/><c:order val="${idx}"/>${tx}${spPr}<c:marker><c:symbol val="none"/></c:marker>${catRef(chart)}${val}<c:smooth val="0"/></c:ser>`;
}

/** El XML de un gráfico (`xl/charts/chartN.xml`). */
export function chartXml(chart: PlacedChart): string {
  const { spec } = chart;
  const barSeries = chart.series.filter((s) => spec.type !== "line" && !s.line);
  const lineSeries = chart.series.filter((s) => spec.type === "line" || s.line);
  const axIds = `<c:axId val="${CAT_AX_ID}"/><c:axId val="${VAL_AX_ID}"/>`;
  const horizontal = spec.type === "bar";

  let idx = 0;
  const bar = barSeries.length
    ? `<c:barChart><c:barDir val="${horizontal ? "bar" : "col"}"/><c:grouping val="${spec.type === "stacked" ? "stacked" : "clustered"}"/><c:varyColors val="0"/>${barSeries
        .map((s) => seriesXml(chart, s, idx++, "bar"))
        .join(
          "",
        )}<c:gapWidth val="60"/>${spec.type === "stacked" ? `<c:overlap val="100"/>` : ""}${axIds}</c:barChart>`
    : "";
  const line = lineSeries.length
    ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${lineSeries
        .map((s) => seriesXml(chart, s, idx++, "line"))
        .join("")}<c:marker val="1"/>${axIds}</c:lineChart>`
    : "";

  const gridLine = `<c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="E1E0D9"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>`;
  const axisLine = `<c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="C3C2B7"/></a:solidFill></a:ln></c:spPr>`;
  const noLine = `<c:spPr><a:ln><a:noFill/></a:ln></c:spPr>`;
  // En barras horizontales el eje de categorías va a la izquierda y se lee de arriba abajo.
  const catAx = `<c:catAx><c:axId val="${CAT_AX_ID}"/><c:scaling><c:orientation val="${horizontal ? "maxMin" : "minMax"}"/></c:scaling><c:delete val="0"/><c:axPos val="${horizontal ? "l" : "b"}"/><c:numFmt formatCode="${escapeXml(chart.category.numFormat ?? "General")}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/>${axisLine}${AXIS_TEXT}<c:crossAx val="${VAL_AX_ID}"/><c:crosses val="autoZero"/><c:auto val="0"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`;
  const valAx = `<c:valAx><c:axId val="${VAL_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${horizontal ? "t" : "l"}"/>${gridLine}<c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${noLine}${AXIS_TEXT}<c:crossAx val="${CAT_AX_ID}"/><c:crosses val="${horizontal ? "max" : "autoZero"}"/><c:crossBetween val="between"/></c:valAx>`;
  const legend =
    chart.series.length > 1
      ? `<c:legend><c:legendPos val="b"/><c:overlay val="0"/>${AXIS_TEXT}</c:legend>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="${NS.c}" xmlns:a="${NS.a}" xmlns:r="${NS.r}"><c:roundedCorners val="0"/><c:chart><c:title><c:tx>${richText(spec.title, 1200, true)}</c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${bar}${line}${catAx}${valAx}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr></c:chartSpace>`;
}

function anchorXml(chart: PlacedChart, relId: string, id: number): string {
  const { col, row, cols, rows } = chart.anchor;
  return `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${col + cols}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row + rows}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id + 1}" name="${escapeXml(chart.spec.title.slice(0, 60) || `Gráfico ${id}`)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${NS.c}"><c:chart xmlns:c="${NS.c}" xmlns:r="${NS.r}" r:id="${relId}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
}

/** Hijos de `<worksheet>` que deben ir **después** de `<drawing>` en el esquema. */
const AFTER_DRAWING = [
  "<legacyDrawing",
  "<legacyDrawingHF",
  "<drawingHF",
  "<picture",
  "<oleObjects",
  "<controls",
  "<webPublishItems",
  "<tableParts",
  "<extLst",
];

/** Inserta `<drawing r:id="…"/>` en el lugar que exige el esquema. */
export function insertDrawingElement(sheetXml: string, relId: string): string {
  if (/<drawing\s/.test(sheetXml)) {
    throw new Error("La hoja ya tiene un dibujo");
  }
  let root = sheetXml;
  // El atributo `r:id` necesita el prefijo `r` declarado en la raíz.
  if (!/<worksheet[^>]*xmlns:r=/.test(root)) {
    root = root.replace(/<worksheet\b/, `<worksheet xmlns:r="${NS.r}"`);
  }
  const el = `<drawing r:id="${relId}"/>`;
  const positions = AFTER_DRAWING.map((tag) => root.indexOf(tag)).filter(
    (i) => i >= 0,
  );
  const at = positions.length
    ? Math.min(...positions)
    : root.lastIndexOf("</worksheet>");
  return root.slice(0, at) + el + root.slice(at);
}

/** Agrega una relación a un `.rels` (o crea el archivo), y devuelve su id. */
function addRelationship(
  relsXml: string | null,
  type: string,
  target: string,
): { xml: string; id: string } {
  const base =
    relsXml ??
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${NS.pkgRels}"></Relationships>`;
  const used = new Set(
    [...base.matchAll(/Id="([^"]+)"/g)].map((m) => m[1] as string),
  );
  let n = used.size + 1;
  while (used.has(`rId${n}`)) n++;
  const id = `rId${n}`;
  const xml = base.replace(
    "</Relationships>",
    `<Relationship Id="${id}" Type="${type}" Target="${target}"/></Relationships>`,
  );
  return { xml, id };
}

/** Nombre de hoja → ruta de su XML dentro del paquete (vía `workbook.xml` y sus rels). */
async function sheetPaths(zip: JSZip): Promise<Map<string, string>> {
  const workbook = await zip.file("xl/workbook.xml")!.async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
  const targets = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /Id="([^"]+)"/.exec(m[0])?.[1];
    const target = /Target="([^"]+)"/.exec(m[0])?.[1];
    if (id && target) {
      targets.set(
        id,
        target.startsWith("/")
          ? target.slice(1)
          : `xl/${target.replace(/^\.\//, "")}`,
      );
    }
  }
  const out = new Map<string, string>();
  for (const m of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const name = /name="([^"]*)"/.exec(m[0])?.[1];
    const rid = /r:id="([^"]+)"/.exec(m[0])?.[1];
    if (name != null && rid && targets.has(rid)) {
      out.set(unescapeXml(name), targets.get(rid)!);
    }
  }
  return out;
}

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Agrega los gráficos al .xlsx que armó ExcelJS y devuelve el paquete nuevo. */
export async function injectCharts(
  xlsx: Uint8Array | ArrayBuffer,
  charts: PlacedChart[],
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(xlsx);
  if (charts.length === 0) {
    return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  }
  const paths = await sheetPaths(zip);
  let contentTypes = await zip.file("[Content_Types].xml")!.async("string");
  const overrides: string[] = [];

  const bySheet = new Map<string, PlacedChart[]>();
  for (const c of charts) {
    bySheet.set(c.sheetName, [...(bySheet.get(c.sheetName) ?? []), c]);
  }

  let chartN = 0;
  let drawingN = 0;
  for (const [sheetName, list] of bySheet) {
    const sheetPath = paths.get(sheetName);
    if (!sheetPath) throw new Error(`No existe la hoja «${sheetName}»`);
    drawingN++;
    const drawingPath = `xl/drawings/drawing${drawingN}.xml`;

    let drawingRels: string | null = null;
    const anchors: string[] = [];
    list.forEach((chart, i) => {
      chartN++;
      zip.file(`xl/charts/chart${chartN}.xml`, chartXml(chart));
      overrides.push(
        `<Override PartName="/xl/charts/chart${chartN}.xml" ContentType="${NS.ctChart}"/>`,
      );
      const rel = addRelationship(
        drawingRels,
        NS.relChart,
        `../charts/chart${chartN}.xml`,
      );
      drawingRels = rel.xml;
      anchors.push(anchorXml(chart, rel.id, i + 1));
    });
    zip.file(
      drawingPath,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="${NS.xdr}" xmlns:a="${NS.a}">${anchors.join("")}</xdr:wsDr>`,
    );
    zip.file(`xl/drawings/_rels/drawing${drawingN}.xml.rels`, drawingRels!);
    overrides.push(
      `<Override PartName="/${drawingPath}" ContentType="${NS.ctDrawing}"/>`,
    );

    const dir = sheetPath.slice(0, sheetPath.lastIndexOf("/"));
    const file = sheetPath.slice(sheetPath.lastIndexOf("/") + 1);
    const sheetRelsPath = `${dir}/_rels/${file}.rels`;
    const existing = zip.file(sheetRelsPath);
    const rel = addRelationship(
      existing ? await existing.async("string") : null,
      NS.relDrawing,
      `../drawings/drawing${drawingN}.xml`,
    );
    zip.file(sheetRelsPath, rel.xml);
    const sheetXml = await zip.file(sheetPath)!.async("string");
    zip.file(sheetPath, insertDrawingElement(sheetXml, rel.id));
  }

  contentTypes = contentTypes.replace(
    "</Types>",
    `${overrides.join("")}</Types>`,
  );
  zip.file("[Content_Types].xml", contentTypes);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
