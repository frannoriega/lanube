import "server-only";
import { issueEditToken } from "@/lib/db/participants";
import { editLinkPath } from "@/lib/events/edit-token";

/**
 * Enlaces de edición de inscripciones en los correos (milestone 25, S5).
 *
 * El token se guarda hasheado, así que un enlace no se puede volver a armar desde la base: cada
 * correo que lleva uno emite un token nuevo con `issueEditToken` (los anteriores siguen valiendo
 * hasta que termina el evento). Se llama **solo cuando el correo de verdad se va a mandar** —
 * con los correos de eventos suspendidos por mantenimiento, no — para no sembrar tokens que no
 * recibe nadie (no harían daño, pero ensucian la tabla).
 */

/** Origen público de los enlaces de los correos (mismo criterio que el resto de los senders). */
export function emailBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3000"
  );
}

/** URL absoluta de un token ya emitido (el de la confirmación de inscripción). */
export function editLinkUrl(token: string): string {
  return `${emailBaseUrl()}${editLinkPath(token)}`;
}

/** Emite un token nuevo para la inscripción y devuelve su URL absoluta. */
export async function freshEditLinkUrl(participantId: string): Promise<string> {
  return editLinkUrl(await issueEditToken(participantId));
}

/**
 * Nota al pie de todo correo con enlace: que guarden el último y que hay forma de pedir otro.
 * Los enlaces viejos siguen andando, pero un correo perdido no debería dejar a nadie sin acceso.
 */
export function editLinkFootnoteHtml(): string {
  const requestUrl = `${emailBaseUrl()}/forms/response/request-link`;
  return `<p style="color:#888;font-size:12px;line-height:1.5;margin-top:20px;">
    Este enlace es personal: no lo compartas. Vale hasta que termine el evento.
    Si lo perdés, podés <a href="${requestUrl}" style="color:#4E87C2;">pedir uno nuevo</a>.
  </p>`;
}
