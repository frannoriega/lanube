"use client";

import { IconPicker } from "@/components/molecules/icon-picker";
import { ImageUpload } from "@/components/molecules/image-upload";
import { getSpaceIcon } from "@/lib/constants/spaces";
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
import { Switch } from "@/components/ui/switch";
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
import { apiErrorMessage, apiSend, invalidateApi } from "@/lib/api/client";
import { spaceInputSchema, type SpaceInput } from "@/lib/schemas/config";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

interface SpaceRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  capacity: number;
  isExclusive: boolean;
  isReservable: boolean;
  isFeatured: boolean;
  displayOrder: number;
  iconName: string | null;
  imageUrl: string | null;
}

const EMPTY: SpaceInput = {
  name: "",
  slug: "",
  description: "",
  capacity: 1,
  isExclusive: false,
  isReservable: true,
  isFeatured: false,
  displayOrder: 0,
  iconName: "",
  imageUrl: null,
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function SpacesManager() {
  const { data, firstTime, refetch } = useApi<SpaceRow[]>("/api/admin/spaces");
  const spaces = data ?? [];
  const [editing, setEditing] = useState<SpaceRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<SpaceRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [reordering, setReordering] = useState(false);

  const form = useForm<SpaceInput>({
    resolver: zodResolver(spaceInputSchema),
    defaultValues: EMPTY,
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (space: SpaceRow) => {
    setEditing(space);
    form.reset({
      name: space.name,
      slug: space.slug,
      description: space.description,
      capacity: space.capacity,
      isExclusive: space.isExclusive,
      isReservable: space.isReservable,
      isFeatured: space.isFeatured,
      displayOrder: space.displayOrder,
      iconName: space.iconName ?? "",
      imageUrl: space.imageUrl,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: SpaceInput) => {
    setBusy(true);
    const payload = {
      ...values,
      iconName: values.iconName || null,
      imageUrl: values.imageUrl || null,
    };
    try {
      if (editing) {
        await apiSend(`/api/admin/spaces/${editing.id}`, "PUT", payload);
        toast.success("Espacio actualizado");
      } else {
        await apiSend("/api/admin/spaces", "POST", payload);
        toast.success("Espacio creado");
      }
      setDialogOpen(false);
      invalidateApi("/api/admin/spaces");
      await refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo guardar el espacio"));
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= spaces.length) return;
    const orderedIds = spaces.map((s) => s.id);
    [orderedIds[index], orderedIds[target]] = [
      orderedIds[target],
      orderedIds[index],
    ];
    setReordering(true);
    try {
      await apiSend("/api/admin/spaces/reorder", "POST", { orderedIds });
      invalidateApi("/api/admin/spaces");
      await refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo reordenar los espacios"));
    } finally {
      setReordering(false);
    }
  };

  const onDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiSend(`/api/admin/spaces/${deleting.id}`, "DELETE");
      toast.success("Espacio eliminado");
      setDeleting(null);
      invalidateApi("/api/admin/spaces");
      await refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo eliminar el espacio"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="glass-card dark:glass-card-dark">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Espacios</CardTitle>
          <CardDescription>
            Espacios reservables del centro (coworking, laboratorio, …) y su
            capacidad.
          </CardDescription>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> Nuevo espacio
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
                <TableHead className="w-20">Orden</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="w-24">Capacidad</TableHead>
                <TableHead>Atributos</TableHead>
                <TableHead className="w-28 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {spaces.map((space, index) => (
                <TableRow key={space.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={reordering || index === 0}
                        onClick={() => move(index, -1)}
                        aria-label={`Subir ${space.name}`}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={reordering || index === spaces.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label={`Bajar ${space.name}`}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {(() => {
                        const Icon = getSpaceIcon(space.iconName);
                        return (
                          <Icon className="h-4 w-4 shrink-0 text-la-nube-selected dark:text-la-nube-secondary" />
                        );
                      })()}
                      {space.name}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {space.slug}
                  </TableCell>
                  <TableCell>{space.capacity}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {space.isReservable && (
                        <Badge variant="secondary">Reservable</Badge>
                      )}
                      {space.isExclusive && (
                        <Badge variant="secondary">Exclusivo</Badge>
                      )}
                      {space.isFeatured && (
                        <Badge variant="secondary">Destacado</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(space)}
                      aria-label={`Editar ${space.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleting(space)}
                      aria-label={`Eliminar ${space.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {spaces.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    No hay espacios definidos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create / edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar espacio" : "Nuevo espacio"}
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
                      <Input
                        placeholder="Sala de reuniones"
                        {...field}
                        onBlur={() => {
                          field.onBlur();
                          if (!editing && !form.getValues("slug")) {
                            form.setValue("slug", slugify(field.value));
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="sala-de-reuniones" {...field} />
                    </FormControl>
                    <FormDescription>
                      Identificador para URLs; único por espacio.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="iconName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icono</FormLabel>
                    <FormControl>
                      <IconPicker
                        value={field.value ?? null}
                        onChange={field.onChange}
                        disabled={busy}
                      />
                    </FormControl>
                    <FormDescription>
                      Se muestra en el menú lateral, las tarjetas y el
                      calendario del espacio.
                    </FormDescription>
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
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacidad</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        value={field.value}
                        onChange={(e) =>
                          field.onChange(
                            Number.isNaN(e.target.valueAsNumber)
                              ? 1
                              : e.target.valueAsNumber,
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => {
                  const slug = form.watch("slug");
                  return (
                    <FormItem>
                      <FormLabel>Imagen</FormLabel>
                      <FormControl>
                        <ImageUpload
                          value={field.value ?? null}
                          onChange={field.onChange}
                          uploadUrl={`/api/admin/spaces/upload${slug ? `?slug=${encodeURIComponent(slug)}` : ""}`}
                          alt={form.getValues("name") || "Espacio"}
                          disabled={busy}
                        />
                      </FormControl>
                      <FormDescription>
                        Se muestra en la página principal y en las páginas del
                        espacio.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              {(
                [
                  {
                    name: "isReservable",
                    label: "Reservable",
                    hint: "Los usuarios pueden reservarlo desde su panel.",
                  },
                  {
                    name: "isExclusive",
                    label: "Exclusivo",
                    hint: "Una sola reserva aprobada a la vez (sin compartir capacidad).",
                  },
                  {
                    name: "isFeatured",
                    label: "Destacado",
                    hint: "Se muestra en la página principal.",
                  },
                ] as const
              ).map((flag) => (
                <FormField
                  key={flag.name}
                  control={form.control}
                  name={flag.name}
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                      <div>
                        <FormLabel>{flag.label}</FormLabel>
                        <FormDescription>{flag.hint}</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ))}
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
              Solo puede eliminarse si no tiene eventos ni reservas asociadas.
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
