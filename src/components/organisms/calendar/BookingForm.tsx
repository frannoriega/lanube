"use client";

/**
 * Formulario de "Nueva reserva" del calendario (milestone 14, propuesta 8).
 *
 * Antes eran cuatro `useState` sueltos dentro de `WeekCalendar`, con "Hora de inicio" y
 * "Hora de fin" como dos selects en una grilla de dos columnas y los botones al final.
 * Ahora:
 *   - Es un formulario shadcn (`Form` + react-hook-form + Zod), como el resto del proyecto.
 *   - El horario es **una sola fila** "09:00 → 10:00" con la duración al lado ("1 h"), que es
 *     lo que la persona realmente está eligiendo.
 *   - Orden: Horario · Tipo · Motivo. El pie (Cancelar / Crear reserva) usa
 *     `ResponsiveDialogFooter`, así en el teléfono queda pegado abajo de la hoja.
 *
 * Las reglas de negocio que dependen del reloj (no reservar en el pasado, 24h de
 * anticipación mínima) **no** viven acá: las sigue aplicando `WeekCalendar` en su submit,
 * para que haya un único lugar donde se decide si una reserva es válida.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
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

/** Validación del formulario: horas "HH:mm" con fin posterior al inicio, tipo y motivo. */
export const bookingFormSchema = z
  .object({
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    eventType: z.string().min(1, "Elegí un tipo de reserva"),
    reason: z
      .string()
      .trim()
      .min(1, "Contanos para qué es la reserva")
      .max(1000, "Máximo 1000 caracteres"),
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
  eventTypes,
  reasonLabel,
  submitting,
  onSubmit,
  onCancel,
}: {
  /** Valores iniciales; cambian cada vez que se abre el formulario desde otro horario. */
  defaultValues: BookingFormValues;
  eventTypes: Array<{ value: string; label: string }>;
  /** Rótulo del campo motivo (cada espacio puede personalizarlo). */
  reasonLabel?: string;
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
    defaultValues.eventType,
    defaultValues.reason,
  ]);

  const startTime = form.watch("startTime");
  const endTime = form.watch("endTime");

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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Horario: una fila "inicio → fin · duración". */}
        <fieldset className="space-y-2">
          <legend className="text-sm leading-none font-medium">Horario</legend>
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
                      {TIME_OPTIONS.slice(0, -1).map((o) => (
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

        <FormField
          control={form.control}
          name="eventType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de reserva</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {eventTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{reasonLabel || "Motivo de la reserva"}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe el propósito de la reserva..."
                  rows={3}
                  className="max-h-60"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
