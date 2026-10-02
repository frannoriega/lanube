import { describe, expect, it } from "vitest";
import {
  firstBookableDayIndex,
  isDayFullyBlocked,
  visibleDayCountFor,
  visibleDayIndices,
} from "./calendar-utils";

describe("visibleDayCountFor", () => {
  it("1 día en teléfono, 3 en sm, 5 desde md", () => {
    expect(visibleDayCountFor({ isSm: false, isMd: false })).toBe(1);
    expect(visibleDayCountFor({ isSm: true, isMd: false })).toBe(3);
    expect(visibleDayCountFor({ isSm: true, isMd: true })).toBe(5);
  });
});

describe("visibleDayIndices", () => {
  it("con 1 día muestra solo el enfocado", () => {
    expect(visibleDayIndices(1, 0)).toEqual([0]);
    expect(visibleDayIndices(1, 3)).toEqual([3]);
  });

  it("con 3 días centra el foco sin salirse de la semana", () => {
    expect(visibleDayIndices(3, 0)).toEqual([0, 1, 2]);
    expect(visibleDayIndices(3, 1)).toEqual([0, 1, 2]);
    expect(visibleDayIndices(3, 2)).toEqual([1, 2, 3]);
    expect(visibleDayIndices(3, 4)).toEqual([2, 3, 4]);
  });

  it("con 5 días muestra la semana entera sin importar el foco", () => {
    expect(visibleDayIndices(5, 0)).toEqual([0, 1, 2, 3, 4]);
    expect(visibleDayIndices(5, 4)).toEqual([0, 1, 2, 3, 4]);
  });

  it("acota un foco fuera de rango", () => {
    expect(visibleDayIndices(1, -2)).toEqual([0]);
    expect(visibleDayIndices(1, 9)).toEqual([4]);
  });
});

describe("firstBookableDayIndex / isDayFullyBlocked", () => {
  // Semana del lunes 5 al viernes 9 de octubre de 2026 (hora local).
  const week = [5, 6, 7, 8, 9].map((d) => new Date(2026, 9, d));

  it("el domingo anterior, el lunes ya es reservable", () => {
    const clock = new Date(2026, 9, 4, 10, 0);
    expect(firstBookableDayIndex(week, clock)).toBe(0);
  });

  it("el martes a la noche, miércoles queda bloqueado y abre en jueves", () => {
    // Martes 20:00: el último turno del miércoles (17:45) está a menos de 24h.
    const clock = new Date(2026, 9, 6, 20, 0);
    expect(isDayFullyBlocked(week[2], clock)).toBe(true);
    expect(firstBookableDayIndex(week, clock)).toBe(3);
  });

  it("devuelve -1 si toda la semana está bloqueada", () => {
    const clock = new Date(2026, 9, 9, 12, 0);
    expect(firstBookableDayIndex(week, clock)).toBe(-1);
  });
});
