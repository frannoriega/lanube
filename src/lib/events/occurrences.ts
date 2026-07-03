import { dateKeyFromUnixMs } from "@/lib/admin/admin-timezone";
import { WEEKDAY_RRULE } from "@/lib/schemas/events";

// Pure occurrence logic (no DB) so it can be unit-tested. `events.ts` maps Prisma rows into
// these plain shapes and calls in.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type OccurrenceStatus = "scheduled" | "rescheduled" | "cancelled";

export interface RawException {
  id: string;
  exceptionDateMs: number;
  isCancelled: boolean;
  newStartMs: number | null;
  newEndMs: number | null;
  reason: string | null;
  createdAtMs: number;
}

export interface RawReservation {
  id: string;
  startMs: number;
  endMs: number;
  recurrenceEndMs: number;
  rrule: string | null;
  exceptions: RawException[];
}

export interface EventOccurrence {
  reservationId: string;
  occurrenceDateMs: number;
  startMs: number;
  endMs: number;
  status: OccurrenceStatus;
  reason: string | null;
}

export interface DroppedSession {
  date: string; // yyyy-MM-dd (admin tz)
  kind: "cancel" | "reschedule";
  reason: string | null;
}

/** UTC calendar-date key of a ms timestamp (matches the SQL exception-date matching). */
export function utcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Weekday (0=Sun..6=Sat) of a single-BYDAY reservation rrule, or null. */
export function weekdayOfRrule(rrule: string | null): number | null {
  const code = rrule?.match(/BYDAY=([A-Z]{2})/)?.[1];
  if (!code) return null;
  const i = (WEEKDAY_RRULE as readonly string[]).indexOf(code);
  return i >= 0 ? i : null;
}

/**
 * Expands each weekly reservation into occurrences (nominal start..recurrenceEnd, step 1 week)
 * and overlays its exceptions (latest per UTC date wins, mirroring `effective_occurrence_window`).
 * Returns upcoming/ongoing sessions only (effective window end > now), sorted by start.
 */
export function expandEventOccurrences(
  reservations: RawReservation[],
  nowMs: number,
): EventOccurrence[] {
  const out: EventOccurrence[] = [];

  for (const r of reservations) {
    const duration = r.endMs - r.startMs;

    // Latest exception per UTC date.
    const byDate = new Map<string, RawException>();
    for (const ex of [...r.exceptions].sort(
      (a, b) => b.createdAtMs - a.createdAtMs,
    )) {
      const key = utcDateKey(ex.exceptionDateMs);
      if (!byDate.has(key)) byDate.set(key, ex);
    }

    for (let occ = r.startMs; occ <= r.recurrenceEndMs; occ += WEEK_MS) {
      const ex = byDate.get(utcDateKey(occ));
      let status: OccurrenceStatus = "scheduled";
      let s = occ;
      let e = occ + duration;
      let reason: string | null = null;
      if (ex) {
        reason = ex.reason;
        if (ex.isCancelled) {
          status = "cancelled";
        } else if (ex.newStartMs != null && ex.newEndMs != null) {
          status = "rescheduled";
          s = ex.newStartMs;
          e = ex.newEndMs;
        }
      }
      const filterEnd = status === "rescheduled" ? e : occ + duration;
      if (filterEnd <= nowMs) continue;
      out.push({
        reservationId: r.id,
        occurrenceDateMs: occ,
        startMs: s,
        endMs: e,
        status,
        reason,
      });
    }
  }

  out.sort((a, b) => a.startMs - b.startMs);
  return out;
}

/**
 * A saved exception, tagged with the weekday of its reservation so the client can overlay it
 * on the per-weekday preview without needing reservation ids.
 */
export interface ExistingException {
  weekday: number;
  occurrenceDateMs: number;
  isCancelled: boolean;
  newStartMs: number | null;
  newEndMs: number | null;
  reason: string | null;
}

/**
 * A staged (unsaved) per-session change. Keyed by weekday + nominal occurrence date so it survives
 * date-range edits and is resolved to a reservation server-side only when the event is saved.
 * The reason is **not** stored per-action: cancels/reschedules share a single batch reason,
 * collected once and sent with the save (see `event-sessions.tsx`).
 */
export interface SessionAction {
  weekday: number;
  occurrenceDateMs: number;
  kind: "cancel" | "reschedule" | "revert";
  newStartMs?: number;
  newEndMs?: number;
}

/**
 * Final exceptions for one weekday's reservation: saved exceptions overlaid by staged actions
 * (one per date — a staged action replaces the saved one; `revert` clears it). Used to build the
 * client-side session preview before anything is persisted. `pendingReason` is the shared batch
 * reason shown against every staged cancel/reschedule (they don't carry their own).
 */
export function effectiveExceptions(
  weekday: number,
  existing: ExistingException[],
  pending: SessionAction[],
  pendingReason: string | null = null,
): RawException[] {
  const byDate = new Map<string, RawException>();
  for (const ex of existing) {
    if (ex.weekday !== weekday) continue;
    byDate.set(utcDateKey(ex.occurrenceDateMs), {
      id: `saved-${ex.occurrenceDateMs}`,
      exceptionDateMs: ex.occurrenceDateMs,
      isCancelled: ex.isCancelled,
      newStartMs: ex.newStartMs,
      newEndMs: ex.newEndMs,
      reason: ex.reason,
      createdAtMs: 0,
    });
  }
  for (const a of pending) {
    if (a.weekday !== weekday) continue;
    const key = utcDateKey(a.occurrenceDateMs);
    if (a.kind === "revert") {
      byDate.delete(key);
    } else {
      byDate.set(key, {
        id: `staged-${a.occurrenceDateMs}`,
        exceptionDateMs: a.occurrenceDateMs,
        isCancelled: a.kind === "cancel",
        newStartMs: a.kind === "reschedule" ? (a.newStartMs ?? null) : null,
        newEndMs: a.kind === "reschedule" ? (a.newEndMs ?? null) : null,
        reason: pendingReason,
        createdAtMs: 1,
      });
    }
  }
  return [...byDate.values()];
}

/**
 * Exceptions an edit would drop: those on a **removed** weekday, or whose date falls **outside**
 * the new [startDate, endDate] range. Returns display info + the exception ids to delete.
 */
export function detectDroppedExceptions(
  reservations: RawReservation[],
  newWeekdays: Set<number>,
  startDate: string,
  endDate: string,
): { dropped: DroppedSession[]; droppedIds: string[] } {
  const dropped: DroppedSession[] = [];
  const droppedIds: string[] = [];

  for (const r of reservations) {
    const wd = weekdayOfRrule(r.rrule);
    const removed = wd == null || !newWeekdays.has(wd);
    for (const ex of r.exceptions) {
      const dk = dateKeyFromUnixMs(ex.exceptionDateMs);
      const outOfRange = dk < startDate || dk > endDate;
      if (removed || outOfRange) {
        dropped.push({
          date: dk,
          kind: ex.isCancelled ? "cancel" : "reschedule",
          reason: ex.reason,
        });
        droppedIds.push(ex.id);
      }
    }
  }
  return { dropped, droppedIds };
}
