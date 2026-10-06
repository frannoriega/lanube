"use client";

import { IconPicker } from "@/components/molecules/icon-picker";
import { ImageUpload } from "@/components/molecules/image-upload";
import { MarkdownEditor } from "@/components/molecules/markdown-editor";
import { Button } from "@/components/ui/button";
import {
  FormPageLayout,
  FormSection,
  StickySaveBar,
} from "@/components/molecules/form-layout";
import { ReorderList } from "@/components/molecules/reorder-list";
import {
  UnsavedChangesDialog,
  useUnsavedChangesGuard,
} from "@/hooks/use-unsaved-changes-guard";
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
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage, apiSend, invalidateApi } from "@/lib/api/client";
import { spaceInputSchema, type SpaceInput } from "@/lib/schemas/config";
import type { SpaceFaq } from "@/lib/types/spaces";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpDown, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";

/**
 * The editable shape of a Space (no BigInt timestamp columns, so it is safe to pass from a
 * server component to this client form). `null` id means "create".
 */
export interface SpaceEditable {
  id: string;
  kind: SpaceKind;
  name: string;
  slug: string;
  description: string;
  longDescription: string | null;
  faqs: SpaceFaq[] | null;
  capacity: number | null;
  isExclusive: boolean;
  isReservable: boolean;
  isFeatured: boolean;
  displayOrder: number;
  iconName: string | null;
  imageUrl: string | null;
}

type SpaceKind = SpaceInput["kind"];

const EMPTY: SpaceInput = {
  kind: "SPACE",
  name: "",
  slug: "",
  description: "",
  longDescription: "",
  faqs: [],
  capacity: 1,
  isExclusive: false,
  isReservable: true,
  isFeatured: false,
  iconName: "",
  imageUrl: null,
};

/** Lo que cambia entre un espacio y un área común (milestone 24). */
const KIND_COPY = {
  SPACE: {
    noun: "espacio",
    newLabel: "Crear espacio",
    created: "Espacio creado",
    updated: "Espacio actualizado",
    saveError: "No se pudo guardar el espacio",
    identity:
      "Cómo se llama el espacio, cómo se reconoce y cuántas personas entran.",
    placeholder: "Sala de reuniones",
  },
  AMENITY: {
    noun: "área común",
    newLabel: "Crear área común",
    created: "Área común creada",
    updated: "Área común actualizada",
    saveError: "No se pudo guardar el área común",
    identity:
      "Cómo se llama, cómo se reconoce y, si querés, cuántas personas entran.",
    placeholder: "Cocina",
  },
} as const;

const FLAGS = [
  {
    name: "isReservable",
    label: "Reservable",
    hint: "Los usuarios pueden reservarlo desde su panel.",
  },
  {
    name: "isExclusive",
    label: "Exclusivo",
    hint: "Una sola reserva aprobada a la vez (sin compartir capacidad).",
  },
  {
    name: "isFeatured",
    label: "Destacado",
    hint: "Se muestra en la página principal.",
  },
] as const;

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const LIST_URL = "/admin/spaces";

/**
 * Formulario de espacio (milestone 14, propuesta 3).
 *   - Columna principal: Identidad (nombre, ícono, capacidad, imagen) · Descripción ·
 *     Preguntas frecuentes · Avanzado (slug, colapsado).
 *   - Aside "Comportamiento": Reservable / Exclusivo / Destacado (al final en el teléfono).
 *   - Slug **derivado del nombre al crear y estable después**: no se tipea; queda detrás de
 *     "Avanzado" para el arreglo manual poco frecuente. Las colisiones se resuelven en el
 *     servidor con sufijo numérico (`createSpace`).
 *   - Las preguntas frecuentes se muestran **colapsadas** (solo la pregunta) y se expanden de
 *     a una para editar; su orden se cambia con el modo "Reordenar" compartido.
 *   - Barra de guardado pegada abajo + guardia de cambios sin guardar.
 */
