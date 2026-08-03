import z from "zod";

/**
 * Valid Argentine DNI numbers currently range from ~1.000.000 to ~150.000.000.
 * We validate the numeric value against that range (integers only, no letters).
 */
export const DNI_MIN = 1_000_000;
export const DNI_MAX = 150_000_000;

const DNI_INVALID_MESSAGE = "Ingrese un DNI válido (solo números)";

/** Shared DNI validator: integer within [DNI_MIN, DNI_MAX]. */
export const dniSchema = z
  .number({ message: "Ingrese su DNI" })
  .int({ message: DNI_INVALID_MESSAGE })
  .min(DNI_MIN, { message: DNI_INVALID_MESSAGE })
  .max(DNI_MAX, { message: DNI_INVALID_MESSAGE });

/**
 * Server-side DNI validator that also accepts the value as a string (the profile
 * PUT endpoint sends `dni` serialized). Coerces to a number, then applies `dniSchema`.
 */
export const dniInputSchema = z.coerce.number().pipe(dniSchema);

/** Keep only digits from raw input (used by DNI inputs to block letters/symbols). */
export function sanitizeDni(raw: string): string {
  return raw.replace(/\D/g, "");
}
