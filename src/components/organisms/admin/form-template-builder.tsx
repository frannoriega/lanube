"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormSection, StickySaveBar } from "@/components/molecules/form-layout";
import { ReorderList } from "@/components/molecules/reorder-list";
import {
  UnsavedChangesDialog,
  useUnsavedChangesGuard,
} from "@/hooks/use-unsaved-changes-guard";
import { cn } from "@/lib/utils";
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
  BOOLEAN_FIELD_TYPES,
  FIELD_TYPE_ICONS,
  FIELD_TYPE_LABELS,
  FILE_FIELD_TYPES,
  NUMERIC_FIELD_TYPES,
  SELECT_FIELD_TYPES,
} from "@/lib/constants/form-fields";
import {
  buildVisibleWhen,
  CONDITION_OPS,
  opNeedsValue,
  parseVisibleWhen,
} from "@/lib/events/builder-conditions";
import {
  type FormNode,
  type FormSchema,
  isGroupNode,
  type InputNode,
} from "@/lib/events/form-schema";
import { FormFieldType } from "@/types/prisma";
import { createId } from "@paralleldrive/cuid2";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowUpDown,
  ChevronDown,
  FileText,
  Repeat,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  type Control,
  type FieldValues,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { LoadError } from "@/components/molecules/load-error";

// ---------------------------------------------------------------------------
// Schema (the builder edits a flat-ish model; groups nest one level of inputs)
// ---------------------------------------------------------------------------

const splitLines = (s: string) =>
  s
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);
const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

// Fields shared by every input editor (top-level input OR group child).
const inputShape = {
  id: z.string(),
  type: z.enum(FormFieldType),
  label: z.string().trim().min(1, { message: "La etiqueta es obligatoria" }),
  placeholder: z.string().max(200),
  required: z.boolean(),
  optionsText: z.string(),
  minText: z.string(),
  maxText: z.string(),
  stepText: z.string(),
  // FILE constraints
  maxSizeText: z.string(),
  acceptText: z.string(),
  // BOOLEAN attached document (e.g. terms & conditions)
  attachmentUrl: z.string(),
  attachmentName: z.string(),
};

/** Comma-separated extensions → normalized array (no dot, lowercase). */
const splitExtensions = (s: string) =>
  s
    .split(",")
    .map((e) => e.trim().replace(/^\./, "").toLowerCase())
    .filter(Boolean);

function refineInput(
  f: {
    type: FormFieldType;
    optionsText: string;
    minText: string;
    maxText: string;
    stepText: string;
    maxSizeText: string;
  },
  ctx: z.RefinementCtx,
) {
  if (SELECT_FIELD_TYPES.includes(f.type)) {
    if (splitLines(f.optionsText).length < 1)
      ctx.addIssue({
        code: "custom",
        message: "Agregá al menos una opción",
        path: ["optionsText"],
      });
  }
  if (FILE_FIELD_TYPES.includes(f.type)) {
    const size = numOrNull(f.maxSizeText);
    if (size !== null && (!Number.isFinite(size) || size <= 0 || size > 10))
      ctx.addIssue({
        code: "custom",
        message: "Ingresá un tamaño entre 0 y 10 MB",
        path: ["maxSizeText"],
      });
  }
  if (NUMERIC_FIELD_TYPES.includes(f.type)) {
    const min = numOrNull(f.minText);
    const max = numOrNull(f.maxText);
    const step = numOrNull(f.stepText);
    if (min !== null && !Number.isFinite(min))
      ctx.addIssue({
        code: "custom",
        message: "Número inválido",
        path: ["minText"],
      });
    if (max !== null && !Number.isFinite(max))
      ctx.addIssue({
        code: "custom",
        message: "Número inválido",
        path: ["maxText"],
      });
    if (step !== null && (!Number.isFinite(step) || step <= 0))
      ctx.addIssue({
        code: "custom",
        message: "Debe ser mayor a 0",
        path: ["stepText"],
      });
    if (
      min !== null &&
      max !== null &&
      Number.isFinite(min) &&
      Number.isFinite(max) &&
      min > max
    )
      ctx.addIssue({
        code: "custom",
        message: "El máximo debe ser mayor o igual al mínimo",
        path: ["maxText"],
      });
  }
}

