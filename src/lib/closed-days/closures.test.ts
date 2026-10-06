import { describe, expect, it } from "vitest";
import { startOfDateKeyMs } from "@/lib/admin/admin-timezone";
import {
  closureIntervalOnDay,
  closureRejectionMessage,
  closureSlotsForRange,
  closureWindowLabel,
  findClosureForWindow,
  formatMinutes,
  type ClosureLike,
} from "./closures";

const HOUR = 3_600_000;
const at = (dateKey: string, hour: number) =>
  startOfDateKeyMs(dateKey) + hour * HOUR;

const fullDay = (startDate: string, endDate = startDate): ClosureLike => ({
  title: "Feriado",
  startDate,
  endDate,
  startTime: null,
  endTime: null,
});

const partial = (
  date: string,
  startTime: number,
  endTime: number,
  endDate = date,
): ClosureLike => ({
  title: "Cierre parcial",
  startDate: date,
  endDate,
  startTime,
  endTime,
});

describe("findClosureForWindow", () => {
  it("no encuentra nada sin cierres", () => {
    expect(
      findClosureForWindow(at("2026-05-25", 9), at("2026-05-25", 10), []),
    ).toBeNull();
  });

  it("un cierre de día completo bloquea cualquier horario de ese día", () => {
    const c = fullDay("2026-05-25");
    expect(
      findClosureForWindow(at("2026-05-25", 9), at("2026-05-25", 10), [c]),
    ).toBe(c);
    expect(
      findClosureForWindow(at("2026-05-25", 17), at("2026-05-25", 18), [c]),
    ).toBe(c);
  });

  it("no bloquea el día anterior ni el siguiente", () => {
    const c = fullDay("2026-05-25");
    expect(
      findClosureForWindow(at("2026-05-22", 9), at("2026-05-22", 10), [c]),
    ).toBeNull();
    expect(
      findClosureForWindow(at("2026-05-26", 9), at("2026-05-26", 10), [c]),
    ).toBeNull();
  });

  it("un rango cubre todos sus días, extremos incluidos", () => {
    const c = fullDay("2026-07-20", "2026-07-31");
    for (const d of ["2026-07-20", "2026-07-27", "2026-07-31"]) {
      expect(findClosureForWindow(at(d, 9), at(d, 10), [c])).toBe(c);
    }
    expect(
      findClosureForWindow(at("2026-08-03", 9), at("2026-08-03", 10), [c]),
    ).toBeNull();
  });

  it("una franja bloquea solo su horario", () => {
    const c = partial("2026-05-25", 14 * 60, 18 * 60);
    expect(
      findClosureForWindow(at("2026-05-25", 9), at("2026-05-25", 12), [c]),
    ).toBeNull();
    expect(
      findClosureForWindow(at("2026-05-25", 15), at("2026-05-25", 16), [c]),
    ).toBe(c);
  });

  it("los bordes de la franja no se pisan: terminar a las 14:00 o empezar a las 18:00 es válido", () => {
    const c = partial("2026-05-25", 14 * 60, 18 * 60);
    expect(
      findClosureForWindow(at("2026-05-25", 12), at("2026-05-25", 14), [c]),
    ).toBeNull();
    expect(
      findClosureForWindow(at("2026-05-25", 18), at("2026-05-25", 19), [c]),
    ).toBeNull();
  });

  it("un solape parcial con la franja alcanza para bloquear", () => {
    const c = partial("2026-05-25", 14 * 60, 18 * 60);
    expect(
      findClosureForWindow(at("2026-05-25", 13), at("2026-05-25", 15), [c]),
    ).toBe(c);
    expect(
      findClosureForWindow(at("2026-05-25", 17), at("2026-05-25", 19), [c]),
    ).toBe(c);
  });

  it("una franja en un rango aplica en cada día del rango", () => {
    const c = partial("2026-07-20", 9 * 60, 13 * 60, "2026-07-22");
    expect(
      findClosureForWindow(at("2026-07-21", 10), at("2026-07-21", 11), [c]),
    ).toBe(c);
    expect(
      findClosureForWindow(at("2026-07-21", 14), at("2026-07-21", 15), [c]),
    ).toBeNull();
  });

  it("una ventana que termina justo a medianoche no toca el día siguiente", () => {
    const c = fullDay("2026-05-26");
    expect(
      findClosureForWindow(at("2026-05-25", 23), at("2026-05-26", 0), [c]),
    ).toBeNull();
  });

  it("una ventana que cruza la medianoche se revisa en ambos días", () => {
    const c = fullDay("2026-05-26");
    expect(
      findClosureForWindow(at("2026-05-25", 23), at("2026-05-26", 1), [c]),
    ).toBe(c);
  });

  it("devuelve el primero que coincide", () => {
    const a = fullDay("2026-05-25");
    const b = { ...fullDay("2026-05-25"), title: "Otro" };
    expect(
      findClosureForWindow(at("2026-05-25", 9), at("2026-05-25", 10), [a, b]),
    ).toBe(a);
  });

  it("ignora una ventana vacía o invertida", () => {
    const c = fullDay("2026-05-25");
    expect(
      findClosureForWindow(at("2026-05-25", 10), at("2026-05-25", 10), [c]),
    ).toBeNull();
    expect(
      findClosureForWindow(at("2026-05-25", 11), at("2026-05-25", 10), [c]),
    ).toBeNull();
  });
});

