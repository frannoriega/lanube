"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

export interface ReservationOccurrence {
  reservationId: string;
  occurrenceStartTime: string;
  occurrenceEndTime: string;
  reason: string;
  status: string;
  reservableType: string;
  reservableId: string;
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
  resourceType: string; // MEETING, COWORKING, LAB, AUDITORIUM
  apiEndpoint: string; // API endpoint to fetch reservations and create them
  onCreateReservation: (data: ReservationFormData) => Promise<void>;
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
  resourceType,
  apiEndpoint,
  onCreateReservation,
  eventTypes,
  defaultEventType,
  title,
  description,
  userId,
}: WeekCalendarProps) {
  // Week navigation state
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getCurrentWorkWeekStart());
  
  // Data state
  const [occurrences, setOccurrences] = useState<ReservationOccurrence[]>([]);
  const [loading, setLoading] = useState(true);

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
      setLoading(true);
      try {
        // Get Friday (last work day) at end of day
        const weekEnd = addDays(currentWeekStart, 4); // Monday + 4 = Friday
        weekEnd.setHours(23, 59, 59, 999);
        
        const response = await fetch(
          `${apiEndpoint}?startDate=${currentWeekStart.toISOString()}&endDate=${weekEnd.toISOString()}`
        );
        
        if (response.ok) {
          const data = await response.json();
          setOccurrences(data.occurrences || []);
        } else {
          toast.error("Error al cargar las reservas");
        }
      } catch (error) {
        console.error("Error fetching reservations:", error);
        toast.error("Error al cargar las reservas");
      } finally {
        setLoading(false);
      }
    };

    fetchReservations();
  }, [currentWeekStart, apiEndpoint]);

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
      const occStart = parseISO(occ.occurrenceStartTime);
      return isSameDay(occStart, day);
    });
  };

  // Calculate reservation position
  const getReservationStyle = (occ: ReservationOccurrence) => {
    const occStart = parseISO(occ.occurrenceStartTime);
    const occEnd = parseISO(occ.occurrenceEndTime);

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

      await onCreateReservation({
        startTime: startDateTime,
        endTime: endDateTime,
        reason,
        eventType,
      });

      // Success - close dialog and reset form
      setDialogOpen(false);
      setReason("");
      setEventType(defaultEventType);
      setIsWholeDay(false);
      setSelection(null);

      // Refetch reservations to show the new one
      const weekEnd = addDays(currentWeekStart, 4);
      weekEnd.setHours(23, 59, 59, 999);
      const response = await fetch(
        `${apiEndpoint}?startDate=${currentWeekStart.toISOString()}&endDate=${weekEnd.toISOString()}`
      );
      if (response.ok) {
        const data = await response.json();
        setOccurrences(data.occurrences || []);
      }
    } catch (error: any) {
      // Error is already handled by parent component
    } finally {
      setSubmitting(false);
    }
  };

  const dragSelection = getDragSelectionStyle();
  const timeOptions = generateTimeOptions();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-la-nube-primary"></div>
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
                  className={`text-center p-3 border-l border-gray-200 dark:border-gray-700 ${
                    isSameDay(day, new Date())
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
                const isPastDay = day < new Date() && !isSameDay(day, new Date());
                const dayReservations = getReservationsForDay(day);

                return (
                  <div
                    key={dayIdx}
                    className={`relative border-l border-gray-200 dark:border-gray-700 ${
                      isPastDay ? "bg-gray-50 dark:bg-gray-900" : "bg-white dark:bg-gray-950"
                    }`}
                    style={{ cursor: isPastDay ? "not-allowed" : "crosshair" }}
                    onMouseDown={(e) => !isPastDay && handleMouseDown(e, dayIdx)}
                    onMouseMove={(e) => !isPastDay && handleMouseMove(e, dayIdx)}
                  >
                    {/* Hour lines */}
                    {Array.from({ length: BUSINESS_HOURS.END - BUSINESS_HOURS.START }, (_, i) => i + 1).map((hour) => (
                      <div
                        key={hour}
                        className="absolute w-full border-t border-gray-200 dark:border-gray-700"
                        style={{ top: `${(hour / (BUSINESS_HOURS.END - BUSINESS_HOURS.START)) * 100}%` }}
                      />
                    ))}

                    {/* Existing reservations */}
                    {dayReservations.map((occ, idx) => {
                      const style = getReservationStyle(occ);
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
                            className={`h-full rounded ${bgColor} text-white text-xs p-1 overflow-hidden cursor-default shadow-sm`}
                            title={`${occ.reason} ${isOwnReservation ? '(Tu reserva)' : ''} ${isPending ? '(Pendiente)' : ''}`}
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

          {/* Legend */}
          <div className="flex items-center gap-6 text-sm mb-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-la-nube-primary"></div>
              <span className="text-gray-600 dark:text-gray-400">Reserva aprobada</span>
            </div>
            {userId && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-600"></div>
                  <span className="text-gray-600 dark:text-gray-400">Tu reserva aprobada ✓</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-yellow-500"></div>
                  <span className="text-gray-600 dark:text-gray-400">Tu reserva pendiente ⏳</span>
                </div>
              </>
            )}
          </div>

          {/* Instructions */}
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <p>
              💡 <strong>Cómo usar:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Haz clic y arrastra en el calendario para seleccionar un horario</li>
              <li>Los intervalos son de {TIME_INTERVAL_MINUTES} minutos</li>
              <li>Las reservas deben ser del mismo día</li>
              <li>
                Horario disponible: Lunes a Viernes, {BUSINESS_HOURS.START}:00 - {BUSINESS_HOURS.END}:00
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Reservation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{title || "Nueva Reserva"}</DialogTitle>
            <DialogDescription>
              {selection && `${format(selection.day, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}`}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Whole day toggle */}
            <div className="flex items-center justify-between space-x-2 p-3 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="wholeDay" className="text-base">
                  Evento de día completo
                </Label>
                <p className="text-sm text-muted-foreground">
                  {BUSINESS_HOURS.START}:00 - {BUSINESS_HOURS.END}:00
                </p>
              </div>
              <Switch id="wholeDay" checked={isWholeDay} onCheckedChange={setIsWholeDay} />
            </div>

            {/* Time inputs (hidden when whole day) */}
            {!isWholeDay && (
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
            )}

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
    </>
  );
}
