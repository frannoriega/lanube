"use client";

/**
 * Piezas por-día del calendario de reservas, extraídas de `WeekCalendar` en el milestone 14
 * (decisión Part A.1) para poder dibujar 1, 3 o 5 días según el ancho de pantalla sin
 * duplicar el markup.
 *
 * Son componentes **de presentación**: no piden datos ni deciden reglas. El fetch, el envío
 * de la reserva, la regla de 24h de anticipación (`isDayFullyBlocked` / `hasMinimumNotice`)
 * y el diálogo de detalle siguen viviendo una sola vez en `WeekCalendar`, que le pasa a cada
 * columna lo que ya calculó.
 */

import { Button } from "@/components/ui/button";
import { ReservationOccurrence } from "@/lib/db/resourceCalendar";
import { cn } from "@/lib/utils";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Plus } from "lucide-react";
import { BUSINESS_HOURS, fromUtcMs, getSlotStyle } from "./calendar-utils";
import type { UnavailableSlot } from "./WeekCalendar";

/** Rayado gris de "no disponible" (día bloqueado o recurso lleno). */
const BLOCKED_STRIPES =
  "bg-[repeating-linear-gradient(135deg,_#99a1af_0,_#99a1af_3px,_transparent_0,_transparent_50%)] dark:bg-[repeating-linear-gradient(135deg,_#4a5565_0,_#4a5565_3px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed";
/** Rayado violeta: ocupado por una reserva de otro recurso que bloquea este (cross_resource). */
const CROSS_RESOURCE_STRIPES =
  "bg-[repeating-linear-gradient(135deg,_#7c3aed_0,_#7c3aed_3px,_transparent_0,_transparent_50%)] dark:bg-[repeating-linear-gradient(135deg,_#a78bfa_0,_#a78bfa_3px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed";

/** ¿La ocurrencia es una reserva del usuario actual? */
export function isOwnOccurrence(
  occ: ReservationOccurrence,
  userId: string | undefined,
): boolean {
  return (
    !!userId && occ.reservableType === "USER" && occ.reservableId === userId
  );
}

/**
 * Encabezado de un día en la vista de columnas: día de la semana + número, resaltado si es
 * hoy, y el botón "Reservar" (camino de teclado y de "todo el día", F2.5a) si el día todavía
 * admite reservas.
 */
export function DayHeaderCell({
  day,
  isToday,
  bookable,
  onBook,
}: {
  day: Date;
  isToday: boolean;
  bookable: boolean;
  onBook: () => void;
}) {
  return (
    <div
      className={cn(
        "border-l border-gray-200 p-3 text-center dark:border-gray-700",
        isToday
          ? "bg-la-nube-primary/10 font-bold text-la-nube-selected dark:text-la-nube-secondary"
          : "text-gray-700 dark:text-gray-300",
      )}
    >
      <div className="text-xs font-medium">
        {format(day, "EEE", { locale: es }).toUpperCase()}
      </div>
      <div className="text-xl font-bold">{format(day, "d")}</div>
      {bookable && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 h-7 w-full px-1 text-xs"
          onClick={onBook}
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          <span>Reservar</span>
          <span className="sr-only">
            {" "}
            el {format(day, "EEEE d 'de' MMMM", { locale: es })}
          </span>
        </Button>
      )}
    </div>
  );
}

export interface DayColumnProps {
  day: Date;
  /** Día entero bloqueado por la anticipación mínima de 24h: se dibuja rayado y no acepta selección. */
  blocked: boolean;
  reservations: ReservationOccurrence[];
  unavailableSlots: UnavailableSlot[];
  userId?: string;
  /** Selección en curso (arrastre o toque) a dibujar sobre esta columna, en % del alto. */
  selectionOverlay: { top: string; height: string } | null;
  onPointerDownSlot: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMoveSlot: (e: React.PointerEvent<HTMLDivElement>) => void;
  /** Fin del toque (táctil): si no hubo desplazamiento, abre el formulario en ese horario. */
  onPointerUpSlot: (e: React.PointerEvent<HTMLDivElement>) => void;
  /** El navegador canceló el puntero (lo tomó como scroll). */
  onPointerCancelSlot: () => void;
  onSelectOccurrence: (occ: ReservationOccurrence) => void;
}

/**
 * El cuerpo de un día: líneas de hora, bloques no disponibles, reservas existentes (como
 * botones que abren el detalle) y la superposición de la selección en curso.
 */
