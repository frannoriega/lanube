"use client";

import { AdminResourceTypeCombobox } from "@/components/molecules/admin-resource-type-combobox";
import type { SpaceOption } from "@/components/molecules/admin-resource-type-combobox";
import { AdminReservationsCardsPanel } from "@/components/templates/admin/admin-reservations-cards-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiErrorMessage } from "@/lib/api/client";
import { reviewAdminReservation } from "@/lib/api/mutations";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export function ReservationsPageContent({
  spaceOptions,
}: {
  spaceOptions: SpaceOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [processing, setProcessing] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState<{
    reservationId: string;
    conflicts: string[];
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);

  const paramService = searchParams.get("service");
  const [service, setService] = useState<string>(() => {
    if (paramService && spaceOptions.some((o) => o.id === paramService))
      return paramService;
    return spaceOptions[0]?.id ?? "";
  });

  useEffect(() => {
    if (paramService && spaceOptions.some((o) => o.id === paramService)) {
      setService(paramService);
    }
  }, [paramService, spaceOptions]);

  const triggerRefetch = useCallback(() => setRefetchKey((k) => k + 1), []);

  const onServiceChange = useCallback(
    (v: string) => {
      setService(v);
      router.replace(`/admin/reservations?service=${encodeURIComponent(v)}`, {
        scroll: false,
      });
    },
    [router],
  );

  const handleReservationAction = async (
    reservationId: string,
    action: "APPROVED" | "REJECTED",
    deniedReason?: string,
  ) => {
    setProcessing(reservationId);
    try {
      if (action === "APPROVED") {
        const preview = await reviewAdminReservation(reservationId, {
          status: action,
          preview: true,
        });
        setConfirmData({
          reservationId,
          conflicts: preview.autoRejectedIds || [],
        });
      } else {
        await reviewAdminReservation(reservationId, {
          status: action,
          deniedReason,
        });
        toast.success("Reserva rechazada exitosamente");
        triggerRefetch();
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Error al procesar la reserva"));
    } finally {
      if (action !== "APPROVED") setProcessing(null);
    }
  };

  const confirmApprove = async () => {
    if (!confirmData) return;
    setConfirming(true);
    try {
      const data = await reviewAdminReservation(confirmData.reservationId, {
        status: "APPROVED",
      });
      const count = (data.autoRejectedIds || []).length;
      toast.success(
        `Reserva aprobada. ${count > 0 ? `${count} reservas rechazadas automáticamente` : "Sin conflictos"}`,
      );
      setConfirmData(null);
      triggerRefetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Error al aprobar la reserva"));
    } finally {
      setConfirming(false);
      setProcessing(null);
    }
  };

  const spaceName = spaceOptions.find((o) => o.id === service)?.name ?? "";

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            Tipo de recurso
          </p>
          <AdminResourceTypeCombobox
            value={service}
            onChange={onServiceChange}
            options={spaceOptions}
          />
        </div>
      </div>

      <AdminReservationsCardsPanel
        variant="admin"
        spaceId={service}
        spaceName={spaceName}
        showHeading
        onAction={handleReservationAction}
        processing={processing}
        refetchKey={refetchKey}
      />

      <Dialog
        open={!!confirmData}
        onOpenChange={(open) => !open && setConfirmData(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar aprobación</DialogTitle>
            <DialogDescription>
              {confirmData?.conflicts?.length
                ? `Aprobar esta reserva rechazará automáticamente ${confirmData.conflicts.length} reservas pendientes.`
                : "No hay conflictos detectados."}
            </DialogDescription>
          </DialogHeader>
          {confirmData?.conflicts?.length ? (
            <div className="max-h-48 overflow-auto rounded border p-2 text-sm">
              {confirmData.conflicts.map((id) => (
                <div
                  key={id}
                  className="border-b border-gray-200 py-1 last:border-b-0 dark:border-gray-800"
                >
                  {id}
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setConfirmData(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmApprove} disabled={confirming}>
              {confirming ? "Aprobando..." : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
