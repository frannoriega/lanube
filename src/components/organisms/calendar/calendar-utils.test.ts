import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";
import {
  daysWithinHorizon,
  firstBookableDayIndex,
  firstBookableWeekStart,
  getCurrentWorkWeekStart,
  horizonWeekStart,
  isDayBeyondHorizon,
  isDayFullyBlocked,
  isDayFullyClosed,
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

  it("el martes a la noche, el martes ya no tiene turnos pero el miércoles sí", () => {
    // Martes 20:00: pasó el último turno de hoy (18:45); mañana está entero por delante.
    const clock = new Date(2026, 9, 6, 20, 0);
    expect(isDayFullyBlocked(week[1], clock)).toBe(true);
    expect(isDayFullyBlocked(week[2], clock)).toBe(false);
    expect(firstBookableDayIndex(week, clock)).toBe(2);
  });

  it("hoy sigue abierto mientras quede algún turno", () => {
    expect(isDayFullyBlocked(week[1], new Date(2026, 9, 6, 18, 30))).toBe(
      false,
    );
    expect(isDayFullyBlocked(week[1], new Date(2026, 9, 6, 18, 46))).toBe(true);
  });

  it("devuelve -1 si toda la semana quedó atrás", () => {
    const clock = new Date(2026, 9, 9, 20, 0); // viernes tras el cierre
    expect(firstBookableDayIndex(week, clock)).toBe(-1);
  });
});

describe("getCurrentWorkWeekStart / firstBookableWeekStart", () => {
  const mon5 = new Date(2026, 9, 5);
  const mon12 = new Date(2026, 9, 12);

  it("de lunes a viernes es el lunes de esta semana; sábado y domingo, el siguiente", () => {
    expect(getCurrentWorkWeekStart(new Date(2026, 9, 6, 10))).toEqual(mon5); // martes
    expect(getCurrentWorkWeekStart(new Date(2026, 9, 8, 10))).toEqual(mon5); // jueves
    expect(getCurrentWorkWeekStart(new Date(2026, 9, 9, 10))).toEqual(mon5); // viernes
    expect(getCurrentWorkWeekStart(new Date(2026, 9, 10, 10))).toEqual(mon12); // sábado
    expect(getCurrentWorkWeekStart(new Date(2026, 9, 11, 10))).toEqual(mon12); // domingo
  });

  it("el jueves a la noche todavía queda el viernes: abre en esta semana", () => {
    expect(firstBookableWeekStart(new Date(2026, 9, 8, 20))).toEqual(mon5);
  });

  it("el viernes a la noche toda la semana quedó atrás: abre en la siguiente (hallazgo F)", () => {
    expect(firstBookableWeekStart(new Date(2026, 9, 9, 20))).toEqual(mon12);
  });
});

describe("isDayFullyClosed", () => {
  const day = new Date(2026, 9, 2); // vie 2 oct 2026, hora local
  const slot = (fromH: number, toH: number, kind = "closed") => ({
    kind,
    startTime: new Date(2026, 9, 2, fromH).getTime(),
    endTime: new Date(2026, 9, 2, toH).getTime(),
  });

  it("es true con un cierre de 08:00 a 19:00", () => {
    expect(isDayFullyClosed(day, [slot(8, 19)])).toBe(true);
  });

  it("es false con un cierre parcial", () => {
    expect(isDayFullyClosed(day, [slot(14, 18)])).toBe(false);
  });

  it("une cierres contiguos que juntos cubren el día", () => {
    expect(isDayFullyClosed(day, [slot(14, 19), slot(8, 14)])).toBe(true);
  });

  it("no lo cierra si queda un hueco entre dos cierres", () => {
    expect(isDayFullyClosed(day, [slot(9, 12), slot(14, 18)])).toBe(false);
  });

  it("ignora los tramos que no son cierres y los de otro día", () => {
    expect(isDayFullyClosed(day, [slot(9, 18, "resource_full")])).toBe(false);
    expect(isDayFullyClosed(new Date(2026, 9, 5), [slot(8, 19)])).toBe(false);
  });
});

describe("horizonte deslizante de 2 semanas en el calendario", () => {
  // Miércoles 7 de octubre de 2026: el último día reservable es el miércoles 21.
  const wed7 = new Date(2026, 9, 7, 10);
  const weekOf = (monday: Date) =>
    Array.from({ length: 5 }, (_, i) => addDays(monday, i));

  it("la última página es la semana del último día reservable", () => {
    expect(horizonWeekStart(wed7)).toEqual(new Date(2026, 9, 19));
  });

  it("de la última semana solo entran lunes a miércoles", () => {
    expect(daysWithinHorizon(weekOf(new Date(2026, 9, 19)), wed7)).toBe(3);
    expect(isDayBeyondHorizon(new Date(2026, 9, 21), wed7)).toBe(false);
    expect(isDayBeyondHorizon(new Date(2026, 9, 22), wed7)).toBe(true);
  });

  it("las semanas anteriores entran enteras", () => {
    expect(daysWithinHorizon(weekOf(new Date(2026, 9, 12)), wed7)).toBe(5);
  });

  it("un lunes la última página tiene un solo día", () => {
    const mon5 = new Date(2026, 9, 5, 10);
    expect(horizonWeekStart(mon5)).toEqual(new Date(2026, 9, 19));
    expect(daysWithinHorizon(weekOf(new Date(2026, 9, 19)), mon5)).toBe(1);
  });

  it("un sábado el último día cae en sábado: la última página es la de la semana de ese sábado, entera", () => {
    const sat10 = new Date(2026, 9, 10, 10); // último día: sábado 24
    expect(horizonWeekStart(sat10)).toEqual(new Date(2026, 9, 19));
    expect(daysWithinHorizon(weekOf(new Date(2026, 9, 19)), sat10)).toBe(5);
  });
});
