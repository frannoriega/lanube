/**
 * Generador de calendarios iCalendar (RFC 5545) para las suscripciones del milestone 45.
 *
 * Puro (sin base ni red) para testearlo. Decisiones:
 * - **Horas en UTC** (`20261202T130000Z`): así no hace falta un `VTIMEZONE` y cada cliente lo
 *   muestra en la zona de quien mira, como la página.
 * - **UID estable por ocurrencia**: el cliente actualiza el ítem en lugar de duplicarlo cuando
 *   cambia algo (título, estado, una sesión que se cancela).
 * - **Color** (milestone 45, decisión del usuario): `COLOR` de RFC 7986 por calendario y por ítem,
 *   con **nombres de color CSS** (lo que exige la RFC). Google, Outlook y en la práctica Apple
 *   ignoran el color por ítem en una suscripción: el color real lo da cada calendario.
 * - Texto escapado (`\\`, `;`, `,`, saltos) y líneas plegadas a 75 octetos.
 */

export type IcsStatus = "CONFIRMED" | "TENTATIVE" | "CANCELLED";

export interface IcsEvent {
  /** Único y estable; se le agrega `@lanube` si no trae dominio. */
  uid: string;
  startMs: number;
  endMs: number;
  /** Día completo (cierres): se escribe con fechas, no horas. Fechas del predio (YYYY-MM-DD). */
  allDay?: { startDate: string; endDateExclusive: string };
  summary: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  status?: IcsStatus;
  /** Nombre de color CSS (RFC 7986). */
  color?: string | null;
}

export interface IcsCalendar {
  name: string;
  description?: string | null;
  /** Nombre de color CSS del calendario entero (RFC 7986). */
  color?: string | null;
  /** Hex del mismo color, para `X-APPLE-CALENDAR-COLOR` (Apple lo lee al suscribirse). */
  appleColorHex?: string | null;
  events: IcsEvent[];
  /** Ahora (ms): `DTSTAMP` de cada ítem. */
  nowMs: number;
}

/** Escapa un TEXT de iCalendar (RFC 5545 §3.3.11). */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** `20261202T130000Z`. */
export function icsUtc(ms: number): string {
  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** Pliega una línea a 75 octetos (UTF-8), sin cortar un carácter multibyte. */
export function foldIcsLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    // La primera línea admite 75; las de continuación, 74 + el espacio inicial.
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + b > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += b;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function prop(name: string, value: string): string {
  return foldIcsLine(`${name}:${value}`);
}

/** El calendario completo, con CRLF como pide la RFC. */
export function buildIcs(cal: IcsCalendar): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//La Nube//Calendario//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    prop("NAME", escapeIcsText(cal.name)),
    prop("X-WR-CALNAME", escapeIcsText(cal.name)),
    "X-WR-TIMEZONE:America/Argentina/Buenos_Aires",
    // Cada cuánto conviene volver a leerlo. Google decide por su cuenta (horas).
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  if (cal.description) {
    lines.push(prop("DESCRIPTION", escapeIcsText(cal.description)));
    lines.push(prop("X-WR-CALDESC", escapeIcsText(cal.description)));
  }
  if (cal.color) lines.push(prop("COLOR", cal.color));
  if (cal.appleColorHex)
    lines.push(prop("X-APPLE-CALENDAR-COLOR", cal.appleColorHex));

  const stamp = icsUtc(cal.nowMs);
  for (const e of cal.events) {
    lines.push("BEGIN:VEVENT");
    lines.push(prop("UID", e.uid.includes("@") ? e.uid : `${e.uid}@lanube`));
    lines.push(`DTSTAMP:${stamp}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${e.allDay.startDate.replace(/-/g, "")}`);
      lines.push(
        `DTEND;VALUE=DATE:${e.allDay.endDateExclusive.replace(/-/g, "")}`,
      );
    } else {
      lines.push(`DTSTART:${icsUtc(e.startMs)}`);
      lines.push(`DTEND:${icsUtc(e.endMs)}`);
    }
    lines.push(prop("SUMMARY", escapeIcsText(e.summary)));
    if (e.description)
      lines.push(prop("DESCRIPTION", escapeIcsText(e.description)));
    if (e.location) lines.push(prop("LOCATION", escapeIcsText(e.location)));
    if (e.url) lines.push(prop("URL", e.url));
    lines.push(`STATUS:${e.status ?? "CONFIRMED"}`);
    // Ocupa el horario en la vista de disponibilidad (salvo cancelado).
    lines.push(`TRANSP:${e.status === "CANCELLED" ? "TRANSPARENT" : "OPAQUE"}`);
    if (e.color) lines.push(prop("COLOR", e.color));
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
