"use client";

/**
 * Acciones en lote sobre una lista del admin (milestone 16): la barra que aparece al marcar
 * filas, el diálogo de confirmación y el hook que llama al endpoint `/bulk`.
 *
 * Patrón compartido por eventos y noticias (y pensado para la próxima lista que lo
 * necesite): la tabla agrega una columna de checkboxes (`selectionColumn`, rol `leading` en
 * la tarjeta del teléfono), y cuando hay algo marcado aparece `BulkActionBar` arriba con las
 * acciones. Las destructivas pasan por `BulkConfirmDialog`, que lista **qué** se va a tocar
 * — un "¿Eliminar 7 elementos?" sin nombres es fácil de confirmar por error.
 */

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, apiSend } from "@/lib/api/client";
import type { BulkAction, BulkActionResult } from "@/lib/schemas/bulk";
import type { ColumnDef } from "@tanstack/react-table";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

/** Columna de checkboxes para `DataTable` (encabezado: marcar/desmarcar toda la página). */
export function selectionColumn<T>(): ColumnDef<T> {
  return {
    id: "select",
    enableHiding: false,
    meta: { mobile: "leading", label: "Seleccionar" },
    header: ({ table }) => (
      <input
        type="checkbox"
        aria-label="Seleccionar todo"
        className="size-4 cursor-pointer accent-primary"
        ref={(el) => {
          if (el)
            el.indeterminate =
              table.getIsSomePageRowsSelected() &&
              !table.getIsAllPageRowsSelected();
        }}
        checked={table.getIsAllPageRowsSelected()}
        onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        aria-label="Seleccionar fila"
        className="size-4 cursor-pointer accent-primary"
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onChange={(e) => row.toggleSelected(e.target.checked)}
      />
    ),
  };
}

/** Barra de acciones en lote: cuántos hay marcados, "Deseleccionar" y los botones. */
export function BulkActionBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label="Acciones en lote"
      className="sticky top-16 z-20 flex flex-col gap-2 rounded-lg border border-border bg-card p-2 pl-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">
          {count} seleccionado{count === 1 ? "" : "s"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7 px-2 text-muted-foreground"
        >
          <X className="mr-1 h-3.5 w-3.5" aria-hidden /> Deseleccionar
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/**
 * Confirmación de una acción en lote: título, qué va a pasar y la lista de lo afectado
 * (recortada a 8 nombres + "y N más").
 */
export function BulkConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  names,
  confirmLabel,
  destructive = false,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  names: string[];
  confirmLabel: string;
  destructive?: boolean;
  busy: boolean;
  onConfirm: () => void;
}) {
  const MAX = 8;
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {description}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ul className="max-h-60 list-disc space-y-1 overflow-y-auto pl-5 text-sm">
          {names.slice(0, MAX).map((n, i) => (
            <li key={i} className="[overflow-wrap:anywhere]">
              {n}
            </li>
          ))}
          {names.length > MAX ? (
            <li className="list-none text-muted-foreground">
              y {names.length - MAX} más
            </li>
          ) : null}
        </ul>
        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Volver
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Procesando…" : confirmLabel}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/**
 * Llama al endpoint `/bulk` de una lista, informa el resultado (incluidos los que se
 * saltearon y por qué) y refresca la página. `onDone` limpia la selección.
 */
export function useBulkAction(endpoint: string, onDone: () => void) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = async (action: BulkAction, ids: string[], success: string) => {
    setBusy(true);
    try {
      const result = await apiSend<BulkActionResult>(endpoint, "POST", {
        ids,
        action,
      });
      if (result.done > 0) toast.success(`${success} (${result.done})`);
      if (result.skipped.length > 0) {
        const reasons = [...new Set(result.skipped.map((s) => s.reason))];
        toast.warning(
          `${result.skipped.length} sin cambios: ${reasons.join("; ")}`,
        );
      }
      onDone();
      router.refresh();
      return true;
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo completar la acción"));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { busy, run };
}
