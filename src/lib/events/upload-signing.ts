/**
 * Firma de los descriptores de archivo de participantes (milestone 25, S2).
 *
 * El descriptor `{ url, name, size, type }` que devuelve la subida vuelve al servidor dentro de
 * la respuesta del formulario, o sea que es **entrada del cliente**. Antes se aceptaba cualquier
 * `url`: con el storage local, `local-private:../../.env` leía cualquier archivo; con Vercel Blob,
 * un pathname inventado leía cualquier blob privado del store (que prod y preview comparten). El
 * proxy de admin solo exigía que la URL estuviera en alguna respuesta del evento — y el atacante
 * la había puesto ahí.
 *
 * Ahora la subida firma el descriptor con un HMAC atado al evento, y el envío/edición solo acepta
 * descriptores con firma válida (o los que ya estaban guardados en esa misma inscripción). Usa
 * `NEXTAUTH_SECRET`, que ya es obligatorio: no agrega una variable de entorno que configurar.
 *
 * Sin `server-only` para poder testearlo con Vitest; solo lo importa código de servidor.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { UploadedFile } from "@/lib/events/form-schema";

function signingSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      "NEXTAUTH_SECRET no está configurado: no se pueden firmar archivos",
    );
  }
  return secret;
}

/** Lo que cubre la firma: el evento y todos los campos que el proxy o el admin usan. */
function payload(file: UploadedFile, eventId: string): string {
  return JSON.stringify([
    "participant-upload",
    eventId,
    file.url,
    file.name,
    file.size,
    file.type,
  ]);
}

export function computeUploadSignature(
  file: UploadedFile,
  eventId: string,
  secret: string = signingSecret(),
): string {
  return createHmac("sha256", secret)
    .update(payload(file, eventId))
    .digest("base64url");
}

/** Devuelve el descriptor con su firma (`sig`). */
export function signUploadedFile(
  file: Omit<UploadedFile, "sig">,
  eventId: string,
  secret?: string,
): UploadedFile {
  return { ...file, sig: computeUploadSignature(file, eventId, secret) };
}

/** ¿La firma corresponde a este descriptor y a este evento? Comparación en tiempo constante. */
export function verifyUploadedFile(
  file: UploadedFile,
  eventId: string,
  secret?: string,
): boolean {
  if (typeof file.sig !== "string" || typeof file.size !== "number") {
    return false;
  }
  const expected = Buffer.from(computeUploadSignature(file, eventId, secret));
  const given = Buffer.from(file.sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
