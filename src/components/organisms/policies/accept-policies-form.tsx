"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { ApiError, apiErrorMessage, apiSend } from "@/lib/api/client";
import { policyAcceptanceSchema } from "@/lib/schemas/auth";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2 } from "lucide-react";
import { getSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import {
  allPoliciesChecked,
  PolicyCheckboxes,
  type PolicyToAccept,
} from "./policy-checkboxes";

/**
 * El formulario de `/policies/accept` (milestone 19): un checkbox por política pendiente,
 * "Aceptar y continuar" y "Cerrar sesión". No hay "más tarde": el pedido es que no se pueda
 * seguir usando el sistema sin aceptar.
 *
 * Después de aceptar (o si al llegar ya no había nada pendiente, p. ej. porque se aceptó en
 * otra pestaña) se pide `/api/auth/session` con `getSession()`: eso hace correr el `jwt()`,
 * que recalcula `policiesPending` desde la base, y **reescribe la cookie**. Recién entonces se
 * navega — con navegación completa, para que el middleware lea la cookie nueva. Sin ese paso,
 * el middleware vería la cookie vieja y mandaría de vuelta al gate en un loop.
 */
export function AcceptPoliciesForm({
  policies,
  next,
}: {
  policies: PolicyToAccept[];
  /** A dónde volver, ya validado en el servidor (`safeGateNext`). */
  next: string;
}) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  const schema = z
    .object({ accepted: z.array(policyAcceptanceSchema) })
    .refine((d) => allPoliciesChecked(policies, d.accepted), {
      message: "Tenés que aceptar cada política para continuar",
      path: ["accepted"],
    });
  const form = useForm<z.infer<typeof schema>>({
    resolver: standardSchemaResolver(schema),
    defaultValues: { accepted: [] },
  });

  /** Reescribe la cookie de sesión con el estado de la base y sale del gate. */
  const leave = async () => {
    setLeaving(true);
    try {
      await getSession();
    } finally {
      window.location.assign(next);
    }
  };

  // Nada pendiente (aceptó en otra pestaña, o la cookie estaba atrasada): salir solo.
  const autoLeft = useRef(false);
  useEffect(() => {
    if (policies.length === 0 && !autoLeft.current) {
      autoLeft.current = true;
      void leave();
    }
    // `leave` no cambia nada que este efecto necesite volver a mirar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policies.length]);

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      await apiSend("/api/policies/accept", "POST", {
        accepted: data.accepted,
      });
    } catch (err) {
      toast.error(
        apiErrorMessage(
          err,
          "No pudimos registrar tu aceptación. Probá de nuevo.",
        ),
      );
      // 409: una política cambió mientras la leía. Se recarga la pantalla (el servidor vuelve
      // a calcular lo pendiente) y se destilda todo, para que lea y acepte la versión nueva.
      if (err instanceof ApiError && err.status === 409) {
        form.reset({ accepted: [] });
        router.refresh();
      }
      return;
    }
    await leave();
  };

  if (policies.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Ya está todo al día. Te llevamos de vuelta…
      </p>
    );
  }

  const busy = form.formState.isSubmitting || leaving;
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-6"
      >
        <FormField
          control={form.control}
          name="accepted"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <PolicyCheckboxes
                  policies={policies}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={busy}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          >
            Cerrar sesión
          </Button>
          <Button type="submit" variant="brand" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Aceptar y continuar
          </Button>
        </div>
      </form>
    </Form>
  );
}
