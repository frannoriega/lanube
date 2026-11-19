import { Skeleton } from "@/components/ui/skeleton";
import { DISPLAY_HOURS } from "./calendar-utils";

/**
 * Esqueleto de la grilla del calendario de un espacio mientras llegan sus reservas (milestone
 * 35): la misma estructura (columna de horas + una columna por día, con las líneas de hora) y
 * unas tarjetas fantasma que pulsan. Sin esto la grilla aparecía vacía —como si todo estuviera
 * libre— hasta que respondía la API.
 */
export function CalendarSkeleton({ columns }: { columns: number }) {
  const hours = DISPLAY_HOURS.END - DISPLAY_HOURS.START;
  return (
    <div
      className="relative mb-8 flex gap-0"
      role="status"
      aria-live="polite"
      aria-label="Cargando las reservas"
    >
      <div className="w-14 flex-shrink-0" />
      <div
        className="grid flex-1 gap-0"
        style={{
          minHeight: "600px",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: columns }, (_, c) => (
          <div
            key={c}
            className="relative border-l border-gray-200 px-1 dark:border-gray-700"
          >
            {Array.from({ length: hours - 1 }, (_, h) => (
              <div
                key={h}
                className="absolute left-0 w-full border-t border-gray-200 dark:border-gray-700"
                style={{ top: `${((h + 1) / hours) * 100}%` }}
              />
            ))}
            {/* Tarjetas fantasma en posiciones distintas por columna, para que no parezca una grilla. */}
            <Skeleton
              className="absolute left-1 right-1 rounded"
              style={{
                top: `${8 + ((c * 17) % 40)}%`,
                height: `${9 + ((c * 5) % 8)}%`,
              }}
            />
            {c % 2 === 0 && (
              <Skeleton
                className="absolute left-1 right-1 rounded"
                style={{ top: `${58 + ((c * 7) % 20)}%`, height: "8%" }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
