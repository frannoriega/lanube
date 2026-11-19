"use client";

/**
 * Piezas por-día del calendario de reservas, extraídas de `WeekCalendar` en el milestone 14
 * (decisión Part A.1) para poder dibujar 1, 3 o 5 días según el ancho de pantalla sin
 * duplicar el markup.
 *
 * Son componentes **de presentación**: no piden datos ni deciden reglas. El fetch, el envío
 * de la reserva, el bloqueo de días ya pasados (`isDayFullyBlocked`)
 * y el diálogo de detalle siguen viviendo una sola vez en `WeekCalendar`, que le pasa a cada
 * columna lo que ya calculó.
 */

import { reservationStatusLabel } from "@/components/atoms/status-badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ReservationOccurrence } from "@/lib/db/resourceCalendar";
import { cn } from "@/lib/utils";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  BUSINESS_HOURS,
  DISPLAY_HOURS,
  fromUtcMs,
  getSlotStyle,
} from "./calendar-utils";
import { OCCURRENCE_TONES, occurrenceTone } from "./occurrence-style";
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
  /** Día entero bloqueado (ya no queda ningún turno por delante): se dibuja rayado y no acepta selección. */
  blocked: boolean;
  reservations: ReservationOccurrence[];
  unavailableSlots: UnavailableSlot[];
  /**
   * Minuto del día (desde medianoche) desde el cual ya se puede reservar (`firstBookableMinutes`).
   * Lo anterior —las horas de hoy que ya pasaron— se raya como «no disponible».
   */
  firstBookableMinutes: number;
  userId?: string;
  /** Selección en curso (arrastre o toque) a dibujar sobre esta columna, en % del alto. */
  selectionOverlay: { top: string; height: string } | null;
  onPointerDownSlot: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMoveSlot: (e: React.PointerEvent<HTMLDivElement>) => void;
  /** Fin del toque (táctil): si no hubo desplazamiento, abre el formulario en ese horario. */
  onPointerUpSlot: (e: React.PointerEvent<HTMLDivElement>) => void;
  /** El navegador canceló el puntero (lo tomó como scroll). */
  onPointerCancelSlot: () => void;
  /** Contenido del popover de una reserva (lo arma `WeekCalendar`: ahí vive el cancelar). */
  renderOccurrenceDetails: (
    occ: ReservationOccurrence,
    close: () => void,
  ) => ReactNode;
}

/**
 * El cuerpo de un día: líneas de hora, bloques no disponibles, reservas existentes (como
 * botones que abren el detalle en un popover) y la superposición de la selección en curso.
 */
