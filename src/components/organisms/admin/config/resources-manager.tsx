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
import { useApi } from "@/hooks/use-api";
import { apiErrorMessage, apiSend, invalidateApi } from "@/lib/api/client";
import { resourceInputSchema, type ResourceInput } from "@/lib/schemas/config";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

interface ResourceRow {
  id: string;
  name: string;
  serialNumber: string | null;
}

const EMPTY: ResourceInput = { name: "", serialNumber: "" };

export function ResourcesManager() {
  const { data, firstTime, refetch } = useApi<ResourceRow[]>(
    "/api/admin/resources",
  );
  const resources = data ?? [];
  const [editing, setEditing] = useState<ResourceRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<ResourceRow | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm<ResourceInput>({
    resolver: zodResolver(resourceInputSchema),
    defaultValues: EMPTY,
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (resource: ResourceRow) => {
    setEditing(resource);
    form.reset({
      name: resource.name,
      serialNumber: resource.serialNumber ?? "",
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: ResourceInput) => {
    setBusy(true);
    try {
      if (editing) {
        await apiSend(`/api/admin/resources/${editing.id}`, "PUT", values);
        toast.success("Recurso actualizado");
      } else {
        await apiSend("/api/admin/resources", "POST", values);
        toast.success("Recurso creado");
      }
      setDialogOpen(false);
      invalidateApi("/api/admin/resources");
      await refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo guardar el recurso"));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiSend(`/api/admin/resources/${deleting.id}`, "DELETE");
      toast.success("Recurso eliminado");
      setDeleting(null);
      invalidateApi("/api/admin/resources");
      await refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo eliminar el recurso"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="glass-card dark:glass-card-dark">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Recursos</CardTitle>
          <CardDescription>
            Inventario de equipamiento físico (impresoras 3D, proyectores, …).
          </CardDescription>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> Nuevo recurso
        </Button>
      </CardHeader>
      <CardContent>
        {firstTime ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Número de serie</TableHead>
                <TableHead className="w-28 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.map((resource) => (
                <TableRow key={resource.id}>
                  <TableCell className="font-medium">{resource.name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {resource.serialNumber ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(resource)}
                      aria-label={`Editar ${resource.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleting(resource)}
                      aria-label={`Eliminar ${resource.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {resources.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    No hay recursos registrados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create / edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar recurso" : "Nuevo recurso"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Impresora 3D" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de serie (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="SN-0001"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
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
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar {deleting?.name}?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={busy}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
