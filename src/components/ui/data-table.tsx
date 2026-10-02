"use client";

import {
  type Cell,
  type RowData,
  type Table as ReactTable,
  flexRender,
} from "@tanstack/react-table";
import * as React from "react";

import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

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

interface DataTableProps<TData> {
  table: ReactTable<TData>;
  isLoading?: boolean;
  emptyMessage?: React.ReactNode;
  loadingMessage?: React.ReactNode;
}

export function DataTable<TData>({
  table,
  isLoading = false,
  emptyMessage = "No se encontraron resultados.",
  loadingMessage = "Cargando…",
}: DataTableProps<TData>) {
  const rows = table.getRowModel().rows;
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
      />
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
}: Required<DataTableProps<TData>>) {
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
        const render = (cell: Cell<TData, unknown>) =>
          flexRender(cell.column.columnDef.cell, cell.getContext());

        return (
          <li
            key={row.id}
            data-state={row.getIsSelected() ? "selected" : undefined}
            className="flex flex-col gap-2 p-4 data-[state=selected]:bg-muted"
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
            {actions.length > 0 && (
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