const childSchema = z.object(inputShape).superRefine(refineInput);

const builderFieldSchema = z
  .object({
    ...inputShape,
    kind: z.enum(["input", "group"]),
    // visibility (both kinds)
    condField: z.string(),
    condOp: z.string(),
    condValue: z.string(),
    // group config
    repeatable: z.boolean(),
    repeatMin: z.string(),
    repeatMax: z.string(),
    countFrom: z.string(),
    itemLabel: z.string(),
    children: z.array(childSchema),
  })
  .superRefine((f, ctx) => {
    if (f.condField && opNeedsValue(f.condOp) && f.condValue.trim() === "")
      ctx.addIssue({
        code: "custom",
        message: "Ingresá un valor",
        path: ["condValue"],
      });
    if (f.kind === "input") {
      refineInput(f, ctx);
    } else if (f.children.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Agregá al menos un campo al grupo",
        path: ["children"],
      });
    }
  });

const builderSchema = z.object({
  name: z.string().trim().min(1, { message: "El nombre es obligatorio" }),
  description: z.string().max(2000),
  fields: z.array(builderFieldSchema),
});

type BuilderValues = z.infer<typeof builderSchema>;
type BuilderChild = z.infer<typeof childSchema>;

function newChild(): BuilderChild {
  return {
    id: createId(),
    type: FormFieldType.SHORT_TEXT,
    label: "",
    placeholder: "",
    required: false,
    optionsText: "",
    minText: "",
    maxText: "",
    stepText: "",
    maxSizeText: "",
    acceptText: "",
    attachmentUrl: "",
    attachmentName: "",
  };
}

function newField(kind: "input" | "group"): BuilderValues["fields"][number] {
  return {
    ...newChild(),
    kind,
    condField: "",
    condOp: "eq",
    condValue: "",
    repeatable: kind === "group",
    repeatMin: "",
    repeatMax: "",
    countFrom: "",
    itemLabel: kind === "group" ? "Elemento {{n}}" : "",
    children: kind === "group" ? [newChild()] : [],
  };
}

// ---------------------------------------------------------------------------
// Load / save mapping (builder values <-> FormSchema)
// ---------------------------------------------------------------------------

function inputNodeToEditor(n: InputNode): BuilderChild {
  const c = n.constraints;
  return {
    id: n.id,
    type: n.type as FormFieldType,
    label: n.label,
    placeholder: n.placeholder ?? "",
    required: n.required,
    optionsText: Array.isArray(n.options) ? n.options.join("\n") : "",
    minText: c?.min != null ? String(c.min) : "",
    maxText: c?.max != null ? String(c.max) : "",
    stepText: c?.step != null ? String(c.step) : "",
    maxSizeText: c?.maxSizeMb != null ? String(c.maxSizeMb) : "",
    acceptText: Array.isArray(c?.accept) ? c.accept.join(", ") : "",
    attachmentUrl: c?.attachmentUrl ?? "",
    attachmentName: c?.attachmentName ?? "",
  };
}

