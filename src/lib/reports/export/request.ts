import {
  EVENT_PARTS,
  PERIOD_SECTIONS,
  type EventPart,
  type PeriodSection,
} from "./build";

/**
 * Qué se pidió exportar, leído de la query de `GET /api/admin/reports/export`. Puro y testeado
 * (`request.test.ts`).
 *
 *   ?format=xlsx|csv
 *   &from=<ms>&to=<ms>                    obligatorios si se pide algún bloque por período
 *   &sections=reservations,daily,events    bloques por período (de `/admin/reports`)
 *   &event=<id>&event=<id>…                eventos (toda su vida), hasta MAX_EXPORT_EVENTS
 *   &parts=summary,attendance,curve,choices  qué partes de cada evento (por defecto, todas)
 *
 * Es un GET (no un POST con cuerpo) a propósito: exportar no cambia nada, así que no se audita
 * ni lo frena el modo «solo lectura» del mantenimiento, y el pedido se puede repetir.
 */

export type ExportFormat = "xlsx" | "csv";

/** Mismo tope de período que los reportes en pantalla. */
export const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

/**
 * Tope de eventos por archivo. Con este número el archivo se arma holgado dentro de un pedido
 * (medido en el registro del milestone: ~3 consultas por evento y milisegundos de armado), así
 * que la exportación es **siempre en el momento**, sin cola ni email.
 */
export const MAX_EXPORT_EVENTS = 50;

export interface ExportRequest {
  format: ExportFormat;
  period: { fromMs: number; toMs: number } | null;
  sections: Set<PeriodSection>;
  eventIds: string[];
  parts: Set<EventPart>;
}

const ID_RE = /^[a-z0-9]{1,64}$/i;

function csvList(raw: string | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseExportRequest(
  sp: URLSearchParams,
): { ok: true; value: ExportRequest } | { ok: false; message: string } {
  const format = sp.get("format");
  if (format !== "xlsx" && format !== "csv") {
    return { ok: false, message: "Formato inválido: usá «xlsx» o «csv»" };
  }

  const sectionsRaw = csvList(sp.get("sections"));
  if (sectionsRaw.some((s) => !PERIOD_SECTIONS.includes(s as PeriodSection))) {
    return { ok: false, message: "Bloque del reporte desconocido" };
  }
  const sections = new Set(sectionsRaw as PeriodSection[]);

  const partsRaw = csvList(sp.get("parts"));
  if (partsRaw.some((p) => !EVENT_PARTS.includes(p as EventPart))) {
    return { ok: false, message: "Parte del reporte de evento desconocida" };
  }
  const parts = new Set(
    (partsRaw.length ? partsRaw : [...EVENT_PARTS]) as EventPart[],
  );

  const eventIds = [...new Set(sp.getAll("event"))];
  if (eventIds.some((id) => !ID_RE.test(id))) {
    return { ok: false, message: "Identificador de evento inválido" };
  }
  if (eventIds.length > MAX_EXPORT_EVENTS) {
    return {
      ok: false,
      message: `Se pueden exportar hasta ${MAX_EXPORT_EVENTS} eventos por archivo`,
    };
  }

  let period: ExportRequest["period"] = null;
  if (sections.size > 0) {
    const fromMs = Number(sp.get("from"));
    const toMs = Number(sp.get("to"));
    if (
      !Number.isInteger(fromMs) ||
      !Number.isInteger(toMs) ||
      fromMs <= 0 ||
      toMs <= 0
    ) {
      return {
        ok: false,
        message:
          "Parámetros inválidos: se requieren 'from' y 'to' como timestamps Unix en ms",
      };
    }
    if (fromMs > toMs) {
      return {
        ok: false,
        message:
          "La fecha de inicio debe ser anterior o igual a la fecha de fin",
      };
    }
    if (toMs - fromMs > MAX_RANGE_MS) {
      return { ok: false, message: "El rango máximo es de 366 días" };
    }
    period = { fromMs, toMs };
  }

  if (sections.size === 0 && eventIds.length === 0) {
    return { ok: false, message: "Elegí al menos un bloque para exportar" };
  }
  return { ok: true, value: { format, period, sections, eventIds, parts } };
}

/** La query de un pedido (lo arma el cliente; inversa de `parseExportRequest`). */
export function exportQuery(req: {
  format: ExportFormat;
  period?: { fromMs: number; toMs: number } | null;
  sections?: Iterable<PeriodSection>;
  eventIds?: Iterable<string>;
  parts?: Iterable<EventPart>;
}): string {
  const sp = new URLSearchParams({ format: req.format });
  const sections = [...(req.sections ?? [])];
  if (sections.length && req.period) {
    sp.set("from", String(req.period.fromMs));
    sp.set("to", String(req.period.toMs));
    sp.set("sections", sections.join(","));
  }
  for (const id of req.eventIds ?? []) sp.append("event", id);
  const parts = [...(req.parts ?? [])];
  if (parts.length) sp.set("parts", parts.join(","));
  return sp.toString();
}
