/**
 * Firma de los enlaces de suscripción de calendario (milestone 45).
 *
 * Un enlace de suscripción lo abre Google (o Apple, Outlook) **sin sesión**, así que lleva su
 * propia credencial: una firma HMAC-SHA256 con `NEXTAUTH_SECRET` (ya obligatorio; mismo criterio
 * que `upload-signing.ts`). No hay tabla de tokens:
 *
 * - Feeds de una persona: la firma cubre su id, el feed y `calendarFeedVersion`. «Regenerar
 *   enlaces» sube la versión y todos los anteriores dejan de valer; apagar las suscripciones
 *   (`calendarFeedEnabled = false`) los apaga sin cambiar la versión.
 * - Feed de una inscripción (el del correo de confirmación): la firma cubre el id de la
 *   inscripción. Solo muestra el calendario de ese evento y no permite cambiar nada —por eso no se
 *   usa el enlace de edición, que sí es una credencial para editar—.
 *
 * Rotar `NEXTAUTH_SECRET` invalida todas las suscripciones (hay que volver a agregarlas).
 * Sin `server-only` para poder testearlo; solo lo importa código de servidor.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET no está configurado");
  return s;
}

function sign(parts: (string | number)[], key: string): string {
  return createHmac("sha256", key)
    .update(JSON.stringify(["calendar-feed", ...parts]))
    .digest("base64url")
    .slice(0, 32);
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function userFeedSignature(
  registeredUserId: string,
  feed: string,
  version: number,
  key: string = secret(),
): string {
  return sign(["user", registeredUserId, feed, version], key);
}

export function verifyUserFeedSignature(
  registeredUserId: string,
  feed: string,
  version: number,
  signature: string,
  key: string = secret(),
): boolean {
  return safeEqual(
    userFeedSignature(registeredUserId, feed, version, key),
    signature,
  );
}

export function registrationFeedSignature(
  participantId: string,
  key: string = secret(),
): string {
  return sign(["registration", participantId], key);
}

export function verifyRegistrationFeedSignature(
  participantId: string,
  signature: string,
  key: string = secret(),
): boolean {
  return safeEqual(registrationFeedSignature(participantId, key), signature);
}

/** Feeds de una persona: los propios y, para admins, uno por espacio. */
export type UserFeedKind = "reservations" | "events" | `space-${string}`;

export function isUserFeedKind(v: string): v is UserFeedKind {
  return v === "reservations" || v === "events" || /^space-[\w-]+$/.test(v);
}

/** Ruta pública (sin origen) del feed de una persona. */
export function userFeedPath(
  registeredUserId: string,
  feed: UserFeedKind,
  version: number,
): string {
  return `/api/calendar/feed/${registeredUserId}/${feed}/${userFeedSignature(registeredUserId, feed, version)}.ics`;
}

/** Ruta pública (sin origen) del feed de una inscripción. */
export function registrationFeedPath(participantId: string): string {
  return `/api/calendar/registration/${participantId}/${registrationFeedSignature(participantId)}.ics`;
}

/**
 * Enlaces para agregar una suscripción: el de Google (abre «Agregar calendario» con la URL) y el
 * `webcal://` (Apple, Outlook, Thunderbird lo abren como suscripción).
 */
export function subscribeLinks(absoluteHttpsUrl: string): {
  google: string;
  webcal: string;
} {
  const webcal = absoluteHttpsUrl.replace(/^https?:\/\//, "webcal://");
  return {
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
    webcal,
  };
}
