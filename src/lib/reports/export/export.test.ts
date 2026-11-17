import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { EventReport, EventsReport } from "@/lib/db/eventReports";
import type { ReportData } from "@/types/stats/report";
import { buildExportDocument, EVENT_PARTS } from "./build";
import { csvValue, documentToCsv, neutralizeFormula, quoteCsv } from "./csv";
import { periodTag, uniqueSheetName } from "./format";
import { exportQuery, parseExportRequest } from "./request";
import { documentToXlsx } from "./xlsx";
import { columnLetter, insertDrawingElement, rangeRef } from "./xlsx-charts";

// 2026-10-01 00:00 y 2026-10-31 23:59:59.999, hora de Argentina (UTC-3).
const OCT_FROM = Date.UTC(2026, 9, 1, 3);
const OCT_TO = Date.UTC(2026, 10, 1, 2, 59, 59, 999);
const NOW = Date.UTC(2026, 10, 17, 15);

const report: ReportData = {
  period: { from: OCT_FROM, to: OCT_TO },
  users: { newRegistrations: 4 },
  reservations: {
    total: 10,
    byStatus: { approved: 6, pending: 3, rejected: 1 },
    perResource: [
      {
        resourceType: "Coworking",
        count: 10,
        byStatus: { approved: 6, pending: 3, rejected: 1 },
      },
    ],
    durationStats: {
      overall: { total: 600, min: 30, avg: 60, max: 120 },
      perResource: [
        {
          resourceType: "Coworking",
          count: 6,
          totalMinutes: 600,
          minMinutes: 30,
          avgMinutes: 60,
          maxMinutes: 120,
        },
      ],
    },
  },
  daily: [
    {
      dateKey: "2026-10-01",
      reservations: 2,
      approved: 1,
      pending: 1,
      rejected: 0,
      cancelled: 0,
      newUsers: 1,
    },
    {
      dateKey: "2026-10-02",
      reservations: 1,
      approved: 1,
      pending: 0,
      rejected: 0,
      cancelled: 0,
      newUsers: 0,
    },
  ],
  coverage: { rawFromMs: 0, hasPrunedPortion: false, snapshots: [] },
};

const eventsReport: EventsReport = {
  period: { from: OCT_FROM, to: OCT_TO },
  totals: {
    events: 1,
    sessions: { held: 4, upcoming: 0, cancelled: 1 },
    registrations: {
      PENDING: 1,
      APPROVED: 8,
      REJECTED: 0,
      CANCELLED: 1,
      total: 10,
    },
    walkIns: 2,
    withAccount: 5,
    accountAfter: 1,
    approvalPct: null,
    selfCancelPct: 10,
    avgOccupancyPct: 45,
    checkIns: { registered: 20, walkIns: 3 },
    avgAttendancePct: 62,
    returning: 0,
  },
  byType: [{ typeName: "Taller", events: 1, sessions: 4 }],
  bySpace: [{ spaceName: "Laboratorio", events: 1, hours: 8 }],
  events: [
    {
      id: "ev1",
      name: "=Taller de Python",
      typeName: "Taller",
      spaceName: "Laboratorio",
      sessions: { held: 4, upcoming: 0, cancelled: 1 },
      capacity: 20,
      holding: 9,
      occupancyPct: 45,
      walkIns: 2,
      checkInEnabled: true,
      checkIns: { registered: 20, walkIns: 3 },
      attendancePct: 62,
    },
  ],
};

const eventReport: EventReport = {
  id: "ev1abcdefgh",
  name: "Taller de Python",
  typeName: "Taller",
  spaceName: "Laboratorio",
  status: "PUBLISHED",
  firstMs: Date.UTC(2026, 9, 5, 13),
  lastMs: Date.UTC(2026, 9, 26, 16),
  checkInEnabled: true,
  requiresApproval: false,
  sessions: { held: 4, upcoming: 0, cancelled: 1 },
  capacity: 20,
  holding: 9,
  occupancyPct: 45,
  byStatus: { PENDING: 1, APPROVED: 8, REJECTED: 0, CANCELLED: 1 },
  walkIns: 2,
  approvedRegistered: 8,
  withAccount: 5,
  accountAfter: 1,
  registrationWindow: null,
  curve: [
    { day: "2026-09-20", total: 3 },
    { day: "2026-09-21", total: 10 },
  ],
  attendance: [
    {
      occurrenceStart: Date.UTC(2026, 9, 5, 13),
      startMs: Date.UTC(2026, 9, 5, 13),
      endMs: Date.UTC(2026, 9, 5, 16),
      registered: 7,
      walkIns: 1,
    },
    {
      occurrenceStart: Date.UTC(2026, 9, 12, 13),
      startMs: Date.UTC(2026, 9, 12, 13),
      endMs: Date.UTC(2026, 9, 12, 16),
      registered: 5,
      walkIns: 2,
    },
  ],
  attendancePct: 75,
  choices: [
    {
      fieldId: "f1",
      label: "Institución",
      answered: 9,
      options: [
        { option: "UTN", count: 5 },
        { option: "UNER", count: 4 },
      ],
    },
    {
      fieldId: "f2",
      label: "Nivel",
      answered: 9,
      options: [{ option: "Inicial", count: 9 }],
    },
  ],
};

