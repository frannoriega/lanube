"use client";

import {
  AdminResourceTypeCombobox,
  type SpaceOption,
} from "@/components/molecules/admin-resource-type-combobox";
import { AdminReservationsCardsPanel } from "@/components/templates/admin/admin-reservations-cards-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSpaceOptions } from "@/hooks/api";
import { Calendar } from "lucide-react";
import { useEffect, useState } from "react";

// Re-exported so existing importers keep working; source of truth moved to lib.
export {
  parseAdminReservationListFromApi,
  parseItemsByDateFromApi,
  type AdminReservationListResult,
  type DayWithReservations,
} from "@/lib/api/admin-reservations";

export function DashboardRecentReservations({
  onAction,
  processing,
  refetchKey = 0,
}: {
  onAction: (
    id: string,
    action: "APPROVED" | "REJECTED",
    reason?: string,
  ) => void;
  processing: string | null;
  refetchKey?: number;
}) {
  const { data: spaceOptions } = useSpaceOptions();
  const options: SpaceOption[] = spaceOptions ?? [];
  const [service, setService] = useState<string>("");

  useEffect(() => {
    if (!spaceOptions) return;
    setService((prev) => prev || spaceOptions[0]?.id || "");
  }, [spaceOptions]);

  return (
    <Card className="glass-card dark:glass-card-dark">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Reservas recientes
        </CardTitle>
        <CardDescription>
          Esta semana y la próxima (Argentina). Elegí el tipo de recurso y
          expandí un día con reservas para ver la grilla y el detalle lateral.
        </CardDescription>
        <div className="pt-2">
          <p className="mb-1.5 text-sm font-medium text-muted-foreground">
            Tipo de recurso
          </p>
          <AdminResourceTypeCombobox
            value={service}
            onChange={setService}
            options={options}
          />
        </div>
      </CardHeader>
      <CardContent>
        <AdminReservationsCardsPanel
          variant="dashboard"
          spaceId={service}
          spaceName={options.find((o) => o.id === service)?.name ?? ""}
          showHeading={false}
          onAction={onAction}
          processing={processing}
          refetchKey={refetchKey}
        />
      </CardContent>
    </Card>
  );
}
