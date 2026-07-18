import type { Prisma } from "@/generated/prisma/client";

/**
 * Booking core — shared types.
 *
 * The booking core is the app's baseline domain: reservations, the 15-minute
 * ledger, capacity/conflict checks, and the resources they book. It exposes a
 * small **operations port** (`src/core/booking`) that the rest of the app — and
 * every module — calls instead of touching reservation/ledger tables or the SQL
 * functions directly.
 *
 * End-goal (a later session): lift `src/core/booking` into a standalone,
 * independently-versioned package reusable across repos. The seams that still
 * need cutting before that are noted in README.md (actor/identity resolver,
 * resource-name reads, transaction ownership). Keeping all reservation/ledger
 * access behind this port is what makes that lift mechanical.
 */

/**
 * A Prisma client or an open transaction. Booking operations run **inside the
 * caller's transaction** when one is passed (the caller often also writes its own
 * tables in the same tx), and against the shared client otherwise.
 *
 * NOTE (extraction seam): sharing a transaction across the future package boundary
 * requires a shared PrismaClient. When booking becomes its own package this `Db`
 * type + the tx threading is the thing to redesign (e.g. a `runInTransaction`
 * owned by booking).
 */
export type Db = Prisma.TransactionClient;

/**
 * Polymorphic owner of a reservation — the `reservations.reservable_type` /
 * `reservable_id` pair. Booking never resolves the owner back to a concrete table
 * (the FK was intentionally dropped), so an owner is just an opaque type + id.
 */
export interface OwnerRef {
  /** e.g. "EVENT". Matches `reservations.reservable_type`. */
  type: string;
  /** The owning row's id, e.g. an event id. */
  id: string;
}

/** A single-occurrence override on a recurring reservation. All times UNIX ms. */
export interface OccurrenceException {
  id: string;
  exceptionDateMs: number;
  isCancelled: boolean;
  newStartMs: number | null;
  newEndMs: number | null;
  reason: string | null;
  createdAtMs: number;
}

/**
 * A reservation as booking hands it out: normalized to numbers (no BigInt), with
 * its exceptions. Callers reason about recurrence via the raw `rrule` string.
 */
export interface OwnerReservation {
  id: string;
  startMs: number;
  endMs: number;
  recurrenceEndMs: number | null;
  rrule: string | null;
  exceptions: OccurrenceException[];
}

/**
 * Everything needed to create a fully-blocking recurring reservation for an owner
 * (used by events: one weekly reservation per weekday, capacity = resource
 * capacity so the resource is fully reserved).
 */
export interface BlockingReservationSpec {
  /** Pre-generated reservation id (callers key their occurrence plans by it). */
  reservationId: string;
  owner: OwnerRef;
  /** Resource (space) id to block. */
  resourceId: string;
  /** Reservation-type code (catalog `code`). */
  typeCode: string;
  reason: string;
  startMs: number;
  endMs: number;
  rrule: string | null;
  recurrenceEndMs: number | null;
}

/** A single-occurrence exception to write (cancel or reschedule). */
export interface ExceptionSpec {
  exceptionDateMs: number;
  isCancelled: boolean;
  /** Present for reschedules. */
  newStartMs?: number | null;
  newEndMs?: number | null;
  reason: string;
}

/** New window for an existing reservation. */
export interface ReservationWindow {
  reason: string;
  startMs: number;
  endMs: number;
  recurrenceEndMs: number | null;
}

/** Stable, framework-agnostic error codes so callers own user-facing messages. */
export type BookingErrorCode =
  | "ALREADY_BOOKED"
  | "RESOURCE_NOT_FOUND"
  | "RESCHEDULE_CONFLICT";

/**
 * A domain error from the booking core. Carries a stable `code` — the core stays
 * language-neutral; callers map codes to their own (localized) messages.
 */
export class BookingError extends Error {
  code: BookingErrorCode;
  constructor(code: BookingErrorCode) {
    super(code);
    this.name = "BookingError";
    this.code = code;
  }
}
