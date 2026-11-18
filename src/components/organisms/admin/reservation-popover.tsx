"use client";

import { StatusBadge, ToneBadge } from "@/components/atoms/status-badge";
import { ReservationDecisionActions } from "@/components/organisms/admin/reservation-decision-actions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AdminReservationListResult } from "@/lib/api/admin-reservations";
import { cn } from "@/lib/utils";
import { formateWeekday, formatDate, formatTime } from "@/lib/utils/date";
import {
  AlertTriangle,
  AlignLeft,
  Bot,
  Clock,
  MapPin,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

type OnAction = (
  id: string,
  action: "APPROVED" | "REJECTED",
  reason?: string,
) => void;

/** Franja de color de arriba: dice el estado de un vistazo (mismos tonos que la línea de tiempo). */
function accentClass(status: string): string {
  switch (status) {
    case "APPROVED":
      return "bg-blue-500";
    case "PENDING":
      return "bg-amber-500";
    default:
      return "bg-muted-foreground/50";
  }
}

/** Otras reservas vivas del mismo espacio físico que se pisan con ésta. */
function overlapsOf(
  r: AdminReservationListResult,
  sameDay: AdminReservationListResult[],
): AdminReservationListResult[] {
  return sameDay
    .filter(
      (o) =>
        o.id !== r.id &&
        o.resource.id === r.resource.id &&
        (o.status === "PENDING" || o.status === "APPROVED") &&
        o.startTime < r.endTime &&
        r.startTime < o.endTime,
    )
    .sort((a, b) => a.startTime - b.startTime);
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <dt className="sr-only">{label}</dt>
        <dd className="break-words">{children}</dd>
      </div>
    </div>
  );
}

/**
 * El detalle de una reserva para decidir, chico y limpio (reemplaza a la hoja lateral): franja
 * de color del estado, título, quién la pidió, horario, descripción, con qué se superpone y,
 * si está pendiente, aprobar o rechazar ahí mismo.
 */
export function ReservationPopoverCard({
  reservation: r,
  sameDayReservations,
  processing,
  onAction,
  onRejected,
}: {
  reservation: AdminReservationListResult;
  /** Las reservas de ese día, para avisar con cuáles se superpone. */
  sameDayReservations: AdminReservationListResult[];
  processing: string | null;
  onAction: OnAction;
  onRejected?: () => void;
}) {
  const overlaps = useMemo(
    () => overlapsOf(r, sameDayReservations),
    [r, sameDayReservations],
  );
  const start = new Date(r.startTime);
  const person = `${r.registeredUser.name} ${r.registeredUser.lastName}`.trim();
  const email =
    r.registeredUser.user.displayEmail ?? r.registeredUser.user.email;
  const description = r.reason?.trim() ?? "";

  return (
    <div className="text-sm">
      <div className={cn("h-1.5", accentClass(r.status))} aria-hidden="true" />
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base leading-snug font-semibold [overflow-wrap:anywhere]">
            {r.title || "Sin título"}
          </h3>
          <div className="shrink-0">
            <StatusBadge status={r.status} />
          </div>
        </div>

        <dl className="space-y-2">
          <Row icon={User} label="Reservó">
            <span className="font-medium">{person}</span>
            <span className="block text-xs text-muted-foreground">{email}</span>
          </Row>
          <Row icon={Clock} label="Horario">
            {formateWeekday(start)} {formatDate(start)} · {formatTime(start)} –{" "}
            {formatTime(new Date(r.endTime))}
          </Row>
          <Row icon={MapPin} label="Espacio">
            {r.resource.name}{" "}
            <span className="text-muted-foreground">
              (capacidad {r.resource.capacity})
            </span>
          </Row>
          <Row icon={Users} label="Personas">
            {r.actorSize} {r.actorSize === 1 ? "persona" : "personas"}
          </Row>
          <Row icon={AlignLeft} label="Descripción">
            {description ? (
              <span className="block max-h-32 overflow-y-auto whitespace-pre-wrap">
                {description}
              </span>
            ) : (
              <span className="text-muted-foreground">Sin descripción</span>
            )}
          </Row>
        </dl>

        {r.assistantName ? (
          // Pedida por un asistente conectado por MCP (milestone 20).
          <ToneBadge tone="info">
            <Bot className="h-3 w-3" aria-hidden />
            Vía asistente: {r.assistantName}
          </ToneBadge>
        ) : null}

        {overlaps.length > 0 ? (
          <div className="rounded-md bg-amber-50 p-2.5 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Se superpone con {overlaps.length}{" "}
              {overlaps.length === 1 ? "reserva" : "reservas"}
            </p>
            <ul className="mt-1.5 max-h-28 space-y-1 overflow-y-auto text-xs">
              {overlaps.map((o) => (
                <li
                  key={o.id}
                  className="flex items-baseline justify-between gap-2"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">
                      {o.title || "Sin título"}
                    </span>{" "}
                    · {o.registeredUser.name} {o.registeredUser.lastName}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatTime(new Date(o.startTime))}–
                    {formatTime(new Date(o.endTime))}
                    {o.status === "PENDING" ? " (pend.)" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {r.status === "PENDING" ? (
          <ReservationDecisionActions
            reservationId={r.id}
            processing={processing}
            onAction={onAction}
            onRejected={onRejected}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Ancla el detalle a su bloque (`children` es el botón). Se cierra solo al rechazar; al aprobar
 * sigue abierto hasta que llegan los datos nuevos (o aparece la confirmación de conflictos).
 */
export function ReservationPopover({
  reservation,
  sameDayReservations,
  processing,
  onAction,
  children,
}: {
  reservation: AdminReservationListResult;
  sameDayReservations: AdminReservationListResult[];
  processing: string | null;
  onAction: OnAction;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        className="w-80 max-w-[calc(100vw-2rem)] overflow-hidden p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ReservationPopoverCard
          reservation={reservation}
          sameDayReservations={sameDayReservations}
          processing={processing}
          onAction={onAction}
          onRejected={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
