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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowDown, ArrowUp, ArrowUpDown, Info } from "lucide-react";
import { useRef, useState } from "react";

import { type AdminUser } from "./types";
import { ToneBadge, UserStatusBadge } from "@/components/atoms/status-badge";

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

/**
 * Las versiones de una política son fechas ISO (`"2025-11-16"`, ver `policies/registry.ts`):
 * se muestran como `16/11/2025`, sin pasar por `Date` (no es un instante, no hay zona horaria).
 * Un valor que no tenga esa forma se muestra tal cual.
 */
const formatPolicyVersion = (version: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(version);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : version;
};

/** Texto de ayuda del encabezado «Políticas» (redacción pedida por el usuario, milestone 29). */
const POLICIES_COLUMN_HELP =
  "Indica si la persona aceptó la versión vigente de las políticas.";

/**
 * Badge de la columna «Políticas» con una tarjeta flotante de detalle (milestone 29): qué
 * versión aceptó de cada política y cuándo, y cuáles le faltan. Se abre al pasar el mouse y
 * también al tocar o con Enter/Espacio (un tooltip no llega a pantallas táctiles ni a teclado).
 */
function PolicyStatusCell({ user }: { user: AdminUser }) {
  const [open, setOpen] = useState(false);
  const upToDate = user.policies === "UP_TO_DATE";
  const { accepted, pending } = user.policyDetail;
  // Solo el mouse abre/cierra al pasar: en una pantalla táctil el navegador emula
  // `mouseenter` antes del click, y la tarjeta se abría y se cerraba en el mismo toque.
  const hovering = useRef(false);
  const hover = (next: boolean) => (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    hovering.current = next;
    setOpen(next);
  };
  return (
    <Popover
      open={open}
      // Con el mouse encima, un click no la cierra (ya estaba abierta por el hover).
      onOpenChange={(next) => {
        if (!next && hovering.current) return;
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onPointerEnter={hover(true)}
          onPointerLeave={hover(false)}
          aria-label={`Políticas: ${upToDate ? "al día" : "pendiente"}. Ver detalle`}
        >
          <ToneBadge tone={upToDate ? "success" : "warning"}>
            {upToDate ? "Al día" : "Pendiente"}
          </ToneBadge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 space-y-3 text-sm"
        // Al abrir con el mouse, que el foco no salte a la tarjeta.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
      >
        {pending.length > 0 && (
          <div className="space-y-1">
            <p className="font-medium">Tiene que aceptar</p>
            <ul className="space-y-0.5 text-muted-foreground">
              {pending.map((p) => (
                <li key={p.key}>
                  {p.title} (versión del {formatPolicyVersion(p.version)})
                </li>
              ))}
            </ul>
          </div>
        )}
        {accepted.length > 0 ? (
          <div className="space-y-1">
            <p className="font-medium">Aceptó</p>
            <ul className="space-y-0.5 text-muted-foreground">
              {accepted.map((a) => (
                <li key={a.key}>
                  {a.title} (versión del {formatPolicyVersion(a.version)}), el{" "}
                  {formatDate(a.acceptedAt)}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-muted-foreground">Nunca aceptó las políticas.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

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
      // Un rol actual que no está entre los asignables (el superadmin, o uno que el rol de
      // quien mira no puede otorgar) no se puede cambiar: el servidor lo rechaza con 403.
      const roleLocked =
        user.roleId != null && !roles.some((r) => r.id === user.roleId);
      if (!canManageRoles || user.id === currentUserId || roleLocked) {
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
    // Identifica la fila: no se ofrece en el selector de columnas (milestone 29).
    enableHiding: false,
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
    // Milestone 19: si la cuenta aceptó las políticas vigentes. "Pendiente" incluye a las
    // cuentas creadas antes del milestone que todavía no volvieron a entrar.
    // Milestone 29: los admins leían «Pendiente» como «no terminó el registro». El encabezado
    // explica la columna y la celda es solo el badge, con el detalle en una tarjeta flotante.
    accessorKey: "policies",
    meta: { label: "Políticas" },
    header: () => (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="flex cursor-help items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
          >
            Políticas
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">: {POLICIES_COLUMN_HELP}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{POLICIES_COLUMN_HELP}</TooltipContent>
      </Tooltip>
    ),
    enableSorting: false,
    cell: ({ row }) => <PolicyStatusCell user={row.original} />,
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
