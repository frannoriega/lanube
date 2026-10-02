import type { NotificationEvent } from "../types";
import { formatRange } from "./format";

export interface EmailRendered {
  subject: string;
  html: string;
}

const LOGO_URL =
  "https://hbdpirnnyofbhbjx.public.blob.vercel-storage.com/email/logo.png";

function shell(heading: string, bodyHtml: string): string {
  return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="${LOGO_URL}" alt="La Nube" width="200" style="max-width:200px;height:auto;display:block;margin:0 auto;" />
        </div>
        <div style="background:#f8f9fa;padding:30px;border-radius:10px;margin-bottom:20px;">
          <h2 style="color:#333;margin-top:0;">${heading}</h2>
          ${bodyHtml}
        </div>
      </div>`;
}

const p = (text: string) =>
  `<p style="color:#555;line-height:1.6;">${text}</p>`;

/**
 * Renders the email channel's subject + HTML for an event, or `null` when this event type
 * doesn't define an email (yet, or on purpose).
 *
 * `event.sessionChanged` returns `null` here deliberately: `notifyEventParticipantsBatch`
 * (src/lib/email/event-occurrence-update.ts) already sends ONE batched email per participant
 * covering every change from a save, which this per-event renderer can't reproduce without
 * re-batching — so that call site keeps its own bespoke email send and only routes the
 * in-app channel through `notify()`. See the milestone doc for the full rationale.
 */
export function renderEmail(event: NotificationEvent): EmailRendered | null {
  switch (event.type) {
    case "reservation.approved": {
      const d = event.data;
      const what = d.spaceName ?? d.reservationTypeName;
      return {
        subject: "Reserva aprobada - La Nube",
        html: shell(
          "Tu reserva fue aprobada",
          p(
            `Tu reserva de <strong>${what}</strong> para el ${formatRange(d.startTime, d.endTime)} fue <strong style="color:#27ae60;">aprobada</strong>.`,
          ),
        ),
      };
    }
    case "reservation.rejected": {
      const d = event.data;
      const what = d.spaceName ?? d.reservationTypeName;
      const reasonHtml = d.reason
        ? p(`<strong>Motivo:</strong> ${d.reason}`)
        : "";
      return {
        subject: "Reserva rechazada - La Nube",
        html: shell(
          "Tu reserva fue rechazada",
          p(
            `Tu reserva de <strong>${what}</strong> para el ${formatRange(d.startTime, d.endTime)} fue <strong style="color:#c0392b;">rechazada</strong>.`,
          ) + reasonHtml,
        ),
      };
    }
    case "event.sessionChanged":
      return null;
    case "news.decided": {
      const d = event.data;
      const approved = d.decision === "APPROVED";
      const verb = approved ? "aprobada" : "rechazada";
      const what =
        d.kind === "SUBMISSION"
          ? "tu noticia"
          : d.kind === "EDIT"
            ? "tu pedido de edición de"
            : d.kind === "PAUSE"
              ? "tu pedido de pausa de"
              : "tu pedido de eliminación de";
      const reasonHtml = d.reason
        ? p(`<strong>Motivo:</strong> ${d.reason}`)
        : "";
      return {
        subject: `Noticia ${verb} - La Nube`,
        html: shell(
          `Noticia ${verb}`,
          p(
            `Se ${verb === "aprobada" ? "aprobó" : "rechazó"} ${what} <strong>"${d.title}"</strong>.`,
          ) + reasonHtml,
        ),
      };
    }
  }
}