function nodeToBuilderField(n: FormNode): BuilderValues["fields"][number] {
  const cond = parseVisibleWhen(n.visibleWhen);
  if (!isGroupNode(n)) {
    return {
      ...inputNodeToEditor(n),
      kind: "input",
      condField: cond.field,
      condOp: cond.op,
      condValue: cond.value,
      repeatable: false,
      repeatMin: "",
      repeatMax: "",
      countFrom: "",
      itemLabel: "",
      children: [],
    };
  }
  return {
    id: n.id,
    kind: "group",
    type: FormFieldType.SHORT_TEXT,
    label: n.label ?? "",
    placeholder: "",
    required: false,
    optionsText: "",
    minText: "",
    maxText: "",
    stepText: "",
    maxSizeText: "",
    acceptText: "",
    attachmentUrl: "",
    attachmentName: "",
    condField: cond.field,
    condOp: cond.op,
    condValue: cond.value,
    repeatable: !!n.repeat,
    repeatMin: n.repeat?.min != null ? String(n.repeat.min) : "",
    repeatMax: n.repeat?.max != null ? String(n.repeat.max) : "",
    countFrom: n.repeat?.countFrom ?? "",
    itemLabel: n.repeat?.itemLabel ?? "",
    children: n.children
      .filter((c): c is InputNode => c.kind === "input")
      .map(inputNodeToEditor),
  };
}

/** Builds the per-type constraints bag for an input editor (null when the type has none). */
function editorToConstraints(f: BuilderChild): InputNode["constraints"] {
  if (NUMERIC_FIELD_TYPES.includes(f.type)) {
    return {
      min: numOrNull(f.minText),
      max: numOrNull(f.maxText),
      step: numOrNull(f.stepText),
    };
  }
  if (FILE_FIELD_TYPES.includes(f.type)) {
    const accept = splitExtensions(f.acceptText);
    return {
      maxSizeMb: numOrNull(f.maxSizeText),
      accept: accept.length > 0 ? accept : null,
    };
  }
  if (BOOLEAN_FIELD_TYPES.includes(f.type) && f.attachmentUrl.trim()) {
    return {
      attachmentUrl: f.attachmentUrl.trim(),
      attachmentName: f.attachmentName.trim() || "Documento",
    };
  }
  return null;
}

function editorToInputNode(
  f: BuilderChild & { condField?: string; condOp?: string; condValue?: string },
  withVisibility: boolean,
): InputNode {
  return {
    kind: "input",
    id: f.id,
    type: f.type,
    label: f.label.trim(),
    placeholder: f.placeholder.trim() || null,
    required: f.required,
    options: SELECT_FIELD_TYPES.includes(f.type)
      ? splitLines(f.optionsText)
      : null,
    constraints: editorToConstraints(f),
    visibleWhen: withVisibility
      ? buildVisibleWhen({
          field: f.condField ?? "",
          op: f.condOp ?? "eq",
          value: f.condValue ?? "",
        })
      : null,
  };
}

