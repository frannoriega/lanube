import {
  ADMIN_TIMEZONE,
  addDaysToDateKey,
  endOfDateKeyMs,
} from "@/lib/admin/admin-timezone";
import { EventInput, WEEKDAY_RRULE } from "@/modules/events/schema";
import { TZDate } from "@date-fns/tz";
import { createId } from "@paralleldrive/cuid2";

export interface OccurrencePlan {
  reservationId: string;
  startMs: number;
  endMs: number;
  rrule: string;
  recurrenceEndMs: number;
}

/** The scheduling fields of an event — enough to expand its weekly occurrences. */
export type EventRecipe = Pick<
  EventInput,
  "weekdays" | "startDate" | "endDate" | "startTime" | "endTime"
>;

/** Unix ms for a calendar date-key + HH:mm, interpreted in the admin timezone. */
export function dateKeyTimeToMs(dateKey: string, hhmm: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  return new TZDate(y, m - 1, d, h, min, 0, 0, ADMIN_TIMEZONE).getTime();
}

/** Weekday (0=Sun..6=Sat) of a date-key in the admin timezone. */
export function weekdayOfDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new TZDate(y, m - 1, d, 12, 0, 0, 0, ADMIN_TIMEZONE).getDay();
}

/**
 * One weekly-recurring reservation per selected weekday (the SQL recurrence engine steps
 * weekly from the first occurrence, so multiple weekdays => multiple reservations, all
 * sharing reservableId = eventId).
 */
export function planEventOccurrences(input: EventRecipe): OccurrencePlan[] {
  const recurrenceEndMs = endOfDateKeyMs(input.endDate);
  const plans: OccurrencePlan[] = [];

  for (const weekday of input.weekdays) {
    // First date in [startDate, endDate] matching this weekday.
    let key = input.startDate;
    let found: string | null = null;
    for (let i = 0; i < 7 && key <= input.endDate; i++) {
      if (weekdayOfDateKey(key) === weekday) {
        found = key;
        break;
      }
      key = addDaysToDateKey(key, 1);
    }
    if (!found) continue;

    plans.push({
      reservationId: createId(),
      startMs: dateKeyTimeToMs(found, input.startTime),
      endMs: dateKeyTimeToMs(found, input.endTime),
      rrule: `FREQ=WEEKLY;BYDAY=${WEEKDAY_RRULE[weekday]}`,
      recurrenceEndMs,
    });
  }

  return plans;
}
