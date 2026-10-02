"use client";

/**
 * Formulario de tema del landing **como página** (milestone 14, propuesta 4): antes era un
 * diálogo largo (~12 campos, con cantidad y emojis condicionales) que en el teléfono no
 * entraba. Vive en `/admin/themes/new` y `/admin/themes/[id]/edit`.
 *
 * Secciones: *Básico* (nombre, habilitado) · *Cuándo* (se repite todos los años → selector de
 * mes + día en vez de "MM-DD" tipeado; si no, rango de fechas) · *Efecto* (emojis y cantidad
 * solo si hay lluvia de emojis) · *Texto* (línea sobre el título, palabras de la rotación).
 * La **prioridad** ya no es un campo: es el orden de la lista (modo "Reordenar"). Un tema
 * nuevo queda con prioridad 0, abajo de la lista.
 */

import { DateRangePicker } from "@/components/molecules/date-range-picker";
import {
  FormPageLayout,
  FormSection,
  StickySaveBar,
} from "@/components/molecules/form-layout";
import { MonthDayPicker } from "@/components/molecules/month-day-picker";
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
import { endOfDateKeyMs, startOfDateKeyMs } from "@/lib/admin/admin-timezone";
import { EMPTY_LANDING_THEME } from "@/lib/landing-themes/form-values";
import {
  landingThemeInputSchema,
  type LandingThemeInput,
} from "@/lib/schemas/config";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const LIST_URL = "/admin/themes";

/** "yyyy-MM-dd" key (DateRangePicker's format) from a ms timestamp, or undefined. */
function msToDateKey(ms: number | null | undefined): string | undefined {
  if (ms == null) return undefined;
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function LandingThemeForm({
  themeId,
  defaultValues = EMPTY_LANDING_THEME,
}: {
  /** Id del tema al editar; ausente al crear. */
  themeId?: string;
  defaultValues?: LandingThemeInput;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const form = useForm<LandingThemeInput>({
    resolver: zodResolver(landingThemeInputSchema),
    defaultValues,
  });
  const recurring = form.watch("recurring");
  const entranceEffect = form.watch("entranceEffect");
  const guard = useUnsavedChangesGuard(form.formState.isDirty && !busy);

  const onSubmit = async (values: LandingThemeInput) => {
    setBusy(true);
    try {
      if (themeId) {
        await apiSend(`/api/admin/themes/${themeId}`, "PUT", values);
        toast.success("Tema actualizado");
      } else {
        await apiSend("/api/admin/themes", "POST", values);
        toast.success("Tema creado");
      }
      invalidateApi("/api/admin/themes");
      guard.release();
      router.push(LIST_URL);
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo guardar el tema"));
      setBusy(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl">
        <FormPageLayout
          main={
            <>
              <FormSection
                id="basico"
                title="Básico"
                description="Cómo se llama el tema y si está activo."
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Aniversario" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                      <FormLabel className="mb-0">Habilitado</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </FormSection>

              <FormSection
                id="cuando"
                title="Cuándo"
                description="La ventana de fechas en la que la portada muestra el tema."
              >
                <FormField
                  control={form.control}
                  name="recurring"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                      <div>
                        <FormLabel className="mb-0">
                          Se repite todos los años
                        </FormLabel>
                        <FormDescription>
                          Ej: aniversario, fin de año. Si no, elegí un rango de
                          fechas puntual.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {recurring ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {(
                      [
                        ["startMonthDay", "Desde"],
                        ["endMonthDay", "Hasta"],
                      ] as const
                    ).map(([fieldName, label]) => (
                      <FormField
                        key={fieldName}
                        control={form.control}
                        name={fieldName}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{label}</FormLabel>
                            <FormControl>
                              <MonthDayPicker
                                value={field.value ?? ""}
                                onChange={field.onChange}
                                ariaLabel={label}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                ) : (
                  <FormItem>
                    <FormLabel>Rango de fechas</FormLabel>
                    <DateRangePicker
                      value={{
                        from: msToDateKey(form.watch("startDate")),
                        to: msToDateKey(form.watch("endDate")),
                      }}
                      onChange={(range) => {
                        form.setValue(
                          "startDate",
                          range.from ? startOfDateKeyMs(range.from) : null,
                          { shouldValidate: true },
                        );
                        form.setValue(
                          "endDate",
                          range.to ? endOfDateKeyMs(range.to) : null,
                          { shouldValidate: true },
                        );
                      }}
                      clearable
                    />
                    <FormMessage>
                      {form.formState.errors.startDate?.message ??
                        form.formState.errors.endDate?.message}
                    </FormMessage>
                  </FormItem>
                )}
              </FormSection>

              <FormSection
                id="efecto"
                title="Efecto"
                description="Una animación breve al entrar a la portada."
              >
                <FormField
                  control={form.control}
                  name="entranceEffect"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Efecto al entrar</FormLabel>
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
                          <SelectItem value="NONE">Ninguno</SelectItem>
                          <SelectItem value="EMOJI_SHOWER">
                            Lluvia de emojis
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Se muestra una vez por visitante por día, mientras el
                        tema esté activo.
                      </FormDescription>
                    </FormItem>
                  )}
                />
                {entranceEffect === "EMOJI_SHOWER" ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
                    <FormField
                      control={form.control}
                      name="emojiList"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Emojis</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="🎉 🎊 🥳"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormDescription>
                            Separados por espacio.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="particleCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cantidad</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={5}
                              max={150}
                              value={field.value ?? 40}
                              onChange={(e) =>
                                field.onChange(
                                  Number.isNaN(e.target.valueAsNumber)
                                    ? 40
                                    : e.target.valueAsNumber,
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ) : null}
              </FormSection>

              <FormSection
                id="texto"
                title="Texto"
                description="Cambios en el encabezado del inicio mientras el tema está activo."
              >
                <FormField
                  control={form.control}
                  name="heroEyebrowOverride"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Línea sobre el título (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="🎉 Celebrando nuestro aniversario"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Reemplaza &ldquo;Una iniciativa de Concepción del
                        Uruguay&rdquo; mientras el tema esté activo.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="heroKeywords"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Palabras para la rotación del título (opcional)
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="10 años, celebración, fiesta"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Separadas por coma. Se combinan con la rotación de
                        &ldquo;un espacio de …&rdquo; del inicio según la opción
                        de abajo.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="heroKeywordsMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cómo combinarlas</FormLabel>
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
                          <SelectItem value="APPEND">
                            Agregar a las palabras habituales
                          </SelectItem>
                          <SelectItem value="REPLACE">
                            Reemplazar las palabras habituales
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        &ldquo;Reemplazar&rdquo; solo aplica mientras el tema
                        esté activo; después vuelven las palabras de siempre.
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </FormSection>
            </>
          }
        />

        <StickySaveBar dirty={form.formState.isDirty} className="mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(LIST_URL)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {themeId ? "Guardar cambios" : "Crear tema"}
          </Button>
        </StickySaveBar>
      </form>
      <UnsavedChangesDialog guard={guard} />
    </Form>
  );
}
