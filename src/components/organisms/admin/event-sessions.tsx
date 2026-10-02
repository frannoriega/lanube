"use client";

import { LocalDate } from "@/components/molecules/local-date";
import { TimeSelect } from "@/components/molecules/time-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { dateKeyFromUnixMs } from "@/lib/admin/admin-timezone";
import {
  EventOccurrence,
  ExistingException,
  SessionAction,
  effectiveExceptions,
  expandEventOccurrences,
  utcDateKey,
  weekdayOfRrule,
} from "@/lib/events/occurrences";
import {
  EventRecipe,
  dateKeyTimeToMs,
  planEventOccurrences,
} from "@/lib/events/plan";
import { cn } from "@/lib/utils";
import {
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 10;

/** HH:mm (admin tz) for a ms timestamp. */
const hhmmFmt = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Argentina/Buenos_Aires",
});
const toHHmm = (ms: number) => hhmmFmt.format(new Date(ms));

/** yyyy-MM-dd from a local Date (no timezone shift). */
function dateToKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Sesiones de un evento, **dentro del formulario** (milestone 14, propuesta 1 + Part B.2).
 *
 * Antes era un diálogo "Sesiones" con su propio borrador y su propio "Guardar". Un evento
 * puede tener muchísimas sesiones (todos los días hábiles durante meses), así que ahora vive
 * en la sección *Agenda* del formulario como:
 *   - un **resumen** de una línea ("24 sesiones · 2 canceladas · 1 reprogramada") que se
 *     actualiza en vivo con las fechas / días / horario del formulario, y
 *   - "Gestionar sesiones", que despliega la **lista paginada** (10 por página) con
 *     Reprogramar / Cancelar / Revertir por fila.
 *
 * El modelo de staging no cambia: cada acción se guarda en el estado del formulario
 * (`actions`, por día de semana + fecha nominal) y recién se persiste —y se avisa por email a
 * los inscriptos— cuando se guarda el evento. Como ya no hay un "Guardar" propio, no hace
 * falta un borrador intermedio: el "Guardar cambios" del evento es el único commit. El motivo
 * compartido (obligatorio si hay cancelaciones o reprogramaciones) se pide acá mismo.
 *
 * En un evento nuevo (`editable = false`) solo se muestra el resumen: las excepciones se
 * gestionan una vez creado.
 */