const fullDoc = () =>
  buildExportDocument({
    period: {
      report,
      events: eventsReport,
      sections: new Set(["reservations", "daily", "events"]),
    },
    events: [eventReport],
    parts: new Set(EVENT_PARTS),
    nowMs: NOW,
  });

describe("format", () => {
  it("periodTag usa mes, año o rango", () => {
    expect(periodTag(OCT_FROM, OCT_TO)).toBe("2026-10");
    expect(
      periodTag(Date.UTC(2025, 0, 1, 3), Date.UTC(2026, 0, 1, 2, 59)),
    ).toBe("2025");
    expect(periodTag(OCT_FROM, Date.UTC(2026, 9, 16, 2))).toBe(
      "2026-10-01_2026-10-15",
    );
  });

  it("uniqueSheetName limpia, recorta a 31 y desambigua", () => {
    const used = new Set<string>();
    expect(uniqueSheetName("Taller: Python [2026]", used)).toBe(
      "Taller Python 2026",
    );
    const long = "Un nombre de evento larguísimo que no entra";
    const a = uniqueSheetName(long, used);
    const b = uniqueSheetName(long, used);
    expect(a.length).toBeLessThanOrEqual(31);
    expect(b.length).toBeLessThanOrEqual(31);
    expect(b.endsWith(" (2)")).toBe(true);
  });
});

describe("build", () => {
  it("arma una hoja por bloque y por evento, cada tabla con su período o evento", () => {
    const doc = fullDoc();
    expect(doc.sheets.map((s) => s.name)).toEqual([
      "Reservas 2026-10",
      "Diario 2026-10",
      "Eventos 2026-10",
      "Taller de Python",
    ]);
    expect(doc.fileBase).toBe("lanube-reporte-2026-10");
    const perResource = doc.sheets[0].tables[0];
    expect(perResource.rows[0]).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-31",
      service: "Coworking",
      total: 10,
    });
    const ev = doc.sheets[3];
    expect(ev.tables.map((t) => t.title)).toEqual([
      "Asistencia por sesión",
      "Curva de inscripciones",
      "Institución",
      "Nivel",
    ]);
    expect(ev.tables[0].rows[0]).toMatchObject({
      event: "Taller de Python",
      registered: 7,
      total: 8,
      absent: 1,
    });
  });

  it("respeta las partes elegidas de un evento", () => {
    const doc = buildExportDocument({
      events: [eventReport],
      parts: new Set(["curve"]),
      nowMs: NOW,
    });
    expect(doc.sheets).toHaveLength(1);
    expect(doc.sheets[0].facts).toEqual([]);
    expect(doc.sheets[0].tables.map((t) => t.title)).toEqual([
      "Curva de inscripciones",
    ]);
    expect(doc.fileBase).toBe("lanube-evento-taller-de-python");
  });
});

