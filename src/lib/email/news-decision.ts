"use server";
import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import { logger } from "@/lib/logger";

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

/** Escapes text interpolated into the email HTML (title, admin-authored reason). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function approvedHtml(title: string, editLink: string): string {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 30px;">
      <img src="${LOGO_URL}" alt="La Nube" width="200" style="max-width:200px;height:auto;display:block;margin:0 auto;" />
    </div>
    <div style="background:#f8f9fa;padding:30px;border-radius:10px;margin-bottom:20px;">
      <h2 style="color:#333;margin-top:0;">¡Tu nota fue publicada!</h2>
      <p style="color:#555;line-height:1.6;">
        <strong>${escapeHtml(title)}</strong> ya está publicada en Noticias.
      </p>
      <div style="text-align:center;margin:30px 0;">
        <a href="${editLink}" style="background:#4E87C2;color:white;padding:15px 30px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;">
          Ver la nota
        </a>
      </div>
    </div>
  </div>`;
}

function rejectedHtml(title: string, reason: string | null): string {
  const reasonBlock = reason
    ? `<p style="color:#555;line-height:1.6;"><strong>Motivo:</strong> ${escapeHtml(reason)}</p>`
    : `<p style="color:#555;line-height:1.6;">No pudimos publicarla en su forma actual. Podés editarla y volver a enviarla a revisión.</p>`;
  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 30px;">
      <img src="${LOGO_URL}" alt="La Nube" width="200" style="max-width:200px;height:auto;display:block;margin:0 auto;" />
    </div>
    <div style="background:#f8f9fa;padding:30px;border-radius:10px;margin-bottom:20px;">
      <h2 style="color:#333;margin-top:0;">Novedades sobre tu nota</h2>
      <p style="color:#555;line-height:1.6;">
        Tu nota <strong>${escapeHtml(title)}</strong> no fue aprobada para publicación.
      </p>
      ${reasonBlock}
    </div>
  </div>`;
}

/**
 * Emails the author of a news post the outcome of an approve/reject decision.
 * Never throws — a failed notification must not break the decision endpoint
 * that triggered it; failures are logged instead.
 */
export async function notifyNewsDecision(
  to: string,
  title: string,
  postId: string,
  decision: "APPROVED" | "REJECTED",
  reason: string | null,
): Promise<void> {
  const baseUrl =
    process.env.NEXTAUTH_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3000";
  const subject =
    decision === "APPROVED"
      ? `Nota publicada: ${title} - La Nube`
      : `Nota no publicada: ${title} - La Nube`;
  const html =
    decision === "APPROVED"
      ? approvedHtml(title, `${baseUrl}/admin/news/${postId}`)
      : rejectedHtml(title, reason);

  try {
    await transporter.sendMail({ from: FROM_EMAIL, to: [to], subject, html });
  } catch (error) {
    logger.warn("news decision notification failed", {
      to,
      postId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
