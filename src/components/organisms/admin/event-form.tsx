"use client";

import { CopyFormUrl } from "@/components/organisms/admin/copy-form-url";
import {
  FormPicker,
  FormPickerTemplate,
} from "@/components/organisms/admin/form-picker";
import { DateRangePicker } from "@/components/molecules/date-range-picker";
import { DateTimePicker } from "@/components/molecules/date-time-picker";
import {
  CoverImageHint,
  ImageUpload,
} from "@/components/molecules/image-upload";
import { InlineRichTextInput } from "@/components/molecules/inline-rich-text-input";
import { MarkdownEditor } from "@/components/molecules/markdown-editor";
import { TimeSelect } from "@/components/molecules/time-select";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useApi } from "@/hooks/use-api";
import { ApiError, apiErrorMessage, apiSend } from "@/lib/api/client";
import { EVENT_STATUS_LABELS } from "@/lib/constants/events";
import type {
  ExistingException,
  SessionAction,
} from "@/lib/events/occurrences";
import { EventInput, eventInputSchema } from "@/lib/schemas/events";
import { EventStatus, type ReservationType } from "@/types/prisma";

/** A per-session change the edit would drop (mirrors the API's 409 payload). */
interface DroppedSession {
  date: string; // yyyy-MM-dd
  kind: "cancel" | "reschedule";
  reason: string | null;
}

// ENDED is derived, never chosen by the admin.
const SELECTABLE_STATUSES: EventStatus[] = [
  EventStatus.DRAFT,
  EventStatus.PUBLISHED,
  EventStatus.PAUSED,
];
import { EventSessions } from "@/components/organisms/admin/event-sessions";
import { useServerTime } from "@/components/providers/server-time";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Users } from "lucide-react";
import Link from "next/link";
import { DeleteEventButton } from "@/components/organisms/admin/delete-event-button";
import {
  FormJumpIndex,
  FormPageLayout,
  FormSection,
  StickySaveBar,
} from "@/components/molecules/form-layout";
import {
  UnsavedChangesDialog,
  useUnsavedChangesGuard,
} from "@/hooks/use-unsaved-changes-guard";
import { createId } from "@paralleldrive/cuid2";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { LoadError } from "@/components/molecules/load-error";

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
  summary: string;
  isFeatured: boolean;
  eventType: string;
  status: string;
  spaceId: string;
  startDate: string;
  endDate: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  capacity: number | null;
  requiresApproval: boolean;
  imageUrl: string;
  form: EventFormBindingDefaults | null;
}

/**
 * Ancho de "una columna" de las grillas de 2 columnas del formulario (`sm:grid-cols-2
 * gap-4`): 50% menos medio gap. Los campos sueltos que no ocupan todo el ancho (fechas del
 * evento, cupo) usan esto en vez de un `max-w-*` arbitrario, para que su borde derecho caiga
 * en la misma línea que el de "Tipo de evento" / "Apertura de inscripción". Los controles
 * compuestos (días de la semana, horario) mantienen su ancho intrínseco.
 */
const HALF_COLUMN = "sm:w-[calc(50%-0.5rem)]";

const EMPTY_DEFAULTS: EventInput = {
  name: "",
  description: "",
  summary: "",
  isFeatured: false,
  eventType: "",
  status: EventStatus.DRAFT,
  spaceId: "",
  startDate: "",
  endDate: "",
  weekdays: [],
  startTime: "10:00",
  endTime: "13:00",
  capacity: null,
  requiresApproval: false,
  imageUrl: "",
  form: null,
};

interface EventFormProps {
  mode: "create" | "edit";
  eventId?: string;
  defaults?: EventFormDefaults;
  /** Saved session exceptions (edit mode) — the session editor overlays staged changes on these. */
  existingExceptions?: ExistingException[];
  /** Cantidad de inscriptos (edit): se muestra en el aside de Publicación. */
  participantCount?: number;
  /** Evento cancelado (soft delete): no se muestra la zona de peligro. */
  cancelled?: boolean;
}

