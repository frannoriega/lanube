"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useServerTime } from "@/components/providers/server-time";
import { ReservationOccurrence } from "@/lib/db/resourceCalendar";
import { toCapitalCase } from "@/lib/utils/string";
import {
  addDays,
  addWeeks,
  format,
  getDay,
  isAfter,
  isBefore,
  isSameDay,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

// Configuration constants
const BUSINESS_HOURS = {
  START: 9, // 9 AM
  END: 18, // 6 PM
} as const;

const TIME_INTERVAL_MINUTES = 15;

function fromUtcMs(ms: number): Date {
  return new Date(ms);
}

/** New reservations only from tomorrow onward (local calendar day vs `clock`). */
function isBookableReservationDay(day: Date, clock: Date): boolean {
  return isAfter(startOfDay(day), startOfDay(clock));
}

export type UnavailableSlotKind = "resource_full" | "cross_resource";

export interface UnavailableSlot {
  resourceId?: string;
  startTime: number;
  endTime: number;
  kind?: UnavailableSlotKind;
}

export interface DragSelection {
  day: Date;
  startMinutes: number;
  endMinutes: number;
}

export interface ReservationFormData {
  startTime: Date;
  endTime: Date;
  reason: string;
  eventType: string;
}

interface WeekCalendarProps {
  apiEndpoint: string; // API endpoint to fetch reservations and create them
  eventTypes: Array<{ value: string; label: string }>;
  defaultEventType: string;
  title?: string;
  description?: string;
  userId?: string; // Current user's ID for visual differentiation
}

// Helper function to get the current work week start
function getCurrentWorkWeekStart(now: Date): Date {
  const dayOfWeek = getDay(now); // 0 = Sunday, 6 = Saturday

  // If it's weekend (Saturday or Sunday), get next Monday
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const monday = startOfWeek(now, { weekStartsOn: 1 });
    return addWeeks(monday, 1); // Next week's Monday
  }

  // Friday: skip the current work week (show next Monday onward)
  if (dayOfWeek === 5) {
    const monday = startOfWeek(now, { weekStartsOn: 1 });
    return addWeeks(monday, 1);
  }

  // Otherwise, get this week's Monday
  return startOfWeek(now, { weekStartsOn: 1 });
}

// Helper function to generate time options
function generateTimeOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  const startMinutes = BUSINESS_HOURS.START * 60;
  const endMinutes = BUSINESS_HOURS.END * 60;

  for (
    let minutes = startMinutes;
    minutes <= endMinutes;
    minutes += TIME_INTERVAL_MINUTES
  ) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const value = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
    options.push({ value, label: value });
  }

  return options;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

