"use client";

import { StatusBadge } from "@/components/atoms/status-badge";
import { AdminReservationListResult } from "@/components/templates/admin/dashboard-recent-reservations";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatTime } from "@/lib/utils/date";
import { useEffect, useMemo, useState } from "react";

function timeOverlaps(
  a: AdminReservationListResult,
  b: AdminReservationListResult,
): boolean {
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

export function AdminReservationDetailSheet({
  open,
  onOpenChange,
  reservation,
  sameDayReservations,
  onAction,
  processing,
  onRejected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: AdminReservationListResult | null;
  sameDayReservations: AdminReservationListResult[];
  onAction: (
    id: string,
    action: "APPROVED" | "REJECTED",
    reason?: string,
  ) => void;
  processing: string | null;
  onRejected?: () => void;
}) {
  const [denyReason, setDenyReason] = useState("");
  const [rejectMode, setRejectMode] = useState(false);

  useEffect(() => {
    if (!open) {
      setDenyReason("");
      setRejectMode(false);
    }
  }, [open, reservation?.id]);

  const overlaps = useMemo(() => {
    if (!reservation) return [];
    return sameDayReservations
      .filter(
        (r) =>
          r.id !== reservation.id &&
          r.resource.id === reservation.resource.id &&
          timeOverlaps(r, reservation),
      )
      .sort((a, b) => a.startTime - b.startTime);
  }, [reservation, sameDayReservations]);

  if (!reservation) return null;

  const userName = `${reservation.registeredUser.name} ${reservation.registeredUser.lastName}`;
  const reasonTrimmed = reservation.reason?.trim() ?? "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[340px] max-w-[340px] flex-col gap-0 p-0 sm:max-w-[340px]"
        aria-describedby={undefined}
      >
        <SheetHeader className="border-b border-border p-4 pr-12 text-left">
          <SheetTitle className="text-base font-medium leading-snug">
            Detalle de reserva
          </SheetTitle>
          <p className="mt-1 text-xs font-normal text-muted-foreground leading-snug">
            {reservation.resource.name} ·{" "}
            {formatTime(new Date(reservation.startTime))} –{" "}
            {formatTime(new Date(reservation.endTime))}
          </p>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 text-sm">
          <div>
            <p className="text-xs dark:text-muted-foreground">Solicitante</p>
            <p className="font-medium">{userName}</p>
          </div>
          <div>
            <p className="text-xs dark:text-muted-foreground">Correo</p>
            <p className="font-medium break-all">
              {reservation.registeredUser.user.displayEmail ??
                reservation.registeredUser.user.email}
            </p>
          </div>
          <div>
            <p className="text-xs dark:text-muted-foreground">Motivo</p>
            {reasonTrimmed.length > 0 ? (
              <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-muted/30 px-2 py-1.5 text-sm break-words whitespace-pre-wrap">
                {reasonTrimmed}
              </div>
            ) : (
              <p className="mt-1 text-muted-foreground">Sin motivo</p>
            )}
          </div>
          <div>
            <p className="text-xs dark:text-muted-foreground">Espacio</p>
            <p className="font-medium">
              {reservation.resource.name}{" "}
              <span className="text-muted-foreground font-normal">
                (capacidad: {reservation.resource.capacity})
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs dark:text-muted-foreground">Horario</p>
            <p className="font-medium">
              {formatTime(new Date(reservation.startTime))} –{" "}
              {formatTime(new Date(reservation.endTime))}
            </p>
          </div>
          <div>
            <p className="text-xs dark:text-muted-foreground">Personas</p>
            <p className="font-medium">{reservation.actorSize}</p>
          </div>
          <div>
            <p className="text-xs dark:text-muted-foreground">Estado</p>
            <div className="mt-1">
              <StatusBadge status={reservation.status} />
            </div>
          </div>

          {overlaps.length > 0 ? (
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <p className="mb-2 text-xs font-medium dark:text-muted-foreground">
                Reservas superpuestas
              </p>
              <ul className="max-h-48 space-y-3 overflow-y-auto pr-1">
                {overlaps.map((r) => (
                  <li
                    key={r.id}
                    className="border-b border-border pb-2 last:border-0 last:pb-0"
                  >
                    <p className="font-medium">
                      {r.registeredUser.name} {r.registeredUser.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(new Date(r.startTime))} –{" "}
                      {formatTime(new Date(r.endTime))} · {r.actorSize} pers.
                    </p>
                    {r.reason?.trim() ? (
                      <div className="mt-1 max-h-20 overflow-y-auto rounded border border-border/60 bg-background/80 px-1.5 py-1 text-xs break-words whitespace-pre-wrap text-foreground">
                        {r.reason.trim()}
                      </div>
                    ) : null}
                    <div className="mt-1">
                      <StatusBadge status={r.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {reservation.status === "PENDING" ? (
          <div className="mt-auto border-t border-border p-4 space-y-2">
            {!rejectMode ? (
              <div className="flex gap-2">
                <Button
                  className="flex-1 text-slate-100 bg-brand-primary hover:bg-brand-primary/90"
                  disabled={processing === reservation.id}
                  onClick={() => onAction(reservation.id, "APPROVED")}
                >
                  Aprobar
                </Button>
                <Button
                  className="flex-1 text-slate-800 dark:text-slate-100 bg-transparent border-red-400 border-2 hover:bg-red-400"
                  disabled={processing === reservation.id}
                  onClick={() => setRejectMode(true)}
                >
                  Rechazar
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  className="w-full min-h-[72px] rounded-md border border-input bg-background p-2 text-sm"
                  placeholder="Motivo del rechazo"
                  value={denyReason}
                  onChange={(e) => setDenyReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setRejectMode(false);
                      setDenyReason("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="flex-1"
                    disabled={
                      !denyReason.trim() || processing === reservation.id
                    }
                    onClick={() => {
                      onAction(reservation.id, "REJECTED", denyReason.trim());
                      onRejected?.();
                    }}
                  >
                    Confirmar rechazo
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
