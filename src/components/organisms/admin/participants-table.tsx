"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  type ExportColumn,
  cellFiles,
  exportCell,
} from "@/lib/events/form-export";
import type { UploadedFile } from "@/lib/events/form-schema";
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";

export interface ParticipantRow {
  id: string;
  email: string;
  displayEmail: string | null;
  cancelled: boolean;
  createdAt: number;
  answers: Record<string, unknown>;
}

interface ParticipantsTableProps {
  eventId: string;
  columns: ExportColumn[];
  rows: ParticipantRow[];
}

const dateFmt = (ms: number) =>
  new Date(ms).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

/** A sortable column header button (mirrors the admin users table). */
function SortHeader({
  title,
  sorted,
  onToggle,
}: {
  title: string;
  sorted: false | "asc" | "desc";
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="flex cursor-pointer items-center gap-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
      onClick={onToggle}
    >
      <span>{title}</span>
      {sorted === "asc" ? (
        <ArrowUp className="h-3 w-3" />
      ) : sorted === "desc" ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-60" />
      )}
    </button>
  );
}

/** "Ver" (inline, new tab) + "Descargar" for one private participant file. */
function FileLinks({ eventId, file }: { eventId: string; file: UploadedFile }) {
  const base = `/api/admin/events/${eventId}/participants/file?url=${encodeURIComponent(file.url)}`;
  return (
    <div className="flex items-center gap-1">
      <span className="max-w-[10rem] truncate text-sm" title={file.name}>
        {file.name}
      </span>
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Ver"
      >
        <a href={base} target="_blank" rel="noopener noreferrer">
          <Eye className="h-4 w-4" />
          <span className="sr-only">Ver {file.name}</span>
        </a>
      </Button>
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Descargar"
      >
        <a href={`${base}&download=1`}>
          <Download className="h-4 w-4" />
          <span className="sr-only">Descargar {file.name}</span>
        </a>
      </Button>
    </div>
  );
}

export function ParticipantsTable({
  eventId,
  columns,
  rows,
}: ParticipantsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const columnDefs = useMemo<ColumnDef<ParticipantRow>[]>(() => {
    const emailCol: ColumnDef<ParticipantRow> = {
      id: "email",
      accessorFn: (r) => r.displayEmail ?? r.email,
      header: ({ column }) => (
        <SortHeader
          title="Email"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      enableHiding: false,
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.displayEmail ?? row.original.email}
        </span>
      ),
      meta: { label: "Email" },
    };

    const answerCols: ColumnDef<ParticipantRow>[] = columns.map((col) => ({
      id: col.key,
      accessorFn: (r) => exportCell(col, r.answers),
      header: ({ column }) => (
        <SortHeader
          title={col.label}
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => {
        const files = cellFiles(col, row.original.answers);
        if (files.length > 0) {
          return (
            <div className="flex flex-col gap-1">
              {files.map((f, i) => (
                <FileLinks key={`${f.url}-${i}`} eventId={eventId} file={f} />
              ))}
            </div>
          );
        }
        return exportCell(col, row.original.answers) || "—";
      },
      meta: { label: col.label },
    }));

    const createdCol: ColumnDef<ParticipantRow> = {
      id: "createdAt",
      accessorFn: (r) => r.createdAt,
      header: ({ column }) => (
        <SortHeader
          title="Inscripción"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {dateFmt(row.original.createdAt)}
        </span>
      ),
      meta: { label: "Inscripción" },
    };

    const statusCol: ColumnDef<ParticipantRow> = {
      id: "status",
      accessorFn: (r) => (r.cancelled ? "Cancelado" : "Activo"),
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Estado
        </span>
      ),
      cell: ({ row }) =>
        row.original.cancelled ? (
          <Badge className="bg-red-100 text-red-700">Cancelado</Badge>
        ) : (
          <Badge className="bg-green-100 text-green-800">Activo</Badge>
        ),
      meta: { label: "Estado" },
    };

    return [emailCol, ...answerCols, createdCol, statusCol];
  }, [columns, eventId]);

  const table = useReactTable<ParticipantRow>({
    data: rows,
    columns: columnDefs,
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  const hideableColumns = table
    .getAllLeafColumns()
    .filter((c) => c.getCanHide());

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Buscar en las inscripciones…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="sm:max-w-xs"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-fit">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Columnas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
            <DropdownMenuLabel>Mostrar columnas</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {hideableColumns.map((column) => {
              const label =
                (column.columnDef.meta as { label?: string } | undefined)
                  ?.label ?? column.id;
              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(v) => column.toggleVisibility(!!v)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DataTable
        table={table}
        emptyMessage="No se encontraron inscripciones."
      />

      <DataTablePagination
        table={table}
        totalItems={table.getFilteredRowModel().rows.length}
      />
    </div>
  );
}
