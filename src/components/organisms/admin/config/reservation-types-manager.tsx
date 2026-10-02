"use client";

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
import { useApi } from "@/hooks/use-api";
import { apiErrorMessage, apiSend, invalidateApi } from "@/lib/api/client";
import {
  reservationTypeInputSchema,
  type ReservationTypeInput,
} from "@/lib/schemas/config";
import type { ReservationType } from "@/types/prisma";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { LoadError } from "@/components/molecules/load-error";

const EMPTY: ReservationTypeInput = { name: "", displayOrder: 0 };

export function ReservationTypesManager() {
  const { data, error, firstTime, refetch } = useApi<ReservationType[]>(
    "/api/reservation-types",
  );
  const types = data ?? [];
  const [editing, setEditing] = useState<ReservationType | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<ReservationType | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm<ReservationTypeInput>({
    resolver: zodResolver(reservationTypeInputSchema),
    defaultValues: EMPTY,
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (type: ReservationType) => {
    setEditing(type);
    form.reset({ name: type.name, displayOrder: type.displayOrder });
    setDialogOpen(true);
  };

  const onSubmit = async (values: ReservationTypeInput) => {
    setBusy(true);
    try {
      if (editing) {
        await apiSend(
          `/api/admin/reservation-types/${editing.id}`,
          "PUT",
          values,
        );
        toast.success("Tipo actualizado");
      } else {
        await apiSend("/api/admin/reservation-types", "POST", values);
        toast.success("Tipo creado");
      }
      setDialogOpen(false);
      invalidateApi("/api/reservation-types");
      await refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo guardar el tipo"));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiSend(`/api/admin/reservation-types/${deleting.id}`, "DELETE");
      toast.success("Tipo eliminado");
      setDeleting(null);
      invalidateApi("/api/reservation-types");
      await refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo eliminar el tipo"));
    } finally {
      setBusy(false);
    }
  };

  /*
   * Columnas del `DataTable` (milestone 14): tabla desde `md`, tarjetas por debajo. Cada
   * columna declara su rol en la tarjeta con `meta.mobile` (ver `MobileColumnRole`).
   */
  const columns: ColumnDef<(typeof types)[number]>[] = [
    {
      id: "name",
      header: "Nombre",
      meta: { mobile: "title", label: "Nombre" },
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    // El `code` interno (p. ej. "CONFERENCE") ya no se muestra (hallazgo P): es un
    // identificador técnico que el admin no necesita leer. La columna "Orden" sigue hasta que
    // llegue el modo "Reordenar".
    {
      id: "displayOrder",
      header: "Orden",
      meta: { label: "Orden" },
      cell: ({ row }) => row.original.displayOrder,
    },
    {
      id: "actions",
      header: () => <div className="text-right">Acciones</div>,
      meta: { mobile: "actions", label: "Acciones" },
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEdit(item)}
              aria-label={`Editar ${item.name}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleting(item)}
              aria-label={`Eliminar ${item.name}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      },
    },
  ];
  const table = useStaticTable(types, columns);

  return (
    <Card className="glass-card dark:glass-card-dark">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Tipos de reserva</CardTitle>
          <CardDescription>
            Categorías disponibles al reservar espacios y crear eventos (taller,
            reunión, …).
          </CardDescription>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> Nuevo tipo
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <LoadError
            message="No se pudieron cargar los tipos de reserva."
            onRetry={() => void refetch()}
          />
        ) : firstTime ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <DataTable table={table} emptyMessage="No hay tipos definidos." />
        )}
      </CardContent>

      {/* Create / edit */}
      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {editing ? "Editar tipo" : "Nuevo tipo de reserva"}
            </ResponsiveDialogTitle>
            {editing && (
              <ResponsiveDialogDescription>
                El código <span className="font-mono">{editing.code}</span> no
                cambia (las reservas existentes lo referencian).
              </ResponsiveDialogDescription>
            )}
          </ResponsiveDialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Taller" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Orden</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value}
                        onChange={(e) =>
                          field.onChange(
                            Number.isNaN(e.target.valueAsNumber)
                              ? 0
                              : e.target.valueAsNumber,
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Posición en los selectores (menor = primero).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <ResponsiveDialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={busy}>
                  {editing ? "Guardar" : "Crear"}
                </Button>
              </ResponsiveDialogFooter>
            </form>
          </Form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Delete confirm */}
      <ResponsiveDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              ¿Eliminar {deleting?.name}?
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Solo puede eliminarse si ningún evento ni reserva lo usa.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={busy}>
              Eliminar
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </Card>
  );
}
