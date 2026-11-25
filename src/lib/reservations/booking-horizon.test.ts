import { describe, expect, it } from "vitest";
import { TZDate } from "@date-fns/tz";
import { ADMIN_TIMEZONE } from "@/lib/admin/admin-timezone";
import {
  BOOKING_HORIZON_DAYS,
  EXTENDED_BOOKING_HORIZON_DAYS,
  bookingHorizonDaysFor,
  bookingHorizonEndMs,
  bookingHorizonLastDateKey,
  bookingHorizonMessage,
  isBeyondBookingHorizon,
} from "./booking-horizon";
import { validateUserReservationWindow } from "./user-rules";

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

describe("horizonte extendido por permiso (milestone 42)", () => {
  it("bookingHorizonDaysFor: 14 sin el permiso, 365 con él o siendo superadmin", () => {
    expect(bookingHorizonDaysFor(null)).toBe(BOOKING_HORIZON_DAYS);
    expect(
      bookingHorizonDaysFor({
        isSuperadmin: false,
        permissions: ["admin:access"],
      }),
    ).toBe(14);
    expect(
      bookingHorizonDaysFor({
        isSuperadmin: false,
        permissions: ["reservations:extended-horizon"],
      }),
    ).toBe(EXTENDED_BOOKING_HORIZON_DAYS);
    expect(bookingHorizonDaysFor({ isSuperadmin: true, permissions: [] })).toBe(
      365,
    );
  });

  it("con 365 días el último día reservable es un año después", () => {
    expect(bookingHorizonLastDateKey(local(2026, 11, 25, 10), 365)).toBe(
      "2027-11-25",
    );
  });

  it("el mensaje dice el horizonte de la persona", () => {
    expect(bookingHorizonMessage(local(2026, 11, 25, 10), 365)).toBe(
      "Solo se puede reservar con hasta 1 año de anticipación: hasta el 25/11/2027 inclusive.",
    );
    expect(bookingHorizonMessage(local(2026, 11, 25, 10))).toContain(
      "hasta 2 semanas",
    );
  });

  it("validateUserReservationWindow aplica el horizonte que recibe", () => {
    const now = local(2026, 11, 25, 9);
    // Martes 15/12/2026 (a 20 días), 10–11 h: fuera de 2 semanas, dentro de un año.
    const s = local(2026, 12, 15, 10);
    const e = local(2026, 12, 15, 11);
    expect(validateUserReservationWindow(s, e, now)).toContain("2 semanas");
    expect(validateUserReservationWindow(s, e, now, 365)).toBeNull();
    // Viernes 26/11/2027 10–11 h: un día más allá del año.
    const far = local(2027, 11, 26, 10);
    expect(
      validateUserReservationWindow(far, far + 3_600_000, now, 365),
    ).toContain("1 año");
    expect(isBeyondBookingHorizon(far, now, 365)).toBe(true);
    expect(bookingHorizonEndMs(now, 365)).toBe(local(2027, 11, 26));
  });
});
