"use client";

import { EventMeta } from "@/components/molecules/event-meta";
import { EventHero } from "@/components/organisms/forms/event-hero";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  type AnswerMap,
  fileExtension,
  isVisible,
  repeatCount,
  validateForm,
} from "@/lib/events/form-engine";
import {
  type FormNode,
  type FormSchema,
  type InputNode,
  isGroupNode,
  type UploadedFile,
} from "@/lib/events/form-schema";
import { registerEmailSchema } from "@/lib/schemas/auth";
import { FormFieldType } from "@/types/prisma";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type Control,
  type FieldValues,
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

/** Endpoint that FILE fields POST to (fieldId + file → UploadedFile descriptor). */
const UploadContext = createContext<string | null>(null);

/** Human-readable file size. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface PublicFormProps {
  schema: FormSchema;
  eventName: string;
  eventDescription?: string | null;
  eventImageUrl?: string | null;
  /** Event meta (type/weekdays/location). When all present, an EventMeta row shows under the hero. */
  eventTypeName?: string;
  resourceName?: string;
  weekdays?: number[];
  /** Extra content rendered between the header and the form (e.g. spots left). */
  notice?: React.ReactNode;
  mode: "submit" | "edit";
  slug?: string;
  token?: string;
  initialEmail?: string;
  initialAnswers?: Record<string, unknown>;
}

interface PublicFormValues {
  email: string;
  answers: Record<string, unknown>;
}

