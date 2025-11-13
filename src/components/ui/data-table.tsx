"use client"

import {
    type Table as ReactTable,
    flexRender,
} from "@tanstack/react-table"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Table as UiTable,
} from "@/components/ui/table"

interface DataTableProps<TData> {
  table: ReactTable<TData>
  isLoading?: boolean
  emptyMessage?: React.ReactNode
  loadingMessage?: React.ReactNode
}

export function DataTable<TData>({
  table,
  isLoading = false,
  emptyMessage = "No se encontraron resultados.",
  loadingMessage = "Cargando…",
}: DataTableProps<TData>) {
  const rows = table.getRowModel().rows

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <UiTable>
          <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="hover:bg-transparent"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
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
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
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
  )
}

interface DataTablePaginationProps<TData> {
  table: ReactTable<TData>
  totalItems: number
  isLoading?: boolean
  loadingLabel?: string
}

export function DataTablePagination<TData>({
  table,
  totalItems,
  isLoading = false,
  loadingLabel = "Actualizando…",
}: DataTablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = table.getPageCount()

  const fromItem =
    totalItems === 0 ? 0 : pageIndex * pageSize + 1
  const toItem =
    totalItems === 0
      ? 0
      : Math.min(totalItems, (pageIndex + 1) * pageSize)

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
  )
}



