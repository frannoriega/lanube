import { cn } from "@/lib/utils";
import { OCCURRENCE_TONES, type OccurrenceTone } from "./occurrence-style";

/** Los tonos que siempre se explican; rechazada y cancelada solo si hay alguna a la vista. */
const ALWAYS: OccurrenceTone[] = ["own-approved", "own-pending", "event"];

/**
 * Leyenda del calendario de reservas (milestone 35): como las tarjetas ya no muestran ícono
 * de estado, el color es lo único que dice «aprobada» o «pendiente» — acá se explica.
 */
export function CalendarLegend({
  present,
}: {
  /** Tonos de las reservas que se están viendo. */
  present: Set<OccurrenceTone>;
}) {
  const tones = (
    [
      "own-approved",
      "own-pending",
      "own-rejected",
      "own-cancelled",
      "event",
    ] as const
  ).filter((t) => ALWAYS.includes(t) || present.has(t));
  return (
    <ul
      className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
      aria-label="Referencias de colores"
    >
      {tones.map((t) => (
        <li key={t} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn(
              "inline-block h-3 w-3 rounded-sm",
              OCCURRENCE_TONES[t].bg,
            )}
          />
          {OCCURRENCE_TONES[t].label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        {/* El rayado con estilo en línea: las clases arbitrarias de Tailwind con `_` no lo
            dibujaban en este tamaño y el cuadrito salía vacío. */}
        <span
          aria-hidden="true"
          className="inline-block h-3 w-3 rounded-sm border border-border text-gray-400 dark:text-gray-500"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
          }}
        />
        No disponible
      </li>
    </ul>
  );
}
