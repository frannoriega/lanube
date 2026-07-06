"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { apiErrorMessage, apiSend } from "@/lib/api/client";
import {
  FIELD_TYPE_LABELS,
  SELECT_FIELD_TYPES,
} from "@/lib/constants/form-fields";
import { FormFieldType } from "@/types/prisma";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// The builder edits options as newline-separated text; it's split into an array when saved.
// (The API re-validates the final shape with formTemplateSchema.)
const builderFieldSchema = z
  .object({
    type: z.enum(FormFieldType),
    label: z.string().trim().min(1, { message: "La etiqueta es obligatoria" }),
    placeholder: z.string().max(200),
    required: z.boolean(),
    optionsText: z.string(),
  })
  .superRefine((f, ctx) => {
    if (SELECT_FIELD_TYPES.includes(f.type)) {
      const opts = f.optionsText
        .split("\n")
        .map((o) => o.trim())
        .filter(Boolean);
      if (opts.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Agregá al menos una opción",
          path: ["optionsText"],
        });
      }
    }
  });

const builderSchema = z.object({
  name: z.string().trim().min(1, { message: "El nombre es obligatorio" }),
  description: z.string().max(2000),
  fields: z.array(builderFieldSchema),
});

type BuilderValues = z.infer<typeof builderSchema>;

function newField(): BuilderValues["fields"][number] {
  return {
    type: FormFieldType.SHORT_TEXT,
    label: "",
    placeholder: "",
    required: false,
    optionsText: "",
  };
}

interface FormTemplateBuilderProps {
  mode: "create" | "edit";
  templateId?: string;
}

export function FormTemplateBuilder({
  mode,
  templateId,
}: FormTemplateBuilderProps) {
  const router = useRouter();

  const form = useForm<BuilderValues>({
    resolver: zodResolver(builderSchema),
    defaultValues: { name: "", description: "", fields: [] },
  });
  const { control, handleSubmit, reset, watch, formState } = form;
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "fields",
  });

  const { data: template, firstTime } = useApi<{
    name?: string;
    description?: string | null;
    fields?: {
      type: FormFieldType;
      label: string;
      placeholder: string | null;
      required: boolean;
      options: string[] | null;
    }[];
  }>(mode === "edit" && templateId ? `/api/admin/forms/${templateId}` : null);
  const loading = mode === "edit" && firstTime;

  useEffect(() => {
    if (!template) return;
    reset({
      name: template.name ?? "",
      description: template.description ?? "",
      fields: (template.fields ?? []).map((f) => ({
        type: f.type,
        label: f.label,
        placeholder: f.placeholder ?? "",
        required: f.required,
        optionsText: Array.isArray(f.options) ? f.options.join("\n") : "",
      })),
    });
  }, [template, reset]);

  const onSubmit = async (values: BuilderValues) => {
    const payload = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      fields: values.fields.map((f) => ({
        type: f.type,
        label: f.label.trim(),
        placeholder: f.placeholder.trim() || null,
        required: f.required,
        options: SELECT_FIELD_TYPES.includes(f.type)
          ? f.optionsText
              .split("\n")
              .map((o) => o.trim())
              .filter(Boolean)
          : null,
      })),
    };

    try {
      await apiSend(
        mode === "create"
          ? "/api/admin/forms"
          : `/api/admin/forms/${templateId}`,
        mode === "create" ? "POST" : "PUT",
        payload,
      );
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo guardar el formulario"));
      return;
    }
    toast.success(
      mode === "create" ? "Formulario creado" : "Formulario actualizado",
    );
    router.push("/admin/forms");
    router.refresh();
  };

  if (loading) {
    return <p className="text-muted-foreground">Cargando…</p>;
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Datos del formulario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej.: Inscripción a talleres"
                      {...field}
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
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Email</span> —
              siempre presente y obligatorio (clave del participante).
            </div>

            {fields.map((item, index) => (
              <div key={item.id} className="space-y-3 rounded-md border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-56">
                    <FormField
                      control={control}
                      name={`fields.${index}.type`}
                      render={({ field }) => (
                        <FormItem>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(FIELD_TYPE_LABELS).map(
                                ([v, label]) => (
                                  <SelectItem key={v} value={v}>
                                    {label}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Mover arriba"
                      onClick={() => move(index, index - 1)}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Mover abajo"
                      onClick={() => move(index, index + 1)}
                      disabled={index === fields.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar campo"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <FormField
                  control={control}
                  name={`fields.${index}.label`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Etiqueta</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej.: Nombre completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name={`fields.${index}.placeholder`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Texto de ayuda (opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {SELECT_FIELD_TYPES.includes(watch(`fields.${index}.type`)) && (
                  <FormField
                    control={control}
                    name={`fields.${index}.optionsText`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opciones (una por línea)</FormLabel>
                        <FormControl>
                          <Textarea rows={3} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={control}
                  name={`fields.${index}.required`}
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel>Obligatorio</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() => append(newField())}
            >
              Agregar campo
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/forms")}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? "Guardando…" : "Guardar formulario"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
