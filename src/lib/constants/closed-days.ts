/**
 * Etiquetas y formato de los días cerrados (milestone 23). Puro y seguro para el cliente: lo
 * importan la pantalla de administración, el registro de auditoría y el calendario.
 */
export const CLOSED_DAY_SOURCE_LABELS: Record<string, string> = {
  NATIONAL_SYNC: "Feriado nacional",
  MANUAL_HOLIDAY: "Feriado de la ciudad",
  MANUAL_OTHER: "Otro cierre",
};

export const CLOSED_DAY_STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: "Por revisar",
  ACTIVE: "Activo",
  DISMISSED: "Descartado",
};

/** Los orígenes que un admin puede elegir al cargar un cierre a mano. */
export const MANUAL_CLOSED_DAY_SOURCES = [
  "MANUAL_HOLIDAY",
  "MANUAL_OTHER",
] as const;

/**
 * `2026-05-25` → `25/05/2026`. Se parte el texto en lugar de pasar por `Date`: son fechas de
 * calendario locales, y un `Date` las correría de día según la zona de quien las lea.
 */
export function formatDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}/${m}/${y}`;
}

/** «25/05/2026» o «20/07/2026 al 31/07/2026». */
export function formatDateRange(startDate: string, endDate: string): string {
  return startDate === endDate
    ? formatDateKey(startDate)
    : `${formatDateKey(startDate)} al ${formatDateKey(endDate)}`;
}
