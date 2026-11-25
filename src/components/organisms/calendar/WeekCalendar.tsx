"use client";

import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
import { useServerTime } from "@/components/providers/server-time";
import { useApi } from "@/hooks/use-api";
import { apiErrorMessage, apiSend } from "@/lib/api/client";
import { ReservationOccurrence } from "@/lib/db/resourceCalendar";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { toCapitalCase } from "@/lib/utils/string";
import { addDays, addWeeks, format, isSameDay, isSameMonth } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  BUSINESS_HOURS,
  DISPLAY_HOURS,
  daysWithinHorizon,
  firstBookableDayIndex,
  firstBookableWeekStart,
  fromUtcMs,
  horizonWeekStart,
  isDayFullyBlocked,
  isDayFullyClosed,
  minutesToTime,
  TIME_INTERVAL_MINUTES,
  timeToMinutes,
  visibleDayCountFor,
  visibleDayIndices,
  WORK_WEEK_DAYS,
  firstBookableMinutes,
  LAST_BOOKABLE_START_MINUTES,
} from "./calendar-utils";
import { BookingForm, type BookingFormValues } from "./BookingForm";
import { CalendarLegend } from "./CalendarLegend";
import { CalendarSkeleton } from "./CalendarSkeleton";
import { OccurrenceDetails } from "./OccurrenceDetails";
import { occurrenceTone, type OccurrenceTone } from "./occurrence-style";
import {
  DayColumn,
  DayHeaderCell,
  DayStrip,
  isOwnOccurrence,
} from "./DayColumn";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

export type UnavailableSlotKind = "resource_full" | "cross_resource" | "closed";

export interface UnavailableSlot {
  spaceId?: string;
  startTime: number;
  endTime: number;
  kind?: UnavailableSlotKind;
  /** Solo `closed` (milestone 23): el motivo del cierre, que se muestra en el calendario. */
  title?: string;
}

export interface DragSelection {
  day: Date;
  startMinutes: number;
  endMinutes: number;
}

export interface ReservationFormData {
  startTime: Date;
  endTime: Date;
  title: string;
  /** La descripción (opcional): la columna `reason`. */
  reason: string;
}

interface WeekCalendarProps {
  apiEndpoint: string; // API endpoint to fetch reservations and create them
  userId?: string; // Current user's ID for visual differentiation
  /**
   * Días de horizonte de quien reserva: `bookingHorizonDaysFor(permisos)` (milestone 42). Solo
   * acota la navegación; el servidor lo vuelve a aplicar con los permisos de la sesión.
   */
  horizonDays?: number;
}

