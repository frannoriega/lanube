import "server-only";
import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { NotificationEvent, NotificationRecipient } from "../types";
import type { NotificationProvider } from "../provider";
import { renderEmail } from "../render/email";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_SERVER_HOST,
  port: process.env.SMTP_SERVER_PORT,
  secure: process.env.SMTP_SERVER_SECURE === "true",
  // Ver el comentario de `requireTLS` en reset.ts: sin TLS no se envían credenciales.
  requireTLS: process.env.NODE_ENV === "production",
  auth: {
    user: process.env.SMTP_SERVER_USERNAME,
    pass: process.env.SMTP_SERVER_PASSWORD,
  },
} as SMTPTransport.Options);

const FROM_EMAIL = "La Nube <no-responder@cdeluruguay.gob.ar>";

async function resolveEmail(
  recipient: NotificationRecipient,
): Promise<string | null> {
  if ("email" in recipient) return recipient.email;
  const registered = await prisma.registeredUser.findUnique({
    where: { id: recipient.registeredUserId },
    select: { user: { select: { email: true, displayEmail: true } } },
  });
  if (!registered) return null;
  return registered.user.displayEmail ?? registered.user.email;
}

/**
 * Sends the email channel. Skips silently (not an error) when the event type has no email
 * defined (`renderEmail` returns null) or the recipient has no resolvable address.
 */
export const emailProvider: NotificationProvider = {
  channel: "email",
  async send(event: NotificationEvent) {
    const rendered = renderEmail(event);
    if (!rendered) return;
    const to = await resolveEmail(event.recipient);
    if (!to) return;
    try {
      await transporter.sendMail({
        from: FROM_EMAIL,
        to: [to],
        subject: rendered.subject,
        html: rendered.html,
      });
    } catch (err) {
      logger.warn("notifications/email", {
        type: event.type,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};
