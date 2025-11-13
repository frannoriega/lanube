"use client";
import { StatusBadge } from "@/components/atoms/status-badge";
import { StatusIcon } from "@/components/atoms/status-icon";
import { ReservationInfo } from "@/components/molecules/reservation-info";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminReservationListResult } from "@/lib/db/adminReservations";
import { CheckCircle, XCircle } from "lucide-react";
import React from "react";

export function ReservationCard({
  reservation,
  onAction,
  processing,
}: {
  reservation: AdminReservationListResult;
  onAction: (id: string, action: "APPROVED" | "REJECTED", reason?: string) => void;
  processing: string | null;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);
  const [denyReason, setDenyReason] = React.useState("");

  return (
    <Card>
      <CardContent className="p-4">
        {/* Collapsed header row */}
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-3">
            <StatusIcon status={reservation.status} />
            <div className="font-medium">
              {reservation.registeredUser.name} {reservation.registeredUser.lastName}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {new Date(reservation.startTime).toLocaleDateString()} {new Date(reservation.startTime).toLocaleTimeString()} - {new Date(reservation.endTime).toLocaleTimeString()}
            </div>
            <StatusBadge status={reservation.status} />
          </div>
          <div className="text-sm text-gray-500">{expanded ? "Ocultar" : "Ver"}</div>
        </div>

        {expanded && (
        <div className="flex items-start justify-between mt-4">
          <div className="flex-1">
            <ReservationInfo
              user={{
                email: reservation.registeredUser.user.email,
                dni: reservation.registeredUser.dni,
                institution: reservation.registeredUser.institution,
              }}
              startTime={reservation.startTime.toISOString()}
              endTime={reservation.endTime.toISOString()}
              createdAt={reservation.createdAt.toISOString()}
              reason={reservation.reason}
            />
          </div>

          <div className="flex flex-col gap-2 ml-4">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => onAction(reservation.id, "APPROVED")}
              disabled={processing === reservation.id}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Aprobar
            </Button>
            {!rejecting ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setRejecting(true)}
                disabled={processing === reservation.id}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Rechazar
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <textarea
                  className="w-64 h-20 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-sm"
                  placeholder="Motivo del rechazo"
                  value={denyReason}
                  onChange={(e) => setDenyReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { setRejecting(false); setDenyReason(""); }}>Cancelar</Button>
                  <Button size="sm" variant="destructive" onClick={() => onAction(reservation.id, "REJECTED", denyReason)} disabled={processing === reservation.id || !denyReason.trim()}>
                    Confirmar rechazo
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </CardContent>
    </Card>
  );
}


