import { ToneBadge } from "@/components/atoms/status-badge";
import { LocalDateTime } from "@/components/molecules/local-date";
import { Button } from "@/components/ui/button";
import type { ClosureImpactItem } from "@/lib/db/closedDayImpact";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";

/** Cuántas franjas se listan por reserva antes de resumir el resto. */
const MAX_WINDOWS = 4;

/**
 * Reservas y eventos que un día cerrado pisa (milestone 23, slice 6). Un cierre **no cancela
 * nada solo**: avisa a quien gestiona qué quedó en conflicto para que lo resuelva —cancelando
 * la reserva desde Reservas, o la sesión del evento con su motivo y aviso a los inscriptos—.
 *
 * Es un Server Component: recibe la lista ya calculada y solo usa `LocalDateTime` (cliente)
 * para mostrar las franjas en la zona del espectador.
 */
export function ClosedDayImpact({ items }: { items: ClosureImpactItem[] }) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Ninguna reserva ni evento vigente cae dentro de este cierre.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 text-sm">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden
        />
        <span>
          {items.length === 1
            ? "Hay 1 reserva o evento que cae dentro de este cierre."
            : `Hay ${items.length} reservas o eventos que caen dentro de este cierre.`}{" "}
          No se cancelan solos: resolvelos uno por uno.
        </span>
      </p>
      <ul className="divide-y rounded-lg border">
        {items.map((item) => (
          <li
            key={item.reservationId}
            className="flex flex-wrap items-start justify-between gap-3 p-3"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium [overflow-wrap:anywhere]">
                  {item.who}
                </span>
                <ToneBadge tone={item.kind === "EVENT" ? "info" : "neutral"}>
                  {item.kind === "EVENT" ? "Evento" : "Reserva"}
                </ToneBadge>
                <ToneBadge
                  tone={item.status === "APPROVED" ? "success" : "warning"}
                >
                  {item.status === "APPROVED" ? "Aprobada" : "Pendiente"}
                </ToneBadge>
                {item.isRecurring ? (
                  <ToneBadge tone="neutral">Recurrente</ToneBadge>
                ) : null}
              </div>
              {item.contact ? (
                <div className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {item.contact}
                </div>
              ) : null}
              {item.reason ? (
                <div className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {item.reason}
                </div>
              ) : null}
              <ul className="space-y-0.5 text-sm tabular-nums">
                {item.windows.slice(0, MAX_WINDOWS).map((w) => (
                  <li key={w.start}>
                    <LocalDateTime startMs={w.start} endMs={w.end} />
                  </li>
                ))}
                {item.windows.length > MAX_WINDOWS ? (
                  <li className="text-muted-foreground">
                    y {item.windows.length - MAX_WINDOWS} más
                  </li>
                ) : null}
              </ul>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link
                href={
                  item.eventId
                    ? `/admin/events/${item.eventId}?sessions=1`
                    : "/admin/reservations"
                }
              >
                {item.eventId ? "Gestionar sesiones" : "Ir a Reservas"}
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
