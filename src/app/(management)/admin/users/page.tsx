"use client"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { DataTable, DataTablePagination } from "@/components/ui/data-table"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    getCoreRowModel,
    type PaginationState,
    type SortingState,
    useReactTable,
} from "@tanstack/react-table"
import { RefreshCw, Search, Users as UsersIcon } from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { adminUsersColumns } from "./columns"
import { type AdminUser } from "./types"

type UsersResponse = {
  users?: AdminUser[]
  data?: AdminUser[]
  pagination?: {
    page?: number
    pageSize?: number
    totalPages?: number
    totalUsers?: number
    orderBy?: string
    orderDirection?: "asc" | "desc"
    search?: string
  }
  meta?: {
    page?: number
    pageSize?: number
    totalPages?: number
    totalUsers?: number
  }
  page?: number
  pageSize?: number
  totalPages?: number
  totalUsers?: number
  summary?: {
    totalUsers: number
    activeUsers: number
    bannedUsers: number
    monthUsers: number
  }
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

export default function AdminUsersPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE_OPTIONS[0],
  })
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: false },
  ])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [summary, setSummary] = useState({
    totalUsers: 0,
    activeUsers: 0,
    bannedUsers: 0,
    monthUsers: 0,
  })

  const { pageIndex, pageSize } = pagination
  const effectiveSorting = sorting[0]

  useEffect(() => {
    const handler = setTimeout(() => {
      const trimmed = searchInput.trim()
      setSearchQuery((prev) => {
        if (prev === trimmed) {
          return prev
        }

        setPagination((prevPagination) =>
          prevPagination.pageIndex === 0
            ? prevPagination
            : { ...prevPagination, pageIndex: 0 }
        )

        return trimmed
      })
    }, 400)

    return () => clearTimeout(handler)
  }, [searchInput, setPagination])

  const fetchUsers = useCallback(
    async ({ signal }: { signal?: AbortSignal } = {}) => {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          page: String(pageIndex + 1),
          pageSize: String(pageSize),
        })

        if (effectiveSorting?.id) {
          params.append("orderBy", effectiveSorting.id)
          params.append(
            "orderDirection",
            effectiveSorting.desc ? "desc" : "asc"
          )
        }

        if (searchQuery.trim()) {
          params.append("search", searchQuery.trim())
        }

        const response = await fetch(`/api/admin/users?${params.toString()}`, {
          signal,
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error("No se pudo obtener la lista de usuarios")
        }

        const body: UsersResponse = await response.json()
        const list = body.users ?? body.data ?? []
        const paginationMeta = body.pagination ?? body.meta ?? {}

        const resolvedPage =
          Number(paginationMeta.page ?? body.page ?? pageIndex + 1) || 1
        const resolvedPageSize =
          Number(paginationMeta.pageSize ?? body.pageSize ?? pageSize) ||
          pageSize
        const resolvedTotalUsers =
          Number(paginationMeta.totalUsers ?? body.totalUsers ?? list.length) ||
          list.length
        const resolvedTotalPages =
          Number(paginationMeta.totalPages ?? body.totalPages) ||
          Math.max(
            1,
            resolvedPageSize > 0
              ? Math.ceil(resolvedTotalUsers / resolvedPageSize)
              : 1
          )

        setUsers(list)
        setTotalPages(Math.max(resolvedTotalPages, 1))
        if (body.summary) {
          setSummary({
            totalUsers: body.summary.totalUsers ?? resolvedTotalUsers,
            activeUsers:
              body.summary.activeUsers ??
              Math.max(
                (body.summary.totalUsers ?? resolvedTotalUsers) -
                  (body.summary.bannedUsers ?? 0),
                0
              ),
            bannedUsers: body.summary.bannedUsers ?? 0,
            monthUsers: body.summary.monthUsers ?? 0,
          })
        } else {
          setSummary((prev) => ({
            ...prev,
            totalUsers: resolvedTotalUsers,
          }))
        }

        const resolvedPageIndex = Math.max(0, resolvedPage - 1)

        setPagination((prev: PaginationState) => {
          if (
            prev.pageIndex === resolvedPageIndex &&
            prev.pageSize === resolvedPageSize
          ) {
            return prev
          }

          return {
            pageIndex: resolvedPageIndex,
            pageSize: resolvedPageSize,
          }
        })
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return
        }

        setError(
          err instanceof Error
            ? err.message
            : "Ocurrió un error inesperado al cargar los usuarios"
        )
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [pageIndex, pageSize, searchQuery, effectiveSorting]
  )

  useEffect(() => {
    if (status === "loading") {
      return
    }

    if (!session) {
      router.push("/")
      return
    }

    const controller = new AbortController()

    void fetchUsers({ signal: controller.signal })

    return () => controller.abort()
  }, [session, status, fetchUsers, router])

  const handleSortingChange = (
    updater: SortingState | ((old: SortingState) => SortingState)
  ) => {
    setSorting((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater
      if (!next.length) {
        return [{ id: "createdAt", desc: false }]
      }
      return next
    })
    setPagination((prev) => ({
      ...prev,
      pageIndex: 0,
    }))
  }

  const handlePageSizeChange = (value: string) => {
    const parsed = Number(value)
    if (!Number.isNaN(parsed) && parsed > 0) {
      setPagination({
        pageIndex: 0,
        pageSize: parsed,
      })
    }
  }

  const handleRefresh = () => {
    void fetchUsers()
  }

  const table = useReactTable<AdminUser>({
    data: users,
    columns: adminUsersColumns,
    pageCount: totalPages,
    state: {
      pagination,
      sorting,
    },
    onPaginationChange: setPagination,
    onSortingChange: handleSortingChange,
    manualPagination: true,
    manualSorting: true,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
  })

  if (status === "loading") {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-la-nube-primary" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <UsersIcon className="h-6 w-6 text-la-nube-primary" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Usuarios
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Revisa y gestiona los usuarios registrados en La Nube.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="space-y-1">
            <CardTitle>Total de usuarios</CardTitle>
            <CardDescription>
              Usuarios registrados en la plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-full flex flex-row items-end">
            <p className="text-3xl font-semibold text-la-nube-primary">
              {summary.totalUsers}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="space-y-1">
            <CardTitle>Usuarios activos</CardTitle>
            <CardDescription>
              Usuarios sin sanciones vigentes.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-full flex flex-row items-end">
            <p className="text-3xl font-semibold text-green-600 dark:text-green-400">
              {summary.activeUsers}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="space-y-1">
            <CardTitle>Usuarios bloqueados</CardTitle>
            <CardDescription>
              Usuarios con una sanción activa.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-full flex flex-row items-end">
            <p className="text-3xl font-semibold text-red-600 dark:text-red-400">
              {summary.bannedUsers}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="space-y-1">
            <CardTitle>Altas este mes</CardTitle>
            <CardDescription>
              Registros creados desde el inicio de mes.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-full flex flex-row items-end">
            <p className="text-3xl font-semibold text-indigo-600 dark:text-indigo-400">
              {summary.monthUsers}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card dark:glass-card-dark">
        <CardHeader>
          <CardTitle>Lista de usuarios</CardTitle>
          <CardDescription>
            Gestión de usuarios con soporte para búsqueda y paginación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <form
              className="relative w-full md:max-w-sm"
              onSubmit={(event) => event.preventDefault()}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar por nombre, correo o DNI"
                className="pl-9"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                aria-label="Buscar usuarios"
              />
            </form>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Por página
                </span>
                <Select
                  value={String(pagination.pageSize)}
                  onValueChange={handlePageSizeChange}
                >
                  <SelectTrigger className="min-w-[110px]">
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                className="flex items-center gap-2"
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Actualizar
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <DataTable
            table={table}
            isLoading={loading && users.length === 0}
            loadingMessage="Cargando usuarios…"
            emptyMessage="No se encontraron usuarios con los filtros seleccionados."
          />

          <DataTablePagination
            table={table}
            totalItems={summary.totalUsers}
            isLoading={loading && users.length > 0}
            loadingLabel="Actualizando…"
          />
        </CardContent>
      </Card>
    </div>
  )
}