export function WeekCalendar({
  apiEndpoint,
  userId,
  horizonDays,
}: WeekCalendarProps) {
  const { now, alignRevision } = useServerTime();

  // Week navigation — initialised from the server-aligned clock only once
  // (avoids a double-fetch when the client clock differs from the server).
  const [currentWeekStart, setCurrentWeekStart] = useState<Date | null>(null);

  useLayoutEffect(() => {
    setCurrentWeekStart((prev) => {
      // Abre en la primera semana con algún día reservable (hallazgo F).
      const correct = firstBookableWeekStart(now());
      if (prev && prev.getTime() === correct.getTime()) return prev;
      return correct;
    });
  }, [alignRevision, now]);

  // Data state
  const [unavailableSlots, setUnavailableSlots] = useState<UnavailableSlot[]>(
    [],
  );
  const [occurrences, setOccurrences] = useState<ReservationOccurrence[]>([]);

  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{
    day: Date;
    minutes: number;
  } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{
    day: Date;
    minutes: number;
  } | null>(null);

  // ResponsiveDialog and form state
  const [selection, setSelection] = useState<DragSelection | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Horario inicial del formulario de reserva (lo fijan el arrastre, el toque o "Reservar").
  const [startTime, setStartTime] = useState(
    minutesToTime(BUSINESS_HOURS.START * 60),
  );
  const [endTime, setEndTime] = useState(
    minutesToTime(BUSINESS_HOURS.START * 60 + 60),
  );
  const [submitting, setSubmitting] = useState(false);
  /*
   * Toque en curso sobre una columna (punteros táctiles / lápiz). Se guarda dónde empezó
   * para distinguir un toque (abrir el formulario en ese horario) de un scroll (el dedo se
   * movió): solo cuenta como toque si el dedo no se desplazó más de TAP_SLOP_PX.
   */
  const tapRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    dayIdx: number;
  } | null>(null);

  const calendarRef = useRef<HTMLDivElement>(null);

  // Derived values — guarded against null currentWeekStart
  const weekDays = useMemo(
    () =>
      currentWeekStart
        ? Array.from({ length: WORK_WEEK_DAYS }, (_, i) =>
            addDays(currentWeekStart, i),
          )
        : [],
    [currentWeekStart],
  );

  /*
   * Días visibles a la vez (milestone 14, decisión Part A.1): 1 en teléfonos (< 640px),
   * 3 entre 640 y 767px, la semana entera desde 768px. En el servidor se asume escritorio;
   * no hay salto visible porque hasta que `currentWeekStart` se inicializa en el cliente se
   * muestra solo el spinner.
   */
  const isSm = useMediaQuery("(min-width: 640px)", true);
  const isMd = useMediaQuery("(min-width: 768px)", true);
  const visibleCount = visibleDayCountFor({ isSm, isMd });
  const isNarrow = visibleCount < WORK_WEEK_DAYS;

  /*
   * Día "enfocado" (0 = lunes) de las vistas angostas: el que se muestra en la vista de 1 día
   * y el centro de la ventana en la de 3. Cada vez que cambia la semana arranca en el primer
   * día que todavía admite reservas (o en el lunes si ninguno), en vez de en un día rayado.
   */
  const [focusedDayIdx, setFocusedDayIdx] = useState(0);
  /*
   * Días de la semana que entran en el horizonte (5 salvo en la última página, que se acorta).
   * Los de afuera no se dibujan; `shownDays` es lo que ven las columnas y la tira de días.
   */
  const shownDays = useMemo(
    () => weekDays.slice(0, daysWithinHorizon(weekDays, now(), horizonDays)),
    [weekDays, now, horizonDays],
  );
  // Último día dibujado de la semana: cierra el rango del encabezado (viernes salvo en la última página).
  const lastShownDay = shownDays[shownDays.length - 1] ?? weekDays[0];
  useEffect(() => {
    if (!shownDays.length) return;
    const first = firstBookableDayIndex(shownDays, now());
    setFocusedDayIdx(first === -1 ? 0 : first);
    // `now` es estable por revisión de alineación; solo interesa re-enfocar al cambiar de semana.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownDays]);
  const visibleIdx = useMemo(
    () => visibleDayIndices(visibleCount, focusedDayIdx, shownDays.length),
    [visibleCount, focusedDayIdx, shownDays.length],
  );

  /*
   * "Hoy" lleva a la primera semana con algo reservable (la misma con la que abre), y es
   * también el límite hacia atrás. El límite hacia adelante es el horizonte deslizante de dos
   * semanas (milestone 26): la última página es la semana que contiene el último día
   * reservable, y de ella solo se dibujan los días que entran.
   */
  const todayWeekStart = useMemo(() => firstBookableWeekStart(now()), [now]);
  const maxWeekStart = useMemo(
    () => horizonWeekStart(now(), horizonDays),
    [now, horizonDays],
  );
  const canGoNext = !!(
    currentWeekStart && addWeeks(currentWeekStart, 1) <= maxWeekStart
  );
  const canGoPrev = !!(currentWeekStart && currentWeekStart > todayWeekStart);

  const overlapsUnavailableOrReservation = useCallback(
    (day: Date, startMinutes: number, endMinutes: number) => {
      const getMinutes = (time: Date) => {
        return time.getHours() * 60 + time.getMinutes();
      };
      return (
        unavailableSlots.some(
          (slot) =>
            isSameDay(fromUtcMs(slot.startTime), day) &&
            ((startMinutes > getMinutes(fromUtcMs(slot.startTime)) &&
              endMinutes < getMinutes(fromUtcMs(slot.endTime))) ||
              (startMinutes < getMinutes(fromUtcMs(slot.startTime)) &&
                endMinutes > getMinutes(fromUtcMs(slot.startTime)))),
        ) ||
        occurrences.some(
          (occ) =>
            (occ.status === "PENDING" || occ.status === "APPROVED") &&
            isSameDay(fromUtcMs(occ.occurrenceStartTime), day) &&
            ((startMinutes > getMinutes(fromUtcMs(occ.occurrenceStartTime)) &&
              endMinutes < getMinutes(fromUtcMs(occ.occurrenceEndTime))) ||
              (startMinutes < getMinutes(fromUtcMs(occ.occurrenceStartTime)) &&
                endMinutes > getMinutes(fromUtcMs(occ.occurrenceStartTime)))),
        )
      );
    },
    [unavailableSlots, occurrences],
  );

  const calendarUrl = useMemo(() => {
    if (!currentWeekStart) return null;
    const weekEnd = addWeeks(addDays(currentWeekStart, 4), 1);
    weekEnd.setHours(23, 59, 59, 999);
    return `${apiEndpoint}?startDate=${currentWeekStart.getTime()}&endDate=${weekEnd.getTime()}`;
  }, [currentWeekStart, apiEndpoint]);

  const {
    data: calendarData,
    error: calendarError,
    loading: calendarLoading,
    firstTime: calendarFirstTime,
    refetch: refetchReservations,
  } = useApi<{
    unavailableSlots?: UnavailableSlot[];
    userReservations?: ReservationOccurrence[];
  }>(calendarUrl);

  useEffect(() => {
    if (!calendarData) return;
    const rawSlots: UnavailableSlot[] = [
      ...(calendarData.unavailableSlots || []),
    ];
    rawSlots.sort((a, b) => a.startTime - b.startTime);
    // Merge adjacent slots of the same kind into a single block.
    const processedUnavailableSlots: UnavailableSlot[] = [];
    if (rawSlots.length > 0) {
      let current = rawSlots[0];
      for (let i = 1; i < rawSlots.length; i++) {
        const slot = rawSlots[i];
        if (
          current.endTime === slot.startTime &&
          current.kind === slot.kind &&
          current.title === slot.title
        ) {
          current = { ...current, endTime: slot.endTime };
        } else {
          processedUnavailableSlots.push(current);
          current = slot;
        }
      }
      processedUnavailableSlots.push(current);
    }
    setOccurrences(calendarData.userReservations || []);
    setUnavailableSlots(processedUnavailableSlots);
  }, [calendarData]);

  useEffect(() => {
    if (calendarError) {
      toast.error("Error al cargar las reservas");
    }
  }, [calendarError]);

  // Get position info from mouse event
  const getPositionInfo = useCallback(
    (e: React.MouseEvent, dayIndex: number) => {
      if (!calendarRef.current) return null;

      const rect = calendarRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const totalHeight = rect.height;

      const startMinutes = BUSINESS_HOURS.START * 60;
      const endMinutes = BUSINESS_HOURS.END * 60;
      // La grilla dibuja hasta medianoche (`DISPLAY_HOURS`); reservar, solo hasta el cierre.
      const displayStart = DISPLAY_HOURS.START * 60;
      const totalMinutes = DISPLAY_HOURS.END * 60 - displayStart;

      const minutesFromStart = (relativeY / totalHeight) * totalMinutes;
      const totalMinutesFromMidnight = displayStart + minutesFromStart;

      // Round to nearest interval
      const roundedMinutes =
        Math.round(totalMinutesFromMidnight / TIME_INTERVAL_MINUTES) *
        TIME_INTERVAL_MINUTES;

      // Clamp to business hours
      const clampedMinutes = Math.max(
        startMinutes,
        Math.min(endMinutes, roundedMinutes),
      );

      return {
        day: weekDays[dayIndex],
        minutes: clampedMinutes,
        // El puntero está en la franja posterior al cierre: se ve, pero no se reserva.
        afterClose: totalMinutesFromMidnight >= endMinutes,
      };
    },
    [weekDays],
  );

  // Handle mouse down - start dragging
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, dayIndex: number) => {
      e.preventDefault();
      const posInfo = getPositionInfo(e, dayIndex);
      if (!posInfo || posInfo.afterClose) return;

      if (
        overlapsUnavailableOrReservation(
          posInfo.day,
          posInfo.minutes,
          posInfo.minutes,
        )
      ) {
        return;
      }

      const clock = now();
      const selectedDateTime = new Date(posInfo.day);
      selectedDateTime.setHours(0, posInfo.minutes, 0, 0);

      if (selectedDateTime.getTime() < clock.getTime()) {
        return;
      }

      setIsDragging(true);
      setDragStart(posInfo);
      setDragCurrent(posInfo);
    },
    [getPositionInfo, overlapsUnavailableOrReservation, now],
  );

  // Handle mouse move - update drag
  const handleMouseMove = useCallback(
    (e: React.MouseEvent, dayIndex: number) => {
      if (!isDragging || !dragStart) return;

      const posInfo = getPositionInfo(e, dayIndex);
      if (!posInfo) return;

      const rangeLo = Math.min(dragStart.minutes, posInfo.minutes);
      const rangeHi = Math.max(dragStart.minutes, posInfo.minutes);
      if (overlapsUnavailableOrReservation(posInfo.day, rangeLo, rangeHi)) {
        return;
      }

      if (isSameDay(posInfo.day, dragStart.day)) {
        setDragCurrent(posInfo);
      }
    },
    [isDragging, dragStart, getPositionInfo, overlapsUnavailableOrReservation],
  );

  // Handle mouse up - finish selection
  const handleMouseUp = useCallback(() => {
    if (!isDragging || !dragStart || !dragCurrent) {
      setIsDragging(false);
      return;
    }

    if (!isSameDay(dragStart.day, dragCurrent.day)) {
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      toast.error("Las reservas deben estar en el mismo día");
      return;
    }

    const startMinutes = Math.min(dragStart.minutes, dragCurrent.minutes);
    const endMinutes = Math.max(dragStart.minutes, dragCurrent.minutes);

    if (endMinutes - startMinutes < TIME_INTERVAL_MINUTES) {
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      toast.error(`La reserva mínima es de ${TIME_INTERVAL_MINUTES} minutos`);
      return;
    }

    // Overlap prevention against own reservations
    const dayStart = new Date(dragStart.day);
    dayStart.setHours(0, 0, 0, 0);
    const selStart = new Date(dayStart);
    selStart.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
    const selEnd = new Date(dayStart);
    selEnd.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);

    const overlapsOwn = occurrences.some((occ) => {
      if (
        !(
          userId &&
          occ.reservableType === "USER" &&
          occ.reservableId === userId
        )
      )
        return false;
      const occStart = fromUtcMs(occ.occurrenceStartTime);
      const occEnd = fromUtcMs(occ.occurrenceEndTime);
      return occStart < selEnd && occEnd > selStart;
    });

    if (overlapsOwn) {
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      toast.error("Ya tienes una reserva en ese horario");
      return;
    }

    // Set the selection and open dialog
    setSelection({
      day: dragStart.day,
      startMinutes,
      endMinutes,
    });

    setStartTime(minutesToTime(startMinutes));
    setEndTime(minutesToTime(endMinutes));
    setDialogOpen(true);

    // Reset drag state
    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  }, [isDragging, dragStart, dragCurrent, occurrences, userId]);

  /**
   * Keyboard/touch path into the booking dialog (F2.5a).
   *
   * Creating a reservation was drag-only: the day column is a <div> with onMouseDown /
   * onMouseMove and no key handler, so keyboard users had NO way to book at all
   * (WCAG 2.1.1, Level A). Drag-select cannot be made keyboard-operable in place, so this
   * is the equivalent non-drag route the audit recommended as option (a): a real button
   * per day that opens the very same dialog with a default one-hour slot. The dialog's
   * start/end Selects then do the rest, and they were already keyboard-operable.
   *
   * Deliberately not option (b) (focusable 15-minute cells with space-to-extend): far more
   * code, and this is also the better touch path. Flagged in the milestone doc as the
   * cheaper of the two options pending a product call.
   */
  const openBookingForDay = useCallback(
    (day: Date) => {
      // Hoy no se ofrece lo que ya pasó: el formulario abre en el primer turno reservable
      // (p. ej. a las 15:10, a las 15:15), no a la apertura, que el servidor rechazaría.
      const startMinutes = firstBookableMinutes(day, now());
      if (startMinutes > LAST_BOOKABLE_START_MINUTES) {
        toast.error("No se pueden hacer reservas en el pasado");
        return;
      }
      const endMinutes = Math.min(startMinutes + 60, BUSINESS_HOURS.END * 60);
      setSelection({ day, startMinutes, endMinutes });
      setStartTime(minutesToTime(startMinutes));
      setEndTime(minutesToTime(endMinutes));
      setDialogOpen(true);
    },
    [now],
  );

  /**
   * Bloques ocupados de un día como intervalos [inicio, fin) en minutos desde medianoche:
   * franjas no disponibles + reservas vigentes (pendientes o aprobadas) de cualquiera.
   */
  const busyIntervalsForDay = useCallback(
    (day: Date): Array<[number, number]> => {
      const toMin = (ms: number) => {
        const d = fromUtcMs(ms);
        return d.getHours() * 60 + d.getMinutes();
      };
      return [
        ...unavailableSlots
          .filter((slot) => isSameDay(fromUtcMs(slot.startTime), day))
          .map((slot): [number, number] => [
            toMin(slot.startTime),
            toMin(slot.endTime),
          ]),
        ...occurrences
          .filter(
            (occ) =>
              (occ.status === "PENDING" || occ.status === "APPROVED") &&
              isSameDay(fromUtcMs(occ.occurrenceStartTime), day),
          )
          .map((occ): [number, number] => [
            toMin(occ.occurrenceStartTime),
            toMin(occ.occurrenceEndTime),
          ]),
      ];
    },
    [unavailableSlots, occurrences],
  );

  /*
   * Tocar un horario libre → formulario de reserva precargado (milestone 14, hallazgo A).
   *
   * El arrastre para seleccionar nunca funcionó en pantallas táctiles: un dedo solo genera
   * eventos de mouse al *tocar*, nunca al arrastrar, y arrastrar con el dedo tiene que seguir
   * siendo scroll. Así que en táctil la interacción es el toque: se registra dónde apoyó el
   * dedo (pointerdown) y, si al levantarlo (pointerup) no se movió más de TAP_SLOP_PX, se
   * abre el formulario con inicio = el turno de 15 min tocado y fin = una hora después
   * (recortado al cierre y al próximo bloque ocupado). Si el dedo se movió, fue un scroll y
   * no pasa nada. El mouse sigue usando el arrastre (`handleMouseDown` & co.).
   */
  const TAP_SLOP_PX = 10;

  const handleTapStart = useCallback(
    (e: React.PointerEvent, dayIdx: number) => {
      if (e.pointerType === "mouse") return;
      tapRef.current = {
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        dayIdx,
      };
    },
    [],
  );

  const handleTapMove = useCallback((e: React.PointerEvent) => {
    const tap = tapRef.current;
    if (!tap || tap.pointerId !== e.pointerId) return;
    if (Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_SLOP_PX) {
      tapRef.current = null; // fue un scroll, no un toque
    }
  }, []);

  const handleTapEnd = useCallback(
    (e: React.PointerEvent) => {
      const tap = tapRef.current;
      tapRef.current = null;
      if (!tap || tap.pointerId !== e.pointerId || !calendarRef.current) return;

      // Turno de 15 min bajo el dedo (redondeo hacia abajo: tocar dentro de 10:00–10:15 es 10:00).
      const rect = calendarRef.current.getBoundingClientRect();
      const businessStart = BUSINESS_HOURS.START * 60;
      const businessEnd = BUSINESS_HOURS.END * 60;
      const displayStart = DISPLAY_HOURS.START * 60;
      const displayEnd = DISPLAY_HOURS.END * 60;
      const raw =
        displayStart +
        ((e.clientY - rect.top) / rect.height) * (displayEnd - displayStart);
      // Franja posterior al cierre: se ve, pero no se reserva.
      if (raw >= businessEnd) return;
      const start = Math.max(
        businessStart,
        Math.min(
          businessEnd - TIME_INTERVAL_MINUTES,
          Math.floor(raw / TIME_INTERVAL_MINUTES) * TIME_INTERVAL_MINUTES,
        ),
      );
      const day = weekDays[tap.dayIdx];
      if (!day) return;

      const busy = busyIntervalsForDay(day);
      if (
        busy.some(
          ([bs, be]) => bs < start + TIME_INTERVAL_MINUTES && be > start,
        )
      ) {
        toast.error("Ese horario no está disponible");
        return;
      }

      const startAt = new Date(day);
      startAt.setHours(0, start, 0, 0);
      if (startAt.getTime() < now().getTime()) {
        toast.error("No se pueden hacer reservas en el pasado");
        return;
      }

      // Fin: una hora después, sin pasar el cierre ni pisar el próximo bloque ocupado.
      const nextBusyStart = Math.min(
        businessEnd,
        ...busy.filter(([bs]) => bs > start).map(([bs]) => bs),
      );
      const end = Math.min(start + 60, nextBusyStart);

      setSelection({ day, startMinutes: start, endMinutes: end });
      setStartTime(minutesToTime(start));
      setEndTime(minutesToTime(end));
      setDialogOpen(true);
    },
    [weekDays, busyIntervalsForDay, now],
  );

  // Calculate drag selection style
  const getDragSelectionStyle = useCallback(() => {
    if (!isDragging || !dragStart || !dragCurrent) return null;
    if (!isSameDay(dragStart.day, dragCurrent.day)) return null;

    const dayIndex = weekDays.findIndex((d) => isSameDay(d, dragStart.day));
    if (dayIndex === -1) return null;

    const startMinutes = Math.min(dragStart.minutes, dragCurrent.minutes);
    const endMinutes = Math.max(dragStart.minutes, dragCurrent.minutes);

    const displayStart = DISPLAY_HOURS.START * 60;
    const totalMinutes = DISPLAY_HOURS.END * 60 - displayStart;

    const top = ((startMinutes - displayStart) / totalMinutes) * 100;
    const height = ((endMinutes - startMinutes) / totalMinutes) * 100;

    return {
      dayIndex,
      top: `${top}%`,
      height: `${height}%`,
    };
  }, [isDragging, dragStart, dragCurrent, weekDays]);

  // Get reservations for a specific day
  const getReservationsForDay = (day: Date) => {
    return occurrences.filter((occ) => {
      const occStart = fromUtcMs(occ.occurrenceStartTime);
      return isSameDay(occStart, day);
    });
  };

  // Get unavailable slots for a specific day
  const getUnavailableSlotsForDay = (day: Date) => {
    return unavailableSlots.filter((slot) => {
      const slotStart = fromUtcMs(slot.startTime);
      return isSameDay(slotStart, day);
    });
  };

  // Handle form submission (los valores ya vienen validados por el schema Zod del formulario)
  const handleSubmit = async (values: BookingFormValues) => {
    if (!selection) return;

    const startMinutes = timeToMinutes(values.startTime);
    const endMinutes = timeToMinutes(values.endTime);
    const startDateTime = new Date(selection.day);
    startDateTime.setHours(0, startMinutes, 0, 0);
    const endDateTime = new Date(selection.day);
    endDateTime.setHours(0, endMinutes, 0, 0);

    // Reglas que dependen del reloj del servidor: se chequean acá, en un solo lugar.
    const clock = now();
    if (startDateTime < clock) {
      toast.error("No se pueden hacer reservas en el pasado");
      return;
    }

    setSubmitting(true);
    try {
      await apiSend(apiEndpoint, "POST", {
        startTime: startDateTime.getTime(),
        endTime: endDateTime.getTime(),
        title: values.title,
        reason: values.reason,
      });
      // Success - close dialog and reset
      setDialogOpen(false);
      setSelection(null);
      await refetchReservations();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Error al crear la reserva"));
    } finally {
      setSubmitting(false);
    }
  };

  /** Valores con los que abre el formulario: el horario elegido, sin título ni descripción. */
  // Primer minuto reservable del día elegido (hoy: no antes de ahora). Se recalcula al abrir el
  // formulario; el submit vuelve a comparar contra el reloj, que sigue siendo la regla.
  const bookingMinStartMinutes = selection
    ? firstBookableMinutes(selection.day, now())
    : undefined;

  const bookingDefaults = useMemo<BookingFormValues>(
    () => ({ startTime, endTime, title: "", reason: "" }),
    [startTime, endTime],
  );

  /**
   * Saca de la vista lo que se acaba de cancelar, sin recargar: una ocurrencia (`occurrenceStart`
   * presente, recurrentes) o toda la reserva.
   */
  const removeOccurrences = useCallback(
    (reservationId: string, occurrenceStart?: number) => {
      setOccurrences((prev) =>
        prev.filter(
          (occ) =>
            !(
              occ.reservationId === reservationId &&
              (occurrenceStart === undefined ||
                occ.occurrenceStartTime === occurrenceStart)
            ),
        ),
      );
    },
    [],
  );

  // Tonos a la vista, para que la leyenda explique solo lo que se está mostrando.
  const tonesInView = useMemo(
    () =>
      new Set<OccurrenceTone>(
        occurrences.map((occ) =>
          occurrenceTone(occ, isOwnOccurrence(occ, userId)),
        ),
      ),
    [occurrences, userId],
  );

  const dragSelection = getDragSelectionStyle();

  if (!currentWeekStart) {
    return (
      <div className="flex h-[500px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-la-nube-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      {/*
       * Sin `min-w-[800px]` ni `overflow-hidden` (milestone 14, hallazgos 1 / B / E): antes la
       * grilla medía siempre 800px y el contenedor recortaba el resto, así que en un teléfono
       * solo se veían lunes y martes (y ni siquiera la navegación de semanas), y en una tablet
       * se cortaba el viernes. Ahora la grilla tiene tantas columnas como días visibles y
       * ocupa exactamente el ancho disponible.
       */}
      <div className="min-w-0">
        {/* Week Navigation */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="min-w-0 text-sm text-gray-600 dark:text-gray-400">
            {isSameDay(currentWeekStart, lastShownDay) ? (
              // Última página del horizonte con un solo día: sin rango («15 de noviembre de 2026»).
              <>
                {format(currentWeekStart, "d 'de' MMMM 'de' yyyy", {
                  locale: es,
                })}
              </>
            ) : isNarrow ? (
              // En las vistas angostas el rango va corto ("5 – 9 oct") para dejar lugar a los botones.
              // Si la semana cruza de mes, el primer día lleva su mes ("28 sept – 2 oct"): sin él
              // se leía "28 – 2 oct", como si fuera del 28 de octubre.
              <>
                {format(
                  currentWeekStart,
                  isSameMonth(currentWeekStart, lastShownDay) ? "d" : "d MMM",
                  { locale: es },
                )}{" "}
                –{" "}
                {format(lastShownDay, "d MMM yyyy", {
                  locale: es,
                })}
              </>
            ) : (
              <>
                {format(currentWeekStart, "d 'de' MMMM", { locale: es })} -{" "}
                {format(lastShownDay, "d 'de' MMMM 'de' yyyy", {
                  locale: es,
                })}
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Navegación compacta (solo íconos) en las vistas angostas; el texto va en
                aria-label para que el lector de pantalla siga diciendo qué hace. */}
            <Button
              variant="outline"
              size={isNarrow ? "icon" : "sm"}
              onClick={() =>
                setCurrentWeekStart(addWeeks(currentWeekStart, -1))
              }
              disabled={!canGoPrev}
              aria-label={isNarrow ? "Semana anterior" : undefined}
            >
              <ChevronLeft className="h-4 w-4" />
              {!isNarrow && "Anterior"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeekStart(todayWeekStart)}
              disabled={isSameDay(currentWeekStart, todayWeekStart)}
            >
              Hoy
            </Button>
            <Button
              variant="outline"
              size={isNarrow ? "icon" : "sm"}
              onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
              disabled={!canGoNext}
              aria-label={isNarrow ? "Semana siguiente" : undefined}
            >
              {!isNarrow && "Siguiente"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Leyenda: las tarjetas no llevan ícono de estado, el color lo dice. */}
        <CalendarLegend present={tonesInView} />

        {/* Tira de días (solo vistas angostas): elegir el día que se muestra. */}
        {isNarrow && (
          <DayStrip
            days={shownDays}
            focusedIndex={focusedDayIdx}
            visibleIndices={visibleIdx}
            todayRef={now()}
            isBlocked={(day) =>
              isDayFullyBlocked(day, now()) ||
              isDayFullyClosed(day, unavailableSlots)
            }
            hasOwnReservation={(day) =>
              occurrences.some(
                (occ) =>
                  isOwnOccurrence(occ, userId) &&
                  (occ.status === "PENDING" || occ.status === "APPROVED") &&
                  isSameDay(fromUtcMs(occ.occurrenceStartTime), day),
              )
            }
            onFocusDay={setFocusedDayIdx}
          />
        )}

        {/* Header with days */}
        <div className="flex gap-0 border-b border-gray-200 dark:border-gray-700">
          <div className="w-14 flex-shrink-0"></div>
          <div
            className="grid flex-1 gap-0"
            style={{
              gridTemplateColumns: `repeat(${visibleIdx.length}, minmax(0, 1fr))`,
            }}
          >
            {visibleIdx.map((dayIdx) => {
              const day = weekDays[dayIdx];
              const clock = now();
              return (
                <DayHeaderCell
                  key={dayIdx}
                  day={day}
                  isToday={isSameDay(day, clock)}
                  bookable={
                    !isDayFullyBlocked(day, clock) &&
                    !isDayFullyClosed(day, unavailableSlots)
                  }
                  onBook={() => openBookingForDay(day)}
                />
              );
            })}
          </div>
        </div>

        {/* Calendar body. Mientras llegan las reservas la grilla es un esqueleto que pulsa (la
            primera vez) o se atenúa y pulsa (al cambiar de semana), así nunca se ve vacía y se
            toma por «todo libre». */}
        {calendarFirstTime && !calendarError ? (
          <CalendarSkeleton columns={visibleIdx.length} />
        ) : null}
        <div
          className={cn(
            "relative mb-8 flex gap-0",
            calendarFirstTime && !calendarError && "hidden",
            calendarLoading &&
              !calendarFirstTime &&
              "pointer-events-none animate-pulse opacity-60",
          )}
          aria-busy={calendarLoading}
        >
          {/* Time labels */}
          <div
            className="relative w-14 flex-shrink-0"
            style={{ paddingBottom: "12px" }}
          >
            {Array.from(
              { length: DISPLAY_HOURS.END - DISPLAY_HOURS.START + 1 },
              (_, i) => i + DISPLAY_HOURS.START,
            ).map((hour) => (
              <div
                key={hour}
                className="absolute w-full pr-2 text-right text-xs text-gray-500 dark:text-gray-400"
                style={{
                  top: `${((hour - DISPLAY_HOURS.START) / (DISPLAY_HOURS.END - DISPLAY_HOURS.START)) * 100}%`,
                  transform: "translateY(-50%)",
                }}
              >
                {minutesToTime((hour * 60) % (24 * 60))}
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div
            ref={calendarRef}
            className="relative grid flex-1 gap-0"
            style={{
              minHeight: "800px",
              gridTemplateColumns: `repeat(${visibleIdx.length}, minmax(0, 1fr))`,
            }}
            onPointerUp={(e) => {
              if (e.pointerType === "mouse") handleMouseUp();
            }}
            onPointerLeave={() => {
              if (isDragging) {
                setIsDragging(false);
                setDragStart(null);
                setDragCurrent(null);
              }
            }}
          >
            {visibleIdx.map((dayIdx) => {
              const day = weekDays[dayIdx];
              return (
                <DayColumn
                  key={dayIdx}
                  day={day}
                  blocked={isDayFullyBlocked(day, now())}
                  reservations={getReservationsForDay(day)}
                  unavailableSlots={getUnavailableSlotsForDay(day)}
                  firstBookableMinutes={firstBookableMinutes(day, now())}
                  userId={userId}
                  selectionOverlay={
                    dragSelection && dragSelection.dayIndex === dayIdx
                      ? { top: dragSelection.top, height: dragSelection.height }
                      : null
                  }
                  // Arrastrar para seleccionar es solo para punteros finos (mouse): en
                  // pantallas táctiles el dedo hace scroll, no selección (hallazgo A).
                  onPointerDownSlot={(e) => {
                    if (e.pointerType === "mouse") handleMouseDown(e, dayIdx);
                    else handleTapStart(e, dayIdx);
                  }}
                  onPointerMoveSlot={(e) => {
                    if (e.pointerType === "mouse") handleMouseMove(e, dayIdx);
                    else handleTapMove(e);
                  }}
                  onPointerUpSlot={(e) => {
                    if (e.pointerType !== "mouse") handleTapEnd(e);
                  }}
                  onPointerCancelSlot={() => {
                    // El navegador tomó el gesto como scroll: no es un toque.
                    tapRef.current = null;
                  }}
                  renderOccurrenceDetails={(occ, close) => (
                    <OccurrenceDetails
                      occ={occ}
                      own={isOwnOccurrence(occ, userId)}
                      apiEndpoint={apiEndpoint}
                      onRemoved={removeOccurrences}
                      onClose={close}
                    />
                  )}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Reservation ResponsiveDialog */}
      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ResponsiveDialogContent className="sm:max-w-[500px]">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Nueva reserva</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {selection &&
                `${toCapitalCase(format(selection.day, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es }))}`}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <BookingForm
            defaultValues={bookingDefaults}
            minStartMinutes={bookingMinStartMinutes}
            submitting={submitting}
            onSubmit={handleSubmit}
            onCancel={() => {
              setDialogOpen(false);
              setSelection(null);
            }}
          />
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
