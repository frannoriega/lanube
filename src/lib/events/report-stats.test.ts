import { describe, expect, it } from "vitest";
import type { FormSchema } from "./form-schema";
import type { EventOccurrence } from "./occurrences";
import {
  attendanceBySession,
  choiceDistributions,
  countSessions,
  percent,
  registrationCurve,
} from "./report-stats";

const at = (day: string, time = "10:00") =>
  new Date(`${day}T${time}:00-03:00`).getTime();

function occ(
  day: string,
  status: EventOccurrence["status"] = "scheduled",
): EventOccurrence {
  return {
    reservationId: "r",
    occurrenceDateMs: at(day),
    nominalEndMs: at(day, "12:00"),
    startMs: at(day),
    endMs: at(day, "12:00"),
    status,
    reason: null,
  };
}

describe("countSessions", () => {
  it("separa realizadas, por venir y canceladas dentro del período", () => {
    const now = at("2026-11-17", "11:00");
    const r = countSessions(
      [
        occ("2026-10-27"), // fuera del período
        occ("2026-11-03"),
        occ("2026-11-10", "cancelled"),
        occ("2026-11-17"), // en curso
        occ("2026-11-24"),
      ],
      at("2026-11-01", "00:00"),
      at("2026-11-30", "23:59"),
      now,
    );
    expect(r).toEqual({ held: 1, upcoming: 2, cancelled: 1 });
  });
});

describe("attendanceBySession", () => {
  it("cuenta inscriptos y sin inscripción por sesión, solo las que empezaron", () => {
    const now = at("2026-11-17", "11:00");
    const rows = attendanceBySession(
      [
        occ("2026-11-03"),
        occ("2026-11-10", "cancelled"),
        occ("2026-11-17"),
        occ("2026-11-24"),
      ],
      [
        { occurrenceStart: at("2026-11-03"), walkIn: false },
        { occurrenceStart: at("2026-11-03"), walkIn: true },
        { occurrenceStart: at("2026-11-17"), walkIn: false },
      ],
      now,
    );
    expect(rows.map((r) => [r.startMs, r.registered, r.walkIns])).toEqual([
      [at("2026-11-03"), 1, 1],
      [at("2026-11-17"), 1, 0],
    ]);
  });

  it("una sesión que solo sobrevive en sus ingresos sigue en el gráfico", () => {
    const rows = attendanceBySession(
      [],
      [{ occurrenceStart: at("2025-01-06"), walkIn: false }],
      at("2026-11-17"),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].registered).toBe(1);
  });
});

describe("registrationCurve", () => {
  it("acumula por día del predio y rellena los días vacíos", () => {
    const curve = registrationCurve([
      at("2026-11-01", "09:00"),
      at("2026-11-01", "23:30"), // sigue siendo el 1 en Argentina (ya es 2 en UTC)
      at("2026-11-03", "10:00"),
    ]);
    expect(curve).toEqual([
      { day: "2026-11-01", total: 2 },
      { day: "2026-11-02", total: 2 },
      { day: "2026-11-03", total: 3 },
    ]);
  });
  it("sin inscripciones, vacía", () => {
    expect(registrationCurve([])).toEqual([]);
  });
});

describe("choiceDistributions", () => {
  const schema: FormSchema = {
    version: 1,
    nodes: [
      {
        kind: "input",
        id: "inst",
        type: "SINGLE_SELECT",
        label: "Institución",
        required: true,
        options: ["UTN", "UADER"],
      },
      {
        kind: "input",
        id: "temas",
        type: "MULTI_SELECT",
        label: "Temas",
        required: false,
        options: ["IA", "Web"],
      },
      {
        kind: "input",
        id: "foto",
        type: "BOOLEAN",
        label: "Acepta fotos",
        required: false,
      },
      {
        kind: "input",
        id: "nombre",
        type: "SHORT_TEXT",
        label: "Nombre",
        required: true,
      },
    ],
  };

  it("cuenta cada opción en el orden del formulario, más las que ya no existen", () => {
    const d = choiceDistributions(schema, [
      { inst: "UTN", temas: ["IA", "Web"], foto: true },
      { inst: "UTN", temas: ["IA"], foto: false },
      { inst: "Otra", foto: true },
      {},
    ]);
    expect(d.map((x) => x.label)).toEqual([
      "Institución",
      "Temas",
      "Acepta fotos",
    ]);
    expect(d[0]).toMatchObject({
      answered: 3,
      options: [
        { option: "UTN", count: 2 },
        { option: "UADER", count: 0 },
        { option: "Otra", count: 1 },
      ],
    });
    expect(d[1].options).toEqual([
      { option: "IA", count: 2 },
      { option: "Web", count: 1 },
    ]);
    expect(d[2].options).toEqual([
      { option: "Sí", count: 2 },
      { option: "No", count: 1 },
    ]);
  });
});

describe("percent", () => {
  it("redondea y devuelve null sin denominador", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBeNull();
  });
});
