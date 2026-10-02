"use client";

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
import type { LandingTheme } from "@/types/prisma";
import { Pencil, Plus, Trash2, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { LoadError } from "@/components/molecules/load-error";

function windowSummary(t: LandingTheme): string {
  if (t.recurring) {
    return `${t.startMonthDay ?? "?"} — ${t.endMonthDay ?? "?"} (cada año)`;
  }
  if (t.startDate == null || t.endDate == null) return "Sin definir";
  const fmt = (ms: number) => new Date(ms).toLocaleDateString("es-AR");
  return `${fmt(t.startDate)} — ${fmt(t.endDate)}`;
}

export function LandingThemesManager() {
  const { data, error, firstTime, refetch } =
    useApi<LandingTheme[]>("/api/admin/themes");
  const themes = data ?? [];
  const [deleting, setDeleting] = useState<LandingTheme | null>(null);
  const [busy, setBusy] = useState(false);

  /*
   * Modo "Reordenar" (milestone 14, decisión Part B.3): la lista se reordena arrastrando,
   * solo después de activar el modo, y se guarda de una vez con "Guardar orden".
   */
  const [reorderMode, setReorderMode] = useState(false);
  const saveOrder = async (orderedIds: string[]) => {
    try {
      await apiSend("/api/admin/themes/reorder", "POST", { orderedIds });
      toast.success("Orden guardado");
      setReorderMode(false);
      invalidateApi("/api/admin/themes");
      await refetch();
    } catch (err) {
      toast.error(
        apiErrorMessage(err, "No se pudo guardar el orden de los temas"),
      );
      throw err;
    }
  };

  const onDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiSend(`/api/admin/themes/${deleting.id}`, "DELETE");
      toast.success("Tema eliminado");
      setDeleting(null);
      invalidateApi("/api/admin/themes");
      await refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo eliminar el tema"));
    } finally {
      setBusy(false);
    }
  };

  /*
   * Columnas del `DataTable` (milestone 14): tabla desde `md`, tarjetas por debajo. Cada
   * columna declara su rol en la tarjeta con `meta.mobile` (ver `MobileColumnRole`).
   */
  const columns: ColumnDef<(typeof themes)[number]>[] = [
    {
      id: "name",
      header: "Nombre",
      meta: { mobile: "title", label: "Nombre" },
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
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
      id: "effect",
      header: "Efecto",
      meta: { label: "Efecto" },
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.entranceEffect === "EMOJI_SHOWER"
            ? "Lluvia de emojis"
            : "Ninguno"}
        </Badge>
      ),
    },
    {
      id: "status",
      header: "Estado",
      meta: { mobile: "badge", label: "Estado" },
      cell: ({ row }) => (
        <Badge variant={row.original.isEnabled ? "default" : "secondary"}>
          {row.original.isEnabled ? "Activo" : "Deshabilitado"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Acciones</div>,
      meta: { mobile: "actions", label: "Acciones" },
      cell: ({ row }) => {
        const theme = row.original;
        return (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              asChild
              aria-label={`Editar ${theme.name}`}
            >
              <Link href={`/admin/themes/${theme.id}/edit`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleting(theme)}
              aria-label={`Eliminar ${theme.name}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      },
    },
  ];
  const table = useStaticTable(themes, columns);

  return (
    <Card className="glass-card dark:glass-card-dark">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Temas configurados</CardTitle>
          <CardDescription>
            Cada tema define cuándo se activa y qué cambia en la portada
            mientras dura.
          </CardDescription>
          {/* El orden de la lista es la prioridad (milestone 14): ya no hay un campo numérico. */}
          <p className="mt-1 text-sm text-muted-foreground">
            El orden es la prioridad: si dos temas coinciden en fecha, gana el
            de más arriba.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setReorderMode(true)}
            disabled={reorderMode || themes.length < 2}
          >
            <ArrowUpDown className="mr-1 h-4 w-4" /> Reordenar
          </Button>
          {/* Milestone 14, propuesta 4: el tema se crea/edita en su propia página. */}
          <Button asChild>
            <Link href="/admin/themes/new">
              <Plus className="mr-1 h-4 w-4" /> Nuevo tema
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <LoadError
            message="No se pudieron cargar los temas."
            onRetry={() => void refetch()}
          />
        ) : firstTime ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : reorderMode ? (
          <ReorderList
            items={themes.map((item) => ({
              id: item.id,
              label: item.name,
              description: windowSummary(item),
            }))}
            hint="Si dos temas coinciden en fecha, gana el de más arriba."
            onSave={saveOrder}
            onCancel={() => setReorderMode(false)}
          />
        ) : (
          <DataTable table={table} emptyMessage="No hay temas definidos." />
        )}
      </CardContent>

      {/* Create / edit */}
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
              Esta acción no se puede deshacer.
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
