"use client";

/**
 * Formulario de "Nueva reserva" del calendario (milestone 14, propuesta 8; rediseñado en el
 * milestone 35).
 *
 *   - Es un formulario shadcn (`Form` + react-hook-form + Zod), como el resto del proyecto.
 *   - Como el de Google Calendar: arriba **un título** grande y sin caja (lo único obligatorio),
 *     después el horario en **una sola fila** "09:00 → 10:00 · 1 h" y una **descripción**
 *     opcional. Cada fila lleva su ícono, así se lee de un vistazo.
 *   - Ya no pide el «tipo de reserva»: a quien reserva no le sirve para nada (nada del flujo
 *     depende de él) y se elegía casi siempre el primero de la lista. El servidor le pone el
 *     tipo por defecto; el catálogo sigue para los eventos.
 *   - El pie (Cancelar / Crear reserva) usa `ResponsiveDialogFooter`, así en el teléfono queda
 *     pegado abajo de la hoja.
 *
 * Las reglas de negocio que dependen del reloj (no reservar en el pasado) **no** viven acá: las
 * sigue aplicando `WeekCalendar` en su submit, para que haya un único lugar donde se decide si
 * una reserva es válida.
 */

import { ResponsiveDialogFooter } from "@/components/molecules/responsive-dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  RESERVATION_REASON_MAX,
  RESERVATION_TITLE_MAX,
} from "@/lib/reservations/user-rules";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlignLeft, ArrowRight, Clock } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import {
  BUSINESS_HOURS,
  generateTimeOptions,
  minutesToTime,
  TIME_INTERVAL_MINUTES,
  timeToMinutes,
} from "./calendar-utils";

/** Validación del formulario: horas "HH:mm" con fin posterior al inicio, título y descripción. */
export const bookingFormSchema = z
  .object({
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    title: z
      .string()
      .trim()
      .min(1, "Poné un título para la reserva")
      .max(RESERVATION_TITLE_MAX, `Máximo ${RESERVATION_TITLE_MAX} caracteres`),
    // Opcional: lo obligatorio es el título.
    reason: z
      .string()
      .trim()
      .max(
        RESERVATION_REASON_MAX,
        `Máximo ${RESERVATION_REASON_MAX} caracteres`,
      ),
  })
  .refine((v) => timeToMinutes(v.endTime) > timeToMinutes(v.startTime), {
    message: "La hora de fin debe ser posterior a la de inicio",
    path: ["endTime"],
  });

export type BookingFormValues = z.infer<typeof bookingFormSchema>;

/** "45 min", "1 h", "1 h 30 min": la duración tal como se lee en voz alta. */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const TIME_OPTIONS = generateTimeOptions();

export function BookingForm({
  defaultValues,
  minStartMinutes,
  descriptionPlaceholder,
  submitting,
  onSubmit,
  onCancel,
}: {
  /** Valores iniciales; cambian cada vez que se abre el formulario desde otro horario. */
  defaultValues: BookingFormValues;
  /**
   * Primer minuto del día en que se puede empezar (hoy: no antes de ahora). El select de inicio
   * no ofrece horarios anteriores. La validación real sigue en el envío de `WeekCalendar`.
   */
  minStartMinutes?: number;
  /** Texto de ayuda de la descripción (cada espacio puede personalizarlo). */
  descriptionPlaceholder?: string;
  submitting: boolean;
  onSubmit: (values: BookingFormValues) => void;
  onCancel: () => void;
}) {
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues,
  });

  // Al reabrir con otro horario (otro toque en la grilla), reiniciar con los nuevos valores.
  useEffect(() => {
    form.reset(defaultValues);
    // Solo depende de los valores, no de la identidad del objeto `form`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    defaultValues.startTime,
    defaultValues.endTime,
    defaultValues.title,
    defaultValues.reason,
  ]);

  const startTime = form.watch("startTime");
  const endTime = form.watch("endTime");

  // El inicio no ofrece horas que ya pasaron. El valor actual se conserva aunque haya quedado
  // atrás (el formulario quedó abierto): el envío lo rechaza con el mensaje de siempre.
  const startOptions = useMemo(
    () =>
      TIME_OPTIONS.slice(0, -1).filter(
        (o) =>
          minStartMinutes === undefined ||
          timeToMinutes(o.value) >= minStartMinutes ||
          o.value === startTime,
      ),
    [minStartMinutes, startTime],
  );

  // El fin solo ofrece horas posteriores al inicio.
  const endOptions = useMemo(
    () =>
      TIME_OPTIONS.filter(
        (o) => timeToMinutes(o.value) > timeToMinutes(startTime),
      ),
    [startTime],
  );

  // Si al mover el inicio el fin queda antes (o igual), correrlo un intervalo hacia adelante.
  useEffect(() => {
    const sm = timeToMinutes(startTime);
    if (timeToMinutes(endTime) <= sm) {
      const bumped = sm + TIME_INTERVAL_MINUTES;
      if (bumped <= BUSINESS_HOURS.END * 60) {
        form.setValue("endTime", minutesToTime(bumped), {
          shouldValidate: true,
        });
      }
    }
  }, [startTime, endTime, form]);

  const duration = formatDuration(
    timeToMinutes(endTime) - timeToMinutes(startTime),
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Título: grande y sin caja, como en Google Calendar. */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Título</FormLabel>
              <FormControl>
                <Input
                  autoFocus
                  autoComplete="off"
                  placeholder="Agregá un título"
                  maxLength={RESERVATION_TITLE_MAX}
                  className="h-11 rounded-none border-0 border-b border-input bg-transparent px-0 text-lg font-medium shadow-none focus-visible:border-ring focus-visible:ring-0 dark:bg-transparent"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Horario: una fila "inicio → fin · duración". */}
        <div className="flex items-start gap-3">
          <Clock
            className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <fieldset className="min-w-0 flex-1">
            <legend className="sr-only">Horario</legend>
            <div className="flex flex-wrap items-start gap-2">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Hora de inicio</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-[6.5rem]">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {startOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <ArrowRight
                className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Hora de fin</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-[6.5rem]">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {endOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {duration && (
                <span
                  className="mt-2.5 text-sm text-muted-foreground"
                  aria-live="polite"
                >
                  · {duration}
                </span>
              )}
            </div>
          </fieldset>
        </div>

        {/* Descripción: opcional. */}
        <div className="flex items-start gap-3">
          <AlignLeft
            className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem className="min-w-0 flex-1">
                <FormLabel className="sr-only">Descripción</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={
                      descriptionPlaceholder ||
                      "Agregá una descripción (opcional)"
                    }
                    rows={3}
                    className="max-h-60 resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <ResponsiveDialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creando..." : "Crear reserva"}
          </Button>
        </ResponsiveDialogFooter>
      </form>
    </Form>
  );
}
