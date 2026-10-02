"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
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
import { DataTable, useStaticTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { apiErrorMessage, apiSend } from "@/lib/api/client";
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  type Permission,
} from "@/lib/rbac";
import { roleInputSchema, type RoleInput } from "@/lib/schemas/config";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

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

export function RolesManager() {
  const { data, error, firstTime, refetch } =
    useApi<Role[]>("/api/admin/roles");
  const roles = data ?? [];
  const [editing, setEditing] = useState<Role | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm<RoleInput>({
    resolver: zodResolver(roleInputSchema),
    defaultValues: EMPTY,
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditing(role);
    form.reset({
      name: role.name,
      description: role.description ?? "",
      permissions: role.permissions,
      grantableRoleIds: role.grantableRoleIds,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: RoleInput) => {
    setBusy(true);
    try {
      if (editing) {
        await apiSend(`/api/admin/roles/${editing.id}`, "PUT", values);
        toast.success("Rol actualizado");
      } else {
        await apiSend("/api/admin/roles", "POST", values);
        toast.success("Rol creado");
      }
      setDialogOpen(false);
      await refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo guardar el rol"));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiSend(`/api/admin/roles/${deleting.id}`, "DELETE");
      toast.success("Rol eliminado");
      setDeleting(null);
      await refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo eliminar el rol"));
    } finally {
      setBusy(false);
    }
  };

  /*
   * Columnas del `DataTable` (milestone 14): tabla desde `md`, tarjetas por debajo. Cada
   * columna declara su rol en la tarjeta con `meta.mobile` (ver `MobileColumnRole`).
   */
  const columns: ColumnDef<(typeof roles)[number]>[] = [
    {
      id: "role",
      header: "Rol",
      meta: { mobile: "title", label: "Rol" },
      cell: ({ row }) => {
        const role = row.original;
        return (
          <div>
            <div className="flex flex-wrap items-center gap-2 font-medium">
              {role.name}
              {role.isSystem && (
                <Badge
                  variant="outline"
                  className="gap-1 font-normal"
                  title="Rol del sistema: no se puede editar ni eliminar"
                >
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  Sistema
                </Badge>
              )}
            </div>
            {role.description && (
              <p className="mt-1 max-w-prose text-sm font-normal text-muted-foreground">
                {role.description}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: "permissions",
      header: "Permisos",
      meta: { label: "Permisos" },
      cell: ({ row }) => {
        const role = row.original;
        return role.isSuperadmin ? (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <ShieldCheck
              className="h-4 w-4 text-la-nube-selected dark:text-la-nube-secondary"
              aria-hidden="true"
            />
            Todos los permisos
          </span>
        ) : role.permissions.length === 0 ? (
          <span className="text-sm text-muted-foreground">
            Sin permisos de administración
          </span>
        ) : (
          <span className="text-sm">
            {role.permissions.length} permiso
            {role.permissions.length === 1 ? "" : "s"}
          </span>
        );
      },
    },
    {
      id: "users",
      header: "Usuarios",
      meta: { label: "Usuarios" },
      cell: ({ row }) => row.original.userCount,
    },
    {
      id: "actions",
      header: () => <div className="text-right">Acciones</div>,
      meta: { mobile: "actions", label: "Acciones" },
      cell: ({ row }) => {
        const role = row.original;
        return (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={role.isSystem}
              onClick={() => openEdit(role)}
              aria-label={`Editar ${role.name}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={role.isSystem || role.userCount > 0}
              onClick={() => setDeleting(role)}
              aria-label={`Eliminar ${role.name}`}
              title={
                role.userCount > 0
                  ? "Reasigná a los usuarios antes de eliminar el rol"
                  : undefined
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];
  const table = useStaticTable(roles, columns);

  return (
    <Card className="glass-card dark:glass-card-dark">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Roles</CardTitle>
          <CardDescription>
            Cada rol agrupa permisos del catálogo de la aplicación. Los roles
            del sistema no se pueden editar ni eliminar.
          </CardDescription>
        </div>
        <Button type="button" onClick={openCreate} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo rol
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
            No se pudo cargar la lista de roles.
          </div>
        )}

        {firstTime ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <DataTable
            table={table}
            emptyMessage="Todavía no hay roles definidos."
          />
        )}
      </CardContent>

      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ResponsiveDialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {editing ? "Editar rol" : "Nuevo rol"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Elegí qué puede hacer este rol. Los permisos son los que la
              aplicación verifica realmente; no se pueden inventar nuevos desde
              acá.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6"
              noValidate
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

              <FormField
                control={form.control}
                name="permissions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Permisos</FormLabel>
                    <div className="space-y-5">
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

              <FormField
                control={form.control}
                name="grantableRoleIds"
                render={({ field }) => {
                  const options = roles.filter(
                    (r) => !r.isSuperadmin && r.id !== editing?.id,
                  );
                  return (
                    <FormItem>
                      <FormLabel>Puede otorgar estos roles</FormLabel>
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

              <ResponsiveDialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={busy}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Guardando…" : "Guardar"}
                </Button>
              </ResponsiveDialogFooter>
            </form>
          </Form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Eliminar rol</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              ¿Eliminar «{deleting?.name}»? Esta acción no se puede deshacer.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              disabled={busy}
            >
              {busy ? "Eliminando…" : "Eliminar"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </Card>
  );
}
