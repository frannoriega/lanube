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
  onAction: (id: string, action: "APPROVED" | "REJECTED", reason?: string) => void;
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
  const title = reservation.reason?.trim() ? reservation.reason : "Reserva";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[340px] max-w-[340px] flex-col gap-0 p-0 sm:max-w-[340px]"
        aria-describedby={undefined}
      >
        <SheetHeader className="border-b border-border p-4 pr-12 text-left">
          <SheetTitle className="text-base font-medium leading-snug line-clamp-3">
            {title}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Solicitante</p>
            <p className="font-medium">{userName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Espacio</p>
            <p className="font-medium">
              {reservation.resource.name}{" "}
              <span className="text-muted-foreground font-normal">
                (capacidad: {reservation.resource.capacity})
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Horario</p>
            <p className="font-medium">
              {formatTime(new Date(reservation.startTime))} –{" "}
              {formatTime(new Date(reservation.endTime))}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Personas</p>
            <p className="font-medium">{reservation.actorSize}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Estado</p>
            <div className="mt-1">
              <StatusBadge status={reservation.status} />
            </div>
          </div>

          {overlaps.length > 0 ? (
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Reservas superpuestas
              </p>
              <ul className="space-y-3">
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
                    {r.reason ? (
                      <p className="mt-1 text-xs text-foreground/90 line-clamp-2">
                        {r.reason}
                      </p>
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
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={processing === reservation.id}
                  onClick={() => onAction(reservation.id, "APPROVED")}
                >
                  Aprobar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
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
