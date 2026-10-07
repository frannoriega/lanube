import "server-only";
import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import { listLinkableRegistrations } from "@/lib/db/participants";
import { editLinkFootnoteHtml, freshEditLinkUrl } from "@/lib/email/edit-link";
import { logger } from "@/lib/logger";

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
const LOGO_URL =
  "https://hbdpirnnyofbhbjx.public.blob.vercel-storage.com/email/logo.png";

/** Escapa texto interpolado en el HTML (el nombre del evento lo escribe un admin). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * «Pedir un enlace nuevo» (milestone 25, S5): manda **un** correo con un enlace recién emitido
 * por cada inscripción activa de ese correo en un evento que no terminó. Si no hay ninguna, no
 * manda nada — y quien llama responde lo mismo en los dos casos, para no revelar si el correo
 * estaba inscripto. Devuelve cuántos enlaces mandó (solo para el log).
 *
 * Emite los tokens **antes** de enviar: si el envío falla quedan tokens que nadie recibió, que no
 * dan acceso a nadie y vencen con el evento. Los enlaces anteriores siguen valiendo.
 */
export async function sendFreshEditLinks(
  displayEmail: string,
): Promise<number> {
  const registrations = await listLinkableRegistrations(displayEmail);
  if (registrations.length === 0) return 0;

  const items: string[] = [];
  for (const r of registrations) {
    const url = await freshEditLinkUrl(r.id);
    items.push(
      `<li style="margin-bottom:12px;"><strong>${escapeHtml(r.eventName)}</strong><br>
        <a href="${url}" style="color:#4E87C2;">Ver / editar mi inscripción</a></li>`,
    );
  }
  // Todas las filas son del mismo correo normalizado; se responde a como lo escribió la persona
  // al inscribirse (la primera), igual que los demás correos de eventos.
  const to = registrations[0].to;

  try {
    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to: [to],
      subject: "Tus enlaces de inscripción - La Nube",
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="${LOGO_URL}" alt="La Nube" width="200" style="max-width:200px;height:auto;display:block;margin:0 auto;" />
        </div>
        <div style="background:#f8f9fa;padding:30px;border-radius:10px;margin-bottom:20px;">
          <h2 style="color:#333;margin-top:0;">Tus enlaces de inscripción</h2>
          <p style="color:#555;line-height:1.6;">
            Pediste un enlace nuevo para gestionar tus inscripciones. Con cada uno podés ver,
            editar o cancelar la tuya:
          </p>
          <ul style="color:#555;line-height:1.6;padding-left:20px;">${items.join("")}</ul>
          <p style="color:#555;line-height:1.6;">
            Si no lo pediste vos, podés ignorar este correo: nadie más recibe estos enlaces.
          </p>
          ${editLinkFootnoteHtml()}
        </div>
      </div>`,
    });
    if (info.rejected.length > 0) {
      logger.warn("edit links email rejected", { count: registrations.length });
      return 0;
    }
  } catch (error) {
    logger.error("edit links email failed", error);
    return 0;
  }
  return registrations.length;
}
