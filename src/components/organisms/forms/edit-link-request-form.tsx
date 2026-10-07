"use client";

import { AreaMaintenanceNotice } from "@/components/molecules/maintenance-notice";
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
import { useAreaWriteBlock } from "@/components/providers/maintenance";
import {
  editLinkRequestSchema,
  type EditLinkRequestInput,
} from "@/lib/schemas/events";
import { zodResolver } from "@hookform/resolvers/zod";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { MailCheck } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

/**
 * «Pedir un enlace nuevo» para gestionar una inscripción (milestone 25, S5). Un correo y el
 * captcha; el servidor manda un enlace por cada inscripción activa de ese correo. La pantalla de
 * confirmación dice lo mismo haya o no inscripciones (no revela si el correo estaba inscripto).
 */
export function EditLinkRequestForm() {
  const captchaRef = useRef<TurnstileInstance>(undefined);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const blockedByMaintenance = useAreaWriteBlock("events") !== null;

  const form = useForm<EditLinkRequestInput>({
    resolver: zodResolver(editLinkRequestSchema),
    defaultValues: { email: "", captcha: "" },
    mode: "onChange",
  });

  const onSubmit = async (data: EditLinkRequestInput) => {
    let res: Response;
    let body: { message?: string };
    try {
      res = await fetch("/api/forms/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      body = await res.json().catch(() => ({}));
    } catch (err) {
      console.error("[edit-link-request] failed", err);
      toast.error(
        "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.",
      );
      return;
    } finally {
      // El token de Turnstile es de un solo uso: lo consumió este pedido.
      form.setValue("captcha", "", { shouldValidate: true });
      captchaRef.current?.reset();
    }
    if (!res.ok) {
      toast.error(body.message ?? "No pudimos enviar el enlace");
      return;
    }
    setSentMessage(body.message ?? "Listo. Revisá tu correo.");
  };

  if (sentMessage) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-la-nube-accent text-la-nube-selected dark:bg-la-nube-selected/30 dark:text-la-nube-secondary">
          <MailCheck className="h-7 w-7" />
        </span>
        <h1 className="text-2xl font-bold">Revisá tu correo</h1>
        <p className="max-w-prose text-muted-foreground">{sentMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Pedir un enlace nuevo</h1>
        <p className="text-muted-foreground">
          Escribí el correo con el que te inscribiste. Te mandamos un enlace
          para ver, editar o cancelar cada inscripción activa.
        </p>
      </div>
      <AreaMaintenanceNotice area="events" />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Correo electrónico</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="captcha"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Turnstile
                    ref={captchaRef}
                    className="w-full overflow-hidden rounded-md"
                    siteKey={
                      process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY ??
                      "1x00000000000000000000AA"
                    }
                    options={{
                      action: "submit-form",
                      size: "flexible",
                      language: "es",
                    }}
                    scriptOptions={{ appendTo: "body" }}
                    onSuccess={(token) => field.onChange(token)}
                    onExpire={() => field.onChange("")}
                    onError={() => field.onChange("")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            variant="brand"
            className="w-full"
            disabled={
              blockedByMaintenance ||
              form.formState.isSubmitting ||
              !form.formState.isValid
            }
          >
            {form.formState.isSubmitting ? "Enviando…" : "Enviarme el enlace"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
