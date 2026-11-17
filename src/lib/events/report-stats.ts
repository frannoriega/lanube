import { dateKeyFromUnixMs } from "@/lib/admin/admin-timezone";
import type { FormSchema } from "@/lib/events/form-schema";
import type { EventOccurrence } from "@/lib/events/occurrences";

/**
 * Cuentas puras de los reportes de eventos (milestone 31). Sin base ni reloj: reciben filas
 * ya cargadas y el "ahora", así se testean solas (`report-stats.test.ts`). La carga y el
 * armado están en `src/lib/db/eventReports.ts`.
 *
 * Todo se cuenta **por sesión** (como las reservas desde el milestone 25, C3): una sesión
 * cuenta en el período en que **empieza** (horario efectivo, si se reprogramó).
 */

/** Sesiones de un evento que empiezan en `[fromMs, toMs]`, separadas por estado. */
export interface SessionCounts {
  /** No canceladas que ya terminaron. */
  held: number;
  /** No canceladas que todavía no terminaron (en curso o futuras). */
  upcoming: number;
  /** Canceladas (excepción de sesión con motivo). */
  cancelled: number;
}

export function countSessions(
  occurrences: EventOccurrence[],
  fromMs: number,
  toMs: number,
  nowMs: number,
): SessionCounts {
  const out: SessionCounts = { held: 0, upcoming: 0, cancelled: 0 };
  for (const o of occurrences) {
    if (o.startMs < fromMs || o.startMs > toMs) continue;
    if (o.status === "cancelled") out.cancelled++;
    else if (o.endMs <= nowMs) out.held++;
    else out.upcoming++;
  }
  return out;
}

/** Un ingreso, con el origen de su inscripción. */
export interface CheckInRow {
  occurrenceStart: number;
  walkIn: boolean;
}

/** Asistencia de una sesión: la barra del gráfico. */
export interface SessionAttendance {
  /** Inicio nominal (la clave del check-in). */
  occurrenceStart: number;
  /** Horario efectivo, para la etiqueta. */
  startMs: number;
  endMs: number;
  registered: number;
  walkIns: number;
}

/**
 * Asistencia por sesión: una fila por sesión **que ya empezó** y no está cancelada, en orden.
 * Una sesión que solo sobrevive en sus check-ins (la reserva se podó por la retención de
 * 12 meses, o se quitó ese día de la semana del evento) se agrega igual, con su inicio
 * nominal como horario: la asistencia registrada nunca se pierde del gráfico.
 */
export function attendanceBySession(
  occurrences: EventOccurrence[],
  checkIns: CheckInRow[],
  nowMs: number,
): SessionAttendance[] {
  const rows = new Map<number, SessionAttendance>();
  for (const o of occurrences) {
    if (o.status === "cancelled" || o.startMs > nowMs) continue;
    rows.set(o.occurrenceDateMs, {
      occurrenceStart: o.occurrenceDateMs,
      startMs: o.startMs,
      endMs: o.endMs,
      registered: 0,
      walkIns: 0,
    });
  }
  for (const c of checkIns) {
    let row = rows.get(c.occurrenceStart);
    if (!row) {
      row = {
        occurrenceStart: c.occurrenceStart,
        startMs: c.occurrenceStart,
        endMs: c.occurrenceStart,
        registered: 0,
        walkIns: 0,
      };
      rows.set(c.occurrenceStart, row);
    }
    if (c.walkIn) row.walkIns++;
    else row.registered++;
  }
  return [...rows.values()].sort((a, b) => a.startMs - b.startMs);
}

/** Un punto de la curva de inscripciones: total acumulado al cierre de cada día. */
export interface CurvePoint {
  day: string; // YYYY-MM-DD, en la hora del predio
  total: number;
}

/**
 * Curva acumulada de inscripciones por día (en la hora del predio), del primer día con una
 * inscripción al último. Los días sin inscripciones repiten el total (la curva no baja).
 */
export function registrationCurve(createdAt: number[]): CurvePoint[] {
  if (createdAt.length === 0) return [];
  const perDay = new Map<string, number>();
  for (const ms of createdAt) {
    const k = dateKeyFromUnixMs(ms);
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const days = [...perDay.keys()].sort();
  const out: CurvePoint[] = [];
  let total = 0;
  for (let d = days[0]; d <= days[days.length - 1]; d = nextDateKey(d)) {
    total += perDay.get(d) ?? 0;
    out.push({ day: d, total });
  }
  return out;
}

function nextDateKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

/** Cuántas personas eligieron cada opción de una pregunta de opciones. */
export interface ChoiceDistribution {
  fieldId: string;
  label: string;
  /** Respuestas (personas que contestaron). */
  answered: number;
  options: { option: string; count: number }[];
}

/**
 * Totales de las preguntas de opciones **de primer nivel** del formulario (selección única,
 * múltiple y casilla). Las que están dentro de un grupo quedan afuera: en un grupo repetible
 * cada integrante contesta, y contarlas por inscripción mezclaría personas con grupos (el
 * campo «Participante» del milestone 34 lo resolvería). Las opciones van en el orden del
 * formulario; una respuesta que ya no es una opción (se editó la plantilla) se suma al final.
 */
export function choiceDistributions(
  schema: FormSchema | null,
  answers: unknown[],
): ChoiceDistribution[] {
  if (!schema) return [];
  const out: ChoiceDistribution[] = [];
  for (const node of schema.nodes) {
    if (node.kind !== "input") continue;
    const isBool = node.type === "BOOLEAN";
    if (
      !isBool &&
      node.type !== "SINGLE_SELECT" &&
      node.type !== "MULTI_SELECT"
    )
      continue;
    const counts = new Map<string, number>();
    const options = isBool ? ["Sí", "No"] : (node.options ?? []);
    for (const o of options) counts.set(o, 0);
    let answered = 0;
    for (const a of answers) {
      const v =
        a && typeof a === "object"
          ? (a as Record<string, unknown>)[node.id]
          : undefined;
      const picked: string[] = isBool
        ? typeof v === "boolean"
          ? [v ? "Sí" : "No"]
          : []
        : Array.isArray(v)
          ? v.filter((x): x is string => typeof x === "string")
          : typeof v === "string" && v
            ? [v]
            : [];
      if (picked.length === 0) continue;
      answered++;
      for (const p of picked) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    out.push({
      fieldId: node.id,
      label: node.label,
      answered,
      options: [...counts.entries()].map(([option, count]) => ({
        option,
        count,
      })),
    });
  }
  return out;
}

/** Porcentaje entero, o `null` si el denominador es 0 (se muestra «—», no «0 %»). */
export function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}
