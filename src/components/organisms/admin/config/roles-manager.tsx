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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  userCount: number;
};

const EMPTY: RoleInput = { name: "", description: "", permissions: [] };

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

  return (
    <Card className="glass-card dark:glass-card-dark">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rol</TableHead>
                  <TableHead>Permisos</TableHead>
                  <TableHead>Usuarios</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.length === 0 && !error && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      Todavía no hay roles definidos.
                    </TableCell>
                  </TableRow>
                )}
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
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
                        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                          {role.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {role.isSuperadmin ? (
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
                      )}
                    </TableCell>
                    <TableCell>{role.userCount}</TableCell>
                    <TableCell className="text-right">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar rol" : "Nuevo rol"}</DialogTitle>
            <DialogDescription>
              Elegí qué puede hacer este rol. Los permisos son los que la
              aplicación verifica realmente; no se pueden inventar nuevos desde
              acá.
            </DialogDescription>
          </DialogHeader>
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

              <DialogFooter>
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
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar rol</DialogTitle>
            <DialogDescription>
              ¿Eliminar «{deleting?.name}»? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
