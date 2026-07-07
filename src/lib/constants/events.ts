import { ADMIN_TIMEZONE } from "@/lib/admin/admin-timezone";
import {
  CalendarDays,
  type LucideIcon,
  Presentation,
  Users,
  Wrench,
} from "lucide-react";

/**
 * Fallback labels for the built-in reservation-type codes. Types now live in the
 * `reservation_types` table (superadmin-managed) — prefer the DB `name` when the
 * query provides it; these only cover surfaces without the joined name.
 */
export const EVENT_TYPE_LABELS: Record<string, string> = {
  WORKSHOP: "Taller",
  MEETING: "Reunión",
  CONFERENCE: "Conferencia",
  OTHER: "Otro",
};

export function eventTypeLabel(type: string): string {
  return EVENT_TYPE_LABELS[type] ?? type;
}

/** Icon per event type, used on cover placeholders so types are visually distinguishable. */
export const EVENT_TYPE_ICONS: Record<string, LucideIcon> = {
  WORKSHOP: Wrench,
  MEETING: Users,
  CONFERENCE: Presentation,
  OTHER: CalendarDays,
};

export function eventTypeIcon(type: string): LucideIcon {
  return EVENT_TYPE_ICONS[type] ?? CalendarDays;
}

/** Short weekday labels indexed by Date.getDay() (0 = Sunday .. 6 = Saturday). */
export const WEEKDAY_SHORT_LABELS = [
  "Dom",
  "Lun",
  "Mar",
  "Mié",
  "Jue",
  "Vie",
  "Sáb",
] as const;

/** Derived (display-only) event lifecycle state. CANCELLED + ENDED are computed, not stored. */
export type EventDisplayStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "PAUSED"
  | "ENDED"
  | "CANCELLED";

export const EVENT_STATUS_LABELS: Record<EventDisplayStatus, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  PAUSED: "Pausado",
  ENDED: "Finalizado",
  CANCELLED: "Cancelado",
};

/**
 * The state to show for an event. Precedence: CANCELLED (soft-deleted) > ENDED (last
 * occurrence passed) > stored status. `lastOccurrenceMs` = recurrenceEnd ?? endTime.
 */
export function eventDisplayStatus(
  status: string,
  lastOccurrenceMs: number,
  nowMs: number,
  deletedAt: number | null = null,
): EventDisplayStatus {
  if (deletedAt != null) return "CANCELLED";
  if (lastOccurrenceMs < nowMs) return "ENDED";
  return (status as EventDisplayStatus) ?? "DRAFT";
}

const timeFmt = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: ADMIN_TIMEZONE,
});

/**
 * Wall-clock time range of an event's daily window, e.g. "10:00–13:00". Times are scheduling
 * config in the admin timezone (the documented exception to client-side date formatting).
 */
export function formatEventTimeRange(startMs: number, endMs: number): string {
  return `${timeFmt.format(new Date(startMs))}–${timeFmt.format(new Date(endMs))}`;
}