export function SpaceForm({
  space,
  kind: newKind = "SPACE",
}: {
  space?: SpaceEditable | null;
  /** Tipo al crear (`/admin/spaces/new?kind=amenity`); al editar manda el del registro. */
  kind?: SpaceKind;
}) {
  const router = useRouter();
  const editing = space ?? null;
  const kind: SpaceKind = editing?.kind ?? newKind;
  const amenity = kind === "AMENITY";
  const copy = KIND_COPY[kind];
  const [busy, setBusy] = useState(false);
  // Avanzado (slug) arranca cerrado; se abre solo si el slug no valida (ver JSX).
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Preguntas expandidas, por id de campo de RHF. Las nuevas se agregan ya expandidas.
  const [openFaqs, setOpenFaqs] = useState<Set<string>>(new Set());
  const [reorderingFaqs, setReorderingFaqs] = useState(false);

  const form = useForm<SpaceInput>({
    resolver: zodResolver(spaceInputSchema),
    defaultValues: editing
      ? {
          kind: editing.kind,
          name: editing.name,
          slug: editing.slug,
          description: editing.description,
          longDescription: editing.longDescription ?? "",
          faqs: editing.faqs ?? [],
          capacity: editing.capacity,
          isExclusive: editing.isExclusive,
          isReservable: editing.isReservable,
          isFeatured: editing.isFeatured,
          iconName: editing.iconName ?? "",
          imageUrl: editing.imageUrl,
        }
      : {
          ...EMPTY,
          kind,
          // Un área común nace sin capacidad ni reserva: solo se muestra.
          ...(amenity
            ? { capacity: null, isReservable: false, isExclusive: false }
            : {}),
        },
  });

  const faqFields = useFieldArray({ control: form.control, name: "faqs" });
  // La pregunta recién agregada abre expandida. Su id lo asigna RHF al agregarla, así que se
  // toma en el render siguiente (efecto de abajo).
  const expandNextFaq = useRef(false);
  const lastFaqId = faqFields.fields.at(-1)?.id;
  useEffect(() => {
    if (expandNextFaq.current && lastFaqId) {
      expandNextFaq.current = false;
      setOpenFaqs((prev) => new Set(prev).add(lastFaqId));
    }
  }, [lastFaqId]);
  const guard = useUnsavedChangesGuard(form.formState.isDirty && !busy);
  const faqErrors = form.formState.errors.faqs;
  const slugError = form.formState.errors.slug;

  const toggleFaq = (id: string) =>
    setOpenFaqs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onSubmit = async (values: SpaceInput) => {
    setBusy(true);
    const payload = {
      ...values,
      longDescription: values.longDescription?.trim()
        ? values.longDescription
        : null,
      iconName: values.iconName || null,
      imageUrl: values.imageUrl || null,
    };
    try {
      if (editing) {
        await apiSend(`/api/admin/spaces/${editing.id}`, "PUT", payload);
        toast.success(copy.updated);
      } else {
        await apiSend("/api/admin/spaces", "POST", payload);
        toast.success(copy.created);
      }
      invalidateApi("/api/admin/spaces");
      guard.release();
      router.push(LIST_URL);
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, copy.saveError));
      setBusy(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormPageLayout
          main={
            <>
              <FormSection
                id="identidad"
                title="Identidad"
                description={copy.identity}
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={copy.placeholder}
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            // Al crear, el slug sigue al nombre (no se tipea). Al editar
                            // queda estable para no romper links ya compartidos.
                            if (!editing) {
                              form.setValue("slug", slugify(e.target.value), {
                                shouldValidate: form.formState.isSubmitted,
                              });
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="iconName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ícono</FormLabel>
                      <FormControl>
                        <IconPicker
                          value={field.value ?? null}
                          onChange={field.onChange}
                          disabled={busy}
                        />
                      </FormControl>
                      <FormDescription>
                        Se muestra en el menú lateral, las tarjetas y el
                        calendario del espacio.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacidad</FormLabel>
                      {amenity && (
                        // Solo un área común puede no tener capacidad: un espacio la necesita
                        // para el cálculo de disponibilidad.
                        <div className="flex items-center gap-2">
                          <Switch
                            id="no-capacity"
                            checked={field.value === null}
                            onCheckedChange={(noCap) =>
                              field.onChange(noCap ? null : 1)
                            }
                          />
                          <label htmlFor="no-capacity" className="text-sm">
                            Sin capacidad
                          </label>
                        </div>
                      )}
                      {field.value !== null && (
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            className="max-w-32"
                            value={field.value}
                            onChange={(e) =>
                              field.onChange(
                                Number.isNaN(e.target.valueAsNumber)
                                  ? 1
                                  : e.target.valueAsNumber,
                              )
                            }
                          />
                        </FormControl>
                      )}
                      {amenity && (
                        <FormDescription>
                          Se muestra como «N personas» en el sitio; sin
                          capacidad no se muestra nada.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => {
                    const slug = form.watch("slug");
                    return (
                      <FormItem>
                        <FormLabel>Imagen</FormLabel>
                        <FormControl>
                          <ImageUpload
                            value={field.value ?? null}
                            onChange={field.onChange}
                            uploadUrl={`/api/admin/spaces/upload${slug ? `?slug=${encodeURIComponent(slug)}` : ""}`}
                            alt={form.getValues("name") || copy.noun}
                            disabled={busy}
                          />
                        </FormControl>
                        <FormDescription>
                          Se muestra en la página principal y en las páginas del
                          espacio.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </FormSection>

              <FormSection
                id="descripcion"
                title="Descripción"
                description="El texto corto de las tarjetas y el detalle de la página pública."
              >
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción breve</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormDescription>
                        Resumen corto para la página principal y las tarjetas
                        del espacio.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="longDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción detallada (opcional)</FormLabel>
                      <FormControl>
                        <MarkdownEditor
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          rows={8}
                          maxLength={5000}
                          placeholder="Descripción completa del espacio, para la página pública de Espacios…"
                        />
                      </FormControl>
                      <FormDescription>
                        Se muestra en la página pública de Espacios. Admite
                        markdown (listas, negrita, encabezados).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSection>

              <FormSection
                id="faq"
                title="Preguntas frecuentes"
                description="Se muestran en la página pública del espacio. Las respuestas admiten markdown."
              >
                {reorderingFaqs ? (
                  <ReorderList
                    items={faqFields.fields.map((f, i) => ({
                      id: f.id,
                      label:
                        form.getValues(`faqs.${i}.question`) ||
                        `Pregunta ${i + 1}`,
                    }))}
                    hint="El cambio se guarda junto con el espacio."
                    onSave={async (orderedIds) => {
                      // Reordenamiento local: se persiste con "Guardar cambios".
                      const current = form.getValues("faqs") ?? [];
                      const byId = new Map(
                        faqFields.fields.map((f, i) => [f.id, current[i]]),
                      );
                      faqFields.replace(
                        orderedIds
                          .map((id) => byId.get(id))
                          .filter((v): v is SpaceFaq => !!v),
                      );
                      setOpenFaqs(new Set());
                      setReorderingFaqs(false);
                    }}
                    onCancel={() => setReorderingFaqs(false)}
                  />
                ) : (
                  <>
                    {faqFields.fields.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Sin preguntas frecuentes.
                      </p>
                    ) : (
                      <ul className="divide-y overflow-hidden rounded-md border">
                        {faqFields.fields.map((faq, index) => {
                          const hasError = !!faqErrors?.[index];
                          const open = openFaqs.has(faq.id) || hasError;
                          const question = form.watch(`faqs.${index}.question`);
                          return (
                            <li key={faq.id} className="bg-card">
                              <div className="flex items-center gap-2 px-3 py-2">
                                <button
                                  type="button"
                                  className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-sm font-medium"
                                  aria-expanded={open}
                                  onClick={() => toggleFaq(faq.id)}
                                >
                                  <ChevronDown
                                    className={cn(
                                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                      open && "rotate-180",
                                    )}
                                    aria-hidden
                                  />
                                  <span
                                    className={cn(
                                      "truncate",
                                      !question && "text-muted-foreground",
                                      hasError && "text-destructive",
                                    )}
                                  >
                                    {question ||
                                      `Pregunta ${index + 1} (sin título)`}
                                  </span>
                                </button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  onClick={() => faqFields.remove(index)}
                                  aria-label={`Eliminar pregunta ${index + 1}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                              {open && (
                                <div className="space-y-3 border-t bg-muted/30 p-3">
                                  <FormField
                                    control={form.control}
                                    name={`faqs.${index}.question`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Pregunta</FormLabel>
                                        <FormControl>
                                          <Input
                                            placeholder="¿Qué ofrecemos?"
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name={`faqs.${index}.answer`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Respuesta</FormLabel>
                                        <FormControl>
                                          <MarkdownEditor
                                            value={field.value ?? ""}
                                            onChange={field.onChange}
                                            rows={4}
                                            maxLength={2000}
                                            placeholder="Respuesta…"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          faqFields.append({ question: "", answer: "" });
                          expandNextFaq.current = true;
                        }}
                      >
                        <Plus className="mr-1 h-4 w-4" /> Agregar pregunta
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={faqFields.fields.length < 2}
                        onClick={() => setReorderingFaqs(true)}
                      >
                        <ArrowUpDown className="mr-1 h-4 w-4" /> Reordenar
                      </Button>
                    </div>
                  </>
                )}
              </FormSection>

              {/* "Avanzado": el slug, colapsado. Se abre solo si no valida. */}
              <FormSection
                id="avanzado"
                title="Avanzado"
                description="Datos técnicos que casi nunca hace falta tocar."
              >
                {advancedOpen || slugError ? (
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dirección (slug)</FormLabel>
                        <FormControl>
                          <Input placeholder="sala-de-reuniones" {...field} />
                        </FormControl>
                        <FormDescription>
                          Se usa en las URLs (/user/spaces/…). Cambiarla rompe
                          los links que ya se hayan compartido.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      Dirección:{" "}
                      <span className="font-mono text-foreground">
                        /user/spaces/{form.watch("slug") || "…"}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => setAdvancedOpen(true)}
                    >
                      Editar
                    </Button>
                  </p>
                )}
              </FormSection>
            </>
          }
          aside={
            amenity ? undefined : (
              <FormSection
                id="comportamiento"
                title="Comportamiento"
                description="Cómo se puede usar y dónde aparece."
              >
                {FLAGS.map((flag) => (
                  <FormField
                    key={flag.name}
                    control={form.control}
                    name={flag.name}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between gap-3 rounded-md border p-3">
                        <div className="space-y-1">
                          <FormLabel>{flag.label}</FormLabel>
                          <FormDescription>{flag.hint}</FormDescription>
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
                ))}
              </FormSection>
            )
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
            {editing ? "Guardar cambios" : copy.newLabel}
          </Button>
        </StickySaveBar>
      </form>

      <UnsavedChangesDialog guard={guard} />
    </Form>
  );
}
