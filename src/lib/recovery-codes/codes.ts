/**
 * Formato de los códigos de recuperación (milestone 17). Puro y seguro para el cliente: el
 * formulario de recuperación normaliza con lo mismo que el servidor.
 *
 * Un código son 12 símbolos del alfabeto Base32 de Crockford (sin I, L, O ni U, que se
 * confunden al copiarlos a mano), mostrados como `XXXX-XXXX-XXXX`: 60 bits de azar.
 */

/** Base32 de Crockford: 32 símbolos, sin I/L/O/U. */
export const RECOVERY_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const RECOVERY_CODE_LENGTH = 12;
/** Cuántos códigos se generan por juego. */
export const RECOVERY_CODE_COUNT = 10;

/** `ABCD1234EFGH` → `ABCD-1234-EFGH`. */
export function formatRecoveryCode(raw: string): string {
  return raw.match(/.{1,4}/g)?.join("-") ?? raw;
}

/**
 * Lleva lo que tipeó la persona a la forma canónica, o `null` si no puede ser un código.
 * Tolera minúsculas, espacios y guiones, y aplica las equivalencias de Crockford
 * (O → 0, I/L → 1), así un código copiado a mano con una "O" igual funciona.
 */
export function normalizeRecoveryCode(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (cleaned.length !== RECOVERY_CODE_LENGTH) return null;
  for (const ch of cleaned) {
    if (!RECOVERY_CODE_ALPHABET.includes(ch)) return null;
  }
  return cleaned;
}
