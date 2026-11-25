"use client";

import {
  ParticipantStatusBadge,
  ToneBadge,
} from "@/components/atoms/status-badge";
import { LoadError } from "@/components/molecules/load-error";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
import {
  NodeList,
  ParticipantShapeContext,
  PrimaryParticipantBlock,
  type PublicFormValues,
  UploadContext,
} from "@/components/organisms/forms/public-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { ApiError, apiErrorMessage, apiSend } from "@/lib/api/client";
import type {
  CheckInEventView,
  CheckInMember,
  CheckInParticipant,
  CheckInSummary,
} from "@/lib/db/event-checkin";
import { answerToString } from "@/lib/events/form-export";
import { ADMISSION_PROMPT, type CheckInSession } from "@/lib/events/checkin";
import { type AnswerMap, validateForm } from "@/lib/events/form-engine";
import {
  type FormSchema,
  type ParticipantField,
  participantFields,
} from "@/lib/events/form-schema";
import { registerEmailSchema } from "@/lib/schemas/auth";
import { ParticipantSource, ParticipantStatus } from "@/types/prisma";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type ColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { CheckCircle2, Search, Undo2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

/**
 * Pantalla de check-in de un evento, para usar **en la puerta** (milestone 30).
 *
 * Una sola vista (rediseño pedido por el usuario el 2026-11-17, antes del deploy): arriba la
 * sesión y el contador; abajo la **tabla de inscriptos** — solo el email, su estado y el botón
 * de ingreso — con un buscador de texto por email. No se muestra nada de las respuestas del
 * formulario: el formulario puede ser cualquiera y no hay un campo «nombre» confiable (eso es
 * el milestone 34). Si la búsqueda no encuentra a nadie, la tabla ofrece «Registrar sin
 * inscripción» con ese email, que abre el formulario completo del evento en la página (puede
 * ser largo: la regla «diálogo vs. página» del milestone 14 lo deja fuera de un diálogo).
 *
 * Todo se hace sobre **una sesión** (por defecto, la de hoy).
 *
 * **Milestone 34:** la tabla es de **personas** — quien inscribe y cada integrante de un equipo —
 * con una columna por dato de la forma del participante de ese formulario (nombre, DNI…) y el
 * buscador mira todos esos datos. Si una persona de un equipo coincide, se ve el equipo entero,
 * y en la fila de quien inscribió hay «Todo el equipo» para marcar de una a los que faltan.
 */

type ListData = { participants: CheckInParticipant[]; summary: CheckInSummary };

/** Filas por página: la tabla puede tener cientos de inscriptos. */
const PAGE_SIZE = 25;

/** «lun 23/11 · 10:00–12:00», en español y en la zona de quien mira. */
function sessionLabel(s: CheckInSession): string {
  const day = new Date(s.startMs).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
  return `${day} · ${timeLabel(s.startMs)}–${timeLabel(s.endMs)}`;
}

function timeLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

/** ¿Lo buscado tiene forma de email? (para ofrecerlo en «Registrar sin inscripción»). */
const looksLikeEmail = (q: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q);

export function EventCheckIn({ eventId }: { eventId: string }) {
  const base = `/api/admin/events/${eventId}/checkin`;
  const event = useApi<CheckInEventView>(base);
  const [session, setSession] = useState<number | null>(null);

  // La sesión por defecto llega con el evento; después la elige quien está en la puerta.
  useEffect(() => {
    if (session == null && event.data?.defaultSession != null) {
      setSession(event.data.defaultSession);
    }
  }, [event.data, session]);

  const list = useApi<ListData>(
    session != null ? `${base}/participants?session=${session}` : null,
  );

  const [query, setQuery] = useState("");
  const [walkInEmail, setWalkInEmail] = useState<string | null>(null);

  const current = useMemo(
    () => event.data?.sessions.find((s) => s.occurrenceStart === session),
    [event.data, session],
  );
  const canCheckIn = current?.state === "open";

  const actions = useCheckInActions(base, session, () => void list.refetch());

  if (event.error) {
    return (
      <LoadError
        message={apiErrorMessage(event.error, "No se pudo abrir el check-in.")}
        onRetry={() => void event.refetch()}
        busy={event.loading}
      />
    );
  }
  if (!event.data) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted" />;
  }

  const { sessions, schema, name } = event.data;
  const shape = event.data.participantFields ?? [];
  const summary = list.data?.summary;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Check-in</h1>
        <p className="text-sm text-muted-foreground">{name}</p>
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este evento no tiene sesiones.
        </p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <span className="text-sm font-medium" id="checkin-session">
              Sesión
            </span>
            <Select
              value={session != null ? String(session) : undefined}
              onValueChange={(v) => setSession(Number(v))}
            >
              <SelectTrigger
                className="w-full sm:w-72"
                aria-labelledby="checkin-session"
              >
                <SelectValue placeholder="Elegí una sesión" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => (
                  <SelectItem
                    key={s.occurrenceStart}
                    value={String(s.occurrenceStart)}
                  >
                    {sessionLabel(s)}
                    {s.rescheduled ? " (reprogramada)" : ""}
                    {s.state === "future" ? " — todavía no" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {summary && (
            <p className="text-sm sm:text-right" aria-live="polite">
              Ingresaron <strong>{summary.registeredCheckedIn}</strong> de{" "}
              {summary.registeredApproved} inscriptos
              {summary.walkInsCheckedIn > 0 && (
                <>
                  {" "}
                  · <strong>{summary.walkInsCheckedIn}</strong> sin inscripción
                </>
              )}
            </p>
          )}
        </div>
      )}

      {current && !canCheckIn && (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Esta sesión es de un día que todavía no llegó: se puede mirar la
          lista, pero no registrar ingresos.
        </p>
      )}

      {session != null && walkInEmail != null && (
        <WalkInForm
          base={base}
          session={session}
          schema={schema}
          initialEmail={walkInEmail}
          onCancel={() => setWalkInEmail(null)}
          onDone={(participant) => {
            setWalkInEmail(null);
            // Deja a la vista a la persona recién registrada.
            setQuery(participant.displayEmail);
            void list.refetch();
          }}
        />
      )}

      {session != null && walkInEmail == null && (
        <>
          {list.error ? (
            <LoadError
              message="No se pudo cargar la lista de inscriptos."
              onRetry={() => void list.refetch()}
              busy={list.loading}
            />
          ) : (
            <ParticipantsTable
              shape={shape}
              data={list.data?.participants ?? []}
              loading={list.firstTime}
              query={query}
              onQueryChange={setQuery}
              canCheckIn={canCheckIn}
              actions={actions}
              onWalkIn={(email) => setWalkInEmail(email)}
            />
          )}
        </>
      )}

      {actions.dialog}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabla de inscriptos
// ---------------------------------------------------------------------------

function SourceBadge({ source }: { source: string }) {
  return source === ParticipantSource.WALK_IN ? (
    <ToneBadge tone="info">Sin inscripción</ToneBadge>
  ) : null;
}

/** Una fila de la tabla: una persona de una inscripción (milestone 34). */
interface MemberRow {
  key: string;
  participant: CheckInParticipant;
  member: CheckInMember;
}

/** Texto comparable: minúsculas, sin acentos, sin puntos (un DNI «30.111.222» = «30111222»). */
function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\./g, "");
}

