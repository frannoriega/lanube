"use client";

/**
 * Lista de notas del admin (`/admin/news`) sobre el `DataTable` compartido (milestone 14):
 * tabla desde `md`, tarjetas por debajo. Antes era una `<Table>` escrita a mano en la página
 * (Server Component) que en un teléfono ensanchaba toda la página a ~635px.
 *
 * Es client component porque las celdas de TanStack son funciones; la página le pasa filas
 * ya serializables (`NewsAdminRow`, con fechas en ms `number`).
 *
 * Milestone 16: checkboxes + **acciones en lote** (eliminar; destacar / quitar de
 * destacadas, solo para quien aprueba) y la vista "Destacadas", donde la misma tabla se
 * reordena en el lugar (reemplaza el modal "Reordenar destacadas"). Solo se pueden marcar
 * las filas que la persona podría eliminar una por una: sin `news:approve`, sus notas no
 * publicadas.
 */

import {
  BulkActionBar,
  BulkConfirmDialog,
  selectionColumn,
  useBulkAction,
} from "@/components/molecules/bulk-actions";
import { LocalTimestamp } from "@/components/molecules/local-date";
import {
  ReorderBar,
  useTableReorder,
} from "@/components/molecules/table-reorder";
import { NewsRowActions } from "@/components/organisms/admin/news-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { apiErrorMessage, apiSend } from "@/lib/api/client";
import {
  type ColumnDef,
  getCoreRowModel,
  type RowSelectionState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Star, StarOff, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING_REVIEW: "En revisión",
  PUBLISHED: "Publicada",
  REJECTED: "Rechazada",
  PAUSED: "Pausada",
};

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  DRAFT: "outline",
  PENDING_REVIEW: "secondary",
  PUBLISHED: "default",
  REJECTED: "destructive",
  PAUSED: "outline",
};

const PENDING_ACTION_LABELS: Record<string, string> = {
  EDIT: "Edición pendiente",
  PAUSE: "Pausa solicitada",
  DELETE: "Eliminación solicitada",
};

/** Fila serializable que arma la página a partir de `listAdminNewsPosts`. */
export interface NewsAdminRow {
  id: string;
  title: string;
  status: string;
  pendingAction: string | null;
  deleted: boolean;
  authorLabel: string;
  /** Para saber si quien mira puede marcarla (sin `news:approve`, solo las propias). */
  isMine: boolean;
  isFeatured: boolean;
  /** Fecha a mostrar (publicación, o creación si nunca se publicó), en ms. */
  dateMs: number;
}