export function DayColumn({
  day,
  blocked,
  reservations,
  unavailableSlots,
  firstBookableMinutes,
  userId,
  selectionOverlay,
  onPointerDownSlot,
  onPointerMoveSlot,
  onPointerUpSlot,
  onPointerCancelSlot,
  renderOccurrenceDetails,
}: DayColumnProps) {
  const hours = DISPLAY_HOURS.END - DISPLAY_HOURS.START;
  // Después del cierre se ve el día entero (hasta medianoche) pero no se reserva: rayado.
  const afterCloseTopPct =
    ((BUSINESS_HOURS.END - DISPLAY_HOURS.START) / hours) * 100;
  // Tramo de hoy que ya pasó, en % del alto (0 si el día es futuro; un día pasado entero ya va
  // rayado por `blocked`).
  const pastHeightPct = Math.max(
    0,
    Math.min(
      100,
      ((firstBookableMinutes - DISPLAY_HOURS.START * 60) / (hours * 60)) * 100,
    ),
  );
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

      {/* Horas de hoy que ya pasaron: no se puede reservar antes de «ahora» */}
      {!blocked && pastHeightPct > 0 && (
        <div
          className="absolute top-0 z-50 w-full"
          style={{ height: `${pastHeightPct}%` }}
          title="Este horario ya pasó"
          data-testid="past-slots"
        >
          <div className={cn("h-full rounded", BLOCKED_STRIPES)} />
        </div>
      )}

      {/* Después del cierre: se ve la grilla, pero no se reserva */}
      {!blocked && (
        <div
          className="absolute bottom-0 z-50 w-full"
          style={{ top: `${afterCloseTopPct}%` }}
          title="Fuera del horario de reserva"
          data-testid="after-close"
        >
          <div className={cn("h-full rounded", BLOCKED_STRIPES)} />
        </div>
      )}

      {/* Unavailable slots */}
      {!blocked &&
        unavailableSlots.map((slot, idx) => {
          const style = getSlotStyle(slot);
          // Un cierre del espacio (milestone 23) no es un rayado anónimo: dice por qué.
          if (slot.kind === "closed") {
            return (
              <div
                key={idx}
                className="absolute z-50 w-full px-0.5"
                style={{ top: style.top, height: style.height }}
                title={slot.title}
              >
                <div className="flex h-full flex-col items-center justify-start gap-0.5 overflow-hidden rounded border border-border bg-muted px-1 py-1.5 text-center text-xs text-foreground">
                  <span className="font-semibold">Cerrado</span>
                  {slot.title ? (
                    <span className="line-clamp-4 text-muted-foreground [overflow-wrap:anywhere]">
                      {slot.title}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          }
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
          renderDetails={renderOccurrenceDetails}
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

/**
 * Una reserva existente dentro de la columna (milestone 35).
 *
 * La tarjeta muestra **solo el título**, alineado arriba: el color dice el estado (hay una
 * leyenda en el calendario) y la columna de horas dice cuándo. Al tocarla se abre el detalle
 * en un popover anclado a la tarjeta — sin modal, como en Google Calendar.
 */
function OccurrenceBlock({
  occ,
  own,
  renderDetails,
}: {
  occ: ReservationOccurrence;
  own: boolean;
  renderDetails: (occ: ReservationOccurrence, close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const style = getSlotStyle({
    startTime: occ.occurrenceStartTime,
    endTime: occ.occurrenceEndTime,
  });
  const tone = occurrenceTone(occ, own);

  const statusLabel =
    tone === "event"
      ? "Evento"
      : tone === "other"
        ? "Reservado"
        : reservationStatusLabel(occ.status);
  // Lo que antes solo estaba en el `title` (que no llega a teclado, touch ni lectores de
  // pantalla): título, horario y estado.
  const accessibleLabel = [
    occ.title,
    `${format(fromUtcMs(occ.occurrenceStartTime), "HH:mm")} a ${format(fromUtcMs(occ.occurrenceEndTime), "HH:mm")}`,
    own ? "Tu reserva" : null,
    statusLabel,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      // `z-[60]`: por encima del rayado de las horas que ya pasaron (z-50), que si no tapa y
      // bloquea el clic de una reserva en curso.
      className="absolute z-[60] w-full px-1"
      style={{ top: style.top, height: style.height }}
      // Que tocar/clickear una reserva no arranque además una selección de horario debajo.
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Popover open={open} onOpenChange={setOpen}>
        {/* Un <button> real: foco, Enter/Espacio y anuncio como control (F2.5b). Los botones
            centran su contenido en vertical por defecto: `justify-start` lo pega arriba. */}
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-full w-full cursor-pointer flex-col items-start justify-start overflow-hidden rounded px-1.5 py-1 text-left text-xs leading-tight text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              OCCURRENCE_TONES[tone].bg,
            )}
            aria-label={accessibleLabel}
          >
            <span className="line-clamp-2 font-semibold [overflow-wrap:anywhere]">
              {occ.title}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-80 max-w-[calc(100vw-2rem)]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {renderDetails(occ, () => setOpen(false))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Tira de días para las vistas angostas (1 o 3 días, < 768px): un chip por día hábil de la
 * semana. Reemplaza al encabezado de 5 columnas, que no entra en un teléfono.
 *   - El chip del día enfocado queda resaltado; tocar otro lo enfoca.
 *   - Los días sin turnos por delante quedan deshabilitados.
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
