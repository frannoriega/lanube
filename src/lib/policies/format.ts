/**
 * Formato de las fechas del registro de políticas (`YYYY-MM-DD`, fechas calendario sin hora).
 *
 * Se formatean en UTC a propósito: son fechas, no instantes, y formatear el mediodía UTC de
 * ese día da el mismo día calendario en cualquier zona del mundo. Siempre en castellano
 * (`es-AR`), como el resto del sitio.
 */
export function formatPolicyDate(dateKey: string): string {
  return new Date(`${dateKey.slice(0, 10)}T12:00:00Z`).toLocaleDateString(
    "es-AR",
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
  );
}

/** Título partido para `SectionHeading`: todo menos la última palabra, y la última (acento). */
export function splitPolicyTitle(title: string): {
  title: string;
  accent: string;
} {
  const words = title.split(" ");
  const accent = words.pop() ?? "";
  return { title: words.join(" "), accent };
}
