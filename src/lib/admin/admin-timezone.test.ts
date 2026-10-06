import { describe, expect, it } from "vitest";
import {
  addDaysToDateKey,
  adminForwardWindowRange,
  currentPeriodsInAdminTz,
  dateKeyFromUnixMs,
  enumerateDateKeysInclusive,
  isValidDateKey,
  todayDateKeyInAdminTz,
} from "./admin-timezone";

describe("admin-timezone", () => {
  it("enumerateDateKeysInclusive returns one day when from equals to", () => {
    expect(enumerateDateKeysInclusive("2025-04-04", "2025-04-04")).toEqual([
      "2025-04-04",
    ]);
  });

  it("enumerateDateKeysInclusive spans inclusive range", () => {
    const days = enumerateDateKeysInclusive("2025-04-01", "2025-04-14");
    expect(days).toHaveLength(14);
    expect(days[0]).toBe("2025-04-01");
    expect(days[13]).toBe("2025-04-14");
  });

  it("addDaysToDateKey advances calendar in admin TZ", () => {
    expect(addDaysToDateKey("2025-04-30", 1)).toBe("2025-05-01");
  });

  it("isValidDateKey rejects malformed strings", () => {
    expect(isValidDateKey("2025-4-4")).toBe(false);
    expect(isValidDateKey("25-04-04")).toBe(false);
    expect(isValidDateKey("2025-04-04")).toBe(true);
  });

  it("adminForwardWindowRange starts today and spans dayCount days inclusive", () => {
    const nowMs = new Date("2025-04-04T15:00:00Z").getTime();
    const { fromKey, toKey } = adminForwardWindowRange(14, nowMs);
    expect(fromKey).toBe(todayDateKeyInAdminTz(nowMs));
    expect(enumerateDateKeysInclusive(fromKey, toKey)).toHaveLength(14);
  });

  it("adminForwardWindowRange respects an arbitrary window length", () => {
    const nowMs = new Date("2025-04-04T15:00:00Z").getTime();
    const { fromKey, toKey } = adminForwardWindowRange(60, nowMs);
    expect(enumerateDateKeysInclusive(fromKey, toKey)).toHaveLength(60);
  });

  // Milestone 25, C1/C2: los períodos de las estadísticas van en hora del predio (UTC-3).
  describe("currentPeriodsInAdminTz", () => {
    // Martes 2026-10-06 22:30 en Argentina = miércoles 2026-10-07 01:30 UTC.
    const lateTuesday = Date.UTC(2026, 9, 7, 1, 30);

    it("hoy es el día de Argentina, no el de UTC", () => {
      const { day } = currentPeriodsInAdminTz(lateTuesday);
      expect(dateKeyFromUnixMs(day.startMs)).toBe("2026-10-06");
      expect(day.startMs).toBe(Date.UTC(2026, 9, 6, 3, 0));
      expect(day.endMs).toBe(Date.UTC(2026, 9, 7, 2, 59, 59, 999));
    });

    it("la semana va de domingo a sábado", () => {
      const { week } = currentPeriodsInAdminTz(lateTuesday);
      expect(dateKeyFromUnixMs(week.startMs)).toBe("2026-10-04");
      expect(dateKeyFromUnixMs(week.endMs)).toBe("2026-10-10");
    });

    it("el mes termina en su último día", () => {
      const { month } = currentPeriodsInAdminTz(lateTuesday);
      expect(dateKeyFromUnixMs(month.startMs)).toBe("2026-10-01");
      expect(dateKeyFromUnixMs(month.endMs)).toBe("2026-10-31");
    });

    it("diciembre cierra el año", () => {
      const { month } = currentPeriodsInAdminTz(Date.UTC(2026, 11, 15, 12));
      expect(dateKeyFromUnixMs(month.endMs)).toBe("2026-12-31");
    });
  });
});
