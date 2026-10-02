"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormSection } from "@/components/molecules/form-layout";
import { LoadError } from "@/components/molecules/load-error";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useUserProfile } from "@/hooks/api";
import { apiErrorMessage, invalidateApi } from "@/lib/api/client";
import { updateUserProfile } from "@/lib/api/mutations";
import {
  personalInfoSchema,
  type PersonalInfoInput,
} from "@/lib/schemas/profile";

/**
 * Configuración → Perfil: lo único del perfil que el usuario cambia por su cuenta.
 * El DNI y el motivo viven en "Identidad", porque solo cambian con aprobación.
 */
export default function ProfileSettingsPage() {
  const { data: user, error, firstTime, refetch } = useUserProfile();
  const form = useForm<PersonalInfoInput>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: { name: "", lastName: "", institution: "" },
  });

  useEffect(() => {
    if (!user) return;
    form.reset({
      name: user.name ?? "",
      lastName: user.lastName ?? "",
      institution: user.institution ?? "",
    });
  }, [user, form]);

  const onSubmit = async (values: PersonalInfoInput) => {
    try {
      await updateUserProfile(values);
      toast.success("Perfil actualizado");
      // El nombre también se muestra en el header (menú de usuario).
      invalidateApi("/api/user");
      await refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No pudimos guardar los cambios"));
    }
  };

  if (error && !user) {
    return (
      <LoadError
        message="No pudimos cargar tu perfil."
        onRetry={() => void refetch()}
      />
    );
  }

  if (firstTime) {
    return <Skeleton className="h-80 w-full rounded-xl" />;
  }

  const { isDirty, isSubmitting } = form.formState;

  return (
    <>
      <FormSection
        title="Datos personales"
        description="Así te ve el equipo de La Nube en reservas, eventos y check-in."
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input autoComplete="given-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apellido</FormLabel>
                    <FormControl>
                      <Input autoComplete="family-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="institution"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Institución</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="organization"
                      placeholder="Universidad, empresa, etc."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Opcional.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex flex-wrap items-center gap-3 border-t pt-4">
              <Button type="submit" disabled={!isDirty || isSubmitting}>
                {isSubmitting ? "Guardando…" : "Guardar cambios"}
              </Button>
              {isDirty && !isSubmitting ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => form.reset()}
                >
                  Descartar
                </Button>
              ) : null}
            </div>
          </form>
        </Form>
      </FormSection>

      <Link
        href="/user/settings/identity"
        className="group flex items-center justify-between gap-4 rounded-xl border border-dashed p-4 text-sm transition-colors hover:bg-muted/50"
      >
        <span>
          <span className="font-medium">
            ¿Necesitás cambiar tu DNI o tu motivo?
          </span>
          <span className="block text-muted-foreground">
            Esos datos se cambian con una solicitud que revisa el equipo.
          </span>
        </span>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </>
  );
}