/** Todo lo buscable de una persona: emails y cada dato de la forma. */
function memberHaystack(m: CheckInMember): string {
  return normalizeSearch(
    [
      m.displayEmail,
      m.email,
      ...Object.values(m.data).map(answerToString),
    ].join(" "),
  );
}

function CheckInCell({
  row: { participant: p, member: m },
  canCheckIn,
  actions,
}: {
  row: MemberRow;
  canCheckIn: boolean;
  actions: CheckInActions;
}) {
  const busy = actions.busyId === p.id;
  const missing = p.members.filter((x) => x.checkedInAt == null);
  // «Todo el equipo», en la fila de quien inscribió, si falta más de una persona.
  const team =
    m.role === "PRIMARY" && p.members.length > 1 && missing.length > 1 ? (
      <Button
        size="sm"
        variant="outline"
        disabled={busy || !canCheckIn}
        onClick={() => actions.checkIn(p, missing)}
      >
        Todo el equipo ({missing.length})
      </Button>
    ) : null;
  if (m.checkedInAt != null) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="flex items-center gap-1 text-sm font-medium text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Ingresó {timeLabel(m.checkedInAt)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => actions.undo(p, m)}
          aria-label={`Deshacer el ingreso de ${m.displayEmail}`}
        >
          <Undo2 className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only sm:ml-1">Deshacer</span>
        </Button>
        {team}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        size="sm"
        disabled={busy || !canCheckIn}
        onClick={() => actions.checkIn(p, [m])}
      >
        {p.status === ParticipantStatus.APPROVED
          ? "Registrar ingreso"
          : "Dejar pasar…"}
      </Button>
      {team}
    </div>
  );
}