export function PublicForm({
  schema,
  eventName,
  eventDescription,
  eventImageUrl,
  eventTypeName,
  resourceName,
  weekdays,
  notice,
  mode,
  slug,
  token,
  initialEmail,
  initialAnswers,
}: PublicFormProps) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);

  // Where FILE fields upload to (submit → by slug, edit → by token).
  const uploadUrl =
    mode === "submit"
      ? slug
        ? `/api/forms/${slug}/upload`
        : null
      : token
        ? `/api/forms/response/${token}/upload`
        : null;

  // Validation delegates to the engine's validateForm (single source, honors branching + groups).
  const zodSchema = useMemo(
    () =>
      z
        .object({
          email: mode === "submit" ? registerEmailSchema : z.string(),
          answers: z.record(z.string(), z.unknown()),
        })
        .superRefine((value, ctx) => {
          const { errors } = validateForm(
            schema,
            (value.answers ?? {}) as AnswerMap,
          );
          for (const [path, message] of Object.entries(errors)) {
            const segments = path
              .split(".")
              .map((s) => (/^\d+$/.test(s) ? Number(s) : s));
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message,
              path: ["answers", ...segments],
            });
          }
        }),
    [schema, mode],
  );

  const form = useForm<PublicFormValues>({
    resolver: zodResolver(zodSchema),
    defaultValues: {
      email: initialEmail ?? "",
      answers: initialAnswers ?? {},
    },
  });

  const onSubmit = async (values: PublicFormValues) => {
    const res = await fetch(
      mode === "submit" ? `/api/forms/${slug}` : `/api/forms/response/${token}`,
      {
        method: mode === "submit" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "submit"
            ? { email: values.email, answers: values.answers }
            : { answers: values.answers },
        ),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err.errors) {
        for (const [path, message] of Object.entries(err.errors)) {
          form.setError(`answers.${path}` as `answers.${string}`, {
            message: String(message),
          });
        }
      }
      toast.error(err.message ?? "No se pudo enviar el formulario");
      return;
    }
    if (mode === "submit") {
      router.push(`/forms/${slug}/submitted`);
    } else {
      toast.success("Inscripción actualizada");
    }
  };

  const handleCancel = async () => {
    if (!token) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/forms/response/${token}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("No se pudo cancelar la inscripción");
        return;
      }
      toast.success("Inscripción cancelada");
      router.refresh();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <EventHero
          name={eventName}
          description={eventDescription}
          imageUrl={eventImageUrl}
        />
        {eventTypeName && resourceName && weekdays && (
          <EventMeta
            eventTypeName={eventTypeName}
            resourceName={resourceName}
            weekdays={weekdays}
          />
        )}
        {notice}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Email <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input type="email" disabled={mode === "edit"} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <UploadContext.Provider value={uploadUrl}>
          <NodeList
            nodes={schema.nodes}
            control={form.control}
            basePath="answers"
            scopePath={[]}
          />
        </UploadContext.Provider>

        <div className="flex justify-between gap-2">
          {mode === "edit" ? (
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelling}
            >
              Cancelar inscripción
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? "Enviando…"
              : mode === "submit"
                ? "Inscribirme"
                : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ---------------------------------------------------------------------------
// Recursive node rendering
// ---------------------------------------------------------------------------

/** Builds the innermost-first scope chain for a set of answer keys, from the root answers. */
function scopesFrom(root: AnswerMap, scopePath: string[]): AnswerMap[] {
  const scopes: AnswerMap[] = [root];
  let cur: unknown = root;
  for (const seg of scopePath) {
    cur =
      cur && typeof cur === "object"
        ? (cur as Record<string, unknown>)[seg]
        : undefined;
    scopes.unshift((cur as AnswerMap) ?? {});
  }
  return scopes;
}

interface NodeListProps {
  nodes: FormNode[];
  control: Control<PublicFormValues>;
  /** RHF field-name prefix, e.g. "answers" or "answers.team.0". */
  basePath: string;
  /** Answer keys from the answers root to this level (for scope/visibility). */
  scopePath: string[];
}

function NodeList({ nodes, control, basePath, scopePath }: NodeListProps) {
  // Watch the whole answers object so visibility recomputes on any change.
  const answers = (useWatch({ control, name: "answers" }) ?? {}) as AnswerMap;
  const scopes = scopesFrom(answers, scopePath);

  return (
    <>
      {nodes.map((node) => {
        if (!isVisible(node, scopes)) return null;
        return (
          <NodeRenderer
            key={node.id}
            node={node}
            control={control}
            basePath={basePath}
            scopePath={scopePath}
          />
        );
      })}
    </>
  );
}

function NodeRenderer({
  node,
  control,
  basePath,
  scopePath,
}: {
  node: FormNode;
  control: Control<PublicFormValues>;
  basePath: string;
  scopePath: string[];
}) {
  if (!isGroupNode(node)) {
    // BOOLEAN renders as a checkbox with the label beside it (not a label above a control).
    if (node.type === FormFieldType.BOOLEAN) {
      return (
        <FormField
          control={control}
          name={`${basePath}.${node.id}` as `answers.${string}`}
          render={({ field }) => (
            <FormItem>
              <div className="flex items-start gap-2">
                <FormControl>
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={field.value === true}
                    onChange={(e) => field.onChange(e.target.checked)}
                  />
                </FormControl>
                <div className="space-y-1">
                  <FormLabel className="font-normal">
                    {node.label}
                    {node.required && (
                      <span className="text-destructive"> *</span>
                    )}
                  </FormLabel>
                  {node.constraints?.attachmentUrl && (
                    <a
                      href={node.constraints.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm font-medium text-la-nube-selected underline dark:text-la-nube-secondary"
                    >
                      <FileText className="h-4 w-4" />
                      {node.constraints.attachmentName ?? "Ver documento"}
                    </a>
                  )}
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }

    return (
      <FormField
        control={control}
        name={`${basePath}.${node.id}` as `answers.${string}`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {node.label}
              {node.required && <span className="text-destructive"> *</span>}
            </FormLabel>
            <FormControl>
              <FieldInput
                field={node}
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  if (node.repeat) {
    return (
      <RepeatGroup
        node={node}
        control={control}
        basePath={basePath}
        scopePath={scopePath}
      />
    );
  }

  // Fixed group: a labelled container.
  return (
    <fieldset className="space-y-4 rounded-md border p-4">
      {node.label && (
        <legend className="px-1 text-sm font-medium">{node.label}</legend>
      )}
      <NodeList
        nodes={node.children}
        control={control}
        basePath={`${basePath}.${node.id}`}
        scopePath={[...scopePath, node.id]}
      />
    </fieldset>
  );
}

function RepeatGroup({
  node,
  control,
  basePath,
  scopePath,
}: {
  node: Extract<FormNode, { kind: "group" }>;
  control: Control<PublicFormValues>;
  basePath: string;
  scopePath: string[];
}) {
  const name = `${basePath}.${node.id}`;
  // answers is a fully-dynamic tree, so RHF's FieldArrayPath is `never` here; cast to the loose
  // FieldValues control so the field-array is usable (paths are correct at runtime).
  const { fields, append, remove } = useFieldArray({
    control: control as unknown as Control<FieldValues>,
    name,
  });

  const answers = (useWatch({ control, name: "answers" }) ?? {}) as AnswerMap;
  const scopes = scopesFrom(answers, scopePath);
  const desired = repeatCount(node, scopes);

  // When the count is driven by another field (countFrom), keep the item count in sync.
  useEffect(() => {
    if (desired == null) return;
    if (fields.length < desired) append({}, { shouldFocus: false });
    else if (fields.length > desired) remove(fields.length - 1);
  }, [desired, fields.length, append, remove]);

  const min = node.repeat?.min ?? 0;

  // Manual groups: unfold the minimum number of items up-front so the user doesn't have to
  // click "Agregar" to reach the minimum (confusing). Only for free groups — countFrom groups
  // are already sized by the effect above. `canRemove` blocks going below min, so this stays put.
  useEffect(() => {
    if (desired != null) return; // not a free group
    if (fields.length < min) append({}, { shouldFocus: false });
  }, [desired, fields.length, min, append]);

  const max = node.repeat?.max ?? undefined;
  const free = desired == null;
  const canAdd = free && (max === undefined || fields.length < max);
  const canRemove = free && fields.length > min;

  const itemLabel = (i: number) =>
    (node.repeat?.itemLabel ?? "Elemento {{n}}").replace(
      "{{n}}",
      String(i + 1),
    );

  return (
    <fieldset className="space-y-3 rounded-md border p-4">
      {node.label && (
        <legend className="px-1 text-sm font-medium">{node.label}</legend>
      )}
      {fields.map((item, index) => (
        <div key={item.id} className="space-y-4 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {itemLabel(index)}
            </span>
            {canRemove && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Quitar"
                onClick={() => remove(index)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
          <NodeList
            nodes={node.children}
            control={control}
            basePath={`${name}.${index}`}
            scopePath={[...scopePath, node.id, String(index)]}
          />
        </div>
      ))}
      {canAdd && (
        <Button type="button" variant="outline" onClick={() => append({})}>
          Agregar
        </Button>
      )}
    </fieldset>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: InputNode;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const str = typeof value === "string" ? value : "";
  const c = field.constraints ?? {};

  switch (field.type) {
    case FormFieldType.LONG_TEXT:
      return (
        <Textarea
          value={str}
          placeholder={field.placeholder ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
        />
      );

    case FormFieldType.INTEGER:
      return (
        <Input
          type="number"
          inputMode="numeric"
          value={str}
          placeholder={field.placeholder ?? ""}
          min={c.min ?? undefined}
          max={c.max ?? undefined}
          step={c.step ?? 1}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case FormFieldType.FLOAT:
      return (
        <Input
          type="number"
          value={str}
          placeholder={field.placeholder ?? ""}
          min={c.min ?? undefined}
          max={c.max ?? undefined}
          step={c.step ?? "any"}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case FormFieldType.MONEY:
      return (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            $
          </span>
          <Input
            type="number"
            inputMode="decimal"
            className="pl-7"
            value={str}
            placeholder={field.placeholder ?? ""}
            min={c.min ?? 0}
            max={c.max ?? undefined}
            step={c.step ?? 0.01}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case FormFieldType.DATE:
      return (
        <Input
          type="date"
          value={str}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case FormFieldType.TIME:
      return (
        <Input
          type="time"
          value={str}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case FormFieldType.SINGLE_SELECT:
      return (
        <Select value={str} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Elegí una opción" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case FormFieldType.FILE:
      return <FileField field={field} value={value} onChange={onChange} />;

    case FormFieldType.MULTI_SELECT: {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (opt: string) =>
        onChange(
          selected.includes(opt)
            ? selected.filter((o) => o !== opt)
            : [...selected, opt],
        );
      return (
        <div className="space-y-1">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      );
    }

    default:
      return (
        <Input
          value={str}
          placeholder={field.placeholder ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

/**
 * FILE field: uploads each chosen file to the current form's private upload endpoint (via
 * UploadContext) and stores UploadedFile descriptors in the answer. Enforces the field's
 * extension + size limits client-side for a friendly error (the server re-validates).
 */
function FileField({
  field,
  value,
  onChange,
}: {
  field: InputNode;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const uploadUrl = useContext(UploadContext);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const files = Array.isArray(value) ? (value as UploadedFile[]) : [];
  const c = field.constraints ?? {};
  const max = c.maxFiles ?? 1;
  const cap = Math.min(c.maxSizeMb ?? 10, 10);
  const accept =
    c.accept && c.accept.length > 0
      ? c.accept.map((e) => `.${e}`).join(",")
      : undefined;

  const handleFile = async (file: File) => {
    if (!uploadUrl) {
      toast.error("La subida no está disponible");
      return;
    }
    if (
      c.accept &&
      c.accept.length > 0 &&
      !c.accept.map((e) => e.toLowerCase()).includes(fileExtension(file.name))
    ) {
      toast.error(`Formato no permitido (${c.accept.join(", ")})`);
      return;
    }
    if (file.size > cap * 1024 * 1024) {
      toast.error(`El archivo debe pesar menos de ${cap} MB`);
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("fieldId", field.id);
      const res = await fetch(uploadUrl, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message ?? "No se pudo subir el archivo");
        return;
      }
      onChange([...files, data as UploadedFile].slice(0, max));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {files.map((f, i) => (
        <div
          key={`${f.url}-${i}`}
          className="flex items-center gap-2 rounded-md border p-2 text-sm"
        >
          <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{f.name}</span>
          <span className="shrink-0 text-muted-foreground">
            {formatBytes(f.size)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto"
            aria-label="Quitar archivo"
            onClick={() => onChange(files.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
      {files.length < max && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading
              ? "Subiendo…"
              : files.length > 0
                ? "Agregar otro archivo"
                : "Subir archivo"}
          </Button>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        {c.accept && c.accept.length > 0
          ? c.accept.join(", ").toUpperCase()
          : "Cualquier formato"}{" "}
        · hasta {cap} MB{max > 1 ? ` · máximo ${max} archivos` : ""}
      </p>
    </div>
  );
}
