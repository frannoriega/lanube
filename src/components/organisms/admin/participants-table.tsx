"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PARTICIPANT_STATUS_LABEL } from "@/lib/constants/participants";
import {
  type ExportColumn,
  cellFiles,
  exportCell,
} from "@/lib/events/form-export";
import type { UploadedFile } from "@/lib/events/form-schema";
import { ParticipantStatus } from "@/types/prisma";
import {
  type ColumnDef,
  type RowSelectionState,
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
  Check,
  Download,
  Eye,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export interface ParticipantRow {
  id: string;
  email: string;
  displayEmail: string | null;
  status: ParticipantStatus;
  createdAt: number;
  answers: Record<string, unknown>;
}

interface ParticipantsTableProps {
  eventId: string;
  columns: ExportColumn[];
  rows: ParticipantRow[];
  /** Manual-approval event → show selection checkboxes + approve/reject actions. */
  requiresApproval: boolean;
}

const dateFmt = (ms: number) =>
  new Date(ms).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

/** Statuses that can still be decided (hold a spot). */
const DECIDABLE: ParticipantStatus[] = [
  ParticipantStatus.PENDING,
  ParticipantStatus.APPROVED,
];

const STATUS_BADGE_CLASS: Record<ParticipantStatus, string> = {
  [ParticipantStatus.PENDING]: "bg-amber-100 text-amber-800",
  [ParticipantStatus.APPROVED]: "bg-green-100 text-green-800",
  [ParticipantStatus.REJECTED]: "bg-red-100 text-red-700",
  [ParticipantStatus.CANCELLED]: "bg-slate-200 text-slate-700",
};

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
  requiresApproval,
}: ParticipantsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);

  const columnDefs = useMemo<ColumnDef<ParticipantRow>[]>(() => {
    const selectCol: ColumnDef<ParticipantRow> = {
      id: "select",
      enableHiding: false,
      header: ({ table }) => (
        <input
          type="checkbox"
          aria-label="Seleccionar todo"
          className="cursor-pointer"
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
      cell: ({ row }) =>
        row.getCanSelect() ? (
          <input
            type="checkbox"
            aria-label="Seleccionar fila"
            className="cursor-pointer"
            checked={row.getIsSelected()}
            onChange={(e) => row.toggleSelected(e.target.checked)}
          />
        ) : null,
    };

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
      accessorFn: (r) => PARTICIPANT_STATUS_LABEL[r.status],
      header: ({ column }) => (
        <SortHeader
          title="Estado"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => (
        <Badge className={STATUS_BADGE_CLASS[row.original.status]}>
          {PARTICIPANT_STATUS_LABEL[row.original.status]}
        </Badge>
      ),
      meta: { label: "Estado" },
    };

    return [
      ...(requiresApproval ? [selectCol] : []),
      emailCol,
      ...answerCols,
      createdCol,
      statusCol,
    ];
  }, [columns, eventId, requiresApproval]);

  const table = useReactTable<ParticipantRow>({
    data: rows,
    columns: columnDefs,
    state: { sorting, globalFilter, columnVisibility, rowSelection },
    getRowId: (r) => r.id,
    enableRowSelection: (row) => DECIDABLE.includes(row.original.status),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
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

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);

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

      {requiresApproval && selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 p-3">
          <span className="text-sm font-medium">
            {selectedRows.length} seleccionado
            {selectedRows.length === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => setDecision("approve")}
            >
              <Check className="mr-1 h-4 w-4" />
              Aprobar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setDecision("reject")}
            >
              <X className="mr-1 h-4 w-4" />
              Rechazar
            </Button>
          </div>
        </div>
      )}

      <DataTable
        table={table}
        emptyMessage="No se encontraron inscripciones."
      />

      <DataTablePagination
        table={table}
        totalItems={table.getFilteredRowModel().rows.length}
      />

      <DecisionDialog
        eventId={eventId}
        decision={decision}
        participants={selectedRows}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
        onDone={() => {
          setDecision(null);
          setRowSelection({});
        }}
      />
    </div>
  );
}

/** Keyword the admin must type to arm the confirmation. */
const CONFIRM_KEYWORD: Record<"approve" | "reject", string> = {
  approve: "APROBAR",
  reject: "RECHAZAR",
};

function DecisionDialog({
  eventId,
  decision,
  participants,
  onOpenChange,
  onDone,
}: {
  eventId: string;
  decision: "approve" | "reject" | null;
  participants: ParticipantRow[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset the typed fields whenever the dialog (re)opens for a decision.
  const open = decision !== null;
  const keyword = decision ? CONFIRM_KEYWORD[decision] : "";
  const armed = confirmText.trim().toUpperCase() === keyword;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setReason("");
      setConfirmText("");
    }
    onOpenChange(next);
  };

  const submit = async () => {
    if (!decision || !armed) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/events/${eventId}/participants/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participantIds: participants.map((p) => p.id),
            decision,
            reason: reason.trim() || null,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message ?? "No se pudo completar la acción");
        return;
      }
      const data = await res.json().catch(() => ({}));
      toast.success(
        decision === "approve"
          ? `${data.decided ?? participants.length} inscripción(es) aprobada(s)`
          : `${data.decided ?? participants.length} inscripción(es) rechazada(s)`,
      );
      setReason("");
      setConfirmText("");
      onDone();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {decision === "approve"
              ? "Aprobar inscripciones"
              : "Rechazar inscripciones"}
          </DialogTitle>
          <DialogDescription>
            {decision === "approve"
              ? "Se confirmará el lugar de estas personas y se les enviará un email."
              : "Se rechazarán estas inscripciones y se les enviará un email."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border">
            <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {participants.length} participante
              {participants.length === 1 ? "" : "s"}
            </div>
            <ul className="max-h-40 overflow-y-auto px-3 py-2 text-sm">
              {participants.map((p) => (
                <li key={p.id} className="truncate py-0.5">
                  {p.displayEmail ?? p.email}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="decision-reason">Motivo (opcional)</Label>
            <Textarea
              id="decision-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                decision === "reject"
                  ? "Se incluye en el email de rechazo. Si lo dejás vacío, se envía un mensaje neutral."
                  : "Se puede incluir una nota interna del motivo."
              }
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="decision-confirm">
              Escribí <span className="font-mono font-semibold">{keyword}</span>{" "}
              para confirmar
            </Label>
            <Input
              id="decision-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            variant={decision === "reject" ? "destructive" : "default"}
            className={
              decision === "approve" ? "bg-green-600 hover:bg-green-700" : ""
            }
            disabled={!armed || submitting}
            onClick={submit}
          >
            {submitting
              ? "Procesando…"
              : decision === "approve"
                ? "Aprobar"
                : "Rechazar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
