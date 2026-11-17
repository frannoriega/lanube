import {
  addDaysToDateKey,
  dateKeyFromUnixMs,
  endOfDateKeyMs,
  startOfDateKeyMs,
} from "@/lib/admin/admin-timezone";
import {
  closureIntervalOnDay,
  isFullDayClosure,
  type ClosureLike,
} from "@/lib/closed-days/closures";

/**
 * Reglas **puras** del calendario de actividades (milestone 32): qué rango se puede pedir,
 * cómo se ven las reservas ajenas («Ocupado») y cómo se dibujan los días cerrados. Sin base ni
 * reloj propio; testeadas en `activity.test.ts`. La carga está en
 * `src/lib/db/activityCalendar.ts` y el dibujo en `organisms/activity-calendar/`.
 */

/** Qué es cada cosa del calendario. */
export type CalendarItemKind =
  | "reservation" // una reserva (de cualquiera, para admins; la propia, para usuarios)
  | "busy" // usuarios: lo que reservaron otros, sin nombre ni motivo
  | "event" // una sesión de un evento
  | "closed" // día o franja cerrada
  | "maintenance"; // ventana de mantenimiento (solo admins)

export interface CalendarItem {
  /** Único dentro de una respuesta (para las `key` de React). */
  id: string;
  kind: CalendarItemKind;
  startMs: number;
  endMs: number;
  /** Ocupa el día entero (cierres completos, mantenimiento): va en la franja de arriba. */
  allDay: boolean;
  title: string;
  spaceId?: string;
  spaceName?: string;
  /** Reservas: `PENDING` o `APPROVED` (las rechazadas y canceladas no se muestran). */
  status?: "PENDING" | "APPROVED";
  /** Usuarios: la reserva es propia. */
  own?: boolean;
  /** Solo admins: quién reservó («Ana Pérez», «Equipo X»). */
  requester?: string;
  /** Eventos. */
  eventId?: string;
  /** Solo admins: el estado del evento (borrador y pausado se distinguen). */
  eventStatus?: "DRAFT" | "PUBLISHED" | "PAUSED";
  /** Eventos públicos con formulario: inscripción abierta ahora. */
  registrationOpen?: boolean;
  /** Eventos: a dónde lleva el botón de la tarjeta (inscripción o página del evento). */
  href?: string;
  /** Texto de apoyo (franja de un cierre, modo de un mantenimiento). */
  detail?: string;
}

export interface ActivityCalendarData {
  from: number;
  to: number;
  items: CalendarItem[];
}

const DAY_MS = 86_400_000;

/**
 * Rango máximo de un pedido: una vista de mes son 6 semanas (42 días) y el cliente pide la
 * grilla entera; se deja un margen por la zona horaria del navegador.
 */
export const CALENDAR_MAX_RANGE_MS = 45 * DAY_MS;

/**
 * Hasta dónde se puede navegar: el fin del **año siguiente** (hora del predio), visto desde
 * `nowMs`. Es el tope que acordó el diseño; también lo valida el servidor.
 */
export function calendarNavigationEndMs(nowMs: number): number {
  const year = Number(dateKeyFromUnixMs(nowMs).slice(0, 4)) + 1;
  return endOfDateKeyMs(`${year}-12-31`);
}

/** Valida `from`/`to` de un pedido al calendario. `null` = válido. */
export function calendarRangeError(
  fromMs: number,
  toMs: number,
  nowMs: number,
): string | null {
  if (
    !Number.isInteger(fromMs) ||
    !Number.isInteger(toMs) ||
    fromMs <= 0 ||
    toMs <= 0
  ) {
    return "Parámetros inválidos: se requieren 'from' y 'to' como timestamps Unix en ms";
  }
  if (fromMs >= toMs) return "El inicio debe ser anterior al fin";
  if (toMs - fromMs > CALENDAR_MAX_RANGE_MS) {
    return "El rango máximo es de 45 días";
  }
  if (fromMs > calendarNavigationEndMs(nowMs)) {
    return "El calendario llega hasta el fin del año próximo";
  }
  return null;
}

/**
 * Reservas ajenas para la vista de usuario: se unen por espacio los tramos que se tocan o se
 * superponen, y salen como «Ocupado» sin nombre, motivo ni estado. Unir evita, además, una
 * pared de bloques iguales en el coworking (muchas reservas chicas a la vez).
 */
