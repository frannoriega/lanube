"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Download, LifeBuoy, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

import { FormSection } from "@/components/molecules/form-layout";
import { LoadError } from "@/components/molecules/load-error";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { apiErrorMessage, apiSend } from "@/lib/api/client";
import { formatDate } from "@/lib/utils/date";

type Status = { total: number; remaining: number; generatedAt: number | null };

/** Con esta cantidad o menos, se sugiere generar un juego nuevo. */
const LOW_REMAINING = 2;

/**
 * Códigos de recuperación (milestone 17): la salida para quien olvidó su contraseña **y**
 * perdió acceso a su email. Se generan pidiendo la contraseña, se muestran una sola vez y
 * se canjean en el ingreso ("Olvidé mi contraseña" → "Usar un código de recuperación").
 */
export function RecoveryCodesSection() {
  const { data, error, firstTime, refetch } = useApi<Status>(
    "/api/user/recovery-codes",
  );
  const [open, setOpen] = useState(false);

  const has = (data?.total ?? 0) > 0;
  const low = has && (data?.remaining ?? 0) <= LOW_REMAINING;

  return (
    <FormSection
      title="Códigos de recuperación"
      description="Para entrar si olvidás tu contraseña y además perdés acceso a tu email."
    >
      {error && !data ? (
        <LoadError
          message="No pudimos cargar el estado de tus códigos."
          onRetry={() => void refetch()}
        />
      ) : firstTime || !data ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <div className="flex items-start gap-3 rounded-lg border p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <LifeBuoy className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="font-medium">
              {has
                ? `Te quedan ${data.remaining} de ${data.total} códigos`
                : "Todavía no generaste códigos"}
            </p>
            <p className="text-sm text-muted-foreground">
              {has && data.generatedAt
                ? `Generados el ${formatDate(new Date(data.generatedAt))}. Cada código sirve una sola vez.`
                : "Guardalos en un gestor de contraseñas o impresos, lejos de tu computadora."}
            </p>
            {low ? (
              <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300">
                <TriangleAlert className="h-4 w-4" aria-hidden />
                Te quedan pocos: generá un juego nuevo.
              </p>
            ) : null}
          </div>
        </div>
      )}

      <div>
        <Button
          variant={has ? "outline" : "default"}
          onClick={() => setOpen(true)}
          disabled={!data}
        >
          {has ? "Generar códigos nuevos" : "Generar códigos"}
        </Button>
      </div>

      <GenerateDialog
        open={open}
        regenerating={has}
        onOpenChange={setOpen}
        onGenerated={() => void refetch()}
      />
    </FormSection>
  );
}

const passwordSchema = z.object({
  password: z.string().min(1, { message: "Ingresá tu contraseña" }),
});

/**
 * Dos pasos en el mismo diálogo: (1) confirmar con la contraseña, (2) mostrar los códigos
 * con copiar/descargar y una casilla "Los guardé" que habilita "Listo".
 */
function GenerateDialog({
  open,
  regenerating,
  onOpenChange,
  onGenerated,
}: {
  open: boolean;
  regenerating: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: () => void;
}) {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "" },
  });

  useEffect(() => {
    if (open) {
      setCodes(null);
      setSaved(false);
      form.reset({ password: "" });
    }
  }, [open, form]);

  const onSubmit = async ({ password }: { password: string }) => {
    try {
      const res = await apiSend<{ codes: string[] }>(
        "/api/user/recovery-codes",
        "POST",
        { password },
      );
      setCodes(res.codes);
      onGenerated();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No pudimos generar los códigos"));
    }
  };

  const asText = () =>
    [
      "La Nube — códigos de recuperación",
      "Cada código sirve una sola vez.",
      "",
      ...(codes ?? []),
      "",
    ].join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText());
      toast.success("Códigos copiados");
    } catch {
      toast.error("No pudimos copiarlos: seleccionalos a mano");
    }
  };

  const download = () => {
    const blob = new Blob([asText()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "la-nube-codigos-de-recuperacion.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md">
        {!codes ? (
          <>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>
                {regenerating
                  ? "Generar códigos nuevos"
                  : "Generar códigos de recuperación"}
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                {regenerating
                  ? "Los códigos que tenés ahora van a dejar de funcionar. "
                  : ""}
                Para confirmar que sos vos, ingresá tu contraseña.
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña actual</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          {...field}
                        />
                      </FormControl>
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
                    {form.formState.isSubmitting ? "Generando…" : "Generar"}
                  </Button>
                </ResponsiveDialogFooter>
              </form>
            </Form>
          </>
        ) : (
          <>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Guardá tus códigos</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                Es la única vez que los vas a ver. Cada uno sirve una sola vez.
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <ul
              aria-label="Códigos de recuperación"
              className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border bg-muted/50 p-4 font-mono text-sm tabular-nums"
            >
              {codes.map((c) => (
                <li key={c} className="select-all">
                  {c}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void copy()}>
                <Copy className="h-4 w-4" aria-hidden />
                Copiar
              </Button>
              <Button variant="outline" size="sm" onClick={download}>
                <Download className="h-4 w-4" aria-hidden />
                Descargar .txt
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="recovery-saved"
                checked={saved}
                onCheckedChange={(v) => setSaved(v === true)}
              />
              <Label htmlFor="recovery-saved" className="font-normal">
                Los guardé en un lugar seguro
              </Label>
            </div>
            <ResponsiveDialogFooter>
              <Button onClick={() => onOpenChange(false)} disabled={!saved}>
                Listo
              </Button>
            </ResponsiveDialogFooter>
          </>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
