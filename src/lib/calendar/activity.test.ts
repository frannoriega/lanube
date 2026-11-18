import { describe, expect, it } from "vitest";
import {
  calendarNavigationEndMs,
  calendarRangeError,
  closureItems,
  maintenanceItems,
} from "./activity";

// Hora de Argentina = UTC-3.
const ar = (y: number, m: number, d: number, h = 0, mi = 0) =>
  Date.UTC(y, m - 1, d, h + 3, mi);

describe("rango del calendario", () => {
  const now = ar(2026, 11, 17, 12);

  it("llega hasta el fin del año próximo", () => {
    expect(calendarNavigationEndMs(now)).toBe(
      ar(2027, 12, 31, 23, 59) + 59_999,
    );
  });

  it("valida rangos", () => {
    expect(
      calendarRangeError(ar(2026, 11, 1), ar(2026, 12, 12), now),
    ).toBeNull();
    expect(calendarRangeError(ar(2026, 11, 1), ar(2026, 12, 20), now)).toMatch(
      /45 días/,
    );
    expect(calendarRangeError(ar(2028, 1, 1), ar(2028, 1, 7), now)).toMatch(
      /año próximo/,
    );
    expect(calendarRangeError(5, 3, now)).not.toBeNull();
    expect(calendarRangeError(NaN, 3, now)).not.toBeNull();
  });
});

describe("closureItems", () => {
  const base = { id: "c", title: "Feriado" };

  it("un cierre de día completo es un solo ítem recortado a la ventana", () => {
    const [item] = closureItems(
      [
        {
          ...base,
          startDate: "2026-11-20",
          endDate: "2026-11-30",
          startTime: null,
          endTime: null,
        },
      ],
      ar(2026, 11, 23),
      ar(2026, 11, 29, 23, 59),
    );
    expect(item).toMatchObject({
      allDay: true,
      startMs: ar(2026, 11, 23),
      title: "Feriado",
    });
  });

  it("uno con franja da un ítem por día", () => {
    const items = closureItems(
      [
        {
          ...base,
          startDate: "2026-11-23",
          endDate: "2026-11-24",
          startTime: 14 * 60,
          endTime: 18 * 60,
        },
      ],
      ar(2026, 11, 23),
      ar(2026, 11, 29, 23, 59),
    );
    expect(items.map((i) => [i.startMs, i.endMs])).toEqual([
      [ar(2026, 11, 23, 14), ar(2026, 11, 23, 18)],
      [ar(2026, 11, 24, 14), ar(2026, 11, 24, 18)],
    ]);
    expect(items[0].detail).toBe("Cerrado de 14:00 a 18:00");
  });
});

describe("maintenanceItems", () => {
  const w = {
    id: "w",
    title: "Migración",
    mode: "READ_ONLY" as const,
    createdAt: 0,
  };

  it("usa endedAt si terminó antes y descarta las que no tocan la ventana", () => {
    const items = maintenanceItems(
      [
        { ...w, startsAt: 100, endsAt: 500, endedAt: 300 },
        { ...w, id: "x", startsAt: 900, endsAt: 1000, endedAt: null },
      ],
      200,
      800,
      250,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      startMs: 200,
      endMs: 300,
      detail: "Solo lectura",
    });
  });

  it("una sin fin vigente llega al final de la ventana", () => {
    const [item] = maintenanceItems(
      [{ ...w, startsAt: null, endsAt: null, endedAt: null, createdAt: 100 }],
      200,
      800,
      300,
    );
    expect(item).toMatchObject({ startMs: 200, endMs: 800 });
  });
});
