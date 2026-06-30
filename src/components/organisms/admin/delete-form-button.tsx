"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function DeleteFormButton({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (
      !window.confirm(
        "¿Eliminar este formulario? Los eventos que ya lo usan no se ven afectados.",
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/forms/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message ?? "No se pudo eliminar el formulario");
        return;
      }
      toast.success("Formulario eliminado");
      router.push("/admin/forms");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
      {deleting ? "Eliminando…" : "Eliminar"}
    </Button>
  );
}
