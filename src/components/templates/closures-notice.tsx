import { closureWindowLabel } from "@/lib/closed-days/closures";
import { formatDateRange } from "@/lib/constants/closed-days";
import type { ClosedDay } from "@/lib/db/closedDays";
import { CalendarOff } from "lucide-react";

/**
 * Aviso público de los próximos cierres de La Nube (milestone 23): feriados, vacaciones y
 * cierres por horario, con su motivo. No renderiza nada si no hay ninguno, igual que la
 * sección de eventos de la portada: un aviso vacío sería ruido.
 *
 * Las fechas son de calendario locales, así que se formatean como texto (`dd/mm/aaaa`) y no
 * pasan por `Date`, que las correría de día según la zona del visitante.
 */
export function ClosuresNotice({ closures }: { closures: ClosedDay[] }) {
  if (closures.length === 0) return null;
  return (
    <aside
      aria-labelledby="closures-title"
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <h2
        id="closures-title"
        className="flex items-center gap-2 text-base font-semibold"
      >
        <CalendarOff className="h-4 w-4" aria-hidden />
        Próximos cierres
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Esos días no se pueden pedir reservas.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {closures.map((c) => (
          <li key={c.id} className="[overflow-wrap:anywhere]">
            <span className="font-medium tabular-nums">
              {formatDateRange(c.startDate, c.endDate)}
            </span>
            {c.startTime !== null ? (
              <span className="tabular-nums"> · {closureWindowLabel(c)}</span>
            ) : null}
            <span className="text-muted-foreground"> — {c.title}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
