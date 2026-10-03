"use client";

import { AdminResourceTypeCombobox } from "@/components/molecules/admin-resource-type-combobox";
import type { SpaceOption } from "@/components/molecules/admin-resource-type-combobox";
import { AdminReservationsCardsPanel } from "@/components/templates/admin/admin-reservations-cards-panel";
import { ApprovalConflictsDialog } from "@/components/organisms/admin/approval-conflicts-dialog";
import { apiErrorMessage } from "@/lib/api/client";
import { reviewAdminReservation } from "@/lib/api/mutations";
import type {
  ApprovalConflict,
  ApprovalPreview,
} from "@/lib/reservations/approval-conflicts";
import { ALL_SPACES_ID } from "@/hooks/api";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const ALL_SPACES_OPTION: SpaceOption = {
  id: ALL_SPACES_ID,
  name: "Todos los espacios",
};

export function ReservationsPageContent({
  spaceOptions,
}: {
  spaceOptions: SpaceOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [processing, setProcessing] = useState<string | null>(null);
  /** Aprobación pendiente de confirmar: solo existe cuando rechazaría otras reservas. */
  const [confirmData, setConfirmData] = useState<{
    reservationId: string;
    conflicts: ApprovalConflict[];
    space: ApprovalPreview["space"];
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);

  const comboOptions: SpaceOption[] = [ALL_SPACES_OPTION, ...spaceOptions];

  // Defaults to "all"; an explicit ?service= (including "all") is honored if valid.
  const paramService = searchParams.get("service");
  const [service, setService] = useState<string>(() => {
    if (paramService && comboOptions.some((o) => o.id === paramService))
      return paramService;
    return ALL_SPACES_ID;
  });

  useEffect(() => {
    if (paramService && comboOptions.some((o) => o.id === paramService)) {
      setService(paramService);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /** Aprueba de verdad (sin `preview`) y avisa cuántas reservas se rechazaron en cascada. */
  const commitApprove = async (reservationId: string) => {
    setConfirming(true);
    try {
      const data = await reviewAdminReservation(reservationId, {
        status: "APPROVED",
      });
      const count = (data.autoRejectedIds || []).length;
      toast.success(
        count > 0
          ? `Reserva aprobada. ${count} reservas rechazadas automáticamente`
          : "Reserva aprobada",
      );
      setConfirmData(null);
      triggerRefetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Error al aprobar la reserva"));
    } finally {
      setConfirming(false);
    }
  };

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
        const conflicts = preview.conflicts ?? [];
        // Sin conflictos no hay nada que confirmar: se aprueba directo. El diálogo solo
        // aparece cuando aprobar va a rechazar automáticamente otras reservas.
        if (conflicts.length === 0) {
          await commitApprove(reservationId);
          return;
        }
        setConfirmData({
          reservationId,
          conflicts,
          space: preview.space ?? null,
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
      setProcessing(null);
    }
  };

  const spaceName = comboOptions.find((o) => o.id === service)?.name ?? "";

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Espacio</p>
          <AdminResourceTypeCombobox
            value={service}
            onChange={onServiceChange}
            options={comboOptions}
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

      <ApprovalConflictsDialog
        preview={confirmData}
        onCancel={() => setConfirmData(null)}
        onConfirm={() =>
          confirmData && commitApprove(confirmData.reservationId)
        }
        confirming={confirming}
      />
    </>
  );
}
