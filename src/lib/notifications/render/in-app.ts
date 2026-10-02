import type { NotificationEvent } from "../types";
import { formatMoment, formatRange } from "./format";

export interface InAppRendered {
  title: string;
  body: string;
  /** Deep-linking payload, stored as-is on the row's `data` column. */
  data?: Record<string, unknown>;
}

/**
 * Every event type must render for the in-app channel — it's the one channel every
 * recipient with an account has, so unlike email there's no "skip this type" case. Pure
 * function: no imports beyond ./format, so it's trivially unit-testable.
 */
export function renderInApp(event: NotificationEvent): InAppRendered {
  switch (event.type) {
    case "reservation.approved": {
      const d = event.data;
      const what = d.spaceName ?? d.reservationTypeName;
      return {
        title: "Reserva aprobada",
        body: `Tu reserva de ${what} para el ${formatRange(d.startTime, d.endTime)} fue aprobada.`,
        data: { reservationId: d.reservationId },
      };
    }
    case "reservation.rejected": {
      const d = event.data;
      const what = d.spaceName ?? d.reservationTypeName;
      const base = `Tu reserva de ${what} para el ${formatRange(d.startTime, d.endTime)} fue rechazada`;
      return {
        title: "Reserva rechazada",
        body: d.reason ? `${base}: ${d.reason}` : `${base}.`,
        data: { reservationId: d.reservationId },
      };
    }
    case "event.sessionChanged": {
      const d = event.data;
      if (d.kind === "cancelled") {
        const base = `La sesión del ${formatMoment(d.originalStartTime)} de "${d.eventName}" fue cancelada`;
        return {
          title: `Sesión cancelada: ${d.eventName}`,
          body: d.reason ? `${base}: ${d.reason}` : `${base}.`,
          data: { eventId: d.eventId },
        };
      }
      if (d.kind === "restored") {
        return {
          title: `Sesión restablecida: ${d.eventName}`,
          body: `La sesión del ${formatMoment(d.originalStartTime)} de "${d.eventName}" vuelve a su horario habitual.`,
          data: { eventId: d.eventId },
        };
      }
      return {
        title: `Cambio de fecha: ${d.eventName}`,
        body: `La sesión del ${formatMoment(d.originalStartTime)} de "${d.eventName}" se movió al ${formatMoment(d.newStartTime!)}.`,
        data: { eventId: d.eventId },
      };
    }
    case "news.decided": {
      const d = event.data;
      const verb = d.decision === "APPROVED" ? "aprobada" : "rechazada";
      const what =
        d.kind === "SUBMISSION"
          ? "Tu noticia"
          : d.kind === "EDIT"
            ? "Tu pedido de edición de"
            : d.kind === "PAUSE"
              ? "Tu pedido de pausa de"
              : "Tu pedido de eliminación de";
      const base = `${what} "${d.title}" fue ${verb}`;
      return {
        title: `Noticia ${verb}`,
        body: d.reason ? `${base}: ${d.reason}` : `${base}.`,
        data: { newsPostId: d.newsPostId, slug: d.slug },
      };
    }
  }
}
