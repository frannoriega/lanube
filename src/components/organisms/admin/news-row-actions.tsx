"use client";

import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage, apiSend } from "@/lib/api/client";
import { Check, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function NewsRowActions({
  id,
  title,
  canApprove,
  showDecision,
  isPublished,
  isDeleted,
}: {
  id: string;
  title: string;
  canApprove: boolean;
  /** Show approve/reject (a PENDING_REVIEW row, or one with a pending EDIT/PAUSE/DELETE). */
  showDecision: boolean;
  /** A plain author can't delete a live post directly — they request it instead. */
  isPublished: boolean;
  isDeleted: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const decide = async (decision: "APPROVED" | "REJECTED", why?: string) => {
    setBusy(true);
    try {
      await apiSend(`/api/admin/news/${id}/decision`, "POST", {
        decision,
        reason: why ?? null,
      });
      toast.success(
        decision === "APPROVED" ? "Nota aprobada" : "Nota rechazada",
      );
      setRejecting(false);
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo procesar la decisión"));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    setBusy(true);
    try {
      await apiSend(`/api/admin/news/${id}`, "DELETE");
      toast.success("Nota eliminada");
      setDeleting(false);
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo eliminar la nota"));
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    setBusy(true);
    try {
      await apiSend(`/api/admin/news/${id}/restore`, "POST");
      toast.success("Nota restaurada");
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo restaurar la nota"));
    } finally {
      setBusy(false);
    }
  };

  // Un autor sin news:approve no puede bajar/eliminar su propia nota publicada con un click
  // — tiene que pedirlo desde el formulario y que un admin lo decida.
  const canDeleteDirectly = canApprove || !isPublished;

  return (
    <div className="flex items-center justify-end gap-1">
      {canApprove && isDeleted ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={onRestore}
          aria-label={`Restaurar ${title}`}
        >
          Restaurar
        </Button>
      ) : null}
      {canApprove && showDecision ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => decide("APPROVED")}
            aria-label={`Aprobar ${title}`}
          >
            <Check className="h-4 w-4 text-green-600" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setRejecting(true)}
            aria-label={`Rechazar ${title}`}
          >
            <X className="h-4 w-4 text-destructive" />
          </Button>
        </>
      ) : null}
      <Button variant="ghost" size="sm" asChild aria-label={`Editar ${title}`}>
        <Link href={`/admin/news/${id}`}>
          <Pencil className="h-4 w-4" />
        </Link>
      </Button>
      {canDeleteDirectly ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDeleting(true)}
          aria-label={`Eliminar ${title}`}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      ) : null}

      <ResponsiveDialog open={rejecting} onOpenChange={setRejecting}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              Rechazar &ldquo;{title}&rdquo;
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              El motivo se muestra al autor.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo (obligatorio)"
          />
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setRejecting(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !reason.trim()}
              onClick={() => decide("REJECTED", reason.trim())}
            >
              Rechazar
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog open={deleting} onOpenChange={setDeleting}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              ¿Eliminar &ldquo;{title}&rdquo;?
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {isPublished
                ? "Deja de estar visible en el sitio. Se puede restaurar después."
                : "Esta acción no se puede deshacer."}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setDeleting(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={busy} onClick={onDelete}>
              Eliminar
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
