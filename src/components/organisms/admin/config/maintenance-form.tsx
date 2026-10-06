"use client";

/**
 * Formulario de mantenimiento **como página** (milestone 22), en `/admin/maintenance/new` y
 * `/admin/maintenance/[id]/edit`. Es una página y no un diálogo porque lleva un editor
 * markdown y varios selectores (regla del proyecto, milestone 14).
 *
 * Secciones: *Qué* (atajos, título, motivo) · *Alcance* (áreas y qué significa para ellas) ·
 * *Cuándo* (desde ahora o programado; sin fin previsto o con fin). El aside muestra la vista
 * previa del aviso tal como lo van a ver los usuarios.
 */

import { DateTimePicker } from "@/components/molecules/date-time-picker";
import {
  FormPageLayout,
  FormSection,
  StickySaveBar,
} from "@/components/molecules/form-layout";
import { MarkdownEditor } from "@/components/molecules/markdown-editor";
import { MaintenanceMessage } from "@/components/organisms/maintenance/maintenance-banner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import {
  UnsavedChangesDialog,
  useUnsavedChangesGuard,
} from "@/hooks/use-unsaved-changes-guard";
import { apiErrorMessage, apiSend, invalidateApi } from "@/lib/api/client";
import { dateTimeLocalToMs, msToDateTimeLocal } from "@/lib/events/datetime";
import {
  ALL_AREA,
  MAINTENANCE_AREAS,
  MAINTENANCE_AREA_IDS,
  MAINTENANCE_MODES,
  MAINTENANCE_MODE_DESCRIPTIONS,
  MAINTENANCE_MODE_LABELS,
} from "@/lib/maintenance/areas";
import { MAINTENANCE_PRESETS } from "@/lib/maintenance/presets";
import {
  maintenanceInputSchema,
  type MaintenanceInput,
} from "@/lib/schemas/maintenance";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const LIST_URL = "/admin/maintenance";

const EMPTY: MaintenanceInput = {
  title: "",
  reasonMd: "",
  mode: "NOTICE",
  areas: [],
  startsAt: null,
  endsAt: null,
};

