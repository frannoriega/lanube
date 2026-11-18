"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

/**
 * Aprobar / Rechazar una reserva pendiente, en el lugar (milestone 35). Rechazar pide el
 * motivo ahí mismo, sin abrir otro diálogo. Lo usan la lista del tablero y la hoja de detalle
 * de la página de reservas, que antes tenían cada una su copia.
 *
 * No decide nada por su cuenta: llama a `onAction` y el padre hace el pedido (y, si aprobar va
 * a rechazar otras reservas, muestra la confirmación con los conflictos).
 */
export function ReservationDecisionActions({
  reservationId,
  processing,
  onAction,
  onRejected,
}: {
  reservationId: string;
  /** Id de la reserva que se está procesando ahora (deshabilita los botones). */
  processing: string | null;
  onAction: (
    id: string,
    action: "APPROVED" | "REJECTED",
    reason?: string,
  ) => void;
  onRejected?: () => void;
}) {
  const [rejectMode, setRejectMode] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const busy = processing === reservationId;

  if (!rejectMode) {
    return (
      <div className="flex gap-2">
        <Button
          className="flex-1 bg-la-nube-primary text-slate-100 hover:bg-la-nube-primary/90"
          disabled={busy}
          onClick={() => onAction(reservationId, "APPROVED")}
        >
          Aprobar
        </Button>
        <Button
          variant="outline"
          className="flex-1 border-2 border-red-400 hover:bg-red-400"
          disabled={busy}
          onClick={() => setRejectMode(true)}
        >
          Rechazar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Textarea
        className="min-h-[72px]"
        placeholder="Motivo del rechazo"
        aria-label="Motivo del rechazo"
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
          disabled={!denyReason.trim() || busy}
          onClick={() => {
            onAction(reservationId, "REJECTED", denyReason.trim());
            onRejected?.();
          }}
        >
          Confirmar rechazo
        </Button>
      </div>
    </div>
  );
}
