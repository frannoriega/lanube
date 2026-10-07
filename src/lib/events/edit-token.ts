import { createHash, randomBytes } from "node:crypto";

/**
 * Enlaces de edición de una inscripción (milestone 25, S5 — opción «C» elegida por el usuario).
 *
 * Un enlace `/forms/response/<token>` es una credencial portadora: quien lo tiene ve, edita o
 * cancela esa inscripción. Por eso:
 *
 * - En la base se guarda **solo el SHA-256** del token (tabla `event_participant_edit_tokens`),
 *   nunca el token. Con 256 bits de azar un hash rápido alcanza (mismo criterio que los tokens de
 *   reseteo y los del servidor OAuth): no hay diccionario que probar y se puede buscar por índice.
 * - Como el enlace no se puede volver a armar desde la base, **cada correo que lleva enlace emite
 *   un token nuevo** (`issueEditToken` en `db/participants.ts`). Los anteriores **siguen
 *   valiendo**: se descartó rotar (invalidar los viejos en cada correo) porque rompía el enlace
 *   del correo de inscripción con cada cambio de sesión y abría carreras entre envíos.
 * - Todos los tokens de una inscripción **vencen cuando termina el evento** (`editLinkExpired`):
 *   ahí ya no hay nada que editar, y acota la vida de un enlace filtrado.
 *
 * Este módulo es puro (solo `node:crypto`), testeado en `edit-token.test.ts`.
 */

/** Un token nuevo: 256 bits de azar en base64url (43 caracteres, seguro en una URL). */
export function generateEditToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * SHA-256 en hex del token, tal como se guarda en `token_hash`. Coincide con
 * `encode(sha256(convert_to(token, 'UTF8')), 'hex')` de Postgres, que es lo que usó la migración
 * `20261008100000_participant_edit_tokens` para hashear los tokens que ya existían.
 */
export function hashEditToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * ¿Ya terminó el evento, y con él la validez de sus enlaces de edición? Mismo criterio que el
 * formulario público usa para cerrarse (`getPublicForm`): pasada la última ocurrencia
 * (`recurrenceEnd`, o `endTime` si no es recurrente). Se calcula al momento de usar el enlace —
 * no se guarda un vencimiento por token— para que reprogramar el evento lo mueva solo.
 */
export function editLinkExpired(
  event: { endTime: bigint | number; recurrenceEnd: bigint | number | null },
  nowMs: number,
): boolean {
  return Number(event.recurrenceEnd ?? event.endTime) < nowMs;
}

/** Path público de un enlace de edición (el correo le antepone el origen). */
export function editLinkPath(token: string): string {
  return `/forms/response/${encodeURIComponent(token)}`;
}
