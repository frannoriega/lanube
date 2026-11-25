/**
 * Lista de invitados de un evento privado (milestone 43): lo puro, sin base, para testearlo.
 *
 * El admin pega una lista de emails tal como la tenga (separados por coma, punto y coma,
 * espacios o renglones; también «Nombre <mail@x>» copiado de un cliente de correo). Acá se
 * separan, se recortan y se clasifican. La **normalización** (reglas de Gmail, etc.) la hace el
 * servidor con `normalizeEmailForIdentityServer`, la misma que usan las inscripciones: así un
 * invitado y su inscripción siempre se reconocen.
 */

/** Tope de emails por pegado: evita pedidos gigantes por error (la lista puede crecer en tandas). */
export const MAX_INVITEES_PER_PASTE = 500;

/** Formato mínimo de un email (el resto lo decide la normalización del servidor). */
const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

export interface ParsedInviteeList {
  /** Emails con formato válido, sin repetir (comparando en minúsculas), en el orden pegado. */
  valid: string[];
  /** Lo que no parece un email, tal como vino. */
  invalid: string[];
  /** Repetidos dentro del mismo pegado (se cuentan, no se agregan dos veces). */
  repeated: string[];
}

/** Separa y clasifica un texto pegado con emails. */
export function parseInviteeList(text: string): ParsedInviteeList {
  // «Ana Pérez <ana@x.com>» → «ana@x.com»: lo que está entre <> es el email.
  const withoutNames = text.replace(/[^<>\n,;]*<([^<>]+)>/g, " $1 ");
  const tokens = withoutNames
    .split(/[\s,;]+/)
    .map((t) => t.trim().replace(/^mailto:/i, ""))
    .filter(Boolean);
  const seen = new Set<string>();
  const out: ParsedInviteeList = { valid: [], invalid: [], repeated: [] };
  for (const t of tokens) {
    if (!EMAIL_RE.test(t)) {
      out.invalid.push(t);
      continue;
    }
    const key = t.toLowerCase();
    if (seen.has(key)) {
      out.repeated.push(t);
      continue;
    }
    seen.add(key);
    out.valid.push(t);
  }
  return out;
}

/** Estado de un invitado en la tabla del admin. */
export type InviteeState = "registered" | "invited" | "pending";

/** «Inscripto» le gana a «Invitado el …», que le gana a «Sin enviar». */
export function inviteeState(i: {
  registered: boolean;
  invitedAt: number | null;
}): InviteeState {
  if (i.registered) return "registered";
  return i.invitedAt != null ? "invited" : "pending";
}
