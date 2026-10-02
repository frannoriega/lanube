"use client";

import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
} from "@tanstack/react-table";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ToneBadge } from "@/components/atoms/status-badge";
import { LoadError } from "@/components/molecules/load-error";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
import { Button } from "@/components/ui/button";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import useUser from "@/hooks/use-user";
import { apiErrorMessage } from "@/lib/api/client";
import { decideProfileChangeRequest } from "@/lib/api/mutations";
import { PROFILE_CHANGE_STATUS } from "@/lib/constants/profile-requests";
import {
  PROFILE_CHANGE_FIELD_LABELS,
  profileChangeDecisionSchema,
} from "@/lib/schemas/profile";
import { formatDate } from "@/lib/utils/date";
import type {
  AdminProfileChangeRequestItem,
  AdminProfileChangeRequestPage,
} from "@/types/api";

type StatusFilter = "PENDING" | "RESOLVED" | "ALL";
const PAGE_SIZE = 20;

/**
 * Cola de solicitudes de cambio de DNI / motivo (milestone 17).
 *
 * El admin **decide**, no edita: el diálogo muestra el valor actual, el pedido y la
 * justificación, y solo ofrece Aprobar o Rechazar (rechazar exige un motivo, que el usuario
 * ve en su historial). Las solicitudes propias se ven pero no se pueden resolver — lo
 * rechaza también el servidor.
 */
