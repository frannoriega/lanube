import { describe, expect, it } from "vitest";
import { TZDate } from "@date-fns/tz";
import { ADMIN_TIMEZONE } from "@/lib/admin/admin-timezone";
import {
  bookingHorizonEndMs,
  bookingHorizonLastDateKey,
  bookingHorizonMessage,
  isBeyondBookingHorizon,
} from "./booking-horizon";

/** Unix ms de una fecha + hora locales del predio. */
function local(y: number, m: number, d: number, h = 0, min = 0): number {
  return new TZDate(y, m - 1, d, h, min, 0, 0, ADMIN_TIMEZONE).getTime();
}

describe("horizonte de reserva (ventana deslizante de 2 semanas)", () => {
  it("un miércoles el último día reservable es el miércoles de dos semanas después", () => {
    // 2026-10-07 es miércoles.
    expect(bookingHorizonLastDateKey(local(2026, 10, 7, 10))).toBe(
      "2026-10-21",
    );
  });

  it("cruza el fin de mes: miércoles 1 → miércoles 15", () => {
    // 2026-04-01 es miércoles.
    expect(bookingHorizonLastDateKey(local(2026, 4, 1, 9))).toBe("2026-04-15");
  });

  it("no depende del día de la semana: lunes, viernes y sábado suman 14 días", () => {
    expect(bookingHorizonLastDateKey(local(2026, 10, 5, 9))).toBe("2026-10-19");
    expect(bookingHorizonLastDateKey(local(2026, 10, 9, 9))).toBe("2026-10-23");
    expect(bookingHorizonLastDateKey(local(2026, 10, 10, 9))).toBe(
      "2026-10-24",
    );
  });

  it("el día cuenta en la zona del predio, no en UTC", () => {
    // 23:30 locales del miércoles 7 ya son jueves 8 en UTC.
    expect(bookingHorizonLastDateKey(local(2026, 10, 7, 23, 30))).toBe(
      "2026-10-21",
    );
  });

  it("el último día entra entero y el siguiente ya no", () => {
    const now = local(2026, 10, 7, 10);
    expect(bookingHorizonEndMs(now)).toBe(local(2026, 10, 22, 0));
    expect(isBeyondBookingHorizon(local(2026, 10, 21, 18, 45), now)).toBe(
      false,
    );
    expect(isBeyondBookingHorizon(local(2026, 10, 22, 8), now)).toBe(true);
  });

  it("el mensaje dice hasta cuándo se puede reservar", () => {
    expect(bookingHorizonMessage(local(2026, 10, 7, 10))).toContain(
      "21/10/2026",
    );
  });
});
