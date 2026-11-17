import { dateKeyFromUnixMs } from "@/lib/admin/admin-timezone";
import {
  EVENT_STATUS_LABELS,
  eventDisplayStatus,
} from "@/lib/constants/events";
import type { EventReport, EventsReport } from "@/lib/db/eventReports";
import type { ReportData } from "@/types/stats/report";
import { displayDateKey, periodTag, uniqueSheetName } from "./format";
import type {
  CellValue,
  ColumnKind,
  ExportColumn,
  ExportDocument,
  ExportFact,
  ExportSheet,
  ExportTable,
} from "./model";

/**
 * Traduce los reportes al modelo de exportación (`model.ts`). Puro: recibe los reportes ya
 * calculados — los mismos objetos que dibuja la pantalla — y el "ahora". Testeado en
 * `build.test.ts`.
 */

/** Bloques por período que se pueden elegir en `/admin/reports`. */
export const PERIOD_SECTIONS = ["reservations", "daily", "events"] as const;
export type PeriodSection = (typeof PERIOD_SECTIONS)[number];

/** Partes del reporte de cada evento. */
export const EVENT_PARTS = [
  "summary",
  "attendance",
  "curve",
  "choices",
] as const;
export type EventPart = (typeof EVENT_PARTS)[number];

/** Etiquetas de la pantalla de exportación (y de la portada del Excel). */
export const PERIOD_SECTION_LABELS: Record<PeriodSection, string> = {
  reservations: "Usuarios y reservas",
  daily: "Actividad diaria",
  events: "Eventos del período",
};
export const EVENT_PART_LABELS: Record<EventPart, string> = {
  summary: "Ficha y resumen",
  attendance: "Asistencia por sesión",
  curve: "Curva de inscripciones",
  choices: "Respuestas de opciones",
};

/**
 * Colores de los gráficos de Excel (skill de dataviz, sobre fondo blanco):
 * - estados de reserva → paleta de **estado** de referencia (bueno / advertencia / crítico),
 *   como en pantalla (verde / amarillo / rojo), con la leyenda y la tabla al lado;
 * - series de eventos → posiciones 1 y 2 de la paleta categórica (azul, naranja), las mismas
 *   del reporte por evento en pantalla; validadas con `validate_palette.js --mode light`
 *   (todo PASS, ΔE daltonismo 24.7);
 * - líneas de referencia (aprobados, cupo) → gris neutro punteado.
 */
export const CHART_COLORS = {
  approved: "0CA30C",
  pending: "FAB219",
  rejected: "D03B3B",
  blue: "2A78D6",
  orange: "EB6834",
  reference: "6B6B6B",
} as const;

const col = (key: string, label: string, kind: ColumnKind): ExportColumn => ({
  key,
  label,
  kind,
});

/** Columnas `Desde`/`Hasta` que encabezan toda tabla por período. */
const PERIOD_COLUMNS = [
  col("from", "Desde", "date"),
  col("to", "Hasta", "date"),
];

function periodCells(fromMs: number, toMs: number) {
  return { from: dateKeyFromUnixMs(fromMs), to: dateKeyFromUnixMs(toMs) };
}

function periodContext(fromMs: number, toMs: number) {
  const p = periodCells(fromMs, toMs);
  return [
    { key: "from", label: "Desde", kind: "date" as const, value: p.from },
    { key: "to", label: "Hasta", kind: "date" as const, value: p.to },
  ];
}

function periodLabel(fromMs: number, toMs: number): string {
  return `${displayDateKey(dateKeyFromUnixMs(fromMs))} — ${displayDateKey(dateKeyFromUnixMs(toMs))}`;
}

const fact = (
  label: string,
  value: CellValue,
  kind: ColumnKind = "int",
  hint?: string,
): ExportFact => ({ label, value, kind, hint });

// ───────────────────────────── Usuarios y reservas ─────────────────────────────

