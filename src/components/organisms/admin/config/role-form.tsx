"use client";

/**
 * Formulario de rol **como página** (milestone 14, propuesta 5). Antes era un diálogo con
 * nombre, descripción y ~20 checkboxes de permisos que en el teléfono obligaba a scrollear
 * dentro de un modal. Vive en `/admin/roles/new` y `/admin/roles/[id]/edit`.
 *
 * Secciones: *Rol* (nombre, descripción) · *Permisos* (agrupados por área, en dos columnas
 * desde `lg`) · *Puede otorgar estos roles*. Barra de guardado pegada abajo + guardia de
 * cambios sin guardar.
 *
 * Los datos salen de `GET /api/admin/roles` (la lista), que hace falta igual para las
 * opciones de "Puede otorgar"; no hay un GET por id. Un rol del sistema no se puede editar
 * (la API lo rechaza con 403), así que la página lo muestra como aviso en vez del formulario.
 */

import { FormSection, StickySaveBar } from "@/components/molecules/form-layout";
import { LoadError } from "@/components/molecules/load-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import {
  UnsavedChangesDialog,
  useUnsavedChangesGuard,
} from "@/hooks/use-unsaved-changes-guard";
import { apiErrorMessage, apiSend, invalidateApi } from "@/lib/api/client";
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  type Permission,
} from "@/lib/rbac";
import { roleInputSchema, type RoleInput } from "@/lib/schemas/config";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const LIST_URL = "/admin/roles";

/** Fila de `GET /api/admin/roles`. */
type Role = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isSuperadmin: boolean;
  permissions: Permission[];
  grantableRoleIds: string[];
  userCount: number;
};

const EMPTY: RoleInput = {
  name: "",
  description: "",
  permissions: [],
  grantableRoleIds: [],
};

