"use server";
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

export interface DecisionRecipient {
  email: string;
  displayEmail: string | null;
  editToken: string;
}

/** Escapes text interpolated into the email HTML (admin-authored reason). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function approvedHtml(eventName: string, editLink: string): string {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 30px;">
      <img src="${LOGO_URL}" alt="La Nube" width="200" style="max-width:200px;height:auto;display:block;margin:0 auto;" />
    </div>
    <div style="background:#f8f9fa;padding:30px;border-radius:10px;margin-bottom:20px;">
      <h2 style="color:#333;margin-top:0;">¡Tu inscripción fue aprobada!</h2>
      <p style="color:#555;line-height:1.6;">
        Confirmamos tu lugar en <strong>${escapeHtml(eventName)}</strong>. ¡Te esperamos!
      </p>
      <div style="text-align:center;margin:30px 0;">
        <a href="${editLink}" style="background:#4E87C2;color:white;padding:15px 30px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;">
          Ver mi inscripción
        </a>
      </div>
    </div>
  </div>`;
}

function rejectedHtml(eventName: string, reason: string | null): string {
  const reasonBlock = reason
    ? `<p style="color:#555;line-height:1.6;"><strong>Motivo:</strong> ${escapeHtml(reason)}</p>`
    : `<p style="color:#555;line-height:1.6;">Recibimos muchas inscripciones y en esta ocasión no pudimos confirmar tu lugar. Gracias por tu interés; esperamos verte en próximos eventos.</p>`;
  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 30px;">
      <img src="${LOGO_URL}" alt="La Nube" width="200" style="max-width:200px;height:auto;display:block;margin:0 auto;" />
    </div>
    <div style="background:#f8f9fa;padding:30px;border-radius:10px;margin-bottom:20px;">
      <h2 style="color:#333;margin-top:0;">Novedades sobre tu inscripción</h2>
      <p style="color:#555;line-height:1.6;">
        Lamentablemente no pudimos confirmar tu lugar en
        <strong>${escapeHtml(eventName)}</strong>.
      </p>
      ${reasonBlock}
    </div>
  </div>`;
}

/**
 * Emails a batch of participants the outcome of an approval decision (one email each).
 * Approvals link back to the editable registration; rejections show the shared reason if given,
 * otherwise a neutral generic message.
 *
 * TODO(scale): fans out synchronously in the request, like notifyEventParticipantsBatch. Fine at
 * current participant counts; move to a queue at ~100+. See CLAUDE.md / notifications-sync note.
 */
export async function notifyParticipantsDecision(
  eventName: string,
  decision: "approve" | "reject",
  reason: string | null,
  recipients: DecisionRecipient[],
): Promise<{ sent: number; failed: number }> {
  if (recipients.length === 0) return { sent: 0, failed: 0 };

  const baseUrl =
    process.env.NEXTAUTH_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3000";

  const subject =
    decision === "approve"
      ? `Inscripción aprobada: ${eventName} - La Nube`
      : `Inscripción no confirmada: ${eventName} - La Nube`;

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const to = r.displayEmail ?? r.email;
    const editLink = `${baseUrl}/forms/response/${encodeURIComponent(r.editToken)}`;
    const html =
      decision === "approve"
        ? approvedHtml(eventName, editLink)
        : rejectedHtml(eventName, reason);
    try {
      const info = await transporter.sendMail({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      });
      if (info.rejected.length > 0) failed++;
      else sent++;
    } catch (error) {
      console.error("Error al notificar decisión a participante", to, error);
      failed++;
    }
  }
  return { sent, failed };
}
