import { describe, expect, it } from "vitest";
import { TZDate } from "@date-fns/tz";
import { ADMIN_TIMEZONE } from "@/lib/admin/admin-timezone";
import {
  BOOKING_WINDOW_MESSAGES,
  MINIMUM_NOTICE_MESSAGE,
} from "./booking-window";
import { validateUserReservationWindow } from "./user-rules";

/** Unix ms de una fecha/hora local del predio, para que los casos se lean como la regla. */
function local(y: number, m: number, d: number, h: number, min = 0): number {
  return new TZDate(y, m - 1, d, h, min, 0, 0, ADMIN_TIMEZONE).getTime();
}

// "Ahora" = lunes 2026-10-05 10:00 local. El jueves 2026-10-08 queda con > 24 h de margen.
const NOW = local(2026, 10, 5, 10);

describe("validateUserReservationWindow", () => {
  it("acepta una reserva válida", () => {
    expect(
      validateUserReservationWindow(
        local(2026, 10, 8, 10),
        local(2026, 10, 8, 12),
        NOW,
      ),
    ).toBeNull();
  });

  it("rechaza tiempos no numéricos", () => {
    expect(
      validateUserReservationWindow(NaN, local(2026, 10, 8, 12), NOW),
    ).toBe("startTime y endTime deben ser milisegundos UTC válidos");
  });

  it("rechaza inicio igual o posterior al fin", () => {
    const t = local(2026, 10, 8, 10);
    expect(validateUserReservationWindow(t, t, NOW)).toBe(
      "La hora de inicio debe ser anterior a la hora de fin",
    );
  });

  it("rechaza horarios fuera de la grilla de 15 minutos", () => {
    expect(
      validateUserReservationWindow(
        local(2026, 10, 8, 10, 5),
        local(2026, 10, 8, 12),
        NOW,
      ),
    ).toBe("Las reservas deben empezar y terminar en intervalos de 15 minutos");
  });

  it("rechaza reservas en el pasado", () => {
    expect(
      validateUserReservationWindow(
        local(2026, 10, 2, 10),
        local(2026, 10, 2, 12),
        NOW,
      ),
    ).toBe("No se pueden hacer reservas en el pasado");
  });

  it("exige 24 h reales de anticipación", () => {
    // Mañana a las 09:00: 23 h de margen.
    expect(
      validateUserReservationWindow(
        local(2026, 10, 6, 9),
        local(2026, 10, 6, 11),
        NOW,
      ),
    ).toBe(MINIMUM_NOTICE_MESSAGE);
    // Mañana a las 10:00: exactamente 24 h, alcanza.
    expect(
      validateUserReservationWindow(
        local(2026, 10, 6, 10),
        local(2026, 10, 6, 11),
        NOW,
      ),
    ).toBeNull();
  });

  it("aplica la ventana horaria del predio", () => {
    // Sábado 2026-10-10.
    expect(
      validateUserReservationWindow(
        local(2026, 10, 10, 10),
        local(2026, 10, 10, 12),
        NOW,
      ),
    ).toBe(BOOKING_WINDOW_MESSAGES.weekend);
    expect(
      validateUserReservationWindow(
        local(2026, 10, 8, 17),
        local(2026, 10, 8, 19),
        NOW,
      ),
    ).toBe(BOOKING_WINDOW_MESSAGES.outside_hours);
  });
});