export function DayColumn({
  day,
  blocked,
  reservations,
  unavailableSlots,
  userId,
  selectionOverlay,
  onPointerDownSlot,
  onPointerMoveSlot,
  onPointerUpSlot,
  onPointerCancelSlot,
  onSelectOccurrence,
}: DayColumnProps) {
  const hours = BUSINESS_HOURS.END - BUSINESS_HOURS.START;
  return (
    <div
      className={cn(
        "relative z-40 border-l border-gray-200 dark:border-gray-700",
        blocked ? BLOCKED_STRIPES : "bg-white dark:bg-gray-950",
        // En pantallas táctiles, un toque sobre la columna es "elegí este horario"; sin
        // `touch-action` el navegador igual hace scroll vertical normal con el dedo.
        !blocked && "cursor-pointer",
      )}
      data-day={format(day, "yyyy-MM-dd")}
      onPointerDown={blocked ? undefined : onPointerDownSlot}
      onPointerMove={blocked ? undefined : onPointerMoveSlot}
      onPointerUp={blocked ? undefined : onPointerUpSlot}
      onPointerCancel={blocked ? undefined : onPointerCancelSlot}
    >
      {/* Hour lines */}
      {Array.from({ length: hours }, (_, i) => i + 1).map((hour) => (
        <div
          key={hour}
          className="absolute w-full border-t border-gray-200 dark:border-gray-700"
          style={{ top: `${(hour / hours) * 100}%` }}
        />
      ))}

      {/* Unavailable slots */}
      {!blocked &&
        unavailableSlots.map((slot, idx) => {
          const style = getSlotStyle(slot);
          return (
            <div
              key={idx}
              className="absolute z-50 w-full"
              style={{ top: style.top, height: style.height }}
            >
              <div
                className={cn(
                  "h-full rounded",
                  slot.kind === "cross_resource"
                    ? CROSS_RESOURCE_STRIPES
                    : BLOCKED_STRIPES,
                )}
              />
            </div>
          );
        })}

      {/* Existing reservations */}
      {reservations.map((occ, idx) => (
        <OccurrenceBlock
          key={idx}
          occ={occ}
          own={isOwnOccurrence(occ, userId)}
          onSelect={() => onSelectOccurrence(occ)}
        />
      ))}

      {/* Selection overlay (drag or tap) */}
      {selectionOverlay && (
        <div
          className="pointer-events-none absolute w-full px-1"
          style={selectionOverlay}
        >
          <div className="h-full rounded border-2 border-blue-500 bg-blue-400/50" />
        </div>
      )}
    </div>
  );
}

