"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

/** Cancels (soft-deletes) an event after confirmation: frees the resource, keeps history. */
export function DeleteEventButton({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (
      !window.confirm(
        "¿Cancelar este evento? Se liberará el recurso reservado y dejará de estar disponible para inscripciones. Los inscriptos quedan registrados.",
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message ?? "No se pudo cancelar el evento");
        return;
      }
      toast.success("Evento cancelado");
      router.push("/admin/events");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
      {deleting ? "Cancelando…" : "Cancelar evento"}
    </Button>
  );
}
