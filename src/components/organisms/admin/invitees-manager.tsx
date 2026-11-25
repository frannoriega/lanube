"use client";

import { ToneBadge, type StatusTone } from "@/components/atoms/status-badge";
import {
  BulkActionBar,
  BulkConfirmDialog,
  selectionColumn,
} from "@/components/molecules/bulk-actions";
import { LoadError } from "@/components/molecules/load-error";
import { LocalTimestamp } from "@/components/molecules/local-date";
import { CopyFormUrl } from "@/components/organisms/admin/copy-form-url";
import { Button } from "@/components/ui/button";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { apiErrorMessage, apiSend } from "@/lib/api/client";
import type { InviteeState } from "@/lib/events/invitees";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type RowSelectionState,
  useReactTable,
} from "@tanstack/react-table";
import { Info, MailPlus, Send, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

interface InviteeRow {
  id: string;
  displayEmail: string;
  invitedAt: number | null;
  inviteCount: number;
  createdAt: number;
  registered: boolean;
  state: InviteeState;
}

interface InviteesResponse {
  event: {
    id: string;
    name: string;
    isPrivate: boolean;
    status: string;
    cancelled: boolean;
    formSlug: string | null;
  };
  invitees: InviteeRow[];
}

const STATE_BADGE: Record<InviteeState, { label: string; tone: StatusTone }> = {
  registered: { label: "Inscripto", tone: "success" },
  invited: { label: "Invitado", tone: "info" },
  pending: { label: "Sin enviar", tone: "neutral" },
};

const addSchema = z.object({
  emails: z
    .string()
    .trim()
    .min(1, { message: "Pegá al menos un email" })
    .max(50_000, { message: "El texto es demasiado largo" }),
});

/**
 * Invitados de un evento privado (milestone 43): una página con su tabla (regla de «listas
 * largas en página, no en modal»). Pegar emails, quitar, y mandar o reenviar la invitación por
 * correo. La columna «Estado» cruza la lista con las inscripciones vigentes.
 */
export function InviteesManager({ eventId }: { eventId: string }) {
  const endpoint = `/api/admin/events/${eventId}/invitees`;
  const { data, error, loading, refetch } = useApi<InviteesResponse>(endpoint);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [confirm, setConfirm] = useState<null | "send" | "remove">(null);
  const [busy, setBusy] = useState(false);

  const form = useForm<z.infer<typeof addSchema>>({
    resolver: zodResolver(addSchema),
    defaultValues: { emails: "" },
  });

  // Identidad estable para TanStack (ver CLAUDE.md §13: un array nuevo en cada render cuelga).
  const rows = useMemo(() => data?.invitees ?? [], [data]);
  const unsent = rows.filter((r) => r.invitedAt == null).length;

  const columns = useMemo<ColumnDef<InviteeRow>[]>(
    () => [
      selectionColumn<InviteeRow>(),
      {
        id: "email",
        accessorKey: "displayEmail",
        header: "Email",
        enableHiding: false,
        meta: { mobile: "title", label: "Email" },
        cell: ({ row }) => (
          <span className="[overflow-wrap:anywhere]">
            {row.original.displayEmail}
          </span>
        ),
      },
      {
        id: "state",
        header: "Estado",
        meta: { mobile: "badge", label: "Estado" },
        cell: ({ row }) => {
          const b = STATE_BADGE[row.original.state];
          return <ToneBadge tone={b.tone}>{b.label}</ToneBadge>;
        },
      },
      {
        id: "invitedAt",
        header: "Última invitación",
        meta: { label: "Última invitación" },
        cell: ({ row }) =>
          row.original.invitedAt ? (
            <span className="text-sm text-muted-foreground">
              <LocalTimestamp ms={row.original.invitedAt} />
              {row.original.inviteCount > 1 &&
                ` · ${row.original.inviteCount} envíos`}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
    ],
    [],
  );

  const table = useReactTable<InviteeRow>({
    data: rows,
    columns,
    state: { globalFilter, rowSelection },
    getRowId: (r) => r.id,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
    initialState: { pagination: { pageSize: 25 } },
  });
  const selected = table.getSelectedRowModel().rows.map((r) => r.original);

  const onAdd = async (values: z.infer<typeof addSchema>) => {
    try {
      const r = await apiSend<{
        added: number;
        existing: string[];
        invalid: string[];
        repeated: string[];
      }>(endpoint, "POST", values);
      const notes = [
        r.existing.length > 0 && `${r.existing.length} ya estaban`,
        r.repeated.length > 0 && `${r.repeated.length} repetidos en el texto`,
        r.invalid.length > 0 &&
          `${r.invalid.length} no parecen emails (${r.invalid.slice(0, 3).join(", ")}${r.invalid.length > 3 ? "…" : ""})`,
      ].filter(Boolean);
      toast.success(
        r.added === 1
          ? "Se agregó 1 invitado"
          : `Se agregaron ${r.added} invitados`,
        notes.length ? { description: notes.join(" · ") } : undefined,
      );
      form.reset({ emails: "" });
      await refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudieron agregar los invitados"));
    }
  };

  const send = async (ids?: string[]) => {
    setBusy(true);
    try {
      const r = await apiSend<{
        sent: number;
        failed: number;
        remaining: number;
      }>(`${endpoint}/send`, "POST", ids ? { ids } : {});
      if (r.sent > 0)
        toast.success(
          r.sent === 1
            ? "Se mandó 1 invitación"
            : `Se mandaron ${r.sent} invitaciones`,
        );
      if (r.failed > 0)
        toast.error(
          `${r.failed} no se pudieron mandar. Podés reintentar desde la tabla.`,
        );
      if (r.remaining > 0)
        toast.info(`Quedan ${r.remaining} por mandar: volvé a tocar «Mandar».`);
      if (r.sent === 0 && r.failed === 0) toast.info("No había a quién mandar");
      setRowSelection({});
      await refetch();
    } catch (err) {
      toast.error(
        apiErrorMessage(err, "No se pudieron mandar las invitaciones"),
      );
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const remove = async (ids: string[]) => {
    setBusy(true);
    try {
      const r = await apiSend<{ removed: number }>(endpoint, "DELETE", { ids });
      toast.success(
        r.removed === 1
          ? "Se quitó 1 invitado"
          : `Se quitaron ${r.removed} invitados`,
      );
      setRowSelection({});
      await refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudieron quitar los invitados"));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  if (error && !data) {
    return <LoadError onRetry={refetch} busy={loading} />;
  }
  const event = data?.event;
  const canSend =
    !!event &&
    !event.cancelled &&
    !!event.formSlug &&
    event.status === "PUBLISHED";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invitados</h1>
        <p className="text-muted-foreground">
          {event?.name ?? "…"}
          {rows.length > 0 &&
            ` · ${rows.length} invitado${rows.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {event && (
        <div className="space-y-2">
          {!event.isPrivate && (
            <Notice>
              El evento es <strong>público</strong>: la lista queda guardada
              pero no limita quién se inscribe. Marcalo como privado en el
              evento para que solo se anoten los invitados.
            </Notice>
          )}
          {event.isPrivate && rows.length === 0 && (
            <Notice>
              Sin invitados, se puede inscribir cualquiera que tenga el enlace.
              Al agregar el primero, solo se inscriben los de la lista.
            </Notice>
          )}
          {!event.formSlug && (
            <Notice>
              El evento no tiene formulario de inscripción: no hay a dónde
              invitar.
            </Notice>
          )}
          {event.formSlug && event.status !== "PUBLISHED" && (
            <Notice>
              Publicá el evento para poder mandar invitaciones: hasta entonces
              el enlace no funciona.
            </Notice>
          )}
          {event.formSlug && <CopyFormUrl slug={event.formSlug} />}
        </div>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onAdd)}
          className="space-y-3 rounded-lg border p-4"
        >
          <FormField
            control={form.control}
            name="emails"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agregar invitados</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    placeholder={
                      "ana@ejemplo.com, juan@ejemplo.com\nmaria@ejemplo.com"
                    }
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Pegá los emails como los tengas: separados por coma, punto y
                  coma o uno por renglón. Los repetidos y los que ya estaban no
                  se agregan dos veces.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              <MailPlus className="h-4 w-4" />
              {form.formState.isSubmitting ? "Agregando…" : "Agregar"}
            </Button>
          </div>
        </form>
      </Form>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Buscar un email…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="sm:max-w-xs"
          />
          <Button
            type="button"
            variant="outline"
            disabled={!canSend || unsent === 0 || busy}
            onClick={() => void send()}
          >
            <Send className="h-4 w-4" />
            {unsent > 0
              ? `Mandar a los que faltan (${unsent})`
              : "Todos recibieron la invitación"}
          </Button>
        </div>

        <BulkActionBar
          count={selected.length}
          onClear={() => setRowSelection({})}
        >
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canSend || busy}
            onClick={() => setConfirm("send")}
          >
            <Send className="h-4 w-4" />
            Mandar invitación
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-destructive"
            disabled={busy}
            onClick={() => setConfirm("remove")}
          >
            <Trash2 className="h-4 w-4" />
            Quitar
          </Button>
        </BulkActionBar>

        <DataTable
          table={table}
          isLoading={loading && !data}
          emptyMessage={
            globalFilter
              ? "Ningún invitado coincide."
              : "Todavía no hay invitados."
          }
        />
        <DataTablePagination
          table={table}
          totalItems={table.getFilteredRowModel().rows.length}
        />
      </div>

      <BulkConfirmDialog
        open={confirm === "send"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Mandar la invitación"
        description={`Se manda un correo con el enlace de inscripción a ${selected.length} invitado${selected.length === 1 ? "" : "s"} (a quien ya la recibió, se le reenvía).`}
        names={selected.map((s) => s.displayEmail)}
        confirmLabel="Mandar"
        busy={busy}
        onConfirm={() => void send(selected.map((s) => s.id))}
      />
      <BulkConfirmDialog
        open={confirm === "remove"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Quitar invitados"
        description={
          selected.some((s) => s.registered)
            ? "Quien ya se inscribió sigue inscripto: quitarlo de la lista no cancela su inscripción."
            : "Dejan de poder inscribirse (si el evento es privado y la lista no queda vacía)."
        }
        names={selected.map((s) => s.displayEmail)}
        confirmLabel="Quitar"
        destructive
        busy={busy}
        onConfirm={() => void remove(selected.map((s) => s.id))}
      />
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
