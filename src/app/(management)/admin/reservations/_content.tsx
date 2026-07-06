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
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export function ReservationsPageContent({
  spaceOptions,
}: {
  spaceOptions: SpaceOption[];
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState<{
    reservationId: string;
    conflicts: string[];
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);

  const paramService = searchParams.get("service");
  const [service, setService] = useState<string>(() => {
    const valid =
      paramService && spaceOptions.some((o) => o.id === paramService);
    return valid ? paramService! : (spaceOptions[0]?.id ?? "");
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

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/");
      return;
    }
    setLoading(false);
  }, [session, status, router]);

  const handleReservationAction = async (
    reservationId: string,
    action: "APPROVED" | "REJECTED",
    deniedReason?: string,
  ) => {
    setProcessing(reservationId);
    try {
      if (action === "APPROVED") {
        const previewRes = await fetch(
          `/api/admin/reservations/${reservationId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: action, preview: true }),
          },
        );
        if (!previewRes.ok) {
          const err = await previewRes.json().catch(() => ({}));
          toast.error(err.message || "No se pudo previsualizar conflictos");
          setProcessing(null);
          return;
        }
        const previewData = await previewRes.json();
        setConfirmData({
          reservationId,
          conflicts: previewData.autoRejectedIds || [],
        });
      } else {
        const response = await fetch(
          `/api/admin/reservations/${reservationId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: action, deniedReason }),
          },
        );
        if (response.ok) {
          toast.success("Reserva rechazada exitosamente");
          triggerRefetch();
        } else {
          const error = await response.json();
          toast.error(error.message || "Error al procesar la reserva");
        }
      }
    } catch {
      toast.error("Error al procesar la reserva");
    } finally {
      if (action !== "APPROVED") setProcessing(null);
    }
  };

  const confirmApprove = async () => {
    if (!confirmData) return;
    setConfirming(true);
    try {
      const res = await fetch(
        `/api/admin/reservations/${confirmData.reservationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "APPROVED" }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || "No se pudo aprobar la reserva");
      } else {
        const data = await res.json().catch(() => ({}));
        const count = (data.autoRejectedIds || []).length;
        toast.success(
          `Reserva aprobada. ${count > 0 ? `${count} reservas rechazadas automáticamente` : "Sin conflictos"}`,
        );
        setConfirmData(null);
        triggerRefetch();
      }
    } catch {
      toast.error("Error al aprobar la reserva");
    } finally {
      setConfirming(false);
      setProcessing(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-la-nube-primary border-b-transparent" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const selectedSpace = spaceOptions.find((o) => o.id === service);

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
        spaceName={selectedSpace?.name ?? ""}
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
