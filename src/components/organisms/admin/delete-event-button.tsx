"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, apiSend } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Cancels (soft-deletes) an event after confirmation: frees the resource, keeps history.
 *
 * Milestone 14: vive en la "Zona de peligro" del aside del formulario de evento. La
 * confirmación pasó de `window.confirm` a un diálogo responsive (drawer en el teléfono) y el
 * pedido a `apiSend` (convención del proyecto: nada de `fetch` directo desde componentes).
 */
export function DeleteEventButton({
  id,
  onDone,
}: {
  id: string;
  /**
   * Se llama justo antes de redirigir tras cancelar con éxito — el formulario lo usa para
   * soltar su guardia de "cambios sin guardar" (salir después de cancelar es intencional).
   */
  onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiSend(`/api/admin/events/${id}`, "DELETE");
      toast.success("Evento cancelado");
      setOpen(false);
      onDone?.();
      router.push("/admin/events");
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo cancelar el evento"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        Cancelar evento
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent className="sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              ¿Cancelar este evento?
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Se liberará el recurso reservado y dejará de estar disponible para
              inscripciones. Los inscriptos quedan registrados. Podés
              reactivarlo editándolo y guardando.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={deleting}
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Cancelando…" : "Cancelar evento"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
