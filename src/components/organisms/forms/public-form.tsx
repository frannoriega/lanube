"use client";

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
import { PublicFormField, validateAnswers } from "@/lib/events/answers";
import { registerEmailSchema } from "@/lib/schemas/auth";
import { FormFieldType } from "@/types/prisma";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

interface PublicFormProps {
  fields: PublicFormField[];
  eventName: string;
  eventDescription?: string | null;
  eventImageUrl?: string | null;
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
  fields,
  eventName,
  eventDescription,
  eventImageUrl,
  notice,
  mode,
  slug,
  token,
  initialEmail,
  initialAnswers,
}: PublicFormProps) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);

  // Zod schema for shadcn Form: the email rule reuses the registration schema; the dynamic
  // per-field answer rules reuse the same `validateAnswers` the server uses (single source).
  const schema = useMemo(
    () =>
      z
        .object({
          // Edit mode: email is disabled + pre-filled, so it only needs to be a string.
          email: mode === "submit" ? registerEmailSchema : z.string(),
          answers: z.record(z.string(), z.unknown()),
        })
        .superRefine((value, ctx) => {
          const { errors } = validateAnswers(fields, value.answers);
          for (const [fieldId, message] of Object.entries(errors)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message,
              path: ["answers", fieldId],
            });
          }
        }),
    [fields, mode],
  );

  const form = useForm<PublicFormValues>({
    resolver: zodResolver(schema),
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
        for (const [fieldId, message] of Object.entries(err.errors)) {
          form.setError(`answers.${fieldId}`, {
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

        {fields.map((f) => (
          <FormField
            key={f.id}
            control={form.control}
            name={`answers.${f.id}`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {f.label}
                  {f.required && <span className="text-destructive"> *</span>}
                </FormLabel>
                <FormControl>
                  <FieldInput
                    field={f}
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}

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

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: PublicFormField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const str = typeof value === "string" ? value : "";

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

    case FormFieldType.NUMBER:
      return (
        <Input
          type="number"
          value={str}
          placeholder={field.placeholder ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
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
