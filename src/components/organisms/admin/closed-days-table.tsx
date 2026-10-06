"use client";

/**
 * Lista de días cerrados del admin (`/admin/closed-days`, milestone 23). `DataTable`
 * compartido: tabla en escritorio, una tarjeta por fila en el teléfono. Tocar una fila abre la
 * edición; eliminar pide confirmación en un diálogo (un cierre mal cargado se corrige
 * editando, así que borrar es la excepción).
 *
 * La página (Server Component) arma las filas ya serializables y con el texto de fechas
 * formateado: son fechas de calendario locales, no instantes.
 */

import { ToneBadge, type StatusTone } from "@/components/atoms/status-badge";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
import { Button } from "@/components/ui/button";
import { DataTable, useStaticTable } from "@/components/ui/data-table";
import { apiErrorMessage, apiSend, invalidateApi } from "@/lib/api/client";
import {
  CLOSED_DAY_SOURCE_LABELS,
  CLOSED_DAY_STATUS_LABELS,
} from "@/lib/constants/closed-days";
import type { ColumnDef } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export interface ClosedDayRow {
  id: string;
  title: string;
  /** «25/05/2026» o «20/07/2026 al 31/07/2026». */
  dates: string;
  /** «Todo el día» o «14:00–18:00». */
  window: string;
  source: string;
  status: string;
}

const STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: "success",
  PENDING_REVIEW: "warning",
  DISMISSED: "neutral",
};

export function ClosedDaysTable({
  rows,
  emptyMessage,
}: {
  rows: ClosedDayRow[];
  emptyMessage: string;
}) {
  const router = useRouter();
  const [toDelete, setToDelete] = useState<ClosedDayRow | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await apiSend(`/api/admin/closed-days/${toDelete.id}`, "DELETE");
      toast.success("Día cerrado eliminado");
      invalidateApi("/api/admin/closed-days");
      setToDelete(null);
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo eliminar el día cerrado"));
    } finally {
      setBusy(false);
    }
  };

  const columns: ColumnDef<ClosedDayRow, unknown>[] = [
    {
      id: "title",
      header: "Motivo",
      meta: { mobile: "title", label: "Motivo" },
      cell: ({ row }) => (
        <div className="font-medium [overflow-wrap:anywhere]">
          {row.original.title}
        </div>
      ),
    },
    {
      id: "dates",
      header: "Fechas",
      meta: { label: "Fechas" },
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm tabular-nums">
          {row.original.dates}
        </span>
      ),
    },
    {
      id: "window",
      header: "Horario",
      meta: { label: "Horario" },
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm tabular-nums">
          {row.original.window}
        </span>
      ),
    },
    {
      id: "source",
      header: "Origen",
      meta: { label: "Origen" },
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {CLOSED_DAY_SOURCE_LABELS[row.original.source] ?? row.original.source}
        </span>
      ),
    },
    {
      id: "status",
      header: "Estado",
      meta: { mobile: "badge", label: "Estado" },
      cell: ({ row }) => (
        <ToneBadge tone={STATUS_TONE[row.original.status] ?? "neutral"}>
          {CLOSED_DAY_STATUS_LABELS[row.original.status] ?? row.original.status}
        </ToneBadge>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      meta: { mobile: "actions" },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/closed-days/${row.original.id}/edit`}>
              Editar
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Eliminar ${row.original.title}`}
            onClick={() => setToDelete(row.original)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const table = useStaticTable(rows, columns);

  return (
    <>
      <DataTable table={table} emptyMessage={emptyMessage} />
      <ResponsiveDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Eliminar día cerrado</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Vas a eliminar «{toDelete?.title}» ({toDelete?.dates}). El espacio
              vuelve a poder reservarse esos días. Si es un feriado nacional y
              solo querés ignorarlo, es mejor editarlo y marcarlo como
              descartado.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button
              variant="outline"
              onClick={() => setToDelete(null)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={busy}
            >
              Eliminar
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
