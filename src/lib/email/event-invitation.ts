import "server-only";
import { emailBaseUrl } from "@/lib/email/edit-link";
import { escapeHtml } from "@/lib/email/escape";
import { FROM_EMAIL, transporter } from "@/lib/email/transport";
import { logger } from "@/lib/logger";

const LOGO_URL =
  "https://hbdpirnnyofbhbjx.public.blob.vercel-storage.com/email/logo.png";

export interface InvitationEvent {
  name: string;
  summary: string | null;
  imageUrl: string | null;
  formSlug: string;
}

/**
 * HTML de la invitación a un evento privado (milestone 43). Puro (sin enviar) para testearlo.
 * Lleva el nombre, el copete, la imagen y el botón al formulario. **No** lleva enlace de edición:
 * todavía no hay inscripción.
 */
export function invitationHtml(event: InvitationEvent): string {
  const base = emailBaseUrl();
  const formUrl = `${base}/forms/${encodeURIComponent(event.formSlug)}`;
  const image = event.imageUrl
    ? `<img src="${escapeHtml(event.imageUrl.startsWith("http") ? event.imageUrl : `${base}${event.imageUrl}`)}" alt="" width="540" style="max-width:100%;height:auto;border-radius:8px;display:block;margin:0 auto 20px;" />`
    : "";
  const summary = event.summary?.trim()
    ? `<p style="color:#555;line-height:1.6;">${escapeHtml(event.summary.trim())}</p>`
    : "";
  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 30px;">
      <img src="${LOGO_URL}" alt="La Nube" width="200" style="max-width:200px;height:auto;display:block;margin:0 auto;" />
    </div>
    <div style="background:#f8f9fa;padding:30px;border-radius:10px;margin-bottom:20px;">
      <h2 style="color:#333;margin-top:0;">Te invitaron a ${escapeHtml(event.name)}</h2>
      ${image}
      ${summary}
      <p style="color:#555;line-height:1.6;">Es un evento con inscripción por invitación. Para anotarte, usá este mismo correo en el formulario.</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="${formUrl}" style="background:#4E87C2;color:white;padding:15px 30px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;">
          Inscribirme
        </a>
      </div>
      <p style="color:#888;font-size:12px;line-height:1.5;">Si no esperabas esta invitación, podés ignorar este correo.</p>
    </div>
  </div>`;
}

/**
 * Manda **una** invitación. Devuelve si salió (para que el llamador registre `invitedAt` solo de
 * los enviados). Nunca lanza: un correo que falla no corta la tanda.
 */
export async function sendEventInvitation(
  to: string,
  event: InvitationEvent,
): Promise<boolean> {
  try {
    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to: [to],
      subject: `Invitación: ${event.name} - La Nube`,
      html: invitationHtml(event),
    });
    return info.rejected.length === 0;
  } catch (error) {
    logger.warn("event invitation failed", {
      to,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