describe("csv", () => {
  it("neutraliza fórmulas y entrecomilla lo necesario", () => {
    expect(neutralizeFormula("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(neutralizeFormula("-1")).toBe("'-1");
    expect(neutralizeFormula("Taller")).toBe("Taller");
    expect(quoteCsv('dice "hola", che')).toBe('"dice ""hola"", che"');
    expect(csvValue(-3, "int")).toBe("-3");
    expect(csvValue(Date.UTC(2026, 9, 5, 13), "datetime")).toBe(
      "2026-10-05 10:00",
    );
  });

  it("escribe un archivo por tabla y junta las respuestas de un evento", () => {
    const files = documentToCsv(fullDoc());
    const names = files.map((f) => f.name);
    expect(names).toContain("reservas-2026-10-resumen.csv");
    expect(names).toContain("actividad-diaria-2026-10.csv");
    expect(names.filter((n) => n.includes("respuestas"))).toHaveLength(1);
    const answers = files.find((f) => f.name.includes("respuestas"))!;
    expect(
      answers.content.startsWith("﻿Evento,Pregunta,Opción,Personas\r\n"),
    ).toBe(true);
    expect(answers.content.split("\r\n").filter(Boolean)).toHaveLength(4);
    const events = files.find(
      (f) => f.name === "eventos-por-evento-2026-10.csv",
    )!;
    expect(events.content).toContain(",'=Taller de Python,");
  });
});

describe("request", () => {
  it("lee y valida la query, ida y vuelta con exportQuery", () => {
    const q = exportQuery({
      format: "xlsx",
      period: { fromMs: OCT_FROM, toMs: OCT_TO },
      sections: ["reservations", "events"],
      eventIds: ["ev1", "ev2"],
      parts: ["summary"],
    });
    const parsed = parseExportRequest(new URLSearchParams(q));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.period).toEqual({ fromMs: OCT_FROM, toMs: OCT_TO });
    expect([...parsed.value.sections]).toEqual(["reservations", "events"]);
    expect(parsed.value.eventIds).toEqual(["ev1", "ev2"]);
    expect([...parsed.value.parts]).toEqual(["summary"]);
  });

  it("rechaza pedidos vacíos, desconocidos o sin período", () => {
    const bad = (q: string) =>
      parseExportRequest(new URLSearchParams(q)).ok === false;
    expect(bad("format=pdf&event=a")).toBe(true);
    expect(bad("format=csv")).toBe(true);
    expect(bad("format=csv&sections=daily")).toBe(true);
    expect(bad("format=csv&sections=nope&from=1&to=2")).toBe(true);
    expect(bad("format=csv&event=a&parts=nope")).toBe(true);
    expect(bad("format=csv&event=../x")).toBe(true);
    expect(bad(`format=csv&sections=daily&from=1&to=${400 * 86_400_000}`)).toBe(
      true,
    );
    expect(
      parseExportRequest(new URLSearchParams("format=csv&event=a")).ok,
    ).toBe(true);
  });
});

describe("xlsx", () => {
  it("helpers de referencias", () => {
    expect(columnLetter(1)).toBe("A");
    expect(columnLetter(28)).toBe("AB");
    expect(rangeRef("Hoja de Ana's", 2, 5, 9)).toBe(
      "'Hoja de Ana''s'!$B$5:$B$9",
    );
    expect(
      insertDrawingElement(
        '<worksheet xmlns:r="x"><sheetData/><pageMargins/><tableParts/></worksheet>',
        "rId3",
      ),
    ).toBe(
      '<worksheet xmlns:r="x"><sheetData/><pageMargins/><drawing r:id="rId3"/><tableParts/></worksheet>',
    );
  });

  it("arma un libro que ExcelJS vuelve a leer, con datos tipados y gráficos nativos", async () => {
    const bytes = await documentToXlsx(fullDoc());

    const zip = await JSZip.loadAsync(bytes);
    const charts = Object.keys(zip.files).filter((f) =>
      /^xl\/charts\/chart\d+\.xml$/.test(f),
    );
    // por servicio, diario, horas por espacio, asistencia, curva, 2 preguntas
    expect(charts).toHaveLength(7);
    const types = await zip.file("[Content_Types].xml")!.async("string");
    expect(types).toContain("/xl/charts/chart1.xml");
    expect(types).toContain("/xl/drawings/drawing1.xml");

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Índice",
      "Reservas 2026-10",
      "Diario 2026-10",
      "Eventos 2026-10",
      "Taller de Python",
    ]);
    const daily = wb.getWorksheet("Diario 2026-10")!;
    let dateCell: ExcelJS.Cell | null = null;
    daily.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value instanceof Date && !dateCell) dateCell = cell;
      });
    });
    expect(dateCell).not.toBeNull();
    expect((dateCell as unknown as ExcelJS.Cell).numFmt).toBe("dd/mm/yyyy");
    // Un texto que empieza con "=" es texto en la planilla, no una fórmula.
    const events = wb.getWorksheet("Eventos 2026-10")!;
    let found = false;
    events.eachRow((row) =>
      row.eachCell((cell) => {
        if (cell.value === "=Taller de Python") found = true;
      }),
    );
    expect(found).toBe(true);
  });
});