export function EventSessions({
  recipe,
  existing,
  actions,
  onActionsChange,
  reason,
  onReasonChange,
  editable,
  defaultExpanded = false,
}: {
  /** Current (possibly unsaved) scheduling fields from the form. */
  recipe: EventRecipe;
  /** Saved exceptions for the event, tagged by weekday. */
  existing: ExistingException[];
  /** Staged, not-yet-saved session changes. */
  actions: SessionAction[];
  onActionsChange: (next: SessionAction[]) => void;
  /** Single reason shared by every staged cancel/reschedule. */
  reason: string;
  onReasonChange: (reason: string) => void;
  /** Si se pueden gestionar sesiones (solo al editar un evento ya creado). */
  editable: boolean;
  /** Abrir la lista desplegada (atajo `?sessions=1` desde la tarjeta del evento). */
  defaultExpanded?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(editable && defaultExpanded);
  const rootRef = useRef<HTMLDivElement>(null);
  // Con el atajo `?sessions=1`, llevar la vista hasta la lista.
  useEffect(() => {
    if (editable && defaultExpanded) {
      rootRef.current?.scrollIntoView({ block: "start" });
    }
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const draftActions = actions;
  const draftReason = reason;

  const { startDate, endDate, startTime, endTime } = recipe;
  const weekdaysKey = recipe.weekdays.join(",");

  // Preview occurrences from the live recipe + saved exceptions + staged changes — nothing is
  // persisted here; the actual write + emails happen when the event is saved.
  const occurrences = useMemo<EventOccurrence[]>(() => {
    if (weekdaysKey === "" || !startDate || !endDate) return [];
    let plans;
    try {
      plans = planEventOccurrences({
        weekdays: weekdaysKey.split(",").map(Number),
        startDate,
        endDate,
        startTime,
        endTime,
      });
    } catch {
      return [];
    }
    const raws = plans.map((p) => {
      const wd = weekdayOfRrule(p.rrule)!;
      return {
        id: `wd-${wd}`,
        startMs: p.startMs,
        endMs: p.endMs,
        recurrenceEndMs: p.recurrenceEndMs,
        rrule: p.rrule,
        exceptions: effectiveExceptions(
          wd,
          existing,
          draftActions,
          draftReason,
        ),
      };
    });
    return expandEventOccurrences(raws, Date.now());
  }, [
    startDate,
    endDate,
    startTime,
    endTime,
    weekdaysKey,
    existing,
    draftActions,
    draftReason,
  ]);

  // Staged rows are matched by calendar date so the "Sin guardar" badge survives a start-time edit
  // (which shifts the nominal occurrence ms).
  const pendingDates = useMemo(
    () => new Set(draftActions.map((a) => utcDateKey(a.occurrenceDateMs))),
    [draftActions],
  );
  const needsReason = useMemo(
    () =>
      draftActions.some((a) => a.kind === "cancel" || a.kind === "reschedule"),
    [draftActions],
  );
  const savedDates = useMemo(
    () => new Set(existing.map((e) => utcDateKey(e.occurrenceDateMs))),
    [existing],
  );

  const upsert = (a: SessionAction) => {
    onActionsChange([
      ...actions.filter(
        (x) =>
          !(
            x.weekday === a.weekday && x.occurrenceDateMs === a.occurrenceDateMs
          ),
      ),
      a,
    ]);
  };

  const revert = (weekday: number, occurrenceDateMs: number) => {
    const hasPending = draftActions.some(
      (x) => x.weekday === weekday && x.occurrenceDateMs === occurrenceDateMs,
    );
    if (hasPending) {
      // Undo the staged change (back to whatever was saved / regular).
      onActionsChange(
        actions.filter(
          (x) =>
            !(x.weekday === weekday && x.occurrenceDateMs === occurrenceDateMs),
        ),
      );
      return;
    }
    // No staged change → this is a saved exception; stage a revert to clear it on save.
    if (savedDates.has(utcDateKey(occurrenceDateMs))) {
      upsert({ weekday, occurrenceDateMs, kind: "revert" });
    }
  };

  const total = occurrences.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = occurrences.slice(
    (current - 1) * PAGE_SIZE,
    current * PAGE_SIZE,
  );

  const cancelledCount = occurrences.filter(
    (o) => o.status === "cancelled",
  ).length;
  const rescheduledCount = occurrences.filter(
    (o) => o.status === "rescheduled",
  ).length;
  const summary = [
    `${total} ${total === 1 ? "sesión" : "sesiones"}`,
    cancelledCount > 0 &&
      `${cancelledCount} cancelada${cancelledCount === 1 ? "" : "s"}`,
    rescheduledCount > 0 &&
      `${rescheduledCount} reprogramada${rescheduledCount === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      ref={rootRef}
      id="sesiones"
      className="scroll-mt-20 space-y-3 rounded-lg border p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">Sesiones</p>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {total > 0
              ? summary
              : weekdaysKey === "" || !startDate || !endDate
                ? "Elegí fechas y días para ver las sesiones."
                : "No quedan sesiones por delante en estas fechas."}
            {actions.length > 0 &&
              ` · ${actions.length} cambio${actions.length === 1 ? "" : "s"} sin guardar`}
          </p>
        </div>
        {editable && total > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={expanded}
            aria-controls="sesiones-lista"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Ocultar sesiones" : "Gestionar sesiones"}
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </Button>
        )}
      </div>

      {!editable && total > 0 && (
        <p className="text-xs text-muted-foreground">
          Vas a poder cancelar o reprogramar sesiones puntuales una vez creado
          el evento.
        </p>
      )}

      {editable && expanded && (
        <div id="sesiones-lista" className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Reprogramá o cancelá fechas puntuales. Se aplican —y se avisa por
            email a los inscriptos— al guardar el evento.
          </p>
          {total === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No hay sesiones en este rango de fechas.
            </p>
          ) : (
            <>
              <ul className="divide-y rounded-md border">
                {pageItems.map((occ) => {
                  const weekday = Number(occ.reservationId.slice(3));
                  const isPending = pendingDates.has(
                    utcDateKey(occ.occurrenceDateMs),
                  );
                  return (
                    <li
                      key={`${occ.reservationId}:${occ.occurrenceDateMs}`}
                      className="flex flex-wrap items-center justify-between gap-3 p-3"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              occ.status === "cancelled" &&
                                "text-muted-foreground line-through",
                            )}
                          >
                            <LocalDate ms={occ.startMs} /> ·{" "}
                            {toHHmm(occ.startMs)}–{toHHmm(occ.endMs)}
                          </span>
                          {occ.status === "rescheduled" && (
                            <Badge className="border-transparent bg-amber-500/15 font-normal text-amber-700 dark:text-amber-400">
                              Reprogramada
                            </Badge>
                          )}
                          {occ.status === "cancelled" && (
                            <Badge className="border-transparent bg-destructive/10 font-normal text-destructive">
                              Cancelada
                            </Badge>
                          )}
                          {isPending && (
                            <Badge
                              variant="outline"
                              className="font-normal text-muted-foreground"
                            >
                              Sin guardar
                            </Badge>
                          )}
                        </div>
                        {occ.reason && (
                          <p className="text-xs text-muted-foreground">
                            Motivo: {occ.reason}
                          </p>
                        )}
                      </div>

                      {/* Buttons by state: reschedule is always available; a live session can be
                        cancelled; a cancelled one can be reverted to its regular slot. */}
                      <div className="flex shrink-0 items-center gap-1">
                        <RescheduleDialog
                          defaultDateKey={dateKeyFromUnixMs(occ.startMs)}
                          defaultStart={toHHmm(occ.startMs)}
                          defaultEnd={toHHmm(occ.endMs)}
                          onSubmit={(newStartMs, newEndMs) => {
                            // Cheap client guard: don't let a reschedule land on another (non-cancelled)
                            // session of this event. The server enforces the full cross-booking check.
                            const clash = occurrences.some(
                              (o) =>
                                o.status !== "cancelled" &&
                                o.occurrenceDateMs !== occ.occurrenceDateMs &&
                                newStartMs < o.endMs &&
                                newEndMs > o.startMs,
                            );
                            if (clash) {
                              toast.error(
                                "El nuevo horario se superpone con otra sesión",
                              );
                              return false;
                            }
                            upsert({
                              weekday,
                              occurrenceDateMs: occ.occurrenceDateMs,
                              kind: "reschedule",
                              newStartMs,
                              newEndMs,
                            });
                            return true;
                          }}
                        />
                        {occ.status !== "cancelled" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                              upsert({
                                weekday,
                                occurrenceDateMs: occ.occurrenceDateMs,
                                kind: "cancel",
                              })
                            }
                          >
                            <X className="h-4 w-4" />
                            Cancelar
                          </Button>
                        )}
                        {occ.status === "cancelled" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              revert(weekday, occ.occurrenceDateMs)
                            }
                          >
                            <RotateCcw className="h-4 w-4" />
                            Revertir
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {total} sesiones · página {current} de {totalPages}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={current <= 1}
                      onClick={() => setPage(current - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={current >= totalPages}
                      onClick={() => setPage(current + 1)}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* One reason for the whole batch of cancels/reschedules — collected at the end,
                sent as a single notification to participants when the event is saved. */}
              {needsReason && (
                <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                  <Label htmlFor="session-reason">
                    Motivo de los cambios *
                  </Label>
                  <Textarea
                    id="session-reason"
                    value={draftReason}
                    onChange={(e) => onReasonChange(e.target.value)}
                    placeholder="Ej.: Feriado / el docente no puede asistir"
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se aplica a todas las sesiones modificadas y se avisa por
                    email a los inscriptos al guardar el evento.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RescheduleDialog({
  defaultDateKey,
  defaultStart,
  defaultEnd,
  onSubmit,
}: {
  defaultDateKey: string;
  defaultStart: string;
  defaultEnd: string;
  /** Returns true if the reschedule was accepted; false keeps the dialog open (e.g. a clash). */
  onSubmit: (newStartMs: number, newEndMs: number) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dateKey, setDateKey] = useState(defaultDateKey);
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);

  const submit = () => {
    if (start >= end) {
      toast.error("El horario de fin debe ser posterior al de inicio");
      return;
    }
    if (
      onSubmit(dateKeyTimeToMs(dateKey, start), dateKeyTimeToMs(dateKey, end))
    ) {
      setOpen(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <CalendarClock className="h-4 w-4" />
        Reprogramar
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent className="max-h-[90vh] overflow-y-auto">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Reprogramar sesión</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Elegí la nueva fecha y horario. Se aplica al guardar el evento.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <Calendar
                mode="single"
                showOutsideDays={false}
                selected={keyToDate(dateKey)}
                onSelect={(d) => d && setDateKey(dateToKey(d))}
                defaultMonth={keyToDate(dateKey)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Hora de inicio</Label>
                <TimeSelect value={start} onChange={setStart} />
              </div>
              <div className="space-y-1.5">
                <Label>Hora de fin</Label>
                <TimeSelect value={end} onChange={setEnd} />
              </div>
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button type="button" onClick={submit}>
              Guardar cambio
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