export function EventForm({
  mode,
  eventId,
  defaults,
  existingExceptions = [],
  participantCount,
  cancelled = false,
}: EventFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Server-aligned "today" so the date pickers highlight/default to the server clock (faketime).
  const { now, alignRevision } = useServerTime();
  const serverToday = useMemo(
    () => now(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alignRevision],
  );
  // F1.2: these three feed <Select>s. Without surfacing `error`, a failed request gives
  // an EMPTY picker, so the admin concludes there are no resources / no types / no
  // templates rather than that the page failed to load. Reported inline (not thrown)
  // because they are secondary to the form itself — see LoadError's docblock.
  const {
    data: resourcesData,
    error: resourcesError,
    refetch: refetchResources,
  } = useApi<ResourceOption[]>("/api/admin/spaces?reservable=1");
  const resources = useMemo(() => resourcesData ?? [], [resourcesData]);
  const {
    data: typesData,
    error: typesError,
    refetch: refetchTypes,
  } = useApi<ReservationType[]>("/api/reservation-types");
  const reservationTypes = typesData ?? [];
  const {
    data: templatesData,
    error: templatesError,
    refetch: refetchTemplates,
  } = useApi<FormPickerTemplate[]>("/api/admin/forms");
  const templates = templatesData ?? [];
  const loadFailures = [
    resourcesError && {
      label: "los recursos reservables",
      retry: refetchResources,
    },
    typesError && { label: "los tipos de reserva", retry: refetchTypes },
    templatesError && {
      label: "las plantillas de formulario",
      retry: refetchTemplates,
    },
  ].filter(Boolean) as Array<{ label: string; retry: () => Promise<void> }>;
  const [dropWarning, setDropWarning] = useState<{
    dropped: DroppedSession[];
    values: EventInput;
  } | null>(null);
  // La edición dejaría más inscriptos que lugares (milestone-12 D11). Es confirmable, como
  // dropWarning, pero con un flag propio: confirmar una no debe confirmar la otra.
  const [capacityWarning, setCapacityWarning] = useState<{
    registered: number;
    capacity: number;
    values: EventInput;
  } | null>(null);
  // Atajo `?sessions=1` desde la tarjeta del evento: abre la lista de sesiones desplegada.
  const sessionsShortcut =
    mode === "edit" && searchParams.get("sessions") === "1";
  // Staged per-session changes — applied (and emailed) only when the event is saved.
  const [sessionActions, setSessionActions] = useState<SessionAction[]>([]);
  // Single reason shared by all staged cancels/reschedules (asked once, at the end).
  const [sessionReason, setSessionReason] = useState("");

  const form = useForm<EventInput>({
    resolver: zodResolver(eventInputSchema),
    defaultValues: (defaults as EventInput | undefined) ?? EMPTY_DEFAULTS,
  });
  const { control, handleSubmit, watch, getValues, setValue, formState } = form;

  // Cambios sin guardar = campos del formulario o sesiones en staging (milestone 14).
  const isDirty = formState.isDirty || sessionActions.length > 0;
  const guard = useUnsavedChangesGuard(isDirty && !formState.isSubmitting);

  // Picking a template opens the binding section with empty dates; null clears it. The slug
  // (public link key) is generated client-side so the URL is known before saving, and reused
  // while the same template stays selected (switching templates mints a new one).
  const onSelectTemplate = (templateId: string | null) => {
    if (templateId === null) {
      setValue("form", null, { shouldValidate: true, shouldDirty: true });
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
      { shouldValidate: true, shouldDirty: true },
    );
  };

  const binding = watch("form");
  const spaceId = watch("spaceId");
  const selectedResource = resources.find((r) => r.id === spaceId);

  const needsSessionReason = sessionActions.some(
    (a) => a.kind === "cancel" || a.kind === "reschedule",
  );

  const save = async (
    values: EventInput,
    forces: { force?: boolean; forceCapacity?: boolean } = {},
  ): Promise<boolean> => {
    // A batch of cancels/reschedules needs the single shared reason before it can be saved.
    if (mode === "edit" && needsSessionReason && sessionReason.trim() === "") {
      toast.error("Indicá el motivo de los cambios de sesiones");
      document
        .getElementById("sesiones")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return false;
    }
    try {
      await apiSend(
        mode === "create"
          ? "/api/admin/events"
          : `/api/admin/events/${eventId}`,
        mode === "create" ? "POST" : "PUT",
        mode === "create"
          ? values
          : {
              ...values,
              force: forces.force ?? false,
              forceCapacity: forces.forceCapacity ?? false,
              sessionActions,
              sessionReason: sessionReason.trim(),
            },
      );
    } catch (err) {
      // De esta ruta vuelven dos 409 confirmables distintos, así que hay que discriminar por
      // el body y no por el status — tratar todo 409 como el aviso de sesiones mostraría una
      // lista de "se perderán sesiones" vacía cuando en realidad hay sobrecupo.
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as {
          dropped?: DroppedSession[];
          capacityWarning?: { registered: number; capacity: number };
        } | null;
        if (body?.capacityWarning) {
          setCapacityWarning({ ...body.capacityWarning, values });
          return false;
        }
        if (body?.dropped) {
          setDropWarning({ dropped: body.dropped, values });
          return false;
        }
      }
      toast.error(apiErrorMessage(err, "No se pudo guardar el evento"));
      return false;
    }
    setDropWarning(null);
    setCapacityWarning(null);
    setSessionActions([]);
    setSessionReason("");
    toast.success(mode === "create" ? "Evento creado" : "Evento actualizado");
    guard.release();
    router.push("/admin/events");
    router.refresh();
    return true;
  };

  const onSubmit = (values: EventInput) => save(values);

  return (
    <>
      {loadFailures.length > 0 && (
        <div className="mb-4 space-y-2">
          {loadFailures.map((failure) => (
            <LoadError
              key={failure.label}
              message={`No se pudieron cargar ${failure.label}. El selector correspondiente va a aparecer vacío.`}
              onRetry={() => void failure.retry()}
            />
          ))}
        </div>
      )}
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/*
           * Estructura del formulario (milestone 14, propuesta 1): tres secciones con título
           * en la columna principal —Información / Agenda / Inscripción— y un aside de
           * *Publicación* (sticky desde `lg`, último en el teléfono) con la zona de peligro.
           * Antes eran ~20 campos en una sola columna, con los controles de publicación
           * mezclados con los de agenda y los botones recién al final.
           */}
          <FormPageLayout
            main={
              <>
                <FormSection
                  id="informacion"
                  title="Información"
                  description="Lo que ven los participantes en la tarjeta y en el formulario de inscripción."
                >
                  <FormField
                    control={control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej.: Taller de impresión 3D"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Resumen (corto, tarjeta) antes que la Descripción (larga, detalle). */}
                  <FormField
                    control={control}
                    name="summary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Resumen (opcional)</FormLabel>
                        <FormDescription>
                          Texto corto que se muestra en las tarjetas del inicio.
                          Si lo dejás vacío, la tarjeta no muestra descripción.
                        </FormDescription>
                        <FormControl>
                          <InlineRichTextInput
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            rows={2}
                            maxLength={200}
                            placeholder="Ej.: Aprendé a modelar e imprimir tus propias piezas en 3D."
                          />
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
                          La ven los participantes. Admite formato (negrita,
                          cursiva, listas…).
                        </FormDescription>
                        <FormControl>
                          <MarkdownEditor
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            rows={5}
                            minLength={100}
                            maxLength={2000}
                            placeholder="Contá de qué se trata el evento. Usá la barra de formato para resaltar lo importante."
                            uploadUrl={`/api/admin/events/attachment${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ""}`}
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
                        <FormLabel>Imagen</FormLabel>
                        <FormControl>
                          <ImageUpload
                            value={field.value || null}
                            onChange={(url) => field.onChange(url ?? "")}
                            uploadUrl={`/api/admin/events/upload${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ""}`}
                            alt={watch("name") || "Imagen del evento"}
                            hint={<CoverImageHint />}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </FormSection>

                <FormSection
                  id="agenda"
                  title="Agenda"
                  description="Cuándo y dónde: el evento se repite cada semana en los días elegidos."
                >
                  {/* Tipo + Recurso: un par semántico, mismo ancho. */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={control}
                      name="eventType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de evento</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Elegí un tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {reservationTypes.map((t) => (
                                <SelectItem key={t.code} value={t.code}>
                                  {t.name}
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
                      name="spaceId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recurso</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Elegí un recurso" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {resources.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormItem>
                    <FormLabel>Fechas del evento</FormLabel>
                    <div className={HALF_COLUMN}>
                      <DateRangePicker
                        value={{
                          from: watch("startDate"),
                          to: watch("endDate"),
                        }}
                        onChange={(range) => {
                          setValue("startDate", range.from ?? "", {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                          setValue("endDate", range.to ?? "", {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                        }}
                        today={serverToday}
                        ariaLabel="Fechas del evento"
                      />
                    </div>
                    {(formState.errors.startDate ||
                      formState.errors.endDate) && (
                      <p className="text-sm text-destructive">
                        {formState.errors.startDate?.message ??
                          formState.errors.endDate?.message}
                      </p>
                    )}
                  </FormItem>

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
                              field.onChange(
                                vals.map(Number).sort((a, b) => a - b),
                              )
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

                  {/* Horario como una fila "10:00 → 13:00" con dos selects angostos. */}
                  <fieldset className="space-y-2">
                    <legend className="text-sm leading-none font-medium">
                      Horario
                    </legend>
                    <div className="flex flex-wrap items-start gap-2">
                      <FormField
                        control={control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="sr-only">
                              Hora de inicio
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
                      <ArrowRight
                        className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <FormField
                        control={control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="sr-only">
                              Hora de fin
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

                  <EventSessions
                    editable={mode === "edit" && !!eventId}
                    defaultExpanded={sessionsShortcut}
                    recipe={{
                      weekdays: watch("weekdays"),
                      startDate: watch("startDate"),
                      endDate: watch("endDate"),
                      startTime: watch("startTime"),
                      endTime: watch("endTime"),
                    }}
                    existing={existingExceptions}
                    actions={sessionActions}
                    onActionsChange={setSessionActions}
                    reason={sessionReason}
                    onReasonChange={setSessionReason}
                  />
                </FormSection>

                <FormSection
                  id="inscripcion"
                  title="Inscripción"
                  description="Cómo se anotan los participantes y cuántos lugares hay."
                >
                  <div className="space-y-2">
                    <Label>Formulario de inscripción (opcional)</Label>
                    <FormPicker
                      templates={templates}
                      value={binding?.templateId ?? null}
                      onSelect={onSelectTemplate}
                    />
                    <p className="text-sm text-muted-foreground">
                      Se crea una copia del formulario para este evento. Editar
                      la plantilla más adelante no afecta a los eventos ya
                      creados.
                    </p>
                  </div>

                  {binding && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={control}
                        name="form.opensAt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Apertura de inscripción</FormLabel>
                            <FormControl>
                              <DateTimePicker
                                value={field.value ?? ""}
                                onChange={field.onChange}
                                today={serverToday}
                                defaultTime="09:00"
                                ariaLabel="Apertura de inscripción"
                              />
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
                              <DateTimePicker
                                value={field.value ?? ""}
                                onChange={field.onChange}
                                today={serverToday}
                                defaultTime="18:00"
                                ariaLabel="Cierre de inscripción"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <FormField
                    control={control}
                    name="capacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cupo de participantes (opcional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            className={HALF_COLUMN}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                              )
                            }
                            placeholder={
                              selectedResource
                                ? `Por defecto: ${selectedResource.capacity}`
                                : "Por defecto: capacidad"
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          Si lo dejás vacío, el cupo es la capacidad del
                          recurso.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="requiresApproval"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-4 space-y-0 rounded-md border p-4">
                        <div className="space-y-1">
                          <FormLabel>Requiere aprobación</FormLabel>
                          <FormDescription>
                            Las inscripciones quedan pendientes hasta que las
                            apruebes o rechaces. El cupo limita cuántas personas
                            pueden inscribirse (los aprobados pueden ser menos).
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
                </FormSection>
              </>
            }
            aside={
              <>
                <FormJumpIndex
                  sections={[
                    { id: "informacion", label: "Información" },
                    { id: "agenda", label: "Agenda" },
                    { id: "inscripcion", label: "Inscripción" },
                    { id: "publicacion", label: "Publicación" },
                  ]}
                />
                <FormSection
                  id="publicacion"
                  title="Publicación"
                  description="Quién lo ve y cómo aparece en el inicio."
                >
                  <FormField
                    control={control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
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
                            {SELECTABLE_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {EVENT_STATUS_LABELS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Publicado: visible con link de inscripción. Pausado:
                          se da de baja temporalmente sin borrarlo.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="isFeatured"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-4 space-y-0">
                        <div className="space-y-1">
                          <FormLabel>Destacar en el inicio</FormLabel>
                          <FormDescription>
                            Encabeza la sección de eventos. El orden entre
                            destacados se cambia desde la lista.
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

                  {binding && watch("status") === EventStatus.PUBLISHED && (
                    <CopyFormUrl slug={binding.slug} />
                  )}

                  {mode === "edit" && eventId && (
                    <Button asChild variant="outline" className="w-full">
                      <Link href={`/admin/events/${eventId}/participants`}>
                        <Users className="h-4 w-4" />
                        Participantes ({participantCount ?? 0})
                      </Link>
                    </Button>
                  )}
                </FormSection>

                {mode === "edit" && eventId && !cancelled && (
                  <FormSection
                    title="Zona de peligro"
                    description="Cancela el evento: libera el recurso y cierra las inscripciones. Los inscriptos quedan registrados."
                    tone="danger"
                  >
                    <DeleteEventButton id={eventId} onDone={guard.release} />
                  </FormSection>
                )}
              </>
            }
          />

          <StickySaveBar dirty={isDirty}>
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
          </StickySaveBar>
        </form>
      </Form>

      <UnsavedChangesDialog guard={guard} />

      <ResponsiveDialog
        open={dropWarning !== null}
        onOpenChange={(o) => !o && setDropWarning(null)}
      >
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              Se perderán cambios de sesiones
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Con estas fechas, las siguientes sesiones modificadas dejarán de
              existir. Si continuás, se eliminarán.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
            {dropWarning?.dropped.map((d, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="font-medium">{formatDropDate(d.date)}</span>
                <span className="text-muted-foreground">
                  · {d.kind === "cancel" ? "cancelada" : "reprogramada"}
                  {d.reason ? ` — ${d.reason}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDropWarning(null)}
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (dropWarning) save(dropWarning.values, { force: true });
              }}
            >
              Continuar y eliminar
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={capacityWarning !== null}
        onOpenChange={(o) => !o && setCapacityWarning(null)}
      >
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              El cupo queda por debajo de los inscriptos
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Hay {capacityWarning?.registered} inscriptos y el nuevo cupo es{" "}
              {capacityWarning?.capacity}. Nadie se da de baja automáticamente:
              si continuás, quedan{" "}
              {Math.max(
                0,
                (capacityWarning?.registered ?? 0) -
                  (capacityWarning?.capacity ?? 0),
              )}{" "}
              inscriptos por encima del cupo y vas a tener que resolverlo desde
              la lista de inscriptos.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCapacityWarning(null)}
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (capacityWarning)
                  save(capacityWarning.values, { forceCapacity: true });
              }}
            >
              Guardar igual
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}

/** yyyy-MM-dd → dd/mm/yyyy for the drop-warning list. */
function formatDropDate(key: string): string {
  const [y, m, d] = key.split("-");
  return y && m && d ? `${d}/${m}/${y}` : key;
}
