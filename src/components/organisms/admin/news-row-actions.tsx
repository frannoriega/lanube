"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
}: {
  id: string;
  title: string;
  canApprove: boolean;
  /** Show approve/reject (only meaningful for a PENDING_REVIEW row). */
  showDecision: boolean;
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

  return (
    <div className="flex items-center justify-end gap-1">
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
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setDeleting(true)}
        aria-label={`Eliminar ${title}`}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>

      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar &ldquo;{title}&rdquo;</DialogTitle>
            <DialogDescription>
              El motivo se muestra al autor.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo (opcional)"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => decide("REJECTED", reason || undefined)}
            >
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar &ldquo;{title}&rdquo;?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={busy} onClick={onDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
