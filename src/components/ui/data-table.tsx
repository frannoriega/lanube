"use client";

import {
  type Cell,
  type ColumnDef,
  type Row,
  type RowData,
  type Table as ReactTable,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import {
  REORDER_SCREEN_READER_INSTRUCTIONS,
  reorderAnnouncements,
  useReorderSensors,
} from "@/components/molecules/reorder-list";

import { Button } from "@/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Table as UiTable,
} from "@/components/ui/table";

/**
 * Rol de una columna en la vista de tarjetas (< `md`) — milestone 14, decisión Part A.2.
 *
 * En un teléfono una tabla de 4–6 columnas obliga a scrollear de costado (o, peor, ensancha
 * toda la página). Por debajo de `md` el `DataTable` dibuja **una tarjeta por fila** armada a
 * partir de estos roles, declarados en cada columna con `meta: { mobile: "…" }`:
 *   - `title`   — encabezado de la tarjeta, en negrita (si hay varias, van una al lado de la otra: "Nombre Apellido").
 *   - `badge`   — chips de estado, arriba a la derecha.
 *   - `meta`    — pares "Etiqueta: valor" debajo del título (es el valor por defecto).
 *   - `actions` — botones al pie de la tarjeta.
 *   - `leading` — controles a la izquierda del título (p. ej. el checkbox de selección).
 *   - `hidden`  — no se muestra en la tarjeta.
 * Se eligió esto y no "ocultar columnas secundarias" porque esas columnas (capacidad,
 * prioridad, estado) suelen ser justo lo que el admin vino a mirar.
 */
export type MobileColumnRole =
  | "title"
  | "meta"
  | "badge"
  | "actions"
  | "leading"
  | "hidden";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Rol de la columna en la vista de tarjetas (por defecto `"meta"`). */
    mobile?: MobileColumnRole;
    /**
     * Etiqueta legible de la columna. La usa la tarjeta para los pares "Etiqueta: valor"
     * (el `header` suele ser un botón de orden, no texto) y otros consumidores, como el
     * selector de columnas de participantes.
     */
    label?: string;
  }
}

/** Etiqueta de una celda en la tarjeta: `meta.label`, o el header si es texto, o el id. */
function cellLabel<TData>(cell: Cell<TData, unknown>): string {
  const def = cell.column.columnDef;
  if (def.meta?.label) return def.meta.label;
  if (typeof def.header === "string") return def.header;
  return cell.column.id;
}

/**
 * Instancia de TanStack Table para listas chicas y estáticas (sin orden, filtro ni
 * paginación del lado de la tabla): las de configuración del admin, que antes eran `<Table>`
 * escritas a mano y se migraron al `DataTable` en el milestone 14 para ganar la vista de
 * tarjetas en teléfonos. `getRowId` usa el `id` de la fila cuando existe, así las filas
 * conservan su identidad (y su foco) al reordenar o refrescar.
 */
export function useStaticTable<TData>(
  data: TData[],
  columns: ColumnDef<TData, unknown>[],
): ReactTable<TData> {
  return useReactTable<TData>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row, index) => {
      const id = (row as { id?: unknown }).id;
      return typeof id === "string" ? id : String(index);
    },
  });
}

interface DataTableProps<TData> {
  table: ReactTable<TData>;
  isLoading?: boolean;
  emptyMessage?: React.ReactNode;
  loadingMessage?: React.ReactNode;
  /**
   * Si se pasa, la fila entera (o la tarjeta) es clickeable y operable con teclado (Enter /
   * Espacio) — p. ej. la auditoría, donde cada fila abre su detalle. No usar junto con
   * controles interactivos dentro de las celdas.
   */
  onRowClick?: (row: TData) => void;
  /**
   * Modo "Reordenar" en la misma tabla (milestone 16, ver `molecules/table-reorder.tsx`).
   * Mientras está presente, cada fila se arrastra desde una manija al final, se numeran las
   * posiciones y se ocultan las columnas `actions` y `leading` (no se edita ni se
   * selecciona mientras se ordena). `onRowClick` queda desactivado.
   */
  reorder?: DataTableReorderProps<TData>;
}

