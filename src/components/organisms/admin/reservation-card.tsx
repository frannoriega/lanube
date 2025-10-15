"use client";
import { StatusBadge } from "@/components/atoms/status-badge";
import { StatusIcon } from "@/components/atoms/status-icon";
import { ReservationInfo } from "@/components/molecules/reservation-info";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle } from "lucide-react";

export function ReservationCard({
  reservation,
  onAction,
  processing,
}: {
  reservation: any;
  onAction: (id: string, action: "APPROVED" | "REJECTED") => void;
  processing: string | null;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <StatusIcon status={reservation.status} />
              <h3 className="font-semibold text-lg">
                {reservation.registeredUser.name} {reservation.registeredUser.lastName}
              </h3>
              <StatusBadge status={reservation.status} />
            </div>

            <ReservationInfo
              user={{
                email: reservation.registeredUser.user.email,
                dni: reservation.registeredUser.dni,
                institution: reservation.registeredUser.institution,
              }}
              startTime={reservation.startTime}
              endTime={reservation.endTime}
              createdAt={reservation.createdAt}
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
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onAction(reservation.id, "REJECTED")}
              disabled={processing === reservation.id}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Rechazar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


