"use client";

import { LocalDate, LocalDateTime } from "@/components/molecules/local-date";
import { Button } from "@/components/ui/button";
import type { EventOccurrence } from "@/lib/events/occurrences";
import {
  summarizeSchedule,
  type ScheduleSummary,
} from "@/lib/events/schedule-summary";
import { cn } from "@/lib/utils";
import { CalendarRange, ChevronDown, Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Fact } from "./event-fact";

/**
 * Piezas de cronograma de la página pública de un evento (milestone 17).
 *
 * El resumen se calcula **en el cliente** porque depende de la zona horaria del visitante
 * (las sesiones viajan en UTC ms). En el HTML del servidor, y hasta hidratar, se ve un
 * renglón vacío del mismo alto — igual que `LocalDate`, para no producir un desajuste de
 * hidratación entre la hora del servidor y la del navegador.
 */
function useScheduleSummary(occurrences: EventOccurrence[]) {
  const [summary, setSummary] = useState<ScheduleSummary | null>(null);
  useEffect(() => setSummary(summarizeSchedule(occurrences)), [occurrences]);
  return summary;
}

/**
 * Los dos renglones de "Cuándo" de la ficha lateral: las franjas ("Lunes y jueves · 10:00 –
 * 13:00") y el rango con la cantidad de sesiones.
 */
export function EventScheduleFacts({
  occurrences,
}: {
  occurrences: EventOccurrence[];
}) {
  const summary = useScheduleSummary(occurrences);

  return (
    <>
      <Fact icon={Clock} label="Horario">
        {summary ? (
          summary.slots.length > 0 ? (
            summary.slots.map((s) => <span key={s.label}>{s.label}</span>)
          ) : (
            <span>Sin sesiones programadas</span>
          )
        ) : (
          <span aria-hidden>&nbsp;</span>
        )}
      </Fact>
      <Fact icon={CalendarRange} label="Fechas">
        {summary ? (
          <>
            {summary.rangeLabel && <span>{summary.rangeLabel}</span>}
            <span className="text-muted-foreground">
              {summary.total} {summary.total === 1 ? "sesión" : "sesiones"}
              {summary.cancelled > 0 &&
                ` · ${summary.cancelled} ${summary.cancelled === 1 ? "cancelada" : "canceladas"}`}
            </span>
          </>
        ) : (
          <span aria-hidden>&nbsp;</span>
        )}
      </Fact>
    </>
  );
}

/** Cuántas sesiones se ven antes de "Ver todas". */
const PREVIEW_COUNT = 4;

/**
 * Lista de sesiones. Antes era una caja de ancho completo por fecha (trece cajas iguales en
 * un taller de siete semanas); ahora es una sola tarjeta con renglones divididos, que muestra
 * de entrada las próximas `PREVIEW_COUNT` (desde la próxima a dictarse) y despliega el resto
 * con "Ver todas". Las canceladas y reprogramadas mantienen sus marcas.
 *
 * `nowMs` llega del servidor (`nowMs()` respeta libfaketime) para que "próxima" y "pasada"
 * coincidan con el reloj de la app, no con el del navegador.
 */
export function EventSessionList({
  occurrences,
  nowMs,
}: {
  occurrences: EventOccurrence[];
  nowMs: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const nextIdx = useMemo(
    () =>
      occurrences.findIndex(
        (o) => o.status !== "cancelled" && o.startMs > nowMs,
      ),
    [occurrences, nowMs],
  );

  // Vista previa: desde la próxima sesión (o las últimas, si el evento ya terminó).
  const previewStart =
    nextIdx >= 0 ? nextIdx : Math.max(0, occurrences.length - PREVIEW_COUNT);
  const visible = expanded
    ? occurrences
    : occurrences.slice(previewStart, previewStart + PREVIEW_COUNT);
  const hidden = occurrences.length - visible.length;

  return (
    <div className="flex flex-col gap-3">
      <ol className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">
        {visible.map((occ) => {
          const idx = occurrences.indexOf(occ);
          return (
            <SessionRow
              key={`${occ.reservationId}-${occ.occurrenceDateMs}`}
              occ={occ}
              isNext={idx === nextIdx}
              isPast={occ.endMs <= nowMs}
            />
          );
        })}
      </ol>
      {(hidden > 0 || expanded) && occurrences.length > PREVIEW_COUNT && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start text-la-nube-selected dark:text-la-nube-secondary"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded
            ? "Ver menos"
            : `Ver todas las sesiones (${occurrences.length})`}
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </Button>
      )}
    </div>
  );
}

function SessionRow({
  occ,
  isNext,
  isPast,
}: {
  occ: EventOccurrence;
  isNext: boolean;
  isPast: boolean;
}) {
  const isCancelled = occ.status === "cancelled";
  const isRescheduled = occ.status === "rescheduled";

  return (
    <li
      className={cn(
        "flex flex-col gap-1 px-4 py-3 text-sm",
        isNext && "bg-la-nube-primary/5 dark:bg-la-nube-primary/10",
        isPast && !isCancelled && !isNext && "text-muted-foreground",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {isNext && (
          <span className="rounded-full bg-la-nube-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-la-nube-selected dark:text-la-nube-secondary">
            Próxima
          </span>
        )}
        {isCancelled ? (
          <span className="line-through opacity-70">
            <LocalDateTime
              startMs={occ.occurrenceDateMs}
              endMs={occ.occurrenceDateMs + (occ.endMs - occ.startMs)}
            />
          </span>
        ) : isRescheduled ? (
          <span className="flex flex-wrap items-center gap-2">
            {/* De una reprogramada sólo se conoce la fecha original, no su horario. */}
            <span className="line-through opacity-70">
              <LocalDate ms={occ.occurrenceDateMs} />
            </span>
            <span className="text-muted-foreground">→</span>
            <LocalDateTime startMs={occ.startMs} endMs={occ.endMs} />
          </span>
        ) : (
          <LocalDateTime startMs={occ.startMs} endMs={occ.endMs} />
        )}

        {isCancelled && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-700 dark:bg-red-900/40 dark:text-red-300">
            Cancelada
          </span>
        )}
        {isRescheduled && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            Reprogramada
          </span>
        )}
      </div>

      {occ.reason && (
        <p className="text-xs text-muted-foreground">{occ.reason}</p>
      )}
    </li>
  );
}
