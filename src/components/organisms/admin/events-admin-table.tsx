"use client";

/**
 * Lista de eventos del admin (`/admin/events`) como tabla (milestone 16).
 *
 * Antes era una grilla de tarjetas grandes con portada 16:9: lindas, pero se veían ~6
 * eventos por pantalla y no había dónde poner una selección. Una tabla deja escanear
 * fechas, estado e inscriptos de un vistazo, admite checkboxes para las **acciones en lote**
 * (cancelar, destacar, quitar de destacados) y, por ser el `DataTable` compartido, en el
 * teléfono sigue siendo una tarjeta por evento — ahora compacta.
 *
 * Con el filtro "Destacados" (`featured`) la misma tabla muestra solo los destacados, en el
 * orden del landing, y permite reordenarlos ahí mismo (reemplaza el modal "Reordenar
 * destacados" del milestone 14).
 *
 * La página (Server Component) arma filas serializables (`EventAdminRow`).
 */

import {
  BulkActionBar,
  BulkConfirmDialog,
  selectionColumn,
  useBulkAction,
} from "@/components/molecules/bulk-actions";
import { EventCover } from "@/components/molecules/event-cover";
import { LocalDateRange } from "@/components/molecules/local-date";
import {
  ReorderBar,
  useTableReorder,
} from "@/components/molecules/table-reorder";
import { EventCardActions } from "@/components/organisms/admin/event-card-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { apiErrorMessage, apiSend } from "@/lib/api/client";
import {
  EVENT_STATUS_LABELS,
  type EventDisplayStatus,
  WEEKDAY_SHORT_LABELS,
} from "@/lib/constants/events";
import { cn } from "@/lib/utils";
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

/** Fila serializable que arma la página a partir de `listEvents`. */
export interface EventAdminRow {
  id: string;
  name: string;
  imageUrl: string | null;
  eventType: string;
  typeName: string;
  spaceName: string;
  status: EventDisplayStatus;
  isFeatured: boolean;
  startMs: number;
  /** Última fecha (fin de la recurrencia), o `null` si es de un solo día. */
  lastMs: number | null;
  weekdays: number[];
  /** "10:00–13:00", ya formateado en la zona del panel. */
  timeRange: string;
  form: { slug: string; opensAt: number; closesAt: number } | null;
  participants: number;
}

const STATUS_BADGE_CLASS: Record<EventDisplayStatus, string> = {
  DRAFT: "",
  PUBLISHED:
    "border-transparent bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
  PAUSED:
    "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
  ENDED: "",
  CANCELLED: "border-transparent bg-destructive/10 text-destructive",
};

function StatusBadge({ status }: { status: EventDisplayStatus }) {
  const tinted =
    status === "PUBLISHED" || status === "PAUSED" || status === "CANCELLED";
  return (
    <Badge
      variant={tinted ? "default" : "outline"}
      className={cn(
        "font-normal",
        tinted ? STATUS_BADGE_CLASS[status] : "text-muted-foreground",
      )}
    >
      {EVENT_STATUS_LABELS[status]}
    </Badge>
  );
}

type Pending = "delete" | null;

