import type { ReservationOccurrence } from "@/lib/db/resourceCalendar";

/**
 * Cómo se pinta cada reserva del calendario de un espacio (milestone 35).
 *
 * Una sola fuente para la tarjeta (`DayColumn`) y la leyenda (`CalendarLegend`): así lo que
 * dice la leyenda nunca se desfasa de lo que se dibuja. La tarjeta ya no lleva íconos ni
 * horario — el color ES el estado, y el detalle se abre al tocarla.
 *
 * Todos los fondos van con `text-white` y miden ≥ 4.5:1 (F2.5c del milestone 10): son los
 * mismos tonos -700 que antes.
 */
export type OccurrenceTone =
  | "own-approved"
  | "own-pending"
  | "own-rejected"
  | "own-cancelled"
  | "event"
  | "other";

export function occurrenceTone(
  occ: Pick<ReservationOccurrence, "status" | "reservableType">,
  own: boolean,
): OccurrenceTone {
  // Un evento no es una reserva más: siempre está aprobado y tiene su propio color.
  if (occ.reservableType === "EVENT") return "event";
  if (!own) return "other";
  if (occ.status === "PENDING") return "own-pending";
  if (occ.status === "REJECTED") return "own-rejected";
  if (occ.status === "CANCELLED") return "own-cancelled";
  return "own-approved";
}

export const OCCURRENCE_TONES: Record<
  OccurrenceTone,
  { bg: string; label: string }
> = {
  "own-approved": { bg: "bg-green-700", label: "Tu reserva" },
  "own-pending": { bg: "bg-amber-700", label: "Tu reserva pendiente" },
  "own-rejected": { bg: "bg-red-600", label: "Reserva rechazada" },
  "own-cancelled": { bg: "bg-gray-500", label: "Reserva cancelada" },
  event: { bg: "bg-violet-700", label: "Evento" },
  other: { bg: "bg-la-nube-selected", label: "Reservado" },
};
