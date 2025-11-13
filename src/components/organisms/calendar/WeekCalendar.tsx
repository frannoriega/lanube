"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ReservationOccurrence } from "@/lib/db/resourceCalendar";
import { toCapitalCase } from "@/lib/utils/string";
import { addDays, addWeeks, format, getDay, isSameDay, parseISO, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Configuration constants
const BUSINESS_HOURS = {
  START: 9,  // 9 AM
  END: 18,   // 6 PM
} as const;

const TIME_INTERVAL_MINUTES = 15;

export interface UnavailableSlot {
  startTime: string;
  endTime: string;
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
function getCurrentWorkWeekStart(): Date {
  const now = new Date();
  const dayOfWeek = getDay(now); // 0 = Sunday, 6 = Saturday

  // If it's weekend (Saturday or Sunday), get next Monday
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const monday = startOfWeek(now, { weekStartsOn: 1 });
    return addWeeks(monday, 1); // Next week's Monday
  }

  // Otherwise, get this week's Monday
  return startOfWeek(now, { weekStartsOn: 1 });
}

// Helper function to generate time options
function generateTimeOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  const startMinutes = BUSINESS_HOURS.START * 60;
  const endMinutes = BUSINESS_HOURS.END * 60;

  for (let minutes = startMinutes; minutes <= endMinutes; minutes += TIME_INTERVAL_MINUTES) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const value = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
    options.push({ value, label: value });
  }

  return options;
}