function ParticipantsTable({
  shape,
  data,
  loading,
  query,
  onQueryChange,
  canCheckIn,
  actions,
  onWalkIn,
}: {
  shape: ParticipantField[];
  data: CheckInParticipant[];
  loading: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  canCheckIn: boolean;
  actions: CheckInActions;
  onWalkIn: (email: string) => void;
}) {
  // Identidad estable para TanStack (milestones 22/25): solo cambia con los datos o la búsqueda.
  // Busca en el email tal como se escribió y en el normalizado (`ana.perez@gmail.com` también
  // aparece buscando `anaperez`).
  // Milestone 34: una fila por persona, y se busca en sus emails y en todos los datos de la
  // forma del participante. Si coincide alguien de un equipo, se muestra el equipo entero.
  const rows = useMemo<MemberRow[]>(() => {
    const q = normalizeSearch(query.trim());
    const out: MemberRow[] = [];
    for (const p of data) {
      if (q && !p.members.some((m) => memberHaystack(m).includes(q))) continue;
      for (const m of p.members)
        out.push({ key: m.id, participant: p, member: m });
    }
    return out;
  }, [data, query]);

  const columns = useMemo<ColumnDef<MemberRow, unknown>[]>(
    () => [
      {
        id: "email",
        header: "Persona",
        meta: { mobile: "title", label: "Persona" },
        cell: ({ row }) => {
          const { member: m, participant: p } = row.original;
          return (
            <div className={m.role === "MEMBER" ? "pl-4" : undefined}>
              <span className="break-all font-medium">{m.displayEmail}</span>
              {m.role === "MEMBER" ? (
                <p className="text-xs text-muted-foreground">
                  {m.label} · equipo de {p.displayEmail}
                </p>
              ) : p.members.length > 1 ? (
                <p className="text-xs text-muted-foreground">
                  Inscribió a un equipo de {p.members.length}
                </p>
              ) : null}
            </div>
          );
        },
      },
      // Una columna por dato de la forma del participante de este formulario.
      ...shape.map(
        (f): ColumnDef<MemberRow, unknown> => ({
          id: `data-${f.key}`,
          header: f.label,
          meta: { label: f.label },
          cell: ({ row }) => (
            <span className="text-sm">
              {answerToString(row.original.member.data[f.key]) || "—"}
            </span>
          ),
        }),
      ),
      {
        id: "status",
        header: "Estado",
        meta: { mobile: "badge", label: "Estado" },
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <ParticipantStatusBadge status={row.original.participant.status} />
            <SourceBadge source={row.original.participant.source} />
          </div>
        ),
      },
      {
        id: "checkin",
        header: () => <div className="text-right">Ingreso</div>,
        meta: { mobile: "actions", label: "Ingreso" },
        cell: ({ row }) => (
          <CheckInCell
            row={row.original}
            canCheckIn={canCheckIn}
            actions={actions}
          />
        ),
      },
    ],
    [canCheckIn, actions, shape],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (r) => r.key,
    autoResetPageIndex: false,
    initialState: { pagination: { pageIndex: 0, pageSize: PAGE_SIZE } },
  });

  const q = query.trim();
  const offerEmail = looksLikeEmail(q) ? q : "";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            autoCapitalize="none"
            autoComplete="off"
            placeholder={
              shape.length > 0
                ? `Buscar por email, ${shape
                    .slice(0, 2)
                    .map((f) => f.label.toLowerCase())
                    .join(", ")}…`
                : "Buscar por email"
            }
            className="pl-9"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label="Buscar personas por email o por sus datos"
          />
        </div>
        <Button
          variant="outline"
          disabled={!canCheckIn}
          onClick={() => onWalkIn(offerEmail)}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Registrar sin inscripción
        </Button>
      </div>
      <DataTable
        table={table}
        isLoading={loading}
        loadingMessage="Cargando inscriptos…"
        emptyMessage={
          q ? (
            <div className="space-y-2">
              <p>No hay ninguna inscripción con «{q}».</p>
              {canCheckIn && (
                <Button size="sm" onClick={() => onWalkIn(offerEmail)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Registrar sin inscripción
                </Button>
              )}
            </div>
          ) : (
            "Todavía no hay inscriptos."
          )
        }
      />
      {rows.length > PAGE_SIZE && (
        <DataTablePagination table={table} totalItems={rows.length} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Acciones (registrar, dejar pasar, deshacer)
// ---------------------------------------------------------------------------

interface CheckInActions {
  busyId: string | null;
  /** Registra el ingreso de esas personas de la inscripción (una, o «todo el equipo»). */
  checkIn: (p: CheckInParticipant, members: CheckInMember[]) => void;
  undo: (p: CheckInParticipant, m: CheckInMember) => void;
  /** El diálogo de «dejar pasar»: se monta una vez, en la pantalla. */
  dialog: React.ReactNode;
}

function useCheckInActions(
  base: string,
  session: number | null,
  /** Algo cambió en el servidor (ingreso, admisión, deshacer): recargar la lista. */
  onChange: (p: CheckInParticipant) => void,
): CheckInActions {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [admitting, setAdmitting] = useState<{
    participant: CheckInParticipant;
    members: CheckInMember[];
  } | null>(null);

  const send = async (
    p: CheckInParticipant,
    members: CheckInMember[],
    admit: boolean,
  ) => {
    if (session == null) return;
    setBusyId(p.id);
    try {
      const res = await apiSend<{
        participant: CheckInParticipant;
        alreadyCheckedIn: boolean;
      }>(base, "POST", {
        session,
        participantId: p.id,
        memberIds: members.map((m) => m.id),
        admit,
      });
      toast.success(
        res.alreadyCheckedIn
          ? "Ya tenía el ingreso registrado"
          : members.length > 1
            ? `Ingreso registrado (${members.length} personas)`
            : "Ingreso registrado",
      );
      onChange(res.participant);
    } catch (err) {
      // La pantalla la creía aprobada pero ya no lo está (otra persona la cambió): se
      // actualiza con lo que devolvió el servidor y se pide la confirmación de «dejar pasar».
      const fresh =
        err instanceof ApiError && err.status === 409
          ? (err.body as { participant?: CheckInParticipant } | null)
              ?.participant
          : undefined;
      if (fresh) {
        onChange(fresh);
        setAdmitting({ participant: fresh, members });
        return;
      }
      toast.error(apiErrorMessage(err, "No se pudo registrar el ingreso"));
    } finally {
      setBusyId(null);
    }
  };

  const checkIn = (p: CheckInParticipant, members: CheckInMember[]) => {
    if (p.status !== ParticipantStatus.APPROVED)
      setAdmitting({ participant: p, members });
    else void send(p, members, false);
  };

  const undo = async (p: CheckInParticipant, m: CheckInMember) => {
    if (session == null) return;
    setBusyId(p.id);
    try {
      const res = await apiSend<{ participant: CheckInParticipant }>(
        base,
        "DELETE",
        { session, participantId: p.id, memberId: m.id },
      );
      toast.success("Ingreso deshecho");
      onChange(res.participant);
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo deshacer el ingreso"));
    } finally {
      setBusyId(null);
    }
  };

  const admittingP = admitting?.participant ?? null;
  const prompt =
    admittingP && admittingP.status !== ParticipantStatus.APPROVED
      ? ADMISSION_PROMPT[
          admittingP.status as Exclude<
            ParticipantStatus,
            ParticipantStatus.APPROVED
          >
        ]
      : "";

  const dialog = (
    <ResponsiveDialog
      open={admitting != null}
      onOpenChange={(open) => !open && setAdmitting(null)}
    >
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>¿Dejar pasar?</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="break-all">
            {admittingP?.displayEmail}
            {admittingP && admittingP.members.length > 1
              ? ` (equipo de ${admittingP.members.length}: se aprueba la inscripción entera)`
              : ""}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <p className="text-sm">{prompt}</p>
        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => setAdmitting(null)}>
            Volver
          </Button>
          <Button
            onClick={() => {
              const a = admitting;
              setAdmitting(null);
              if (a) void send(a.participant, a.members, true);
            }}
          >
            Dejar pasar y registrar ingreso
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );

  return { busyId, checkIn, undo: (p, m) => void undo(p, m), dialog };
}

// ---------------------------------------------------------------------------
// «Registrar sin inscripción»
// ---------------------------------------------------------------------------

function WalkInForm({
  base,
  session,
  schema,
  initialEmail,
  onCancel,
  onDone,
}: {
  base: string;
  session: number;
  schema: FormSchema | null;
  initialEmail: string;
  onCancel: () => void;
  onDone: (participant: CheckInParticipant) => void;
}) {
  // La misma validación que la inscripción pública (`PublicForm`): el motor del formulario.
  const zodSchema = useMemo(
    () =>
      z
        .object({
          email: registerEmailSchema,
          answers: z.record(z.string(), z.unknown()),
        })
        .superRefine((value, ctx) => {
          if (!schema) return;
          const { errors } = validateForm(
            schema,
            (value.answers ?? {}) as AnswerMap,
          );
          for (const [path, message] of Object.entries(errors)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message,
              path: [
                "answers",
                ...path
                  .split(".")
                  .map((s) => (/^\d+$/.test(s) ? Number(s) : s)),
              ],
            });
          }
        }),
    [schema],
  );

  const form = useForm<PublicFormValues>({
    resolver: zodResolver(zodSchema),
    defaultValues: { email: initialEmail, answers: {} },
  });

  const onSubmit = async (values: PublicFormValues) => {
    try {
      const res = await apiSend<{ participant: CheckInParticipant }>(
        `${base}/walk-in`,
        "POST",
        { session, email: values.email, answers: values.answers },
      );
      toast.success("Registrado sin inscripción, con su ingreso");
      onDone(res.participant);
    } catch (err) {
      const body = err instanceof ApiError ? err.body : null;
      if (body && typeof body === "object") {
        const b = body as {
          errors?: Record<string, string>;
          existing?: CheckInParticipant;
        };
        if (b.existing) {
          toast.info(
            "Ese email ya tiene una inscripción: registrá su ingreso.",
          );
          onDone(b.existing);
          return;
        }
        if (b.errors) {
          for (const [path, message] of Object.entries(b.errors)) {
            form.setError(`answers.${path}` as `answers.${string}`, {
              message,
            });
          }
        }
      }
      toast.error(apiErrorMessage(err, "No se pudo registrar"));
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Registrar sin inscripción</h2>
          <p className="text-sm text-muted-foreground">
            Completá el formulario del evento con la persona. Queda inscripta
            (sin importar el cupo) y con su ingreso a esta sesión —ella y, si el
            formulario lo pide, su equipo—. No se le manda ningún correo.
          </p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Quien llega (y su equipo, si el formulario lo pide): milestone 34. */}
            <PrimaryParticipantBlock
              fields={schema ? participantFields(schema) : []}
              control={form.control}
            />
            {schema && (
              <UploadContext.Provider value={`${base}/upload`}>
                <ParticipantShapeContext.Provider
                  value={participantFields(schema)}
                >
                  <NodeList
                    nodes={schema.nodes}
                    control={form.control}
                    basePath="answers"
                    scopePath={[]}
                  />
                </ParticipantShapeContext.Provider>
              </UploadContext.Provider>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "Registrando…"
                  : "Registrar e ingresar"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
