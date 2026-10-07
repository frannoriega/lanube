"use client";

import { Button } from "@/components/ui/button";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
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
import { ToneBadge, type StatusTone } from "@/components/atoms/status-badge";
import {
  DECISION_SOURCE_STATUSES,
  PARTICIPANT_STATUS_LABEL,
  reapprovalFits,
} from "@/lib/constants/participants";
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
  /** Cupo efectivo del evento (0 = sin cupo), para avisar antes de re-aprobar rechazados. */
  capacity: number;
  /** Lugares ocupados hoy (PENDING + APPROVED). */
  spotsTaken: number;
}

const dateFmt = (ms: number) =>
  new Date(ms).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

/**
 * Estados que se pueden seleccionar para decidir: los que alguna decisión toma
 * (`DECISION_SOURCE_STATUSES`). Desde el milestone 25 incluye REJECTED, para poder volver a
 * aprobar a alguien rechazado si queda cupo. CANCELLED no: la canceló la propia persona.
 */
const DECIDABLE: ParticipantStatus[] = [
  ...new Set([
    ...DECISION_SOURCE_STATUSES.approve,
    ...DECISION_SOURCE_STATUSES.reject,
  ]),
];

/** Las filas seleccionadas a las que una decisión efectivamente se aplica. */
function applicableTo(
  decision: "approve" | "reject",
  rows: ParticipantRow[],
): ParticipantRow[] {
  return rows.filter((r) =>
    DECISION_SOURCE_STATUSES[decision].includes(r.status),
  );
}

/**
 * Participant status → shared tone. This was a fifth light-only `bg-*-100 text-*-800`
 * map (milestone-10 F2.6); the tones live in atoms/status-badge.tsx and define both
 * themes once. Don't reintroduce colour classes here.
 */
const STATUS_TONE: Record<ParticipantStatus, StatusTone> = {
  [ParticipantStatus.PENDING]: "warning",
  [ParticipantStatus.APPROVED]: "success",
  [ParticipantStatus.REJECTED]: "danger",
  [ParticipantStatus.CANCELLED]: "neutral",
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
  capacity,
  spotsTaken,
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
      meta: { mobile: "leading", label: "Seleccionar" },
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
      meta: { mobile: "title", label: "Email" },
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
        <ToneBadge tone={STATUS_TONE[row.original.status]}>
          {PARTICIPANT_STATUS_LABEL[row.original.status]}
        </ToneBadge>
      ),
      meta: { mobile: "badge", label: "Estado" },
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
              const label = column.columnDef.meta?.label ?? column.id;
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
              disabled={applicableTo("approve", selectedRows).length === 0}
              onClick={() => setDecision("approve")}
            >
              <Check className="mr-1 h-4 w-4" />
              Aprobar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={applicableTo("reject", selectedRows).length === 0}
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
        capacity={capacity}
        spotsTaken={spotsTaken}
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
  participants: selected,
  capacity,
  spotsTaken,
  onOpenChange,
  onDone,
}: {
  eventId: string;
  decision: "approve" | "reject" | null;
  participants: ParticipantRow[];
  capacity: number;
  spotsTaken: number;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  // Solo a quienes la decisión se aplica; el resto de la selección se informa y no se manda
  // (p. ej. aprobar a alguien ya aprobado, o rechazar a alguien ya rechazado).
  const participants = decision ? applicableTo(decision, selected) : [];
  const skipped = selected.length - participants.length;
  const reapproving =
    decision === "approve"
      ? participants.filter((p) => p.status === ParticipantStatus.REJECTED)
          .length
      : 0;
  const capacityCheck = reapprovalFits({
    capacity,
    taken: spotsTaken,
    reapproving,
  });
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset the typed fields whenever the dialog (re)opens for a decision.
  const open = decision !== null;
  const keyword = decision ? CONFIRM_KEYWORD[decision] : "";
  const armed =
    confirmText.trim().toUpperCase() === keyword &&
    participants.length > 0 &&
    capacityCheck.fits;

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
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent className="max-h-[85vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {decision === "approve"
              ? "Aprobar inscripciones"
              : "Rechazar inscripciones"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {decision === "approve"
              ? "Se confirmará el lugar de estas personas y se les enviará un email."
              : "Se rechazarán estas inscripciones y se les enviará un email."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4">
          {decision === "reject" && (
            // Milestone 25 (seguimiento de S5): una persona rechazada no puede volver a
            // inscribirse con ese correo; la única vuelta es que un admin la re-apruebe, y eso
            // ocupa un lugar.
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <p className="font-medium">Pensalo antes de rechazar.</p>
              <p className="mt-1 text-muted-foreground">
                Estas personas no van a poder volver a inscribirse con ese
                correo. Más adelante solo vas a poder volver a aprobarlas si
                todavía queda lugar en el evento.
              </p>
            </div>
          )}

          {reapproving > 0 && (
            <div
              className={
                capacityCheck.fits
                  ? "rounded-md border p-3 text-sm"
                  : "rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
              }
            >
              <p className="font-medium">
                {reapproving === 1
                  ? "Vas a volver a aprobar a 1 persona rechazada."
                  : `Vas a volver a aprobar a ${reapproving} personas rechazadas.`}
              </p>
              <p className="mt-1 text-muted-foreground">
                {capacityCheck.free === null
                  ? "Este evento no tiene cupo, así que entran todas."
                  : capacityCheck.fits
                    ? `Cada una ocupa un lugar: quedan ${capacityCheck.free}.`
                    : `Cada una ocupa un lugar y ${
                        capacityCheck.free === 0
                          ? "el cupo está lleno"
                          : `quedan solo ${capacityCheck.free}`
                      }. No se aprueba ninguna: elegí a quién, o rechazá a otra persona antes.`}
              </p>
            </div>
          )}

          <div className="rounded-md border">
            <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {participants.length} participante
              {participants.length === 1 ? "" : "s"}
              {skipped > 0 &&
                ` · ${skipped} ya ${skipped === 1 ? "está" : "están"} en ese estado`}
            </div>
            <ul className="max-h-40 overflow-y-auto px-3 py-2 text-sm">
              {participants.map((p) => (
                <li key={p.id} className="truncate py-0.5">
                  {p.displayEmail ?? p.email}
                  {p.status === ParticipantStatus.REJECTED && (
                    <span className="text-muted-foreground"> · rechazada</span>
                  )}
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

        <ResponsiveDialogFooter>
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
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
