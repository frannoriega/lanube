import { describe, expect, it } from "vitest";
import type { EventOccurrence } from "./occurrences";
import { joinSpanish, summarizeSchedule } from "./schedule-summary";

const TZ = "America/Argentina/Buenos_Aires";

/** Sesión de 3 h que empieza a las `hour` (hora argentina, UTC-3) del día dado. */
function occ(
  date: string,
  hour = 10,
  status: EventOccurrence["status"] = "scheduled",
): EventOccurrence {
  const startMs = Date.parse(
    `${date}T${String(hour).padStart(2, "0")}:00:00-03:00`,
  );
  return {
    reservationId: "r",
    occurrenceDateMs: startMs,
    startMs,
    endMs: startMs + 3 * 3_600_000,
    status,
    reason: null,
  };
}

describe("joinSpanish", () => {
  it("une con comas y una 'y' final", () => {
    expect(joinSpanish(["lunes"])).toBe("lunes");
    expect(joinSpanish(["lunes", "jueves"])).toBe("lunes y jueves");
    expect(joinSpanish(["lunes", "martes", "jueves"])).toBe(
      "lunes, martes y jueves",
    );
  });
});

describe("summarizeSchedule", () => {
  it("agrupa los días de una misma franja, lunes primero", () => {
    // 2026-04-13 es lunes, 2026-04-16 jueves, 2026-04-19 domingo.
    const s = summarizeSchedule(
      [occ("2026-04-19"), occ("2026-04-16"), occ("2026-04-13")],
      TZ,
    );
    expect(s.slots).toHaveLength(1);
    expect(s.slots[0].label).toBe("Lunes, jueves y domingo · 10:00 – 13:00");
    expect(s.total).toBe(3);
  });

  it("no cuenta las canceladas en el total ni en el rango", () => {
    const s = summarizeSchedule(
      [
        occ("2026-04-13", 10, "cancelled"),
        occ("2026-04-16"),
        occ("2026-05-25"),
      ],
      TZ,
    );
    expect(s.total).toBe(2);
    expect(s.cancelled).toBe(1);
    expect(s.rangeLabel).toBe("Del 16 abr al 25 may 2026");
  });

  it("separa franjas horarias distintas", () => {
    const s = summarizeSchedule(
      [occ("2026-04-13", 10), occ("2026-04-15", 18)],
      TZ,
    );
    expect(s.slots.map((x) => x.label)).toEqual([
      "Lunes · 10:00 – 13:00",
      "Miércoles · 18:00 – 21:00",
    ]);
  });

  it("muestra el año de inicio sólo si cambia", () => {
    const s = summarizeSchedule([occ("2026-12-14"), occ("2027-02-01")], TZ);
    expect(s.rangeLabel).toBe("Del 14 dic 2026 al 1 feb 2027");
  });

  it("una sola sesión es una fecha, no un rango", () => {
    const s = summarizeSchedule([occ("2026-04-13")], TZ);
    expect(s.rangeLabel).toBe("El 13 abr 2026");
  });

  it("sin sesiones no hay rango", () => {
    const s = summarizeSchedule([], TZ);
    expect(s).toMatchObject({ slots: [], total: 0, rangeLabel: null });
  });
});
