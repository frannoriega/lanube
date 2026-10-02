"use client";

/**
 * "Reordenar destacados" (milestone 14, decisiones sobre las propuestas): abre el modo de
 * reordenamiento compartido (`ReorderList`) sobre los elementos **destacados** de una lista
 * (eventos o noticias), que son los que encabezan el landing.
 *
 * Reemplaza el campo numérico "Orden entre destacados(as)" que tenían los formularios: el
 * orden se decide mirando la lista entera, no escribiendo un número en cada elemento por
 * separado. Lo usan las páginas de Eventos y Noticias (Server Components) — por eso es un
 * botón autocontenido que pide los datos al abrirse (`GET endpoint`) y, al guardar, hace un
 * `router.refresh()` para que la página del servidor vuelva a leer el orden.
 */

import { ReorderList } from "@/components/molecules/reorder-list";
import { LoadError } from "@/components/molecules/load-error";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { apiErrorMessage, apiSend, invalidateApi } from "@/lib/api/client";
import { ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function FeaturedReorderButton({
  endpoint,
  labelKey,
  triggerLabel,
  title,
  emptyMessage,
}: {
  /** GET devuelve `[{ id, <labelKey> }]` en el orden actual; POST recibe `{ orderedIds }`. */
  endpoint: string;
  /** Campo de cada elemento que se muestra como rótulo (`name` en eventos, `title` en noticias). */
  labelKey: "name" | "title";
  triggerLabel: string;
  title: string;
  emptyMessage: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Solo pide los datos con el diálogo abierto (y fuerza datos frescos cada vez que se abre).
  const { data, error, firstTime, refetch } = useApi<
    Array<{ id: string } & Record<string, string>>
  >(open ? endpoint : null);

  const save = async (orderedIds: string[]) => {
    try {
      await apiSend(endpoint, "POST", { orderedIds });
      toast.success("Orden guardado");
      invalidateApi(endpoint);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo guardar el orden"));
      throw err;
    }
  };

  const items = (data ?? []).map((item) => ({
    id: item.id,
    label: item[labelKey] ?? item.id,
  }));

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          invalidateApi(endpoint);
          setOpen(true);
        }}
      >
        <ArrowUpDown className="mr-1 h-4 w-4" /> {triggerLabel}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent className="sm:max-w-lg">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Es el orden en que aparecen al principio del landing.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {error ? (
            <LoadError
              message="No se pudo cargar la lista."
              onRetry={() => void refetch()}
            />
          ) : firstTime || !data ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length < 2 ? (
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            // `key` por apertura: cada vez que se abre arranca del orden guardado.
            <ReorderList
              key={items.map((i) => i.id).join(",")}
              items={items}
              onSave={save}
              onCancel={() => setOpen(false)}
            />
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