function reservationsSheet(report: ReportData, used: Set<string>): ExportSheet {
  const { from: fromMs, to: toMs } = report.period;
  const tag = periodTag(fromMs, toMs);
  const p = periodCells(fromMs, toMs);
  const cmp = report.comparison;
  const prev = (n: number | undefined) =>
    n === undefined ? undefined : `Período anterior: ${n}`;
  const r = report.reservations;

  const perResource: ExportTable = {
    csvName: `reservas-por-servicio-${tag}`,
    title: "Reservas por servicio",
    note: "Cada ocurrencia de una reserva recurrente cuenta en el período en que ocurre.",
    columns: [
      ...PERIOD_COLUMNS,
      col("service", "Servicio", "text"),
      col("total", "Total", "int"),
      col("approved", "Aprobadas", "int"),
      col("pending", "Pendientes", "int"),
      col("rejected", "Rechazadas", "int"),
    ],
    rows: r.perResource.map((x) => ({
      ...p,
      service: x.resourceType,
      total: x.count,
      approved: x.byStatus.approved,
      pending: x.byStatus.pending,
      rejected: x.byStatus.rejected,
    })),
    chart:
      r.perResource.length > 0
        ? {
            type: "stacked",
            title: "Reservas por servicio",
            category: "service",
            series: [
              { key: "approved", color: CHART_COLORS.approved },
              { key: "pending", color: CHART_COLORS.pending },
              { key: "rejected", color: CHART_COLORS.rejected },
            ],
          }
        : undefined,
  };

  const d = r.durationStats;
  const durations: ExportTable = {
    csvName: `reservas-duracion-${tag}`,
    title: "Duración de las reservas aprobadas (minutos)",
    columns: [
      ...PERIOD_COLUMNS,
      col("service", "Servicio", "text"),
      col("total", "Total (min)", "int"),
      col("min", "Mínima (min)", "int"),
      col("avg", "Promedio (min)", "int"),
      col("max", "Máxima (min)", "int"),
    ],
    rows: [
      ...(d.overall
        ? [
            {
              ...p,
              service: "General",
              total: d.overall.total,
              min: d.overall.min,
              avg: d.overall.avg,
              max: d.overall.max,
            },
          ]
        : []),
      ...[...d.perResource]
        .sort((a, b) => b.count - a.count)
        .map((x) => ({
          ...p,
          service: x.resourceType,
          total: x.totalMinutes,
          min: x.minMinutes,
          avg: x.avgMinutes,
          max: x.maxMinutes,
        })),
    ],
  };

  return {
    name: uniqueSheetName(`Reservas ${tag}`, used),
    title: "Usuarios y reservas",
    subtitle: `Período: ${periodLabel(fromMs, toMs)}${
      report.coverage.hasPrunedPortion
        ? ` · Las reservas anteriores al ${displayDateKey(dateKeyFromUnixMs(report.coverage.rawFromMs))} ya no tienen detalle y no están contadas.`
        : ""
    }`,
    csvPrefix: `reservas-${tag}`,
    factContext: periodContext(fromMs, toMs),
    facts: [
      fact(
        "Nuevos registros de usuarios",
        report.users.newRegistrations,
        "int",
        prev(cmp?.users.newRegistrations),
      ),
      fact("Reservas", r.total, "int", prev(cmp?.reservations.total)),
      fact(
        "Aprobadas",
        r.byStatus.approved,
        "int",
        prev(cmp?.reservations.byStatus.approved),
      ),
      fact(
        "Pendientes",
        r.byStatus.pending,
        "int",
        prev(cmp?.reservations.byStatus.pending),
      ),
      fact(
        "Rechazadas",
        r.byStatus.rejected,
        "int",
        prev(cmp?.reservations.byStatus.rejected),
      ),
    ],
    tables: [perResource, durations],
  };
}

function dailySheet(report: ReportData, used: Set<string>): ExportSheet {
  const { from: fromMs, to: toMs } = report.period;
  const tag = periodTag(fromMs, toMs);
  return {
    name: uniqueSheetName(`Diario ${tag}`, used),
    title: "Actividad diaria",
    subtitle: `Período: ${periodLabel(fromMs, toMs)}`,
    csvPrefix: `diario-${tag}`,
    factContext: [],
    facts: [],
    tables: [
      {
        csvName: `actividad-diaria-${tag}`,
        title: "Reservas y registros por día",
        note: "Una fila por día del período (hora de Argentina). La fecha ya identifica el período: estas filas se pueden pegar debajo de las de otro mes.",
        columns: [
          col("date", "Fecha", "date"),
          col("reservations", "Reservas", "int"),
          col("approved", "Aprobadas", "int"),
          col("pending", "Pendientes", "int"),
          col("rejected", "Rechazadas", "int"),
          col("cancelled", "Canceladas", "int"),
          col("newUsers", "Usuarios nuevos", "int"),
        ],
        rows: report.daily.map((x) => ({
          date: x.dateKey,
          reservations: x.reservations,
          approved: x.approved,
          pending: x.pending,
          rejected: x.rejected,
          cancelled: x.cancelled,
          newUsers: x.newUsers,
        })),
        chart:
          report.daily.length > 0
            ? {
                type: "stacked",
                title: "Reservas por día",
                category: "date",
                series: [
                  { key: "approved", color: CHART_COLORS.approved },
                  { key: "pending", color: CHART_COLORS.pending },
                  { key: "rejected", color: CHART_COLORS.rejected },
                ],
              }
            : undefined,
      },
    ],
  };
}