export interface DataTableReorderProps<TData> {
  /** Mueve la fila `activeId` al lugar de `overId`. */
  onMove: (activeId: string, overId: string) => void;
  /** Nombre de una fila, para la manija ("Mover Sala A") y los lectores de pantalla. */
  nameOf: (row: TData) => string;
}

/** Columnas que no se muestran mientras se reordena. */
function hiddenWhileReordering(
  meta: { mobile?: MobileColumnRole } | undefined,
) {
  return meta?.mobile === "actions" || meta?.mobile === "leading";
}

/**
 * Contexto de arrastre compartido por la tabla y las tarjetas: sensores (mouse, dedo,
 * teclado), anuncios en castellano y el movimiento al soltar.
 */
function ReorderDnd<TData>({
  table,
  reorder,
  children,
}: {
  table: ReactTable<TData>;
  reorder: DataTableReorderProps<TData>;
  children: React.ReactNode;
}) {
  const sensors = useReorderSensors();
  const rows = table.getRowModel().rows;
  const ids = rows.map((r) => r.id);
  const nameOf = (id: string) => {
    const row = rows.find((r) => r.id === id);
    return row ? reorder.nameOf(row.original) : id;
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id)
      reorder.onMove(String(active.id), String(over.id));
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements: reorderAnnouncements(nameOf, ids),
        screenReaderInstructions: REORDER_SCREEN_READER_INSTRUCTIONS,
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/** La manija: lo único que se arrastra, y lo único enfocable para mover con teclado. */
function ReorderHandle({
  label,
  sortable,
}: {
  label: string;
  sortable: ReturnType<typeof useSortable>;
}) {
  return (
    <button
      type="button"
      ref={sortable.setActivatorNodeRef}
      {...sortable.attributes}
      {...sortable.listeners}
      aria-label={`Mover ${label}`}
      className="flex h-10 w-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
    >
      <GripVertical className="h-5 w-5" aria-hidden />
    </button>
  );
}

/** Número de posición (1-based) que acompaña a cada fila mientras se reordena. */
function PositionBadge({ position }: { position: number }) {
  return (
    <span className="inline-block w-6 text-right text-sm tabular-nums text-muted-foreground">
      {position}
    </span>
  );
}

/** Una fila de la tabla en modo reordenar. */
function SortableTableRow<TData>({
  row,
  position,
  reorder,
}: {
  row: Row<TData>;
  position: number;
  reorder: DataTableReorderProps<TData>;
}) {
  const sortable = useSortable({ id: row.id });
  return (
    <TableRow
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Translate.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className={cn(
        "bg-card",
        sortable.isDragging && "relative z-10 shadow-lg ring-2 ring-ring",
      )}
    >
      <TableCell className="w-10">
        <PositionBadge position={position} />
      </TableCell>
      {row
        .getVisibleCells()
        .filter((cell) => !hiddenWhileReordering(cell.column.columnDef.meta))
        .map((cell) => (
          <TableCell key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      <TableCell className="w-12 text-right">
        <ReorderHandle
          label={reorder.nameOf(row.original)}
          sortable={sortable}
        />
      </TableCell>
    </TableRow>
  );
}

/** Props de accesibilidad + handlers para una fila clickeable (tabla o tarjeta). */
function clickableRowProps<TData>(
  original: TData,
  onRowClick: ((row: TData) => void) | undefined,
) {
  if (!onRowClick) return {};
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-haspopup": "dialog" as const,
    onClick: () => onRowClick(original),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onRowClick(original);
      }
    },
  };
}

export function DataTable<TData>({
  table,
  isLoading = false,
  emptyMessage = "No se encontraron resultados.",
  loadingMessage = "Cargando…",
  onRowClick: onRowClickProp,
  reorder,
}: DataTableProps<TData>) {
  const rows = table.getRowModel().rows;
  const onRowClick = reorder ? undefined : onRowClickProp;
  // Tabla desde `md`; tarjetas por debajo. Se decide en JS (no con `hidden md:block`) para no
  // duplicar en el DOM los controles de cada fila (selects, checkboxes) en las dos vistas.
  const isDesktop = useMediaQuery("(min-width: 768px)", true);

  if (!isDesktop) {
    return (
      <DataTableCards
        table={table}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        loadingMessage={loadingMessage}
        onRowClick={onRowClick}
        reorder={reorder}
      />
    );
  }

  if (reorder) {
    const extraCols = 2; // posición + manija
    return (
      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <ReorderDnd table={table} reorder={reorder}>
            <UiTable>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="hover:bg-transparent"
                  >
                    <TableHead>
                      <span className="sr-only">Posición</span>
                    </TableHead>
                    {headerGroup.headers
                      .filter(
                        (h) => !hiddenWhileReordering(h.column.columnDef.meta),
                      )
                      .map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      ))}
                    <TableHead>
                      <span className="sr-only">Mover</span>
                    </TableHead>
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={table.getAllLeafColumns().length + extraCols}
                      className="h-32 text-center text-sm text-muted-foreground"
                    >
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, index) => (
                    <SortableTableRow
                      key={row.id}
                      row={row}
                      position={index + 1}
                      reorder={reorder}
                    />
                  ))
                )}
              </TableBody>
            </UiTable>
          </ReorderDnd>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <UiTable>
          <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading && rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={table.getAllLeafColumns().length}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-la-nube-primary" />
                    <span>{loadingMessage}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={table.getAllLeafColumns().length}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={onRowClick ? "cursor-pointer" : undefined}
                  {...clickableRowProps(row.original, onRowClick)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </UiTable>
      </div>
    </div>
  );
}