export function ProfileRequestsQueue() {
  const currentUser = useUser();
  const [status, setStatus] = useState<StatusFilter>("PENDING");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [reviewing, setReviewing] =
    useState<AdminProfileChangeRequestItem | null>(null);

  const url = `/api/admin/profile-requests?status=${status}&page=${pagination.pageIndex + 1}&pageSize=${pagination.pageSize}`;
  const { data, error, loading, firstTime, refetch } =
    useApi<AdminProfileChangeRequestPage>(url);

  const columns = useMemo<ColumnDef<AdminProfileChangeRequestItem>[]>(
    () => [
      {
        id: "person",
        header: "Persona",
        meta: { mobile: "title", label: "Persona" },
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="min-w-0">
              <p className="font-medium">
                {r.requester.name} {r.requester.lastName}
                {r.requester.id === currentUser?.id ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    (vos)
                  </span>
                ) : null}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {r.requester.email}
              </p>
            </div>
          );
        },
      },
      {
        id: "field",
        header: "Dato",
        meta: { label: "Dato" },
        cell: ({ row }) => PROFILE_CHANGE_FIELD_LABELS[row.original.field],
      },
      {
        id: "change",
        header: "Cambio",
        meta: { label: "Cambio" },
        cell: ({ row }) => <ChangeSummary request={row.original} />,
      },
      {
        id: "createdAt",
        header: "Enviada",
        meta: { label: "Enviada" },
        cell: ({ row }) => formatDate(new Date(row.original.createdAt)),
      },
      {
        id: "status",
        header: "Estado",
        meta: { mobile: "badge", label: "Estado" },
        cell: ({ row }) => {
          const s = PROFILE_CHANGE_STATUS[row.original.status];
          return <ToneBadge tone={s.tone}>{s.label}</ToneBadge>;
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Acciones</span>,
        meta: { mobile: "actions" },
        cell: ({ row }) => (
          <Button
            size="sm"
            variant={row.original.status === "PENDING" ? "default" : "outline"}
            onClick={() => setReviewing(row.original)}
          >
            {row.original.status === "PENDING" ? "Revisar" : "Ver"}
          </Button>
        ),
      },
    ],
    [currentUser?.id],
  );

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: data?.totalPages ?? 1,
    state: { pagination },
    onPaginationChange: setPagination,
    getRowId: (row) => row.id,
  });

  return (
    <div className="space-y-4">
      <Tabs
        value={status}
        onValueChange={(v) => {
          setStatus(v as StatusFilter);
          setPagination((p) => ({ ...p, pageIndex: 0 }));
        }}
      >
        <TabsList>
          <TabsTrigger value="PENDING">
            Pendientes
            {data && data.pendingCount > 0 ? ` (${data.pendingCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="RESOLVED">Resueltas</TabsTrigger>
          <TabsTrigger value="ALL">Todas</TabsTrigger>
        </TabsList>
      </Tabs>

      {error && !data ? (
        <LoadError
          message="No pudimos cargar las solicitudes."
          onRetry={() => void refetch()}
        />
      ) : (
        <>
          <DataTable
            table={table}
            isLoading={firstTime}
            emptyMessage={
              status === "PENDING"
                ? "No hay solicitudes esperando revisión."
                : "No hay solicitudes."
            }
          />
          <DataTablePagination
            table={table}
            totalItems={data?.total ?? 0}
            isLoading={loading && !firstTime}
          />
        </>
      )}

      {reviewing ? (
        <ReviewDialog
          request={reviewing}
          isOwn={reviewing.requester.id === currentUser?.id}
          onClose={() => setReviewing(null)}
          onDecided={() => void refetch()}
        />
      ) : null}
    </div>
  );
}

/** "actual → pedido", recortado en la tabla (el diálogo muestra todo). */
function ChangeSummary({
  request,
}: {
  request: AdminProfileChangeRequestItem;
}) {
  const isDni = request.field === "DNI";
  return (
    <div className="flex max-w-xs flex-wrap items-center gap-1.5 text-sm">
      <span
        className={
          isDni
            ? "font-mono tabular-nums text-muted-foreground line-through"
            : "line-clamp-1 text-muted-foreground"
        }
      >
        {request.currentValue}
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className={isDni ? "font-mono tabular-nums" : "line-clamp-1"}>
        {request.requestedValue}
      </span>
      {request.dniConflict ? (
        <AlertTriangle
          className="h-4 w-4 text-amber-600 dark:text-amber-400"
          aria-label="El DNI pedido ya está en otra cuenta"
        />
      ) : null}
    </div>
  );
}

function ReviewDialog({
  request,
  isOwn,
  onClose,
  onDecided,
}: {
  request: AdminProfileChangeRequestItem;
  isOwn: boolean;
  onClose: () => void;
  onDecided: () => void;
}) {
  const [reason, setReason] = useState(request.decisionReason ?? "");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const pending = request.status === "PENDING";
  const status = PROFILE_CHANGE_STATUS[request.status];
  const isDni = request.field === "DNI";

  const decide = async (decision: "approve" | "reject") => {
    // Misma validación que el servidor (rechazar exige motivo).
    const parsed = profileChangeDecisionSchema.safeParse({
      decision,
      reason: reason.trim() || undefined,
    });
    if (!parsed.success) {
      setReasonError(parsed.error.issues[0]?.message ?? "Motivo inválido");
      return;
    }
    setReasonError(null);
    setBusy(decision);
    try {
      await decideProfileChangeRequest(request.id, parsed.data);
      toast.success(
        decision === "approve"
          ? "Solicitud aprobada: el dato ya quedó actualizado"
          : "Solicitud rechazada",
      );
      onClose();
      onDecided();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No pudimos guardar la decisión"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            Cambio de {PROFILE_CHANGE_FIELD_LABELS[request.field]}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {request.requester.name} {request.requester.lastName} ·{" "}
            {request.requester.email}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid gap-2 rounded-lg border p-3">
            <div>
              <p className="text-xs text-muted-foreground">Actual</p>
              <p
                className={
                  isDni
                    ? "font-mono tabular-nums"
                    : "whitespace-pre-line break-words"
                }
              >
                {request.currentValue}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pedido</p>
              <p
                className={
                  isDni
                    ? "font-mono font-semibold tabular-nums"
                    : "whitespace-pre-line break-words font-medium"
                }
              >
                {request.requestedValue}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Por qué lo pide</p>
            <p className="whitespace-pre-line break-words">
              {request.justification}
            </p>
          </div>

          {request.dniConflict ? (
            <p className="flex gap-2 rounded-md bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              Ese DNI ya está registrado en otra cuenta, así que no se puede
              aprobar. Revisá con la persona antes de rechazar.
            </p>
          ) : null}

          {pending && isOwn ? (
            <p className="rounded-md bg-muted p-3">
              Es tu propia solicitud: la tiene que resolver otra persona del
              equipo.
            </p>
          ) : null}

          {pending && !isOwn ? (
            <div className="space-y-1.5">
              <Label htmlFor="decision-reason">
                Motivo (obligatorio para rechazar)
              </Label>
              <Textarea
                id="decision-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-invalid={reasonError ? true : undefined}
                placeholder="La persona lo ve en su historial."
              />
              {reasonError ? (
                <p className="text-sm text-destructive">{reasonError}</p>
              ) : null}
            </div>
          ) : null}

          {!pending ? (
            <div className="space-y-1 rounded-lg bg-muted p-3">
              <p className="flex items-center gap-2">
                <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
                {request.decidedAt ? (
                  <span className="text-xs text-muted-foreground">
                    el {formatDate(new Date(request.decidedAt))}
                    {request.decidedBy
                      ? ` por ${request.decidedBy.name} ${request.decidedBy.lastName}`
                      : ""}
                  </span>
                ) : null}
              </p>
              {request.decisionReason ? (
                <p className="break-words">{request.decisionReason}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <ResponsiveDialogFooter>
          {pending && !isOwn ? (
            <>
              <Button
                variant="outline"
                onClick={() => void decide("reject")}
                disabled={busy !== null}
              >
                {busy === "reject" ? "Rechazando…" : "Rechazar"}
              </Button>
              <Button
                onClick={() => void decide("approve")}
                disabled={busy !== null || request.dniConflict}
              >
                {busy === "approve" ? "Aprobando…" : "Aprobar cambio"}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
