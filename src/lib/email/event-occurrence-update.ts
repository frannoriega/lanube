"use server";
import { ADMIN_TIMEZONE } from "@/lib/admin/admin-timezone";
import { SPOT_HOLDING_STATUSES } from "@/lib/constants/participants";
import { listEventParticipants } from "@/lib/db/participants";
import { ParticipantStatus } from "@/types/prisma";
import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_SERVER_HOST,
  port: process.env.SMTP_SERVER_PORT,
  secure: process.env.SMTP_SERVER_SECURE === "true",
  auth: {
    user: process.env.SMTP_SERVER_USERNAME,
    pass: process.env.SMTP_SERVER_PASSWORD,
  },
} as SMTPTransport.Options);

const FROM_EMAIL = "La Nube <no-responder@cdeluruguay.gob.ar>";
const LOGO_URL =
  "https://hbdpirnnyofbhbjx.public.blob.vercel-storage.com/email/logo.png";

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

/** "jueves 23 de julio, 10:00–13:00" in the admin timezone (event wall-clock). */
function formatSession(startMs: number, endMs: number): string {
  return `${dateFmt.format(new Date(startMs))}, ${timeFmt.format(new Date(startMs))}–${timeFmt.format(new Date(endMs))}`;
}

/** A single session change within a batch (one save can move/cancel/restore several). */
export interface OccurrenceChange {
  kind: "cancelled" | "rescheduled" | "restored";
  /** Original session window (for restored, the schedule it returns to). */
  originalStartMs: number;
  originalEndMs: number;
  /** New window (rescheduled only). */
  newStartMs?: number;
  newEndMs?: number;
}

/** All session changes from one event save, sharing a single reason. */
export interface OccurrenceBatchPayload {
  eventName: string;
  /** Shared reason for the cancels/reschedules in this batch (restores carry none). */
  reason?: string;
  changes: OccurrenceChange[];
}

/** One "<li>" line describing a change (cancel / reschedule / restore). */
function changeLine(c: OccurrenceChange): string {
  const original = formatSession(c.originalStartMs, c.originalEndMs);
  if (c.kind === "cancelled") {
    return `<li style="margin-bottom:8px;"><strong style="color:#c0392b;">Cancelada</strong> — ${original}</li>`;
  }
  if (c.kind === "restored") {
    return `<li style="margin-bottom:8px;"><strong style="color:#27ae60;">Restablecida</strong> — vuelve a su horario habitual: ${original}</li>`;
  }
  const moved = formatSession(c.newStartMs!, c.newEndMs!);
  return `<li style="margin-bottom:8px;"><strong style="color:#b9770e;">Reprogramada</strong> — ${original} → <strong>${moved}</strong></li>`;
}

/**
 * Emails every non-cancelled participant of an event **once**, summarizing all the session
 * changes from a single save (cancellations, reschedules, restores) plus the shared reason.
 * A batch save therefore sends one email per participant rather than one per changed session.
 *
 * TODO(scale): this fans out synchronously inside the request that writes the exceptions —
 * fine for the current small participant counts + Vercel's limited background-job capacity,
 * but for large events (~100+) move this to a background job/queue so the request isn't
 * blocked and partial failures can retry. See CLAUDE.md.
 */
export async function notifyEventParticipantsBatch(
  eventId: string,
  payload: OccurrenceBatchPayload,
): Promise<{ sent: number; failed: number }> {
  if (payload.changes.length === 0) return { sent: 0, failed: 0 };

  // Only participants who still hold a spot (pending or approved) get session-change notices.
  const participants = (await listEventParticipants(eventId)).filter((p) =>
    SPOT_HOLDING_STATUSES.includes(p.status as ParticipantStatus),
  );
  const baseUrl =
    process.env.NEXTAUTH_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3000";

  // Chronological, so the list reads in calendar order regardless of edit order.
  const changes = [...payload.changes].sort(
    (a, b) => a.originalStartMs - b.originalStartMs,
  );
  const single = changes.length === 1 ? changes[0] : null;

  const subject = single
    ? single.kind === "cancelled"
      ? `Sesión cancelada: ${payload.eventName} - La Nube`
      : single.kind === "restored"
        ? `Sesión restablecida: ${payload.eventName} - La Nube`
        : `Cambio de fecha: ${payload.eventName} - La Nube`
    : `Cambios en las sesiones: ${payload.eventName} - La Nube`;
  const heading = single
    ? single.kind === "cancelled"
      ? "Se canceló una sesión"
      : single.kind === "restored"
        ? "Se restableció una sesión"
        : "Se reprogramó una sesión"
    : "Cambios en las sesiones";

  const intro = single
    ? `<p style="color:#555;line-height:1.6;">Hay una novedad en <strong>${payload.eventName}</strong>:</p>`
    : `<p style="color:#555;line-height:1.6;">Hay cambios en las sesiones de <strong>${payload.eventName}</strong>:</p>`;

  const list = `<ul style="color:#555;line-height:1.6;padding-left:20px;">${changes
    .map(changeLine)
    .join("")}</ul>`;

  const reasonLine = payload.reason
    ? `<p style="color:#555;line-height:1.6;"><strong>Motivo:</strong> ${payload.reason}</p>`
    : "";

  let sent = 0;
  let failed = 0;
  for (const p of participants) {
    const to = p.displayEmail ?? p.email;
    const editLink = `${baseUrl}/forms/response/${encodeURIComponent(p.editToken)}`;
    try {
      const info = await transporter.sendMail({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="${LOGO_URL}" alt="La Nube" width="200" style="max-width:200px;height:auto;display:block;margin:0 auto;" />
        </div>
        <div style="background:#f8f9fa;padding:30px;border-radius:10px;margin-bottom:20px;">
          <h2 style="color:#333;margin-top:0;">${heading}</h2>
          ${intro}
          ${list}
          ${reasonLine}
          <div style="text-align:center;margin:30px 0;">
            <a href="${editLink}" style="background:#4E87C2;color:white;padding:15px 30px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;">
              Ver mi inscripción
            </a>
          </div>
        </div>
      </div>`,
      });
      if (info.rejected.length > 0) failed++;
      else sent++;
    } catch (error) {
      console.error("Error al notificar a participante", to, error);
      failed++;
    }
  }
  return { sent, failed };
}