/**
 * Vista de tarjetas del `DataTable` (< `md`). Ver `MobileColumnRole` para cómo cada columna
 * decide dónde aparece.
 */
function DataTableCards<TData>({
  table,
  isLoading,
  emptyMessage,
  loadingMessage,
  onRowClick,
  reorder,
}: Omit<Required<DataTableProps<TData>>, "onRowClick" | "reorder"> &
  Pick<DataTableProps<TData>, "onRowClick" | "reorder">) {
  const rows = table.getRowModel().rows;

  if (isLoading && rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-la-nube-primary" />
        <span>{loadingMessage}</span>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  if (reorder) {
    return (
      <ReorderDnd table={table} reorder={reorder}>
        <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {rows.map((row, index) => (
            <SortableCard
              key={row.id}
              row={row}
              position={index + 1}
              reorder={reorder}
            />
          ))}
        </ol>
      </ReorderDnd>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {rows.map((row) => {
        const byRole = (role: MobileColumnRole) =>
          row
            .getVisibleCells()
            .filter(
              (cell) => (cell.column.columnDef.meta?.mobile ?? "meta") === role,
            );
        const leading = byRole("leading");
        const titles = byRole("title");
        const badges = byRole("badge");
        const metas = byRole("meta");
        const actions = byRole("actions");
        // Tarjeta mínima (solo título + acciones, p. ej. tipos de reserva): las acciones van en
        // la misma línea que el título en vez de en una fila propia casi vacía.
        const inlineActions =
          metas.length === 0 && badges.length === 0 && actions.length > 0;
        const render = (cell: Cell<TData, unknown>) =>
          flexRender(cell.column.columnDef.cell, cell.getContext());

        return (
          <li
            key={row.id}
            data-state={row.getIsSelected() ? "selected" : undefined}
            className={cn(
              "flex flex-col gap-2 p-4 data-[state=selected]:bg-muted",
              onRowClick &&
                "cursor-pointer hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
            )}
            {...clickableRowProps(row.original, onRowClick)}
          >
            {(leading.length > 0 || titles.length > 0 || badges.length > 0) && (
              <div className="flex items-start gap-3">
                {leading.map((cell) => (
                  <div key={cell.id} className="shrink-0 pt-0.5">
                    {render(cell)}
                  </div>
                ))}
                <div className="flex min-w-0 flex-1 flex-wrap gap-x-1 font-medium [overflow-wrap:anywhere] text-foreground">
                  {titles.map((cell) => (
                    <span key={cell.id}>{render(cell)}</span>
                  ))}
                </div>
                {badges.length > 0 && (
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {badges.map((cell) => (
                      <span key={cell.id}>{render(cell)}</span>
                    ))}
                  </div>
                )}
                {inlineActions && (
                  <div className="-my-1.5 flex shrink-0 items-center gap-1">
                    {actions.map((cell) => (
                      <React.Fragment key={cell.id}>
                        {render(cell)}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            )}
            {metas.length > 0 && (
              <dl
                className={cn(
                  "grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm",
                  leading.length > 0 && "pl-8",
                )}
              >
                {metas.map((cell) => (
                  <React.Fragment key={cell.id}>
                    <dt className="text-muted-foreground">{cellLabel(cell)}</dt>
                    <dd className="min-w-0 [overflow-wrap:anywhere] text-foreground">
                      {render(cell)}
                    </dd>
                  </React.Fragment>
                ))}
              </dl>
            )}
            {actions.length > 0 && !inlineActions && (
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                {actions.map((cell) => (
                  <React.Fragment key={cell.id}>{render(cell)}</React.Fragment>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Tarjeta compacta del modo reordenar en teléfonos: posición, título y manija. Los datos
 * secundarios se omiten para que entren más filas en pantalla mientras se arrastra.
 */
function SortableCard<TData>({
  row,
  position,
  reorder,
}: {
  row: Row<TData>;
  position: number;
  reorder: DataTableReorderProps<TData>;
}) {
  const sortable = useSortable({ id: row.id });
  const titles = row
    .getVisibleCells()
    .filter((cell) => cell.column.columnDef.meta?.mobile === "title");
  return (
    <li
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Translate.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className={cn(
        "flex items-center gap-3 bg-card py-2 pr-2 pl-4",
        sortable.isDragging && "relative z-10 shadow-lg ring-2 ring-ring",
      )}
    >
      <PositionBadge position={position} />
      <div className="flex min-w-0 flex-1 flex-wrap gap-x-1 font-medium [overflow-wrap:anywhere]">
        {titles.length > 0
          ? titles.map((cell) => (
              <span key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </span>
            ))
          : reorder.nameOf(row.original)}
      </div>
      <ReorderHandle label={reorder.nameOf(row.original)} sortable={sortable} />
    </li>
  );
}

interface DataTablePaginationProps<TData> {
  table: ReactTable<TData>;
  totalItems: number;
  isLoading?: boolean;
  loadingLabel?: string;
}

export function DataTablePagination<TData>({
  table,
  totalItems,
  isLoading = false,
  loadingLabel = "Actualizando…",
}: DataTablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();

  const fromItem = totalItems === 0 ? 0 : pageIndex * pageSize + 1;
  const toItem =
    totalItems === 0 ? 0 : Math.min(totalItems, (pageIndex + 1) * pageSize);

  return (
    <div className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
      <div>
        {totalItems > 0 ? (
          <span>
            Mostrando {fromItem} - {toItem} de {totalItems} registros
          </span>
        ) : (
          <span>No hay resultados para mostrar</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage() || isLoading}
        >
          Anterior
        </Button>
        <span className="text-sm">
          Página {pageCount === 0 ? 0 : pageIndex + 1} de {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage() || isLoading}
        >
          Siguiente
        </Button>
      </div>
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-b border-la-nube-primary" />
          {loadingLabel}
        </div>
      )}
    </div>
  );
}