export function MaintenanceForm({
  windowId,
  defaultValues = EMPTY,
}: {
  /** Id de la ventana al editar; ausente al crear. */
  windowId?: string;
  defaultValues?: MaintenanceInput;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const form = useForm<MaintenanceInput>({
    resolver: zodResolver(maintenanceInputSchema),
    defaultValues,
  });
  const guard = useUnsavedChangesGuard(form.formState.isDirty && !busy);

  const values = form.watch();
  const globalSelected = values.areas.includes(ALL_AREA);
  // Los toggles de "programar inicio" / "tiene fin" se derivan de los valores: apagarlos
  // vuelve el extremo a "nulo" (rige ya / sin fin previsto).
  const scheduledStart = values.startsAt != null;
  const hasEnd = values.endsAt != null;

  const applyPreset = (id: string) => {
    const preset = MAINTENANCE_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    form.reset(
      { ...form.getValues(), ...preset.values },
      { keepDefaultValues: true },
    );
    // `reset` limpia `isDirty`; el atajo sí es un cambio que no hay que perder.
    form.setValue("title", preset.values.title, { shouldDirty: true });
  };

  const toggleArea = (id: string, checked: boolean) => {
    const current = form.getValues("areas");
    let next = checked ? [...current, id] : current.filter((a) => a !== id);
    // «Todo el sitio» no admite «No disponible» (ver el esquema): se baja a solo lectura.
    if (
      id === ALL_AREA &&
      checked &&
      form.getValues("mode") === "UNAVAILABLE"
    ) {
      form.setValue("mode", "READ_ONLY", { shouldDirty: true });
    }
    next = Array.from(new Set(next));
    form.setValue("areas", next, { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = async (input: MaintenanceInput) => {
    setBusy(true);
    try {
      if (windowId) {
        await apiSend(`/api/admin/maintenance/${windowId}`, "PUT", input);
        toast.success("Mantenimiento actualizado");
      } else {
        await apiSend("/api/admin/maintenance", "POST", input);
        toast.success("Mantenimiento declarado");
      }
      invalidateApi("/api/admin/maintenance");
      invalidateApi("/api/maintenance");
      guard.release();
      router.push(LIST_URL);
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo guardar el mantenimiento"));
      setBusy(false);
    }
  };

  // Vista previa: la misma pieza que ve el público, con lo que hay escrito hasta ahora.
  const preview = {
    id: "preview",
    title: values.title || "Título del aviso",
    reasonMd: values.reasonMd || "El motivo aparece acá.",
    mode: values.mode,
    areas: values.areas,
    startsAt: values.startsAt,
    endsAt: values.endsAt,
    endedAt: null,
    state:
      values.startsAt != null && values.startsAt > Date.now()
        ? ("scheduled" as const)
        : ("active" as const),
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormPageLayout
          className="max-w-5xl"
          main={
            <>
              <FormSection
                id="que"
                title="Qué"
                description="El título y el motivo que van a leer los usuarios."
              >
                {!windowId && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Empezar desde un atajo
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {MAINTENANCE_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => applyPreset(p.id)}
                          className="rounded-md border p-3 text-left text-sm transition-colors hover:bg-muted"
                        >
                          <span className="block font-medium">{p.label}</span>
                          <span className="block text-xs text-muted-foreground">
                            {p.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input placeholder="Migración de servidor" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reasonMd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motivo para los usuarios</FormLabel>
                      <FormControl>
                        <MarkdownEditor
                          value={field.value}
                          onChange={field.onChange}
                          rows={8}
                          breaks
                          minLength={10}
                          maxLength={4000}
                          placeholder="Qué está pasando, qué se puede y qué no, y cuándo volvemos."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSection>

              <FormSection
                id="alcance"
                title="Alcance"
                description="Qué se ve afectado y qué significa para esas áreas."
              >
                <FormField
                  control={form.control}
                  name="mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qué implica</FormLabel>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {MAINTENANCE_MODES.map((m) => {
                          const disabled =
                            m === "UNAVAILABLE" && globalSelected;
                          return (
                            <button
                              key={m}
                              type="button"
                              disabled={disabled}
                              aria-pressed={field.value === m}
                              onClick={() => field.onChange(m)}
                              className={cn(
                                "rounded-md border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                                field.value === m
                                  ? "border-la-nube-selected bg-la-nube-accent/40 dark:bg-la-nube-selected/20"
                                  : "hover:bg-muted",
                              )}
                            >
                              <span className="block font-medium">
                                {MAINTENANCE_MODE_LABELS[m]}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {MAINTENANCE_MODE_DESCRIPTIONS[m]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="areas"
                  render={() => (
                    <FormItem>
                      <FormLabel>Áreas</FormLabel>
                      <div className="space-y-2">
                        {MAINTENANCE_AREA_IDS.map((id) => {
                          const area = MAINTENANCE_AREAS[id];
                          const checked = values.areas.includes(id);
                          return (
                            <label
                              key={id}
                              className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(c) =>
                                  toggleArea(id, c === true)
                                }
                                className="mt-0.5"
                              />
                              <span className="space-y-0.5 text-sm">
                                <span className="block font-medium">
                                  {area.label}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  {area.description}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSection>

              <FormSection
                id="cuando"
                title="Cuándo"
                description="Por defecto rige desde que se guarda y hasta que lo finalizás a mano."
              >
                <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                  <div>
                    <FormLabel className="mb-0">Programar el inicio</FormLabel>
                    <FormDescription>
                      Hasta entonces solo se anuncia (hasta 7 días antes).
                    </FormDescription>
                  </div>
                  <Switch
                    checked={scheduledStart}
                    onCheckedChange={(on) =>
                      form.setValue(
                        "startsAt",
                        on ? Date.now() + 60 * 60 * 1000 : null,
                        { shouldDirty: true, shouldValidate: true },
                      )
                    }
                  />
                </FormItem>
                {scheduledStart && (
                  <FormField
                    control={form.control}
                    name="startsAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inicio</FormLabel>
                        <FormControl>
                          <DateTimePicker
                            value={
                              field.value == null
                                ? ""
                                : msToDateTimeLocal(field.value)
                            }
                            onChange={(v) =>
                              field.onChange(v ? dateTimeLocalToMs(v) : null)
                            }
                            ariaLabel="Inicio del mantenimiento"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                  <div>
                    <FormLabel className="mb-0">
                      Tiene un fin previsto
                    </FormLabel>
                    <FormDescription>
                      Si no, queda vigente hasta que lo finalices.
                    </FormDescription>
                  </div>
                  <Switch
                    checked={hasEnd}
                    onCheckedChange={(on) =>
                      form.setValue(
                        "endsAt",
                        on
                          ? (values.startsAt ?? Date.now()) + 2 * 60 * 60 * 1000
                          : null,
                        { shouldDirty: true, shouldValidate: true },
                      )
                    }
                  />
                </FormItem>
                {hasEnd && (
                  <FormField
                    control={form.control}
                    name="endsAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fin</FormLabel>
                        <FormControl>
                          <DateTimePicker
                            value={
                              field.value == null
                                ? ""
                                : msToDateTimeLocal(field.value)
                            }
                            onChange={(v) =>
                              field.onChange(v ? dateTimeLocalToMs(v) : null)
                            }
                            ariaLabel="Fin del mantenimiento"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </FormSection>
            </>
          }
          aside={
            <div className="space-y-2">
              <p className="text-sm font-medium">Así lo ven los usuarios</p>
              <MaintenanceMessage window={preview} />
            </div>
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
            {windowId ? "Guardar cambios" : "Declarar mantenimiento"}
          </Button>
        </StickySaveBar>
      </form>
      <UnsavedChangesDialog guard={guard} />
    </Form>
  );
}
