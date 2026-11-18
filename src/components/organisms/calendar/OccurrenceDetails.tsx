"use client";

import { StatusBadge } from "@/components/atoms/status-badge";
import { FramedImage } from "@/components/molecules/framed-image";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, apiSend } from "@/lib/api/client";
import type { ReservationOccurrence } from "@/lib/db/resourceCalendar";
import { toCapitalCase } from "@/lib/utils/string";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlignLeft, CalendarDays, Clock, Repeat } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { formatDuration } from "./BookingForm";
import { fromUtcMs } from "./calendar-utils";
import { OCCURRENCE_TONES, occurrenceTone } from "./occurrence-style";

/**
 * Detalle de una reserva (o evento) del calendario de un espacio (milestone 35). Vive dentro
 * del popover que abre la tarjeta — no es un modal.
 *
 * Es donde se cancela una reserva propia: el pedido sale de acá (`apiSend DELETE`) y, si salió
 * bien, avisa con `onRemoved` para que el calendario la saque de la vista sin recargar.
 * Cancelar pide una confirmación **en el mismo lugar** (no otro diálogo), y las recurrentes
 * preguntan «¿solo esta o toda la serie?» como antes (milestone 5).
 */
export function OccurrenceDetails({
  occ,
  own,
  apiEndpoint,
  onRemoved,
  onClose,
}: {
  occ: ReservationOccurrence;
  /** La reserva es del usuario que mira (la única que puede cancelar). */
  own: boolean;
  apiEndpoint: string;
  /** Saca de la vista una ocurrencia (`occurrenceStartTime` presente) o toda la reserva. */
  onRemoved: (reservationId: string, occurrenceStartTime?: number) => void;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const isEvent = occ.reservableType === "EVENT";
  const tone = OCCURRENCE_TONES[occurrenceTone(occ, own)];
  const start = fromUtcMs(occ.occurrenceStartTime);
  const end = fromUtcMs(occ.occurrenceEndTime);
  const durationMin = Math.round(
    (occ.occurrenceEndTime - occ.occurrenceStartTime) / 60_000,
  );
  const canCancel = own && !isEvent && occ.status !== "CANCELLED";

  const cancel = async (scope: "occurrence" | "series") => {
    setBusy(true);
    try {
      await apiSend(apiEndpoint, "DELETE", {
        reservationId: occ.reservationId,
        ...(scope === "occurrence"
          ? { occurrenceStartTime: occ.occurrenceStartTime }
          : {}),
      });
      toast.success(
        scope === "series" && occ.isRecurring
          ? "Serie cancelada"
          : "Reserva cancelada",
      );
      onRemoved(
        occ.reservationId,
        scope === "occurrence" ? occ.occurrenceStartTime : undefined,
      );
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo cancelar la reserva"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 text-sm">
      {isEvent && occ.eventPublic && occ.eventImageUrl ? (
        <FramedImage
          src={occ.eventImageUrl}
          alt=""
          sizes="320px"
          className="-mx-4 -mt-4 h-28 w-[calc(100%+2rem)] rounded-t-md"
        />
      ) : null}

      {/* Título a la izquierda y estado a la derecha, a la altura de la primera línea. Un título
          largo se parte en varias líneas (nunca empuja al estado, que no se encoge) y el cuadro
          de color queda alineado con su primera línea, no centrado en todo el alto. */}
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className={`mt-[0.3125rem] h-3 w-3 shrink-0 rounded-sm ${tone.bg}`}
        />
        <h3 className="min-w-0 flex-1 text-base leading-snug font-semibold [overflow-wrap:anywhere]">
          {occ.title}
        </h3>
        <span className="shrink-0">
          {isEvent ? (
            <span className="text-xs text-muted-foreground">Evento</span>
          ) : own ? (
            <StatusBadge status={occ.status} />
          ) : (
            <span className="text-xs text-muted-foreground">Reservado</span>
          )}
        </span>
      </div>

      <dl className="space-y-2 text-muted-foreground">
        <div className="flex items-start gap-2.5">
          <CalendarDays
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <dt className="sr-only">Día</dt>
          <dd className="text-foreground">
            {toCapitalCase(
              format(start, "EEEE d 'de' MMMM 'de' yyyy", { locale: es }),
            )}
          </dd>
        </div>
        <div className="flex items-start gap-2.5">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <dt className="sr-only">Horario</dt>
          <dd className="text-foreground">
            {format(start, "HH:mm")} a {format(end, "HH:mm")}
            <span className="text-muted-foreground">
              {" "}
              · {formatDuration(durationMin)}
            </span>
          </dd>
        </div>
        {occ.isRecurring ? (
          <div className="flex items-start gap-2.5">
            <Repeat className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Repetición</dt>
            <dd className="text-foreground">Reserva recurrente</dd>
          </div>
        ) : null}
        {!isEvent && occ.reason ? (
          <div className="flex items-start gap-2.5">
            <AlignLeft className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Descripción</dt>
            <dd className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words text-foreground">
              {occ.reason}
            </dd>
          </div>
        ) : null}
        {isEvent && occ.eventPublic && occ.eventSummary ? (
          <div className="flex items-start gap-2.5">
            <AlignLeft className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Resumen</dt>
            <dd className="text-foreground">{occ.eventSummary}</dd>
          </div>
        ) : null}
      </dl>

      {isEvent && !occ.eventPublic ? (
        <p className="text-muted-foreground">
          Este horario está reservado para un evento que todavía no se publicó.
        </p>
      ) : null}

      {isEvent && occ.eventPublic ? (
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {occ.eventId ? (
            <Button
              asChild
              size="sm"
              variant={occ.formOpen ? "outline" : "default"}
            >
              <Link
                href={`/events/${occ.eventId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver evento
              </Link>
            </Button>
          ) : null}
          {occ.formOpen && occ.formSlug ? (
            <Button asChild size="sm">
              <Link
                href={`/forms/${occ.formSlug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Inscribirse
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {canCancel ? (
        <div className="border-t border-border pt-3">
          {!confirming ? (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirming(true)}
              >
                Cancelar reserva
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-muted-foreground">
                {occ.isRecurring
                  ? "¿Cancelar solo esta reserva o toda la serie?"
                  : "¿Cancelar esta reserva?"}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setConfirming(false)}
                >
                  Volver
                </Button>
                {occ.isRecurring ? (
                  <>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => void cancel("occurrence")}
                    >
                      Solo esta
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => void cancel("series")}
                    >
                      Toda la serie
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => void cancel("series")}
                  >
                    Sí, cancelar
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
