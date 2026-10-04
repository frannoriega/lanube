import { TZDate } from "@date-fns/tz";
import { describe, expect, it } from "vitest";
import { ADMIN_TIMEZONE } from "@/lib/admin/admin-timezone";
import { computeFreeWindows } from "./availability";
import {
  formatVenueRange,
  parseIsoWithOffset,
  parseVenueDate,
  toVenueDateKey,
  toVenueIso,
} from "./format";

function local(y: number, m: number, d: number, h = 0, min = 0): number {
  return new TZDate(y, m - 1, d, h, min, 0, 0, ADMIN_TIMEZONE).getTime();
}

describe("fechas de las tools", () => {
  it("exige offset en la entrada", () => {
    expect(parseIsoWithOffset("2026-10-13T10:00:00-03:00")).toBe(
      local(2026, 10, 13, 10),
    );
    expect(parseIsoWithOffset("2026-10-13T13:00:00Z")).toBe(
      local(2026, 10, 13, 10),
    );
    expect(parseIsoWithOffset("2026-10-13T10:00")).toBeNull();
    expect(parseIsoWithOffset("2026-10-13")).toBeNull();
    expect(parseIsoWithOffset("mañana a las 10")).toBeNull();
  });

  it("parsea fechas locales y rechaza las que desbordan", () => {
    expect(parseVenueDate("2026-10-13")).toBe(local(2026, 10, 13));
    expect(parseVenueDate("2026-02-31")).toBeNull();
    expect(parseVenueDate("13/10/2026")).toBeNull();
  });

  it("sale en la zona del predio, con offset y texto es-AR", () => {
    const ms = local(2026, 10, 9, 14);
    expect(toVenueIso(ms)).toBe("2026-10-09T14:00:00-03:00");
    expect(toVenueDateKey(ms)).toBe("2026-10-09");
    expect(formatVenueRange(ms, local(2026, 10, 9, 16))).toBe(
      "viernes 09/10, 14:00–16:00",
    );
  });
});

describe("computeFreeWindows", () => {
  // Ahora = lunes 2026-10-05 10:00 local.
  const NOW = local(2026, 10, 5, 10);

  it("salta fines de semana y respeta horario y anticipación", () => {
    const days = computeFreeWindows({
      fromDayMs: local(2026, 10, 5), // lunes
      toDayMs: local(2026, 10, 12), // lunes siguiente (exclusive)
      busy: [],
      nowMs: NOW,
    });
    // Lunes a viernes: 5 días hábiles.
    expect(days.map((d) => toVenueDateKey(d.dayStartMs))).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
    ]);
    // Hoy no queda nada (24 h de anticipación); mañana desde las 10:00.
    expect(days[0].windows).toEqual([]);
    expect(days[1].windows).toEqual([
      { startMs: local(2026, 10, 6, 10), endMs: local(2026, 10, 6, 18) },
    ]);
    expect(days[2].windows).toEqual([
      { startMs: local(2026, 10, 7, 9), endMs: local(2026, 10, 7, 18) },
    ]);
  });

  it("descuenta bloques ocupados (también contiguos) y tramos cortos", () => {
    const [day] = computeFreeWindows({
      fromDayMs: local(2026, 10, 8),
      toDayMs: local(2026, 10, 9),
      busy: [
        { startMs: local(2026, 10, 8, 11), endMs: local(2026, 10, 8, 11, 15) },
        { startMs: local(2026, 10, 8, 11, 15), endMs: local(2026, 10, 8, 12) },
        {
          startMs: local(2026, 10, 8, 12, 30),
          endMs: local(2026, 10, 8, 17, 45),
        },
      ],
      nowMs: NOW,
      minDurationMs: 30 * 60 * 1000,
    });
    expect(day.windows).toEqual([
      { startMs: local(2026, 10, 8, 9), endMs: local(2026, 10, 8, 11) },
      { startMs: local(2026, 10, 8, 12), endMs: local(2026, 10, 8, 12, 30) },
      // 17:45–18:00 dura 15 min: queda afuera por minDuration.
    ]);
  });
});
