"use client";

import { CopyFormUrl } from "@/components/organisms/admin/copy-form-url";
import {
  FormPicker,
  FormPickerTemplate,
} from "@/components/organisms/admin/form-picker";
import { ImageUpload } from "@/components/molecules/image-upload";
import { MarkdownEditor } from "@/components/molecules/markdown-editor";
import { TimeSelect } from "@/components/molecules/time-select";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EVENT_STATUS_LABELS, EVENT_TYPE_LABELS } from "@/lib/constants/events";
import { EventInput, eventInputSchema } from "@/lib/schemas/events";
import { EventStatus, EventType } from "@/types/prisma";

// ENDED is derived, never chosen by the admin.
const SELECTABLE_STATUSES: EventStatus[] = [
  EventStatus.DRAFT,
  EventStatus.PUBLISHED,
  EventStatus.PAUSED,
];
import { zodResolver } from "@hookform/resolvers/zod";
import { createId } from "@paralleldrive/cuid2";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

// 0 = Sunday .. 6 = Saturday (matches Date.getDay()).
const WEEKDAYS: Array<{ value: string; label: string }> = [
  { value: "1", label: "Lun" },
  { value: "2", label: "Mar" },
  { value: "3", label: "Mié" },
  { value: "4", label: "Jue" },
  { value: "5", label: "Vie" },
  { value: "6", label: "Sáb" },
  { value: "0", label: "Dom" },
];

interface ResourceOption {
  id: string;
  name: string;
  type: string;
  capacity: number;
}

export interface EventFormBindingDefaults {
  templateId: string;
  slug: string;
  opensAt: string;
  closesAt: string;
}

export interface EventFormDefaults {
  name: string;
  description: string;
  eventType: string;
  status: string;
  resourceId: string;
  startDate: string;
  endDate: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  capacity: number | null;
  imageUrl: string | null;
  form: EventFormBindingDefaults | null;
}

const EMPTY_DEFAULTS: EventInput = {
  name: "",
  description: "",
  eventType: EventType.WORKSHOP,
  status: EventStatus.DRAFT,
  resourceId: "",
  startDate: "",
  endDate: "",
  weekdays: [],
  startTime: "10:00",
  endTime: "13:00",
  capacity: null,
  imageUrl: null,
  form: null,
};

interface EventFormProps {
  mode: "create" | "edit";
  eventId?: string;
  defaults?: EventFormDefaults;
}

export function EventForm({ mode, eventId, defaults }: EventFormProps) {
  const router = useRouter();
  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [templates, setTemplates] = useState<FormPickerTemplate[]>([]);

  const form = useForm<EventInput>({
    resolver: zodResolver(eventInputSchema),
    defaultValues: (defaults as EventInput | undefined) ?? EMPTY_DEFAULTS,
  });
  const { control, handleSubmit, watch, getValues, setValue, formState } = form;

  useEffect(() => {
    fetch("/api/admin/resources")
      .then((r) => (r.ok ? r.json() : []))
      .then(setResources)
      .catch(() => setResources([]));
    fetch("/api/admin/forms")
      .then((r) => (r.ok ? r.json() : []))
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  // Picking a template opens the binding section with empty dates; null clears it. The slug
  // (public link key) is generated client-side so the URL is known before saving, and reused
  // while the same template stays selected (switching templates mints a new one).
  const onSelectTemplate = (templateId: string | null) => {
    if (templateId === null) {
      setValue("form", null, { shouldValidate: true });
      return;
    }
    const current = getValues("form");
    setValue(
      "form",
      {
        templateId,
        slug:
          current && current.templateId === templateId
            ? current.slug
            : createId(),
        opensAt: current?.opensAt ?? "",
        closesAt: current?.closesAt ?? "",
      },
      { shouldValidate: true },
    );
  };

  const binding = watch("form");
  const resourceId = watch("resourceId");
  const selectedResource = resources.find((r) => r.id === resourceId);

  const onSubmit = async (values: EventInput) => {
    const res = await fetch(
      mode === "create" ? "/api/admin/events" : `/api/admin/events/${eventId}`,
      {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.message ?? "No se pudo guardar el evento");
      return;
    }
    toast.success(mode === "create" ? "Evento creado" : "Evento actualizado");
    router.push("/admin/events");
    router.refresh();
  };

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="max-w-2xl space-y-6"
        noValidate
      >
        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input placeholder="Ej.: Taller de impresión 3D" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción</FormLabel>
              <FormDescription>
                La ven los participantes. Admite formato (negrita, cursiva,
                listas…).
              </FormDescription>
              <FormControl>
                <MarkdownEditor
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  rows={5}
                  minLength={100}
                  maxLength={2000}
                  placeholder="Contá de qué se trata el evento. Usá la barra de formato para resaltar lo importante."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Imagen (opcional)</FormLabel>
              <FormControl>
                <ImageUpload
                  value={field.value ?? null}
                  onChange={field.onChange}
                  uploadUrl="/api/admin/events/upload"
                  alt={watch("name") || "Imagen del evento"}
                  containerClassName="h-32 w-full max-w-md"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Estado</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SELECTABLE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {EVENT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Publicado: visible con link de inscripción. Pausado: se da de
                baja temporalmente sin borrarlo.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name="eventType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de evento</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="resourceId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Recurso</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Elegí un recurso" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {resources.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} ({r.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Inicio</legend>
            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">
                      Fecha
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">
                      Hora
                    </FormLabel>
                    <FormControl>
                      <TimeSelect
                        value={field.value}
                        onChange={field.onChange}
                        ariaLabel="Hora de inicio"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Fin</legend>
            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">
                      Fecha
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">
                      Hora
                    </FormLabel>
                    <FormControl>
                      <TimeSelect
                        value={field.value}
                        onChange={field.onChange}
                        ariaLabel="Hora de fin"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </fieldset>
        </div>

        <FormField
          control={control}
          name="weekdays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Días de la semana</FormLabel>
              <FormControl>
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  value={field.value.map(String)}
                  onValueChange={(vals) =>
                    field.onChange(vals.map(Number).sort((a, b) => a - b))
                  }
                  className="flex-wrap justify-start"
                >
                  {WEEKDAYS.map((d) => (
                    <ToggleGroupItem key={d.value} value={d.value}>
                      {d.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="capacity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cupo de participantes (opcional)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                  placeholder={
                    selectedResource
                      ? `Por defecto: ${selectedResource.capacity}`
                      : "Por defecto: capacidad del recurso"
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4 rounded-md border p-4">
          <div className="space-y-2">
            <Label>Formulario de inscripción (opcional)</Label>
            <FormPicker
              templates={templates}
              value={binding?.templateId ?? null}
              onSelect={onSelectTemplate}
            />
            <p className="text-sm text-muted-foreground">
              Se crea una copia del formulario para este evento. Editar la
              plantilla más adelante no afecta a los eventos ya creados.
            </p>
          </div>

          {binding && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={control}
                  name="form.opensAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apertura de inscripción</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" lang="es-AR" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="form.closesAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cierre de inscripción</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" lang="es-AR" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {watch("status") === EventStatus.PUBLISHED && (
                <CopyFormUrl slug={binding.slug} />
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/events")}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting
              ? "Guardando..."
              : mode === "create"
                ? "Crear evento"
                : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
