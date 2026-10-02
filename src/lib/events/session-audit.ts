import { ADMIN_TIMEZONE } from "@/lib/admin/admin-timezone";
import { formatEventTimeRange } from "@/lib/constants/events";
import type { SessionActionInput } from "@/lib/schemas/events";

/**
 * Las sesiones tocadas en un guardado de evento, como texto para la auditoría (milestone 16):
 * "Cancelada: jue 09/07", "Reprogramada: jue 09/07 → vie 10/07 10:00–12:00".
 *
 * Se formatean en el servidor, en la zona del panel (`ADMIN_TIMEZONE`): son fechas de
 * calendario del evento — la excepción documentada al formateo del lado del cliente, igual
 * que `formatEventTimeRange`. Puro: testeable sin base.
 */
const dayFmt = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: ADMIN_TIMEZONE,
});

export function describeSessionActions(
  actions: SessionActionInput[],
): string[] {
  return actions.map((a) => {
    const day = dayFmt.format(new Date(a.occurrenceDateMs));
    switch (a.kind) {
      case "cancel":
        return `Cancelada: ${day}`;
      case "revert":
        return `Restaurada: ${day}`;
      case "reschedule":
        return `Reprogramada: ${day} → ${dayFmt.format(new Date(a.newStartMs))} ${formatEventTimeRange(a.newStartMs, a.newEndMs)}`;
    }
  });
}
