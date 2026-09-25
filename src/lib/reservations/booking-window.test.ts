import { describe, expect, it } from "vitest";
import { TZDate } from "@date-fns/tz";
import { ADMIN_TIMEZONE } from "@/lib/admin/admin-timezone";
import { checkBookingWindow } from "./booking-window";

/** Unix ms for a venue-local date + time, so the cases read as the rule they test. */
function local(y: number, m: number, d: number, h: number, min = 0): number {
  return new TZDate(y, m - 1, d, h, min, 0, 0, ADMIN_TIMEZONE).getTime();
}

// 2026-09-24 is a Thursday; 2026-09-25 a Friday; 2026-09-26 a Saturday.
describe("checkBookingWindow", () => {
  it("allows a weekday booking inside opening hours", () => {
    expect(
      checkBookingWindow(local(2026, 9, 24, 9), local(2026, 9, 24, 11)),
    ).toBe(null);
    expect(
      checkBookingWindow(local(2026, 9, 24, 16), local(2026, 9, 24, 18)),
    ).toBe(null);
  });

  it("rejects a booking ending after 18:00 local", () => {
    // The old check was `endHour > 21` on UTC hours, which admitted 18:59 local.
    expect(
      checkBookingWindow(local(2026, 9, 24, 17), local(2026, 9, 24, 18, 59)),
    ).toBe("outside_hours");
    expect(
      checkBookingWindow(local(2026, 9, 24, 17), local(2026, 9, 24, 18, 15)),
    ).toBe("outside_hours");
  });

  it("rejects a booking starting before 09:00 local", () => {
    expect(
      checkBookingWindow(local(2026, 9, 24, 8, 45), local(2026, 9, 24, 10)),
    ).toBe("outside_hours");
  });

  it("allows an end between 15:01 and 15:59 local", () => {
    // The old `endHour === 18 && minutes > 0` clause (18:00 UTC = 15:00 local) rejected
    // these with a message about 6 PM. Nothing in the rules justifies a 15:00 boundary.
    expect(
      checkBookingWindow(local(2026, 9, 24, 14), local(2026, 9, 24, 15, 30)),
    ).toBe(null);
    expect(
      checkBookingWindow(local(2026, 9, 24, 14), local(2026, 9, 24, 15, 1)),
    ).toBe(null);
  });

  it("treats a late Friday booking as a Friday, not a Saturday", () => {
    // Friday 17:00–18:00 local is Friday 20:00–21:00 UTC. The old getUTCDay() logic was
    // only saved from misclassifying this by the hours window; the weekday check itself
    // was wrong.
    expect(
      checkBookingWindow(local(2026, 9, 25, 17), local(2026, 9, 25, 18)),
    ).toBe(null);
  });

  it("rejects weekends", () => {
    expect(
      checkBookingWindow(local(2026, 9, 26, 10), local(2026, 9, 26, 12)),
    ).toBe("weekend");
    expect(
      checkBookingWindow(local(2026, 9, 27, 10), local(2026, 9, 27, 12)),
    ).toBe("weekend");
  });

  it("rejects a window that crosses local midnight", () => {
    // Can't be checked against one day's minute range, and the UI never offers it.
    expect(
      checkBookingWindow(local(2026, 9, 24, 17), local(2026, 9, 25, 10)),
    ).toBe("overnight");
  });
});
