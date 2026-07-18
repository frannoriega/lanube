import { ADMIN_TIMEZONE } from "@/lib/admin/admin-timezone";
import { TZDate } from "@date-fns/tz";

/** "YYYY-MM-DDTHH:mm" (datetime-local input) interpreted in the admin TZ -> Unix ms. */
export function dateTimeLocalToMs(value: string): number {
  const [date, time] = value.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = (time ?? "00:00").split(":").map(Number);
  return new TZDate(y, m - 1, d, h, min, 0, 0, ADMIN_TIMEZONE).getTime();
}

/** Unix ms -> "YYYY-MM-DDTHH:mm" in the admin TZ (for datetime-local inputs). */
export function msToDateTimeLocal(ms: number): string {
  const d = new TZDate(ms, ADMIN_TIMEZONE);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export const DATETIME_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