export function EventsAdminTable({
  rows,
  featuredView,
  startReordering = false,
}: {
  rows: EventAdminRow[];
  /** Vista "Destacados": solo los destacados, en orden, y se pueden reordenar. */
  featuredView: boolean;
  /** Entrar directo al modo reordenar (link "Reordenar destacados" desde la vista normal). */
  startReordering?: boolean;
}) {
  const router = useRouter();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pending, setPending] = useState<Pending>(null);

  const reorder = useTableReorder(rows, async (orderedIds) => {
    try {
      await apiSend("/api/admin/events/featured-order", "POST", {
        orderedIds,
      });
      toast.success("Orden guardado");
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo guardar el orden"));
      throw err;
    }
  });
  // Abrir en modo reordenar si se llegó desde "Reordenar destacados". Se hace en el
  // render inicial (no en un efecto) para no pintar un cuadro sin manijas.
  const [autoStarted, setAutoStarted] = useState(false);
  if (startReordering && featuredView && !autoStarted && rows.length > 1) {
    setAutoStarted(true);
    reorder.start();
  }

  const bulk = useBulkAction("/api/admin/events/bulk", () =>
    setRowSelection({}),
  );

  const columns: ColumnDef<EventAdminRow>[] = [
    selectionColumn<EventAdminRow>(),
    {
      id: "event",
      header: "Evento",
      meta: { mobile: "title", label: "Evento" },
      cell: ({ row }) => {
        const e = row.original;
        return (
          <div className="flex min-w-0 items-center gap-3">
            <EventCover
              imageUrl={e.imageUrl}
              name={e.name}
              eventType={e.eventType}
              sizes="48px"
              fit="cover"
              className="hidden h-12 w-12 shrink-0 rounded-md border md:block [&_svg]:h-5 [&_svg]:w-5"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-medium [overflow-wrap:anywhere]">
                {e.isFeatured ? (
                  <Star
                    className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500"
                    aria-label="Destacado"
                  />
                ) : null}
                {e.name}
              </div>
              <div className="text-xs font-normal text-muted-foreground">
                {e.typeName} · {e.spaceName}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: "dates",
      header: "Fechas",
      meta: { label: "Fechas" },
      cell: ({ row }) => {
        const e = row.original;
        return (
          <div className="space-y-1 text-sm">
            <div className="whitespace-nowrap">
              <LocalDateRange startMs={e.startMs} endMs={e.lastMs} />
            </div>
            <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              {e.weekdays.map((d) => (
                <span
                  key={d}
                  className="rounded border border-border px-1 py-px text-[10px] font-medium uppercase"
                >
                  {WEEKDAY_SHORT_LABELS[d]}
                </span>
              ))}
              <span className="tabular-nums">{e.timeRange}</span>
            </div>
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Estado",
      meta: { mobile: "badge", label: "Estado" },
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "registrations",
      header: "Inscripción",
      meta: { label: "Inscripción" },
      cell: ({ row }) => {
        const e = row.original;
        return (
          <div className="space-y-0.5 text-sm">
            <div className="tabular-nums">
              {e.participants} inscripto{e.participants === 1 ? "" : "s"}
            </div>
            {e.form ? (
              <div className="text-xs whitespace-nowrap text-muted-foreground">
                <LocalDateRange
                  startMs={e.form.opensAt}
                  endMs={e.form.closesAt}
                />
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Sin formulario
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Acciones</div>,
      meta: { mobile: "actions", label: "Acciones" },
      cell: ({ row }) => {
        const e = row.original;
        return (
          <EventCardActions
            inline
            eventId={e.id}
            formSlug={e.form?.slug ?? null}
            formPublished={e.status === "PUBLISHED"}
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
    // Un evento cancelado no se puede volver a cancelar ni destacar.
    enableRowSelection: (row) => row.original.status !== "CANCELLED",
  });
  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  const ids = selected.map((e) => e.id);
  const anyUnfeatured = selected.some((e) => !e.isFeatured);
  const anyFeatured = selected.some((e) => e.isFeatured);

  return (
    <div className="space-y-3">
      {featuredView ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Destacados del inicio, en el orden en que aparecen.
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

      <ReorderBar reorder={reorder} hint="El de arriba aparece primero." />

      {!reorder.active ? (
        <BulkActionBar count={ids.length} onClear={() => setRowSelection({})}>
          {anyUnfeatured ? (
            <Button
              size="sm"
              variant="outline"
              disabled={bulk.busy}
              onClick={() => bulk.run("feature", ids, "Eventos destacados")}
            >
              <Star className="mr-1 h-4 w-4" /> Destacar
            </Button>
          ) : null}
          {anyFeatured ? (
            <Button
              size="sm"
              variant="outline"
              disabled={bulk.busy}
              onClick={() =>
                bulk.run("unfeature", ids, "Eventos quitados de destacados")
              }
            >
              <StarOff className="mr-1 h-4 w-4" /> Quitar destacado
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="destructive"
            disabled={bulk.busy}
            onClick={() => setPending("delete")}
          >
            <Trash2 className="mr-1 h-4 w-4" /> Cancelar eventos
          </Button>
        </BulkActionBar>
      ) : null}

      <DataTable
        table={table}
        emptyMessage="No hay eventos."
        reorder={
          reorder.active
            ? { onMove: reorder.move, nameOf: (e) => e.name }
            : undefined
        }
      />

      <BulkConfirmDialog
        open={pending === "delete"}
        onOpenChange={(o) => !o && setPending(null)}
        title={`¿Cancelar ${ids.length} evento${ids.length === 1 ? "" : "s"}?`}
        description="Se liberan sus reservas y dejan de mostrarse en el sitio. Se conservan el formulario y los inscriptos, y cada uno se puede reactivar editándolo y guardando."
        names={selected.map((e) => e.name)}
        confirmLabel="Cancelar eventos"
        destructive
        busy={bulk.busy}
        onConfirm={async () => {
          const ok = await bulk.run("delete", ids, "Eventos cancelados");
          if (ok) setPending(null);
        }}
      />
    </div>
  );
}
