import { describe, expect, it } from "vitest";
import { TZDate } from "@date-fns/tz";
import { ADMIN_TIMEZONE } from "@/lib/admin/admin-timezone";
import { planEventOccurrences } from "@/lib/events/plan";
import { EventInput } from "@/lib/schemas/events";

function baseInput(overrides: Partial<EventInput> = {}): EventInput {
  return {
    name: "Taller",
    description: null,
    eventType: "WORKSHOP",
    resourceId: "res1",
    // 2026-03-01 is a Sunday; 2026-03-14 is a Saturday.
    startDate: "2026-03-01",
    endDate: "2026-03-14",
    weekdays: [3, 5], // Wednesday, Friday
    startTime: "10:00",
    endTime: "13:00",
    capacity: null,
    ...overrides,
  } as EventInput;
}

function weekdayOf(ms: number): number {
  return new TZDate(ms, ADMIN_TIMEZONE).getDay();
}

describe("planEventOccurrences", () => {
  it("creates one weekly reservation per selected weekday", () => {
    const plans = planEventOccurrences(baseInput());
    expect(plans).toHaveLength(2);
    expect(plans.map((p) => p.rrule).sort()).toEqual([
      "FREQ=WEEKLY;BYDAY=FR",
      "FREQ=WEEKLY;BYDAY=WE",
    ]);
  });

  it("anchors each reservation to the first matching weekday in range", () => {
    const plans = planEventOccurrences(baseInput());
    // First Wednesday on/after 2026-03-01 is 2026-03-04; first Friday is 2026-03-06.
    const byDay = Object.fromEntries(
      plans.map((p) => [p.rrule, weekdayOf(p.startMs)]),
    );
    expect(byDay["FREQ=WEEKLY;BYDAY=WE"]).toBe(3);
    expect(byDay["FREQ=WEEKLY;BYDAY=FR"]).toBe(5);
  });

  it("sets the daily time window in the admin timezone", () => {
    const [plan] = planEventOccurrences(baseInput({ weekdays: [3] }));
    const start = new TZDate(plan.startMs, ADMIN_TIMEZONE);
    const end = new TZDate(plan.endMs, ADMIN_TIMEZONE);
    expect(start.getHours()).toBe(10);
    expect(end.getHours()).toBe(13);
  });

  it("skips weekdays that never occur in the range", () => {
    // A single-day range on a Wednesday: only Wednesday should yield an occurrence.
    const plans = planEventOccurrences(
      baseInput({
        startDate: "2026-03-04",
        endDate: "2026-03-04",
        weekdays: [3, 5],
      }),
    );
    expect(plans).toHaveLength(1);
    expect(plans[0].rrule).toBe("FREQ=WEEKLY;BYDAY=WE");
  });

  it("sets recurrenceEnd to the end of the end date", () => {
    const [plan] = planEventOccurrences(baseInput({ weekdays: [3] }));
    const end = new TZDate(plan.recurrenceEndMs, ADMIN_TIMEZONE);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(2); // March
    expect(end.getDate()).toBe(14);
  });
});