// ───────────────────────────── Eventos del período ─────────────────────────────

function eventsPeriodSheet(
  events: EventsReport,
  used: Set<string>,
): ExportSheet {
  const { from: fromMs, to: toMs } = events.period;
  const tag = periodTag(fromMs, toMs);
  const p = periodCells(fromMs, toMs);
  const t = events.totals;
  return {
    name: uniqueSheetName(`Eventos ${tag}`, used),
    title: "Eventos del período",
    subtitle: `Período: ${periodLabel(fromMs, toMs)} · Una sesión cuenta en el período en que empieza.`,
    csvPrefix: `eventos-${tag}`,
    factContext: periodContext(fromMs, toMs),
    facts: [
      fact(
        "Eventos con sesiones",
        t.events,
        "int",
        `${t.sessions.held} sesiones realizadas · ${t.sessions.upcoming} por venir · ${t.sessions.cancelled} canceladas`,
      ),
      fact("Sesiones realizadas", t.sessions.held),
      fact("Sesiones por venir", t.sessions.upcoming),
      fact("Sesiones canceladas", t.sessions.cancelled),
      fact("Inscripciones", t.registrations.total),
      fact("Inscripciones aprobadas", t.registrations.APPROVED),
      fact("Inscripciones pendientes", t.registrations.PENDING),
      fact("Inscripciones rechazadas", t.registrations.REJECTED),
      fact(
        "Inscripciones canceladas por la persona",
        t.registrations.CANCELLED,
      ),
      fact("Registrados sin inscripción", t.walkIns),
      fact(
        "Inscriptos con cuenta en La Nube",
        t.withAccount,
        "int",
        `${t.accountAfter} la crearon después de inscribirse`,
      ),
      fact("Ingresos de inscriptos", t.checkIns.registered),
      fact("Ingresos sin inscripción", t.checkIns.walkIns),
      fact(
        "Asistencia promedio",
        t.avgAttendancePct,
        "pct",
        "Inscriptos que ingresaron ÷ inscriptos aprobados hoy",
      ),
      fact("Ocupación promedio", t.avgOccupancyPct, "pct"),
      fact(
        "Tasa de aprobación",
        t.approvalPct,
        "pct",
        "Solo eventos con aprobación manual",
      ),
      fact("Cancelación propia", t.selfCancelPct, "pct"),
      fact(
        "Personas que vuelven",
        t.returning,
        "int",
        "Inscriptas en más de un evento del período",
      ),
    ],
    tables: [
      {
        csvName: `eventos-por-evento-${tag}`,
        title: "Por evento",
        columns: [
          ...PERIOD_COLUMNS,
          col("event", "Evento", "text"),
          col("type", "Tipo", "text"),
          col("space", "Espacio", "text"),
          col("held", "Sesiones realizadas", "int"),
          col("upcoming", "Sesiones por venir", "int"),
          col("cancelled", "Sesiones canceladas", "int"),
          col("capacity", "Cupo", "int"),
          col("holding", "Ocupan lugar", "int"),
          col("occupancy", "Ocupación (%)", "pct"),
          col("checkInsRegistered", "Ingresos de inscriptos", "int"),
          col("checkInsWalkIns", "Ingresos sin inscripción", "int"),
          col("attendance", "Asistencia (%)", "pct"),
        ],
        rows: events.events.map((e) => ({
          ...p,
          event: e.name,
          type: e.typeName,
          space: e.spaceName,
          held: e.sessions.held,
          upcoming: e.sessions.upcoming,
          cancelled: e.sessions.cancelled,
          capacity: e.capacity,
          holding: e.holding,
          occupancy: e.occupancyPct,
          checkInsRegistered: e.checkIns.registered,
          checkInsWalkIns: e.checkIns.walkIns,
          attendance: e.attendancePct,
        })),
      },
      {
        csvName: `eventos-por-tipo-${tag}`,
        title: "Por tipo de evento",
        columns: [
          ...PERIOD_COLUMNS,
          col("type", "Tipo", "text"),
          col("events", "Eventos", "int"),
          col("sessions", "Sesiones", "int"),
        ],
        rows: events.byType.map((x) => ({
          ...p,
          type: x.typeName,
          events: x.events,
          sessions: x.sessions,
        })),
      },
      {
        csvName: `eventos-por-espacio-${tag}`,
        title: "Por espacio",
        note: "Horas de sesiones de eventos (no incluye reservas de personas).",
        columns: [
          ...PERIOD_COLUMNS,
          col("space", "Espacio", "text"),
          col("events", "Eventos", "int"),
          col("hours", "Horas", "decimal"),
        ],
        rows: events.bySpace.map((x) => ({
          ...p,
          space: x.spaceName,
          events: x.events,
          hours: x.hours,
        })),
        chart:
          events.bySpace.length > 0
            ? {
                type: "bar",
                title: "Horas de eventos por espacio",
                category: "space",
                series: [{ key: "hours", color: CHART_COLORS.blue }],
              }
            : undefined,
      },
    ],
  };
}

