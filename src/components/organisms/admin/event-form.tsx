"use client";

import { CopyFormUrl } from "@/components/organisms/admin/copy-form-url";
import {
  FormPicker,
  FormPickerTemplate,
} from "@/components/organisms/admin/form-picker";
import { DateRangePicker } from "@/components/molecules/date-range-picker";
import { DateTimePicker } from "@/components/molecules/date-time-picker";
import { ImageUpload } from "@/components/molecules/image-upload";
import { MarkdownEditor } from "@/components/molecules/markdown-editor";
import { TimeSelect } from "@/components/molecules/time-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
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
import { CalendarCog } from "lucide-react";
import { createId } from "@paralleldrive/cuid2";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
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
  featuredOrder: number;
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
  imageUrl: string | null;
  form: EventFormBindingDefaults | null;
}

const EMPTY_DEFAULTS: EventInput = {
  name: "",
  description: "",
  summary: "",
  isFeatured: false,
  featuredOrder: 0,
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
  imageUrl: null,
  form: null,
};

interface EventFormProps {
  mode: "create" | "edit";
  eventId?: string;
  defaults?: EventFormDefaults;
  /** Saved session exceptions (edit mode) — the session editor overlays staged changes on these. */
  existingExceptions?: ExistingException[];
}

export function EventForm({
  mode,
  eventId,
  defaults,
  existingExceptions = [],
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
  const { data: resourcesData } = useApi<ResourceOption[]>(
    "/api/admin/spaces?reservable=1",
  );
  const resources = useMemo(() => resourcesData ?? [], [resourcesData]);
  const { data: typesData } = useApi<ReservationType[]>(
    "/api/reservation-types",
  );
  const reservationTypes = typesData ?? [];
  const { data: templatesData } =
    useApi<FormPickerTemplate[]>("/api/admin/forms");
  const templates = templatesData ?? [];
  const [dropWarning, setDropWarning] = useState<{
    dropped: DroppedSession[];
    values: EventInput;
  } | null>(null);
  // Opened via the ?sessions=1 shortcut (from the admin card) or the "Sesiones" button.
  const [sessionsOpen, setSessionsOpen] = useState(
    mode === "edit" && searchParams.get("sessions") === "1",
  );
  // Staged per-session changes — applied (and emailed) only when the event is saved.
  const [sessionActions, setSessionActions] = useState<SessionAction[]>([]);
  // Single reason shared by all staged cancels/reschedules (asked once, at the end).
  const [sessionReason, setSessionReason] = useState("");

  const form = useForm<EventInput>({
    resolver: zodResolver(eventInputSchema),
    defaultValues: (defaults as EventInput | undefined) ?? EMPTY_DEFAULTS,
  });
  const { control, handleSubmit, watch, getValues, setValue, formState } = form;

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

  const save = async (values: EventInput, force: boolean): Promise<boolean> => {
    // A batch of cancels/reschedules needs the single shared reason before it can be saved.
    if (mode === "edit" && needsSessionReason && sessionReason.trim() === "") {
      toast.error("Indicá el motivo de los cambios de sesiones");
      setSessionsOpen(true);
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
              force,
              sessionActions,
              sessionReason: sessionReason.trim(),
            },
      );
    } catch (err) {
      // The edit would drop per-session changes → confirm before forcing.
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as { dropped?: DroppedSession[] } | null;
        setDropWarning({ dropped: body?.dropped ?? [], values });
        return false;
      }
      toast.error(apiErrorMessage(err, "No se pudo guardar el evento"));
      return false;
    }
    setDropWarning(null);
    setSessionActions([]);
    setSessionReason("");
    toast.success(mode === "create" ? "Evento creado" : "Evento actualizado");
    router.push("/admin/events");
    router.refresh();
    return true;
  };

  const onSubmit = (values: EventInput) => save(values, false);

  return (
    <>
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
                    uploadUrl={`/api/admin/events/attachment${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ""}`}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="summary"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Resumen (opcional)</FormLabel>
                <FormDescription>
                  Texto corto que se muestra en las tarjetas del inicio. Sin
                  formato. Si lo dejás vacío, la tarjeta no muestra descripción.
                </FormDescription>
                <FormControl>
                  <Textarea
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
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
            name="imageUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Imagen (opcional)</FormLabel>
                <FormControl>
                  <ImageUpload
                    value={field.value ?? null}
                    onChange={field.onChange}
                    uploadUrl={`/api/admin/events/upload${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ""}`}
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

          <div className="space-y-4 rounded-md border p-4">
            <FormField
              control={control}
              name="isFeatured"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4 space-y-0">
                  <div className="space-y-1">
                    <FormLabel>Destacar en el inicio</FormLabel>
                    <FormDescription>
                      Los eventos destacados encabezan la sección de eventos con
                      mayor protagonismo.
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

            {watch("isFeatured") && (
              <FormField
                control={control}
                name="featuredOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Orden entre destacados</FormLabel>
                    <FormDescription>
                      Menor número aparece primero (0, 1, 2…).
                    </FormDescription>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value ?? 0}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? 0 : Number(e.target.value),
                          )
                        }
                        className="max-w-32"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

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
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
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
            <DateRangePicker
              value={{ from: watch("startDate"), to: watch("endDate") }}
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
            {(formState.errors.startDate || formState.errors.endDate) && (
              <p className="text-sm text-destructive">
                {formState.errors.startDate?.message ??
                  formState.errors.endDate?.message}
              </p>
            )}
            <FormDescription>
              El evento se repite cada semana en los días elegidos, dentro de
              este rango.
            </FormDescription>
          </FormItem>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hora de inicio</FormLabel>
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
            <FormField
              control={control}
              name="endTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hora de fin</FormLabel>
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

          <FormField
            control={control}
            name="requiresApproval"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-4 space-y-0 rounded-md border p-4">
                <div className="space-y-1">
                  <FormLabel>Requiere aprobación</FormLabel>
                  <FormDescription>
                    Las inscripciones quedan pendientes hasta que las apruebes o
                    rechaces. El cupo limita cuántas personas pueden inscribirse
                    (los aprobados pueden ser menos).
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

                {watch("status") === EventStatus.PUBLISHED && (
                  <CopyFormUrl slug={binding.slug} />
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/events")}
            >
              Cancelar
            </Button>
            {mode === "edit" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setSessionsOpen(true)}
                disabled={formState.isSubmitting}
              >
                <CalendarCog className="h-4 w-4" />
                Sesiones
                {sessionActions.length > 0 && ` (${sessionActions.length})`}
              </Button>
            )}
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

      {mode === "edit" && eventId && (
        <EventSessions
          open={sessionsOpen}
          onOpenChange={setSessionsOpen}
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
      )}

      <Dialog
        open={dropWarning !== null}
        onOpenChange={(o) => !o && setDropWarning(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Se perderán cambios de sesiones</DialogTitle>
            <DialogDescription>
              Con estas fechas, las siguientes sesiones modificadas dejarán de
              existir. Si continuás, se eliminarán.
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
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
                if (dropWarning) save(dropWarning.values, true);
              }}
            >
              Continuar y eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** yyyy-MM-dd → dd/mm/yyyy for the drop-warning list. */
function formatDropDate(key: string): string {
  const [y, m, d] = key.split("-");
  return y && m && d ? `${d}/${m}/${y}` : key;
}