export function NewsAdminTable({
  rows,
  canApprove,
  featuredView = false,
  startReordering = false,
  selectable = true,
}: {
  rows: NewsAdminRow[];
  canApprove: boolean;
  /** Vista "Destacadas": solo las destacadas, en orden, reordenables. */
  featuredView?: boolean;
  /** Entrar directo al modo reordenar (link "Reordenar destacadas"). */
  startReordering?: boolean;
  /** Sin checkboxes (p. ej. en la vista de eliminadas). */
  selectable?: boolean;
}) {
  const router = useRouter();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reorder = useTableReorder(rows, async (orderedIds) => {
    try {
      await apiSend("/api/admin/news/featured-order", "POST", { orderedIds });
      toast.success("Orden guardado");
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo guardar el orden"));
      throw err;
    }
  });
  const canReorder = featuredView && canApprove;
  // Ver `EventsAdminTable`: se entra al modo en el primer render, no en un efecto.
  const [autoStarted, setAutoStarted] = useState(false);
  if (startReordering && canReorder && !autoStarted && rows.length > 1) {
    setAutoStarted(true);
    reorder.start();
  }

  const bulk = useBulkAction("/api/admin/news/bulk", () => setRowSelection({}));

  const columns: ColumnDef<NewsAdminRow>[] = [
    ...(selectable ? [selectionColumn<NewsAdminRow>()] : []),
    {
      id: "title",
      header: "Título",
      meta: { mobile: "title", label: "Título" },
      cell: ({ row }) => (
        <span className="font-medium">{row.original.title}</span>
      ),
    },
    {
      id: "status",
      header: "Estado",
      meta: { label: "Estado" },
      cell: ({ row }) => {
        const post = row.original;
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={STATUS_VARIANTS[post.status]}>
              {STATUS_LABELS[post.status]}
            </Badge>
            {/* Un autor pidió un cambio contra esta nota mientras estaba en línea, así
                que sigue en el sitio (o eliminada, si el pedido era eso) hasta que un
                admin decida — nunca se aplica solo. */}
            {post.pendingAction && (
              <Badge
                variant="outline"
                title="Solicitud de un autor pendiente de decisión"
              >
                {PENDING_ACTION_LABELS[post.pendingAction] ??
                  post.pendingAction}
              </Badge>
            )}
            {post.deleted && (
              <Badge variant="destructive" title="Eliminada (soft delete)">
                Eliminada
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: "author",
      header: "Autor",
      meta: { label: "Autor" },
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.authorLabel}
        </span>
      ),
    },
    {
      id: "featured",
      header: "Destacada",
      meta: { label: "Destacada" },
      cell: ({ row }) => (row.original.isFeatured ? "Sí" : "—"),
    },
    {
      id: "date",
      header: "Fecha",
      meta: { label: "Fecha" },
      cell: ({ row }) => (
        <LocalTimestamp
          ms={row.original.dateMs}
          className="text-sm text-muted-foreground"
        />
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Acciones</div>,
      meta: { mobile: "actions", label: "Acciones" },
      cell: ({ row }) => {
        const post = row.original;
        return (
          <NewsRowActions
            id={post.id}
            title={post.title}
            canApprove={canApprove}
            showDecision={
              post.status === "PENDING_REVIEW" || !!post.pendingAction
            }
            isPublished={post.status === "PUBLISHED"}
            isDeleted={post.deleted}
          />
        );
      },
    },
  ];
  const table = useReactTable({
    data: reorder.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    // Mismas reglas que eliminar nota por nota (ver `/api/admin/news/bulk`).
    enableRowSelection: (row) =>
      canApprove ||
      (row.original.isMine && row.original.status !== "PUBLISHED"),
  });
  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  const ids = selected.map((p) => p.id);

  return (
    <div className="space-y-3">
      {canReorder ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Destacadas del inicio, en el orden en que aparecen.
          </p>
          {!reorder.active ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRowSelection({});
                reorder.start();
              }}
              disabled={rows.length < 2}
            >
              <ArrowUpDown className="mr-1 h-4 w-4" /> Reordenar
            </Button>
          ) : null}
        </div>
      ) : null}

      <ReorderBar reorder={reorder} hint="La de arriba aparece primero." />

      {!reorder.active ? (
        <BulkActionBar count={ids.length} onClear={() => setRowSelection({})}>
          {canApprove && selected.some((p) => !p.isFeatured) ? (
            <Button
              size="sm"
              variant="outline"
              disabled={bulk.busy}
              onClick={() => bulk.run("feature", ids, "Notas destacadas")}
            >
              <Star className="mr-1 h-4 w-4" /> Destacar
            </Button>
          ) : null}
          {canApprove && selected.some((p) => p.isFeatured) ? (
            <Button
              size="sm"
              variant="outline"
              disabled={bulk.busy}
              onClick={() =>
                bulk.run("unfeature", ids, "Notas quitadas de destacadas")
              }
            >
              <StarOff className="mr-1 h-4 w-4" /> Quitar destacada
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="destructive"
            disabled={bulk.busy}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="mr-1 h-4 w-4" /> Eliminar
          </Button>
        </BulkActionBar>
      ) : null}

      <DataTable
        table={table}
        emptyMessage="No hay notas todavía."
        reorder={
          reorder.active
            ? { onMove: reorder.move, nameOf: (p) => p.title }
            : undefined
        }
      />

      <BulkConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`¿Eliminar ${ids.length} nota${ids.length === 1 ? "" : "s"}?`}
        description="Las que alguna vez se publicaron quedan en “Eliminadas” y se pueden restaurar; los borradores que nunca salieron se borran del todo."
        names={selected.map((p) => p.title)}
        confirmLabel="Eliminar"
        destructive
        busy={bulk.busy}
        onConfirm={async () => {
          const ok = await bulk.run("delete", ids, "Notas eliminadas");
          if (ok) setConfirmDelete(false);
        }}
      />
    </div>
  );
}