// ───────────────────────────── Un evento ─────────────────────────────

function eventSheet(
  e: EventReport,
  parts: ReadonlySet<EventPart>,
  nowMs: number,
  used: Set<string>,
): ExportSheet {
  const registrations =
    e.byStatus.PENDING +
    e.byStatus.APPROVED +
    e.byStatus.REJECTED +
    e.byStatus.CANCELLED;
  const status =
    EVENT_STATUS_LABELS[eventDisplayStatus(e.status, e.lastMs, nowMs)];
  // Cada fila lleva el evento: así las tablas de varios eventos se pueden juntar en una.
  const ev = { event: e.name };
  const eventCol = col("event", "Evento", "text");
  const slug = e.id.slice(0, 8);
  const tables: ExportTable[] = [];

  if (parts.has("attendance") && (e.checkInEnabled || e.attendance.length)) {
    tables.push({
      csvName: `evento-${slug}-asistencia`,
      title: "Asistencia por sesión",
      note: `La referencia son los inscriptos aprobados hoy (${e.approvedRegistered}): el estado de una inscripción no tiene historia.`,
      columns: [
        eventCol,
        col("session", "Sesión", "datetime"),
        col("registered", "Inscriptos que ingresaron", "int"),
        col("walkIns", "Sin inscripción", "int"),
        col("total", "Total de ingresos", "int"),
        col("approved", "Inscriptos aprobados", "int"),
        col("absent", "Ausentes", "int"),
      ],
      rows: e.attendance.map((a) => ({
        ...ev,
        session: a.startMs,
        registered: a.registered,
        walkIns: a.walkIns,
        total: a.registered + a.walkIns,
        approved: e.approvedRegistered,
        absent: Math.max(0, e.approvedRegistered - a.registered),
      })),
      chart: e.attendance.length
        ? {
            type: "stacked",
            title: "Asistencia por sesión",
            category: "session",
            series: [
              { key: "registered", color: CHART_COLORS.blue },
              { key: "walkIns", color: CHART_COLORS.orange },
              {
                key: "approved",
                color: CHART_COLORS.reference,
                line: true,
                dashed: true,
              },
            ],
          }
        : undefined,
    });
  }

  if (parts.has("curve")) {
    tables.push({
      csvName: `evento-${slug}-inscripciones`,
      title: "Curva de inscripciones",
      note: "Inscripciones acumuladas al cierre de cada día (por el formulario; no incluye a quienes llegaron sin inscripción).",
      columns: [
        eventCol,
        col("day", "Fecha", "date"),
        col("total", "Inscripciones (acumulado)", "int"),
        col("capacity", "Cupo", "int"),
      ],
      rows: e.curve.map((c) => ({
        ...ev,
        day: c.day,
        total: c.total,
        capacity: e.capacity,
      })),
      chart: e.curve.length
        ? {
            type: "line",
            title: "Inscripciones acumuladas",
            category: "day",
            series: [
              { key: "total", color: CHART_COLORS.blue },
              ...(e.capacity != null
                ? [
                    {
                      key: "capacity",
                      color: CHART_COLORS.reference,
                      dashed: true,
                    },
                  ]
                : []),
            ],
          }
        : undefined,
    });
  }

  if (parts.has("choices")) {
    for (const c of e.choices) {
      tables.push({
        csvName: `evento-${slug}-respuestas`,
        title: c.label,
        note: `${c.answered} personas respondieron. Cuentan quienes ocupan lugar (pendientes y aprobados).`,
        columns: [
          eventCol,
          col("question", "Pregunta", "text"),
          col("option", "Opción", "text"),
          col("count", "Personas", "int"),
        ],
        rows: c.options.map((o) => ({
          ...ev,
          question: c.label,
          option: o.option,
          count: o.count,
        })),
        chart: c.options.length
          ? {
              type: "bar",
              title: c.label,
              category: "option",
              series: [{ key: "count", color: CHART_COLORS.blue }],
            }
          : undefined,
      });
    }
  }

  return {
    name: uniqueSheetName(e.name, used),
    title: e.name,
    subtitle: `${e.typeName} · ${e.spaceName} · ${displayDateKey(dateKeyFromUnixMs(e.firstMs))} — ${displayDateKey(dateKeyFromUnixMs(e.lastMs))} · Toda la vida del evento`,
    csvPrefix: `evento-${slug}`,
    factContext: [
      { key: "event", label: "Evento", kind: "text", value: e.name },
    ],
    facts: parts.has("summary")
      ? [
          fact("Estado", status, "text"),
          fact("Tipo", e.typeName, "text"),
          fact("Espacio", e.spaceName, "text"),
          fact("Primera sesión", dateKeyFromUnixMs(e.firstMs), "date"),
          fact("Última sesión", dateKeyFromUnixMs(e.lastMs), "date"),
          fact("Sesiones realizadas", e.sessions.held),
          fact("Sesiones por venir", e.sessions.upcoming),
          fact("Sesiones canceladas", e.sessions.cancelled),
          fact("Cupo", e.capacity),
          fact("Ocupan lugar", e.holding),
          fact("Ocupación", e.occupancyPct, "pct"),
          fact("Inscripciones", registrations),
          fact("Aprobadas", e.byStatus.APPROVED),
          fact("Pendientes", e.byStatus.PENDING),
          fact("Rechazadas", e.byStatus.REJECTED),
          fact("Canceladas por la persona", e.byStatus.CANCELLED),
          fact("Registrados sin inscripción", e.walkIns),
          fact(
            "Asistencia promedio",
            e.attendancePct,
            "pct",
            "Inscriptos que ingresaron ÷ inscriptos aprobados hoy, en las sesiones realizadas",
          ),
          fact(
            "Con cuenta en La Nube",
            e.withAccount,
            "int",
            `${e.accountAfter} la crearon después de inscribirse`,
          ),
          ...(e.registrationWindow
            ? [
                fact(
                  "Inscripción abre",
                  e.registrationWindow.opensAt,
                  "datetime",
                ),
                fact(
                  "Inscripción cierra",
                  e.registrationWindow.closesAt,
                  "datetime",
                ),
              ]
            : []),
        ]
      : [],
    tables,
  };
}

