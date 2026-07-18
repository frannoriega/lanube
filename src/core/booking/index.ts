import {
  assertWindowFree,
  clearOccurrenceExceptions,
  createBlockingReservation,
  deleteReservationsForOwner,
  getResourceCapacity,
  listOwnersWithExceptions,
  listReservationsForOwner,
  rebuildLedger,
  removeReservation,
  setOccurrenceException,
  updateReservationWindow,
} from "./reservations";

/**
 * Booking core — the app's baseline reservation domain, exposed as a single
 * operations port. Modules and app code call `booking.*` instead of touching
 * reservation/ledger tables or SQL functions directly.
 *
 * Server-only (touches the database). See ./README.md for the extraction plan.
 */
export const booking = {
  getResourceCapacity,
  createBlockingReservation,
  deleteReservationsForOwner,
  removeReservation,
  updateReservationWindow,
  listReservationsForOwner,
  listOwnersWithExceptions,
  rebuildLedger,
  assertWindowFree,
  setOccurrenceException,
  clearOccurrenceExceptions,
};

export type BookingPort = typeof booking;

export {
  BookingError,
  type BookingErrorCode,
  type BlockingReservationSpec,
  type Db,
  type ExceptionSpec,
  type OccurrenceException,
  type OwnerRef,
  type OwnerReservation,
  type ReservationWindow,
} from "./types";