export function WeekCalendar({
  apiEndpoint,
  eventTypes,
  defaultEventType,
  title,
  description,
  userId,
}: WeekCalendarProps) {
  // Week navigation state
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getCurrentWorkWeekStart());

  // Data state
  const [unavailableSlots, setUnavailableSlots] = useState<UnavailableSlot[]>([]);
  const [occurrences, setOccurrences] = useState<ReservationOccurrence[]>([]);

  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ day: Date; minutes: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ day: Date; minutes: number } | null>(null);

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
  const [selectedOccurrence, setSelectedOccurrence] = useState<ReservationOccurrence | null>(null);
  const [deleting, setDeleting] = useState(false);

  const calendarRef = useRef<HTMLDivElement>(null);
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(currentWeekStart, i));

  // Calculate navigation bounds
  const nextWeekStart = addWeeks(currentWeekStart, 1);
  const todayWeekStart = getCurrentWorkWeekStart();
  const maxWeekStart = addWeeks(todayWeekStart, 1);
  const canGoNext = nextWeekStart <= maxWeekStart;
  const canGoPrev = currentWeekStart > todayWeekStart;

  // Fetch reservations when week changes
  useEffect(() => {
    const fetchReservations = async () => {
      try {
        // Get Friday (last work day) at end of day
        const weekEnd = addWeeks(addDays(currentWeekStart, 4), 1); // Monday + 4 = Friday, + 1 week = next week's Friday
        weekEnd.setHours(23, 59, 59, 999);

        const response = await fetch(
          `${apiEndpoint}?startDate=${currentWeekStart.toISOString()}&endDate=${weekEnd.toISOString()}`
        );

        if (response.ok) {
          const data = await response.json();
          let unavailableSlots = data.unavailableSlots || [];
          unavailableSlots.sort((a: UnavailableSlot, b: UnavailableSlot) => {
            return parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime();
          });
          let processedUnavailableSlots: UnavailableSlot[] = [];
          if (unavailableSlots.length > 0) {
            let currentUnavailableSlot = unavailableSlots[0];
            for (let i = 1; i < unavailableSlots.length; i++) {
              const slot = unavailableSlots[i];
              if (currentUnavailableSlot.endTime === slot.startTime) {
                currentUnavailableSlot.endTime = slot.endTime;
              } else {
                processedUnavailableSlots.push(currentUnavailableSlot);
                currentUnavailableSlot = slot;
              }
            }
            processedUnavailableSlots.push(currentUnavailableSlot);
          }
          setOccurrences(data.userReservations || []);
          setUnavailableSlots(processedUnavailableSlots || []);
        } else {
          toast.error("Error al cargar las reservas");
        }
      } catch (error) {
        console.error("Error fetching reservations:", error);
        toast.error("Error al cargar las reservas");
      }
    };

    fetchReservations();
  }, [apiEndpoint]);

  // Convert minutes from midnight to time string (HH:mm)
  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  // Convert time string (HH:mm) to minutes from midnight
  const timeToMinutes = (time: string): number => {
    const [hours, mins] = time.split(":").map(Number);
    return hours * 60 + mins;
  };

  const overlapsUnavailableOrReservation = (day: Date, startMinutes: number, endMinutes: number) => {
    const getMinutes = (time: Date) => {
      return time.getHours() * 60 + time.getMinutes();
    }
    return unavailableSlots.some((slot) =>
      isSameDay(parseISO(slot.startTime), day) &&
      ((startMinutes > getMinutes(parseISO(slot.startTime)) && endMinutes < getMinutes(parseISO(slot.endTime))) ||
        (startMinutes < getMinutes(parseISO(slot.startTime)) && endMinutes > getMinutes(parseISO(slot.startTime))))) ||
      occurrences.some((occ) =>
        isSameDay(parseISO(occ.occurrenceStartTime), day) &&
        ((startMinutes > getMinutes(parseISO(occ.occurrenceStartTime)) && endMinutes < getMinutes(parseISO(occ.occurrenceEndTime))) ||
          (startMinutes < getMinutes(parseISO(occ.occurrenceStartTime)) && endMinutes > getMinutes(parseISO(occ.occurrenceStartTime))))
      )
  }

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
      const roundedMinutes = Math.round(totalMinutesFromMidnight / TIME_INTERVAL_MINUTES) * TIME_INTERVAL_MINUTES;

      // Clamp to business hours
      const clampedMinutes = Math.max(startMinutes, Math.min(endMinutes, roundedMinutes));

      return {
        day: weekDays[dayIndex],
        minutes: clampedMinutes,
      };
    },
    [weekDays]
  );

  // Handle mouse down - start dragging
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, dayIndex: number) => {
      e.preventDefault();
      const posInfo = getPositionInfo(e, dayIndex);
      if (!posInfo) return;

      if (overlapsUnavailableOrReservation(posInfo.day, posInfo.minutes, posInfo.minutes)) {
        return;
      }

      const now = new Date();
      const selectedDateTime = new Date(posInfo.day);
      selectedDateTime.setHours(0, posInfo.minutes, 0, 0);

      if (selectedDateTime < now) {
        return;
      }

      setIsDragging(true);
      setDragStart(posInfo);
      setDragCurrent(posInfo);
    },
    [getPositionInfo]
  );

  // Handle mouse move - update drag
  const handleMouseMove = useCallback(
    (e: React.MouseEvent, dayIndex: number) => {
      if (!isDragging || !dragStart) return;

      const posInfo = getPositionInfo(e, dayIndex);
      if (!posInfo) return;

      if (overlapsUnavailableOrReservation(posInfo.day, dragStart.minutes, posInfo.minutes)) {
        return;
      }

      if (isSameDay(posInfo.day, dragStart.day)) {
        setDragCurrent(posInfo);
      }
    },
    [isDragging, dragStart, getPositionInfo]
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
      if (!(userId && occ.reservableType === 'USER' && occ.reservableId === userId)) return false;
      const occStart = parseISO(occ.occurrenceStartTime);
      const occEnd = parseISO(occ.occurrenceEndTime);
      return occStart < selEnd && occEnd > selStart;
    });

    if (overlapsOwn) {
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      toast.error('Ya tienes una reserva en ese horario');
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
  }, [isDragging, dragStart, dragCurrent]);

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
      console.log(occ);
      const occStart = parseISO(occ.occurrenceStartTime);
      return isSameDay(occStart, day);
    });
  };

  // Get unavailable slots for a specific day
  const getUnavailableSlotsForDay = (day: Date) => {
    return unavailableSlots.filter((slot) => {
      const slotStart = parseISO(slot.startTime);
      const slotEnd = parseISO(slot.endTime);
      return isSameDay(slotStart, day);
    });
  };

  // Calculate reservation position
  const getReservationStyle = (occ: { startTime: string; endTime: string }) => {
    const occStart = parseISO(occ.startTime);
    const occEnd = parseISO(occ.endTime);

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
        startDateTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

        endDateTime = new Date(selection.day);
        endDateTime.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
      }

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
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

        setOccurrences([...occurrences, await response.json()]);
      } else {
        const error = await response.json();
        toast.error(error.error || "Error al crear la reserva");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const dragSelection = getDragSelectionStyle();
  const timeOptions = generateTimeOptions();

  return (
    <>
      <div className="overflow-hidden">
        <div className="min-w-[800px]">
          {/* Week Navigation */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {format(currentWeekStart, "d 'de' MMMM", { locale: es })} -{" "}
              {format(addDays(currentWeekStart, 4), "d 'de' MMMM 'de' yyyy", { locale: es })}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, -1))}
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
                onClick={() => setCurrentWeekStart(nextWeekStart)}
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
                  className={`text-center p-3 border-l border-gray-200 dark:border-gray-700 ${isSameDay(day, new Date())
                    ? "bg-la-nube-primary/10 text-la-nube-primary font-bold"
                    : "text-gray-700 dark:text-gray-300"
                    }`}
                >
                  <div className="text-xs font-medium">{format(day, "EEE", { locale: es }).toUpperCase()}</div>
                  <div className="text-xl font-bold">{format(day, "d")}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Calendar body */}
          <div className="flex gap-0 relative mb-8">
            {/* Time labels */}
            <div className="relative w-14 flex-shrink-0" style={{ paddingBottom: "12px" }}>
              {Array.from({ length: BUSINESS_HOURS.END - BUSINESS_HOURS.START + 1 }, (_, i) => i + BUSINESS_HOURS.START).map(
                (hour) => (
                  <div
                    key={hour}
                    className="absolute text-xs text-gray-500 dark:text-gray-400 text-right pr-2 w-full"
                    style={{
                      top: `${((hour - BUSINESS_HOURS.START) / (BUSINESS_HOURS.END - BUSINESS_HOURS.START)) * 100}%`,
                      transform: "translateY(-50%)",
                    }}
                  >
                    {format(new Date().setHours(hour, 0, 0, 0), "HH:mm")}
                  </div>
                )
              )}
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
                const isPastOrUnavailableDay = day < addDays(new Date(), 1);
                const dayReservations = getReservationsForDay(day);
                const unavailableSlots = getUnavailableSlotsForDay(day);

                return (
                  <div
                    key={dayIdx}
                    className={`relative z-40 border-l border-gray-200 dark:border-gray-700 ${isPastOrUnavailableDay ? "bg-[repeating-linear-gradient(135deg,_#99a1af_0,_#99a1af_3px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed" : "bg-white dark:bg-gray-950"
                      }`}
                    onMouseDown={(e) => !isPastOrUnavailableDay && handleMouseDown(e, dayIdx)}
                    onMouseMove={(e) => !isPastOrUnavailableDay && handleMouseMove(e, dayIdx)}
                  >
                    {/* Hour lines */}
                    {Array.from({ length: BUSINESS_HOURS.END - BUSINESS_HOURS.START }, (_, i) => i + 1).map((hour) => (
                      <div
                        key={hour}
                        className="absolute w-full border-t border-gray-200 dark:border-gray-700"
                        style={{ top: `${(hour / (BUSINESS_HOURS.END - BUSINESS_HOURS.START)) * 100}%` }}
                      />
                    ))}

                    {/* Unavailable slots */}
                    {!isPastOrUnavailableDay && unavailableSlots.map((slot, idx) => {
                      const style = getReservationStyle({ startTime: slot.startTime, endTime: slot.endTime });
                      return (
                        <div key={idx} className="absolute w-full bg-red z-50" style={{ top: style.top, height: style.height }}>
                          <div className="h-full rounded bg-[repeating-linear-gradient(135deg,_#99a1af_0,_#99a1af_3px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed" />
                        </div>
                      )
                    })}

                    {/* Existing reservations */}
                    {dayReservations.map((occ, idx) => {
                      const style = getReservationStyle({ startTime: occ.occurrenceStartTime, endTime: occ.occurrenceEndTime });
                      const isOwnReservation = userId && occ.reservableType === "USER" && occ.reservableId === userId;
                      const isPending = occ.status === "PENDING";

                      // Visual styling based on reservation ownership and status
                      const bgColor = isOwnReservation && isPending
                        ? "bg-yellow-500" // User's pending reservation (yellow)
                        : isOwnReservation
                          ? "bg-green-600"   // User's approved reservation (green)
                          : "bg-la-nube-primary"; // Other's approved reservation (blue)

                      return (
                        <div key={idx} className="absolute w-full px-1" style={{ top: style.top, height: style.height }}>
                          <div
                            className={`h-full rounded ${bgColor} text-white text-xs p-1 overflow-hidden cursor-pointer shadow-sm`}
                            title={`${occ.reason} ${isOwnReservation ? '(Tu reserva)' : ''} ${isPending ? '(Pendiente)' : ''}`}
                            onClick={() => setSelectedOccurrence(occ)}
                          >
                            <div className="font-semibold truncate">
                              {occ.reason}
                              {isOwnReservation && <span className="ml-1">✓</span>}
                            </div>
                            <div className="text-[10px] opacity-90">
                              {format(parseISO(occ.occurrenceStartTime), "HH:mm")} -{" "}
                              {format(parseISO(occ.occurrenceEndTime), "HH:mm")}
                              {isPending && isOwnReservation && <span className="ml-1">⏳</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Drag selection overlay */}
                    {dragSelection && dragSelection.dayIndex === dayIdx && (
                      <div
                        className="absolute w-full px-1 pointer-events-none"
                        style={{ top: dragSelection.top, height: dragSelection.height }}
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
              {selection && `${toCapitalCase(format(selection.day, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es }))}`}
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
                    {timeOptions.map((option) => (
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
                    {timeOptions
                      .filter((option) => timeToMinutes(option.value) > timeToMinutes(startTime))
                      .map((option) => (
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
              <Label htmlFor="reason">{description || "Motivo de la reserva"}</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe el propósito de la reserva..."
                rows={3}
                required
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
      <Dialog open={!!selectedOccurrence} onOpenChange={(open) => !open && setSelectedOccurrence(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Detalle de la reserva</DialogTitle>
            {selectedOccurrence && (
              <DialogDescription>
                {toCapitalCase(format(parseISO(selectedOccurrence.occurrenceStartTime), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es }))}
              </DialogDescription>
            )}
          </DialogHeader>
          {selectedOccurrence && (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="font-medium">Horario:</span>{" "}
                {format(parseISO(selectedOccurrence.occurrenceStartTime), "HH:mm")} - {format(parseISO(selectedOccurrence.occurrenceEndTime), "HH:mm")}
              </div>
              <div className="text-sm">
                <span className="font-medium">Motivo:</span>{" "}
                <span className="bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{selectedOccurrence.reason}</span>
              </div>
              <div className="text-sm">
                <span className="font-medium">Estado:</span>{" "}{selectedOccurrence.status}
              </div>
              {userId && selectedOccurrence.reservableType === 'USER' && selectedOccurrence.reservableId === userId && (
                <div className="pt-2 flex justify-end">
                  <Button variant="destructive" disabled={deleting} onClick={async () => {
                    try {
                      setDeleting(true);
                      const res = await fetch(apiEndpoint, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reservationId: selectedOccurrence.reservationId }),
                      });
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        toast.error(err.error || 'No se pudo eliminar la reserva');
                      } else {
                        toast.success('Reserva eliminada');
                        setOccurrences(occurrences => occurrences.filter((occ) => occ.reservationId !== selectedOccurrence.reservationId));
                        setSelectedOccurrence(null);
                      }
                    } catch (e) {
                      toast.error('Error al eliminar la reserva');
                    } finally {
                      setDeleting(false);
                    }
                  }}>Eliminar</Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
