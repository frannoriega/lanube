"use client";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NO_ROLE_LABEL } from "@/lib/rbac";
import { type RoleOption } from "@/types/prisma";
import { type Column, type ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { type AdminUser } from "./types";
import { UserStatusBadge } from "@/components/atoms/status-badge";

const formatDate = (value: string | Date | number) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/** Roles are data now, so the row already carries its display name. */
const resolveRoleLabel = (role?: string | null) => role || NO_ROLE_LABEL;

// Was a local copy of the same status→color mapping three other files also had, with no
// dark: variants. Now one theme-aware component (F2.6).
const resolveStatusBadge = (status?: string | null) => (
  <UserStatusBadge status={status} />
);

interface DataTableColumnHeaderProps<TData> {
  column: Column<TData, unknown>;
  title: string;
}

function DataTableColumnHeader<TData>({
  column,
  title,
}: DataTableColumnHeaderProps<TData>) {
  if (!column.getCanSort()) {
    return (
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        {title}
      </span>
    );
  }

  const sorted = column.getIsSorted();

  return (
    <button
      type="button"
      className="flex items-center gap-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white cursor-pointer"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      <span>{title}</span>
      {sorted === "asc" ? (
        <ArrowUp className="h-3 w-3" />
      ) : sorted === "desc" ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-60" />
      )}
    </button>
  );
}

/** Sentinel for "no role" — Radix Select cannot hold an empty-string value. */
export const NO_ROLE_VALUE = "__none__";

export interface AdminUsersColumnsOptions {
  /** Show the role selector (holders of users:roles:manage). */
  canManageRoles: boolean;
  /** The viewer's RegisteredUser id — own role is never editable. */
  currentUserId: string | null;
  /** Assignable roles, loaded from /api/admin/roles/assignable. */
  roles: RoleOption[];
  onRoleChange: (user: AdminUser, roleId: string | null) => void;
}

export function buildAdminUsersColumns({
  canManageRoles,
  currentUserId,
  roles,
  onRoleChange,
}: AdminUsersColumnsOptions): ColumnDef<AdminUser>[] {
  const roleColumn: ColumnDef<AdminUser> = {
    accessorKey: "role",
    meta: { label: "Rol" },
    header: () => (
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        Rol
      </span>
    ),
    enableSorting: false,
    cell: ({ row }) => {
      const user = row.original;
      if (!canManageRoles || user.id === currentUserId) {
        return <Badge variant="secondary">{resolveRoleLabel(user.role)}</Badge>;
      }
      return (
        <Select
          value={user.roleId ?? NO_ROLE_VALUE}
          onValueChange={(value) =>
            onRoleChange(user, value === NO_ROLE_VALUE ? null : value)
          }
        >
          <SelectTrigger
            className="h-8 w-fit min-w-[150px]"
            aria-label={`Rol de ${user.name ?? user.email}`}
          >
            <SelectValue placeholder={NO_ROLE_LABEL} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_ROLE_VALUE}>{NO_ROLE_LABEL}</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    },
  };

  return adminUsersBaseColumns.map((column) =>
    "accessorKey" in column && column.accessorKey === "role"
      ? roleColumn
      : column,
  );
}

const adminUsersBaseColumns: ColumnDef<AdminUser>[] = [
  {
    accessorKey: "name",
    meta: { mobile: "title", label: "Nombre" },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nombre" />
    ),
    enableSorting: true,
    cell: ({ row }) => (
      <span className="font-medium text-slate-900 dark:text-slate-100">
        {row.original.name || "—"}
      </span>
    ),
  },
  {
    accessorKey: "lastName",
    meta: { mobile: "title", label: "Apellido" },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Apellido" />
    ),
    enableSorting: true,
    cell: ({ row }) => (
      <span className="text-slate-900 dark:text-slate-100">
        {row.original.lastName || "—"}
      </span>
    ),
  },
  {
    accessorKey: "email",
    meta: { label: "Correo" },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Correo" />
    ),
    enableSorting: true,
    cell: ({ row }) => (
      <span className="text-slate-600 dark:text-slate-300">
        {row.original.email}
      </span>
    ),
  },
  {
    accessorKey: "dni",
    meta: { label: "DNI" },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="DNI" />
    ),
    enableSorting: true,
    cell: ({ row }) => (
      <span className="text-slate-600 dark:text-slate-300">
        {row.original.dni ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "institution",
    meta: { label: "Institución" },
    header: () => (
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        Institución
      </span>
    ),
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-slate-600 dark:text-slate-300">
        {row.original.institution ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "role",
    meta: { label: "Rol" },
    header: () => (
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        Rol
      </span>
    ),
    enableSorting: false,
    cell: ({ row }) => (
      <Badge variant="secondary">{resolveRoleLabel(row.original.role)}</Badge>
    ),
  },
  {
    accessorKey: "status",
    meta: { mobile: "badge", label: "Estado" },
    header: () => (
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        Estado
      </span>
    ),
    enableSorting: false,
    cell: ({ row }) => resolveStatusBadge(row.original.status),
  },
  {
    accessorKey: "createdAt",
    meta: { label: "Fecha alta" },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Fecha alta" />
    ),
    enableSorting: true,
    cell: ({ row }) => (
      <span className="text-slate-600 dark:text-slate-300">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
];
