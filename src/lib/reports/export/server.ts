import "server-only";
import JSZip from "jszip";
import { nowMs } from "@/lib/clock";
import { getReportForRange } from "@/lib/db/adminReports";
import {
  getEventReport,
  getEventsReport,
  type EventReport,
} from "@/lib/db/eventReports";
import { buildExportDocument } from "./build";
import { documentToCsv } from "./csv";
import type { ExportRequest } from "./request";
import { documentToXlsx } from "./xlsx";

/**
 * Arma el archivo de un pedido de exportación **en el mismo pedido** (sin cola): lee los
 * mismos reportes que la pantalla (`getReportForRange`, `getEventsReport`, `getEventReport`),
 * los pasa por `build.ts` y los escribe en el formato pedido.
 */

export interface ExportFile {
  body: Uint8Array;
  contentType: string;
  filename: string;
}

export class ExportNotFoundError extends Error {}

export async function generateReportExport(
  req: ExportRequest,
): Promise<ExportFile> {
  const now = nowMs();
  const { period, sections } = req;
  const needsReport =
    period && (sections.has("reservations") || sections.has("daily"));
  const needsEvents = period && sections.has("events");

  const [report, eventsReport, events] = await Promise.all([
    needsReport ? getReportForRange(period.fromMs, period.toMs) : undefined,
    needsEvents ? getEventsReport(period.fromMs, period.toMs) : undefined,
    // De a uno: cada reporte son ~3 consultas, y así un archivo con muchos eventos no ocupa
    // todas las conexiones del pool a la vez.
    (async () => {
      const out: EventReport[] = [];
      for (const id of req.eventIds) {
        const e = await getEventReport(id);
        if (!e) throw new ExportNotFoundError(id);
        out.push(e);
      }
      return out;
    })(),
  ]);

  const doc = buildExportDocument({
    period: period ? { report, events: eventsReport, sections } : undefined,
    events,
    parts: req.parts,
    nowMs: now,
  });

  if (req.format === "xlsx") {
    return {
      body: await documentToXlsx(doc),
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `${doc.fileBase}.xlsx`,
    };
  }

  const files = documentToCsv(doc);
  if (files.length === 1) {
    return {
      body: new TextEncoder().encode(files[0].content),
      contentType: "text/csv; charset=utf-8",
      filename: files[0].name,
    };
  }
  // Varias tablas = varios CSV: van juntos en un .zip (un CSV no tiene «hojas»).
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.content);
  return {
    body: await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
    }),
    contentType: "application/zip",
    filename: `${doc.fileBase}-csv.zip`,
  };
}
