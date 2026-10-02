"use client";

import { getSpaceIcon } from "@/lib/constants/spaces";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, useStaticTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { ReorderList } from "@/components/molecules/reorder-list";
import { useApi } from "@/hooks/use-api";
import { apiErrorMessage, apiSend, invalidateApi } from "@/lib/api/client";
import { Pencil, Plus, Trash2, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { LoadError } from "@/components/molecules/load-error";

interface SpaceRow {
  id: string;
  name: string;
  slug: string;
  capacity: number;
  isExclusive: boolean;
  isReservable: boolean;
  isFeatured: boolean;
  displayOrder: number;
  iconName: string | null;
}

export function SpacesManager() {
  const { data, error, firstTime, refetch } =
    useApi<SpaceRow[]>("/api/admin/spaces");
  const spaces = data ?? [];
  const [deleting, setDeleting] = useState<SpaceRow | null>(null);
  const [busy, setBusy] = useState(false);
  /*
   * Modo "Reordenar" (milestone 14, decisión Part B.3): la lista se reordena arrastrando,
   * solo después de activar el modo, y se guarda de una vez con "Guardar orden".
   */
  const [reorderMode, setReorderMode] = useState(false);
  const saveOrder = async (orderedIds: string[]) => {
    try {
      await apiSend("/api/admin/spaces/reorder", "POST", { orderedIds });
      toast.success("Orden guardado");
      setReorderMode(false);
      invalidateApi("/api/admin/spaces");
      await refetch();
    } catch (err) {
      toast.error(
        apiErrorMessage(err, "No se pudo guardar el orden de los espacios"),
      );
      throw err;
    }
  };

  const onDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiSend(`/api/admin/spaces/${deleting.id}`, "DELETE");
      toast.success("Espacio eliminado");
      setDeleting(null);
      invalidateApi("/api/admin/spaces");
      await refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo eliminar el espacio"));
    } finally {
      setBusy(false);
    }
  };

  /*
   * Columnas del `DataTable` (milestone 14): tabla desde `md`, tarjetas por debajo. Cada
   * columna declara su rol en la tarjeta con `meta.mobile` (ver `MobileColumnRole`).
   */
  const columns: ColumnDef<(typeof spaces)[number]>[] = [
    {
      id: "name",
      header: "Nombre",
      meta: { mobile: "title", label: "Nombre" },
      cell: ({ row }) => {
        const space = row.original;
        const Icon = getSpaceIcon(space.iconName);
        return (
          <Link
            href={`/admin/spaces/${space.id}/edit`}
            className="flex items-center gap-2 font-medium hover:underline"
          >
            <Icon className="h-4 w-4 shrink-0 text-la-nube-selected dark:text-la-nube-secondary" />
            {space.name}
          </Link>
        );
      },
    },
    {
      id: "slug",
      header: "Slug",
      // Dato técnico: en la tarjeta del teléfono no aporta (se edita desde el formulario).
      meta: { mobile: "hidden", label: "Slug" },
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.slug}</span>
      ),
    },
    {
      id: "capacity",
      header: "Capacidad",
      meta: { label: "Capacidad" },
      cell: ({ row }) => row.original.capacity,
    },
    {
      id: "attributes",
      header: "Atributos",
      meta: { label: "Atributos" },
      cell: ({ row }) => {
        const space = row.original;
        return (
          <div className="flex flex-wrap gap-1">
            {space.isReservable && (
              <Badge variant="secondary">Reservable</Badge>
            )}
            {space.isExclusive && <Badge variant="secondary">Exclusivo</Badge>}
            {space.isFeatured && <Badge variant="secondary">Destacado</Badge>}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Acciones</div>,
      meta: { mobile: "actions", label: "Acciones" },
      cell: ({ row }) => {
        const space = row.original;
        return (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              asChild
              aria-label={`Editar ${space.name}`}
            >
              <Link href={`/admin/spaces/${space.id}/edit`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleting(space)}
              aria-label={`Eliminar ${space.name}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      },
    },
  ];
  const table = useStaticTable(spaces, columns);

  return (
    <Card className="glass-card dark:glass-card-dark">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Espacios</CardTitle>
          <CardDescription>
            Espacios reservables del centro (coworking, laboratorio, …) y su
            capacidad.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setReorderMode(true)}
            disabled={reorderMode || spaces.length < 2}
          >
            <ArrowUpDown className="mr-1 h-4 w-4" /> Reordenar
          </Button>
          <Button asChild>
            <Link href="/admin/spaces/new">
              <Plus className="mr-1 h-4 w-4" /> Nuevo espacio
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <LoadError
            message="No se pudieron cargar los espacios."
            onRetry={() => void refetch()}
          />
        ) : firstTime ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : reorderMode ? (
          <ReorderList
            items={spaces.map((item) => ({
              id: item.id,
              label: item.name,
            }))}
            hint="El orden se usa en el menú y en el sitio público."
            onSave={saveOrder}
            onCancel={() => setReorderMode(false)}
          />
        ) : (
          <DataTable table={table} emptyMessage="No hay espacios definidos." />
        )}
      </CardContent>

      {/* Delete confirm */}
      <ResponsiveDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              ¿Eliminar {deleting?.name}?
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Solo puede eliminarse si no tiene eventos ni reservas asociadas.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={busy}>
              Eliminar
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </Card>
  );
}