function builderFieldToNode(f: BuilderValues["fields"][number]): FormNode {
  if (f.kind === "input") return editorToInputNode(f, true);
  return {
    kind: "group",
    id: f.id,
    label: f.label.trim() || null,
    visibleWhen: buildVisibleWhen({
      field: f.condField,
      op: f.condOp,
      value: f.condValue,
    }),
    repeat: f.repeatable
      ? {
          min: numOrNull(f.repeatMin),
          max: numOrNull(f.repeatMax),
          countFrom: f.countFrom || null,
          itemLabel: f.itemLabel.trim() || null,
        }
      : null,
    children: f.children.map((c) => editorToInputNode(c, false)),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
  const { control, handleSubmit, reset, formState } = form;
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "fields",
    keyName: "fieldKey",
  });

  /*
   * Milestone 14, propuesta 9: cada campo se muestra **colapsado** (rótulo + tipo +
   * "Obligatorio") y se expande de a uno para editarlo — antes eran tarjetas altas siempre
   * abiertas (3 campos ≈ 2 pantallas de teléfono). El orden se cambia con el modo
   * "Reordenar" compartido en vez de flechas arriba/abajo por campo.
   */
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  // El campo recién agregado abre expandido (su `fieldKey` aparece en el render siguiente).
  const openNext = useRef(false);
  const lastKey = fields.at(-1)?.fieldKey;
  useEffect(() => {
    if (openNext.current && lastKey) {
      openNext.current = false;
      setOpenKey(lastKey);
    }
  }, [lastKey]);
  const addField = (kind: "input" | "group") => {
    append(newField(kind));
    openNext.current = true;
  };

  const guard = useUnsavedChangesGuard(
    formState.isDirty && !formState.isSubmitting,
  );

  const {
    data: template,
    error: templateError,
    firstTime,
    refetch: refetchTemplate,
  } = useApi<{
    name?: string;
    description?: string | null;
    schema?: FormSchema | null;
  }>(mode === "edit" && templateId ? `/api/admin/forms/${templateId}` : null);
  const loading = mode === "edit" && firstTime;

  useEffect(() => {
    if (!template) return;
    reset({
      name: template.name ?? "",
      description: template.description ?? "",
      fields: (template.schema?.nodes ?? []).map(nodeToBuilderField),
    });
  }, [template, reset]);

  const onSubmit = async (values: BuilderValues) => {
    const payload = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      schema: {
        version: 1 as const,
        nodes: values.fields.map(builderFieldToNode),
      },
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
    guard.release();
    router.push("/admin/forms");
    router.refresh();
  };

  // Without this an edit whose GET failed renders the builder with an EMPTY field list,
  // which looks exactly like a template whose fields were deleted (F1.2).
  if (mode === "edit" && templateError) {
    return (
      <LoadError
        message="No se pudo cargar el formulario. No lo edites hasta que cargue, o guardarás una versión vacía."
        onRetry={() => void refetchTemplate()}
      />
    );
  }

  if (loading) return <p className="text-muted-foreground">Cargando…</p>;

  const looseControl = control as unknown as Control<FieldValues>;

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
        <FormSection
          id="datos"
          title="Datos del formulario"
          description="Nombre interno de la plantilla (los participantes ven el del evento)."
        >
          <FormField
            control={control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Ej.: Inscripción a talleres" {...field} />
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
                <FormLabel>Descripción (opcional)</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection
          id="campos"
          title="Campos"
          description="Tocá un campo para editarlo. El orden de la lista es el del formulario."
        >
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Email</span> — siempre
            presente y obligatorio (clave del participante).
          </div>

          {reordering ? (
            <ReorderList
              items={fields.map((item, i) => ({
                id: item.fieldKey,
                label: form.getValues(`fields.${i}.label`) || `Campo ${i + 1}`,
              }))}
              hint="El cambio se guarda junto con el formulario."
              onSave={async (orderedKeys) => {
                // Reordenamiento local: se persiste con "Guardar formulario".
                const current = form.getValues("fields");
                const byKey = new Map(
                  fields.map((f, i) => [f.fieldKey, current[i]]),
                );
                replace(
                  orderedKeys
                    .map((k) => byKey.get(k))
                    .filter((v): v is BuilderValues["fields"][number] => !!v),
                );
                setOpenKey(null);
                setReordering(false);
              }}
              onCancel={() => setReordering(false)}
            />
          ) : (
            <>
              {fields.length > 0 && (
                <ul className="divide-y overflow-hidden rounded-md border">
                  {fields.map((item, index) => {
                    const hasError = !!formState.errors.fields?.[index];
                    const open = openKey === item.fieldKey || hasError;
                    return (
                      <li key={item.fieldKey} className="bg-card">
                        <div className="flex items-center gap-2 px-3 py-2">
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
                            aria-expanded={open}
                            onClick={() =>
                              setOpenKey(open ? null : item.fieldKey)
                            }
                          >
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                open && "rotate-180",
                              )}
                              aria-hidden
                            />
                            <FieldSummary
                              control={looseControl}
                              namePrefix={`fields.${index}`}
                              index={index}
                              hasError={hasError}
                            />
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            aria-label={`Eliminar campo ${index + 1}`}
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        {open && (
                          <div className="space-y-3 border-t bg-muted/30 p-3 sm:p-4">
                            <FormField
                              control={control}
                              name={`fields.${index}.kind`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Tipo de bloque</FormLabel>
                                  <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="w-full sm:w-56">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="input">
                                        Campo
                                      </SelectItem>
                                      <SelectItem value="group">
                                        Grupo repetible
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FieldCard
                              control={looseControl}
                              index={index}
                              namePrefix={`fields.${index}`}
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
                  onClick={() => addField("input")}
                >
                  Agregar campo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addField("group")}
                >
                  Agregar grupo repetible
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={fields.length < 2}
                  onClick={() => setReordering(true)}
                >
                  <ArrowUpDown className="mr-1 h-4 w-4" /> Reordenar
                </Button>
              </div>
            </>
          )}
        </FormSection>

        <StickySaveBar dirty={formState.isDirty}>
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
        </StickySaveBar>
      </form>
      <UnsavedChangesDialog guard={guard} />
    </Form>
  );
}

/**
 * Resumen de un campo colapsado: rótulo (o "Campo sin título"), chip con el tipo (ícono +
 * nombre; "Grupo repetible" para grupos) y "Obligatorio" si corresponde. Lee los valores en
 * vivo (`useWatch`) para que el resumen siga a lo que se edita.
 */
function FieldSummary({
  control,
  namePrefix,
  index,
  hasError,
}: {
  control: Control<FieldValues>;
  namePrefix: string;
  index: number;
  hasError: boolean;
}) {
  const kind = useWatch({ control, name: `${namePrefix}.kind` }) as string;
  const label = useWatch({ control, name: `${namePrefix}.label` }) as string;
  const type = useWatch({ control, name: `${namePrefix}.type` }) as string;
  const required = useWatch({
    control,
    name: `${namePrefix}.required`,
  }) as boolean;
  const isGroup = kind === "group";
  const Icon = isGroup ? Repeat : (FIELD_TYPE_ICONS[type] ?? FileText);
  return (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
      <span
        className={cn(
          "min-w-0 truncate text-sm font-medium",
          !label && "text-muted-foreground",
          hasError && "text-destructive",
        )}
      >
        {label || `Campo ${index + 1} (sin título)`}
      </span>
      <Badge variant="secondary" className="gap-1 font-normal">
        <Icon className="h-3 w-3" aria-hidden />
        {isGroup ? "Grupo repetible" : (FIELD_TYPE_LABELS[type] ?? type)}
      </Badge>
      {!isGroup && required && (
        <Badge variant="outline" className="font-normal">
          Obligatorio
        </Badge>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// A top-level field card: dispatches on kind (input vs group).
// ---------------------------------------------------------------------------

function FieldCard({
  control,
  index,
  namePrefix,
}: {
  control: Control<FieldValues>;
  index: number;
  namePrefix: string;
}) {
  const kind = useWatch({ control, name: `${namePrefix}.kind` });

  if (kind === "group") {
    return (
      <div className="space-y-3">
        <FormField
          control={control}
          name={`${namePrefix}.label`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del grupo</FormLabel>
              <FormControl>
                <Input placeholder="Ej.: Integrantes del equipo" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <RepeatConfig control={control} index={index} namePrefix={namePrefix} />
        <GroupChildren control={control} namePrefix={namePrefix} />
        <VisibilityEditor
          control={control}
          index={index}
          namePrefix={namePrefix}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <InputFieldEditor control={control} namePrefix={namePrefix} />
      <VisibilityEditor
        control={control}
        index={index}
        namePrefix={namePrefix}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable input editor (top-level input OR group child)
// ---------------------------------------------------------------------------

function InputFieldEditor({
  control,
  namePrefix,
  showType = true,
}: {
  control: Control<FieldValues>;
  namePrefix: string;
  showType?: boolean;
}) {
  const type = useWatch({ control, name: `${namePrefix}.type` }) as string;

  return (
    <div className="space-y-3">
      {showType && (
        <FormField
          control={control}
          name={`${namePrefix}.type`}
          render={({ field }) => (
            <FormItem className="w-56">
              <FormLabel className="text-xs">Tipo</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(FIELD_TYPE_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
      )}

      <FormField
        control={control}
        name={`${namePrefix}.label`}
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
        name={`${namePrefix}.placeholder`}
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

      {SELECT_FIELD_TYPES.includes(type as FormFieldType) && (
        <FormField
          control={control}
          name={`${namePrefix}.optionsText`}
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

      {NUMERIC_FIELD_TYPES.includes(type as FormFieldType) && (
        <div className="grid grid-cols-3 gap-2">
          {(["minText", "maxText", "stepText"] as const).map((key, i) => (
            <FormField
              key={key}
              control={control}
              name={`${namePrefix}.${key}`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">
                    {["Mínimo", "Máximo", "Paso (opcional)"][i]}
                  </FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="—" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
      )}

      {FILE_FIELD_TYPES.includes(type as FormFieldType) && (
        <div className="grid grid-cols-2 gap-2">
          <FormField
            control={control}
            name={`${namePrefix}.maxSizeText`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Tamaño máx. (MB)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="10" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`${namePrefix}.acceptText`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">
                  Extensiones (separadas por coma)
                </FormLabel>
                <FormControl>
                  <Input placeholder="pdf, jpg, png" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}

      {BOOLEAN_FIELD_TYPES.includes(type as FormFieldType) && (
        <AttachmentUploadField control={control} namePrefix={namePrefix} />
      )}

      <FormField
        control={control}
        name={`${namePrefix}.required`}
        render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
            <FormLabel>Obligatorio</FormLabel>
          </FormItem>
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attachment uploader for a BOOLEAN "acknowledgement" field (e.g. terms & conditions)
// ---------------------------------------------------------------------------

function AttachmentUploadField({
  control,
  namePrefix,
}: {
  control: Control<FieldValues>;
  namePrefix: string;
}) {
  const { setValue } = useFormContext();
  const url = useWatch({
    control,
    name: `${namePrefix}.attachmentUrl`,
  }) as string;
  const name = useWatch({
    control,
    name: `${namePrefix}.attachmentName`,
  }) as string;
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const setField = (key: "attachmentUrl" | "attachmentName", value: string) =>
    setValue(`${namePrefix}.${key}`, value, { shouldDirty: true });

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/forms/upload", {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message ?? "No se pudo subir el archivo");
        return;
      }
      setField("attachmentUrl", data.url as string);
      setField("attachmentName", file.name);
      toast.success("Documento subido");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-3">
      <p className="text-xs font-medium text-muted-foreground">
        Documento a aceptar (opcional) — se muestra junto a la casilla
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      {url ? (
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate underline"
          >
            {name || "Documento"}
          </a>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setField("attachmentUrl", "");
              setField("attachmentName", "");
            }}
          >
            Quitar
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Subiendo…" : "Subir documento"}
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group children (nested list of inputs)
// ---------------------------------------------------------------------------

function GroupChildren({
  control,
  namePrefix,
}: {
  control: Control<FieldValues>;
  namePrefix: string;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${namePrefix}.children`,
    keyName: "childKey",
  });

  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-3">
      <p className="text-xs font-medium text-muted-foreground">
        Campos del grupo (se repiten por cada elemento)
      </p>
      {fields.map((item, j) => (
        <div
          key={(item as { childKey: string }).childKey}
          className="space-y-3 rounded-md border bg-background p-3"
        >
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Quitar campo"
              onClick={() => remove(j)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <InputFieldEditor
            control={control}
            namePrefix={`${namePrefix}.children.${j}`}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append(newChild())}
      >
        Agregar campo al grupo
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Repeat config for a group
// ---------------------------------------------------------------------------

function RepeatConfig({
  control,
  index,
  namePrefix,
}: {
  control: Control<FieldValues>;
  index: number;
  namePrefix: string;
}) {
  const { setValue } = useFormContext();
  const repeatable = useWatch({ control, name: `${namePrefix}.repeatable` });
  const countFrom = useWatch({
    control,
    name: `${namePrefix}.countFrom`,
  }) as string;
  const fieldDriven = !!countFrom; // count comes from another field → no min/max
  const allFields = (useWatch({ control, name: "fields" }) ?? []) as Array<{
    id: string;
    label: string;
    kind: string;
    type: string;
  }>;
  // Only earlier INTEGER fields can drive the count.
  const countFields = allFields
    .slice(0, index)
    .filter(
      (ff) =>
        ff.kind === "input" && ff.type === "INTEGER" && ff.label.trim() !== "",
    );

  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-3">
      <FormField
        control={control}
        name={`${namePrefix}.repeatable`}
        render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
            <FormLabel>Repetible (varios elementos)</FormLabel>
          </FormItem>
        )}
      />
      {repeatable && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <FormField
              control={control}
              name={`${namePrefix}.countFrom`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">
                    Cantidad definida por
                  </FormLabel>
                  <Select
                    value={field.value || "__none__"}
                    onValueChange={(v) => {
                      const next = v === "__none__" ? "" : v;
                      field.onChange(next);
                      // Field-driven count is exact — drop any min/max that would clamp it.
                      if (next) {
                        setValue(`${namePrefix}.repeatMin`, "");
                        setValue(`${namePrefix}.repeatMax`, "");
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Manual</SelectItem>
                      {countFields.map((ff) => (
                        <SelectItem key={ff.id} value={ff.id}>
                          {ff.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            {!fieldDriven && (
              <>
                <FormField
                  control={control}
                  name={`${namePrefix}.repeatMin`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Mínimo</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="—" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`${namePrefix}.repeatMax`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Máximo</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="—" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </>
            )}
          </div>
          <FormField
            control={control}
            name={`${namePrefix}.itemLabel`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">
                  Etiqueta de cada elemento (usá {"{{n}}"} para el número)
                </FormLabel>
                <FormControl>
                  <Input placeholder="Ej.: Integrante {{n}}" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visibility editor (conditional display), reused for inputs + groups
// ---------------------------------------------------------------------------

function VisibilityEditor({
  control,
  index,
  namePrefix,
}: {
  control: Control<FieldValues>;
  index: number;
  namePrefix: string;
}) {
  const allFields = (useWatch({ control, name: "fields" }) ?? []) as Array<{
    id: string;
    label: string;
  }>;
  const earlier = allFields
    .slice(0, index)
    .filter((ff) => ff.label.trim() !== "");
  const condField = useWatch({
    control,
    name: `${namePrefix}.condField`,
  }) as string;
  const condOp = useWatch({ control, name: `${namePrefix}.condOp` }) as string;

  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-3">
      <p className="text-xs font-medium text-muted-foreground">
        Visibilidad condicional
      </p>
      {earlier.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Agregá un campo con etiqueta antes de este para poder mostrarlo sólo
          bajo ciertas condiciones.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <FormField
            control={control}
            name={`${namePrefix}.condField`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Mostrar si</FormLabel>
                <Select
                  value={field.value || "__none__"}
                  onValueChange={(v) =>
                    field.onChange(v === "__none__" ? "" : v)
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Siempre visible</SelectItem>
                    {earlier.map((ff) => (
                      <SelectItem key={ff.id} value={ff.id}>
                        {ff.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          {condField && (
            <FormField
              control={control}
              name={`${namePrefix}.condOp`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Condición</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CONDITION_OPS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          )}
          {condField && opNeedsValue(condOp) && (
            <FormField
              control={control}
              name={`${namePrefix}.condValue`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Valor</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}
