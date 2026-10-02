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
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, useStaticTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useApi } from "@/hooks/use-api";
import { apiErrorMessage, apiSend } from "@/lib/api/client";
import { type Permission } from "@/lib/rbac";
import { Lock, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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

export function RolesManager() {
  const { data, error, firstTime, refetch } =
    useApi<Role[]>("/api/admin/roles");
  const roles = data ?? [];
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);

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
            {/* Los roles del sistema no se editan: botón deshabilitado en vez de link. */}
            {role.isSystem ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled
                aria-label={`Editar ${role.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                asChild
                aria-label={`Editar ${role.name}`}
              >
                <Link href={`/admin/roles/${role.id}/edit`}>
                  <Pencil className="h-4 w-4" />
                </Link>
              </Button>
            )}
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
        {/* Milestone 14, propuesta 5: el rol se crea/edita en su propia página. */}
        <Button asChild className="shrink-0">
          <Link href="/admin/roles/new">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo rol
          </Link>
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
