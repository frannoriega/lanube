"use client";

import { LocalDate } from "@/components/molecules/local-date";
import { TimeSelect } from "@/components/molecules/time-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
} from "@/modules/events/lib/occurrences";
import {
  EventRecipe,
  dateKeyTimeToMs,
  planEventOccurrences,
} from "@/modules/events/lib/plan";
import { cn } from "@/lib/utils";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

export function EventSessions({
  open,
  onOpenChange,
  recipe,
  existing,
  actions,
  onActionsChange,
  reason,
  onReasonChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current (possibly unsaved) scheduling fields from the form. */
  recipe: EventRecipe;
  /** Saved exceptions for the event, tagged by weekday. */
  existing: ExistingException[];
  /** Staged, not-yet-saved session changes. */
  actions: SessionAction[];
  onActionsChange: (next: SessionAction[]) => void;
  /** Single reason shared by every staged cancel/reschedule (collected once, at the end). */
  reason: string;
  onReasonChange: (reason: string) => void;
}) {
  const [page, setPage] = useState(1);

  // Draft edited inside the dialog; changes are only pushed to the form on "Guardar".
  // "Cancelar" (or closing) discards the draft — it's re-seeded from props on the next open.
  const [draftActions, setDraftActions] = useState<SessionAction[]>(actions);
  const [draftReason, setDraftReason] = useState(reason);
  useEffect(() => {
    if (open) {
      setDraftActions(actions);
      setDraftReason(reason);
    }
    // Re-seed only on open transitions, not on every prop identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    setDraftActions((prev) => [
      ...prev.filter(
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
      setDraftActions((prev) =>
        prev.filter(
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

  const commit = () => {
    if (needsReason && draftReason.trim() === "") {
      toast.error("Indicá el motivo de los cambios");
      return;
    }
    onActionsChange(draftActions);
    onReasonChange(draftReason.trim());
    onOpenChange(false);
  };

  const total = occurrences.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = occurrences.slice(
    (current - 1) * PAGE_SIZE,
    current * PAGE_SIZE,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sesiones</DialogTitle>
          <DialogDescription>
            Reprogramá o cancelá fechas puntuales y guardá para confirmarlas. Se
            aplican —y se avisa por email a los inscriptos— al guardar el
            evento.
          </DialogDescription>
        </DialogHeader>

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
                          <LocalDate ms={occ.startMs} /> · {toHHmm(occ.startMs)}
                          –{toHHmm(occ.endMs)}
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
                          onClick={() => revert(weekday, occ.occurrenceDateMs)}
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
              <div className="flex items-center justify-between pt-1">
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
                <Label htmlFor="session-reason">Motivo de los cambios *</Label>
                <Textarea
                  id="session-reason"
                  value={draftReason}
                  onChange={(e) => setDraftReason(e.target.value)}
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

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={commit}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <CalendarClock className="h-4 w-4" />
          Reprogramar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reprogramar sesión</DialogTitle>
          <DialogDescription>
            Elegí la nueva fecha y horario. Se aplica al guardar el evento.
          </DialogDescription>
        </DialogHeader>
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
        <DialogFooter>
          <Button type="button" onClick={submit}>
            Guardar cambio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