export function WeekCalendar({
  apiEndpoint,
  eventTypes,
  defaultEventType,
  title,
  description,
  userId,
}: WeekCalendarProps) {
  const { now, alignRevision } = useServerTime();

  // Week navigation — initialised from the server-aligned clock only once
  // (avoids a double-fetch when the client clock differs from the server).
  const [currentWeekStart, setCurrentWeekStart] = useState<Date | null>(null);

  useLayoutEffect(() => {
    setCurrentWeekStart((prev) => {
      const correct = getCurrentWorkWeekStart(now());
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

  // Dialog and form state
  const [selection, setSelection] = useState<DragSelection | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [eventType, setEventType] = useState(defaultEventType);
  const [isWholeDay, setIsWholeDay] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [submitting, setSubmitting] = useState(false);

  // View details / delete dialog state
  const [selectedOccurrence, setSelectedOccurrence] =
    useState<ReservationOccurrence | null>(null);
  const [deleting, setDeleting] = useState(false);

  const calendarRef = useRef<HTMLDivElement>(null);

  // Derived values — guarded against null currentWeekStart
  const weekDays = useMemo(
    () =>
      currentWeekStart
        ? Array.from({ length: 5 }, (_, i) => addDays(currentWeekStart, i))
        : [],
    [currentWeekStart],
  );

  const todayWeekStart = useMemo(() => getCurrentWorkWeekStart(now()), [now]);
  const maxWeekStart = addWeeks(todayWeekStart, 1);
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

  const fetchReservations = useCallback(async () => {
    if (!currentWeekStart) return;
    try {
      const weekEnd = addWeeks(addDays(currentWeekStart, 4), 1);
      weekEnd.setHours(23, 59, 59, 999);

      const response = await fetch(
        `${apiEndpoint}?startDate=${currentWeekStart.getTime()}&endDate=${weekEnd.getTime()}`,
      );

      if (response.ok) {
        const data = await response.json();
        const rawSlots: UnavailableSlot[] = data.unavailableSlots || [];
        rawSlots.sort((a, b) => a.startTime - b.startTime);
        const processedUnavailableSlots: UnavailableSlot[] = [];
        if (rawSlots.length > 0) {
          let current = rawSlots[0];
          for (let i = 1; i < rawSlots.length; i++) {
            const slot = rawSlots[i];
            if (
              current.endTime === slot.startTime &&
              current.kind === slot.kind
            ) {
              current = { ...current, endTime: slot.endTime };
            } else {
              processedUnavailableSlots.push(current);
              current = slot;
            }
          }
          processedUnavailableSlots.push(current);
        }
        setOccurrences(data.userReservations || []);
        setUnavailableSlots(processedUnavailableSlots);
      } else {
        toast.error("Error al cargar las reservas");
      }
    } catch {
      toast.error("Error al cargar las reservas");
    }
  }, [currentWeekStart, apiEndpoint]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // Get position info from mouse event
  const getPositionInfo = useCallback(
    (e: React.MouseEvent, dayIndex: number) => {
      if (!calendarRef.current) return null;

      const rect = calendarRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const totalHeight = rect.height;

      const startMinutes = BUSINESS_HOURS.START * 60;
      const endMinutes = BUSINESS_HOURS.END * 60;
      const totalMinutes = endMinutes - startMinutes;

      const minutesFromStart = (relativeY / totalHeight) * totalMinutes;
      const totalMinutesFromMidnight = startMinutes + minutesFromStart;

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
      };
    },
    [weekDays],
  );

  // Handle mouse down - start dragging
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, dayIndex: number) => {
      e.preventDefault();
      const posInfo = getPositionInfo(e, dayIndex);
      if (!posInfo) return;

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
      if (!isBookableReservationDay(posInfo.day, clock)) {
        return;
      }

      const selectedDateTime = new Date(posInfo.day);
      selectedDateTime.setHours(0, posInfo.minutes, 0, 0);

      if (selectedDateTime < clock) {
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

  // Calculate drag selection style
  const getDragSelectionStyle = useCallback(() => {
    if (!isDragging || !dragStart || !dragCurrent) return null;
    if (!isSameDay(dragStart.day, dragCurrent.day)) return null;

    const dayIndex = weekDays.findIndex((d) => isSameDay(d, dragStart.day));
    if (dayIndex === -1) return null;

    const startMinutes = Math.min(dragStart.minutes, dragCurrent.minutes);
    const endMinutes = Math.max(dragStart.minutes, dragCurrent.minutes);

    const businessStart = BUSINESS_HOURS.START * 60;
    const businessEnd = BUSINESS_HOURS.END * 60;
    const totalMinutes = businessEnd - businessStart;

    const top = ((startMinutes - businessStart) / totalMinutes) * 100;
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

  // Calculate reservation position
  const getReservationStyle = (occ: { startTime: number; endTime: number }) => {
    const occStart = fromUtcMs(occ.startTime);
    const occEnd = fromUtcMs(occ.endTime);

    const startMinutes = occStart.getHours() * 60 + occStart.getMinutes();
    const endMinutes = occEnd.getHours() * 60 + occEnd.getMinutes();

    const businessStart = BUSINESS_HOURS.START * 60;
    const businessEnd = BUSINESS_HOURS.END * 60;
    const totalMinutes = businessEnd - businessStart;

    const top = ((startMinutes - businessStart) / totalMinutes) * 100;
    const height = ((endMinutes - startMinutes) / totalMinutes) * 100;

    return {
      top: `${Math.max(0, top)}%`,
      height: `${Math.max(0, Math.min(100 - Math.max(0, top), height))}%`,
    };
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selection || !reason) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    setSubmitting(true);

    try {
      let startDateTime: Date;
      let endDateTime: Date;

      if (isWholeDay) {
        startDateTime = new Date(selection.day);
        startDateTime.setHours(BUSINESS_HOURS.START, 0, 0, 0);
        endDateTime = new Date(selection.day);
        endDateTime.setHours(BUSINESS_HOURS.END, 0, 0, 0);
      } else {
        const startMinutes = timeToMinutes(startTime);
        const endMinutes = timeToMinutes(endTime);

        if (startMinutes >= endMinutes) {
          toast.error("La hora de inicio debe ser anterior a la hora de fin");
          setSubmitting(false);
          return;
        }

        startDateTime = new Date(selection.day);
        startDateTime.setHours(
          Math.floor(startMinutes / 60),
          startMinutes % 60,
          0,
          0,
        );

        endDateTime = new Date(selection.day);
        endDateTime.setHours(
          Math.floor(endMinutes / 60),
          endMinutes % 60,
          0,
          0,
        );
      }

      const clock = now();
      if (startDateTime < clock) {
        toast.error("No se pueden hacer reservas en el pasado");
        setSubmitting(false);
        return;
      }

      if (!isBookableReservationDay(selection.day, clock)) {
        toast.error("Las reservas solo están disponibles a partir de mañana");
        setSubmitting(false);
        return;
      }

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: startDateTime.getTime(),
          endTime: endDateTime.getTime(),
          reason,
          eventType,
        }),
      });

      // Success - close dialog and reset form
      if (response.ok) {
        setDialogOpen(false);
        setReason("");
        setEventType(defaultEventType);
        setIsWholeDay(false);
        setSelection(null);

        await fetchReservations();
      } else {
        const error = await response.json();
        toast.error(error.error || "Error al crear la reserva");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const dragSelection = getDragSelectionStyle();

  const bookingEndOptions = useMemo(() => {
    const all = generateTimeOptions();
    const startM = timeToMinutes(startTime);
    return all.filter((o) => timeToMinutes(o.value) > startM);
  }, [startTime]);

  useEffect(() => {
    if (!dialogOpen) return;
    const sm = timeToMinutes(startTime);
    const em = timeToMinutes(endTime);
    if (em <= sm) {
      const bumped = sm + TIME_INTERVAL_MINUTES;
      if (bumped <= BUSINESS_HOURS.END * 60) {
        setEndTime(minutesToTime(bumped));
      }
    }
  }, [dialogOpen, startTime, endTime]);

  if (!currentWeekStart) {
    return (
      <div className="flex h-[500px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-la-nube-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden">
        <div className="min-w-[800px]">
          {/* Week Navigation */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {format(currentWeekStart, "d 'de' MMMM", { locale: es })} -{" "}
              {format(addDays(currentWeekStart, 4), "d 'de' MMMM 'de' yyyy", {
                locale: es,
              })}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentWeekStart(addWeeks(currentWeekStart, -1))
                }
                disabled={!canGoPrev}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
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
                size="sm"
                onClick={() =>
                  setCurrentWeekStart(addWeeks(currentWeekStart, 1))
                }
                disabled={!canGoNext}
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Header with days */}
          <div className="flex gap-0 border-b border-gray-200 dark:border-gray-700">
            <div className="w-14 flex-shrink-0"></div>
            <div className="flex-1 grid grid-cols-5 gap-0">
              {weekDays.map((day, idx) => (
                <div
                  key={idx}
                  className={`text-center p-3 border-l border-gray-200 dark:border-gray-700 ${
                    isSameDay(day, now())
                      ? "bg-la-nube-primary/10 text-la-nube-primary font-bold"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <div className="text-xs font-medium">
                    {format(day, "EEE", { locale: es }).toUpperCase()}
                  </div>
                  <div className="text-xl font-bold">{format(day, "d")}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Calendar body */}
          <div className="flex gap-0 relative mb-8">
            {/* Time labels */}
            <div
              className="relative w-14 flex-shrink-0"
              style={{ paddingBottom: "12px" }}
            >
              {Array.from(
                { length: BUSINESS_HOURS.END - BUSINESS_HOURS.START + 1 },
                (_, i) => i + BUSINESS_HOURS.START,
              ).map((hour) => (
                <div
                  key={hour}
                  className="absolute text-xs text-gray-500 dark:text-gray-400 text-right pr-2 w-full"
                  style={{
                    top: `${((hour - BUSINESS_HOURS.START) / (BUSINESS_HOURS.END - BUSINESS_HOURS.START)) * 100}%`,
                    transform: "translateY(-50%)",
                  }}
                >
                  {format(
                    (() => {
                      const t = now();
                      t.setHours(hour, 0, 0, 0);
                      return t;
                    })(),
                    "HH:mm",
                  )}
                </div>
              ))}
            </div>

            {/* {loading && (
              <div className="absolute inset-0 left-14 flex items-center justify-center z-50 bg-black/20 dark:bg-white/20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-la-nube-primary"></div>
              </div>
            )} */}

            {/* Day columns */}
            <div
              ref={calendarRef}
              className="flex-1 grid grid-cols-5 gap-0 relative"
              style={{ minHeight: "600px" }}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                if (isDragging) {
                  setIsDragging(false);
                  setDragStart(null);
                  setDragCurrent(null);
                }
              }}
            >
              {weekDays.map((day, dayIdx) => {
                const clock = now();
                const earliestBookableDayStart = startOfDay(addDays(clock, 1));
                const isPastOrUnavailableDay = isBefore(
                  startOfDay(day),
                  earliestBookableDayStart,
                );
                const dayReservations = getReservationsForDay(day);
                const unavailableSlots = getUnavailableSlotsForDay(day);

                return (
                  <div
                    key={dayIdx}
                    className={`relative z-40 border-l border-gray-200 dark:border-gray-700 ${
                      isPastOrUnavailableDay
                        ? "bg-[repeating-linear-gradient(135deg,_#99a1af_0,_#99a1af_3px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed"
                        : "bg-white dark:bg-gray-950"
                    }`}
                    onMouseDown={(e) =>
                      !isPastOrUnavailableDay && handleMouseDown(e, dayIdx)
                    }
                    onMouseMove={(e) =>
                      !isPastOrUnavailableDay && handleMouseMove(e, dayIdx)
                    }
                  >
                    {/* Hour lines */}
                    {Array.from(
                      { length: BUSINESS_HOURS.END - BUSINESS_HOURS.START },
                      (_, i) => i + 1,
                    ).map((hour) => (
                      <div
                        key={hour}
                        className="absolute w-full border-t border-gray-200 dark:border-gray-700"
                        style={{
                          top: `${(hour / (BUSINESS_HOURS.END - BUSINESS_HOURS.START)) * 100}%`,
                        }}
                      />
                    ))}

                    {/* Unavailable slots */}
                    {!isPastOrUnavailableDay &&
                      unavailableSlots.map((slot, idx) => {
                        const style = getReservationStyle({
                          startTime: slot.startTime,
                          endTime: slot.endTime,
                        });
                        const stripeClass =
                          slot.kind === "cross_resource"
                            ? "h-full rounded bg-[repeating-linear-gradient(135deg,_#7c3aed_0,_#7c3aed_3px,_transparent_0,_transparent_50%)] dark:bg-[repeating-linear-gradient(135deg,_#a78bfa_0,_#a78bfa_3px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed"
                            : "h-full rounded bg-[repeating-linear-gradient(135deg,_#99a1af_0,_#99a1af_3px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed";
                        return (
                          <div
                            key={idx}
                            className="absolute w-full z-50"
                            style={{ top: style.top, height: style.height }}
                          >
                            <div className={stripeClass} />
                          </div>
                        );
                      })}

                    {/* Existing reservations */}
                    {dayReservations.map((occ, idx) => {
                      const style = getReservationStyle({
                        startTime: occ.occurrenceStartTime,
                        endTime: occ.occurrenceEndTime,
                      });
                      const isOwnReservation =
                        userId &&
                        occ.reservableType === "USER" &&
                        occ.reservableId === userId;
                      const isPending = occ.status === "PENDING";
                      const isRejected = occ.status === "REJECTED";
                      const isCancelled = occ.status === "CANCELLED";

                      const bgColor =
                        isOwnReservation && isPending
                          ? "bg-yellow-500"
                          : isOwnReservation && isRejected
                            ? "bg-red-600"
                            : isOwnReservation && isCancelled
                              ? "bg-gray-500"
                              : isOwnReservation
                                ? "bg-green-600"
                                : "bg-la-nube-primary";

                      return (
                        <div
                          key={idx}
                          className="absolute w-full px-1"
                          style={{ top: style.top, height: style.height }}
                        >
                          <div
                            className={`h-full rounded ${bgColor} text-white text-xs p-1 overflow-hidden cursor-pointer shadow-sm`}
                            title={`${occ.reason} ${isOwnReservation ? "(Tu reserva)" : ""} ${isPending ? "(Pendiente)" : isRejected ? "(Rechazada)" : isCancelled ? "(Cancelada)" : ""}`}
                            onClick={() => setSelectedOccurrence(occ)}
                          >
                            <div className="font-semibold truncate">
                              {occ.reason}
                              {isOwnReservation &&
                                !isRejected &&
                                !isCancelled && <span className="ml-1">✓</span>}
                              {isOwnReservation && isRejected && (
                                <span className="ml-1">✗</span>
                              )}
                            </div>
                            <div className="text-[10px] opacity-90">
                              {format(
                                fromUtcMs(occ.occurrenceStartTime),
                                "HH:mm",
                              )}{" "}
                              -{" "}
                              {format(
                                fromUtcMs(occ.occurrenceEndTime),
                                "HH:mm",
                              )}
                              {isPending && isOwnReservation && (
                                <span className="ml-1">⏳</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Drag selection overlay */}
                    {dragSelection && dragSelection.dayIndex === dayIdx && (
                      <div
                        className="absolute w-full px-1 pointer-events-none"
                        style={{
                          top: dragSelection.top,
                          height: dragSelection.height,
                        }}
                      >
                        <div className="h-full rounded bg-blue-400/50 border-2 border-blue-500" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Reservation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{title || "Nueva Reserva"}</DialogTitle>
            <DialogDescription>
              {selection &&
                `${toCapitalCase(format(selection.day, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es }))}`}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Hora de inicio</Label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {generateTimeOptions().map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Hora de fin</Label>
                <Select value={endTime} onValueChange={setEndTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bookingEndOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="eventType">Tipo de evento</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">
                {description || "Motivo de la reserva"}
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe el propósito de la reserva..."
                rows={3}
                required
                className="max-h-60"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setReason("");
                  setEventType(defaultEventType);
                  setIsWholeDay(false);
                  setSelection(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creando..." : "Crear Reserva"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Reservation Details Dialog */}
      <Dialog
        open={!!selectedOccurrence}
        onOpenChange={(open) => !open && setSelectedOccurrence(null)}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Detalle de la reserva</DialogTitle>
            {selectedOccurrence && (
              <DialogDescription>
                {toCapitalCase(
                  format(
                    fromUtcMs(selectedOccurrence.occurrenceStartTime),
                    "EEEE, d 'de' MMMM 'de' yyyy",
                    { locale: es },
                  ),
                )}
              </DialogDescription>
            )}
          </DialogHeader>
          {selectedOccurrence && (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="font-medium">Horario:</span>{" "}
                {format(
                  fromUtcMs(selectedOccurrence.occurrenceStartTime),
                  "HH:mm",
                )}{" "}
                -{" "}
                {format(
                  fromUtcMs(selectedOccurrence.occurrenceEndTime),
                  "HH:mm",
                )}
              </div>
              <div className="text-sm">
                <span className="font-medium">Motivo:</span>{" "}
                <span className="bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">
                  {selectedOccurrence.reason}
                </span>
              </div>
              <div className="text-sm">
                <span className="font-medium">Estado:</span>{" "}
                {selectedOccurrence.status}
              </div>
              {selectedOccurrence.reservableType === "EVENT" &&
                selectedOccurrence.formOpen &&
                selectedOccurrence.formSlug && (
                  <div className="pt-2 flex justify-end">
                    <Button asChild>
                      <Link
                        href={`/forms/${selectedOccurrence.formSlug}`}
                        target="_blank"
                      >
                        Inscribirse
                      </Link>
                    </Button>
                  </div>
                )}
              {userId &&
                selectedOccurrence.reservableType === "USER" &&
                selectedOccurrence.reservableId === userId && (
                  <div className="pt-2 flex justify-end">
                    <Button
                      variant="destructive"
                      disabled={deleting}
                      onClick={async () => {
                        try {
                          setDeleting(true);
                          const res = await fetch(apiEndpoint, {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              reservationId: selectedOccurrence.reservationId,
                            }),
                          });
                          if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            toast.error(
                              err.error || "No se pudo eliminar la reserva",
                            );
                          } else {
                            toast.success("Reserva eliminada");
                            setOccurrences((occurrences) =>
                              occurrences.filter(
                                (occ) =>
                                  occ.reservationId !==
                                  selectedOccurrence.reservationId,
                              ),
                            );
                            setSelectedOccurrence(null);
                          }
                        } catch (ignored) {
                          toast.error("Error al eliminar la reserva");
                        } finally {
                          setDeleting(false);
                        }
                      }}
                    >
                      Eliminar
                    </Button>
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
