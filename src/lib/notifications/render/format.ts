import { ADMIN_TIMEZONE } from "@/lib/admin/admin-timezone";

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: ADMIN_TIMEZONE,
});
const timeFmt = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: ADMIN_TIMEZONE,
});

/** "jueves 23 de julio, 10:00" in the admin timezone (event wall-clock). */
export function formatMoment(ms: number): string {
  return `${dateFmt.format(new Date(ms))}, ${timeFmt.format(new Date(ms))}`;
}

/** "jueves 23 de julio, 10:00–13:00". */
export function formatRange(startMs: number, endMs: number): string {
  return `${dateFmt.format(new Date(startMs))}, ${timeFmt.format(new Date(startMs))}–${timeFmt.format(new Date(endMs))}`;
}