describe("closureIntervalOnDay", () => {
  it("es null fuera del rango", () => {
    expect(
      closureIntervalOnDay(fullDay("2026-05-25"), "2026-05-24"),
    ).toBeNull();
  });

  it("un día completo mide 24 h", () => {
    const [from, to] = closureIntervalOnDay(
      fullDay("2026-05-25"),
      "2026-05-25",
    )!;
    expect(to - from).toBe(24 * HOUR);
  });
});

describe("mensajes", () => {
  it("formatea minutos", () => {
    expect(formatMinutes(0)).toBe("00:00");
    expect(formatMinutes(14 * 60 + 15)).toBe("14:15");
  });

  it("etiqueta la franja", () => {
    expect(closureWindowLabel(fullDay("2026-05-25"))).toBe("Todo el día");
    expect(closureWindowLabel(partial("2026-05-25", 840, 1080))).toBe(
      "14:00–18:00",
    );
  });

  it("el rechazo incluye el motivo", () => {
    expect(
      closureRejectionMessage({
        ...fullDay("2026-05-25"),
        title: "Vacaciones de invierno",
      }),
    ).toBe("El espacio está cerrado: Vacaciones de invierno");
    expect(closureRejectionMessage(partial("2026-05-25", 840, 1080))).toBe(
      "El espacio está cerrado de 14:00 a 18:00: Cierre parcial",
    );
  });
});

describe("closureSlotsForRange", () => {
  it("recorta un día completo al horario de reserva", () => {
    const slots = closureSlotsForRange(
      [fullDay("2026-05-25")],
      at("2026-05-25", 0),
      at("2026-05-25", 23),
    );
    expect(slots).toEqual([
      {
        title: "Feriado",
        startTime: at("2026-05-25", 9),
        endTime: at("2026-05-25", 18),
      },
    ]);
  });

  it("genera un tramo por día de un rango, solo los que caen en la ventana", () => {
    const slots = closureSlotsForRange(
      [fullDay("2026-07-20", "2026-07-24")],
      at("2026-07-22", 0),
      at("2026-07-23", 23),
    );
    expect(slots.map((s) => s.startTime)).toEqual([
      at("2026-07-22", 9),
      at("2026-07-23", 9),
    ]);
  });

  it("respeta una franja y descarta la que queda fuera del horario", () => {
    const tarde = partial("2026-05-25", 14 * 60, 20 * 60);
    expect(
      closureSlotsForRange([tarde], at("2026-05-25", 0), at("2026-05-25", 23)),
    ).toEqual([
      {
        title: "Cierre parcial",
        startTime: at("2026-05-25", 14),
        endTime: at("2026-05-25", 18),
      },
    ]);
    const noche = partial("2026-05-25", 19 * 60, 21 * 60);
    expect(
      closureSlotsForRange([noche], at("2026-05-25", 0), at("2026-05-25", 23)),
    ).toEqual([]);
  });
});
