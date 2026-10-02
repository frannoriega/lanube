"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/api/client";
import { createProfileChangeRequest } from "@/lib/api/mutations";
import {
  changeJustificationSchema,
  dniSchema,
  reasonToJoinSchema,
  sanitizeDni,
  PROFILE_CHANGE_FIELD_LABELS,
  type ProfileChangeFieldKey,
} from "@/lib/schemas/profile";

/**
 * Diálogo para pedir un cambio de DNI o de motivo (milestone 17). Tiene pocos campos y
 * ningún editor rico, así que es un diálogo (cajón abajo en el teléfono) y no una página
 * (regla de CLAUDE.md §13).
 *
 * El formulario usa un único campo de texto `requestedValue` para los dos casos; el DNI se
 * valida contra `dniSchema` convirtiéndolo a número, igual que el servidor.
 */
const dialogSchema = (field: ProfileChangeFieldKey, current: string) =>
  z
    .object({
      requestedValue:
        field === "DNI"
          ? z
              .string()
              .min(1, { message: "Ingresá el DNI correcto" })
              .refine((v) => dniSchema.safeParse(Number(v)).success, {
                message: "Ingrese un DNI válido (solo números)",
              })
          : reasonToJoinSchema,
      justification: changeJustificationSchema,
    })
    .refine((v) => v.requestedValue.trim() !== current.trim(), {
      message: "Es igual al valor actual",
      path: ["requestedValue"],
    });

type DialogValues = { requestedValue: string; justification: string };

const COPY: Record<
  ProfileChangeFieldKey,
  { title: string; valueLabel: string; justificationHint: string }
> = {
  DNI: {
    title: "Solicitar cambio de DNI",
    valueLabel: "DNI correcto",
    justificationHint:
      "Por ejemplo: «Me equivoqué un dígito al registrarme». Si hace falta, el equipo te va a pedir el documento en el check-in.",
  },
  REASON_TO_JOIN: {
    title: "Solicitar cambio de motivo",
    valueLabel: "Nuevo motivo para unirte",
    justificationHint:
      "Por ejemplo: «Cambié de proyecto y ahora uso el espacio para otra cosa».",
  },
};

export function ChangeRequestDialog({
  field,
  currentValue,
  open,
  onOpenChange,
  onCreated,
}: {
  field: ProfileChangeFieldKey;
  currentValue: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const copy = COPY[field];
  const form = useForm<DialogValues>({
    resolver: zodResolver(dialogSchema(field, currentValue)),
    defaultValues: {
      // El motivo arranca con el actual (se suele ajustar, no reescribir); el DNI vacío.
      requestedValue: field === "REASON_TO_JOIN" ? currentValue : "",
      justification: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        requestedValue: field === "REASON_TO_JOIN" ? currentValue : "",
        justification: "",
      });
    }
  }, [open, field, currentValue, form]);

  const onSubmit = async (values: DialogValues) => {
    try {
      await createProfileChangeRequest({
        field,
        requestedValue: values.requestedValue.trim(),
        justification: values.justification.trim(),
      });
      toast.success("Solicitud enviada. Te avisamos acá cuando la revisen.");
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No pudimos enviar la solicitud"));
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{copy.title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Alguien del equipo revisa el pedido y lo aprueba o lo rechaza. Hasta
            entonces, tu {PROFILE_CHANGE_FIELD_LABELS[field].toLowerCase()}{" "}
            sigue siendo el actual.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">Actual: </span>
              <span className="break-words">{currentValue}</span>
            </div>
            <FormField
              control={form.control}
              name="requestedValue"
              render={({ field: input }) => (
                <FormItem>
                  <FormLabel>{copy.valueLabel}</FormLabel>
                  <FormControl>
                    {field === "DNI" ? (
                      <Input
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Solo números"
                        {...input}
                        onChange={(e) =>
                          input.onChange(sanitizeDni(e.target.value))
                        }
                      />
                    ) : (
                      <Textarea rows={4} {...input} />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="justification"
              render={({ field: input }) => (
                <FormItem>
                  <FormLabel>¿Por qué lo necesitás cambiar?</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...input} />
                  </FormControl>
                  <FormDescription>{copy.justificationHint}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <ResponsiveDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Enviando…" : "Enviar solicitud"}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </Form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