// ───────────────────────────── Documento ─────────────────────────────

export interface BuildExportInput {
  /** Reportes por período (de `/admin/reports`), si se pidió algún bloque por período. */
  period?: {
    report?: ReportData;
    events?: EventsReport;
    sections: ReadonlySet<PeriodSection>;
  };
  /** Reportes de eventos (toda su vida), en el orden en que se muestran. */
  events: EventReport[];
  parts: ReadonlySet<EventPart>;
  nowMs: number;
}

export function buildExportDocument(input: BuildExportInput): ExportDocument {
  const used = new Set<string>();
  const sheets: ExportSheet[] = [];
  const { period } = input;
  const range = period?.report?.period ?? period?.events?.period;

  if (period?.report && period.sections.has("reservations")) {
    sheets.push(reservationsSheet(period.report, used));
  }
  if (period?.report && period.sections.has("daily")) {
    sheets.push(dailySheet(period.report, used));
  }
  if (period?.events && period.sections.has("events")) {
    sheets.push(eventsPeriodSheet(period.events, used));
  }
  for (const e of input.events) {
    sheets.push(eventSheet(e, input.parts, input.nowMs, used));
  }

  const single = !range && input.events.length === 1 ? input.events[0] : null;
  return {
    title: single
      ? `Reporte del evento — La Nube`
      : "Reporte de actividad — La Nube",
    scope: range
      ? `Período: ${periodLabel(range.from, range.to)}`
      : single
        ? single.name
        : `${input.events.length} eventos`,
    generatedAtMs: input.nowMs,
    fileBase: range
      ? `lanube-reporte-${periodTag(range.from, range.to)}`
      : single
        ? `lanube-evento-${slugForFile(single.name)}`
        : `lanube-eventos-${dateKeyFromUnixMs(input.nowMs)}`,
    sheets,
  };
}

function slugForFile(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "evento"
  );
}
