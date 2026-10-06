"use client";

/**
 * Alta y edición de un día cerrado **como página** (milestone 23): rango de fechas + motivo +
 * franja horaria opcional. Es página y no diálogo porque, además de los campos, la edición
 * mostrará las reservas que el cierre afecta (slice 6) — fuera del criterio de «≤ ~4 campos
 * simples» del milestone 14.
 *
 * Los horarios se editan como `HH:MM` en pasos de 15 minutos (los buckets del ledger) y viajan
 * como minutos desde la medianoche; «Todo el día» los deja en `null`. El origen no se elige al
 * editar (un feriado nacional sigue siéndolo aunque se renombre).
 */

import { DateRangePicker } from "@/components/molecules/date-range-picker";
import {
  FormPageLayout,
  FormSection,
  StickySaveBar,
} from "@/components/molecules/form-layout";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  UnsavedChangesDialog,
  useUnsavedChangesGuard,
} from "@/hooks/use-unsaved-changes-guard";
import { apiErrorMessage, apiSend, invalidateApi } from "@/lib/api/client";
import { formatMinutes } from "@/lib/closed-days/closures";
import { CLOSED_DAY_SOURCE_LABELS } from "@/lib/constants/closed-days";
import {
  closedDayInputSchema,
  type ClosedDayInput,
} from "@/lib/schemas/closed-days";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const LIST_URL = "/admin/closed-days";

/** Franja que se propone al apagar «Todo el día»: la tarde, el caso más común. */
const DEFAULT_PARTIAL = { startTime: 14 * 60, endTime: 18 * 60 };

/** `"14:30"` → `870`; `null` si el campo está vacío o incompleto. */
function parseTime(value: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function ClosedDayForm({
  closedDayId,
  defaultValues,
  sourceLabel,
  today,
}: {
  /** Id al editar; ausente al crear. */
  closedDayId?: string;
  defaultValues: ClosedDayInput;
  /** Al editar: el origen del registro, solo informativo. */
  sourceLabel?: string;
  /** `YYYY-MM-DD` de hoy según el servidor, para que el calendario respete faketime. */
  today: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const form = useForm<ClosedDayInput>({
    resolver: zodResolver(closedDayInputSchema),
    defaultValues,
  });
  const fullDay = form.watch("startTime") === null;
  const guard = useUnsavedChangesGuard(form.formState.isDirty && !busy);
  const [y, m, d] = today.split("-").map(Number);

  const onSubmit = async (values: ClosedDayInput) => {
    setBusy(true);
    try {
      const saved = closedDayId
        ? await apiSend<{ id: string; affectedCount: number }>(
            `/api/admin/closed-days/${closedDayId}`,
            "PUT",
            values,
          )
        : await apiSend<{ id: string; affectedCount: number }>(
            "/api/admin/closed-days",
            "POST",
            values,
          );
      toast.success(
        closedDayId ? "Día cerrado actualizado" : "Día cerrado cargado",
      );
      invalidateApi("/api/admin/closed-days");
      guard.release();
      if (saved.affectedCount > 0) {
        // Un cierre no cancela nada solo: se lleva al admin a la lista de lo que quedó en
        // conflicto (la misma página de edición) en lugar de dejarlo olvidado.
        toast.warning(
          saved.affectedCount === 1
            ? "Hay 1 reserva o evento afectado: revisalo."
            : `Hay ${saved.affectedCount} reservas o eventos afectados: revisalos.`,
        );
        router.push(`${LIST_URL}/${saved.id}/edit`);
      } else {
        router.push(LIST_URL);
      }
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo guardar el día cerrado"));
      setBusy(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormPageLayout
          className="max-w-3xl"
          main={
            <>
              <FormSection
                id="motivo"
                title="Motivo"
                description="Es lo que ven los usuarios en el calendario y al intentar reservar."
              >
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motivo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Vacaciones de invierno"
                          maxLength={100}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {!closedDayId ? (
                  <FormField
                    control={form.control}
                    name="source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de cierre</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="MANUAL_HOLIDAY">
                              {CLOSED_DAY_SOURCE_LABELS.MANUAL_HOLIDAY}
                            </SelectItem>
                            <SelectItem value="MANUAL_OTHER">
                              {CLOSED_DAY_SOURCE_LABELS.MANUAL_OTHER}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Los feriados nacionales los propone la sincronización;
                          acá se cargan los de la ciudad, las vacaciones y
                          cualquier otro cierre.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                ) : sourceLabel ? (
                  <p className="text-sm text-muted-foreground">
                    Origen: {sourceLabel}
                  </p>
                ) : null}
              </FormSection>

              <FormSection
                id="cuando"
                title="Cuándo"
                description="Un día o un rango de fechas, y si cierra todo el día o solo unas horas."
              >
                <FormField
                  control={form.control}
                  name="startDate"
                  render={() => (
                    <FormItem>
                      <FormLabel>Fechas</FormLabel>
                      <DateRangePicker
                        value={{
                          from: form.watch("startDate"),
                          to: form.watch("endDate"),
                        }}
                        onChange={(range) => {
                          const from =
                            range.from ?? form.getValues("startDate");
                          form.setValue("startDate", from, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          form.setValue("endDate", range.to ?? from, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
                        today={new Date(y, m - 1, d)}
                        ariaLabel="Fechas del cierre"
                      />
                      <FormDescription>
                        Para un solo día, elegí esa fecha dos veces.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {form.formState.errors.endDate?.message ? (
                  <p
                    role="alert"
                    className="text-sm font-medium text-destructive"
                  >
                    {form.formState.errors.endDate.message}
                  </p>
                ) : null}

                <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="closed-day-full-day">Todo el día</Label>
                    <p className="text-sm text-muted-foreground">
                      Apagalo para cerrar solo en un horario (por ejemplo, un
                      turno sin cubrir).
                    </p>
                  </div>
                  <Switch
                    id="closed-day-full-day"
                    checked={fullDay}
                    onCheckedChange={(checked) => {
                      const next = checked
                        ? { startTime: null, endTime: null }
                        : DEFAULT_PARTIAL;
                      form.setValue("startTime", next.startTime, {
                        shouldDirty: true,
                      });
                      form.setValue("endTime", next.endTime, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                  />
                </div>

                {!fullDay ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Desde</FormLabel>
                          <FormControl>
                            <Input
                              type="time"
                              step={900}
                              value={
                                field.value === null
                                  ? ""
                                  : formatMinutes(field.value)
                              }
                              onChange={(e) =>
                                field.onChange(parseTime(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="endTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hasta</FormLabel>
                          <FormControl>
                            <Input
                              type="time"
                              step={900}
                              value={
                                field.value === null
                                  ? ""
                                  : formatMinutes(field.value)
                              }
                              onChange={(e) =>
                                field.onChange(parseTime(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <p className="text-sm text-muted-foreground sm:col-span-2">
                      El horario se aplica a cada día del rango elegido.
                    </p>
                  </div>
                ) : null}
              </FormSection>
            </>
          }
        />

        <StickySaveBar dirty={form.formState.isDirty}>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(LIST_URL)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {closedDayId ? "Guardar cambios" : "Cargar día cerrado"}
          </Button>
        </StickySaveBar>
      </form>
      <UnsavedChangesDialog guard={guard} />
    </Form>
  );
}
