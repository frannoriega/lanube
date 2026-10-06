import {
  addDaysToDateKey,
  dateKeyFromUnixMs,
  startOfDateKeyMs,
} from "@/lib/admin/admin-timezone";

/**
 * Lógica **pura** de días cerrados (milestone 23): sin base ni reloj propio, así se testea sin
 * Prisma y se comparte entre la regla de reserva (`user-rules.ts`), el calendario y el MCP.
 *
 * Un cierre es un rango de fechas locales (`startDate`..`endDate`, inclusivas, en
 * `ADMIN_TIMEZONE`) y, opcionalmente, una franja en minutos desde la medianoche local que
 * aplica **en cada día del rango**. Sin franja cierra el día completo.
 */
export type ClosureLike = {
  title: string;
  startDate: string;
  endDate: string;
  startTime: number | null;
  endTime: number | null;
};

const MINUTE_MS = 60_000;

/** Minutos en un día completo: el `endTime` máximo de una franja. */
export const MINUTES_PER_DAY = 24 * 60;

/** true si el cierre no tiene franja, es decir, cierra el día completo. */
export function isFullDayClosure(c: ClosureLike): boolean {
  return c.startTime === null || c.endTime === null;
}

/**
 * El intervalo `[desde, hasta)` en ms UTC que el cierre ocupa el día local `dateKey`, o `null`
 * si ese día no está dentro del rango.
 *
 * Se arma como «inicio del día local + minutos»: Argentina no tiene horario de verano, así que
 * un día local mide siempre 24 h y la suma es exacta. Si eso cambiara, este es el lugar a
 * revisar.
 */
export function closureIntervalOnDay(
  c: ClosureLike,
  dateKey: string,
): [number, number] | null {
  if (dateKey < c.startDate || dateKey > c.endDate) return null;
  const dayStart = startOfDateKeyMs(dateKey);
  if (isFullDayClosure(c)) {
    return [dayStart, startOfDateKeyMs(addDaysToDateKey(dateKey, 1))];
  }
  return [
    dayStart + (c.startTime as number) * MINUTE_MS,
    dayStart + (c.endTime as number) * MINUTE_MS,
  ];
}

/**
 * El primer cierre que se solapa con la ventana `[startMs, endMs)`, o `null` si ninguno.
 *
 * El llamador pasa **solo cierres activos**: este módulo no mira `status` (no todos los
 * llamadores lo tienen, y filtrar es trabajo de la consulta). Una ventana que cruza la
 * medianoche se revisa día por día; el último instante incluido es `endMs - 1`, así una
 * ventana que termina justo a las 00:00 no toca el día siguiente.
 */
export function findClosureForWindow<C extends ClosureLike>(
  startMs: number,
  endMs: number,
  closures: readonly C[],
): C | null {
  if (closures.length === 0 || !(startMs < endMs)) return null;
  const lastKey = dateKeyFromUnixMs(endMs - 1);
  for (
    let key = dateKeyFromUnixMs(startMs);
    key <= lastKey;
    key = addDaysToDateKey(key, 1)
  ) {
    for (const c of closures) {
      const interval = closureIntervalOnDay(c, key);
      if (interval && startMs < interval[1] && endMs > interval[0]) return c;
    }
  }
  return null;
}

/** `840` → `"14:00"`. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** «Todo el día» o «14:00–18:00». */
export function closureWindowLabel(c: ClosureLike): string {
  return isFullDayClosure(c)
    ? "Todo el día"
    : `${formatMinutes(c.startTime as number)}–${formatMinutes(c.endTime as number)}`;
}

/**
 * Mensaje en castellano cuando una reserva choca con un cierre. Incluye el motivo, que es para
 * lo que existe el título: que quien reserva entienda por qué no puede. La web y el asistente
 * MCP muestran el mismo texto.
 */
export function closureRejectionMessage(c: ClosureLike): string {
  return isFullDayClosure(c)
    ? `El espacio está cerrado: ${c.title}`
    : `El espacio está cerrado de ${formatMinutes(c.startTime as number)} a ${formatMinutes(c.endTime as number)}: ${c.title}`;
}
