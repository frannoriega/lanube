/**
 * The abstract notification system's event vocabulary — see
 * docs/milestones/milestones-13-notifications.md for the full design. A call site builds
 * one of these and hands it to `notify()` (./dispatch.ts); it never talks to a specific
 * channel (in-app, email, …) directly. Adding a new event type means adding a case here
 * and a renderer in ./render/*, not touching the dispatcher or any provider.
 *
 * Pure data, no server-only imports — safe to import from a client component for the
 * shape of what the bell receives.
 */

/** Who an event is for. Guests (no account) can only ever receive the email channel. */
export type NotificationRecipient =
  | { registeredUserId: string }
  | { email: string };

interface BaseEvent<Type extends string, Data> {
  type: Type;
  recipient: NotificationRecipient;
  data: Data;
}

export interface ReservationDecidedData {
  reservationId: string;
  /** Null for a non-space reservation type, if that's ever introduced. */
  spaceName: string | null;
  reservationTypeName: string;
  startTime: number;
  endTime: number;
  /** Only ever set for a rejection (Reservation.deniedReason). */
  reason?: string | null;
}

export interface EventSessionChangedData {
  eventId: string;
  eventName: string;
  kind: "cancelled" | "rescheduled" | "restored";
  originalStartTime: number;
  originalEndTime: number;
  /** Only set when kind === "rescheduled". */
  newStartTime?: number;
  newEndTime?: number;
  reason?: string | null;
}

export interface NewsDecidedData {
  newsPostId: string;
  title: string;
  slug: string;
  /** What was decided: the initial submission, or a request against a live post. */
  kind: "SUBMISSION" | "EDIT" | "PAUSE" | "DELETE";
  decision: "APPROVED" | "REJECTED";
  reason?: string | null;
}

/**
 * Un admin resolvió una solicitud de cambio de DNI / motivo para unirse (milestone 17).
 * `requestedValue` va en el aviso para que la persona sepa de cuál de sus pedidos se trata.
 */
export interface ProfileChangeDecidedData {
  requestId: string;
  field: "DNI" | "REASON_TO_JOIN";
  requestedValue: string;
  decision: "APPROVED" | "REJECTED";
  /** Obligatorio al rechazar; opcional al aprobar. */
  reason?: string | null;
}

export type NotificationEvent =
  | BaseEvent<"reservation.approved", ReservationDecidedData>
  | BaseEvent<"reservation.rejected", ReservationDecidedData>
  | BaseEvent<"event.sessionChanged", EventSessionChangedData>
  | BaseEvent<"news.decided", NewsDecidedData>
  | BaseEvent<"profileChange.decided", ProfileChangeDecidedData>;

export type NotificationEventType = NotificationEvent["type"];