export function mergeBusy(
  slots: readonly {
    spaceId: string;
    spaceName: string;
    startMs: number;
    endMs: number;
  }[],
): CalendarItem[] {
  const bySpace = new Map<string, typeof slots>();
  for (const s of slots) {
    bySpace.set(s.spaceId, [...(bySpace.get(s.spaceId) ?? []), s]);
  }
  const out: CalendarItem[] = [];
  for (const [spaceId, list] of bySpace) {
    const sorted = [...list].sort((a, b) => a.startMs - b.startMs);
    let cur: { startMs: number; endMs: number } | null = null;
    const flush = () => {
      if (!cur) return;
      out.push({
        id: `busy:${spaceId}:${cur.startMs}`,
        kind: "busy",
        startMs: cur.startMs,
        endMs: cur.endMs,
        allDay: false,
        title: "Ocupado",
        spaceId,
        spaceName: list[0].spaceName,
      });
    };
    for (const s of sorted) {
      if (cur && s.startMs <= cur.endMs) {
        cur.endMs = Math.max(cur.endMs, s.endMs);
      } else {
        flush();
        cur = { startMs: s.startMs, endMs: s.endMs };
      }
    }
    flush();
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * Cierres → ítems del calendario dentro de `[fromMs, toMs]`. Un cierre de día completo es un
 * solo ítem de «todo el día» que cubre su rango de fechas (recortado a la ventana); uno con
 * franja da un ítem con horario por cada día.
 */
export function closureItems(
  closures: readonly (ClosureLike & { id: string })[],
  fromMs: number,
  toMs: number,
): CalendarItem[] {
  const firstKey = dateKeyFromUnixMs(fromMs);
  const lastKey = dateKeyFromUnixMs(toMs);
  const out: CalendarItem[] = [];
  for (const c of closures) {
    if (isFullDayClosure(c)) {
      const start = c.startDate < firstKey ? firstKey : c.startDate;
      const end = c.endDate > lastKey ? lastKey : c.endDate;
      if (start > end) continue;
      out.push({
        id: `closed:${c.id}`,
        kind: "closed",
        startMs: startOfDateKeyMs(start),
        endMs: endOfDateKeyMs(end),
        allDay: true,
        title: c.title,
        detail: "Cerrado todo el día",
      });
      continue;
    }
    for (let key = firstKey; key <= lastKey; key = addDaysToDateKey(key, 1)) {
      const interval = closureIntervalOnDay(c, key);
      if (!interval) continue;
      out.push({
        id: `closed:${c.id}:${key}`,
        kind: "closed",
        startMs: interval[0],
        endMs: interval[1],
        allDay: false,
        title: c.title,
        detail: `Cerrado de ${hhmm(c.startTime as number)} a ${hhmm(c.endTime as number)}`,
      });
    }
  }
  return out;
}

/** Una ventana de mantenimiento tal como se guarda (ms o `null`). */
export interface MaintenanceLike {
  id: string;
  title: string;
  mode: "NOTICE" | "READ_ONLY" | "UNAVAILABLE";
  startsAt: number | null;
  endsAt: number | null;
  endedAt: number | null;
  createdAt: number;
}

export const MAINTENANCE_MODE_LABELS: Record<MaintenanceLike["mode"], string> =
  {
    NOTICE: "Solo aviso",
    READ_ONLY: "Solo lectura",
    UNAVAILABLE: "Fuera de servicio",
  };

/**
 * Ventanas de mantenimiento → ítems de «todo el día» (solo para admins). Una ventana rige de
 * `startsAt` (o desde que se creó) hasta `endedAt` / `endsAt`; si no tiene fin y sigue
 * vigente, se dibuja hasta el final de la ventana pedida (o hasta ahora, si es pasada).
 */
export function maintenanceItems(
  windows: readonly MaintenanceLike[],
  fromMs: number,
  toMs: number,
  nowMs: number,
): CalendarItem[] {
  const out: CalendarItem[] = [];
  for (const w of windows) {
    const start = w.startsAt ?? w.createdAt;
    const plannedEnd = w.endsAt ?? Math.max(toMs, nowMs);
    const end =
      w.endedAt != null ? Math.min(w.endedAt, plannedEnd) : plannedEnd;
    if (end <= start || end < fromMs || start > toMs) continue;
    out.push({
      id: `maintenance:${w.id}`,
      kind: "maintenance",
      startMs: Math.max(start, fromMs),
      endMs: Math.min(end, toMs),
      allDay: true,
      title: w.title,
      detail: MAINTENANCE_MODE_LABELS[w.mode],
    });
  }
  return out;
}
