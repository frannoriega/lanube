"use client";

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
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

interface SpaceRow {
  id: string;
  name: string;
  slug: string;
  capacity: number;
  isExclusive: boolean;
  isReservable: boolean;
  isFeatured: boolean;
  displayOrder: number;
  iconName: string | null;
}

export function SpacesManager() {
  const { data, firstTime, refetch } = useApi<SpaceRow[]>("/api/admin/spaces");
  const spaces = data ?? [];
  const [deleting, setDeleting] = useState<SpaceRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [reordering, setReordering] = useState(false);

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
        <Button asChild>
          <Link href="/admin/spaces/new">
            <Plus className="mr-1 h-4 w-4" /> Nuevo espacio
          </Link>
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
                    <Link
                      href={`/admin/spaces/${space.id}/edit`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      {(() => {
                        const Icon = getSpaceIcon(space.iconName);
                        return (
                          <Icon className="h-4 w-4 shrink-0 text-la-nube-selected dark:text-la-nube-secondary" />
                        );
                      })()}
                      {space.name}
                    </Link>
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
                      asChild
                      aria-label={`Editar ${space.name}`}
                    >
                      <Link href={`/admin/spaces/${space.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
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
