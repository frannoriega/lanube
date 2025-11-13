"use client"

import { Badge } from "@/components/ui/badge"
import { type Column, type ColumnDef } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import { type AdminUser } from "./types"

const formatDate = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "—"
  }

  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const resolveRoleLabel = (role?: string | null) => {
  switch (role) {
    case "ADMIN":
      return "Administrador"
    case "STAFF":
      return "Equipo"
    case "USER":
      return "Usuario"
    default:
      return role ?? "Sin rol"
  }
}

const resolveStatusBadge = (status?: string | null) => {
  if (!status) {
    return <Badge variant="outline">Sin estado</Badge>
  }

  const normalized = status.toUpperCase()

  if (normalized === "ACTIVE") {
    return <Badge className="bg-green-100 text-green-800">Activo</Badge>
  }

  if (normalized === "INACTIVE" || normalized === "BANNED") {
    return (
      <Badge className="bg-red-100 text-red-700">
        {normalized === "BANNED" ? "Bloqueado" : "Inactivo"}
      </Badge>
    )
  }

  return <Badge variant="outline">{status}</Badge>
}

interface DataTableColumnHeaderProps<TData> {
  column: Column<TData, unknown>
  title: string
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
    )
  }

  const sorted = column.getIsSorted()

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
  )
}

export const adminUsersColumns: ColumnDef<AdminUser>[] = [
  {
    accessorKey: "name",
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
]

