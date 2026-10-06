"use client";

import { ToneBadge } from "@/components/atoms/status-badge";
import { LoadError } from "@/components/molecules/load-error";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable, useStaticTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { apiErrorMessage, apiSend, invalidateApi } from "@/lib/api/client";
import {
  MAINTENANCE_MODE_LABELS,
  maintenanceAreaLabel,
} from "@/lib/maintenance/areas";
import type { WindowState } from "@/lib/maintenance/evaluate";
import type { AdminMaintenanceWindow } from "@/lib/maintenance/server";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Power } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

const STATE_LABELS: Record<WindowState, string> = {
  active: "Vigente",
  scheduled: "Programado",
  ended: "Terminado",
};
const STATE_TONES = {
  active: "warning",
  scheduled: "info",
  ended: "neutral",
} as const;
/** Vigentes primero, después lo programado, al final el historial. */
const STATE_ORDER: Record<WindowState, number> = {
  active: 0,
  scheduled: 1,
  ended: 2,
};

const fmt = (ms: number) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ms));

/** "Desde … hasta …", con "ahora" / "sin fin previsto" para los extremos abiertos. */
function windowSummary(w: AdminMaintenanceWindow): string {
  const from = w.startsAt != null ? fmt(w.startsAt) : fmt(w.createdAt);
  if (w.endedAt != null) return `${from} → cortado el ${fmt(w.endedAt)}`;
  return `${from} → ${w.endsAt != null ? fmt(w.endsAt) : "sin fin previsto"}`;
}

export function MaintenanceManager() {
  const { data, error, firstTime, refetch } = useApi<AdminMaintenanceWindow[]>(
    "/api/admin/maintenance",
  );
  const windows = [...(data ?? [])].sort(
    (a, b) =>
      STATE_ORDER[a.state] - STATE_ORDER[b.state] || b.createdAt - a.createdAt,
  );
  const [ending, setEnding] = useState<AdminMaintenanceWindow | null>(null);
  const [busy, setBusy] = useState(false);

  const onEnd = async () => {
    if (!ending) return;
    setBusy(true);
    try {
      await apiSend(`/api/admin/maintenance/${ending.id}/end`, "POST");
      toast.success("Mantenimiento finalizado");
      setEnding(null);
      invalidateApi("/api/admin/maintenance");
      invalidateApi("/api/maintenance");
      await refetch();
    } catch (err) {
      toast.error(
        apiErrorMessage(err, "No se pudo finalizar el mantenimiento"),
      );
    } finally {
      setBusy(false);
    }
  };

  const columns: ColumnDef<AdminMaintenanceWindow>[] = [
    {
      id: "title",
      header: "Mantenimiento",
      meta: { mobile: "title", label: "Mantenimiento" },
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <p className="font-medium">{row.original.title}</p>
          <p className="text-xs text-muted-foreground">
            {MAINTENANCE_MODE_LABELS[row.original.mode]}
          </p>
        </div>
      ),
    },
    {
      id: "areas",
      header: "Áreas",
      meta: { label: "Áreas" },
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.areas.map(maintenanceAreaLabel).join(", ")}
        </span>
      ),
    },
    {
      id: "window",
      header: "Ventana",
      meta: { label: "Ventana" },
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {windowSummary(row.original)}
        </span>
      ),
    },
    {
      id: "state",
      header: "Estado",
      meta: { mobile: "badge", label: "Estado" },
      cell: ({ row }) => (
        <ToneBadge tone={STATE_TONES[row.original.state]}>
          {STATE_LABELS[row.original.state]}
        </ToneBadge>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Acciones</div>,
      meta: { mobile: "actions", label: "Acciones" },
      cell: ({ row }) => {
        const w = row.original;
        if (w.state === "ended") return null;
        return (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              asChild
              aria-label={`Editar ${w.title}`}
            >
              <Link href={`/admin/maintenance/${w.id}/edit`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEnding(w)}
              aria-label={`Finalizar ${w.title}`}
            >
              <Power className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      },
    },
  ];
  const table = useStaticTable(windows, columns);

  return (
    <Card className="glass-card dark:glass-card-dark">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Mantenimientos</CardTitle>
          <CardDescription>
            Los vigentes y los programados se muestran como aviso en el sitio.
            Los terminados quedan como historial.
          </CardDescription>
          <p className="mt-1 text-sm text-muted-foreground">
            Un cambio puede tardar hasta unos 15 segundos en aplicarse a todos
            los pedidos.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/maintenance/new">
            <Plus className="mr-1 h-4 w-4" /> Nuevo mantenimiento
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <LoadError
            message="No se pudieron cargar los mantenimientos."
            onRetry={() => void refetch()}
          />
        ) : firstTime ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <DataTable
            table={table}
            emptyMessage="Todavía no se declaró ningún mantenimiento."
          />
        )}
      </CardContent>

      <ResponsiveDialog
        open={!!ending}
        onOpenChange={(o) => !o && setEnding(null)}
      >
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              ¿Finalizar «{ending?.title}»?
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {ending?.state === "scheduled"
                ? "Se cancela y no llega a empezar."
                : "Se levantan las restricciones y se quita el aviso."}{" "}
              Queda en el historial.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setEnding(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onEnd} disabled={busy}>
              Finalizar ahora
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </Card>
  );
}