export function RoleForm({ roleId }: { roleId?: string }) {
  const router = useRouter();
  const { data, error, firstTime, refetch } =
    useApi<Role[]>("/api/admin/roles");
  const roles = data ?? [];
  const editing = roleId ? (roles.find((r) => r.id === roleId) ?? null) : null;
  const [busy, setBusy] = useState(false);

  const form = useForm<RoleInput>({
    resolver: zodResolver(roleInputSchema),
    defaultValues: EMPTY,
  });
  const guard = useUnsavedChangesGuard(form.formState.isDirty && !busy);

  // Al llegar los datos (o cambiar de rol), cargar sus valores como estado "limpio".
  const editingId = editing?.id;
  useEffect(() => {
    if (!editing) return;
    form.reset({
      name: editing.name,
      description: editing.description ?? "",
      permissions: editing.permissions,
      grantableRoleIds: editing.grantableRoleIds,
    });
    // Solo al cambiar de rol: re-resetear en cada refetch pisaría lo que se está editando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  const onSubmit = async (values: RoleInput) => {
    setBusy(true);
    try {
      if (roleId) {
        await apiSend(`/api/admin/roles/${roleId}`, "PUT", values);
        toast.success("Rol actualizado");
      } else {
        await apiSend("/api/admin/roles", "POST", values);
        toast.success("Rol creado");
      }
      invalidateApi("/api/admin/roles");
      guard.release();
      router.push(LIST_URL);
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo guardar el rol"));
      setBusy(false);
    }
  };

  if (error) {
    return (
      <LoadError
        message="No se pudo cargar la lista de roles."
        onRetry={() => void refetch()}
      />
    );
  }
  if (firstTime) {
    return (
      <div className="max-w-4xl space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }
  if (roleId && !editing) {
    return (
      <p className="text-sm text-muted-foreground">
        Ese rol no existe (o fue eliminado).
      </p>
    );
  }
  if (editing?.isSystem) {
    return (
      <div className="flex max-w-2xl items-start gap-3 rounded-lg border p-4 text-sm">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          <span className="font-medium">{editing.name}</span> es un rol del
          sistema: no se puede editar ni eliminar.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        {/* Ancho máximo en el contenido, no en el `<form>`: la barra de guardar ocupa todo el
            ancho del área (ver `StickySaveBar`). */}
        <div className="max-w-4xl space-y-6">
          <FormSection
            id="rol"
            title="Rol"
            description="Cómo se llama y para qué existe."
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Coordinador de eventos" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Para qué existe este rol."
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>Opcional.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSection>

          <FormSection
            id="permisos"
            title="Permisos"
            description="Qué puede hacer este rol. Son los que la aplicación verifica realmente; no se pueden inventar nuevos desde acá."
          >
            <FormField
              control={form.control}
              name="permissions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Permisos</FormLabel>
                  <div className="grid gap-6 lg:grid-cols-2">
                    {PERMISSION_GROUPS.map((group) => (
                      <fieldset key={group.label} className="space-y-2">
                        <legend className="text-sm font-medium">
                          {group.label}
                        </legend>
                        <p className="text-sm text-muted-foreground">
                          {group.description}
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {group.permissions.map((permission) => {
                            const checked = field.value.includes(permission);
                            const id = `permission-${permission}`;
                            return (
                              <div
                                key={permission}
                                className="flex items-center gap-2 rounded-md border border-border p-2"
                              >
                                <Checkbox
                                  id={id}
                                  checked={checked}
                                  onCheckedChange={(
                                    next: boolean | "indeterminate",
                                  ) => {
                                    field.onChange(
                                      next === true
                                        ? [...field.value, permission]
                                        : field.value.filter(
                                            (value) => value !== permission,
                                          ),
                                    );
                                  }}
                                />
                                <label
                                  htmlFor={id}
                                  className="cursor-pointer text-sm leading-tight"
                                >
                                  {PERMISSION_LABELS[permission]}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                  <FormDescription>
                    Sin «Acceder al panel» el rol no puede entrar a /admin,
                    aunque tenga otros permisos.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSection>

          <FormSection
            id="otorgables"
            title="Puede otorgar estos roles"
            description="A qué roles puede ascender o reasignar usuarios quien tenga este rol."
          >
            <FormField
              control={form.control}
              name="grantableRoleIds"
              render={({ field }) => {
                const options = roles.filter(
                  (r) => !r.isSuperadmin && r.id !== roleId,
                );
                return (
                  <FormItem>
                    <FormLabel className="sr-only">
                      Puede otorgar estos roles
                    </FormLabel>
                    <FormDescription>
                      Quien tenga este rol y el permiso «Gestionar roles de
                      usuarios» solo podrá ascender/reasignar usuarios a los
                      roles marcados acá. El rol superadmin nunca aparece en
                      esta lista: se otorga a mano en la base de datos.
                    </FormDescription>
                    {options.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No hay otros roles todavía.
                      </p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {options.map((option) => {
                          const checked = field.value.includes(option.id);
                          const id = `grantable-${option.id}`;
                          return (
                            <div
                              key={option.id}
                              className="flex items-center gap-2 rounded-md border border-border p-2"
                            >
                              <Checkbox
                                id={id}
                                checked={checked}
                                onCheckedChange={(
                                  next: boolean | "indeterminate",
                                ) => {
                                  field.onChange(
                                    next === true
                                      ? [...field.value, option.id]
                                      : field.value.filter(
                                          (value) => value !== option.id,
                                        ),
                                  );
                                }}
                              />
                              <label
                                htmlFor={id}
                                className="cursor-pointer text-sm leading-tight"
                              >
                                {option.name}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          </FormSection>
        </div>

        <StickySaveBar className="mt-6" dirty={form.formState.isDirty}>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(LIST_URL)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Guardando…" : roleId ? "Guardar cambios" : "Crear rol"}
          </Button>
        </StickySaveBar>
      </form>
      <UnsavedChangesDialog guard={guard} />
    </Form>
  );
}
