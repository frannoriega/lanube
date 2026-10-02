"use client";

/**
 * Lista de notas del admin (`/admin/news`) sobre el `DataTable` compartido (milestone 14):
 * tabla desde `md`, tarjetas por debajo. Antes era una `<Table>` escrita a mano en la página
 * (Server Component) que en un teléfono ensanchaba toda la página a ~635px.
 *
 * Es client component porque las celdas de TanStack son funciones; la página le pasa filas
 * ya serializables (`NewsAdminRow`, con fechas en ms `number`).
 */

import { Badge } from "@/components/ui/badge";
import { DataTable, useStaticTable } from "@/components/ui/data-table";
import { LocalTimestamp } from "@/components/molecules/local-date";
import { NewsRowActions } from "@/components/organisms/admin/news-row-actions";
import type { ColumnDef } from "@tanstack/react-table";

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
  isFeatured: boolean;
  /** Fecha a mostrar (publicación, o creación si nunca se publicó), en ms. */
  dateMs: number;
}

export function NewsAdminTable({
  rows,
  canApprove,
}: {
  rows: NewsAdminRow[];
  canApprove: boolean;
}) {
  const columns: ColumnDef<NewsAdminRow>[] = [
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
  const table = useStaticTable(rows, columns);
  return <DataTable table={table} emptyMessage="No hay notas todavía." />;
}