/** Una reserva existente dentro de la columna. */
function OccurrenceBlock({
  occ,
  own,
  onSelect,
}: {
  occ: ReservationOccurrence;
  own: boolean;
  onSelect: () => void;
}) {
  const style = getSlotStyle({
    startTime: occ.occurrenceStartTime,
    endTime: occ.occurrenceEndTime,
  });
  const isPending = occ.status === "PENDING";
  const isRejected = occ.status === "REJECTED";
  const isCancelled = occ.status === "CANCELLED";

  // F2.5(c): every one of these carries `text-white`, and the old
  // palette failed AA under it — bg-yellow-500 measured 1.92:1, the
  // worst pair in the codebase. These are the same hues one step
  // darker, all ≥ 4.8:1 on white.
  const bgColor =
    own && isPending
      ? "bg-amber-700" // was bg-yellow-500 (1.92:1) → 5.02:1
      : own && isRejected
        ? "bg-red-600" // 4.83:1, already passing
        : own && isCancelled
          ? "bg-gray-500" // 4.83:1, already passing
          : own
            ? "bg-green-700" // was bg-green-600 (3.30:1) → 5.02:1
            : "bg-la-nube-selected"; // was primary (3.77:1) → 6.38:1

  const statusLabel = isPending
    ? "Pendiente"
    : isRejected
      ? "Rechazada"
      : isCancelled
        ? "Cancelada"
        : own
          ? "Aprobada"
          : null;
  const startLabel = format(fromUtcMs(occ.occurrenceStartTime), "HH:mm");
  const endLabel = format(fromUtcMs(occ.occurrenceEndTime), "HH:mm");
  // The title tooltip was the only place this information existed, and
  // it reaches neither keyboard nor touch nor screen readers.
  const accessibleLabel = [
    occ.reason,
    `${startLabel} a ${endLabel}`,
    own ? "Tu reserva" : "Reservado",
    statusLabel,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className="absolute w-full px-1"
      style={{ top: style.top, height: style.height }}
      // Que tocar/clickear una reserva no arranque además una selección de horario debajo.
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* A real <button>: focusable, Enter/Space activated and
          announced as a control, instead of a div+onClick that
          keyboard users could not reach at all (F2.5b). The detail
          dialog it opens is where cancelling lives. */}
      <button
        type="button"
        className={`h-full w-full rounded ${bgColor} cursor-pointer overflow-hidden p-1 text-left text-xs text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
        title={accessibleLabel}
        aria-label={accessibleLabel}
        onClick={onSelect}
      >
        <div className="truncate font-semibold">
          {occ.reason}
          {/* Glyphs stay as a redundant non-color cue, but they are
              decorative now: the status is in the aria-label, so a
              screen reader no longer reads "check mark button". */}
          {own && !isRejected && !isCancelled && (
            <span className="ml-1" aria-hidden="true">
              ✓
            </span>
          )}
          {own && isRejected && (
            <span className="ml-1" aria-hidden="true">
              ✗
            </span>
          )}
        </div>
        <div className="text-[10px]">
          {startLabel} - {endLabel}
          {isPending && own && (
            <span className="ml-1" aria-hidden="true">
              ⏳
            </span>
          )}
        </div>
      </button>
    </div>
  );
}

/**
 * Tira de días para las vistas angostas (1 o 3 días, < 768px): un chip por día hábil de la
 * semana. Reemplaza al encabezado de 5 columnas, que no entra en un teléfono.
 *   - El chip del día enfocado queda resaltado; tocar otro lo enfoca.
 *   - Los días bloqueados por la anticipación de 24h quedan deshabilitados.
 *   - Un punto marca los días donde el usuario ya tiene una reserva propia.
 * Sin gestos de swipe a propósito: chocarían con el scroll vertical de la página.
 */
export function DayStrip({
  days,
  focusedIndex,
  visibleIndices,
  todayRef,
  isBlocked,
  hasOwnReservation,
  onFocusDay,
}: {
  days: Date[];
  focusedIndex: number;
  /** Días que se ven ahora (en la vista de 3, se marcan con un fondo suave). */
  visibleIndices: number[];
  todayRef: Date;
  isBlocked: (day: Date) => boolean;
  hasOwnReservation: (day: Date) => boolean;
  onFocusDay: (index: number) => void;
}) {
  return (
    <div
      className="mb-3 grid grid-cols-5 gap-1.5"
      role="group"
      aria-label="Elegí un día"
    >
      {days.map((day, idx) => {
        const blocked = isBlocked(day);
        const focused = idx === focusedIndex;
        const visible = visibleIndices.includes(idx);
        const own = hasOwnReservation(day);
        const today = isSameDay(day, todayRef);
        return (
          <button
            key={idx}
            type="button"
            disabled={blocked}
            aria-pressed={focused}
            aria-label={`${format(day, "EEEE d 'de' MMMM", { locale: es })}${
              blocked ? ", sin turnos disponibles" : ""
            }${own ? ", tenés una reserva" : ""}`}
            onClick={() => onFocusDay(idx)}
            className={cn(
              "relative flex flex-col items-center rounded-lg border px-1 py-1.5 text-center transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              focused
                ? "border-la-nube-selected bg-la-nube-selected text-white dark:border-la-nube-secondary dark:bg-la-nube-secondary dark:text-gray-950"
                : visible
                  ? "border-border bg-muted text-foreground"
                  : "border-border bg-background text-foreground",
              blocked && "cursor-not-allowed opacity-45",
            )}
          >
            <span className="text-[11px] font-medium uppercase">
              {format(day, "EEE", { locale: es })}
            </span>
            <span
              className={cn(
                "text-base leading-tight font-bold",
                today &&
                  !focused &&
                  "text-la-nube-selected dark:text-la-nube-secondary",
              )}
            >
              {format(day, "d")}
            </span>
            {/* Punto de "tenés una reserva": siempre ocupa su lugar para que los chips no
                cambien de alto, y solo se pinta cuando corresponde. */}
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 h-1.5 w-1.5 rounded-full",
                own
                  ? focused
                    ? "bg-white dark:bg-gray-950"
                    : "bg-green-700 dark:bg-green-400"
                  : "bg-transparent",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
