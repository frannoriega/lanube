"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

import { useUserProfile } from "@/hooks/api";
import { apiErrorMessage } from "@/lib/api/client";
import { updateUserProfile } from "@/lib/api/mutations";
import { Skeleton } from "@/components/ui/skeleton";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  name: z
    .string()
    .min(3, { message: "El nombre debe tener al menos 3 caracteres" }),
  lastName: z
    .string()
    .min(3, { message: "El apellido debe tener al menos 3 caracteres" }),
  dni: z.coerce
    .number({ message: "Ingrese su DNI" })
    .min(0, { message: "El DNI debe ser un número positivo" })
    .max(999999999, { message: "El DNI debe tener menos de 9 dígitos" }),
  institution: z.string().optional(),
  reasonToJoin: z
    .string()
    .min(20, { message: "El motivo debe tener al menos 20 caracteres" })
    .max(500, { message: "El motivo debe tener menos de 500 caracteres" }),
});

type SettingsFormValues = z.infer<typeof formSchema>;

export default function SettingsPage() {
  const { data: user, firstTime, refetch } = useUserProfile();
  const [saving, setSaving] = useState(false);
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(formSchema) as Resolver<SettingsFormValues>,
    defaultValues: {
      name: "",
      lastName: "",
      dni: Number.NaN,
      institution: "",
      reasonToJoin: "",
    },
  });

  useEffect(() => {
    if (!user) return;
    form.reset({
      name: user.name || "",
      lastName: user.lastName || "",
      dni: user.dni ? Number(user.dni) : Number.NaN,
      institution: user.institution || "",
      reasonToJoin: user.reasonToJoin || "",
    });
  }, [user, form]);

  const onSubmit = async (values: SettingsFormValues) => {
    setSaving(true);

    try {
      await updateUserProfile({
        ...values,
        dni: values.dni.toString(),
      });
      toast.success("Perfil actualizado exitosamente");
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Error al actualizar el perfil"));
    } finally {
      setSaving(false);
    }
  };

  if (firstTime) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Configuración
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Gestiona tu información personal y preferencias
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Information */}
        <Card className="glass-card dark:glass-card-dark">
          <CardHeader>
            <CardTitle>Información Personal</CardTitle>
            <CardDescription>Actualiza tu información personal</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input placeholder="Tu nombre" {...field} />
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
                          <Input placeholder="Tu apellido" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="dni"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>DNI</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          placeholder="Número de documento"
                          value={
                            Number.isNaN(field.value) ? "" : (field.value ?? "")
                          }
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            field.onChange(
                              nextValue === "" ? Number.NaN : Number(nextValue),
                            );
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="institution"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Institución (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Universidad, empresa, etc."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reasonToJoin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motivo para unirse</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Cuéntanos por qué quieres usar La Nube..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card className="glass-card dark:glass-card-dark">
          <CardHeader>
            <CardTitle>Información de Cuenta</CardTitle>
            <CardDescription>Detalles de tu cuenta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                value={user?.displayEmail ?? user?.email ?? ""}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                El email no se puede cambiar
              </p>
            </div>

            <div>
              <Label>Fecha de registro</Label>
              <Input
                value={
                  user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : ""
                }
                disabled
                className="bg-gray-50"
              />
            </div>

            <div>
              <Label>Rol</Label>
              <Input
                value={user?.role === "ADMIN" ? "Administrador" : "Usuario"}
                disabled
                className="bg-gray-50"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
