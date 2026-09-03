"use client";

import { IconPicker } from "@/components/molecules/icon-picker";
import { ImageUpload } from "@/components/molecules/image-upload";
import { MarkdownEditor } from "@/components/molecules/markdown-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";

/**
 * The editable shape of a Space (no BigInt timestamp columns, so it is safe to pass from a
 * server component to this client form). `null` id means "create".
 */
export interface SpaceEditable {
  id: string;
  name: string;
  slug: string;
  description: string;
  longDescription: string | null;
  faqs: SpaceFaq[] | null;
  capacity: number;
  isExclusive: boolean;
  isReservable: boolean;
  isFeatured: boolean;
  displayOrder: number;
  iconName: string | null;
  imageUrl: string | null;
}

const EMPTY: SpaceInput = {
  name: "",
  slug: "",
  description: "",
  longDescription: "",
  faqs: [],
  capacity: 1,
  isExclusive: false,
  isReservable: true,
  isFeatured: false,
  displayOrder: 0,
  iconName: "",
  imageUrl: null,
};

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

export function SpaceForm({ space }: { space?: SpaceEditable | null }) {
  const router = useRouter();
  const editing = space ?? null;
  const [busy, setBusy] = useState(false);

  const form = useForm<SpaceInput>({
    resolver: zodResolver(spaceInputSchema),
    defaultValues: editing
      ? {
          name: editing.name,
          slug: editing.slug,
          description: editing.description,
          longDescription: editing.longDescription ?? "",
          faqs: editing.faqs ?? [],
          capacity: editing.capacity,
          isExclusive: editing.isExclusive,
          isReservable: editing.isReservable,
          isFeatured: editing.isFeatured,
          displayOrder: editing.displayOrder,
          iconName: editing.iconName ?? "",
          imageUrl: editing.imageUrl,
        }
      : EMPTY,
  });

  const faqFields = useFieldArray({ control: form.control, name: "faqs" });

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
        toast.success("Espacio actualizado");
      } else {
        await apiSend("/api/admin/spaces", "POST", payload);
        toast.success("Espacio creado");
      }
      invalidateApi("/api/admin/spaces");
      router.push(LIST_URL);
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo guardar el espacio"));
      setBusy(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="glass-card dark:glass-card-dark">
          <CardContent className="space-y-4 pt-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Sala de reuniones"
                      {...field}
                      onBlur={() => {
                        field.onBlur();
                        if (!editing && !form.getValues("slug")) {
                          form.setValue("slug", slugify(field.value));
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
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input placeholder="sala-de-reuniones" {...field} />
                  </FormControl>
                  <FormDescription>
                    Identificador para URLs; único por espacio.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="iconName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icono</FormLabel>
                  <FormControl>
                    <IconPicker
                      value={field.value ?? null}
                      onChange={field.onChange}
                      disabled={busy}
                    />
                  </FormControl>
                  <FormDescription>
                    Se muestra en el menú lateral, las tarjetas y el calendario
                    del espacio.
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
                  <FormControl>
                    <Input
                      type="number"
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
                        alt={form.getValues("name") || "Espacio"}
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
          </CardContent>
        </Card>

        <Card className="glass-card dark:glass-card-dark">
          <CardContent className="space-y-4 pt-6">
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
                    Resumen corto para la página principal y las tarjetas del
                    espacio.
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
                  <FormLabel>Descripción detallada</FormLabel>
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
                    Se muestra en la página pública de Espacios. Admite markdown
                    (listas, negrita, encabezados). Opcional.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card className="glass-card dark:glass-card-dark">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <FormLabel className="text-base font-semibold">
                  Preguntas frecuentes
                </FormLabel>
                <FormDescription>
                  Preguntas y respuestas mostradas en la página pública del
                  espacio. Las respuestas admiten markdown.
                </FormDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => faqFields.append({ question: "", answer: "" })}
              >
                <Plus className="mr-1 h-4 w-4" /> Agregar
              </Button>
            </div>
            {faqFields.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin preguntas frecuentes.
              </p>
            ) : (
              <div className="space-y-4">
                {faqFields.fields.map((faq, index) => (
                  <div
                    key={faq.id}
                    className="space-y-3 rounded-md border bg-muted/30 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Pregunta {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => faqFields.remove(index)}
                        aria-label={`Eliminar pregunta ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <FormField
                      control={form.control}
                      name={`faqs.${index}.question`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="sr-only">
                            Pregunta {index + 1}
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="¿Qué ofrecemos?" {...field} />
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
                          <FormLabel className="sr-only">
                            Respuesta {index + 1}
                          </FormLabel>
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card dark:glass-card-dark">
          <CardContent className="space-y-4 pt-6">
            {FLAGS.map((flag) => (
              <FormField
                key={flag.name}
                control={form.control}
                name={flag.name}
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                    <div>
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
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(LIST_URL)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {editing ? "Guardar cambios" : "Crear espacio"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
